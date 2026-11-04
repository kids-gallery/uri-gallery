// Compare resolved `docker compose config --format json` documents. No secret values in findings.
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
export function checkIsolation(test, production) {
  const errors=[];
  if (!test.name || !production.name || test.name===production.name) errors.push('Distinct project names required');
  for(const kind of ['volumes','networks']) {
    const names=new Set(Object.entries(production[kind]??{}).map(([key,v])=>v.name??`${production.name}_${key}`));
    for(const [key,v] of Object.entries(test[kind]??{})) if(names.has(v.name??`${test.name}_${key}`)) errors.push(`Shared ${kind} resource: ${key}`);
  }
  const prodSecrets=new Set(Object.values(production.secrets??{}).map(v=>v.file).filter(Boolean));
  for(const [key,v] of Object.entries(test.secrets??{})) if(v.file && prodSecrets.has(v.file)) errors.push(`Shared secret file: ${key}`);
  // Bind mounts can share application data even when named volumes differ.
  const binds=new Set(Object.values(production.services??{}).flatMap(s=>(s.volumes??[]).filter(v=>v.type==='bind'&&!v.read_only).map(v=>v.source)));
  for(const [name,s] of Object.entries(test.services??{})) {
    for(const v of s.volumes??[]) if(v.type==='bind'&&binds.has(v.source)) errors.push(`Shared writable production bind: ${name}`);
    for(const p of s.ports??[]) if(p.host_ip!=='127.0.0.1'&&p.host_ip!=='::1') errors.push(`Test port must bind loopback: ${name}`);
  }
  return errors;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const errors=checkIsolation(...process.argv.slice(2,4).map(p=>JSON.parse(readFileSync(p,'utf8'))));
  for(const error of errors) console.error(error);
  process.exitCode=errors.length?1:0;
}
