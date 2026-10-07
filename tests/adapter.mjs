import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const testRequire=createRequire(process.env.DITASHA_TEST_PACKAGE||new URL('../frontend/package.json',import.meta.url));
globalThis.DOMParser=testRequire('@xmldom/xmldom').DOMParser;
let providerKeys={groq:false,gemini:false,openai:false,custom:false};
let chatgptStatus={provider:'openrouter',connected:false,permitted:false,models:[]};
let listener,stored=null,key=false,lastOp,lastMessages,failAI=false,failSave=false,dispatchTarget='general',badDispatch=false,failWorker=false,dispatchPrompt='',failTrends=false,handoffTarget='writer';
let mailPayments=[],failMailAck=false;
const toolCalls=[];
const aiCalls=[];let activeAI=0,peakAI=0;
const feedXML='<rss xmlns:ht="https://trends.google.com/trending/rss"><channel><item><title>FiveM community update</title><pubDate>Wed, 07 Oct 2026 00:00:00 GMT</pubDate><ht:approx_traffic>1000+</ht:approx_traffic><ht:news_item><ht:news_item_title>Community story</ht:news_item_title><ht:news_item_url>https://example.com/story</ht:news_item_url><ht:news_item_source>Example</ht:news_item_source></ht:news_item></item></channel></rss>';

