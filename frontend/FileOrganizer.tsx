import {useEffect,useState} from 'react';
import {FolderCheck,Undo2,Check,Loader2} from 'lucide-react';
import {native} from './lib/desktop';
import {toast} from 'sonner';

type History={undoAvailable:boolean;entries:{source:string;destination:string;status:string}[]};
type Result=History&{moved:number;errors:{file:string;error:string}[]};
const tools=(action:string,id:string)=>native('assistantTools',JSON.stringify({action,id}),210000);

export default function FileOrganizer({rootId,locked,onChanged,onBusyChange}:{rootId:string;locked:boolean;onChanged:()=>Promise<void>;onBusyChange:(busy:boolean)=>void}){
 const [history,setHistory]=useState<History|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[result,setResult]=useState<Result|null>(null);
 useEffect(()=>{let alive=true;setHistory(null);setResult(null);setError('');if(rootId)tools('fileHistory',rootId).then(h=>{if(alive)setHistory(h)}).catch(e=>{if(alive)setError(e.message)});return()=>{alive=false}},[rootId]);
 async function run(action:'fileOrganize'|'fileUndo'|'fileFinish'){
  if(busy||locked||!rootId)return;setBusy(true);onBusyChange(true);setError('');setResult(null);
  try{
   const outcome=await tools(action,rootId);
   if(action!=='fileFinish'){setResult(outcome);toast.success(outcome.moved+' file '+(action==='fileUndo'?'dikembalikan':'dirapikan'));}
   setHistory(await tools('fileHistory',rootId));await onChanged();
  }catch(e){setError((e as Error).message)}finally{setBusy(false);onBusyChange(false)}
 }
 const disabled=busy||locked||!rootId||!history;
 return <section className="settings-card dante-organizer" aria-busy={busy}>
  <div className="tool-heading"><div><p className="eyebrow teal">DANTE · PENGELOLA FILE</p><h2>Rapikan folder dalam sekali jalan.</h2><p>Dante pergi ke meja, memindahkan file, lalu kembali berkeliling.</p></div><FolderCheck size={30} aria-hidden="true"/></div>
  <p className="organizer-scope">File langsung dalam folder pilihan dikelompokkan menjadi Dokumen, Gambar, Video, Audio, Arsip, Aplikasi, Aset FiveM, Kode, dan Lainnya. Subfolder tetap utuh. Maksimal 200 file per batch; nama yang sama diberi nomor.</p>
  <div className="tool-actions organizer-actions">
   <button className="primary" disabled={disabled||history?.undoAvailable} onClick={()=>void run('fileOrganize')}><FolderCheck size={17}/> Rapikan sekarang</button>
   <button className="outline" disabled={disabled||!history?.undoAvailable} onClick={()=>void run('fileUndo')}><Undo2 size={17}/> Batalkan batch terakhir</button>
   {history?.undoAvailable&&<button className="text-button" disabled={disabled} onClick={()=>void run('fileFinish')}><Check size={16}/> Simpan hasil batch</button>}
  </div>
  {!rootId&&<p className="tool-empty">Pilih folder di Inventaris file untuk mulai.</p>}
  {history?.undoAvailable&&<p className="tool-note">Batch terakhir masih bisa dibatalkan. Simpan hasil batch jika ingin merapikan file berikutnya; setelah disimpan, undo batch ini ditutup.</p>}
  {busy&&<p className="tool-working" role="status"><Loader2 size={16} className="spin"/> Dante sedang bekerja. Hasil akan muncul setelah proses selesai.</p>}
  {error&&<p className="tool-error" role="alert">{error}</p>}
  {result&&<div className="organizer-result" role="status"><strong>{result.moved} file berhasil diproses</strong>{result.errors.length>0&&<ul>{result.errors.map((e,i)=><li key={i}>{e.file}: {e.error}</li>)}</ul>}</div>}
  {!!history?.entries.length&&<details className="organizer-history"><summary>Riwayat batch · {history.entries.length} file</summary><div className="tool-table"><table><thead><tr><th>Asal</th><th>Tujuan</th><th>Status</th></tr></thead><tbody>{history.entries.map((entry,i)=><tr key={i}><td>{entry.source}</td><td>{entry.destination}</td><td>{{moving:'Perlu pemulihan',moved:'Dipindahkan',undone:'Dikembalikan',finished:'Disimpan',skipped:'Dilewati'}[entry.status]||entry.status}</td></tr>)}</tbody></table></div></details>}
 </section>;
}
