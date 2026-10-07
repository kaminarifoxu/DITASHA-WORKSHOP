import {useEffect,useRef,useState} from 'react';
import * as T from 'three';
import {buildCharacter,type CharacterPose} from '@/lib/character-3d';
import {officeLayout} from '@/lib/office-motion';
import type {Employee} from '@/lib/workspace';
import type {OfficePositions} from '@/lib/office-engine';

type Props={employees:Employee[];positions:OfficePositions;enabled:boolean;busy:boolean;onChoose:(id:string)=>void;onUnavailable:()=>void};
// The same floor coordinates drive the task engine, 3D models and clickable labels.
export function Office3D({employees,positions,enabled,busy,onChoose,onUnavailable}:Props){
 const mount=useRef<HTMLDivElement>(null),latest=useRef({positions,enabled}),[labels,setLabels]=useState<{id:string;x:number;y:number}[]>([]);
 latest.current={positions,enabled};
 useEffect(()=>{
  const element=mount.current;if(!element)return;const host:HTMLDivElement=element;
  let renderer:T.WebGLRenderer;
  try{renderer=new T.WebGLRenderer({antialias:true,alpha:true,powerPreference:'low-power'});}catch{onUnavailable();return;}
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setClearColor('#211f2d',1);renderer.outputColorSpace=T.SRGBColorSpace;
  renderer.domElement.setAttribute('aria-label','Kantor Sakura 3D');host.appendChild(renderer.domElement);
  const scene=new T.Scene(),camera=new T.OrthographicCamera(-10,10,10,-10,.1,150),layout=officeLayout(employees.length),w=layout.width/80,d=layout.height/80;
  scene.add(new T.HemisphereLight('#fff0e4','#625773',2));const sun=new T.DirectionalLight('#ffe8c8',2.2);sun.position.set(-8,16,10);scene.add(sun);
  const materials=new Map<string,T.MeshLambertMaterial>();const mat=(color:string)=>{if(!materials.has(color))materials.set(color,new T.MeshLambertMaterial({color}));return materials.get(color)!;};
  const geometries=new Set<T.BufferGeometry>();
  function box(color:string,x:number,y:number,z:number,sx:number,sy:number,sz:number,parent:T.Object3D=scene){const g=new T.BoxGeometry(sx,sy,sz);geometries.add(g);const m=new T.Mesh(g,mat(color));m.position.set(x,y,z);parent.add(m);return m;}
  function sphere(color:string,x:number,y:number,z:number,r:number,parent:T.Object3D=scene){const g=new T.SphereGeometry(r,10,8);geometries.add(g);const m=new T.Mesh(g,mat(color));m.position.set(x,y,z);parent.add(m);return m;}
  const point=(x:number,y:number)=>new T.Vector3(x/80-w/2,0,y/80-d/2);
  box('#615046',0,-.14,0,w,.25,d);box('#e3c99d',0,-.015,0,w,.04,d);
  for(let z=-d/2+.6;z<d/2;z+=1.2)for(let x=-w/2+.75;x<w/2;x+=1.5){box('#b8ad7f',x,.012,z,1.46,.035,1.16);box('#8f9471',x,.033,z,1.46,.007,.035);}
  box('#393347',0,1.15,-d/2,w,2.3,.15);box('#40354a',-w/2,1.15,0,.15,2.3,d);
  box('#a3815b',0,.15,-d/2+.09,w,.3,.10);box('#a3815b',-w/2+.09,.15,0,.1,.3,d);
  for(const x of [-4.9,-2.8,2.8,4.9]){box('#efd8ac',x,1.4,-d/2+.10,1.5,1.15,.06);for(let i=-2;i<=2;i++)box('#8d6b52',x+i*.3,1.4,-d/2+.15,.025,1.2,.04);for(const y of [.85,1.4,1.95])box('#8d6b52',x,y,-d/2+.15,1.55,.025,.04);}
  const board=point(170,140);box('#b98e5d',board.x,1.05,board.z,2.2,1.4,.12);box('#354849',board.x,1.05,board.z+.07,2.05,1.25,.03);for(let i=0;i<3;i++)box(['#efd29e','#acd5c2','#c2b0da'][i],board.x+(i-1)*.58,1.1,board.z+.10,.45,.5,.02);for(const x of [-.8,.8])box('#5c4a42',board.x+x,.35,board.z,.09,.7,.10);
  const sofa=point(835,125);box('#65516f',sofa.x,.4,sofa.z,2.55,.65,1.1);box('#806886',sofa.x,.9,sofa.z-.45,2.55,.8,.20);for(const x of [-1.2,1.2])box('#55435e',sofa.x+x,.7,sofa.z,.18,.65,1.15);
  // Sakura branches and low planters along the open wall.
  const tree=point(932,150);box('#735046',tree.x,.85,tree.z,.08,1.7,.08);for(let i=0;i<12;i++)sphere(['#eeb5ce','#d991b7','#f7d3de'][i%3],tree.x+Math.sin(i*2.4)*.65,1.5+(i%4)*.17,tree.z+Math.cos(i*2.4)*.5,.16);
  for(let z=-d/2+1;z<d/2;z+=2.6){box('#9c785a',-w/2+.38,.22,z,.4,.45,.4);for(let i=0;i<3;i++){const leaf=sphere('#568774',-w/2+.38+(i-1)*.1,.62+i*.1,z,.18);leaf.scale.y=1.5;}}
  for(const desk of layout.desks){const p=point(desk.x,desk.y),group=new T.Group();group.position.copy(p);scene.add(group);
   box('#616175',0,.03,.6,2.65,.035,1.9,group);
   for(const x of [-1.0,1.0])for(const z of [-.23,.37])box('#695142',x,.38,z,.09,.76,.09,group);
   box('#c79d70',0,.81,.07,2.4,.12,.83,group);box('#6b5140',0,.75,.07,2.45,.06,.87,group);
   box('#2a3445',0,1.17,-.1,1.08,.65,.08,group);box('#5b8f94',0,1.17,-.049,.96,.53,.016,group);for(let i=0;i<3;i++)box(employees[desk.index].color,-.15,1.32-i*.12,-.035,.54-i*.08,.012,.006,group);
   box('#394154',0,.90,-.1,.08,.22,.08,group);box('#394154',0,.85,-.1,.38,.03,.20,group);
   box('#354053',0,.895,.35,.62,.045,.22,group);box('#6c6876',.53,.9,.37,.10,.045,.15,group);
   box('#b7cab1',-.87,.96,.25,.17,.25,.17,group);
   box('#e7c992',.87,1.35,-.12,.28,.16,.25,group);box('#665746',.87,1.03,-.12,.035,.55,.035,group);
   box('#343c52',0,.45,1.08,.60,.16,.57,group);box('#4f5468',0,.76,1.30,.61,.70,.13,group);box('#343c52',0,.20,1.08,.06,.45,.06,group);
  }
  const rigs=new Map<string,T.Group>(),cache=new Map<string,T.Group>(),poses=new Map<string,string>();
  function cached(index:number,pose:CharacterPose){const key=index+':'+pose;if(!cache.has(key))cache.set(key,buildCharacter(index,pose));return cache.get(key)!;}
  function fit(){const width=host.clientWidth,height=host.clientHeight;if(!width||!height)return;renderer.setSize(width,height,false);camera.position.set(w*1.1,Math.max(w,d)*1.25,d*1.1);camera.lookAt(0,.25,0);camera.updateMatrixWorld();const view=camera.matrixWorldInverse,corners=[];for(const x of [-w/2-.3,w/2+.3])for(const z of [-d/2-.3,d/2+.3])for(const y of [0,2.5])corners.push(new T.Vector3(x,y,z).applyMatrix4(view));const xs=corners.map(p=>p.x),ys=corners.map(p=>p.y);let cx=(Math.max(...xs)+Math.min(...xs))/2,cy=(Math.max(...ys)+Math.min(...ys))/2,hw=(Math.max(...xs)-Math.min(...xs))*.53,hh=(Math.max(...ys)-Math.min(...ys))*.53;const aspect=width/height;if(hw/hh>aspect)hh=hw/aspect;else hw=hh*aspect;camera.left=cx-hw;camera.right=cx+hw;camera.top=cy+hh;camera.bottom=cy-hh;camera.updateProjectionMatrix();}
  const observer=new ResizeObserver(fit);observer.observe(host);fit();let request=0,last=0,lastLabels=0,disposed=false;
  function draw(now:number){if(disposed)return;request=requestAnimationFrame(draw);if(now-last<32)return;last=now;
   const current=latest.current,nextLabels=[];
   for(const [i,employee] of employees.entries()){const state=current.positions[employee.id],desk=layout.desks[i];const frame=state?.walkingFrame,working=state?.phase==='working';const pose:CharacterPose=working?(current.enabled&&Math.floor(now/360)%2?'work2':'work'):frame===null||frame===undefined?'idle':`walk${frame%8}`;
    if(poses.get(employee.id)!==pose){const old=rigs.get(employee.id);if(old)scene.remove(old);const rig=cached(employee.avatar,pose).clone(true);rig.scale.setScalar(.46);rigs.set(employee.id,rig);poses.set(employee.id,pose);scene.add(rig);}
    const rig=rigs.get(employee.id)!;rig.position.copy(point((state?.point.x??desk.x/10)*10,(state?.point.y??(desk.y+95)/layout.height*100)*layout.height/100));rig.position.y=current.enabled&&pose==='idle'?Math.sin(now/1100+i)*.008:0;rig.rotation.y=frame!==null&&frame!==undefined?(state?.facing===-1?-.8:.8):.12;
    const label=rig.position.clone();label.y=1.85;label.project(camera);nextLabels.push({id:employee.id,x:(label.x+1)*50,y:(1-label.y)*50});
   }
   if(now-lastLabels>100){setLabels(nextLabels);lastLabels=now;}renderer.render(scene,camera);host.dataset.sceneReady='true';
  }
  const lost=(event:Event)=>{event.preventDefault();onUnavailable();};renderer.domElement.addEventListener('webglcontextlost',lost);request=requestAnimationFrame(draw);
  return()=>{disposed=true;cancelAnimationFrame(request);observer.disconnect();renderer.domElement.removeEventListener('webglcontextlost',lost);renderer.dispose();host.replaceChildren();geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());const disposedGeo=new Set<T.BufferGeometry>(),disposedMat=new Set<T.Material>();for(const rig of cache.values())rig.traverse(o=>{if(o instanceof T.Mesh){if(!disposedGeo.has(o.geometry)){o.geometry.dispose();disposedGeo.add(o.geometry);}for(const m of Array.isArray(o.material)?o.material:[o.material])if(!disposedMat.has(m)){m.dispose();disposedMat.add(m);}}});};
 },[employees,onUnavailable]);
 return <div className="office-3d"><div className="office-3d-render" ref={mount}/><div className="office-3d-labels">{labels.map(p=>{const e=employees.find(e=>e.id===p.id)!;return <button className="office-3d-worker" disabled={busy} key={p.id} aria-label={'Chat dengan '+e.name+', '+e.role} title={e.name+' · '+e.role} style={{left:p.x+'%',top:p.y+'%','--person-color':e.color} as React.CSSProperties} onClick={()=>onChoose(p.id)}>{e.name}</button>;})}</div><span className="office-3d-caption">SAKURA STUDIO · 3D</span></div>;
}
