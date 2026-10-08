import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync,mkdirSync} from 'node:fs';
import {resolve,join,extname} from 'node:path';
const {chromium}=await import(process.env.DITASHA_PLAYWRIGHT_IMPORT||'playwright');
const root=resolve('frontend/dist'),output=process.env.DITASHA_UI_OUTPUT||'desktop-preview';mkdirSync(output,{recursive:true});
const server=createServer((req,res)=>{try{const pathname=new URL(req.url,'http://local').pathname,p=resolve(root,'.'+(pathname==='/'?'/index.html':pathname));if(!p.startsWith(root+'/'))throw new Error();res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css'})[extname(p)]||'application/octet-stream');res.end(readFileSync(p));}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,executablePath:process.env.DITASHA_CHROME_EXECUTABLE||undefined,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
async function frameFits(page){assert.deepEqual(await page.evaluate(()=>({x:document.documentElement.scrollWidth>innerWidth,y:document.documentElement.scrollHeight>innerHeight,scroll:document.scrollingElement.scrollTop})),{x:false,y:false,scroll:0});}
async function floorFits(page){await page.waitForFunction(()=>{const v=document.querySelector('.fit-office .office-viewport');if(!v)return false;const b=v.getBoundingClientRect(),canvas=v.querySelector('.office-3d-render[data-scene-ready=true] canvas');if(canvas){const c=canvas.getBoundingClientRect();return b.height>100&&Math.abs(c.width-b.width)<2&&Math.abs(c.height-b.height)<2;}const scene=v.querySelector('.shared-scene');if(!scene)return false;const s=scene.getBoundingClientRect();return b.height>100&&s.left>=b.left-1&&s.right<=b.right+1&&s.top>=b.top-1&&s.bottom<=b.bottom+1;});assert.equal(await page.locator('.fit-office .office-viewport').evaluate(e=>e.scrollHeight>e.clientHeight||e.scrollWidth>e.clientWidth),false);await frameFits(page);}

try{
 for(const custom of [0,8]){
  const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(count=>{
   let callback;const now=Date.now(),chat='11111111-1111-4111-8111-111111111111';let stored={version:1,projects:[],employees:Array.from({length:count},(_,i)=>({id:'custom-'+i,name:'Employee '+i,role:'Custom specialist',instruction:'Help with requests',avatar:i%10,color:'#50d6ba',tag:'CUSTOM',description:'Custom role'})),chats:[{id:chat,title:'Long conversation',agent:'general',project_id:null,updated:now}],messages:Array.from({length:30},(_,i)=>({id:'message-'+i,chat_id:chat,role:i%2?'assistant':'user',content:('Long message with useful details. ').repeat(100),created:now+i}))};
   const status={provider:'openrouter',connected:false,permitted:false,models:[],accounts:[],general:'',coding:'',active:''};
   window.chrome={webview:{addEventListener:(_,fn)=>callback=fn,postMessage:message=>{const [op,id,...rest]=message.split('\n'),payload=rest.join('\n');let data=true;
    if(op==='load')data=stored;else if(op==='save')stored=JSON.parse(payload);else if(op==='hasKey')data=true;else if(op==='apiKeyStatus')data={provider:'openrouter',keys:{openrouter:true,groq:false,gemini:false,openai:false,custom:false}};
    else if(op==='chatgptStatus')data=status;else if(op==='syncStatus')data={paired:false};else if(op==='hasGithubToken')data=false;else if(op==='updateStatus')data={current:'3.17.0',status:'Ready',version:'',ready:false,automatic:true};
    else if(op==='assistantTools')data=JSON.parse(payload).action==='status'?{accounts:[{id:'saved-one',label:'Personal',email:'one@example.test',host:'imap.example.test'},{id:'saved-two',label:'Work',email:'two@example.test',host:'imap.example.test'}],roots:[]}:{enabled:false,lastRun:'',lastError:'',exportError:'',total:0,paymentTotal:0,mailTotal:0,pending:0,counts:{},messages:[],payments:JSON.parse(payload).action==='mailStatus'?[{id:'f'.repeat(64),subject:'Discord payment failed',account:'one@example.test',paymentType:'Pembayaran gagal',review:'sorted',amount:null,currency:'',reason:'Tidak ada uang keluar',date:'2026-10-07'},{id:'e'.repeat(64),subject:'You paid to Merchant',account:'one@example.test',paymentType:'Bukti pembayaran',review:'sorted',amount:3,currency:'USD',reason:'Disortir otomatis',date:'2026-10-07'}]:[],accounts:[],reportPath:'',schedule:{registered:false,nextRun:'',lastResult:null}};
    else if(op==='aiEmployee'){const route=JSON.parse(payload);if(!route.messages[0].content.includes('Return ONLY JSON')){if(!window.__completeFixture)return;data={choices:[{message:{content:'Completed inline office chat test.'}}]};queueMicrotask(()=>callback({data:{id:Number(id),ok:true,data}}));return;}data={choices:[{message:{content:JSON.stringify({employee_id:'writer',brief:'Create a plan',steps:(window.__completeFixture?['writer']:['writer','planner','developer','designer','web','finance']).map(employee_id=>({employee_id,brief:'Prepare the assigned contribution for the shared task'}))})}}]};}
    if(op==='assistantTools'){
     const request=JSON.parse(payload);
     if(request.action==='status')data.roots=[{id:'fixture-folder',path:'C:\\Workspace Files'}];
     if(request.action==='fileHistory')data={entries:[],undoAvailable:!!window.__organized};
     if(request.action==='fileList')data={files:[],truncated:false};
     if(request.action==='fileOrganize'){window.__organized=true;data={entries:[],undoAvailable:true,moved:2,errors:[]};}
     if(request.action==='fileUndo'){window.__organized=false;data={entries:[],undoAvailable:false,moved:2,errors:[]};}
     if(request.action==='mailScan'&&window.__holdScan){window.__finishScan=()=>callback({data:{id:Number(id),ok:true,data}});return;}
    }
    queueMicrotask(()=>callback({data:{id:Number(id),ok:true,data}}));
   }}};
  },custom);
  await page.goto(base);await page.locator('.fit-office .office-worker,.fit-office .office-3d-worker').last().waitFor();assert.equal(await page.locator('.fit-office .office-worker,.fit-office .office-3d-worker').count(),10+custom);
  for(const viewport of [{width:1280,height:720},{width:1024,height:600},{width:1440,height:900}]){
   await page.setViewportSize(viewport);try{await floorFits(page);}catch(e){await page.screenshot({path:join(output,'failed-office.png')});console.log(await page.locator('.office-workbench,.office-page,.fit-office,.office-viewport,.shared-scene').evaluateAll(es=>es.map(e=>({class:e.className,rect:e.getBoundingClientRect().toJSON()}))));throw e;}
   assert.equal(await page.locator('.fit-office .office-3d-render[data-scene-ready=true] canvas').count(),1,'Real 3D room renders');
   if(custom===0)await page.screenshot({path:join(output,'office-'+viewport.width+'.png')});
   await page.getByRole('button',{name:'Beranda',exact:true}).click();await page.locator('.home-team-list').waitFor();await frameFits(page);
   assert.equal(await page.locator('.home-dashboard').evaluate(e=>e.scrollHeight>e.clientHeight||e.scrollWidth>e.clientWidth),false,'Home fits without page scrolling');
   if(custom===0)await page.screenshot({path:join(output,'home-'+viewport.width+'.png')});
   await page.getByRole('button',{name:'Kantor virtual',exact:true}).click();await floorFits(page);
  }
  await page.locator('.fit-office .office-dimension').getByRole('button',{name:'2D',exact:true}).click();await floorFits(page);
  await page.getByRole('checkbox',{name:'Gerak karakter'}).uncheck();
  await page.evaluate(()=>window.__completeFixture=true);
  await page.getByRole('button',{name:'Chat baru di kantor'}).click();
  await page.getByRole('textbox',{name:'Pesan untuk AI'}).fill('Test inline office reply');await page.getByRole('button',{name:'Kirim pesan',exact:true}).click();
  await page.getByText('Completed inline office chat test.',{exact:true}).first().waitFor({timeout:30000});
  assert.equal(await page.locator('.office-workbench').count(),1,'Sending stays in the office');await frameFits(page);
  await page.getByRole('navigation',{name:'Navigasi utama'}).getByRole('button',{name:/^Percakapan/}).click();await page.getByText('Completed inline office chat test.',{exact:true}).first().waitFor();
  await page.getByRole('button',{name:'Kantor virtual',exact:true}).click();
  await page.setViewportSize({width:800,height:720});
  await page.getByRole('button',{name:'Kantor',exact:true}).click();await floorFits(page);
  await page.getByRole('button',{name:'Chat Amii',exact:true}).click();assert(await page.getByRole('textbox',{name:'Pesan untuk AI'}).isVisible());await frameFits(page);
  await page.getByRole('button',{name:'Keuangan, email & file',exact:true}).click();
  await page.getByRole('button',{name:'Achi Keuangan',exact:true}).click();
  try{await page.getByText('Discord payment failed').waitFor();}catch(error){await page.screenshot({path:join(output,'failed-achi.png')});console.log({errors,panel:await page.locator('.mail-automation').textContent()});throw error;}
  assert.equal(await page.locator('tbody').getByText('Disortir otomatis',{exact:true}).count(),2,'Recognized outcomes do not require manual review');
  assert(await page.getByText('Tidak ada uang keluar',{exact:true}).isVisible());
  assert.equal(await page.getByRole('button',{name:'Catat di ledger',exact:true}).count(),0,'Sorted failure/foreign receipt does not demand ledger confirmation');
  await frameFits(page);if(custom===0)await page.screenshot({path:join(output,'achi-automatic.png')});
  if(custom===0){
   await page.getByRole('button',{name:'Dante File',exact:true}).click();
   await page.getByRole('combobox',{name:'Pilih folder',exact:true}).selectOption('fixture-folder');
   await page.getByRole('button',{name:'Rapikan sekarang',exact:true}).click();
   await page.getByText('2 file berhasil diproses',{exact:true}).waitFor();
   await page.getByRole('button',{name:'Batalkan batch terakhir',exact:true}).click();
   await page.getByRole('button',{name:'Rapikan sekarang',exact:true}).waitFor();
   await page.waitForFunction(()=>!window.__organized);
   await frameFits(page);await page.screenshot({path:join(output,'dante-organizer.png')});
   await page.getByRole('button',{name:'Lora Email',exact:true}).click();
   await page.evaluate(()=>window.__holdScan=true);
   await page.getByRole('button',{name:'Periksa & sortir sekarang',exact:true}).click();
   await page.waitForFunction(()=>!!window.__finishScan);
   await page.getByRole('button',{name:'Kantor virtual',exact:true}).click();
   await page.getByRole('button',{name:'Kantor',exact:true}).click();
   await page.locator('.fit-office .office-3d-worker.is-working').nth(1).waitFor();
   await page.locator('.fit-office .office-dimension').getByRole('button',{name:'2D',exact:true}).click();
   await page.locator('.fit-office .office-worker.is-working').nth(1).waitFor();
   for(const name of ['Lora','Achi'])assert(await page.locator('.fit-office .office-worker.is-working').filter({hasText:name}).count()===1);
   await page.screenshot({path:join(output,'lora-achi-at-desks.png')});
   await page.evaluate(()=>window.__finishScan());
   await page.waitForFunction(()=>document.querySelectorAll('.fit-office .office-worker.is-working').length===0);
  }
  await page.getByRole('button',{name:'Kantor virtual',exact:true}).click();
  await page.setViewportSize({width:1440,height:900});await page.evaluate(()=>window.__completeFixture=false);
  await page.getByRole('button',{name:'Long conversation'}).first().click();await page.locator('.messages .message').last().waitFor();await frameFits(page);
  assert(await page.locator('.messages').evaluate(e=>e.scrollHeight>e.clientHeight));
  const send=await page.getByRole('button',{name:'Kirim pesan',exact:true}).boundingBox();assert(send&&send.y+send.height<=900);
  await page.locator('.messages').evaluate(e=>e.scrollTop=0);await page.getByRole('textbox',{name:'Pesan untuk AI'}).fill('Rencanakan proyek bersama tim');await page.getByRole('button',{name:'Kirim pesan',exact:true}).click();
  await page.getByRole('button',{name:'Kantor virtual',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('.fit-office .board-task').length===6);await floorFits(page);
  await page.setViewportSize({width:1024,height:600});await floorFits(page);if(custom===0)await page.screenshot({path:join(output,'office-working-1024.png')});
  await page.getByRole('button',{name:'Pengaturan',exact:true}).click();await page.locator('.settings-page').waitFor();await frameFits(page);assert(await page.locator('.settings-page').evaluate(e=>e.scrollHeight>e.clientHeight));
  await page.getByRole('button',{name:'Keuangan, email & file',exact:true}).click();await page.getByRole('button',{name:'Lora Email',exact:true}).click();await page.locator('.saved-account-list button').last().waitFor();assert.equal(await page.locator('.saved-account-list button').count(),2);assert(await page.getByText('one@example.test',{exact:true}).first().isVisible());await frameFits(page);
  await page.getByRole('button',{name:'Kantor virtual',exact:true}).click();await floorFits(page);await page.getByRole('button',{name:'Keuangan, email & file',exact:true}).click();await page.getByRole('button',{name:'Lora Email',exact:true}).click();await page.locator('.saved-account-list button').last().waitFor();assert.equal(await page.locator('.saved-account-list button').count(),2,'Saved accounts load again after remount');
  assert.deepEqual(errors,[]);await page.close();
 }
 console.log('Desktop layout passed: fixed frame at 1024/1280/1440, complete 10/18-person office, dashboard, long chat composer, working board, settings panels, real 3D rendering and saved email accounts.');
}finally{await browser.close();await new Promise(r=>server.close(r));}

