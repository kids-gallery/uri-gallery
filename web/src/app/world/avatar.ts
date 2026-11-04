// 캐릭터(3D미술관_재설계 §2-6): 모드별 기본 캐릭터와 공용 뼈대에 연결한 전체 이미지 캐릭터.
// 분류 · 부품 · 색 자료 구조와 "같이 못 쓰는 부품" 규칙은 참고 구현(REA 분석)의 구조만 빌렸다.
import * as THREE from 'three';
import { type Mask } from './cutout';
import { defaultJoints, normalizeJoints, makeSkeleton, inflatedGeometry, skinGeometry, estimateJoints, type Joints, type JointName } from './avatarMesh';
import type { ThemeId } from './themes';
import { emoteOf, type EmoteId } from './emotes';

export const PALETTE = {
  skin: ['#ffe0c7', '#f6c9a5', '#e8b087', '#d19468', '#a86f47', '#7b4d2e', '#ffd6e0', '#e0f0ff'],
  hair: ['#2b1b10', '#5a3a22', '#a8642c', '#e3b34a', '#d9d9d9', '#e8679a', '#4a7bd8', '#3a8f5c'],
  cloth: ['#e63946', '#f4a261', '#ffd23f', '#3fb950', '#3a86ff', '#8e5bd8', '#a0496b', '#f7f7f7'],
} as const;

export const OPTIONS = {
  hair: [{ id: 'short', label: '짧은 머리' }, { id: 'bob', label: '단발' }, { id: 'long', label: '긴 머리' }, { id: 'pigtails', label: '양갈래' }, { id: 'none', label: '없음' }],
  face: [{ id: 'smile', label: '웃음' }, { id: 'grin', label: '활짝' }, { id: 'wink', label: '윙크' }, { id: 'wow', label: '놀람' }],
  top: [{ id: 'tee', label: '티셔츠' }, { id: 'stripe', label: '줄무늬' }, { id: 'overalls', label: '멜빵' }],
  bottom: [{ id: 'pants', label: '바지' }, { id: 'skirt', label: '치마' }, { id: 'shorts', label: '반바지' }],
  hat: [{ id: 'none', label: '없음' }, { id: 'beret', label: '화가 모자' }, { id: 'crown', label: '왕관' }, { id: 'cap', label: '야구모자' }, { id: 'flower', label: '꽃핀' }],
  prop: [{ id: 'none', label: '없음' }, { id: 'brush', label: '붓' }, { id: 'palette', label: '팔레트' }, { id: 'balloon', label: '풍선' }],
} as const;

type Ids<K extends keyof typeof OPTIONS> = (typeof OPTIONS)[K][number]['id'];

export interface AvatarConfig {
  mode: 'basic' | 'image';
  joints?: Joints;
  imageSource?: 'artwork' | 'upload';
  motion?: 'joints' | 'whole';
  articulation?: 'experimental';
  skin: string;
  hair: Ids<'hair'>; hairColor: string;
  face: Ids<'face'>;
  top: Ids<'top'>; topColor: string;
  bottom: Ids<'bottom'>; bottomColor: string;
  hat: Ids<'hat'>;
  prop: Ids<'prop'>;
}

export const DEFAULT_AVATAR: AvatarConfig = {
  mode: 'basic', imageSource:'upload', motion:'whole', skin: '#f6c9a5', hair: 'short', hairColor: '#2b1b10', face: 'smile',
  top: 'tee', topColor: '#ffd23f', bottom: 'pants', bottomColor: '#3a86ff', hat: 'beret', prop: 'brush',
};

const pick = <T,>(a: readonly T[]) => a[Math.floor(Math.random() * a.length)]!;

export function randomAvatar(): AvatarConfig {
  return {
    mode: 'basic',
    skin: pick(PALETTE.skin),
    hair: pick(OPTIONS.hair).id, hairColor: pick(PALETTE.hair),
    face: pick(OPTIONS.face).id,
    top: pick(OPTIONS.top).id, topColor: pick(PALETTE.cloth),
    bottom: pick(OPTIONS.bottom).id, bottomColor: pick(PALETTE.cloth),
    hat: pick(OPTIONS.hat).id,
    prop: pick(OPTIONS.prop).id,
  };
}

