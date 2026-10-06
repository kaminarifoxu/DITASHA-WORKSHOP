#ifndef UNICODE
#define UNICODE
#endif
#define _UNICODE
#define COBJMACROS
#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <shlobj.h>
#include <shellapi.h>
#include <wchar.h>
#include <stdlib.h>
#include <string.h>
#include "WebView2.h"

static const WCHAR URL[] = L"https://ditasha.local/index.html";
static HINSTANCE instance;
static HWND main_window;
static ICoreWebView2Environment *environment;
static WCHAR storage[MAX_PATH], profile[MAX_PATH];
static BOOL installing = FALSE;
static int window_count = 0;

typedef struct App {
    HWND window;
    ICoreWebView2Controller *controller;
    ICoreWebView2 *view;
    ICoreWebView2NewWindowRequestedEventArgs *popup;
    ICoreWebView2Deferral *deferral;
    struct App *next;
} App;
static App *apps;

static const IID unknown_iid = {0,0,0,{0xc0,0,0,0,0,0,0,0x46}};
static const IID env_iid = {0x4e8a3389,0xc9d8,0x4bd2,{0xb6,0xb5,0x12,0x4f,0xee,0x6c,0xc1,0x4d}};
static const IID ctrl_iid = {0x6c4819f3,0xc9b7,0x4260,{0x81,0x27,0xc9,0xf5,0xbd,0xe7,0xf6,0x8c}};
static const IID popup_iid = {0xd4c185fe,0xc81c,0x4989,{0x97,0xaf,0x2d,0x3f,0xa7,0xab,0x56,0x51}};
static const IID close_iid = {0x5c19e9e0,0x092f,0x486b,{0xaf,0xfa,0xca,0x82,0x31,0x91,0x30,0x39}};

#define HANDLER(Name, Interface, ID) \
 typedef struct Name { Interface iface; LONG refs; App *app; } Name; \
 static ULONG STDMETHODCALLTYPE Name##_add(Interface *self) { return (ULONG)InterlockedIncrement(&((Name*)self)->refs); } \
 static ULONG STDMETHODCALLTYPE Name##_release(Interface *self) { LONG n=InterlockedDecrement(&((Name*)self)->refs); if(!n) free(self); return (ULONG)n; } \
 static HRESULT STDMETHODCALLTYPE Name##_query(Interface *self, REFIID iid, void **out) { \
    if(!out) return E_POINTER; *out=NULL; \
    if(memcmp(iid,&unknown_iid,sizeof(IID)) && memcmp(iid,&ID,sizeof(IID))) return E_NOINTERFACE; \
    *out=self; Name##_add(self); return S_OK; }
HANDLER(EnvHandler, ICoreWebView2CreateCoreWebView2EnvironmentCompletedHandler, env_iid)
HANDLER(CtrlHandler, ICoreWebView2CreateCoreWebView2ControllerCompletedHandler, ctrl_iid)
HANDLER(PopupHandler, ICoreWebView2NewWindowRequestedEventHandler, popup_iid)
HANDLER(CloseHandler, ICoreWebView2WindowCloseRequestedEventHandler, close_iid)

#include "bridge.h"
#include "updater.h"

static void error_message(HWND window, const WCHAR *text, HRESULT code) {
    WCHAR message[1024];
    swprintf(message,1024,L"%ls\n\nError: 0x%08lX",text,(unsigned long)code);
    MessageBoxW(window,message,L"DITASHA Workspace",MB_OK|MB_ICONERROR);
}