globalThis.window={chrome:{webview:{addEventListener:(_,fn)=>{listener=fn;},postMessage:message=>{
 const [op,id,...rest]=message.split('\n');if(op==='ai'||op==='aiCoding'||op==='aiEmployee'){activeAI++;peakAI=Math.max(peakAI,activeAI);}const payload=rest.join('\n');let data=true,ok=true;
 try{
  if(op==='load')data=stored;
  else if(op==='hasKey')data=key;
  else if(op==='chatgptStatus')data=chatgptStatus;
  else if(op==='apiKeyStatus')data={provider:chatgptStatus.provider,keys:{openrouter:key,...providerKeys}};
  else if(op==='saveKey')key=true;
  else if(op==='save'){if(failSave)throw new Error('Disk full');stored=JSON.parse(payload);}
  else if(op==='assistantTools'){const r=JSON.parse(payload);toolCalls.push(r);if(r.action==='status')data={accounts:[{id:'mail-1',email:'test@example.com'}],roots:[{id:'root-1',path:'C:\\Allowed'}]};else if(r.action==='emailCheck')data={messages:[{uid:'8',subject:'Meeting',from:'test@example.com'}],unread:1,checkedAt:'2026-10-07T00:00:00Z'};else if(r.action==='mailStatus')data={payments:mailPayments};else if(r.action==='mailPayment')data=mailPayments.find(p=>p.id===r.id);else if(r.action==='mailReview'){if(failMailAck)throw new Error('Mail store busy');const payment=mailPayments.find(p=>p.id===r.id);payment.review='recorded';data={payments:mailPayments};}else if(r.action==='fileList')data={files:[{path:'notes.txt',size:4}],truncated:false};else throw new Error('Unexpected tool operation');}
  else if(op==='trends'){if(failTrends)throw new Error('Trends offline');data={rss:feedXML,source:'https://trends.google.com/trending/rss?geo=ID'};}
  else if(op==='ai'||op==='aiCoding'||op==='aiEmployee'){const route=JSON.parse(payload);lastOp=op==='aiEmployee'?(route.coding?'aiCoding':'ai'):op;lastMessages=op==='aiEmployee'?route.messages:route;aiCalls.push({op:lastOp,messages:lastMessages,route:op==='aiEmployee'?route:null});if(failAI)throw new Error('Quota exceeded');if(lastMessages[0].content.startsWith('You are Mika')){data={choices:[{message:{content:JSON.stringify({analysis:'Google search trends; source https://example.com/story',handoff_employee_id:handoffTarget,brief:'Write a caption based on the supplied trend'})}}]};}else if(lastMessages[0].content.includes('Return ONLY JSON')){dispatchPrompt=lastMessages[0].content;data={choices:[{message:{content:badDispatch?'bad':JSON.stringify({employee_id:dispatchTarget,brief:'Task brief'})}}]};}else {if(failWorker)throw new Error('Worker quota');data={choices:[{message:{content:'Local AI test answer'}}]};}}
 }catch(error){ok=false;data={error:error.message};}
 queueMicrotask(()=>{if(op==='ai'||op==='aiCoding'||op==='aiEmployee')activeAI--;listener({data:{id:Number(id),ok,data}});});
}}}};
const {parseTrendFeed}=await import('../frontend/test-build/trends.mjs');
assert.equal(parseTrendFeed(feedXML)[0].title,'FiveM community update');
assert.throws(()=>parseTrendFeed('<rss><channel/></rss>'));
assert.throws(()=>parseTrendFeed('<!DOCTYPE rss><rss/>'));
assert.equal(parseTrendFeed(feedXML.replace('https://example.com/story','http://example.com/story'))[0].links.length,0);
const {api,native,exportBackup,importBackup,validateState}=await import('../frontend/test-build/desktop.mjs');
assert.equal((await api('/api/workspace')).employees.length,10);
assert.equal(new Set((await api('/api/workspace')).employees.map(e=>e.avatar)).size,10,'each built-in employee has a distinct character');
assert.equal((await api('/api/workspace')).connected,false);
await native('saveKey','sk-or-v1-test-only-1234567890');
const p=await api('/api/workspace',{type:'project',name:'Local Project',description:'Offline brief'});
await api('/api/workspace',{id:p.id,notes:'Important local context'},'PATCH');
const e=await api('/api/workspace',{type:'employee',name:'Sora',role:'Frontend developer',instruction:'Write accurate code',avatar:2});
const c=await api('/api/workspace',{type:'chat',agent:e.id,project_id:p.id});
dispatchTarget=e.id;
const response=await api('/api/chat',{chat_id:c.id,content:'Help code'});
assert.equal(lastOp,'aiCoding');assert(lastMessages[0].content.includes('Important local context'));assert.equal(response.messages.length,2);
assert.equal((await api('/api/workspace?chat='+c.id)).messages.length,2);
assert.equal((await api('/api/workspace')).chats[0].title,'Help code');
const gc=await api('/api/workspace',{type:'chat',agent:'general'});
dispatchTarget='general';await api('/api/chat',{chat_id:gc.id,content:'General question'});assert.equal(lastOp,'ai');
const before=await exportBackup();failAI=true;
await assert.rejects(api('/api/chat',{chat_id:c.id,content:'Keep draft'}),/Quota/);assert.equal(await exportBackup(),before);failAI=false;
failSave=true;await assert.rejects(api('/api/workspace',{id:p.id,notes:'Unwritten'},'PATCH'),/Disk/);assert.equal(await exportBackup(),before);failSave=false;
await assert.rejects(api('/api/workspace',{type:'employee',name:'X',role:'Y',instruction:'Z',avatar:10}));
const invalid=JSON.parse(before);invalid.chats[0].agent='missing';assert.throws(()=>validateState(invalid));
await assert.rejects(importBackup('{bad-json'));assert.equal(await exportBackup(),before);
await importBackup(before);assert.equal(JSON.stringify(stored),JSON.stringify(JSON.parse(before)));
assert(!before.includes('sk-or-'));assert.equal((await api('/api/workspace')).employees.length,11);
console.log('Passed: local CRUD, project context, coding/general routing, AI failure, disk failure, backup validation, key exclusion.');

