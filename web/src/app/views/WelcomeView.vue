<script setup lang="ts">
// S0w 입장(D25, SD_02 §17-2) — 로그인 전 첫 방문 한 번만. 밝은 그랜드 홀: 유리 아치 천장 · 양옆 기둥 회랑 · 걸린 배너 ·
// 벽에 걸린 아이 그림 액자 · 반사 바닥 · 가운데 조명 받은 대표 액자, 그 위 간판과 [입장하기] → S0a(next 유지).
// 장면은 인라인 SVG로 직접 그린다(외부 이미지 없음), 색은 스타일가이드 토큰. 빛·배너 움직임은 움직임 줄이기면 멈춘다(motion.css).
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

// ---- 장면 기하(소실점 VP 하나) ----
const VP = { x: 720, y: 470 };
const FLOOR_Y = 565; // 소실선(바닥이 시작하는 높이)
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** 왼쪽 회랑의 깊이 t(0 앞 ~ 1 뒤)에서 벽의 위·아래 y와 x */
const wallAt = (t: number) => ({ x: lerp(0, 610, t), top: lerp(300, 470, t), bottom: lerp(900, FLOOR_Y, t) });
const COLS = [0.02, 0.36, 0.6, 0.76, 0.87, 0.94].map((t) => { const w = wallAt(t); const width = lerp(96, 10, t); return { t, ...w, width }; });
/** 기둥 사이 벽에 건 아이 그림 액자(깊이 가운데) */
const TOKENS = ['lime', 'pink', 'mint', 'lilac', 'coral'];
const FRAMES = COLS.slice(0, -1).map((c, i) => {
  const n = COLS[i + 1]!;
  const t = (c.t + n.t) / 2; const w = wallAt(t);
  const h = (w.bottom - w.top) * 0.26; const fw = (n.x - c.x - c.width) * 0.62;
  return { x: (c.x + c.width + n.x) / 2 - fw / 2, y: w.top + (w.bottom - w.top) * 0.3, w: fw, h, color: TOKENS[i % TOKENS.length], kind: i % 3 };
});
/** 천장 볼트: 소실점 쪽으로 작아지는 아치 */
const VAULTS = [0, 1, 2, 3, 4, 5].map((i) => {
  const t = i / 6; const half = lerp(900, 150, Math.sqrt(t)); const base = lerp(360, 470, t); const peak = lerp(-220, 330, Math.sqrt(t));
  return `M ${720 - half} ${base} Q 720 ${peak} ${720 + half} ${base}`;
});
/** 바닥 줄눈: 소실점에서 퍼지는 선 + 원근 가로줄 */
const FLOOR_RAYS = Array.from({ length: 15 }, (_, i) => -560 + i * 180);
const FLOOR_ROWS = Array.from({ length: 7 }, (_, k) => FLOOR_Y + (900 - FLOOR_Y) * ((k + 1) / 7) ** 2);
</script>