static BOOL extract_resource(int id, const WCHAR *name, WCHAR *target) {
    if(swprintf(target,MAX_PATH,L"%ls\\%ls",storage,name)<0) return FALSE;
    HRSRC resource=FindResourceW(instance,MAKEINTRESOURCEW(id),RT_RCDATA);
    if(!resource) return FALSE;
    DWORD size=SizeofResource(instance,resource);
    const void *bytes=LockResource(LoadResource(instance,resource));
    if(!bytes || !size) return FALSE;
    /* Compare the existing file, so multiple app instances can share the loader. */
    HANDLE current=CreateFileW(target,GENERIC_READ,FILE_SHARE_READ,NULL,OPEN_EXISTING,0,NULL);
    if(current!=INVALID_HANDLE_VALUE) {
        DWORD read=0; void *old=malloc(size);
        BOOL matches=old && GetFileSize(current,NULL)==size && ReadFile(current,old,size,&read,NULL) && read==size && !memcmp(old,bytes,size);
        free(old); CloseHandle(current); if(matches) return TRUE;
    }
    WCHAR temp[MAX_PATH];
    if(!GetTempFileNameW(storage,L"DIT",0,temp)) return FALSE;
    HANDLE file=CreateFileW(temp,GENERIC_WRITE,0,NULL,CREATE_ALWAYS,FILE_ATTRIBUTE_NORMAL,NULL);
    DWORD written=0;
    BOOL ok=file!=INVALID_HANDLE_VALUE && WriteFile(file,bytes,size,&written,NULL) && written==size;
    if(file!=INVALID_HANDLE_VALUE) CloseHandle(file);
    if(ok) ok=MoveFileExW(temp,target,MOVEFILE_REPLACE_EXISTING|MOVEFILE_WRITE_THROUGH);
    if(!ok) DeleteFileW(temp);
    return ok;
}

static void finish_popup(App *app) {
    if(app->deferral) { ICoreWebView2Deferral_Complete(app->deferral); ICoreWebView2Deferral_Release(app->deferral); app->deferral=NULL; }
    if(app->popup) { ICoreWebView2NewWindowRequestedEventArgs_Release(app->popup); app->popup=NULL; }
}

static void resize(App *app) {
    if(app->controller && IsWindow(app->window)) {
        RECT bounds; GetClientRect(app->window,&bounds);
        ICoreWebView2Controller_put_Bounds(app->controller,bounds);
    }
}
static HRESULT start_controller(App *app);
static LRESULT CALLBACK window_proc(HWND hwnd,UINT message,WPARAM wparam,LPARAM lparam);

static App *new_window(BOOL main) {
    App *app=calloc(1,sizeof(App)); if(!app) return NULL;
    app->next=apps; apps=app;
    HMENU menu=CreateMenu(), file=CreatePopupMenu();
    AppendMenuW(file,MF_STRING,1,L"Home"); AppendMenuW(file,MF_STRING,2,L"Refresh");
    AppendMenuW(file,MF_STRING,3,L"Back"); AppendMenuW(file,MF_STRING,4,L"Forward");
    AppendMenuW(file,MF_SEPARATOR,0,NULL); AppendMenuW(file,MF_STRING,5,L"Close");
    AppendMenuW(file,MF_SEPARATOR,0,NULL);
    AppendMenuW(file,MF_STRING,6,L"Check and download updates");
    AppendMenuW(file,MF_STRING,7,L"Restart to install downloaded update");
    AppendMenuW(menu,MF_POPUP,(UINT_PTR)file,L"Workspace");
    HWND hwnd=CreateWindowExW(0,L"DITASHALocalWorkspace",main?L"DITASHA Workspace · Local PC":L"DITASHA Workspace Local",WS_OVERLAPPEDWINDOW,
      CW_USEDEFAULT,CW_USEDEFAULT,main?1440:1000,main?960:800,NULL,menu,instance,app);
    if(!hwnd) { DestroyMenu(menu); return NULL; }
    app->window=hwnd; ++window_count;
    if(main) main_window=hwnd;
    ShowWindow(hwnd,SW_SHOW); UpdateWindow(hwnd);
    return app;
}

static HRESULT STDMETHODCALLTYPE popup_invoke(ICoreWebView2NewWindowRequestedEventHandler *self,ICoreWebView2 *sender,ICoreWebView2NewWindowRequestedEventArgs *args) {
    (void)self; (void)sender;
    /* Local workspace has no remote popups or external browser navigation. */
    ICoreWebView2NewWindowRequestedEventArgs_put_Handled(args,TRUE);
    return S_OK;
}
static ICoreWebView2NewWindowRequestedEventHandlerVtbl popup_vtable={PopupHandler_query,PopupHandler_add,PopupHandler_release,popup_invoke};
static HRESULT STDMETHODCALLTYPE close_invoke(ICoreWebView2WindowCloseRequestedEventHandler *self,ICoreWebView2 *sender,IUnknown *args) {
    (void)sender; (void)args;
    App *app=((CloseHandler*)self)->app;
    if(IsWindow(app->window)) PostMessageW(app->window,WM_CLOSE,0,0);
    return S_OK;
}
static ICoreWebView2WindowCloseRequestedEventHandlerVtbl close_vtable={CloseHandler_query,CloseHandler_add,CloseHandler_release,close_invoke};

