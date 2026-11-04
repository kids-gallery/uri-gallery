import {test} from 'node:test';import assert from 'node:assert/strict';import {transition,staleHeartbeat} from './monitor.mjs';
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
