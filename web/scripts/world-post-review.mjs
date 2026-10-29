// Pixel comparison of separate and fused edge shading before FXAA, with the scene clock stopped.
import { chromium } from '@playwright/test';
import fs from 'node:fs';
const out = process.argv[2]; fs.mkdirSync(out, { recursive: true });
const results = [];
const browser = await chromium.launch({ channel: 'chrome' });
try {
  for (const dpr of [1, 2]) {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: dpr, reducedMotion: 'reduce' });
    await page.goto('http://127.0.0.1:5173/app/world');
    await page.getByRole('button', { name: '테스트 계정으로 들어가기' }).click();
    await page.waitForFunction(() => window.__uamWorld?.debugState().works === 14);
    const renderer = await page.evaluate(() => {
      const gl = window.__uamWorld.renderer.getContext(), ext = gl.getExtension('WEBGL_debug_renderer_info');
      return ext && gl.getParameter(ext.UNMASKED_RENDERER_WEBGL);
    });
    if (!renderer || /swiftshader|llvmpipe|software|basic render|warp/i.test(renderer)) throw Error(`Hardware required: ${renderer}`);
    await page.evaluate(async () => {
      const e = window.__uamWorld; await e.loadDecor(); e.skipIntro(); e.stop(); e.startRatio = 0;
      e.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75)); e.resize();
    });
    for (const scene of ['plaza', 'cathedral']) {
      await page.evaluate(scene => {
        const e = window.__uamWorld;
        e.showPlaza(); if (scene === 'cathedral') { e.setInterior('cathedral'); e.enterMuseum(); }
        e.setInputPaused(true); e.updateCamera = () => {};
        e.camera.position.set(...(scene === 'plaza' ? [10, 4, 40] : [4, 5, 10.5]));
        e.camera.lookAt(...(scene === 'plaza' ? [0, 4, 8] : [0, 7, -24]));
      }, scene);
      // Entering the cathedral starts texture requests. Compare only after both paths share loaded assets.
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);
      await page.evaluate(() => window.__uamWorld.frame(0));
      const images = [];
      for (const separate of [true, false]) {
        const data = await page.evaluate(async separate => {
          const e = window.__uamWorld, c = e.postReady();
          if (separate) {
            const { ShaderPass } = await import('/node_modules/three/examples/jsm/postprocessing/ShaderPass.js');
            const { OutputPass } = await import('/node_modules/three/examples/jsm/postprocessing/OutputPass.js');
            window.__legacyEdge = new ShaderPass({
              uniforms: { tDiffuse: { value: null }, strength: { value: .28 } },
              vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
              fragmentShader: 'uniform sampler2D tDiffuse;uniform float strength;varying vec2 vUv;void main(){vec4 c=texture2D(tDiffuse,vUv);float d=length((vUv-0.5)*vec2(1.0,0.82))*1.42;c.rgb*=1.0-strength*smoothstep(0.45,1.0,d);gl_FragColor=c;}',
            });
            window.__legacyOutput = new OutputPass();
            c.removePass(e.output); c.insertPass(window.__legacyEdge, 2); c.insertPass(window.__legacyOutput, 3);
          } else {
            c.removePass(window.__legacyEdge); c.removePass(window.__legacyOutput);
            window.__legacyEdge.dispose(); window.__legacyOutput.dispose(); c.insertPass(e.output, 2);
          }
          // Render the frozen scene directly: frame(0) still updates water color and other state.
          // Isolate the fused arithmetic. FXAA's edge threshold amplifies tiny half-float rounding differences.
          e.fxaa.enabled = false;
          c.render(0); return e.renderer.domElement.toDataURL('image/png');
        }, separate);
        images.push(data);
        fs.writeFileSync(`${out}/${scene}-dpr${dpr}-${separate ? 'separate' : 'fused'}.png`, Buffer.from(data.split(',')[1], 'base64'));
      }
      const diff = await page.evaluate(async images => {
        const pixels = await Promise.all(images.map(async src => {
          const img = new Image(); img.src = src; await img.decode();
          const canvas = document.createElement('canvas'); canvas.width = img.width; canvas.height = img.height;
          const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0); return ctx.getImageData(0, 0, img.width, img.height).data;
        }));
        let max = 0, sum = 0;
        for (let i = 0; i < pixels[0].length; i++) if (i % 4 !== 3) { const d = Math.abs(pixels[0][i] - pixels[1][i]); max = Math.max(max, d); sum += d; }
        return { maxChannelDelta: max, meanChannelDelta: sum / (pixels[0].length * .75) };
      }, images);
      const row = { scene, dpr, renderer, fxaa: false, ...diff, pass: diff.maxChannelDelta <= 3 && diff.meanChannelDelta <= .25 };
      results.push(row); console.log(JSON.stringify(row));
    }
    await page.close();
  }
} catch (e) { results.push({ pass: false, error: String(e.stack ?? e) }); }
finally { await browser.close(); fs.writeFileSync(`${out}/result.json`, JSON.stringify(results, null, 2)); }
if (results.some(r => !r.pass)) process.exitCode = 1;
