// Run from web: node scripts/world-building-review.mjs /absolute/evidence/path
// 3D미술관_재설계 §2-7: 같은 카메라에서 모드마다 건물 8종을 찍고, 같은 모드 안 양식 쌍의 화면 차이 최솟값을 남긴다.
// 화면 차이는 보조 지표다. 사람이 contact 이미지를 직접 보고 실루엣 구분을 판정한다.
import {reviewBrowser} from './review-browser.mjs';import fs from 'node:fs';
const out=process.argv[2]??'/private/tmp/uam-building-review';fs.mkdirSync(out,{recursive:true});
const STYLES=['glass_pyramid','white_spiral','column_temple','clock_station','brick_chimney','golden_dome','hanok_roof','silver_wave'],MODES=['classic','block','forest','toy'];
const browser=await reviewBrowser();
const result={errors:[],modes:{}};
try{
 const page=await browser.newPage({viewport:{width:960,height:640},reducedMotion:'reduce'});page.on('pageerror',e=>result.errors.push(e.message));page.on('console',e=>{if(e.type()==='error')result.errors.push(e.text());});
 await page.goto('http://127.0.0.1:5173/app/world');await page.getByRole('button',{name:'테스트 계정으로 들어가기'}).click();await page.waitForFunction(()=>window.__uamWorld?.debugState().works>=14,null,{timeout:90000});
 await page.evaluate(()=>{const e=window.__uamWorld;e.updateCamera=()=>{};e.setInputPaused(true);e.showPlaza();e.skipIntro();e.avatarRoot.visible=false;});
 for(const mode of MODES){
  const shots=[];
  for(const style of STYLES){
   await page.evaluate(([mode,style])=>{const e=window.__uamWorld;e.setTheme(mode);e.setBuilding(style,'시험');e.camera.position.set(17,10,31);e.camera.lookAt(0,6,6);},[mode,style]);await page.waitForTimeout(400);
   await page.screenshot({path:`${out}/${mode}-${style}.png`});
   // 같은 프레임에서 렌더 결과를 작게 줄여 비교한다(UI 제외, 캔버스만).
   shots.push(await page.evaluate(()=>{const e=window.__uamWorld;e.renderer.render(e.scene,e.camera);const c=document.createElement('canvas');c.width=96;c.height=64;const x=c.getContext('2d');x.drawImage(e.renderer.domElement,0,0,96,64);return {pixels:Array.from(x.getImageData(0,0,96,64).data),triangles:e.renderer.info.render.triangles};}));
  }
  let min={diff:Infinity,pair:null};const pairs=[];
  for(let i=0;i<STYLES.length;i++)for(let j=i+1;j<STYLES.length;j++){const a=shots[i].pixels,b=shots[j].pixels;let s=0,n=0;for(let k=0;k<a.length;k+=4){s+=Math.abs(a[k]-b[k])+Math.abs(a[k+1]-b[k+1])+Math.abs(a[k+2]-b[k+2]);n+=3;}const diff=+(s/n).toFixed(2);pairs.push({a:STYLES[i],b:STYLES[j],diff});if(diff<min.diff)min={diff,pair:[STYLES[i],STYLES[j]]};}
  result.modes[mode]={minPairDiff:min,maxTriangles:Math.max(...shots.map(s=>s.triangles)),pairs};
  console.log(mode,'min pair diff',min.diff,min.pair?.join('/'),'max triangles',result.modes[mode].maxTriangles);
 }
}catch(e){result.errors.push(String(e.stack??e));}finally{await browser.close();fs.writeFileSync(out+'/building-results.json',JSON.stringify(result,null,2));}
console.log('errors',result.errors.length);if(result.errors.length)process.exitCode=1;
