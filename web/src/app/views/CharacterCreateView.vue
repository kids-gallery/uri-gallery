<script setup lang="ts">
// S1 아이 등록 = 캐릭터 만들기(D40, SD_02 §17-13 A). ① 이름 짓기 ② 캐릭터 고르기 ③ 미술관 모양 고르기 ④ 개관.
// 별칭 규칙은 S1(ChildrenView)과 같다 — 앞뒤 공백 뺀 1~20자, 실명·생년월일 칸 없음(BR-CHD-01, D22).
// 저장: ④에서 [리본 자르기] = POST /v1/children {alias, character, color, museumStyle} → [미술관에 들어가기] → /app/museum/{id}.
// 바꾸기: ?edit={childId} → ②③만, PATCH /v1/children/{id}(별칭도 함께) → /app/children. 셋 다 계약 enum 값만 보낸다.
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api, ApiError, toBlock, type BlockNotice as Notice } from '@/api/client';
import type { components } from '@/api/types.gen';
import BlockNotice from '@/components/BlockNotice.vue';
import ReasonButton from '@/components/ReasonButton.vue';
import { ko, problemCopy } from '@/copy/ko';
import CharacterAvatar from '../character/CharacterAvatar.vue';
import MuseumBuilding from '../character/MuseumBuilding.vue';
import { cc } from '../character/copy';
import { PALETTE } from '../character/palette';
import {
  COLORS, COLOR_NAME, DEFAULT_COLOR, DEFAULT_KIND, DEFAULT_STYLE, KINDS, KIND_NAME, STYLES, STYLE_NAME,
  isColor, isKind, isStyle, type CharacterColor, type CharacterKind, type MuseumStyle,
} from '../character/names';

/** 계약 Child(D40 필드 포함) — types.gen.ts가 다시 만들어지면 그쪽 타입으로 바꾼다 */
type Child = components['schemas']['Child'] & { character?: CharacterKind | null; color?: CharacterColor | null; museumStyle?: MuseumStyle | null };
const MAX = 20;

const emit = defineEmits<{ created: [child: Child] }>();
const route = useRoute();
const router = useRouter();
const editId = typeof route.query.edit === 'string' && route.query.edit ? route.query.edit : null;
const steps = editId ? [2, 3] : [1, 2, 3, 4];

const step = ref(editId ? 2 : 1);
const alias = ref('');
const kind = ref<CharacterKind>(DEFAULT_KIND);
const color = ref<CharacterColor>(DEFAULT_COLOR);
const styleIdx = ref(STYLES.indexOf(DEFAULT_STYLE));
const museumStyle = computed<MuseumStyle>(() => STYLES[styleIdx.value]!);

const busy = ref(false);
const block = ref<Notice | null>(null);
const created = ref<Child | null>(null);
const loading = ref(!!editId);
const loadBlock = ref<Notice | null>(null);
const notFound = ref(false);

const head = ref<HTMLElement | null>(null);
const aliasEl = ref<HTMLInputElement | null>(null);
const openedEl = ref<HTMLElement | null>(null);

const trimmed = computed(() => alias.value.trim());
const left = computed(() => MAX - [...trimmed.value].length);
// 검사 문구는 S1·G4 사유 문구와 같다(C_화면문구 §3 G4)
const aliasErr = computed(() => (!trimmed.value ? problemCopy({ gate: 'G4', reason: 'alias_blank' }).reason
  : left.value < 0 ? problemCopy({ gate: 'G4', reason: 'alias_too_long' }).reason : ''));

const stepName = (n: number) => cc.steps[n - 1]!;
const pos = computed(() => steps.indexOf(step.value) + 1);
const liveText = computed(() => cc.stepOf(pos.value, steps.length, stepName(step.value)));
const title = editId ? cc.editTitle : cc.title;

function canGo(n: number) {
  if (created.value || busy.value || loading.value || notFound.value) return false;
  if (!steps.includes(n)) return false;
  return n <= 1 || !aliasErr.value;
}
function go(n: number) { if (canGo(n)) step.value = n; }
function focusAlias() { void nextTick(() => { aliasEl.value?.focus(); aliasEl.value?.select(); }); }

function next() {
  if (step.value === 1 && aliasErr.value) { focusAlias(); return; }
  const i = steps.indexOf(step.value);
  if (i < steps.length - 1) go(steps[i + 1]!);
}
function back() {
  const i = steps.indexOf(step.value);
  if (i > 0) go(steps[i - 1]!);
}

// 단계가 바뀌면 그 단계 제목으로 포커스(차단 블록이 있으면 블록이 포커스를 가진다)
watch(step, () => { void nextTick(() => { if (!block.value) head.value?.focus(); }); });

