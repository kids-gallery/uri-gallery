// Run from web: node scripts/world-massing-review.mjs /absolute/evidence/path
// 3D미술관_재설계 §2-16: 현행 두 장면과 회색 모형 3안을 같은 카메라 네 가지로 찍고 덩어리별 화면 비중을 남긴다.
// 실제 GPU(설치된 Chrome)를 쓴다. 화면은 사람이 직접 보고 판단한다.
import {chromium} from '@playwright/test';import fs from 'node:fs';
const out=process.argv[2]??'/private/tmp/uam-massing-review';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome'});const result={errors:[],shots:[]};
try{
 const p=await browser.newPage({viewport:{width:1280,height:800}});p.on('pageerror',e=>result.errors.push(e.message));p.on('console',e=>{if(e.type()==='error')result.errors.push(e.text());});
 await p.goto('http://127.0.0.1:5173/massing.html');await p.waitForFunction(()=>!!window.__massing,null,{timeout:60000});
 result.renderer=await p.evaluate(()=>{const c=document.querySelector('canvas'),gl=c.getContext('webgl2'),ext=gl&&gl.getExtension('WEBGL_debug_renderer_info');return ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):'unknown';});
 for(const id of ['now-plaza','now-village','A','B','C'])for(const view of ['eye','game','overview','plan']){
  const r=await p.evaluate(([id,view])=>window.__massing.show(id,view),[id,view]);await p.waitForTimeout(150);
  await p.screenshot({path:`${out}/${id}-${view}.png`});result.shots.push(r);console.log(id,view,JSON.stringify(r.stats?.featured??null),JSON.stringify(r.stats?.share??{}).slice(0,200));
 }
}catch(e){result.errors.push(String(e.stack??e));}finally{await browser.close();fs.writeFileSync(out+'/massing.json',JSON.stringify(result,null,2));}
console.log('renderer',result.renderer,'errors',result.errors.length,result.errors.slice(0,3));if(result.errors.length)process.exitCode=1;
