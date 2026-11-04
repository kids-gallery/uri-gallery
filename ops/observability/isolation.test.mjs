import {test} from 'node:test';
import assert from 'node:assert/strict';
import {checkIsolation} from './isolation.mjs';
const base=name=>({name,volumes:{db:{}},networks:{internal:{}},secrets:{password:{file:`/${name}/password`}},services:{web:{ports:[{host_ip:'127.0.0.1',published:'9501'}]}}});
test('project-scoped resources may use identical logical keys',()=>assert.deepEqual(checkIsolation(base('test'),base('prod')),[]));
test('explicit names, secrets and writable binds cannot alias production',()=>{
 const a=base('test'),b=base('prod');a.volumes.db.name=b.volumes.db.name='shared';a.secrets.password.file=b.secrets.password.file;
 a.services.web.volumes=b.services.web.volumes=[{type:'bind',source:'/data/artworks'}];
 assert.equal(checkIsolation(a,b).length,3);
});
test('all-interface port and identical project are rejected',()=>{
 const a=base('prod'); a.services.web.ports[0].host_ip='0.0.0.0';
 assert.ok(checkIsolation(a,base('prod')).length>=2);
});
