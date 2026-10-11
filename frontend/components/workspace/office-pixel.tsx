import {useLayoutEffect,useRef,useState} from 'react';
import {AssistantPerson} from './assistant-person';
import {officeLayout} from '@/lib/office-motion';
import {jobActivity} from '@/lib/assignment';
import type {OfficePositions} from '@/lib/office-engine';
import type {Employee} from '@/lib/workspace';
import deskArt from '@/assets/ditasha-office/desk.png';
import plantArt from '@/assets/ditasha-office/plant.png';

/** Project the existing walkable graph, rather than run a second simulated workforce. */
export function OfficePixel({employees,positions,enabled,busy,onChoose}:{employees:Employee[];positions:OfficePositions;enabled:boolean;busy:boolean;onChoose:(id:string)=>void}){
 const layout=officeLayout(employees.length),floorHeight=layout.height;
 const width=(1000+floorHeight)*.62+160,height=(1000+floorHeight)*.31+250;
 const project=(x:number,y:number)=>({x:(x-y)*.62+floorHeight*.62+80,y:(x+y)*.31+155});
 const points=(pairs:number[][])=>pairs.map(([x,y])=>{const p=project(x,y);return `${p.x},${p.y}`;}).join(' ');
 const viewport=useRef<HTMLDivElement>(null),[scale,setScale]=useState(0);
 useLayoutEffect(()=>{const el=viewport.current;if(!el)return;const resize=()=>{if(el.clientWidth>0&&el.clientHeight>0)setScale(Math.min(el.clientWidth/width,el.clientHeight/height));};const observer=new ResizeObserver(resize);observer.observe(el);resize();return()=>observer.disconnect();},[width,height]);
 const origin=project(0,0),left=project(0,floorHeight),right=project(1000,0);
 return <div className="pixel-office-viewport" ref={viewport} data-motion={enabled?'on':'off'}>
  <div className="shared-scene pixel-office-scene" style={{width,height,visibility:scale>0?'visible':'hidden',transform:`translate(-50%,-50%) scale(${scale})`}} data-scene-ready="true">
   <svg className="pixel-room-shell" width={width} height={height} aria-hidden="true">
    <polygon points={points([[0,0],[1000,0],[1000,floorHeight],[0,floorHeight]])} fill="#a38e71" stroke="#544f43" strokeWidth="7"/>
    {Array.from({length:Math.ceil(floorHeight/90)},(_,i)=><polyline key={'y'+i} points={points([[0,i*90],[1000,i*90]])} fill="none" stroke="#c0ac8c" strokeWidth="2"/>)}
    {Array.from({length:11},(_,i)=><polyline key={'x'+i} points={points([[i*100,0],[i*100,floorHeight]])} fill="none" stroke="#806f5b" strokeWidth="1" opacity=".5"/>)}
    <polygon points={`${left.x},${left.y} ${origin.x},${origin.y} ${origin.x},${origin.y-130} ${left.x},${left.y-130}`} fill="#435d57" stroke="#273d38" strokeWidth="5"/>
    <polygon points={`${origin.x},${origin.y} ${right.x},${right.y} ${right.x},${right.y-130} ${origin.x},${origin.y-130}`} fill="#61766c" stroke="#273d38" strokeWidth="5"/>
    {[180,440,750].map(x=>{const p=project(x,0);return <g key={x} transform={`translate(${p.x},${p.y-94}) skewY(26.565)`}><rect x="-62" y="-20" width="124" height="68" rx="3" fill="#b6dce0" stroke="#c5c8ae" strokeWidth="8"/><path d="M0-20V48M-62 14H62" stroke="#718e84" strokeWidth="4"/></g>;})}
    <g transform={`translate(${origin.x-55},${origin.y-26}) skewY(-26.565)`}><rect x="-200" y="-48" width="198" height="52" rx="5" fill="#172f2c" stroke="#8aa68d" strokeWidth="3"/><text x="-101" y="-24" textAnchor="middle" fill="#d7ead8" fontSize="21" fontWeight="700" letterSpacing="3">DITASHA</text><text x="-101" y="-7" textAnchor="middle" fill="#94c5b4" fontSize="10" letterSpacing="3">WORKSHOP</text></g>
    {layout.desks.map(d=><polygon key={d.index} points={points([[d.x-115,d.y-5],[d.x+115,d.y-5],[d.x+115,d.y+153],[d.x-115,d.y+153]])} fill="#537a73" stroke="#74988a" strokeWidth="2" opacity=".78"/>)}
   </svg>
   {(()=>{const p=project(170,155);return <div className="pixel-task-board" style={{left:p.x,top:p.y,zIndex:Math.round(p.y)}}><strong>PAPAN AMII</strong><div><i/><i/><i/></div></div>;})()}
   {layout.desks.map(d=>{const p=project(d.x,d.y+48);return <div key={'desk-'+d.index} className="pixel-desk" style={{left:p.x,top:p.y,zIndex:Math.round(p.y)}}><img src={deskArt} alt=""/><span className="pixel-desk-label" style={{borderColor:employees[d.index].color}}>{employees[d.index].name}</span></div>;})}
   {[{x:55,y:85},{x:925,y:110},{x:70,y:floorHeight-65},{x:920,y:floorHeight-65}].map((v,i)=>{const p=project(v.x,v.y);return <img key={'plant-'+i} className="pixel-office-plant" src={plantArt} alt="" style={{left:p.x,top:p.y,zIndex:Math.round(p.y)}}/>;})}
   {employees.map((a,i)=>{const state=positions[a.id],d=layout.desks[i],phase=state?.phase,working=phase==='working',walking=state?.walkingFrame!=null;
    const p=project(state?state.point.x*10:d.x,state?state.point.y/100*floorHeight:d.y+95);
    const back=working||state?.direction==='back';
    const facing=walking?(back?-(state?.facing??1):(state?.facing??1)):1;
    const activity=state?.activity||(working?jobActivity(a):phase==='returning'?'Menuju meja':phase==='reporting'?'Melapor ke Amii':phase==='receiving'?'Menerima tugas':phase==='ready'?'Menunggu rekan tim':phase==='queued'?'Menunggu giliran':walking?'Jalan-jalan':'Siap membantu');
    return <button key={a.id} disabled={busy} onClick={()=>onChoose(a.id)} className={'office-worker pixel-office-worker '+(working?'is-working ':'')+(walking?'is-walking ':'')} style={{left:p.x,top:p.y,zIndex:Math.round(p.y),'--person-color':a.color} as React.CSSProperties} aria-label={'Chat dengan '+a.name+', '+a.role} title={a.name+' · '+activity}>
     <span className="worker-activity">{activity}</span><span className="pixel-foot-shadow"/>{working&&<span className="pixel-chair"/>}
     <AssistantPerson index={a.avatar} working={working} frame={state?.walkingFrame??null} facing={facing} back={back} animate={enabled} className=""/>
     <span className="worker-name">{working&&<span className="pixel-work-dot"/>}{a.name}</span>
    </button>;
   })}
  </div>
  <span className="pixel-office-caption">DITASHA STUDIO <span>·</span> {employees.length} anggota tim</span>
 </div>;
}
