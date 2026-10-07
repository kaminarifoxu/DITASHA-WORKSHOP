#ifndef DITASHA_API_PROVIDER_CORE_H
#define DITASHA_API_PROVIDER_CORE_H
static const char *api_ids[]={"openrouter","groq","gemini","openai","custom","chatgpt"};
static int api_index(const char *id){if(!id)return -1;for(int i=0;i<6;i++)if(!strcmp(id,api_ids[i]))return i;return -1;}
static int api_model_valid(const char *id){if(!id||!*id||strlen(id)>256)return 0;for(const unsigned char *p=(const unsigned char*)id;*p;p++)if(*p<=32||*p>=127)return 0;return 1;}
static int api_key_valid(const char *key){if(!key||strlen(key)<10||strlen(key)>4096)return 0;for(const unsigned char *p=(const unsigned char*)key;*p;p++)if(*p<=32||*p>=127)return 0;return 1;}
static int api_free_slug(const char *model){if(!model)return 0;size_t n=strlen(model);return !strcmp(model,"openrouter/free")||(n>5&&!strcmp(model+n-5,":free"));}
static const char *api_base(int provider){switch(provider){case 0:return "https://openrouter.ai/api/v1";case 1:return "https://api.groq.com/openai/v1";case 2:return "https://generativelanguage.googleapis.com/v1beta/openai";case 3:return "https://api.openai.com/v1";default:return NULL;}}
static int api_true(CgJson *j,int obj,const char *key){return cg_equal(j,cg_field(j,obj,key),"true");}
static int api_zero_price(CgJson *j,int obj,const char *key){char *v=cg_get(j,obj,key);if(!v)return 0;char *end=NULL;double price=strtod(v,&end);int zero=*v&&end&&!*end&&price==0;free(v);return zero;}
static char *api_chat_body(int provider,const char *model,const char *messages,int free_only,int max_tokens){
 if(provider<0||provider>=5||!api_model_valid(model)||max_tokens<512||max_tokens>32768||(provider==0&&free_only&&!api_free_slug(model)))return NULL;
 CgJson j=cg_json(messages);int valid=j.t&&j.t[0].type==JSMN_ARRAY&&j.t[0].size>0;free(j.t);if(!valid)return NULL;
 char *normalized=NULL;if(provider==3&&((!strncmp(model,"gpt-",4)&&atoi(model+4)>=5)||(model[0]=='o'&&model[1]>='1'&&model[1]<='9'))){normalized=cg_input(messages);if(!normalized)return NULL;messages=normalized;}char *q=cg_quote(model);if(!q){free(normalized);return NULL;}size_t n=strlen(messages)+strlen(q)+400;char *body=malloc(n);if(body)snprintf(body,n,"{\"model\":%s,\"messages\":%s,\"%s\":%d,\"stream\":false%s}",q,messages,provider==3?"max_completion_tokens":"max_tokens",max_tokens,provider==0&&free_only?",\"provider\":{\"max_price\":{\"prompt\":0,\"completion\":0,\"request\":0}}":"");free(q);cg_clear(normalized);return body;
}
static char *api_catalog(const char *response,int provider){
 CgJson j=cg_json(response);int array=j.t?cg_field(&j,0,"data"):-1;if(array<0||j.t[array].type!=JSMN_ARRAY){free(j.t);return NULL;}char *out=calloc(1000000,1);if(!out){free(j.t);return NULL;}size_t used=1;int count=0;out[0]='[';
 if(provider==0){const char *router="{\"id\":\"openrouter/free\",\"name\":\"OpenRouter · router gratis\",\"free\":true}";strcpy(out+used,router);used+=strlen(router);count++;}
 for(int i=array+1;count<2000&&i<j.n&&j.t[i].start<j.t[array].end;i=cg_skip(&j,i)){
  char *id=cg_get(&j,i,"id"),*name=cg_get(&j,i,"name");if(!name&&id){name=malloc(strlen(id)+1);if(name)strcpy(name,id);}
  if(!api_model_valid(id)||!name||strlen(name)>512){free(id);free(name);continue;}if(provider==0&&!strcmp(id,"openrouter/free")){free(id);free(name);continue;}
  if(provider!=0&&(strstr(id,"whisper")||strstr(id,"tts")||strstr(id,"embed")||strstr(id,"dall-e")||strstr(id,"image")||strstr(id,"moderation")||strstr(id,"transcri")||strstr(id,"audio")||strstr(id,"realtime")||strstr(id,"video")||strstr(id,"safeguard")||cg_equal(&j,cg_field(&j,i,"active"),"false"))){free(id);free(name);continue;}
  int architecture=cg_field(&j,i,"architecture"),mods=cg_field(&j,architecture,"output_modalities"),text=mods<0;
  if(mods>=0&&j.t[mods].type==JSMN_ARRAY)for(int k=mods+1;k<j.n&&j.t[k].start<j.t[mods].end;k=cg_skip(&j,k))if(cg_equal(&j,k,"text"))text=1;
  if(!text){free(id);free(name);continue;}
  int price=cg_field(&j,i,"pricing");int is_free=provider==0&&(api_free_slug(id)||(api_zero_price(&j,price,"prompt")&&api_zero_price(&j,price,"completion")));
  char *qi=cg_quote(id),*qn=cg_quote(name);int n=qi&&qn?snprintf(out+used,1000000-used,"%s{\"id\":%s,\"name\":%s,\"free\":%s}",count?",":"",qi,qn,is_free?"true":"false"):-1;free(qi);free(qn);free(id);free(name);if(n<0||(size_t)n>=1000000-used){free(out);free(j.t);return NULL;}used+=(size_t)n;count++;
 }free(j.t);if(!count||used+2>=1000000){free(out);return NULL;}out[used++]=']';out[used]=0;return out;
}
#endif
