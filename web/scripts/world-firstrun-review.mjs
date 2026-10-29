// Run from web: node scripts/world-firstrun-review.mjs /absolute/evidence/path
// 3D미술관_재설계 §2-15 첫 업로드·§2-17 시작 화면: 시작하기 → 도착 → 사진 고르기 → 자동 처리 → 전시 결과를 실제 입력으로 끝까지 조작한다.
// 합성 이미지만 쓴다. 기록: 누른 횟수, 필수 입력 수, 원본 해시, 실패·재시도, 모바일 배치.
import {reviewBrowser,startWorld,tool} from './review-browser.mjs';import fs from 'node:fs';
const out=process.argv[2]??'/private/tmp/uam-firstrun-review';fs.mkdirSync(out,{recursive:true});const results=[];
const ok=(name,pass,detail)=>{results.push({name,pass,detail});console.log(pass?'PASS':'FAIL',name,detail===undefined?'':JSON.stringify(detail));};
const URL0='http://127.0.0.1:5173/app/world',STORE='/src/app/world/store.ts';
const browser=await reviewBrowser();
const count=p=>p.evaluate(async s=>{const st=await import(s);return st.getAccount().then(a=>a?st.listArtworks().then(l=>l.length):-1);},STORE);
const record=(p,id)=>p.evaluate(async([s,id])=>{const st=await import(s);const a=(await st.listArtworks()).find(x=>x.id===id);if(!a)return null;const img=new Image();img.src=URL.createObjectURL(a.display);await img.decode();return {title:a.title,age:a.age,madeOn:a.madeOn,words:a.words,cutout:!!a.cutout,cutoutState:a.cutoutState??null,rotation:a.rotation??0,sample:a.sample,originalHash:await st.sha256(a.original),display:[img.naturalWidth,img.naturalHeight]};},[STORE,id]);
// 합성 PNG(가로 4:3, 색이 서로 다름)를 브라우저에서 만든다
async function makePngs(p,n,offset=0){return p.evaluate(async([n,o])=>{const out=[];for(let i=0;i<n;i++){const c=document.createElement('canvas');c.width=400;c.height=300;const x=c.getContext('2d');x.fillStyle='#fffdf5';x.fillRect(0,0,400,300);x.fillStyle=`hsl(${(i+o)*37%360} 70% 50%)`;x.beginPath();x.arc(120+i*9,150,70,0,7);x.fill();x.fillStyle='#2a3a8a';x.fillRect(250,60+i*5,80,170);out.push((await new Promise(r=>c.toBlob(r,'image/png'))).arrayBuffer().then(b=>Array.from(new Uint8Array(b))));}return Promise.all(out);},[n,offset]);}
const file=(bytes,name='drawing.png',mimeType='image/png')=>({name,mimeType,buffer:Buffer.from(bytes)});
const sha=async(p,bytes)=>p.evaluate(async b=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new Uint8Array(b)))).map(n=>n.toString(16).padStart(2,'0')).join(''),bytes);
async function pick(p,button,files){const fc=p.waitForEvent('filechooser');await p.getByRole('button',{name:button,exact:true}).click();await (await fc).setFiles(files);}
try{
 const ctx=await browser.newContext({viewport:{width:1280,height:800},reducedMotion:'reduce'});const p=await ctx.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto(URL0);await p.getByRole('button',{name:'시작하기',exact:true}).waitFor({timeout:60000});
 ok('start screen shows start first, sample second, storage note, no family yet',await count(p)===-1&&await p.getByRole('button',{name:'샘플 미술관 먼저 보기'}).isVisible()&&await p.getByText('이 기기에 저장돼요. 브라우저 데이터를 지우면 사라질 수 있어요').isVisible());
 await p.screenshot({path:`${out}/01-entrance.png`});
 // [시작하기]는 빈 가족을 만들고 빈 대표작 자리 앞에 선다(§2-15). 고르기 취소는 아무것도 더하지 않는다
 await startWorld(p);
 ok('start creates an empty family and offers [사진 고르기]',await count(p)===0&&await p.locator('.w-first-work').isVisible());
 await pick(p,'사진 고르기',[]);await p.waitForTimeout(400);
 ok('cancelling the picker adds nothing',await count(p)===0&&await p.getByRole('button',{name:'사진 고르기',exact:true}).isVisible());
 // 한 장: [시작하기] 뒤 버튼 1번 + 사진 선택 → 전시(걷기·덮개 없이)
 const [first,second]=await makePngs(p,2);const firstHash=await sha(p,first);
 const t0=Date.now();await pick(p,'사진 고르기',[file(first,'첫 그림.png')]);
 await p.locator('.w-saved').waitFor({timeout:60000});const ms=Date.now()-t0;
 const st=await p.evaluate(()=>window.__uamWorld.debugState());
 const id=st.featured;const r1=await record(p,id);
 // §2-22 1: 원본을 먼저 걸고 같은 기기에서 배경 지우기를 이어서 한다(처리 전·사본 있음·배경 못 찾음 중 하나)
 ok('start + one button + photo choice reaches the exhibited work with no required inputs',st.space==='inside'&&r1&&r1.age===0&&r1.title===''&&r1.madeOn===''&&['pending','done','none'].includes(r1.cutoutState),{ms,space:st.space,record:r1});
 ok('original bytes are kept exactly',r1?.originalHash===firstHash);
 ok('new local family starts in forest mode with unsorted room',st.theme==='forest'&&st.rooms.includes('새로 온 작품'),{theme:st.theme,rooms:st.rooms});
 await p.waitForTimeout(1200);await p.screenshot({path:`${out}/02-first-result.png`});
 // 사진 돌리기(§2-23 B): 화면용 사본만 오른쪽으로 90°
 await p.getByRole('button',{name:'오른쪽으로 돌리기'}).click();await p.waitForFunction(()=>!document.querySelector('.w-saved button[disabled]'),null,{timeout:30000});await p.waitForTimeout(400);
 const r2=await record(p,id);
 ok('rotate swaps display size, keeps original and id',r2&&r2.rotation===90&&r2.display[0]===r1.display[1]&&r2.display[1]===r1.display[0]&&r2.originalHash===firstHash,{before:r1?.display,after:r2?.display});
 // 이야기: 결과 카드의 질문 두 개(나이, 주제)를 건너뛴 뒤(§2-22 4)
 await p.getByRole('button',{name:'건너뛰기'}).click();await p.getByRole('button',{name:'건너뛰기'}).click();
 await p.getByRole('button',{name:'이 작품 이야기'}).click();const story=p.locator('.w-view textarea');await story.waitFor();await story.fill('하늘에 큰 해를 그렸어');
 await p.locator('.w-view').getByRole('button',{name:/이야기 (남기기|저장)/}).click();await p.waitForTimeout(600);
 ok('story saved from the result card',(await record(p,id))?.words==='하늘에 큰 해를 그렸어');
 await p.keyboard.press('Escape');await p.waitForTimeout(300);
 // 여러 장: 정상 1, 같은 사진, 빈 파일, 손상, HEIC 이름
 const before=await count(p);
 await p.getByRole('button',{name:'작품 올리기',exact:true}).first().click().catch(async()=>{await p.getByRole('button',{name:'더보기'}).click();await p.getByRole('button',{name:'작품 올리기',exact:true}).click();});
 await pick(p,'앨범에서 고르기',[file(second,'둘째.png'),file(first,'같은 사진.png'),file([],'빈 파일.png'),file([1,2,3,4,5,6,7,8],'손상.png'),file([0,0,0,24,102,116,121,112,104,101,105,99],'아이폰.heic','image/heic')]);
 await p.getByRole('button',{name:'성공한 작품 보러 가기'}).waitFor({timeout:60000});
 const listText=await p.locator('.w-upload-list').innerText();
 ok('mixed batch keeps the good one and explains each failure',await count(p)===before+1&&/이미 보관한 사진/.test(listText)&&/빈 파일/.test(listText)&&/열 수 없어요/.test(listText)&&/HEIC/.test(listText),{listText});
 await p.screenshot({path:`${out}/03-mixed-batch.png`});
 // 저장 실패 → 실패 표시 → 다시 시도로 한 점만
 const [third]=await makePngs(p,1,9);
 await p.evaluate(()=>{window.__put=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(...a){if(this.name==='rooms')throw new DOMException('quota','QuotaExceededError');return window.__put.apply(this,a);};});
 const c2=await count(p);await pick(p,'사진 더 고르기',[file(third,'셋째.png')]);
 await p.getByText('저장 공간이 부족해요',{exact:false}).waitFor({timeout:30000}); // §2-19 기준 5: 저장 공간 부족은 원인과 다음 할 일을 말한다
 ok('failed save is not shown as exhibited and leaves no half record',await count(p)===c2&&!(await p.locator('.w-st-fail').filter({hasText:'셋째'}).locator('.w-up-state').innerText()).includes('끝'));
 await p.evaluate(()=>{IDBObjectStore.prototype.put=window.__put;});
 await p.locator('.w-st-fail').filter({hasText:'셋째'}).getByRole('button',{name:'다시 시도'}).click();await p.waitForTimeout(1500);
 ok('retry adds exactly one artwork',await count(p)===c2+1,{count:await count(p),expected:c2+1});
 // 다시 시도하면 저장될 실패를 하나 남긴 채 닫으면 먼저 묻는다(빈 파일·손상·HEIC처럼 다시 해도 안 되는 실패는 묻지 않는다)
 const [fourth]=await makePngs(p,1,23);
 await p.evaluate(()=>{IDBObjectStore.prototype.put=function(...a){if(this.name==='rooms')throw new DOMException('quota','QuotaExceededError');return window.__put.apply(this,a);};});
 await pick(p,'사진 더 고르기',[file(fourth,'넷째.png')]);await p.locator('.w-st-fail').filter({hasText:'넷째'}).waitFor({timeout:30000});
 await p.evaluate(()=>{IDBObjectStore.prototype.put=window.__put;});
 await p.getByRole('button',{name:'닫기',exact:true}).first().click();
 ok('closing with unsaved failed photos asks first',await p.getByText('아직 보관하지 못한 사진이',{exact:false}).isVisible());
 await p.getByRole('button',{name:'보관하지 않고 닫기'}).click();await p.waitForTimeout(500);
 ok('discarding keeps the saved count',await count(p)===c2+1,{count:await count(p)});
 // 10장 한도
 const twelve=await makePngs(p,12,40);const c3=await count(p);
 await p.getByRole('button',{name:'작품 올리기',exact:true}).first().click().catch(async()=>{await p.getByRole('button',{name:'더보기'}).click();await p.getByRole('button',{name:'작품 올리기',exact:true}).click();});
 await pick(p,'앨범에서 고르기',twelve.map((b,i)=>file(b,`묶음${i+1}.png`)));
 await p.getByRole('button',{name:'성공한 작품 보러 가기'}).waitFor({timeout:90000});
 ok('batch limit takes 10 and explains the rest',await count(p)===c3+10&&await p.getByText('2장은 다음에 다시 골라 주세요',{exact:false}).isVisible(),{added:await count(p)-c3});
 await p.getByRole('button',{name:'성공한 작품 보러 가기'}).click();await p.locator('.w-saved').waitFor();
 // 새로고침 뒤 유지
 const total=await count(p);await p.reload();await p.waitForFunction(()=>window.__uamWorld?.debugState?.().works>0,null,{timeout:90000});
 ok('reload keeps every artwork and the original hash',await count(p)===total&&(await record(p,id))?.originalHash===firstHash);
 ok('no page errors',errors.length===0,errors);
 await ctx.close();
 // 샘플 미술관
 const ctx2=await browser.newContext({viewport:{width:1280,height:800},reducedMotion:'reduce'});const s=await ctx2.newPage();
 await s.goto(URL0);await s.getByRole('button',{name:'샘플 미술관 먼저 보기'}).click();await s.waitForFunction(()=>window.__uamWorld?.debugState?.().works>=14&&window.__uamWorld.debugState().mode==='play',null,{timeout:90000});
 const samples=await s.evaluate(async st=>{const m=await import(st);return (await m.listArtworks()).filter(a=>a.sample).length;},STORE);
 await tool(s,'보관함');
 ok('sample museum marks sample works',samples>=14&&await s.getByText('체험용 작품',{exact:false}).first().isVisible(),{samples});
 await ctx2.close();
 // 모바일 390
 const ctx3=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});const m=await ctx3.newPage();
 await m.goto(URL0);await m.getByRole('button',{name:'시작하기',exact:true}).waitFor({timeout:60000});await m.waitForTimeout(500);await m.screenshot({path:`${out}/04-mobile-entrance.png`});
 const box=await m.getByRole('button',{name:'시작하기',exact:true}).boundingBox();
 ok('mobile start button is reachable without horizontal overflow',box.height>=44&&box.x>=0&&box.x+box.width<=390&&await m.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),box);
 const [mob]=await makePngs(m,1,77);await startWorld(m);await pick(m,'사진 고르기',[file(mob,'모바일.png')]);await m.locator('.w-saved').waitFor({timeout:60000});await m.waitForTimeout(1200);
 const sb=await m.locator('.w-saved').boundingBox();
 ok('mobile result card fits the screen',sb.x>=0&&sb.x+sb.width<=390&&sb.y+sb.height<=844,sb);
 await m.screenshot({path:`${out}/05-mobile-result.png`});
 await ctx3.close();
}catch(e){ok('exception',false,String(e.stack??e));}finally{await browser.close();fs.writeFileSync(out+'/result.json',JSON.stringify(results,null,2));}
if(results.some(r=>!r.pass))process.exitCode=1;
