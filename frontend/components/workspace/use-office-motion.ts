import {useEffect,useState} from 'react';
import {officeEngine,type OfficePositions} from '@/lib/office-engine';
import type {Employee} from '@/lib/workspace';
export function useOfficeMotion(employees:Employee[]){
 const signature=employees.map(e=>e.id).join('|');
 const [positions,setPositions]=useState<OfficePositions>({});
 const [enabled,setEnabled]=useState(()=>localStorage.getItem('ditasha-movement')!=='off');
 useEffect(()=>{officeEngine.sync(signature.split('|'));},[signature]);
 useEffect(()=>{officeEngine.setEnabled(enabled);localStorage.setItem('ditasha-movement',enabled?'on':'off');},[enabled]);
 useEffect(()=>{let last=performance.now();const timer=setInterval(()=>{const now=performance.now();officeEngine.tick((now-last)/1000);last=now;setPositions(officeEngine.snapshot());},50);return()=>clearInterval(timer);},[]);
 return {positions,enabled,setEnabled,board:officeEngine.board};
}
