// 로컬 판 저장(3D미술관_재설계 §2-8 · §2-9): 브라우저 IndexedDB v2 — 가족별 계정 · 작품 · 방 · 설정과 활성 가족 · 친구 자료.
// 테스트 계정 입구는 WorldView가 빌드 조건으로만 불러온다(일반 배포 빌드에는 입구가 없다).
import { blobToImage, canvasToBlob, cutoutCanvas, drawToCanvas, removeBackground, DISPLAY_SIDE, WORK_SIDE } from './cutout';
import { DEFAULT_AVATAR, normalizeAvatar, type AvatarConfig } from './avatar';
import { isThemeId, type ThemeId } from './themes';
import { isDecorItem, type DecorItem } from './decor';
import { isStyle, type MuseumStyle } from '../character/names';
import { localToday } from '@/app/localDate';

export const MAX_FILE = 20 * 1024 * 1024;

export interface Account { id: string; guardian: string; child: string; childAge: number; createdAt: number }

export interface Artwork {
  id: string;
  familyId?: string;
  no: number;
  title: string;
  kind: 'drawing' | 'making';
  subject: string;
  material: string;
  age: number;
  madeOn: string;
  words: string;
  original: Blob;
  display: Blob;
  cutout: Blob | null;
  /** 서버 판에서 걸린 부조의 깊이(마스터플랜 3-6). 없으면 컷아웃으로 두께판을 만든다 */
  depth?: Blob | null;
  sample: boolean;
  createdAt: number;
  /** 화면용 사본만 돌리는 각도(0·90·180·270). 원본은 돌리지 않는다(§2-15) */
  rotation?: number;
  /** 올린 뒤 배경 지우기(§2-22): pending 처리 전 · done 사본 있음 · none 배경 못 찾음. 값이 없는 기존 작품은 다시 처리하지 않는다(§2-18) */
  cutoutState?: CutoutState;
}
export type CutoutState = 'pending' | 'done' | 'none';

/** 나이를 모름(§2-15). 업로드 기본값이며 "새로 온 작품" 방에 건다 */
export const UNSORTED_AGE = 0;

/** featured: 가족이 고른 대표작 ID(§2-14). 이 가족 화면에만 쓰고 친구 방문 자료에 넣지 않는다 */
export interface Prefs { avatar: AvatarConfig; avatarImage: Blob | null; theme: ThemeId; sound: boolean; building?: MuseumStyle; interior?: 'gallery' | 'cathedral'; featured?: string | null; decor?: DecorItem[] }

const DB = 'uam-world';
const STORES = ['account', 'artworks', 'rooms', 'prefs','meta','social','drafts'] as const;
type StoreName = (typeof STORES)[number];

let dbp: Promise<IDBDatabase> | null = null;
function db(): Promise<IDBDatabase> {
  if (dbp) return dbp;
  dbp = new Promise((res, rej) => {
    let req: IDBOpenDBRequest;
    try { req = indexedDB.open(DB, 3); } catch (e) { rej(e); return; }
    req.onupgradeneeded = () => {
      const d = req.result;
      for (const s of STORES) if (!d.objectStoreNames.contains(s)) d.createObjectStore(s, s === 'artworks' ? { keyPath: 'id' } : undefined);
      const upgrade=req.transaction!;const account=upgrade.objectStore('account');const old=account.get('main');
      old.onsuccess=()=>{const a=old.result as Account|undefined;if(!a)return;account.put(a,a.id);account.delete('main');upgrade.objectStore('meta').put(a.id,'active');
        for(const name of ['rooms','prefs']){const store=upgrade.objectStore(name),r=store.get('main');r.onsuccess=()=>{if(r.result!==undefined)store.put(r.result,a.id);store.delete('main');};}
        const cursor=upgrade.objectStore('artworks').openCursor();cursor.onsuccess=()=>{const c=cursor.result;if(!c)return;c.update({...c.value,familyId:a.id});c.continue();};
      };
    };
    req.onsuccess = () => {req.result.onversionchange=()=>{req.result.close();dbp=null;};res(req.result);};
    req.onerror = () => rej(req.error ?? new Error('indexedDB'));
    req.onblocked = () => rej(new Error('indexedDB blocked'));
  });
  dbp.catch(() => { dbp = null; });
  return dbp;
}

