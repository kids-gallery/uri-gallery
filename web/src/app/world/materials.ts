import * as THREE from 'three';
// Local CC0 assets, provenance and hashes in public/museum/world/materials/manifest.json.
export type Surface = 'cobblestone_floor_08'|'brown_brick_02'|'aerial_grass_rock';
export function loadSurface(name:Surface){
 const loader=new THREE.TextureLoader();
 const get=(kind:string)=>{const t=loader.load(`/museum/world/materials/${name}_${kind}_1k.jpg`);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=4;return t;};
 const map=get('diff');map.colorSpace=THREE.SRGBColorSpace;
 return {map,normalMap:get('nor_gl'),roughnessMap:get('rough')};
}
/** Planar projection in metres; prevents stretched bricks on long paths and walls. */
export function worldUV(g:THREE.BufferGeometry,tile=2){
 const p=g.getAttribute('position'),n=g.getAttribute('normal'),uv=g.getAttribute('uv');if(!uv||!n)return g;
 for(let i=0;i<p.count;i++){const x=Math.abs(n.getX(i)),y=Math.abs(n.getY(i)),z=Math.abs(n.getZ(i));uv.setXY(i,(x>y&&x>z?p.getZ(i):p.getX(i))/tile,(y>x&&y>z?p.getZ(i):p.getY(i))/tile);}
 return g;
}
/** 둘째 UV(uv1)를 넓은 단위로 만든다. 잔디 얼룩처럼 큰 무늬는 이 UV로, 요철은 worldUV(2m)로 붙여 반복이 띠로 보이지 않게 한다. */
export function largeUV(g:THREE.BufferGeometry,tile=30){
 const p=g.getAttribute('position'),n=g.getAttribute('normal');if(!n)return g;const uv=new Float32Array(p.count*2);
 for(let i=0;i<p.count;i++){const x=Math.abs(n.getX(i)),y=Math.abs(n.getY(i)),z=Math.abs(n.getZ(i));uv[i*2]=(x>y&&x>z?p.getZ(i):p.getX(i))/tile;uv[i*2+1]=(y>x&&y>z?p.getZ(i):p.getY(i))/tile;}
 g.setAttribute('uv1',new THREE.BufferAttribute(uv,2));return g;
}
/** 잔디 색 얼룩(3D미술관_재설계 §2-2). 흰 바탕에 부드러운 명암·색 덩어리를 이음매 없이 그린다. 모드 잔디색과 곱해 쓴다. */
export function grassPatches(size=256):THREE.Texture{
 const c=document.createElement('canvas');c.width=c.height=size;const x=c.getContext('2d');
 if(!x){const t=new THREE.DataTexture(new Uint8Array([255,255,255,255]),1,1);t.needsUpdate=true;t.channel=1;return t;}
 x.fillStyle='#ffffff';x.fillRect(0,0,size,size);let seed=7;const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647;
 const tones=['rgba(186,206,150,','rgba(158,184,128,','rgba(226,220,176,','rgba(206,224,170,'];
 for(let i=0;i<80;i++){const px=rnd()*size,py=rnd()*size,r=size*(.05+rnd()*.15),tone=tones[Math.floor(rnd()*tones.length)]!;
  for(const dx of [-size,0,size])for(const dy of [-size,0,size]){const cx=px+dx,cy=py+dy;if(cx+r<0||cy+r<0||cx-r>size||cy-r>size)continue;const g=x.createRadialGradient(cx,cy,0,cx,cy,r);g.addColorStop(0,tone+'0.5)');g.addColorStop(1,tone+'0)');x.fillStyle=g;x.fillRect(cx-r,cy-r,2*r,2*r);}}
 const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.colorSpace=THREE.SRGBColorSpace;t.channel=1;t.anisotropy=4;return t;
}
