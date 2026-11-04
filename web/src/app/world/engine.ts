// 3D 미술관 엔진(3D미술관_재설계 §2-12): 렌더러 · 시간 흐름 · 입력 · 카메라 · 캐릭터 이동 · 작품 배치와 재생을 묶는다.
// 화면(Vue)은 이 객체에 데이터를 넘기고, 이 객체는 콜백으로 선택 · 근접 · 위치를 알린다.
import { settleWithin } from './settle';
import * as THREE from 'three';
import {occlusionDistance,recoverDistance,distanceToFitArtwork, dragTurn, ZOOM, zoomLift } from './cameraRig';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { Museum, planRooms, MAX_AGE, type RoomSpec, type InteriorId } from './museum';
import type { DecorItem, DecorKind, DecorSpot } from './decor';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js';
import { ThemeManager, type ThemeId } from './themes';
import { buildAvatar, animateAvatar, type AvatarConfig, type AvatarRig } from './avatar';
import { Performance, Particles } from './behaviors';
import { maskFromCutout, drawToCanvas, blobToImage, removeBackground, cutoutCanvas, reliefMask, type Mask } from './cutout';
import { subjectOf } from './subjects';
import { plaqueOf, roomSubtitle, roomTitle } from './curation';
import { play as playSound } from './sound';
import type { MinimapData } from './minimap';
import type { Artwork } from './store';
import { Outdoor, type BuildingData, WORLD_LOOKS } from './outdoor';
import type { MuseumStyle } from '../character/names';
import type { AvatarAction } from './avatar';
import { emoteOf } from './emotes';
import { START, QUICK, FOLLOW, wipeAt, followDistance, insideFraming, titleShot, ease, mix, clamp01, type Vec3 } from './startSequence';

export type Selection = { type: 'work'; id: string } | { type: 'masterpiece'; index: number } | null;

export type InteractionPrompt={kind:'work'|'building';id:string;label:string};
export interface EngineEvents {
  onView?(id:string):void;
  onPrompt?(prompt:InteractionPrompt|null):void;
  onInteractBuilding?(id:string):void;
  onSelect(sel: Selection): void;
  onNear(id: string | null): void;
  onPlace(label: string): void;
  onAction(action: 'addRoom' | 'firstWork'): void;
  onBuilding?(id:string):void;
  onSpace?(space:'plaza'|'town'|'inside'):void;
  /** 시작 연출(§2-17): wait=안쪽 준비를 기다림, go=다시 이어감, hud=도착해 HUD를 보일 때 */
  onStart?(stage:'wait'|'go'|'hud'):void;
  /** 새 작품을 대표작 자리에 걸고 빛이 켜졌을 때(결과 카드를 이때 보인다) */
  onRevealed?(id:string):void;
  /** 작품이 움직이기 시작할 때(§2-22 11 사용 기록) */
  onPlay?(id:string):void;
}

/** 시작 연출 한 번의 상태 */
interface StartRun { t: number; quick: number; swapped: boolean; ready: boolean; skip: boolean; waiting: boolean; from: { pos: Vec3; look: Vec3 }; resolve: () => void; reject: (e: unknown) => void }

/** key: 화면용 사본이 바뀌거나(돌리기, §2-23 B) 배경 지운 사본이 붙으면(§2-22) 새로 만들도록 기억하는 열쇠. 캐릭터 그림은 열쇠를 쓰지 않는다 */
interface Loaded { texture: THREE.CanvasTexture; mask: Mask | null; aspect: number; key?: string }

async function loadAvatarImage(image: Blob): Promise<Loaded> {
  const bmp = await blobToImage(image), c = drawToCanvas(bmp,384);
  const alpha = maskFromCutout(c), m = alpha.ok ? alpha : removeBackground(c);
  const texture = new THREE.CanvasTexture(m.ok ? cutoutCanvas(c,m) : c);
  texture.colorSpace = THREE.SRGBColorSpace;
  return {texture, mask:m.ok?m:null, aspect:c.width/c.height};
}

const SPEED = 3.4;
/** 작품이 움직이는 무대(전시관 가운데 기준, m)(§2-23 A) */
const STAGE = { halfX: 4.2, halfZ: 4.2, ceiling: 6 } as const;
/** 흰빛 전환으로 작품 앞에 서기(§2-23 C): 흰빛 길이(초), 결과 카드를 띄울 때(도착 뒤 초) */
const JUMP = { flash: 0.45, card: 0.6, focus: 6 } as const; // focus: 도착 뒤 카메라 초점을 작품 쪽으로 당기는 초
/** 세로 화면 카메라(§2-23 D): 가로÷세로가 aspect 미만이면 따라가는 거리를 distance배로(2-17 시작 화면의 세로 기준과 같다) */
const PORTRAIT = { aspect: 0.9, distance: 1.3 } as const;

// Blur needs less resolution than the scene. Keep this policy on resize as well (§2-13).
class ReducedBloomPass extends UnrealBloomPass {
  override setSize(width: number, height: number) {
    super.setSize(Math.max(1, Math.round(width / 2)), Math.max(1, Math.round(height / 2)));
  }
}

/** Preserve the multiplicative edge shade before tone mapping, without a separate full-screen pass. */
function shadedOutputPass() {
  const pass = new OutputPass(), marker = '// tone mapping';
  if (!pass.material.fragmentShader.includes(marker)) throw new Error('Expected three r170 OutputShader tone mapping marker');
  pass.material.fragmentShader = pass.material.fragmentShader.replace(marker,
    `float d=length((vUv-0.5)*vec2(1.0,0.82))*1.42;
     gl_FragColor.rgb*=1.0-0.28*smoothstep(0.45,1.0,d);
     ${marker}`);
  return pass;
}

export class MuseumEngine {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(60, 1, 0.05, 400);
  readonly outdoor = new Outdoor();
  space: 'plaza'|'town'|'inside' = 'plaza';
  private ownBuilding:BuildingData={id:'mine',child:'우리 가족',style:'column_temple',mine:true};
  /** title=시작 화면, start=시작 연출, play=조작 중(§2-17) */
  mode:'title'|'start'|'play'='play';
  private titleClock=0;
  private run:StartRun|null=null;
  /** 연출 중에는 사용자의 이동·시점 입력을 받지 않는다(정해진 길은 걷는다) */
  private cinematic=false;
  /** 장면을 바꿀 때 덮는 따뜻한 흰빛(검은 화면 대신) */
  private wipeEl:HTMLDivElement;
  private wipeLevel=0;
  private flashT=0;
  private flashDur=0;
  private snapCamera=false;
  private revealWatch:{id:string;at:number|null;deadline:number}|null=null;
  private cameraDistance=9;
  private prompt:InteractionPrompt|null=null;
  private entering=false;
  private afterEnter:{id:string;thenPlay:boolean}|null=null;
  private enteringTime=0;
  private reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches??false;
  private action:AvatarAction='idle';
  private actionStart=0;
  private actionUntil=0;
  private verticalSpeed=0;
  private customYaw=0;
  private residentRigs:AvatarRig[]=[];
  private residentTicket=0;
  readonly theme = new ThemeManager();
  readonly museum: Museum;
  private hemi = new THREE.HemisphereLight('#ffffff', '#888888', 1.1);
  private sun = new THREE.DirectionalLight('#ffffff', 1.2);
  private particles = new Particles();
  private renderHeld = false;
  private avatarHidden = false;
  private rig: AvatarRig | null = null;
  private avatarRoot = new THREE.Group();
  private clock = new THREE.Clock();
  private raf = 0;
  private running = false;
  private t = 0;
  private yaw = 0;
  private pitch = 0.32;
  private dist = 4.4;
  private keys = new Set<string>();
  private joy = new THREE.Vector2();
  private route: THREE.Vector3[] = [];
  private stuck = 0;
  private performances: Performance[] = [];
  private loaded = new Map<string, Loaded>();
  private artworks = new Map<string, Artwork>();
  private nearTimer = 0;
  private lastNear: string | null = null;
  private lastPlace = '';
  private customizing = false;
  private inputPaused = false;
  private pendingPlay: string | null = null;
  private ray = new THREE.Raycaster();
  private ro: ResizeObserver;
  private down: { x: number; y: number; t: number; id: number } | null = null;
  private dragged = false;
  private pinch: { d: number; dist: number } | null = null;
  private pointers = new Map<number, { x: number; y: number }>();
  private walkSpeed = 0;
  child = '하늘';
  private visiting=false;

