// Run from web: node scripts/world-interior-review.mjs /absolute/evidence/path
// 3D미술관_재설계 §2-2 "대성당 실내": 같은 카메라로 미술관·대성당을 찍고, 작품 좌표 불변·삼각형·셰이더 수·오류를 기록한다.
// 화면 PNG는 사람이 직접 열어 판정한다. SwiftShader 수치는 실기기 성능이 아니다.
import {reviewBrowser} from './review-browser.mjs';import fs from 'node:fs';
const out=process.argv[2]??'/private/tmp/uam-interior-review';fs.mkdirSync(out,{recursive:true});const results=[];
const ok=(name,pass,detail)=>{results.push({name,pass,detail});console.log(pass?'PASS':'FAIL',name,detail===undefined?'':JSON.stringify(detail));};
const browser=await reviewBrowser();
const VIEWS={
 nave:[[0,2.0,'zEnd+2.5'],[0,8,-2]],
 crossing:[[2,1.7,9],[0,22,-3]],
 overview:[[4,5,10.5],[0,7,-24]],
 chapel:[['s*6.2',2.0,'cz+4.2'],['s*14',3.2,'cz-3']],
};
try{
 const page=await browser.newPage({viewport:{width:1280,height:800},reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});
 await page.goto('http://127.0.0.1:5173/app/world');await page.getByRole('button',{name:'테스트 계정으로 들어가기'}).click();await page.waitForFunction(()=>window.__uamWorld?.debugState().works===14,null,{timeout:90000});
 await page.evaluate(()=>{const e=window.__uamWorld;e.skipIntro();e.enterMuseum();});await page.waitForFunction(()=>window.__uamWorld.debugState().space==='inside',null,{timeout:30000});
 await page.evaluate(()=>{const e=window.__uamWorld;e.updateCamera=()=>{};e.setInputPaused(true);e.avatarRoot.visible=false;});
 const shot=async(interior)=>{const info={};for(const [name,[p,l]] of Object.entries(VIEWS)){
   await page.evaluate(([p,l])=>{const e=window.__uamWorld,m=e.museum,r=m.rooms[0],v=a=>typeof a==='number'?a:Function('zEnd','cz','s',`return ${a}`)(m.zEnd,r.cz,r.side);e.camera.position.set(v(p[0]),v(p[1]),v(p[2]));e.camera.lookAt(v(l[0]),v(l[1]),v(l[2]));return null;},[p,l]);
   await page.waitForTimeout(900);await page.screenshot({path:`${out}/${interior}-${name}.png`});info[name]=await page.evaluate(()=>window.__uamWorld.debugState().triangles);}
   return info;};
 const anyWork=await page.evaluate(()=>[...window.__uamWorld.museum.works.keys()][0]);
 const worldPos=()=>page.evaluate(id=>{const w=window.__uamWorld.museum.works.get(id);w.group.updateMatrixWorld(true);const p=w.relief.getWorldPosition(new w.relief.position.constructor());return [p.x,p.y,p.z].map(n=>+n.toFixed(3));},anyWork);
 const before=await worldPos();const gallery=await shot('gallery');
 const t0=Date.now();await page.evaluate(()=>window.__uamWorld.setInterior('cathedral'));const switchMs=Date.now()-t0;
 const cath=await shot('cathedral');const after=await worldPos();
 ok('artwork position unchanged by interior',JSON.stringify(before)===JSON.stringify(after),{before,after});
 ok('cathedral triangles within interior budget 250000',Object.values(cath).every(t=>t<=250000),{gallery,cathedral:cath,switchMs});
 // 순환 뒤 셰이더 수가 늘지 않는지
 const progs=[];for(let i=0;i<3;i++){for(const id of ['gallery','cathedral']){await page.evaluate(id=>window.__uamWorld.setInterior(id),id);await page.waitForTimeout(300);}progs.push(await page.evaluate(()=>window.__uamWorld.debugState().programs));}
 ok('shader programs stable after interior cycles',progs[2]===progs[1],progs);
 // 밖으로 나갔다 다시 들어와도 대성당 재질·반사가 유지되는지(반사 환경은 지워지지 않아야 한다)
 await page.evaluate(()=>{const e=window.__uamWorld;e.showPlaza();});await page.waitForTimeout(300);await page.evaluate(()=>{const e=window.__uamWorld;e.enterMuseum();});await page.waitForFunction(()=>window.__uamWorld.debugState().space==='inside',null,{timeout:30000});
 // 10/22 공간 재설계 뒤 대성당은 별도 객체가 아니라 같은 배치의 실내 양식이다(§2-2·2026-10-22 계약). 다시 들어와도 양식이 유지되는지 본다
 const env=await page.evaluate(()=>({interior:window.__uamWorld.interior}));
 ok('re-entry keeps cathedral interior',env.interior==='cathedral',env);
 await page.evaluate(()=>{const e=window.__uamWorld,m=e.museum,r=m.rooms[0];e.camera.position.set(r.side*6.2,2,r.cz+4.2);e.camera.lookAt(r.side*14,3.2,r.cz-3);});await page.waitForTimeout(900);await page.screenshot({path:`${out}/cathedral-reentry-chapel.png`});
 ok('no page errors',errors.length===0,errors);
}catch(e){ok('exception',false,String(e.stack??e));}finally{await browser.close();fs.writeFileSync(out+'/result.json',JSON.stringify(results,null,2));}
if(results.some(r=>!r.pass))process.exitCode=1;
