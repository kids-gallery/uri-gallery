// 3D 미술관 공간(3D미술관_재설계 §2-2): 로비 = 원형 홀(베를린 구 박물관 유형), 회랑 = 그랑드 갤러리 유형, 양옆 나이별 전시실.
// 실제 치수가 아니라 공간 유형을 빌린다. 좌표: y 위, 로비 가운데 원점, 회랑은 -z 쪽.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { THEMES, TILE, scaleUV, type ThemeManager } from './themes';
import { buildRelief, type Mask } from './cutout';
import { worldUV } from './materials';
import { createLayout, onFloor, CLASSIC, classicNaveEnd, type SpatialLayout } from './spatialLayout';
import { Cathedral } from './cathedral';
import { NavigationWorld } from './spatialNavigation';
import { buildDecor, decorBlocked, decorPose, isDecorItem, type Box2, type DecorContext, type DecorItem, type DecorKind, type DecorPose, type DecorSpot } from './decor';
import { buildSpatialScene, disposeSpatialScene } from './spatialScene';

export type InteriorId = 'gallery' | 'cathedral';

export const R = 12; // 로비 반지름
export const ROT_H = 8;
export const COR_W = 10;
export const COR_H = 7;
export const ROOM_D = 10; // 회랑 벽에서 안쪽 깊이(x)
export const ROOM_L = 10; // 방 길이(z)
export const ROOM_H = 6;
export const DOOR_W = 3.2;
export const DOOR_H = 4.2;
export const ROOM_GAP = 2;
export const Z0 = -Math.sqrt(R * R - (COR_W / 2) ** 2); // 회랑이 로비 원과 만나는 z
const ALPHA = Math.asin(COR_W / 2 / R); // 로비 벽의 회랑 입구 반각
export const WALL_SLOTS = 12;
export const PEDESTAL_SLOTS = 3;
export const MAX_AGE = 13;

// ───────────── 작품 자리 계획(순수 함수) ─────────────

export interface PlanWork { id: string; age: number; kind: 'drawing' | 'making'; order: number }
export interface PlanRoom { age: number; part: number }
export interface PlanSlot { room: number; type: 'wall' | 'pedestal'; index: number }

/** 나이 목록과 작품으로 방과 자리를 정한다. 한 방은 벽 12칸 + 받침대 3칸, 넘치면 같은 나이의 다음 방. */
export function planRooms(ages: number[], works: PlanWork[]): { rooms: PlanRoom[]; slots: Map<string, PlanSlot> } {
  // 0은 미분류(§2-15)라 맨 앞 방이 된다
  const allAges = [...new Set([...ages, ...works.map((w) => w.age)])].filter((a) => Number.isInteger(a) && a >= 0 && a <= MAX_AGE).sort((a, b) => a - b);
  const rooms: PlanRoom[] = [];
  const slots = new Map<string, PlanSlot>();
  for (const age of allAges) {
    const list = works.filter((w) => w.age === age).sort((a, b) => a.order - b.order);
    let part = 1;
    let room = rooms.push({ age, part }) - 1;
    let wall = 0, ped = 0;
    for (const w of list) {
      let placed = false;
      while (!placed) {
        // 만들기는 언제나 단상에 선다. 차면 벽에 걸지 않고 다음 전시실로 넘긴다(마스터플랜 3-3 #137)
        if (w.kind === 'making' && ped < PEDESTAL_SLOTS) { slots.set(w.id, { room, type: 'pedestal', index: ped++ }); placed = true; }
        else if (w.kind !== 'making' && wall < WALL_SLOTS) { slots.set(w.id, { room, type: 'wall', index: wall++ }); placed = true; }
        else { part += 1; room = rooms.push({ age, part }) - 1; wall = 0; ped = 0; }
      }
    }
  }
  return { rooms, slots };
}

// ───────────── 방 배치 ─────────────

export interface RoomSpec { index: number; age: number; part: number; title: string; subtitle: string; side: -1 | 1; cz: number; cx?: number }

export function roomCenterZ(i: number) { return Z0 - ROOM_GAP - ROOM_L / 2 - Math.floor(i / 2) * (ROOM_L + ROOM_GAP); }
export function roomSide(i: number): -1 | 1 { return i % 2 === 0 ? -1 : 1; }
export function corridorEnd(n: number) { const slots = Math.max(2, Math.ceil(n / 2)); return Z0 - slots * (ROOM_L + ROOM_GAP) - ROOM_GAP; }

