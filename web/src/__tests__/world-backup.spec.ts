// @vitest-environment node
// 3D미술관_재설계 §2-19 기준 1 — 백업 파일 만들기·읽기. 순수 함수 시험(브라우저 저장소 없이).
import { describe, expect, it } from 'vitest';
import { zipSync, strToU8 } from 'fflate';
import { BACKUP_FORMAT, BackupError, packBackup, unpackBackup, type BackupManifest } from '@/app/world/backup';
import { DEFAULT_AVATAR } from '@/app/world/avatar';

const bytes = (n: number, seed: number) => Uint8Array.from({ length: n }, (_, i) => (i * 31 + seed) % 256);
const manifest = (): BackupManifest => ({
  format: BACKUP_FORMAT, version: 1, createdAt: 1, child: '하늘', childAge: 5,
  prefs: { avatar: DEFAULT_AVATAR, avatarImage: { path: 'avatar/image.png', type: 'image/png' }, theme: 'forest', sound: true },
  rooms: [0, 5],
  works: [{
    id: 'w1', no: 1, title: '토끼', kind: 'drawing', subject: 'etc', material: '', age: 5, madeOn: '', words: '귀가 길어', createdAt: 2,
    original: { path: 'works/w1/original.jpg', type: 'image/jpeg' }, display: { path: 'works/w1/display.jpg', type: 'image/jpeg' }, cutout: null,
  }],
});
const files = () => ({ 'works/w1/original.jpg': bytes(5000, 1), 'works/w1/display.jpg': bytes(1200, 2), 'avatar/image.png': bytes(300, 3) });

describe('백업 파일(§2-19 기준 1)', () => {
  it('만든 파일을 읽으면 정보와 사진 바이트가 그대로다', () => {
    const back = unpackBackup(packBackup({ manifest: manifest(), files: files() }));
    expect(back.manifest).toEqual(manifest());
    for (const [p, b] of Object.entries(files())) expect(back.files[p]).toEqual(b);
    expect(back.files['manifest.json']).toBeUndefined();
  });

  it('우리 백업이 아닌 zip·zip이 아닌 파일은 not-backup', () => {
    const other = zipSync({ 'a.txt': strToU8('hello') });
    expect(() => unpackBackup(other)).toThrow(BackupError);
    expect(() => unpackBackup(strToU8('not a zip'))).toThrow('not-backup');
    const wrong = zipSync({ 'manifest.json': strToU8(JSON.stringify({ ...manifest(), format: 'something-else' })) });
    expect(() => unpackBackup(wrong)).toThrow('not-backup');
  });

  it('더 새 판의 백업은 newer로 거절한다', () => {
    const z = packBackup({ manifest: { ...manifest(), version: 99 }, files: files() });
    expect(() => unpackBackup(z)).toThrow('newer');
  });

  it('가리키는 사진이 빠진 백업은 broken', () => {
    const f = files();
    delete (f as Record<string, Uint8Array>)['works/w1/display.jpg'];
    expect(() => unpackBackup(packBackup({ manifest: manifest(), files: f }))).toThrow('broken');
  });
});
