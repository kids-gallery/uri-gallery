// Run from web: node scripts/world-decor-review.mjs /absolute/evidence/path
// 3D미술관_재설계 §2-15 꾸미기 규칙: 숲 마을 샘플 미술관에서 작품 옆 소품 놓기·되돌리기·취소·완료·재방문을 실제 입력으로 조작한다.
import {reviewBrowser,startWorld,tool} from './review-browser.mjs';import fs from 'node:fs';
const out=process.argv[2]??'/private/tmp/uam-decor-review';fs.mkdirSync(out,{recursive:true});const results=[];
const ok=(name,pass,detail)=>{results.push({name,pass,detail});console.log(pass?'PASS':'FAIL',name,detail===undefined?'':JSON.stringify(detail));};
const STORE='/src/app/world/store.ts';
const browser=await reviewBrowser();
const decorState=p=>p.evaluate(async s=>{const e=window.__uamWorld,m=e.museum;const prefs=await (await import(s)).getPrefs();return {shown:m.decorGroup.children.length,saved:(prefs.decor??[]).length,theme:prefs.theme};},STORE);
const hashes=p=>p.evaluate(async s=>{const st=await import(s);return Object.fromEntries(await Promise.all((await st.listArtworks()).map(async a=>[a.id,await st.sha256(a.original)])));},STORE);
/** 실제로 화면의 작품을 눌러 고른다. 가려져 있으면 그 작품 앞으로 옮긴 뒤 다시 누른다 */
async function selectWork(p,id){
 await p.evaluate(id=>{const e=window.__uamWorld,w=e.museum.works.get(id);e.debugTeleport(w.stand.x,w.stand.z);e.avatarRoot.rotation.y=Math.atan2(-w.normal.x,-w.normal.z);e.yaw=Math.atan2(w.normal.x,w.normal.z);},id);
 await p.waitForTimeout(900);
 const pt=await p.evaluate(id=>window.__uamWorld.debugScreenOf(id),id);
 if(pt)await p.mouse.click(pt.x,pt.y);
 await p.waitForTimeout(300);
 return p.evaluate(()=>!!document.querySelector('.w-decor-spots')&&document.querySelector('.w-decor-spots').textContent.length>0);
}
try{
 const ctx=await browser.newContext({viewport:{width:1280,height:800},reducedMotion:'reduce'});const p=await ctx.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://127.0.0.1:5173/app/world');await p.getByRole('button',{name:'샘플 미술관 둘러보기'}).click();
 await p.waitForFunction(()=>window.__uamWorld?.debugState?.().works>=14,null,{timeout:90000});
 const before=await hashes(p);
 await tool(p,'공간 꾸미기');await p.waitForFunction(()=>window.__uamWorld.debugState().space==='inside',null,{timeout:30000});
 ok('decorate opens an explicit edit state inside the museum',await p.getByText('공간을 꾸미는 중').isVisible()&&await p.getByRole('button',{name:'완료'}).isVisible());
 // 모든 작품의 왼쪽 자리를 보고, 놓을 수 있는 벽 작품 하나와 막힌 자리 하나를 찾는다
 const plan=await p.evaluate(()=>{const e=window.__uamWorld,m=e.museum,res={free:null,blocked:null};for(const id of m.works.keys()){const slot=m.workSlots.get(id);if(slot.type!=='wall')continue;for(const spot of ['left','right']){const r=m.checkDecor('plant',id,spot,[]);if(!r&&!res.free)res.free={id,spot};if(r&&!res.blocked)res.blocked={id,spot,reason:r};}}return res;});
 ok('some wall spot is free and some spot is refused with a reason',!!plan.free&&!!plan.blocked,plan);
 const selected=await selectWork(p,plan.free.id);
 ok('clicking the artwork offers its spots',selected);
 await p.getByRole('button',{name:'식물',exact:true}).click();
 const label=plan.free.spot==='left'?'왼쪽':'오른쪽';
 await p.locator('.w-decor-spot').getByRole('button',{name:label,exact:true}).click();await p.waitForTimeout(300);
 let st=await decorState(p);
 const blocksWalk=await p.evaluate(()=>{const g=window.__uamWorld.museum.decorGroup.children[0];return g?!window.__uamWorld.museum.canStand(g.position.x,g.position.z):null;});
 ok('placing a plant shows it at once and the avatar cannot walk through it',st.shown===1&&st.saved===0&&blocksWalk===true,{st,blocksWalk});
 const other=plan.free.spot==='left'?'오른쪽':'왼쪽';
 await p.getByRole('button',{name:'등불',exact:true}).click();
 const otherBtn=p.locator('.w-decor-spot').getByRole('button',{name:other,exact:true});
 const otherFree=await otherBtn.isEnabled();if(otherFree)await otherBtn.click();await p.waitForTimeout(300);
 st=await decorState(p);ok('second prop on the other side (or refused with reason)',otherFree?st.shown===2:await p.locator('.w-decor-spot small').count()>0,{otherFree,st});
 await p.screenshot({path:`${out}/01-placed.png`});
 await p.getByRole('button',{name:'되돌리기'}).click();await p.waitForTimeout(300);
 ok('undo removes the last placement',(await decorState(p)).shown===1);
 await p.getByRole('button',{name:'벤치',exact:true}).click();
 const benchBtn=p.locator('.w-decor-spot').getByRole('button',{name:'작품 앞',exact:true});
 const benchFree=await benchBtn.isEnabled();if(benchFree)await benchBtn.click();await p.waitForTimeout(300);
 ok('bench offers only the front spot',await p.locator('.w-decor-spot').count()===1,{benchFree});
 // 막힌 자리 이유가 화면에 글로 보인다
 await selectWork(p,plan.blocked.id);await p.getByRole('button',{name:'식물',exact:true}).click();
 const why=await p.locator('.w-decor-spot small').allInnerTexts();
 ok('refused spot is disabled and explained in words',why.length>0,{why});
 // 취소: 바꾼 것이 있으면 먼저 묻는다
 await p.getByRole('button',{name:'취소'}).click();
 ok('cancel with changes asks first',await p.getByText('바꾼 배치를 버릴까요?').isVisible());
 await p.getByRole('button',{name:'계속 꾸미기'}).click();
 // 저장 실패 → 편집 상태와 배치 유지
 const shownBeforeFail=(await decorState(p)).shown;
 await p.evaluate(()=>{window.__put=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(...a){if(this.name==='prefs')throw new DOMException('quota','QuotaExceededError');return window.__put.apply(this,a);};});
 await p.getByRole('button',{name:'완료'}).click();await p.getByText('저장하지 못했어요',{exact:false}).waitFor();
 st=await decorState(p);ok('save failure keeps editing and the arrangement',await p.getByText('공간을 꾸미는 중').isVisible()&&st.shown===shownBeforeFail&&st.saved===0,st);
 await p.evaluate(()=>{IDBObjectStore.prototype.put=window.__put;});
 await p.getByRole('button',{name:'완료'}).click();await p.getByText('공간을 꾸미는 중').waitFor({state:'hidden'});
 st=await decorState(p);ok('done saves the arrangement',st.saved===shownBeforeFail&&st.shown===shownBeforeFail,st);
 await p.screenshot({path:`${out}/02-saved.png`});
 // Escape: 바꾼 것이 없으면 바로 나간다
 await tool(p,'공간 꾸미기');await p.keyboard.press('Escape');await p.waitForTimeout(200);
 ok('Escape without changes leaves immediately',!(await p.getByText('공간을 꾸미는 중').isVisible()));
 // 재방문: 새로고침 뒤 그대로
 await p.reload();await p.waitForFunction(()=>window.__uamWorld?.debugState?.().works>=14,null,{timeout:90000});await startWorld(p);await p.waitForTimeout(800);
 st=await decorState(p);ok('arrangement is there again after reload',st.shown===shownBeforeFail&&st.saved===shownBeforeFail&&st.theme==='forest',st);
 // 모드를 바꿔도 기록은 그대로, 다시 숲으로 오면 같은 배치
 await p.evaluate(()=>window.__uamWorld.setTheme('classic'));await p.waitForTimeout(800);const inClassic=await decorState(p);
 await p.evaluate(()=>window.__uamWorld.setTheme('forest'));await p.waitForTimeout(800);const back=await decorState(p);
 ok('mode change keeps the record and re-places by meaning',inClassic.saved===shownBeforeFail&&back.shown===shownBeforeFail,{inClassic,back});
 const after=await hashes(p);ok('artwork originals unchanged',Object.entries(before).every(([id,h])=>after[id]===h));
 // 같은 카메라로 꾸민 코너를 찍는다
 await p.evaluate(id=>{const e=window.__uamWorld,w=e.museum.works.get(id);e.updateCamera=()=>{};const n=w.normal;e.avatarRoot.visible=false;e.camera.position.set(w.group.position.x+n.x*5.2+n.z*1.6,2.1,w.group.position.z+n.z*5.2-n.x*1.6);e.camera.lookAt(w.group.position.x,1.1,w.group.position.z);},plan.free.id);
 await p.waitForTimeout(900);await p.screenshot({path:`${out}/03-corner.png`});
 ok('no page errors',errors.length===0,errors);
 await ctx.close();
 // 모바일: 편집 막대가 조이스틱을 가리지 않고 화면 안에 있다
 const m=await (await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'})).newPage();
 await m.goto('http://127.0.0.1:5173/app/world');await m.getByRole('button',{name:'샘플 미술관 둘러보기'}).click();await m.waitForFunction(()=>window.__uamWorld?.debugState?.().works>=14,null,{timeout:90000});
 await m.getByRole('button',{name:'더보기'}).click();await m.getByRole('button',{name:'공간 꾸미기'}).click();await m.waitForTimeout(800);
 const bar=await m.locator('.w-decor-bar').boundingBox(),joy=await m.locator('.joy').boundingBox().catch(()=>null);
 ok('mobile edit bar fits and leaves the joystick free',bar.x>=0&&bar.x+bar.width<=390&&bar.y>=0&&(!joy||bar.y+bar.height<=joy.y+2),{bar,joy});
 await m.screenshot({path:`${out}/04-mobile.png`});
}catch(e){ok('exception',false,String(e.stack??e));}finally{await browser.close();fs.writeFileSync(out+'/result.json',JSON.stringify(results,null,2));}
if(results.some(r=>!r.pass))process.exitCode=1;
