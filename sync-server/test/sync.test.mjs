import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {createApp} from '../server.mjs';
import {passwordHash} from '../store.mjs';
test('authenticated pairing, durable tasks, scope, retries and recovery',async()=>{
 const directory=mkdtempSync(join(tmpdir(),'ditasha-sync-')),origin='http://127.0.0.1:0';let app=createApp({directory,origin,development:true});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));let base='http://127.0.0.1:'+app.server.address().port;
 const call=async(path,data,headers={})=>{const res=await fetch(base+path,{method:data===undefined?'GET':'POST',headers:{...(data===undefined?{}:{'Content-Type':'application/json'}),...headers},body:data===undefined?undefined:JSON.stringify(data)});return {res,status:res.status,data:await res.json()}};
 let cookie='',device='',id='';const mobile=(path,data)=>call(path,data,{Cookie:cookie,Origin:origin,'X-Ditasha-Request':'1'}),pc=(path,data={})=>call(path,data,{Authorization:'Bearer '+device});
 try{
  assert.equal((await call('/api/state')).status,401);app.db.prepare('INSERT INTO owner VALUES (1,?,?)').run('foxu',await passwordHash('fixture-password-long'));
  assert.equal((await call('/api/login',{username:'foxu',password:'fixture-password-long'},{Origin:'https://evil.test','X-Ditasha-Request':'1'})).status,403);
  assert.equal((await mobile('/api/login',{username:'foxu',password:'wrong'})).status,401);
  const login=await mobile('/api/login',{username:'foxu',password:'fixture-password-long'});assert.equal(login.status,200);cookie=login.res.headers.get('set-cookie').split(';')[0];assert(login.res.headers.get('set-cookie').includes('HttpOnly'));assert(login.res.headers.get('set-cookie').includes('Secure'));
  const code=(await mobile('/api/pair/create',{})).data.code;const pair=await call('/api/pc/pair',{code,name:'PC test'});assert.equal(pair.status,200);device=pair.data.token;id=pair.data.id;
  assert.equal((await call('/api/pc/pair',{code,name:'PC duplicate'})).status,401);
  const snapshot={chats:[],messages:[],projects:[],employees:[{id:'general',name:'Amii',role:'Coordinator',instruction:'DO_NOT_UPLOAD'}],apiKey:'DO_NOT_UPLOAD',money:{transactions:[],budgets:{}}};assert.equal((await pc('/api/pc/snapshot',snapshot)).status,200);assert(!app.db.prepare('SELECT data FROM cache').get().data.includes('DO_NOT_UPLOAD'));
  assert.equal((await call('/api/pair/create',{}, {Authorization:'Bearer '+device,Origin:origin,'X-Ditasha-Request':'1'})).status,401,'PC token cannot access owner controls');
  assert.equal((await call('/api/pc/claim',{}, {Cookie:cookie})).status,401,'Phone session cannot act as PC');
  const request={requestId:randomUUID(),type:'chat',agent:'general',content:'Build a landing page',attachments:[]};const task=await mobile('/api/tasks',request);assert.equal(task.status,201);assert.equal((await mobile('/api/tasks',request)).data.id,task.data.id);assert.equal((await mobile('/api/tasks',{...request,content:'Different task'})).status,409);
  const claimed=(await pc('/api/pc/claim')).data.job;assert.equal(claimed.id,task.data.id);assert.equal((await pc('/api/pc/claim')).data.job,null);
  assert.equal((await pc('/api/pc/heartbeat',{jobId:claimed.id,lease:'wrong',progress:'work'})).status,409);assert.equal((await pc('/api/pc/heartbeat',{jobId:claimed.id,lease:claimed.lease,progress:'Sora working'})).status,200);
  const result='```html filename=index.html\n<h1>Done</h1>\n```';const completion={id:claimed.id,lease:claimed.lease,status:'completed',result};assert.equal((await pc('/api/pc/complete',completion)).status,200);assert((await pc('/api/pc/complete',completion)).data.duplicate);assert.equal(app.db.prepare('SELECT COUNT(*) AS n FROM jobs').get().n,1);
  const file=await fetch(base+'/api/tasks/'+task.data.id+'/files/0',{headers:{Cookie:cookie}});assert.equal(file.status,200);assert.equal(await file.text(),'<h1>Done</h1>');assert(file.headers.get('content-disposition').includes('index.html'));
  const second=(await mobile('/api/tasks',{requestId:randomUUID(),type:'email-check'})).data.id;const running=(await pc('/api/pc/claim')).data.job;assert.equal(running.id,second);app.db.prepare('UPDATE jobs SET lease_until=0 WHERE id=?').run(second);assert.equal((await mobile('/api/state')).data.jobs[0].status,'interrupted');
  assert.equal((await pc('/api/pc/complete',{id:second,lease:running.lease,status:'completed',result:'Done locally'})).status,409);assert((await pc('/api/pc/recover')).data.jobs.some(j=>j.id===second));assert.equal((await pc('/api/pc/reconcile',{id:second,status:'completed',result:'Recovered durable PC result'})).status,200);assert.equal((await mobile('/api/state')).data.jobs[0].result,'Recovered durable PC result');
  const queued=(await mobile('/api/tasks',{requestId:randomUUID(),type:'email-check'})).data.id;assert.equal((await mobile('/api/tasks/'+queued+'/cancel',{})).status,200);assert.equal((await pc('/api/pc/claim')).data.job,null);
  await app.close();app=createApp({directory,origin,development:true});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+app.server.address().port;assert.equal((await mobile('/api/state')).data.jobs.length,3,'Jobs and owner session survive restart');
  const newCode=(await mobile('/api/pair/create',{})).data.code;const newPair=(await call('/api/pc/pair',{code:newCode,name:'Replacement PC'})).data;assert.notEqual(newPair.id,id);assert.equal((await pc('/api/pc/heartbeat')).status,401);device=newPair.token;assert.equal((await pc('/api/pc/reconcile',{id:second,status:'completed',result:'Overwrite'})).status,409,'Replacement PC cannot reconcile old PC jobs');
  await mobile('/api/device/revoke',{});assert.equal((await pc('/api/pc/heartbeat')).status,401);
  await mobile('/api/logout',{});assert.equal((await mobile('/api/state')).status,401);
 }finally{await app.close();rmSync(directory,{recursive:true,force:true})}
});
