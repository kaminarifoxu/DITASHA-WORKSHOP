import type {TeamStep} from './team-plan';
import {configureOffice,boardNode,nodes,deskNodes,idleNodes,route,advance,type Point} from './office-motion';
export type Phase='idle'|'walking'|'assigning'|'returning'|'working'|'reporting'|'receiving'|'queued'|'ready';
type Actor={point:Point;node:number;path:number[];phase:Phase;pause:number;desk:number;distance:number;facing:number;arrival?:()=>void};
export class OfficeEngine {
 actors:Record<string,Actor>={}; enabled=true;
 board:{employee_id:string;brief:string;status:'queued'|'working'|'ready'|'done'|'failed'}[]=[];
 async postPlan(steps:TeamStep[]){
  this.board=steps.map(s=>({...s,status:'queued'}));
  const ids=steps.map(s=>s.employee_id).filter(id=>id!=='general'&&this.actors[id]);
  if(!ids.length)return;
  await this.go('general',boardNode,'assigning');
  for(const id of ids){const a=this.actors[id];a.path=[];a.phase='queued';}
  await this.go('general',this.actors.general.desk,'returning');this.actors.general.phase='receiving';
 }
 fail(){for(const task of this.board)if(task.status!=='done')task.status='failed';}

 sync(ids:string[]){if(Object.keys(this.actors).join('|')!==ids.join('|')){this.reset();this.actors={};configureOffice(ids.length);}ids.forEach((id,i)=>{if(!this.actors[id]){const n=id==='general'?deskNodes[0]:idleNodes[i%idleNodes.length];this.actors[id]={point:{...nodes[n]},node:n,path:[],phase:'idle',pause:0,desk:deskNodes[i],distance:0,facing:1};}});for(const id of Object.keys(this.actors))if(!ids.includes(id))delete this.actors[id];}
 snapshot(){return Object.fromEntries(Object.entries(this.actors).map(([id,a])=>[id,{point:{...a.point},phase:a.phase,walkingFrame:a.path.length?[0,1,2,1][Math.floor(a.distance/1.9)%4]:null,facing:a.facing}]));}
 setEnabled(enabled:boolean){this.enabled=enabled;if(!enabled)for(const a of Object.values(this.actors)){if(a.path.length&&a.phase!=='walking'){const end=a.path[a.path.length-1];a.node=end;a.point={...nodes[end]};}a.path=[];if(a.phase==='walking')a.phase='idle';const done=a.arrival;a.arrival=undefined;done?.();}}
 tick(seconds:number){for(const a of Object.values(this.actors)){
  if(a.path.length){const next=a.path[0],m=advance(a.point,nodes[next],Math.min(seconds,1),a.phase==='walking'?12:22);const dx=m.point.x-a.point.x,dy=m.point.y-a.point.y;a.distance+=Math.hypot(dx,dy);if(Math.abs(dx)>.001)a.facing=dx<0?-1:1;a.point=m.point;if(m.arrived){a.node=a.path.shift()!;if(!a.path.length){const done=a.arrival;a.arrival=undefined;if(a.phase==='walking'){a.phase='idle';a.pause=1+Math.random()*2;}done?.();}}}
  else if(a!==this.actors.general&&a.phase==='idle'&&this.enabled){a.pause-=seconds;if(a.pause<=0){const choices=idleNodes.filter(n=>n!==a.node);a.path=route(a.node,choices[Math.floor(Math.random()*choices.length)]);a.phase='walking';}}
 }}
 async go(id:string,target:number,phase:Phase){const a=this.actors[id];if(!a)return;a.phase=phase;const anchor=a.path[0]??a.node;a.path=[...(a.path.length?[anchor]:[]),...route(anchor,target)];if(!this.enabled){a.path=[];a.node=target;a.point={...nodes[target]};return;}if(a.path.length)await new Promise<void>(resolve=>{const timeout=setTimeout(()=>{const end=a.path[a.path.length-1];if(end!==undefined){a.node=end;a.point={...nodes[end]};}a.path=[];a.arrival=undefined;resolve();},15000);a.arrival=()=>{clearTimeout(timeout);resolve();};});}
 async assign(worker:string){
  const ami=this.actors.general,w=this.actors[worker];if(!ami||!w)return;
  if(worker==='general'){ami.phase='working';return;}
  let task=this.board.find(t=>t.employee_id===worker&&t.status==='queued');
  if(!task){await this.postPlan([{employee_id:worker,brief:'Tugas dari Amii'}]);task=this.board[0];}
  await this.go(worker,boardNode,'receiving');
  w.point.x+=6+(Object.keys(this.actors).indexOf(worker)%3)*5;
  await this.go(worker,w.desk,'returning');task.status='working';w.phase='working';ami.phase='receiving';
 }
 async publishResult(worker:string){
  const w=this.actors[worker];if(!w)return;
  await this.go(worker,boardNode,'reporting');
  const task=this.board.find(t=>t.employee_id===worker);if(task)task.status='done';
  await this.go(worker,w.desk,'returning');w.phase='ready';
 }
 ready(worker:string){const a=this.actors[worker];if(a)a.phase='ready';const task=this.board.find(t=>t.employee_id===worker);if(task)task.status='ready';}
 integrate(worker:string){const a=this.actors[worker];if(a)a.phase='working';const task=this.board.find(t=>t.employee_id===worker);if(task)task.status='working';}
 async reportTogether(ids:string[]){
  await Promise.all(ids.map(async(id,i)=>{await this.report(id);if(this.actors[id])this.actors[id].point.x+=i*8;}));
 }

 async report(worker:string){
  const ami=this.actors.general,w=this.actors[worker];if(!ami||!w)return;
  await this.go(worker,ami.desk,'reporting');if(worker!=='general')w.point.x+=7;w.phase='receiving';
  const task=this.board.find(t=>t.employee_id===worker&&(t.status==='working'||t.status==='ready'));if(task)task.status='done';
 }

 reset(){for(const a of Object.values(this.actors)){a.arrival?.();a.arrival=undefined;a.phase='idle';a.pause=.6;}}
}
export const officeEngine=new OfficeEngine();
export type OfficePositions=ReturnType<OfficeEngine['snapshot']>;
