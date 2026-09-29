<script setup lang="ts">
// C8 전시 조건 체크(T093, SD_02 §3-4 · UX1, G12). 두 줄: 결과 확인 완료 · 제목-그린 날-나이 저장. 둘 다면 전시에 걸린다.
import { ko } from '@/copy/ko';

defineProps<{ reviewed: boolean; storyDone: boolean }>();
</script>

<template>
  <section class="tile stack-sm" aria-labelledby="ex-cond">
    <p id="ex-cond" class="t-body"><b>{{ ko.story.exhibitTitle }}</b> <span class="gate">G12</span></p>
    <ul class="cond">
      <li :data-done="reviewed"><span aria-hidden="true">{{ reviewed ? '[X]' : '[ ]' }}</span> {{ ko.story.condReview }}<span class="sr">{{ reviewed ? ' - 완료' : ' - 아직' }}</span></li>
      <li :data-done="storyDone"><span aria-hidden="true">{{ storyDone ? '[X]' : '[ ]' }}</span> {{ ko.story.condStory }}<span class="sr">{{ storyDone ? ' - 완료' : ' - 아직' }}</span></li>
    </ul>
    <p class="t-body-sm">{{ ko.story.condNote }}</p>
  </section>
</template>

<style scoped>
.stack-sm{display:grid;gap:var(--s-xs)}
.cond{list-style:none;margin:0;padding:0;display:grid;gap:4px;font:330 16px/1.45 var(--font-sans)}
.cond span[aria-hidden]{font-family:var(--font-mono)}
.gate{font:400 12px/1 var(--font-mono);letter-spacing:.6px}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
</style>