const events=[];dispatchTarget='developer';
const delegated=await api('/api/chat',{chat_id:gc.id,content:'Debug a FiveM resource',onAssign:async id=>events.push('assign:'+id),onReport:async id=>events.push('report:'+id)});
assert.deepEqual(events,['assign:developer','report:developer']);assert.equal(lastOp,'aiCoding');assert(delegated.messages[1].content.includes('Hasil dari Rei'));
assert(lastMessages.at(-1).content.includes('Debug a FiveM resource'));
const stable=await exportBackup();badDispatch=true;
await assert.rejects(api('/api/chat',{chat_id:gc.id,content:'Test'}),/membagi tugas/);assert.equal(await exportBackup(),stable);badDispatch=false;
dispatchTarget='missing';await assert.rejects(api('/api/chat',{chat_id:gc.id,content:'Test'}),/tidak valid/);assert.equal(await exportBackup(),stable);
dispatchTarget='developer';failWorker=true;events.length=0;
await assert.rejects(api('/api/chat',{chat_id:gc.id,content:'Test',onAssign:async id=>events.push(id),onReport:async()=>events.push('report')}),/Worker quota/);assert.deepEqual(events,['developer']);assert.equal(await exportBackup(),stable);
console.log('Passed: Amii delegation, custom employees, coding route, handoff order, invalid assignment, worker failure and unchanged saved history.');
failWorker=false;
for(const [target,request,name] of [['writer','Buat caption Instagram','Nara'],['planner','Susun rencana belajar','Kira']]){
 dispatchTarget=target;events.length=0;
 const result=await api('/api/chat',{chat_id:gc.id,content:request,onAssign:async id=>events.push(id),onReport:async id=>events.push('report:'+id)});
 assert.equal(lastOp,'ai');assert.deepEqual(events,[target,'report:'+target]);assert(result.messages[1].content.includes('Hasil dari '+name));
}
const designer=await api('/api/workspace',{type:'employee',name:'Luna',role:'Desainer logo',instruction:'Design logos and brand identities',avatar:3});
dispatchTarget=designer.id;
let assigned='';await api('/api/chat',{chat_id:gc.id,content:'Buat konsep logo',onAssign:async id=>assigned=id});assert.equal(assigned,designer.id);assert.equal(lastOp,'ai');assert(lastMessages[0].content.includes('Design logos'));assert(dispatchPrompt.includes('Design logos and brand identities'));assert(dispatchPrompt.includes('writer (Nara)'));assert(dispatchPrompt.includes('planner (Kira)'));
dispatchTarget='developer';
const explicit=await api('/api/chat',{chat_id:gc.id,content:'Minta Nara membantu: buat artikel',onAssign:async id=>assigned=id});assert.equal(assigned,'writer');assert.equal(lastOp,'ai');assert(explicit.messages[1].content.includes('Hasil dari Nara'));
console.log('Passed: Nara writing, Kira planning, custom role delegation, and explicit employee selection overriding incorrect router choice.');
dispatchTarget='social';events.length=0;
const social=await api('/api/chat',{chat_id:gc.id,content:'Cari tren untuk konten komunitas',onAssign:async id=>events.push('assign:'+id),onReport:async id=>events.push('report:'+id)});
assert.deepEqual(events,['assign:social','report:social','assign:writer','report:writer']);assert(social.messages[1].content.includes('Mika → Nara'));assert(social.messages[1].content.includes('https://example.com/story'));assert(social.messages[1].content.includes('Diambil:'));assert(lastMessages.at(-1).content.includes('FiveM community update'));
const beforeTrendsFailure=await exportBackup();failTrends=true;await assert.rejects(api('/api/chat',{chat_id:gc.id,content:'Cari tren'}),/Trends offline/);assert.equal(await exportBackup(),beforeTrendsFailure);failTrends=false;
handoffTarget='missing';await assert.rejects(api('/api/chat',{chat_id:gc.id,content:'Cari tren'}),/handoff/);assert.equal(await exportBackup(),beforeTrendsFailure);
console.log('Passed: live trend feed parsing, Mika-to-Nara handoff, source/date evidence, offline feed and invalid handoff without history loss.');
await import('./office-motion.mjs');