export function wallSlot(r: RoomSpec, i: number): { pos: THREE.Vector3; normal: THREE.Vector3 } {
  const s = r.side;
  const y = 1.6;
  if (i < 4) {
    const z = r.cz + [-1.2, 1.2, -3.6, 3.6][i]!; // 첫 두 작품은 문 정면 가운데(재설계 2-24)
    return { pos: new THREE.Vector3((r.cx ?? s * 10) + s * 4.82, y, z), normal: new THREE.Vector3(-s, 0, 0) };
  }
  const xs = [6.8, 9.2, 11.6, 14.0];
  if (i < 8) return { pos: new THREE.Vector3((r.cx ?? s * 10) + s * (xs[i - 4]! - 10), y, r.cz - ROOM_L / 2 + 0.18), normal: new THREE.Vector3(0, 0, 1) };
  return { pos: new THREE.Vector3((r.cx ?? s * 10) + s * (xs[i - 8]! - 10), y, r.cz + ROOM_L / 2 - 0.18), normal: new THREE.Vector3(0, 0, -1) };
}

export function pedestalSlot(r: RoomSpec, i: number): THREE.Vector3 {
  const s = r.side;
  const p = [[10, -2.4], [10, 2.4], [12.4, 0]][i]!;
  return new THREE.Vector3((r.cx ?? s * 10) + s * (p[0]! - 10), 0, r.cz + p[1]!);
}

/** 작품 앞 서는 자리(§2-22 검토 1): 앞 거리(m)와, 그 자리에 설 수 없을 때 벽을 따라 비켜 설 거리(가까운 것부터) */
export const STAND = { wall: 2.3, pedestal: 1.9, slide: [0.3, 0.6, 0.9] } as const;

/** at(작품 자리)에서 normal 쪽으로 ahead m 앞. 설 수 없으면 벽을 따라 STAND.slide 순서로 양쪽을 본다. 모두 막히면 앞 자리를 그대로 준다(단위 시험이 막는다) */
export function standPoint(at: { x: number; z: number }, normal: { x: number; z: number }, ahead: number, canStand: (x: number, z: number) => boolean, slide: readonly number[] = STAND.slide, out = new THREE.Vector3()) {
  const x0 = at.x + normal.x * ahead, z0 = at.z + normal.z * ahead;
  out.set(x0, 0, z0);
  if (canStand(x0, z0)) return out;
  const tx = -normal.z, tz = normal.x; // 벽을 따라가는 방향
  for (const d of slide) for (const s of [1, -1]) {
    const x = x0 + tx * d * s, z = z0 + tz * d * s;
    if (canStand(x, z)) return out.set(x, 0, z);
  }
  return out;
}

// ───────────── 글씨 질감 ─────────────

