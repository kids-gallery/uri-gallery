"""Verify a surviving synthetic original after the isolated restore, using a fresh login."""
import hashlib,json,subprocess,sys
from pathlib import Path
from snapshot import db
project=sys.argv[1] if len(sys.argv)>1 else 'uri-gallery-ops-restore1104b'
if not project.startswith('uri-gallery-ops-restore'):raise ValueError('Only restored test project permitted')
runtime=Path(__file__).resolve().parent/'validation-runtime'
id,email=db(project,'SELECT a.artwork_id,g.email FROM artwork a JOIN guardian_account g ON a.family_id=g.family_id ORDER BY a.artwork_id LIMIT 1;').decode().strip().split('\t')
expected=json.loads((runtime/'session.json').read_text())['checksum']
script='const input='+json.dumps({'id':id,'email':email,'expected':expected})+';\n'+'''
const {createHash}=await import('node:crypto');
const base='http://127.0.0.1:9521';
const login=await fetch(base+'/v1/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:input.email,password:'synthetic-Password-2026'})});
if(login.status!==204)throw new Error('fresh restored login failed');
const cookie=login.headers.getSetCookie().map(v=>v.split(';')[0]).join('; ');
const detail=await (await fetch(base+'/v1/artworks/'+input.id,{headers:{cookie}})).json();
const response=await fetch(base+(detail.originalUrl??detail.photoUrl),{headers:{cookie}});
if(response.status!==200)throw new Error('restored original unavailable');
if(createHash('sha256').update(Buffer.from(await response.arrayBuffer())).digest('hex')!==input.expected)throw new Error('restored original checksum mismatch');
console.log(JSON.stringify({freshLogin:204,original:200,originalChecksumMatchesSnapshotFixture:true}));
'''
r=subprocess.run(['docker','exec','-i',project+'-app-api-1','node','--input-type=module'],input=script.encode(),stdout=subprocess.PIPE,stderr=subprocess.PIPE,check=True)
report=json.loads(r.stdout);(runtime/'restore-original-report.json').write_text(json.dumps(report,indent=2));print(json.dumps(report))
