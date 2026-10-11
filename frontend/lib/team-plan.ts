import {requestedEmployee} from './assignment';
import {deterministicSpecialistPlan} from './specialist-routing';
import type {Employee} from './workspace';
export type TeamStep={employee_id:string;brief:string};
const reviewStep=(text:string):TeamStep=>({employee_id:'general',brief:'Review the completed specialist work for this request, resolve conflicts or gaps, and produce the final user-facing answer. Preserve the user constraints and do not merely repeat the raw team notes. Original request: '+text});
function withAmiiReview(steps:TeamStep[],text:string):TeamStep[]{
 if(!steps.length||steps[steps.length-1]?.employee_id==='general')return steps;
 return [...steps,reviewStep(text)];
}
const DOMAIN:Record<string,RegExp>={
 finance:/\b(finance|financial|account|bookkeep|budget|invoice|payment|keuangan|akunt|anggaran|pembayaran)\b/i,
 email:/\b(email|mail|inbox|gmail|imap)\b/i,
 files:/\b(file|folder|directory|berkas|direktori)\b/i,
 developer:/\b(fivem|developer|lua|qbcore|esx|game dev|resource|asset)\b/i,
 web:/\b(web|frontend|backend|react|javascript|typescript|html|css|developer)\b/i,
 designer:/\b(design|designer|logo|brand|visual|graphic|desain|branding)\b/i,
 social:/\b(social|content|trend|tiktok|instagram|media sosial|konten)\b/i,
 writer:/\b(write|writer|copy|article|script|caption|penulis|tulis|naskah)\b/i,
 planner:/\b(plan|planner|strategy|research|roadmap|rencana|strategi|riset)\b/i,
};
function matchingCustomSpecialist(rawId:string,canonicalId:string,team:Employee[]){
 if(rawId===canonicalId)return null;
 const employee=team.find(e=>e.id===rawId);
 if(!employee||['general','developer','web','designer','social','writer','planner','finance','email','files'].includes(employee.id))return null;
 return DOMAIN[canonicalId]?.test(employee.role+' '+employee.instruction)?employee:null;
}
export function resolveTeamPlan(raw:unknown,text:string,team:Employee[]):TeamStep[]{
 const p=raw as {employee_id?:unknown;brief?:unknown;steps?:unknown};
 const valid=(s:any):s is TeamStep=>!!s&&typeof s.employee_id==='string'&&team.some(e=>e.id===s.employee_id)&&typeof s.brief==='string'&&!!s.brief.trim()&&s.brief.length<=16000;
 const requested=requestedEmployee(text,team);
 if(!p||!valid({employee_id:p.employee_id,brief:p.brief}))throw new Error('Pembagian tugas Amii tidak valid. Coba lagi.');
 if(requested)return requested.id==='general'?[{employee_id:requested.id,brief:text}]:withAmiiReview([{employee_id:requested.id,brief:text}],text);

 // Obvious domain work should not depend on the router model making the perfect choice.
 // Amii still coordinates the work, but deterministic routing keeps design, FiveM, web,
 // social, writing, planning, email, finance and file jobs with their actual specialists.
 const deterministic=deterministicSpecialistPlan(text,team);
 if(deterministic){
  // For a single-domain job, a user-created employee may replace the built-in specialist
  // only when Amii picked that employee and their declared role/instructions clearly match
  // the same deterministic domain. Multi-specialist workflows keep their fixed handoff order.
  if(deterministic.length===1&&typeof p.employee_id==='string'){
   const custom=matchingCustomSpecialist(p.employee_id,deterministic[0].employee_id,team);
   if(custom)return withAmiiReview([{employee_id:custom.id,brief:p.brief as string}],text);
  }
  return withAmiiReview(deterministic,text);
 }

 if(p.steps!==undefined){
  if(!Array.isArray(p.steps)||p.steps.length<1||p.steps.length>6||!p.steps.every(valid)||new Set(p.steps.map(s=>s.employee_id)).size!==p.steps.length||(p.steps.length>1&&p.steps.some(s=>s.employee_id==='general')))throw new Error('Rencana kerja tim Amii tidak valid. Coba lagi.');
  return withAmiiReview(p.steps,text);
 }
 const single=[{employee_id:p.employee_id as string,brief:p.brief as string}];
 return p.employee_id==='general'?single:withAmiiReview(single,text);
}
