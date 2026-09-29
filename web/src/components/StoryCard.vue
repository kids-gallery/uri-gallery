<script setup lang="ts">
// C7 이야기 카드(T093, SD_02 §3 C7 · UX5, BR-STY-03·04, BR-EXH-05, D6). 작품명 · 작가 줄 · 결과 종류 · 규칙 문장 해설(아이의 한마디는 원문 그대로)
// · 보호자 감상평 · AI 작성 해설을 칸을 나눠 보인다 — 한마디와 AI 문장은 절대 한 칸에 섞지 않는다.
// 모양은 S8 "작품 앞" 월 라벨(D25 ⑥ 르네상스, 신지현 디자인)을 그대로 옮겼다. 뒤로가기·재생 같은 조작은 부르는 쪽(slot before/after)이 둔다.
import { ko } from '@/copy/ko';
import type { components } from '@/api/types.gen';

type Item = components['schemas']['GalleryItem'];
defineProps<{ item: Item; alias: string; titleId?: string }>();

const yearOf = (d: string) => d.slice(0, 4);
const monthOf = (d: string) => Number(d.slice(5, 7));
</script>

<template>
  <slot name="before" />
  <p class="wl-eyebrow">{{ ko.museum.label }}</p>
  <h1 :id="titleId" class="wl-title">{{ item.title }}</h1>
  <p class="wl-artist">{{ ko.museum.artist(alias, item.ageAtMaking, yearOf(item.madeOn)) }}</p>
  <p class="wl-kind">{{ ko.museum.kind[item.kind] }}</p>
  <p class="wl-desc">
    {{ ko.museum.intro(item.title, alias, item.ageAtMaking, yearOf(item.madeOn), monthOf(item.madeOn)) }}
    <template v-if="item.childWords">{{ ko.museum.wordsBefore }}<span class="wl-words">{{ item.childWords }}</span>{{ ko.museum.wordsAfter }}</template>
    <template v-if="ko.museum.kindLine[item.kind]">{{ ko.museum.kindLine[item.kind] }}</template>
  </p>
  <p v-if="item.backsideEstimated" class="wl-note">{{ ko.gallery.backside }}</p>
  <div v-if="item.guardianNote" class="wl-block">
    <p class="wl-h">{{ ko.museum.guardianNote }}</p>
    <p class="wl-note-text">{{ item.guardianNote }}</p>
  </div>
  <div v-if="item.aiCaption?.body" class="wl-block" data-ai="1">
    <p class="wl-h">{{ ko.museum.commentary }}</p>
    <p>{{ item.aiCaption.body }}</p>
  </div>
  <slot name="after" />
</template>

<style scoped>
.wl-eyebrow{font:400 12px/1 var(--font-mono);letter-spacing:.6px;color:var(--museum-gold-3)}
.wl-title{margin:0;font:600 26px/1.3 var(--font-sans)}
.wl-title::before{content:"「"}.wl-title::after{content:"」"}
.wl-artist{font:400 15px/1.4 var(--font-sans)}
.wl-kind{font:400 13px/1.4 var(--font-mono);letter-spacing:.3px;border-top:1px solid var(--museum-gold-2);padding-top:var(--s-sm)}
.wl-desc{font:330 17px/1.7 var(--font-sans)}
.wl-words{font-weight:540}
.wl-note{font:330 14px/1.45 var(--font-sans)}
.wl-block{display:grid;gap:4px;border-top:1px solid var(--museum-gold-2);padding-top:var(--s-sm)}
.wl-h{font:400 12px/1 var(--font-mono);letter-spacing:.6px;color:var(--museum-gold-3)}
.wl-note-text{font:330 italic 16px/1.6 var(--font-sans)}
</style>