function prevStyle() { styleIdx.value = (styleIdx.value + STYLES.length - 1) % STYLES.length; }
function nextStyle() { styleIdx.value = (styleIdx.value + 1) % STYLES.length; }

const body = () => ({ alias: trimmed.value, character: kind.value, color: color.value, museumStyle: museumStyle.value });

function isAliasProblem(e: ApiError) {
  return e.gate === 'G4' || (e.reason ?? '').startsWith('alias') || (e.problem?.fields ?? []).some((f) => f.name === 'alias');
}
function fail(e: unknown) {
  const err = e instanceof ApiError ? e : new ApiError(0, null);
  if (err.status === 422 && isAliasProblem(err) && !editId) step.value = 1;
  block.value = toBlock(err);
}

async function open() {
  if (busy.value || created.value) return;
  if (aliasErr.value) { step.value = 1; focusAlias(); return; }
  busy.value = true; block.value = null;
  try {
    const saved = await api.post<Child>('/v1/children', { body: body() });
    created.value = saved;
    emit('created', saved);
    void nextTick(() => openedEl.value?.focus());
  } catch (e) { fail(e); } finally { busy.value = false; }
}

async function saveEdit() {
  if (busy.value || !editId) return;
  busy.value = true; block.value = null;
  try {
    await api.patch<Child>(`/v1/children/${encodeURIComponent(editId)}`, { body: body() });
    await router.push('/app/children');
  } catch (e) { fail(e); } finally { busy.value = false; }
}

function enter() { if (created.value) void router.push(`/app/museum/${encodeURIComponent(created.value.id)}`); }

function onBlockAction(label: string) {
  if (label === ko.child.edit) {
    if (editId) { void router.push('/app/children'); return; }
    block.value = null; step.value = 1; focusAlias();
  } else if (editId) void saveEdit();
  else void open();
}

async function loadEdit() {
  if (!editId) return;
  loading.value = true; loadBlock.value = null;
  try {
    const list = await api.get<Child[]>('/v1/children');
    const c = list.find((x) => x.id === editId);
    if (!c) { notFound.value = true; return; }
    alias.value = c.alias;
    if (isKind(c.character)) kind.value = c.character;
    if (isColor(c.color)) color.value = c.color;
    if (isStyle(c.museumStyle)) styleIdx.value = STYLES.indexOf(c.museumStyle);
  } catch (e) {
    loadBlock.value = toBlock(e instanceof ApiError ? e : new ApiError(0, null));
  } finally { loading.value = false; }
}

onMounted(() => { void loadEdit(); if (!editId) focusAlias(); });
</script>

