<script setup lang="ts">
// S8 가족 전시(T096, SD_02 §11, UC6 BF2~BF6·A4·A6~A8, BR-EXH-02~04, D3).
// 아이별 → 연령 묶음 → 제작일 순. 결과 종류와 관계없이 같은 크기, 낮춤·원인 표시 없음. 자동 넘김·자동 재생 없음.
// 작품 상세: 정지 결과 · [원본 보기] · 한마디 먼저 · (승인된) AI 설명. 파일을 못 읽으면 이야기는 그대로 두고 그 자리만 "지금은 불러올 수 없어요".
import { computed, onMounted, ref, watch } from 'vue';
import { api } from '@/api/client';
import type { BlockNotice as Notice } from '@/api/client';
import type { components } from '@/api/types.gen';
import BlockNotice from '@/components/BlockNotice.vue';
import SideBySide from '@/components/SideBySide.vue';
import { ko } from '@/copy/ko';
import { blockOf } from '../artwork';

type Child = components['schemas']['Child'];
type Gallery = components['schemas']['Gallery'];
type Item = components['schemas']['GalleryItem'];

const children = ref<Child[] | null>(null);
const childId = ref('');
const q = ref('');
const g = ref<Gallery | null>(null);
const open = ref<Item | null>(null);
const showOriginal = ref(false);
const block = ref<Notice | null>(null);
let timer: ReturnType<typeof setTimeout> | null = null;

const count = computed(() => g.value?.groups.reduce((n, x) => n + x.items.length, 0) ?? 0);
const DATE = /^\d{4}-\d{2}-\d{2}$/;

async function load() {
  if (!childId.value) return;
  try {
    const term = q.value.trim();
    g.value = await api.get<Gallery>('/v1/gallery', { query: { child: childId.value, ...(DATE.test(term) ? { madeOn: term } : term ? { q: term } : {}) } });
    block.value = null;
  } catch (e) { block.value = blockOf(e); }
}
onMounted(async () => {
  try {
    children.value = await api.get<Child[]>('/v1/children');
    childId.value = children.value[0]?.id ?? '';
  } catch (e) { block.value = blockOf(e); }
});
watch(childId, () => { open.value = null; void load(); });
watch(q, () => { if (timer) clearTimeout(timer); timer = setTimeout(() => void load(), 300); });

function still(it: Item) { return it.kind === 'frame' ? it.originalUrl : it.kind === 'relief' ? it.auxUrl ?? it.originalUrl : it.posterUrl ?? it.originalUrl; }
function show(it: Item) { open.value = it; showOriginal.value = false; }
</script>

<template>
  <main class="container page stack">
    <div class="head">
      <h1 class="t-headline">{{ ko.shell.appMenu.gallery }}</h1>
      <div class="filters">
        <div class="field">
          <label for="gl-child">{{ ko.gallery.child }}</label>
          <select id="gl-child" v-model="childId" class="input">
            <option v-for="c in children ?? []" :key="c.id" :value="c.id">{{ c.alias }}</option>
          </select>
        </div>
        <div class="field">
          <label for="gl-q">{{ ko.gallery.search }}</label>
          <input id="gl-q" v-model="q" class="input" type="search" autocomplete="off">
        </div>
      </div>
    </div>
    <BlockNotice v-if="block" :notice="block" @action="load" />

    <!-- 작품 상세 -->
    <section v-if="open" class="stack" aria-labelledby="gl-open">
      <h2 id="gl-open" class="t-card-title">{{ open.title }} - {{ open.madeOn }} - {{ ko.gallery.age(open.ageAtMaking) }}</h2>
      <p v-if="open.childWords" class="quote"><b>{{ ko.gallery.words }}</b> {{ open.childWords }}</p>
      <SideBySide :original-url="null" :show-original="false"
        :still="(showOriginal ? open.originalUrl : still(open)) ?? null" :video="showOriginal || open.kind !== 'animated' ? null : open.primaryUrl ?? null"
        :result-label="showOriginal ? ko.review.original : ko.kind[open.kind] ?? ''" @reload="load" />
      <p v-if="open.backsideEstimated" class="t-body-sm">{{ ko.gallery.backside }}</p>
      <div class="acts">
        <button v-if="open.kind !== 'frame'" class="btn btn-secondary" type="button" :aria-pressed="showOriginal" @click="showOriginal = !showOriginal">
          {{ showOriginal ? ko.review.showResult : ko.review.showOriginal }}
        </button>
        <button class="btn btn-secondary" type="button" @click="open = null">{{ ko.gallery.toList }}</button>
      </div>
      <section v-if="open.aiCaption?.body" class="tile">
        <p class="t-body-sm"><b>{{ ko.gallery.aiCaption }}</b></p>
        <p class="t-body">{{ open.aiCaption.body }}</p>
      </section>
    </section>

    <!-- 연령 묶음 -->
    <template v-else-if="g">
      <section v-if="!count" class="stack">
        <p class="t-body">{{ q.trim() ? ko.gallery.noMatch : ko.gallery.empty }}</p>
        <div><RouterLink class="btn btn-primary" to="/app/upload">{{ ko.gallery.toUpload }}</RouterLink></div>
      </section>
      <section v-for="grp in g.groups" :key="grp.ageAtMaking" class="stack" :aria-label="ko.gallery.age(grp.ageAtMaking)">
        <h2 class="age-head t-card-title">{{ ko.gallery.age(grp.ageAtMaking) }}</h2>
        <ul class="grid">
          <li v-for="it in grp.items" :key="it.id">
            <button class="art" type="button" @click="show(it)">
              <figure><img :src="still(it) ?? ''" :alt="it.title"></figure>
              <span class="title">{{ it.title }}</span>
              <span class="words">{{ it.madeOn }}</span>
            </button>
          </li>
        </ul>
      </section>
    </template>
  </main>
</template>

<style scoped>
.head{display:grid;gap:var(--s-sm)}
.filters{display:flex;flex-wrap:wrap;gap:var(--s-md)}
.filters .field{min-width:200px;flex:1}
.acts{display:flex;flex-wrap:wrap;gap:var(--s-sm)}
.grid{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:var(--s-md)}
.grid .art{width:100%;border:0;text-align:left;cursor:pointer;color:var(--color-ink)}
.grid figure img{width:100%;height:100%;object-fit:contain}
</style>