function tx<T>(store: StoreName, mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  return db().then((d) => new Promise<T | undefined>((res, rej) => {
    const t = d.transaction(store, mode);
    const s = t.objectStore(store);
    const r = run(s);
    let out: T | undefined;
    if (r) r.onsuccess = () => { out = r.result; };
    t.oncomplete = () => res(out);
    t.onerror = () => rej(t.error ?? new Error('tx'));
    t.onabort = () => rej(t.error ?? new Error('tx abort'));
  }));
}

const get = <T>(store: StoreName, key: IDBValidKey) => tx<T>(store, 'readonly', (s) => s.get(key) as IDBRequest<T>);
/** 한 거래 안에서 작품을 읽고, change가 새 값을 돌려줄 때만 쓴다(처리 중 사진 돌리기가 끼어도 새 값을 덮지 않는다) */
function updateArtworkIf(id: string, change: (a: Artwork) => Artwork | null): Promise<boolean> {
  return db().then((d) => new Promise<boolean>((resolve, reject) => {
    const t = d.transaction('artworks', 'readwrite'), s = t.objectStore('artworks'), r = s.get(id);
    let wrote = false;
    // 처리 함수 안에서 난 동기 오류(저장 공간 부족 등)도 거래를 되돌리고 부른 쪽에 알린다. 잡지 않으면 화면 밖 오류로 샌다
    r.onsuccess = () => { try { const next = r.result ? change(r.result as Artwork) : null; if (next) { s.put(next); wrote = true; } } catch (e) { t.abort(); reject(e); } };
    t.oncomplete = () => resolve(wrote); t.onerror = () => reject(t.error ?? new Error('tx')); t.onabort = () => reject(t.error ?? new Error('tx abort'));
  }));
}
const put = (store: StoreName, value: unknown, key?: IDBValidKey) => tx(store, 'readwrite', (s) => (key === undefined ? s.put(value) : s.put(value, key))).then(() => undefined);

export async function storageWorks(): Promise<boolean> {
  try { await db(); return true; } catch { return false; }
}