/** 저장된 값이 깨졌거나 옛 판이면 기본값으로 채운다 */
export function normalizeAvatar(v: unknown): AvatarConfig {
  const o = (v && typeof v === 'object' ? v : {}) as Partial<AvatarConfig>;
  const inList = <K extends keyof typeof OPTIONS>(k: K, x: unknown): x is Ids<K> => OPTIONS[k].some((e) => e.id === x);
  const color = (x: unknown, d: string) => (typeof x === 'string' && /^#[0-9a-f]{6}$/i.test(x) ? x : d);
  const d = DEFAULT_AVATAR;
  return {
    mode: o.mode === 'image' ? 'image' : 'basic',
    ...(o.joints ? { joints: normalizeJoints(o.joints) } : {}),
    imageSource: o.imageSource === 'artwork' ? 'artwork' : 'upload',
    motion: o.motion === 'joints' && o.articulation === 'experimental' ? 'joints' : 'whole',
    ...(o.articulation === 'experimental' ? { articulation: 'experimental' as const } : {}),
    skin: color(o.skin, d.skin),
    hair: inList('hair', o.hair) ? o.hair : d.hair, hairColor: color(o.hairColor, d.hairColor),
    face: inList('face', o.face) ? o.face : d.face,
    top: inList('top', o.top) ? o.top : d.top, topColor: color(o.topColor, d.topColor),
    bottom: inList('bottom', o.bottom) ? o.bottom : d.bottom, bottomColor: color(o.bottomColor, d.bottomColor),
    hat: inList('hat', o.hat) ? o.hat : d.hat,
    prop: inList('prop', o.prop) ? o.prop : d.prop,
  };
}

function faceTexture(skin: string, face: AvatarConfig['face']) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = skin; g.fillRect(0, 0, 128, 128);
  // §2-18: 큰 눈에 반짝임 두 개, 볼 홍조, 작은 입. 눈은 머리 구면의 적도 근처(y≈60)에 둔다
  const blush = (x: number) => {
    const r = g.createRadialGradient(x, 80, 1, x, 80, 13);
    r.addColorStop(0, 'rgba(255,128,150,.55)'); r.addColorStop(1, 'rgba(255,128,150,0)');
    g.fillStyle = r; g.beginPath(); g.ellipse(x, 80, 13, 9, 0, 0, Math.PI * 2); g.fill();
  };
  blush(28); blush(100);
  const ink = '#3a2418';
  g.fillStyle = ink; g.strokeStyle = ink; g.lineWidth = 5; g.lineCap = 'round';
  const eye = (x: number, closed: boolean) => {
    if (closed) { g.beginPath(); g.arc(x, 62, 9, Math.PI * 1.15, Math.PI * 1.85); g.stroke(); return; }
    const rx = face === 'wow' ? 11 : 9.5, ry = face === 'wow' ? 13.5 : 12;
    g.fillStyle = ink; g.beginPath(); g.ellipse(x, 60, rx, ry, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#ffffff';
    g.beginPath(); g.arc(x + 3.5, 54.5, 4, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(x - 3, 65, 1.8, 0, Math.PI * 2); g.fill();
  };
  eye(40, false);
  eye(88, face === 'wink');
  g.strokeStyle = ink; g.lineWidth = 4;
  if (face === 'smile') { g.beginPath(); g.arc(64, 80, 9, Math.PI * 0.18, Math.PI * 0.82); g.stroke(); }
  else if (face === 'grin') { g.fillStyle = '#8a3434'; g.beginPath(); g.arc(64, 80, 11, 0, Math.PI); g.closePath(); g.fill(); g.fillStyle = '#ff9aa8'; g.beginPath(); g.ellipse(64, 87, 5, 2.5, 0, 0, Math.PI * 2); g.fill(); }
  else if (face === 'wink') { g.beginPath(); g.arc(64, 81, 8, Math.PI * 0.2, Math.PI * 0.8); g.stroke(); }
  else { g.fillStyle = '#8a3434'; g.beginPath(); g.ellipse(64, 88, 5.5, 7, 0, 0, Math.PI * 2); g.fill(); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function stripeTexture(color: string) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  g.fillStyle = color; g.fillRect(0, 0, 64, 64);
  g.fillStyle = '#ffffff';
  for (let y = 0; y < 64; y += 16) g.fillRect(0, y, 64, 7);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export interface AvatarRig {
  root: THREE.Group;
  body: THREE.Group; // 걸을 때 위아래로 흔들리는 부분
  legL: THREE.Object3D; legR: THREE.Object3D;
  armL: THREE.Object3D | null; armR: THREE.Object3D | null;
  height: number;
  bones: Record<JointName, THREE.Bone>;
  skin?: THREE.SkinnedMesh;
  style: ThemeId;
  rigid: boolean;
  dispose(): void;
}

const std = (color: string, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.75, ...extra });

function box(w: number, h: number, d: number, mat: THREE.Material | THREE.Material[], x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  return m;
}

function addHat(cfg: AvatarConfig, head: THREE.Object3D, top: number) {
  if (cfg.hat === 'beret') {
    // §2-18: 납작한 원판 대신 부푼 납작 구. 한쪽으로 살짝 기울여 쓴다
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.255, 28, 14), std('#a0496b', { roughness: 0.9 }));
    b.scale.set(1, 0.36, 1);
    b.position.set(0.03, top + 0.035, -0.015);
    b.rotation.z = -0.2;
    const stem = new THREE.Mesh(new THREE.SphereGeometry(0.025, 10, 8), std('#a0496b', { roughness: 0.9 }));
    stem.scale.set(1, 1.5, 1);
    stem.position.set(0.05, top + 0.12, -0.015);
    head.add(b, stem);
  } else if (cfg.hat === 'crown') {
    const gold = std('#e3b34a', { metalness: 0.7, roughness: 0.3 });
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.1, 20, 1, true), gold);
    ring.position.y = top + 0.05;
    head.add(ring);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const sp = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.1, 8), gold);
      sp.position.set(Math.sin(a) * 0.19, top + 0.14, Math.cos(a) * 0.19);
      head.add(sp);
    }
  } else if (cfg.hat === 'cap') {
    const c = new THREE.Mesh(new THREE.SphereGeometry(0.23, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), std(cfg.topColor));
    c.position.y = top - 0.02;
    const brim = box(0.36, 0.03, 0.2, std(cfg.topColor), 0, top - 0.01, 0.26);
    head.add(c, brim);
  } else if (cfg.hat === 'flower') {
    for (let k = 0; k < 5; k++) {
      const p = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), std('#ff8fb1'));
      p.position.set(0.2 + Math.cos(k * 1.26) * 0.05, top - 0.05 + Math.sin(k * 1.26) * 0.05, 0.12);
      head.add(p);
    }
    const ctr = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), std('#ffd23f'));
    ctr.position.set(0.2, top - 0.05, 0.14);
    head.add(ctr);
  }
}

