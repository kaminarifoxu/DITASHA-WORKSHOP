import {api,native,cloudSnapshot,cloudReceipts} from './desktop';
import {officeEngine} from './office-engine';
type Job={id:string;type:'chat'|'email-check'|'payment-review';lease:string;request:any};
export type SyncInfo={paired:boolean;url?:string;deviceId?:string};
let queue:Promise<unknown>=Promise.resolve();
export function syncNative(operation:string,payload:unknown={}){const work=()=>native(operation,JSON.stringify(payload),180000);const job=queue.then(work,work);queue=job.catch(()=>{});return job;}
export const syncRequest=(path:string,body:unknown={})=>syncNative('syncRequest',{path,body});
const tools=(action:string,data:Record<string,unknown>={})=>native('assistantTools',JSON.stringify({action,...data}),210000);
export function startCloudSync(callbacks:{busy:()=>boolean;begin:()=>void;activity:(id:string|null,text:string)=>void;finish:()=>Promise<void>;status:(text:string,error?:boolean)=>void}){
 let stopped=false,ticking=false,active:Job|null=null,progress='',lastHash='',nextSnapshot=0,reconciledDevice='',completion:{job:Job;body:any}|null=null;
 const status=(text:string,error=false)=>{if(!stopped)callbacks.status(text,error)};
 async function publish(){
  if(Date.now()<nextSnapshot)return;nextSnapshot=Date.now()+60000;
  const snapshot:any=await cloudSnapshot();if(snapshot.money.transactions.length>1000)snapshot.partial=true;snapshot.money.transactions=snapshot.money.transactions.slice(-1000);
  if(callbacks.busy()&&!active)return;
  try{const mail=await tools('mailStatus');snapshot.mail={lastRun:mail.lastRun,total:mail.total,pending:mail.pending,payments:mail.payments.map((p:any)=>({id:p.id,subject:p.subject,account:p.account,review:p.review,paymentType:p.paymentType,amount:p.amount,currency:p.currency,date:p.date,dueDate:p.dueDate}))};const report=await tools('mailReportData');if(report.available)snapshot.report={base64:report.base64};}catch{/* AI tasks must not fail because a local tools check is temporarily busy. */}
  let bytes=new TextEncoder().encode(JSON.stringify(snapshot));if(bytes.length>7500000){delete snapshot.report;snapshot.partial=true;bytes=new TextEncoder().encode(JSON.stringify(snapshot));}
  if(bytes.length>7500000)throw new Error('Data sync terlalu besar. Kurangi arsip atau lampiran.');const digest=await crypto.subtle.digest('SHA-256',bytes);const hash=Array.from(new Uint8Array(digest)).map(v=>v.toString(16).padStart(2,'0')).join('');if(hash!==lastHash){await syncRequest('/api/pc/snapshot',snapshot);lastHash=hash;}
 }
 async function execute(job:Job){
  active=job;callbacks.begin();progress='Amii menerima tugas dari ponsel';callbacks.activity('general',progress);
  let body:any;
  try{
   const request=job.request,receipt=await api('/api/sync/prepare',{id:job.id,type:job.type,...request});
   if(receipt.status==='completed')body={status:'completed',result:receipt.result||'Tugas sudah selesai di PC.'};
   else if(receipt.status!=='prepared')body={status:'interrupted',error:'Tugas pernah dimulai pada PC ini. Periksa hasil lokal sebelum membuat tugas baru.'};
   else if(job.type==='chat'){
    const roster=(await api('/api/workspace')).employees;const worker=roster.find((e:any)=>e.id===request.agent);if(!worker)throw new Error('Karyawan dari ponsel tidak ditemukan.');
    const activity=(id:string,text:string)=>{progress=text;callbacks.activity(id,text)};
    const result=await api('/api/chat',{chat_id:receipt.chatId,remoteJobId:job.id,content:request.agent==='general'?request.content:'Minta '+worker.name+' membantu: '+request.content,attachments:request.attachments||[],
     onPlan:async(steps:any)=>{activity('general','Amii memasang tugas ponsel di papan');await officeEngine.postPlan(steps)},
     onAssign:async(id:string)=>{activity(id,(roster.find((e:any)=>e.id===id)?.name||id)+' mengambil tugas');await officeEngine.assign(id)},
     onBoardReport:async(id:string)=>{activity(id,'Hasil riset dibagikan di papan');await officeEngine.publishResult(id)},
     onReady:async(id:string)=>{officeEngine.ready(id);activity(id,'Tim menyelesaikan pekerjaan')},onIntegrate:async(id:string)=>{officeEngine.integrate(id);activity(id,'Sora menggabungkan desain dan kode')},
     onReportTogether:async(ids:string[])=>{progress='Tim membawa hasil ke Amii';await officeEngine.reportTogether(ids)},onReport:async(id:string)=>{activity(id,'Hasil dikirim ke Amii');await officeEngine.report(id)}});
    body={status:'completed',result:result.messages.find((m:any)=>m.role==='assistant')?.content||'Selesai'};
   }else{
    await api('/api/sync/receipt',{id:job.id,status:'running'});
    if(job.type==='email-check'){progress='Lora memeriksa inbox';callbacks.activity('email',progress);const result=await tools('mailScan');body={status:'completed',result:`Lora selesai memeriksa inbox. Arsip: ${result.total} email. Pembayaran perlu review: ${result.pending}.`+(result.lastError?'\nKendala akun: '+result.lastError:'')+(result.exportError?'\nExcel: '+result.exportError:'')};}
    else {progress='Achi meninjau pembayaran dari ponsel';callbacks.activity('finance',progress);await tools('mailReview',request);let result='Review pembayaran tersimpan.';if(request.review==='confirmed'&&request.importLedger){if(request.currency!=='IDR')throw new Error('Ledger PC hanya mendukung IDR. Review tersimpan di Excel.');const imported=await api('/api/money/import-mail',{id:request.id});result=imported.synced?'Transaksi IDR dikonfirmasi dan dicatat satu kali di ledger.':'Ledger tersimpan; status email belum sinkron. Tinjau pada PC.';}body={status:'completed',result};}
    await api('/api/sync/receipt',{id:job.id,status:'completed',result:body.result});
   }
  }catch(e){body={status:'failed',error:(e as Error).message.slice(0,1000)};try{await api('/api/sync/receipt',{id:job.id,status:'failed',result:body.error})}catch{}officeEngine.fail();}
  completion={job,body:{id:job.id,lease:job.lease,...body}};active=null;nextSnapshot=0;officeEngine.reset();callbacks.activity(null,'');try{await callbacks.finish()}catch(e){status((e as Error).message,true)};
  try{await deliver()}catch(e){status('Hasil tersimpan di PC; pengiriman menunggu koneksi: '+(e as Error).message,true)}
 }
 async function deliver(){if(!completion)return;const pending=completion;try{await syncRequest('/api/pc/complete',pending.body)}catch(e){const receipts=await cloudReceipts([pending.job.id]);if(!receipts.length)throw e;const r=receipts[0];await syncRequest('/api/pc/reconcile',{id:r.id,status:r.status,result:r.status==='completed'?r.result:'',error:r.status==='failed'?r.result:''})};if(completion===pending)completion=null;status('Sync terhubung · hasil ponsel terkirim');}
 async function tick(){if(stopped||ticking)return;ticking=true;try{
   const info:SyncInfo=await syncNative('syncStatus');if(!info.paired){status('Sync ponsel belum dipasangkan');return;}
   if(reconciledDevice!==info.deviceId&&!active){const recover=await syncRequest('/api/pc/recover');const receipts=await cloudReceipts(recover.jobs.map((j:any)=>j.id));for(const r of receipts)await syncRequest('/api/pc/reconcile',{id:r.id,status:r.status,result:r.status==='completed'?r.result:'',error:r.status==='failed'?r.result:''});reconciledDevice=info.deviceId||'';}
   await syncRequest('/api/pc/heartbeat',active?{jobId:active.id,lease:active.lease,progress}:{});
   if(completion)await deliver();
   if(!active&&!callbacks.busy()){await publish();const result=await syncRequest('/api/pc/claim');if(result.job){void execute(result.job);return;}}
   status(active?'Ponsel · '+progress:'Sync ponsel terhubung');
  }catch(e){status((e as Error).message,true)}finally{ticking=false;}}
 const timer=setInterval(()=>void tick(),15000);const changed=()=>{lastHash='';nextSnapshot=0;void tick()};window.addEventListener('ditasha-sync-changed',changed);void tick();
 return ()=>{stopped=true;clearInterval(timer);window.removeEventListener('ditasha-sync-changed',changed)};
}