static HRESULT STDMETHODCALLTYPE ctrl_invoke(ICoreWebView2CreateCoreWebView2ControllerCompletedHandler *self,HRESULT code,ICoreWebView2Controller *controller) {
    App *app=((CtrlHandler*)self)->app;
    if(!IsWindow(app->window)) { finish_popup(app); if(controller) ICoreWebView2Controller_Close(controller); return S_OK; }
    if(FAILED(code) || !controller) { finish_popup(app); error_message(app->window,L"Could not start the internal workspace window.",code); return S_OK; }
    app->controller=controller; ICoreWebView2Controller_AddRef(controller);
    HRESULT hr=ICoreWebView2Controller_get_CoreWebView2(controller,&app->view);
    if(FAILED(hr)) { finish_popup(app); error_message(app->window,L"Could not load the internal workspace.",hr); return S_OK; }
    hr=attach_local_content(app);
    if(FAILED(hr)){error_message(app->window,L"Could not load the local workspace files.",hr);return S_OK;}
    resize(app); ICoreWebView2Controller_put_IsVisible(controller,TRUE);
    ICoreWebView2Settings *settings=NULL;
    if(SUCCEEDED(ICoreWebView2_get_Settings(app->view,&settings))) {
        ICoreWebView2Settings_put_AreDevToolsEnabled(settings,FALSE);
        ICoreWebView2Settings_put_IsStatusBarEnabled(settings,FALSE);
        ICoreWebView2Settings_Release(settings);
    }
    PopupHandler *handler=calloc(1,sizeof(PopupHandler));
    if(handler) {
        handler->iface.lpVtbl=&popup_vtable; handler->refs=1; handler->app=app;
        EventRegistrationToken token;
        ICoreWebView2_add_NewWindowRequested(app->view,&handler->iface,&token);
        PopupHandler_release(&handler->iface);
    }
    CloseHandler *close_handler=calloc(1,sizeof(CloseHandler));
    if(close_handler) {
        close_handler->iface.lpVtbl=&close_vtable; close_handler->refs=1; close_handler->app=app;
        EventRegistrationToken token;
        ICoreWebView2_add_WindowCloseRequested(app->view,&close_handler->iface,&token);
        CloseHandler_release(&close_handler->iface);
    }
    if(app->popup) {
        hr=ICoreWebView2NewWindowRequestedEventArgs_put_NewWindow(app->popup,app->view);
        finish_popup(app);
    } else hr=ICoreWebView2_Navigate(app->view,URL);
    if(FAILED(hr)) error_message(app->window,L"Could not open the workspace. Use Workspace > Home to retry.",hr);
    if(app->window==main_window)SetTimer(app->window,1001,5000,NULL);
    return S_OK;
}
static ICoreWebView2CreateCoreWebView2ControllerCompletedHandlerVtbl ctrl_vtable={CtrlHandler_query,CtrlHandler_add,CtrlHandler_release,ctrl_invoke};
static HRESULT start_controller(App *app) {
    CtrlHandler *handler=calloc(1,sizeof(CtrlHandler)); if(!handler) return E_OUTOFMEMORY;
    handler->iface.lpVtbl=&ctrl_vtable; handler->refs=1; handler->app=app;
    HRESULT hr=ICoreWebView2Environment_CreateCoreWebView2Controller(environment,app->window,&handler->iface);
    CtrlHandler_release(&handler->iface); return hr;
}

