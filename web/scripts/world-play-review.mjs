// Run from web: node scripts/world-play-review.mjs /absolute/evidence/path
// 3D미술관_재설계 §2-11: 그리기 초안 복구·저장 실패·버리기와 퍼즐 비율·같은 모양 조각·완료 안내를 실제 화면으로 확인한다.
import {reviewBrowser,startWorld} from './review-browser.mjs';import fs from 'node:fs';
const out=process.argv[2]??'/private/tmp/uam-play-review';fs.mkdirSync(out,{recursive:true});const results=[];
const ok=(name,pass,detail)=>{results.push({name,pass,detail});console.log(pass?'PASS':'FAIL',name,detail===undefined?'':JSON.stringify(detail));};
const browser=await reviewBrowser();
const STORE='/src/app/world/store.ts';
async function enter(page,works=14){await page.goto('http://127.0.0.1:5173/app/world');await page.getByRole('button',{name:'테스트 계정으로 들어가기'}).click();await page.waitForFunction(n=>window.__uamWorld?.debugState().works===n,works,{timeout:90000});}
const count=page=>page.evaluate(async s=>(await (await import(s)).listArtworks()).length,STORE);
const draft=page=>page.evaluate(async s=>{const d=await (await import(s)).getDraft();return d?{id:d.id,strokes:d.strokes.length,turn:d.turn}:null;},STORE);
const hashes=page=>page.evaluate(async s=>{const arts=await (await import(s)).listArtworks();return Object.fromEntries(await Promise.all(arts.map(async a=>[a.id,Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await a.original.arrayBuffer()))).map(n=>n.toString(16).padStart(2,'0')).join('')])));},STORE);
async function openDraw(page){await page.getByRole('button',{name:'함께 놀기',exact:true}).click();await page.getByRole('button',{name:/함께 그리기/}).click();await page.locator('.w-draw-canvas').waitFor();}
async function stroke(page,x0,y0,x1,y1){const b=await page.locator('.w-draw-canvas').boundingBox();await page.mouse.move(b.x+x0,b.y+y0);await page.mouse.down();await page.mouse.move(b.x+x1,b.y+y1,{steps:10});await page.mouse.up();}
const inked=page=>page.evaluate(()=>{const c=document.querySelector('.w-draw-canvas'),d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let n=0;for(let i=0;i<d.length;i+=4)if(d[i]<200||d[i+2]>220&&d[i]<120)n++;return n;});
async function waitDraft(page,pred,ms=4000){const end=Date.now()+ms;let d;while(Date.now()<end){d=await draft(page);if(pred(d))return d;await page.waitForTimeout(100);}return d;}
try{
 const page=await browser.newPage({viewport:{width:1280,height:800},reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await enter(page);const before=await hashes(page);
 // 1. 두 차례 그린 뒤 새로고침 → 같은 획·차례 복구
 await openDraw(page);await stroke(page,40,60,200,110);await page.getByRole('button',{name:'다음 사람 차례'}).click();await stroke(page,260,200,420,260);
 const d1=await waitDraft(page,d=>d?.strokes===2&&d.turn===2);ok('draft saved after each stroke and turn',d1?.strokes===2&&d1.turn===2,d1);
 await page.reload();await startWorld(page);await page.waitForFunction(()=>window.__uamWorld?.debugState().works===14,null,{timeout:90000});
 await page.getByRole('button',{name:'함께 놀기',exact:true}).click();ok('menu tells a drawing is waiting',await page.getByText('그리던 그림을 이어서 그려요').waitFor({timeout:3000}).then(()=>true,()=>false));
 await page.getByRole('button',{name:/함께 그리기/}).click();await page.locator('.w-draw-canvas').waitFor();
 ok('reload restores strokes and turn',await page.getByText('그리던 그림을 다시 불러왔어요').isVisible()&&await page.getByText('2번째 차례예요',{exact:false}).isVisible()&&await inked(page)>200,{ink:await inked(page)});
 await page.screenshot({path:out+'/draft-restored.png'});
 // 2. 초안 쓰기 실패: 그림은 남고 경고, 보관은 막지 않음
 await page.evaluate(()=>{window.__put=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(...a){if(this.name==='drafts')throw new DOMException('quota','QuotaExceededError');return window.__put.apply(this,a);};});
 await stroke(page,100,300,300,320);await page.getByText('이 기기에 임시로 남기지 못했어요',{exact:false}).waitFor({timeout:4000}).catch(()=>{});
 ok('draft write failure warns and keeps drawing',await page.getByText('이 기기에 임시로 남기지 못했어요',{exact:false}).isVisible()&&await inked(page)>300);
 // 3. 작품 저장 실패 → 그림·초안 유지 → 재시도 한 점
 await page.evaluate(()=>{IDBObjectStore.prototype.put=function(...a){if(this.name==='artworks')throw new DOMException('quota','QuotaExceededError');return window.__put.apply(this,a);};});
 await page.getByRole('button',{name:'우리 그림 보관하기'}).click();await page.getByText('저장하지 못했어요',{exact:false}).waitFor();
 ok('artwork save failure keeps canvas and draft',await count(page)===14&&await inked(page)>300&&(await draft(page))?.id===d1.id);
 await page.evaluate(()=>{IDBObjectStore.prototype.put=window.__put;});await page.getByRole('button',{name:'우리 그림 보관하기'}).click();await page.waitForFunction(()=>window.__uamWorld?.debugState().works===15,null,{timeout:30000});
 const saved=await page.evaluate(async([s,id])=>{const a=(await (await import(s)).listArtworks()).find(x=>x.id===id);return a?{type:a.original.type,size:a.original.size,kind:a.kind,madeOn:a.madeOn}:null;},[STORE,d1.id]);
 ok('retry saves exactly one artwork with the draft id and clears the draft',await count(page)===15&&saved?.type==='image/png'&&saved.madeOn===''&&await draft(page)===null,saved);
 // 4. 버리기: 초안까지 지움
 await openDraw(page);ok('after saving the next drawing starts empty',!(await page.getByText('그리던 그림을 다시 불러왔어요').count())&&await inked(page)===0);
 await stroke(page,50,50,150,150);await waitDraft(page,d=>d?.strokes===1);await page.getByRole('button',{name:'닫기',exact:true}).click();await page.getByRole('button',{name:'보관하지 않고 닫기'}).click();
 ok('discard removes the draft',await waitDraft(page,d=>d===null)===null&&await count(page)===15);
 // 5. 되돌려 빈 도화지 → 초안 없음
 await openDraw(page);await stroke(page,50,50,150,150);await waitDraft(page,d=>d?.strokes===1);await page.getByRole('button',{name:'한 번 되돌리기'}).click();
 ok('undo to empty removes the draft',await waitDraft(page,d=>d===null)===null);await page.getByRole('button',{name:'닫기',exact:true}).click();
 // 6. 퍼즐: 작품 비율, 같은 모양 조각, 완료 안내
 await page.getByRole('button',{name:'함께 놀기',exact:true}).click();await page.getByRole('button',{name:/작품 퍼즐/}).click();
 await page.locator('.w-puzzle select, .w-play select').first().selectOption(d1.id);await page.getByRole('button',{name:'9조각',exact:true}).click();await page.locator('.w-puzzle button').nth(8).waitFor();
 const box=await page.locator('.w-puzzle').boundingBox();ok('board keeps 4:3 artwork ratio',Math.abs(box.width/box.height-4/3)<0.04,{w:box.width,h:box.height});
 // 화면에 그림이 있는 조각만 제자리로 옮긴다. 빈 조각끼리의 순서는 사람이 구분할 수 없으므로 맞추지 않는다.
 const inkedTiles=await page.evaluate(async([s,id])=>{const store=await import(s),play=await import('/src/app/world/play.ts');const a=(await store.listArtworks()).find(x=>x.id===id);const img=new Image();img.src=URL.createObjectURL(a.display);await img.decode();const c=document.createElement('canvas');c.width=240;c.height=180;const x=c.getContext('2d');x.drawImage(img,0,0,240,180);const sig=play.tileSignatures(x.getImageData(0,0,240,180).data,240,180,3);const paper=new Uint8ClampedArray(240*180*4);for(let i=0;i<paper.length;i+=4){paper[i]=255;paper[i+1]=253;paper[i+2]=245;paper[i+3]=255;}const blank=play.tileSignatures(paper,240,180,3)[0];return sig.map((t,i)=>play.sameShape(t,blank)?-1:i).filter(i=>i>=0);},[STORE,d1.id]);
 const tiles=page.locator('.w-puzzle button');let swaps=0;
 for(const want of inkedTiles){if(await page.locator('.w-celebrate').count())break;const labels=await tiles.evaluateAll(b=>b.map(x=>+x.getAttribute('aria-label').match(/조각 (\d+)/)[1]-1));if(labels[want]===want)continue;const from=labels.indexOf(want);await tiles.nth(from).click();await tiles.nth(want).click();swaps++;}
 await page.locator('.w-celebrate').waitFor({timeout:3000}).catch(()=>{});
 ok('blank-margin puzzle completes when only drawn pieces are placed',await page.locator('.w-celebrate').count()===1,{inkedTiles,swaps});
 const cel=await page.locator('.w-celebrate').boundingBox();ok('completion notice is moved into view and focused',!!cel&&cel.y>=0&&cel.y+Math.min(cel.height,60)<=800&&await page.evaluate(()=>document.activeElement?.classList.contains('w-celebrate')),cel);
 await page.screenshot({path:out+'/puzzle-blank-complete.png'});
 // 7. 빠른 난이도 바꾸기 뒤 조각 수가 마지막 선택과 같음
 for(const n of ['4조각','9조각','4조각','9조각','4조각'])await page.getByRole('button',{name:n,exact:true}).click();await page.waitForTimeout(800);
 ok('rapid size changes settle on the last choice',await tiles.count()===4&&!(await page.locator('.w-celebrate').count()));
 // 8. 세로 작품 비율
 const tall=await page.evaluate(async s=>{const store=await import(s);const c=document.createElement('canvas');c.width=300;c.height=600;const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,300,600);x.fillStyle='#d33';x.fillRect(40,40,220,200);x.fillStyle='#36c';x.beginPath();x.arc(150,430,110,0,7);x.fill();const blob=await new Promise(r=>c.toBlob(r,'image/png'));const p=await store.processImage(blob,false);const id=store.newId(),all=await store.listArtworks();await store.saveArtworkAndRoom({id,no:all.reduce((n,a)=>Math.max(n,a.no),0)+1,title:'세로 시험 그림',kind:'drawing',subject:'etc',material:'',age:6,madeOn:'',words:'',original:blob,display:p.display,cutout:null,sample:false,createdAt:Date.now()});return id;},STORE);
 // 9. 모두 흰 그림은 퍼즐 대신 안내
 const blankId=await page.evaluate(async s=>{const store=await import(s);const c=document.createElement('canvas');c.width=400;c.height=300;const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,400,300);const blob=await new Promise(r=>c.toBlob(r,'image/png'));const p=await store.processImage(blob,false);const id=store.newId(),all=await store.listArtworks();await store.saveArtworkAndRoom({id,no:all.reduce((n,a)=>Math.max(n,a.no),0)+1,title:'빈 시험 종이',kind:'drawing',subject:'etc',material:'',age:6,madeOn:'',words:'',original:blob,display:p.display,cutout:null,sample:false,createdAt:Date.now()});return id;},STORE);
 await page.getByRole('button',{name:'닫기',exact:true}).click();await page.reload();await startWorld(page);await page.waitForFunction(()=>window.__uamWorld?.debugState().works===17,null,{timeout:90000});
 await page.getByRole('button',{name:'함께 놀기',exact:true}).click();await page.getByRole('button',{name:/작품 퍼즐/}).click();await page.locator('.w-play select').selectOption(tall);await page.locator('.w-puzzle button').nth(3).waitFor();
 const tb=await page.locator('.w-puzzle').boundingBox();ok('portrait artwork keeps 1:2 ratio and fits the screen height',Math.abs(tb.width/tb.height-.5)<0.04&&tb.height<=800*.56+2,{w:tb.width,h:tb.height});await page.screenshot({path:out+'/puzzle-portrait.png'});
 await page.locator('.w-play select').selectOption(blankId);await page.getByText('같은 모양 조각이 많아',{exact:false}).waitFor({timeout:5000}).catch(()=>{});
 ok('all-blank artwork shows guidance instead of an unwinnable board',await page.getByText('같은 모양 조각이 많아',{exact:false}).isVisible()&&await page.locator('.w-puzzle button').count()===0);
 const after=await hashes(page);ok('preexisting originals unchanged',Object.entries(before).every(([id,h])=>after[id]===h));
 ok('no page errors',errors.length===0,errors);
 // 10. 모바일 390: 퍼즐·완료 안내 가로 넘침 없음
 const mp=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});await enter(mp);
 await mp.getByRole('button',{name:'함께 놀기',exact:true}).click();await mp.getByRole('button',{name:/작품 퍼즐/}).click();await mp.locator('.w-puzzle button').nth(3).waitFor();
 ok('mobile puzzle has no horizontal overflow',await mp.evaluate(()=>[...document.querySelectorAll('.w-play-card, .w-puzzle')].every(e=>e.scrollWidth<=e.clientWidth+1)));
 await mp.screenshot({path:out+'/mobile-puzzle.png'});
}catch(e){ok('exception',false,String(e.stack??e));}finally{await browser.close();fs.writeFileSync(out+'/result.json',JSON.stringify(results,null,2));}
if(results.some(r=>!r.pass))process.exitCode=1;
