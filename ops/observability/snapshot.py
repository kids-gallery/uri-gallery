"""OPS synthetic-stack snapshot. Never operates on a public/production project.

Usage: snapshot.py backup PROJECT DIRECTORY
       snapshot.py restore NEW_PROJECT DIRECTORY DELETE_LEDGER_JSON
Secrets are not exported; keep the original test secret files to open the restored DB.
"""
import hashlib,json,re,subprocess,sys,time
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
def run(args,**kw):return subprocess.run(args,check=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE,**kw).stdout
def docker(*args,**kw):return run(['docker',*args],**kw)
def compose(project,*args,restore=False):
 files=['-f',str(ROOT/'compose.yaml'),'-f',str(ROOT/'ops-test.override.yaml')]
 if restore:files+=['-f',str(ROOT/'ops-restore.override.yaml')]
 return docker('compose','-p',project,*files,*args)
def db(project,sql=None,dump=False):
 command='MYSQL_PWD="$(cat /run/secrets/db_root_password)" '+('mariadb-dump --user=root --single-transaction --routines --triggers --events --databases uam' if dump else 'mariadb --user=root --batch --skip-column-names uam')
 return docker('exec','-i',project+'-db-1','sh','-c',command,input=sql.encode() if sql else None)
def digest(file):return hashlib.sha256(file.read_bytes()).hexdigest()
def volume(project,key):
 name=f'{project}_{key}'
 inspect=json.loads(docker('volume','inspect',name))[0]
 if inspect.get('Labels',{}).get('com.docker.compose.project')!=project:raise ValueError('Volume project label mismatch')
 return name
def archive(project,key,directory,restore=False):
 name=volume(project,key)
 command=['tar','xzf',f'/backup/{key}.tgz','--no-same-owner','-C','/volume'] if restore else ['tar','czf',f'/backup/{key}.tgz','-C','/volume','.']
 docker('run','--rm','--user','1000:1000','--network','none','--cap-drop','ALL','--security-opt','no-new-privileges','--mount',f'type=volume,src={name},dst=/volume'+('' if restore else ',readonly'),'--mount',f'type=bind,src={directory},dst=/backup'+(',readonly' if restore else ''),'alpine:3.20',*command)
def main():
 mode,project,folder=sys.argv[1:4];started=time.monotonic();folder=Path(folder).resolve()
 if not re.fullmatch(r'uri-gallery-ops-[a-z0-9-]+',project):raise ValueError('Only isolated OPS project names are permitted')
 if mode=='backup':
  folder.mkdir(parents=True,exist_ok=False);folder.chmod(0o700)
  services=compose(project,'ps','--services','--status','running').decode().split()
  writers=[s for s in ['app-api','model-api','worker-cpu','sweeper'] if s in services]
  if len(writers)!=4:raise ValueError('All four application services must be running before snapshot')
  manifest={'project':project,'createdAt':time.time(),'commit':run(['git','-C',str(ROOT),'rev-parse','HEAD']).decode().strip(),'files':{}}
  manifest['countsBefore']=db(project,'SELECT COUNT(*) FROM artwork; SELECT COUNT(*) FROM stored_object;').decode().strip().splitlines()
  compose(project,'stop',*writers)
  try:
   (folder/'db.sql').write_bytes(db(project,dump=True))
   for key in ['artworks','worker-state']:archive(project,key,folder)
   for name in ['db.sql','artworks.tgz','worker-state.tgz']:manifest['files'][name]=digest(folder/name)
   manifest['seconds']=round(time.monotonic()-started,2)
   (folder/'manifest.json').write_text(json.dumps(manifest,indent=2));(folder/'manifest.json').chmod(0o600)
  finally:compose(project,'start',*writers)
  print(json.dumps({'mode':mode,'seconds':manifest['seconds'],'counts':manifest['countsBefore']}))
 elif mode=='restore':
  manifest=json.loads((folder/'manifest.json').read_text())
  if project==manifest['project'] or not project.startswith('uri-gallery-ops-restore'):raise ValueError('Restore requires a NEW restore-prefixed project')
  if docker('ps','-aq','--filter',f'label=com.docker.compose.project={project}').strip() or docker('volume','ls','-q','--filter',f'label=com.docker.compose.project={project}').strip():raise ValueError('Restore target is not empty')
  for name,checksum in manifest['files'].items():
   if name not in ['db.sql','artworks.tgz','worker-state.tgz'] or digest(folder/name)!=checksum:raise ValueError('Snapshot checksum mismatch')
  ledger=json.loads(Path(sys.argv[4]).read_text())
  if ledger['snapshotHash']!=digest(folder/'manifest.json'):raise ValueError('Deletion ledger must be explicitly matched to this snapshot')
  ids=ledger['artworkIds']
  if not isinstance(ids,list) or any(type(i)!=int or i<=0 for i in ids):raise ValueError('Invalid deletion IDs')
  compose(project,'up','-d','db',restore=True)
  for _ in range(90):
   health=docker('inspect','--format','{{.State.Health.Status}}',project+'-db-1').decode().strip()
   if health=='healthy':break
   time.sleep(1)
  else:raise TimeoutError('Restore DB readiness')
  db(project,(folder/'db.sql').read_text())
  # Prepare named volumes without starting writers or publishing any port.
  compose(project,'create','app-api','worker-cpu',restore=True)
  for key in ['artworks','worker-state']:archive(project,key,folder,True)
  sql="DELETE FROM app_session; DELETE FROM auth_email_token; UPDATE stage_job SET claim_expires_at=UTC_TIMESTAMP()-INTERVAL 60 SECOND WHERE status='running';\n"
  for i in ids:
   sql+=f"UPDATE artwork SET status='deleting',deleting_since=UTC_TIMESTAMP() WHERE artwork_id={i}; UPDATE stage_job SET cancel_requested_at=UTC_TIMESTAMP() WHERE artwork_id={i} AND status IN ('queued','running','retry_wait'); INSERT INTO deletion_request(target_kind,origin,artwork_id,status) SELECT 'artwork','guardian',artwork_id,'waiting_stop' FROM artwork WHERE artwork_id={i} AND NOT EXISTS(SELECT 1 FROM deletion_request WHERE artwork_id={i} AND status IN ('accepted','waiting_stop','deleting_files'));\n"
  db(project,sql)
  compose(project,'up','-d','app-api','model-api','worker-cpu','sweeper',restore=True)
  for _ in range(90):
   remaining=db(project,'SELECT COUNT(*) FROM artwork'+(' WHERE artwork_id IN ('+','.join(map(str,ids))+')' if ids else ' WHERE 1=0')+';').decode().strip()
   if remaining=='0':break
   time.sleep(1)
  else:raise TimeoutError('Replayed deletions did not finish; keep restore isolated')
  report={'mode':mode,'project':project,'seconds':round(time.monotonic()-started,2),'replayedDeletions':len(ids),'remainingDeletedArtworks':int(remaining),'sessions':int(db(project,'SELECT COUNT(*) FROM app_session;').decode().strip()),'counts':db(project,'SELECT COUNT(*) FROM artwork; SELECT COUNT(*) FROM stored_object;').decode().strip().splitlines(),'publicPorts':False}
  (folder/'restore-report.json').write_text(json.dumps(report,indent=2));print(json.dumps(report))
 else:raise ValueError('Unknown mode')
if __name__=='__main__':main()
