import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { MuseumStyle } from '../character/names';
import type { ThemeId } from './themes';
import { grassPatches,largeUV,loadSurface,worldUV } from './materials';

export interface BuildingData { id:string; child:string; style:MuseumStyle; mine:boolean }
const LOOKS={classic:{stone:'#ddd0b5',roof:'#6f837b',ground:'#87a478',path:'#d6c7a8',sky:'#74a9c1',horizon:'#efe5d0',water:'#69b2c1',leaf:'#537854',ui:'#f7edda',ink:'#4e392f'},block:{stone:'#b8ad93',roof:'#775341',ground:'#609442',path:'#bfa078',sky:'#78bdeb',horizon:'#d5e8ed',water:'#3a87b4',leaf:'#3e773c',ui:'#e4eacb',ink:'#263d25'},forest:{stone:'#b78c63',roof:'#5b8265',ground:'#a6b88c',path:'#dbbd97',sky:'#c58e93',horizon:'#ffe3b1',water:'#84b4b0',leaf:'#77976b',ui:'#edf1dc',ink:'#304839'},toy:{stone:'#eebf51',roof:'#4689ac',ground:'#91c8b0',path:'#f4ddac',sky:'#83c7df',horizon:'#f9e5bc',water:'#49afd0',leaf:'#58a38c',ui:'#fff0c9',ink:'#3b4561'}};
export const WORLD_LOOKS=LOOKS;
export class Outdoor {
 private ambience:THREE.Points;
 private reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches??false;
 readonly root=new THREE.Group();readonly sky:THREE.Mesh;readonly floor:THREE.Mesh;
 readonly buildings=new THREE.Group();readonly landscape=new THREE.Group();readonly clouds=new THREE.Group();readonly doors:THREE.Group[]=[];
 readonly cameraSolids:THREE.Object3D[]=[];
 readonly pickables:THREE.Object3D[]=[];readonly positions=new Map<string,THREE.Vector3>();
 private mats={masonry:new THREE.MeshStandardMaterial({roughness:.9}),stone:new THREE.MeshStandardMaterial(),roof:new THREE.MeshStandardMaterial(),ground:new THREE.MeshStandardMaterial(),path:new THREE.MeshStandardMaterial(),water:new THREE.MeshStandardMaterial({metalness:.25,roughness:.3}),leaf:new THREE.MeshStandardMaterial(),glass:new THREE.MeshStandardMaterial({color:'#7495a0',metalness:.55,roughness:.2}),trim:new THREE.MeshStandardMaterial({color:'#c8a35b',metalness:.6,roughness:.3}),tile:new THREE.MeshStandardMaterial({color:'#c4785a',roughness:.85}),cloth:new THREE.MeshStandardMaterial({color:'#f6ecd8',roughness:.95,side:THREE.DoubleSide}),dark:new THREE.MeshStandardMaterial({color:'#293b3d',roughness:.7}),cloud:new THREE.MeshStandardMaterial({color:'#fff8e6',roughness:1})};
 private shader:THREE.ShaderMaterial;
 private surfaces={paving:loadSurface('cobblestone_floor_08'),brick:loadSurface('brown_brick_02'),grass:loadSurface('aerial_grass_rock')};private patches=grassPatches();
 private obstacles:Array<{x:number;z:number;w:number;d:number}>=[];
 private ownGeometries=new Set<THREE.BufferGeometry>();private labels:THREE.Texture[]=[];
 private specs:BuildingData[]=[];private town=false;current:ThemeId='classic';
 constructor(){
  Object.assign(this.mats.masonry,this.surfaces.brick);
  this.shader=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,uniforms:{top:{value:new THREE.Color()},bottom:{value:new THREE.Color()}},vertexShader:'varying vec3 vPos;void main(){vPos=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:'uniform vec3 top;uniform vec3 bottom;varying vec3 vPos;void main(){float t=smoothstep(-20.0,120.0,vPos.y);vec3 c=mix(bottom,top,t);gl_FragColor=vec4(pow(c,vec3(2.2)),1.0);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}' });
  // 하늘은 직접 렌더와 화면 마감(후처리) 경로에서 같은 색이어야 한다: 예전처럼 보이던 표시 값을 선형으로 되돌린 뒤 표준 톤 매핑·색 공간 변환을 거친다
  this.sky=new THREE.Mesh(new THREE.SphereGeometry(230,32,16),this.shader);this.sky.frustumCulled=false;
  this.floor=new THREE.Mesh(new THREE.PlaneGeometry(350,350),this.mats.ground);this.floor.rotation.x=-Math.PI/2;this.floor.position.y=-.03;this.floor.userData.floor=true;this.floor.receiveShadow=true;
  worldUV(this.floor.geometry,2);largeUV(this.floor.geometry);
  const points=new Float32Array(64*3);for(let i=0;i<64;i++){points[i*3]=Math.sin(i*7.13)*25;points[i*3+1]=1+(i%13)*.65;points[i*3+2]=12+((i*17)%45);}
  const pg=new THREE.BufferGeometry();pg.setAttribute('position',new THREE.BufferAttribute(points,3));this.ambience=new THREE.Points(pg,new THREE.PointsMaterial({size:.045,color:'#ffe8ba',transparent:true,opacity:.35,depthWrite:false}));this.root.add(this.ambience);
  this.root.add(this.sky,this.floor,this.buildings,this.landscape,this.clouds);this.apply('classic');
 }
 private mesh(geo:THREE.BufferGeometry,mat:THREE.Material,parent:THREE.Object3D,x=0,y=0,z=0,sx=1,sy=1,sz=1){this.ownGeometries.add(geo);if(mat instanceof THREE.MeshStandardMaterial)worldUV(geo);if(mat===this.mats.ground)largeUV(geo);const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
 private box(parent:THREE.Object3D,mat:THREE.Material,x:number,y:number,z:number,w:number,h:number,d:number){return this.mesh(new THREE.BoxGeometry(w,h,d),mat,parent,x,y,z);}
 private instance(parent:THREE.Object3D,geo:THREE.BufferGeometry,mat:THREE.Material,points:Array<[number,number,number]>) {this.ownGeometries.add(geo);const m=new THREE.InstancedMesh(geo,mat,points.length),matrix=new THREE.Matrix4();points.forEach((p,i)=>m.setMatrixAt(i,matrix.makeTranslation(...p)));m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
 private clear(){this.obstacles=[];this.cameraSolids.length=0;for(const g of this.ownGeometries)g.dispose();this.ownGeometries.clear();for(const t of this.labels)t.dispose();this.labels=[];for(const g of [this.buildings,this.landscape,this.clouds]){g.traverse(o=>{if(o.userData.label)(o as THREE.Mesh).material instanceof THREE.Material&&((o as THREE.Mesh).material as THREE.Material).dispose();});g.clear();}this.pickables.length=0;this.doors.length=0;this.positions.clear();}
 setBuildings(specs:BuildingData[],town=false){this.specs=specs;this.town=town;this.rebuild();}
 /** 내 미술관 정면 현수막(§2-14): 대표작 원본. 다른 가족 건물에는 걸지 않는다 */
 private banner:{texture:THREE.Texture;aspect:number;owner:string}|null=null;
 /** owner: 현수막을 걸 내 건물 ID. 친구 미술관 방문처럼 다른 건물이 같은 자리에 서도 그 건물에는 걸지 않는다 */
 setBanner(b:{texture:THREE.Texture;aspect:number;owner:string}|null){if(this.banner?.texture===b?.texture&&this.banner?.aspect===b?.aspect&&this.banner?.owner===b?.owner)return;this.banner=b;if(this.specs.length&&this.root.visible)this.rebuild();}
 private hangBanners(g:THREE.Group){
  const b=this.banner;if(!b||this.current!=='classic')return;
  // 작품은 기둥 사이 폭 1.8m를 기준으로 키우고(세로형은 높이 3.4m까지) 천은 작품 둘레만 둔다(§2-14 마지막 시각 보정). 원본 비율 유지
  let w=1.8,h=w/b.aspect;if(h>3.4){h=3.4;w=h*b.aspect;}
  const top=6.1,cy=top-.12-h/2;
  for(const x of [-4,4]){
   const cloth=this.mesh(new THREE.PlaneGeometry(w+.16,h+.3),this.mats.cloth,g,x,top-(h+.3)/2,6.12);cloth.castShadow=false;
   // 작품 면은 원래 UV를 그대로 쓴다(공간 단위 UV를 씌우지 않는다). 질감은 실내와 함께 쓰므로 재질만 지운다
   const artGeo=new THREE.PlaneGeometry(w,h);this.ownGeometries.add(artGeo);
   const art=new THREE.Mesh(artGeo,new THREE.MeshStandardMaterial({map:b.texture,roughness:.9,emissive:'#ffffff',emissiveMap:b.texture,emissiveIntensity:.12}));art.position.set(x,cy,6.14);art.userData.label=true;art.name='artwork-banner';g.add(art);
   const rod=this.mesh(new THREE.CylinderGeometry(.05,.05,w+.4,8),this.mats.trim,g,x,top+.05,6.14);rod.rotation.z=Math.PI/2;
  }
 }
 private rebuild(){this.clear();const mode=this.current,boxy=mode==='block',forest=mode==='forest';
  this.specs.forEach((s,i)=>{const g=this.build(s.style,this.town);if(s.mine&&s.id===this.banner?.owner)this.hangBanners(g);const col=i%5,row=Math.floor(i/5);const x=this.town?(col-(Math.min(5,this.specs.length-row*5)-1)/2)*26:0,z=this.town?-row*26:6;g.position.set(x,0,z);g.userData.buildingId=s.id;this.buildings.add(g);this.positions.set(s.id,new THREE.Vector3(x,0,z+12));
   g.traverse(o=>{if((o as THREE.Mesh).isMesh){o.userData.buildingId=s.id;this.pickables.push(o);}});
   const c=document.createElement('canvas');c.width=512;c.height=128;const ctx=c.getContext('2d')!;ctx.fillStyle='#fff4dc';ctx.fillRect(0,0,512,128);ctx.strokeStyle='#b69b63';ctx.lineWidth=8;ctx.strokeRect(6,6,500,116);ctx.fillStyle='#493e35';ctx.font='600 32px sans-serif';ctx.textAlign='center';ctx.fillText(`${s.child}의 미술관`,256,76,480);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;this.labels.push(t);const sign=this.mesh(new THREE.PlaneGeometry(4.5,1.125),new THREE.MeshBasicMaterial({map:t}),g,-6,2,9);sign.userData.label=true;this.box(g,this.mats.trim,-6,.9,8.96,.12,1.8,.12);
  });
  this.garden();
  for(let i=0;i<16;i++){const a=i*2.4,r=75+(i%3)*15;const cloud=new THREE.Group();cloud.position.set(Math.sin(a)*r,32+(i%5)*3,Math.cos(a)*r);for(let j=0;j<3;j++)this.mesh(boxy?new THREE.BoxGeometry(8,3,4):new THREE.SphereGeometry(3.5,12,8),this.mats.cloud,cloud,j*5,Math.sin(j)*1.4,0,1,boxy?1:.6,1);this.clouds.add(cloud);}
  this.mesh(boxy?new THREE.BoxGeometry(7,7,2):new THREE.SphereGeometry(4,16,12),new THREE.MeshBasicMaterial({color:forest?'#ffd49a':'#fff4bd'}),this.clouds,55,48,-70).userData.label=true;
  for(const group of [this.buildings,this.landscape])group.traverse(o=>{if(o instanceof THREE.Mesh&&o.material!==this.mats.water&&!o.userData.label)this.cameraSolids.push(o);});this.root.updateMatrixWorld(true);
 }
 private garden(){
  const g=this.landscape,m=this.mats,mode=this.current;
  const block=(x:number,z:number,w:number,d:number)=>this.obstacles.push({x,z,w,d});
  // Town streets remain wide enough to reach every museum; garden props stay in the foreground.
  if(mode!=='forest'||this.town)this.box(g,m.path,0,-.025,this.town?-55:38,this.town?145:7,.04,this.town?200:66);
  if(mode==='classic'){
    this.box(g,m.path,0,.005,29,43,.05,10);
    for(const side of [-1,1]){
      const x=side*17;
      this.box(g,m.stone,x,.2,29,8,.4,17);
      this.box(g,m.water,x,.43,29,7.2,.04,16.2);block(x,29,8,17);
      for(const dx of [-3.8,3.8])this.box(g,m.stone,x+dx,.5,29,.35,.22,17.2);
      for(const dz of [-8.3,8.3])this.box(g,m.stone,x,.5,29+dz,8,.22,.35);
      this.mesh(new THREE.CylinderGeometry(.65,1.1,1.3,16),m.stone,g,x,1,29);
      this.mesh(new THREE.CylinderGeometry(1.7,1.2,.3,24),m.stone,g,x,1.8,29);
      this.mesh(new THREE.CylinderGeometry(.25,.5,1.2,16),m.stone,g,x,2.5,29);
      this.mesh(new THREE.SphereGeometry(.4,12,8),m.water,g,x,3.2,29);
      for(let j=0;j<7;j++)this.box(g,m.leaf,side*27,.65,15+j*6,1.8,1.3,4.8);
    }
  }else if(mode==='block'){
    for(const side of [-1,1])for(let i=0;i<5;i++){
      const x=side*(15+i%2*5),z=17+i*9;
      for(let k=0;k<3;k++)this.box(g,k===2?m.leaf:m.stone,x, .4+k*.8,z,8-k*2,.8,7-k);
      block(x,z,8,7);
      for(let k=0;k<3;k++)this.box(g,m.glass,x-2+k,2.6,z,.55,.55,.55);
    }
    for(const x of [-8,8]){this.box(g,m.stone,x,.08,35,2.4,.16,43);this.box(g,m.water,x,.18,35,1.6,.06,42);block(x,35,2.4,43);}
    for(let z=16;z<62;z+=6)this.box(g,m.roof,0,.025,z,6,.07,.16);
  }else if(mode==='forest'){
    for(const side of [-1,1])for(let i=0;i<5;i++){
      const x=side*(22+i%2*6),z=12+i*11;
      this.mesh(new THREE.SphereGeometry(6,16,10),m.ground,g,x,-1.6,z,1,.48,1.3);
    }
    const pond=this.mesh(new THREE.CylinderGeometry(6,6,.12,32),m.water,g,-16,.05,30,1,1,1.45);pond.name='woodland-pond';block(-16,30,12,17);
    for(let i=0;i<15;i++){const a=i*Math.PI*2/15;this.mesh(new THREE.DodecahedronGeometry(.7,0),m.stone,g,-16+Math.cos(a)*6,.25,30+Math.sin(a)*8.7,1,.7,1);}
    for(let i=0;i<18;i++){const z=15+i*2.5,x=Math.sin(i*.35)*2;this.mesh(new THREE.CylinderGeometry(1.6,1.8,.08,7),m.path,g,x,.045,z,1,1,.85);}
    for(let i=0;i<12;i++){const x=10+(i%3)*2,z=18+Math.floor(i/3)*9;this.mesh(new THREE.CylinderGeometry(.08,.15,.5,6),m.stone,g,x,.25,z);this.mesh(new THREE.SphereGeometry(.4,10,6,0,Math.PI*2,0,Math.PI/2),m.roof,g,x,.5,z,1,.65,1);}
  }else{
    for(let row=0;row<9;row++)for(let col=0;col<7;col++){
      const x=(col-3)*5,z=14+row*5,mat=(row+col)%3===0?m.stone:(row+col)%3===1?m.path:m.roof;
      this.box(g,mat,x,.015,z,4.85,.09,4.85);
      if(Math.abs(x)>5&&row%2===0)this.mesh(new THREE.CylinderGeometry(.65,.65,.12,16),mat,g,x+2.2,.1,z);
    }
    for(const side of [-1,1]){
      this.mesh(new THREE.TorusGeometry(3,.5,10,32),m.trim,g,side*14,3.2,29);block(side*14,29,7,1.2);
      this.mesh(new THREE.CylinderGeometry(.16,.25,6,12),m.roof,g,side*22,3,43);
      for(let i=0;i<4;i++){const blade=this.box(g,i%2?m.roof:m.stone,side*22+Math.cos(i*Math.PI/2)*1.2,6+Math.sin(i*Math.PI/2)*1.2,43,2,.7,.2);blade.rotation.z=i*Math.PI/2+.4;}
    }
  }
  if(!this.town)for(let i=0;i<15;i++){const x=-42+i*6,z=-13-Math.sin(i)*4;this.tree(x,z,i);block(x,z,.8,.8);}
  for(let i=0;i<(this.town?20:24);i++){
    const x=(i%2?-1:1)*(30+(i%3)*4),z=3+Math.floor(i/2)*6;
    this.tree(x,z,i);block(x,z,.8,.8);
  }
  for(const side of [-1,1])for(const z of [19,41,56]){
    const x=side*(mode==='block'?12:10);this.bench(x,z);block(x,z,3.4,1.1);
    if(mode==='classic'){
      this.mesh(new THREE.CylinderGeometry(.07,.12,3.5,8),m.dark,g,x,1.75,z+3);
      this.box(g,m.dark,x,3.6,z+3,.5,.7,.5);this.box(g,m.cloud,x,3.6,z+3,.36,.55,.36);
      this.mesh(new THREE.ConeGeometry(.5,.35,4),m.dark,g,x,4.08,z+3).rotation.y=Math.PI/4;
    }
  }
  if(!this.town)for(const side of [-1,1]){
    for(let z=6;z<73;z+=3){
      this.box(g,mode==='forest'?m.roof:m.stone,side*39,.8,z,.3,1.6,.3);
      if(mode==='toy')this.mesh(new THREE.SphereGeometry(.3,8,6),m.trim,g,side*39,1.7,z);
    }
    for(const y of [.5,1.2])this.box(g,mode==='forest'?m.roof:m.stone,side*39,y,39,.15,.13,67);
  }
 }
 private tree(x:number,z:number,i:number){
  const g=this.landscape,m=this.mats,mode=this.current;
  if(mode==='block'){
    this.box(g,m.roof,x,1.5,z,.65,3,.65);
    for(let k=0;k<3;k++)this.box(g,m.leaf,x+(k%2)*.6,3.2+k*.9,z,4-k*.8,1.5,4-k*.8);
  }else if(mode==='toy'){
    this.mesh(new THREE.CylinderGeometry(.3,.4,3,12),m.roof,g,x,1.5,z);
    for(let k=0;k<3;k++)this.mesh(new THREE.SphereGeometry(1.2,12,8),k%2?m.stone:m.leaf,g,x+(k-1)*1.3,3.2+(k%2),z);
    this.mesh(new THREE.CylinderGeometry(.6,.6,.3,12),m.trim,g,x,5,z);
  }else{
    this.mesh(new THREE.CylinderGeometry(.16,.42,4,10),m.roof,g,x,2,z);
    for(let k=0;k<4;k++){
      const a=k*2.4+i,dx=Math.cos(a),dz=Math.sin(a);
      const branch=this.mesh(new THREE.CylinderGeometry(.08,.15,2.4,6),m.roof,g,x+dx*.6,2.7+k*.3,z+dz*.6);branch.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),new THREE.Vector3(dx,.9,dz).normalize());
      this.mesh(new THREE.IcosahedronGeometry(1.55,1),m.leaf,g,x+dx*1.3,4.2+k*.25,z+dz*1.3,1,1.2,1);
    }
  }
 }
 private bench(x:number,z:number){
  const g=this.landscape,m=this.mats;
  if(this.current==='forest'){
    const log=this.mesh(new THREE.CylinderGeometry(.33,.36,3.4,12),m.roof,g,x,.62,z);log.rotation.z=Math.PI/2;
    for(const dx of [-1.1,1.1])this.mesh(new THREE.CylinderGeometry(.26,.32,.45,8),m.roof,g,x+dx,.22,z);
  }else if(this.current==='toy'){
    this.box(g,m.roof,x,.65,z,3.4,.35,1);
    for(const dx of [-1.25,1.25])this.mesh(new THREE.CylinderGeometry(.25,.25,.6,12),m.stone,g,x+dx,.3,z);
    this.box(g,m.stone,x,1.2,z-.5,3.4,.65,.25);
  }else{
    for(let i=0;i<4;i++)this.box(g,m.roof,x,.64,z-.36+i*.24,3.4,.12,.18);
    for(let i=0;i<3;i++)this.box(g,m.roof,x,.95+i*.22,z-.53,3.4,.16,.12);
    for(const dx of [-1.25,1.25]){this.box(g,m.dark,x+dx,.3,z,.12,.6,.8);this.box(g,m.dark,x+dx,.95,z-.5,.1,.9,.12);}
  }
 }

