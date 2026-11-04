import hashlib,json,subprocess,sys,time,urllib.request
from pathlib import Path
from snapshot import db,compose
root=Path(__file__).resolve().parents[2];runtime=root/'ops/observability/validation-runtime';folder=runtime/'snapshot1'
session=json.loads((runtime/'session.json').read_text());id=int(session['artwork']);child=int(session['child'])
cookie='; '.join(f"{c['name']}={c['value']}" for c in session['cookies'])
# The owner deletion occurs AFTER the snapshot. Its independent replay ledger is required on restore.
import urllib.error
try:
 r=urllib.request.urlopen(urllib.request.Request(f'http://localhost:19501/v1/artworks/{id}',method='DELETE',headers={'Cookie':cookie}))
 assert r.status==202,r.status
except urllib.error.HTTPError as e:
 if e.code!=404:raise
ledger={'snapshotHash':hashlib.sha256((folder/'manifest.json').read_bytes()).hexdigest(),'artworkIds':[id]}
(runtime/'deletion-ledger.json').write_text(json.dumps(ledger));(runtime/'deletion-ledger.json').chmod(0o600)
target=sys.argv[1] if len(sys.argv)>1 else 'uri-gallery-ops-restore1104b'
subprocess.run([sys.executable,str(root/'ops/observability/snapshot.py'),'restore',target,str(folder),str(runtime/'deletion-ledger.json')],check=True)
# Obtain only the synthetic account address internally; never print credentials or cookies.
email=db(target,f'SELECT email FROM guardian_account WHERE family_id=(SELECT family_id FROM child WHERE child_id={child}) LIMIT 1;').decode().strip()
payload=json.dumps({'email':email,'password':'synthetic-Password-2026'})
script='const input='+json.dumps({'cookie':cookie,'payload':payload,'id':id})+';\n'+'''const old=await fetch('http://127.0.0.1:9521/v1/artworks',{headers:{cookie:input.cookie}});if(old.status!==401)throw new Error('restored session still valid');
const login=await fetch('http://127.0.0.1:9521/v1/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:input.payload});if(login.status!==204)throw new Error('restored login failed '+login.status);
const cookies=login.headers.getSetCookie().map(v=>v.split(';')[0]).join('; ');
const gone=await fetch('http://127.0.0.1:9521/v1/artworks/'+input.id,{headers:{cookie:cookies}});if(gone.status!==404)throw new Error('deleted artwork restored');
console.log(JSON.stringify({oldSession:old.status,login:login.status,deletedArtwork:gone.status}));'''
result=subprocess.run(['docker','exec','-i',target+'-app-api-1','node','--input-type=module'],input=script.encode(),stdout=subprocess.PIPE,stderr=subprocess.PIPE,check=True)
report=json.loads(result.stdout);(runtime/'restore-auth-report.json').write_text(json.dumps(report,indent=2));print(json.dumps(report))
