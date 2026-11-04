import {test} from 'node:test';import assert from 'node:assert/strict';import {transition,staleHeartbeat,singleFlight} from './monitor.mjs';
test('alert after consecutive failures, suppress repeat, recover once',()=>{
 let s=transition({state:'healthy',failures:0},true);assert.equal(s.event,null);
 s=transition(s,true);assert.equal(s.event,'alert');
 s=transition(s,true);assert.equal(s.event,null);
 s=transition(s,false);assert.equal(s.event,'recovered');
 assert.equal(transition(s,false).event,null);
});
test('missing, malformed, future and stale heartbeat cannot look healthy',()=>{
 for(const record of [{},{timestamp:'bad',event:'collector_heartbeat'},{timestamp:new Date(100000).toISOString(),event:'collector_heartbeat'},{timestamp:new Date(0).toISOString(),event:'collector_heartbeat'}])assert.equal(staleHeartbeat(record,50000),true);
 assert.equal(staleHeartbeat({timestamp:new Date(49000).toISOString(),event:'collector_heartbeat'},50000),false);
});
test('slow checks cannot overlap and failures release the next check',async()=>{
 let release,calls=0;
 const tick=singleFlight(async()=>{calls++;await new Promise(r=>{release=r;});});
 const first=tick();assert.equal(await tick(),false);assert.equal(calls,1);release();assert.equal(await first,true);
 let fail=true;const recover=singleFlight(async()=>{if(fail)throw new Error('test');});
 await assert.rejects(recover());fail=false;assert.equal(await recover(),true);
});
