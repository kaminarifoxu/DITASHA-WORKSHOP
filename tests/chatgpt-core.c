#include <assert.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#define JSMN_STATIC
#define JSMN_STRICT
#include "jsmn.h"
#include "../src/chatgpt-core.h"
static CgJson claims(const char *s){return cg_json(s);}
int main(void){
 assert(cg_host_valid("urn:uuid:12345678-1234-4abc-8def-123456789abc"));assert(!cg_host_valid("random-base64-host"));assert(!cg_host_valid("12345678-1234-4abc-8def-123456789abc"));assert(!cg_host_valid("urn:uuid:12345678-1234-1abc-8def-123456789abc"));
 CgJson j=claims("{\"iss\":\"https://auth.openai.com\",\"aud\":\"oaiapp_test\",\"nonce\":\"n123\",\"exp\":200,\"sub\":\"user\"}");
 assert(cg_claims(&j,"oaiapp_test","n123",100));assert(!cg_claims(&j,"oaiapp_other","n123",100));assert(!cg_claims(&j,"oaiapp_test","wrong",100));assert(!cg_claims(&j,"oaiapp_test","n123",200));free(j.t);
 j=claims("{\"iss\":\"https://evil.test\",\"aud\":\"oaiapp_test\",\"nonce\":\"n123\",\"exp\":200,\"sub\":\"user\"}");assert(!cg_claims(&j,"oaiapp_test","n123",100));free(j.t);
 j=claims("{\"iss\":\"https://auth.openai.com\",\"aud\":[\"oaiapp_test\",\"other\"],\"azp\":\"other\",\"nonce\":\"n123\",\"exp\":200,\"sub\":\"user\"}");assert(!cg_claims(&j,"oaiapp_test","n123",100));free(j.t);
 assert(cg_scope("openid resource.invoke chatgpt.tokens.use.direct offline_access","chatgpt.tokens.use.direct"));assert(!cg_scope("chatgpt.tokens.use.direct.fake","chatgpt.tokens.use.direct"));assert(!cg_scope(NULL,"chatgpt.tokens.use.direct"));
 char *s=cg_query("code=abc%2Bdef&state=abc_123&client_id=oaiapp_test","code");assert(!strcmp(s,"abc+def"));cg_clear(s);assert(!cg_query("state=a&state=b","state"));assert(!cg_query("code=abc%00def","code"));assert(!cg_query("code=%XX","code"));
 s=cg_encode("http://127.0.0.1:123/auth/callback");assert(!strcmp(s,"http%3A%2F%2F127.0.0.1%3A123%2Fauth%2Fcallback"));free(s);
 j=cg_json("{\"x\":\"Indo \\u2764 \\ud83e\\udd8a\\n\"}");s=cg_get(&j,0,"x");assert(s&&!strcmp(s,"Indo ❤ 🦊\n"));char *q=cg_quote(s);CgJson round=cg_json(q);char *again=cg_string(&round,0);assert(!strcmp(s,again));free(again);free(round.t);free(q);free(s);free(j.t);
 j=cg_json("{\"x\":\"\\ud800\"}");assert(!cg_get(&j,0,"x"));free(j.t);
 s=cg_input("[{\"role\":\"system\",\"content\":\"Rules\\nMore\"},{\"role\":\"user\",\"content\":\"Hi\"}]");assert(s&&strstr(s,"\"role\":\"developer\""));assert(!strstr(s,"system"));free(s);assert(!cg_input("[],\"model\":\"paid\""));assert(!cg_input("[{\"role\":\"tool\",\"content\":\"Hi\"}]"));
 const char *good="event: response.created\r\ndata: {\"type\":\"response.created\"}\r\n\r\nevent: response.output_text.delta\ndata: {\"type\":\"response.output_text.delta\",\"delta\":\"Hello\"}\n\ndata: {\"type\":\"response.completed\",\"response\":{\"status\":\"completed\",\"output\":[{\"type\":\"message\",\"content\":[{\"type\":\"output_text\",\"text\":\"Hello 🦊\\n\"}]}]}}\n\ndata: [DONE]\n";
 s=cg_completed(good);assert(s&&!strcmp(s,"Hello 🦊\n"));free(s);
 assert(!cg_completed("data: {\"type\":\"response.output_text.delta\",\"delta\":\"unfinished\"}\n\n"));
 assert(!cg_completed("data: {\"type\":\"response.failed\",\"response\":{\"error\":{\"code\":\"usage_limit\"}}}\n\n"));
 assert(!cg_completed("data: {\"type\":\"response.completed\",\"response\":{\"status\":\"incomplete\",\"output\":[]}}\n\n"));
 assert(!cg_completed("data: invalid\n\n"));

 const char *json="{\"object\":\"response\",\"status\":\"completed\",\"output\":[{\"type\":\"message\",\"content\":[{\"type\":\"output_text\",\"text\":\"Done\"}]}]}";
 s=cg_completed(json);assert(s&&!strcmp(s,"Done"));free(s);
 const char *compact="\xef\xbb\xbf: keepalive\r\nevent: response.completed\r\ndata:{\"type\":\"response.completed\",\r\ndata:\"response\":{\"status\":\"completed\",\"output\":[{\"content\":[{\"type\":\"output_text\",\"text\":\"Done\"}]}]}}\r\n\r\ndata:[DONE]\r\n\r\n";
 s=cg_completed(compact);assert(s&&!strcmp(s,"Done"));free(s);
 s=cg_completed("data:{\"type\":\"response.completed\",\"response\":{\"status\":\"completed\",\"output\":[{\"content\":[{\"type\":\"refusal\",\"refusal\":\"Cannot help.\"}]}]}}\n\n");assert(s&&!strcmp(s,"Cannot help."));free(s);
 CgResponseError error;
 assert(!cg_completed_ex("data:{\"type\":\"response.incomplete\",\"response\":{\"status\":\"incomplete\",\"incomplete_details\":{\"reason\":\"max_output_tokens\"}}}\n\n",&error));assert(error==CG_RESPONSE_TOKENS);
 assert(!cg_completed_ex("data:{\"type\":\"error\",\"code\":\"rate_limit_exceeded\",\"message\":\"private\"}\n\n",&error));assert(error==CG_RESPONSE_LIMIT);assert(!strstr(cg_response_error(error),"private"));
 assert(!cg_completed_ex("data:{\"type\":\"response.failed\",\"response\":{\"error\":{\"code\":\"invalid_api_key\"}}}\n\n",&error));assert(error==CG_RESPONSE_AUTH);
 assert(!cg_completed_ex("data:{\"type\":\"response.output_text.delta\",\"delta\":\"partial\"}\n\n",&error));assert(error==CG_RESPONSE_INTERRUPTED);
 assert(!cg_completed_ex(NULL,&error));
 assert(!cg_completed_ex("data:{broken}\n\n",&error));assert(error==CG_RESPONSE_INVALID);
 s=malloc(strlen(good)*2+1);strcpy(s,good);strcat(s,good);assert(!cg_completed(s));free(s);

 assert(!cg_completed_ex("data:{\"type\":\"response.incomplete\",\"response\":{\"status\":\"incomplete\",\"incomplete_details\":{\"reason\":\"content_filter\"}}}\n\n",&error));assert(error==CG_RESPONSE_FILTER);
 assert(!cg_completed_ex("{\"object\":\"response\",\"status\":\"completed\",\"output\":[]}",&error));assert(error==CG_RESPONSE_EMPTY);
 assert(!cg_completed_ex("{\"error\":{\"code\":\"insufficient_quota\"}}",&error));assert(error==CG_RESPONSE_LIMIT);
 s=malloc(strlen(good)+100);strcpy(s,good);strcat(s,"\ndata:{\"type\":\"error\",\"code\":\"server_error\"}\n\n");assert(!cg_completed_ex(s,&error));assert(error==CG_RESPONSE_FAILED);free(s);
 puts("Passed ChatGPT protocol tests: OIDC claims, permissions, callbacks, encoding, developer roles, completed SSE and interrupted stream rejection.");return 0;
}
