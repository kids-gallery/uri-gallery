// 작품을 누르면(3D미술관_재설계 §2-5): 입체가 액자에서 나와 주제별 행동을 하고 제자리로 돌아온다.
// 행동은 subjects.ts의 표가 정한다. 여기에는 행동별 움직임(경로 · 튐 · 기울기)과 입자 효과만 있다.
import * as THREE from 'three';
import type { Behavior } from './subjects';

export const DURATION = 7; // 초
const POP = 0.6;
const BACK = 1.0;

export interface Stage { cx: number; cz: number; halfX: number; halfZ: number; ceiling: number }

interface Pose { pos: THREE.Vector3; yaw: number; roll: number; sx: number; sy: number }

type Emit = 'smoke' | 'flame' | 'bubble' | 'sparkle' | 'confetti' | 'dust' | null;

const smooth = (x: number) => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t); };
const backOut = (x: number) => { const t = Math.min(1, Math.max(0, x)); const c = 1.7; return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2; };

/** 행동별 자세. u = 행동 시작 뒤 지난 초, start = 액자 밖으로 나온 자리, h = 작품 높이 */
function behaviorPose(b: Behavior, u: number, start: THREE.Vector3, st: Stage, h: number, subject: string): { pose: Omit<Pose, 'yaw'>; emit: Emit } {
  const floorY = h / 2 + 0.02;
  const a0 = Math.atan2(start.z - st.cz, start.x - st.cx);
  const r = Math.max(1.6, Math.min(st.halfX, st.halfZ) - 1.4);
  switch (b) {
    case 'run': {
      const a = a0 + u * 1.5;
      const hop = Math.abs(Math.sin(u * 9)) * 0.38;
      return {
        pose: { pos: new THREE.Vector3(st.cx + r * Math.cos(a), floorY + hop, st.cz + r * Math.sin(a)), roll: Math.sin(u * 18) * 0.12, sx: 1, sy: 1 - 0.1 * (1 - Math.abs(Math.sin(u * 9))) },
        emit: hop < 0.05 ? 'dust' : null,
      };
    }
    case 'fly': {
      const isBalloon = subject === 'balloon';
      const rise = smooth(u / 1.6);
      const y = 1.6 + rise * (Math.min(st.ceiling - h / 2 - 0.4, 4.4) - 1.6) + Math.sin(u * 2.2) * 0.25;
      const a = a0 + u * (isBalloon ? 0.45 : 1.15);
      const rr = isBalloon ? r * 0.5 : r;
      const flap = subject === 'bird' || subject === 'butterfly' ? 0.55 + 0.45 * Math.abs(Math.cos(u * 14)) : 1;
      return {
        pose: { pos: new THREE.Vector3(st.cx + rr * Math.cos(a), y, st.cz + rr * Math.sin(a)), roll: isBalloon ? Math.sin(u * 1.5) * 0.15 : Math.sin(u * 1.6) * 0.3, sx: flap, sy: 1 },
        emit: subject === 'rocket' ? (Math.floor(u * 30) % 2 ? 'flame' : 'smoke') : subject === 'plane' ? 'smoke' : null,
      };
    }
    case 'drive': {
      const x = st.cx + Math.sin(u * 1.1) * (st.halfX - 1.2);
      return {
        pose: { pos: new THREE.Vector3(x, floorY + Math.abs(Math.sin(u * 14)) * 0.04, st.cz + 1.2), roll: Math.cos(u * 1.1) * -0.08, sx: 1, sy: 1 },
        emit: 'dust',
      };
    }
    case 'swim': {
      return {
        pose: { pos: new THREE.Vector3(st.cx + Math.sin(u * 0.85) * r, 2.1 + Math.sin(u * 1.7) * 0.5, st.cz + Math.sin(u * 1.7) * r * 0.6), roll: Math.sin(u * 3) * 0.28, sx: 1, sy: 1 + Math.sin(u * 6) * 0.04 },
        emit: 'bubble',
      };
    }
    case 'grow': {
      const s = 1 + 0.55 * Math.sin(Math.min(1, u / 4.6) * Math.PI) + 0.06 * Math.sin(u * 7);
      return {
        pose: { pos: new THREE.Vector3(start.x, Math.max(start.y, floorY + 0.2) + 0.25 * Math.sin(Math.min(1, u / 4.6) * Math.PI), start.z), roll: Math.sin(u * 2.5) * 0.12, sx: s, sy: s },
        emit: 'sparkle',
      };
    }
    case 'dance': {
      const hop = Math.abs(Math.sin(u * 6)) * 0.42;
      return {
        pose: { pos: new THREE.Vector3(start.x, floorY + hop, start.z), roll: Math.sin(u * 6) * 0.28, sx: 1 + 0.06 * Math.sin(u * 12), sy: 1 - 0.06 * Math.sin(u * 12) },
        emit: Math.floor(u * 4) % 3 === 0 ? 'confetti' : null,
      };
    }
    case 'spin':
    default: {
      return {
        pose: { pos: new THREE.Vector3(start.x, start.y + 0.3 * Math.sin(Math.min(1, u / 4.6) * Math.PI), start.z), roll: 0, sx: Math.cos(u * 2.6), sy: 1 },
        emit: u > 4.0 && u < 4.4 ? 'sparkle' : null,
      };
    }
  }
}