<template>
  <main class="welcome">
    <svg class="scene" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="w-glass" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="var(--color-block-mint)" />
          <stop offset="1" stop-color="var(--color-canvas)" />
        </linearGradient>
        <linearGradient id="w-stone" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="var(--color-block-cream)" />
          <stop offset="1" stop-color="var(--color-surface-soft)" />
        </linearGradient>
        <linearGradient id="w-floor" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="var(--color-canvas)" />
          <stop offset="1" stop-color="var(--color-block-cream)" />
        </linearGradient>
        <radialGradient id="w-door" cx="0.5" cy="0.6" r="0.6">
          <stop offset="0" stop-color="var(--color-canvas)" />
          <stop offset="1" stop-color="var(--color-block-cream)" />
        </radialGradient>
        <clipPath id="w-floor-clip"><polygon points="0,900 610,565 830,565 1440,900" /></clipPath>
        <radialGradient id="w-spot" cx="0.5" cy="0" r="1">
          <stop offset="0" stop-color="var(--color-canvas)" stop-opacity=".9" />
          <stop offset="1" stop-color="var(--color-canvas)" stop-opacity="0" />
        </radialGradient>
      </defs>

      <!-- 바탕 석조 벽 -->
      <rect width="1440" height="900" fill="url(#w-stone)" />
      <!-- 유리 아치 천장과 볼트 -->
      <path d="M -200 360 Q 720 -300 1640 360 L 1640 -10 L -200 -10 Z" fill="url(#w-glass)" />
      <g fill="none" stroke="var(--color-canvas)" stroke-width="6" opacity=".95">
        <path v-for="(d, i) in VAULTS" :key="i" :d="d" />
      </g>
      <g stroke="var(--color-canvas)" stroke-width="3" opacity=".8">
        <line v-for="k in 9" :key="k" :x1="720" :y1="330" :x2="-200 + (k - 1) * 230" :y2="-10" />
      </g>
      <!-- 안쪽 벽과 빛나는 아치문 -->
      <rect x="560" y="300" width="320" height="270" fill="var(--color-block-cream)" />
      <path d="M 640 565 L 640 420 Q 720 330 800 420 L 800 565 Z" fill="url(#w-door)" />
      <!-- 양옆 벽 -->
      <polygon points="0,300 610,470 610,565 0,900" fill="color-mix(in srgb,var(--color-block-cream) 88%,var(--color-ink))" />
      <polygon points="1440,300 830,470 830,565 1440,900" fill="color-mix(in srgb,var(--color-block-cream) 88%,var(--color-ink))" />
      <!-- 벽 위 몰딩 · 걸레받이 -->
      <g stroke="var(--color-canvas)" stroke-width="10" stroke-linecap="round">
        <line x1="0" y1="330" x2="610" y2="476" /><line x1="1440" y1="330" x2="830" y2="476" />
      </g>
      <g stroke="color-mix(in srgb,var(--color-ink) 55%,var(--color-block-cream))" stroke-width="12">
        <line x1="0" y1="880" x2="610" y2="560" /><line x1="1440" y1="880" x2="830" y2="560" />
      </g>
      <!-- 벽의 아이 그림 액자(왼쪽·오른쪽 대칭) -->
      <g v-for="side in [1, -1]" :key="side" :transform="side === -1 ? 'translate(1440 0) scale(-1 1)' : undefined">
        <g v-for="(f, i) in FRAMES" :key="i">
          <rect :x="f.x - 3" :y="f.y - 3" :width="f.w + 6" :height="f.h + 6" fill="var(--color-ink)" />
          <rect :x="f.x" :y="f.y" :width="f.w" :height="f.h" fill="var(--color-canvas)" />
          <circle v-if="f.kind === 0" :cx="f.x + f.w * 0.5" :cy="f.y + f.h * 0.5" :r="Math.min(f.w, f.h) * 0.28" :fill="`var(--color-block-${f.color})`" />
          <polygon v-else-if="f.kind === 1" :points="`${f.x + f.w * .2},${f.y + f.h * .8} ${f.x + f.w * .5},${f.y + f.h * .25} ${f.x + f.w * .8},${f.y + f.h * .8}`" :fill="`var(--color-block-${f.color})`" />
          <rect v-else :x="f.x + f.w * .2" :y="f.y + f.h * .35" :width="f.w * .6" :height="f.h * .4" :fill="`var(--color-block-${f.color})`" />
        </g>
      </g>
      <!-- 기둥 회랑 -->
      <g v-for="side in [1, -1]" :key="`c${side}`" :transform="side === -1 ? 'translate(1440 0) scale(-1 1)' : undefined">
        <g v-for="(c, i) in COLS" :key="i">
          <rect :x="c.x" :y="c.top + 10" :width="c.width" :height="c.bottom - c.top - 10" fill="var(--color-canvas)" />
          <rect :x="c.x + c.width * .72" :y="c.top + 10" :width="c.width * .28" :height="c.bottom - c.top - 10" fill="var(--color-block-cream)" />
          <line v-for="k in 3" :key="k" :x1="c.x + c.width * (k / 4)" :x2="c.x + c.width * (k / 4)" :y1="c.top + 24" :y2="c.bottom - 16"
            stroke="var(--color-hairline)" :stroke-width="Math.max(1, c.width / 30)" />
          <rect :x="c.x - c.width * .15" :y="c.top" :width="c.width * 1.3" :height="Math.max(6, c.width * .35)" fill="var(--color-canvas)" />
          <rect :x="c.x - c.width * .12" :y="c.bottom - Math.max(6, c.width * .3)" :width="c.width * 1.24" :height="Math.max(6, c.width * .3)" fill="var(--color-canvas)" />
        </g>
      </g>
      <!-- 천장에서 늘어진 배너 -->
      <g class="banners">
        <g class="sway">
          <line x1="250" y1="120" x2="250" y2="160" stroke="var(--color-ink)" stroke-width="2" /><line x1="316" y1="130" x2="316" y2="165" stroke="var(--color-ink)" stroke-width="2" />
          <path d="M 236 160 L 330 165 L 330 420 L 283 395 L 236 420 Z" fill="var(--color-block-lime)" />
          <circle cx="283" cy="235" r="26" fill="var(--color-canvas)" /><circle cx="283" cy="235" r="12" fill="var(--color-block-pink)" />
        </g>
        <g class="sway late">
          <line x1="1190" y1="120" x2="1190" y2="160" stroke="var(--color-ink)" stroke-width="2" /><line x1="1124" y1="130" x2="1124" y2="165" stroke="var(--color-ink)" stroke-width="2" />
          <path d="M 1204 160 L 1110 165 L 1110 420 L 1157 395 L 1204 420 Z" fill="var(--color-block-pink)" />
          <circle cx="1157" cy="235" r="26" fill="var(--color-canvas)" /><circle cx="1157" cy="235" r="12" fill="var(--color-block-lilac)" />
        </g>
      </g>
      <!-- 바닥: 반사되는 줄눈 -->
      <polygon points="0,900 610,565 830,565 1440,900" fill="url(#w-floor)" />
      <g stroke="var(--color-hairline)" stroke-width="2" clip-path="url(#w-floor-clip)">
        <line v-for="x in FLOOR_RAYS" :key="x" :x1="720" :y1="FLOOR_Y" :x2="x" :y2="900" />
        <line v-for="y in FLOOR_ROWS" :key="y" x1="0" :x2="1440" :y1="y" :y2="y" />
      </g>
      <!-- 천창에서 내려오는 빛 -->
      <g class="rays" fill="var(--color-canvas)">
        <polygon points="520,0 640,0 760,900 520,900" opacity=".22" />
        <polygon points="800,0 900,0 980,900 820,900" opacity=".16" />
      </g>
      <!-- 가운데 대표 작품: 받침대 + 조명 받은 액자 -->
      <ellipse cx="720" cy="640" rx="210" ry="120" fill="url(#w-spot)" />
      <rect x="668" y="690" width="104" height="120" fill="var(--color-canvas)" /><rect x="652" y="682" width="136" height="16" fill="var(--color-canvas)" />
      <rect x="760" y="690" width="12" height="120" fill="var(--color-block-cream)" />
      <rect x="640" y="540" width="160" height="136" fill="var(--color-ink)" />
      <rect x="650" y="550" width="140" height="116" fill="var(--color-canvas)" />
      <circle cx="752" cy="578" r="16" fill="var(--color-block-lime)" />
      <path d="M 668 650 L 668 612 L 700 590 L 732 612 L 732 650 Z" fill="none" stroke="var(--color-block-coral)" stroke-width="5" stroke-linejoin="round" />
      <line x1="660" y1="652" x2="780" y2="652" stroke="var(--color-block-mint)" stroke-width="6" stroke-linecap="round" />
    </svg>

    <div class="sign">
      <p class="eyebrow">{{ ko.museum.tagline }}</p>
      <h1 class="title">{{ ko.museum.name }}</h1>
    </div>
    <div class="door">
      <button ref="btn" class="btn btn-enter" type="button" @click="enter">{{ ko.museum.enter }}</button>
    </div>
  </main>
