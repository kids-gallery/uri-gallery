// Host-only Docker reader. The Alloy container never receives the Docker socket.
import {execFileSync} from 'node:child_process';
import {mkdirSync,readFileSync,existsSync,appendFileSync,statSync,renameSync,writeFileSync,rmSync} from 'node:fs';
import path from 'node:path';
import {normalize} from './normalize.mjs';
const [project,out]=process.argv.slice(2);
if(!/^uri-gallery-ops-[a-z0-9-]+$/.test(project??'')||!out) throw new Error('Explicit isolated project and output directory required');
mkdirSync(out,{recursive:true,mode:0o700});
const statePath=path.join(out,'cursor.json');
let cursor=existsSync(statePath)?JSON.parse(readFileSync(statePath,'utf8')):{};
const allowed=new Set(['app-api','model-api','worker-cpu','sweeper']);
const docker=args=>execFileSync('docker',args,{encoding:'utf8',maxBuffer:8*1024*1024,stdio:['ignore','pipe','pipe']});
function write(service,record){
 const file=path.join(out,`${service}.jsonl`);
 if(existsSync(file)&&statSync(file).size>5*1024*1024){
  const old=file.replace('.jsonl','-2.jsonl'),prev=file.replace('.jsonl','-1.jsonl');
  if(existsSync(old))rmSync(old);if(existsSync(prev))renameSync(prev,old);renameSync(file,prev);
 }
 appendFileSync(file,JSON.stringify(record)+'\n',{mode:0o600});
}
function poll(){
 let healthy=true,seen=0;
 try{
  const names=docker(['ps','--filter',`label=com.docker.compose.project=${project}`,'--format','{{.Names}}']).trim().split('\n').filter(Boolean);
  for(const name of names){
   const service=docker(['inspect','--format','{{index .Config.Labels "com.docker.compose.service"}}',name]).trim();
   if(!allowed.has(service))continue;
   seen++;
   const since=cursor[name]??new Date(Date.now()-60000).toISOString();
   // stdout only: unstructured third-party stderr is deliberately excluded.
   const lines=docker(['logs','--timestamps','--since',since,name]).split('\n');
   for(const line of lines){
    const at=line.indexOf(' ');if(at<0)continue;
    const timestamp=line.slice(0,at);if(cursor[name]&&timestamp<=cursor[name])continue;
    try{const record=normalize(JSON.parse(line.slice(at+1)),{service,environment:'test'});if(record)write(service,record);}catch{/* malformed text is never copied */}
    cursor[name]=timestamp;
   }
  }
 }catch{healthy=false;}
 const timestamp=new Date().toISOString();
 if(healthy&&seen===allowed.size)write('collector',{timestamp,level:'info',service:'collector',environment:'test',event:'collector_heartbeat'});
 writeFileSync(statePath+'.tmp',JSON.stringify(cursor),{mode:0o600});renameSync(statePath+'.tmp',statePath);
}
poll();setInterval(poll,5000);
