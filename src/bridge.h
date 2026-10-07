/* Native local persistence and fixed OpenRouter endpoint. All callbacks are STA;
   WinHTTP runs on a worker and replies are delivered through the window queue. */
#include <stdio.h>
#include <winhttp.h>
#include <wincrypt.h>
#define JSMN_STATIC
#define JSMN_STRICT
#include "jsmn.h"
#define BRIDGE_REPLY (WM_APP+44)
static WCHAR data_root[MAX_PATH];
#include "ai-slots.h"
HANDLER(BridgeHandler, ICoreWebView2WebMessageReceivedEventHandler, IID_ICoreWebView2WebMessageReceivedEventHandler)

typedef struct Reply { unsigned long id; BOOL ok; char *data; } Reply;
typedef struct AiJob { HWND window; unsigned long id; char *messages; WCHAR *authorization; BOOL coding; } AiJob;

static char *to_utf8(const WCHAR *text) {
    int n=WideCharToMultiByte(CP_UTF8,WC_ERR_INVALID_CHARS,text,-1,NULL,0,NULL,NULL);
    if(!n) return NULL; char *out=malloc((size_t)n);
    if(out && !WideCharToMultiByte(CP_UTF8,WC_ERR_INVALID_CHARS,text,-1,out,n,NULL,NULL)) {free(out);out=NULL;} return out;
}
static WCHAR *to_wide(const char *text) {
    int n=MultiByteToWideChar(CP_UTF8,MB_ERR_INVALID_CHARS,text,-1,NULL,0);
    if(!n) return NULL; WCHAR *out=malloc((size_t)n*sizeof(WCHAR));
    if(out && !MultiByteToWideChar(CP_UTF8,MB_ERR_INVALID_CHARS,text,-1,out,n)){free(out);out=NULL;} return out;
}
static BOOL json_root(const char *text,jsmntype_t type) {
    size_t length=strlen(text); if(!length || length>16000000) return FALSE;
    unsigned count=256; jsmntok_t *tokens=NULL; int result;
    do {
        free(tokens);tokens=calloc(count,sizeof(jsmntok_t));if(!tokens)return FALSE;
        jsmn_parser parser;jsmn_init(&parser);result=jsmn_parse(&parser,text,length,tokens,count);
        if(result==JSMN_ERROR_NOMEM)count*=2;
    }while(result==JSMN_ERROR_NOMEM && count<=1048576);
    while(length && (text[length-1]==' '||text[length-1]=='\r'||text[length-1]=='\n'||text[length-1]=='\t'))--length;
    BOOL valid=result>0 && tokens[0].type==type && tokens[0].end==(int)length;
    free(tokens);return valid;
}
static BOOL local_path(const WCHAR *name,WCHAR *out){return swprintf(out,MAX_PATH,L"%ls\\%ls",data_root,name)>0;}
static char *read_local(const WCHAR *name,DWORD limit,DWORD *size,BOOL *missing) {
    WCHAR path[MAX_PATH];local_path(name,path);if(missing)*missing=FALSE;
    HANDLE file=CreateFileW(path,GENERIC_READ,FILE_SHARE_READ,NULL,OPEN_EXISTING,FILE_ATTRIBUTE_NORMAL,NULL);
    if(file==INVALID_HANDLE_VALUE){if(missing)*missing=GetLastError()==ERROR_FILE_NOT_FOUND;return NULL;}
    DWORD n=GetFileSize(file,NULL),read=0;char *bytes=NULL;
    if(n!=INVALID_FILE_SIZE && n<=limit){bytes=malloc((size_t)n+1);if(bytes && (!ReadFile(file,bytes,n,&read,NULL)||read!=n)){free(bytes);bytes=NULL;}if(bytes)bytes[n]=0;}
    CloseHandle(file);if(size)*size=bytes?n:0;return bytes;
}
static BOOL write_local(const WCHAR *name,const void *bytes,DWORD size,BOOL backup) {
    WCHAR path[MAX_PATH],temp[MAX_PATH],bak[MAX_PATH];local_path(name,path);
    if(!GetTempFileNameW(data_root,L"DIT",0,temp))return FALSE;
    HANDLE file=CreateFileW(temp,GENERIC_WRITE,0,NULL,CREATE_ALWAYS,FILE_ATTRIBUTE_NORMAL,NULL);DWORD written=0;
    BOOL ok=file!=INVALID_HANDLE_VALUE && WriteFile(file,bytes,size,&written,NULL)&&written==size && FlushFileBuffers(file);
    if(file!=INVALID_HANDLE_VALUE)CloseHandle(file);
    if(ok && backup && GetFileAttributesW(path)!=INVALID_FILE_ATTRIBUTES){
        swprintf(bak,MAX_PATH,L"%ls.bak",path);ok=CopyFileW(path,bak,FALSE);
    }
    if(ok)ok=MoveFileExW(temp,path,MOVEFILE_REPLACE_EXISTING|MOVEFILE_WRITE_THROUGH);
    if(!ok)DeleteFileW(temp);return ok;
}
static BOOL valid_key(const char *key){
    size_t n=strlen(key);if(n<20||n>256||strncmp(key,"sk-or-",6))return FALSE;
    for(size_t i=0;i<n;++i)if(!((key[i]>='a'&&key[i]<='z')||(key[i]>='A'&&key[i]<='Z')||(key[i]>='0'&&key[i]<='9')||key[i]=='-'||key[i]=='_'))return FALSE;
    return TRUE;
}
static BOOL save_key(const char *key) {
    if(!valid_key(key))return FALSE;
    DATA_BLOB in={(DWORD)strlen(key),(BYTE*)key},out={0};
    if(!CryptProtectData(&in,L"DITASHA OpenRouter key",NULL,NULL,NULL,CRYPTPROTECT_UI_FORBIDDEN,&out))return FALSE;
    BOOL ok=write_local(L"openrouter.key",out.pbData,out.cbData,FALSE);LocalFree(out.pbData);return ok;
}
static char *load_key(void) {
    DWORD size=0;char *encrypted=read_local(L"openrouter.key",65536,&size,NULL);if(!encrypted)return NULL;
    DATA_BLOB in={size,(BYTE*)encrypted},out={0};BOOL ok=CryptUnprotectData(&in,NULL,NULL,NULL,NULL,CRYPTPROTECT_UI_FORBIDDEN,&out);
    free(encrypted);if(!ok)return NULL;
    char *key=calloc((size_t)out.cbData+1,1);if(key)memcpy(key,out.pbData,out.cbData);
    SecureZeroMemory(out.pbData,out.cbData);LocalFree(out.pbData);
    if(key && !valid_key(key)){SecureZeroMemory(key,strlen(key));free(key);key=NULL;}return key;
}
static void send_reply(App *app,unsigned long id,BOOL ok,const char *data) {
    if(!app->view)return;
    size_t n=strlen(data)+100;char *json=malloc(n);if(!json)return;
    snprintf(json,n,"{\"id\":%lu,\"ok\":%s,\"data\":%s}",id,ok?"true":"false",data);
    WCHAR *wide=to_wide(json);free(json);
    if(wide){ICoreWebView2_PostWebMessageAsJson(app->view,wide);free(wide);}
}
static void fail_reply(App *app,unsigned long id,const char *error) {
    char data[512];snprintf(data,sizeof(data),"{\"error\":\"%s\"}",error);send_reply(app,id,FALSE,data);
}
static DWORD WINAPI ai_worker(void *context) {
    AiJob *job=context;Reply *reply=calloc(1,sizeof(Reply));
    const char *error="Permintaan AI gagal. Periksa internet lalu coba lagi.";char *response=NULL;
    HINTERNET session=NULL,connection=NULL,request=NULL;char *body=NULL;
    if(!reply)goto done;reply->id=job->id;
    const char *general="{\"model\":\"openrouter/free\",\"provider\":{\"max_price\":{\"prompt\":0,\"completion\":0,\"request\":0}},\"max_tokens\":3000,\"messages\":";
    const char *coding="{\"model\":\"poolside/laguna-s-2.1:free\",\"models\":[\"poolside/laguna-s-2.1:free\",\"openrouter/free\"],\"provider\":{\"max_price\":{\"prompt\":0,\"completion\":0,\"request\":0}},\"max_tokens\":3000,\"messages\":";
    const char *prefix=job->coding?coding:general;size_t length=strlen(prefix)+strlen(job->messages)+2;
    body=malloc(length);if(!body)goto done;snprintf(body,length,"%s%s}",prefix,job->messages);
    session=WinHttpOpen(L"DITASHA-Local/3.0",WINHTTP_ACCESS_TYPE_AUTOMATIC_PROXY,WINHTTP_NO_PROXY_NAME,WINHTTP_NO_PROXY_BYPASS,0);
    if(!session)goto done;WinHttpSetTimeouts(session,15000,15000,30000,60000);
    connection=WinHttpConnect(session,L"openrouter.ai",INTERNET_DEFAULT_HTTPS_PORT,0);if(!connection)goto done;
    request=WinHttpOpenRequest(connection,L"POST",L"/api/v1/chat/completions",NULL,WINHTTP_NO_REFERER,WINHTTP_DEFAULT_ACCEPT_TYPES,WINHTTP_FLAG_SECURE);if(!request)goto done;
    DWORD redirect=WINHTTP_OPTION_REDIRECT_POLICY_NEVER;
    if(!WinHttpSetOption(request,WINHTTP_OPTION_REDIRECT_POLICY,&redirect,sizeof(redirect)))goto done;
    if(!WinHttpAddRequestHeaders(request,job->authorization,(DWORD)-1L,WINHTTP_ADDREQ_FLAG_ADD|WINHTTP_ADDREQ_FLAG_REPLACE))goto done;
    if(!WinHttpSendRequest(request,L"Content-Type: application/json\r\n",(DWORD)-1L,body,(DWORD)strlen(body),(DWORD)strlen(body),0)||!WinHttpReceiveResponse(request,NULL))goto done;
    DWORD status=0,status_size=sizeof(status);
    if(!WinHttpQueryHeaders(request,WINHTTP_QUERY_STATUS_CODE|WINHTTP_QUERY_FLAG_NUMBER,WINHTTP_HEADER_NAME_BY_INDEX,&status,&status_size,WINHTTP_NO_HEADER_INDEX))goto done;
    if(status!=200){error=status==401?"API key tidak valid. Ganti key di Pengaturan.":status==429?"Kuota model gratis tercapai. Tunggu sebentar lalu coba lagi.":status==402?"OpenRouter membatasi akun ini. Periksa status akun; aplikasi tetap hanya memakai model gratis.":"Model gratis tidak tersedia. Coba lagi nanti. Tidak ada fallback berbayar.";goto done;}
    DWORD total=0,available=0;response=calloc(1,1);if(!response)goto done;
    for(;;){
        if(!WinHttpQueryDataAvailable(request,&available))goto done;
        if(!available)break;if(available>4000000-total){error="Jawaban AI terlalu besar.";goto done;}
        char *grown=realloc(response,(size_t)total+available+1);if(!grown)goto done;response=grown;
        DWORD received=0;if(!WinHttpReadData(request,response+total,available,&received)||!received)goto done;
        total+=received;response[total]=0;
    }
    if(!json_root(response,JSMN_OBJECT)){error="OpenRouter memberikan jawaban tidak valid. Coba lagi.";goto done;}
    reply->ok=TRUE;reply->data=response;response=NULL;
done:
    if(request)WinHttpCloseHandle(request);if(connection)WinHttpCloseHandle(connection);if(session)WinHttpCloseHandle(session);
    if(body){SecureZeroMemory(body,strlen(body));free(body);}free(response);
    if(job->authorization){SecureZeroMemory(job->authorization,wcslen(job->authorization)*sizeof(WCHAR));free(job->authorization);}
    if(job->messages){SecureZeroMemory(job->messages,strlen(job->messages));free(job->messages);}
    release_ai_slot();
    if(reply){
        if(!reply->ok){char data[512];snprintf(data,sizeof(data),"{\"error\":\"%s\"}",error);reply->data=_strdup(data);}
        if(!reply->data || !PostMessageW(job->window,BRIDGE_REPLY,0,(LPARAM)reply)){free(reply->data);free(reply);}
    }
    free(job);return 0;
}
#include "chatgpt.h"
#include "api-providers.h"
#include "sync.h"
#include "trends.h"
#include "assistant-tools.h"
static BOOL updater_operation(App *app,const WCHAR *operation,unsigned long id,const WCHAR *payload);
static HRESULT STDMETHODCALLTYPE bridge_invoke(ICoreWebView2WebMessageReceivedEventHandler *self,ICoreWebView2 *sender,ICoreWebView2WebMessageReceivedEventArgs *args) {
    (void)sender;App *app=((BridgeHandler*)self)->app;
    LPWSTR source=NULL,message=NULL;
    if(FAILED(ICoreWebView2WebMessageReceivedEventArgs_get_Source(args,&source)))return S_OK;
    BOOL trusted=!wcscmp(source,URL);CoTaskMemFree(source);if(!trusted)return S_OK;
    if(FAILED(ICoreWebView2WebMessageReceivedEventArgs_TryGetWebMessageAsString(args,&message)))return S_OK;
    WCHAR *line1=wcschr(message,L'\n');if(!line1){CoTaskMemFree(message);return S_OK;}*line1++=0;
    WCHAR *line2=wcschr(line1,L'\n');if(!line2){CoTaskMemFree(message);return S_OK;}*line2++=0;
    WCHAR *end=NULL;unsigned long id=wcstoul(line1,&end,10);
    if(!id||*end||wcslen(message)>32||wcslen(line2)>16000000){CoTaskMemFree(message);return S_OK;}
    if(!wcscmp(message,L"load")) {
        BOOL missing=FALSE;char *data=read_local(L"workspace.json",16000000,NULL,&missing);
        if(missing)send_reply(app,id,TRUE,"null");
        else if(data&&json_root(data,JSMN_OBJECT))send_reply(app,id,TRUE,data);
        else fail_reply(app,id,"Data lokal tidak dapat dibaca. File lama tidak ditimpa; periksa workspace.json.bak.");
        free(data);
    }else if(!wcscmp(message,L"save")) {
        char *data=to_utf8(line2);
        BOOL ok=data&&json_root(data,JSMN_OBJECT)&&write_local(L"workspace.json",data,(DWORD)strlen(data),TRUE);free(data);
        if(ok)send_reply(app,id,TRUE,"true");else fail_reply(app,id,"Data belum tersimpan. Periksa ruang disk dan akses folder aplikasi.");
    }else if(!wcscmp(message,L"saveResult")) {
        char *payload=to_utf8(line2);CgJson j=cg_json(payload);char *name=j.t?cg_get(&j,0,"name"):NULL,*content=j.t?cg_get(&j,0,"content"):NULL;
        BOOL valid=name&&*name&&strlen(name)<=120&&content&&strlen(content)<=8000000;
        if(name)for(const unsigned char *p=(const unsigned char*)name;*p;p++)if(*p<32||strchr("\\/:*?\"<>|",*p))valid=FALSE;
        if(!valid)fail_reply(app,id,"Nama atau isi file tidak valid.");
        else {WCHAR path[32768]={0},*wide=to_wide(name);if(wide){wcsncpy(path,wide,32767);free(wide);}OPENFILENAMEW ofn={0};ofn.lStructSize=sizeof(ofn);ofn.hwndOwner=app->window;ofn.lpstrFile=path;ofn.nMaxFile=32768;ofn.lpstrTitle=L"Simpan hasil AI";ofn.lpstrFilter=L"Semua file\0*.*\0\0";ofn.Flags=OFN_OVERWRITEPROMPT|OFN_PATHMUSTEXIST|OFN_NOCHANGEDIR;
         if(GetSaveFileNameW(&ofn)){HANDLE file=CreateFileW(path,GENERIC_WRITE,0,NULL,CREATE_ALWAYS,FILE_ATTRIBUTE_NORMAL,NULL);DWORD written=0,n=(DWORD)strlen(content);BOOL ok=file!=INVALID_HANDLE_VALUE&&WriteFile(file,content,n,&written,NULL)&&written==n;if(file!=INVALID_HANDLE_VALUE)CloseHandle(file);if(ok)send_reply(app,id,TRUE,"{\"saved\":true}");else fail_reply(app,id,"File belum tersimpan. Periksa izin folder dan ruang disk.");}
         else if(CommDlgExtendedError())fail_reply(app,id,"Dialog simpan tidak dapat dibuka.");else send_reply(app,id,TRUE,"{\"saved\":false}");
        }free(name);cg_clear(content);free(j.t);cg_clear(payload);
    }else if(!wcscmp(message,L"openLink")) {
        BOOL valid=(!wcsncmp(line2,L"https://",8)||!wcsncmp(line2,L"http://",7))&&wcslen(line2)<2048;for(const WCHAR *p=line2;*p;p++)if(*p<=32||*p==L'"'||*p==L'\\')valid=FALSE;
        if(valid&&(INT_PTR)ShellExecuteW(app->window,L"open",line2,NULL,NULL,SW_SHOWNORMAL)>32)send_reply(app,id,TRUE,"true");else fail_reply(app,id,"Tautan tidak dapat dibuka.");
    }else if(sync_operation(app,message,id,line2)) {
        /* Outbound phone relay, credentials remain DPAPI encrypted. */
    }else if(tools_operation(app,message,id,line2)) {
        /* Folder selection and read-only IMAP tools. */
    }else if(!wcscmp(message,L"hasKey")) {
        char *key=load_key();send_reply(app,id,TRUE,key?"true":"false");if(key){SecureZeroMemory(key,strlen(key));free(key);}
    }else if(!wcscmp(message,L"saveKey")) {
        char *key=to_utf8(line2);BOOL ok=key&&save_key(key);if(key){SecureZeroMemory(key,strlen(key));free(key);}
        if(ok)send_reply(app,id,TRUE,"true");else fail_reply(app,id,"API key tidak valid atau tidak dapat disimpan. Gunakan key OpenRouter sk-or-.");
    }else if(!wcscmp(message,L"removeKey")) {
        WCHAR path[MAX_PATH];local_path(L"openrouter.key",path);
        if(DeleteFileW(path)||GetLastError()==ERROR_FILE_NOT_FOUND)send_reply(app,id,TRUE,"true");else fail_reply(app,id,"API key tidak dapat dihapus.");
    }else if(api_operation(app,message,id,line2)) {
        /* Provider keys and per-employee inference. */
    }else if(cg_operation(app,message,id,line2)) {
        /* Native OAuth and account operations reply asynchronously. */
    }else if(!wcscmp(message,L"trends")) {
        start_trends(app,id);
    }else if(!wcscmp(message,L"ai")||!wcscmp(message,L"aiCoding")) {
        if(cg_using()){cg_start(app,id,"chatgptAI",line2,!wcscmp(message,L"aiCoding"));goto finish;}
        if(InterlockedCompareExchange(&cg_control,0,0)){fail_reply(app,id,"Tunggu pengaturan koneksi selesai.");goto finish;}
        if(!reserve_ai_slot()){fail_reply(app,id,"Tiga permintaan AI sedang berjalan. Tunggu sebentar.");goto finish;}
        AiJob *job=calloc(1,sizeof(AiJob));char *key=load_key();
        if(!job||!key){free(job);if(key){SecureZeroMemory(key,strlen(key));free(key);}release_ai_slot();fail_reply(app,id,"Masukkan API key OpenRouter di Pengaturan.");goto finish;}
        job->window=app->window;job->id=id;job->coding=!wcscmp(message,L"aiCoding");job->messages=to_utf8(line2);
        size_t n=strlen(key)+32;char *auth=malloc(n);if(auth)snprintf(auth,n,"Authorization: Bearer %s\r\n",key);
        job->authorization=auth?to_wide(auth):NULL;
        if(auth){SecureZeroMemory(auth,strlen(auth));free(auth);}SecureZeroMemory(key,strlen(key));free(key);
        HANDLE thread=NULL;
        if(job->messages&&strlen(job->messages)<500000&&json_root(job->messages,JSMN_ARRAY)&&job->authorization)thread=CreateThread(NULL,0,ai_worker,job,0,NULL);
        if(thread)CloseHandle(thread);else {free(job->messages);if(job->authorization){SecureZeroMemory(job->authorization,wcslen(job->authorization)*sizeof(WCHAR));free(job->authorization);}free(job);release_ai_slot();fail_reply(app,id,"Permintaan tidak dapat diproses. Coba lagi.");}
    }else if(!updater_operation(app,message,id,line2))fail_reply(app,id,"Operasi tidak dikenal.");
finish:
    SecureZeroMemory(line2,wcslen(line2)*sizeof(WCHAR));CoTaskMemFree(message);return S_OK;
}
static ICoreWebView2WebMessageReceivedEventHandlerVtbl bridge_vtable={BridgeHandler_query,BridgeHandler_add,BridgeHandler_release,bridge_invoke};
static void attach_bridge(App *app) {
    BridgeHandler *handler=calloc(1,sizeof(BridgeHandler));if(!handler)return;
    handler->iface.lpVtbl=&bridge_vtable;handler->refs=1;handler->app=app;
    EventRegistrationToken token;ICoreWebView2_add_WebMessageReceived(app->view,&handler->iface,&token);
    BridgeHandler_release(&handler->iface);
}
HANDLER(NavigationHandler, ICoreWebView2NavigationStartingEventHandler, IID_ICoreWebView2NavigationStartingEventHandler)
static HRESULT STDMETHODCALLTYPE navigation_invoke(ICoreWebView2NavigationStartingEventHandler *self,ICoreWebView2 *sender,ICoreWebView2NavigationStartingEventArgs *args){
    (void)self;(void)sender;LPWSTR uri=NULL;
    if(SUCCEEDED(ICoreWebView2NavigationStartingEventArgs_get_Uri(args,&uri))){if(wcscmp(uri,URL))ICoreWebView2NavigationStartingEventArgs_put_Cancel(args,TRUE);CoTaskMemFree(uri);}return S_OK;
}
static ICoreWebView2NavigationStartingEventHandlerVtbl navigation_vtable={NavigationHandler_query,NavigationHandler_add,NavigationHandler_release,navigation_invoke};
static HRESULT attach_local_content(App *app) {
    ICoreWebView2_3 *view3=NULL;HRESULT hr=ICoreWebView2_QueryInterface(app->view,&IID_ICoreWebView2_3,(void**)&view3);if(FAILED(hr))return hr;
    hr=ICoreWebView2_3_SetVirtualHostNameToFolderMapping(view3,L"ditasha.local",storage,COREWEBVIEW2_HOST_RESOURCE_ACCESS_KIND_DENY);
    ICoreWebView2_3_Release(view3);if(FAILED(hr))return hr;
    NavigationHandler *handler=calloc(1,sizeof(NavigationHandler));if(!handler)return E_OUTOFMEMORY;
    handler->iface.lpVtbl=&navigation_vtable;handler->refs=1;handler->app=app;EventRegistrationToken token;
    hr=ICoreWebView2_add_NavigationStarting(app->view,&handler->iface,&token);NavigationHandler_release(&handler->iface);
    if(SUCCEEDED(hr))attach_bridge(app);return hr;
}
