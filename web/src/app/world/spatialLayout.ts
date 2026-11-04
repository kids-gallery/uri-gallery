import type { ThemeId } from './themes';
import type { Point, Solid } from './spatialNavigation';
export interface SpatialRoom extends Point { side: -1 | 1 }
export interface Piece { kind: 'box' | 'cylinder' | 'cone'; x: number; y: number; z: number; w: number; h: number; d: number; material: 'floor'|'wall'|'column'|'trim'|'ceiling'|'pedestal'|'carpet'|'skylight'|'landscape'|'foliage'; yaw?: number; roll?: number; solid?: boolean; floor?: boolean }
export interface Floor { x: number; z: number; w: number; d: number; yaw?: number; round?: boolean }
export interface SpatialLayout { rooms: SpatialRoom[]; pieces: Piece[]; floors: Floor[]; nodes: Point[]; solids: Solid[]; spawn: Point }
/** 클래식 평면의 신랑 치수(§2-20). 대성당 실내(cathedral.ts)도 이 값을 받아 쓴다 */
// naveHalf: 신랑 벽 = 전시실 문 벽(roomX - 방 반폭 5). 전시실이 신랑 벽에 붙어 옆 예배당이 된다
export const CLASSIC = { foyerHalf: 12, aisle: 7, naveHalf: 9, roomWall: 5.4, roomX: 14, firstRoomZ: -13.2, roomStep: 12 } as const;
/** 장난감 섬은 겹치지 않는 만큼만 멀리 둔다(재설계 2-24) */
const toyRadius=(count:number)=>Math.max(22,7.5/Math.sin(Math.PI/(2*(count+1))));
/** 클래식 신랑 끝벽 z: 마지막 전시실(없으면 첫 전시실 자리) 뒤 7m. 평면과 대성당(museum.ts)이 같이 쓴다 */
export function classicNaveEnd(count: number) { return CLASSIC.firstRoomZ - Math.max(0, Math.ceil(count / 2) - 1) * CLASSIC.roomStep - 7; }