typedef HRESULT (STDAPICALLTYPE *CreateEnvironment)(PCWSTR,PCWSTR,ICoreWebView2EnvironmentOptions*,ICoreWebView2CreateCoreWebView2EnvironmentCompletedHandler*);
static CreateEnvironment create_environment;
static HRESULT start_environment(App *app);
static BOOL install_runtime(HWND window) {
    if(installing) return FALSE;
    if(MessageBoxW(window,L"DITASHA needs Microsoft WebView2 Runtime to display the workspace inside this app.\n\nInstall the runtime now? Microsoft’s included installer will download it. An internet connection is required.",L"First-time setup",MB_YESNO|MB_ICONINFORMATION)!=IDYES) return FALSE;
    WCHAR installer[MAX_PATH];
    if(!extract_resource(102,L"MicrosoftEdgeWebview2Setup.exe",installer)) return FALSE;
    SHELLEXECUTEINFOW info={0}; info.cbSize=sizeof(info); info.fMask=SEE_MASK_NOCLOSEPROCESS|SEE_MASK_FLAG_NO_UI;
    info.lpFile=installer; info.lpParameters=L"/install"; info.nShow=SW_SHOWNORMAL;
    if(!ShellExecuteExW(&info) || !info.hProcess) return FALSE;
    installing=TRUE; EnableWindow(window,FALSE);
    BOOL quit=FALSE;
    for(;;) {
        DWORD wait=MsgWaitForMultipleObjects(1,&info.hProcess,FALSE,INFINITE,QS_ALLINPUT);
        if(wait==WAIT_OBJECT_0 || wait==WAIT_FAILED) break;
        MSG msg;
        while(PeekMessageW(&msg,NULL,0,0,PM_REMOVE)) {
            if(msg.message==WM_QUIT) { quit=TRUE; break; }
            TranslateMessage(&msg); DispatchMessageW(&msg);
        }
        if(quit) break;
    }
    DWORD exit_code=1; GetExitCodeProcess(info.hProcess,&exit_code); CloseHandle(info.hProcess);
    EnableWindow(window,TRUE); installing=FALSE;
    if(quit) { PostQuitMessage(0); return FALSE; }
    return exit_code==0;
}
static BOOL attempted_install=FALSE;
static HRESULT STDMETHODCALLTYPE env_invoke(ICoreWebView2CreateCoreWebView2EnvironmentCompletedHandler *self,HRESULT code,ICoreWebView2Environment *result) {
    App *app=((EnvHandler*)self)->app;
    if(!IsWindow(app->window)) return S_OK;
    if(FAILED(code) || !result) {
        if(code==HRESULT_FROM_WIN32(ERROR_FILE_NOT_FOUND) && !attempted_install) {
            attempted_install=TRUE;
            if(install_runtime(app->window)) { HRESULT hr=start_environment(app); if(SUCCEEDED(hr)) return S_OK; code=hr; }
        }
        error_message(app->window,L"Could not start WebView2. Install Microsoft WebView2 Runtime, then reopen DITASHA.",code);
        return S_OK;
    }
    environment=result; ICoreWebView2Environment_AddRef(environment);
    HRESULT hr=start_controller(app);
    if(FAILED(hr)) error_message(app->window,L"Could not create the workspace window.",hr);
    return S_OK;
}
static ICoreWebView2CreateCoreWebView2EnvironmentCompletedHandlerVtbl env_vtable={EnvHandler_query,EnvHandler_add,EnvHandler_release,env_invoke};
static HRESULT start_environment(App *app) {
    EnvHandler *handler=calloc(1,sizeof(EnvHandler)); if(!handler) return E_OUTOFMEMORY;
    handler->iface.lpVtbl=&env_vtable; handler->refs=1; handler->app=app;
    HRESULT hr=create_environment(NULL,profile,NULL,&handler->iface);
    EnvHandler_release(&handler->iface); return hr;
}

