import {createServer} from 'node:http';import {spawn,execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';import {fileURLToPath} from 'node:url';
const root=new URL('.',import.meta.url);mkdirSync(new URL('validation-runtime/',root),{recursive:true});
const heartbeat=fileURLToPath(new URL('validation-runtime/monitor-heartbeat.jsonl',root));const output=fileURLToPath(new URL('validation-runtime/monitor-events.jsonl',root));writeFileSync(output,'');
const received=[];const server=createServer(async(req,res)=>{let body='';for await(const b of req)body+=b;received.push(JSON.parse(body));res.writeHead(204);res.end();});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const beat=()=>writeFileSync(heartbeat,JSON.stringify({timestamp:new Date().toISOString(),event:'collector_heartbeat'})+'\n');beat();const timer=setInterval(beat,5000);
const monitor=spawn(process.execPath,[fileURLToPath(new URL('monitor.mjs',root)),heartbeat,output,'uri-gallery-ops-app1104'],{env:{...process.env,OPS_ALERT_WEBHOOK:`http://127.0.0.1:${server.address().port}`},stdio:'ignore'});
const command=(action,service)=>execFileSync('docker',[action,`uri-gallery-ops-app1104-${service}-1`],{stdio:['ignore','pipe','pipe']});
async function wait(check,event){for(let i=0;i<70;i++){if(received.some(v=>v.check===check&&v.event===event))return;await new Promise(r=>setTimeout(r,1000));}throw new Error(`No ${check} ${event}`);}
try{
 command('stop','worker-cpu');await wait('worker','alert');command('start','worker-cpu');await wait('worker','recovered');
 command('stop','db');await wait('db','alert');command('start','db');await wait('db','recovered');
 clearInterval(timer);writeFileSync(heartbeat,JSON.stringify({timestamp:'invalid',event:'collector_heartbeat'}));await wait('collection_heartbeat','alert');beat();await wait('collection_heartbeat','recovered');
 const report={receiver:'local loopback test webhook',received,actualChannel:'pending user details'};writeFileSync(new URL('validation-runtime/monitor-report.json',root),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{monitor.kill();clearInterval(timer);server.close();for(const service of ['db','worker-cpu'])try{command('start',service);}catch{}}
