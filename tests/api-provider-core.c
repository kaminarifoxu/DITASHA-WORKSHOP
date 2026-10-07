#include <assert.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#define JSMN_STATIC
#define JSMN_STRICT
#include "jsmn.h"
#include "../src/chatgpt-core.h"
#include "../src/api-provider-core.h"
int main(void){
 assert(!strcmp(api_base(1),"https://api.groq.com/openai/v1"));assert(api_base(4)==NULL);CgJson bools=cg_json("{\"coding\":true}");assert(api_true(&bools,0,"coding"));free(bools.t);
 assert(api_index("groq")==1);assert(api_index("../../key")==-1);assert(api_index(NULL)==-1);assert(api_index("chatgpt")==5);
 assert(api_key_valid("gsk_test_never_real"));assert(!api_key_valid(NULL));assert(!api_key_valid("sk-short"));assert(!api_key_valid("token\r\nInjected: yes"));
 assert(api_model_valid("openai/gpt-oss-120b"));assert(!api_model_valid("model\nInjected"));assert(api_free_slug("openrouter/free"));assert(api_free_slug("vendor/model:free"));assert(!api_free_slug("vendor/paid"));
 const char *messages="[{\"role\":\"user\",\"content\":\"Hello\"}]";char *body=api_chat_body(0,"vendor/model:free",messages,1,4096);assert(body&&strstr(body,"max_price")&&strstr(body,"\"prompt\":0")&&!strstr(body,"models\""));free(body);
 assert(!api_chat_body(0,"paid/model",messages,1,4096));body=api_chat_body(0,"paid/model",messages,0,4096);assert(body&&!strstr(body,"max_price"));free(body);
 body=api_chat_body(3,"gpt-test",messages,0,8192);assert(body&&strstr(body,"max_completion_tokens")&&!strstr(body,"\"max_tokens\""));free(body);
 body=api_chat_body(2,"gemini-test",messages,0,4096);assert(body&&strstr(body,"\"max_tokens\":4096"));free(body);
 body=api_chat_body(3,"gpt-6.1-sol","[{\"role\":\"system\",\"content\":\"Rules\"},{\"role\":\"user\",\"content\":\"Hi\"}]",0,8192);assert(body&&strstr(body,"developer")&&!strstr(body,"system"));free(body);
 assert(!api_chat_body(1,"x",messages,0,100000));assert(!api_chat_body(1,"x","[],\"model\":\"paid\"",0,4096));
 const char *catalog="{\"data\":[{\"id\":\"vendor/model:free\",\"name\":\"Free model\",\"pricing\":{\"prompt\":\"0\",\"completion\":\"0\"},\"architecture\":{\"output_modalities\":[\"text\"]}},{\"id\":\"vendor/paid\",\"name\":\"Paid model\",\"pricing\":{\"prompt\":\"0.1\",\"completion\":\"0.2\"}},{\"id\":\"images-only\",\"architecture\":{\"output_modalities\":[\"image\"]}}]}";
 char *list=api_catalog(catalog,0);assert(list&&strstr(list,"openrouter/free")&&strstr(list,"vendor/model:free")&&strstr(list,"vendor/paid")&&!strstr(list,"images-only"));free(list);
 list=api_catalog("{\"data\":[{\"id\":\"chat-model\"},{\"id\":\"whisper-large\"},{\"id\":\"inactive-chat\",\"active\":false},{\"id\":\"embedding-model\"}]}",1);assert(list&&strstr(list,"chat-model")&&!strstr(list,"whisper")&&!strstr(list,"inactive")&&!strstr(list,"embedding"));free(list);
 assert(!api_catalog("{bad}",1));
 /* Shared helpers remain covered so this translation unit compiles with -Werror. */
 assert(!cg_claims(&(CgJson){0},"client","nonce",0));assert(cg_host_valid("urn:uuid:12345678-1234-4abc-8def-123456789abc"));assert(cg_scope("chatgpt.tokens.use.direct","chatgpt.tokens.use.direct"));char *s=cg_query("state=test","state");cg_clear(s);s=cg_encode("https://example.test");free(s);s=cg_input(messages);free(s);assert(!cg_completed("data: [DONE]\n"));
 puts("Passed native API policy: provider/key validation, free-only caps, billing opt-in, token fields, model catalogs and JSON injection rejection.");return 0;
}
