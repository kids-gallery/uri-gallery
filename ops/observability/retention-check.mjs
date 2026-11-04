import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const base='http://localhost:13102', container='uri-gallery-ops-retentionfix1104-loki-1';
const marker=String(Date.now()),now=BigInt(Date.now())*1000000n,old=now-25n*3600n*1000000000n;
const runtime=new URL('retention-runtime/overrides.yaml',import.meta.url);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const request=(url,options={})=>fetch(base+url,{...options,signal:AbortSignal.timeout(10000)});
async function until(name,predicate,ms=60000){const end=Date.now()+ms;while(Date.now()<end){if(await predicate())return;await sleep(1000);}throw new Error(name+' timed out');}
function policy(hours){writeFileSync(runtime,`overrides:\n  fake:\n    max_query_lookback: ${hours}h\n`);}
async function activeHash(){const r=await request('/metrics');if(!r.ok)return '';const text=await r.text();if(!/loki_runtime_config_last_reload_successful\{[^}]*\} 1/.test(text))return '';return text.match(/loki_runtime_config_hash\{[^}]*sha256="([a-f0-9]+)"/)?.[1]??'';}
async function changePolicy(hours){const before=await activeHash();policy(hours);await until('query policy reload',async()=>{const hash=await activeHash();return hash!==''&&hash!==before;});}
async function push(at,age){const r=await request('/loki/api/v1/push',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({streams:[{stream:{service:'retention-probe',probe:marker,age},values:[[String(at),JSON.stringify({event:'retention_probe',age})]]}]})});if(!r.ok)throw new Error('fixture rejected '+r.status);}
async function query(age){const center=age==='old'?old:now;const q=new URLSearchParams({query:`{service="retention-probe",probe="${marker}",age="${age}"}`,start:String(center-1000000000n),end:String(center+1000000000n)});const r=await request('/loki/api/v1/query_range?'+q);if(!r.ok)throw new Error('query failed '+r.status);return (await r.json()).data.result.reduce((n,s)=>n+s.values.length,0);}
function chunks(at){
 const ms=Number(at/1000000n);
 return execFileSync('docker',['exec',container,'find','/loki/chunks/fake','-type','f'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim().split('\n').filter(p=>{
  const [from,to]=Buffer.from(p.split('/').at(-1),'base64').toString('utf8').split(':').map(s=>Number.parseInt(s,16));
  return from===ms&&to===ms;
 });
}
const report={marker,status:'running',retentionHours:24,oldAgeHours:25,restarted:false,indexRotationMinutes:15,deletionTimeoutSeconds:1200,scope:'query cutoff and object-store chunks; not every WAL/index/filesystem copy'};
mkdirSync(new URL('validation-runtime/',import.meta.url),{recursive:true});
const reportPath=new URL('validation-runtime/retention-report.json',import.meta.url);
try{
 await until('Loki ready',async()=>{try{return(await request('/ready')).ok;}catch{return false;}});
 policy(24);await sleep(2000);await changePolicy(48);
 await push(old,'old');await push(now,'recent');
 await until('baseline old/recent query',async()=>await query('old')===1&&await query('recent')===1);
 report.oldBefore=1;report.recentBefore=1;
 await request('/flush',{method:'POST'});
 await until('baseline persisted chunks',async()=>chunks(old).length>0&&chunks(now).length>0);
 report.oldChunksBefore=chunks(old).length;report.recentChunksBefore=chunks(now).length;
 const start=Date.now();await changePolicy(24);
 await until('expired query denied',async()=>await query('old')===0);
 report.queryCutoffSeconds=(Date.now()-start)/1000;
 // Loki v3.4.2 rotates TSDB heads every 15 minutes and checks rotation every minute.
 await until('expired chunk deleted',async()=>chunks(old).length===0,1200000);
 report.deletionSeconds=(Date.now()-start)/1000;
 report.oldAfter=await query('old');report.recentAfter=await query('recent');
 report.oldChunksAfter=chunks(old).length;report.recentChunksAfter=chunks(now).length;
 if(report.oldAfter!==0||report.recentAfter!==1||report.recentChunksAfter<1)throw new Error('recent data lost or expired data returned');
 report.status='passed';
}catch(e){report.status='failed';report.error=e.message;process.exitCode=1;}
finally{policy(24);writeFileSync(reportPath,JSON.stringify(report,null,2));}
console.log(JSON.stringify(report));
