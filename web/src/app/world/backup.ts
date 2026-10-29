// 백업 파일 내보내기·가져오기(3D미술관_재설계 §2-19 기준 1). 기기에만 저장하는 판의 데이터 분실을 막는다.
// 한 파일(zip, 압축 없음: 사진은 이미 압축돼 있다) = manifest.json + 작품마다 원본·화면용 사본·배경 지운 사본 + 캐릭터 그림.
// 견본 작품은 넣지 않는다(설정에서 다시 걸 수 있다). 가져오기는 없는 작품만 더하고 기존 작품을 바꾸지 않는다.
import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from 'fflate';
import * as store from './store';
import type { Artwork, Prefs } from './store';
import { extOf, safeName } from './relief3d';

export const BACKUP_FORMAT = 'uam-world-backup';
export const BACKUP_VERSION = 1;

export interface FileRef { path: string; type: string }
export interface BackupWork {
  id: string; no: number; title: string; kind: Artwork['kind']; subject: string; material: string;
  age: number; madeOn: string; words: string; createdAt: number; rotation?: number; cutoutState?: Artwork['cutoutState'];
  original: FileRef; display: FileRef; cutout: FileRef | null;
}
export interface BackupManifest {
  format: typeof BACKUP_FORMAT; version: number; createdAt: number;
  child: string; childAge: number;
  prefs: Omit<Prefs, 'avatarImage'> & { avatarImage: FileRef | null };
  rooms: number[];
  works: BackupWork[];
}
export interface BackupData { manifest: BackupManifest; files: Record<string, Uint8Array> }

export class BackupError extends Error {
  constructor(public reason: 'not-backup' | 'newer' | 'broken') { super(reason); }
}

/** 메모리의 백업 자료 → zip 바이트 */
export function packBackup(d: BackupData): Uint8Array {
  const entries: Zippable = { 'manifest.json': strToU8(JSON.stringify(d.manifest)) };
  for (const [path, bytes] of Object.entries(d.files)) entries[path] = [bytes, { level: 0 }];
  return zipSync(entries, { level: 0 });
}

/** zip 바이트 → 백업 자료. 우리 백업이 아니거나, 더 새 판이거나, 가리키는 파일이 없으면 BackupError */
export function unpackBackup(bytes: Uint8Array): BackupData {
  let z: Record<string, Uint8Array>;
  try { z = unzipSync(bytes); } catch { throw new BackupError('not-backup'); }
  const raw = z['manifest.json'];
  if (!raw) throw new BackupError('not-backup');
  let manifest: BackupManifest;
  try { manifest = JSON.parse(strFromU8(raw)) as BackupManifest; } catch { throw new BackupError('not-backup'); }
  if (manifest?.format !== BACKUP_FORMAT) throw new BackupError('not-backup');
  if (typeof manifest.version !== 'number' || manifest.version > BACKUP_VERSION) throw new BackupError('newer');
  if (!Array.isArray(manifest.works) || !Array.isArray(manifest.rooms) || typeof manifest.prefs !== 'object') throw new BackupError('broken');
  const refs = manifest.works.flatMap((w) => [w.original, w.display, w.cutout]).concat(manifest.prefs.avatarImage);
  for (const r of refs) if (r && !z[r.path]) throw new BackupError('broken');
  delete z['manifest.json'];
  return { manifest, files: z };
}

