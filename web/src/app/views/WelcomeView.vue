<script setup lang="ts">
// S0w 입장(SD_02 §17-4, D26 ⑥ — 동작은 §17-2 그대로) — 로그인 전 첫 방문 한 번만. 아이보리 한 면에 아주 큰 굵은 글자
// "우리 아이 미술관", 글자 안은 아이 그림 같은 색 띠(background-clip), 태그라인 · 짧은 소개 두 줄 · 빨간 가는 선 고리 문양,
// [입장하기](빨간 원형 테두리 + 화살표) → S0a(next 유지). 외부 이미지 없음. 움직임 줄이기면 색 띠 흐름을 멈춘다(motion.css).
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
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

/** 빨간 가는 선 고리 문양(스피로그래프 — 장식) */
function spiro(R: number, r: number, d: number, turns: number) {
  const pts: string[] = [];
  for (let t = 0; t <= Math.PI * 2 * turns; t += 0.04) {
    const x = (R - r) * Math.cos(t) + d * Math.cos(((R - r) / r) * t);
    const y = (R - r) * Math.sin(t) - d * Math.sin(((R - r) / r) * t);
    pts.push(`${(x + 110).toFixed(1)},${(y + 110).toFixed(1)}`);
  }
  return `M${pts.join('L')}`;
}
const RING = spiro(96, 41, 50, 41);
const RING2 = spiro(90, 33, 44, 33);
</script>

<template>
  <main class="welcome">
    <svg class="ring r1" viewBox="0 0 220 220" aria-hidden="true" focusable="false"><path :d="RING" /></svg>
    <svg class="ring r2" viewBox="0 0 220 220" aria-hidden="true" focusable="false"><path :d="RING2" /></svg>

    <div class="top">
      <p class="intro">{{ ko.museum.intro1 }}<br>{{ ko.museum.intro2 }}</p>
    </div>

    <div class="sign">
      <p class="eyebrow">{{ ko.museum.tagline }}</p>
      <h1 class="title">{{ ko.museum.name }}</h1>
    </div>

    <div class="door">
      <button ref="btn" class="enter" type="button" @click="enter">{{ ko.museum.enter }} <span class="arrow" aria-hidden="true">→</span></button>
    </div>
  </main>
</template>

<style scoped>
.welcome{position:relative;min-height:100vh;min-height:100dvh;overflow:hidden;display:grid;grid-template-rows:auto 1fr auto;background:var(--color-canvas);
  padding:clamp(20px,4vw,48px);word-break:keep-all}
.ring{position:absolute;fill:none;stroke:var(--color-accent-magenta);stroke-width:.35;opacity:.8;pointer-events:none}
.r1{width:clamp(220px,30vw,420px);left:-6%;bottom:-10%}
.r2{width:clamp(140px,16vw,240px);right:6%;top:14%;opacity:.55}
.top{position:relative;display:flex;justify-content:flex-end}
.intro{max-width:340px;font:500 15px/1.6 var(--font-sans);color:var(--color-ink)}
.sign{position:relative;align-self:center;display:grid;gap:var(--s-sm)}
.eyebrow{font:700 clamp(18px,2vw,26px)/1.3 var(--font-sans);color:var(--color-accent-magenta);letter-spacing:-.01em}
/* 글자 안을 동화책 색 띠로 — 장미 · 라일락 · 민트 · 하늘(v3, D31 ②). 가장 옅은 띠도 바탕 대비 3.19:1(큰 글자 기준 3:1 이상) */
.title{margin:0;font:800 clamp(56px,13vw,200px)/.95 var(--font-sans);letter-spacing:-.05em;
  background:linear-gradient(100deg,#b8618a 0%,#9a74c4 22%,#d0708f 38%,#4e9a96 52%,#7584c8 68%,#9a74c4 84%,#b8618a 100%) 0 0/200% 100%;
  -webkit-background-clip:text;background-clip:text;color:transparent;animation:flow 14s linear infinite}
@keyframes flow{to{background-position:200% 0}}
.door{position:relative;display:flex;justify-content:flex-start;padding-bottom:clamp(8px,3vh,32px)}
.enter{display:inline-flex;align-items:center;gap:14px;background:var(--color-canvas);color:var(--color-ink);border:1px solid var(--color-accent-magenta);
  border-radius:var(--r-pill);padding:14px 16px 14px 28px;font:700 20px/1 var(--font-sans);cursor:pointer}
.enter .arrow{display:grid;place-items:center;width:40px;height:40px;border-radius:50%;background:var(--color-primary);color:var(--color-on-primary);font-size:18px}
.enter:hover{background:var(--color-surface-soft)}
@media (max-width:560px){.title{font-size:21vw;line-height:1}}
@media (prefers-reduced-motion:reduce){.title{animation:none}}
</style>
