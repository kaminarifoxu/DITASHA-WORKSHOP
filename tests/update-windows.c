#define UNICODE
#define _UNICODE
#include <windows.h>
#include <wincrypt.h>
#include <wchar.h>
#include <stdio.h>
#include <string.h>
#include <assert.h>
#include "../src/ai-slots.h"
static BOOL fail_install=FALSE;
static BOOL test_move(LPCWSTR from,LPCWSTR to,DWORD flags){
    size_t length=wcslen(from);if(fail_install&&length>4&&!wcscmp(from+length-4,L".new")){SetLastError(ERROR_ACCESS_DENIED);return FALSE;}
    return MoveFileExW(from,to,flags);
}
#define UPDATE_MOVE_FILE test_move
#include "../src/update-install.h"
static void write_text(const WCHAR *path,const char *value){HANDLE f=CreateFileW(path,GENERIC_WRITE,0,NULL,CREATE_ALWAYS,0,NULL);assert(f!=INVALID_HANDLE_VALUE);DWORD n=0;assert(WriteFile(f,value,(DWORD)strlen(value),&n,NULL)&&n==strlen(value));CloseHandle(f);}
static void expect_text(const WCHAR *path,const char *expected){char bytes[64]={0};HANDLE f=CreateFileW(path,GENERIC_READ,FILE_SHARE_READ,NULL,OPEN_EXISTING,0,NULL);assert(f!=INVALID_HANDLE_VALUE);DWORD n=0;assert(ReadFile(f,bytes,63,&n,NULL));CloseHandle(f);assert(!strcmp(bytes,expected));}
int main(int argc,char **argv){
 assert(reserve_ai_slot());assert(reserve_ai_slot());assert(reserve_ai_slot());assert(!reserve_ai_slot());
 release_ai_slot();assert(ai_pending==2);assert(reserve_ai_slot());
 release_ai_slot();release_ai_slot();assert(ai_pending==1);release_ai_slot();assert(ai_pending==0);
 puts("Passed native AI slots: three concurrent workers, overflow rejection, independent completion and updater idle state.");
 WCHAR temp[MAX_PATH],folder[MAX_PATH],source[MAX_PATH],target[MAX_PATH],backup[MAX_PATH],missing[MAX_PATH],scratch[MAX_PATH];
 assert(GetTempPathW(MAX_PATH,temp));assert(GetTempFileNameW(temp,L"DIT",0,folder));assert(DeleteFileW(folder));assert(CreateDirectoryW(folder,NULL));
 swprintf(source,MAX_PATH,L"%ls\\candidate.exe",folder);swprintf(target,MAX_PATH,L"%ls\\target.exe",folder);swprintf(backup,MAX_PATH,L"%ls.previous",target);swprintf(missing,MAX_PATH,L"%ls\\missing.exe",folder);swprintf(scratch,MAX_PATH,L"%ls.new",target);
 write_text(source,"new");write_text(target,"old");
 char hash[65];DWORD size=0;assert(hash_file(source,hash,&size)&&size==3);assert(!strcmp(hash,"11507a0e2f5e69d5dfa40a62a1bd7b6ee57e6bcd85c67c9b8431b36fff21c437"));
 assert(!is_windows_x64(source));
 if(argc>1){WCHAR candidate[MAX_PATH];assert(MultiByteToWideChar(CP_UTF8,0,argv[1],-1,candidate,MAX_PATH));assert(is_windows_x64(candidate));}
 assert(!replace_executable(missing,target));expect_text(target,"old");
 HANDLE lock=CreateFileW(target,GENERIC_READ,0,NULL,OPEN_EXISTING,0,NULL);assert(lock!=INVALID_HANDLE_VALUE);assert(!replace_executable(source,target));CloseHandle(lock);expect_text(target,"old");
 fail_install=TRUE;assert(!replace_executable(source,target));fail_install=FALSE;expect_text(target,"old");
 assert(replace_executable(source,target));expect_text(target,"new");expect_text(backup,"old");
 DeleteFileW(source);DeleteFileW(target);DeleteFileW(backup);DeleteFileW(scratch);RemoveDirectoryW(folder);
 puts("Passed Windows updater: SHA-256, PE validation, locked/missing files, rollback, successful replacement and previous-version backup.");return 0;
}
