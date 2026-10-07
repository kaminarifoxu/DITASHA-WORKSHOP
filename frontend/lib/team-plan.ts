import {requestedEmployee} from './assignment';
import type {Employee} from './workspace';
export type TeamStep={employee_id:string;brief:string};
export function resolveTeamPlan(raw:unknown,text:string,team:Employee[]):TeamStep[]{
 const p=raw as {employee_id?:unknown;brief?:unknown;steps?:unknown};
 const valid=(s:any):s is TeamStep=>!!s&&typeof s.employee_id==='string'&&team.some(e=>e.id===s.employee_id)&&typeof s.brief==='string'&&!!s.brief.trim()&&s.brief.length<=16000;
 const requested=requestedEmployee(text,team);
 if(!p||!valid({employee_id:p.employee_id,brief:p.brief}))throw new Error('Pembagian tugas Amii tidak valid. Coba lagi.');
 if(requested)return [{employee_id:requested.id,brief:text}];
 // Website creation always includes research, design and implementation, even if a router selects only Sora.
 const website=/\b(landing[ -]?page|website|web[ -]?site|situs|halaman web)\b/i.test(text);
 const build=/\b(buat(?:kan)?|bikin|bangun|create|build|make|develop|design)\b/i.test(text);
 const repair=/\b(fix|debug|error|perbaiki|rusak)\b/i.test(text);
 if(website&&build&&!repair)return [
  {employee_id:'social',brief:'Research audience fit and content/market direction for this website. Use supplied live Google search trends only when relevant. Suggest design directions as your recommendations, not as verified design popularity. Original request: '+text},
  {employee_id:'designer',brief:'Develop the landing-page visual design: layout, hierarchy, palette, typography, responsive behavior and components. Use Mika’s research and the shared brief; you work alongside Sora. Original request: '+text},
  {employee_id:'web',brief:'Deliver complete usable landing-page code and setup instructions based on Mika’s research and the shared brief. Create an initial implementation alongside Luna; a final integration pass will apply her design. Preserve the original requirements. Original request: '+text}
 ];
 if(p.steps!==undefined){
  if(!Array.isArray(p.steps)||p.steps.length<1||p.steps.length>6||!p.steps.every(valid)||new Set(p.steps.map(s=>s.employee_id)).size!==p.steps.length||(p.steps.length>1&&p.steps.some(s=>s.employee_id==='general')))throw new Error('Rencana kerja tim Amii tidak valid. Coba lagi.');
  return p.steps;
 }
 return [{employee_id:p.employee_id as string,brief:p.brief as string}];
}