export function createLayout(id: ThemeId, count: number, highHall: boolean): SpatialLayout {
  const layout: SpatialLayout = { rooms: [], pieces: [], floors: [], nodes: [], solids: [], spawn: { x: 0, z: 9 } };
  const box = (x: number,y: number,z: number,w: number,h: number,d: number,material: Piece['material'],solid=false) => {
    layout.pieces.push({kind:'box',x,y,z,w,h,d,material,solid});
    if(solid)layout.solids.push({min:[x-w/2,y-h/2,z-d/2],max:[x+w/2,y+h/2,z+d/2]});
  };
  const floor = (x:number,z:number,w:number,d:number,round=false,yaw=0) => {
    layout.floors.push({x,z,w,d,round,yaw});
    layout.pieces.push({kind:round?'cylinder':'box',x,y:-.18,z,w,h:.36,d,material:'floor',floor:true,yaw});
  };
  const path=(a:Point,b:Point,width=4)=>{ const dx=b.x-a.x,dz=b.z-a.z;floor((a.x+b.x)/2,(a.z+b.z)/2,width,Math.hypot(dx,dz)+1,false,Math.atan2(dx,dz));layout.nodes.push(a,b); };
  floor(0,7,24,20,id==='toy');
  layout.nodes.push({x:0,z:9},{x:-4,z:4},{x:4,z:4},{x:-4,z:-2},{x:4,z:-2});
  const hallH=highHall?10:6;
  // The foyer has a genuine 6m camera clearance behind spawn, and physical side walls.
  if(id==='classic'||id==='block'){
    for(const x of [-CLASSIC.foyerHalf,CLASSIC.foyerHalf])box(x,hallH/2,7,.32,hallH,20,'wall',true);
    for(const x of [-8,8]){box(x,hallH/2,14,.6,hallH,.6,'column',true);box(x,hallH,6,7,.35,20,'ceiling');}
    if(id==='block'){box(-4,hallH+1,4,8,.5,14,'ceiling');box(5,hallH+2,0,9,.5,9,'ceiling');}
    else {box(0,hallH,14,24,.45,1,'trim');for(const x of [-6,6])box(x,hallH/2,-2,.5,hallH,.5,'column',true);}
  }else if(id==='forest'){
    for(const x of [-7,7])box(x,hallH/2,12,.55,hallH,.55,'trim',true);
    box(0,hallH,12,15,.5,.6,'trim');
  }else{
    for(const x of [-8,8])for(const z of [0,13])box(x,-2,z,1.5,4,1.5,'trim');
    layout.pieces.push({kind:'cylinder',x:0,y:-.55,z:7,w:26,h:.7,d:26,material:'pedestal'});
  }
  // §2-23: 로비에는 작품을 걸지 않으므로 가운데 대표작 받침대를 두지 않는다
  // Different positions and connections, not a common floorplan with a material swap.
  for(let i=0;i<count;i++){
    const side: -1|1=i%2===0?-1:1, row=Math.floor(i/2);
    let x=side*CLASSIC.roomX,z=CLASSIC.firstRoomZ-row*CLASSIC.roomStep;
    if(id==='block'){x=side*(12+(row%2)*6);z=-9-row*12;}
    if(id==='forest'){x=side*(18+(row%2)*3);z=-11-row*14;}
    if(id==='toy'){const a=Math.PI+(i+1)*Math.PI/(count+1),radius=toyRadius(count);x=Math.cos(a)*radius;z=7+Math.sin(a)*radius;}
    const actualSide: -1|1=x<0?-1:1;
    layout.rooms.push({x,z,side:actualSide});
    const door={x:x-actualSide*5,z}, outside={x:door.x-actualSide*2,z};
    floor(x,z,id==='toy'?15:10.5,id==='toy'?15:10.5,id==='toy');
    const anchor=id==='toy'?{x:0,z:4}:{x:id==='classic'?actualSide*CLASSIC.aisle:0,z};
    path(anchor,outside);path(outside,{x,z});
    if(id==='classic') {path({x:actualSide*CLASSIC.aisle,z:-2},anchor);path({x:-CLASSIC.aisle,z},{x:CLASSIC.aisle,z});}
    else if(id==='toy') path({x:0,z:4},outside,4.5);
    else path({x:0,z:-2},anchor,id==='forest'?5:6);
    const h=id==='toy'?3.1:id==='block'?5.5+(row%2)*1.3:id==='forest'?4.2:CLASSIC.roomWall;
    box(x+actualSide*5,h/2,z,.3,h,10.3,'wall',true);
    for(const dz of [-5,5])box(x,h/2,z+dz,10.3,h,.3,'wall',true);
    for(const dz of [-3.4,3.4])box(door.x,h/2,z+dz,.3,h,3.2,'wall',true);
    box(door.x,h-.55,z,.4,1.1,3.6,'column',true);
    for(const dz of [-1.9,1.9])box(door.x,1.65,z+dz,.55,3.3,.35,'trim',true);
    if(id==='forest'){
      for(const s of [-1,1])layout.pieces.push({kind:'box',x:x+s*2.8,y:5.1,z,w:6.1,h:.3,d:11.6,roll:-s*.32,material:'ceiling'});
      for(const dz of [-4,0,4])box(x,4,z+dz,10.5,.25,.3,'trim');
      // §2-15 숲 마을: 돌 기단(벽이 땅에 앉게), 작품 높이 위의 높은 창(창빛), 처마 밑 도리
      for(const dz of [-5.15,5.15])box(x,.2,z+dz,10.9,.4,.55,'pedestal');
      box(x+actualSide*5.15,.2,z,.55,.4,10.9,'pedestal');
      // 창: 유리(창빛) + 창틀 + 십자 살. along=창이 놓인 벽의 방향(x 또는 z)
      const win=(cx:number,cz:number,along:'x'|'z')=>{const W=1.5,H=.75,t=.09,D=.44,ax=along==='x';
        box(cx,3.35,cz,ax?W:.36,H,ax?.36:W,'skylight');
        for(const dy of [-H/2,H/2])box(cx,3.35+dy,cz,ax?W+2*t:D,t,ax?D:W+2*t,'trim');
        for(const d of [-W/2,W/2])box(ax?cx+d:cx,3.35,ax?cz:cz+d,ax?t:D,H,ax?D:t,'trim');
        box(cx,3.35,cz,ax?.05:D,H,ax?D:.05,'trim');box(cx,3.35,cz,ax?W:D,.05,ax?D:W,'trim');};
      for(const dz of [-5,5])for(const dx of [-2.6,0,2.6])win(x+dx,z+dz,'x');
      for(const dz of [-3,0,3])win(x+actualSide*5,z+dz,'z');
      for(const dz of [-5.5,5.5])box(x,3.95,z+dz,10.9,.22,.22,'trim');
    }else if(id==='toy'){
      layout.pieces.push({kind:'cylinder',x,y:3.55,z,w:7,h:.3,d:7,material:'ceiling'});
    }else {for(const dx of [-3.2,3.2])box(x+dx,h+.12,z,3.6,.3,10.7,'ceiling');box(x,h+.25,z,2,.15,10.5,'skylight');}
    for(const dz of [-4.8,4.8])box(x,.12,z+dz,9.6,.24,.15,'trim');
    for(const [dx,dz] of [[0,-2.4],[0,2.4],[2.4*actualSide,0]])box(x+dx!,.5,z+dz!,.9,1,.9,'pedestal',true);
    layout.nodes.push(outside,{x:door.x,z},{x:x-actualSide*2.5,z});
    for(const dx of [-3.2,3.2])for(const dz of [-3.5,0,3.5])layout.nodes.push({x:x+dx,z:z+dz});
  }
  if(id==='classic'){
    // §2-20 대성당 신랑: 로비 뒤(z=-3)에서 끝벽까지 한 바닥. 옆벽(x=±naveHalf)은 전시실 문 벽과 이어지고, 그 위는 cathedral.ts가 세운다
    const end=classicNaveEnd(count),h=CLASSIC.roomWall,W=CLASSIC.naveHalf;
    floor(0,(-3+end)/2,W*2,-3-end);
    for(const s of [-1,1]){
      let from=-3; // 위(로비 쪽)에서 아래로 내려가며 전시실 자리(z±5)를 비운다
      for(const rz of layout.rooms.filter(r=>r.side===s).map(r=>r.z).sort((a,b)=>b-a)){if(from>rz+5)box(s*W,h/2,(from+rz+5)/2,.32,h,from-rz-5,'wall',true);from=rz-5;}
      if(from>end)box(s*W,h/2,(from+end)/2,.32,h,from-end,'wall',true);
      box(s*(W+CLASSIC.foyerHalf)/2,hallH/2,-3,CLASSIC.foyerHalf-W,hallH,.32,'wall',true); // 로비 뒤 벽 조각
    }
    box(0,h/2,end,W*2,h,.32,'wall',true);
  }
  if(id==='forest'){
    const back=-11-Math.floor(Math.max(0,count-1)/2)*14;
    for(const x of [-11,11]){path({x,z:-2},{x,z:back},4);path({x:0,z:-2},{x,z:-2},4);}
    path({x:-15,z:back},{x:15,z:back},4);
    box(0,-.6,back/2,110,.4,Math.abs(back)+65,'landscape');
  }
  if(id==='block')box(0,-.7,-20,110,.6,140,'landscape');
  if(id==='toy'){
    const radius=toyRadius(count),width=radius*2+20;
    box(0,-.75,-radius/2,width,.7,radius+38,'landscape');
    for(const x of [-width/2+4,width/2-4])for(const z of [-radius-12,20])box(x,-4,z,3,6,3,'landscape');
  }
  if(id==='forest')for(let i=0;i<12;i++){
    const x=(i%2?-1:1)*(10+(i%3)*2),z=-8-Math.floor(i/2)*10;
    if(layout.rooms.some(r=>Math.hypot(r.x-r.side*5-x,r.z-z)<4))continue; // 문 앞 나무는 들어가는 길을 막는다
    box(x,2,z,.7,4,.7,'trim',true);layout.pieces.push({kind:'cone',x,y:5,z,w:5,h:6,d:5,material:'foliage'});
  }
  if(highHall){for(const x of [-9,9]){box(x,5,5,.7,10,.7,'column',true);box(x,10,5,5,.4,12,'ceiling');}box(0,10,11,19,.5,.7,'trim');}
  return layout;
}
export function onFloor(layout:SpatialLayout,x:number,z:number,r=.42){
  return layout.floors.some(f=>{const dx=x-f.x,dz=z-f.z,c=Math.cos(f.yaw??0),s=Math.sin(f.yaw??0),u=dx*c-dz*s,v=dx*s+dz*c;
    return f.round?Math.hypot(dx,dz)<f.w/2-r:Math.abs(u)<f.w/2-r&&Math.abs(v)<f.d/2-r;});
}
