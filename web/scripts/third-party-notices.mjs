// 공개 소프트웨어 고지(3D미술관_재설계 §2-19 기준 3). package.json의 dependencies(배포본에 들어가는 것)마다
// node_modules의 LICENSE 원문을 모아 public/licenses/THIRD_PARTY.txt 하나로 쓴다. 목록을 손으로 적지 않는다.
// 사용: web에서 `node scripts/third-party-notices.mjs` (build:world가 먼저 부른다)
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const web = resolve(import.meta.dirname, '..');
const deps = Object.keys(JSON.parse(readFileSync(resolve(web, 'package.json'), 'utf8')).dependencies ?? {}).sort();
const parts = [];
const missing = [];
for (const name of deps) {
  const dir = resolve(web, 'node_modules', name);
  const pkg = JSON.parse(readFileSync(resolve(dir, 'package.json'), 'utf8'));
  // 패키지 맨 위에 없으면 배포 폴더(dist)에서 찾는다
  const file = ['', 'dist'].map((sub) => resolve(dir, sub)).filter((d) => existsSync(d))
    .flatMap((d) => readdirSync(d).filter((f) => /^(licen[cs]e|copying)(\.|$)/i.test(f)).map((f) => resolve(d, f)))[0];
  if (!file) missing.push(name);
  const text = file ? readFileSync(file, 'utf8').trim() : `(LICENSE 파일 없음. package.json license: ${pkg.license ?? '표시 없음'})`;
  parts.push(`${'='.repeat(72)}\n${name} ${pkg.version} — ${pkg.license ?? '표시 없음'}\n${'='.repeat(72)}\n${text}\n`);
}
const head = `우리 아이 미술관이 쓰는 공개 소프트웨어(${deps.length}개)\n이 파일은 scripts/third-party-notices.mjs가 만든다. 질감 자료의 출처는 /museum/world/materials/manifest.json에 있다.\n\n`;
writeFileSync(resolve(web, 'public/licenses/THIRD_PARTY.txt'), head + parts.join('\n'));
console.log(JSON.stringify({ packages: deps.length, missing }));
if (missing.length) process.exitCode = 1;
