// 움직여 보기 창의 무대(마스터플랜 3-3 #137). 전시실과 따로 작품만 세워 주제별 행동을 보인다.
// 입체의 모양과 재질은 전시실의 것을 그대로 쓰고 지우지 않는다. 움직임은 behaviors.ts의 Performance가 맡는다.
import * as THREE from 'three';
import { Particles, Performance, type Stage } from './behaviors';
import type { Behavior, SoundId } from './subjects';
import { play as playSound } from './sound';

export interface MotionSource { relief: THREE.Mesh; behavior: Behavior; subject: string; sound: SoundId }

export class MotionStage {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
  private home: THREE.Mesh;
  private particles = new Particles();
  private stage: Stage;
  private perf: Performance | null = null;
  private clock = new THREE.Clock();
  private raf = 0;
  private resize: ResizeObserver;

  constructor(private canvas: HTMLCanvasElement, private source: MotionSource, private onDone: () => void) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true }); // 만들지 못하면 부른 쪽이 전시실로 낮춘다
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.scene.add(new THREE.HemisphereLight('#ffffff', '#d9c7a8', 2.2));
    const sun = new THREE.DirectionalLight('#ffffff', 1.4);
    sun.position.set(2, 6, 5);
    this.scene.add(sun);
    const { relief } = source;
    const size = relief.userData.size as { w?: number; h: number };
    const span = Math.max(size.h, size.w ?? size.h);
    this.stage = { cx: 0, cz: 0, halfX: span * 0.9, halfZ: span * 0.6, ceiling: span * 1.8 };
    this.home = new THREE.Mesh(relief.geometry, relief.material);
    this.home.userData = relief.userData;
    relief.getWorldScale(this.home.scale);
    this.home.position.set(0, size.h / 2 + 0.02, -span * 0.4);
    this.scene.add(this.home, this.particles.group);
    this.resize = new ResizeObserver(() => this.fit());
    this.resize.observe(canvas);
    this.fit();
    const loop = () => {
      this.raf = requestAnimationFrame(loop);
      const dt = Math.min(0.1, this.clock.getDelta());
      if (this.perf) {
        this.perf.update(dt, this.camera, this.particles);
        if (this.perf.done) { this.perf = null; this.onDone(); }
      }
      this.particles.update(dt);
      this.renderer.render(this.scene, this.camera);
    };
    this.raf = requestAnimationFrame(loop);
  }

  /** 창 크기에 맞춰 무대 전체(좌우 폭과 천장)가 들어오는 거리로 카메라를 둔다 */
  private fit() {
    const w = this.canvas.clientWidth || 1, h = this.canvas.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    const tan = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    const { halfX, ceiling } = this.stage;
    const dist = Math.max((ceiling * 1.1) / (2 * tan), (halfX * 2.2) / (2 * tan * this.camera.aspect));
    this.camera.position.set(0, ceiling * 0.55, dist);
    this.camera.lookAt(0, ceiling * 0.46, 0);
    this.camera.updateProjectionMatrix();
  }

  play() {
    if (this.perf) return;
    this.perf = new Performance(this.home, new THREE.Vector3(0, 0, 1), this.source.behavior, this.source.subject, this.stage, this.scene);
    playSound(this.source.sound);
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.resize.disconnect();
    this.perf?.finish();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }
}
