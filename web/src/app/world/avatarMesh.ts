// 이미지 전체를 닫힌 입체로 만들고 공용 뼈대에 연결한다. 외부 모델·생성형 이미지 없음.
import * as THREE from 'three';
import { type Mask } from './cutout';
import { MarchingCubes } from 'three/examples/jsm/objects/MarchingCubes.js';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export const JOINT_NAMES = ['hips','spine','neck','head','armL','forearmL','handL','armR','forearmR','handR','legL','shinL','footL','legR','shinR','footR'] as const;
export type JointName = typeof JOINT_NAMES[number];
export type Joints = Record<JointName, { x: number; y: number }>;
export const PARENTS = [-1,0,1,2,2,4,5,2,7,8,0,10,11,0,13,14];
export const JOINT_LABELS: Record<JointName,string> = { hips:'골반',spine:'허리',neck:'목',head:'머리',armL:'왼쪽 어깨',forearmL:'왼쪽 팔꿈치',handL:'왼손',armR:'오른쪽 어깨',forearmR:'오른쪽 팔꿈치',handR:'오른손',legL:'왼쪽 허벅지',shinL:'왼쪽 무릎',footL:'왼발',legR:'오른쪽 허벅지',shinR:'오른쪽 무릎',footR:'오른발' };
export function defaultJoints(): Joints {
  const xy = [[.5,.57],[.5,.4],[.5,.25],[.5,.12],[.34,.29],[.22,.43],[.13,.57],[.66,.29],[.78,.43],[.87,.57],[.42,.59],[.4,.77],[.38,.96],[.58,.59],[.6,.77],[.62,.96]];
  return Object.fromEntries(JOINT_NAMES.map((n,i)=>[n,{x:xy[i]![0]!,y:xy[i]![1]!}])) as Joints;
}
export function normalizeJoints(value: unknown): Joints {
  const out=defaultJoints(); const v=value as Partial<Joints>|undefined;
  for(const n of JOINT_NAMES) { const p=v?.[n]; if(p && Number.isFinite(p.x)&&Number.isFinite(p.y)) out[n]={x:THREE.MathUtils.clamp(p.x,0,1),y:THREE.MathUtils.clamp(p.y,0,1)}; }
  return out;
}
function sampleMask(mask: Mask|null, side=64) {
  const w=side,h=side, data=new Uint8Array(w*h);
  for(let y=1;y<h-1;y++) for(let x=1;x<w-1;x++) data[y*w+x]=!mask || mask.data[Math.min(mask.h-1,Math.floor(y/h*mask.h))*mask.w+Math.min(mask.w-1,Math.floor(x/w*mask.w))] ? 1:0;
  return {w,h,data};
}
/** Zhang-Suen thinning. 작은 마스크에서 계산하고 후보점을 골격 위에 놓는다. */
export function estimateJoints(mask: Mask|null): { joints:Joints; humanoid:boolean; skeletonPixels:number } {
  const {w,h,data}=sampleMask(mask); const sk=data.slice();
  const offsets=[-w,-w+1,1,w+1,w,w-1,-1,-w-1];
  let changed=true;
  for(let it=0;it<64&&changed;it++) { changed=false;
    for(let pass=0;pass<2;pass++) { const remove:number[]=[];
      for(let y=1;y<h-1;y++) for(let x=1;x<w-1;x++) { const i=y*w+x;if(!sk[i])continue;
        const p=offsets.map(o=>sk[i+o]!); const count=p.reduce((a,b)=>a+b,0); let transitions=0;
        for(let k=0;k<8;k++)if(!p[k]&&p[(k+1)%8])transitions++;
        if(count<2||count>6||transitions!==1)continue;
        const a=pass===0?p[0]!*p[2]!*p[4]!:p[0]!*p[2]!*p[6]!;
        const b=pass===0?p[2]!*p[4]!*p[6]!:p[0]!*p[4]!*p[6]!;
        if(!a&&!b)remove.push(i);
      }
      for(const i of remove)sk[i]=0; changed ||= remove.length>0;
    }
  }
  const points:Array<{x:number;y:number}>=[];let x0=1,y0=1,x1=0,y1=0;
  for(let i=0;i<data.length;i++)if(data[i]) {const x=i%w/w,y=Math.floor(i/w)/h;x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);if(sk[i])points.push({x,y});}
  const joints=defaultJoints();
  for(const n of JOINT_NAMES){const q=joints[n];const target={x:x0+q.x*(x1-x0),y:y0+q.y*(y1-y0)};
    let nearest=target,best=Infinity;for(const p of points){const d=(p.x-target.x)**2+(p.y-target.y)**2;if(d<best){best=d;nearest=p;}}joints[n]={...nearest};}
  // 두 다리 사이 빈 공간이 있는지 확인. 자동 판정은 제안일 뿐, 직접 수정 가능.
  const row=Math.min(h-2,Math.round((y0+(y1-y0)*.82)*h));let runs=0,inside=false;
  for(let x=0;x<w;x++){const on=!!data[row*w+x];if(on&&!inside)runs++;inside=on;}
  return {joints,humanoid:runs>=2&&points.length>12,skeletonPixels:points.length};
}
export function makeSkeleton(joints:Joints,aspect:number,height=1.5) {
  const positions=JOINT_NAMES.map(n=>new THREE.Vector3((joints[n].x-.5)*height*aspect,(1-joints[n].y)*height,0));
  const bones=JOINT_NAMES.map((n,i)=>{const b=new THREE.Bone();b.name=n;b.position.copy(positions[i]!);if(PARENTS[i]!>=0)b.position.sub(positions[PARENTS[i]!]!);return b;});
  bones.forEach((b,i)=>{if(PARENTS[i]!>=0)bones[PARENTS[i]!]!.add(b);});
  return {bones,positions,byName:Object.fromEntries(bones.map(b=>[b.name,b])) as Record<JointName,THREE.Bone>};
}
/** 윤곽까지의 거리로 채운 부드러운 연속 등위면. 미관측 옆·뒤는 추정이다. */
export function inflatedGeometry(mask:Mask|null,aspect:number,height=1.5,resolution=64):THREE.BufferGeometry {
  const n=resolution,{data}=sampleMask(mask,n),depth=new Float32Array(n*n),distance=new Float32Array(n*n),edge:Array<[number,number]>=[];
  if(!data.some(Boolean))for(let y=1;y<n-1;y++)for(let x=1;x<n-1;x++)data[y*n+x]=1;
  for(let y=1;y<n-1;y++)for(let x=1;x<n-1;x++)if(!data[y*n+x]&&(data[y*n+x-1]||data[y*n+x+1]||data[(y-1)*n+x]||data[(y+1)*n+x]))edge.push([x,y]);
  // A completely opaque/failed mask has no internal edge: use its rectangular border.
  if(!edge.length)for(let i=0;i<n;i++)edge.push([0,i],[n-1,i],[i,0],[i,n-1]);
  let radius=0;
  for(let y=2;y<n-2;y++)for(let x=2;x<n-2;x++)if(data[y*n+x]){
    let d=Infinity;for(const [ex,ey] of edge)d=Math.min(d,((x-ex)*aspect)**2+(y-ey)**2);
    distance[y*n+x]=Math.max(.1,Math.sqrt(d)-.5);radius=Math.max(radius,distance[y*n+x]!);
  }
  for(let i=0;i<depth.length;i++){const d=distance[i]!;depth[i]=.9*Math.sqrt(Math.max(0,d*(2*radius-d)));}
  const zScale=Math.max(1,aspect);
  const material=new THREE.MeshBasicMaterial();const mc=new MarchingCubes(n,material,false,false,60000);mc.isolation=0;
  for(let z=0;z<n;z++)for(let y=0;y<n;y++)for(let x=0;x<n;x++){
    const row=n-1-y,d=depth[row*n+x]!,zz=(z-(n-1)/2)*zScale;
    mc.field[z*n*n+y*n+x]=d>0?d-Math.abs(zz)-.013:-1;
  }
  mc.update();const raw=new THREE.BufferGeometry();
  raw.setAttribute('position',new THREE.BufferAttribute((mc.geometry.attributes.position!.array as Float32Array).slice(0,mc.count*3),3));
  const g=mergeVertices(raw,1e-5);raw.dispose();mc.geometry.dispose();material.dispose();
  const p=g.getAttribute('position'),uv:number[]=[],color:number[]=[];
  for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i);p.setXYZ(i,x*height*aspect/2,(y+1)*height/2,z*zScale*height/2);uv.push((x+1)/2,(y+1)/2);color.push(1,1,1);}
  // Relax voxel stair steps without changing connectivity or opening the surface.
  const adjacent=Array.from({length:p.count},()=>new Set<number>()),ix=g.index!;
  for(let i=0;i<ix.count;i+=3){const ids=[ix.getX(i),ix.getX(i+1),ix.getX(i+2)];for(const v of ids)for(const u of ids)if(u!==v)adjacent[v]!.add(u);}
  for(let pass=0;pass<3;pass++){const next=new Float32Array(p.array);for(let i=0;i<p.count;i++){const ns=adjacent[i]!;if(!ns.size)continue;let x=0,y=0,z=0;for(const j of ns){x+=p.getX(j);y+=p.getY(j);z+=p.getZ(j);}next[i*3]=p.getX(i)*.55+x/ns.size*.45;next[i*3+1]=p.getY(i)*.55+y/ns.size*.45;next[i*3+2]=p.getZ(i)*.55+z/ns.size*.45;}p.array.set(next);}
  g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setAttribute('color',new THREE.Float32BufferAttribute(color,3));g.computeVertexNormals();return g;
}
export function skinGeometry(g:THREE.BufferGeometry,positions:THREE.Vector3[],whole=false){
  const ids:number[]=[],weights:number[]=[];const p=new THREE.Vector3(),q=new THREE.Vector3();
  for(let i=0;i<g.attributes.position!.count;i++){p.fromBufferAttribute(g.attributes.position!,i);const ranks=positions.map((a,j)=>{const child=PARENTS.findIndex(v=>v===j);const b=positions[child]??a;if(a.distanceToSquared(b)<1e-10)q.copy(a);else new THREE.Line3(a,b).closestPointToPoint(p,true,q);return {j,d:p.distanceToSquared(q)};}).sort((a,b)=>a.d-b.d).slice(0,4);
    const ww=ranks.map(r=>1/(.002+r.d)**2),sum=ww.reduce((a,b)=>a+b,0);
    for(let k=0;k<4;k++){ids.push(whole?0:ranks[k]!.j);weights.push(whole?(k===0?1:0):ww[k]!/sum);}
  }
  g.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(ids,4));g.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights,4));
}
export function boundaryEdges(g:THREE.BufferGeometry){const edges=new Map<string,number>();const ix=g.index!;for(let i=0;i<ix.count;i+=3){const t=[ix.getX(i),ix.getX(i+1),ix.getX(i+2)];for(let k=0;k<3;k++){const a=t[k]!,b=t[(k+1)%3]!,key=a<b?`${a},${b}`:`${b},${a}`;edges.set(key,(edges.get(key)??0)+1);}}return [...edges.values()].filter(n=>n!==2).length;}
