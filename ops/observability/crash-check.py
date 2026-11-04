import hashlib,importlib.util,json,subprocess,time,uuid
from pathlib import Path
from snapshot import db
root=Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('flow',root/'ops/observability/flow-check.py');flow=importlib.util.module_from_spec(spec);spec.loader.exec_module(flow)
project=flow.PROJECT;started=time.monotonic()
def delayed():subprocess.run(['docker','compose','-p',project,'-f','compose.yaml','-f','ops-test.override.yaml','-f','ops-delay.override.yaml','up','-d','--force-recreate','worker-cpu'],check=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
a,_,child=flow.signup('crash');delayed()
try:
 status,data,_=flow.upload(a,child,str(uuid.uuid4()));assert status==202;id=data['id']
 detail=flow.req(a,f'/v1/artworks/{id}')[1];photo=detail.get('originalUrl') or detail['photoUrl'];before=hashlib.sha256(flow.req(a,photo)[1]).hexdigest()
 for _ in range(60):
  state=db(project,f"SELECT status FROM stage_job WHERE artwork_id={int(id)} AND stage_kind='split';").decode().strip()
  if state=='running':break
  time.sleep(.5)
 else:raise AssertionError('Split did not start')
 flow.docker('kill',project+'-worker-cpu-1')
 assert hashlib.sha256(flow.req(a,photo)[1]).hexdigest()==before
finally:flow.compose('up','-d','--force-recreate','worker-cpu')
for _ in range(180):
 state=db(project,f"SELECT status FROM stage_job WHERE artwork_id={int(id)} AND stage_kind='split';").decode().strip()
 if state=='done':break
 time.sleep(1)
else:raise AssertionError('Crashed split was not resumed to completion')
attempts=int(db(project,f"SELECT attempt_count FROM stage_job WHERE artwork_id={int(id)} AND stage_kind='split';").decode().strip())
assert attempts>=2,attempts
assert hashlib.sha256(flow.req(a,photo)[1]).hexdigest()==before
count=int(db(project,f"SELECT COUNT(*) FROM artwork WHERE artwork_id={int(id)};").decode().strip());assert count==1
report={'fixture':'fake split delayed 20s, worker SIGKILL after running observed','attempts':attempts,'originalChecksumUnchanged':True,'artworkCount':count,'seconds':round(time.monotonic()-started,2),'limits':'one crash point; not result-file-before-commit, disk failure, real model or DB write failure coverage'}
(root/'ops/observability/validation-runtime/crash-report.json').write_text(json.dumps(report,indent=2));print(json.dumps(report))
