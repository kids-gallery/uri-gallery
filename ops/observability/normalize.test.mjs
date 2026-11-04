import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalize} from './normalize.mjs';
const source={service:'app-api',environment:'test'};
test('Node and Python levels share one schema',()=>{
  for(const [raw,want] of [[30,'info'],[40,'warn'],[50,'error'],['WARNING','warn'],['error','error'],['custom','unknown']]) assert.equal(normalize({level:raw},source).level,want);
  assert.equal(normalize({level:20},source),null);
});
test('free text and nested values never reach collection output',()=>{
  const secret='child@example.test bearer-secret /family/photo.jpg 아이별칭';
  const out=normalize({level:'error',event:secret,msg:secret,requestId:secret,error:{stack:secret},status:secret,durationMs:secret},source,0);
  assert.equal(JSON.stringify(out).includes(secret),false);
  assert.deepEqual(Object.keys(out),['timestamp','level','service','environment','event']);
});
test('HTTP failures stay separate from severity; duration and timestamps normalize',()=>{
  const out=normalize({level:30,status:503,duration_ms:12,ts:'2026-11-04T00:00:00Z'},source);
  assert.equal(out.level,'info'); assert.equal(out.httpStatus,503); assert.equal(out.durationMs,12);
  assert.equal(out.timestamp,'2026-11-04T00:00:00.000Z');
  assert.throws(()=>normalize({}, {...source,service:'mailpit'}));
});
