import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync,mkdirSync} from 'node:fs';
import {resolve,join,extname} from 'node:path';
const {chromium}=await import(process.env.DITASHA_PLAYWRIGHT_IMPORT||'playwright');
const root=resolve('frontend/dist'),output=process.env.DITASHA_UI_OUTPUT||'desktop-preview';mkdirSync(output,{recursive:true});
const server=createServer((req,res)=>{try{const pathname=new URL(req.url,'http://local').pathname,p=resolve(root,'.'+(pathname==='/'?'/index.html':pathname));if(!p.startsWith(root+'/'))throw new Error();res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css'})[extname(p)]||'application/octet-stream');res.end(readFileSync(p));}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,executablePath:process.env.DITASHA_CHROME_EXECUTABLE||undefined,args:['--no-sandbox']});
async function frameFits(page){assert.deepEqual(await page.evaluate(()=>({x:document.documentElement.scrollWidth>innerWidth,y:document.documentElement.scrollHeight>innerHeight,scroll:document.scrollingElement.scrollTop})),{x:false,y:false,scroll:0});}
async function floorFits(page){await page.waitForFunction(()=>{const scene=document.querySelector('.fit-office .shared-scene'),v=document.querySelector('.fit-office .office-viewport');if(!scene||!v)return false;const s=scene.getBoundingClientRect(),b=v.getBoundingClientRect();return b.height>100&&s.left>=b.left-1&&s.right<=b.right+1&&s.top>=b.top-1&&s.bottom<=b.bottom+1;});assert.equal(await page.locator('.fit-office .office-viewport').evaluate(e=>e.scrollHeight>e.clientHeight||e.scrollWidth>e.clientWidth),false);await frameFits(page);}
try{
 for(const custom of [0,8]){
  const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(count=>{
   let callback;const now=Date.now(),chat='11111111-1111-4111-8111-111111111111';let stored={version:1,projects:[],employees:Array.from({length:count},(_,i)=>({id:'custom-'+i,name:'Employee '+i,role:'Custom specialist',instruction:'Help with requests',avatar:i%10,color:'#50d6ba',tag:'CUSTOM',description:'Custom role'})),chats:[{id:chat,title:'Long conversation',agent:'general',project_id:null,updated:now}],messages:Array.from({length:30},(_,i)=>({id:'message-'+i,chat_id:chat,role:i%2?'assistant':'user',content:('Long message with useful details. ').repeat(100),created:now+i}))};
   const status={provider:'openrouter',connected:false,permitted:false,models:[],accounts:[],general:'',coding:'',active:''};
   window.chrome={webview:{addEventListener:(_,fn)=>callback=fn,postMessage:message=>{const [op,id,...rest]=message.split('\n'),payload=rest.join('\n');let data=true;
    if(op==='load')data=stored;else if(op==='save')stored=JSON.parse(payload);else if(op==='hasKey')data=true;else if(op==='apiKeyStatus')data={provider:'openrouter',keys:{openrouter:true,groq:false,gemini:false,openai:false,custom:false}};
    else if(op==='chatgptStatus')data=status;else if(op==='syncStatus')data={paired:false};else if(op==='hasGithubToken')data=false;else if(op==='updateStatus')data={current:'3.16.0',status:'Ready',version:'',ready:false,automatic:true};
    else if(op==='assistantTools')data=JSON.parse(payload).action==='status'?{accounts:[],roots:[]}:{enabled:false,lastRun:'',lastError:'',exportError:'',total:0,paymentTotal:0,mailTotal:0,pending:0,counts:{},messages:[],payments:[],accounts:[],reportPath:'',schedule:{registered:false,nextRun:'',lastResult:null}};
    else if(op==='aiEmployee'){const route=JSON.parse(payload);if(!route.messages[0].content.includes('Return ONLY JSON')){if(!window.__completeFixture)return;data={choices:[{message:{content:'Completed inline office chat test.'}}]};queueMicrotask(()=>callback({data:{id:Number(id),ok:true,data}}));return;}data={choices:[{message:{content:JSON.stringify({employee_id:'writer',brief:'Create a plan',steps:(window.__completeFixture?['writer']:['writer','planner','developer','designer','web','finance']).map(employee_id=>({employee_id,brief:'Prepare the assigned contribution for the shared task'}))})}}]};}
    queueMicrotask(()=>callback({data:{id:Number(id),ok:true,data}}));
   }}};
  },custom);
  await page.goto(base);await page.locator('.fit-office .office-worker').last().waitFor();assert.equal(await page.locator('.fit-office .office-worker').count(),10+custom);
  for(const viewport of [{width:1280,height:720},{width:1024,height:600},{width:1440,height:900}]){
   await page.setViewportSize(viewport);await floorFits(page);
   if(custom===0)await page.screenshot({path:join(output,'office-'+viewport.width+'.png')});
   await page.getByRole('button',{name:'Beranda',exact:true}).click();await page.locator('.home-team-list').waitFor();await frameFits(page);
   assert.equal(await page.locator('.home-dashboard').evaluate(e=>e.scrollHeight>e.clientHeight||e.scrollWidth>e.clientWidth),false,'Home fits without page scrolling');
   if(custom===0)await page.screenshot({path:join(output,'home-'+viewport.width+'.png')});
   await page.getByRole('button',{name:'Kantor virtual',exact:true}).click();await floorFits(page);
  }
  await page.getByRole('checkbox',{name:'Gerak karakter'}).uncheck();
  await page.evaluate(()=>window.__completeFixture=true);
  await page.getByRole('button',{name:'Chat baru di kantor'}).click();
  await page.getByRole('textbox',{name:'Pesan untuk AI'}).fill('Test inline office reply');await page.getByRole('button',{name:'Kirim pesan',exact:true}).click();
  await page.getByText('Completed inline office chat test.',{exact:true}).first().waitFor({timeout:30000});
  assert.equal(await page.locator('.office-workbench').count(),1,'Sending stays in the office');await frameFits(page);
  await page.getByRole('button',{name:'Percakapan',exact:true}).first().click();await page.getByText('Completed inline office chat test.',{exact:true}).first().waitFor();
  await page.getByRole('button',{name:'Kantor virtual',exact:true}).click();
  await page.setViewportSize({width:800,height:720});
  await page.getByRole('button',{name:'Kantor',exact:true}).click();await floorFits(page);
  await page.getByRole('button',{name:'Chat Amii',exact:true}).click();assert(await page.getByRole('textbox',{name:'Pesan untuk AI'}).isVisible());await frameFits(page);
  await page.setViewportSize({width:1440,height:900});await page.evaluate(()=>window.__completeFixture=false);
  await page.getByRole('button',{name:'Long conversation'}).first().click();await page.locator('.messages .message').last().waitFor();await frameFits(page);
  assert(await page.locator('.messages').evaluate(e=>e.scrollHeight>e.clientHeight));
  const send=await page.getByRole('button',{name:'Kirim pesan',exact:true}).boundingBox();assert(send&&send.y+send.height<=900);
  await page.locator('.messages').evaluate(e=>e.scrollTop=0);await page.getByRole('textbox',{name:'Pesan untuk AI'}).fill('Rencanakan proyek bersama tim');await page.getByRole('button',{name:'Kirim pesan',exact:true}).click();
  await page.getByRole('button',{name:'Kantor virtual',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('.fit-office .board-task').length===6);await floorFits(page);
  await page.setViewportSize({width:1024,height:600});await floorFits(page);if(custom===0)await page.screenshot({path:join(output,'office-working-1024.png')});
  await page.getByRole('button',{name:'Pengaturan',exact:true}).click();await page.locator('.settings-page').waitFor();await frameFits(page);assert(await page.locator('.settings-page').evaluate(e=>e.scrollHeight>e.clientHeight));
  assert.deepEqual(errors,[]);await page.close();
 }
 console.log('Desktop layout passed: fixed frame at 1024/1280/1440, complete 10/18-person office, dashboard, long chat composer, working board and settings panels.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