// The router's single-worker answer must still expand website creation into a real shared workflow.
dispatchTarget='web';failTrends=false;failWorker=false;events.length=0;aiCalls.length=0;
let teamPlan;
const website=await api('/api/chat',{chat_id:gc.id,content:'Buatkan website landing page untuk komunitas',onPlan:async steps=>{teamPlan=steps;},onBoardReport:async id=>events.push('board:'+id),onReportTogether:async ids=>events.push('together:'+ids.join('|')),onAssign:async id=>events.push('assign:'+id),onReport:async id=>events.push('report:'+id)});
assert.deepEqual(teamPlan.map(s=>s.employee_id),['social','designer','web']);
assert.deepEqual(events,['assign:social','board:social','assign:designer','assign:web','together:designer|web']);
const designerCall=aiCalls.find(c=>c.messages[0].content.startsWith('You are Luna'));
const codingCall=aiCalls.find(c=>c.messages[0].content.startsWith('You are Sora'));
assert.equal(codingCall.op,'aiCoding');
assert.equal(JSON.parse(designerCall.messages.at(-1).content).earlier_team_results[0].name,'Mika');
assert.deepEqual(JSON.parse(codingCall.messages.at(-1).content).earlier_team_results.map(c=>c.name),['Mika']);
const finalCode=aiCalls.filter(c=>c.messages[0].content.startsWith('You are Sora')).at(-1);
assert.deepEqual(JSON.parse(finalCode.messages.at(-1).content).earlier_team_results.map(c=>c.name),['Mika','Luna','Sora']);
assert(peakAI>=2,'design and code requests overlap');
assert(website.messages[1].content.includes('Mika → Luna → Sora'));
failTrends=true;
const offlineWebsite=await api('/api/chat',{chat_id:gc.id,content:'Make a landing page website'});
assert(offlineWebsite.messages[1].content.includes('bukan tren terverifikasi'));failTrends=false;
const beforeTeamFailure=await exportBackup();failWorker=true;
await assert.rejects(api('/api/chat',{chat_id:gc.id,content:'Build a landing page website'}),/Worker quota/);
assert.equal(await exportBackup(),beforeTeamFailure);failWorker=false;
console.log('Passed: website teamwork, research/design passed to coding, live-research fallback and unchanged history after team failure.');

chatgptStatus={provider:'chatgpt',connected:true,permitted:true,models:[{slug:'account-model',display_name:'Account Model'}],general:'account-model',coding:'account-code'};
let providerState=await api('/api/workspace');assert.equal(providerState.provider,'chatgpt');assert.equal(providerState.connected,true);assert.equal(providerState.model,'account-model');assert.equal(providerState.codingModel,'poolside/laguna-s-2.1:free');assert.equal(providerState.openRouterConnected,true);
chatgptStatus.permitted=false;assert.equal((await api('/api/workspace')).connected,false,'identity-only login cannot enable AI');
chatgptStatus.permitted=true;chatgptStatus.models=[];assert.equal((await api('/api/workspace')).connected,false,'missing account models cannot enable AI');
chatgptStatus.provider='openrouter';assert.equal((await api('/api/workspace')).model,'openrouter/free');
const backupWithoutAuth=await exportBackup();assert(!backupWithoutAuth.includes('account-model'));assert(!backupWithoutAuth.includes('chatgptStatus'));
console.log('Passed: ChatGPT provider status, account model selection, identity-only permission gate and credential-free backups.');

