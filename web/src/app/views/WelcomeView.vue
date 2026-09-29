<script setup lang="ts">
// S0w 입장(제안, SD_02 §17-2). 로그인 전 첫 방문 한 번만 — 어두운 전시장 벽, 조명 받은 빈 흑백 액자, [입장하기] → S0a(next 유지).
// 본 뒤에는 브라우저 저장값(uam.entered)으로 건너뛴다. 저장값을 읽거나 쓰지 못해도 막지 않는다(그냥 로그인으로).
// 움직임 줄이기 설정이면 조명·글자 등장 애니메이션을 끈다.
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import ArtFrame from '@/components/ArtFrame.vue';
import { ko } from '@/copy/ko';
import { markEntered } from '../entrance';

const route = useRoute();
const router = useRouter();
const btn = ref<HTMLButtonElement | null>(null);
onMounted(() => btn.value?.focus());
async function enter() {
  markEntered();
  await router.replace({ path: '/app/login', query: typeof route.query.next === 'string' ? { next: route.query.next } : {} });
}
</script>

<template>
  <main class="welcome">
    <div class="spot" aria-hidden="true"></div>
    <div class="inner">
      <ArtFrame size="lg" :lit="false" />
      <h1 class="title">{{ ko.museum.name }}</h1>
      <p class="tag">{{ ko.museum.tagline }}</p>
      <button ref="btn" class="btn btn-enter" type="button" @click="enter">{{ ko.museum.enter }}</button>
    </div>
  </main>
</template>

<style scoped>
.welcome{min-height:100vh;min-height:100dvh;background:var(--color-inverse-canvas);color:var(--color-inverse-ink);display:grid;place-items:center;position:relative;overflow:hidden;padding:var(--s-xl) var(--s-md)}
.spot{position:absolute;inset:0;background:radial-gradient(ellipse 38% 55% at 50% 30%,rgba(255,255,255,.22),rgba(255,255,255,0) 70%);animation:lightup 1.4s ease-out both}
.inner{position:relative;display:grid;justify-items:center;gap:var(--s-md);text-align:center;word-break:keep-all}
.inner :deep(.empty .frame){border-color:rgba(255,255,255,.55)}
.inner :deep(.hook){background:var(--color-inverse-ink)}
.title{margin:var(--s-md) 0 0;font:340 56px/1.05 var(--font-sans);letter-spacing:-1px;animation:rise .9s .5s ease-out both}
.tag{font:330 20px/1.4 var(--font-sans);opacity:.85;animation:rise .9s .7s ease-out both}
.btn-enter{background:var(--color-inverse-ink);color:var(--color-ink);padding:10px 28px;margin-top:var(--s-sm);animation:rise .9s .9s ease-out both}
@media (max-width:560px){.title{font-size:38px}}
@keyframes lightup{from{opacity:0}to{opacity:1}}
@keyframes rise{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.spot,.title,.tag,.btn-enter{animation:none}}
</style>
