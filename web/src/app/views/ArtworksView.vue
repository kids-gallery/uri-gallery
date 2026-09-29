<script setup lang="ts">
// S4 작품 목록(T080, SD_02 §7, UC3 BF1·BF2). 로그인 뒤 진입 홈. 가족 작품만, 상태 배지(C4)와 현재 단계.
// 작품을 누르면 상태에 맞는 화면으로 간다(routeFor). 진행 중 작품이 있을 때만 폴링(R-12).
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { api } from '@/api/client';
import type { BlockNotice as Notice } from '@/api/client';
import type { components } from '@/api/types.gen';
import BlockNotice from '@/components/BlockNotice.vue';
import StatusBadge from '@/components/StatusBadge.vue';
import ReasonButton from '@/components/ReasonButton.vue';
import { usePolling } from '@/composables/usePolling';
import { ko } from '@/copy/ko';
import NoticeBlock from '../components/NoticeBlock.vue';
import { MOVING_STATES, blockOf, nextActionLabel, routeFor, type ArtworkSummary } from '../artwork';

type Child = components['schemas']['Child'];

const joined = useRoute().query.joined === '1'; // S1c 수락 뒤(UC15 BF6)
const items = ref<ArtworkSummary[] | null>(null);
const children = ref<Child[]>([]);
const block = ref<Notice | null>(null);
const alias = computed(() => new Map(children.value.map((c) => [c.id, c.alias])));

async function load(): Promise<boolean> {
  const [list, kids] = await Promise.all([api.get<ArtworkSummary[]>('/v1/artworks'), api.get<Child[]>('/v1/children')]);
  items.value = list; children.value = kids; block.value = null;
  return list.some((a) => MOVING_STATES.includes(a.state));
}
const poll = usePolling(load);
async function first() {
  try { if (await load()) poll.start(); } catch (e) { block.value = blockOf(e); }
}
onMounted(first);
</script>

<template>
  <main class="container page stack">
    <div class="head">
      <h1 class="t-headline">{{ ko.shell.appMenu.artworks }}</h1>
      <RouterLink v-if="children.length" class="btn btn-primary" to="/app/upload">{{ ko.shell.appMenu.upload }}</RouterLink>
      <ReasonButton v-else-if="items" :label="ko.shell.appMenu.upload" disabled :reason="ko.child.needChild" />
    </div>
    <NoticeBlock v-if="joined" :title="ko.family.joined" />
    <BlockNotice v-if="block" :notice="block" @action="first" />

    <section v-if="items && !items.length" class="stack">
      <p class="t-body">{{ ko.list.empty }}</p>
      <RouterLink v-if="!children.length" class="btn btn-secondary" to="/app/children">{{ ko.shell.appMenu.children }}</RouterLink>
    </section>

    <div v-else-if="items" class="table-wrap">
      <table class="plain">
        <thead>
          <tr><th>{{ ko.list.colTitle }}</th><th>{{ ko.list.colChild }}</th><th>{{ ko.list.colState }}</th><th>{{ ko.list.colStage }}</th></tr>
        </thead>
        <tbody>
          <tr v-for="a in items" :key="a.id">
            <td>
              <RouterLink class="art-link" :to="routeFor(a)">
                <img v-if="a.thumbnailUrl" :src="a.thumbnailUrl" alt="" class="thumb">
                <span>{{ a.title || ko.list.untitled }}</span>
              </RouterLink>
            </td>
            <td>{{ alias.get(a.childId) ?? '' }}</td>
            <td><StatusBadge :state="a.state === 'failed' ? 'not_delivered' : a.state" /></td>
            <td>
              <RouterLink v-if="nextActionLabel(a.state)" class="btn btn-secondary btn-sm"
                :to="a.state === 'exhibited' ? '/app' : routeFor(a)">{{ nextActionLabel(a.state) }}</RouterLink>
              <span v-else-if="a.currentStage" class="t-body-sm">{{ ko.stageName[a.currentStage] ?? '' }}</span>
              <RouterLink v-else class="t-body-sm" :to="`/app/artworks/${a.id}`">{{ ko.list.progress }}</RouterLink>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </main>
</template>

<style scoped>
.head{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:var(--s-sm)}
.table-wrap{overflow-x:auto}
table.plain{width:100%;border-collapse:collapse;font:330 16px/1.45 var(--font-sans)}
table.plain th,table.plain td{text-align:left;padding:var(--s-sm) var(--s-sm) var(--s-sm) 0;border-bottom:1px solid var(--color-hairline-soft);vertical-align:middle}
table.plain th{font:400 12px/1 var(--font-mono);letter-spacing:.6px;text-transform:uppercase}
.art-link{display:inline-flex;align-items:center;gap:var(--s-sm);color:var(--color-ink);font-weight:540}
.thumb{width:48px;height:48px;object-fit:cover;border-radius:var(--r-sm);background:var(--color-surface-soft)}
.btn-sm{min-height:44px;font-size:16px;padding:6px 14px}
</style>
