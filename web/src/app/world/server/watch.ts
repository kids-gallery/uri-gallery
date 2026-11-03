// 3D 화면 작품 상태 묻기(마스터플랜 3-3, 3-5 5번, #37). 진행 중인 작품만 묻고, 통신 실패를 창에 넘긴다.
// - 간격과 숨긴 탭은 /app과 같은 usePolling(3→6→10초)이 맡는다.
// - 묻는 작품은 이 화면의 메모리에만 둔다. 서버 목록으로 다시 읽는 일은 #40.
import { getCurrentScope, onScopeDispose, ref, shallowRef } from 'vue';
import { usePolling } from '@/composables/usePolling';
import { failureOf, getArtwork, type ArtworkDetail, type Failure } from './index';

const ACTIVE = new Set<string>(['waiting', 'running', 'retrying']);

/** state가 아니라 stages로 본다. 원본 액자가 걸린 작품은 판정 중에도 state가 exhibited이고, choices가 있어도 컷아웃은 아직 오는 중일 수 있다 */
export const isMoving = (a: Pick<ArtworkDetail, 'stages'>) => a.stages.some((s) => ACTIVE.has(s.status));

export function useArtworkWatch() {
  /** 받은 상세. 창(#38·#39)과 입체 교체(#40)가 쓴다 */
  const details = shallowRef(new Map<string, ArtworkDetail>());
  const failure = ref<Failure | null>(null);
  const retrying = ref(false);
  const watching = new Set<string>();
  let round = 0;
  let left = false; // 화면을 벗어나면 다시 묻지 않는다
  let unread: { list: () => Promise<string[]>; failure: Failure } | null = null; // 못 읽은 서버 목록. 다시 시도 때 또 읽는다

  async function ask(): Promise<boolean> {
    const mine = ++round;
    const ids = [...watching];
    const res = await Promise.allSettled(ids.map(getArtwork));
    if (mine !== round) return watching.size > 0; // 다시 시도·로그아웃 뒤에 도착한 옛 응답은 버린다
    const next = new Map(details.value);
    const fails: Failure[] = unread ? [unread.failure] : [];
    res.forEach((r, i) => {
      const id = ids[i]!;
      if (r.status === 'fulfilled') {
        next.set(id, r.value);
        if (!isMoving(r.value)) watching.delete(id);
        return;
      }
      const f = failureOf(r.reason);
      fails.push(f);
      if (f.kind === 'refused') watching.delete(id); // 같은 요청을 되풀이해도 안 된다(지워진 작품 등)
    });
    details.value = next;
    failure.value = fails.find((f) => f.kind === 'login') ?? fails.find((f) => f.kind === 'offline') ?? fails[0] ?? null;
    return watching.size > 0 && failure.value?.kind !== 'login'; // 로그인이 풀리면 다시 로그인할 때까지 묻지 않는다
  }

  const poll = usePolling(ask);

  function add(ids: string[]) {
    if (left) return;
    for (const id of ids) watching.add(id);
    if (watching.size) poll.start();
  }

  /** 새로 고침(#40): 서버 목록의 작품을 묻기에 더한다. 못 읽으면 안내를 띄운다 */
  async function resume(list: () => Promise<string[]>) {
    try {
      const ids = await list();
      unread = null;
      add(ids);
    } catch (e) {
      if (left) return;
      unread = { list, failure: failureOf(e) };
      failure.value = unread.failure;
    }
  }

  /** 버튼: 기다리지 않고 바로 묻는다. 물을 작품이 없으면 안내만 닫는다 */
  async function retry() {
    if (retrying.value) return;
    retrying.value = true;
    poll.stop();
    try {
      if (unread) await resume(unread.list);
      if (await ask()) poll.start();
    } finally {
      retrying.value = false;
    }
  }

  /** 로그아웃(#30): 다른 가족의 작품이 남지 않게 모두 지운다 */
  function clear() {
    round++;
    poll.stop();
    watching.clear();
    unread = null;
    details.value = new Map();
    failure.value = null;
  }

  // usePolling은 타이머만 멈춘다. 다시 시도를 기다리는 중에 화면을 벗어나면 그 뒤의 poll.start()까지 막아야 한다(watching이 비어 ask가 false를 돌려준다)
  if (getCurrentScope()) onScopeDispose(() => { left = true; clear(); });
  return { details, failure, retrying, add, resume, retry, clear };
}
