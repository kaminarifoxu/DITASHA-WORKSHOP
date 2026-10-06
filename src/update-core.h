#ifndef DITASHA_UPDATE_CORE_H
#define DITASHA_UPDATE_CORE_H
#include <string.h>
#include <stdlib.h>
#include <stdio.h>
#include <ctype.h>
#include "jsmn.h"
/* A stable release tag is exactly vMAJOR.MINOR.PATCH (or without v). */
static int parse_version(const char *s,unsigned out[3]) {
    if(*s=='v')++s;
    for(int i=0;i<3;++i){
        if(!isdigit((unsigned char)*s))return 0;
        unsigned n=0;do{if(n>99999)return 0;n=n*10+(unsigned)(*s++-'0');}while(isdigit((unsigned char)*s));out[i]=n;
        if(i<2){if(*s++!='.')return 0;}else if(*s)return 0;
    }return 1;
}
static int newer_version(const char *candidate,const char *current){
    unsigned a[3],b[3];if(!parse_version(candidate,a)||!parse_version(current,b))return 0;
    for(int i=0;i<3;++i){if(a[i]!=b[i])return a[i]>b[i];}return 0;
}
static int token_string(const char *json,const jsmntok_t *token,char *out,size_t capacity){
    if(token->type!=JSMN_STRING||token->start<0||token->end<token->start)return 0;
    size_t n=(size_t)(token->end-token->start);if(n>=capacity)return 0;
    /* Update metadata only accepts simple ASCII identifiers / URLs, no escapes. */
    for(size_t i=0;i<n;++i){unsigned char c=(unsigned char)json[token->start+(int)i];if(c<32||c>126||c=='\\')return 0;}
    memcpy(out,json+token->start,n);out[n]=0;return 1;
}
static int token_next(const jsmntok_t *tokens,int count,int index){int end=tokens[index].end;++index;while(index<count&&tokens[index].start<end)++index;return index;}
static int object_field(const char *json,const jsmntok_t *tokens,int count,int object,const char *key){
    if(object<0||object>=count||tokens[object].type!=JSMN_OBJECT)return -1;
    int end=tokens[object].end,index=object+1;
    while(index<count&&tokens[index].start<end){
        char name[128];int value=index+1;if(value>=count)return -1;
        if(token_string(json,&tokens[index],name,sizeof(name))&&!strcmp(name,key))return value;
        index=token_next(tokens,count,value);
    }return -1;
}
typedef struct UpdateInfo {char version[48],asset_path[256],sha256[65];unsigned long size;} UpdateInfo;
static int parse_release(const char *json,UpdateInfo *info){
    jsmn_parser parser;jsmn_init(&parser);jsmntok_t *tokens=calloc(32768,sizeof(jsmntok_t));if(!tokens)return 0;
    int count=jsmn_parse(&parser,json,strlen(json),tokens,32768),ok=0;
    if(count<1||tokens[0].type!=JSMN_OBJECT)goto done;
    int tag=object_field(json,tokens,count,0,"tag_name"),draft=object_field(json,tokens,count,0,"draft"),pre=object_field(json,tokens,count,0,"prerelease"),assets=object_field(json,tokens,count,0,"assets");
    if(tag<0||draft<0||pre<0||assets<0||tokens[assets].type!=JSMN_ARRAY)goto done;
    if(tokens[draft].type!=JSMN_PRIMITIVE||tokens[draft].end-tokens[draft].start!=5||memcmp(json+tokens[draft].start,"false",5))goto done;
    if(tokens[pre].type!=JSMN_PRIMITIVE||tokens[pre].end-tokens[pre].start!=5||memcmp(json+tokens[pre].start,"false",5))goto done;
    if(!token_string(json,&tokens[tag],info->version,sizeof(info->version)))goto done;
    unsigned components[3];if(!parse_version(info->version,components))goto done;
    for(int i=assets+1;i<count&&tokens[i].start<tokens[assets].end;i=token_next(tokens,count,i)){
        int name=object_field(json,tokens,count,i,"name"),digest=object_field(json,tokens,count,i,"digest"),url=object_field(json,tokens,count,i,"url"),size=object_field(json,tokens,count,i,"size"),state=object_field(json,tokens,count,i,"state");
        char filename[128],hash[80],address[512],state_text[32];
        if(name<0||digest<0||url<0||size<0||state<0)continue;
        if(!token_string(json,&tokens[name],filename,sizeof(filename))||strcmp(filename,"DITASHA-Workspace.exe"))continue;
        if(!token_string(json,&tokens[state],state_text,sizeof(state_text))||strcmp(state_text,"uploaded"))continue;
        if(!token_string(json,&tokens[digest],hash,sizeof(hash))||strlen(hash)!=71||strncmp(hash,"sha256:",7))continue;
        int valid=1;for(int j=7;j<71;++j)if(!isxdigit((unsigned char)hash[j]))valid=0;if(!valid)continue;
        if(!token_string(json,&tokens[url],address,sizeof(address)))continue;
        const char *prefix="https://api.github.com/repos/kaminarifoxu/DITASHA-WORKSHOP/releases/assets/";
        if(strncmp(address,prefix,strlen(prefix)))continue;
        const char *id=address+strlen(prefix);if(!*id)continue;valid=1;for(const char *p=id;*p;++p)if(!isdigit((unsigned char)*p))valid=0;if(!valid)continue;
        if(tokens[size].type!=JSMN_PRIMITIVE)continue;
        char amount[24];int n=tokens[size].end-tokens[size].start;if(n<1||n>=24)continue;memcpy(amount,json+tokens[size].start,(size_t)n);amount[n]=0;
        char *end=NULL;unsigned long bytes=strtoul(amount,&end,10);if(*end||bytes<1024||bytes>100000000)continue;
        for(int j=0;j<64;++j)info->sha256[j]=(char)tolower((unsigned char)hash[j+7]);info->sha256[64]=0;
        snprintf(info->asset_path,sizeof(info->asset_path),"%s",address+strlen("https://api.github.com"));info->size=bytes;ok=1;break;
    }
done:free(tokens);return ok;
}
#endif