/**
 * 둥근 머리의 머리카락(§2-18). 머리 구면(반지름 top)을 6% 크게 감싸는 껍질이다.
 * 윗머리 덮개(앞이마 선까지) + 얼굴 창을 비운 옆·뒷머리. 얼굴 조각(앞 ±0.75 라디안)보다 넓게 비워 볼이 보이게 한다.
 * SphereGeometry의 φ=π/2가 앞(+z), θ는 정수리에서 잰 각이다.
 */
function addRoundHair(cfg: AvatarConfig, head: THREE.Object3D, top: number) {
  const m = std(cfg.hairColor, { roughness: 0.62 });
  const R = top * 1.06;
  const shell = (thetaStart: number, thetaLength: number, open = 0) => {
    const g = new THREE.SphereGeometry(R, 36, 18, open ? Math.PI / 2 + open : 0, open ? Math.PI * 2 - open * 2 : Math.PI * 2, thetaStart, thetaLength);
    const s = new THREE.Mesh(g, m);
    s.name = 'hair';
    head.add(s);
    return s;
  };
  shell(0, 1.02); // 윗머리: 이마 선은 눈(적도 근처)보다 충분히 위
  const length = cfg.hair === 'long' ? 2.35 : cfg.hair === 'bob' ? 2.2 : 1.85;
  shell(0.95, length - 0.95, cfg.hair === 'bob' || cfg.hair === 'long' ? 0.82 : 0.95);
  if (cfg.hair === 'long') {
    const back = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 14), m);
    back.scale.set(top * 0.95, top * 1.25, top * 0.45);
    back.position.set(0, -top * 0.95, -top * 0.62);
    back.name = 'hair';
    head.add(back);
  }
  if (cfg.hair === 'pigtails') {
    for (const side of [-1, 1]) {
      const tail = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 12), m);
      tail.scale.set(top * 0.42, top * 0.6, top * 0.42);
      tail.position.set(side * top * 1.22, -top * 0.15, -top * 0.25);
      tail.rotation.z = side * 0.35;
      const tie = new THREE.Mesh(new THREE.TorusGeometry(top * 0.2, top * 0.06, 8, 16), std('#e8679a'));
      tie.position.set(side * top * 1.0, top * 0.12, -top * 0.22);
      tie.rotation.y = Math.PI / 2;
      tail.name = tie.name = 'hair';
      head.add(tail, tie);
    }
  }
}