</template>

<style scoped>
.welcome{position:relative;min-height:100vh;min-height:100dvh;overflow:hidden;display:grid;grid-template-rows:auto 1fr auto;justify-items:center;background:var(--color-block-cream);word-break:keep-all}
.scene{position:absolute;inset:0;width:100%;height:100%}
.rays{animation:shimmer 6s ease-in-out infinite alternate}
.sway{transform-box:fill-box;transform-origin:50% 0;animation:sway 7s ease-in-out infinite alternate}
.sway.late{animation-delay:-3s}
@keyframes shimmer{from{opacity:.7}to{opacity:1}}
@keyframes sway{from{transform:rotate(-1.2deg)}to{transform:rotate(1.2deg)}}
/* 입체 간판 — 흰 글자 + 검은 외곽선 + 아래로 쌓인 그림자 */
.sign{position:relative;margin-top:clamp(24px,7vh,72px);text-align:center;padding:0 var(--s-md);animation:rise .9s .2s ease-out both}
.eyebrow{display:inline-block;background:var(--color-inverse-canvas);color:var(--color-inverse-ink);font:540 16px/1 var(--font-sans);padding:10px 18px;border-radius:var(--r-pill);box-shadow:var(--elev-2)}
.title{margin:14px 0 0;color:var(--color-canvas);font:800 clamp(44px,8.5vw,112px)/1.02 var(--font-sans);letter-spacing:-.02em;
  -webkit-text-stroke:clamp(2px,.35vw,5px) var(--color-ink);paint-order:stroke fill;
  text-shadow:0 4px 0 var(--color-ink),0 8px 0 var(--color-ink),0 16px 28px rgba(0,0,0,.28)}
.door{position:relative;align-self:end;padding-bottom:clamp(28px,8vh,80px);animation:rise .9s .6s ease-out both}
.btn-enter{background:var(--color-primary);color:var(--color-on-primary);font-size:22px;padding:14px 40px;box-shadow:var(--elev-3)}
@keyframes rise{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
</style>
