"""Synthetic API regression against ONLY the isolated local OPS stack. No real mail/model data."""
import base64, hashlib, http.cookiejar, json, struct, subprocess, time, urllib.error, urllib.parse, urllib.request, uuid, zlib
from pathlib import Path
BASE='http://localhost:19501'; MAIL='http://localhost:18025/api/v1'; PROJECT='uri-gallery-ops-app1104'
report={'environment':'Windows Docker Desktop / WSL linux amd64','models':'fake','mail':'Mailpit','checks':[]}
out=Path('ops/observability/validation-runtime');out.mkdir(parents=True,exist_ok=True)
def docker(*args): return subprocess.check_output(['docker',*args],stderr=subprocess.PIPE,text=True)
def compose(*args): return docker('compose','-p',PROJECT,'-f','compose.yaml','-f','ops-test.override.yaml',*args)
def req(agent,path,method='GET',body=None,headers=None):
 h=headers or {}; data=body
 if isinstance(body,dict): data=json.dumps(body).encode();h={**h,'Content-Type':'application/json'}
 try:
  with agent.open(urllib.request.Request(BASE+path,data=data,method=method,headers=h),timeout=20) as r:
   b=r.read();return r.status,(json.loads(b) if 'json' in r.headers.get('Content-Type','') else b),dict(r.headers)
 except urllib.error.HTTPError as e:
  b=e.read();return e.code,b,dict(e.headers)
def check(name,actual,expected):
 assert actual==expected,(name,actual,expected)
 report['checks'].append({'check':name,'result':'pass'})
def signup(tag):
 jar=http.cookiejar.CookieJar();a=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar));email=f'ops-{tag}-{uuid.uuid4().hex[:8]}@example.test';pw='synthetic-Password-2026'
 check('signup '+tag,req(a,'/v1/auth/signup','POST',{'email':email,'password':pw,'passwordConfirm':pw})[0],202)
 for _ in range(30):
  data=json.load(urllib.request.urlopen(MAIL+'/search?'+urllib.parse.urlencode({'query':f'to:"{email}"'})))
  if data.get('messages'): break
  time.sleep(.3)
 message=json.load(urllib.request.urlopen(MAIL+'/message/'+data['messages'][0]['ID']))
 import re
 token=re.search(r'/app/verify\?token=([^\s"<>&]+)',message['Text']+'\n'+message['HTML'])[1]
 check('Mailpit verification '+tag,req(a,'/v1/auth/email/verify','POST',{'token':token})[0],204)
 status,child,_=req(a,'/v1/children','POST',{'alias':'합성별이'+tag});check('child '+tag,status,201)
 return a,jar,child['id']
def png():
 def ch(t,d):return struct.pack('>I',len(d))+t+d+struct.pack('>I',zlib.crc32(t+d)&0xffffffff)
 return b'\x89PNG\r\n\x1a\n'+ch(b'IHDR',struct.pack('>IIBBBBB',32,32,8,2,0,0,0))+ch(b'IDAT',zlib.compress((b'\0'+b'\x88\xaa\xee'*32)*32))+ch(b'IEND',b'')
def upload(a,child,key):
 b='ops'+uuid.uuid4().hex
 body=(f'--{b}\r\nContent-Disposition: form-data; name="childId"\r\n\r\n{child}\r\n--{b}\r\nContent-Disposition: form-data; name="photo"; filename="synthetic.png"\r\nContent-Type: image/png\r\n\r\n').encode()+png()+f'\r\n--{b}--\r\n'.encode()
 return req(a,'/v1/artworks','POST',body,{'Content-Type':'multipart/form-data; boundary='+b,'Idempotency-Key':key})
def wait(a,id,predicate,limit=90):
 for _ in range(limit):
  status,detail,_=req(a,f'/v1/artworks/{id}')
  if status==200 and predicate(detail):return detail
  time.sleep(1)
 raise AssertionError('processing state timeout')
def main():
 started=time.monotonic()
 a,jar,child=signup('A');b,_,other=signup('B')
 compose('stop','worker-cpu')
 try:
  key=str(uuid.uuid4());status,data,_=upload(a,child,key);check('accepted while worker stopped',status,202);id=data['id']
  check('idempotent retry artwork ID',upload(a,child,key)[1]['id'],id)
  detail=req(a,f'/v1/artworks/{id}')[1]
  photo=detail.get('originalUrl') or detail.get('photoUrl')
  assert photo,('missing photo url',list(detail))
  if photo.startswith('http'):photo=urllib.parse.urlsplit(photo).path
  status,original,headers=req(a,photo);check('owner original access',status,200)
  before=hashlib.sha256(original).hexdigest()
  for name,path,method,body in [('detail',f'/v1/artworks/{id}','GET',None),('file',photo,'GET',None),('decision',f'/v1/artworks/{id}/decision','POST',{'decision':'like'}),('delete',f'/v1/artworks/{id}','DELETE',None)]:
   check('other family denied '+name,req(b,path,method,body)[0],404)
  assert 'private' in headers.get('Cache-Control','') and 'no-store' in headers.get('Cache-Control','')
  report['checks'].append({'check':'private no-store file cache header','result':'pass'})
 finally: compose('start','worker-cpu')
 detail=wait(a,id,lambda d:'relief' in d.get('choices',[]))
 check('confirm relief',req(a,f'/v1/artworks/{id}/confirm','POST',{'kind':'relief'})[0],200)
 detail=wait(a,id,lambda d:'like' in d.get('choices',[]))
 check('approve result',req(a,f'/v1/artworks/{id}/decision','POST',{'decision':'like'})[0],200)
 check('original checksum after worker resume',hashlib.sha256(req(a,photo)[1]).hexdigest(),before)
 check('gallery contains one artwork',sum(len(g['items']) for g in req(a,'/v1/gallery?child='+str(child))[1]['groups']),1)
 compose('restart','app-api','model-api','worker-cpu','sweeper')
 for _ in range(60):
  try:
   if req(a,f'/v1/artworks/{id}')[0]==200:break
  except Exception:pass
  time.sleep(1)
 check('same artwork after service restart',req(a,f'/v1/artworks/{id}')[1]['id'],id)
 check('original checksum after restart',hashlib.sha256(req(a,photo)[1]).hexdigest(),before)
 # Save synthetic session only in ignored runtime directory for the restore/expiry checks.
 (out/'session.json').write_text(json.dumps({'artwork':id,'child':child,'photo':photo,'checksum':before,'cookies':[{k:getattr(c,k) for k in ['name','value','domain','path','secure','expires']} for c in jar]}));(out/'session.json').chmod(0o600)
 report['seconds']=round(time.monotonic()-started,2)
 (out/'flow-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps(report,ensure_ascii=False))

if __name__=="__main__":main()