let selectedFamily: string | null = null;
export const activeFamily = async () => {
  if (selectedFamily) return selectedFamily;
  try { const id = sessionStorage.getItem('uam-world-family'); if (id) return id; } catch { /* Storage may be blocked independently of IndexedDB. */ }
  return (await get<string>('meta','active')) ?? 'main';
};
export const getAccount = async () => get<Account>('account',await activeFamily());
export const listFamilies = async () => ((await tx<Account[]>('account','readonly',s=>s.getAll()))??[]).filter(a=>a&&a.id);
export async function selectFamily(id:string){
  if(!await get<Account>('account',id))throw new Error('family missing');
  await put('meta',id,'active');selectedFamily=id;
  try { sessionStorage.setItem('uam-world-family',id); } catch { /* Keep this tab's selection in memory. */ }
}
export const saveAccount = (a:Account) => put('account',{id:a.id,guardian:a.guardian,child:a.child,childAge:a.childAge,createdAt:a.createdAt},a.id);
export async function getRooms(family?:string):Promise<number[]>{const r=await get<number[]>('rooms',family??await activeFamily());return Array.isArray(r)&&r.every(Number.isInteger)?r:[4,5,6,7];}
export const saveRooms=async(ages:number[])=>put('rooms',[...new Set(ages)].sort((a,b)=>a-b),await activeFamily());
export async function getPrefs(family?:string):Promise<Prefs>{const p=(await get<Partial<Prefs>>('prefs',family??await activeFamily()))??{};return {avatar:normalizeAvatar(p.avatar??DEFAULT_AVATAR),avatarImage:p.avatarImage instanceof Blob?p.avatarImage:null,theme:isThemeId(p.theme)?p.theme:'classic',sound:p.sound!==false,building:isStyle(p.building)?p.building:'column_temple',interior:p.interior==='cathedral'?'cathedral':'gallery',featured:typeof p.featured==='string'?p.featured:null,decor:Array.isArray(p.decor)?p.decor.filter(isDecorItem):[]};}
export const savePrefs=async(p:Prefs)=>put('prefs',{avatar:{...p.avatar,...(p.avatar.joints?{joints:JSON.parse(JSON.stringify(p.avatar.joints))}:{})},avatarImage:p.avatarImage,theme:p.theme,sound:p.sound,building:p.building??'column_temple',interior:p.interior==='cathedral'?'cathedral':'gallery',featured:typeof p.featured==='string'?p.featured:null,decor:(p.decor??[]).filter(isDecorItem).map(d=>({id:d.id,kind:d.kind,work:d.work,spot:d.spot}))},await activeFamily());
export async function listArtworks(family?:string):Promise<Artwork[]>{const id=family??await activeFamily();const all=(await tx<Artwork[]>('artworks','readonly',s=>s.getAll()))??[];return all.filter(a=>a.familyId===id).sort((a,b)=>a.no-b.no);}
export const putArtwork=async(a:Artwork)=>put('artworks',{...a,familyId:await activeFamily()});
/** Artwork and its room commit together. Reusing the same id makes retries idempotent. */
export async function saveArtworkAndRoom(a:Artwork,opts:{clearDraft?:boolean}={}){
 const familyId=await activeFamily(),d=await db();
 return new Promise<void>((resolve,reject)=>{
  const t=d.transaction(opts.clearDraft?['artworks','rooms','drafts']:['artworks','rooms'],'readwrite');
  t.oncomplete=()=>resolve();t.onerror=()=>reject(t.error??new Error('save failed'));t.onabort=()=>reject(t.error??new Error('save aborted'));
  try{
   t.objectStore('artworks').put({...a,familyId});
   if(opts.clearDraft)t.objectStore('drafts').delete(familyId);
   const rooms=t.objectStore('rooms'),q=rooms.get(familyId);
   q.onsuccess=()=>{try{rooms.put([...new Set([...(Array.isArray(q.result)?q.result:[]),a.age])].sort((x,y)=>x-y),familyId);}catch(e){t.abort();reject(e);}};
  }catch(e){t.abort();reject(e);}
 });
}
/** 함께 그리기 초안(§2-9 drafts, §2-11). 가족마다 하나. 작품이 아니며 보관 성공 때 같은 거래에서 지운다. */
export interface DrawDraft { id:string; strokes:Array<{color:string;width:number;points:Array<[number,number]>}>; turn:number; updatedAt:number }
export async function getDraft():Promise<DrawDraft|undefined>{const d=await get<DrawDraft>('drafts',await activeFamily());return d&&typeof d.id==='string'&&Array.isArray(d.strokes)?d:undefined;}
export async function saveDraft(d:DrawDraft){await put('drafts',JSON.parse(JSON.stringify(d)),await activeFamily());}
export async function deleteDraft(){const family=await activeFamily();await tx('drafts','readwrite',s=>{s.delete(family);});}
export type ArtworkInfo=Pick<Artwork,'title'|'age'|'madeOn'|'words'|'material'|'kind'|'subject'>;
/** 지금 기록에 정보 칸만 바꾼 작품(§2-22 검토 2). 화면용 사본·배경 지운 사본·처리 상태·각도는 지금 기록 그대로 */
export function withInfo(now:Artwork,info:ArtworkInfo):Artwork{return {...now,...info,title:info.title.trim().slice(0,40),material:info.material.trim().slice(0,20),words:info.words.slice(0,200)};}
/** 작품 정보 저장. 한 거래 안에서 지금 기록을 읽어 정보 칸만 바꾸고 그 나이 전시실도 함께 적는다(그 사이 끝난 배경 지우기·돌리기를 덮지 않는다) */
export async function updateArtworkInfo(id:string,info:ArtworkInfo){
 if(!Number.isInteger(info.age)||info.age<UNSORTED_AGE||info.age>13)throw new Error('invalid age');
 const family=await activeFamily(),d=await db();
 return new Promise<void>((resolve,reject)=>{
  const t=d.transaction(['artworks','rooms'],'readwrite');let denied=false;
  t.oncomplete=()=>denied?reject(new Error('not owner')):resolve();t.onerror=()=>reject(t.error??new Error('save failed'));t.onabort=()=>reject(t.error??new Error('save aborted'));
  const s=t.objectStore('artworks'),g=s.get(id);
  // 처리 함수 안의 동기 오류(저장 공간 부족 등)는 거래를 되돌리고 부른 쪽에 알린다(saveArtworkAndRoom과 같은 처리)
  g.onsuccess=()=>{
   try{
    const a=g.result as Artwork|undefined;if(!a||a.familyId!==family){denied=true;return;}
    s.put(withInfo(a,info));
    const rooms=t.objectStore('rooms'),q=rooms.get(family);
    q.onsuccess=()=>{try{rooms.put([...new Set([...(Array.isArray(q.result)?q.result:[]),info.age])].sort((x,y)=>x-y),family);}catch(e){t.abort();reject(e);}};
   }catch(e){t.abort();reject(e);}
  };
 });
}
/** 백업 가져오기(§2-19): 다른 가족 작품을 덮어쓰지 않도록 가족과 상관없이 같은 ID가 있는지 본다 */
export async function hasArtwork(id:string){return !!(await get<Artwork>('artworks',id));}
/** 앱을 열 때 브라우저에 저장 공간 유지를 요청한다(§2-19 기준 1). 거절·미지원이어도 앱은 그대로 동작한다. null = 이 브라우저는 묻는 방법이 없다(§2-22 저장 상태) */
export async function keepStorage():Promise<boolean|null>{try{const s=navigator.storage;if(!s?.persist)return null;return (await s.persisted?.())||await s.persist();}catch{return null;}}
/** 가족마다 기기 안에 두는 작은 기록(§2-22: 마지막 백업, 사용 기록). 숫자만 담는다 */
const metaKey = async (kind: 'backup' | 'usage') => `${kind}:${await activeFamily()}`;
export interface BackupMark { lastAt?: number; laterAt?: number }
export async function getBackupMark(): Promise<BackupMark> { const m = await get<BackupMark>('meta', await metaKey('backup')); return { ...(typeof m?.lastAt === 'number' ? { lastAt: m.lastAt } : {}), ...(typeof m?.laterAt === 'number' ? { laterAt: m.laterAt } : {}) }; }
/** done = 백업 파일을 내보냄, later = 권유 줄에서 [나중에] */
export async function markBackup(kind: 'done' | 'later', now = Date.now()) { const m = await getBackupMark(); await put('meta', kind === 'done' ? { ...m, lastAt: now } : { ...m, laterAt: now }, await metaKey('backup')); }
export async function getUsageRecord(): Promise<unknown> { return get<unknown>('meta', await metaKey('usage')); }
export async function putUsageRecord(u: unknown) { await put('meta', u, await metaKey('usage')); }
/** 저장 공간 부족 오류인지(§2-19 기준 5) */
export function isQuotaError(e:unknown){const n=(e as {name?:string}|null)?.name;return n==='QuotaExceededError'||n==='NS_ERROR_DOM_QUOTA_REACHED';}
export async function deleteArtwork(id:string){const a=await get<Artwork>('artworks',id);if(a?.familyId!==await activeFamily())throw new Error('not owner');await tx('artworks','readwrite',s=>s.delete(id));}
export interface SocialData { links:Array<[string,string]>; invites:Array<{id:string;owner:string;token:string;expiresAt:number;used:boolean}> }
export function socialTransaction<T>(run:(state:SocialData)=>T,write=true):Promise<T>{return db().then(d=>new Promise<T>((resolve,reject)=>{const t=d.transaction('social',write?'readwrite':'readonly'),s=t.objectStore('social'),r=s.get('main');let result:T;r.onsuccess=()=>{try{const state:SocialData=r.result??{links:[],invites:[]};result=run(state);if(write)s.put(state,'main');}catch(e){t.abort();reject(e);}};t.oncomplete=()=>resolve(result!);t.onerror=()=>reject(t.error);t.onabort=()=>reject(t.error??new Error('storage aborted'));}));}

