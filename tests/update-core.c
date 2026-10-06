#include <assert.h>
#define JSMN_STATIC
#define JSMN_STRICT
#include "../src/update-core.h"
static const char valid[]="{\"tag_name\":\"v3.2.0\",\"draft\":false,\"prerelease\":false,\"assets\":[{\"name\":\"DITASHA-Workspace.exe\",\"state\":\"uploaded\",\"digest\":\"sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef\",\"size\":6000000,\"url\":\"https://api.github.com/repos/kaminarifoxu/DITASHA-WORKSHOP/releases/assets/1234\"}]}";
int main(void){
 assert(newer_version("v3.2.0","3.1.0"));assert(newer_version("v4.0.0","3.99.99"));assert(newer_version("3.10.0","3.9.9"));
 assert(!newer_version("3.1.0","3.1.0"));assert(!newer_version("3.0.9","3.1.0"));assert(!newer_version("3.2.0-beta","3.1.0"));assert(!newer_version("v3.2","3.1.0"));
 UpdateInfo info={0};assert(parse_release(valid,&info));assert(info.size==6000000);assert(!strcmp(info.asset_path,"/repos/kaminarifoxu/DITASHA-WORKSHOP/releases/assets/1234"));
 char changed[sizeof(valid)+100];strcpy(changed,valid);char *p=strstr(changed,"false");memcpy(p,"true ",5);assert(!parse_release(changed,&info));
 strcpy(changed,valid);p=strstr(changed,"0123456789abcdef");*p='z';assert(!parse_release(changed,&info));
 strcpy(changed,valid);p=strstr(changed,"kaminarifoxu");*p='x';assert(!parse_release(changed,&info));
 strcpy(changed,valid);p=strstr(changed,"Workspace.exe");*p='X';assert(!parse_release(changed,&info));
 assert(!parse_release("{\"tag_name\":\"v9.0.0\"}",&info));assert(!parse_release("{",&info));
 puts("Passed release validation: numeric versions, no downgrade/prerelease, digest and repository/asset restrictions.");return 0;
}
