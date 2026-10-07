/* Fixed public RSS endpoint. Never forwards AI/API credentials or follows redirects. */
typedef struct TrendJob { HWND window; unsigned long id; } TrendJob;
static char *quote_rss(const char *text) {
    size_t len=strlen(text);char *out=malloc(len*6+3);if(!out)return NULL;char *p=out;*p++='"';
    for(size_t i=0;i<len;i++){unsigned char c=(unsigned char)text[i];if(c=='"'||c=='\\'){*p++='\\';*p++=(char)c;}else if(c<32){snprintf(p,7,"\\u%04x",c);p+=6;}else *p++=(char)c;}
    *p++='"';*p=0;return out;
}
static DWORD WINAPI trend_worker(void *context) {
    TrendJob *job=context;Reply *reply=calloc(1,sizeof(Reply));
    HINTERNET session=NULL,connection=NULL,request=NULL;char *rss=NULL,*quoted=NULL;
    const char *error="Tren live belum tersedia. Periksa internet atau coba lagi; tren tidak dibuat-buat.";
    if(!reply)goto done;reply->id=job->id;
    session=WinHttpOpen(L"DITASHA-Trends/1.0",WINHTTP_ACCESS_TYPE_AUTOMATIC_PROXY,WINHTTP_NO_PROXY_NAME,WINHTTP_NO_PROXY_BYPASS,0);if(!session)goto done;
    WinHttpSetTimeouts(session,10000,10000,15000,20000);
    connection=WinHttpConnect(session,L"trends.google.com",INTERNET_DEFAULT_HTTPS_PORT,0);if(!connection)goto done;
    request=WinHttpOpenRequest(connection,L"GET",L"/trending/rss?geo=ID",NULL,WINHTTP_NO_REFERER,WINHTTP_DEFAULT_ACCEPT_TYPES,WINHTTP_FLAG_SECURE);if(!request)goto done;
    DWORD redirect=WINHTTP_OPTION_REDIRECT_POLICY_NEVER;
    if(!WinHttpSetOption(request,WINHTTP_OPTION_REDIRECT_POLICY,&redirect,sizeof(redirect)))goto done;
    if(!WinHttpSendRequest(request,L"Accept: application/rss+xml, application/xml, text/xml\r\n",(DWORD)-1L,WINHTTP_NO_REQUEST_DATA,0,0,0)||!WinHttpReceiveResponse(request,NULL))goto done;
    DWORD status=0,size=sizeof(status);if(!WinHttpQueryHeaders(request,WINHTTP_QUERY_STATUS_CODE|WINHTTP_QUERY_FLAG_NUMBER,WINHTTP_HEADER_NAME_BY_INDEX,&status,&size,WINHTTP_NO_HEADER_INDEX)||status!=200)goto done;
    DWORD total=0,available=0;rss=calloc(1,1);if(!rss)goto done;
    for(;;){if(!WinHttpQueryDataAvailable(request,&available))goto done;if(!available)break;if(available>1000000-total)goto done;
        char *grown=realloc(rss,(size_t)total+available+1);if(!grown)goto done;rss=grown;DWORD received=0;
        if(!WinHttpReadData(request,rss+total,available,&received)||!received)goto done;total+=received;rss[total]=0;}
    if(!strstr(rss,"<rss")||strstr(rss,"<!DOCTYPE")||strstr(rss,"<!ENTITY"))goto done;
    quoted=quote_rss(rss);if(!quoted)goto done;size_t n=strlen(quoted)+128;reply->data=malloc(n);if(!reply->data)goto done;
    snprintf(reply->data,n,"{\"rss\":%s,\"source\":\"https://trends.google.com/trending/rss?geo=ID\"}",quoted);reply->ok=TRUE;
done:
    if(request)WinHttpCloseHandle(request);if(connection)WinHttpCloseHandle(connection);if(session)WinHttpCloseHandle(session);free(rss);free(quoted);
    release_ai_slot();
    if(reply){if(!reply->ok){free(reply->data);char data[512];snprintf(data,sizeof(data),"{\"error\":\"%s\"}",error);reply->data=_strdup(data);}
        if(!reply->data||!PostMessageW(job->window,BRIDGE_REPLY,0,(LPARAM)reply)){free(reply->data);free(reply);}}
    free(job);return 0;
}
static void start_trends(App *app,unsigned long id) {
    if(!reserve_ai_slot()){fail_reply(app,id,"Tunggu permintaan yang sedang berjalan selesai.");return;}
    TrendJob *job=calloc(1,sizeof(TrendJob));if(job){job->window=app->window;job->id=id;}
    HANDLE thread=job?CreateThread(NULL,0,trend_worker,job,0,NULL):NULL;
    if(thread)CloseHandle(thread);else{free(job);release_ai_slot();fail_reply(app,id,"Pencarian tren tidak dapat dimulai.");}
}
