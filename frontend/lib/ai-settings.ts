import {RECOMMENDED_MODELS} from './recommended-ai';
import {FREE_MODEL,FREE_CODING_MODEL,isCodingEmployee} from './ai-policy';
import type {Employee} from './workspace';
export const providerIds=['openrouter','groq','gemini','openai','custom','chatgpt'] as const;
export type ProviderId=typeof providerIds[number];
export type APIProviderId=Exclude<ProviderId,'chatgpt'>;
export const apiProviderIds=providerIds.filter((id):id is APIProviderId=>id!=='chatgpt');
export const providerNames:Record<ProviderId,string>={openrouter:'OpenRouter',groq:'Groq',gemini:'Google Gemini',openai:'OpenAI API',custom:'API kompatibel OpenAI',chatgpt:'ChatGPT · paket kamu'};
export const providerURLs:Record<APIProviderId,string>={openrouter:'https://openrouter.ai/api/v1',groq:'https://api.groq.com/openai/v1',gemini:'https://generativelanguage.googleapis.com/v1beta/openai',openai:'https://api.openai.com/v1',custom:''};
export type ModelChoice={id:string;name:string;free?:boolean};
export type ProviderSettings={general:string;coding:string;baseUrl:string;freeOnly:boolean;maxTokens:number;models:ModelChoice[]};
export type EmployeeRoute={provider:ProviderId|'default';model:string};
export type AIConfig={providers:Record<APIProviderId,ProviderSettings>;employees:Record<string,EmployeeRoute>};
export type KeyStatus={provider:ProviderId;keys:Record<APIProviderId,boolean>};
export type ChatGPTInfo={connected:boolean;permitted:boolean;general:string;coding:string;models:{slug:string;display_name:string}[]};
export function defaultAIConfig():AIConfig{return {providers:Object.fromEntries(apiProviderIds.map(id=>[id,{general:id==='openrouter'?FREE_MODEL:'',coding:id==='openrouter'?FREE_CODING_MODEL:'',baseUrl:providerURLs[id],freeOnly:id==='openrouter',maxTokens:id==='openrouter'?3000:id==='openai'?8192:4096,models:id==='openrouter'?[{id:FREE_MODEL,name:'OpenRouter · router gratis',free:true},...RECOMMENDED_MODELS]:[]}])) as AIConfig['providers'],employees:{}};}
const validModel=(v:unknown)=>typeof v==='string'&&v.length<=256&&(!v||/^[\x21-\x7e]+$/.test(v));
export function isFreeSlug(model:string){return model==='openrouter/free'||model.endsWith(':free');}
export function validBaseURL(value:string){try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password&&!url.search&&!url.hash&&!/[\s\\]/.test(value)&&value.length<=2048;}catch{return false;}}
export function validateAIConfig(value:unknown,employeeIds?:Set<string>):AIConfig{
 if(value===undefined)return defaultAIConfig();const input=value as AIConfig;if(!input||typeof input!=='object'||!input.providers||!input.employees||Array.isArray(input.employees))throw new Error('Pengaturan AI tidak valid.');
 const output=defaultAIConfig();for(const id of apiProviderIds){const p=input.providers[id];if(!p||!validModel(p.general)||!validModel(p.coding)||typeof p.baseUrl!=='string'||(id==='custom'&&p.baseUrl&&!validBaseURL(p.baseUrl))||typeof p.freeOnly!=='boolean'||!Number.isInteger(p.maxTokens)||p.maxTokens<512||p.maxTokens>32768||!Array.isArray(p.models)||p.models.length>2000)throw new Error('Pengaturan '+providerNames[id]+' tidak valid.');
  const models=p.models.map(m=>{if(!m||!validModel(m.id)||!m.id||typeof m.name!=='string'||m.name.length>512||(m.free!==undefined&&typeof m.free!=='boolean'))throw new Error('Daftar model AI tidak valid.');return {id:m.id,name:m.name,free:m.free===true};});
  if(id==='openrouter'&&p.freeOnly&&((p.general&&!isFreeSlug(p.general))||(p.coding&&!isFreeSlug(p.coding))))throw new Error('Mode gratis OpenRouter memerlukan model :free atau openrouter/free.');
  output.providers[id]={general:p.general,coding:p.coding,baseUrl:id==='custom'?p.baseUrl:providerURLs[id],freeOnly:id==='openrouter'?p.freeOnly:false,maxTokens:p.maxTokens,models};
 }
 const entries=Object.entries(input.employees);if(entries.length>200)throw new Error('Maksimal 200 pilihan model karyawan.');for(const [id,r] of entries){if(id.length>100||!id||(employeeIds&&!employeeIds.has(id))||!r||!['default',...providerIds].includes(r.provider)||!validModel(r.model)||(r.provider==='default'&&r.model!==''))throw new Error('Pilihan model karyawan tidak valid.');if(r.provider==='openrouter'&&output.providers.openrouter.freeOnly&&r.model&&!isFreeSlug(r.model))throw new Error('Model karyawan OpenRouter harus gratis.');output.employees[id]={provider:r.provider,model:r.model};}
 return output;
}
export function resolveEmployeeRoute(employee:Pick<Employee,'id'|'role'>,config:AIConfig,defaultProvider:ProviderId,chatgpt:ChatGPTInfo){
 const assignment=config.employees[employee.id],provider=assignment&&assignment.provider!=='default'?assignment.provider:defaultProvider;
 const coding=isCodingEmployee(employee),p=provider==='chatgpt'?null:config.providers[provider];
 const model=assignment?.model||(provider==='chatgpt'?(coding?chatgpt.coding:chatgpt.general):(coding?p!.coding:p!.general));
 if(!model)throw new Error('Pilih model untuk '+employee.id+' ('+providerNames[provider]+') di Pengaturan.');
 if(provider==='chatgpt'&&(!chatgpt.connected||!chatgpt.permitted||!chatgpt.models.some(m=>m.slug===model)))throw new Error('Hubungkan ChatGPT dan pilih model akun yang tersedia untuk '+employee.id+'.');
 if(provider==='openrouter'&&p!.freeOnly&&!isFreeSlug(model))throw new Error('Mode gratis OpenRouter aktif untuk '+employee.id+'. Pilih model gratis.');
 if(provider==='custom'&&!validBaseURL(p!.baseUrl))throw new Error('Isi base URL HTTPS untuk API khusus di Pengaturan.');
 return {provider,model,coding,baseUrl:p?.baseUrl||'',freeOnly:p?.freeOnly||false,maxTokens:p?.maxTokens||0};
}
export function employeeConnected(employee:Pick<Employee,'id'|'role'>,config:AIConfig,keys:KeyStatus,chatgpt:ChatGPTInfo){try{const route=resolveEmployeeRoute(employee,config,keys.provider,chatgpt);return route.provider==='chatgpt'?true:keys.keys[route.provider];}catch{return false;}}
