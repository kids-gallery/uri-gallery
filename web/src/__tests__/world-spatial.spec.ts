import {describe,it,expect} from 'vitest';
import {createLayout,onFloor} from '../app/world/spatialLayout';
import {NavigationWorld} from '../app/world/spatialNavigation';
import {distanceToFitArtwork} from '../app/world/cameraRig';
import type {ThemeId} from '../app/world/themes';
import {wallSlot,pedestalSlot,standPoint,STAND,WALL_SLOTS,PEDESTAL_SLOTS,type RoomSpec} from '../app/world/museum';
const modes:ThemeId[]=['classic','block','forest','toy'];
// §2-22 검토 1: 6장·10장 묶음의 마지막 작품(벽 5·9번 칸) 앞이 빈 받침대에 막혀 로비로 옮겨지던 문제
describe('standing spot in front of every artwork',()=>{
  it('lets the avatar stand (and walk) in front of every wall and pedestal slot in every mode and room count',()=>{
    const bare=new Set<number>();
    for(const mode of modes)for(let count=1;count<=6;count++){
      // 미술관은 클래식에서만 높은 홀을 쓴다(Museum.applyTheme)
      const l=createLayout(mode,count,mode==='classic'),n=new NavigationWorld(l.solids,(x,z)=>onFloor(l,x,z)),can=(x:number,z:number)=>n.canStand(x,z);
      l.rooms.forEach((p,index)=>{
        const room:RoomSpec={index,age:0,part:1,title:'',subtitle:'',side:p.side,cz:p.z,cx:p.x},at=`${mode} rooms${count} #${index}`;
        for(let i=0;i<WALL_SLOTS;i++){
          const {pos,normal}=wallSlot(room,i),s=standPoint(pos,normal,STAND.wall,can);
          expect(can(s.x,s.z),`${at} wall${i}`).toBe(true);
          expect(Math.abs(s.x-p.x)<5&&Math.abs(s.z-p.z)<5,`${at} wall${i} same room`).toBe(true);
          const front=standPoint(pos,normal,STAND.wall,can,[]);
          if(!can(front.x,front.z)){bare.add(i);expect(n.route(l.spawn,s,l.nodes).length,`${at} wall${i} route`).toBeGreaterThan(0);}
        }
        for(let i=0;i<PEDESTAL_SLOTS;i++){const s=standPoint(pedestalSlot(room,i),{x:-p.side,z:0},STAND.pedestal,can);expect(can(s.x,s.z),`${at} pedestal${i}`).toBe(true);}
      });
    }
    // 비켜 서기 없이 앞 자리만 쓰면 받침대 옆 벽 5·9번 칸에서만 막힌다(시험이 원인을 실제로 덮는지 확인)
    expect([...bare].sort((a,b)=>a-b)).toEqual([5,9]);
  });
});
describe('authored museum circulation',()=>{
  it('has four distinct room layouts, with safe spawn and routes to every room',()=>{
    const signatures=new Set<string>();
    for(const mode of modes){
      const l=createLayout(mode,4,false),n=new NavigationWorld(l.solids,(x,z)=>onFloor(l,x,z));
      signatures.add(JSON.stringify(l.rooms));expect(n.canStand(l.spawn.x,l.spawn.z)).toBe(true);
      for(const r of l.rooms){const stand={x:r.x+r.side*2.52,z:r.z-3.6};expect(n.canStand(stand.x,stand.z)).toBe(true);const route=n.route(l.spawn,stand,l.nodes);expect(route.length,mode).toBeGreaterThan(0);let p=l.spawn;for(const next of route){expect(n.clearLine(p,next),mode).toBe(true);p=next;}}
    }
    expect(signatures.size).toBe(4);
  });
  it('cannot tunnel through a thin wall after a long frame, but slides along it',()=>{
    const n=new NavigationWorld([{min:[2,0,-10],max:[2.3,3,10]}],()=>true),p={x:0,z:0};n.move(p,12,3);expect(p.x).toBeLessThan(1.6);expect(p.z).toBeCloseTo(3);
  });
  // §2-20: 클래식 신랑 가운데는 걸을 수 있고(10/22의 화단 자리), 전시실 사이 신랑 벽 바깥은 걸을 수 없다
  it('walks the classic nave, stops outside its side walls, and rejects nonfinite or off-floor movement',()=>{
    const l=createLayout('classic',4,false),n=new NavigationWorld(l.solids,(x,z)=>onFloor(l,x,z));expect(n.canStand(0,-8)).toBe(true);expect(n.canStand(10,-18.5)).toBe(false);expect(n.canStand(100,100)).toBe(false);expect(n.canStand(NaN,0)).toBe(false);
  });
  // 설계서 2-1 문 드나들기: 보이는 문틀 어디서 밀어도 들어가고, 문에서 먼 벽은 그대로 막는다
  it('walks into a room from anywhere within the visible door frame',()=>{
    for(const mode of modes)for(const count of [1,4,8]){
      const l=createLayout(mode,count,false),n=new NavigationWorld(l.solids,(x,z)=>onFloor(l,x,z));
      for(const r of l.rooms)for(let dz=-2;dz<=2;dz+=.25){
        const door=r.x-r.side*5,p={x:door-r.side*1.2,z:r.z+dz};
        if(!n.canStand(p.x,p.z))continue;
        n.move(p,r.side*6,0);
        expect((p.x-door)*r.side,`${mode} ${count} dz=${dz}`).toBeGreaterThan(1);
      }
    }
  });
  it('slips into the door when a thumb pushes up to 30 degrees off',()=>{
    for(const mode of modes){
      const l=createLayout(mode,1,false),n=new NavigationWorld(l.solids,(x,z)=>onFloor(l,x,z)),r=l.rooms[0]!,door=r.x-r.side*5;
      for(const lean of [-.5,.5]){const p={x:door-r.side*1.2,z:r.z+1.5};n.move(p,r.side*5,lean*5);expect((p.x-door)*r.side,`${mode} ${lean}`).toBeGreaterThan(.6);}
    }
  });
  it('keeps a wall away from the door solid and does not fight a diagonal push',()=>{
    const wall=new NavigationWorld([{min:[2,0,-10],max:[2.3,3,10]}],()=>true),p={x:1,z:0};
    wall.move(p,3,0);expect(p.x).toBeLessThan(1.6);expect(p.z).toBe(0);
    const l=createLayout('forest',1,false),n=new NavigationWorld(l.solids,(x,z)=>onFloor(l,x,z)),r=l.rooms[0]!;
    const door=r.x-r.side*5,far={x:door-r.side*1.2,z:r.z+4};
    n.move(far,r.side*6,0);expect((far.x-door)*r.side).toBeLessThan(0);expect(far.z).toBe(r.z+4);
    const away={x:door-r.side*1.2,z:r.z+1.6};n.move(away,r.side*3,3);expect((away.x-door)*r.side).toBeLessThan(0);expect(away.z).toBeGreaterThan(r.z+1.6);
  });
  it('retains theme-specific layouts under the high-hall choice',()=>{
    for(const mode of modes){expect(createLayout(mode,4,true).rooms).toEqual(createLayout(mode,4,false).rooms);expect(createLayout(mode,4,true).pieces.some(p=>p.y===10)).toBe(true);}
  });
  it('requires more viewing distance in a narrow portrait viewport',()=>{expect(distanceToFitArtwork(2,1,.46,50)).toBeGreaterThan(distanceToFitArtwork(2,1,1.6,50));});
});
