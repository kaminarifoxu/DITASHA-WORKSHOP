import type {TeamStep} from './team-plan';
import {configureOffice,boardNode,nodes,deskNodes,idleNodes,route,advance,type Point} from './office-motion';
export type Phase='idle'|'walking'|'assigning'|'returning'|'working'|'reporting'|'receiving'|'queued'|'ready';
export type BoardTask={employee_id:string;brief:string;status:'queued'|'working'|'ready'|'done'|'failed'};
export type CompletedTask={employee_id:string;brief:string;completedAt:number;handedTo?:string};
type Actor={point:Point;node:number;path:number[];phase:Phase;pause:number;desk:number;distance:number;facing:number;direction?:'front'|'back';arrival?:()=>void};
const BOARD_KEY='ditasha-task-board-v1',HISTORY_KEY='ditasha-task-history-v1';
function loadBoard():BoardTask[]{
 if(typeof window==='undefined')return [];
 try{
  const value=JSON.parse(localStorage.getItem(BOARD_KEY)||'[]');
  if(!Array.isArray(value))return [];
  return value.filter((t:any)=>t&&typeof t.employee_id==='string'&&typeof t.brief==='string'&&t.brief.length<=16000&&['queued','working','ready','done','failed'].includes(t.status)).slice(0,12);
 }catch{return [];}
}
function loadHistory():CompletedTask[]{
 if(typeof window==='undefined')return [];
 try{
  const value=JSON.parse(localStorage.getItem(HISTORY_KEY)||'[]');
  if(!Array.isArray(value))return [];
  return value.filter((t:any)=>t&&typeof t.employee_id==='string'&&typeof t.brief==='string'&&t.brief.length<=16000&&Number.isFinite(t.completedAt)&&(t.handedTo===undefined||typeof t.handedTo==='string')).slice(0,40);
 }catch{return [];}
}
export class OfficeEngine {
 actors:Record<string,Actor>={}; enabled=true;
 private occupied=new Set<string>(); private changed=new Set<()=>void>();
 private chatRelease:(()=>void)|undefined;
 get chatBusy(){return !!this.chatRelease;}
 async chatWork<T>(work:()=>Promise<T>):Promise<T>{
  // Acquire before the workspace write queue to avoid a desk/write lock inversion.
  const release=await this.reserve(['__chat','general','email','finance','files',...Object.keys(this.actors)]);
  this.chatRelease=release;
  try{return await work();}finally{this.reset();}
 }
 activity:Record<string,string>={};
 private async reserve(ids:string[]){
  while(ids.some(id=>this.occupied.has(id)))await new Promise<void>(resolve=>this.changed.add(resolve));
  ids.forEach(id=>this.occupied.add(id));
  return ()=>{ids.forEach(id=>this.occupied.delete(id));const waiting=[...this.changed];this.changed.clear();waiting.forEach(fn=>fn());};
 }
 async deskWork<T>(ids:string[],label:string,work:()=>Promise<T>):Promise<T>{
  const release=await this.reserve(ids);
  try{
   ids.forEach(id=>{this.activity[id]='Menuju meja · '+label;});
   await Promise.all(ids.map(id=>this.actors[id]?this.go(id,this.actors[id].desk,'returning'):Promise.resolve()));
   ids.forEach(id=>{if(this.actors[id])this.actors[id].phase='working';this.activity[id]=label;});
   return await work();
  }finally{
   ids.forEach(id=>{delete this.activity[id];const a=this.actors[id];if(a){a.path=[];a.phase='idle';a.pause=1;}});release();
  }
 }
 board:BoardTask[]=loadBoard();
 history:CompletedTask[]=loadHistory();
 private persistBoard(){if(typeof window!=='undefined')try{localStorage.setItem(BOARD_KEY,JSON.stringify(this.board.slice(0,12)));}catch{}}
 private persistHistory(){if(typeof window!=='undefined')try{localStorage.setItem(HISTORY_KEY,JSON.stringify(this.history.slice(0,40)));}catch{}}
 private completeTask(task:BoardTask|undefined,handedTo?:string){
  if(!task||task.status==='done')return;
  task.status='done';
  this.history=[{employee_id:task.employee_id,brief:task.brief,completedAt:Date.now(),...(handedTo?{handedTo}:{})},...this.history].slice(0,40);
  this.persistHistory();
 }
 async postPlan(steps:TeamStep[]){
  if(!this.chatRelease)this.chatRelease=await this.reserve(steps.map(s=>s.employee_id));
  this.board=steps.map(s=>({...s,status:'queued'}));this.persistBoard();
  const ids=steps.map(s=>s.employee_id).filter(id=>id!=='general'&&this.actors[id]);
  if(!ids.length)return;
  await this.go('general',boardNode,'assigning');
  for(const id of ids){const a=this.actors[id];a.path=[];a.phase='queued';}
  await this.go('general',this.actors.general.desk,'returning');this.actors.general.phase='receiving';
 }
 fail(){for(const task of this.board)if(task.status!=='done')task.status='failed';this.persistBoard();}