static LRESULT CALLBACK window_proc(HWND hwnd,UINT message,WPARAM wparam,LPARAM lparam) {
    App *app=(App*)GetWindowLongPtrW(hwnd,GWLP_USERDATA);
    if(message==WM_NCCREATE) { app=((CREATESTRUCTW*)lparam)->lpCreateParams; app->window=hwnd; SetWindowLongPtrW(hwnd,GWLP_USERDATA,(LONG_PTR)app); }
    switch(message) {
    case WM_TIMER:
        if(hwnd==main_window){
            if(wparam==1001){KillTimer(hwnd,1001);SetTimer(hwnd,1002,6*60*60*1000,NULL);}
            if(wparam==1001||wparam==1002)start_update(hwnd,FALSE);
        }return 0;
    case UPDATE_RESULT: {
        UpdateResult *result=(UpdateResult*)lparam;
        if(result){
            if(result->ready&&!InterlockedCompareExchange(&ai_pending,0,0))install_downloaded(hwnd);
            else if(result->manual&&!result->ready){char status[512],version[48];WCHAR file[MAX_PATH];update_snapshot(status,version,file);WCHAR *message=to_wide(status);if(message){MessageBoxW(hwnd,message,L"DITASHA updates",MB_OK|MB_ICONINFORMATION);free(message);}}
            free(result);
        }return 0;
    }
    case BRIDGE_REPLY: {
        Reply *reply=(Reply*)lparam;
        if(app && reply)send_reply(app,reply->id,reply->ok,reply->data);
        if(reply){free(reply->data);free(reply);}return 0;
    }
    case WM_SIZE: if(app) resize(app); return 0;
    case WM_MOVE: if(app && app->controller) ICoreWebView2Controller_NotifyParentWindowPositionChanged(app->controller); return 0;
    case WM_SETFOCUS: if(app && app->controller) ICoreWebView2Controller_MoveFocus(app->controller,COREWEBVIEW2_MOVE_FOCUS_REASON_PROGRAMMATIC); return 0;
    case WM_COMMAND:
        if(LOWORD(wparam)==6){start_update(hwnd,TRUE);return 0;}
        if(LOWORD(wparam)==7){install_downloaded(hwnd);return 0;}
        if(LOWORD(wparam)==5) { DestroyWindow(hwnd); return 0; }
        if(app && app->view) switch(LOWORD(wparam)) {
            case 1: ICoreWebView2_Navigate(app->view,URL); break;
            case 2: ICoreWebView2_Reload(app->view); break;
            case 3: ICoreWebView2_GoBack(app->view); break;
            case 4: ICoreWebView2_GoForward(app->view); break;
        }
        return 0;
    case WM_PAINT: {
        PAINTSTRUCT paint; HDC dc=BeginPaint(hwnd,&paint); RECT rect; GetClientRect(hwnd,&rect);
        SetBkMode(dc,TRANSPARENT); SetTextColor(dc,RGB(36,63,55));
        DrawTextW(dc,L"DITASHA Workspace\n\nStarting your internal workspace…",-1,&rect,DT_CENTER|DT_VCENTER|DT_WORDBREAK);
        EndPaint(hwnd,&paint); return 0;
    }
    case WM_DESTROY:
        if(app) {
            finish_popup(app);
            if(app->view) { ICoreWebView2_Release(app->view); app->view=NULL; }
            if(app->controller) { ICoreWebView2Controller_Close(app->controller); ICoreWebView2Controller_Release(app->controller); app->controller=NULL; }
            app->window=NULL;
        }
        if(hwnd==main_window || --window_count==0) PostQuitMessage(0);
        return 0;
    }
    return DefWindowProcW(hwnd,message,wparam,lparam);
}

