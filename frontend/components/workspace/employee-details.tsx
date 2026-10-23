import {useEffect,useRef} from 'react';
import {createPortal} from 'react-dom';
import {MessageSquare,X,ClipboardList,CheckCircle2} from 'lucide-react';
import {AssistantPerson} from './assistant-person';
import type {Employee} from '@/lib/workspace';
import type {BoardTask,CompletedTask,OfficeEvent,OfficePositions} from '@/lib/office-engine';

const phaseLabels:Record<string,string>={idle:'Siap membantu',walking:'Jalan-jalan',assigning:'Memasang brief',returning:'Menuju meja',working:'Bekerja',reporting:'Menyerahkan hasil',receiving:'Menerima tugas / laporan',queued:'Menunggu giliran',ready:'Menunggu rekan tim'};
const taskLabels:Record<BoardTask['status'],string>={queued:'Menunggu giliran',working:'Bekerja',ready:'Kontribusi siap',done:'Selesai',failed:'Terhenti'};
const time=(timestamp:number)=>new Date(timestamp).toLocaleString('id-ID',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'});
export function EmployeeDetails({employee,state,board,history,events,busy,onClose,onChoose}:{employee?:Employee;state?:OfficePositions[string];board:BoardTask[];history:CompletedTask[];events:OfficeEvent[];busy:boolean;onClose:()=>void;onChoose:(id:string)=>void}){
 const dialog=useRef<HTMLDialogElement>(null);
 const id=employee?.id;
 useEffect(()=>{
  const el=dialog.current;if(!el||!id)return;
  const previous=document.activeElement;
  el.showModal();
  return()=>{el.close();if(previous instanceof HTMLElement&&previous.isConnected)previous.focus();};
 },[id]);
 if(!employee)return null;
 const task=board.find(t=>t.employee_id===employee.id&&!['done','failed'].includes(t.status))||board.find(t=>t.employee_id===employee.id);
 const occupied=busy||state?.phase==='working'||!!state?.activity;
 const completed=history.filter(t=>t.employee_id===employee.id);
 const recent=events.filter(e=>e.employee_id===employee.id||e.target===employee.id).slice(0,6);
 return createPortal(<dialog ref={dialog} className="employee-details" aria-labelledby="employee-detail-name" onCancel={onClose} onClick={e=>{if(e.target===e.currentTarget){const r=e.currentTarget.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)onClose();}}}>
  <button className="employee-detail-close" onClick={onClose} aria-label="Tutup detail karyawan"><X size={20}/></button>
  <header><AssistantPerson index={employee.avatar} working={state?.phase==='working'} frame={null} facing={1} animate={false} className="employee-detail-portrait"/><div><p className="eyebrow teal">{employee.tag}</p><h2 id="employee-detail-name">{employee.name}</h2><p>{employee.role}</p><span className="employee-detail-status">{state?.activity||phaseLabels[state?.phase||'idle']}</span></div></header>
  <div className="employee-detail-body">
   <p>{employee.description}</p>
   <section><h3><ClipboardList size={16}/> Tugas di papan</h3>{task?<><span className={'employee-task-state '+task.status}>{taskLabels[task.status]}</span><p className="employee-detail-brief">{task.brief}</p></>:<p className="employee-detail-muted">Belum ada tugas di papan Amii.</p>}</section>
   <section><h3>Aktivitas sesi ini</h3><p className="employee-detail-muted">Pembaruan otomatis dari status pekerjaan kantor.</p>{recent.length?<ol className="employee-detail-events">{recent.map(event=><li key={event.id}><p>{event.text}</p><time>{time(event.createdAt)}</time></li>)}</ol>:<p className="employee-detail-empty">Aktivitas muncul saat karyawan menerima atau menyerahkan tugas.</p>}</section>
   <section><h3><CheckCircle2 size={16}/> {completed.length} kontribusi selesai</h3><p className="employee-detail-muted">Dari 40 kontribusi terbaru yang disimpan kantor.</p>{completed.length?<ol className="employee-detail-events">{completed.slice(0,5).map((item,i)=><li key={item.completedAt+'-'+i}><p>{item.brief}</p><time>{time(item.completedAt)}</time></li>)}</ol>:<p className="employee-detail-empty">Belum ada kontribusi tersimpan untuk karyawan ini.</p>}</section>
  </div>
  <footer>{occupied&&<small>Tim sedang bekerja. Detail tetap dapat dibuka.</small>}<button className="primary" disabled={occupied} onClick={()=>onChoose(employee.id)}><MessageSquare size={16}/> Beri tugas melalui Amii</button></footer>
 </dialog>,document.body);
}