const bytesOf = async (b: Blob) => new Uint8Array(await b.arrayBuffer());
const ymd = (t: number) => { const d = new Date(t); return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`; };

/** 지금 가족의 미술관을 백업 파일 하나로 만든다 */
export async function exportBackup(now = Date.now()): Promise<{ blob: Blob; name: string; count: number }> {
  const account = await store.getAccount();
  if (!account) throw new Error('no family');
  const [prefs, rooms, all] = await Promise.all([store.getPrefs(), store.getRooms(), store.listArtworks()]);
  const files: Record<string, Uint8Array> = {};
  const add = async (path: string, b: Blob): Promise<FileRef> => { files[path] = await bytesOf(b); return { path, type: b.type || 'application/octet-stream' }; };
  const works: BackupWork[] = [];
  for (const a of all.filter((x) => !x.sample).sort((x, y) => x.no - y.no)) {
    const dir = `works/${a.id}`;
    works.push({
      id: a.id, no: a.no, title: a.title, kind: a.kind, subject: a.subject, material: a.material, age: a.age,
      madeOn: a.madeOn, words: a.words, createdAt: a.createdAt, ...(a.rotation ? { rotation: a.rotation } : {}), ...(a.cutoutState ? { cutoutState: a.cutoutState } : {}),
      original: await add(`${dir}/original.${extOf(a.original.type)}`, a.original),
      display: await add(`${dir}/display.${extOf(a.display.type)}`, a.display),
      cutout: a.cutout ? await add(`${dir}/cutout.png`, a.cutout) : null,
    });
  }
  const { avatarImage, ...rest } = prefs;
  const manifest: BackupManifest = {
    format: BACKUP_FORMAT, version: BACKUP_VERSION, createdAt: now, child: account.child, childAge: account.childAge,
    prefs: { ...rest, avatarImage: avatarImage ? await add(`avatar/image.${extOf(avatarImage.type)}`, avatarImage) : null },
    rooms, works,
  };
  const zip = packBackup({ manifest, files });
  return { blob: new Blob([zip as BlobPart], { type: 'application/zip' }), name: `우리아이미술관_백업_${safeName(account.child)}_${ymd(now)}.zip`, count: works.length };
}

/**
 * 백업 파일을 지금 가족에 더한다. 같은 ID의 작품은 건너뛴다(어느 가족의 것이든 덮어쓰지 않는다).
 * 지금 가족에 직접 올린 작품이 하나도 없을 때만 캐릭터·모드 설정과 아이 이름도 가져온다.
 */
export async function importBackup(file: Blob): Promise<{ added: number; skipped: number; prefsRestored: boolean }> {
  const { manifest, files } = unpackBackup(await bytesOf(file));
  const blob = (r: FileRef) => new Blob([files[r.path]! as BlobPart], { type: r.type });
  const existing = await store.listArtworks();
  const empty = !existing.some((a) => !a.sample);
  let no = existing.reduce((m, a) => Math.max(m, a.no), 0);
  let added = 0, skipped = 0;
  for (const w of [...manifest.works].sort((x, y) => x.no - y.no)) {
    if (await store.hasArtwork(w.id)) { skipped++; continue; }
    await store.saveArtworkAndRoom({
      id: w.id, no: empty && !existing.some((a) => a.no === w.no) ? w.no : ++no, title: w.title, kind: w.kind, subject: w.subject,
      material: w.material, age: w.age, madeOn: w.madeOn, words: w.words, original: blob(w.original), display: blob(w.display),
      cutout: w.cutout ? blob(w.cutout) : null, sample: false, createdAt: w.createdAt, ...(w.rotation ? { rotation: w.rotation } : {}),
      // 처리 전에 내보낸 작품은 가져온 기기에서 이어서 배경을 지운다(§2-22 3). 예전 백업은 값이 없어 다시 처리하지 않는다
      ...(w.cutoutState === 'pending' || w.cutoutState === 'done' || w.cutoutState === 'none' ? { cutoutState: w.cutoutState } : {}),
    });
    no = Math.max(no, w.no);
    added++;
  }
  if (empty) {
    const { avatarImage, ...rest } = manifest.prefs;
    await store.savePrefs({ ...(await store.getPrefs()), ...rest, avatarImage: avatarImage ? blob(avatarImage) : null });
    const account = await store.getAccount();
    if (account && account.child === store.NEW_FAMILY_CHILD && manifest.child) await store.saveAccount({ ...account, child: manifest.child, childAge: manifest.childAge });
  }
  return { added, skipped, prefsRestored: empty };
}