<template>
  <main class="container page cc">
    <h1 class="t-headline">{{ title }}</h1>
    <p v-if="route.query.welcome === '1'" class="cc-welcome t-body" role="status">{{ ko.kakao.welcome }}</p><!-- D47: 카카오 첫 가입은 흰 표 대신 여기로 -->

    <nav class="dots" :aria-label="cc.stepNav">
      <ol>
        <li v-for="(n, i) in steps" :key="n">
          <button type="button" class="dot-btn" :class="{ on: step === n, done: steps.indexOf(step) > i }"
            :aria-current="step === n ? 'step' : undefined" :aria-label="cc.goStep(i + 1, stepName(n))"
            :disabled="step !== n && !canGo(n)" @click="go(n)">
            <span class="dot" aria-hidden="true">{{ i + 1 }}</span><span class="dot-name">{{ stepName(n) }}</span>
          </button>
        </li>
      </ol>
    </nav>
    <p class="sr-only" aria-live="polite" data-test="live">{{ liveText }}</p>

    <BlockNotice v-if="loadBlock" :notice="loadBlock" @action="loadEdit" />
    <p v-if="loading" class="t-body-sm" role="status">{{ cc.loading }}</p>
    <section v-else-if="notFound" class="card stack">
      <p class="t-body" role="alert">{{ cc.notFound }}</p>
      <RouterLink class="btn btn-secondary" to="/app/children">{{ cc.toChildren }}</RouterLink>
    </section>

    <template v-else-if="!loadBlock">
      <!-- ① 이름 짓기 -->
      <section v-if="step === 1" class="step card" data-step="1" aria-labelledby="cc-h">
        <h2 id="cc-h" ref="head" class="t-card-title" tabindex="-1">{{ cc.askName }}</h2>
        <form class="stack" novalidate @submit.prevent="next">
          <div class="tag">
            <span class="tag-hole" aria-hidden="true" />
            <label class="tag-label" for="cc-alias">{{ cc.nameTag }}</label>
            <input id="cc-alias" ref="aliasEl" v-model="alias" class="tag-input" :class="{ 'is-error': left < 0 }" autocomplete="off"
              :aria-invalid="left < 0 ? 'true' : undefined" aria-describedby="cc-alias-h cc-alias-n">
          </div>
          <p id="cc-alias-h" class="hint t-body-sm">{{ cc.nameHint }}</p>
          <p id="cc-alias-n" class="hint t-body-sm num" aria-live="polite">{{ cc.remaining(Math.max(left, 0)) }}<template v-if="left < 0"> - {{ aliasErr }}</template></p>
          <p class="t-body-sm">{{ cc.notCollected }}</p>
          <div class="acts">
            <ReasonButton class="big" :label="cc.next" :disabled="!!aliasErr" :reason="aliasErr" @click="next" @blocked="focusAlias" />
          </div>
        </form>
      </section>

      <!-- ② 캐릭터 고르기 -->
      <section v-else-if="step === 2" class="step card" data-step="2" aria-labelledby="cc-h">
        <h2 id="cc-h" ref="head" class="t-card-title" tabindex="-1">{{ cc.pickTitle }}</h2>
        <div class="stage">
          <CharacterAvatar :kind="kind" :color="color" :size="176" spinning />
          <span class="pedestal" aria-hidden="true" />
        </div>
        <fieldset class="pick">
          <legend class="t-body">{{ cc.friends }}</legend>
          <div class="kinds">
            <label v-for="k in KINDS" :key="k" class="kcard" :class="{ on: kind === k }">
              <input v-model="kind" class="sr-only" type="radio" name="cc-kind" :value="k">
              <span aria-hidden="true"><CharacterAvatar :kind="k" :color="color" :size="60" /></span>
              <span class="kname">{{ KIND_NAME[k] }}</span>
            </label>
          </div>
        </fieldset>
        <fieldset class="pick">
          <legend class="t-body">{{ cc.colors }}</legend>
          <div class="swatches">
            <label v-for="c in COLORS" :key="c" class="sw" :class="{ on: color === c }">
              <input v-model="color" class="sr-only" type="radio" name="cc-color" :value="c">
              <span class="sw-dot" :style="{ background: PALETTE[c].body }" aria-hidden="true" />
              <span class="sw-name">{{ COLOR_NAME[c] }}</span>
            </label>
          </div>
        </fieldset>
        <div class="acts">
          <button v-if="!editId" class="btn btn-secondary" type="button" @click="back">{{ cc.back }}</button>
          <button class="btn btn-primary big" type="button" @click="next">{{ cc.next }}</button>
        </div>
      </section>

      <!-- ③ 미술관 모양 고르기 -->
      <section v-else-if="step === 3" class="step card" data-step="3" aria-labelledby="cc-h">
        <h2 id="cc-h" ref="head" class="t-card-title" tabindex="-1">{{ cc.styleTitle }}</h2>
        <div class="town" role="group" :aria-label="cc.townLabel(STYLE_NAME[museumStyle])">
          <svg class="town-bg" viewBox="0 0 320 160" preserveAspectRatio="xMidYMax meet" aria-hidden="true">
            <polygon points="160,158 318,104 160,50 2,104" fill="#E3F5DC" />
            <path d="M160 158 L2 104 M160 158 L318 104" stroke="#BFE3B6" />
            <g v-for="tr in [[40, 100], [276, 98], [70, 122], [250, 124]]" :key="`${tr[0]}`">
              <rect :x="tr[0]! - 2" :y="tr[1]! - 4" width="4" height="10" fill="#A0714F" />
              <circle :cx="tr[0]" :cy="tr[1]! - 10" r="10" fill="#8AD17F" stroke="#4A3441" stroke-width="1.2" />
            </g>
          </svg>
          <MuseumBuilding class="town-b" :museum-style="museumStyle" :color="color" :size="200" />
        </div>
        <div class="flip">
          <button class="btn btn-secondary flip-btn" type="button" :aria-label="cc.prevStyle" @click="prevStyle"><span aria-hidden="true">‹</span></button>
          <p class="flip-name" aria-live="polite">
            <strong class="t-body-lg">{{ STYLE_NAME[museumStyle] }}</strong>
            <span class="t-body-sm">{{ cc.styleCount(styleIdx + 1, STYLES.length) }}</span>
          </p>
          <button class="btn btn-secondary flip-btn" type="button" :aria-label="cc.nextStyle" @click="nextStyle"><span aria-hidden="true">›</span></button>
        </div>
        <div class="acts">
          <button class="btn btn-secondary" type="button" @click="back">{{ cc.back }}</button>
          <ReasonButton v-if="editId" class="big" :label="busy ? cc.saving : cc.saveEdit" :disabled="busy" @click="saveEdit" />
          <button v-else class="btn btn-primary big" type="button" @click="next">{{ cc.next }}</button>
        </div>
      </section>

      <!-- ④ 개관 -->
      <section v-else-if="step === 4" class="step card" data-step="4" aria-labelledby="cc-h">
        <h2 id="cc-h" ref="head" class="t-card-title" tabindex="-1">{{ cc.openTitle }}</h2>
        <div class="ceremony" :class="{ opened: !!created }">
          <MuseumBuilding :museum-style="museumStyle" :color="color" :size="220" :open="!!created" decorative />
          <span class="ribbon" aria-hidden="true"><span class="rl" /><span class="rr" /><span class="knot" /></span>
          <span class="guest" aria-hidden="true"><CharacterAvatar :kind="kind" :color="color" :size="72" /></span>
        </div>
        <template v-if="!created">
          <p class="t-body">{{ cc.ribbonHint }}</p>
          <div class="acts">
            <button class="btn btn-secondary" type="button" :disabled="busy" @click="back">{{ cc.back }}</button>
            <ReasonButton class="big" :label="busy ? cc.saving : cc.cutRibbon" :disabled="busy" @click="open" />
          </div>
        </template>
        <template v-else>
          <p ref="openedEl" class="opened-msg t-headline" role="status" tabindex="-1">{{ cc.opened(created.alias) }}</p>
          <p v-if="created.aliasDuplicate" class="t-body-sm">{{ cc.dup(created.alias) }}</p>
          <div class="acts">
            <button class="btn btn-primary big" type="button" @click="enter">{{ cc.enter }}</button>
          </div>
        </template>
      </section>

      <BlockNotice v-if="block" :notice="block" @action="onBlockAction" />
    </template>
  </main>