export async function clearAll() {
  selectedFamily = null;
  try { sessionStorage.removeItem('uam-world-family'); } catch { /* IndexedDB can still be cleared. */ }
  for (const s of STORES) await tx(s, 'readwrite', (o) => o.clear());
}

export function newId() {
  return (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`).replace(/-/g, '').slice(0, 20);
}

// ───────────── 사진 처리 ─────────────

export interface Processed { display: Blob; cutout: Blob | null; maskOk: boolean; previewUrl: string }

/** 원본은 건드리지 않는다. 화면용 축소본과(원하면) 배경 지운 그림을 따로 만든다. */
export async function processImage(file: Blob, removeBg: boolean, rotation = 0): Promise<Processed> {
  const img = await blobToImage(file);
  const display = rotateCanvas(drawToCanvas(img, DISPLAY_SIDE), rotation);
  const isPng = file.type === 'image/png' || file.type === 'image/svg+xml';
  const displayBlob = await canvasToBlob(display, isPng ? 'image/png' : 'image/jpeg', 0.9);
  let cutout: Blob | null = null;
  let maskOk = false;
  let preview = display;
  if (removeBg) {
    const work = rotateCanvas(drawToCanvas(img, WORK_SIDE), rotation);
    const mask = removeBackground(work);
    maskOk = mask.ok;
    if (mask.ok) {
      const cut = cutoutCanvas(display, mask);
      cutout = await canvasToBlob(cut, 'image/png');
      preview = cut;
    }
  }
  return { display: displayBlob, cutout, maskOk, previewUrl: preview.toDataURL('image/png') };
}

/** 화면용 캔버스를 90°씩 돌린 새 캔버스. 0이면 그대로 */
export function rotateCanvas(c: HTMLCanvasElement, rotation: number): HTMLCanvasElement {
  const r = ((Math.round(rotation / 90) % 4) + 4) % 4;
  if (!r) return c;
  const out = document.createElement('canvas');
  out.width = r % 2 ? c.height : c.width; out.height = r % 2 ? c.width : c.height;
  const ctx = out.getContext('2d')!;
  ctx.translate(out.width / 2, out.height / 2); ctx.rotate(r * Math.PI / 2); ctx.drawImage(c, -c.width / 2, -c.height / 2);
  return out;
}

/** 사진 돌리기 방향(§2-23 B): 지금 각도에서 오른쪽(1)·왼쪽(-1)으로 90°. 결과는 0·90·180·270 */
export const turned = (current: number, dir: 1 | -1) => ((((Math.round(current / 90) + dir) % 4) + 4) % 4) * 90;

/** 원본에서 화면용 사본을 다시 만든다(§2-15 사진 돌리기). 원본·ID·이야기는 그대로 두고, 배경 지운 사본은 방향이 달라지므로 비우고 다시 만들 차례로 둔다(§2-22) */
export async function setRotation(id: string, rotation: number) {
  const family = await activeFamily(), a = await get<Artwork>('artworks', id);
  if (!a || a.familyId !== family) throw new Error('not owner');
  const r = ((Math.round(rotation / 90) % 4) + 4) % 4 * 90;
  const p = await processImage(a.original, false, r);
  // §2-22 검토 2: 사본을 만드는 동안 저장된 나이·주제·이야기를 덮지 않게, 한 거래 안에서 지금 기록을 읽어 돌리기 네 칸만 바꾼다
  if (!(await updateArtworkIf(id, (now) => (now.familyId === family ? withRotation(now, p.display, r) : null)))) throw new Error('not owner');
}
/** 돌린 작품(§2-22 검토 2): 화면용 사본·배경 지운 사본(비움)·처리 상태(다시 만들 차례)·각도만 바꾼다 */
export function withRotation(now: Artwork, display: Blob, rotation: number): Artwork {
  return { ...now, display, cutout: null, cutoutState: 'pending', rotation };
}

/** 배경 지우기 결과를 붙인 작품(§2-22). 처리를 시작할 때와 방향이 같고 아직 처리 전일 때만. 원본·ID·화면용 사본은 그대로 둔다 */
export function withCutout(now: Artwork, rotationAtStart: number, cutout: Blob | null): Artwork | null {
  if (now.cutoutState !== 'pending' || (now.rotation ?? 0) !== rotationAtStart) return null;
  return { ...now, cutout, cutoutState: cutout ? 'done' : 'none' };
}
/** 배경 지우기 시도 열쇠(§2-22 검토 8): 작품과 방향을 함께 센다. 사진을 돌리면 새 방향은 처음부터 센다 */
export const cutoutTry = (a: Pick<Artwork, 'id' | 'rotation'>) => `${a.id}:${a.rotation ?? 0}`;
/** 배경 지우기 한 번의 결과(§2-22). done = 윤곽 입체로 바뀜, none = 배경을 못 찾아 두께판, moved = 처리하는 동안 사진을 돌려 이 결과를 버림(새 방향으로 다시 한다), skip = 처리할 것이 없음 */
export type CutoutResult = 'done' | 'none' | 'moved' | 'skip';
/** 올린 뒤 같은 기기에서 배경 지우기(§2-22) */
export async function makeCutout(id: string): Promise<CutoutResult> {
  const family = await activeFamily(), a = await get<Artwork>('artworks', id);
  if (!a || a.familyId !== family || a.cutoutState !== 'pending') return 'skip';
  const rotation = a.rotation ?? 0;
  let cutout: Blob | null = null;
  try { cutout = (await processImage(a.original, true, rotation)).cutout; } catch { /* 열지 못한 원본은 두께판으로 둔다(설계도 7-4의 2번) */ }
  let moved = false;
  const wrote = await updateArtworkIf(id, (now) => {
    if (now.familyId !== family) return null;
    if (now.cutoutState === 'pending' && (now.rotation ?? 0) !== rotation) { moved = true; return null; }
    return withCutout(now, rotation, cutout);
  });
  return wrote ? (cutout ? 'done' : 'none') : moved ? 'moved' : 'skip';
}

/** 배경 지우기 차례(§2-22 1~3, 검토 8). 처리 전 작품을 한 장씩 처리하고 끝날 때마다 after(다시 그리기)를 부른다.
 *  같은 작품·방향은 tries번까지 한다. 처리하는 동안 사진을 돌려 버린 시도(moved)는 세지 않는다(오가며 돌려도 처리 전으로 남지 않게).
 *  after가 false를 주면 멈추고, make가 실패하면 그대로 던진다(부른 쪽이 다음에 열 때 다시 한다) */
export async function cutoutQueue(o: { pending: () => Pick<Artwork, 'id' | 'rotation'>[]; make: (id: string) => Promise<CutoutResult>; after: () => Promise<boolean>; tries: number }) {
  const tried = new Map<string, number>();
  for (;;) {
    const next = o.pending().find((a) => (tried.get(cutoutTry(a)) ?? 0) < o.tries);
    if (!next) return;
    const key = cutoutTry(next), result = await o.make(next.id);
    if (result !== 'moved') tried.set(key, (tried.get(key) ?? 0) + 1);
    if (!(await o.after())) return;
  }
}

/** 원본 바이트의 SHA-256(중복 확인용) */
export async function sha256(blob: Blob): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return Array.from(new Uint8Array(d)).map((n) => n.toString(16).padStart(2, '0')).join('');
}

/** 새 가족이 받는 값. 가족이 없을 때 시작 화면도 이 값으로 그려 시작 뒤 모드가 바뀌지 않게 한다(§2-17) */
export const NEW_FAMILY_THEME: ThemeId = 'forest';
export const NEW_FAMILY_CHILD = '우리 아이';

/** 이 기기 가족(§2-15 첫 화면). 로그인 없이 브라우저에만 저장한다. 이름·나이는 묻지 않는다. 새 가족의 기본 모드는 숲 마을 */
export async function createLocalFamily(withSamples: boolean, onStep?: (done: number, total: number) => void): Promise<Account> {
  const acc: Account = { id: newId(), guardian: '', child: NEW_FAMILY_CHILD, childAge: UNSORTED_AGE, createdAt: Date.now() };
  await saveAccount(acc);
  await selectFamily(acc.id);
  await saveRooms(withSamples ? [4, 5, 6, 7] : []);
  await savePrefs({ avatar: DEFAULT_AVATAR, avatarImage: null, theme: NEW_FAMILY_THEME, sound: true });
  if (withSamples) await addSamples(onStep);
  return acc;
}

// ───────────── 테스트 계정과 견본 ─────────────

interface SampleDef { file: string; base: string; title: string; subject: string; kind: 'drawing' | 'making'; age: number; material: string }

const TEAM = '/museum/sample/';
const MINE = '/museum/world/samples/';
/** 견본: 팀이 코드로 그린 SVG 13점 + 호랑이 1점(개인 확장). 실제 아이 그림이 아니다. */
export const SAMPLES: SampleDef[] = [
  { file: 'tiger.svg', base: MINE, title: '어흥 호랑이', subject: 'tiger', kind: 'drawing', age: 4, material: '크레파스' },
  { file: 'house-sun.svg', base: TEAM, title: '해님 아래 우리 집', subject: 'house', kind: 'drawing', age: 5, material: '' },
  { file: 'family.svg', base: TEAM, title: '우리 가족 소풍', subject: 'family', kind: 'drawing', age: 5, material: '' },
  { file: 'cat.svg', base: TEAM, title: '낮잠 자는 고양이', subject: 'cat', kind: 'drawing', age: 5, material: '' },
  { file: 'snowman.svg', base: TEAM, title: '눈사람 친구', subject: 'snowman', kind: 'drawing', age: 5, material: '' },
  { file: 'rainbow.svg', base: TEAM, title: '비 온 뒤 무지개', subject: 'rainbow', kind: 'drawing', age: 6, material: '' },
  { file: 'garden.svg', base: TEAM, title: '꽃밭에 나비', subject: 'flower', kind: 'drawing', age: 6, material: '' },
  { file: 'rocket.svg', base: TEAM, title: '달나라 가는 로켓', subject: 'rocket', kind: 'drawing', age: 6, material: '' },
  { file: 'balloon.svg', base: TEAM, title: '하늘로 풍선', subject: 'balloon', kind: 'drawing', age: 6, material: '' },
  { file: 'fish.svg', base: TEAM, title: '바닷속 친구들', subject: 'fish', kind: 'drawing', age: 7, material: '' },
  { file: 'tree.svg', base: TEAM, title: '사과나무', subject: 'tree', kind: 'drawing', age: 7, material: '' },
  { file: 'car.svg', base: TEAM, title: '빨간 자동차', subject: 'car', kind: 'drawing', age: 7, material: '' },
  { file: 'clay-bear.svg', base: TEAM, title: '찰흙 곰 인형', subject: 'bear', kind: 'making', age: 6, material: '찰흙' },
  { file: 'paper-robot.svg', base: TEAM, title: '종이 상자 로봇', subject: 'robot', kind: 'making', age: 7, material: '종이 상자' },
];

export async function addSamples(onStep?: (done: number, total: number) => void): Promise<number> {
  const existing = await listArtworks();
  let no = existing.reduce((m, a) => Math.max(m, a.no), 0);
  let added = 0;
  for (const [i, s] of SAMPLES.entries()) {
    try {
      const res = await fetch(s.base + s.file);
      if (!res.ok) continue;
      const original = new Blob([await res.blob()], { type: 'image/svg+xml' });
      const p = await processImage(original, true);
      await putArtwork({
        id: newId(), no: ++no, title: s.title, kind: s.kind, subject: s.subject, material: s.material, age: s.age,
        madeOn: '', words: '', original, display: p.display, cutout: p.cutout, sample: true, createdAt: Date.now() + i,
      });
      added++;
    } catch { /* 견본 하나가 실패해도 나머지는 넣는다 */ }
    onStep?.(i + 1, SAMPLES.length);
  }
  return added;
}

export async function removeSamples() {
  for (const a of await listArtworks()) if (a.sample) await deleteArtwork(a.id);
}

export async function createTestAccount(onStep?: (done: number, total: number) => void): Promise<Account> {
  const acc: Account = { id: newId(), guardian: '테스트 보호자', child: '하늘', childAge: 6, createdAt: Date.now() };
  await saveAccount(acc);
  await selectFamily(acc.id);
  await saveRooms([4, 5, 6, 7]);
  await savePrefs({ avatar: DEFAULT_AVATAR, avatarImage: null, theme: 'classic', sound: true });
  await addSamples(onStep);
  return acc;
}

export function today() { return localToday(); }
