import {readFileSync,appendFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {normalize} from './normalize.mjs';
import {fileURLToPath} from 'node:url';
const root=new URL('.',import.meta.url);
const password=readFileSync(new URL('private/grafana_password',root),'utf8').trim();
const authorization='Basic '+Buffer.from('admin:'+password).toString('base64');
const base='http://localhost:13001';
const compose=['compose','-f',fileURLToPath(new URL('compose.yaml',root))];
const cmd=(...args)=>execFileSync('docker',[...compose,...args],{stdio:['ignore','pipe','pipe']});
const report={checks:[],injectionTimes:[],started:new Date().toISOString()};
const assert=(name,ok)=>{if(!ok)throw new Error(name);report.checks.push({check:name,result:'pass'});};
async function query(marker){
 const end=BigInt(Date.now())*1000000n,start=end-600000000000n;
 const q=new URLSearchParams({query:`{environment="test"} | json | event="validation_probe" | durationMs=${marker}`,start:String(start),end:String(end),limit:'1000'});
 const r=await fetch(base+'/api/datasources/proxy/uid/loki/loki/api/v1/query_range?'+q,{headers:{authorization}});
 if(!r.ok)return [];
 return (await r.json()).data.result.flatMap(s=>s.values.map(v=>JSON.parse(v[1])));
}
function inject(marker){
 const timestamp=Date.now();
 for(const service of ['app-api','model-api','worker-cpu','sweeper'])for(const level of [30,40,50]){
  const v=normalize({level,time:timestamp,durationMs:marker,status:level===30?503:200,msg:'synthetic@example.test bearer-secret'}, {service,environment:'test'});
  appendFileSync(new URL('collected/probe.jsonl',root),JSON.stringify({...v,event:'validation_probe'})+'\n');
 }
 return timestamp;
}
async function wait(marker,started){
 for(let i=0;i<60;i++){
  let values=await query(marker);
  if(values.length>=12){assert(`probe ${marker}: exactly 12 events (no duplicate)`,values.length===12);assert(`probe ${marker}: 4 info 5xx events`,values.filter(v=>v.httpStatus===503&&v.level==='info').length===4);assert(`probe ${marker}: no synthetic secret`,!JSON.stringify(values).includes('bearer-secret'));report.injectionTimes.push({marker,seconds:(Date.now()-started)/1000});return;}
  await new Promise(r=>setTimeout(r,1000));
 }
 throw new Error('Loki ingestion exceeded 60 seconds');
}
const anon=await fetch(base+'/api/datasources');assert('anonymous Grafana API denied',anon.status===401);
const marker=Date.now();
await wait(marker,inject(marker));
cmd('restart','alloy');await new Promise(r=>setTimeout(r,5000));
assert('Alloy restart retains position without duplicate probe', (await query(marker)).length===12);
cmd('stop','loki');const at=inject(marker+1);await new Promise(r=>setTimeout(r,5000));cmd('start','loki');await wait(marker+1,at);
const dashboard=await (await fetch(base+'/api/dashboards/uid/operations-logs',{headers:{authorization}})).json();
assert('dashboard has filters and 4 panels',dashboard.dashboard.panels.length===4&&dashboard.dashboard.templating.list.length===2);
const log=execFileSync('docker',['inspect','--format','{{json .HostConfig.LogConfig}}','uri-gallery-ops-observe1104-loki-1'],{encoding:'utf8'});assert('Docker log rotation applied',JSON.parse(log).Config['max-size']==='10m');
mkdirSync(new URL('validation-runtime/',root),{recursive:true});writeFileSync(new URL('validation-runtime/dashboard-report.json',root),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
