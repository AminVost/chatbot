import test from 'node:test';
import assert from 'node:assert/strict';
import {openZai} from '../lib/zai-retry.js';
const primary='zai/glm-4.7-flash',fallback='zai/glm-4.5-flash',vision='zai/glm-4.6v-flash';
const ok=()=>new Response('data: [DONE]\n\n',{status:200});
const err=(code,status=429,headers={})=>Response.json({error:{code}},{status,headers});
function harness(sequence,model=primary,extra={}){
 const called=[],reserved=[],records=[],waits=[];
 const run=()=>openZai({model,fetchAttempt:async m=>{called.push(m);const value=sequence.shift();if(value instanceof Error)throw value;return value},reserveAttempt:async m=>{reserved.push(m);return '2026-11-27'},recordAttempt:async(m,d,s)=>records.push({m,d,s}),sleep:async ms=>waits.push(ms),...extra});
 return {run,called,reserved,records,waits};
}
test('normal Z.ai response has one attempt',async()=>{const h=harness([ok()]);const r=await h.run();assert.equal(r.model,primary);assert.equal(r.attempts,1);assert.deepEqual(h.called,[primary]);assert.equal(h.records.length,0)});
test('overload recovers on same model',async()=>{const h=harness([err(1305),ok()]);const r=await h.run();assert.equal(r.model,primary);assert.equal(r.attempts,2);assert.deepEqual(h.waits,[800]);assert.equal(h.records.length,1)});
test('two retries then one free fallback, accounting each attempt',async()=>{const h=harness([err(1305),err(1305),err(1305),ok()]);const r=await h.run();assert.equal(r.model,fallback);assert.equal(r.attempts,4);assert.deepEqual(h.called,[primary,primary,primary,fallback]);assert.deepEqual(h.reserved,h.called);assert.equal(h.records.length,3);assert(h.records.every(r=>!r.s.success));assert.deepEqual(h.waits,[800,1600,2400])});
test('fallback failure stops after four attempts',async()=>{const h=harness(Array.from({length:4},()=>err(1305)));const r=await h.run();assert.equal(r.response.status,429);assert.equal(r.code,1305);assert.equal(h.records.length,4)});
test('vision and GLM 4.5 never change model',async()=>{for(const m of [vision,fallback]){const h=harness([err(1305),err(1305),err(1305)],m);await h.run();assert.deepEqual(h.called,[m,m,m])}});
test('billing, quota, generic 429 and auth do not retry',async()=>{for(const [code,status] of [[1113,429],[1302,429],[1308,429],[1313,429],[undefined,429],[1305,401]]){const h=harness([err(code,status)]);await h.run();assert.equal(h.called.length,1);assert.equal(h.waits.length,0)}});
test('honor short Retry-After and stop for long Retry-After',async()=>{const h=harness([err(1305,429,{'retry-after':'3'}),ok()]);await h.run();assert.deepEqual(h.waits,[3000]);const long=harness([err(1305,429,{'retry-after':'20'})]);await long.run();assert.equal(long.called.length,1)});
test('local quota rejection prevents extra provider request',async()=>{let reservations=0;const h=harness([err(1305)],primary,{reserveAttempt:async()=>{if(++reservations>1)throw Object.assign(Error('quota'),{status:429});return 'day'}});await assert.rejects(h.run(),/quota/);assert.equal(h.called.length,1)});
test('network error stops and records failed attempt',async()=>{const h=harness([Error('network')]);await assert.rejects(h.run(),/network/);assert.equal(h.records.length,1);assert.equal(h.called.length,1)});
test('cancellation prevents subsequent attempt',async()=>{const c=new AbortController();const h=harness([err(1305)],primary,{signal:c.signal,sleep:async()=>c.abort()});await assert.rejects(h.run(),{name:'AbortError'});assert.equal(h.called.length,1)});
test('paid models cannot be attempted',async()=>{const h=harness([], 'zai/glm-5.3');await assert.rejects(h.run(),/not enabled/);assert.equal(h.called.length,0)});