</template>

<style scoped>
.cc{display:flex;flex-direction:column;gap:var(--s-lg);max-width:min(880px,100%);overflow-x:clip}
.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
.dots ol{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:var(--s-xs)}
.dot-btn{display:inline-flex;align-items:center;gap:6px;min-height:44px;padding:4px 12px 4px 4px;border:0;border-radius:var(--r-pill);background:var(--color-surface-soft);color:var(--color-ink);font:480 16px/1.2 var(--font-sans);cursor:pointer}
.dot-btn:disabled{cursor:default;opacity:.55}
.dot{display:inline-grid;place-items:center;width:32px;height:32px;border-radius:50%;background:var(--color-canvas);box-shadow:inset 0 0 0 2px var(--color-hairline);font-variant-numeric:tabular-nums}
.dot-btn.done .dot{background:var(--color-block-mint)}
.dot-btn.on{background:var(--color-primary);color:var(--color-on-primary)}
.dot-btn.on .dot{background:var(--color-on-primary);color:var(--color-primary);box-shadow:none}
@media (max-width:560px){.dot-btn:not(.on) .dot-name{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)}.dot-btn:not(.on){padding-right:4px}}
.step{display:flex;flex-direction:column;gap:var(--s-md);min-width:0}
.step h2:focus{outline:none}
.step h2:focus-visible{outline:2px solid var(--color-ink);outline-offset:4px}
.acts{display:flex;flex-wrap:wrap;gap:var(--s-sm);align-items:center}
.big{min-height:56px;padding-left:32px;padding-right:32px;font-size:22px}
@media (max-width:560px){.acts .big{flex:1 1 100%}}
.hint{margin:0}
.num{font-variant-numeric:tabular-nums}

/* ① 이름표 */
.tag{position:relative;display:flex;flex-direction:column;gap:6px;padding:var(--s-md) var(--s-lg) var(--s-lg) 56px;background:var(--color-block-lime);border:2px solid var(--color-ink);border-radius:var(--r-lg) 12px 12px var(--r-lg);max-width:560px;box-shadow:var(--elev-2)}
.tag-hole{position:absolute;left:20px;top:50%;width:16px;height:16px;margin-top:-8px;border-radius:50%;background:var(--color-canvas);box-shadow:inset 0 0 0 2px var(--color-ink)}
.tag-label{font:400 14px/1 var(--font-mono);letter-spacing:.6px}
.tag-input{width:100%;min-width:0;border:0;border-bottom:3px dashed var(--color-accent-magenta);background:transparent;color:var(--color-ink);font:700 clamp(26px,6vw,36px)/1.3 var(--font-sans);padding:4px 0}
.tag-input:focus{outline:none;border-bottom-style:solid;border-bottom-color:var(--color-ink)}
.tag-input.is-error{border-bottom-color:var(--color-ink);border-bottom-style:solid}

