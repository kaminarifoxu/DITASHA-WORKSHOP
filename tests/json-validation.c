#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#include <assert.h>
typedef int BOOL;
#define TRUE 1
#define FALSE 0
#define JSMN_STATIC
#define JSMN_STRICT
#include "jsmn.h"
static BOOL json_root(const char *text,jsmntype_t type) {
    size_t length=strlen(text); if(!length || length>16000000) return FALSE;
    unsigned count=256; jsmntok_t *tokens=NULL; int result;
    do {
        free(tokens);tokens=calloc(count,sizeof(jsmntok_t));if(!tokens)return FALSE;
        jsmn_parser parser;jsmn_init(&parser);result=jsmn_parse(&parser,text,length,tokens,count);
        if(result==JSMN_ERROR_NOMEM)count*=2;
    }while(result==JSMN_ERROR_NOMEM && count<=1048576);
    while(length && (text[length-1]==' '||text[length-1]=='\r'||text[length-1]=='\n'||text[length-1]=='\t'))--length;
    BOOL valid=result>0 && tokens[0].type==type && tokens[0].end==(int)length;
    free(tokens);return valid;
}
int main(void){
 assert(json_root("[{\"role\":\"user\",\"content\":\"hi\"}]",JSMN_ARRAY));
 assert(!json_root("[],\"model\":\"paid/model\"",JSMN_ARRAY));
 assert(!json_root("{\"model\":\"paid/model\"}",JSMN_ARRAY));
 assert(!json_root("[",JSMN_ARRAY));
 assert(json_root("{\"version\":1,\"messages\":[]}",JSMN_OBJECT));
 assert(!json_root("{\"version\":",JSMN_OBJECT));
 puts("Passed native JSON root validation: array/object boundary and policy injection rejection.");
 return 0;
}
