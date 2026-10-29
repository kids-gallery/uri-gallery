<script setup lang="ts">
// 휴대폰 실측 표시(3D미술관_재설계 §2-22 13). 개발 서버나 측정용 빌드(VITE_MEASURE=1)에서 주소에 ?measure가 있을 때만 WorldView가 불러온다. 일반 배포본에는 없다.
// 값과 계산은 measure.ts. 화면 왼쪽 가운데에 한 줄 단추로 뜬다: 휴대폰의 왼쪽 아래는 걷기 조이스틱·[시작하기]·첫 작품 안내([사진 고르기]) 자리라
// 측정하는 동안 눌러야 하므로 비운다. 단추를 누르면 값 전체와 [값 복사]·[프레임 재기]·[접기]가 펼쳐진다. 3D 화면은 이 상자 밖에서 그대로 눌린다.
import { computed, nextTick, ref } from 'vue';
import { FRAME_END, MARKS, pageInfo, report, sec, useMeasure } from './measure';

const COPY = { done: '복사했어요. 메모 앱에 붙여 넣어 주세요', manual: '자동으로 복사하지 못했어요. 아래 글 상자를 길게 눌러 [전체 선택] → [복사]를 눌러 주세요' } as const;
const m = useMeasure(), s = m.state;
const open = ref(false), note = ref(''), manual = ref(false), area = ref<HTMLTextAreaElement | null>(null);
const text = computed(() => report(s, pageInfo()).join('\n'));
/** 접혀 있을 때의 한 줄: 재는 중이면 남은 초, 아니면 가장 최근에 생긴 값 */
const latest = computed(() => {
  if (s.running) return `프레임 재는 중 ${s.running.left}초`;
  const items = [
    ...MARKS.flatMap((x) => { const t = s.marks[x.name]; return t === undefined ? [] : [{ t, label: `${x.label} ${sec(t)}` }]; }),
    ...s.frames.map((f) => ({ t: f.at, label: f.end === 'done' ? '프레임 다 쟀어요' : `프레임 ${FRAME_END[f.end]}` })),
  ].sort((a, b) => b.t - a.t);
  return `${s.reopen.reopened ? '다시 열림 · ' : ''}${items[0]?.label ?? '측정 준비'}`;
});

/** 걸으면서 잴 수 있게 펼친 상자를 접고 시작한다 */
function frames() { note.value = ''; open.value = false; m.startFrames('button'); }
/** 보안 연결(HTTPS·localhost)이 아니면 clipboard가 없다. 그때는 누른 순간 안에서 옛 방식 복사를 한 번 해 본다 */
function execCopy(t: string) {
  if (typeof document.execCommand !== 'function') return false;
  const el = document.createElement('textarea');
  el.value = t; el.readOnly = true; el.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
  document.body.append(el); el.select(); el.setSelectionRange(0, t.length);
  let ok = false;
  try { ok = document.execCommand('copy'); } catch { ok = false; }
  el.remove();
  return ok;
}
async function copy() {
  const t = report(s, pageInfo()).join('\n');
  manual.value = false;
  if (navigator.clipboard?.writeText) {
    try { await navigator.clipboard.writeText(t); note.value = COPY.done; return; } catch { /* 권한이 막히면 글 상자로 */ }
  } else if (execCopy(t)) { note.value = COPY.done; return; }
  manual.value = true; note.value = COPY.manual;
  await nextTick();
  const el = area.value;
  if (el) { el.value = t; el.focus(); el.select(); el.setSelectionRange(0, t.length); }
}
</script>

<template>
  <Teleport to="body">
    <section class="m-box" aria-label="측정 표시(개발용)">
      <button class="m-pill" type="button" :aria-expanded="open" @click="open = !open">측정 · {{ latest }}</button>
      <div v-if="open" class="m-panel">
        <div class="m-actions">
          <button type="button" @click="copy">값 복사</button>
          <button type="button" :disabled="!!s.running" @click="frames">{{ s.frames.length ? '프레임 다시 재기' : '프레임 재기' }}</button>
          <button type="button" @click="open = false">접기</button>
        </div>
        <p v-if="note" class="m-note" role="status">{{ note }}</p>
        <textarea v-if="manual" ref="area" class="m-copy" rows="6" readonly :value="text" aria-label="복사할 측정 값" />
        <pre class="m-lines">{{ text }}</pre>
      </div>
    </section>
  </Teleport>
</template>

<style scoped>
/* 개발용 표시라 제품 화면과 다르게 어두운 판으로 둔다. 흐림(backdrop-filter)은 휴대폰 GPU에 부담이라 쓰지 않는다 */
.m-box{position:fixed;z-index:1000;left:calc(env(safe-area-inset-left,0px) + 8px);top:50%;transform:translateY(-50%);display:grid;gap:6px;justify-items:start;max-width:min(340px,calc(100vw - 16px));
  font:13px/1.45 system-ui,-apple-system,"Apple SD Gothic Neo","Noto Sans KR",sans-serif;color:#fff;font-variant-numeric:tabular-nums}
.m-pill{min-height:44px;max-width:100%;padding:8px 14px;border-radius:999px;border:1px solid rgba(255,255,255,.4);background:rgba(20,18,16,.8);color:inherit;font:inherit;font-weight:600;text-align:left;cursor:pointer;touch-action:manipulation}
/* 버튼은 늘 위에 보이고 값 글만 스크롤한다. 펼친 동안은 화면 대부분을 써서 한 번에 캡처할 수 있게 한다 */
.m-panel{box-sizing:border-box;width:100%;max-height:86vh;max-height:min(86dvh,720px);display:flex;flex-direction:column;gap:8px;padding:10px 12px;border-radius:12px;border:1px solid rgba(255,255,255,.3);background:rgba(20,18,16,.88)}
.m-lines{flex:1 1 auto;min-height:0;overflow:auto;margin:0;white-space:pre-wrap;word-break:keep-all;overflow-wrap:anywhere;font:inherit}
.m-actions{display:flex;flex-wrap:wrap;gap:6px}
.m-actions button{min-height:44px;padding:6px 14px;border-radius:10px;border:1px solid rgba(255,255,255,.45);background:rgba(255,255,255,.14);color:#fff;font:inherit;font-weight:600;cursor:pointer;touch-action:manipulation}
.m-actions button:disabled{opacity:.5;cursor:default}
.m-pill:focus-visible,.m-actions button:focus-visible{outline:2px solid #fff;outline-offset:2px}
.m-note{margin:0;word-break:keep-all}
.m-copy{box-sizing:border-box;width:100%;flex:none;padding:6px;border-radius:8px;border:0;font:12px/1.4 ui-monospace,Menlo,monospace;color:#111;background:#fff}
</style>
