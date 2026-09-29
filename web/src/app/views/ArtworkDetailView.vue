<script setup lang="ts">
// S4 진행 상세(T080, SD_02 §7-2·§7-4, UC3). 단계별 상태·다시 시도 횟수·낮춤 안내(C6)·모델 준비 대기(오류 아님)·G9 처리하지 못함.
// 전이 중 상태(received·judging·processing)일 때만 폴링하고, 다른 상태가 되면 그 화면으로 가는 버튼을 보인다.
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import type { BlockNotice as Notice } from '@/api/client';
import BlockNotice from '@/components/BlockNotice.vue';
import DowngradeNote from '@/components/DowngradeNote.vue';
import JourneyRail from '@/components/JourneyRail.vue';
import StatusBadge from '@/components/StatusBadge.vue';
import { usePolling } from '@/composables/usePolling';
import { ko } from '@/copy/ko';
import NoticeBlock from '../components/NoticeBlock.vue';
import DeleteDialog from '../components/DeleteDialog.vue';
import { MOVING_STATES, blockOf, loadArtwork, nextActionLabel, notDeliveredBlock, railOf, routeFor, type ArtworkDetail } from '../artwork';

const route = useRoute();
const router = useRouter();
const id = String(route.params.id);
const a = ref<ArtworkDetail | null>(null);
const block = ref<Notice | null>(null);
const started = route.query.started === '1';
const deleting = ref(false);

const rail = computed(() => (a.value ? railOf(a.value.state) : null));
const g9 = computed(() => (a.value?.state === 'failed' ? notDeliveredBlock(a.value) : null));
const waitingQueue = computed(() => a.value?.state === 'processing' && a.value.stages.some((s) => s.status === 'waiting') && !a.value.stages.some((s) => s.status === 'running'));
const next = computed(() => (a.value ? nextActionLabel(a.value.state) : ''));

async function load(): Promise<boolean> {
  a.value = await loadArtwork(id);
  block.value = null;
  return MOVING_STATES.includes(a.value.state);
}
const poll = usePolling(load);
async function first() {
  try { if (await load()) poll.start(); } catch (e) { block.value = blockOf(e); }
}
onMounted(first);

function onBlock(label: string) {
  if (label === ko.list.toReview && a.value) void router.push(routeFor(a.value));
  else void router.push('/app');
}
function stageNote(s: ArtworkDetail['stages'][number]): string {
  if (s.waitingForModel) return s.etaSeconds ? `${ko.wait.model} - ${ko.wait.modelEta(Math.ceil(s.etaSeconds))}` : ko.wait.model;
  if ((s.attempt ?? 0) > 1 && (s.status === 'retrying' || s.status === 'failed')) return ko.list.retried((s.attempt ?? 1) - 1);
  return '';
}
</script>

<template>
  <main class="container page stack">
    <RouterLink class="t-body-sm" to="/app">{{ ko.list.backToList }}</RouterLink>
    <BlockNotice v-if="block" :notice="block" @action="onBlock" />
    <template v-if="a && rail">
      <JourneyRail :current="rail.current" :variant="waitingQueue ? 'waiting' : rail.variant" :gate="rail.gate" :blocked-label="rail.blockedLabel" />
      <NoticeBlock v-if="started" :title="ko.confirm.started"><p>{{ ko.rail.leaveOk }}</p></NoticeBlock>
      <h1 class="t-headline">{{ ko.list.detailTitle(a.story?.title || ko.list.untitled) }}</h1>

      <div v-if="a.stages.length" class="table-wrap">
        <table class="plain">
          <thead><tr><th>{{ ko.list.colStep }}</th><th>{{ ko.list.colStepState }}</th><th>{{ ko.list.colNote }}</th></tr></thead>
          <tbody>
            <tr v-for="(s, i) in a.stages" :key="i">
              <td>{{ ko.stageName[s.stage] ?? '' }}</td>
              <td><StatusBadge kind="stage" :state="s.status === 'waiting' ? 'queued' : s.status === 'retrying' ? 'retry_wait' : s.status" /></td>
              <td class="t-body-sm">{{ stageNote(s) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <DowngradeNote v-if="a.downgrade" :path="a.downgrade" />
      <BlockNotice v-if="g9" :notice="g9" @action="onBlock" />
      <div class="acts">
        <RouterLink v-if="next && !g9" class="btn btn-primary" :to="a.state === 'exhibited' ? '/app/gallery' : routeFor(a)">{{ next }}</RouterLink>
        <button v-if="!deleting" class="btn btn-secondary" type="button" @click="deleting = true; poll.stop()">{{ ko.del.artwork }}</button>
      </div>
      <DeleteDialog v-if="deleting" kind="artwork" :id="id" @close="deleting = false" />
    </template>
  </main>
</template>

<style scoped>
.acts{display:flex;flex-wrap:wrap;gap:var(--s-sm)}
.table-wrap{overflow-x:auto}
table.plain{width:100%;border-collapse:collapse;font:330 16px/1.45 var(--font-sans)}
table.plain th,table.plain td{text-align:left;padding:var(--s-sm) var(--s-sm) var(--s-sm) 0;border-bottom:1px solid var(--color-hairline-soft);vertical-align:middle}
table.plain th{font:400 12px/1 var(--font-mono);letter-spacing:.6px;text-transform:uppercase}
</style>
