import {requestedEmployee} from './assignment';
import {deterministicSpecialistPlan} from './specialist-routing';
import type {Employee} from './workspace';
export type TeamStep={employee_id:string;brief:string};
export function resolveTeamPlan(raw:unknown,text:string,team:Employee[]):TeamStep[]{
 const p=raw as {employee_id?:unknown;brief?:unknown;steps?:unknown};
 const valid=(s:any):s is TeamStep=>!!s&&typeof s.employee_id==='string'&&team.some(e=>e.id===s.employee_id)&&typeof s.brief==='string'&&!!s.brief.trim()&&s.brief.length<=16000;
 const requested=requestedEmployee(text,team);
 if(!p||!valid({employee_id:p.employee_id,brief:p.brief}))throw new Error('Pembagian tugas Amii tidak valid. Coba lagi.');
 if(requested)return [{employee_id:requested.id,brief:text}];

 // Obvious domain work should not depend on the router model making the perfect choice.
 // Amii still coordinates the work, but deterministic routing keeps design, FiveM, web,
 // social, writing, planning, email, finance and file jobs with their actual specialists.
 const deterministic=deterministicSpecialistPlan(text,team);
 if(deterministic)return deterministic;

 if(p.steps!==undefined){
  if(!Array.isArray(p.steps)||p.steps.length<1||p.steps.length>6||!p.steps.every(valid)||new Set(p.steps.map(s=>s.employee_id)).size!==p.steps.length||(p.steps.length>1&&p.steps.some(s=>s.employee_id==='general')))throw new Error('Rencana kerja tim Amii tidak valid. Coba lagi.');
  return p.steps;
 }
 return [{employee_id:p.employee_id as string,brief:p.brief as string}];
}
