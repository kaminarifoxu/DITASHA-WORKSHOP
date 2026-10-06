#include "version.h"
#include "update-core.h"
#define UPDATE_RESULT (WM_APP+45)
static LONG update_pending=0;
static CRITICAL_SECTION update_lock;
static char update_status[512]="Belum diperiksa",update_version[48]="";
static WCHAR update_file[MAX_PATH];
static char update_digest[65];static DWORD update_size=0;
static BOOL auto_updates=TRUE;
typedef struct UpdateJob{HWND window;BOOL manual,download;}UpdateJob;
typedef struct UpdateResult{BOOL ready,manual;}UpdateResult;
static void set_update_status(const char *status){EnterCriticalSection(&update_lock);snprintf(update_status,sizeof(update_status),"%s",status);LeaveCriticalSection(&update_lock);}
static void update_snapshot(char *status,char *version,WCHAR *file){EnterCriticalSection(&update_lock);strcpy(status,update_status);strcpy(version,update_version);wcscpy(file,update_file);LeaveCriticalSection(&update_lock);}
static BOOL github_token_valid(const char *token){
    size_t n=strlen(token);if(n<20||n>256)return FALSE;
    if(strncmp(token,"github_pat_",11)&&strncmp(token,"ghp_",4))return FALSE;
    for(size_t i=0;i<n;++i)if(!isalnum((unsigned char)token[i])&&token[i]!='_')return FALSE;return TRUE;
}
static char *load_github_token(void){
    DWORD n=0;char *encrypted=read_local(L"github-update.key",65536,&n,NULL);if(!encrypted)return NULL;
    DATA_BLOB in={n,(BYTE*)encrypted},out={0};BOOL ok=CryptUnprotectData(&in,NULL,NULL,NULL,NULL,CRYPTPROTECT_UI_FORBIDDEN,&out);free(encrypted);if(!ok)return NULL;
    char *token=calloc((size_t)out.cbData+1,1);if(token)memcpy(token,out.pbData,out.cbData);SecureZeroMemory(out.pbData,out.cbData);LocalFree(out.pbData);
    if(token&&!github_token_valid(token)){SecureZeroMemory(token,strlen(token));free(token);token=NULL;}return token;
}
static BOOL save_github_token(const char *token){
    if(!github_token_valid(token))return FALSE;
    DATA_BLOB in={(DWORD)strlen(token),(BYTE*)token},out={0};if(!CryptProtectData(&in,L"DITASHA GitHub updates",NULL,NULL,NULL,CRYPTPROTECT_UI_FORBIDDEN,&out))return FALSE;
    BOOL ok=write_local(L"github-update.key",out.pbData,out.cbData,FALSE);LocalFree(out.pbData);return ok;
}
#include "update-install.h"
/* Redirects are followed manually. The GitHub token is sent only to api.github.com,
   and never to GitHub's signed asset CDN URLs. */
