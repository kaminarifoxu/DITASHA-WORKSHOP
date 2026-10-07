import {nodes,deskNodes,idleNodes,route,advance,type Point} from './office-motion';
export type Phase='idle'|'walking'|'assigning'|'returning'|'working'|'reporting'|'receiving';
type Actor={point:Point;node:number;path:number[];phase:Phase;pause:number;desk:number;distance:number;facing:number;arrival?:()=>void};
export class OfficeEngine {
 actors:Record<string,Actor>={}; enabled=true;
 sync(ids:string[]){ids.forEach((id,i)=>{if(!this.actors[id]){const n=id==='general'?deskNodes[0]:idleNodes[i%idleNodes.length];this.actors[id]={point:{...nodes[n]},node:n,path:[],phase:'idle',pause:0,desk:deskNodes[i===0?0:1+(i-1)%3],distance:0,facing:1};}});for(const id of Object.keys(this.actors))if(!ids.includes(id))delete this.actors[id];}
 snapshot(){return Object.fromEntries(Object.entries(this.actors).map(([id,a])=>[id,{point:{...a.point},phase:a.phase,walkingFrame:a.path.length?[0,1,2,1][Math.floor(a.distance/1.9)%4]:null,facing:a.facing}]));}
 setEnabled(enabled:boolean){this.enabled=enabled;if(!enabled)for(const a of Object.values(this.actors)){if(a.path.length&&a.phase!=='walking'){const end=a.path[a.path.length-1];a.node=end;a.point={...nodes[end]};}a.path=[];if(a.phase==='walking')a.phase='idle';const done=a.arrival;a.arrival=undefined;done?.();}}
 tick(seconds:number){for(const a of Object.values(this.actors)){
  if(a.path.length){const next=a.path[0],m=advance(a.point,nodes[next],Math.min(seconds,1),a.phase==='walking'?12:22);const dx=m.point.x-a.point.x,dy=m.point.y-a.point.y;a.distance+=Math.hypot(dx,dy);if(Math.abs(dx)>.001)a.facing=dx<0?-1:1;a.point=m.point;if(m.arrived){a.node=a.path.shift()!;if(!a.path.length){const done=a.arrival;a.arrival=undefined;if(a.phase==='walking'){a.phase='idle';a.pause=1+Math.random()*2;}done?.();}}}
  else if(a!==this.actors.general&&a.phase==='idle'&&this.enabled){a.pause-=seconds;if(a.pause<=0){const choices=idleNodes.filter(n=>n!==a.node);a.path=route(a.node,choices[Math.floor(Math.random()*choices.length)]);a.phase='walking';}}
 }}
 async go(id:string,target:number,phase:Phase){const a=this.actors[id];if(!a)return;a.phase=phase;const anchor=a.path[0]??a.node;a.path=[...(a.path.length?[anchor]:[]),...route(anchor,target)];if(!this.enabled){a.path=[];a.node=target;a.point={...nodes[target]};return;}if(a.path.length)await new Promise<void>(resolve=>{const timeout=setTimeout(()=>{const end=a.path[a.path.length-1];if(end!==undefined){a.node=end;a.point={...nodes[end]};}a.path=[];a.arrival=undefined;resolve();},15000);a.arrival=()=>{clearTimeout(timeout);resolve();};});}
 async assign(worker:string){const ami=this.actors.general,w=this.actors[worker];if(!ami||!w)return;if(worker==='general'){ami.phase='working';return;}ami.phase='assigning';await this.go(worker,ami.desk,'receiving');w.point.x+=7;await this.go(worker,w.desk,'returning');w.phase='working';ami.phase='receiving';}
 async report(worker:string){const ami=this.actors.general,w=this.actors[worker];if(!ami||!w)return;await this.go(worker,ami.desk,'reporting');if(worker!=='general')w.point.x+=7;w.phase='receiving';}
 reset(){for(const a of Object.values(this.actors)){a.arrival?.();a.arrival=undefined;a.phase='idle';a.pause=.6;}}
}
export const officeEngine=new OfficeEngine();
export type OfficePositions=ReturnType<OfficeEngine['snapshot']>;
