// Hardware-only local benchmark. See design/개인확장/3D미술관_재설계 §2-13.
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const out = path.resolve(process.argv[2] ?? '../_claude/검증/20261021-desktop/perf');
const fixed = process.argv.includes('--fixed');
const diagnose = process.argv.includes('--diagnose') || fixed;
const url = process.env.WORLD_URL ?? 'http://127.0.0.1:5173/app/world';
// §2-14 공개·가까이 보기 진입은 --rework일 때만 기존 7장면 뒤에 더한다(기존 장면의 순서와 조건은 그대로)
const rework = process.argv.includes('--rework');
const scenes = ['plaza', 'town31', 'gallery-lobby', 'gallery-hall', 'cathedral-lobby', 'cathedral-nave', 'walk', ...(rework ? ['reveal', 'view'] : [])];
const webDir = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
fs.mkdirSync(out, { recursive: true });
const result = { status: 'running', started: new Date().toISOString(), commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', cwd: webDir }).trim(), worktreeDirty: execFileSync('git', ['status', '--porcelain', '-uno'], { encoding: 'utf8', cwd: webDir }).trim().split('\n').filter(Boolean), url, viewport: { width: 1920, height: 1080 }, seconds: 10, diagnose, measurements: [], errors: [] };
result.sourceHashes = Object.fromEntries(['src/app/world/engine.ts', 'src/app/world/outdoor.ts', 'src/app/world/museum.ts', 'src/app/world/WorldView.vue', 'src/app/world/store.ts', 'scripts/world-perf-review.mjs'].map(file => [file, createHash('sha256').update(fs.readFileSync(path.join(webDir, file))).digest('hex')]));
const save = () => fs.writeFileSync(path.join(out, 'perf.json'), JSON.stringify(result, null, 2));
let browser;
try {
  browser = await chromium.launch({ channel: 'chrome' }); // No software-renderer flags or fallback.
  result.browser = browser.version();
  for (const dpr of diagnose ? [2] : [1, 2]) {
    const context = await browser.newContext({ viewport: result.viewport, deviceScaleFactor: dpr, reducedMotion: 'no-preference' });
    const page = await context.newPage();
    page.on('pageerror', e => result.errors.push(e.message));
    await page.goto(url);
    await page.waitForFunction(() => window.__uamWorld?.renderer.info.render.frame > 0, null, { timeout: 90000 });
    const first = await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => {
      const e = window.__uamWorld, gl = e.renderer.getContext(), ext = gl.getExtension('WEBGL_debug_renderer_info');
      // GPU 타이머는 지원 여부만 기록한다. 아래 프레임 수치는 rAF 간격(화면 갱신 간격)이며 GPU 명령 시간이 아니다
      const timer = { webgl2: !!gl.getExtension('EXT_disjoint_timer_query_webgl2'), webgl1: !!gl.getExtension('EXT_disjoint_timer_query'), contextIsWebGL2: typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext };
      resolve({ first3dMs: performance.now(), renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : null, gpuTimerExtension: timer });
    })));
    result.renderer = first.renderer;
    if (!first.renderer || /swiftshader|llvmpipe|softpipe|software|basic render|warp/i.test(first.renderer)) throw Error(`Hardware renderer required: ${first.renderer}`);
    await page.getByRole('button', { name: '테스트 계정으로 들어가기' }).click();
    await page.waitForFunction(() => window.__uamWorld?.debugState().works === 14, null, { timeout: 90000 });
    await page.evaluate(async () => {
      const e = window.__uamWorld;
      e.skipIntro();
      await e.loadDecor();
      const a = await import('/src/app/world/avatar.ts');
      const t = performance.now();
      await e.setAvatar({ ...a.DEFAULT_AVATAR, mode: 'image', imageSource: 'artwork' }, [...e.artworks.values()].find(w => w.subject === 'tiger').original);
      window.__perfAvatarMs = performance.now() - t;
      await e.setAvatar(a.DEFAULT_AVATAR, null);
      window.__perfOriginal = { frame: e.frame.bind(e), adapt: e.adapt.bind(e), camera: e.updateCamera.bind(e), post: e.postReady.bind(e) };
      // Aggregate render calls across all scene/shadow/post passes, once per engine frame.
      e.renderer.info.autoReset = false;
      e.frame = dt => {
        e.renderer.info.reset();
        const t = performance.now(); window.__perfOriginal.frame(dt);
        window.__perfCpu = performance.now() - t;
      };
    });
    result[`startupDpr${dpr}`] = { ...first, avatarMs: await page.evaluate(() => window.__perfAvatarMs), fixtureReadyMs: await page.evaluate(() => performance.now()) };
    for (const scene of scenes) {
      await page.evaluate(async scene => {
        const e = window.__uamWorld;
        e.reduced = true; e.setInterior(scene.startsWith('cathedral') ? 'cathedral' : 'gallery');
        if (scene === 'town31') {
          const n = await import('/src/app/character/names.ts'), a = await import('/src/app/world/avatar.ts');
          const image = [...e.artworks.values()].find(w => w.subject === 'tiger').original;
          const buildings = Array.from({ length: 31 }, (_, i) => ({ id: String(i), child: '견본 ' + i, style: n.STYLES[i % 8], mine: i === 0, avatar: { ...a.DEFAULT_AVATAR, mode: 'image', imageSource: 'artwork' }, avatarImage: image }));
          e.showTown(buildings); await e.setResidents(buildings);
        } else { e.showPlaza(); if (scene.includes('-') || scene === 'view') e.enterMuseum(); }
        e.reduced = false; e.skipIntro(); e.setInputPaused(true);
        const hall = scene.endsWith('hall') || scene.endsWith('nave');
        const p = scene === 'town31' ? [25, 12, 45] : scene.includes('-') ? hall ? [0, 2, e.museum.zEnd + 2.5] : [4, 5, 10.5] : [10, 4, 40];
        const target = scene.includes('-') ? hall ? [0, 8, -2] : [0, 7, -24] : [0, 4, 8];
        e.camera.position.set(...p); e.camera.lookAt(...target);
        window.__perfPose = { p, target };
        // Keep normal camera/occlusion CPU work; only override the final view for matching screenshots.
        e.updateCamera = dt => { window.__perfOriginal.camera(dt); e.camera.position.set(...p); e.camera.lookAt(...target); };
      }, scene);
      const variants = fixed ? ['control'] : diagnose ? ['control', 'post-off', 'shadows-off', 'ratio-1', ...(scene === 'plaza' || scene === 'town31' ? ['decor-off'] : []), ...(scene.startsWith('cathedral') ? ['shafts-off'] : [])] : ['normal'];
      for (const variant of variants) {
        await page.evaluate(({ dpr, variant, scene, diagnose }) => {
          const e = window.__uamWorld, o = window.__perfOriginal;
          e.adapt = diagnose ? () => {} : o.adapt;
          e.renderer.setPixelRatio(variant === 'ratio-1' ? 1 : Math.min(dpr, 1.75)); e.resize();
          e.frameSum = 0; e.frameN = 0;
          e.postReady = variant === 'post-off' ? () => null : diagnose ? () => { const old = e.startRatio; e.startRatio = 0; const p = o.post(); e.startRatio = old; return p; } : o.post;
          e.renderer.shadowMap.enabled = variant !== 'shadows-off';
          e.outdoor.landscape.visible = variant !== 'decor-off';
          e.museum.cathedral?.root.traverse(obj => { if (['shaft', 'pool', 'dust'].some(k => obj.material === e.museum.cathedral.mats[k])) obj.visible = variant !== 'shafts-off'; });
          if (scene === 'walk' || scene === 'reveal') { e.reduced = false; e.showPlaza(); e.skipIntro(); e.debugTeleport(0, 28); e.updateCamera = o.camera; }
          if (scene === 'view') { const w = [...e.museum.works.values()].find(w => w.group.getObjectByName('original-print')); e.debugTeleport(w.stand.x, w.stand.z); e.updateCamera = o.camera; e.setInputPaused(false); }
        }, { dpr, variant, scene, diagnose });
        await page.waitForTimeout(3000);
        // Warmup is excluded; every recorded series contains ten seconds of samples.
        const measurement = await page.evaluate(async ({ scene, variant, dpr }) => {
          const e = window.__uamWorld, samples = [], cpu = [], counters = [], states = [];
          if (scene === 'walk') { e.setInputPaused(false); e.enterMuseum(); }
          // 공개: 광장에서 가장 최근 작품의 첫 공개(입장→로비 액자 앞). 가까이 보기: 명패의 버튼으로 원본 화면을 연다
          if (scene === 'reveal') { e.setInputPaused(false); e.reveal([...e.artworks.values()].sort((a, b) => b.createdAt - a.createdAt)[0].id); }
          if (scene === 'view') [...document.querySelectorAll('.plaque button')].find(b => b.textContent.trim() === '가까이 보기')?.click();
          const started = performance.now(); let previous = await new Promise(requestAnimationFrame);
          while (performance.now() - started < 10000) {
            const now = await new Promise(requestAnimationFrame);
            samples.push(now - previous); previous = now; cpu.push(window.__perfCpu);
            const r = e.renderer.info;
            counters.push({ calls: r.render.calls, triangles: r.render.triangles, programs: r.programs.length, textures: r.memory.textures });
            const state = { ratio: e.renderer.getPixelRatio(), post: !!e.postReady(), space: e.space };
            if (JSON.stringify(states.at(-1)?.state) !== JSON.stringify(state)) states.push({ ms: performance.now() - started, state });
          }
          const stats = values => { const a = [...values].sort((a, b) => a - b); return { p50: a[Math.ceil(a.length * .5) - 1], p95: a[Math.ceil(a.length * .95) - 1], max: a.at(-1) }; };
          return { scene, variant, dpr, elapsedMs: performance.now() - started, samples: samples.length, frameMs: stats(samples), cpuSubmitMs: stats(cpu), calls: stats(counters.map(c => c.calls)), triangles: stats(counters.map(c => c.triangles)), programs: counters.at(-1).programs, textures: counters.at(-1).textures, jsHeapBytes: performance.memory?.usedJSHeapSize ?? null, states, pose: window.__perfPose, viewOpened: scene === 'view' ? !!document.querySelector('[role="dialog"] .w-view-figure') : undefined, featured: e.museum.featuredId ?? null, drawingBuffer: [e.renderer.domElement.width, e.renderer.domElement.height], intervalsMs: samples };
        }, { scene, variant, dpr });
        result.measurements.push(measurement); save();
        await page.screenshot({ path: path.join(out, `${scene}-dpr${dpr}-${variant}.png`) });
        console.log(JSON.stringify({ scene, dpr, variant, p95: measurement.frameMs.p95, calls: measurement.calls.p50, states: measurement.states }));
      }
    }
    await context.close();
  }
  if (result.errors.length) throw Error('Page errors occurred');
  result.status = 'pass';
} catch (e) { result.status = 'fail'; result.errors.push(String(e.stack ?? e)); process.exitCode = 1; }
finally {
  await browser?.close(); result.finished = new Date().toISOString(); save();
  const rows = result.measurements;
  fs.writeFileSync(path.join(out, 'summary.tsv'), ['scene\tdpr\tvariant\tp50_ms\tp95_ms\tmax_ms\tcalls_p50\ttriangles_p50\tcpu_p95_ms', ...rows.map(r => [r.scene, r.dpr, r.variant, r.frameMs.p50, r.frameMs.p95, r.frameMs.max, r.calls.p50, r.triangles.p50, r.cpuSubmitMs.p95].join('\t'))].join('\n'));
  if (diagnose) fs.writeFileSync(path.join(out, 'diagnosis.tsv'), ['scene\tdisabled\tcontrol_p95_ms\tvariant_p95_ms\tdelta_ms\tcpu_delta_ms\tinterpretation', ...rows.filter(r => r.variant !== 'control').map(r => {
    const c = rows.find(c => c.scene === r.scene && c.variant === 'control');
    const delta = c.frameMs.p95 - r.frameMs.p95;
    return [r.scene, r.variant, c.frameMs.p95, r.frameMs.p95, delta, c.cpuSubmitMs.p95 - r.cpuSubmitMs.p95, delta > Math.max(1, c.frameMs.p95 * .1) ? 'effect observed; CPU/GPU split not proven' : 'no clear p95 benefit in this sample'].join('\t');
  })].join('\n'));
}