static char *github_get(const WCHAR *initial,const char *token,BOOL asset,const WCHAR *destination,DWORD expected,DWORD *http_status){
    WCHAR address[8192];if(wcslen(initial)>=8192)return NULL;wcscpy(address,initial);
    HINTERNET session=WinHttpOpen(L"DITASHA-Updater/" APP_VERSION_W,WINHTTP_ACCESS_TYPE_AUTOMATIC_PROXY,WINHTTP_NO_PROXY_NAME,WINHTTP_NO_PROXY_BYPASS,0);
    if(!session)return NULL;WinHttpSetTimeouts(session,15000,15000,30000,60000);char *result=NULL;
    for(int redirects=0;redirects<8;++redirects){
        WCHAR host[512],path[8192],extra[8192];URL_COMPONENTSW url={0};url.dwStructSize=sizeof(url);url.lpszHostName=host;url.dwHostNameLength=512;url.lpszUrlPath=path;url.dwUrlPathLength=8192;url.lpszExtraInfo=extra;url.dwExtraInfoLength=8192;
        if(!WinHttpCrackUrl(address,0,0,&url)||url.nScheme!=INTERNET_SCHEME_HTTPS||url.nPort!=443||url.dwUserNameLength||url.dwPasswordLength)break;
        host[url.dwHostNameLength]=0;path[url.dwUrlPathLength]=0;extra[url.dwExtraInfoLength]=0;
        BOOL api=!_wcsicmp(host,L"api.github.com");
        if(api&&wcsncmp(path,L"/repos/kaminarifoxu/DITASHA-WORKSHOP/",wcslen(L"/repos/kaminarifoxu/DITASHA-WORKSHOP/")))break;
        if(!api&&_wcsicmp(host,L"release-assets.githubusercontent.com")&&_wcsicmp(host,L"objects.githubusercontent.com")&&_wcsicmp(host,L"github.com"))break;
        if(!asset&&!api)break;if(wcslen(path)+wcslen(extra)>=8192)break;wcscat(path,extra);
        HINTERNET connection=WinHttpConnect(session,host,443,0);if(!connection)break;
        HINTERNET request=WinHttpOpenRequest(connection,L"GET",path,NULL,WINHTTP_NO_REFERER,WINHTTP_DEFAULT_ACCEPT_TYPES,WINHTTP_FLAG_SECURE);
        if(!request){WinHttpCloseHandle(connection);break;}
        DWORD no_redirect=WINHTTP_OPTION_REDIRECT_POLICY_NEVER;BOOL ok=WinHttpSetOption(request,WINHTTP_OPTION_REDIRECT_POLICY,&no_redirect,sizeof(no_redirect));
        if(api){
            ok=ok&&WinHttpAddRequestHeaders(request,asset?L"Accept: application/octet-stream\r\nX-GitHub-Api-Version: 2022-11-28\r\n":L"Accept: application/vnd.github+json\r\nX-GitHub-Api-Version: 2022-11-28\r\n",(DWORD)-1L,WINHTTP_ADDREQ_FLAG_ADD);
            if(token){char auth[512];snprintf(auth,sizeof(auth),"Authorization: Bearer %s\r\n",token);WCHAR *wide=to_wide(auth);SecureZeroMemory(auth,sizeof(auth));ok=ok&&wide&&WinHttpAddRequestHeaders(request,wide,(DWORD)-1L,WINHTTP_ADDREQ_FLAG_ADD);if(wide){SecureZeroMemory(wide,wcslen(wide)*sizeof(WCHAR));free(wide);}}
        }
        ok=ok&&WinHttpSendRequest(request,WINHTTP_NO_ADDITIONAL_HEADERS,0,WINHTTP_NO_REQUEST_DATA,0,0,0)&&WinHttpReceiveResponse(request,NULL);
        DWORD status=0,n=sizeof(status);if(ok)ok=WinHttpQueryHeaders(request,WINHTTP_QUERY_STATUS_CODE|WINHTTP_QUERY_FLAG_NUMBER,WINHTTP_HEADER_NAME_BY_INDEX,&status,&n,WINHTTP_NO_HEADER_INDEX);
        if(http_status)*http_status=status;
        if(ok&&(status==301||status==302||status==303||status==307||status==308)){
            n=sizeof(address);ok=WinHttpQueryHeaders(request,WINHTTP_QUERY_LOCATION,WINHTTP_HEADER_NAME_BY_INDEX,address,&n,WINHTTP_NO_HEADER_INDEX);
            WinHttpCloseHandle(request);WinHttpCloseHandle(connection);if(ok)continue;break;
        }
        if(!ok||status!=200){WinHttpCloseHandle(request);WinHttpCloseHandle(connection);break;}
        HANDLE file=INVALID_HANDLE_VALUE;char *bytes=NULL;DWORD total=0,available=0;
        if(asset){file=CreateFileW(destination,GENERIC_WRITE,0,NULL,CREATE_ALWAYS,FILE_ATTRIBUTE_NORMAL,NULL);ok=file!=INVALID_HANDLE_VALUE;}else{bytes=calloc(1,1);ok=bytes!=NULL;}
        while(ok){
            if(!WinHttpQueryDataAvailable(request,&available)){ok=FALSE;break;}if(!available)break;
            DWORD limit=asset?expected:2000000;if(available>limit-total){ok=FALSE;break;}
            BYTE buffer[65536];DWORD request_size=available<sizeof(buffer)?available:(DWORD)sizeof(buffer),received=0;
            if(!WinHttpReadData(request,buffer,request_size,&received)||!received){ok=FALSE;break;}
            if(asset){DWORD written=0;ok=WriteFile(file,buffer,received,&written,NULL)&&written==received;
                char progress[128];snprintf(progress,sizeof(progress),"Mengunduh update: %lu%%",expected?(unsigned long)((total+received)*100ULL/expected):0);set_update_status(progress);
            }else{char *grown=realloc(bytes,(size_t)total+received+1);if(!grown){ok=FALSE;break;}bytes=grown;memcpy(bytes+total,buffer,received);bytes[total+received]=0;}
            total+=received;
        }
        if(asset){ok=ok&&total==expected&&FlushFileBuffers(file);if(file!=INVALID_HANDLE_VALUE)CloseHandle(file);if(ok)result=_strdup("downloaded");else DeleteFileW(destination);}
        else if(ok)result=bytes;else free(bytes);
        WinHttpCloseHandle(request);WinHttpCloseHandle(connection);break;
    }
    WinHttpCloseHandle(session);return result;
}
static DWORD WINAPI update_worker(void *context){
    UpdateJob *job=context;char *token=load_github_token();DWORD status=0;BOOL ready=FALSE;
    char prior_status[512],prior_version[48];WCHAR prior_file[MAX_PATH];update_snapshot(prior_status,prior_version,prior_file);
    set_update_status("Memeriksa rilis GitHub...");
    char *metadata=github_get(L"https://api.github.com/repos/kaminarifoxu/DITASHA-WORKSHOP/releases/latest",token,FALSE,NULL,0,&status);
    if(!metadata){set_update_status(status==401?"Token GitHub tidak valid. Ganti token di Pengaturan.":status==404?"Rilis belum tersedia atau token tidak punya akses ke repo privat.":status==403?"GitHub membatasi akses. Periksa izin token atau coba lagi nanti.":"Update tidak dapat diperiksa. Periksa internet.");goto done;}
    UpdateInfo info={0};
    if(!parse_release(metadata,&info)){free(metadata);set_update_status("Rilis tidak memiliki EXE x64 dan SHA-256 yang valid.");goto done;}free(metadata);
    if(!newer_version(info.version,APP_VERSION)){set_update_status("Aplikasi sudah memakai versi terbaru.");goto done;}
    if(!job->download){set_update_status("Versi baru tersedia. Tekan Periksa dan unduh update.");goto done;}
    WCHAR folder[MAX_PATH],temp[MAX_PATH],destination[MAX_PATH],url[1024];
    swprintf(folder,MAX_PATH,L"%ls\\Updates",data_root);int dir=SHCreateDirectoryExW(NULL,folder,NULL);
    if(dir!=ERROR_SUCCESS&&dir!=ERROR_ALREADY_EXISTS&&dir!=ERROR_FILE_EXISTS){set_update_status("Folder update tidak dapat dibuat.");goto done;}
    WCHAR *version=to_wide(info.version);WCHAR *asset=to_wide(info.asset_path);
    if(!version||!asset){free(version);free(asset);goto done;}
    swprintf(destination,MAX_PATH,L"%ls\\DITASHA-%ls.exe",folder,version);swprintf(url,1024,L"https://api.github.com%ls",asset);free(version);free(asset);
    char digest[65];DWORD size=0;
    if(!hash_file(destination,digest,&size)||size!=info.size||strcmp(digest,info.sha256)||!is_windows_x64(destination)){
        if(!GetTempFileNameW(folder,L"upd",0,temp)){set_update_status("File update tidak dapat dibuat.");goto done;}
        char *download=github_get(url,token,TRUE,temp,info.size,&status);BOOL downloaded=download!=NULL;free(download);
        if(!downloaded||!hash_file(temp,digest,&size)||size!=info.size||strcmp(digest,info.sha256)||!is_windows_x64(temp)){
            DeleteFileW(temp);set_update_status("Unduhan gagal diverifikasi. Versi lama tetap digunakan.");goto done;
        }
        if(!MoveFileExW(temp,destination,MOVEFILE_REPLACE_EXISTING|MOVEFILE_WRITE_THROUGH)){DeleteFileW(temp);set_update_status("Update belum tersimpan. Periksa akses folder.");goto done;}
    }
    EnterCriticalSection(&update_lock);wcscpy(update_file,destination);strcpy(update_version,info.version);strcpy(update_digest,info.sha256);update_size=info.size;LeaveCriticalSection(&update_lock);
    set_update_status("Update terunduh dan terverifikasi. Siap restart untuk memasang.");ready=TRUE;
done:
    if(token){SecureZeroMemory(token,strlen(token));free(token);}InterlockedExchange(&update_pending,0);
    UpdateResult *result=malloc(sizeof(UpdateResult));if(result){result->ready=ready&&(job->manual||strcmp(prior_version,update_version));result->manual=job->manual;if(!PostMessageW(job->window,UPDATE_RESULT,0,(LPARAM)result))free(result);}free(job);return 0;
}
static void start_update(HWND window,BOOL manual){
    if(!manual&&!auto_updates)return;if(InterlockedCompareExchange(&update_pending,1,0)!=0)return;
    UpdateJob *job=calloc(1,sizeof(UpdateJob));if(!job){InterlockedExchange(&update_pending,0);return;}
    job->window=window;job->manual=manual;job->download=manual||auto_updates;
    HANDLE thread=CreateThread(NULL,0,update_worker,job,0,NULL);if(thread)CloseHandle(thread);else{free(job);InterlockedExchange(&update_pending,0);set_update_status("Pemeriksaan update tidak dapat dimulai.");}
}
static BOOL start_program(const WCHAR *exe,const WCHAR *arguments){
    WCHAR command[2048];if(swprintf(command,2048,L"\"%ls\" %ls",exe,arguments?arguments:L"")<0)return FALSE;
    STARTUPINFOW startup={0};startup.cb=sizeof(startup);PROCESS_INFORMATION process={0};
    BOOL ok=CreateProcessW(exe,command,NULL,NULL,FALSE,0,NULL,NULL,&startup,&process);if(ok){CloseHandle(process.hThread);CloseHandle(process.hProcess);}return ok;
}
static void install_downloaded(HWND window){
    char status[512],version[48];WCHAR file[MAX_PATH],current[MAX_PATH];update_snapshot(status,version,file);
    if(!*file){MessageBoxW(window,L"No verified update is downloaded yet. Use Workspace > Check and download updates.",L"DITASHA updates",MB_OK|MB_ICONINFORMATION);return;}
    if(InterlockedCompareExchange(&ai_pending,0,0)){MessageBoxW(window,L"Wait for the current AI reply, then restart to install.",L"DITASHA updates",MB_OK|MB_ICONINFORMATION);return;}
    if(MessageBoxW(window,L"The new version has downloaded and passed its SHA-256 check.\n\nSave any unsaved notes before continuing. Saved chats, projects, employees and keys will remain.\n\nRestart now to install?",L"DITASHA update ready",MB_YESNO|MB_ICONINFORMATION)!=IDYES)return;
    char expected[65],actual[65];DWORD expected_size,size;
    EnterCriticalSection(&update_lock);strcpy(expected,update_digest);expected_size=update_size;LeaveCriticalSection(&update_lock);
    if(!GetModuleFileNameW(NULL,current,MAX_PATH)||!hash_file(file,actual,&size)||size!=expected_size||strcmp(actual,expected)||!is_windows_x64(file)){MessageBoxW(window,L"The downloaded update is unavailable. Check for updates again.",L"DITASHA updates",MB_OK|MB_ICONERROR);return;}
    WCHAR args[1024];swprintf(args,1024,L"--apply-update %lu \"%ls\"",(unsigned long)GetCurrentProcessId(),current);
    if(start_program(file,args))DestroyWindow(window);else MessageBoxW(window,L"Could not start the updater. The existing app is unchanged.",L"DITASHA updates",MB_OK|MB_ICONERROR);
}
static int apply_update(int argc,WCHAR **argv){
    if(argc!=4)return 1;WCHAR *end=NULL;unsigned long pid=wcstoul(argv[2],&end,10);if(!pid||*end||wcslen(argv[3])>MAX_PATH-16)return 1;
    HANDLE parent=OpenProcess(SYNCHRONIZE,FALSE,(DWORD)pid);if(parent){DWORD waited=WaitForSingleObject(parent,60000);CloseHandle(parent);if(waited!=WAIT_OBJECT_0)return 1;}
    WCHAR self[MAX_PATH];if(!GetModuleFileNameW(NULL,self,MAX_PATH))return 1;
    if(!replace_executable(self,argv[3])){MessageBoxW(NULL,L"The update could not replace the app. Your data is unchanged. Check that the EXE is in a writable folder, such as Downloads, then try again.",L"DITASHA update",MB_OK|MB_ICONERROR);start_program(argv[3],NULL);return 1;}
    if(!start_program(argv[3],NULL))return 1;return 0;
}
static void initialize_updates(void){
    InitializeCriticalSection(&update_lock);char *setting=read_local(L"auto-updates.txt",16,NULL,NULL);auto_updates=!setting||strcmp(setting,"off");free(setting);
}
static BOOL updater_operation(App *app,const WCHAR *operation,unsigned long id,const WCHAR *payload){
    if(!wcscmp(operation,L"updateStatus")){
        char status[512],version[48];WCHAR file[MAX_PATH];update_snapshot(status,version,file);
        char json[1024];snprintf(json,sizeof(json),"{\"status\":\"%s\",\"version\":\"%s\",\"ready\":%s,\"automatic\":%s,\"current\":\"%s\"}",status,version,*file?"true":"false",auto_updates?"true":"false",APP_VERSION);send_reply(app,id,TRUE,json);
    }else if(!wcscmp(operation,L"checkUpdate")){start_update(app->window,TRUE);send_reply(app,id,TRUE,"true");}
    else if(!wcscmp(operation,L"installUpdate")){send_reply(app,id,TRUE,"true");install_downloaded(app->window);}
    else if(!wcscmp(operation,L"autoUpdate")){BOOL enabled=!wcscmp(payload,L"on");if(write_local(L"auto-updates.txt",enabled?"on":"off",enabled?2:3,FALSE)){auto_updates=enabled;send_reply(app,id,TRUE,"true");if(enabled)start_update(app->window,FALSE);}else fail_reply(app,id,"Preferensi update tidak dapat disimpan.");}
    else if(!wcscmp(operation,L"saveGithubToken")){char *token=to_utf8(payload);BOOL ok=token&&save_github_token(token);if(token){SecureZeroMemory(token,strlen(token));free(token);}if(ok){send_reply(app,id,TRUE,"true");start_update(app->window,FALSE);}else fail_reply(app,id,"Token GitHub tidak valid atau tidak dapat disimpan.");}
    else if(!wcscmp(operation,L"hasGithubToken")){char *token=load_github_token();send_reply(app,id,TRUE,token?"true":"false");if(token){SecureZeroMemory(token,strlen(token));free(token);}}
    else if(!wcscmp(operation,L"removeGithubToken")){WCHAR path[MAX_PATH];local_path(L"github-update.key",path);if(DeleteFileW(path)||GetLastError()==ERROR_FILE_NOT_FOUND)send_reply(app,id,TRUE,"true");else fail_reply(app,id,"Token GitHub tidak dapat dihapus.");}
    else return FALSE;return TRUE;
}
