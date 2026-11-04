import {execFileSync} from 'node:child_process';import {writeFileSync,mkdirSync} from 'node:fs';
const project=process.argv[2];if(!/^uri-gallery-ops-[a-z0-9-]+$/.test(project??''))throw new Error('Explicit isolated project required');
const docker=args=>execFileSync('docker',args,{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
const names=docker(['ps','--filter',`label=com.docker.compose.project=${project}`,'--format','{{.Names}}']).split('\n').filter(Boolean);
const samples=[];const started=Date.now();
for(let i=0;i<10;i++){
 const raw=docker(['stats','--no-stream','--format','{{json .}}',...names]);
 samples.push({at:new Date().toISOString(),containers:raw.split('\n').map(s=>{const v=JSON.parse(s);return {name:v.Name,cpu:v.CPUPerc,memory:v.MemUsage,blockIO:v.BlockIO};})});
 await new Promise(r=>setTimeout(r,1000));
}
const versions=names.map(name=>({name,imageId:docker(['inspect','--format','{{.Image}}',name])}));
const report={project,seconds:(Date.now()-started)/1000,samples,versions,limits:'10 idle samples; not a 24-hour log rate, model performance result or hosting quote'};
mkdirSync(new URL('validation-runtime/',import.meta.url),{recursive:true});writeFileSync(new URL('validation-runtime/resource-report.json',import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify({samples:samples.length,seconds:report.seconds,containers:names.length}));
