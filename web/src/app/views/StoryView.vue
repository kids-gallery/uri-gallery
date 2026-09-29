<script setup lang="ts">
// S6 이야기 쓰기(T095, SD_02 §9, UC5 BF2~BF5·A1·A4·A5·E1·E2·E5·E7, G11·G12·G3, FR-9 공동 보호자).
// - 부분 저장 허용. 화면이 그린 날(오늘 이후 금지)·나이(0~18)를 먼저 검사하고 서버가 다시 검사한다.
// - 한마디는 적은 그대로 보낸다(트림 없음, BR-STY-03). 비우고 저장하면 지운다(A4).
// - 동시 수정: 불러올 때의 updatedAt을 baseUpdatedAt으로 싣고, 409 story_conflict면 최신을 불러오고 내 입력은 옆에 남긴다.
// - 세션 만료(§17 규칙 3): 이 기기 브라우저에만 임시 저장 → 다시 열면 "저장하지 못한 입력이 있어요". 저장 성공 때 지운다.
// - 설명 확장점(S7, T129 CaptionPanel)은 GET /v1/captions/model-status가 응답할 때만 보인다 — P0(caption.enabled=false)에서는 404라 숨는다.
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api, ApiError, toBlock, type BlockNotice as Notice } from '@/api/client';
import BlockNotice from '@/components/BlockNotice.vue';
import ExhibitCheck from '@/components/ExhibitCheck.vue';
import JourneyRail from '@/components/JourneyRail.vue';
import ReasonButton from '@/components/ReasonButton.vue';
import { ko } from '@/copy/ko';
import NoticeBlock from '../components/NoticeBlock.vue';
import { blockOf, loadArtwork, railOf, resultImage, type ArtworkDetail } from '../artwork';
import ArtFrame from '@/components/ArtFrame.vue';
import CaptionPanel from './CaptionPanel.vue';

interface Form { title: string; madeOn: string; age: string; words: string; note: string }
const route = useRoute();
const router = useRouter();
const id = String(route.params.id);
const DRAFT = `uam.storyDraft.${id}`;
const a = ref<ArtworkDetail | null>(null);
const f = ref<Form>({ title: '', madeOn: '', age: '', words: '', note: '' });
const base = ref<string | null>(null);
const busy = ref(false);
const block = ref<Notice | null>(null);
const done = ref<'' | 'saved' | 'exhibited'>('');
const mine = ref<Form | null>(null);
const draft = ref<Form | null>(null);
const approvedNow = route.query.approved === '1';

const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const futureDate = computed(() => !!f.value.madeOn && f.value.madeOn > today());
const badAge = computed(() => f.value.age !== '' && !(/^\d{1,2}$/.test(f.value.age) && Number(f.value.age) <= 18));
const longTitle = computed(() => [...f.value.title].length > 100);
const longNote = computed(() => [...f.value.note].length > 1000);
const why = computed(() => (futureDate.value ? ko.story.fixDate : badAge.value ? ko.story.ageRange : longTitle.value ? ko.story.titleLong : longNote.value ? ko.story.noteLong : busy.value ? ko.upload.sending : ''));
const rail = computed(() => (a.value ? railOf(a.value.state) : null));
const reviewed = computed(() => a.value?.state === 'approved' || a.value?.state === 'exhibited');
const storyDone = computed(() => !!(a.value?.story?.title && a.value.story.madeOn && a.value.story.ageAtMaking != null));

function fill(d: ArtworkDetail) {
  a.value = d;
  const s = d.story ?? {};
  f.value = { title: s.title ?? '', madeOn: s.madeOn ?? '', age: s.ageAtMaking == null ? '' : String(s.ageAtMaking), words: s.childWords ?? '', note: s.guardianNote ?? '' };
  base.value = s.updatedAt ?? null;
}
const readDraft = (): Form | null => { try { const v = localStorage.getItem(DRAFT); return v ? JSON.parse(v) as Form : null; } catch { return null; } };
const clearDraft = () => { try { localStorage.removeItem(DRAFT); } catch { /* 저장소 없음 */ } };

async function load() {
  try { fill(await loadArtwork(id)); block.value = null; } catch (e) { block.value = blockOf(e); }
}
onMounted(async () => { await load(); draft.value = readDraft(); });

async function save() {
  if (why.value || !a.value) return;
  busy.value = true; block.value = null; done.value = ''; mine.value = null;
  const sent = { ...f.value };
  const body = {
    title: sent.title.trim() || null, madeOn: sent.madeOn || null,
    ageAtMaking: sent.age === '' ? null : Number(sent.age), childWords: sent.words === '' ? null : sent.words,
    guardianNote: sent.note === '' ? null : sent.note, baseUpdatedAt: base.value, // D25 보호자 감상평 — 원문 그대로
  };
  try {
    const d = await api.put<ArtworkDetail>(`/v1/artworks/${encodeURIComponent(id)}/story`, { body });
    fill(d); clearDraft();
    done.value = d.state === 'exhibited' ? 'exhibited' : 'saved';
  } catch (e) {
    const err = e instanceof ApiError ? e : new ApiError(0, null);
    if (err.status === 401) { try { localStorage.setItem(DRAFT, JSON.stringify(sent)); } catch { /* 저장소 없음 */ } return; }
    block.value = toBlock(err);
    if (err.reason === 'story_conflict') { mine.value = sent; await load(); block.value = toBlock(err); }
  } finally { busy.value = false; }
}
async function onBlock(label: string) {
  if (label === '최신 내용 불러오기') await load();
  else if (label === '목록으로') await router.push('/app/works');
  else if (label === '다시 저장') await save();
  else document.getElementById(futureDate.value ? 'st-date' : 'st-title')?.focus();
}
function useDraft() { if (draft.value) f.value = { ...draft.value }; draft.value = null; clearDraft(); }
function dropDraft() { draft.value = null; clearDraft(); }
</script>

