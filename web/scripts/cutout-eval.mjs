// 배경 지우기 비교 실험(3D미술관_재설계 §2-19). 로컬 확인 전용.
// 사용: 개발 서버를 켠 뒤 `node scripts/cutout-eval.mjs <예제 폴더> <출력 폴더>`
// 예제 폴더: AnimatedDrawings(MIT) examples/characters/charN의 texture.png·mask.png를 charN_texture.png·charN_mask.png로 둔다.
// 정답 마스크는 사람이 확인한 마스크다. 같은 자료에 세 방식(A 종이색만 · B +틈 메우기 · E +조명 펴기)을 돌려 IoU를 낸다.
import { chromium } from '@playwright/test';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const dir = resolve(process.argv[2] ?? '.');
const out = resolve(process.argv[3] ?? '/private/tmp/uam-cutout-eval');
const base = process.env.WORLD_URL ?? 'http://127.0.0.1:9501';
mkdirSync(out, { recursive: true });
const cases = readdirSync(dir).filter((f) => /_texture\.png$/.test(f)).sort().map((f) => {
  const name = f.replace('_texture.png', '');
  return { name, tex: readFileSync(resolve(dir, f)).toString('base64'), gt: readFileSync(resolve(dir, `${name}_mask.png`)).toString('base64') };
});
const extra = readdirSync(dir).filter((f) => /\.(png|jpe?g)$/i.test(f) && !/_(texture|mask)\.png$/.test(f)).map((f) => ({ name: f, img: readFileSync(resolve(dir, f)).toString('base64') }));

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`${base}/app/world`);
const result = await page.evaluate(async ({ cases, extra }) => {
  const cut = await import('/src/app/world/cutout.ts');
  // A 종이색 이어 칠하기만(10/22) · B A+틈 메우기(§2-18) · E B+조명 펴기(§2-19, 앱 기본값)
  const methods = { A: { flatten: false, closeGaps: false }, B: { flatten: false, closeGaps: true }, E: {} };
  const load = async (b64, type = 'image/png') => cut.blobToImage(await (await fetch(`data:${type};base64,${b64}`)).blob());
  const rows = [], sheets = [];
  for (const c of cases) {
    const img = await load(c.tex), gtImg = await load(c.gt);
    const work = cut.drawToCanvas(img, cut.WORK_SIDE);
    const g = document.createElement('canvas'); g.width = work.width; g.height = work.height;
    const gx = g.getContext('2d'); gx.drawImage(gtImg, 0, 0, g.width, g.height);
    const gd = gx.getImageData(0, 0, g.width, g.height).data;
    const row = { name: c.name };
    // 비교 그림: 원본 | 정답 | A | B | E (전경=흰색, 정답 밖으로 넘친 곳=빨강, 놓친 곳=파랑)
    const s = document.createElement('canvas'); s.width = work.width * 5; s.height = work.height;
    const sx = s.getContext('2d'); sx.drawImage(work, 0, 0); sx.drawImage(g, work.width, 0);
    let col = 2;
    for (const [k, o] of Object.entries(methods)) {
      const t0 = performance.now();
      const m = cut.removeBackground(work, o);
      const ms = Math.round(performance.now() - t0);
      let inter = 0, uni = 0, extra = 0, miss = 0;
      const vis = sx.createImageData(m.w, m.h);
      for (let i = 0; i < m.w * m.h; i++) {
        const a = m.data[i] ? 1 : 0, b = gd[i * 4] > 127 ? 1 : 0;
        inter += a & b; uni += a | b; extra += a & (1 - b); miss += b & (1 - a);
        const [r, gg, bb] = a && b ? [255, 255, 255] : a ? [230, 60, 60] : b ? [60, 90, 230] : [20, 20, 20];
        vis.data[i * 4] = r; vis.data[i * 4 + 1] = gg; vis.data[i * 4 + 2] = bb; vis.data[i * 4 + 3] = 255;
      }
      sx.putImageData(vis, col++ * work.width, 0);
      const gtN = inter + miss;
      row[k] = { iou: +(inter / Math.max(1, uni)).toFixed(3), extra: +(extra / Math.max(1, gtN)).toFixed(3), miss: +(miss / Math.max(1, gtN)).toFixed(3), ok: m.ok, ms };
    }
    rows.push(row);
    sheets.push({ name: c.name, url: s.toDataURL('image/png') });
  }
  // 정답 없는 전체 사진: 방식별 마스크를 나란히 그린 그림만 남긴다(사람 판단)
  for (const e of extra) {
    const img = await load(e.img, e.name.endsWith('.png') ? 'image/png' : 'image/jpeg');
    const work = cut.drawToCanvas(img, cut.WORK_SIDE);
    const s = document.createElement('canvas'); s.width = work.width * 4; s.height = work.height;
    const sx = s.getContext('2d'); sx.drawImage(work, 0, 0);
    Object.values(methods).forEach((o, k) => {
      const m = cut.removeBackground(work, o);
      const v = cut.cutoutCanvas(work, m);
      sx.fillStyle = '#5ab0a0'; sx.fillRect((k + 1) * work.width, 0, work.width, work.height); sx.drawImage(v, (k + 1) * work.width, 0);
    });
    sheets.push({ name: e.name, url: s.toDataURL('image/png') });
  }
  return { rows, sheets };
}, { cases, extra });

for (const s of result.sheets) writeFileSync(resolve(out, `${s.name}_비교.png`), Buffer.from(s.url.split(',')[1], 'base64'));
const mean = (k) => +(result.rows.reduce((a, r) => a + r[k].iou, 0) / Math.max(1, result.rows.length)).toFixed(3);
const summary = { n: result.rows.length, meanIoU: { A: mean('A'), B: mean('B'), E: mean('E') }, rows: result.rows, sheets: result.sheets.map((s) => `${s.name}_비교.png`) };
writeFileSync(resolve(out, 'cutout-eval.json'), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary));
await browser.close();
