import {Scene,Group,Mesh,MeshLambertMaterial,SphereGeometry,CylinderGeometry,BoxGeometry,TorusGeometry,AmbientLight,DirectionalLight,OrthographicCamera,Vector3,type BufferGeometry} from 'three';
import {SVGRenderer} from 'three/addons/renderers/SVGRenderer.js';
export const characterLooks=[
 {hair:'#34303b',coat:'#287b83',accent:'#83dcca',style:'short',glasses:true},
 {hair:'#885137',coat:'#d98938',accent:'#ffe0a8',style:'bob'},
 {hair:'#292932',coat:'#77569a',accent:'#c7b0ec',style:'spiky'},
 {hair:'#3d303b',coat:'#659aca',accent:'#c3e4fc',style:'pony'},
 {hair:'#ca7f92',coat:'#d187a2',accent:'#fbd5e2',style:'long',beret:true},
 {hair:'#d4c9bd',coat:'#3a526b',accent:'#b4d6e3',style:'short',glasses:true},
 {hair:'#5a3933',coat:'#88a28a',accent:'#d9eac7',style:'buns'},
 {hair:'#e3ebf7',coat:'#354456',accent:'#dac682',style:'bob'},
 {hair:'#765341',coat:'#354456',accent:'#c0a4d8',style:'bob'},
 {hair:'#292c35',coat:'#805f51',accent:'#9dcab9',style:'short',glasses:true,beard:true},
];
export type CharacterPose='idle'|'left'|'mid'|'right'|'work';
// Rig height 3.56, head height .46: adult proportions shared by all ten models.
export function buildCharacter(index:number,pose:CharacterPose){
 const c=characterLooks[Math.max(0,Math.min(9,index))],person=new Group(),work=pose==='work',step=pose==='left'?1:pose==='right'?-1:0;
 const skin='#e7b598',pants='#303842',shoes='#252b33',female=['bob','pony','long','buns'].includes(c.style);
 const materials=new Map<string,MeshLambertMaterial>();
 const material=(color:string)=>{if(!materials.has(color))materials.set(color,new MeshLambertMaterial({color,flatShading:true}));return materials.get(color)!;};
 function mesh(g:BufferGeometry,color:string,x:number,y:number,z:number,sx=1,sy=1,sz=1,parent:Group=person){const m=new Mesh(g,material(color));m.position.set(x,y,z);m.scale.set(sx,sy,sz);parent.add(m);return m;}
 const ball=(color:string,x:number,y:number,z:number,sx:number,sy:number,sz:number,parent=person)=>mesh(new SphereGeometry(1,10,8),color,x,y,z,sx,sy,sz,parent);
 const box=(color:string,x:number,y:number,z:number,sx:number,sy:number,sz:number,parent=person)=>mesh(new BoxGeometry(sx,sy,sz),color,x,y,z,1,1,1,parent);
 function between(color:string,start:Vector3,end:Vector3,r1:number,r2:number,parent:Group){const delta=end.clone().sub(start),m=mesh(new CylinderGeometry(r2,r1,delta.length(),8),color,0,0,0,1,1,1,parent);m.position.copy(start).add(end).multiplyScalar(.5);m.quaternion.setFromUnitVectors(new Vector3(0,1,0),delta.normalize());return m;}
 // Small oval under the feet makes the figures sit on the office floor.
 ball('#17211f',0,.015,0,.51,.012,.31);
 for(const side of [-1,1]){
  const leg=new Group();leg.position.set(side*.15,1.7,0);leg.rotation.x=side*step*.28;person.add(leg);
  between(pants,new Vector3(0,0,0),new Vector3(0,-.78,0),.125,.14,leg);
  const calf=new Group();calf.position.y=-.78;calf.rotation.x=Math.max(0,-side*step)*.30;leg.add(calf);
  between(pants,new Vector3(0,0,0),new Vector3(0,-.78,0),.075,.105,calf);
  ball(shoes,0,-.79,.085,.105,.07,.20,calf);box('#8b979c',0,-.82,.09,.18,.025,.32,calf);
 }
 // Tailored torso, shoulders and sleeves instead of the oversized cartoon body.
 mesh(new CylinderGeometry(female?.28:.33,.25,1.04,8),c.coat,0,2.22,0,1,1,.68);
 ball(c.coat,0,2.55,-.01,female?.28:.33,.29,.18);
 box('#d5d9d5',0,2.63,.165,.13,.36,.025);
 box(c.coat,0,2.25,.17,.035,.85,.025);
 box('#182632',0,1.73,.005,.53,.07,.34);
 box('#9aa49d',0,1.73,.181,.08,.048,.018);
 for(const side of [-1,1]){
  const arm=new Group();arm.position.set(side*(female?.29:.34),2.67,0);arm.rotation.z=side*.10;arm.rotation.x=work?-.5:-side*step*.20;person.add(arm);
  ball(c.coat,0,-.07,0,.14,.18,.15,arm);
  between(c.coat,new Vector3(0,-.1,0),new Vector3(side*.025,-.53,0),.10,.13,arm);
  const forearm=new Group();forearm.position.set(side*.025,-.53,0);forearm.rotation.x=work?-1.1:-.06;arm.add(forearm);
  between(c.coat,new Vector3(0,0,0),new Vector3(0,-.47,0),.065,.095,forearm);
  ball(skin,0,-.52,.02,.07,.12,.055,forearm);
 }
 mesh(new CylinderGeometry(.08,.095,.21,8),skin,0,2.9,0);
 const head=new Group();head.position.set(0,3.19,0);person.add(head);
 ball(skin,0,0,.02,.19,.24,.18,head);
 ball(skin,-.19,-.01,0,.037,.06,.027,head);ball(skin,.19,-.01,0,.037,.06,.027,head);
 ball(skin,0,-.018,.193,.03,.043,.04,head);
 for(const side of [-1,1]){ball('#443935',side*.074,.034,.172,.022,.012,.008,head);box(c.hair,side*.074,.072,.163,.058,.012,.015,head);}
 box('#b5786d',0,-.102,.16,.064,.012,.008,head);
 mesh(new SphereGeometry(1,10,6,0,Math.PI*2,0,1.40),c.hair,0,.055,-.025,.21,.235,.20,head);
 // Small hair locks, side parts and longer back sections identify each employee.
 for(let i=0;i<5;i++){const x=(i-2)*.07,m=ball(c.hair,x,.145-(i%2)*.035,.105,.064,.055,.07,head);m.rotation.z=(i-2)*.18;}
 if(c.style==='spiky')for(let i=0;i<5;i++){const m=mesh(new CylinderGeometry(0,.048,.16,4),c.hair,(i-2)*.07,.22+(i%2)*.028,0,1,1,1,head);m.rotation.z=(2-i)*.25;}
 if(c.style==='bob'||c.style==='long'){
  const length=c.style==='long'?.54:.27;
  ball(c.hair,0,-length*.25,-.115,.22,length,.12,head);
  for(const side of [-1,1])ball(c.hair,side*.185,-length*.25,-.01,.046,length,.10,head);
 }
 if(c.style==='pony')ball(c.hair,.07,-.05,-.24,.095,.32,.09,head);
 if(c.style==='buns')for(const side of [-1,1]){ball(c.hair,side*.18,.17,-.04,.09,.085,.085,head);ball(c.accent,side*.17,.14,.012,.015,.023,.021,head);}
 if(c.beret){const hat=ball('#282b32',-.024,.218,0,.255,.08,.23,head);hat.rotation.z=.16;}
 if(c.glasses)for(const side of [-1,1]){const glass=mesh(new TorusGeometry(.050,.006,4,12),index===9?'#a5b7b7':'#26343d',side*.075,.028,.190,1,.72,1,head);glass.rotation.y=side*.16;} 
 if(c.glasses)box('#78868b',0,.03,.187,.045,.007,.008,head);
 if(c.beard)ball('#62534b',0,-.158,.08,.14,.05,.094,head);
 box(c.accent,-.13,2.5,.178,.07,.09,.012);
 if([0,1,3].includes(index)){box('#eff1e8',.05,2.12,.184,.115,.14,.018);box(c.accent,.05,2.14,.196,.075,.025,.008);}
 if(work){const tablet=box('#253747',0,2.22,.50,.46,.32,.03);tablet.rotation.x=-.5;const screen=box(c.accent,0,2.235,.521,.39,.23,.015);screen.rotation.x=-.5;}
 person.userData={headHeight:.48,totalHeight:3.56,index,pose};return person;
}
export function characterSVG(index:number,pose:CharacterPose){
 const renderer=new SVGRenderer();renderer.setSize(120,192);renderer.setPrecision(2);renderer.overdraw=.18;
 const scene=new Scene(),character=buildCharacter(index,pose);scene.add(character,new AmbientLight('#ffffff',.65));
 const key=new DirectionalLight('#fff2d9',.9);key.position.set(-3,6,5);scene.add(key);const fill=new DirectionalLight('#b3d9ef',.3);fill.position.set(3,3,-2);scene.add(fill);
 const camera=new OrthographicCamera(-1.3,1.3,2.08,-2.08,.1,30);camera.position.set(5,3.5,8);camera.lookAt(0,1.75,0);camera.updateMatrixWorld();
 renderer.render(scene,camera);renderer.domElement.setAttribute('xmlns','http://www.w3.org/2000/svg');renderer.domElement.style.backgroundColor='transparent';
 const result=new XMLSerializer().serializeToString(renderer.domElement);
 character.traverse(object=>{if(object instanceof Mesh){object.geometry.dispose();}});return result;
}
const sprites=new Map<string,string>();
export function cachedCharacter(index:number,pose:CharacterPose){return sprites.get(index+':'+pose);}
export function characterSprite(index:number,pose:CharacterPose){const key=index+':'+pose;if(!sprites.has(key))sprites.set(key,'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(characterSVG(index,pose)));return sprites.get(key)!;}
