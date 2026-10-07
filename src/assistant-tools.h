/* User-operated desktop tools. Request data travels through pipes, never command text. */
static volatile LONG tools_busy=0;
typedef struct ToolsJob {HWND window;unsigned long id;char *payload;WCHAR script[MAX_PATH];} ToolsJob;
static DWORD WINAPI tools_worker(void *parameter){
 ToolsJob *job=parameter;Reply *reply=calloc(1,sizeof(Reply));HANDLE inputR=NULL,inputW=NULL,outputR=NULL,outputW=NULL,nul=NULL;PROCESS_INFORMATION process={0};char *response=NULL;DWORD total=0;BOOL good=FALSE;HANDLE mutex=CreateMutexW(NULL,FALSE,L"Local\\DITASHA-AssistantTools");BOOL acquired=FALSE;
 SECURITY_ATTRIBUTES sa={sizeof(sa),NULL,TRUE};
 if(!reply)goto done;reply->id=job->id;if(!mutex)goto done;DWORD wait=WaitForSingleObject(mutex,5000);if(wait!=WAIT_OBJECT_0&&wait!=WAIT_ABANDONED)goto done;acquired=TRUE;
 if(!CreatePipe(&inputR,&inputW,&sa,0)||!CreatePipe(&outputR,&outputW,&sa,0))goto done;
 SetHandleInformation(inputW,HANDLE_FLAG_INHERIT,0);SetHandleInformation(outputR,HANDLE_FLAG_INHERIT,0);
 nul=CreateFileW(L"NUL",GENERIC_WRITE,FILE_SHARE_READ|FILE_SHARE_WRITE,&sa,OPEN_EXISTING,0,NULL);
 WCHAR windows[MAX_PATH],program[MAX_PATH],command[2048];GetSystemDirectoryW(windows,MAX_PATH);swprintf(program,MAX_PATH,L"%ls\\WindowsPowerShell\\v1.0\\powershell.exe",windows);
 swprintf(command,2048,L"\"%ls\" -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File \"%ls\" -Store \"%ls\"",program,job->script,data_root);
 STARTUPINFOW start={0};start.cb=sizeof(start);start.dwFlags=STARTF_USESTDHANDLES;start.hStdInput=inputR;start.hStdOutput=outputW;start.hStdError=nul;
 if(!CreateProcessW(program,command,NULL,NULL,TRUE,CREATE_NO_WINDOW,NULL,NULL,&start,&process))goto done;
 CloseHandle(inputR);inputR=NULL;CloseHandle(outputW);outputW=NULL;DWORD written=0,n=(DWORD)strlen(job->payload);
 if(!WriteFile(inputW,job->payload,n,&written,NULL)||written!=n)goto done;CloseHandle(inputW);inputW=NULL;
 ULONGLONG deadline=GetTickCount64()+180000;
 for(;;){DWORD available=0;if(!PeekNamedPipe(outputR,NULL,0,NULL,&available,NULL)){if(GetLastError()==ERROR_BROKEN_PIPE)break;goto done;}
  if(available){if(available>2000000-total)goto done;char *grown=realloc(response,(size_t)total+available+1);if(!grown)goto done;response=grown;DWORD received=0;if(!ReadFile(outputR,response+total,available,&received,NULL))goto done;total+=received;response[total]=0;}
  else if(WaitForSingleObject(process.hProcess,0)==WAIT_OBJECT_0)break;
  else {if(GetTickCount64()>deadline)goto done;Sleep(20);}
 }
 if(response&&json_root(response,JSMN_OBJECT)){CgJson j=cg_json(response);char *ok=cg_raw(&j,cg_field(&j,0,"ok"));int token=cg_field(&j,0,"data");char *error=cg_get(&j,0,"error");
  if(ok&&!strcmp(ok,"true")&&token>=0){reply->ok=TRUE;reply->data=cg_raw(&j,token);good=reply->data!=NULL;}
  else if(error){reply->data=malloc(strlen(error)*6+32);if(reply->data){char *quoted=cg_quote(error);if(quoted){sprintf(reply->data,"{\"error\":%s}",quoted);free(quoted);good=TRUE;}}}
  free(ok);free(error);free(j.t);
 }
done:
 if(process.hProcess){if(WaitForSingleObject(process.hProcess,0)!=WAIT_OBJECT_0){TerminateProcess(process.hProcess,1);WaitForSingleObject(process.hProcess,2000);}CloseHandle(process.hProcess);CloseHandle(process.hThread);}
 if(inputR)CloseHandle(inputR);if(inputW)CloseHandle(inputW);if(outputR)CloseHandle(outputR);if(outputW)CloseHandle(outputW);if(nul&&nul!=INVALID_HANDLE_VALUE)CloseHandle(nul);
 if(reply){if(!good){free(reply->data);reply->ok=FALSE;reply->data=_strdup("{\"error\":\"Alat belum berhasil. Periksa Windows PowerShell, izin folder, atau koneksi email.\"}");}if(!PostMessageW(job->window,BRIDGE_REPLY,0,(LPARAM)reply)){free(reply->data);free(reply);}}
 if(acquired)ReleaseMutex(mutex);if(mutex)CloseHandle(mutex);free(response);cg_clear(job->payload);free(job);InterlockedExchange(&tools_busy,0);return 0;
}
static BOOL tools_operation(App *app,const WCHAR *operation,unsigned long id,const WCHAR *payload){
 if(!wcscmp(operation,L"chooseFolder")){BROWSEINFOW browse={0};browse.hwndOwner=app->window;browse.lpszTitle=L"Pilih folder yang boleh dikelola Dante";browse.ulFlags=BIF_RETURNONLYFSDIRS|BIF_NEWDIALOGSTYLE;LPITEMIDLIST item=SHBrowseForFolderW(&browse);
  WCHAR path[MAX_PATH];if(item&&SHGetPathFromIDListW(item,path)){char *text=to_utf8(path),*quote=text?cg_quote(text):NULL;if(quote)send_reply(app,id,TRUE,quote);else fail_reply(app,id,"Folder tidak dapat dibaca.");free(text);free(quote);}else send_reply(app,id,TRUE,"null");if(item)CoTaskMemFree(item);return TRUE;}
 if(wcscmp(operation,L"assistantTools"))return FALSE;
 if(InterlockedCompareExchange(&tools_busy,1,0)){fail_reply(app,id,"Tunggu operasi alat sebelumnya selesai.");return TRUE;}
 ToolsJob *job=calloc(1,sizeof(ToolsJob));BOOL ok=FALSE;
 if(job){job->window=app->window;job->id=id;job->payload=to_utf8(payload);HRSRC resource=FindResourceW(instance,MAKEINTRESOURCEW(104),RT_RCDATA);DWORD size=resource?SizeofResource(instance,resource):0;const void *script=resource?LockResource(LoadResource(instance,resource)):NULL;
  HRSRC helper=FindResourceW(instance,MAKEINTRESOURCEW(105),RT_RCDATA);DWORD helperSize=helper?SizeofResource(instance,helper):0;const void *helperBytes=helper?LockResource(LoadResource(instance,helper)):NULL;
  if(helperBytes&&helperSize&&write_local(L"mail-automation.ps1",helperBytes,helperSize,FALSE)&&script&&size&&job->payload&&strlen(job->payload)<=4096&&json_root(job->payload,JSMN_OBJECT)&&write_local(L"assistant-tools.ps1",script,size,FALSE)){local_path(L"assistant-tools.ps1",job->script);HANDLE thread=CreateThread(NULL,0,tools_worker,job,0,NULL);if(thread){CloseHandle(thread);ok=TRUE;}}
 }
 if(!ok){if(job){cg_clear(job->payload);free(job);}InterlockedExchange(&tools_busy,0);fail_reply(app,id,"Alat desktop belum dapat dijalankan.");}return TRUE;
}
