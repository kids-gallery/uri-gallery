// 3D 화면 전시 목록(마스터플랜 3-3, #40). 서버 판은 GET /v1/gallery에 있는 작품만 건다.
// - 컷아웃은 승인되어 걸린 부조(kind가 relief)의 auxUrl만 쓴다. 판정 중에도 오는 상세의 cutoutUrl은 쓰지 않는다.
// - 파일은 작품마다 메모리에 두고, 결과 종류가 바뀔 때만 다시 받는다.
// - 깊이는 VITE_RELIEF_DEPTH=1로 빌드했을 때만 받는다(마스터플랜 3-6).
// - 사진을 받으면 작품은 사라지지 않는다. 깊이를 못 받으면 두께판, 컷아웃을 못 받으면 액자로 건다(마스터플랜 3-3).
import { ref } from 'vue';
import { exhibitBlob } from '../exhibit';
import * as store from '../store';
import { failureOf, gallery, listArtworks, listChildren, type ArtworkDetail, type Failure, type Gallery } from './index';

type Item = Gallery['groups'][number]['items'][number];

const RELIEF_DEPTH_ON = import.meta.env.VITE_RELIEF_DEPTH === '1';
/** 만들기는 받침대의 동상이므로 빌드 값과 상관없이 깊이로 둥근 입체를 만든다(#133) */
const wantsDepth = (item: Item) => item.kind === 'relief' && (RELIEF_DEPTH_ON || item.making);
const shown = new Map<string, { work: store.Artwork; kind: string; childId: string }>();
/** 로그아웃하면 늘어난다. 그 전에 시작한 요청의 결과는 버린다 */
let epoch = 0;

/** 목록을 읽지 못했을 때. 보던 작품은 그대로 두고 화면이 알린다 */
export const galleryFailure = ref<Failure | null>(null);

async function file(url: string): Promise<Blob> {
  const res = await fetch(url, { credentials: 'same-origin' });
  if (!res.ok) throw new Error(`file ${res.status}`);
  return res.blob();
}

/** 원본에서 화면용 사본을 만든다. 배경 분리는 서버 몫이라 cutoutState를 두지 않는다 */
async function photoWork(id: string, photoUrl: string, making = false): Promise<store.Artwork> {
  const original = await file(photoUrl);
  const { display } = await store.processImage(original, false);
  return {
    id, no: 0, title: '', kind: making ? 'making' : 'drawing', subject: 'etc', material: '', age: store.UNSORTED_AGE, madeOn: '', words: '',
    original, display, cutout: null, sample: false, createdAt: Date.now(), rotation: 0,
  };
}

async function workOf(item: Item, no: number): Promise<store.Artwork> {
  const had = shown.get(item.id);
  const same = had?.kind === item.kind;
  // 전시용 판은 컷아웃으로 만들었다. 컷아웃이 걸렸던 작품의 결과가 바뀌면 판이 남지 않게 사진에서 다시 만든다
  const base = had && (same || !had.work.cutout) ? had.work : await photoWork(item.id, item.photoUrl ?? item.originalUrl ?? '');
  const orNull = (url: string) => file(url).catch(() => null); // 못 받으면 낮춰 걸고 load가 다시 받게 한다(마스터플랜 3-3)
  const cutout = same ? had.work.cutout : item.kind === 'relief' && item.auxUrl ? await orNull(item.auxUrl) : null;
  const depth = (same ? had.work.depth : null) ?? (wantsDepth(item) && cutout && item.primaryUrl ? await orNull(item.primaryUrl) : null);
  // 걸린 부조는 벽에 전시용 판을 건다. 못 만들면 자른 사진 그대로 둔다
  const display = cutout && !same ? await exhibitBlob(cutout).catch(() => base.display) : base.display;
  return {
    ...base, display, no, title: item.title, kind: item.making ? 'making' : 'drawing', age: item.ageAtMaking ?? store.UNSORTED_AGE,
    madeOn: item.madeOn, words: item.childWords ?? '', cutout, depth, cutoutState: cutout ? 'done' : undefined,
  };
}

