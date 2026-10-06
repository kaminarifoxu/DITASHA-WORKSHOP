#ifndef DITASHA_UPDATE_INSTALL_H
#define DITASHA_UPDATE_INSTALL_H
#ifndef UPDATE_MOVE_FILE
#define UPDATE_MOVE_FILE MoveFileExW
#endif
static BOOL hash_file(const WCHAR *path,char digest[65],DWORD *size){
    HANDLE file=CreateFileW(path,GENERIC_READ,FILE_SHARE_READ,NULL,OPEN_EXISTING,0,NULL);if(file==INVALID_HANDLE_VALUE)return FALSE;
    HCRYPTPROV provider=0;HCRYPTHASH hash=0;BOOL ok=CryptAcquireContextW(&provider,NULL,NULL,PROV_RSA_AES,CRYPT_VERIFYCONTEXT)&&CryptCreateHash(provider,CALG_SHA_256,0,0,&hash);
    BYTE bytes[65536];DWORD n=0,total=0;
    while(ok){if(!ReadFile(file,bytes,sizeof(bytes),&n,NULL)){ok=FALSE;break;}if(!n)break;if(n>100000000-total){ok=FALSE;break;}total+=n;ok=CryptHashData(hash,bytes,n,0);}
    BYTE result[32];DWORD result_size=sizeof(result);if(ok)ok=CryptGetHashParam(hash,HP_HASHVAL,result,&result_size,0)&&result_size==32;
    if(ok){for(int i=0;i<32;++i)sprintf(digest+i*2,"%02x",result[i]);digest[64]=0;if(size)*size=total;}
    if(hash)CryptDestroyHash(hash);if(provider)CryptReleaseContext(provider,0);CloseHandle(file);return ok;
}
static BOOL is_windows_x64(const WCHAR *path){
    HANDLE file=CreateFileW(path,GENERIC_READ,FILE_SHARE_READ,NULL,OPEN_EXISTING,0,NULL);if(file==INVALID_HANDLE_VALUE)return FALSE;
    IMAGE_DOS_HEADER dos;IMAGE_NT_HEADERS64 nt;DWORD n=0;
    BOOL ok=ReadFile(file,&dos,sizeof(dos),&n,NULL)&&n==sizeof(dos)&&dos.e_magic==IMAGE_DOS_SIGNATURE&&dos.e_lfanew>0&&dos.e_lfanew<1000000;
    if(ok){SetFilePointer(file,dos.e_lfanew,NULL,FILE_BEGIN);ok=ReadFile(file,&nt,sizeof(nt),&n,NULL)&&n==sizeof(nt)&&nt.Signature==IMAGE_NT_SIGNATURE&&nt.FileHeader.Machine==IMAGE_FILE_MACHINE_AMD64&&nt.OptionalHeader.Magic==IMAGE_NT_OPTIONAL_HDR64_MAGIC&&nt.OptionalHeader.Subsystem==IMAGE_SUBSYSTEM_WINDOWS_GUI;}
    CloseHandle(file);return ok;
}
static BOOL replace_executable(const WCHAR *source,const WCHAR *target){
    WCHAR temp[MAX_PATH],backup[MAX_PATH];if(wcslen(target)>MAX_PATH-16)return FALSE;
    swprintf(temp,MAX_PATH,L"%ls.new",target);swprintf(backup,MAX_PATH,L"%ls.previous",target);
    if(!CopyFileW(source,temp,FALSE))return FALSE;
    BOOL had_target=GetFileAttributesW(target)!=INVALID_FILE_ATTRIBUTES;
    if(had_target&&!UPDATE_MOVE_FILE(target,backup,MOVEFILE_REPLACE_EXISTING|MOVEFILE_WRITE_THROUGH)){DeleteFileW(temp);return FALSE;}
    if(!UPDATE_MOVE_FILE(temp,target,MOVEFILE_REPLACE_EXISTING|MOVEFILE_WRITE_THROUGH)){
        if(had_target)UPDATE_MOVE_FILE(backup,target,MOVEFILE_REPLACE_EXISTING|MOVEFILE_WRITE_THROUGH);DeleteFileW(temp);return FALSE;
    }return TRUE;
}

#endif
