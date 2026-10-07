/* Portable parsing and protocol policy. No credentials cross the UI bridge. */
#ifndef DITASHA_CHATGPT_CORE_H
#define DITASHA_CHATGPT_CORE_H
#include <stdint.h>
#include <time.h>
typedef struct CgJson { const char *s; jsmntok_t *t; int n; } CgJson;
static void cg_clear(char *s){if(s){volatile char *p=s;size_t n=strlen(s);while(n--)*p++=0;free(s);}}
static CgJson cg_json(const char *s){
 CgJson j={s,NULL,0};if(!s||strlen(s)>16000000)return j;
 unsigned cap=128;int n;do{free(j.t);j.t=calloc(cap,sizeof(*j.t));if(!j.t)return j;jsmn_parser p;jsmn_init(&p);n=jsmn_parse(&p,s,strlen(s),j.t,cap);cap*=2;}while(n==JSMN_ERROR_NOMEM&&cap<=1048576);
 size_t len=strlen(s);while(len&&strchr(" \n\r\t",s[len-1]))len--;
 if(n<=0||j.t[0].end+(j.t[0].type==JSMN_STRING?1:0)!=(int)len){free(j.t);j.t=NULL;return j;}j.n=n;return j;
}
static int cg_skip(CgJson *j,int i){if(i<0||i>=j->n)return j->n;int end=j->t[i].end;i++;while(i<j->n&&j->t[i].start<end)i++;return i;}
static int cg_equal(CgJson *j,int i,const char *s){return i>=0&&i<j->n&&j->t[i].end-j->t[i].start==(int)strlen(s)&&!memcmp(j->s+j->t[i].start,s,strlen(s));}
static int cg_field(CgJson *j,int obj,const char *key){
 if(obj<0||obj>=j->n||j->t[obj].type!=JSMN_OBJECT)return -1;
 for(int i=obj+1;i<j->n&&j->t[i].start<j->t[obj].end;){int v=i+1;if(cg_equal(j,i,key))return v;i=cg_skip(j,v);}return -1;
}
static char *cg_raw(CgJson *j,int i){if(i<0||i>=j->n)return NULL;size_t n=(size_t)(j->t[i].end-j->t[i].start);char *s=malloc(n+3);if(!s)return NULL;if(j->t[i].type==JSMN_STRING){s[0]='"';memcpy(s+1,j->s+j->t[i].start,n);s[n+1]='"';s[n+2]=0;}else{memcpy(s,j->s+j->t[i].start,n);s[n]=0;}return s;}
static int cg_hex(char c){if(c>='0'&&c<='9')return c-'0';if(c>='a'&&c<='f')return c-'a'+10;if(c>='A'&&c<='F')return c-'A'+10;return -1;}
static char *cg_string(CgJson *j,int i){
 if(i<0||i>=j->n||j->t[i].type!=JSMN_STRING)return NULL;
 const char *p=j->s+j->t[i].start,*end=j->s+j->t[i].end;char *s=malloc((size_t)(end-p)+1);if(!s)return NULL;size_t n=0;
 while(p<end){unsigned char c=(unsigned char)*p++;if(c<32)goto bad;if(c!='\\'){s[n++]=(char)c;continue;}if(p==end)goto bad;c=(unsigned char)*p++;
  if(c=='"'||c=='\\'||c=='/')s[n++]=(char)c;else if(c=='b')s[n++]='\b';else if(c=='f')s[n++]='\f';else if(c=='n')s[n++]='\n';else if(c=='r')s[n++]='\r';else if(c=='t')s[n++]='\t';else if(c=='u'){
   uint32_t cp=0;for(int k=0;k<4;k++){if(p==end||cg_hex(*p)<0)goto bad;cp=cp*16+(unsigned)cg_hex(*p++);}
   if(cp>=0xd800&&cp<=0xdbff){if(end-p<6||p[0]!='\\'||p[1]!='u')goto bad;p+=2;uint32_t low=0;for(int k=0;k<4;k++){if(cg_hex(*p)<0)goto bad;low=low*16+(unsigned)cg_hex(*p++);}if(low<0xdc00||low>0xdfff)goto bad;cp=0x10000+((cp-0xd800)<<10)+(low-0xdc00);}else if(cp>=0xdc00&&cp<=0xdfff)goto bad;
   if(!cp)goto bad;
   if(cp<0x80)s[n++]=(char)cp;else if(cp<0x800){s[n++]=(char)(0xc0|(cp>>6));s[n++]=(char)(0x80|(cp&63));}else if(cp<0x10000){s[n++]=(char)(0xe0|(cp>>12));s[n++]=(char)(0x80|((cp>>6)&63));s[n++]=(char)(0x80|(cp&63));}else{s[n++]=(char)(0xf0|(cp>>18));s[n++]=(char)(0x80|((cp>>12)&63));s[n++]=(char)(0x80|((cp>>6)&63));s[n++]=(char)(0x80|(cp&63));}
  }else goto bad;
 }s[n]=0;return s;
 bad:free(s);return NULL;
}
static char *cg_get(CgJson *j,int obj,const char *key){return cg_string(j,cg_field(j,obj,key));}
static long long cg_number(CgJson *j,int obj,const char *key){int i=cg_field(j,obj,key);if(i<0||j->t[i].type!=JSMN_PRIMITIVE)return -1;char *s=cg_raw(j,i);if(!s)return -1;char *end;long long v=strtoll(s,&end,10);if(*end)v=-1;free(s);return v;}
static char *cg_quote(const char *s){if(!s)s="";size_t n=strlen(s);if(n>16000000)return NULL;char *q=malloc(n*6+3);if(!q)return NULL;char *p=q;*p++='"';for(const unsigned char *i=(const unsigned char*)s;*i;i++){if(*i=='"'||*i=='\\'){*p++='\\';*p++=(char)*i;}else if(*i<32){snprintf(p,7,"\\u%04x",*i);p+=6;}else *p++=(char)*i;}*p++='"';*p=0;return q;}
static char *cg_encode(const char *s){size_t n=strlen(s);char *out=malloc(n*3+1);if(!out)return NULL;char *p=out;for(const unsigned char *i=(const unsigned char*)s;*i;i++){if((*i>='a'&&*i<='z')||(*i>='A'&&*i<='Z')||(*i>='0'&&*i<='9')||strchr("-._~",*i))*p++=(char)*i;else{snprintf(p,4,"%%%02X",*i);p+=3;}}*p=0;return out;}
static char *cg_decode(const char *s,size_t n){char *r=malloc(n+1);if(!r)return NULL;size_t m=0;for(size_t i=0;i<n;i++){char c=s[i];if(c=='%'){if(i+2>=n||cg_hex(s[i+1])<0||cg_hex(s[i+2])<0)goto bad;c=(char)(cg_hex(s[i+1])*16+cg_hex(s[i+2]));i+=2;}else if(c=='+')c=' ';if(!c||((unsigned char)c)<32)goto bad;r[m++]=c;}r[m]=0;return r;bad:free(r);return NULL;}
static char *cg_query(const char *query,const char *key){char *value=NULL;size_t kn=strlen(key);for(const char *p=query;*p;){const char *end=strchr(p,'&');if(!end)end=p+strlen(p);const char *eq=memchr(p,'=',(size_t)(end-p));if(eq&&(size_t)(eq-p)==kn&&!memcmp(p,key,kn)){if(value){cg_clear(value);return NULL;}value=cg_decode(eq+1,(size_t)(end-eq-1));if(!value)return NULL;}p=*end?end+1:end;}return value;}
static int cg_host_valid(const char *host){
 if(!host||strlen(host)!=45||strncmp(host,"urn:uuid:",9))return 0;
 for(int i=9;i<45;i++){int p=i-9;if(p==8||p==13||p==18||p==23){if(host[i]!='-')return 0;}else if(cg_hex(host[i])<0)return 0;}
 return host[23]=='4'&&strchr("89abAB",host[28])!=NULL;
}
static int cg_scope(const char *scope,const char *wanted){if(!scope)return 0;size_t n=strlen(wanted);for(const char *p=scope;*p;){while(*p==' ')p++;const char *end=strchr(p,' ');if(!end)end=p+strlen(p);if((size_t)(end-p)==n&&!memcmp(p,wanted,n))return 1;p=end;}return 0;}
static int cg_claims(CgJson *j,const char *client,const char *nonce,long long now){
 char *iss=cg_get(j,0,"iss"),*non=cg_get(j,0,"nonce"),*sub=cg_get(j,0,"sub");int aud=cg_field(j,0,"aud"),match=0;
 if(aud>=0&&j->t[aud].type==JSMN_STRING){char *s=cg_string(j,aud);match=s&&!strcmp(s,client);free(s);}else if(aud>=0&&j->t[aud].type==JSMN_ARRAY){for(int i=aud+1;i<j->n&&j->t[i].start<j->t[aud].end;i=cg_skip(j,i)){char *s=cg_string(j,i);if(s&&!strcmp(s,client))match=1;free(s);}if(j->t[aud].size>1){char *azp=cg_get(j,0,"azp");match=match&&azp&&!strcmp(azp,client);free(azp);}}
 long long exp=cg_number(j,0,"exp"),nbf=cg_number(j,0,"nbf");int ok=iss&&!strcmp(iss,"https://auth.openai.com")&&non&&!strcmp(non,nonce)&&sub&&*sub&&match&&exp>now&&(nbf<0||nbf<=now+60);free(iss);free(non);free(sub);return ok;
}
static char *cg_input(const char *messages){
 CgJson j=cg_json(messages);if(!j.t||j.t[0].type!=JSMN_ARRAY){free(j.t);return NULL;}size_t cap=strlen(messages)*6+128;char *out=malloc(cap);if(!out){free(j.t);return NULL;}size_t used=0;out[used++]='[';int first=1;
 for(int i=1;i<j.n&&j.t[i].start<j.t[0].end;i=cg_skip(&j,i)){char *role=cg_get(&j,i,"role"),*text=cg_get(&j,i,"content"),*q=text?cg_quote(text):NULL;const char *r=role&&!strcmp(role,"system")?"developer":role;
  if(!r||(!strcmp(r,"developer")?0:strcmp(r,"user")&&strcmp(r,"assistant"))||!q){free(role);free(text);free(q);free(out);free(j.t);return NULL;}
  int n=snprintf(out+used,cap-used,"%s{\"role\":\"%s\",\"content\":%s}",first?"":",",r,q);free(role);free(text);free(q);if(n<0||(size_t)n>=cap-used){free(out);free(j.t);return NULL;}used+=(size_t)n;first=0;
 }out[used++]=']';out[used]=0;free(j.t);return out;
}

