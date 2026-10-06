import {useEffect,useState} from 'react';
import {GitBranch,RefreshCw,Download,Save,Trash2} from 'lucide-react';
import {native} from './lib/desktop';
import {toast} from 'sonner';
type Status={current:string;status:string;version:string;ready:boolean;automatic:boolean};
export default function UpdateSettings(){
 const [status,setStatus]=useState<Status>({current:'',status:'Memuat status...',version:'',ready:false,automatic:true}),[token,setToken]=useState(''),[stored,setStored]=useState(false),[busy,setBusy]=useState(false);
 async function refresh(){const [snapshot,hasToken]=await Promise.all([native('updateStatus'),native('hasGithubToken')]);setStatus(snapshot);setStored(hasToken);}
 useEffect(()=>{let active=true;const load=async()=>{try{const [snapshot,hasToken]=await Promise.all([native('updateStatus'),native('hasGithubToken')]);if(active){setStatus(snapshot);setStored(hasToken);}}catch(error){if(active)setStatus(previous=>({...previous,status:(error as Error).message}));}};void load();const timer=setInterval(()=>void load(),2000);return()=>{active=false;clearInterval(timer);};},[]);
 async function perform(op:string,payload='',success?:string){setBusy(true);try{await native(op,payload);if(op==='saveGithubToken')setToken('');await refresh();if(success)toast.success(success);}catch(error){toast.error((error as Error).message);}finally{setBusy(false);}}
 return <section className="settings-card"><div className="settings-heading"><span className="agent-icon"><GitBranch size={24}/></span><div><h2>Update aplikasi</h2><p>DITASHA-WORKSHOP · GitHub Releases</p></div><span className="settings-status">v{status.current||'…'}</span></div>
 <label className="auto-update-choice"><input type="checkbox" checked={status.automatic} disabled={busy} onChange={e=>void perform('autoUpdate',e.target.checked?'on':'off')}/><span>Periksa dan unduh update otomatis<small>Saat aplikasi dibuka, lalu setiap 6 jam. Instal setelah kamu memilih restart.</small></span></label>
 <p className="update-status" role="status">{status.status}{status.ready&&status.version?' ('+status.version+')':''}</p>
 <div className="local-actions"><button className="outline" disabled={busy} onClick={()=>void perform('checkUpdate')}><RefreshCw size={16}/> Periksa dan unduh update</button>{status.ready&&<button className="primary" disabled={busy} onClick={()=>void perform('installUpdate')}><Download size={16}/> Restart untuk instal</button>}</div>
 <p className="local-help">Unduhan diverifikasi dengan SHA-256. Data lokal dan key tetap tersimpan saat update.</p>
 <h3 className="github-token-heading">Akses repository privat</h3><p>Repository kamu privat. Buat fine-grained personal access token GitHub untuk <b>DITASHA-WORKSHOP</b> dengan izin <b>Contents: Read-only</b>, lalu simpan di sini.</p>
 <label className="local-key-label" htmlFor="github-update-token">Token GitHub {stored?'· sudah tersimpan':''}</label><input id="github-update-token" type="password" autoComplete="off" spellCheck={false} maxLength={256} value={token} onChange={e=>setToken(e.target.value)} className="local-key-input" placeholder="github_pat_…"/>
 <div className="local-actions"><button className="primary" disabled={busy||!token.trim()} onClick={()=>void perform('saveGithubToken',token.trim(),'Token disimpan terenkripsi.')}><Save size={16}/> Simpan token</button>{stored&&<button className="outline" disabled={busy} onClick={()=>void perform('removeGithubToken','','Token dihapus.')}><Trash2 size={16}/> Hapus token</button>}</div>
 <p className="local-help">Token tersimpan terenkripsi untuk akun Windows ini. Token tidak ikut backup atau source code.</p></section>;
}
