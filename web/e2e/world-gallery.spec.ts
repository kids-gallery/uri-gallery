// #40 3D 화면 전시 목록(마스터플랜 3-3): 원본 액자 → 승인 전 결과는 보이지 않음 → 승인 뒤 컷아웃 입체 → 새로 고침 유지 → 지우기. 390 · 1440.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { expect, test, type Page } from '@playwright/test';
import { animatedJobs, e2eDb, type Connection } from './stack/db';
import { album, openWorldUpload, photo, tag, useCrop } from './stack/world';

async function shot(page: Page, name: string) { if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/${name}-${page.viewportSize()!.width}.png` }); }

/** 가운데 원만 남고 바깥이 투명한 컷아웃(시험용 그림) */
function cutoutPng(w = 320, h = 240): Buffer {
  const crcT = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (b: Buffer) => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255]! ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (t: string, d: Buffer) => { const head = Buffer.from(t); const len = Buffer.alloc(4); len.writeUInt32BE(d.length); const sum = Buffer.alloc(4); sum.writeUInt32BE(crc(Buffer.concat([head, d]))); return Buffer.concat([len, head, d, sum]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  const rows = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * (w * 4 + 1) + 1 + x * 4;
    if ((x - w / 2) ** 2 + (y - h / 2) ** 2 < 70 ** 2) { rows[i] = 230; rows[i + 1] = 90; rows[i + 2] = 60; rows[i + 3] = 255; }
  }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(rows)), chunk('IEND', Buffer.alloc(0))]);
}

let db: Connection;
test.beforeAll(async () => { db = await e2eDb(); });
test.afterAll(async () => { await db?.end(); });
test.describe.configure({ timeout: 300_000 });

/** 임시 스택에 컷아웃과 승인 전 부조 결과를 넣는다(활성 모델이 없어 워커가 만들 수 없다). 아직 걸지 않는다 */
async function seedRelief(id: string, png: Buffer): Promise<{ relief: number; cutout: number }> {
  const [[a]] = await db.query(`SELECT family_id FROM artwork WHERE artwork_id = ?`, [id]) as [{ family_id: number }[]];
  const key = `family/${a!.family_id}/e2e-cutout-${id}.png`;
  const file = path.join(process.env.E2E_DIR!, 'store', key);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, png);
  const object = async (kind: string) => (await db.query(`INSERT INTO stored_object (owner_kind, family_id, artwork_id, object_kind, object_key) VALUES ('family', ?, ?, ?, ?)`, [a!.family_id, id, kind, `${key}.${kind}`]) as [{ insertId: number }])[0].insertId;
  fs.copyFileSync(file, `${file}.cutout`); fs.copyFileSync(file, `${file}.depth`);
  const cutout = await object('cutout');
  await db.query(`UPDATE judgment SET cutout_object_id = ? WHERE artwork_id = ?`, [cutout, id]);
  // 작업 행은 활성 버전만 받는다. us3처럼 가짜 M5를 넣는 동안만 활성으로 둔다
  const [v] = await db.query(`INSERT INTO model_version (model_id, version_label, weights_sha256, config_hash, runtime, license_confirmed, release_state, exec_device)
    VALUES ('M5', CONCAT('e2e-', LEFT(REPLACE(UUID(), '-', ''), 12)), REPEAT('0', 64), REPEAT('0', 64), 'fake', TRUE, 'active', 'cpu')`) as [{ insertId: number }];
  try {
    const [j] = await db.query(`INSERT INTO stage_job (artwork_id, stage_kind, origin, serving_group, model_version_id, status) VALUES (?, 'depth_relief', 'confirm', 'cpu_vision', ?, 'done')`, [id, v.insertId]) as [{ insertId: number }];
    const [r] = await db.query(`INSERT INTO result (artwork_id, job_id, result_kind, object_id) VALUES (?, ?, 'relief', ?)`, [id, j.insertId, await object('depth')]) as [{ insertId: number }];
    return { relief: r.insertId, cutout };
  } finally {
    await db.query(`UPDATE model_version SET release_state = 'retired' WHERE version_id = ?`, [v.insertId]);
  }
}

test('원본 액자 → 승인 전 결과 비전시 → 승인 뒤 컷아웃 입체 → 새로 고침 유지 → 지우기', async ({ page }) => {
  const png = cutoutPng();
  const objects: number[] = []; // 화면이 받은 파일의 객체 번호(파일 토큰 앞부분)
  page.on('response', (r) => { const m = /\/v1\/files\/([^/?]+)/.exec(r.url()); if (m && r.ok()) objects.push(Number(Buffer.from(m[1]!.split('.')[0]!, 'base64url').toString().split('.')[0])); });

  await openWorldUpload(page, tag('w40'));
  const posted = page.waitForResponse((r) => r.url().endsWith('/v1/artworks') && r.request().method() === 'POST');
  await album(page).setInputFiles(photo());
  await useCrop(page);
  const id = String((await (await posted).json() as { id: string }).id);
  await expect(page.locator('.w-saved-thumb')).toBeVisible({ timeout: 60_000 });
  await shot(page, 'gallery-1-frame');
  expect(objects.length).toBeGreaterThan(0);

  const openArchive = async () => {
    await page.getByRole('button', { name: '더보기' }).click({ timeout: 60_000 });
    await page.getByRole('button', { name: '보관함', exact: true }).click();
    return page.getByRole('dialog', { name: '입체 보관함' });
  };
  const enter = async () => {
    await page.goto('/app/world');
    await page.getByRole('button', { name: '시작하기' }).click();
    await expect(page.getByRole('button', { name: '작품 올리기', exact: true }).first()).toBeVisible({ timeout: 60_000 });
  };

  // 승인 전: 컷아웃과 부조가 서버에 있어도 전시에 나오지 않는다. 새로 고침해도 작품은 남는다
  const { relief, cutout } = await seedRelief(id, png);
  const before = (await (await page.request.get(`/v1/artworks/${id}`)).json()) as { cutoutUrl: string | null };
  expect(before.cutoutUrl).toBeTruthy();
  objects.length = 0;
  await enter();
  await expect.poll(() => objects.length, { timeout: 30_000 }).toBeGreaterThan(0); // 사진은 받는다(아래 검사가 빈 목록으로 통과하지 않게)
  let archive = await openArchive();
  await expect(archive.getByRole('heading', { name: /1점/ })).toBeVisible();
  await expect(archive.getByRole('button', { name: '제목·추억 고치기' })).toHaveCount(0); // 올린 작품은 고칠 수 없다(D46)
  await shot(page, 'gallery-2-unapproved');
  expect(objects).not.toContain(cutout);
  await archive.getByRole('button', { name: '닫기' }).click();

  // 승인 뒤: 진행 중인 단계가 있으면 새로 고침한 뒤에도 상태를 이어서 묻고, 걸린 결과가 부조로 바뀌면 새로 고침 없이 컷아웃을 받는다
  await animatedJobs(db, id, (v) => db.query(`INSERT INTO stage_job (artwork_id, stage_kind, origin, serving_group, model_version_id) VALUES (?, 'animate_render', 'confirm', 'gpu', ?)`, [id, v]).then(() => undefined));
  await enter();
  await page.waitForResponse((r) => r.url().endsWith(`/v1/artworks/${id}`) && r.request().method() === 'GET', { timeout: 30_000 });
  objects.length = 0;
  await db.query(`UPDATE artwork SET hung_result_id = ? WHERE artwork_id = ?`, [relief, id]);
  await expect.poll(() => objects, { timeout: 30_000 }).toContain(cutout);
  await db.query(`UPDATE stage_job SET status = 'done' WHERE artwork_id = ? AND status = 'queued'`, [id]);
  archive = await openArchive();
  await expect(archive.getByRole('heading', { name: /1점/ })).toBeVisible();
  await page.waitForTimeout(1500);
  await shot(page, 'gallery-3-approved');

  // 지우기: 서버에서 지워지고 목록에서 사라진다
  await archive.getByRole('button', { name: '지우기' }).first().click();
  const del = page.waitForResponse((r) => r.url().endsWith(`/v1/artworks/${id}`) && r.request().method() === 'DELETE');
  await archive.getByRole('button', { name: '지우기' }).last().click();
  expect((await del).status()).toBe(202);
  await expect(page.getByRole('heading', { name: /0점/ })).toBeVisible({ timeout: 15_000 });
  const list = (await (await page.request.get('/v1/artworks')).json()) as { id: string }[];
  expect(list.map((a) => a.id)).not.toContain(id);
  await page.goto('/app/world');
  await page.getByRole('button', { name: '시작하기' }).click();
  archive = await openArchive();
  await expect(archive.getByRole('heading', { name: /0점/ })).toBeVisible();
});
