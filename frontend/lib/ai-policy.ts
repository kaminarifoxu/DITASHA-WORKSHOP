import type {Employee} from '@/lib/workspace';
export const FREE_MODEL='openrouter/free';
export const FREE_CODING_MODEL='poolside/laguna-s-2.1:free';
export function isCodingEmployee(employee:Pick<Employee,'id'|'role'>){return employee.id==='developer'||/\b(coding|coder|developer|programmer|software|fullstack|frontend|backend|kode|pemrograman|programming)\b/i.test(employee.role);}
export function safeFreeModel(value:string|undefined,fallback:string){return value&&(value==='openrouter/free'||/^[a-z0-9._-]+\/[a-z0-9._-]+:free$/i.test(value))?value:fallback;}
export function employeeModel(employee:Pick<Employee,'id'|'role'>,settings:{OPENROUTER_MODEL?:string;OPENROUTER_CODING_MODEL?:string}){return isCodingEmployee(employee)?safeFreeModel(settings.OPENROUTER_CODING_MODEL,FREE_CODING_MODEL):safeFreeModel(settings.OPENROUTER_MODEL,FREE_MODEL);}
export function freeRequestPolicy(employee:Pick<Employee,'id'|'role'>,settings:{OPENROUTER_MODEL?:string;OPENROUTER_CODING_MODEL?:string}){const model=employeeModel(employee,settings);return {model,...(model!==FREE_MODEL?{models:[model,FREE_MODEL]}:{}),provider:{max_price:{prompt:0,completion:0,request:0}}};}