/** 받지 못한 파일이 있는 작품 수를 돌려준다 */
async function load(entries: { item: Item; childId: string }[], mine: number): Promise<number> {
  let missed = 0;
  for (const [i, { item, childId }] of entries.entries()) {
    try {
      const work = await workOf(item, i + 1);
      if (mine !== epoch) return 0;
      const relief = item.kind === 'relief';
      const noCutout = relief && !!item.auxUrl && !work.cutout;
      const noDepth = wantsDepth(item) && !!work.cutout && !!item.primaryUrl && !work.depth;
      // 컷아웃이 없으면 보이는 것은 액자다. 걸린 결과와 달라 상태 묻기가 목록을 다시 읽는다
      shown.set(item.id, { work, kind: noCutout ? 'frame' : item.kind, childId });
      if (noCutout || noDepth) missed++; // 걸어 둔 채 새 주소로 한 번 더 받는다
    } catch {
      missed++; // 한 장 때문에 전시 전체가 비지 않게 한다(열 수 없는 사진 등)
    }
  }
  return missed;
}

/** 나이 전시실을 기기에 남긴다. 못 남겨도 전시는 그대로이고, 연결 실패도 아니다 */
async function saveRooms(works: store.Artwork[], mine: number) {
  try {
    const rooms = await store.getRooms();
    if (mine === epoch) await store.saveRooms([...rooms, ...works.map((a) => a.age)]);
  } catch { /* 다음에 읽을 때 다시 남긴다 */ }
}

export async function galleryWorks(childId: string | null): Promise<store.Artwork[]> {
  const mine = epoch;
  try {
    const children = childId ? [childId] : (await listChildren()).map((c) => c.id);
    const read = async () => (await Promise.all(children.map(gallery))).flatMap((g) => g.groups.flatMap((x) => x.items.map((item) => ({ item, childId: g.childId }))));
    let entries = await read();
    if (await load(entries, mine)) { entries = await read(); await load(entries, mine); } // 파일 주소는 5분 뒤 만료된다. 새 주소로 한 번 더 받는다
    if (mine !== epoch) return [];
    const ids = new Set(entries.map((x) => x.item.id));
    for (const id of shown.keys()) if (!ids.has(id)) shown.delete(id);
    const order = entries.flatMap((x) => shown.get(x.item.id)?.work ?? []);
    galleryFailure.value = null;
    await saveRooms(order, mine);
    return mine === epoch ? order : [];
  } catch (e) {
    if (mine !== epoch) return [];
    galleryFailure.value = failureOf(e);
    return [...shown.values()].filter((s) => !childId || s.childId === childId).map((s) => s.work); // 다른 아이의 작품을 대신 보이지 않는다
  }
}

/** 올리자마자 원본 액자를 건다. 화면이 그리지 못해도 보관은 끝났으므로 false만 돌려준다 */
export async function hangUploaded(d: ArtworkDetail, making = false): Promise<boolean> {
  if (shown.has(d.id)) return true;
  const mine = epoch;
  try {
    const work = await photoWork(d.id, d.photoUrl ?? '', making);
    if (mine !== epoch) return false;
    shown.set(d.id, { work, kind: 'frame', childId: d.childId });
    return true;
  } catch {
    return false;
  }
}

/** 걸린 결과가 지금 보이는 것과 다르면 목록을 다시 읽어야 한다. 조각은 공개 설정이 꺼져 있으면 액자로 내려온다(D10) */
export function isStale(d: ArtworkDetail): boolean {
  if (!d.exhibited) return false;
  const now = shown.get(d.id)?.kind, hung = d.hungResultKind ?? 'frame';
  return now !== hung && !(hung === 'sculpture' && now === 'frame');
}

/** 새로 고침 뒤 다시 읽을 작품. 확정·결정을 기다리는 작품은 진행 중이 아니어도 창을 열어야 한다. 끝난 작품은 한 번 읽고 묻기에서 빠진다. 못 읽으면 묻지 않을 뿐 전시는 그대로다 */
export const watchIds = (childId: string | null) => listArtworks().then((list) => list.filter((a) => !childId || a.childId === childId).map((a) => a.id));

/** 로그아웃(#30): 다른 가족의 작품이 남지 않게 지운다 */
export function clearGallery() {
  epoch++;
  shown.clear();
  galleryFailure.value = null;
}
