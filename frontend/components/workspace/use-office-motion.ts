'use client';
import {useEffect,useRef,useState} from 'react';
import {nodes,deskNodes,idleNodes,route,advance,type Point} from '@/lib/office-motion';
import type {Employee} from '@/lib/workspace';
type Motion={id:string;point:Point;node:number;path:number[];phase:'idle'|'walking'|'returning'|'working'|'done';pauseUntil:number;desk:number};
export function useOfficeMotion(employees:Employee[],busy:boolean,activeAgent:string){
 const signature=employees.map(e=>e.id).join('|'),input=useRef({busy,activeAgent});input.current={busy,activeAgent};
 const hovered=useRef<string|null>(null),[positions,setPositions]=useState<Record<string,{point:Point;phase:Motion['phase']}>>({}),[reduced,setReduced]=useState(false);
 useEffect(()=>{const media=window.matchMedia('(prefers-reduced-motion: reduce)');setReduced(media.matches);const change=()=>setReduced(media.matches);media.addEventListener('change',change);return()=>media.removeEventListener('change',change);},[]);
 useEffect(()=>{
  const ids=signature.split('|').filter(Boolean);const initial=[1,3,8,9];const now=performance.now();
  const states:Motion[]=ids.map((id,i)=>({id,point:{...nodes[reduced?deskNodes[i]:initial[i]]},node:reduced?deskNodes[i]:initial[i],path:[],phase:'idle',pauseUntil:now+800+i*1100,desk:deskNodes[i]}));
  let frame=0,last=now,paint=0;
  const publish=()=>setPositions(Object.fromEntries(states.map(s=>[s.id,{point:{...s.point},phase:s.phase}])));
  publish();
  function tick(time:number){const dt=Math.min((time-last)/1000,.05);last=time;if(!document.hidden){
   for(const s of states){const active=input.current.busy&&input.current.activeAgent===s.id;
    if(reduced){s.point={...nodes[s.desk]};s.phase=active?'working':'idle';continue;}
    if(active&&s.phase!=='returning'&&s.phase!=='working'){
     const anchor=s.path[0]??s.node;s.path=[...(s.path.length?[anchor]:[]),...route(anchor,s.desk)];s.phase=s.path.length?'returning':'working';s.pauseUntil=time+1500;
    }
    if(s.phase==='working'&&!active){s.phase='done';s.pauseUntil=time+1700;}
    if(s.phase==='done'&&time>=s.pauseUntil){s.phase='idle';s.pauseUntil=time+600;}
    if(s.path.length){if(hovered.current===s.id&&s.phase==='walking')continue;const target=nodes[s.path[0]],moved=advance(s.point,target,dt,s.phase==='returning'?19:10);s.point=moved.point;if(moved.arrived){s.node=s.path.shift()!;if(!s.path.length){if(s.phase==='returning'){s.phase=active?'working':'done';s.pauseUntil=time+1700;}else{s.phase='idle';s.pauseUntil=time+1800+Math.random()*2500;}}}}
    else if(s.phase==='idle'&&time>=s.pauseUntil&&hovered.current!==s.id){const choices=idleNodes.filter(n=>n!==s.node),destination=choices[Math.floor(Math.random()*choices.length)];s.path=route(s.node,destination);s.phase='walking';}
   }
   if(time-paint>=80){publish();paint=time;}
  }frame=requestAnimationFrame(tick);}
  frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame);
 },[signature,reduced]);
 return {positions,pause:(id:string|null)=>{hovered.current=id;}};
}
