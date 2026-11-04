import {writeFileSync,mkdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const base='http://localhost:13101';const marker=String(Date.now());const now=BigInt(Date.now())*1000000n;
const old=now-25n*3600n*1000000000n;
for(let i=0;i<45;i++){try{if((await fetch(base+'/ready')).ok)break;}catch{}await new Promise(r=>setTimeout(r,1000));}
async function push(at,age){const r=await fetch(base+'/loki/api/v1/push',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({streams:[{stream:{service:'retention-probe',probe:marker,age},values:[[String(at),JSON.stringify({event:'retention_probe',age})]]}]})});if(!r.ok)throw new Error('retention fixture rejected '+r.status);}
async function query(age){const center=age==='old'?old:now;const q=new URLSearchParams({query:`{service="retention-probe",probe="${marker}",age="${age}"}`,start:String(center-1000000000n),end:String(center+1000000000n)});const r=await fetch(base+'/loki/api/v1/query_range?'+q,{signal:AbortSignal.timeout(10000)});if(!r.ok)return -1;return (await r.json()).data.result.reduce((n,s)=>n+s.values.length,0);}
await push(old,'old');await push(now,'recent');
for(let i=0;i<15;i++){if(await query('old')===1&&await query('recent')===1)break;await new Promise(r=>setTimeout(r,1000));}
if(await query('old')!==1||await query('recent')!==1)throw new Error('probe missing before retention');
await fetch(base+'/flush',{method:'POST'});
const start=Date.now();let removed=false;
while(Date.now()-start<180000){if(await query('old')===0){removed=true;break;}await new Promise(r=>setTimeout(r,1000));}
let cacheRestart=false;
if(!removed){
 // A compacted index can remain in the querier cache. Only this synthetic test is restarted.
 execFileSync('docker',['restart','uri-gallery-ops-retention1104-loki-1'],{stdio:'pipe'});cacheRestart=true;
 for(let i=0;i<60;i++){try{if((await fetch(base+'/ready')).ok&&await query('old')===0){removed=true;break;}}catch{}await new Promise(r=>setTimeout(r,1000));}
}
if(!removed)throw new Error('retention not observed after 180 seconds and cache restart');
if(await query('recent')!==1)throw new Error('recent probe was removed');
const report={retentionHours:24,oldAgeHours:25,oldBefore:1,oldAfter:0,recentAfter:1,seconds:(Date.now()-start)/1000,cacheRestart,scope:'separate synthetic Loki; main draft retention stays 168h; cache propagation without restart not established'};
mkdirSync(new URL('validation-runtime/',import.meta.url),{recursive:true});writeFileSync(new URL('validation-runtime/retention-report.json',import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
