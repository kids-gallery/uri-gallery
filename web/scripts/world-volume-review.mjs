import {reviewBrowser} from './review-browser.mjs';
import fs from 'node:fs';
const out=process.argv[2]??'/private/tmp/uam-volume-20261020/visual-final';fs.mkdirSync(out,{recursive:true});
const browser=await reviewBrowser();
const page=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'reduce'});const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});
await page.goto('http://127.0.0.1:5173/app/world');await page.getByRole('button',{name:'테스트 계정으로 들어가기'}).click();await page.waitForFunction(()=>window.__uamWorld?.debugState().works>=14,null,{timeout:90000});
const result={errors,modes:[],avatars:[]};
await page.evaluate(()=>{window.__uamWorld.updateCamera=()=>{};window.__uamWorld.setInputPaused(true);});
for(const mode of ['classic','block','forest','toy']){
 await page.evaluate(mode=>{const e=window.__uamWorld;e.setTheme(mode);e.showPlaza();e.skipIntro();e.camera.position.set(24,18,48);e.camera.lookAt(0,3,13);},mode);await page.waitForTimeout(2000);
 await page.screenshot({path:`${out}/outside-${mode}.png`});result.modes.push(await page.evaluate(()=>window.__uamWorld.debugState()));
 await page.evaluate(()=>{const e=window.__uamWorld;e.enterMuseum();e.camera.position.set(7,4,9);e.camera.lookAt(-1,4,-7);});await page.waitForTimeout(700);await page.screenshot({path:`${out}/inside-${mode}.png`});
}
await page.evaluate(async()=>{const e=window.__uamWorld;e.showPlaza();e.setTheme('classic');e.avatarRoot.position.set(0,0,28);e.avatarRoot.rotation.y=0;const a=[...e.artworks.values()].find(a=>a.subject==='tiger');await e.setAvatar({...(await import('/src/app/world/avatar.ts')).DEFAULT_AVATAR,mode:'image'},a.original);});
for(const deg of [0,45,90,135,180,270]){await page.evaluate(deg=>{const e=window.__uamWorld,a=deg*Math.PI/180;e.camera.position.set(Math.sin(a)*3,1.15,28+Math.cos(a)*3);e.camera.lookAt(0,.8,28);},deg);await page.waitForTimeout(300);await page.screenshot({path:`${out}/avatar-${deg}.png`});}
result.avatars=await page.evaluate(async()=>{const e=window.__uamWorld,mod=await import('/src/app/world/avatarMesh.ts');const output=[];for(const a of e.artworks.values()){await e.setAvatar({...(await import('/src/app/world/avatar.ts')).DEFAULT_AVATAR,mode:'image'},a.original);const g=e.rig.skin.geometry;g.computeBoundingBox();const size=g.boundingBox.max.clone().sub(g.boundingBox.min);output.push({title:a.title,edges:mod.boundaryEdges(g),triangles:g.index.count/3,size:size.toArray(),rigid:e.rig.rigid});}return output;});
result.fallback=await page.evaluate(async()=>{const e=window.__uamWorld,c=document.createElement('canvas');c.width=300;c.height=200;const ctx=c.getContext('2d');ctx.fillStyle='#d49144';ctx.fillRect(0,0,300,200);const blob=await new Promise(resolve=>c.toBlob(resolve));await e.setAvatar({...(await import('/src/app/world/avatar.ts')).DEFAULT_AVATAR,mode:'image'},blob);const g=e.rig.skin.geometry;return {vertices:g.attributes.position.count,finite:Array.from(g.attributes.position.array).every(Number.isFinite),edges:(await import('/src/app/world/avatarMesh.ts')).boundaryEdges(g)};});
fs.writeFileSync(`${out}/visual-results.json`,JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));await browser.close();

if(errors.length||result.avatars.some(a=>a.edges!==0||!a.rigid)||result.fallback.vertices<100||!result.fallback.finite||result.fallback.edges!==0)process.exitCode=1;