int WINAPI wWinMain(HINSTANCE inst,HINSTANCE previous,PWSTR command,int show) {
    int argc=0;WCHAR **argv=CommandLineToArgvW(GetCommandLineW(),&argc);
    if(argv&&argc>1&&!wcscmp(argv[1],L"--apply-update")){int result=apply_update(argc,argv);LocalFree(argv);return result;}
    if(argv)LocalFree(argv);
    HANDLE single=CreateMutexW(NULL,FALSE,L"Local\\DITASHAWorkspaceLocal3");
    if(!single)return 1;
    if(GetLastError()==ERROR_ALREADY_EXISTS){HWND existing=FindWindowW(L"DITASHALocalWorkspace",NULL);if(existing){ShowWindow(existing,SW_RESTORE);SetForegroundWindow(existing);}CloseHandle(single);return 0;}
    (void)previous; (void)command; (void)show; instance=inst;
    HRESULT hr=CoInitializeEx(NULL,COINIT_APARTMENTTHREADED);
    if(FAILED(hr)) return 1;
    WCHAR local[MAX_PATH], loader_path[MAX_PATH];
    if(FAILED(SHGetFolderPathW(NULL,CSIDL_LOCAL_APPDATA,NULL,SHGFP_TYPE_CURRENT,local)) || wcslen(local)>MAX_PATH-70) { CoUninitialize(); return 1; }
    swprintf(storage,MAX_PATH,L"%ls\\DITASHA Workspace\\Desktop-%ls",local,APP_VERSION_W);
    swprintf(profile,MAX_PATH,L"%ls\\DITASHA Workspace\\LocalProfile",local);
    int status=SHCreateDirectoryExW(NULL,storage,NULL);
    if(status!=ERROR_SUCCESS && status!=ERROR_ALREADY_EXISTS && status!=ERROR_FILE_EXISTS) { error_message(NULL,L"Could not create DITASHA’s local app folder.",HRESULT_FROM_WIN32(status)); CoUninitialize(); return 1; }
    swprintf(data_root,MAX_PATH,L"%ls\\DITASHA Workspace\\LocalData",local);
    int data_status=SHCreateDirectoryExW(NULL,data_root,NULL);
    if(data_status!=ERROR_SUCCESS && data_status!=ERROR_ALREADY_EXISTS && data_status!=ERROR_FILE_EXISTS){error_message(NULL,L"Could not create the local data folder.",HRESULT_FROM_WIN32(data_status));CoUninitialize();return 1;}
    initialize_updates();
    WCHAR ui_path[MAX_PATH];
    if(!extract_resource(103,L"index.html",ui_path)){error_message(NULL,L"Could not unpack the local workspace.",HRESULT_FROM_WIN32(GetLastError()));CoUninitialize();return 1;}
    if(!extract_resource(101,L"WebView2Loader.dll",loader_path)) { error_message(NULL,L"Could not load the embedded browser component.",HRESULT_FROM_WIN32(GetLastError())); CoUninitialize(); return 1; }
    HMODULE loader=LoadLibraryExW(loader_path,NULL,LOAD_LIBRARY_SEARCH_DLL_LOAD_DIR|LOAD_LIBRARY_SEARCH_SYSTEM32);
    if(!loader) { error_message(NULL,L"Could not load Microsoft WebView2.",HRESULT_FROM_WIN32(GetLastError())); CoUninitialize(); return 1; }
    create_environment=(CreateEnvironment)(void*)GetProcAddress(loader,"CreateCoreWebView2EnvironmentWithOptions");
    if(!create_environment) { FreeLibrary(loader); CoUninitialize(); return 1; }
    WNDCLASSEXW cls={0}; cls.cbSize=sizeof(cls); cls.lpfnWndProc=window_proc; cls.hInstance=instance;
    cls.hIcon=LoadIconW(instance,MAKEINTRESOURCEW(1)); cls.hIconSm=cls.hIcon;
    cls.hCursor=LoadCursorW(NULL,IDC_ARROW); cls.hbrBackground=(HBRUSH)(COLOR_WINDOW+1); cls.lpszClassName=L"DITASHALocalWorkspace";
    RegisterClassExW(&cls);
    App *app=new_window(TRUE); if(!app) { FreeLibrary(loader); CoUninitialize(); return 1; }
    hr=start_environment(app);
    if(FAILED(hr)) {
        if(hr==HRESULT_FROM_WIN32(ERROR_FILE_NOT_FOUND) && install_runtime(app->window)) { attempted_install=TRUE; hr=start_environment(app); }
        if(FAILED(hr)) error_message(app->window,L"Could not start the embedded workspace. Check Microsoft WebView2 Runtime.",hr);
    }
    MSG msg; while(GetMessageW(&msg,NULL,0,0)>0) { TranslateMessage(&msg); DispatchMessageW(&msg); }
    for(App *a=apps;a;a=a->next) if(IsWindow(a->window)) DestroyWindow(a->window);
    if(environment) ICoreWebView2Environment_Release(environment);
    /* Keep callback contexts alive until COM shutdown, including cancelled async operations. */
    CoUninitialize(); FreeLibrary(loader);
    while(apps) { App *next=apps->next; free(apps); apps=next; }
    CloseHandle(single);return 0;
}