// ───────────── 입자 ─────────────

interface Particle { s: THREE.Sprite; v: THREE.Vector3; life: number; max: number; grow: number; spin: number }

function dotTexture(kind: 'soft' | 'star') {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  if (kind === 'soft') {
    const r = g.createRadialGradient(32, 32, 2, 32, 32, 30);
    r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  } else {
    g.fillStyle = '#fff';
    g.beginPath();
    for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2 - Math.PI / 2; const rr = i % 2 ? 11 : 28; g.lineTo(32 + Math.cos(a) * rr, 32 + Math.sin(a) * rr); }
    g.closePath(); g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class Particles {
  readonly group = new THREE.Group();
  private pool: Particle[] = [];
  private soft = dotTexture('soft');
  private star = dotTexture('star');

  emit(kind: NonNullable<Emit>, at: THREE.Vector3, h: number) {
    const n = kind === 'confetti' ? 3 : kind === 'sparkle' ? 2 : 1;
    for (let i = 0; i < n; i++) {
      if (this.pool.length > 160) return;
      const color = {
        smoke: '#e9e4dc', flame: ['#ffb703', '#fb8500', '#ffd166'][i % 3]!, bubble: '#bde4ff', sparkle: '#ffe066',
        confetti: ['#e63946', '#3a86ff', '#ffd23f', '#3fb950', '#ff8fb1'][Math.floor(Math.random() * 5)]!, dust: '#d9c9b0',
      }[kind];
      const mat = new THREE.SpriteMaterial({ map: kind === 'sparkle' || kind === 'confetti' ? this.star : this.soft, color, transparent: true, depthWrite: false, blending: kind === 'flame' || kind === 'sparkle' ? THREE.AdditiveBlending : THREE.NormalBlending });
      const s = new THREE.Sprite(mat);
      const p = at.clone();
      const v = new THREE.Vector3();
      let size = 0.18, max = 1.2, grow = 0.5;
      if (kind === 'smoke' || kind === 'flame') { p.y -= h * 0.5; v.set((Math.random() - 0.5) * 0.4, -0.9 - Math.random() * 0.5, (Math.random() - 0.5) * 0.4); size = kind === 'flame' ? 0.22 : 0.3; max = kind === 'flame' ? 0.35 : 1.4; grow = kind === 'flame' ? -0.3 : 0.9; }
      else if (kind === 'bubble') { p.add(new THREE.Vector3((Math.random() - 0.5) * 0.6, 0, (Math.random() - 0.5) * 0.6)); v.set(0, 0.6 + Math.random() * 0.4, 0); size = 0.08 + Math.random() * 0.08; max = 1.6; grow = 0.1; }
      else if (kind === 'sparkle') { p.add(new THREE.Vector3((Math.random() - 0.5) * h * 1.6, (Math.random() - 0.5) * h * 1.4, (Math.random() - 0.5) * 0.5)); v.set(0, 0.3, 0); size = 0.16 + Math.random() * 0.12; max = 0.9; grow = -0.1; }
      else if (kind === 'confetti') { p.y += h * 0.4; v.set((Math.random() - 0.5) * 2.4, 1.5 + Math.random(), (Math.random() - 0.5) * 2.4); size = 0.1; max = 1.6; grow = 0; }
      else { p.y -= h * 0.5 - 0.05; v.set((Math.random() - 0.5) * 0.5, 0.15, (Math.random() - 0.5) * 0.5); size = 0.22; max = 0.7; grow = 0.6; }
      s.position.copy(p);
      s.scale.setScalar(size);
      this.group.add(s);
      this.pool.push({ s, v, life: 0, max, grow, spin: (Math.random() - 0.5) * 6 });
    }
  }

  clear() { for(const p of this.pool){this.group.remove(p.s);p.s.material.dispose();}this.pool=[]; }

  update(dt: number) {
    for (let i = this.pool.length - 1; i >= 0; i--) {
      const p = this.pool[i]!;
      p.life += dt;
      if (p.life >= p.max) { this.group.remove(p.s); p.s.material.dispose(); this.pool.splice(i, 1); continue; }
      p.s.position.addScaledVector(p.v, dt);
      if (p.grow) p.s.scale.multiplyScalar(1 + p.grow * dt);
      if (p.v.y > 1) p.v.y -= 3 * dt; // 색종이는 떨어진다
      p.s.material.rotation += p.spin * dt;
      p.s.material.opacity = 1 - p.life / p.max;
    }
  }
}

// ───────────── 재생 ─────────────

export class Performance {
  t = 0;
  done = false;
  private start = new THREE.Vector3();
  private homePos = new THREE.Vector3();
  private homeQuat = new THREE.Quaternion();
  private homeScale = new THREE.Vector3();
  private last: Pose | null = null;
  private emitClock = 0;
  private sourceWasVisible = true;
  readonly actor: THREE.Mesh;

  constructor(private source: THREE.Mesh, normal: THREE.Vector3, private behavior: Behavior, private subject: string, private stage: Stage, private parent: THREE.Object3D) {
    source.updateWorldMatrix(true, false);
    source.getWorldPosition(this.homePos);
    source.getWorldQuaternion(this.homeQuat);
    source.getWorldScale(this.homeScale);
    this.actor = new THREE.Mesh(source.geometry, source.material);
    this.actor.position.copy(this.homePos);
    this.actor.quaternion.copy(this.homeQuat);
    this.actor.scale.copy(this.homeScale);
    this.start.copy(this.homePos).addScaledVector(normal, 1.3);
    this.start.y = Math.max(this.start.y, (source.userData.size as { h: number }).h / 2 + 0.05);
    // 벽 작품의 입체는 평소 숨어 있고 원본 액자가 보인다(§2-14). 끝나면 원래 보임 상태로 돌린다
    this.sourceWasVisible = source.visible;
    source.visible = false;
    this.actor.visible = true;
    parent.add(this.actor);
  }

  get height() { return (this.source.userData.size as { h: number }).h; }

  update(dt: number, camera: THREE.Camera, particles: Particles) {
    if (this.done) return;
    this.t += dt;
    const t = this.t;
    const h = this.height;
    const faceCam = (p: THREE.Vector3) => Math.atan2(camera.position.x - p.x, camera.position.z - p.z);
    let pose: Pose;
    if (t < POP) {
      const k = backOut(t / POP);
      const pos = this.homePos.clone().lerp(this.start, k);
      pose = { pos, yaw: faceCam(pos), roll: 0, sx: 1 + 0.15 * k, sy: 1 + 0.15 * k };
    } else if (t < DURATION - BACK) {
      const u = t - POP;
      const { pose: b, emit } = behaviorPose(this.behavior, u, this.start, this.stage, h, this.subject);
      const k = smooth(u / 0.6);
      const pos = this.start.clone().lerp(b.pos, k);
      const yaw = faceCam(pos) + (this.behavior === 'dance' ? Math.sin(u * 3) * 0.5 : 0);
      pose = { pos, yaw, roll: b.roll * k, sx: 1.15 + (b.sx - 1) * k, sy: 1.15 + (b.sy - 1) * k };
      if (this.behavior === 'spin') pose.sx = 1.15 * b.sx;
      if (this.behavior === 'fly' && (this.subject === 'bird' || this.subject === 'butterfly')) pose.sx = 1.15 * b.sx;
      if (this.behavior === 'grow') { pose.sx = 1.15 * b.sx; pose.sy = 1.15 * b.sy; }
      this.emitClock += dt;
      if (emit && this.emitClock > 0.05) { this.emitClock = 0; particles.emit(emit, pos, h); }
      this.last = pose;
    } else {
      const k = smooth((t - (DURATION - BACK)) / BACK);
      const from = this.last ?? { pos: this.start, yaw: 0, roll: 0, sx: 1, sy: 1 };
      const pos = from.pos.clone().lerp(this.homePos, k);
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, from.yaw, from.roll, 'YXZ'));
      q.slerp(this.homeQuat, k);
      this.actor.position.copy(pos);
      this.actor.quaternion.copy(q);
      this.actor.scale.set(this.homeScale.x * (from.sx + (1 - from.sx) * k), this.homeScale.y * (from.sy + (1 - from.sy) * k), this.homeScale.z);
      if (t >= DURATION) this.finish();
      return;
    }
    this.actor.position.copy(pose.pos);
    this.actor.quaternion.setFromEuler(new THREE.Euler(0, pose.yaw, pose.roll, 'YXZ'));
    this.actor.scale.set(this.homeScale.x * pose.sx, this.homeScale.y * pose.sy, this.homeScale.z);
  }

  finish() {
    if (this.done) return;
    this.done = true;
    this.parent.remove(this.actor);
    this.source.visible = this.sourceWasVisible;
  }
}
