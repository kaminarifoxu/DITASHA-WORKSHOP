import assert from 'node:assert/strict';
import {OfficeEngine} from '../frontend/test-build/office-engine.mjs';
// Repeatable idle routes; random arrivals may legitimately return to the starting tile.
let randomSeed=12345;Math.random=()=>{randomSeed=(randomSeed*1664525+1013904223)>>>0;return randomSeed/4294967296;};
const engine=new OfficeEngine();engine.sync(['general','writer','developer','planner','extra']);
const start=engine.snapshot();
const frames=new Set();for(let i=0;i<400;i++){engine.tick(.05);const frame=engine.snapshot().writer.walkingFrame;if(frame!==null)frames.add(frame);}assert(frames.size===8&&[...frames].every(f=>Number.isInteger(f)&&f>=0&&f<8),'eight distance-driven walking poses while travelling');for(let i=0;i<40;i++)engine.tick(.05);
assert.deepEqual(engine.snapshot().general.point,start.general.point,'Amii stays at his desk');assert(engine.actors.writer.distance>0,'employees travel while roaming');
async function finish(job){let done=false;job.then(()=>done=true);for(let i=0;i<1500&&!done;i++){engine.tick(.05);await Promise.resolve();}assert(done,'handoff completes');await job;}
await finish(engine.assign('developer'));
assert.equal(engine.actors.developer.phase,'working');assert.equal(engine.actors.developer.node,engine.actors.developer.desk);
assert.equal(engine.actors.general.node,engine.actors.general.desk);assert.deepEqual(engine.snapshot().general.point,start.general.point);
const taskStart=engine.snapshot().developer.point;for(let i=0;i<100;i++)engine.tick(.05);assert.deepEqual(engine.snapshot().developer.point,taskStart,'worker stays at desk during AI');
await finish(engine.report('developer'));assert.equal(engine.actors.developer.node,engine.actors.general.desk);
engine.reset();for(let i=0;i<40;i++)engine.tick(.05);assert.notDeepEqual(engine.snapshot().developer.point,taskStart);
await finish(engine.assign('extra'));assert.equal(engine.actors.extra.phase,'working');
engine.reset();engine.setEnabled(false);await engine.assign('developer');await engine.report('developer');assert.equal(engine.actors.developer.node,engine.actors.general.desk);
engine.reset();await engine.assign('general');assert.equal(engine.actors.general.phase,'working');engine.reset();const stopped=engine.snapshot();for(let i=0;i<100;i++)engine.tick(.05);assert.deepEqual(engine.snapshot(),stopped);
engine.setEnabled(true);const pending=engine.assign('developer');engine.setEnabled(false);await pending;assert.equal(engine.actors.developer.phase,'working');engine.reset();
assert.equal(engine.snapshot().general.walkingFrame,null);
console.log('Passed: idle roaming, Amii assignment, desk work, report to Amii, custom rooms, movement toggle and toggle during handoff.');
const large=new OfficeEngine();large.sync(['general',...Array.from({length:17},(_,i)=>'worker-'+i)]);
assert.equal(new Set(Object.values(large.actors).map(a=>a.desk)).size,18,'every employee has a unique desk in one office');
const managerPoint=large.snapshot().general.point;
async function finishLarge(job){let done=false;job.then(()=>done=true);for(let i=0;i<2500&&!done;i++){large.tick(.05);await Promise.resolve();}assert(done);await job;}
await finishLarge(large.assign('worker-16'));assert.equal(large.actors['worker-16'].node,large.actors['worker-16'].desk);await finishLarge(large.report('worker-16'));assert.equal(large.actors['worker-16'].node,large.actors.general.desk);assert.deepEqual(large.snapshot().general.point,managerPoint);
console.log('Passed: 18 employees in one expanding office, unique desks, connected handoff paths and stationary Amii.');

