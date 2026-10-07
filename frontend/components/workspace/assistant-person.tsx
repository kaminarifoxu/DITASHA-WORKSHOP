import {useEffect,useState} from 'react';
import {cachedCharacter,characterSprite,characterLooks,type CharacterPose} from '@/lib/character-3d';
export function AssistantPerson({index,working,frame,facing,className}:{index:number;working:boolean;frame:number|null;facing:number;className:string}){
 const [workFrame,setWorkFrame]=useState(false);
 useEffect(()=>{if(!working)return;const timer=setInterval(()=>setWorkFrame(f=>!f),360);return()=>clearInterval(timer)},[working]);
 const pose:CharacterPose=working?(workFrame?'work2':'work'):frame===null?'idle':`walk${frame%8}`,id=Math.max(0,Math.min(9,index));
 const [image,setImage]=useState(()=>cachedCharacter(id,pose));
 useEffect(()=>{setImage(characterSprite(id,pose));},[id,pose]);
 const c=characterLooks[id];
 return <span aria-hidden="true" className={'pixel-person assistant-person adult-person anime-person '+(working?'working ':'')+(frame!==null?'stepping ':'')+className} style={{'--facing':frame===null?1:facing} as React.CSSProperties}>{image?<img className="character-render" src={image} alt=""/>:<svg viewBox="0 0 120 192"><ellipse cx="60" cy="183" rx="24" ry="4" fill="#182c24"/><path d="M49 92h9l-4 87h-13zM63 92h9l9 87H65z" fill="#35424d"/><path d="M42 54h36l6 51H36zM40 58l-9 55h8l11-46M80 58l9 55h-8L70 67" fill={c.coat}/><ellipse cx="60" cy="36" rx="12" ry="16" fill="#e7b598"/><path d="M47 35q-4-24 15-22q14-1 12 19l-7-7-19 7z" fill={c.hair}/></svg>}</span>;
}