/* ② 받침 · 카드 · 색 */
.stage{display:flex;flex-direction:column;align-items:center;padding:var(--s-md) 0 0;background:radial-gradient(circle at 50% 40%,var(--color-block-cream),transparent 70%)}
.pedestal{display:block;width:200px;max-width:80%;height:28px;margin-top:-18px;border-radius:50%;background:linear-gradient(#fdf0ee,#ebd5d6);box-shadow:0 6px 0 #d9bcc0,var(--elev-2)}
.pick{border:0;margin:0;padding:0;min-width:0}
.pick legend{padding:0;margin-bottom:var(--s-xs);font-weight:540}
.kinds{display:grid;grid-template-columns:repeat(auto-fill,minmax(84px,1fr));gap:var(--s-xs)}
.kcard{display:flex;flex-direction:column;align-items:center;gap:2px;padding:8px 4px;border-radius:var(--r-md);background:var(--color-canvas);box-shadow:inset 0 0 0 1px var(--color-hairline);cursor:pointer;transition:transform .15s ease}
.kcard:hover{transform:translateY(-2px)}
.kcard.on{background:var(--color-block-pink);box-shadow:inset 0 0 0 3px var(--color-primary)}
.kcard:focus-within,.sw:focus-within{outline:3px solid var(--color-ink);outline-offset:2px}
.kname{font:540 16px/1.2 var(--font-sans)}
.swatches{display:flex;flex-wrap:wrap;gap:var(--s-sm)}
.sw{display:flex;flex-direction:column;align-items:center;gap:4px;cursor:pointer;min-width:56px;border-radius:var(--r-md);padding:4px}
.sw-dot{width:44px;height:44px;border-radius:50%;box-shadow:inset 0 0 0 2px rgba(74,52,65,.35)}
.sw.on .sw-dot{box-shadow:0 0 0 3px var(--color-canvas),0 0 0 6px var(--color-primary)}
.sw-name{font:450 14px/1.2 var(--font-sans)}

/* ③ 마을 모형 */
.town{position:relative;display:flex;justify-content:center;align-items:flex-end;min-height:220px;padding-bottom:8px;background:linear-gradient(#e8f6ff,var(--color-canvas) 70%);border-radius:var(--r-md);overflow:hidden}
.town-bg{position:absolute;left:0;right:0;bottom:0;width:100%;height:auto}
.town-b{position:relative;animation:rise .5s cubic-bezier(.3,.7,.2,1.2)}
@keyframes rise{from{transform:translateY(24px);opacity:0}to{transform:none;opacity:1}}
.flip{display:flex;align-items:center;justify-content:center;gap:var(--s-md)}
.flip-btn{width:56px;height:56px;min-height:56px;padding:0;font-size:32px;border-radius:50%}
.flip-name{display:flex;flex-direction:column;align-items:center;margin:0;min-width:0;text-align:center}

/* ④ 개관식 */
.ceremony{position:relative;display:flex;justify-content:center;align-items:flex-end;min-height:240px;background:linear-gradient(#fff5d6,var(--color-canvas) 70%);border-radius:var(--r-md);overflow:hidden}
.guest{position:absolute;left:calc(50% + 80px);bottom:6px}
@media (max-width:420px){.guest{left:auto;right:4px}}
.ribbon{position:absolute;left:50%;bottom:34px;width:180px;height:10px;margin-left:-90px;pointer-events:none}
.ribbon .rl,.ribbon .rr{position:absolute;top:0;width:50%;height:10px;background:#E4405F;box-shadow:inset 0 -2px 0 rgba(0,0,0,.15);transition:transform .8s ease,opacity .8s ease}
.ribbon .rl{left:0;transform-origin:left center}
.ribbon .rr{right:0;transform-origin:right center}
.ribbon .knot{position:absolute;left:50%;top:-6px;width:22px;height:22px;margin-left:-11px;border-radius:50%;background:#E4405F;box-shadow:inset 0 0 0 4px #F46C85;transition:opacity .4s ease}
.opened .ribbon .rl{transform:rotate(60deg);opacity:0}
.opened .ribbon .rr{transform:rotate(-60deg);opacity:0}
.opened .ribbon .knot{opacity:0}
.opened-msg{margin:0}
.opened-msg:focus{outline:none}
@media (prefers-reduced-motion:reduce){
  .town-b{animation:none}
  .kcard{transition:none}
  .ribbon{display:none}
}
.cc-welcome{margin:0;padding:10px 14px;border-radius:14px;background:var(--color-block-lime);font-weight:600}
</style>