function addHair(cfg: AvatarConfig, head: THREE.Object3D, top: number, round = false) {
  if (cfg.hair === 'none') return;
  if (round) { addRoundHair(cfg, head, top); return; }
  // 블록 모드: 상자 머리에 맞춘 상자 머리카락
  const m = std(cfg.hairColor);
  const hatCovers = cfg.hat === 'beret' || cfg.hat === 'crown' || cfg.hat === 'cap';
  // 같이 못 쓰는 부품: 모자를 쓰면 머리 윗부분은 모자 아래로 접는다
  if (!hatCovers) head.add(box(0.46, 0.09, 0.46, m, 0, top + 0.02, 0));
  head.add(box(0.46, 0.18, 0.06, m, 0, top - 0.08, -0.21));
  if (cfg.hair === 'bob' || cfg.hair === 'long') {
    head.add(box(0.06, cfg.hair === 'long' ? 0.42 : 0.26, 0.42, m, -0.23, top - (cfg.hair === 'long' ? 0.22 : 0.14), -0.02));
    head.add(box(0.06, cfg.hair === 'long' ? 0.42 : 0.26, 0.42, m, 0.23, top - (cfg.hair === 'long' ? 0.22 : 0.14), -0.02));
  }
  if (cfg.hair === 'long') head.add(box(0.46, 0.55, 0.07, m, 0, top - 0.3, -0.22));
  if (cfg.hair === 'pigtails') {
    for (const x of [-0.27, 0.27]) {
      const p = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 10), m);
      p.position.set(x, top - 0.12, -0.08);
      head.add(p);
    }
  }
}

function addProp(cfg: AvatarConfig, armR: THREE.Object3D, armL: THREE.Object3D) {
  if (cfg.prop === 'brush') {
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.34, 8), std('#b07a45'));
    stick.position.set(0, -0.46, 0.1);
    stick.rotation.x = Math.PI / 2.4;
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.08, 8), std('#e63946'));
    tip.position.set(0, -0.42, 0.27);
    tip.rotation.x = Math.PI / 2;
    armR.add(stick, tip);
  } else if (cfg.prop === 'palette') {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.02, 20), std('#e8c99a'));
    p.position.set(0, -0.46, 0.08);
    p.rotation.x = Math.PI / 2;
    armL.add(p);
    ['#e63946', '#3a86ff', '#ffd23f', '#3fb950'].forEach((c, i) => {
      const d = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), std(c));
      d.position.set(Math.cos(i * 1.4) * 0.08, -0.46 + Math.sin(i * 1.4) * 0.08, 0.1);
      armL.add(d);
    });
  } else if (cfg.prop === 'balloon') {
    const s = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.7, 4), std('#ffffff'));
    s.position.set(0, -0.12, 0);
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.17, 16, 12), std('#e63946', { roughness: 0.3 }));
    b.position.set(0, 0.36, 0);
    armL.add(s, b);
  }
}

