import {useRef,useState} from 'react';
import APISettings from './APISettings';
import type {AIConfig,KeyStatus,ChatGPTInfo} from './lib/ai-settings';
import type {Employee} from './lib/workspace';
import ChatGPTSettings from './ChatGPTSettings';
import UpdateSettings from './UpdateSettings';
import {Sparkles,Lock,Save,Download,Upload,Trash2,Loader2} from 'lucide-react';
import {native,exportBackup,importBackup} from './lib/desktop';
import {toast} from 'sonner';
export default function LocalSettings({refresh,workflowBusy=false,config,keys,chatgpt,employees}:{workflowBusy?:boolean;config:AIConfig;keys:KeyStatus;chatgpt:ChatGPTInfo;employees:Employee[];refresh:()=>Promise<unknown>}){
 const [busy,setBusy]=useState(false);const input=useRef<HTMLInputElement>(null);
 async function backup(){try{const text=await exportBackup(),url=URL.createObjectURL(new Blob([text],{type:'application/json'})),link=document.createElement('a');link.href=url;link.download='DITASHA-Backup-'+new Date().toISOString().slice(0,10)+'.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),60000);}catch(error){toast.error((error as Error).message);}}
 async function restore(file:File|undefined){if(!file)return;if(!window.confirm('Import backup ini akan mengganti proyek, karyawan, dan chat lokal. Export backup saat ini terlebih dahulu bila ingin menyimpannya. Lanjutkan?'))return;setBusy(true);try{await importBackup(await file.text());await refresh();toast.success('Backup berhasil diimpor.');}catch(error){toast.error((error as Error).message);}finally{setBusy(false);if(input.current)input.current.value='';}}
 return <div className="page settings-page"><p className="eyebrow teal">DITASHA · DI PC KAMU</p><h1>Pengaturan</h1><p className="lead">Kantor dan data lokal. Internet untuk jawaban AI dan update aplikasi.</p>
 <ChatGPTSettings refresh={refresh} locked={workflowBusy}/>
 <APISettings config={config} keys={keys} chatgpt={chatgpt} employees={employees} locked={workflowBusy} refresh={refresh}/>
 <div className="security-note"><Lock size={22}/><div><h3>Workspace berjalan di PC.</h3><p>Proyek, catatan, karyawan, dan chat tersimpan di PC ini. Pesan dan konteks proyek dikirim ke penyedia yang dipilih untuk setiap karyawan. Login dilakukan di browser resmi OpenAI.</p></div></div>
 <UpdateSettings/><section className="settings-card"><h2>Backup lokal</h2><p>Export data sebelum pindah PC atau mengimpor backup. API key dan sesi ChatGPT tidak ikut di dalam backup.</p><div className="local-actions"><button className="outline" disabled={workflowBusy||busy} onClick={()=>void backup()}><Download size={16}/> Export backup</button><button className="outline" disabled={workflowBusy||busy} onClick={()=>input.current?.click()}><Upload size={16}/> Import backup</button><input ref={input} type="file" accept=".json,application/json" hidden onChange={e=>void restore(e.target.files?.[0])}/></div></section>
 <section className="settings-card"><h2>DITASHA Workspace Local</h2><dl><div><dt>Versi</dt><dd>Windows x64 · versi di panel update</dd></div><div><dt>Penyimpanan</dt><dd>PC ini · folder LocalAppData DITASHA</dd></div><div><dt>AI</dt><dd>ChatGPT / OpenRouter / Groq / Gemini / OpenAI API / API khusus</dd></div></dl></section></div>;
}
