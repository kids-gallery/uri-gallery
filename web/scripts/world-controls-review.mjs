// Run from web: node scripts/world-controls-review.mjs /absolute/evidence/path
// 3D미술관_재설계 §2-1·§2-11·§2-17: 키보드 걷기·조이스틱(터치 기기)·끌어서 돌려 보기·점프·손 흔들기·춤을 실제 입력으로 조작한다.
import {reviewBrowser} from './review-browser.mjs';import fs from 'node:fs';
const out=process.argv[2]??'/private/tmp/uam-controls-review';fs.mkdirSync(out,{recursive:true});const results=[];
const ok=(name,pass,detail)=>{results.push({name,pass,detail});console.log(pass?'PASS':'FAIL',name,detail===undefined?'':JSON.stringify(detail));};
const browser=await reviewBrowser();
const pos=p=>p.evaluate(()=>{const e=window.__uamWorld,a=e.avatarRoot.position;return {x:a.x,y:a.y,z:a.z,yaw:e.yaw,action:e.action};});
const dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
try{
 for(const [label,viewport,touch] of [['pc',{width:1280,height:800},false],['mobile',{width:390,height:844},true]]){
  const page=await browser.newPage({viewport,isMobile:touch,hasTouch:touch,reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:5173/app/world');await page.getByRole('button',{name:'테스트 계정으로 들어가기'}).click();await page.waitForFunction(()=>window.__uamWorld?.debugState().works===14,null,{timeout:90000});
  await page.evaluate(()=>{const e=window.__uamWorld;e.skipIntro();e.debugTeleport(0,30);});await page.waitForTimeout(300);
  if(!touch){
   const a=await pos(page);await page.locator('canvas').first().click({position:{x:640,y:200}}).catch(()=>{});await page.evaluate(()=>window.__uamWorld.debugTeleport(0,30));
   await page.keyboard.down('KeyW');await page.waitForTimeout(900);await page.keyboard.up('KeyW');const b=await pos(page);await page.waitForTimeout(500);const c=await pos(page);
   ok(`${label} W key walks and stops on release`,dist(a,b)>.6&&dist(b,c)<.15,{moved:+dist(a,b).toFixed(2),after:+dist(b,c).toFixed(2)});
   const y0=(await pos(page)).yaw;const cv=await page.locator('canvas').first().boundingBox();await page.mouse.move(cv.x+700,cv.y+420);await page.mouse.down();await page.mouse.move(cv.x+900,cv.y+420,{steps:8});await page.mouse.up();
   ok(`${label} drag rotates camera`,Math.abs((await pos(page)).yaw-y0)>.05,{before:y0,after:(await pos(page)).yaw});
  }
  // 걷기 막대는 터치 기기에서만 보인다(3D미술관_재설계 §2-17). 키보드 기기에는 없어야 한다
  if(!touch)ok(`${label} no joystick on a keyboard device`,await page.locator('.joy').count()===0);
  else{const joy=page.locator('.joy');const jb=await joy.boundingBox();const j0=await pos(page);
  await page.mouse.move(jb.x+jb.width/2,jb.y+jb.height/2);await page.mouse.down();await page.mouse.move(jb.x+jb.width/2,jb.y+4,{steps:4});await page.waitForTimeout(900);await page.mouse.up();
  const j1=await pos(page);await page.waitForTimeout(500);const j2=await pos(page);
  ok(`${label} joystick walks and stops on release`,dist(j0,j1)>.6&&dist(j1,j2)<.15,{moved:+dist(j0,j1).toFixed(2),after:+dist(j1,j2).toFixed(2)});}
  await page.getByRole('button',{name:'점프',exact:true}).click();let top=0;for(let i=0;i<12;i++){top=Math.max(top,(await pos(page)).y);await page.waitForTimeout(60);}await page.waitForTimeout(1200);
  ok(`${label} jump button lifts and lands`,top>.2&&(await pos(page)).y<.03,{top:+top.toFixed(2)});
  await page.getByRole('button',{name:'동작',exact:true}).click();await page.getByRole('menuitem',{name:'손 흔들기',exact:true}).click();ok(`${label} wave button starts wave`,(await pos(page)).action==='wave');
  await page.getByRole('button',{name:'동작',exact:true}).click();await page.getByRole('menuitem',{name:'신나는 춤',exact:true}).click();ok(`${label} dance menu starts dance (§2-20)`,(await pos(page)).action==='dance');
  await page.screenshot({path:`${out}/${label}-controls.png`});
  ok(`${label} no page errors`,errors.length===0,errors);await page.close();
 }
}catch(e){ok('exception',false,String(e.stack??e));}finally{await browser.close();fs.writeFileSync(out+'/result.json',JSON.stringify(results,null,2));}
if(results.some(r=>!r.pass))process.exitCode=1;