export function textTexture(w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d')!, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

const SERIF = '"MC Serif","Noto Serif KR","AppleMyungjo",serif';
const SANS = 'system-ui,-apple-system,"Apple SD Gothic Neo","Malgun Gothic",sans-serif';

function fitText(g: CanvasRenderingContext2D, text: string, maxW: number, font: (px: number) => string, start: number): number {
  let px = start;
  g.font = font(px);
  while (px > 14 && g.measureText(text).width > maxW) { px -= 2; g.font = font(px); }
  return px;
}

function plaqueTexture(title: string, byline: string, detail = '') {
  return textTexture(512, 300, (g, w, h) => {
    g.fillStyle = '#fbf4e6'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#c9a24a'; g.lineWidth = 8; g.strokeRect(6, 6, w - 12, h - 12);
    g.fillStyle = '#4a3526'; g.textAlign = 'left'; g.textBaseline = 'top';
    fitText(g, title, w - 60, (px) => `600 ${px}px ${SERIF}`, 52);
    g.fillText(title, 30, 34);
    g.font = `500 34px ${SANS}`; g.fillStyle = '#6e3550';
    g.fillText(byline, 30, 124);
    if (detail) { g.font = `400 28px ${SANS}`; g.fillStyle = '#7a6650'; fitText(g, detail, w - 60, (px) => `400 ${px}px ${SANS}`, 28); g.fillText(detail, 30, 192); }
  });
}

function signTexture(title: string, subtitle: string) {
  return textTexture(1024, 320, (g, w, h) => {
    g.fillStyle = '#fbf4e6'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#c9a24a'; g.lineWidth = 12; g.strokeRect(10, 10, w - 20, h - 20);
    g.lineWidth = 3; g.strokeRect(28, 28, w - 56, h - 56);
    g.fillStyle = '#6e3550'; g.textAlign = 'center'; g.textBaseline = 'middle';
    fitText(g, title, w - 120, (px) => `600 ${px}px ${SERIF}`, 120);
    g.fillText(title, w / 2, subtitle ? h * 0.42 : h / 2);
    if (subtitle) { g.fillStyle = '#4a3526'; fitText(g, subtitle, w - 120, (px) => `500 ${px}px ${SANS}`, 44); g.fillText(subtitle, w / 2, h * 0.76); }
  });
}

let glowTex: THREE.Texture | null = null;
function glowTexture() {
  if (glowTex) return glowTex;
  glowTex = textTexture(256, 256, (g, w, h) => {
    const r = g.createRadialGradient(w / 2, h * 0.42, 4, w / 2, h / 2, w / 2);
    r.addColorStop(0, 'rgba(255,240,200,.9)');
    r.addColorStop(0.55, 'rgba(255,230,180,.25)');
    r.addColorStop(1, 'rgba(255,220,160,0)');
    g.fillStyle = r; g.fillRect(0, 0, w, h);
  });
  return glowTex;
}

// ───────────── 미술관 ─────────────

export interface WorkInput {
  id: string;
  kind: 'drawing' | 'making';
  texture: THREE.Texture;
  mask: Mask | null;
  aspect: number;
  title: string;
  byline: string;
  slot: PlanSlot;
}

export interface WorkObject {
  id: string;
  room: RoomSpec;
  group: THREE.Group;
  relief: THREE.Mesh;
  normal: THREE.Vector3;
  stand: THREE.Vector3; // 작품 앞 서는 자리
}

export interface MasterpieceInfo { file: string; title: string; artist: string; date: string; source: string }

type Region = { kind: 'rotunda' } | { kind: 'corridor' } | { kind: 'room'; index: number };

const disposeTree = (o: THREE.Object3D) => {
  o.traverse((c) => {
    const m = c as THREE.Mesh;
    if (m.geometry) m.geometry.dispose();
    const mat = m.material as THREE.Material | THREE.Material[] | undefined;
    const list = Array.isArray(mat) ? mat : mat ? [mat] : [];
    for (const x of list) {
      if ((x as THREE.Material & { userData: { shared?: boolean } }).userData.shared) continue;
      const map = (x as THREE.MeshBasicMaterial).map;
      if (map && (map as THREE.Texture & { userData: { shared?: boolean } }).userData.shared !== true && map instanceof THREE.CanvasTexture) map.dispose();
      x.dispose();
    }
  });
};


export class Museum {
  readonly root = new THREE.Group();
  readonly cameraSolids:THREE.Object3D[]=[];
  readonly pickables: THREE.Object3D[] = [];
  readonly floors: THREE.Object3D[] = [];
  readonly walls: THREE.Object3D[] = [];
  rooms: RoomSpec[] = [];
  works = new Map<string, WorkObject>();
  masterpieces: MasterpieceInfo[] = [];
  private wing = new THREE.Group();
  private details = new THREE.Group();
  /** 로비 대표작 자리(엔진의 화면 위치 확인도 읽는다) */
  readonly featured = new THREE.Group();
  private obstacles: Array<{ x: number; z: number; r: number }> = [];
  private staticObstacles: Array<{ x: number; z: number; r: number }> = [];
  private zEnd = corridorEnd(0);
  private glowMat: THREE.MeshBasicMaterial;
  private glassMat: THREE.MeshStandardMaterial;
  private matteMat: THREE.MeshStandardMaterial;
  private lobbySignMesh: THREE.Mesh | null = null;
  interior: InteriorId = 'gallery';
  reduced = false;
  private layout!: SpatialLayout;
  /** 미니맵이 읽는 지금 평면 */
  get plan(): SpatialLayout { return this.layout; }
  private navigation!: NavigationWorld;
  private architecture: ReturnType<typeof buildSpatialScene> | null = null;
  private workSlots = new Map<string, PlanSlot>();
  private env: THREE.Texture | null = null;
  private decorGroups: THREE.Object3D[] = [];
  /** 클래식 모드의 대성당 실내(§2-20). 처음 클래식이 될 때 한 번 만들고 다시 쓴다 */
  private cathedral: Cathedral | null = null;

  constructor(private theme: ThemeManager) {
    this.glowMat = new THREE.MeshBasicMaterial({ map: glowTexture(), transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false });
    this.glassMat = new THREE.MeshStandardMaterial({ color: '#dff3ff', transparent: true, opacity: 0.14, roughness: 0.05, metalness: 0, depthWrite: false });
    this.matteMat = new THREE.MeshStandardMaterial({ color: '#f6efe1', roughness: 0.95 });
    for (const m of [this.glowMat, this.glassMat, this.matteMat]) m.userData.shared = true;
    if (this.glowMat.map) this.glowMat.map.userData.shared = true; // 대표작 빛도 같은 질감을 쓴다
    for (const m of Object.values(theme.mats)) m.userData.shared = true;
    this.root.add(this.wing, this.featured,this.details);
    this.applyTheme();
  }

  /** Build the replacement before touching the current scene or shared artwork resources. */
  applyTheme(){
    for (const st of this.stands) st.visible = !this.wallBehindMasterpieces();
    const classic=this.theme.current==='classic';
    const layout=createLayout(this.theme.current,this.rooms.length,classic);
    const next=buildSpatialScene(layout,this.theme.mats,this.theme.current);
    const navigation=new NavigationWorld(layout.solids,(x,z)=>onFloor(layout,x,z));
    const old=this.architecture;
    this.layout=layout;this.navigation=navigation;this.architecture=next;
    this.root.add(next.root);
    if(old){
      const oldFloors=new Set(old.floors),oldWalls=new Set(old.walls);
      this.floors.splice(0,this.floors.length,...this.floors.filter(o=>!oldFloors.has(o as THREE.Mesh)));
      this.walls.splice(0,this.walls.length,...this.walls.filter(o=>!oldWalls.has(o as THREE.Mesh)));
      disposeSpatialScene(old.root);
    }
    this.floors.push(...next.floors);this.walls.push(...next.walls);
    this.rooms.forEach((r,i)=>{const p=layout.rooms[i]!;r.cx=p.x;r.cz=p.z;r.side=p.side;});
    for(const [id,w] of this.works){
      const slot=this.workSlots.get(id);if(!slot)continue;
      if(slot.type==='wall'){
        const {pos,normal}=wallSlot(w.room,slot.index);w.group.position.copy(pos);w.normal.copy(normal);
        w.group.rotation.y=Math.atan2(normal.x,normal.z);this.standFor(pos,normal,STAND.wall,w.stand);
      }else{const p=pedestalSlot(w.room,slot.index);w.group.position.set(p.x,1,p.z);w.normal.set(-w.room.side,0,0);w.group.rotation.y=Math.atan2(w.normal.x,w.normal.z);this.standFor(p,w.normal,STAND.pedestal,w.stand);}
    }
    this.wing.traverse(o=>{const i=o.userData.roomSign;if(typeof i==='number'){const r=this.rooms[i];if(r){o.position.set(r.cx!-r.side*5.2,3,r.cz);o.rotation.y=-r.side*Math.PI/2;}}});
    if(classic)this.buildCathedral(layout,next.root);else if(this.cathedral)this.root.remove(this.cathedral.root);
    this.rebuildDecor();
    this.dressInterior();
  }
  /** §2-20: 클래식 평면 위에 교차부 돔과 신랑을 세우고, 평면의 바닥·벽·기둥·장식선을 대성당 재질로 바꾼다 */
  private buildCathedral(layout:SpatialLayout,scene:THREE.Object3D){
    const c=this.cathedral??=new Cathedral();if(this.env)c.setEnv(this.env);
    // 신랑 폭 = 평면의 신랑 벽, 교차부 돔은 신랑보다 0.5m 넓게, 전시실(방 10m, 문 3.6×3.3m)은 옆 예배당이 된다
    const half=CLASSIC.naveHalf,R=half+.5,zEnd=classicNaveEnd(layout.rooms.length);
    c.build({R,Z0:-Math.sqrt(R*R-half*half),zEnd,corW:half*2,corH:CLASSIC.roomWall,roomD:10,roomL:10,roomH:CLASSIC.roomWall,doorW:3.6,doorH:3.3,rooms:layout.rooms.map(r=>({side:r.side,cz:r.z}))});
    if(!c.root.parent)this.root.add(c.root);
    const t=this.theme.mats,swap=new Map<THREE.Material,THREE.Material>([[t.floor,c.mats.floor],[t.wall,c.mats.stone],[t.column,c.mats.marble],[t.pedestal,c.mats.marble],[t.trim,c.mats.gold]]);
    // 평평한 천장·천창·러그는 대성당 천장과 겹치므로 숨긴다(예전 대성당 실내와 같은 규칙)
    const hide=new Set<THREE.Material>([t.ceiling,t.skylight,t.carpet]);
    scene.traverse(o=>{if(o instanceof THREE.Mesh){const mat=o.material as THREE.Material,m=swap.get(mat);if(m)o.material=m;else if(hide.has(mat))o.visible=false;}});
  }
  setInterior(id:InteriorId,env:THREE.Texture|null=null){
    const previous=this.interior;this.interior=id;if(env)this.env=env;
    try{this.applyTheme();}catch(error){this.interior=previous;throw error;}
  }
  private dressInterior(){
    this.cameraSolids.length=0;
    this.cameraSolids.push(...(this.architecture?.camera??[]));
    this.featured.traverse(o=>{if(o instanceof THREE.Mesh && !(o.material as THREE.Material).transparent)this.cameraSolids.push(o);});
    this.root.updateMatrixWorld(true);
  }
  move(position:{x:number;z:number},dx:number,dz:number){return this.navigation.move(position,dx,dz);}

  // ───────── 공간 꾸미기(§2-15) ─────────
  private decorItems: DecorItem[] = [];
  private decorGroup = new THREE.Group();
  /** 지금 공간에서 보이는 소품 ID(놓을 수 없게 된 것은 기록만 남고 보이지 않는다) */
  shownDecor = new Set<string>();
  setDecor(items: DecorItem[]) { this.decorItems = items.filter(isDecorItem); this.rebuildDecor(); }
  private decorPoseOf(kind: DecorKind, work: string, spot: DecorSpot): DecorPose | null {
    const w = this.works.get(work), slot = this.workSlots.get(work);
    if (!w || !slot) return null;
    return decorPose(kind, slot.type, { x: w.group.position.x, z: w.group.position.z }, { x: w.normal.x, z: w.normal.z }, spot);
  }
  private decorContext(others: Box2[]): DecorContext {
    const layout = this.layout;
    const doors: Box2[] = layout.rooms.map((r) => { const dx = r.x - r.side * 5, a = dx - r.side * 1.8, b = dx + r.side * 2.8; return { minX: Math.min(a, b), maxX: Math.max(a, b), minZ: r.z - 1.9, maxZ: r.z + 1.9 }; });
    return {
      onFloor: (x, z) => onFloor(layout, x, z, 0),
      hitsSolid: (b) => layout.solids.some((s) => s.min[1] < 1.2 && b.minX < s.max[0] && b.maxX > s.min[0] && b.minZ < s.max[2] && b.maxZ > s.min[2]),
      stands: [...this.works.values()].map((w) => ({ x: w.stand.x, z: w.stand.z })),
      doors, others,
    };
  }
  /** 놓을 수 없으면 이유, 놓을 수 있으면 null. items는 지금 편집 중인 배치 */
  checkDecor(kind: DecorKind, work: string, spot: DecorSpot, items: DecorItem[]): string | null {
    const pose = this.decorPoseOf(kind, work, spot);
    if (!pose) return '이 작품 옆에는 놓을 수 없어요';
    const others = items.filter((i) => this.shownDecor.has(i.id)).map((i) => this.decorPoseOf(i.kind, i.work, i.spot)?.box).filter((b): b is Box2 => !!b);
    return decorBlocked(pose, this.decorContext(others));
  }
  rebuildDecor() {
    for (const c of [...this.decorGroup.children]) { this.decorGroup.remove(c); c.traverse((o) => { if (o instanceof THREE.Mesh) o.geometry.dispose(); }); }
    if (!this.decorGroup.parent) this.root.add(this.decorGroup);
    this.shownDecor.clear();
    const boxes: Box2[] = [];
    for (const it of this.decorItems) {
      const pose = this.decorPoseOf(it.kind, it.work, it.spot);
      if (!pose || decorBlocked(pose, this.decorContext(boxes))) continue; // 이 공간에 맞지 않으면 보관만 한다
      const g = buildDecor(it.kind); g.position.set(pose.x, 0, pose.z); g.rotation.y = pose.yaw; g.userData.decorId = it.id;
      this.decorGroup.add(g); this.shownDecor.add(it.id); boxes.push(pose.box);
    }
    const layout = this.layout;
    this.navigation = new NavigationWorld([...layout.solids, ...boxes.map((b) => ({ min: [b.minX, 0, b.minZ] as [number, number, number], max: [b.maxX, 1, b.maxZ] as [number, number, number] }))], (x, z) => onFloor(layout, x, z));
  }

  private m(k: keyof ThemeManager['mats']) { return this.theme.mats[k]; }

  private floorPlane(w: number, d: number, x: number, z: number, y = 0, mat = this.m('floor')) {
    const geo = scaleUV(new THREE.PlaneGeometry(w, d), w / TILE, d / TILE);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, y, z);
    mesh.userData.floor = true;
    mesh.receiveShadow=true;
    this.floors.push(mesh);
    return mesh;
  }

  private wallPlane(w: number, h: number, pos: THREE.Vector3, rotY: number, mat = this.m('wall')) {
    const geo = scaleUV(new THREE.PlaneGeometry(w, h), w / TILE, h / TILE);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(pos);
    mesh.rotation.y = rotY;
    mesh.receiveShadow=true;
    this.walls.push(mesh);
    return mesh;
  }

  private ceilingPlane(w: number, d: number, x: number, z: number, y: number, mat = this.m('ceiling')) {
    const geo = scaleUV(new THREE.PlaneGeometry(w, d), w / TILE, d / TILE);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = Math.PI / 2;
    mesh.position.set(x, y, z);
    return mesh;
  }

  /** 로비 위 간판: "{아이}의 미술관" */
  setLobbySign(child: string) {
    if (this.lobbySignMesh) { this.root.remove(this.lobbySignMesh); disposeTree(this.lobbySignMesh); }
    const tex = signTexture(`${child}의 미술관`, '전시실은 이쪽이에요');
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 1.44), new THREE.MeshBasicMaterial({ map: tex }));
    mesh.position.set(0, COR_H - 0.85, Z0 + 0.3); // 회랑 입구 위쪽에 매단다
    // 벽 없는 모드에서 하늘에 떠 보이지 않게 기둥을 세운다(마스터플랜 3-3 #137)
    const post = new THREE.MeshStandardMaterial({ color: '#8a6a48', roughness: 0.8 });
    for (const x of [-2.1, 2.1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.16, COR_H - 0.85, 0.16), post); p.position.set(x, -(COR_H - 0.85) / 2, -0.05); mesh.add(p); }
    this.lobbySignMesh = mesh;
    this.root.add(mesh);
  }

  /** 로비 명화(공공 영역 이미지) */
  async loadMasterpieces(base = '/museum/world/masterpieces/') {
    let items: Array<Record<string, string>> = [];
    try {
      const res = await fetch(`${base}manifest.json`);
      items = (await res.json()).items ?? [];
    } catch { return; }
    const loader = new THREE.TextureLoader();
    // 입구에서 회랑을 볼 때 시야 양옆(±135°)은 비운다. 그 시야의 주인공은 가운데 대표작이다(§2-14)
    const angles = [0, 0.785, -0.785, 1.571, -1.571];
    this.masterpieces = [];
    await Promise.all(items.slice(0, angles.length).map(async (it, i) => {
      const tex = await loader.loadAsync(base + it.file).catch(() => null);
      if (!tex) return;
      tex.colorSpace = THREE.SRGBColorSpace;
      const img = tex.image as { width: number; height: number };
      const aspect = img.width / img.height;
      let w = 2.6, h = w / aspect;
      if (h > 2.2) { h = 2.2; w = h * aspect; }
      const a = angles[i]!;
      const grp = new THREE.Group();
      const r = R - 0.1;
      const side=i%2===0?-1:1;
      grp.position.set(side*11.7,2.6,3+Math.floor(i/2)*4);
      grp.rotation.y=-side*Math.PI/2;
      const canvas = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0.15 }));
      canvas.position.z = 0.07;
      const frame = this.frame(w, h, 0.14);
      const glow = new THREE.Mesh(new THREE.PlaneGeometry(w + 1.6, h + 2.0), this.glowMat);
      glow.position.set(0, 0.3, 0.012);
      const info: MasterpieceInfo = {
        file: it.file ?? '',
        title: it.title_ko || it.title || '',
        artist: it.artist_ko || it.artist || '',
        date: it.date_ko || it.date || '',
        source: it.source ?? '',
      };
      const plaque = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.36), new THREE.MeshBasicMaterial({ map: plaqueTexture(info.title, info.artist, `${info.date} · 메트로폴리탄 미술관 공공 영역`) }));
      plaque.position.set(0, -h / 2 - 0.42, 0.03);
      grp.add(glow, frame, canvas, plaque, this.masterpieceStand(w, h, grp.position.y));
      const index = this.masterpieces.push(info) - 1;
      for (const o of [canvas, plaque]) { o.userData.masterpiece = index; this.pickables.push(o); }
      this.root.add(grp);
    }));
  }

  /** 벽이 없는 앞마당(숲 마을·장난감)에서 명화를 땅에 세우는 지지대(§2-15): 뒷판·기둥·받침·작은 지붕. 벽이 있는 모드에서는 숨긴다 */
  private stands: THREE.Object3D[] = [];
  private masterpieceStand(w: number, h: number, centerY: number): THREE.Group {
    const g = new THREE.Group(); g.name = 'masterpiece-stand';
    const add = (mat: THREE.Material, x: number, y: number, z: number, bw: number, bh: number, bd: number, rz = 0) => {
      const m = new THREE.Mesh(worldUV(new THREE.BoxGeometry(bw, bh, bd)), mat); m.position.set(x, y, z); m.rotation.z = rz; m.castShadow = m.receiveShadow = true; g.add(m); return m;
    };
    const top = h / 2 + 0.45, bottom = -h / 2 - 0.68, ground = -centerY;
    add(this.m('trim'), 0, (top + bottom) / 2, -0.06, w + 0.5, top - bottom, 0.08); // 뒷판(명패까지 덮는다)
    for (const s of [-1, 1]) {
      const x = s * (w / 2 + 0.32);
      add(this.m('trim'), x, (ground + top + 0.25) / 2, -0.04, 0.16, top + 0.25 - ground, 0.16); // 기둥
      add(this.m('pedestal'), x, ground + 0.07, -0.04, 0.42, 0.14, 0.5); // 받침(땅에 닿는다)
      add(this.m('ceiling'), s * (w / 4 + 0.22), top + 0.42, 0.12, w / 2 + 0.75, 0.08, 0.62, -s * 0.32); // 박공지붕 한쪽
    }
    g.visible = !this.wallBehindMasterpieces();
    this.stands.push(g);
    return g;
  }
  /** 앞마당 양옆에 실제 벽이 있는 모드(spatialLayout의 클래식·블록) */
  private wallBehindMasterpieces() { return this.theme.current === 'classic' || this.theme.current === 'block'; }

  /** 로비 흉상(CC0) */
  async loadBusts(url = '/museum/world/sculpture/marble_bust_01.gltf') {
    try {
      const gltf = await new GLTFLoader().loadAsync(url);
      const model = gltf.scene;
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const s = 0.78 / size.y;
      model.scale.setScalar(s);
      const box2 = new THREE.Box3().setFromObject(model);
      model.position.y -= box2.min.y;
      this.root.traverse((o) => {
        if (!o.userData.bustAnchor) return;
        const b = model.clone();
        b.position.y += 1.15 / 2;
        o.add(b);
      });
    } catch { /* 흉상이 없어도 미술관은 열린다 */ }
  }

  frame(w: number, h: number, t: number): THREE.Group {
    const g = new THREE.Group();
    const d = 0.08;
    const mk = (fw: number, fh: number, x: number, y: number) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(fw, fh, d), this.m('trim'));
      m.position.set(x, y, d / 2);
      g.add(m);
    };
    mk(w + 2 * t, t, 0, h / 2 + t / 2);
    mk(w + 2 * t, t, 0, -h / 2 - t / 2);
    mk(t, h, -w / 2 - t / 2, 0);
    mk(t, h, w / 2 + t / 2, 0);
    return g;
  }

  buildWing(rooms: Omit<RoomSpec,'side'|'cz'|'index'|'cx'>[]){
    this.clearWing();this.workSlots.clear();
    this.rooms=rooms.map((r,index)=>({...r,index,side:roomSide(index),cz:roomCenterZ(index)}));
    this.applyTheme();
    for(const r of this.rooms){
      const sign=new THREE.Mesh(new THREE.PlaneGeometry(2.4,.7),new THREE.MeshBasicMaterial({map:signTexture(r.title,r.subtitle)}));
      sign.position.set(r.cx!-r.side*5.2,3,r.cz);sign.rotation.y=-r.side*Math.PI/2;this.wing.add(sign);
      sign.userData.roomSign=r.index;
    }
    const add=new THREE.Mesh(new THREE.PlaneGeometry(2.8,.8),new THREE.MeshBasicMaterial({map:signTexture('+ 전시실 추가','')}));
    add.position.set(-5,1.8,1);add.userData.action='addRoom';this.wing.add(add);this.pickables.push(add);
  }

  private clearWing() {
    // 지우기 전에 회랑·방·작품 아래의 모든 객체를 모아 두고, 판정 목록에서 뺀다
    const gone = new Set<THREE.Object3D>();
    this.wing.traverse((o) => { if (o !== this.wing) gone.add(o); });
    for (const c of [...this.wing.children]) { this.wing.remove(c); disposeTree(c); }
    this.works.clear();
    const keep = (o: THREE.Object3D) => !gone.has(o);
    this.floors.splice(0, this.floors.length, ...this.floors.filter(keep));
    this.walls.splice(0, this.walls.length, ...this.walls.filter(keep));
    this.pickables.splice(0, this.pickables.length, ...this.pickables.filter(keep));
  }

  // ── 작품 걸기 ──
  placeWork(w: WorkInput) {
    this.workSlots.set(w.id,w.slot);
    const room = this.rooms[w.slot.room];
    if (!room) return;
    const group = new THREE.Group();
    group.userData.workId = w.id;
    let relief: THREE.Mesh;
    let normal: THREE.Vector3;
    let stand: THREE.Vector3;
    if (w.slot.type === 'wall') {
      const { pos, normal: n } = wallSlot(room, w.slot.index);
      normal = n;
      let ww = 1.6, hh = ww / w.aspect;
      if (hh > 1.25) { hh = 1.25; ww = hh * w.aspect; }
      group.position.copy(pos);
      group.rotation.y = Math.atan2(n.x, n.z);
      const glow = new THREE.Mesh(new THREE.PlaneGeometry(ww + 1.3, hh + 1.7), this.glowMat);
      glow.position.set(0, 0.2, 0.01);
      const matte = new THREE.Mesh(new THREE.PlaneGeometry(ww + 0.22, hh + 0.22), this.matteMat);
      matte.position.z = 0.03;
      const frame = this.frame(ww + 0.22, hh + 0.22, 0.09);
      relief = buildRelief(w.texture, w.mask, w.aspect, { height: hh });
      const d = (relief.userData.size as { d: number }).d;
      relief.position.z = 0.05 + d / 2 + 0.02;
      // 벽에는 원본(화면용 사본, 배경 포함)을 건다. 입체는 움직일 때만 액자에서 나온다(§2-14)
      relief.visible = false;
      const print = new THREE.Mesh(new THREE.PlaneGeometry(ww, hh), new THREE.MeshStandardMaterial({ map: w.texture, roughness: 0.82, emissive: '#ffffff', emissiveMap: w.texture, emissiveIntensity: 0.12 }));
      print.position.z = 0.045;
      print.name = 'original-print';
      const plaque = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.27), new THREE.MeshBasicMaterial({ map: plaqueTexture(w.title, w.byline) }));
      plaque.position.set(0, -hh / 2 - 0.11 - 0.24, 0.02); // 작품 아래 가운데(옆 칸과 겹치지 않게)
      group.add(glow, matte, frame, print, relief, plaque);
      for (const o of [print, relief, matte, plaque]) { o.userData.workId = w.id; this.pickables.push(o); }
      stand = this.standFor(pos, n, STAND.wall);
    } else {
      const p = pedestalSlot(room, w.slot.index);
      normal = new THREE.Vector3(-room.side, 0, 0);
      let hh = 0.95, ww = hh * w.aspect;
      if (ww > 0.95) { ww = 0.95; hh = ww / w.aspect; }
      group.position.set(p.x, 1.0, p.z);
      group.rotation.y = Math.atan2(normal.x, normal.z);
      relief = buildRelief(w.texture, w.mask, w.aspect, { height: hh, depth: Math.max(0.06, hh * 0.09) });
      relief.position.y = hh / 2 + 0.03;
      const d = (relief.userData.size as { d: number }).d;
      const glass = new THREE.Mesh(new THREE.BoxGeometry(ww + 0.24, hh + 0.2, d + 0.3), this.glassMat);
      glass.position.y = (hh + 0.2) / 2 + 0.01;
      const plaque = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.27), new THREE.MeshBasicMaterial({ map: plaqueTexture(w.title, w.byline) }));
      plaque.position.set(0, -0.32, 0.457);
      group.add(relief, glass, plaque);
      for (const o of [relief, glass, plaque]) { o.userData.workId = w.id; this.pickables.push(o); }
      stand = this.standFor(p, normal, STAND.pedestal);
    }
    this.wing.add(group);
    this.works.set(w.id, { id: w.id, room, group, relief, normal, stand });
  }

  /** 로비 가운데 대표작(§2-14): 원본 사진을 큰 액자로 세운다. 입구 쪽(+z)을 본다. reveal이면 빛이 0에서 켜진다 */
  /** §2-23: 로비에는 작품을 걸지 않는다. 시작 연출·디버그가 쓰는 빈 무리만 남긴다 */

  update(dt: number) {
    if (this.cathedral?.root.parent) this.cathedral.update(dt, this.reduced);
  }

  // ── 이동 판정 ──
  regionOf(x:number,z:number):Region{
    for(const r of this.rooms)if(Math.abs(x-r.cx!)<5.2&&Math.abs(z-r.cz)<5.2)return {kind:'room',index:r.index};
    return z>-3?{kind:'rotunda'}:{kind:'corridor'};
  }
  canStand(x:number,z:number){return this.navigation.canStand(x,z);}
  /** 작품 앞 서는 자리(지금 평면 기준). 걸 때와 모드를 바꿀 때 같은 함수를 쓴다 */
  private standFor(at:THREE.Vector3,normal:THREE.Vector3,ahead:number,out?:THREE.Vector3){return standPoint(at,normal,ahead,(x,z)=>this.canStand(x,z),STAND.slide,out);}
  route(from:THREE.Vector3,to:THREE.Vector3){return this.navigation.route(from,to,this.layout.nodes).map(p=>new THREE.Vector3(p.x,0,p.z));}
  bounds(){return {zEnd:Math.min(-15,...this.rooms.map(r=>r.cz-7))};}
}