providerKeys={groq:true,gemini:true,openai:true,custom:true};
chatgptStatus={provider:'openrouter',connected:true,permitted:true,general:'account-general',coding:'account-code',models:[{slug:'account-general',display_name:'General'},{slug:'account-code',display_name:'Code'}]};
const config=(await api('/api/workspace')).aiConfig;
config.providers.groq.general='groq-general';config.providers.groq.coding='groq-code';
config.providers.gemini.general='gemini-design';config.providers.gemini.coding='gemini-code';
config.providers.custom.baseUrl='https://models.example.test/v1';config.providers.custom.general='custom-general';config.providers.custom.coding='custom-code';
config.employees={general:{provider:'groq',model:'amii-model'},social:{provider:'gemini',model:'mika-model'},designer:{provider:'chatgpt',model:'account-general'},web:{provider:'groq',model:'sora-code'}};
await api('/api/ai-settings',{config});
let multiStatus=await api('/api/workspace');assert.equal(multiStatus.model,'amii-model');assert.equal(multiStatus.provider,'groq');assert.equal(multiStatus.connected,true);
aiCalls.length=0;await api('/api/chat',{chat_id:gc.id,content:'Build a landing page website'});
assert.deepEqual(aiCalls.map(c=>[c.route.employee_id,c.route.provider,c.route.model]),[['general','groq','amii-model'],['social','gemini','mika-model'],['designer','chatgpt','account-general'],['web','groq','sora-code'],['web','groq','sora-code']]);
assert(aiCalls.every(c=>c.route.employee_id&&Array.isArray(c.route.messages)));
const cfgBackup=await exportBackup();assert.equal(JSON.parse(cfgBackup).ai.employees.web.model,'sora-code');assert(!cfgBackup.includes('test-access'));assert(!cfgBackup.includes('API_KEY'));
await importBackup(cfgBackup);assert.equal((await api('/api/workspace')).aiConfig.employees.social.provider,'gemini');
providerKeys.groq=false;assert.equal((await api('/api/workspace')).connected,false,'Amii specific provider controls connection status');
const beforeMissingKey=await exportBackup();await assert.rejects(api('/api/chat',{chat_id:gc.id,content:'hello'}),/API key groq/);assert.equal(await exportBackup(),beforeMissingKey);providerKeys.groq=true;
const badConfig=structuredClone(config);badConfig.providers.custom.baseUrl='https://user:password@example.test/v1';await assert.rejects(api('/api/ai-settings',{config:badConfig}),/tidak valid/);
badConfig.providers.custom.baseUrl='file:///tmp/key';await assert.rejects(api('/api/ai-settings',{config:badConfig}),/tidak valid/);
const paid=structuredClone(config);paid.providers.openrouter.general='paid/model';await assert.rejects(api('/api/ai-settings',{config:paid}),/gratis/);
const unknown=structuredClone(config);unknown.employees.missing={provider:'groq',model:'x'};await assert.rejects(api('/api/ai-settings',{config:unknown}),/tidak valid/);
config.employees[e.id]={provider:'custom',model:'custom-code'};await api('/api/ai-settings',{config});dispatchTarget=e.id;aiCalls.length=0;await api('/api/chat',{chat_id:c.id,content:'Help with code'});assert.equal(aiCalls.at(-1).route.provider,'custom');assert.equal(aiCalls.at(-1).route.baseUrl,'https://models.example.test/v1');assert.equal(aiCalls.at(-1).route.model,'custom-code');
console.log('Passed: mixed-provider website pipeline, employee overrides, custom endpoints, saved/backup model choices, missing-key preservation and invalid/paid configuration rejection.');

const {validateAttachments,generatedFiles,safeFilename}=await import('../frontend/test-build/chat-files.mjs');
assert.throws(()=>validateAttachments([{name:'photo.png',content:'binary'}]));
assert.throws(()=>validateAttachments([{name:'../key.txt',content:'x'}]));
assert.throws(()=>validateAttachments([{name:'x.txt',content:'a'.repeat(60001)}]));
assert.throws(()=>validateAttachments(Array.from({length:6},()=>({name:'x.txt',content:'ok'}))));
assert.equal(generatedFiles('```html filename=index.html\n<h1>Hello</h1>\n```')[0].name,'index.html');
assert.equal(generatedFiles('```lua filename=client.lua\nprint("hello")\n```')[0].content,'print("hello")');
assert.equal(generatedFiles('```js\nunfinished').length,0);
assert(!safeFilename('../../CON.txt').includes('/'));assert(safeFilename('CON.txt').startsWith('hasil-'));
const attachedChat=await api('/api/workspace',{type:'chat',agent:'general'});dispatchTarget='writer';aiCalls.length=0;
await api('/api/chat',{chat_id:attachedChat.id,content:'Summarize this file',attachments:[{name:'brief.md',content:'SECRET_REFERENCE_ONLY'}]});
assert(aiCalls.every(call=>call.messages.at(-1).content.includes('SECRET_REFERENCE_ONLY')));
assert(aiCalls.every(call=>!call.messages[0].content.includes('SECRET_REFERENCE_ONLY')));
assert.equal((await api('/api/workspace?chat='+attachedChat.id)).messages[0].attachments[0].name,'brief.md');
const attachedBackup=await exportBackup();await importBackup(attachedBackup);assert.equal((await api('/api/workspace?chat='+attachedChat.id)).messages[0].attachments[0].content,'SECRET_REFERENCE_ONLY');
failWorker=true;await assert.rejects(api('/api/chat',{chat_id:attachedChat.id,content:'More',attachments:[{name:'x.txt',content:'NEW_FILE'}]}));assert.equal(await exportBackup(),attachedBackup);failWorker=false;
failSave=true;await assert.rejects(api('/api/chats/delete',{id:attachedChat.id}));assert.equal(await exportBackup(),attachedBackup);failSave=false;
const beforeDelete=JSON.parse(await exportBackup());await api('/api/chats/delete',{id:attachedChat.id});const afterDelete=JSON.parse(await exportBackup());assert(!afterDelete.chats.some(c=>c.id===attachedChat.id));assert(!afterDelete.messages.some(m=>m.chat_id===attachedChat.id));assert.deepEqual(afterDelete.projects,beforeDelete.projects);assert.deepEqual(afterDelete.ai,beforeDelete.ai);assert.equal(afterDelete.chats.length,beforeDelete.chats.length-1);
await api('/api/chats/delete',{all:true});const cleared=JSON.parse(await exportBackup());assert.equal(cleared.chats.length,0);assert.equal(cleared.messages.length,0);assert.deepEqual(cleared.employees,afterDelete.employees);assert.deepEqual(cleared.projects,afterDelete.projects);await importBackup(attachedBackup);
console.log('Passed: file validation, generated file extraction, attachment handoffs/backups, failed-request preservation, single/all chat deletion and disk-failure rollback.');

