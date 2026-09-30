<script setup lang="ts">
// 움직임 질문(D49, SD_02 §17-9): 판정이 움직임을 제안한 그림이면 한 번 더 묻는다 — "애니메이션으로 만드시겠습니까?" [예] · [아니오].
// 대상 = 그림(making 아님) · suggestion animated · choices에 animated · 아직 확정 안 함. 판정이 아직이면 최대 30초 기다린다.
// [예] → POST confirm animated(원본 액자는 그대로 걸림, 확인 뒤 [좋아요]로 바꿔 건다) · [아니오] → 이 기기에서 그 작품은 다시 묻지 않는다.
// 같은 크기 · 같은 무게 · 기본 선택 없음(U10). overlay = 걸리는 장면 뒤 가운데 카드(장면이 끝날 때까지 조금 기다림), 아니면 작업대 안 카드.
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { api } from '@/api/client';
import { reducedMotion } from '@/composables/usePolling';
import { ko } from '@/copy/ko';

interface Detail { suggestion?: string | null; confirmedKind?: string | null; choices?: string[]; making?: boolean }
const props = defineProps<{ artworkId: string; overlay?: boolean }>();
const emit = defineEmits<{ close: []; started: [] }>();
const KEY = `uam.animAsk.${props.artworkId}`;
const WAIT_MS = 30000;
const phase = ref<'hidden' | 'judging' | 'ask' | 'started'>('hidden');
const busy = ref(false);
const msg = ref('');
let timer: ReturnType<typeof setTimeout> | null = null;
let alive = true;
const t0 = Date.now();

const said = () => { try { return localStorage.getItem(KEY) !== null; } catch { return false; } };
const remember = (v: string) => { try { localStorage.setItem(KEY, v); } catch { /* 저장소 없음 — 다시 물을 수 있다 */ } };
/** 움직일 수 있나: yes · no(묻지 않음) · wait(판정 전) */
function canAnimate(d: Detail): 'yes' | 'no' | 'wait' {
  if (d.making || d.confirmedKind || !(d.choices ?? []).includes('animated')) return 'no';
  if (d.suggestion == null) return 'wait';
  return d.suggestion === 'animated' ? 'yes' : 'no';
}

async function check() {
  if (!alive) return;
  let d: Detail;
  try { d = await api.get<Detail>(`/v1/artworks/${encodeURIComponent(props.artworkId)}`); } catch { return done(); }
  const v = canAnimate(d);
  if (v === 'no') return done();
  if (v === 'wait') {
    if (Date.now() - t0 > WAIT_MS) return done();
    if (phase.value === 'hidden' && !props.overlay) phase.value = 'judging';
    timer = setTimeout(check, 3000); return;
  }
  // 걸리는 장면(약 4초)이 끝난 뒤 묻는다
  const wait = props.overlay ? Math.max(0, (reducedMotion() ? 800 : 4500) - (Date.now() - t0)) : 0;
  if (!wait) phase.value = 'ask';
  else timer = setTimeout(() => { if (alive) phase.value = 'ask'; }, wait);
}
function done() { phase.value = 'hidden'; emit('close'); }
async function yes() {
  if (busy.value) return;
  busy.value = true; msg.value = '';
  try {
    await api.post(`/v1/artworks/${encodeURIComponent(props.artworkId)}/confirm`, { body: { kind: 'animated' } });
    remember('yes'); phase.value = 'started'; emit('started');
  } catch { msg.value = ko.animAsk.fail; }
  busy.value = false;
}
function no() { remember('no'); done(); }
onMounted(() => { if (said()) done(); else void check(); });
onBeforeUnmount(() => { alive = false; if (timer) clearTimeout(timer); });
</script>

<template>
  <div v-if="phase !== 'hidden'" :class="overlay ? 'aa-scrim' : 'aa-inline'">
    <section class="aa" role="dialog" :aria-modal="overlay ? 'true' : undefined" aria-labelledby="aa-q">
      <p v-if="phase === 'judging'" class="aa-small" role="status">{{ ko.animAsk.judging }}</p>
      <template v-else-if="phase === 'ask'">
        <p class="aa-spark" aria-hidden="true">✨🎞️</p>
        <h2 id="aa-q" class="aa-q">{{ ko.animAsk.q }}</h2>
        <p class="aa-small">{{ ko.animAsk.hint }}</p>
        <div class="aa-acts">
          <button class="btn btn-primary aa-btn" type="button" :disabled="busy" @click="yes">{{ ko.animAsk.yes }}</button>
          <button class="btn btn-primary aa-btn" type="button" :disabled="busy" @click="no">{{ ko.animAsk.no }}</button>
        </div>
        <p class="aa-msg" role="status" aria-live="polite">{{ msg }}</p>
      </template>
      <template v-else>
        <h2 id="aa-q" class="aa-q">{{ ko.animAsk.started }}</h2>
        <p class="aa-small">{{ ko.animAsk.startedHint }}</p>
        <div class="aa-acts"><button class="btn btn-secondary aa-btn" type="button" @click="done">{{ ko.animAsk.close }}</button></div>
      </template>
    </section>
  </div>
</template>

<style scoped>
.aa-scrim{position:fixed;inset:0;z-index:40;display:grid;place-items:center;padding:16px;background:rgba(60,44,30,.28);animation:aa-in .45s cubic-bezier(.32,.72,0,1) both}
.aa-inline{margin:0}
.aa{background:#fffdf8;border-radius:22px;padding:22px 20px;max-width:380px;width:100%;text-align:center;display:grid;gap:10px;
  box-shadow:0 0 0 1px rgba(201,165,82,.45),0 24px 60px -24px rgba(90,62,30,.45)}
.aa-scrim .aa{animation:aa-pop .55s cubic-bezier(.32,.72,0,1) both}
.aa-spark{margin:0;font-size:30px;line-height:1}
.aa-q{margin:0;font:700 20px/1.35 var(--mc-serif,serif);color:#4a3526}
.aa-small{margin:0;font:500 13px/1.45 var(--font-sans);color:#7a6555}
.aa-acts{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:4px}
.aa-acts:has(> :only-child){grid-template-columns:1fr}
.aa-btn{min-height:52px;font-size:17px}
.aa-msg{margin:0;min-height:1.2em;font:500 13px/1.3 var(--font-sans);color:#8a2b2b}
@keyframes aa-in{from{opacity:0}to{opacity:1}}
@keyframes aa-pop{from{opacity:0;transform:translateY(16px) scale(.96)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.aa-scrim,.aa-scrim .aa{animation:none}}
</style>
