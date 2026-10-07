import {useEffect,useState} from 'react';
import {Loader2,LogOut,RefreshCw,ExternalLink,Plus,ShieldCheck} from 'lucide-react';
import {native} from './lib/desktop';
import {toast} from 'sonner';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from './components/ui/dialog';
export type ChatGPTStatus={provider:string;active:string;connected:boolean;permitted:boolean;general:string;coding:string;models:{slug:string;display_name:string}[];accounts:{id:string;email:string;signedIn:boolean}[];welcome?:boolean;remoteRevoked?:boolean};
export default function ChatGPTSettings({refresh,locked=false}:{refresh:()=>Promise<unknown>;locked?:boolean}){
 const [status,setStatus]=useState<ChatGPTStatus>(),[busy,setBusy]=useState(''),[welcome,setWelcome]=useState(false),[error,setError]=useState('');
 async function load(){const s=await native('chatgptStatus');setStatus(s);return s as ChatGPTStatus;}
 useEffect(()=>{let live=true;native('chatgptStatus').then(s=>{if(live)setStatus(s);}).catch(e=>{if(live)setError(e.message);});return()=>{live=false;};},[]);
 async function action(op:string,payload=''){
  if(locked)return;
  setBusy(op);setError('');try{const s:ChatGPTStatus=await native(op,payload,180000);setStatus(s);await refresh();
   if(op==='chatgptSignOut'&&s.remoteRevoked===false)toast.warning('Sesi lokal dihapus. Pencabutan akses online belum terkonfirmasi; putuskan aplikasi di pengaturan ChatGPT.');
   if(op==='chatgptChoose')toast.success('Pilihan model disimpan.');
  }catch(e){setError((e as Error).message);try{await load();await refresh();}catch{/* Preserve the original error. */}}finally{setBusy('');}
 }
 async function login(id=''){
  if(locked)return;
  setBusy('chatgptLogin');setError('');try{const signed:ChatGPTStatus=await native('chatgptLogin',id,600000);setStatus(signed);
   if(signed.permitted&&signed.models.length){setStatus(await native('aiProvider','chatgpt'));setWelcome(!!signed.welcome);toast.success('ChatGPT terhubung dan dipilih sebagai penyedia default.');}
   else toast.warning('Akun masuk, tetapi penggunaan paket ChatGPT belum tersedia.');await refresh();
  }catch(e){setError((e as Error).message);try{await load();await refresh();}catch{/* Preserve the original login error. */}}finally{setBusy('');}
 }
 async function dismissWelcome(){try{await native('chatgptWelcome');setWelcome(false);}catch(e){toast.error((e as Error).message);}}
 const active=status?.accounts.find(a=>a.id===status.active);
 return <><section className="settings-card chatgpt-card"><div className="settings-heading"><span className="agent-icon"><ShieldCheck size={24}/></span><div><h2>ChatGPT · paket kamu</h2><p>Masuk lewat browser resmi OpenAI</p></div><span className="settings-status">{status?.connected?(status.permitted?'Terhubung':'Izin paket belum tersedia'):'Belum terhubung'}</span></div>
 {locked&&<p className="local-help">Tunggu tugas tim selesai sebelum mengganti koneksi.</p>}
 <p>Gunakan jatah Plus atau Pro yang tersedia untuk Amii dan tim. Karyawan yang memilih ChatGPT berbagi batas penggunaan akun kamu. Tidak perlu memasukkan API key OpenAI.</p><p className="local-help">Akses mengikuti kelayakan akun dan izin OpenAI. Agar tidak memakai kredit tambahan, nonaktifkan penggunaan kredit oleh aplikasi ini di pengaturan ChatGPT.</p>
 {!!status?.accounts.length&&<label className="local-key-label">Akun tersimpan<select className="local-key-input" value={status.active} disabled={locked||!!busy} onChange={e=>void action('chatgptSwitch',e.target.value)}>{status.accounts.map((a,i)=><option key={a.id} value={a.id}>{a.email} · akun {i+1}{a.signedIn?'':' · keluar'}</option>)}</select></label>}
 <div className="local-actions"><button className="chatgpt-signin" disabled={locked||!!busy||!status} onClick={()=>void login(status?.active)}>{busy==='chatgptLogin'?<Loader2 size={16} className="spin"/>:null}Continue with ChatGPT</button>{!!status?.accounts.length&&<button className="outline" disabled={locked||!!busy} onClick={()=>void login()}><Plus size={16}/> Tambah akun</button>}{status?.connected&&<button className="outline" disabled={locked||!!busy} onClick={()=>void action('chatgptSignOut')}><LogOut size={16}/> Keluar</button>}</div>
 {busy==='chatgptLogin'&&<p className="chatgpt-pending">Selesaikan login dan persetujuan di browser. <button onClick={()=>void native('chatgptCancel').catch(e=>toast.error(e.message))}>Batalkan</button></p>}
 {active&&<p className="local-help">Akun aktif: {active.email} · akun {(status?.accounts.indexOf(active)||0)+1}</p>}
 {status?.connected&&status.permitted&&<><div className="local-actions"><button className="outline" disabled={locked||!!busy} onClick={()=>void action('chatgptModels')}><RefreshCw size={16}/> Muat model akun</button></div>{status.models.length>0&&<div className="chatgpt-models">{(['general','coding'] as const).map(kind=><label className="local-key-label" key={kind}>{kind==='general'?'Model Amii, riset dan desain':'Model coding'}<select className="local-key-input" value={status[kind]} disabled={locked||!!busy} onChange={e=>void action('chatgptChoose',JSON.stringify({general:status.general,coding:status.coding,[kind]:e.target.value}))}>{status.models.map(m=><option value={m.slug} key={m.slug}>{m.display_name}</option>)}</select></label>)}</div>}</>}
 {error&&<p className="chatgpt-error" role="alert">{error}</p>}<div className="local-actions"><button className="outline" onClick={()=>void native('chatgptUsage').catch(e=>toast.error(e.message))}><ExternalLink size={16}/> Kelola penggunaan</button>{!status&&<button className="outline" disabled={locked||!!busy} onClick={()=>void action('chatgptStatus')}>Coba lagi</button>}</div><p className="local-help">Login disimpan terenkripsi oleh Windows dan tidak ikut backup. Kamu bisa berpindah penyedia sendiri. Saat batas ChatGPT tercapai, aplikasi menampilkan pesan tanpa beralih otomatis.</p></section>
 <Dialog open={welcome} onOpenChange={open=>{if(!open)void dismissWelcome();}}><DialogContent><DialogTitle>Kamu menggunakan paket ChatGPT</DialogTitle><DialogDescription>Permintaan karyawan yang memilih ChatGPT menggunakan jatah paket ChatGPT kamu. Batasnya dibagi dengan aplikasi lain. Kelola batas aplikasi dan izin kredit tambahan di pengaturan ChatGPT.</DialogDescription><div className="local-actions"><button className="outline" onClick={()=>void native('chatgptUsage')}>Kelola penggunaan</button><button className="primary" onClick={()=>void dismissWelcome()}>Mengerti</button></div></DialogContent></Dialog></>;
}
