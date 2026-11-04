import json,subprocess,time,urllib.request
from pathlib import Path
from snapshot import db,compose,docker
root=Path(__file__).resolve().parents[2];project='uri-gallery-ops-app1104';runtime=root/'ops/observability/validation-runtime'
session=json.loads((runtime/'session.json').read_text());cookie='; '.join(f"{c['name']}={c['value']}" for c in session['cookies'])
before=db(project,'SELECT COUNT(*) FROM artwork; SELECT COUNT(*) FROM stored_object;').decode().strip().splitlines()
image=docker('inspect','--format','{{.Image}}',project+'-app-api-1').decode().strip();started=time.monotonic()
docker('build','-t','uri-gallery-ops-api:bad1104','-f',str(root/'ops/observability/BadRelease.Dockerfile'),str(root))
try:
 docker('compose','-p',project,'-f',str(root/'compose.yaml'),'-f',str(root/'ops-test.override.yaml'),'-f',str(root/'ops-bad-release.override.yaml'),'up','-d','--no-deps','--no-build','app-api')
 for _ in range(20):
  if docker('inspect','--format','{{.State.Status}}',project+'-app-api-1').decode().strip()=='exited':break
  time.sleep(.5)
 else:raise AssertionError('Bad image did not fail')
finally:compose(project,'up','-d','--no-deps','--no-build','app-api')
for _ in range(60):
 try:
  r=urllib.request.urlopen(urllib.request.Request('http://localhost:19501/v1/artworks',headers={'Cookie':cookie}),timeout=5)
  if r.status==200:break
 except Exception:pass
 time.sleep(1)
else:raise AssertionError('Rollback did not restore authenticated API')
assert docker('inspect','--format','{{.Image}}',project+'-app-api-1').decode().strip()==image
after=db(project,'SELECT COUNT(*) FROM artwork; SELECT COUNT(*) FROM stored_object;').decode().strip().splitlines();assert after==before
report={'failedImage':'uri-gallery-ops-api:bad1104','restoredImageId':image,'countsBefore':before,'countsAfter':after,'authenticatedList':200,'seconds':round(time.monotonic()-started,2),'scope':'application image rollback; no incompatible DB migration'}
(runtime/'rollback-report.json').write_text(json.dumps(report,indent=2));print(json.dumps(report))