const React=testRequire('react'),{renderToStaticMarkup}=testRequire('react-dom/server');const {default:MessageBody}=await import('../frontend/test-build/message-body.mjs');
const html=renderToStaticMarkup(React.createElement(MessageBody,{text:'# Hello\n\n**Bold** and `code`\n\n- One\n- Two\n\n| Name | Value |\n| --- | --- |\n| A | B |\n\n```html filename=index.html\n<script>alert(1)</script>\n```\n\n<img src=x onerror=alert(1)>\n\n[Bad](javascript:alert)'}));
assert(html.includes('<h3'));assert(html.includes('<strong>Bold</strong>'));assert(html.includes('<ul>'));assert(html.includes('<table>'));assert(html.includes('index.html'));assert(html.includes('Simpan file'));assert(!html.includes('<script>'));assert(!html.includes('<img'));assert(!html.includes('href="javascript:'));
console.log('Passed: Markdown headings, bold, code, lists, tables, download cards and escaped untrusted HTML.');

const beforePreset=JSON.parse(await exportBackup());key=true;
const migrated=await import('../frontend/test-build/desktop.mjs?recommended-migration');
const presetStatus=await migrated.api('/api/workspace');const presetBackup=JSON.parse(await migrated.exportBackup());
assert.equal(presetBackup.recommendedPreset,1);
for(const id of ['general','writer','planner','designer','social'])assert.deepEqual(presetStatus.aiConfig.employees[id],{provider:'openrouter',model:'google/gemma-4-31b-it:free'});
for(const id of ['developer','web'])assert.deepEqual(presetStatus.aiConfig.employees[id],{provider:'openrouter',model:'cohere/north-mini-code:free'});
assert(presetStatus.aiConfig.providers.openrouter.maxTokens>=8192);
assert.deepEqual(presetStatus.aiConfig.employees[e.id],beforePreset.ai.employees[e.id]);assert.deepEqual(presetBackup.messages,beforePreset.messages);assert.deepEqual(presetBackup.projects,beforePreset.projects);
assert(presetStatus.employees.find(x=>x.id==='general').instruction.includes('During task allocation'));
assert(presetStatus.employees.find(x=>x.id==='web').instruction.includes('filename=index.html'));
const userChoice=structuredClone(presetStatus.aiConfig);userChoice.employees.general={provider:'groq',model:'my-choice'};await migrated.api('/api/ai-settings',{config:userChoice});
const reopened=await import('../frontend/test-build/desktop.mjs?recommended-reopen');assert.equal((await reopened.api('/api/workspace')).aiConfig.employees.general.model,'my-choice');
console.log('Passed: one-time recommended preset migration, role prompts, custom assignment/data preservation and user choices retained after restart.');
// Operational employee routing, ledger persistence and disk rollback.
const ops=await import('../frontend/test-build/desktop.mjs?operations');
const roster=(await ops.api('/api/workspace')).employees;
for(const [id,name,avatar] of [['finance','Achi',7],['email','Lora',8],['files','Dante',9]]){
 const person=roster.find(e=>e.id===id);assert.equal(person.name,name);assert.equal(person.avatar,avatar);
 assert.equal((await ops.api('/api/workspace')).aiConfig.employees[id].provider,'openrouter');
}
await ops.api('/api/money',{action:'add',date:'2026-10-07',kind:'income',amount:7000000,category:'Kontrak',note:'ASE'});
await ops.api('/api/money',{action:'add',date:'2026-10-07',kind:'expense',amount:500000,category:'Server',note:'Hosting'});
await ops.api('/api/money',{action:'budget',month:'2026-10',amount:2000000});
let ledger=(await ops.api('/api/workspace')).money;assert.equal(ledger.transactions.length,2);assert.equal(ledger.budgets['2026-10'],2000000);
const backup=await ops.exportBackup();assert.equal(JSON.parse(backup).money.transactions.length,2);
const savedLedger=JSON.stringify(ledger);failSave=true;await assert.rejects(ops.api('/api/money',{action:'add',date:'2026-10-07',kind:'expense',amount:10,category:'Test'}));failSave=false;
assert.equal(JSON.stringify((await ops.api('/api/workspace')).money),savedLedger);
await assert.rejects(ops.api('/api/money',{action:'add',date:'2026-02-30',kind:'income',amount:10,category:'Test'}));
await assert.rejects(ops.api('/api/money',{action:'add',date:'2026-10-07',kind:'income',amount:-10,category:'Test'}));
await assert.rejects(ops.api('/api/money',{action:'budget',month:'2026-13',amount:10}));
chatgptStatus={provider:'openrouter',connected:false,permitted:false,models:[]};key=true;badDispatch=false;failWorker=false;failAI=false;dispatchTarget='developer';
for(const [id,name] of [['finance','Achi'],['email','Lora'],['files','Dante']]){
 const chat=await ops.api('/api/workspace',{type:'chat',agent:'general',project_id:null});
 await ops.api('/api/chat',{chat_id:chat.id,content:'Minta '+name+' membantu: tinjau catatan yang diberikan'});
 assert.equal(aiCalls.at(-1).route.employee_id,id);
 if(id==='finance')assert(aiCalls.at(-1).messages[0].content.includes('6500000'),'Achi sees real ledger arithmetic');
}
const afterRestart=await import('../frontend/test-build/desktop.mjs?money-restart');assert.equal((await afterRestart.api('/api/workspace')).money.transactions.length,2);
await afterRestart.api('/api/money',{action:'delete',id:ledger.transactions[0].id});assert.equal((await afterRestart.api('/api/workspace')).money.transactions.length,1);
console.log('Passed: Achi/Lora/Dante routing, distinct avatars, new employee model migration, recorded finance context, ledger backup/restart and invalid/disk-failure protection.');

