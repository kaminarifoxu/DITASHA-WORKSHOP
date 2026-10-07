/* API keys stay native; the UI sends only the employee's selected route. */
#include "api-provider-core.h"
typedef struct ApiJob {HWND window;unsigned long id;char *payload;BOOL models;} ApiJob;
static BOOL api_key_name(int index,WCHAR *name){if(index<0||index>=5)return FALSE;return swprintf(name,64,L"%hs.key",api_ids[index])>0;}
static char *api_load_key(int index){
 if(index==0)return load_key();WCHAR name[64];if(!api_key_name(index,name))return NULL;DWORD size=0;char *encrypted=read_local(name,20000,&size,NULL);if(!encrypted)return NULL;
 DATA_BLOB in={size,(BYTE*)encrypted},out={0};BOOL ok=CryptUnprotectData(&in,NULL,NULL,NULL,NULL,CRYPTPROTECT_UI_FORBIDDEN,&out);free(encrypted);if(!ok)return NULL;char *key=calloc((size_t)out.cbData+1,1);if(key)memcpy(key,out.pbData,out.cbData);SecureZeroMemory(out.pbData,out.cbData);LocalFree(out.pbData);if(key&&!api_key_valid(key)){cg_clear(key);key=NULL;}return key;
}
static BOOL api_save_key(int index,const char *key){
 if(!api_key_valid(key))return FALSE;if(index==0)return save_key(key);WCHAR name[64];if(!api_key_name(index,name)||!api_key_valid(key))return FALSE;DATA_BLOB in={(DWORD)strlen(key),(BYTE*)key},out={0};if(!CryptProtectData(&in,L"DITASHA AI API key",NULL,NULL,NULL,CRYPTPROTECT_UI_FORBIDDEN,&out))return FALSE;BOOL ok=write_local(name,out.pbData,out.cbData,FALSE);SecureZeroMemory(out.pbData,out.cbData);LocalFree(out.pbData);return ok;
}
static char *api_default(void){char *provider=read_local(L"ai.provider",32,NULL,NULL);if(api_index(provider)<0){free(provider);provider=_strdup("openrouter");}return provider;}
static char *api_key_status(void){BOOL keys[5];for(int i=0;i<5;i++){char *key=api_load_key(i);keys[i]=key!=NULL;cg_clear(key);}char *provider=api_default(),*out=malloc(400);if(out&&provider)snprintf(out,400,"{\"provider\":\"%s\",\"keys\":{\"openrouter\":%s,\"groq\":%s,\"gemini\":%s,\"openai\":%s,\"custom\":%s}}",provider,keys[0]?"true":"false",keys[1]?"true":"false",keys[2]?"true":"false",keys[3]?"true":"false",keys[4]?"true":"false");else{free(out);out=NULL;}free(provider);return out;}
static BOOL api_url(int provider,const char *custom,const WCHAR *suffix,WCHAR **url){
 const char *base=provider==4?custom:api_base(provider);if(!base||strlen(base)>2048||_strnicmp(base,"https://",8))return FALSE;
 for(const unsigned char *p=(const unsigned char*)base;*p;p++)if(*p<=32||*p>=127||*p=='#'||*p=='?'||*p=='\\')return FALSE;
 WCHAR *wide=to_wide(base);if(!wide)return FALSE;URL_COMPONENTS parts={0};parts.dwStructSize=sizeof(parts);parts.dwHostNameLength=parts.dwUrlPathLength=parts.dwExtraInfoLength=parts.dwUserNameLength=parts.dwPasswordLength=(DWORD)-1;
 BOOL valid=WinHttpCrackUrl(wide,0,0,&parts)&&parts.nScheme==INTERNET_SCHEME_HTTPS&&parts.dwHostNameLength>0&&parts.dwHostNameLength<256&&!parts.dwUserNameLength&&!parts.dwPasswordLength&&!parts.dwExtraInfoLength;
 if(!valid){free(wide);return FALSE;}size_t n=wcslen(wide);while(n&&wide[n-1]==L'/')wide[--n]=0;size_t total=n+wcslen(suffix)+1;*url=malloc(total*sizeof(WCHAR));if(*url)swprintf(*url,total,L"%ls%ls",wide,suffix);free(wide);return *url!=NULL;
}
static char *api_http(const WCHAR *url,const char *body,const char *key,DWORD *status){
 *status=0;URL_COMPONENTS parts={0};parts.dwStructSize=sizeof(parts);parts.dwHostNameLength=parts.dwUrlPathLength=parts.dwExtraInfoLength=(DWORD)-1;if(!WinHttpCrackUrl(url,0,0,&parts)||parts.nScheme!=INTERNET_SCHEME_HTTPS||parts.dwHostNameLength>=256||parts.dwUrlPathLength>=2300||parts.dwExtraInfoLength)return NULL;
 WCHAR host[256],path[2300];memcpy(host,parts.lpszHostName,parts.dwHostNameLength*sizeof(WCHAR));host[parts.dwHostNameLength]=0;memcpy(path,parts.lpszUrlPath,parts.dwUrlPathLength*sizeof(WCHAR));path[parts.dwUrlPathLength]=0;
 HINTERNET session=NULL,connection=NULL,request=NULL;char *response=NULL;WCHAR *authorization=NULL;
 session=WinHttpOpen(L"DITASHA-Workspace/3.9",WINHTTP_ACCESS_TYPE_AUTOMATIC_PROXY,WINHTTP_NO_PROXY_NAME,WINHTTP_NO_PROXY_BYPASS,0);if(!session)goto done;WinHttpSetTimeouts(session,15000,15000,30000,90000);connection=WinHttpConnect(session,host,parts.nPort,0);if(!connection)goto done;request=WinHttpOpenRequest(connection,body?L"POST":L"GET",path,NULL,WINHTTP_NO_REFERER,WINHTTP_DEFAULT_ACCEPT_TYPES,WINHTTP_FLAG_SECURE);if(!request)goto done;
 DWORD policy=WINHTTP_OPTION_REDIRECT_POLICY_NEVER;if(!WinHttpSetOption(request,WINHTTP_OPTION_REDIRECT_POLICY,&policy,sizeof(policy)))goto done;
 size_t an=strlen(key)+32;char *auth=malloc(an);if(!auth)goto done;snprintf(auth,an,"Authorization: Bearer %s\r\n",key);authorization=to_wide(auth);cg_clear(auth);if(!authorization||!WinHttpAddRequestHeaders(request,authorization,(DWORD)-1,WINHTTP_ADDREQ_FLAG_ADD|WINHTTP_ADDREQ_FLAG_REPLACE))goto done;
 DWORD length=body?(DWORD)strlen(body):0;if(!WinHttpSendRequest(request,L"Content-Type: application/json\r\n",(DWORD)-1,(void*)body,length,length,0)||!WinHttpReceiveResponse(request,NULL))goto done;DWORD sn=sizeof(*status);if(!WinHttpQueryHeaders(request,WINHTTP_QUERY_STATUS_CODE|WINHTTP_QUERY_FLAG_NUMBER,NULL,status,&sn,NULL))goto done;
 DWORD total=0,available=0;response=calloc(1,1);while(response){if(!WinHttpQueryDataAvailable(request,&available))goto failed;if(!available)break;if(available>8000000-total)goto failed;char *grown=realloc(response,(size_t)total+available+1);if(!grown)goto failed;response=grown;DWORD received=0;if(!WinHttpReadData(request,response+total,available,&received)||!received)goto failed;total+=received;response[total]=0;}goto done;
 failed:cg_clear(response);response=NULL;
 done:if(authorization){SecureZeroMemory(authorization,wcslen(authorization)*sizeof(WCHAR));free(authorization);}if(request)WinHttpCloseHandle(request);if(connection)WinHttpCloseHandle(connection);if(session)WinHttpCloseHandle(session);return response;
}
static DWORD WINAPI api_worker(void *context){
 ApiJob *job=context;Reply *reply=calloc(1,sizeof(*reply));CgJson j=cg_json(job->payload);char *provider=j.t?cg_get(&j,0,"provider"):NULL,*custom=j.t?cg_get(&j,0,"baseUrl"):NULL,*model=j.t?cg_get(&j,0,"model"):NULL,*messages=NULL,*key=NULL,*body=NULL,*response=NULL;WCHAR *url=NULL;const char *error="Permintaan AI tidak dapat diproses.";int index=api_index(provider);DWORD status=0;
 if(!reply)goto done;reply->id=job->id;if(!j.t||index<0)goto done;
 if(!job->models){messages=cg_raw(&j,cg_field(&j,0,"messages"));if(!messages||!json_root(messages,JSMN_ARRAY)||strlen(messages)>500000)goto done;}
 if(index==5){
  if(job->models){error="Muat model ChatGPT lewat panel login ChatGPT.";goto done;}
  CgJob cg={0};cg.payload=messages;cg.coding=api_true(&j,0,"coding");cg.model=model;error=NULL;reply->data=cg_ai(&cg,&error);reply->ok=reply->data!=NULL;goto done;
 }
 if(!api_url(index,custom,job->models?L"/models":L"/chat/completions",&url)){error="Base URL tidak valid. Gunakan URL HTTPS tanpa username, query atau fragment, misalnya https://api.example.com/v1.";goto done;}
 key=api_load_key(index);if(!key){error="API key penyedia ini belum disimpan. Tambahkan di Pengaturan.";goto done;}
 if(!job->models){long long tokens=cg_number(&j,0,"maxTokens");if(tokens<512||tokens>32768){error="Batas token harus antara 512 sampai 32768.";goto done;}BOOL free_only=index==0&&!cg_equal(&j,cg_field(&j,0,"freeOnly"),"false");body=api_chat_body(index,model,messages,free_only,(int)tokens);if(!body){error=index==0&&free_only&&!api_free_slug(model)?"Mode gratis OpenRouter aktif. Pilih model :free atau openrouter/free; model berbayar tidak dikirim.":"Pilih model valid dan batas token antara 512 sampai 32768.";goto done;}}
 response=api_http(url,body,key,&status);if(!response||status!=200){error=status==401||status==403?"API key atau akses model ditolak. Periksa key dan izin akun penyedia ini.":status==429?"Batas permintaan penyedia ini tercapai. Tunggu atau pilih model/penyedia lain di Pengaturan.":status==402?"Saldo API penyedia ini tidak mencukupi. Periksa akun atau pilih penyedia lain.":status==400||status==404||status==422?"Endpoint atau model menolak permintaan. Periksa base URL, ID model dan batas token di Pengaturan.":"Tidak dapat menghubungi penyedia AI. Periksa internet lalu coba lagi.";goto done;}
 if(job->models){reply->data=api_catalog(response,index);if(!reply->data){error="Daftar model tidak tersedia. Kamu bisa memasukkan ID model secara manual.";goto done;}reply->ok=TRUE;goto done;}
 CgJson result=cg_json(response);int choices=result.t?cg_field(&result,0,"choices"):-1,choice=choices>=0&&result.t[choices].type==JSMN_ARRAY&&result.t[choices].size>0?choices+1:-1;char *finish=cg_get(&result,choice,"finish_reason");int message=cg_field(&result,choice,"message");char *text=cg_get(&result,message,"content");BOOL valid=text&&*text&&!(finish&&(!strcmp(finish,"length")||!strcmp(finish,"content_filter")));
 if(finish&&!strcmp(finish,"length"))error="Jawaban AI terpotong. Naikkan batas token penyedia ini di Pengaturan, lalu coba lagi.";else if(!valid)error="Model belum menghasilkan jawaban teks yang lengkap. Pilih model chat/teks yang sesuai.";free(finish);cg_clear(text);free(result.t);if(!valid)goto done;
 reply->ok=TRUE;reply->data=response;response=NULL;
 done:free(j.t);free(provider);free(custom);free(model);cg_clear(messages);cg_clear(key);cg_clear(body);cg_clear(response);free(url);if(job->models)InterlockedExchange(&cg_control,0);release_ai_slot();if(reply){if(!reply->ok){char *q=cg_quote(error?error:"Permintaan ChatGPT gagal.");if(q){size_t n=strlen(q)+30;reply->data=malloc(n);if(reply->data)snprintf(reply->data,n,"{\"error\":%s}",q);free(q);}}if(!reply->data||!PostMessageW(job->window,BRIDGE_REPLY,0,(LPARAM)reply)){free(reply->data);free(reply);}}cg_clear(job->payload);free(job);return 0;
}
static void api_start(App *app,unsigned long id,const WCHAR *payload,BOOL models){
 if(models){if(InterlockedCompareExchange(&cg_control,1,0)){fail_reply(app,id,"Operasi koneksi AI sedang berjalan.");return;}if(InterlockedCompareExchange(&ai_pending,0,0)){InterlockedExchange(&cg_control,0);fail_reply(app,id,"Tunggu tugas AI selesai sebelum memuat model.");return;}}
 else if(InterlockedCompareExchange(&cg_control,0,0)){fail_reply(app,id,"Tunggu pengaturan koneksi AI selesai.");return;}
 if(!reserve_ai_slot()){if(models)InterlockedExchange(&cg_control,0);fail_reply(app,id,"Tiga permintaan AI sedang berjalan. Tunggu sebentar.");return;}ApiJob *job=calloc(1,sizeof(*job));HANDLE thread=NULL;if(job){job->window=app->window;job->id=id;job->models=models;job->payload=to_utf8(payload);if(job->payload&&strlen(job->payload)<1000000)thread=CreateThread(NULL,0,api_worker,job,0,NULL);}
 if(thread)CloseHandle(thread);else{if(job){cg_clear(job->payload);free(job);}if(models)InterlockedExchange(&cg_control,0);release_ai_slot();fail_reply(app,id,"Permintaan AI tidak dapat dimulai.");}
}
static BOOL api_operation(App *app,const WCHAR *op,unsigned long id,const WCHAR *payload){
 if(!wcscmp(op,L"apiKeyStatus")){char *s=api_key_status();if(s){send_reply(app,id,TRUE,s);free(s);}else fail_reply(app,id,"Status API tidak dapat dibaca.");return TRUE;}
 if(!wcscmp(op,L"aiEmployee")||!wcscmp(op,L"apiModels")){api_start(app,id,payload,!wcscmp(op,L"apiModels"));return TRUE;}
 if(wcscmp(op,L"apiSaveKey")&&wcscmp(op,L"apiRemoveKey")&&wcscmp(op,L"apiDefault"))return FALSE;
 if(InterlockedCompareExchange(&cg_control,0,0)||InterlockedCompareExchange(&ai_pending,0,0)){fail_reply(app,id,"Tunggu tugas AI atau login selesai sebelum mengubah koneksi.");return TRUE;}
 char *text=to_utf8(payload);BOOL ok=FALSE;
 if(!wcscmp(op,L"apiDefault")){int index=api_index(text);ok=index>=0&&write_local(L"ai.provider",text,(DWORD)strlen(text),FALSE);}
 else{CgJson j=cg_json(text);char *provider=j.t?cg_get(&j,0,"provider"):NULL;int index=api_index(provider);if(index>=0&&index<5){if(!wcscmp(op,L"apiSaveKey")){char *key=cg_get(&j,0,"key");ok=api_save_key(index,key);cg_clear(key);}else{WCHAR name[64],path[MAX_PATH];if(api_key_name(index,name)){local_path(name,path);ok=DeleteFileW(path)||GetLastError()==ERROR_FILE_NOT_FOUND;}}}free(provider);free(j.t);}
 cg_clear(text);if(ok)send_reply(app,id,TRUE,"true");else fail_reply(app,id,"Key atau penyedia tidak valid, atau perubahan tidak dapat disimpan.");return TRUE;
}