 /** 비클래식 모드의 양식별 지붕 위 실루엣(§2-7 표). 도형 정의는 하나이고, 블록은 층층이 쌓은 상자, 숲은 면 수가 적은 목재 도형, 장난감은 매끈한 도형으로 만든다. */
 private signature(g:THREE.Group,style:MuseumStyle,far:boolean){const m=this.mats,mode=this.current,block=mode==='block',seg=far?6:mode==='forest'?8:24,t=mode==='block'?6.62:mode==='forest'?6.18:6.1;
  const cone=(mat:THREE.Material,x:number,y:number,z:number,r:number,h:number,sides=seg)=>{if(block){const n=Math.max(3,Math.round(h/.8));for(let i=0;i<n;i++){const w=2*r*(1-i/n)*.75;this.box(g,mat,x,y+h*(i+.5)/n,z,w,h/n,w);}return;}const c=this.mesh(new THREE.ConeGeometry(r,h,sides),mat,g,x,y+h/2,z);if(sides===4)c.rotation.y=Math.PI/4;};
  const cyl=(mat:THREE.Material,x:number,y:number,z:number,r1:number,r2:number,h:number,ry=0)=>{const o=block?this.box(g,mat,x,y+h/2,z,2*Math.max(r1,r2),h,2*Math.max(r1,r2)):this.mesh(new THREE.CylinderGeometry(r1,r2,h,seg),mat,g,x,y+h/2,z);o.rotation.y=ry;};
  const dome=(mat:THREE.Material,x:number,y:number,z:number,r:number)=>{if(block){const n=r>2?4:2;for(let i=0;i<n;i++){const w=2*r*Math.cos(Math.asin((i+.5)/n));this.box(g,mat,x,y+r*(i+.5)/n,z,w,r/n,w);}return;}this.mesh(new THREE.SphereGeometry(r,seg,Math.max(4,seg/2),0,Math.PI*2,0,Math.PI/2),mat,g,x,y,z);};
  const gable=(mat:THREE.Material,y:number,w:number,h:number,d:number)=>{if(block){for(let i=0;i<4;i++)this.box(g,mat,0,y+h*(i+.5)/4,0,w*(1-i/4),h/4,d);return;}const sh=new THREE.Shape();sh.moveTo(-w/2,0);sh.lineTo(w/2,0);sh.lineTo(0,h);sh.closePath();this.mesh(new THREE.ExtrudeGeometry(sh,{depth:d,bevelEnabled:false}),mat,g,0,y,-d/2);};
  const disc=(mat:THREE.Material,x:number,y:number,z:number,r:number)=>{if(block){this.box(g,mat,x,y,z,2*r,2*r,.15);return;}this.mesh(new THREE.CylinderGeometry(r,r,.12,seg),mat,g,x,y,z).rotation.x=Math.PI/2;};
  switch(style){
   case 'glass_pyramid':cone(m.glass,0,t,0,6.2,6,4);break;
   case 'white_spiral':for(let i=0;i<5;i++)cyl(i%2?m.trim:m.stone,0,t+i,0,4.3-i*.7,4.5-i*.7,1,i*.22);break;
   case 'column_temple':gable(m.roof,t,13.2,2.8,11.6);this.box(g,m.trim,0,t+.12,5.9,13.2,.25,.3);break;
   case 'clock_station':cyl(m.stone,0,t,0,1.7,1.7,6.5);disc(m.trim,0,t+4.8,1.82,1.05);this.box(g,m.dark,0,t+5.1,1.92,.08,.65,.05);this.box(g,m.dark,.22,t+4.8,1.92,.5,.08,.05);cone(m.roof,0,t+6.5,0,2.4,3.2,4);break;
   case 'brick_chimney':for(const x of [-4,4]){cyl(m.masonry,x,t,-2,.9,1.1,6.5);cyl(m.trim,x,t+6.5,-2,1.2,1.2,.45);}break;
   case 'golden_dome':dome(m.trim,0,t,0,4.6);for(const x of [-5.4,5.4]){cyl(m.stone,x,t,0,.8,.9,3.2);dome(m.trim,x,t+3.2,0,1.2);}break;
   case 'hanok_roof':if(block){for(let i=0;i<3;i++)this.box(g,m.roof,0,t+.35+i*.7,0,15.4-i*4.4,.7,13.6-i*2.6);for(const x of [-7.4,7.4])for(const z of [-6.5,6.5])this.box(g,m.trim,x,t+1.05,z,1,.7,1);this.box(g,m.trim,0,t+2.3,0,7,.45,.6);}else for(const side of [-1,1]){const roof=this.box(g,m.roof,side*3.6,t+1.15,0,8.2,.5,13.8);roof.rotation.z=-side*.27;for(const z of [-6.8,6.8]){const tip=this.box(g,m.trim,side*7.7,t+.45,z,1.7,.35,.9);tip.rotation.z=side*.62;}}if(!block)this.box(g,m.trim,0,t+2.25,0,.45,.45,14);break;
   case 'silver_wave':for(let i=0;i<7;i++){const k=Math.sin(i*.9);if(block)this.box(g,m.glass,-6+i*2,t+.6+k*.55,0,2,1.2+k*1.1,11.5);else{const r=this.box(g,m.glass,-6+i*2,t+.8+k*1.1,0,2.15,.4,11.5);r.rotation.z=Math.cos(i*.9)*.35;}}break;
  }
 }
 build(style:MuseumStyle,far=false){const g=new THREE.Group(),m=this.mats;const detail=far?8:16,block=this.current==='block';
  if(this.current==='classic'){
    this.box(g,m.stone,-4,3.5,0,4,6,10);this.box(g,m.stone,4,3.5,0,4,6,10);this.box(g,m.stone,0,6,0,4,1,10);
    for(const y of [.35,1.1,5.8,6.5]){if(y<5)for(const x of [-4.2,4.2])this.box(g,m.stone,x,y,0,4.2,.24,10.6);else this.box(g,m.stone,0,y,0,12.6,.24,10.6);}
    // 굵고 짧게 읽히는 기둥(§2-14): 가는 고전 기둥 대신 아이 눈높이에서 덩어리로 보이는 비례
    for(const x of [-5,-3,3,5]){
      this.mesh(new THREE.CylinderGeometry(.44,.52,5.5,detail),m.stone,g,x,3.5,5.5);
      for(const y of [.8,6.2]){this.box(g,m.stone,x,y,5.5,1.3,.32,1.3);this.mesh(new THREE.CylinderGeometry(.66,.66,.2,detail),m.stone,g,x,y+.24,5.5);}
    }
  }else if(this.current==='block'){
    for(const side of [-1,1])for(let k=0;k<3;k++)this.box(g,k%2?m.stone:m.roof,side*4,1.1+k*2,0,4,1.9,10);
    this.box(g,m.roof,0,6.3,0,13,.65,11);
  }else if(this.current==='forest'){
    for(const side of [-1,1]){this.box(g,m.roof,side*4,2.9,0,4,5.8,10);for(let y=.4;y<5.7;y+=.48)this.box(g,m.path,side*4,y,5.08,4,.1,.18);}
    for(const x of [-5.8,-2.2,2.2,5.8])this.mesh(new THREE.CylinderGeometry(.23,.32,6.3,10),m.roof,g,x,3.15,5.7);
    this.box(g,m.roof,0,6,0,13.4,.35,12.4);for(const z of [-5.6,5.6])this.box(g,m.path,0,5.72,z,13,.22,.3);
  }else{
    for(const side of [-1,1]){this.box(g,m.stone,side*4,2.6,0,4,5.2,9);this.mesh(new THREE.CylinderGeometry(1.3,1.3,6.3,20),m.roof,g,side*5,3.15,4);}
    this.box(g,m.roof,0,5.6,0,13,1,11);
    const arch=this.mesh(new THREE.TorusGeometry(2.1,.5,8,24,Math.PI),m.trim,g,0,4.5,5.5);arch.rotation.z=0;
    for(const x of [-5.5,5.5])for(const z of [-4.5,4.5])this.mesh(new THREE.CylinderGeometry(.6,.6,.4,16),m.trim,g,x,6.3,z);
  }
  this.box(g,m.dark,0,2.5,-4.8,4,5,.2);
  for(let i=0;i<4;i++)this.box(g,m.stone,0,.05+i*.09,8-i*.6,7-i*.25,.1+i*.18,1.3);
  for(const x of [-4.7,-3,3,4.7])for(const y of [2.4,4.6]){
    this.box(g,m.roof,x,y,5.1,1.05,1.6,.2);this.box(g,m.glass,x,y,5.23,.8,1.32,.1);
    this.box(g,m.stone,x,y-.85,5.35,1.2,.15,.45);this.box(g,m.stone,x,y,5.31,.05,1.32,.06);
  }
  for(const side of [-1,1]){const pivot=new THREE.Group();pivot.position.set(side*2,.9,5.2);this.box(pivot,m.roof,-side*.95,1.9,0,1.9,3.8,.15);this.box(pivot,m.glass,-side*.95,2.3,.09,1.4,2.1,.08);this.box(pivot,m.trim,-side*1.7,1.8,.2,.08,.6,.08);g.add(pivot);if(!far)this.doors.push(pivot);}
  if(this.current!=='classic')this.signature(g,style,far);
  else{const m={...this.mats,roof:this.mats.tile};switch(style){
   case 'glass_pyramid':{const p=this.mesh(new THREE.ConeGeometry(8,8,4),m.glass,g,0,7.7,0);p.rotation.y=Math.PI/4;for(let i=1;i<5;i++)this.box(g,m.trim,0,4+i*1.3,5-i*.8,12-i*2,.09,.12);break;}
   case 'white_spiral':for(let i=0;i<6;i++){const ring=this.mesh(new THREE.CylinderGeometry(5-i*.45,5.4-i*.45,1.1,block?8:detail*2),m.stone,g,0,6+i*.8,0);ring.rotation.z=.055;this.mesh(new THREE.TorusGeometry(5.15-i*.45,.12,4,detail*2),m.trim,g,0,6.4+i*.8,0).rotation.x=Math.PI/2;}break;
   case 'column_temple':{const shape=new THREE.Shape();shape.moveTo(-6.6,0);shape.lineTo(6.6,0);shape.lineTo(0,2.2);shape.closePath();this.mesh(new THREE.ExtrudeGeometry(shape,{depth:12,bevelEnabled:false}),m.roof,g,0,6.6,-6);this.box(g,m.trim,0,6.4,0,13.6,.35,12.6);break;}
   case 'clock_station':{this.box(g,m.stone,0,8,0,3.2,7,3.2);this.mesh(new THREE.ConeGeometry(2.6,3.5,4),m.roof,g,0,13,0).rotation.y=Math.PI/4;const face=this.mesh(new THREE.CylinderGeometry(1.1,1.1,.12,24),m.trim,g,0,9.6,1.7);face.rotation.x=Math.PI/2;this.box(g,m.dark,0,9.9,1.8,.07,.7,.04);this.box(g,m.dark,.24,9.6,1.8,.5,.07,.04);break;}
   case 'brick_chimney':for(const x of [-4,4]){this.mesh(new THREE.CylinderGeometry(.8,1.15,8,block?4:12),m.masonry,g,x,9,-2);this.mesh(new THREE.CylinderGeometry(1,1,.4,block?4:12),m.trim,g,x,13,-2);}for(let y=1;y<7;y++)this.box(g,m.roof,-4, y,5.12,4,.09,.04);break;
   case 'golden_dome':this.mesh(new THREE.SphereGeometry(5,detail*2,detail,0,Math.PI*2,0,Math.PI/2),m.trim,g,0,6.5,0,1,1.1,1);for(const x of [-5,5]){this.mesh(new THREE.CylinderGeometry(.8,.9,5,detail),m.stone,g,x,8,0);this.mesh(new THREE.SphereGeometry(1.3,detail,8,0,Math.PI*2,0,Math.PI/2),m.trim,g,x,10.5,0);}break;
   case 'hanok_roof':for(const side of [-1,1]){const roof=this.box(g,m.roof,side*3,7.3,0,7,.6,13);roof.rotation.z=-side*.28;this.box(g,m.trim,side*6.3,8.2,0,.35,.4,13);}break;
   case 'silver_wave':for(let i=0;i<(far?4:9);i++){const roof=this.box(g,m.glass,-6+i*(far?4:1.5),7.2+Math.sin(i*.85)*1.3,0,2.1,.35,12);roof.rotation.z=Math.cos(i*.85)*.28;}break;
  }}
  
  // 같은 재질의 정적 부분을 합친다. 문과 인스턴스는 따로 둔다.
  const groups=new Map<THREE.Material,THREE.Mesh[]>();for(const o of [...g.children])if(o instanceof THREE.Mesh&&!(o instanceof THREE.InstancedMesh)){const mat=o.material as THREE.Material;const arr=groups.get(mat)??[];arr.push(o);groups.set(mat,arr);}
  for(const [mat,parts] of groups){if(parts.length<2)continue;const geometries=parts.map(o=>{o.updateMatrix();const geo=o.geometry.clone().applyMatrix4(o.matrix);return geo.index?geo.toNonIndexed():geo;});const merged=mergeGeometries(geometries);for(const geo of geometries)geo.dispose();if(merged){this.ownGeometries.add(merged);const mesh=new THREE.Mesh(merged,mat);mesh.castShadow=true;mesh.receiveShadow=true;g.add(mesh);for(const o of parts)g.remove(o);}}
  return g;
 }
 apply(id:ThemeId){this.current=id;const particles=this.ambience.material as THREE.PointsMaterial;particles.color.set(id==='forest'?'#fff6bc':id==='toy'?'#fff6fa':id==='block'?'#cce9b2':'#ffe8ba');particles.size=id==='classic'?.035:id==='forest'?.09:.065;particles.opacity=id==='classic'?.18:.45;const l=LOOKS[id];for(const key of ['stone','roof','ground','path','water','leaf'] as const)this.mats[key].color.set(l[key]);for(const key of ['stone','roof'] as const){this.mats[key].roughness=id==='toy'?.25:id==='classic'?.88:.8;this.mats[key].metalness=0;}const realistic=id==='classic'||id==='forest';
  // 클래식 건물 벽은 사진 보도석 질감 대신 무늬 없는 따뜻한 회벽이다(§2-14). 사진 질감은 길과 지면에만 남긴다
  for(const [mat,surface] of [[this.mats.path,this.surfaces.paving],[this.mats.ground,this.surfaces.grass],[this.mats.stone,this.surfaces.paving]] as const){const use=realistic&&!(id==='classic'&&mat===this.mats.stone);mat.map=use?surface.map:null;mat.normalMap=use?surface.normalMap:null;mat.roughnessMap=use?surface.roughnessMap:null;mat.normalScale.setScalar(.45);mat.needsUpdate=true;}
  if(realistic){this.mats.stone.color.set(id==='classic'?'#f1e4cc':'#f5eee0');this.mats.ground.map=this.patches;this.mats.ground.color.set(id==='forest'?'#8ea36f':'#86a96a');this.mats.path.color.set('#eee9d9');}
  if(id==='forest'){this.mats.roof.color.set('#796043');this.mats.path.color.set('#c9b794');}
  this.shader.uniforms.top!.value.set(l.sky);this.shader.uniforms.bottom!.value.set(l.horizon);if(this.specs.length)this.rebuild();}
 openDoors(amount:number){this.doors.forEach((p,i)=>p.rotation.y=(i%2?1:-1)*amount*Math.PI*.48);}
 /** 시작 화면·시작 연출이 쓰는 문 위치(3D미술관_재설계 §2-17). 건물은 서는 자리(positions)에서 12m 안쪽에 있고, 문짝은 건물 중심에서 5.2m 앞이다.
  *  plane=문짝 아래 가운데, facade=시작 화면 카메라가 보는 정면 가운데, stand=시작 화면에서 캐릭터가 서는 길의 z */
 doorOf(id:string){const p=this.positions.get(id)??new THREE.Vector3(0,0,18),center=p.z-12;return {plane:new THREE.Vector3(p.x,.9,center+5.2),facade:{x:p.x,y:4.2,z:center+3},stand:p.z-1.5};}
 suspend(){this.clear();this.root.visible=false;}
 update(t:number){if(!this.reduced){this.ambience.position.y=Math.sin(t*(this.current==='toy'?.8:.2))*.4;this.ambience.rotation.y=Math.sin(t*.08)*.06;}this.clouds.rotation.y=Math.sin(t*.012)*.025;this.mats.water.color.offsetHSL(0,0,Math.sin(t)*.00003);}
 /** 건물 문 통로 안인가(canStand가 열어 둔 폭 1.6). 걸어 들어가면 입장을 시작한다(설계서 2-1 문 드나들기) */
 inDoorway(x:number,z:number){for(const p of this.positions.values())if(Math.abs(x-p.x)<1.6&&z<p.z-3&&z>p.z-19)return true;return false;}
 canStand(x:number,z:number){if(Math.abs(x)>82||z>100||z< -170)return false;for(const o of this.obstacles)if(Math.abs(x-o.x)<o.w/2+.35&&Math.abs(z-o.z)<o.d/2+.35)return false;for(const p of this.positions.values())if(Math.abs(x-p.x)<7&&z<p.z-3&&z>p.z-19)return Math.abs(x-p.x)<1.6;return true;}
 dispose(){this.clear();this.ambience.geometry.dispose();(this.ambience.material as THREE.Material).dispose();this.sky.geometry.dispose();this.shader.dispose();this.floor.geometry.dispose();Object.values(this.mats).forEach(m=>m.dispose());Object.values(this.surfaces).forEach(s=>Object.values(s).forEach(t=>t.dispose()));this.patches.dispose();}
}