for(const [name,id,text,operation] of [['Lora','email','cek inbox email','emailCheck'],['Dante','files','periksa file folder','fileList']]){
 const chat=await afterRestart.api('/api/workspace',{type:'chat',agent:'general',project_id:null});
 await afterRestart.api('/api/chat',{chat_id:chat.id,content:'Minta '+name+' membantu: '+text});
 assert.equal(aiCalls.at(-1).route.employee_id,id);assert(toolCalls.some(c=>c.action===operation));
 assert(aiCalls.at(-1).messages[0].content.includes(id==='email'?'Meeting':'notes.txt'));
}
assert(!toolCalls.some(c=>['emailRead','fileRead','fileMove'].includes(c.action)),'Chat metadata checks do not read content or change files');
console.log('Passed: Lora inbox and Dante inventory checks provide real tool evidence to AI without automatic content reads or modifications.');

const mailId='a'.repeat(64);mailPayments=[{id:mailId,review:'pending',currency:'IDR',amount:125000,transactionDate:'2026-10-07',kind:'expense',subject:'Hosting receipt',account:'one@example.test'}];
await assert.rejects(afterRestart.api('/api/money/import-mail',{id:mailId}),/Konfirmasi/);
mailPayments[0].review='confirmed';mailPayments[0].currency='USD';await assert.rejects(afterRestart.api('/api/money/import-mail',{id:mailId}),/IDR/);mailPayments[0].currency='IDR';
const mailBefore=await afterRestart.exportBackup();failSave=true;await assert.rejects(afterRestart.api('/api/money/import-mail',{id:mailId}),/Disk/);failSave=false;assert.equal(await afterRestart.exportBackup(),mailBefore);assert.equal(mailPayments[0].review,'confirmed');
failMailAck=true;const partial=await afterRestart.api('/api/money/import-mail',{id:mailId});assert.equal(partial.synced,false);assert.equal(partial.money.transactions.filter(t=>t.id==='mail-'+mailId).length,1);
failMailAck=false;const retry=await afterRestart.api('/api/money/import-mail',{id:mailId});assert.equal(retry.synced,true);assert.equal(retry.money.transactions.filter(t=>t.id==='mail-'+mailId).length,1);assert.equal(mailPayments[0].review,'recorded');
const again=await afterRestart.api('/api/money/import-mail',{id:mailId});assert.equal(again.money.transactions.filter(t=>t.id==='mail-'+mailId).length,1);
mailPayments=[{...mailPayments[0],id:'b'.repeat(64),review:'confirmed',transactionDate:'2026-02-30'}];await assert.rejects(afterRestart.api('/api/money/import-mail',{id:'b'.repeat(64)}),/tidak valid/);
console.log('Passed: reviewed IDR-only email ledger import, authoritative native evidence, disk failure preservation and duplicate-safe retry after partial handoff failure.');