 sync(ids:string[]){if(Object.keys(this.actors).join('|')!==ids.join('|')){for(const a of Object.values(this.actors)){a.arrival?.();a.arrival=undefined;}this.actors={};configureOffice(ids.length);}ids.forEach((id,i)=>{if(!this.actors[id]){const active=!!this.activity[id],n=id==='general'||active?deskNodes[i]:idleNodes[i%idleNodes.length];this.actors[id]={point:{...nodes[n]},node:n,path:[],phase:active?'working':'idle',pause:0,desk:deskNodes[i],distance:0,facing:1};}});for(const id of Object.keys(this.actors))if(!ids.includes(id))delete this.actors[id];}
 snapshot(){return Object.fromEntries(Object.entries(this.actors).map(([id,a])=>{const task=this.board.find(t=>t.employee_id===id&&!['done','failed'].includes(t.status));return [id,{point:{...a.point},phase:a.phase,activity:this.activity[id]||'',assignment:task?.brief||'',walkingFrame:a.path.length?Math.floor(a.distance/1.0)%8:null,facing:a.facing,direction:a.direction??'front'}];}));}
 setEnabled(enabled:boolean){this.enabled=enabled;if(!enabled)for(const a of Object.values(this.actors)){if(a.path.length&&a.phase!=='walking'){const end=a.path[a.path.length-1];a.node=end;a.point={...nodes[end]};}a.path=[];if(a.phase==='walking')a.phase='idle';const done=a.arrival;a.arrival=undefined;done?.();}}
 tick(seconds:number){for(const a of Object.values(this.actors)){
  if(a.path.length){const next=a.path[0],m=advance(a.point,nodes[next],Math.min(seconds,1),a.phase==='walking'?12:22);const dx=m.point.x-a.point.x,dy=m.point.y-a.point.y;a.distance+=Math.hypot(dx,dy);if(Math.abs(dx+dy)>.001)a.direction=dx+dy<0?'back':'front';if(Math.abs(dx)>.001)a.facing=dx<0?-1:1;a.point=m.point;if(m.arrived){a.node=a.path.shift()!;if(!a.path.length){const done=a.arrival;a.arrival=undefined;if(a.phase==='walking'){a.phase='idle';a.pause=1+Math.random()*2;}done?.();}}}
  else if(a!==this.actors.general&&a.phase==='idle'&&this.enabled){a.pause-=seconds;if(a.pause<=0){const choices=idleNodes.filter(n=>n!==a.node);a.path=route(a.node,choices[Math.floor(Math.random()*choices.length)]);a.phase='walking';}}
 }}
 async go(id:string,target:number,phase:Phase){const a=this.actors[id];if(!a)return;a.phase=phase;const anchor=a.path[0]??a.node;a.path=[...(a.path.length?[anchor]:[]),...route(anchor,target)];if(!this.enabled||!a.path.length){a.path=[];a.node=target;a.point={...nodes[target]};return;}if(a.path.length)await new Promise<void>(resolve=>{const timeout=setTimeout(()=>{const end=a.path[a.path.length-1];if(end!==undefined){a.node=end;a.point={...nodes[end]};}a.path=[];a.arrival=undefined;resolve();},15000);a.arrival=()=>{clearTimeout(timeout);resolve();};});}
 async assign(worker:string){
  const ami=this.actors.general,w=this.actors[worker];if(!ami||!w)return;
  let task=this.board.find(t=>t.employee_id===worker&&t.status==='queued');
  if(!task){await this.postPlan([{employee_id:worker,brief:'Tugas dari Amii'}]);task=this.board[0];}
  if(worker==='general'){task.status='working';ami.phase='working';this.activity.general='Reviewing team work';this.persistBoard();return;}
  await this.go(worker,boardNode,'receiving');
  w.point.x+=6+(Object.keys(this.actors).indexOf(worker)%3)*5;
  await this.go(worker,w.desk,'returning');task.status='working';w.phase='working';ami.phase='receiving';this.persistBoard();
 }
 async publishResult(worker:string){
  const w=this.actors[worker];if(!w)return;
  await this.go(worker,boardNode,'reporting');
  const task=this.board.find(t=>t.employee_id===worker);this.completeTask(task);
  await this.go(worker,w.desk,'returning');w.phase='ready';this.persistBoard();
 }
 ready(worker:string){const a=this.actors[worker];if(a)a.phase='ready';const task=this.board.find(t=>t.employee_id===worker);if(task)task.status='ready';this.persistBoard();}
 integrate(worker:string){const a=this.actors[worker];if(a)a.phase='working';const task=this.board.find(t=>t.employee_id===worker);if(task)task.status='working';this.persistBoard();}
 async reportTogether(ids:string[]){
  await Promise.all(ids.map(async(id,i)=>{await this.report(id);if(this.actors[id])this.actors[id].point.x+=i*8;}));
 }

 async report(worker:string){
  const ami=this.actors.general,w=this.actors[worker];if(!ami||!w)return;
  const taskIndex=this.board.findIndex(t=>t.employee_id===worker&&(t.status==='working'||t.status==='ready'));
  const task=taskIndex>=0?this.board[taskIndex]:undefined,next=taskIndex>=0?this.board.slice(taskIndex+1).find(t=>t.status==='queued'):undefined;
  if(worker!=='general'&&next&&next.employee_id!=='general'&&this.actors[next.employee_id]){
   const receiver=this.actors[next.employee_id];this.activity[worker]='Handoff ke '+next.employee_id;
   await this.go(worker,receiver.desk,'reporting');w.point.x+=7;
   delete this.activity[worker];w.phase='receiving';
  }else{
   await this.go(worker,ami.desk,'reporting');if(worker!=='general')w.point.x+=7;w.phase='receiving';
  }
  this.completeTask(task,next?.employee_id);if(worker==='general')delete this.activity.general;this.persistBoard();
 }

 reset(){this.chatRelease?.();this.chatRelease=undefined;for(const [id,a] of Object.entries(this.actors)){if(this.activity[id])continue;a.arrival?.();a.arrival=undefined;a.path=[];a.phase='idle';a.pause=.6;}}
}
export const officeEngine=new OfficeEngine();
export type OfficePositions=ReturnType<OfficeEngine['snapshot']>;
