<script setup lang="ts">
// S6 작품 이야기(T095, SD_02 §9 · §17-14 D46): 올린 작품은 고정 — 이야기는 올릴 때 함께 적고, 여기서는 보기만 한다.
// 걸린 뒤 설명은 큐레이션(규칙 캡션 · AI 해설 · 들려주기)이 맡고, 가족 보호자는 댓글을 7일 동안 남긴다(그 뒤 보기 · 작품 삭제만).
import { computed, onMounted, ref } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import BlockNotice from '@/components/BlockNotice.vue';
import ExhibitCheck from '@/components/ExhibitCheck.vue';
import JourneyRail from '@/components/JourneyRail.vue';
import { ko } from '@/copy/ko';
import { type BlockNotice as Notice } from '@/api/client';
import NoticeBlock from '../components/NoticeBlock.vue';
import { blockOf, loadArtwork, railOf, type ArtworkDetail } from '../artwork';
import CaptionPanel from './CaptionPanel.vue';
import CommentPanel from '@/components/CommentPanel.vue';

const route = useRoute();
const router = useRouter();
const id = String(route.params.id);
const a = ref<ArtworkDetail | null>(null);
const block = ref<Notice | null>(null);
const approvedNow = route.query.approved === '1';
const rail = computed(() => (a.value ? railOf(a.value.state) : null));
const reviewed = computed(() => a.value?.state === 'approved' || a.value?.state === 'exhibited');
const storyDone = computed(() => !!(a.value?.story?.title && a.value.story.madeOn && a.value.story.ageAtMaking != null));
const rows = computed(() => {
  const s = a.value?.story ?? {};
  return [
    [ko.story.madeOn, s.madeOn], [ko.story.age, s.ageAtMaking == null ? null : String(s.ageAtMaking)],
    [ko.story.words, s.childWords], [ko.story.note, s.guardianNote],
  ].filter((r): r is [string, string] => !!r[1]);
});

async function load() {
  try { a.value = await loadArtwork(id); block.value = null; } catch (e) { block.value = blockOf(e); }
}
onMounted(load);
async function onBlock(label: string) {
  if (label === '목록으로') await router.push('/app/works');
  else await load();
}
</script>

<template>
  <main class="container page stack">
    <BlockNotice v-if="block && !a" :notice="block" @action="onBlock" />
    <template v-if="a && rail">
      <JourneyRail :current="rail.current" :variant="rail.variant" :gate="rail.gate">
        <template #hold><ExhibitCheck :reviewed="reviewed" :story-done="storyDone" /></template>
      </JourneyRail>
      <NoticeBlock v-if="approvedNow" :title="ko.review.afterApprove" />
      <section class="card stack story-view" aria-label="작품 이야기">
        <h1 class="t-headline">{{ a.story?.title || ko.list.untitled }}</h1>
        <dl v-if="rows.length" class="story-dl">
          <template v-for="[k, v] in rows" :key="k"><dt>{{ k }}</dt><dd>{{ v }}</dd></template>
        </dl>
        <p class="lock" role="note">🔒 {{ ko.up2.lockNote }}</p>
      </section>
      <section class="card stack"><CommentPanel :artwork-id="id" /></section><!-- D46 ④ 부모 댓글(7일) -->
      <ExhibitCheck v-if="rail.variant !== 'hold'" :reviewed="reviewed" :story-done="storyDone" />
      <CaptionPanel :artwork="a" />
    </template>
  </main>
</template>

<style scoped>
.story-view{max-width:640px}
.story-dl{display:grid;grid-template-columns:auto 1fr;gap:6px 14px;margin:0}
.story-dl dt{font:600 14px/1.5 var(--font-sans);color:#7a6555}
.story-dl dd{margin:0;white-space:pre-wrap;font:500 15px/1.5 var(--font-sans);color:var(--color-ink)}
.lock{margin:0;font:500 13px/1.4 var(--font-sans);color:#7a6555}
</style>