/** 앞면은 원본 투영, 옆과 뒤는 같은 행의 내부 색으로 채운다. */
function imageMaterial(g:THREE.BufferGeometry,texture:THREE.Texture){
  const mat=new THREE.MeshStandardMaterial({map:texture,roughness:.83});
  const colors:number[]=[],front:number[]=[],uv=g.getAttribute('uv'),norm=g.getAttribute('normal');
  let pixels:Uint8ClampedArray|undefined;
  if(texture.image&&typeof document!=='undefined'){
    const c=document.createElement('canvas');c.width=c.height=64;const ctx=c.getContext('2d')!;
    try{ctx.drawImage(texture.image as CanvasImageSource,0,0,64,64);pixels=ctx.getImageData(0,0,64,64).data;}catch{/* Decoded image unavailable. */}
  }
  const rowColors=Array.from({length:64},(_,y)=>{
    const samples:number[][]=[];
    if(pixels)for(let x=2;x<62;x++){const i=(y*64+x)*4,r=pixels[i]!,gg=pixels[i+1]!,b=pixels[i+2]!;if(pixels[i+3]!>200&&Math.max(r,gg,b)>65)samples.push([r,gg,b]);}
    if(!samples.length)return new THREE.Color('#d5b689');
    const mid=(k:number)=>samples.map(p=>p[k]!).sort((a,b)=>a-b)[Math.floor(samples.length/2)]!/255;
    return new THREE.Color().setRGB(mid(0),mid(1),mid(2),THREE.SRGBColorSpace);
  });
  for(let i=0;i<uv.count;i++){const c=rowColors[Math.min(63,Math.max(0,Math.round((1-uv.getY(i))*63)))]!;colors.push(c.r,c.g,c.b);front.push(THREE.MathUtils.smoothstep(norm.getZ(i),.18,.72));}
  g.setAttribute('sideColor',new THREE.Float32BufferAttribute(colors,3));g.setAttribute('frontWeight',new THREE.Float32BufferAttribute(front,1));
  mat.onBeforeCompile=shader=>{
    shader.vertexShader='attribute vec3 sideColor; attribute float frontWeight; varying vec3 vSide; varying float vFront;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvSide=sideColor;vFront=frontWeight;');
    shader.fragmentShader='varying vec3 vSide; varying float vFront;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\ndiffuseColor.rgb=mix(vSide,diffuseColor.rgb,vFront);');
  };
  mat.customProgramCacheKey=()=> 'uam-rounded-original-v1';return mat;
}