// Phone work must survive restart without repeating provider calls.
const remoteId='11111111-1111-4111-8111-111111111111';
const prepared=await afterRestart.api('/api/sync/prepare',{id:remoteId,type:'chat',agent:'general'});
assert.equal(prepared.status,'prepared');
assert.equal((await afterRestart.api('/api/sync/prepare',{id:remoteId,type:'chat',agent:'general'})).chatId,prepared.chatId);
const beforeRemote=aiCalls.length;
await afterRestart.api('/api/chat',{chat_id:prepared.chatId,remoteJobId:remoteId,content:'Buat catatan singkat'});
const completedRemote=await afterRestart.api('/api/sync/prepare',{id:remoteId,type:'chat',agent:'general'});
assert.equal(completedRemote.status,'completed');assert(completedRemote.result.length>0);assert(aiCalls.length>beforeRemote);
const afterRemote=aiCalls.length;
await assert.rejects(afterRestart.api('/api/chat',{chat_id:prepared.chatId,remoteJobId:remoteId,content:'Buat catatan singkat'}),/sudah dijalankan/);
assert.equal(aiCalls.length,afterRemote);
const syncRestart=await import('../frontend/test-build/desktop.mjs?sync-restart');
assert.equal((await syncRestart.cloudReceipts([remoteId]))[0].result,completedRemote.result);
const interruptedId='22222222-2222-4222-8222-222222222222';
const interrupted=await syncRestart.api('/api/sync/prepare',{id:interruptedId,type:'chat',agent:'general'});
failAI=true;await assert.rejects(syncRestart.api('/api/chat',{chat_id:interrupted.chatId,remoteJobId:interruptedId,content:'Another job'}));failAI=false;
assert.equal((await syncRestart.api('/api/sync/prepare',{id:interruptedId,type:'chat',agent:'general'})).status,'running');
assert.equal((await syncRestart.cloudReceipts([interruptedId])).length,0);
const savedRemote=await syncRestart.exportBackup();failSave=true;
await assert.rejects(syncRestart.api('/api/sync/prepare',{id:'33333333-3333-4333-8333-333333333333',type:'chat',agent:'general'}),/Disk/);failSave=false;
assert.equal(await syncRestart.exportBackup(),savedRemote);
const snapshot=await syncRestart.cloudSnapshot();assert(snapshot.employees.every(e=>!('instruction' in e)));assert(snapshot.messages.every(m=>!('attachments' in m)));assert(snapshot.projects.every(p=>!('notes' in p)));
await syncRestart.api('/api/chats/delete',{id:prepared.chatId});
await syncRestart.importBackup(await syncRestart.exportBackup());
assert.equal((await syncRestart.api('/api/sync/prepare',{id:remoteId,type:'chat',agent:'general'})).status,'completed');
console.log('Passed: durable phone completion/restart, no repeated AI work, interrupted-job review, snapshot privacy and atomic receipt persistence.');
