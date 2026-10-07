import assert from 'node:assert/strict';
let listener,stored=null,key=false,lastOp,lastMessages,failAI=false,failSave=false,dispatchTarget='general',badDispatch=false,failWorker=false;
globalThis.window={chrome:{webview:{addEventListener:(_,fn)=>{listener=fn;},postMessage:message=>{
 const [op,id,...rest]=message.split('\n');const payload=rest.join('\n');let data=true,ok=true;
 try{
  if(op==='load')data=stored;
  else if(op==='hasKey')data=key;
  else if(op==='saveKey')key=true;
  else if(op==='save'){if(failSave)throw new Error('Disk full');stored=JSON.parse(payload);}
  else if(op==='ai'||op==='aiCoding'){lastOp=op;lastMessages=JSON.parse(payload);if(failAI)throw new Error('Quota exceeded');if(lastMessages[0].content.includes('Return ONLY JSON'))data={choices:[{message:{content:badDispatch?'bad':JSON.stringify({employee_id:dispatchTarget,brief:'Task brief'})}}]};else {if(failWorker)throw new Error('Worker quota');data={choices:[{message:{content:'Local AI test answer'}}]};}}
 }catch(error){ok=false;data={error:error.message};}
 queueMicrotask(()=>listener({data:{id:Number(id),ok,data}}));
}}}};
const {api,native,exportBackup,importBackup,validateState}=await import('../frontend/test-build/desktop.mjs');
assert.equal((await api('/api/workspace')).employees.length,4);
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
await assert.rejects(api('/api/workspace',{type:'employee',name:'X',role:'Y',instruction:'Z',avatar:9}));
const invalid=JSON.parse(before);invalid.chats[0].agent='missing';assert.throws(()=>validateState(invalid));
await assert.rejects(importBackup('{bad-json'));assert.equal(await exportBackup(),before);
await importBackup(before);assert.equal(JSON.stringify(stored),JSON.stringify(JSON.parse(before)));
assert(!before.includes('sk-or-'));assert.equal((await api('/api/workspace')).employees.length,5);
console.log('Passed: local CRUD, project context, coding/general routing, AI failure, disk failure, backup validation, key exclusion.');

const events=[];dispatchTarget='developer';
const delegated=await api('/api/chat',{chat_id:gc.id,content:'Build a website',onAssign:async id=>events.push('assign:'+id),onReport:async id=>events.push('report:'+id)});
assert.deepEqual(events,['assign:developer','report:developer']);assert.equal(lastOp,'aiCoding');assert(delegated.messages[1].content.includes('Hasil dari Rei'));
assert(lastMessages.at(-1).content.includes('Build a website'));
const stable=await exportBackup();badDispatch=true;
await assert.rejects(api('/api/chat',{chat_id:gc.id,content:'Test'}),/membagi tugas/);assert.equal(await exportBackup(),stable);badDispatch=false;
dispatchTarget='missing';await assert.rejects(api('/api/chat',{chat_id:gc.id,content:'Test'}),/tidak valid/);assert.equal(await exportBackup(),stable);
dispatchTarget='developer';failWorker=true;events.length=0;
await assert.rejects(api('/api/chat',{chat_id:gc.id,content:'Test',onAssign:async id=>events.push(id),onReport:async()=>events.push('report')}),/Worker quota/);assert.deepEqual(events,['developer']);assert.equal(await exportBackup(),stable);
console.log('Passed: Amii delegation, custom employees, coding route, handoff order, invalid assignment, worker failure and unchanged saved history.');
await import('./office-motion.mjs');
