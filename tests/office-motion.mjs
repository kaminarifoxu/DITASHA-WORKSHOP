import assert from 'node:assert/strict';
import {OfficeEngine} from '../frontend/test-build/office-engine.mjs';
const engine=new OfficeEngine();engine.sync(['general','writer','developer','planner','extra']);
const start=engine.snapshot();
const frames=new Set();for(let i=0;i<60;i++){engine.tick(.05);frames.add(engine.snapshot().writer.walkingFrame);}assert(frames.has(0)&&frames.has(1)&&frames.has(2),'three stable stepping poses while travelling');for(let i=0;i<40;i++)engine.tick(.05);
assert.deepEqual(engine.snapshot().general.point,start.general.point,'Amii stays at his desk');assert.notDeepEqual(engine.snapshot().writer.point,start.writer.point,'employees walk');
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
