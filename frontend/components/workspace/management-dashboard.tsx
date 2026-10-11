import type {BoardTask,CompletedTask,OfficePositions} from '@/lib/office-engine';
import type {Employee} from '@/lib/workspace';
import {ArrowRight,CheckCircle2,ClipboardList,Clock3,Sparkles} from 'lucide-react';

type DashboardStatus='Idle'|'Queued'|'Working'|'Reviewing'|'Done';
function short(text:string,max=58){const clean=text.replace(/\s+/g,' ').trim();return clean.length>max?clean.slice(0,max-1)+'…':clean;}
function statusFor(id:string,task:BoardTask|undefined,phase:string|undefined):DashboardStatus{
 if(id==='general'&&task?.status==='working')return 'Reviewing';
 if(task?.status==='queued'||phase==='queued')return 'Queued';
 if(task?.status==='working'||phase==='working'||phase==='reporting'||phase==='returning'||phase==='receiving')return 'Working';
 if(task?.status==='done'||task?.status==='ready'||phase==='ready')return 'Done';
 return 'Idle';
}
export function ManagementDashboard({employees,positions,board,history}:{employees:Employee[];positions:OfficePositions;board:BoardTask[];history:CompletedTask[]}){
 const rows=employees.map(employee=>{
  const task=board.find(t=>t.employee_id===employee.id&&!['failed'].includes(t.status))||board.find(t=>t.employee_id===employee.id);
  const state=positions[employee.id];
  const status=statusFor(employee.id,task,state?.phase);
  const index=task?board.indexOf(task):-1;
  const next=index>=0?board.slice(index+1).find(t=>t.status==='queued'):undefined;
  const handoff=(state?.phase==='reporting'||task?.status==='done')&&next?employees.find(e=>e.id===next.employee_id):undefined;
  const completed=history.filter(item=>item.employee_id===employee.id);
  return {employee,task,state,status,handoff,completed};
 });
 const manager=rows.find(row=>row.employee.id==='general');
 const recent=history.slice(0,6);
 return <section className="management-dashboard" aria-label="Dashboard manajemen kantor">
  <div className="management-dashboard-head">
   <div><span className="management-kicker"><ClipboardList size={14}/> OPERATIONS</span><strong>Company dashboard</strong><small>Status tim langsung dari papan tugas Amii</small></div>
   <div className={'manager-review-card '+(manager?.status==='Reviewing'?'reviewing':'')}><Sparkles size={17}/><span><small>AMII · MANAGER DESK</small><strong>{manager?.status==='Reviewing'?'Reviewing final work':manager?.status==='Working'?'Coordinating team':'Ready to coordinate'}</strong><em>{manager?.task?.brief?short(manager.task.brief,72):'No final review waiting'}</em></span></div>
  </div>
  <div className="management-grid">
   <div className="employee-status-grid">
    {rows.map(({employee,task,status,handoff,completed})=><article className="employee-status-card" key={employee.id} style={{'--employee-color':employee.color} as React.CSSProperties}>
     <div className="employee-status-top"><span className="employee-status-dot"/><div><strong>{employee.name}</strong><small>{employee.role}</small></div><em className={'employee-status-badge status-'+status.toLowerCase()}>{status}</em></div>
     <p title={task?.brief}>{task?.brief?short(task.brief):status==='Idle'?'Available for new work':'Waiting for next assignment'}</p>
     <div className="employee-status-meta"><span><CheckCircle2 size={13}/>{completed.length} completed</span>{handoff&&<span className="handoff-chip">Handoff <ArrowRight size={12}/> {handoff.name}</span>}</div>
    </article>)}
   </div>
   <aside className="completion-history">
    <div className="completion-history-title"><Clock3 size={15}/><div><strong>Completed-task history</strong><small>Latest finished contributions</small></div></div>
    {recent.length?<ol>{recent.map((item,i)=>{const employee=employees.find(e=>e.id===item.employee_id);const target=item.handedTo?employees.find(e=>e.id===item.handedTo):undefined;return <li key={item.completedAt+'-'+item.employee_id+'-'+i}><span style={{'--employee-color':employee?.color||'#789'} as React.CSSProperties}/><div><strong>{employee?.name||item.employee_id}</strong><p title={item.brief}>{short(item.brief,68)}</p><small>{new Date(item.completedAt).toLocaleString('id-ID',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}{target?' · handed to '+target.name:''}</small></div></li>;})}</ol>:<p className="history-empty">Completed jobs will appear here after the team finishes its first task.</p>}
   </aside>
  </div>
 </section>;
}
