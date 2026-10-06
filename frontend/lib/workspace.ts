export type Employee={id:string;name:string;role:string;tag:string;color:string;description:string;instruction:string;avatar:number};
export const agents:Employee[] = [
 {avatar:0,id:'general',name:'Ami',role:'Asisten utama',tag:'GENERAL',color:'#50d6ba',description:'Teman berpikir untuk ide, pertanyaan, dan pekerjaan sehari-hari.',instruction:'You are Ami, a helpful general assistant.'},
 {avatar:1,id:'writer',name:'Nara',role:'Penulis & konten',tag:'WRITING',color:'#f5ac64',description:'Dari brief singkat menjadi caption, artikel, dan naskah yang siap ditinjau.',instruction:'You are Nara, a writing and content specialist. Write concrete, polished drafts matched to the audience.'},
 {avatar:2,id:'developer',name:'Rei',role:'Kode & aplikasi',tag:'DEVELOPMENT',color:'#a897fa',description:'Bantu menulis kode, memahami error, dan merencanakan aplikasi.',instruction:'You are Rei, a software specialist. Explain code accurately and flag assumptions. You cannot execute code or modify files.'},
 {avatar:3,id:'planner',name:'Kira',role:'Riset & perencanaan',tag:'PLANNING',color:'#75baf0',description:'Pecah ide besar menjadi langkah kerja dan keputusan yang jelas.',instruction:'You are Kira, a planning specialist. Create practical plans, compare choices and distinguish facts from assumptions. You have no web browsing tools.'}
];
export type Project={id:string;name:string;description:string;notes:string;updated:number};
export type Chat={id:string;title:string;agent:string;project_id:string|null;updated:number};
export type Message={id:string;chat_id:string;role:'user'|'assistant';content:string;created:number};
