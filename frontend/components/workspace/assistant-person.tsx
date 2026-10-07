// One character system for the whole office: identical proportions in every pose.
const looks=[
 {hair:'#34303b',light:'#524653',coat:'#287b83',accent:'#83dcca',style:'short',glasses:true}, // Amii
 {hair:'#885137',light:'#b2784d',coat:'#d98938',accent:'#ffe0a8',style:'bob'}, // Nara
 {hair:'#292932',light:'#46414f',coat:'#77569a',accent:'#c7b0ec',style:'spiky'}, // Rei
 {hair:'#3d303b',light:'#675064',coat:'#659aca',accent:'#c3e4fc',style:'pony'}, // Kira
 {hair:'#ca7f92',light:'#efa9b8',coat:'#d187a2',accent:'#fbd5e2',style:'long',beret:true}, // Luna
 {hair:'#d4c9bd',light:'#f3e9dd',coat:'#3a526b',accent:'#b4d6e3',style:'short',glasses:true}, // Sora
 {hair:'#5a3933',light:'#805348',coat:'#88a28a',accent:'#d9eac7',style:'buns'}, // Mika
 {hair:'#e3ebf7',light:'#ffffff',coat:'#354456',accent:'#dac682',style:'bob'}, // Achi
 {hair:'#765341',light:'#a37b59',coat:'#354456',accent:'#c0a4d8',style:'bob'}, // Lora
 {hair:'#292c35',light:'#44464f',coat:'#805f51',accent:'#9dcab9',style:'short',glasses:true,beard:true}, // Dante
];
export function AssistantPerson({index,working,frame,facing,className}:{index:number;working:boolean;frame:number|null;facing:number;className:string}){
 const c=looks[Math.max(0,Math.min(looks.length-1,index))],walk=frame!==null,step=walk?(frame===0?-1:frame===2?1:0):0;
 const outline='#283139',skin='#f3c5a9',shade='#dda68c',female=['bob','pony','long','buns'].includes(c.style);
 return <span aria-hidden="true" className={'pixel-person assistant-person '+(working?'working ':'')+(walk?'stepping ':'')+className} style={{'--facing':walk?facing:1} as React.CSSProperties}><svg viewBox="0 0 96 112" fill="none" strokeLinecap="round" strokeLinejoin="round">
 <ellipse cx="48" cy="106" rx="25" ry="4" fill="#101b21" opacity=".22"/>
 <g stroke={outline} strokeWidth="1.8">
 {/* Hair behind the face; silhouettes differ while the skull remains fixed. */}
 {c.style==='pony'&&<path d="M66 14Q86 10 79 36L72 57Q62 53 69 30Z" fill={c.hair}/>}
 {c.style==='long'&&<path d="M23 25Q15 32 18 50Q9 58 20 66Q14 72 25 78L36 68H60L70 77Q81 70 75 62Q87 54 77 44L74 23Z" fill={c.hair}/>}
 {c.style==='buns'&&<><circle cx="22" cy="17" r="10" fill={c.hair}/><circle cx="74" cy="17" r="10" fill={c.hair}/><path d="M24 26L17 42L23 48M72 26L79 42L73 48" stroke={c.hair} strokeWidth="7"/></>}
 {/* Fixed feet and body bounds, with alternating lift and swing. */}
 <g transform={`translate(${-step*2} ${step===1?-3:0})`}><path d="M34 78H46L45 100H32Z" fill="#37414c"/><path d="M33 97H44L47 104Q39 109 27 105L28 101Z" fill="#29333c"/><path d="M30 103H43" stroke="#aabbbd"/></g>
 <g transform={`translate(${step*2} ${step===-1?-3:0})`}><path d="M50 78H62L64 100H51Z" fill="#37414c"/><path d="M52 97H63L68 101L69 105Q56 109 49 104Z" fill="#29333c"/><path d="M54 103H65" stroke="#aabbbd"/></g>
 <path d="M36 55Q48 51 60 55L67 79Q49 86 29 79Z" fill={c.coat}/><path d="M43 55L48 66L54 55" fill="#f0ece3"/><path d="M48 65V80" stroke={outline} opacity=".45"/><path d="M33 70L35 62M61 70L59 62" stroke={c.accent} opacity=".5"/>
 <g transform={`rotate(${working?-24:step*8} 33 57)`}><path d="M34 56Q26 54 23 62L22 75Q23 79 29 78L35 63" fill={c.coat}/><path d="M23 74Q19 83 27 85Q33 84 30 76" fill={skin}/></g>
 <g transform={`rotate(${working?24:-step*8} 63 57)`}><path d="M62 56Q70 54 73 62L74 75Q73 79 67 78L61 63" fill={c.coat}/><path d="M73 74Q77 83 69 85Q63 84 66 76" fill={skin}/></g>
 <path d="M43 49V57Q48 61 53 57V49" fill={shade}/>
 {/* Every head uses exactly the same geometry in idle, walk and work. */}
 <path d="M22 28Q19 7 46 6Q75 5 75 30L72 44H24Z" fill={c.hair}/>
 <ellipse cx="25" cy="36" rx="5" ry="7" fill={skin}/><ellipse cx="71" cy="36" rx="5" ry="7" fill={skin}/>
 <path d="M26 24Q28 14 48 14Q68 14 70 24V37Q69 53 48 55Q27 53 26 37Z" fill={skin}/>
 <path d="M29 38Q31 48 39 50" stroke="#f8d8c1" strokeWidth="3"/>
 <path d="M34 27L41 26M55 26L62 27" stroke={c.hair} strokeWidth="2"/>
 <ellipse cx="38" cy="34" rx="4.7" ry="6.1" fill="#5b443f"/><ellipse cx="58" cy="34" rx="4.7" ry="6.1" fill={index===7?'#8172a2':'#5b443f'}/>
 <ellipse cx="39" cy="33" rx="2" ry="2.8" fill="#252e35" stroke="none"/><ellipse cx="59" cy="33" rx="2" ry="2.8" fill="#252e35" stroke="none"/>
 <circle cx="36.5" cy="31.5" r="1.6" fill="white" stroke="none"/><circle cx="56.5" cy="31.5" r="1.6" fill="white" stroke="none"/>
 <path d="M46 40L49 41" stroke={shade} strokeWidth="1.3"/><path d="M43 46Q48 50 53 46" stroke="#b97669" strokeWidth="1.5"/>
 <ellipse cx="31" cy="42" rx="4" ry="2" fill="#e89892" opacity=".4" stroke="none"/><ellipse cx="65" cy="42" rx="4" ry="2" fill="#e89892" opacity=".4" stroke="none"/>
 {c.style==='spiky'?<path d="M22 25L21 14L29 15L29 6L38 10L43 3L49 7L59 3L60 9L71 8L69 16L76 18L71 28L65 20L55 24L54 17L43 25L41 18L31 27L31 20Z" fill={c.hair}/>:<path d="M23 26Q20 11 36 9Q58 0 72 17L72 30L66 25L63 18Q58 24 51 24L54 15Q45 22 37 24L39 16L29 28Z" fill={c.hair}/>}
 <path d="M30 14Q37 9 45 10M57 10L64 14" stroke={c.light} strokeWidth="3" opacity=".65"/>
 {(c.style==='bob'||c.style==='long')&&<><path d="M23 25L29 24L30 50L23 52Q18 42 23 25Z" fill={c.hair}/><path d="M68 25L73 25Q79 45 72 52L67 50Z" fill={c.hair}/><path d="M24 34L25 45M72 33L72 44" stroke={c.light} opacity=".5"/></>}
 {c.glasses&&<g stroke={index===9?'#a6b6b7':'#28343b'} strokeWidth="2"><rect x="29" y="28" width="17" height="13" rx="4"/><rect x="50" y="28" width="17" height="13" rx="4"/><path d="M46 32H50M25 31L29 32M67 32L71 31"/></g>}
 {c.beard&&<path d="M34 47L38 51Q48 55 59 50L63 46" stroke="#776259" strokeWidth="2" opacity=".8"/>}
 {c.beret&&<><path d="M20 19Q18 4 40 4Q62-1 72 12L69 17Q44 12 23 24Z" fill="#35363e"/><path d="M36 4L40 1" stroke="#35363e" strokeWidth="4"/></>}
 {c.style==='buns'&&<><path d="M20 24L25 26M71 26L76 24" stroke={c.accent} strokeWidth="4"/></>}
 {female&&<circle cx="27" cy="43" r="1.5" fill={c.accent} stroke="none"/>}
 {index===0||index===1||index===3?<><path d="M39 58L47 73L58 58" stroke="#31434f" strokeWidth="2"/><rect x="42" y="70" width="12" height="9" rx="1" fill="#e9ede5"/><path d="M45 73H51" stroke={c.coat}/></>:<rect x="35" y="63" width="6" height="6" rx="1" fill={c.accent} stroke="none"/>}
 {working&&<><path d="M30 68L63 65L60 88H32Z" fill="#354c5c"/><path d="M35 72L58 70L56 82H36Z" fill={c.accent} stroke="none"/><path d="M39 75L52 74M39 78H48" stroke="#416573" strokeWidth="1"/><ellipse cx="32" cy="78" rx="4" ry="5" fill={skin}/><ellipse cx="61" cy="76" rx="4" ry="5" fill={skin}/></>}
 </g></svg></span>;
}