const boardOffice=new OfficeEngine();boardOffice.sync(['general','social','designer','web']);
const visited=new Set();const posting=boardOffice.postPlan([{employee_id:'social',brief:'Research'},{employee_id:'designer',brief:'Design'},{employee_id:'web',brief:'Code'}]);
async function finishBoard(job){let done=false;job.then(()=>done=true);for(let i=0;i<2500&&!done;i++){boardOffice.tick(.05);const state=boardOffice.snapshot();if(state.general.phase==='assigning')visited.add('amii');for(const id of ['social','designer','web'])if(state[id].phase==='receiving')visited.add(id);await Promise.resolve();}assert(done);await job;}
await finishBoard(posting);assert.equal(boardOffice.actors.general.node,boardOffice.actors.general.desk);assert(!visited.has('designer'),'designer does not collect before research');
await finishBoard(boardOffice.assign('social'));assert(visited.has('social'));assert.equal(boardOffice.actors.social.phase,'working');
await finishBoard(boardOffice.publishResult('social'));assert.equal(boardOffice.board[0].status,'done');assert.equal(boardOffice.actors.social.node,boardOffice.actors.social.desk);
await finishBoard(Promise.all(['designer','web'].map(id=>boardOffice.assign(id))));assert(visited.has('designer')&&visited.has('web'));for(const id of ['designer','web'])assert.equal(boardOffice.actors[id].phase,'working');
boardOffice.ready('designer');boardOffice.ready('web');assert.equal(boardOffice.actors.designer.node,boardOffice.actors.designer.desk,'finished designer waits at desk');
await finishBoard(boardOffice.reportTogether(['designer','web']));for(const id of ['designer','web'])assert.equal(boardOffice.actors[id].node,boardOffice.actors.general.desk);assert.notEqual(boardOffice.actors.designer.point.x,boardOffice.actors.web.point.x);
await boardOffice.postPlan([]);
await finishBoard(boardOffice.postPlan([{employee_id:'social',brief:'Research'},{employee_id:'designer',brief:'Design'},{employee_id:'web',brief:'Code'}]));
boardOffice.setEnabled(false);await boardOffice.assign('social');assert.equal(boardOffice.board[0].status,'working');await boardOffice.report('social');assert.equal(boardOffice.board[0].status,'done');boardOffice.fail();assert.deepEqual(boardOffice.board.map(t=>t.status),['done','failed','failed']);
console.log('Passed: Amii board posting, all team members collect work, queued desks, board progress and failure state.');


const operations=new OfficeEngine();operations.sync(['general','email','finance','files']);
async function drain(job){let done=false;job.finally(()=>done=true).catch(()=>{});for(let i=0;i<2500&&!done;i++){operations.tick(.05);await Promise.resolve();}assert(done,'desk operation resolves');return job;}
let finishWork;let invoked=false;
const sorting=operations.deskWork(['email','finance'],'Sorting',async()=>{
 invoked=true;for(const id of ['email','finance']){assert.equal(operations.actors[id].node,operations.actors[id].desk);assert.equal(operations.actors[id].phase,'working');}
 await new Promise(resolve=>finishWork=resolve);
});
assert.equal(invoked,false,'native work does not start before arrival');
for(let i=0;i<1500&&!invoked;i++){operations.tick(.05);await Promise.resolve();}
assert(invoked);const seated=operations.snapshot();operations.reset();for(let i=0;i<50;i++)operations.tick(.05);
for(const id of ['email','finance'])assert.deepEqual(operations.snapshot()[id].point,seated[id].point,'reset cannot release a running native operation');
let secondStarted=false;const second=operations.deskWork(['email'],'Next',async()=>{secondStarted=true;});await Promise.resolve();assert(!secondStarted,'same worker is reserved');
finishWork();await drain(sorting);await drain(second);assert.equal(operations.actors.email.phase,'idle');assert.equal(operations.actors.finance.phase,'idle');
await assert.rejects(drain(operations.deskWork(['files'],'Move',async()=>{throw new Error('failure fixture')})),/failure fixture/);assert.equal(operations.actors.files.phase,'idle','failure releases worker');
operations.setEnabled(false);let chatDone,chatStarted=false;
const chat=operations.chatWork(async()=>{chatStarted=true;await operations.postPlan([{employee_id:'email',brief:'Mail'}]);await operations.assign('email');await new Promise(resolve=>chatDone=resolve)});
for(let i=0;i<30&&!chatDone;i++)await Promise.resolve();assert(chatStarted&&chatDone);
let backgroundStarted=false;const background=operations.deskWork(['email'],'Scheduled',async()=>{backgroundStarted=true});await Promise.resolve();assert(!backgroundStarted);
chatDone();await drain(chat);await drain(background);assert(!operations.chatBusy);
assert.equal(operations.actors.email.phase,'idle');
console.log('Passed: real work starts at desks, workers stay seated, same-worker queue, reset protection, failure release and chat/background lock ordering.');
