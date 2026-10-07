/* Exercise the same native crypto/storage implementation on a Windows runner. */
#define wWinMain ditasha_unused_entry
#include "../src/desktop.c"
#include <assert.h>
#include "chatgpt-fixtures.h"
int wmain(void){
 char *sub=NULL,*email=NULL;
 assert(cg_verify_token(CG_FIXTURE_TOKEN,"oaiapp_fixture","fixture-nonce",CG_FIXTURE_JWKS,&sub,&email));assert(!strcmp(sub,"fixture-user"));assert(!strcmp(email,"foxu@example.test"));free(sub);free(email);sub=email=NULL;
 assert(!cg_verify_token(CG_FIXTURE_TOKEN,"oaiapp_other","fixture-nonce",CG_FIXTURE_JWKS,&sub,&email));
 assert(!cg_verify_token(CG_FIXTURE_TOKEN,"oaiapp_fixture","wrong",CG_FIXTURE_JWKS,&sub,&email));
 assert(!cg_verify_token(CG_FIXTURE_WRONG_ISSUER,"oaiapp_fixture","fixture-nonce",CG_FIXTURE_JWKS,&sub,&email));
 assert(!cg_verify_token(CG_FIXTURE_EXPIRED,"oaiapp_fixture","fixture-nonce",CG_FIXTURE_JWKS,&sub,&email));
 assert(!cg_verify_token(CG_FIXTURE_NONE,"oaiapp_fixture","fixture-nonce",CG_FIXTURE_JWKS,&sub,&email));
 char *tampered=_strdup(CG_FIXTURE_TOKEN);char *signature=strrchr(tampered,'.')+1;signature[0]=signature[0]=='A'?'B':'A';assert(!cg_verify_token(tampered,"oaiapp_fixture","fixture-nonce",CG_FIXTURE_JWKS,&sub,&email));free(tampered);
 char *random=cg_random();assert(random&&strlen(random)==43);BYTE hash[32];assert(cg_sha((BYTE*)random,(ULONG)strlen(random),hash));char *encoded=cg_b64(hash,32);DWORD n=0;BYTE *decoded=cg_unb64(encoded,&n);assert(n==32&&!memcmp(hash,decoded,32));cg_clear(random);free(encoded);free(decoded);
 WCHAR temp[MAX_PATH];assert(GetTempPathW(MAX_PATH,temp));assert(GetTempFileNameW(temp,L"DCG",0,data_root));assert(DeleteFileW(data_root));assert(CreateDirectoryW(data_root,NULL));
 CgStore s={0},loaded={0};assert(cg_load(&s));assert(cg_save(&s));char *stable=_strdup(s.host);assert(stable&&cg_host_valid(stable));
 free(s.host);s.host=_strdup("old-base64-host-from-v380");assert(cg_save(&s));assert(cg_host_valid(s.host));free(stable);stable=_strdup(s.host);
 WCHAR *endpoint=NULL;assert(api_url(1,"https://evil.test",L"/models",&endpoint));assert(!wcscmp(endpoint,L"https://api.groq.com/openai/v1/models"));free(endpoint);endpoint=NULL;
 assert(api_url(4,"https://example.test:8443/v1/",L"/chat/completions",&endpoint));assert(!wcscmp(endpoint,L"https://example.test:8443/v1/chat/completions"));free(endpoint);endpoint=NULL;
 assert(!api_url(4,"https://user:pass@example.test/v1",L"/models",&endpoint));assert(!api_url(4,"http://example.test/v1",L"/models",&endpoint));assert(!api_url(4,"https://example.test/v1?api_key=leak",L"/models",&endpoint));
 for(int provider=1;provider<5;provider++){assert(api_save_key(provider,"fixture-api-key-never-real"));char *key=api_load_key(provider);assert(key&&!strcmp(key,"fixture-api-key-never-real"));cg_clear(key);}
 char *key_status=api_key_status();assert(key_status&&strstr(key_status,"\"groq\":true")&&!strstr(key_status,"fixture-api-key-never-real"));free(key_status);
 free(s.active);s.active=_strdup("oaiapp_fixture");s.count=1;CgAccount *a=&s.accounts[0];a->client=_strdup("oaiapp_fixture");a->sub=_strdup("fixture-user");a->email=_strdup("foxu@example.test");a->access=_strdup("test-access-never-real");a->refresh=_strdup("test-refresh-never-real");a->identity=_strdup(CG_FIXTURE_TOKEN);a->scope=_strdup("chatgpt.tokens.use.direct");a->models=_strdup("[{\"slug\":\"fixture-model\",\"display_name\":\"Fixture model\"}]");a->general=_strdup("fixture-model");a->coding=_strdup("fixture-model");a->expiry=4102444800;assert(cg_save(&s));assert(cg_load(&loaded));assert(!strcmp(stable,loaded.host));assert(!strcmp(loaded.accounts[0].access,"test-access-never-real"));assert(cg_model_allowed(&loaded.accounts[0],"fixture-model"));assert(!cg_model_allowed(&loaded.accounts[0],"paid/arbitrary"));char *status=cg_status(&loaded);assert(status&&!strstr(status,"test-access-never-real")&&!strstr(status,"test-refresh-never-real")&&!strstr(status,CG_FIXTURE_TOKEN));free(status);
 DWORD size=0;char *cipher=read_local(L"chatgpt.accounts",1000000,&size,NULL);assert(cipher&&size>0);for(DWORD i=0;i+strlen("test-access-never-real")<=size;i++)assert(memcmp(cipher+i,"test-access-never-real",strlen("test-access-never-real")));free(cipher);free(stable);cg_free_store(&s);cg_free_store(&loaded);
 WCHAR path[MAX_PATH];local_path(L"chatgpt.accounts",path);assert(DeleteFileW(path));for(int provider=1;provider<5;provider++){WCHAR name[64];assert(api_key_name(provider,name));local_path(name,path);assert(DeleteFileW(path));}assert(RemoveDirectoryW(data_root));puts("Passed Windows ChatGPT RSA signatures, tampering rejection, PKCE primitives, DPAPI storage and secret-free status.");return 0;
}