<template>
  <main class="container page stack">
    <BlockNotice v-if="block && !a" :notice="block" @action="onBlock" />
    <template v-if="a && rail">
      <JourneyRail :current="rail.current" :variant="rail.variant" :gate="rail.gate">
        <template #hold><ExhibitCheck :reviewed="reviewed" :story-done="storyDone" /></template>
      </JourneyRail>
      <NoticeBlock v-if="approvedNow && !done" :title="ko.review.afterApprove" />
      <NoticeBlock v-if="draft" :title="ko.fail.draftRestored">
        <template #actions>
          <button class="btn btn-secondary" type="button" @click="useDraft">{{ ko.fail.draftFill }}</button>
          <button class="btn btn-secondary" type="button" @click="dropDraft">{{ ko.fail.draftDiscard }}</button>
        </template>
      </NoticeBlock>
      <!-- 전시 확정 순간: 액자가 벽에 걸린다(1초 안팎, 움직임 줄이기면 멈춤 — SD_02 §17-2) -->
      <div v-if="done === 'exhibited'" class="hang-wall" aria-hidden="true">
        <div class="hang-anim"><ArtFrame size="sm" :src="resultImage(a).still" :alt="a.story?.title ?? ''" /></div>
      </div>
      <NoticeBlock v-if="done" :title="done === 'exhibited' ? ko.story.exhibited : ko.story.saved">
        <template v-if="done === 'exhibited'" #actions><RouterLink class="btn btn-secondary" to="/app/hall">{{ ko.list.toGallery }}</RouterLink></template>
      </NoticeBlock>

      <form class="card stack story-form" novalidate @submit.prevent="save">
        <h1 class="t-headline">{{ a.story?.title || ko.list.untitled }}</h1>
        <fieldset class="stack">
          <legend class="t-eyebrow">{{ ko.story.required }}</legend>
          <div class="field">
            <label for="st-title">{{ ko.story.title }}</label>
            <input id="st-title" v-model="f.title" class="input" :class="{ 'is-error': longTitle }" maxlength="200" autocomplete="off">
          </div>
          <div class="field">
            <label for="st-date">{{ ko.story.madeOn }}</label>
            <input id="st-date" v-model="f.madeOn" class="input" :class="{ 'is-error': futureDate }" type="date" :max="today()"
              :aria-invalid="futureDate ? 'true' : undefined">
          </div>
          <div class="field">
            <label for="st-age">{{ ko.story.age }}</label>
            <input id="st-age" v-model="f.age" class="input" :class="{ 'is-error': badAge }" inputmode="numeric" maxlength="2"
              :aria-invalid="badAge ? 'true' : undefined">
          </div>
        </fieldset>
        <div class="field">
          <label for="st-words">{{ ko.story.words }}</label>
          <textarea id="st-words" v-model="f.words" class="input" rows="3" maxlength="2000"></textarea>
        </div>
        <div class="field">
          <label for="st-note">{{ ko.story.note }}</label>
          <textarea id="st-note" v-model="f.note" class="input" :class="{ 'is-error': longNote }" rows="3" aria-describedby="st-note-h"></textarea>
          <p id="st-note-h" class="hint">{{ ko.story.noteHint }}</p>
        </div>
        <BlockNotice v-if="block" :notice="block" @action="onBlock" />
        <section v-if="mine" class="tile t-body-sm" aria-label="내가 적은 내용">
          <p><b>{{ ko.story.mine }}</b></p>
          <p>{{ ko.story.title }}: {{ mine.title }} · {{ ko.story.madeOn }}: {{ mine.madeOn }} · {{ ko.story.age }}: {{ mine.age }}</p>
          <p v-if="mine.words">{{ mine.words }}</p>
          <p v-if="mine.note">{{ ko.story.note }}: {{ mine.note }}</p>
        </section>
        <div class="acts">
          <ReasonButton :label="ko.story.save" :disabled="!!why" :reason="why" @click="save"
            @blocked="onBlock('')" />
        </div>
      </form>
      <ExhibitCheck v-if="rail.variant !== 'hold'" :reviewed="reviewed" :story-done="storyDone" />
      <CaptionPanel :artwork="a" />
    </template>
  </main>
</template>

<style scoped>
.story-form{max-width:640px}
.hang-wall{background:color-mix(in srgb,var(--color-block-cream) 45%,var(--color-canvas));border-radius:var(--r-md);display:grid;place-items:center;padding:var(--s-lg) 0 var(--s-xl);overflow:hidden}
.hang-anim{animation:hang 1s cubic-bezier(.2,.9,.3,1.2) both;transform-origin:50% 0}
@keyframes hang{0%{opacity:0;transform:translateY(-40px) rotate(-6deg)}60%{opacity:1;transform:translateY(4px) rotate(2deg)}100%{transform:none}}
@media (prefers-reduced-motion:reduce){.hang-anim{animation:none}}
fieldset{border:0;margin:0;padding:0}
textarea.input{min-height:96px;resize:vertical}
.acts{display:flex;flex-wrap:wrap;gap:var(--s-sm)}
</style>
