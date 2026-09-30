<script setup lang="ts">
// 미술관 안의 방(D38, SD_02 §17-11): 화면 높이를 꽉 채우는 벽 · 몰딩 · 징두리 · 쪽모이 바닥 · 위에서 내리는 조명. 모두 장식(aria-hidden).
// kind마다 방 안 사물: upload = 아틀리에 이젤 · works = 수장고(원근 있는 옆벽) · bench = 작업대 · desk = 명패 쓰는 책상 · info = 안내 데스크.
import { provide } from 'vue';
defineProps<{ kind: 'upload' | 'works' | 'bench' | 'desk' | 'info' }>();
provide('inRoom', true);
</script>

<template>
  <div class="room" :class="`room-${kind}`">
    <div class="room-bg" aria-hidden="true">
      <span class="r-wall"></span><span class="r-molding"></span><span class="r-wainscot"></span>
      <span class="r-floor"></span><span class="r-light"></span>
      <span v-if="kind === 'works'" class="r-side l"></span><span v-if="kind === 'works'" class="r-side r"></span>
      <span v-if="kind === 'upload'" class="r-easel"><i class="leg a"></i><i class="leg b"></i><i class="leg c"></i><i class="bar"></i></span>
      <span v-if="kind === 'bench' || kind === 'desk'" class="r-table"></span>
      <span v-if="kind === 'info'" class="r-counter"></span>
      <span class="r-vig"></span><span class="r-grain"></span>
    </div>
    <div class="room-body"><slot /></div>
  </div>
</template>

<style scoped>
.room{position:relative;min-height:100dvh;isolation:isolate}
.room-bg{position:fixed;inset:0;z-index:-1;overflow:hidden;pointer-events:none;background:#f3e9dc}
.room-bg span{position:absolute;display:block}
/* 벽: 크림 회반죽 + 옅은 판넬 */
.r-wall{inset:0;background:
  radial-gradient(ellipse 60% 45% at 50% 18%,rgba(255,250,240,.9),rgba(255,250,240,0) 70%),
  repeating-linear-gradient(90deg,rgba(176,138,62,.0) 0 calc(25vw - 1px),rgba(176,138,62,.18) calc(25vw - 1px) 25vw),
  linear-gradient(#f7eee2,#efe2d1 62%,#e7d6c1)}
.r-molding{left:0;right:0;top:64px;height:14px;background:linear-gradient(#e6cb86,#b08a3e 55%,#f3dfa2);box-shadow:0 6px 12px -8px rgba(80,55,20,.5)}
.r-wainscot{left:0;right:0;bottom:26vh;height:13vh;background:linear-gradient(#e9dccb,#dccbb4);box-shadow:inset 0 3px 0 rgba(176,138,62,.55),inset 0 -2px 0 rgba(120,90,50,.25)}
/* 바닥: 헤링본 쪽모이, 원근 */
.r-floor{left:-30%;right:-30%;bottom:-2vh;height:30vh;transform-origin:50% 100%;transform:perspective(520px) rotateX(52deg);
  background:repeating-linear-gradient(45deg,#b48a5f 0 22px,#a07650 22px 44px),repeating-linear-gradient(-45deg,rgba(0,0,0,.08) 0 22px,rgba(255,255,255,.05) 22px 44px);
  background-blend-mode:multiply;box-shadow:inset 0 30px 40px -20px rgba(60,40,20,.5)}
.r-light{left:10%;right:10%;top:0;height:78vh;background:radial-gradient(ellipse 50% 60% at 50% 0%,rgba(255,244,214,.75),rgba(255,244,214,0) 70%)}
.r-vig{inset:0;background:radial-gradient(ellipse 85% 80% at 50% 45%,rgba(40,24,10,0) 55%,rgba(40,24,10,.28))}
.r-grain{inset:0;opacity:.05;mix-blend-mode:multiply;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")}
/* 수장고: 원근 있는 옆벽 */
.r-side{top:78px;bottom:26vh;width:14vw;background:linear-gradient(90deg,#dccbb4,#efe2d1)}
.r-side.l{left:0;transform-origin:0 50%;transform:perspective(700px) rotateY(38deg)}
.r-side.r{right:0;transform-origin:100% 50%;transform:perspective(700px) rotateY(-38deg);background:linear-gradient(-90deg,#dccbb4,#efe2d1)}
/* 아틀리에: 이젤 다리(내용 카드 뒤) */
.r-easel{left:50%;bottom:4vh;width:min(76vw,560px);height:62vh;transform:translateX(-50%)}
.r-easel .leg{position:absolute;bottom:0;width:14px;height:100%;background:linear-gradient(90deg,#7a5230,#a8784a 50%,#6d4726);border-radius:4px;box-shadow:0 10px 16px -8px rgba(0,0,0,.45)}
.r-easel .leg.a{left:10%;transform:rotate(-7deg);transform-origin:50% 0}
.r-easel .leg.b{right:10%;transform:rotate(7deg);transform-origin:50% 0}
.r-easel .leg.c{left:calc(50% - 7px);height:92%;opacity:.7}
.r-easel .bar{position:absolute;left:6%;right:6%;bottom:18%;height:12px;background:linear-gradient(#a8784a,#6d4726);border-radius:4px}
/* 작업대 · 책상 · 안내 데스크 */
.r-table{left:-5%;right:-5%;bottom:0;height:22vh;background:linear-gradient(#8a5d38,#6a4427);transform-origin:50% 100%;transform:perspective(600px) rotateX(24deg);box-shadow:0 -10px 30px -10px rgba(60,35,15,.55)}
.r-counter{left:4%;right:4%;bottom:0;height:20vh;border-radius:18px 18px 0 0;background:linear-gradient(135deg,#f4efe9,#dcd3c8 45%,#f7f3ee 60%,#d6ccc0);box-shadow:0 -8px 30px -12px rgba(60,40,20,.5)}
.room-body{position:relative;z-index:1;padding-top:76px;padding-bottom:22vh}
@media (prefers-reduced-motion:no-preference){.room-body{animation:room-in var(--dur-3) var(--ease-spring) both}}
@keyframes room-in{from{opacity:0;transform:translateY(12px)}}
</style>
