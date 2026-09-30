// 사진 자산 규칙(SD_04 §3-3 "사진 자산", 2026-09-30): web/public/museum/photos/<노드>/<1024|2048>/{px,nx,py,ny,pz,nz}.webp 는
// manifest.json {nodes:[…]}에 출처·작가·허용 라이선스·원본 크기·좌표·용량이 있어야 하고, 노드당 예산(1024판 900KB·2048판 3MB) 안이어야 한다.
// 목록과 폴더가 어긋나면 실패. 사진은 ops/museum/pano2cube.py로 만든다.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const DIR = path.resolve(__dirname, '../../public/museum/photos');
const FACES = ['px', 'nx', 'py', 'ny', 'pz', 'nz'];
const BUDGET: Record<string, number> = { '1024': 900 * 1024, '2048': 3 * 1024 * 1024 };
const LICENSE = /^(PD|CC0|CC BY( \d\.\d)?|CC BY-SA( \d\.\d)?)$/;

interface Node {
  id: string; title: string; source: string; author: string; license: string;
  original: { width: number; height: number }; position: { x: number; z: number }; bytes: Record<string, number>;
}

export function checkPhotos(dir: string): string[] {
  const errs: string[] = [];
  const mf = path.join(dir, 'manifest.json');
  if (!fs.existsSync(mf)) return ['manifest.json 없음'];
  let doc: { nodes?: Node[] };
  try { doc = JSON.parse(fs.readFileSync(mf, 'utf8')); } catch { return ['manifest.json이 JSON이 아님']; }
  if (!Array.isArray(doc.nodes)) return ['manifest.json은 {nodes:[…]}'];
  const ids = new Set(doc.nodes.map((n) => n.id));
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory() && !ids.has(e.name)) errs.push(`${e.name}/: 목록에 없는 노드(출처·라이선스를 적어야 함)`);
    if (e.isFile() && e.name !== 'manifest.json') errs.push(`${e.name}: 노드 폴더 밖 파일`);
  }
  for (const n of doc.nodes) {
    const w = n.id ?? '(id 없음)';
    for (const k of ['id', 'title', 'source', 'author', 'license'] as const) if (!n[k] || typeof n[k] !== 'string') errs.push(`${w}: ${k} 없음`);
    if (n.source && !/^https:\/\//.test(n.source)) errs.push(`${w}: source는 원본 페이지 https URL`);
    if (n.license && !LICENSE.test(n.license)) errs.push(`${w}: 허용 밖 라이선스 "${n.license}"(PD·CC0·CC BY·CC BY-SA만)`);
    if (!(n.original?.width > 0 && Math.abs(n.original.width / n.original.height - 2) < 0.02)) errs.push(`${w}: original은 2:1 등장방형 크기`);
    if (typeof n.position?.x !== 'number' || typeof n.position?.z !== 'number') errs.push(`${w}: position{x,z} 없음`);
    for (const size of Object.keys(BUDGET)) {
      let total = 0;
      for (const f of FACES) {
        const p = path.join(dir, n.id ?? '', size, `${f}.webp`);
        if (!fs.existsSync(p)) { errs.push(`${w}: ${size}/${f}.webp 없음`); continue; }
        total += fs.statSync(p).size;
      }
      const limit = BUDGET[size] ?? 0;
      if (total > limit) errs.push(`${w}: ${size}판 ${total}B > 예산 ${limit}B`);
      if (n.bytes?.[size] !== total) errs.push(`${w}: bytes.${size} ${n.bytes?.[size]} ≠ 실제 ${total}`);
    }
  }
  return errs;
}

function fixture(nodes: unknown[], files: Record<string, number>) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'photos-'));
  for (const [f, size] of Object.entries(files)) { fs.mkdirSync(path.dirname(path.join(d, f)), { recursive: true }); fs.writeFileSync(path.join(d, f), Buffer.alloc(size)); }
  fs.writeFileSync(path.join(d, 'manifest.json'), JSON.stringify({ nodes }));
  return d;
}
const faces = (id: string, size: string, each: number) => Object.fromEntries(FACES.map((f) => [`${id}/${size}/${f}.webp`, each]));
const good = { id: 'g-v1', title: '그랑드 갤러리', source: 'https://commons.wikimedia.org/wiki/File:x.jpg', author: '작가', license: 'CC BY-SA 4.0',
  original: { width: 8000, height: 4000 }, position: { x: 0, z: 0 }, bytes: { '1024': 60, '2048': 120 } };

describe('사진 자산(SD_04 §3-3)', () => {
  it('실제 폴더: 모든 노드가 목록에 있고 규칙을 지킨다', () => {
    expect(checkPhotos(DIR)).toEqual([]);
  });
  it('올바른 노드는 통과', () => {
    const d = fixture([good], { ...faces('g-v1', '1024', 10), ...faces('g-v1', '2048', 20) });
    expect(checkPhotos(d)).toEqual([]);
    fs.rmSync(d, { recursive: true, force: true });
  });
  it('검사가 실제로 잡는다 — 권리 불명 라이선스·목록 없는 노드·면 빠짐·예산 초과·용량 불일치', () => {
    const bad = { ...good, id: 'b-v1', license: '© Louvre', source: 'http://www.louvre.fr/x', bytes: { '1024': 1, '2048': 1 } };
    const d = fixture([bad], {
      ...faces('b-v1', '1024', 200 * 1024), ...Object.fromEntries(Object.entries(faces('b-v1', '2048', 10)).slice(0, 5)),
      ...faces('stray-v1', '1024', 10),
    });
    const errs = checkPhotos(d).join('\n');
    expect(errs).toMatch(/stray-v1\/: 목록에 없는 노드/);
    expect(errs).toMatch(/b-v1: 허용 밖 라이선스/);
    expect(errs).toMatch(/b-v1: source는 원본 페이지 https URL/);
    expect(errs).toMatch(/b-v1: 2048\/nz\.webp 없음/);
    expect(errs).toMatch(/b-v1: 1024판 \d+B > 예산/);
    expect(errs).toMatch(/b-v1: bytes\.1024 1 ≠ 실제/);
    fs.rmSync(d, { recursive: true, force: true });
  });
});
