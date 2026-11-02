// 3D 화면 사진 올리기(마스터플랜 3-3, #31). 사진을 서버로 보내고 받은 원본 액자를 화면에 건다.
// - 한 빌드는 한 저장소만 쓴다: VITE_WORLD_SERVER=1이면 서버 판, 아니면 기기 판. 서버에 닿지 않아도 기기 저장으로 바꾸지 않는다.
// - 걸린 작품은 이 화면의 메모리에만 둔다. 서버 목록으로 다시 읽는 일은 #40.
import { ref } from 'vue';
import { ApiError } from '@/api/client';
import { problemCopy } from '@/copy/ko';
import * as store from '../store';
import { failureOf, failureReason, listChildren, uploadArtwork, type ArtworkDetail } from './index';

export const SERVER_WORLD = import.meta.env.VITE_WORLD_SERVER === '1';

/** #36의 아이 고르기가 정한다. 없으면 아이가 1명일 때만 그 아이로 올린다 */
export const selectedChild = ref<string | null>(null);

const TYPES = /^image\/(jpeg|png|hei[cf])$/i, EXT = /\.(jpe?g|png|hei[cf])$/i;

/** 서버가 UUID만 받는다. crypto.randomUUID는 https·localhost에서만 있어 http://<IP>:9501(#41)에서는 쓸 수 없다 */
export function newUploadKey(): string {
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6]! & 0x0f) | 0x40;
  b[8] = (b[8]! & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** 올리기 전 안내. 통과해도 서버가 내용을 다시 검사한다(깨진 사진은 서버 이유 문장으로) */
export function checkPhoto(f: File): string | null {
  if (!f.size) return '빈 파일이에요';
  if (f.size > store.MAX_FILE) return '사진이 너무 커요(한 장 20MB까지)';
  if (!TYPES.test(f.type) && !EXT.test(f.name)) return problemCopy({ gate: 'G5', reason: 'format' }).reason;
  return null;
}

export type SendResult = { ok: true; id: string; hung: boolean } | { ok: false; reason: string; retryable: boolean };

const hung = new Map<string, store.Artwork>();
let generation = 0;
/** 로그아웃·만료 시 이전 가족의 작품과 선택을 버린다. 진행 중 응답도 무효다. */
export function clearWorldWorks() { generation++; hung.clear(); selectedChild.value = null; }

/** 3D 화면에 그릴 작품. 서버 판은 기기 저장소의 작품을 섞지 않는다 */
export const worldWorks = async (): Promise<store.Artwork[]> => (SERVER_WORLD ? [...hung.values()] : store.listArtworks());

/** key는 사진마다 하나다. 다시 시도할 때 같은 key를 넘겨야 작품이 두 번 생기지 않는다 */
export async function sendPhoto(file: File, key: string): Promise<SendResult> {
  const current = generation;
  let detail: ArtworkDetail;
  try {
    const list = await listChildren();
    const childId = list.find((c) => c.id === selectedChild.value)?.id ?? (list.length === 1 ? list[0]!.id : null);
    if (!childId) return { ok: false, reason: list.length ? '어느 아이의 작품인지 먼저 골라 주세요' : '아이를 먼저 등록해 주세요', retryable: true };
    detail = await uploadArtwork(childId, file, key);
  } catch (e) {
    const f = failureOf(e);
    return { ok: false, reason: failureReason(f), retryable: f.kind !== 'refused' || (e instanceof ApiError && e.code === 'not_saved') };
  }
  if (current !== generation) return { ok: false, reason: '로그인이 바뀌었어요. 다시 로그인해 주세요', retryable: true };
  const displayed = await hang(detail, current);
  if (current !== generation) return { ok: false, reason: '로그인이 바뀌었어요. 다시 로그인해 주세요', retryable: true };
  return { ok: true, id: detail.id, hung: displayed };
}

/** 서버에 보관된 사진으로 원본 액자를 건다. 배경 분리는 서버 몫이라 cutoutState를 두지 않는다. 화면이 그리지 못해도 보관은 끝났으므로 실패로 돌려주지 않는다 */
async function hang(d: ArtworkDetail, current: number): Promise<boolean> {
  if (hung.has(d.id)) return true;
  try {
    const res = await fetch(d.photoUrl ?? '', { credentials: 'same-origin' });
    if (!res.ok) return false;
    const original = await res.blob();
    const { display } = await store.processImage(original, false);
    await store.saveRooms([...await store.getRooms(), store.UNSORTED_AGE]);
    if (current !== generation) return false;
    hung.set(d.id, {
      id: d.id, no: hung.size + 1, title: d.story?.title ?? '', kind: d.making ? 'making' : 'drawing', subject: 'etc', material: '',
      age: store.UNSORTED_AGE, madeOn: d.story?.madeOn ?? '', words: '', original, display, cutout: null,
      sample: false, createdAt: Date.now(), rotation: 0,
    });
    return true;
  } catch {
    return false;
  }
}