/** 모든 몸 양식과 이미지 캐릭터가 같은 뼈 이름·동작을 쓴다. */
export function buildAvatar(cfg: AvatarConfig, image?: { texture: THREE.Texture; mask: Mask | null; aspect: number }, style:ThemeId='classic',distant=false): AvatarRig {
  const root=new THREE.Group(),body=new THREE.Group();root.add(body);root.name='avatar';
  const drawn=cfg.mode==='image'&&image;
  const joints=drawn ? (cfg.joints??estimateJoints(image.mask).joints) : defaultJoints();
  const {bones,positions,byName}=makeSkeleton(joints,drawn?image.aspect: .68);
  body.add(bones[0]!); let skin:THREE.SkinnedMesh|undefined;
  if(drawn){
    const g=inflatedGeometry(image.mask,image.aspect,1.5,distant?32:64);skinGeometry(g,positions,cfg.motion!=='joints'||cfg.articulation!=='experimental');
    skin=new THREE.SkinnedMesh(g,imageMaterial(g,image.texture));skin.name='whole-image';
    body.add(skin);root.updateMatrixWorld(true);skin.bind(new THREE.Skeleton(bones));skin.frustumCulled=false;
  }else{
    // 클래식은 고른 피부·옷 색을 그대로 쓰는 무광 몸이다(§2-14). 종전의 청동 조각상 색·금속성은 쓰지 않는다
    const classic=style==='classic',round=style!=='block';
    const material=(c:string)=>std(c,{metalness:style==='toy'?.12:0,roughness:style==='toy'?.22:classic?.78:.82});
    const skinMat=material(cfg.skin),shirt=material(cfg.topColor),pants=material(cfg.bottomColor);
    if(style==='block'){
      const c=document.createElement('canvas');c.width=c.height=8;const ctx=c.getContext('2d')!;
      for(let y=0;y<8;y++)for(let x=0;x<8;x++){const tone=220+((x*17+y*31)%36);ctx.fillStyle=`rgb(${tone},${tone},${tone})`;ctx.fillRect(x,y,1,1);}
      const tex=new THREE.CanvasTexture(c);tex.magFilter=tex.minFilter=THREE.NearestFilter;tex.colorSpace=THREE.SRGBColorSpace;
      skinMat.map=shirt.map=pants.map=tex;
    }
    if(cfg.top==='stripe')shirt.map=stripeTexture(cfg.topColor);
    const part=(bone:JointName,w:number,h:number,d:number,mat:THREE.Material,y=0)=>{
      const geo=round?new THREE.SphereGeometry(.5,16,12):new THREE.BoxGeometry(1,1,1);const m=new THREE.Mesh(geo,mat);m.scale.set(w,h,d);m.position.y=y;m.name='basic-'+bone;byName[bone].add(m);return m;};
    const forest=style==='forest',toy=style==='toy';
    // 클래식: 큰 머리(약 3등신)와 통통한 몸통, 조금 낮은 키. 숲 마을(2~2.5등신)보다는 덜 과장한다
    if(forest){body.scale.set(1, .85,1);}else if(classic){body.scale.set(1,.92,1);}
    part('spine',forest?.46:classic?.44:.38,forest?.5:.46,classic?.3:.25,shirt,-.1);
    part('neck',.13,.2,.13,skinMat,-.02);
    part('hips',classic?.36:.32,.23,classic?.28:round?.25:.235,pants,0); // 블록 상자는 상의와 깊이가 같으면 앞뒤 면이 겹쳐 깜빡인다(#152)
    const headSize=forest?.68:toy?.44:classic?.52:.42;
    const head=part('head',headSize,headSize,headSize,skinMat);
    // 얼굴은 별도 얇은 면. 모드마다 동일한 머리뼈에 붙어 움직인다.
    // 둥근 머리는 얼굴을 머리 구면에 붙은 곡면 조각으로 그린다(§2-14 마지막 시각 보정). 평면 판은 모서리가 머리 밖으로 나와 카드처럼 보였다.
    // 앞(+z)을 중심으로 가로 1.5·세로 1.4 라디안을 덮고, 얼굴 그림 전체가 그 조각에 펼쳐진다. 블록의 상자 머리는 평면 그대로다.
    const faceGeo=round?new THREE.SphereGeometry(headSize*.505,24,16,Math.PI/2-.75,1.5,Math.PI/2-.7,1.4):new THREE.PlaneGeometry(headSize*.8,headSize*.8);
    const face=new THREE.Mesh(faceGeo,new THREE.MeshStandardMaterial({map:faceTexture(cfg.skin,cfg.face),roughness:.75}));if(!round)face.position.z=headSize*.49;byName.head.add(face);
    const adorn=new THREE.Group();adorn.scale.setScalar(headSize/.42);byName.head.add(adorn);addHair(cfg,adorn,.21,round);addHat(cfg,adorn,.21);
    for(const side of ['L','R'] as const){
      for(const [name,next,mat,width] of [[`arm${side}`,`forearm${side}`,shirt,.14],[`forearm${side}`,`hand${side}`,skinMat,.115],[`leg${side}`,`shin${side}`,pants,.16],[`shin${side}`,`foot${side}`,cfg.bottom==='pants'?pants:skinMat,.14]] as const){
        const a=byName[name],b=byName[next];const length=b.position.length();const mesh=part(name,width,length,width,mat);mesh.position.copy(b.position).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),b.position.clone().normalize());a.updateMatrix();
      }
      part(`hand${side}`,.13,.13,.13,skinMat);part(`foot${side}`,.17,.1,.25,material('#51443b'));
    }
    if(cfg.bottom==='skirt')part('hips',.48,.3,.35,pants,-.1);
    if(cfg.top==='overalls')part('spine',.27,.30,.28,material(cfg.bottomColor),-.12);
    const propR=new THREE.Group(),propL=new THREE.Group();propR.position.y=propL.position.y=.46;byName.handR.add(propR);byName.handL.add(propL);addProp(cfg,propR,propL);
    head.userData.style=style;
  }
  const dispose=()=>{const mats=new Set<THREE.Material>(),tex=new Set<THREE.Texture>();root.traverse(o=>{const m=o as THREE.Mesh;m.geometry?.dispose();for(const t of Array.isArray(m.material)?m.material:m.material?[m.material]:[])mats.add(t);});for(const m of mats){const t=(m as THREE.MeshStandardMaterial).map;if(t&&!t.userData.shared)tex.add(t);m.dispose();}tex.forEach(t=>t.dispose());skin?.skeleton.dispose();};
  return {root,body,legL:byName.legL,legR:byName.legR,armL:byName.armL,armR:byName.armR,bones:byName,skin,height:1.5,style,rigid:!!drawn&&(cfg.motion!=='joints'||cfg.articulation!=='experimental'),dispose};
}

