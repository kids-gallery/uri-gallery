// Run from web: node scripts/world-feel-review.mjs /absolute/evidence/path
// 3D미술관_재설계 §2-11 게임 완성도: 화면 마감(효과 켬/끔 같은 카메라), 공간 전환 흰빛(§2-17), 달리기 시야각, 키캡 안내를 실제 입력으로 확인한다.
import {reviewBrowser} from './review-browser.mjs';
// 엔진 흰빛을 매 프레임 기록한다(ms 동안). act는 기록을 시작한 뒤 부르는 엔진 동작
const wipeTrace=(page,act,ms)=>page.evaluate(([act,ms])=>new Promise(res=>{const e=window.__uamWorld,t0=performance.now(),xs=[];new Function('e',act)(e);xs.push({t:performance.now()-t0,w:e.debugState().wipe,space:e.debugState().space});const tick=()=>{xs.push({t:performance.now()-t0,w:e.debugState().wipe,space:e.debugState().space});if(performance.now()-t0<ms)requestAnimationFrame(tick);else res(xs);};requestAnimationFrame(tick);}),[act,ms]);import fs from 'node:fs';
const out=process.argv[2]??'/private/tmp/uam-feel-review';fs.mkdirSync(out,{recursive:true});const results=[];
const ok=(name,pass,detail)=>{results.push({name,pass,detail});console.log(pass?'PASS':'FAIL',name,detail===undefined?'':JSON.stringify(detail));};
const browser=await reviewBrowser();
async function open(reduced){const page=await browser.newPage({viewport:{width:1280,height:800},reducedMotion:reduced?'reduce':'no-preference'});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5173/app/world');await page.getByRole('button',{name:'테스트 계정으로 들어가기'}).click();await page.waitForFunction(()=>window.__uamWorld?.debugState().works===14,null,{timeout:90000});
 await page.evaluate(()=>window.__uamWorld.skipIntro());return {page,errors};}
try{
 // 1. 화면 마감: 같은 카메라에서 효과 끔/켬
 {const {page,errors}=await open(true);
  for(const label of ['plaza','cathedral']){
   if(label==='cathedral')await page.evaluate(async()=>{const e=window.__uamWorld;e.setInterior('cathedral');e.enterMuseum();});
   await page.waitForTimeout(600);
   await page.evaluate(l=>{const e=window.__uamWorld;e.updateCamera=()=>{};if(l==='plaza'){e.camera.position.set(10,4,40);e.camera.lookAt(0,4,8);}else{e.camera.position.set(4,5,10.5);e.camera.lookAt(0,7,-24);}},label);
   for(const on of [false,true]){await page.evaluate(on=>{window.__uamWorld.startRatio=on?0:99;},on);await page.waitForTimeout(700);await page.screenshot({path:`${out}/${label}-post-${on?'on':'off'}.png`});}
   ok(`${label} post-processing renders`,await page.evaluate(()=>!!window.__uamWorld.composer));
  }
  await page.evaluate(()=>{window.__uamWorld.setInterior('gallery');});
  const quick=await wipeTrace(page,'e.showPlaza()',700),lastLit=Math.max(0,...quick.filter(x=>x.w>0.01).map(x=>x.t));
  ok('reduced motion: space change is a short light cover, no dark overlay',Math.max(...quick.map(x=>x.w))>=0.9&&lastLit<=250&&await page.locator('.w-fade').count()===0,{lastLit:Math.round(lastLit)});
  ok('no page errors (reduced)',errors.length===0,errors);await page.close();}
 // 2. 페이드와 달리기 시야각(움직임 줄이기 아님)
 {const {page,errors}=await open(false);
  const enter=await wipeTrace(page,'e.enterMuseum()',8000),inside=enter.findIndex(x=>x.space==='inside');
  const coveredAtSwitch=inside>0&&Math.max(enter[inside].w,enter[inside-1].w)>=0.9,clearAfter=inside>0&&enter.filter(x=>x.t>enter[inside].t+500).every(x=>x.w<0.05);
  ok('entering walks into light and clears (no dark overlay)',coveredAtSwitch&&clearAfter&&await page.locator('.w-fade').count()===0,{switchAt:inside>0&&Math.round(enter[inside].t)});
  await page.evaluate(()=>{const e=window.__uamWorld;e.debugTeleport(0,7);});await page.locator('canvas').first().click({position:{x:640,y:120}}).catch(()=>{});
  const base=await page.evaluate(()=>window.__uamWorld.camera.fov);
  await page.keyboard.down('ShiftLeft');await page.keyboard.down('KeyS');await page.waitForTimeout(900);
  const running=await page.evaluate(()=>({fov:window.__uamWorld.camera.fov,kick:window.__uamWorld.fovKick}));
  await page.keyboard.up('KeyS');await page.keyboard.up('ShiftLeft');await page.waitForTimeout(1200);
  const after=await page.evaluate(()=>window.__uamWorld.camera.fov);
  ok('sprinting widens view and returns',running.fov>base+3&&Math.abs(after-base)<0.6,{base,running,after});
  await page.keyboard.down('KeyS');await page.waitForTimeout(700);const walk=await page.evaluate(()=>window.__uamWorld.fovKick);await page.keyboard.up('KeyS');
  ok('walking without Shift keeps view',walk<0.5,{walk});
  // 키캡 안내: 작품 앞
  await page.evaluate(()=>{const e=window.__uamWorld,w=[...e.museum.works.values()][0];e.debugTeleport(w.stand.x,w.stand.z);});await page.waitForTimeout(700);
  const prompt=page.locator('kbd').first();const has=await prompt.isVisible().catch(()=>false);
  ok('near artwork shows key prompt',has);if(has)await page.screenshot({path:`${out}/prompt.png`});
  ok('no page errors',errors.length===0,errors);await page.close();}
}catch(e){ok('exception',false,String(e.stack??e));}finally{await browser.close();fs.writeFileSync(out+'/result.json',JSON.stringify(results,null,2));}
if(results.some(r=>!r.pass))process.exitCode=1;
