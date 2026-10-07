import {officeLayout} from '@/lib/office-motion';
import type {Employee} from '@/lib/workspace';
export function OfficeFloor({employees}:{employees:Employee[]}){
 const {width,height,desks}=officeLayout(employees.length);
 return <svg className="shared-office-floor" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
 <defs><pattern id="office-wood" width="180" height="44" patternUnits="userSpaceOnUse"><rect width="180" height="44" fill="#47352b"/><path d="M0 1H180M0 43H180M95 1V43" stroke="#251f1a"/><path d="M5 9H78M105 31H173M8 33H84" stroke="#6d5140" opacity=".3"/></pattern><linearGradient id="desk-wood" x2="0" y2="1"><stop stopColor="#c18c54"/><stop offset="1" stopColor="#805437"/></linearGradient><linearGradient id="screen-glow" x2="1" y2="1"><stop stopColor="#153837"/><stop offset="1" stopColor="#2c716c"/></linearGradient><radialGradient id="lamp-light"><stop stopColor="#efb766" stopOpacity=".19"/><stop offset="1" stopColor="#efb766" stopOpacity="0"/></radialGradient><pattern id="rug-weave" width="12" height="12" patternUnits="userSpaceOnUse"><path d="M0 2h12M2 0v12" stroke="#a4aa73" strokeOpacity=".12"/></pattern></defs>
 <rect width={width} height={height} fill="url(#office-wood)"/><rect width={width} height="48" fill="#263a32"/><path d="M0 48H1000" stroke="#8e7350" strokeWidth="8"/>
 {[70,240,700,870].map(x=><g key={x}><rect x={x} y="9" width="80" height="32" rx="3" fill="#12252c" stroke="#547968"/><path d={`M${x+40} 9v32M${x} 25h80`} stroke="#547968"/><path d={`M${x+8} 17h4m16 13h4m30-13h4`} stroke="#d9ae6a"/></g>)}
 <text x="500" y="33" textAnchor="middle" fill="#c4e0ca" fontSize="14" letterSpacing="4">DITASHA · SHARED STUDIO</text>
 {Array.from({length:Math.ceil(height/180)},(_,i)=><g key={i} transform={`translate(27 ${90+i*180})`}><ellipse cy="30" rx="21" ry="7" fill="#201d19"/><path d="M-13 7h26l-4 25h-18z" fill="#997251"/><path d="M0 10v-33M0-4q-30-20-24-31q24-2 24 31M0-8q29-26 25-33q-29 4-25 33M0-15q-5-27 3-35q13 17-3 35" fill="#43785b" stroke="#2f6347" strokeWidth="3"/></g>)}
 <rect x="725" y="73" width="220" height="95" rx="15" fill="#253e35" stroke="#638573" strokeWidth="3"/><rect x="742" y="90" width="86" height="65" rx="9" fill="#365549"/><rect x="842" y="90" width="86" height="65" rx="9" fill="#365549"/>
 <g><rect x="80" y="72" width="180" height="88" rx="5" fill="#172f2c" stroke="#b18e58" strokeWidth="5"/><text x="170" y="91" textAnchor="middle" fill="#d4e7d7" fontSize="11" fontWeight="700">PAPAN TUGAS</text>{[0,1,2].map(i=><g key={i}><rect x={95+i*51} y="103" width="42" height="41" rx="2" fill={['#edce85','#93d8c1','#bbace9'][i]}/><path d={`M${101+i*51} 114h28m-28 7h23m-23 7h26`} stroke="#385348" strokeWidth="2"/></g>)}</g>

 {desks.map(d=><g key={employees[d.index].id} transform={`translate(${d.x} ${d.y})`}>
 <ellipse cx="75" cy="35" rx="155" ry="100" fill="url(#lamp-light)"/><rect x="-116" y="-8" width="232" height="160" rx="6" fill="#1c3630" stroke="#647e64" strokeWidth="2" opacity=".65"/>
 <rect x="-110" y="-2" width="220" height="148" rx="4" fill="url(#rug-weave)"/><ellipse cy="126" rx="27" ry="9" fill="#211b18" opacity=".7"/>
 <rect x="-23" y="70" width="46" height="57" rx="12" fill="#232e2d" stroke="#556661" strokeWidth="3"/>
 <path d="M0 124v12m-23 4l23-5 23 5" stroke="#394745" strokeWidth="5"/>
 <path d="M-90 47v43m180-43v43" stroke="#2f2923" strokeWidth="8"/>
 <rect x="-96" y="12" width="192" height="59" rx="5" fill="url(#desk-wood)" stroke="#392a20" strokeWidth="4"/>
 <rect x="-44" y="-20" width="88" height="48" rx="3" fill="url(#screen-glow)" stroke="#233132" strokeWidth="5"/>
 <path d="M-28-5h32m-32 8h49m-49 8h25" stroke={employees[d.index].color} opacity=".7" strokeWidth="2"/>
 <path d="M0 30v8m-13 1h26" stroke="#343c3a" strokeWidth="4"/>
 <rect x="-25" y="43" width="50" height="13" rx="2" fill="#253231"/><path d="M-22 47h43m-43 5h43m-36-7v8m8-8v8m8-8v8m8-8v8" stroke="#8b9a87" strokeWidth="1" opacity=".6"/><rect x="35" y="43" width="9" height="12" rx="4" fill="#4a5650"/>
 <rect x="-80" y="27" width="18" height="20" rx="3" fill="#aacfaa"/><path d="M-61 30q12 1 0 12" fill="none" stroke="#aacfaa" strokeWidth="3"/>
 <path d="M68 20v-32l15-12" stroke="#3b3931" strokeWidth="4"/><path d="M72-21l17-11 11 17-25 9z" fill="#d3ba71"/>
 <text y="147" textAnchor="middle" fill={employees[d.index].color} fontSize="12" fontWeight="600">{employees[d.index].name}</text>
 </g>)}
 <rect x="970" width="30" height={height} fill="#25382d" opacity=".7"/>
 </svg>;
}