export type AvatarAction='idle'|'walk'|'run'|'jump'|EmoteId;
/** elapsed: 지금 감정 표현을 시작한 뒤 흐른 초(빙글빙글처럼 한 번 도는 동작에 쓴다) */
export function animateAvatar(rig:AvatarRig,t:number,speed:number,action:AvatarAction=speed>4?'run':speed>.1?'walk':'idle',elapsed=0){
  rig.body.rotation.set(0,0,0);
  const emote=emoteOf(action);
  // 몸 전체 움직임은 그림 캐릭터(통째로 움직이기)도 같이 쓴다. 그림 캐릭터는 위아래 폭을 줄인다(§2-6 안정 동작)
  if(emote){rig.body.position.y=Math.abs(Math.sin(t*(emote.bobFreq??0)))*(emote.bob??0)*(rig.rigid?.35:1);rig.body.rotation.z=Math.sin(t*3)*(emote.sway??0);rig.body.rotation.y=(emote.spin??0)*Math.min(1,elapsed/emote.seconds);}
  if(rig.rigid){
    if(!emote)rig.body.position.y=0;
    for(const bone of Object.values(rig.bones))bone.rotation.set(0,0,0);
    rig.root.updateMatrixWorld(true);rig.skin?.skeleton.update();return;
  }
  const b=rig.bones;for(const bone of Object.values(b))bone.rotation.set(0,0,0);
  const k=Math.min(1,speed/3),phase=t*(action==='run'?13:9),swing=Math.sin(phase)*(rig.skin?.16:.65)*k;
  b.legL.rotation.x=swing;b.legR.rotation.x=-swing;b.shinL.rotation.x=Math.max(0,-swing)*.6;b.shinR.rotation.x=Math.max(0,swing)*.6;
  b.armL.rotation.x=-swing*.8;b.armR.rotation.x=swing*.8;b.forearmL.rotation.x=-Math.abs(swing)*.4;b.forearmR.rotation.x=-Math.abs(swing)*.4;
  if(!emote)rig.body.position.y=Math.abs(Math.sin(phase))*.04*k+Math.sin(t*2)*.008*(1-k);
  else for(const c of emote.channels)b[c.bone].rotation[c.axis]=c.base+(c.amp??0)*Math.sin(t*(c.freq??0)+(c.phase??0));
  if(action==='jump'){b.legL.rotation.x=-.3;b.legR.rotation.x=-.3;b.shinL.rotation.x=.6;b.shinR.rotation.x=.6;}
  rig.root.updateMatrixWorld(true);rig.skin?.skeleton.update();
}