  constructor(private container: HTMLElement, private ev: EngineEvents) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    this.ratioSteps = this.ratioSteps.filter((r) => r <= this.renderer.getPixelRatio() + 0.01);
    this.startRatio = this.renderer.getPixelRatio();
    this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;this.sun.castShadow=true;this.sun.shadow.mapSize.set(1024,1024);Object.assign(this.sun.shadow.camera,{left:-45,right:45,top:45,bottom:-45,near:.5,far:140});this.sun.shadow.bias=-.0005;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    container.appendChild(this.renderer.domElement);
    this.renderer.domElement.style.touchAction = 'none';
    this.renderer.domElement.setAttribute('aria-label', '3D 미술관');
    this.sun.position.set(6, 18, 8);
    this.scene.add(this.hemi, this.sun, new THREE.AmbientLight('#ffffff', 0.2));
    // 금테가 금빛으로 보이도록 실내 환경 반사(three.js 기본 제공 RoomEnvironment)를 액자 재질에만 건다(전체에 걸면 약한 기기가 느려진다)
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.env = env;
    pmrem.dispose();
    this.theme.mats.trim.envMap = env;
    this.theme.mats.trim.envMapIntensity = 1.0;
    this.museum = new Museum(this.theme);
    this.museum.reduced = this.reduced;
    this.scene.add(this.museum.root, this.particles.group, this.avatarRoot,this.outdoor.root);
    this.museum.root.visible=false;this.outdoor.setBuildings([this.ownBuilding]);
    this.wipeEl=document.createElement('div');this.wipeEl.className='w-wipe';this.wipeEl.setAttribute('aria-hidden','true');
    Object.assign(this.wipeEl.style,{position:'absolute',inset:'0',background:'#fff6e6',opacity:'0',pointerEvents:'none'});
    container.appendChild(this.wipeEl);
    this.camera.position.set(24,40,60);
    this.avatarRoot.position.set(0, 0, 28);
    this.avatarRoot.rotation.y = Math.PI;
    this.theme.apply('classic', this.scene, this.hemi, this.sun);
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(container);
    this.resize();
    this.bindInput();
  }

  // ───────── 수명 ─────────
  private decorLoaded=false;
  async loadDecor() {
    if(this.decorLoaded)return;this.decorLoaded=true;
    await Promise.all([this.museum.loadMasterpieces(), this.museum.loadBusts()]);
    this.theme.warm(this.renderer, this.scene, this.camera);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.clock.getDelta();
    const loop = () => {
      if (!this.running) return;
      this.raf = requestAnimationFrame(loop);
      if (document.hidden || this.renderHeld) { this.clock.getDelta(); return; }
      const dt = Math.min(0.1, this.clock.getDelta());
      this.adapt(dt);
      this.frame(dt);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() { this.running = false; cancelAnimationFrame(this.raf); }

  // 느린 기기: 2초 평균 프레임이 33ms를 넘으면 화면 해상도를 한 단계 낮춘다(1.75 → 1.25 → 1 → 0.75)
  private frameSum = 0;
  private frameN = 0;
  private ratioSteps = [1.75, 1.25, 1, 0.75];
  private env: THREE.Texture | null = null;
  private composer: EffectComposer | null = null;
  private bloom: UnrealBloomPass | null = null;
  private fxaa: ShaderPass | null = null;
  private output: OutputPass | null = null;
  private startRatio = 1;
  private baseFov = 60;
  private fovKick = 0;
  private sprinting = false;
  private adapt(dt: number) {
    this.frameSum += dt;
    this.frameN += 1;
    if (this.frameSum < 2) return;
    const avg = this.frameSum / this.frameN;
    this.frameSum = 0;
    this.frameN = 0;
    const cur = this.renderer.getPixelRatio();
    if (avg > 0.033) {
      const next = this.ratioSteps.find((r) => r < cur - 0.01);
      if (next) { this.renderer.setPixelRatio(next); this.resize(); }
    }
  }

  dispose() {
    this.stop();
    this.composer?.dispose(); this.bloom?.dispose(); this.fxaa?.dispose(); this.output?.dispose(); this.composer = null; this.fxaa = null; this.output = null;
    this.ro.disconnect();
    this.unbind();
    this.rig?.dispose();
    this.clearResidents();
    this.outdoor.dispose();
    const materials=new Set<THREE.Material>();const textures=new Set<THREE.Texture>();
    this.scene.traverse(o=>{const m=o as THREE.Mesh;m.geometry?.dispose();for(const mat of Array.isArray(m.material)?m.material:m.material?[m.material]:[])materials.add(mat);});
    for(const mat of materials){for(const v of Object.values(mat))if(v instanceof THREE.Texture)textures.add(v);mat.dispose();}for(const t of textures)t.dispose();for(const l of this.loaded.values())l.texture.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.wipeEl.remove();
  }

  private resize() {
    const w = Math.max(1, this.container.clientWidth), h = Math.max(1, this.container.clientHeight);
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.camera.aspect = w / h;
    this.baseFov = w < 600 ? 68 : 60;
    this.camera.fov = this.baseFov + this.fovKick;
    this.camera.updateProjectionMatrix();
    if (this.composer) { this.composer.setPixelRatio(this.renderer.getPixelRatio()); this.composer.setSize(w, h); }
    if (this.fxaa) {
      const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
      this.fxaa.uniforms.resolution!.value.set(1 / size.x, 1 / size.y);
    }
  }

  // ───────── 데이터 ─────────
  private async load(a: Artwork): Promise<Loaded> {
    const key = `${a.display.size}:${a.rotation ?? 0}:${a.cutout?.size ?? 0}:${a.depth?.size ?? 0}`, hit = this.loaded.get(a.id);
    if (hit && hit.key === key) return hit;
    if (hit) { hit.texture.dispose(); this.loaded.delete(a.id); }
    const bmp = await createImageBitmap(a.display);
    const canvas = drawToCanvas(bmp as unknown as HTMLImageElement, 1024);
    bmp.close?.();
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    texture.userData.shared = true;
    const mask = await reliefMask(a.cutout, a.depth);
    const l = { texture, mask, aspect: canvas.width / canvas.height, key };
    this.loaded.set(a.id, l);
    return l;
  }

  async setWorld(child: string, works: Artwork[], roomAges: number[], visiting=false) {
    this.child = child;this.visiting=visiting;
    this.museum.setLobbySign(child);
    const loadedNow = new Map<string, Loaded>();
    for (const a of works) loadedNow.set(a.id, await this.load(a));
    for (const [id, l] of this.loaded) if (!loadedNow.has(id)) { l.texture.dispose(); this.loaded.delete(id); }
    this.artworks = new Map(works.map((a) => [a.id, a]));
    for (const p of this.performances) p.finish();
    this.performances = [];
    const sortKey = (a: Artwork) => `${a.madeOn || '9999'}-${String(a.no).padStart(6, '0')}`;
    const ordered = [...works].sort((a, b) => (sortKey(a) < sortKey(b) ? -1 : 1));
    const { rooms, slots } = planRooms(roomAges, ordered.map((a, i) => ({ id: a.id, age: a.age, kind: a.kind, order: i })));
    const specs = rooms.map((r, i) => {
      const subjects = ordered.filter((a) => slots.get(a.id)?.room === i).map((a) => a.subject);
      return { age: r.age, part: r.part, title: visiting?`전시실 ${i+1}`:roomTitle(r.age)+(r.part > 1 ? ` ${r.part}` : ''), subtitle: visiting?'':roomSubtitle(subjects) };
    });
    this.museum.buildWing(specs);
    for(const p of this.museum.pickables)if(p.userData.action==='addRoom')p.visible=!visiting&&import.meta.env.VITE_WORLD_SERVER!=='1';
    for (const a of ordered) {
      const slot = slots.get(a.id);
      const l = loadedNow.get(a.id);
      if (!slot || !l) continue;
      const p = plaqueOf({ no: a.no, title: a.title, kind: a.kind, subject: a.subject, material: a.material, age: a.age, madeOn: a.madeOn, words: a.words, child });
      this.museum.placeWork({ id: a.id, kind: a.kind, texture: l.texture, mask: l.mask, aspect: l.aspect, title: p.title, byline: visiting?`${child}의 작품`:a.sample?`${p.byline} · 체험용 작품`:p.byline, slot }); // 견본 표시(§2-15)
    }
    this.museum.setDecor(visiting ? [] : this.decor); // 친구 방문에는 꾸미기를 보이지 않는다(허용 목록 밖)
    this.showFeatured();
    await this.prepareInterior();
    // 캐릭터가 지워진 방 안에 서 있으면 로비로
    if (this.space==='inside' && !this.museum.canStand(this.avatarRoot.position.x, this.avatarRoot.position.z)) this.avatarRoot.position.set(0, 0, 7.2);
  }

  /** 대표작(§2-14): 가족이 고른 작품, 없거나 지워졌으면 가장 최근 작품. 친구 방문에서는 고른 값을 쓰지 않는다 */
  private featuredPick: string | null = null;
  setFeaturedId(id: string | null) { this.featuredPick = id; this.showFeatured(); }
  private featuredWork(): Artwork | undefined {
    const chosen = !this.visiting && this.featuredPick ? this.artworks.get(this.featuredPick) : undefined;
    return chosen ?? [...this.artworks.values()].sort((a, b) => b.createdAt - a.createdAt)[0];
  }
  /** 대표작은 광장 건물 정면 현수막(간판)으로만 쓴다. 로비에는 작품을 걸지 않는다(§2-23) */
  private showFeatured(id?: string) {
    const a = id ? this.artworks.get(id) : this.featuredWork();
    const l = a ? this.loaded.get(a.id) : undefined;
    // 광장 정면 현수막은 내 미술관에서만, 대표작 원본으로 건다. 친구 미술관을 방문하는 동안은 걸지 않는다
    this.outdoor.setBanner(!this.visiting && a && l ? { texture: l.texture, aspect: l.aspect, owner: this.ownBuilding.id } : null);
  }

  /** 새로 남긴 작품의 첫 공개(§2-14): 로비 가운데 액자에 걸고, 그 앞으로 걸어가 빛을 켠다 */
  reveal(id: string) {
    if (this.space !== 'inside') { if (this.space === 'town') this.showPlaza(); this.afterReveal = id; this.enterMuseum(); return; }
    if (!this.artworks.has(id)) return;
    this.showFeatured(id);
    // §2-23: 그 나이 전시관의 작품 앞에 흰빛 전환으로 선다. 결과 카드는 도착한 뒤에 알린다
    this.jumpTo(id);
    this.revealWatch = { id, at: this.t + JUMP.card, deadline: this.t + 3.2 };
    this.ev.onSelect({ type: 'work', id });
    playSound('sparkle');
  }
  private afterReveal: string | null = null;
  private faceAfterRoute = false;
  private faceFeatured() {
    this.avatarRoot.rotation.y = Math.PI;
    this.yaw = 0; this.pitch = MuseumEngine.REST.pitch; this.dist = MuseumEngine.REST.dist;
    this.focusPoint.copy(MuseumEngine.FEATURED_POINT); this.revealFocus = 6; // 6초 동안 카메라 초점을 로비 쪽으로 당긴다
    if (this.revealWatch && this.revealWatch.at === null) this.revealWatch.at = this.t + (this.reduced ? 0 : 0.8);
  }
  private revealFocus = 0;
  /** 초점을 당길 곳(§2-23 C): 흰빛으로 도착한 작품. 시작 연출 도착은 로비 기준점 */
  private focusPoint = new THREE.Vector3();
  private static readonly FEATURED_POINT = new THREE.Vector3(0, 1.9, 0.2);
  /** 로비 대표작 앞 자리(첫 공개와 시작 연출 도착이 같은 자리). 대표작 판에서 3.4m 앞 */
  private static readonly REVEAL_SPOT = new THREE.Vector3(0, 0, 3.6);

  rooms(): RoomSpec[] { return this.museum.rooms; }

  // ───────── 공간 꾸미기(§2-15) ─────────
  private decor: DecorItem[] = [];
  /** 편집 중 미리보기도 같은 함수로 그린다. 저장은 화면(WorldView)이 [완료]에서만 한다 */
  setDecor(items: DecorItem[]) { this.decor = items.map((i) => ({ ...i })); if (!this.visiting) this.museum.setDecor(this.decor); }
  checkDecor(kind: DecorKind, work: string, spot: DecorSpot, items: DecorItem[]) { return this.museum.checkDecor(kind, work, spot, items); }
  decorShown(id: string) { return this.museum.shownDecor.has(id); }

  setTheme(id:ThemeId){
    const previous=this.theme.current;
    this.finishPerformances();
    try{this.theme.apply(id,this.scene,this.hemi,this.sun);this.museum.applyTheme();}
    catch(error){this.theme.apply(previous,this.scene,this.hemi,this.sun);throw error;}
    this.outdoor.apply(id);if(this.space==='inside')this.outdoor.suspend();
    this.resetScenePosition();this.applyLook();if(this.avatarConfig)void this.setAvatar(this.avatarConfig,this.avatarImage);
  }
  setInterior(id:InteriorId){this.finishPerformances();this.museum.setInterior(id,this.env);this.resetScenePosition();this.applyLook();}
  private resetScenePosition(){this.route=[];this.pendingPlay=null;this.ev.onSelect(null);this.ev.onNear(null);if(this.space==='inside'){this.avatarRoot.position.copy(MuseumEngine.REVEAL_SPOT);this.resetView();}}
  get interior(): InteriorId { return this.museum.interior; }
  private get cathedralView() { return this.space === 'inside' && this.museum.interior === 'cathedral'; }
  private applyLook() {
    const id = this.theme.current;
    this.theme.apply(id, this.scene, this.hemi, this.sun);
    this.scene.fog = new THREE.Fog(WORLD_LOOKS[id].horizon, id === 'forest' ? 65 : 65, id === 'forest' ? 240 : 230);
    this.sun.position.set(id === 'forest' ? -20 : 18, id === 'forest' ? 12 : 35, 20); this.renderer.toneMappingExposure = 1.05;
  }
  /** 화면 마감(§2-11 게임 완성도): 은은한 빛 번짐과 가장자리 어둡게. 대성당은 빛 번짐을 더 세게. 자동 조절이 처음 해상도보다 낮추면 끈다 */
  private postReady() {
    if (this.renderer.getPixelRatio() < this.startRatio - 0.01) return null;
    if (!this.composer) {
      const size = this.renderer.getSize(new THREE.Vector2());
      this.composer = new EffectComposer(this.renderer); this.composer.setPixelRatio(this.renderer.getPixelRatio()); this.composer.setSize(size.x, size.y);
      this.composer.addPass(new RenderPass(this.scene, this.camera));
      this.bloom = new ReducedBloomPass(size, 0.42, 0.55, 1.6); this.composer.addPass(this.bloom);
      this.output = shadedOutputPass(); this.composer.addPass(this.output);
      this.fxaa = new ShaderPass(FXAAShader); this.composer.addPass(this.fxaa);
      this.resize();
    }
    // 기준은 톤 매핑 전 선형 밝기다. 1보다 높게 잡아 창·금처럼 아주 밝은 곳만 번지게 한다(낮으면 햇빛 받은 바닥·하늘까지 번져 화면이 뿌옇다)
    if (this.bloom) { const c = this.cathedralView; this.bloom.strength = c ? 0.35 : 0.18; this.bloom.threshold = c ? 1.3 : 1.6; this.bloom.radius = c ? 0.5 : 0.35; }
    // High DPR already supersamples edges; another full-screen pass costs too much on UHD 730.
    if (this.fxaa) this.fxaa.enabled = this.renderer.getPixelRatio() <= 1.25;
    return this.composer;
  }
  setBuilding(style:MuseumStyle,child:string,id='mine'){this.ownBuilding={style,child,id,mine:true};if(this.space==='plaza')this.outdoor.setBuildings([this.ownBuilding]);}
  // Keep the current scene's GPU resources while outside. Replacement and engine disposal own release.
  // The baseline CPU profile showed synchronous program readiness work during entry.
  // compileAsync never settles if a material is disposed while compiling (three 0.170), so entry must not depend on it.
  private prepareInterior(){return settleWithin(()=>this.renderer.compileAsync(this.museum.root,this.camera,this.scene),8000);}
  private finishPerformances(){for(const p of this.performances)p.finish();this.performances=[];this.pendingPlay=null;this.particles.clear();}
  showPlaza(flash=true){this.endStart();this.mode='play';this.cinematic=false;this.finishPerformances();this.afterEnter=null;this.afterReveal=null;this.faceAfterRoute=false;this.clearResidents();this.space='plaza';this.entering=false;this.route=[];this.outdoor.setBuildings([this.ownBuilding]);this.outdoor.root.visible=true;this.museum.root.visible=false;this.applyLook();this.avatarRoot.position.set(0,0,28);this.yaw=0;this.dist=9;if(flash)this.flash(this.reduced?QUICK:.35);this.ev.onSpace?.('plaza');this.ev.onSelect(null);this.ev.onNear(null);}
  showTown(buildings:BuildingData[],focus?:string){this.endStart();this.mode='play';this.cinematic=false;this.finishPerformances();this.afterReveal=null;this.faceAfterRoute=false;this.clearResidents();this.space='town';this.entering=false;this.route=[];this.outdoor.setBuildings(buildings,true);this.outdoor.root.visible=true;this.museum.root.visible=false;this.applyLook();const p=focus?this.outdoor.positions.get(focus):null;this.avatarRoot.position.copy(p??new THREE.Vector3(0,0,25));this.yaw=0;this.dist=12;this.flash(this.reduced?QUICK:.35);this.ev.onSpace?.('town');this.ev.onSelect(null);this.ev.onNear(null);}
  /** 들어가기(§2-17): 문까지 걸어가며 흰빛이 덮이고, 문턱에서 안으로 바꾼 뒤 흰빛이 걷힌다 */
  enterMuseum(){if(this.space==='inside'||this.entering||this.mode!=='play')return;this.entering=true;this.enteringTime=0;if(this.reduced){this.setWipe(1);this.finishEnter();}else this.route=[new THREE.Vector3(0,0,15),new THREE.Vector3(0,0,11.6)];}
  private finishEnter(){this.entering=false;this.space='inside';this.route=[];this.outdoor.suspend();this.museum.root.visible=true;this.applyLook();this.avatarRoot.position.copy(MuseumEngine.REVEAL_SPOT);this.dist=4.4;this.cameraDistance=4.4;this.snapCamera=true;this.flash(this.reduced?QUICK:.3);this.ev.onSpace?.('inside');const next=this.afterEnter;this.afterEnter=null;if(next)this.goTo(next.id,next.thenPlay);const shown=this.afterReveal;this.afterReveal=null;if(shown)this.reveal(shown);const jump=this.afterJump;this.afterJump=null;if(jump)this.jumpTo(jump);}

  // ───────── 시작 화면과 시작 연출(§2-17) ─────────
  /** 대표작 앞 구도(§2-17): 캐릭터는 화면 가운데 아래, 대표작은 가운데 위에 겹치지 않게 놓인다(거리 4.6m, 기울기 0.36, 초점 30% 당김) */
  private static readonly REST = { dist: 4.6, pitch: 0.36 };
  private static readonly FOCUS_PULL = 0.3;
  /** 시작 화면: 이 가족의 광장을 넓은 구도로 보여 준다. 캐릭터는 문 앞 길에서 카메라 쪽을 본다 */
  showTitle(){
    this.showPlaza(false);
    this.mode='title';this.cinematic=true;this.titleClock=0;this.setWipe(0);this.outdoor.openDoors(0);
    const door=this.outdoor.doorOf(this.ownBuilding.id);
    this.avatarRoot.position.set(door.plane.x,0,door.stand);this.avatarRoot.rotation.y=0;
  }
  private titleCamera(){
    const door=this.outdoor.doorOf(this.ownBuilding.id);
    return titleShot(door.facade,this.camera.aspect,this.reduced?0:this.titleClock);
  }
  /** 시작 연출. ready는 안쪽 장면(가족·작품)이 준비되면 풀리는 약속이다. 도착하면 풀리고, ready가 실패하면 시작 화면으로 돌아가 같은 실패로 끝난다 */
  playStart(ready:Promise<unknown>):Promise<void>{
    if(this.mode!=='title')return Promise.resolve();
    return new Promise<void>((resolve,reject)=>{
      const run:StartRun={t:0,quick:0,swapped:false,ready:false,skip:this.reduced,waiting:false,from:this.titleCamera(),resolve,reject};
      this.run=run;this.mode='start';
      const door=this.outdoor.doorOf(this.ownBuilding.id);
      // 문턱 앞까지 먼저 걷고, 안쪽이 준비되면 문 안쪽까지 이어 걷는다
      this.route=[new THREE.Vector3(door.plane.x,0,door.plane.z+1.4)];
      ready.then(()=>{if(this.run!==run)return;run.ready=true;if(!run.swapped)this.route.push(new THREE.Vector3(door.plane.x,0,door.plane.z-.8));},(e)=>{if(this.run!==run)return;this.run=null;this.showTitle();reject(e);});
    });
  }
  /** 연출 중 누르거나 키를 누르면 바로 도착 상태로(장면을 바꾸기 전이면 흰빛을 빠르게 덮었다 걷는다) */
  skipIntro(){if(this.run)this.run.skip=true;}
  private endStart(){if(!this.run)return;const r=this.run;this.run=null;this.mode='play';this.cinematic=false;r.resolve();}
  private stepStart(dt:number){
    const r=this.run!;
    const gate=r.skip?r.quick===0:r.t>=START.wipeIn;
    if(!r.swapped&&!r.ready&&gate){if(!r.waiting){r.waiting=true;this.ev.onStart?.('wait');}}
    else{
      if(r.waiting){r.waiting=false;this.ev.onStart?.('go');}
      if(r.skip)r.quick+=dt;else r.t+=dt;
    }
    if(!r.swapped)this.outdoor.openDoors(Math.min(1,r.t/START.doorOpen));
    if(r.skip){
      // 빠른 길: 흰빛을 QUICK초에 덮고, 도착 상태로 바꾼 뒤 QUICK초에 걷는다
      if(!r.swapped){this.setWipe(Math.max(this.wipeLevel,clamp01(r.quick/QUICK)));if(r.quick>=QUICK&&r.ready)this.swapInside(true);return;}
      // 지금 덮인 만큼에서 QUICK초에 걷는다(이미 걷혔으면 다시 덮지 않는다)
      const w=this.wipeLevel;this.placeFinal();this.flashDur=QUICK;this.flashT=QUICK*w;this.arrive();return;
    }
    this.setWipe(wipeAt(r.t));
    if(!r.swapped&&r.t>=START.swap&&r.ready)this.swapInside(false);
    if(r.swapped){const f=insideFraming(r.t,MuseumEngine.REST);this.pitch=f.pitch;this.dist=f.dist;}
    if(r.t>=START.arrive)this.arrive();
  }
  private swapInside(final:boolean){
    const r=this.run!;r.swapped=true;
    this.space='inside';this.entering=false;this.route=[];this.outdoor.suspend();this.museum.root.visible=true;this.applyLook();
    // 안쪽 입구는 도착 자리 4.4m 뒤(걷는 데 약 1.3초, 도착 시각 안에 닿는다)
    const spot=MuseumEngine.REVEAL_SPOT.clone(),entry=spot.clone().setZ(spot.z+4.4);
    this.avatarRoot.position.copy(final?spot:entry);this.avatarRoot.rotation.y=Math.PI;
    if(!final)this.route=this.museum.route(entry.clone(),spot);
    this.yaw=0;const f=final?MuseumEngine.REST:insideFraming(START.swap,MuseumEngine.REST);this.pitch=f.pitch;this.dist=f.dist;this.cameraDistance=f.dist;
    this.revealFocus=0;this.snapCamera=true;
    this.ev.onSpace?.('inside');
  }
  private placeFinal(){this.route=[];this.avatarRoot.position.copy(MuseumEngine.REVEAL_SPOT);this.avatarRoot.rotation.y=Math.PI;this.yaw=0;this.pitch=MuseumEngine.REST.pitch;this.dist=MuseumEngine.REST.dist;this.cameraDistance=this.dist;this.revealFocus=0;this.snapCamera=true;}
  private arrive(){if(!this.run)return;this.ev.onStart?.('hud');this.endStart();}
  /** 바깥 다가가기: 캐릭터 뒤에서 문 쪽을 보는 구도 */
  private followShot(t:number){
    const target=this.avatarRoot.position.clone().add(new THREE.Vector3(0,1.25,0)),d=followDistance(t);
    return {pos:{x:target.x,y:target.y+Math.sin(FOLLOW.pitch)*d,z:target.z+Math.cos(FOLLOW.pitch)*d},look:{x:target.x,y:target.y+.1,z:target.z-2.5}};
  }
  private setWipe(v:number){if(Math.abs(v-this.wipeLevel)<.001&&v!==0&&v!==1)return;this.wipeLevel=v;this.wipeEl.style.opacity=v.toFixed(3);}
  /** 장면을 바꾼 직후 흰빛을 dur초에 걷는다 */
  private flash(dur:number){this.flashDur=dur;this.flashT=dur;this.setWipe(1);}
  private clearResidents(){this.residentTicket++;for(const r of this.residentRigs){r.root.removeFromParent();r.dispose();}this.residentRigs=[];}
  async setResidents(buildings:Array<BuildingData & {avatar:AvatarConfig;avatarImage:Blob|null}>){this.clearResidents();const ticket=this.residentTicket;for(const b of buildings){let img:Loaded|undefined;if(b.avatar.mode==='image'&&b.avatarImage){img=await loadAvatarImage(b.avatarImage);}if(ticket!==this.residentTicket){img?.texture.dispose();return;}const rig=buildAvatar(b.avatar,img,this.theme.current,true);const p=this.outdoor.positions.get(b.id);if(p){rig.root.position.copy(p).add(new THREE.Vector3(3,0,-3));rig.root.rotation.y=.2;this.outdoor.root.add(rig.root);this.residentRigs.push(rig);}else rig.dispose();}}
  resetView(){this.skipIntro();this.yaw=0;this.pitch=.32;this.dist=this.space==='inside'?4.4:this.space==='town'?12:9;}
  gesture(action:AvatarAction){this.action=action;this.actionStart=this.t;this.actionUntil=this.t+(emoteOf(action)?.seconds??2.4);if(action==='jump'&&this.avatarRoot.position.y<=.02)this.verticalSpeed=4;}


  private avatarConfig: AvatarConfig | null = null;
  private avatarImage: Blob | null = null;
  private avatarLoad = 0;
  async setAvatar(cfg: AvatarConfig, image: Blob | null) {
    const ticket=++this.avatarLoad;this.avatarConfig=cfg;this.avatarImage=image;
    let img: { texture: THREE.Texture; mask: Mask | null; aspect: number } | undefined;
    if (cfg.mode === 'image' && image) {
      img=await loadAvatarImage(image);
    }
    if(ticket!==this.avatarLoad){img?.texture.dispose();return;}
    const rig = buildAvatar(cfg, img, this.theme.current);
    if (this.rig) { this.avatarRoot.remove(this.rig.root); this.rig.dispose(); }
    this.rig = rig;
    this.avatarRoot.add(rig.root);rig.root.traverse(o=>{if(o instanceof THREE.Mesh){o.castShadow=true;o.receiveShadow=true;}});
  }

  // ───────── 행동 ─────────
  play(id: string) {
    const w = this.museum.works.get(id);
    const a = this.artworks.get(id);
    if (!w || !a) return;
    if (this.performances.some((p) => !p.done && p.actor.geometry === w.relief.geometry)) return;
    if (this.performances.filter((p) => !p.done).length >= 3) this.performances.find((p) => !p.done)?.finish();
    const s = subjectOf(a.subject);
    const r = w.room;
    const stage = { cx: r.cx ?? r.side * 10, cz: r.cz, ...STAGE };
    this.performances.push(new Performance(w.relief, w.normal, s.behavior, s.id, stage, this.scene));
    playSound(s.sound);
    this.ev.onPlay?.(id);
  }
  /** 미니맵이 읽는 값(마스터플랜 3-3 #137). 건물 안에서만 준다 */
  minimap(): MinimapData | null {
    if (this.space !== 'inside') return null;
    const a = this.avatarRoot.position;
    return {
      floors: this.museum.plan.floors, x: a.x, z: a.z, yaw: this.avatarRoot.rotation.y,
      works: [...this.museum.works.values()].map((w) => ({ x: w.stand.x, z: w.stand.z, making: this.artworks.get(w.id)?.kind === 'making' })),
    };
  }
  /** 움직여 보기 창에 넘길 작품(마스터플랜 3-3 #137). 전시실의 입체를 읽기만 한다 */
  stageSource(id: string) {
    const w = this.museum.works.get(id), a = this.artworks.get(id);
    if (!w || !a) return null;
    const s = subjectOf(a.subject);
    this.ev.onPlay?.(id);
    return { relief: w.relief, behavior: s.behavior, subject: s.id, sound: s.sound };
  }
  /** 작품이 움직이는 중인가(§2-22 2: 배경 지운 사본을 붙여 다시 그리는 일은 움직임이 끝난 뒤에 한다) */
  performing() { return this.performances.some((p) => !p.done); }

  /** 작품 앞으로 걸어가고(가까우면 바로) 도착하면 재생 */
  /** §2-23 C: 걷지 않고 흰빛 전환으로 그 작품 앞에 선다(업로드 결과·한눈에 보기 공통). 밖에 있으면 들어간 뒤 같은 일을 한다 */
  jumpTo(id: string) {
    if (this.space !== 'inside') { if (this.space === 'town') this.showPlaza(); this.afterJump = id; this.enterMuseum(); return; }
    const w = this.museum.works.get(id);
    if (!w) return;
    this.finishPerformances(); this.route = []; this.pendingPlay = null; this.faceAfterRoute = false;
    this.flash(JUMP.flash);
    this.avatarRoot.position.set(w.stand.x, 0, w.stand.z);
    this.faceWork(id); this.cameraDistance = this.dist; this.snapCamera = true;
    w.group.getWorldPosition(this.focusPoint); this.revealFocus = JUMP.focus; // 캐릭터가 작품을 가리지 않게 초점을 작품 쪽으로
    this.nearTimer = 1; // 다음 프레임에 가까운 작품(명패)을 다시 잰다
  }
  private afterJump: string | null = null;

  goTo(id: string, thenPlay = false) {
    if(this.space!=='inside'){if(this.space==='town')this.showPlaza();this.afterEnter={id,thenPlay};this.enterMuseum();return;}
    const w = this.museum.works.get(id);
    if (!w) return;
    const here = this.avatarRoot.position.clone();
    if (here.distanceTo(w.stand) < 1.2) { if (thenPlay) this.play(id); return; }
    this.route = this.museum.route(here, w.stand);
    this.pendingPlay = thenPlay ? id : null;
    this.faceAfterRoute = false;
  }

  goLobby() { if(this.space!=='inside'){if(this.space==='town')this.showPlaza();this.enterMuseum();return;}this.route = this.museum.route(this.avatarRoot.position.clone(), new THREE.Vector3(0, 0, 6.5)); }

  setJoystick(x: number, y: number) { this.joy.set(x, y); if ((x || y) && !this.entering) this.route = []; }

  private look = { invert: false, speed: 1 };
  /** 화면 끌기 방향과 빠르기(설정, 마스터플랜 3-3 #137) */
  setLook(invert: boolean, speed: number) { this.look = { invert, speed }; }
  setCustomizing(on: boolean) { this.customizing = on; }
  /** 대성당과 블록의 건물 안은 내려다볼 수 없어 지금 거리까지만 줄인다(마스터플랜 3-3 #137) */
  private get zoomFar(): number { const t = this.theme.current; return this.space === 'inside' && (t === 'classic' || t === 'block') ? ZOOM.lift : ZOOM.far; }
  /** 움직여 보기 창이 도는 동안 뒤쪽 장면을 멈춘다. 휴대폰에서 3D 두 개를 함께 그리지 않기 위해서다 */
  setRenderHeld(on: boolean) { this.renderHeld = on; }
  /** 결과 카드가 떠 있는 동안 캐릭터가 작품을 가리지 않게 한다(마스터플랜 3-3 #137) */
  setAvatarHidden(on: boolean) { this.avatarHidden = on; }
  setInputPaused(on:boolean){this.inputPaused=on;this.onBlur();if(on){this.route=[];this.pendingPlay=null;}}

  // ───────── 한 프레임 ─────────
  private frame(dt: number) {
    this.t += dt;
    this.outdoor.update(this.t);for(const r of this.residentRigs)animateAvatar(r,this.t,0);
    if(this.run)this.stepStart(dt);
    else if(this.flashT>0){this.flashT=Math.max(0,this.flashT-dt);this.setWipe(this.flashDur?this.flashT/this.flashDur:0);}
    if(this.mode==='title'&&!this.reduced)this.titleClock+=dt;
    // 들어가기: 문턱 1.6m 앞부터 흰빛이 덮이고, 문턱에서 안으로 바꾼다
    if(this.space==='plaza'&&!this.entering&&this.outdoor.inDoorway(this.avatarRoot.position.x,this.avatarRoot.position.z))this.enterMuseum();
    if(this.entering){this.enteringTime+=dt;this.outdoor.openDoors(Math.min(1,this.enteringTime));const z=this.avatarRoot.position.z;this.setWipe(clamp01((13.6-z)/1.6));if(z<=12)this.finishEnter();}
    const rw=this.revealWatch;if(rw&&((rw.at!==null&&this.t>=rw.at)||this.t>=rw.deadline)){this.revealWatch=null;this.ev.onRevealed?.(rw.id);}
    this.moveAvatar(dt);
    if(this.space==='inside')this.museum.update(dt);
    for (const p of this.performances) p.update(dt, this.camera, this.particles);
    this.performances = this.performances.filter((p) => !p.done);
    this.particles.update(dt);
    this.updateCamera(dt);
    this.nearTimer += dt;
    if (this.nearTimer > 0.2 && !this.cinematic) { this.nearTimer = 0; this.checkNear(); }
    const post = this.postReady();
    if (post) post.render(); else this.renderer.render(this.scene, this.camera);
  }

  private moveAvatar(dt: number) {
    this.sprinting = false;
    const pos = this.avatarRoot.position;
    let dir = new THREE.Vector3();
    if (!this.customizing && !this.inputPaused) {
      const f = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
      const r = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
      const k = this.keys;
      // 연출 중에는 정해진 길만 걷는다(§2-17)
      const fwd = this.cinematic || this.entering ? 0 : (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0) + -this.joy.y;
      const side = this.cinematic || this.entering ? 0 : (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0) + this.joy.x;
      if (fwd || side) { dir.addScaledVector(f, fwd).addScaledVector(r, side); this.route = []; this.faceAfterRoute = false; this.revealFocus = 0; }
      else if (this.route.length) {
        const target = this.route[0]!;
        const d = new THREE.Vector3(target.x - pos.x, 0, target.z - pos.z);
        if (d.length() < 0.25) {
          this.route.shift();
          if (!this.route.length && this.pendingPlay) { const id = this.pendingPlay; this.pendingPlay = null; this.faceWork(id); this.play(id); }
          if (!this.route.length && this.faceAfterRoute) { this.faceAfterRoute = false; this.faceFeatured(); }
        } else dir = d;
      }
    }
    const len = dir.length();
    if (len > 0.001) {
      dir.multiplyScalar(1 / Math.max(1, len));
      const speed=this.keys.has('ShiftLeft')||this.keys.has('ShiftRight')?SPEED*1.7:SPEED;
      const step = speed * dt * Math.min(1, len);
      // 한 번에 0.2m 넘게 옮기지 않는다(느린 프레임에서도 벽 판정이 촘촘하게)
      const n = Math.max(1, Math.ceil(step / 0.2));
      let moved = false;
      for (let i = 0; i < n; i++) moved = this.tryMove((dir.x * step) / n, (dir.z * step) / n) || moved;
      if (moved && speed > SPEED) this.sprinting = true;
      if (!moved) { this.stuck += dt; if (this.stuck > 0.7) { this.route = []; this.stuck = 0; } } else this.stuck = 0;
      const targetYaw = Math.atan2(dir.x, dir.z);
      let dy = targetYaw - this.avatarRoot.rotation.y;
      dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      this.avatarRoot.rotation.y += dy * Math.min(1, dt * 10);
      this.walkSpeed = THREE.MathUtils.lerp(this.walkSpeed, moved ? speed : 0, Math.min(1, dt * 8));
    } else this.walkSpeed = THREE.MathUtils.lerp(this.walkSpeed, 0, Math.min(1, dt * 8));
    const ground=this.space==='plaza'&&Math.abs(pos.x)<3?THREE.MathUtils.clamp((15-pos.z)/3,0,1)*.8:0;
    if(this.verticalSpeed||pos.y>ground+.02){this.verticalSpeed-=9.8*dt;pos.y=Math.max(ground,pos.y+this.verticalSpeed*dt);if(pos.y===ground)this.verticalSpeed=0;}else pos.y=ground;
    if (this.rig) animateAvatar(this.rig, this.t, this.walkSpeed,this.t<this.actionUntil?this.action:undefined,this.t-this.actionStart);
    const place = this.placeLabel();
    if (place !== this.lastPlace) { this.lastPlace = place; this.ev.onPlace(place); }
  }

  private faceWork(id: string) {
    const w = this.museum.works.get(id);
    if (!w) return;
    const p = w.group.getWorldPosition(new THREE.Vector3());
    this.avatarRoot.rotation.y = Math.atan2(p.x - this.avatarRoot.position.x, p.z - this.avatarRoot.position.z);
    this.yaw = this.avatarRoot.rotation.y + Math.PI;
    this.dist=Math.max(2.4,Math.min(7.5,distanceToFitArtwork(1.82,1.47,this.camera.aspect,this.camera.getEffectiveFOV())*1.2));
  }

  private tryMove(dx: number, dz: number): boolean {
    const p = this.avatarRoot.position;
    const m = this.museum;
    if(this.space==='inside'){const x=p.x,z=p.z;m.move(p,dx,dz);return Math.hypot(p.x-x,p.z-z)>.00001;}
    const tries: Array<[number, number]> = [[dx, dz]];
    for (const a of [0.5, -0.5, 1.0, -1.0, 1.57, -1.57]) {
      const c = Math.cos(a), s = Math.sin(a);
      tries.push([dx * c - dz * s, dx * s + dz * c]);
    }
    tries.push([dx, 0], [0, dz]);
    for (const [x, z] of tries) {
      if (this.outdoor.canStand(p.x+x,p.z+z)) { p.x += x; p.z += z; return true; }
    }
    return false;
  }

  private placeLabel(): string {
    if(this.space!=='inside')return this.space==='plaza'?'바깥 광장':'미술관 마을';
    const p = this.avatarRoot.position;
    const r = this.museum.regionOf(p.x, p.z);
    if (r.kind === 'rotunda') return '로비';
    if (r.kind === 'corridor') return '회랑';
    return this.museum.rooms[r.index]?.title ?? '전시실';
  }

  private updateCamera(dt: number) {
    if (this.mode === 'title') { const s = this.titleCamera(); this.camera.position.set(s.pos.x, s.pos.y, s.pos.z); this.camera.lookAt(s.look.x, s.look.y, s.look.z); return; }
    // 시작 연출 바깥 구간: 시작 화면 구도에서 캐릭터 뒤 구도로 섞어 들어간다
    if (this.run && !this.run.swapped) {
      const r = this.run, f = this.followShot(r.t), k = ease(r.t / START.approach), p = mix(r.from.pos, f.pos, k), l = mix(r.from.look, f.look, k);
      this.camera.position.set(p.x, p.y, p.z); this.camera.lookAt(l.x, l.y, l.z); return;
    }
    if (!this.inputPaused && !this.cinematic) {
      this.yaw += (Number(this.keys.has('KeyJ')) - Number(this.keys.has('KeyL'))) * 1.5 * dt;
      this.pitch = THREE.MathUtils.clamp(this.pitch + (Number(this.keys.has('KeyI')) - Number(this.keys.has('KeyK'))) * dt, .05, .9);
      const closer = this.keys.has('Equal') || this.keys.has('NumpadAdd');
      const farther = this.keys.has('Minus') || this.keys.has('NumpadSubtract');
      if (closer || farther) this.dist = THREE.MathUtils.clamp(this.dist + (Number(farther) - Number(closer)) * 4 * dt, ZOOM.near, this.zoomFar);
    }
    this.dist = Math.min(this.dist, this.zoomFar); // 모드를 바꿔도 줄인 거리가 남지 않게 한다
    let target = this.avatarRoot.position.clone().add(new THREE.Vector3(0, 1.25, 0));
    let yaw = this.yaw, pitch = this.pitch, dist = this.dist;
    if (this.camera.aspect < PORTRAIT.aspect) dist *= PORTRAIT.distance; // §2-23 D: 세로 화면은 멀리서 작품과 캐릭터를 함께 담는다
    if (this.customizing) { yaw = this.avatarRoot.rotation.y+this.customYaw; pitch = 0.12; dist = 2.6; target.y = this.avatarRoot.position.y + 0.85; }
    // 작품이 움직이는 동안: 캐릭터 뒤에서 그 작품을 바라본다
    const watch = this.customizing ? undefined : [...this.performances].reverse().find((p) => !p.done);
    if (watch) {
      const a = watch.actor.position;
      const from = new THREE.Vector3(this.avatarRoot.position.x - a.x, 0, this.avatarRoot.position.z - a.z);
      if (from.lengthSq() > 0.01) this.yaw = yaw = Math.atan2(from.x, from.z);
      pitch = 0.35;
      dist = Math.max(dist, 5.2);
      target = target.lerp(a.clone(), 0.55);
    }
    // 많이 줄이면 위로 올라가 벽 너머로 전시실을 내려다본다(마스터플랜 3-3 #137)
    const lift = this.customizing || watch ? 0 : zoomLift(this.dist);
    pitch += (1.15 - pitch) * lift;
    if (this.revealFocus > 0) {
      this.revealFocus = this.space === 'inside' && !watch ? Math.max(0, this.revealFocus - dt) : 0;
      // 마지막 1초 동안 당김을 풀어 시선이 한 번에 돌아가지 않게 한다
      if (this.revealFocus > 0) target = target.lerp(this.focusPoint, MuseumEngine.FOCUS_PULL * Math.min(1, this.revealFocus));
    }
    const off = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)).multiplyScalar(dist);
    let want = target.clone().add(off);
    const direction=off.clone().normalize();
    // 많이 줄이면 천장을 숨기고 벽과 들보에 걸리지 않게 전시실을 내려다본다
    const ceiling=this.theme.mats.ceiling,open=this.space==='inside'&&lift>.02;
    if(ceiling.visible===open)ceiling.visible=!open;
    const allowed=open?dist:occlusionDistance(target,direction,dist,this.space==='inside'?this.museum.cameraSolids:this.outdoor.cameraSolids,this.camera.aspect,this.camera.near,this.camera.getEffectiveFOV());
    this.cameraDistance=recoverDistance(this.cameraDistance,allowed,dt);
    want=target.clone().addScaledVector(direction,this.cameraDistance);
    if(this.space==='inside')want.y=Math.min(want.y,6.6+lift*34);
    const smoothing=1-Math.exp(-8*dt);
    // 장면을 바꾼 직후에는 바깥 카메라 위치에서 끌려오지 않게 바로 놓는다
    if(this.snapCamera){this.snapCamera=false;this.camera.position.copy(want);}
    else if(allowed<dist-.01)this.camera.position.copy(want);else this.camera.position.lerp(want,smoothing);
    this.camera.lookAt(target);
    this.avatarRoot.visible=!this.avatarHidden&&(this.customizing||this.camera.position.distanceTo(this.avatarRoot.position.clone().add(new THREE.Vector3(0,1.1,0)))>1.6);
    // 달리기 감각(§2-11): 뛰는 동안만 시야각을 6도 넓힌다. 움직임 줄이기에서는 쓰지 않는다
    const kick = this.reduced ? 0 : this.sprinting ? 6 : 0;
    this.fovKick += (kick - this.fovKick) * (1 - Math.exp(-6 * dt));
    if (Math.abs(this.camera.fov - (this.baseFov + this.fovKick)) > 0.01) { this.camera.fov = this.baseFov + this.fovKick; this.camera.updateProjectionMatrix(); }
  }

  private checkNear() {
    const p=this.avatarRoot.position;let next:InteractionPrompt|null=null;
    if(this.space==='inside'){
      let best:string|null=null,bd=3.2;
      for(const w of this.museum.works.values()){
        const d=Math.hypot(w.stand.x-p.x,w.stand.z-p.z);if(d>=bd)continue;
        const eye=p.clone().add(new THREE.Vector3(0,1.2,0)),point=w.group.getWorldPosition(new THREE.Vector3());point.y=Math.max(1.2,point.y);
        const delta=point.clone().sub(eye);this.ray.set(eye,delta.clone().normalize());this.ray.far=Math.max(0,delta.length()-.15);
        if(this.ray.intersectObjects(this.museum.walls,false).length)continue;
        bd=d;best=w.id;
      }
      if(best!==this.lastNear){this.lastNear=best;this.ev.onNear(best);}
      if(best)next={kind:'work',id:best,label:'작품 가까이 보기'};
    }else{
      let best=3.5;
      for(const [id,stand] of this.outdoor.positions){const d=Math.hypot(stand.x-p.x,stand.z-3-p.z);if(d<best){best=d;next={kind:'building',id,label:'미술관 들어가기'};}}
    }
    if(JSON.stringify(next)!==JSON.stringify(this.prompt)){this.prompt=next;this.ev.onPrompt?.(next);}
  }
  interact(){
    if(this.inputPaused)return;this.checkNear();const p=this.prompt;if(!p)return;
    if(p.kind==='work'){this.faceWork(p.id);this.ev.onSelect({type:'work',id:p.id});this.ev.onView?.(p.id);}
    else if(this.space==='plaza')this.enterMuseum();else this.ev.onInteractBuilding?.(p.id);
  }

  // ───────── 입력 ─────────
  private onKeyDown = (e: KeyboardEvent) => {
    // 시작 연출 중 아무 키나 누르면 건너뛴다. 시작 화면의 키는 화면 버튼이 받는다(§2-17)
    if(this.mode==='start'){this.skipIntro();return;}
    if(this.inputPaused||this.mode==='title')return;
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
    // 누른 화면 버튼에 포커스가 남아도 걷는다. 스페이스와 창 안의 버튼은 버튼 몫이다(설계서 2-1 문 드나들기)
    if (t?.tagName === 'BUTTON' && (e.code === 'Space' || t.closest('[role="dialog"]'))) return;
    if(e.code==='Space'){e.preventDefault();this.gesture('jump');return;}
    if(e.code==='KeyE'){e.preventDefault();this.interact();return;}
    if(e.code==='KeyH'){this.gesture('wave');return;}
    if(e.code==='KeyQ'){this.gesture('dance');return;}
    if(e.code==='KeyR'){e.preventDefault();this.resetView();return;}
    if(['KeyI','KeyJ','KeyK','KeyL','Equal','Minus','NumpadAdd','NumpadSubtract'].includes(e.code)){
      e.preventDefault();this.keys.add(e.code);return;
    }
    if(e.code==='ShiftLeft'||e.code==='ShiftRight'){this.keys.add(e.code);return;}
    if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
      this.keys.add(e.code);
      e.preventDefault();
    }
  };
  private onKeyUp = (e: KeyboardEvent) => { this.keys.delete(e.code); };
  private onBlur = () => { this.keys.clear();this.joy.set(0,0);this.pointers.clear();this.down=null;this.pinch=null; };

  private onPointerDown = (e: PointerEvent) => {
    if(this.mode==='start'){this.skipIntro();return;}
    if(this.inputPaused||this.cinematic)return;
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      this.pinch = { d: Math.hypot(a!.x - b!.x, a!.y - b!.y), dist: this.dist };
      this.down = null;
      return;
    }
    this.down = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId };
    this.dragged = false;
    this.renderer.domElement.setPointerCapture?.(e.pointerId);
  };

  private onPointerMove = (e: PointerEvent) => {
    if(this.inputPaused)return;
    const prev = this.pointers.get(e.pointerId);
    if (!prev) return;
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.pinch && this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      const d = Math.hypot(a!.x - b!.x, a!.y - b!.y);
      this.dist = THREE.MathUtils.clamp(this.pinch.dist * (this.pinch.d / Math.max(1, d)), ZOOM.near, this.zoomFar);
      return;
    }
    if (!this.down) return;
    const dx = e.clientX - prev.x, dy = e.clientY - prev.y;
    if (Math.hypot(e.clientX - this.down.x, e.clientY - this.down.y) > 6) this.dragged = true;
    if (this.dragged) {
      this.revealFocus = 0;
      if(this.customizing){this.customYaw-=dx*.006;return;}
      const turn = dragTurn(dx, dy, this.look);
      this.yaw += turn.yaw;
      this.pitch = THREE.MathUtils.clamp(this.pitch + turn.pitch, 0.05, 0.9);
    }
  };

  private onPointerUp = (e: PointerEvent) => {
    if(this.inputPaused)return;
    this.pointers.delete(e.pointerId);
    if (this.pointers.size < 2) this.pinch = null;
    const d = this.down;
    this.down = null;
    if (!d || d.id !== e.pointerId || this.dragged || this.customizing) return;
    this.click(e.clientX, e.clientY);
  };

  private onWheel = (e: WheelEvent) => {
    e.preventDefault();
    if(this.inputPaused||this.cinematic)return;
    this.dist = THREE.MathUtils.clamp(this.dist * (1 + Math.sign(e.deltaY) * 0.1), ZOOM.near, this.zoomFar);
  };

  private click(cx: number, cy: number) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((cx - rect.left) / rect.width) * 2 - 1, -((cy - rect.top) / rect.height) * 2 + 1);
    this.ray.setFromCamera(ndc, this.camera);
    this.ray.far = 60;
    if(this.space!=='inside'){
      const hit=this.ray.intersectObjects([...this.outdoor.pickables,this.outdoor.floor],false)[0];if(!hit)return;
      const id=hit.object.userData.buildingId as string|undefined;if(id){const p=this.outdoor.positions.get(id);if(p)this.route=[p.clone()];this.ev.onBuilding?.(id);}else {const p=hit.point.clone();p.y=0;this.route=[p];}return;
    }
    const hits = this.ray.intersectObjects([...this.museum.pickables, ...this.museum.floors, ...this.museum.walls], false);
    const first = hits[0];
    if (!first) return;
    const o = first.object;
    if (o.userData.action === 'firstWork' && !this.visiting) { this.ev.onAction('firstWork'); return; } // 빈 대표작 자리는 사진 고르기(§2-17)
    if (o.userData.featured) { this.ev.onSelect({ type: 'work', id: o.userData.workId as string }); return; } // 로비 대표작은 명패만 연다
    if (o.userData.workId) {
      const id = o.userData.workId as string;
      this.ev.onSelect({ type: 'work', id });
      const w = this.museum.works.get(id);
      if (w && w.stand.distanceTo(this.avatarRoot.position) > 6) this.goTo(id);
      return;
    }
    if (o.userData.masterpiece !== undefined) { this.ev.onSelect({ type: 'masterpiece', index: o.userData.masterpiece as number }); return; }
    if (o.userData.action === 'addRoom' && !this.visiting) { this.ev.onAction('addRoom'); return; }
    if (o.userData.floor) {
      const p = first.point.clone();
      p.y = 0;
      this.route = this.museum.route(this.avatarRoot.position.clone(), p);
      this.pendingPlay = null;
      this.faceAfterRoute = false;
      this.ev.onSelect(null);
    }
  }

  private bindInput() {
    const el = this.renderer.domElement;
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    el.addEventListener('pointerdown', this.onPointerDown);
    el.addEventListener('pointermove', this.onPointerMove);
    el.addEventListener('pointerup', this.onPointerUp);
    el.addEventListener('pointercancel', this.onBlur);
    el.addEventListener('wheel', this.onWheel, { passive: false });
  }

  private unbind() {
    const el = this.renderer.domElement;
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    el.removeEventListener('pointerdown', this.onPointerDown);
    el.removeEventListener('pointermove', this.onPointerMove);
    el.removeEventListener('pointerup', this.onPointerUp);
    el.removeEventListener('pointercancel', this.onBlur);
    el.removeEventListener('wheel', this.onWheel);
  }

  /** 시험용: 지금 상태 요약(E2E 확인에 쓴다) */
  debugState() {
    const p = this.avatarRoot.position;
    return { space:this.space,mode:this.mode,wipe:this.wipeLevel,waiting:!!this.run?.waiting,entering:this.entering,triangles:this.renderer.info.render.triangles,programs:this.renderer.info.programs?.length,style:this.rig?.style, x: p.x, z: p.z, place: this.lastPlace, rooms: this.museum.rooms.map((r) => r.title), works: this.museum.works.size, featured: (this.featuredWork()?.id??null), playing: this.performances.length, theme: this.theme.current, maxAge: MAX_AGE };
  }

  /** 시험용: 작품 하나(원본 사진 액자)의 화면 사각형(§2-17·§2-23 결과 카드 겹침 확인). 로비에는 작품을 걸지 않는다 */
  debugWorkRect(id: string): { left: number; top: number; right: number; bottom: number } | null {
    const w = this.museum.works.get(id);
    const target = w?.group.getObjectByName('original-print') ?? w?.group;
    if (!target) return null;
    const box = new THREE.Box3().setFromObject(target);
    if (box.isEmpty()) return null;
    const rect = this.renderer.domElement.getBoundingClientRect();
    let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
    for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
      const p = new THREE.Vector3(x, y, z).project(this.camera), sx = rect.left + ((p.x + 1) / 2) * rect.width, sy = rect.top + ((1 - p.y) / 2) * rect.height;
      left = Math.min(left, sx); right = Math.max(right, sx); top = Math.min(top, sy); bottom = Math.max(bottom, sy);
    }
    return { left, top, right, bottom };
  }

  /** 시험용: 작품 하나의 윤곽·행동·재생 여부(§2-22 끝나는 조건: 직접 올린 작품의 윤곽이 비어 있지 않고 주제대로 움직인다) */
  debugWork(id: string) {
    const l = this.loaded.get(id), a = this.artworks.get(id), w = this.museum.works.get(id);
    return { loaded: !!l, masked: !!l?.mask, maskRatio: l?.mask?.ratio ?? 0, behavior: a ? subjectOf(a.subject).behavior : null, playing: !!w && this.performances.some((p) => !p.done && p.actor.geometry === w.relief.geometry) };
  }

  /** 시험용: 캐릭터를 곧바로 옮긴다 */
  debugTeleport(x: number, z: number) { this.avatarRoot.position.set(x, 0, z); this.route = []; }

  /** 시험용: 작품 하나의 화면 좌표 */
  debugScreenOf(id: string): { x: number; y: number } | null {
    const w = this.museum.works.get(id);
    if (!w) return null;
    const p = w.relief.getWorldPosition(new THREE.Vector3()).project(this.camera);
    const rect = this.renderer.domElement.getBoundingClientRect();
    return { x: rect.left + ((p.x + 1) / 2) * rect.width, y: rect.top + ((1 - p.y) / 2) * rect.height };
  }
}