typedef enum CgResponseError { CG_RESPONSE_OK, CG_RESPONSE_INTERRUPTED, CG_RESPONSE_INVALID, CG_RESPONSE_FAILED, CG_RESPONSE_LIMIT, CG_RESPONSE_AUTH, CG_RESPONSE_TOKENS, CG_RESPONSE_FILTER, CG_RESPONSE_EMPTY } CgResponseError;
static CgResponseError cg_failure(CgJson *j,int obj){
 int err=cg_field(j,obj,"error");char *code=cg_get(j,err>=0?err:obj,"code");CgResponseError reason=CG_RESPONSE_FAILED;
 if(code){if(strstr(code,"rate_limit")||strstr(code,"quota")||strstr(code,"usage_limit"))reason=CG_RESPONSE_LIMIT;else if(strstr(code,"token_expired")||strstr(code,"invalid_api_key")||strstr(code,"authentication"))reason=CG_RESPONSE_AUTH;}free(code);return reason;
}
/* Only a successful terminal response can become a finished employee job. */
static int cg_response_event(const char *data,char **answer,int *terminal,CgResponseError *error){
 if(!strcmp(data,"[DONE]"))return 1;
 CgJson j=cg_json(data);if(!j.t||j.t[0].type!=JSMN_OBJECT){free(j.t);*error=CG_RESPONSE_INVALID;return 0;}
 char *type=cg_get(&j,0,"type");int response=cg_field(&j,0,"response");char *object=cg_get(&j,0,"object");
 if(!type&&object&&!strcmp(object,"response"))response=0;
 if((type&&(!strcmp(type,"error")||!strcmp(type,"response.failed")))||(!type&&cg_field(&j,0,"error")>=0)){*error=cg_failure(&j,response>=0?response:0);goto bad;}
 if((type&&(!strcmp(type,"response.completed")||!strcmp(type,"response.incomplete")))||response==0){
  if((*terminal)++){*error=CG_RESPONSE_INVALID;goto bad;}
  char *status=cg_get(&j,response,"status");if(!status||strcmp(status,"completed")){
   int details=cg_field(&j,response,"incomplete_details");char *reason=cg_get(&j,details,"reason");*error=reason&&!strcmp(reason,"max_output_tokens")?CG_RESPONSE_TOKENS:reason&&!strcmp(reason,"content_filter")?CG_RESPONSE_FILTER:CG_RESPONSE_FAILED;free(reason);free(status);goto bad;
  }free(status);int output=cg_field(&j,response,"output");if(output<0||j.t[output].type!=JSMN_ARRAY){*error=CG_RESPONSE_INVALID;goto bad;}
  size_t size=0;*answer=calloc(1,1);if(!*answer){*error=CG_RESPONSE_INVALID;goto bad;}
  for(int i=output+1;i<j.n&&j.t[i].start<j.t[output].end;i=cg_skip(&j,i)){
   int content=cg_field(&j,i,"content");if(content<0||j.t[content].type!=JSMN_ARRAY)continue;
   for(int k=content+1;k<j.n&&j.t[k].start<j.t[content].end;k=cg_skip(&j,k)){
    char *kind=cg_get(&j,k,"type");const char *field=kind&&!strcmp(kind,"output_text")?"text":kind&&!strcmp(kind,"refusal")?"refusal":NULL;free(kind);if(!field)continue;
    char *text=cg_get(&j,k,field);if(!text){*error=CG_RESPONSE_INVALID;goto bad;}size_t len=strlen(text);char *grown=realloc(*answer,size+len+1);if(!grown){free(text);*error=CG_RESPONSE_INVALID;goto bad;}*answer=grown;memcpy(*answer+size,text,len+1);size+=len;free(text);
   }
  }
  if(!size){*error=CG_RESPONSE_EMPTY;goto bad;}*error=CG_RESPONSE_OK;
 }else if(!type){*error=CG_RESPONSE_INVALID;goto bad;}
 free(type);free(object);free(j.t);return 1;
 bad:free(type);free(object);free(j.t);return 0;
}
static char *cg_completed_ex(const char *stream,CgResponseError *error){
 char *answer=NULL,*event=NULL;int terminal=0;size_t used=0;*error=CG_RESPONSE_INTERRUPTED;
 if(!stream||strlen(stream)>16000000)return NULL;
 const char *start=stream;if(strlen(start)>=3&&!memcmp(start,"\xef\xbb\xbf",3))start+=3;
 while(*start&&strchr(" \t\r\n",*start))start++;
 if(*start=='{'){if(!cg_response_event(start,&answer,&terminal,error))goto bad;goto done;}
 for(const char *p=start;*p;){const char *end=p;while(*end&&*end!='\r'&&*end!='\n')end++;size_t n=(size_t)(end-p);
  if(!n){if(used){event[used]=0;if(!cg_response_event(event,&answer,&terminal,error))goto bad;used=0;}}
  else if(n>=5&&!memcmp(p,"data:",5)){const char *v=p+5;if(v<end&&*v==' ')v++;size_t len=(size_t)(end-v);char *grown=realloc(event,used+len+2);if(!grown){*error=CG_RESPONSE_INVALID;goto bad;}event=grown;if(used)event[used++]='\n';memcpy(event+used,v,len);used+=len;event[used]=0;}
  p=end;if(*p=='\r')p++;if(*p=='\n')p++;
 }
 if(used&&!cg_response_event(event,&answer,&terminal,error))goto bad;
 done:if(terminal&&*error==CG_RESPONSE_OK&&answer&&*answer){free(event);return answer;}
 bad:free(event);free(answer);return NULL;
}
static inline char *cg_completed(const char *stream){CgResponseError error;return cg_completed_ex(stream,&error);}
static inline const char *cg_response_error(CgResponseError error){
 switch(error){
 case CG_RESPONSE_LIMIT:return "Batas penggunaan ChatGPT tercapai. Buka Kelola penggunaan di Pengaturan.";
 case CG_RESPONSE_AUTH:return "Sesi ChatGPT berakhir. Login kembali di Pengaturan.";
 case CG_RESPONSE_TOKENS:return "ChatGPT mencapai batas token sebelum selesai. Coba tugas yang lebih kecil atau model lain.";
 case CG_RESPONSE_FILTER:return "ChatGPT menghentikan jawaban karena filter konten. Ubah permintaan dan coba lagi.";
 case CG_RESPONSE_FAILED:return "OpenAI menghentikan permintaan ChatGPT. Coba lagi atau pilih model lain di Pengaturan.";
 case CG_RESPONSE_EMPTY:return "Model ChatGPT selesai tanpa jawaban teks. Pilih model teks lain di Pengaturan.";
 case CG_RESPONSE_INVALID:return "Format jawaban ChatGPT tidak valid. Coba lagi; jika berulang, laporkan pesan ini.";
 default:return "Koneksi ChatGPT terputus sebelum jawaban selesai. Periksa internet dan coba lagi.";
 }
}
#endif
