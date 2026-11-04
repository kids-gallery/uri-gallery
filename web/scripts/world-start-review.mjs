// Run from web: node scripts/world-start-review.mjs /absolute/evidence/path
// 3D미술관_재설계 §2-17 기본 화면 틀: 시작 화면 → 시작 연출 → 도착, 건너뛰기, 움직임 줄이기, 첫 작품, 기본 HUD, 공간 전환, 390px.
// 매 프레임 카메라 위치·흰빛·HUD 투명도를 기록해 순간 이동이 흰빛 아래에서만 생기는지 본다. 합성 이미지만 쓴다.
import {reviewBrowser,tool} from './review-browser.mjs';import fs from 'node:fs';
const out=process.argv[2]??'/private/tmp/uam-start-review';fs.mkdirSync(out,{recursive:true});
const URL0='http://127.0.0.1:5173/app/world',results=[];
const ok=(name,pass,detail)=>{results.push({name,pass,detail});console.log(pass?'PASS':'FAIL',name,detail===undefined?'':JSON.stringify(detail));};
const browser=await reviewBrowser();
const watchErrors=p=>{const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error'&&!/favicon\.ico/.test(m.location()?.url??''))errs.push(m.text());});return errs;};
// 매 프레임 기록(6초)
const record=p=>p.evaluate(()=>{window.__seq=[];const e=window.__uamWorld,t0=performance.now();const tick=()=>{const c=e.camera.position,s=e.debugState(),el=document.querySelector('.hud-top .tools');window.__seq.push({t:performance.now()-t0,x:c.x,y:c.y,z:c.z,w:s.wipe,space:s.space,mode:s.mode,hud:el?+getComputedStyle(el).opacity:-1});if(performance.now()-t0<6000)requestAnimationFrame(tick);};requestAnimationFrame(tick);});
const seqOf=async p=>{await p.waitForFunction(()=>window.__seq.length&&window.__seq.at(-1).t>=5900,null,{timeout:20000});return p.evaluate(()=>window.__seq);};
// 한 프레임에 카메라가 1m 넘게 옮겨진 곳(순간 이동)
const jumps=seq=>{const r=[];for(let i=1;i<seq.length;i++){const a=seq[i-1],b=seq[i],d=Math.hypot(b.x-a.x,b.y-a.y,b.z-a.z);if(d>1)r.push({t:Math.round(b.t),d:+d.toFixed(2),w:+Math.max(a.w,b.w).toFixed(2)});}return r;};
const overlap=(a,b)=>!!a&&!!b&&a.left<b.right&&b.left<a.right&&a.top<b.bottom&&b.top<a.bottom;
const rectOf=async l=>{const r=await l.boundingBox();return r&&{left:r.x,top:r.y,right:r.x+r.width,bottom:r.y+r.height};};
const png=(p,hue)=>p.evaluate(async h=>{const c=document.createElement('canvas');c.width=400;c.height=300;const x=c.getContext('2d');x.fillStyle='#fffdf5';x.fillRect(0,0,400,300);x.fillStyle=`hsl(${h} 70% 50%)`;x.beginPath();x.arc(200,150,90,0,7);x.fill();const b=await new Promise(r=>c.toBlob(r,'image/png'));return Array.from(new Uint8Array(await b.arrayBuffer()));},hue);
const startButton=p=>p.getByRole('button',{name:'시작하기',exact:true});
const all=[];
try{
 // ── A. 데스크톱 처음 온 가족 ──
 {const ctx=await browser.newContext({viewport:{width:1280,height:800}});const p=await ctx.newPage();const errs=watchErrors(p);all.push(errs);
 await p.goto(URL0);await startButton(p).waitFor({timeout:90000});await p.waitForTimeout(800);
 const title=await p.evaluate(()=>({theme:window.__uamWorld.debugState().theme,mode:window.__uamWorld.debugState().mode,hud:document.querySelectorAll('.hud-top').length,focus:document.activeElement?.textContent?.trim()}));
 ok('title: own world in the new-family mode, no HUD, start button focused',title.theme==='forest'&&title.mode==='title'&&title.hud===0&&title.focus==='시작하기',title);
 ok('title: sample button and storage note for a new family',await p.getByRole('button',{name:'샘플 미술관 먼저 보기'}).isVisible()&&await p.getByText('이 기기에 저장돼요. 브라우저 데이터를 지우면 사라질 수 있어요').isVisible());
 await p.screenshot({path:out+'/a-title.png'});
 await record(p);await startButton(p).click();const seq=await seqOf(p);fs.writeFileSync(out+'/a-sequence.json',JSON.stringify(seq));
 const t0=seq.find(s=>s.mode==='start')?.t??0,full=seq.find(s=>s.hud>=0.999),firstInside=seq.findIndex(s=>s.space==='inside');
 ok('start to full HUD within 4 s',!!full&&full.t-t0<=4000,{ms:full&&Math.round(full.t-t0)});
 const j=jumps(seq);ok('camera jumps only under the light (wipe >= 0.9)',j.every(x=>x.w>=0.9),j);
 ok('space switches while the light covers the screen',firstInside>0&&Math.max(seq[firstInside].w,seq[firstInside-1].w)>=0.9,{w:firstInside>0&&seq[firstInside].w});
 ok('HUD fades in over several frames',seq.filter(s=>s.hud>0.05&&s.hud<0.95).length>=2,{frames:seq.filter(s=>s.hud>0.05&&s.hud<0.95).length});
 const arrive=await p.evaluate(()=>({theme:window.__uamWorld.debugState().theme,space:window.__uamWorld.debugState().space}));ok('arrival keeps the title mode and is inside',arrive.theme===title.theme&&arrive.space==='inside',arrive);
 const card=p.locator('.w-first-work');ok('empty family sees the first-artwork prompt with focus on [사진 고르기]',await card.isVisible()&&await p.evaluate(()=>document.activeElement?.textContent?.trim())==='사진 고르기');
 // §2-23: 로비에는 작품을 걸지 않는다(빈 대표작 자리도 없다). 첫 작품은 안내 카드로 올린다
 const lobby=await p.evaluate(()=>window.__uamWorld.museum.featured.children.length);ok('lobby hangs no artwork; the first-artwork card is the prompt (§2-23)',lobby===0&&await card.isVisible(),{lobby});
 ok('desktop: at most 4 buttons always visible, no joystick',await p.locator('.tools > button:visible').count()<=4&&await p.locator('.joy').count()===0,{visible:await p.locator('.tools > button:visible').allInnerTexts()});
 await p.screenshot({path:out+'/a-arrival.png'});
 await p.locator('.w-more-tools').click();const menu=await p.locator('#w-secondary-menu button:visible').allInnerTexts();
 ok('[더보기] holds every other function',['보관함','전시실 추가','공간 꾸미기','모드','캐릭터','친구 초대','소리 끄기','설정','사용법','밖으로'].every(n=>menu.includes(n)),menu);
 await p.keyboard.press('Escape');ok('Escape closes [더보기] and returns focus',await p.locator('.w-more-tools').getAttribute('aria-expanded')==='false'&&await p.evaluate(()=>document.activeElement?.classList.contains('w-more-tools')));
 // 첫 작품: 걷지 않고 흰빛 전환으로 그 전시관의 작품 앞에 서고(§2-23 C), 결과 카드는 그 뒤에 작품과 겹치지 않게
 const before=await p.evaluate(()=>{const s=window.__uamWorld.debugState();return {x:s.x,z:s.z};});
 const fc=p.waitForEvent('filechooser');await p.getByRole('button',{name:'사진 고르기',exact:true}).click();await (await fc).setFiles([{name:'첫 그림.png',mimeType:'image/png',buffer:Buffer.from(await png(p,200))}]);
 await p.evaluate(()=>{window.__maxWipe=0;const e=window.__uamWorld;const tick=()=>{window.__maxWipe=Math.max(window.__maxWipe,e.debugState().wipe);if(!document.querySelector('.w-saved'))requestAnimationFrame(tick);};requestAnimationFrame(tick);});
 await p.locator('.w-saved').waitFor({timeout:30000});
 const after=await p.evaluate(()=>{const e=window.__uamWorld,s=e.debugState(),w=e.museum.works.get(s.featured);return {x:s.x,z:s.z,featured:s.featured,standDist:w?Math.hypot(s.x-w.stand.x,s.z-w.stand.z):null,route:e.route.length,maxWipe:window.__maxWipe,plaque:document.querySelectorAll('.plaque').length};});
 ok('first artwork: white-flash jump in front of it in its hall, no walking (§2-23 C)',after.standDist!==null&&after.standDist<0.6&&after.route===0&&after.maxWipe>=0.5&&!!after.featured,{before,after});
 const rect=await p.evaluate(id=>window.__uamWorld.debugWorkRect(id),after.featured);ok('result card alone and clear of the artwork',after.plaque===0&&!!rect&&!overlap(rect,await rectOf(p.locator('.w-saved'))),{rect});
 await p.screenshot({path:out+'/a-first-artwork.png'});
 await p.locator('.w-saved').getByRole('button',{name:'닫기'}).click();
 // 공간 전환: 흰빛, 검은 덮개 없음
 await record(p);await tool(p,'밖으로');const out1=await seqOf(p);
 ok('going outside flashes the light, not black',Math.max(...out1.map(s=>s.w))>=0.9&&await p.locator('.w-fade').count()===0&&out1.at(-1).space==='plaza');
 // 다시 온 가족
 await p.reload();await startButton(p).waitFor({timeout:90000});
 ok('returning title names the museum and count',/우리 아이의 미술관 · 작품 1점/.test(await p.locator('.w-entry-lead').innerText()),await p.locator('.w-entry-lead').innerText());
 await startButton(p).click();await p.waitForFunction(()=>window.__uamWorld.debugState().mode==='play',null,{timeout:20000});await p.waitForTimeout(600);
 const back=await p.evaluate(()=>{const e=window.__uamWorld,s=e.debugState();return {space:s.space,place:s.place,lobby:e.museum.featured.children.length};});
 ok('returning family lands inside with no prompt and no lobby artwork (§2-23)',back.space==='inside'&&back.lobby===0&&await p.locator('.w-first-work').count()===0,back);
 await p.screenshot({path:out+'/a-return.png'});
 await ctx.close();}

 // ── B. 건너뛰기: 화면 누르기, 키 ──
 for(const how of ['click','key']){const ctx=await browser.newContext({viewport:{width:1280,height:800}});const p=await ctx.newPage();all.push(watchErrors(p));
  await p.goto(URL0);await startButton(p).waitFor({timeout:90000});await startButton(p).click();await p.waitForTimeout(500);
  const t=Date.now();if(how==='click')await p.mouse.click(640,400);else await p.keyboard.press('KeyA');
  await p.waitForFunction(()=>window.__uamWorld.debugState().mode==='play',null,{timeout:5000});const ms=Date.now()-t;
  const st=await p.evaluate(()=>window.__uamWorld.debugState());ok(`skip by ${how} reaches arrival within 0.3 s (+0.15 s measuring)`,ms<=450&&st.space==='inside',{ms,space:st.space});
  await ctx.close();}

 // ── C. 움직임 줄이기 ──
 {const ctx=await browser.newContext({viewport:{width:1280,height:800},reducedMotion:'reduce'});const p=await ctx.newPage();all.push(watchErrors(p));
 await p.goto(URL0);await startButton(p).waitFor({timeout:90000});await p.waitForTimeout(500);
 await record(p);await startButton(p).click();const seq=await seqOf(p);
 const t0=seq.find(s=>s.mode==='start')?.t??0,play=seq.find(s=>s.mode==='play'),moving=seq.filter((s,i)=>i&&s.mode!=='play'&&Math.hypot(s.x-seq[i-1].x,s.y-seq[i-1].y,s.z-seq[i-1].z)>0.01).length;
 ok('reduced motion: no camera flight, arrival within 0.5 s',!!play&&play.t-t0<=500&&moving<=1&&jumps(seq).every(x=>x.w>=0.9),{ms:play&&Math.round(play.t-t0),moving,jumps:jumps(seq)});
 await ctx.close();}

 // ── D. 휴대폰 390px ──
 {const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const p=await ctx.newPage();all.push(watchErrors(p));
 await p.goto(URL0);await startButton(p).waitFor({timeout:90000});await p.waitForTimeout(600);
 const titleBox=await p.locator('.w-title-card').boundingBox();const o1=await p.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
 ok('390px title fits',o1<=0&&titleBox.x>=0&&titleBox.x+titleBox.width<=390,{overflow:o1,titleBox});await p.screenshot({path:out+'/d-mobile-title.png'});
 await startButton(p).click();await p.waitForFunction(()=>window.__uamWorld.debugState().mode==='play',null,{timeout:20000});await p.waitForTimeout(700);
 const o2=await p.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
 ok('390px arrival fits, joystick shown, at most 4 buttons',o2<=0&&await p.locator('.joy').count()===1&&await p.locator('.tools > button:visible').count()<=4,{overflow:o2});
 await p.screenshot({path:out+'/d-mobile-arrival.png'});await ctx.close();}

 // ── E. 샘플, 개발용 입구 ──
 {const ctx=await browser.newContext({viewport:{width:1280,height:800}});const p=await ctx.newPage();all.push(watchErrors(p));
 await p.goto(URL0);await startButton(p).waitFor({timeout:90000});await p.getByRole('button',{name:'샘플 미술관 먼저 보기'}).click();
 await p.waitForFunction(()=>window.__uamWorld.debugState().mode==='play',null,{timeout:30000});
 const st=await p.evaluate(()=>window.__uamWorld.debugState());ok('sample path arrives at a featured sample, no first prompt',st.works===14&&!!st.featured&&await p.locator('.w-first-work').count()===0,{works:st.works,featured:st.featured});
 await ctx.close();}
 {const ctx=await browser.newContext({viewport:{width:1280,height:800}});const p=await ctx.newPage();all.push(watchErrors(p));
 await p.goto(URL0);await p.getByRole('button',{name:'테스트 계정으로 들어가기'}).click();await p.waitForFunction(()=>window.__uamWorld?.debugState().works===14,null,{timeout:90000});
 const st=await p.evaluate(()=>window.__uamWorld.debugState());ok('dev test entry goes straight to the plaza (existing reviews)',st.space==='plaza'&&st.mode==='play',{space:st.space,mode:st.mode});
 await ctx.close();}
 ok('no page or console errors (favicon request excluded)',all.every(e=>e.length===0),all.flat());
}catch(e){ok('exception',false,String(e.stack??e));}
finally{await browser.close();fs.writeFileSync(out+'/result.json',JSON.stringify(results,null,2));}
console.log(`${results.filter(r=>r.pass).length}/${results.length}`);if(results.some(r=>!r.pass))process.exitCode=1;
