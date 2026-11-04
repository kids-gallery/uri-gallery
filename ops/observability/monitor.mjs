import {readFileSync,appendFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
export function transition(previous, failures, threshold=2){
 const count=failures?previous.failures+1:0;
 const state=count>=threshold?'firing':count===0?'healthy':previous.state;
 return {state,failures:count,event:state!==previous.state?(state==='firing'?'alert':'recovered'):null};
}
export function singleFlight(work) {
 let running=false;
 return async()=>{if(running)return false;running=true;try{await work();return true;}finally{running=false;}};
}
export function staleHeartbeat(record, now=Date.now()) {
 const time=Date.parse(record?.timestamp);
 return record?.event!=='collector_heartbeat'||!Number.isFinite(time)||time>now+5000||now-time>30000;
}
export function stackChecks(project, threshold=60) {
 if(!/^uri-gallery-ops-[a-z0-9-]+$/.test(project))throw new Error('Only isolated project probes supported');
 const checks={db:true,worker:true,queue:true};
 const docker=args=>execFileSync('docker',args,{encoding:'utf8',timeout:5000,stdio:['ignore','pipe','pipe']}).trim();
 for(const [check,service] of [['db','db'],['worker','worker-cpu']])try{
  const state=JSON.parse(docker(['inspect','--format','{{json .State}}',`${project}-${service}-1`]));checks[check]=!state.Running||state.Health?.Status!=='healthy';
 }catch{}
 try{
  const metrics=docker(['exec',`${project}-app-api-1`,'node','-e',"fetch('http://127.0.0.1:9521/metrics',{signal:AbortSignal.timeout(3000)}).then(async r=>{if(!r.ok)process.exit(1);process.stdout.write(await r.text())}).catch(()=>process.exit(1))"]);
  const values=[...metrics.matchAll(/^uam_queue_oldest_wait_seconds\{[^}]*\} (\S+)/gm)].map(m=>Number(m[1]));
  checks.queue=!values.length||values.some(v=>!Number.isFinite(v)||v>threshold);
 }catch{}
 return checks;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const [heartbeat,output,project]=process.argv.slice(2);const states=new Map();
 async function poll(){
  let bad=true;
  try{const lines=readFileSync(heartbeat,'utf8').trim().split('\n');bad=staleHeartbeat(JSON.parse(lines.at(-1)));}catch{}
  const checks={collection_heartbeat:bad,...(project?stackChecks(project,Number(process.env.OPS_QUEUE_THRESHOLD_SECONDS??60)):{})};
  for(const [check,failed] of Object.entries(checks)) {
  const state=transition(states.get(check)??{state:'healthy',failures:0},failed);states.set(check,state);
  if(state.event){const event={timestamp:new Date().toISOString(),event:state.event,check};appendFileSync(output,JSON.stringify(event)+'\n');
   if(process.env.OPS_ALERT_WEBHOOK){try{const r=await fetch(process.env.OPS_ALERT_WEBHOOK,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(event),signal:AbortSignal.timeout(5000)});if(!r.ok)throw new Error();}catch{appendFileSync(output,JSON.stringify({timestamp:event.timestamp,event:'delivery_failed'})+'\n');}}
  }
  }
 }
 const tick=singleFlight(poll);
 const safeTick=()=>tick().catch(()=>{appendFileSync(output,JSON.stringify({timestamp:new Date().toISOString(),event:'monitor_failed'})+'\n');});
 await safeTick();setInterval(safeTick,10000);
}
