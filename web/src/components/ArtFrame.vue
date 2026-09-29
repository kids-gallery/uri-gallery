<script setup lang="ts">
// 흑백 액자(SD_02 §17-2 토큰 사상, 스타일가이드 원칙 01 "흑백 프레임 · 작품이 주인공").
// 검은 테두리 + 흰 매트 + 그림자, 위에서 비추는 조명. 그림은 잘라 내지 않는다(object-fit: contain — "그림이 잘려 보여요" 해결),
// 액자는 그림 비율을 따르고 높이만 맞춘다(같은 크기 — BR-EXH-02). 파일을 못 읽으면 액자 안에만 §17 전역 실패 문구.
// src가 없으면 빈 액자 걸이(빈 상태·입장 화면). gold면 르네상스 전시관의 금박 액자(D25 ⑥ — 전시 공간에서만, museum.css 팔레트).
import { ref, watch } from 'vue';
import { ko } from '@/copy/ko';

const props = withDefaults(defineProps<{ src?: string | null; video?: string | null; playing?: boolean; alt?: string; size?: 'sm' | 'md' | 'lg'; lit?: boolean; gold?: boolean }>(),
  { src: null, video: null, playing: false, alt: '', size: 'md', lit: true, gold: false });
const emit = defineEmits<{ reload: [] }>();
const broken = ref(false);
const videoEl = ref<HTMLVideoElement | null>(null);
watch(() => props.src, () => { broken.value = false; });
watch(() => props.playing, (p) => {
  const v = videoEl.value;
  if (!v) return;
  if (p) void v.play().catch(() => undefined); else v.pause();
});
</script>

<template>
  <div class="artframe" :class="[`is-${size}`, { lit, gold, empty: !src }]">
    <div class="frame">
      <div class="mat">
        <template v-if="src && !broken">
          <video v-if="video" ref="videoEl" :src="video" :poster="src" playsinline loop muted preload="metadata" :aria-label="alt" @error="broken = true" />
          <img v-else :src="src" :alt="alt" @error="broken = true">
        </template>
        <div v-else-if="src && broken" class="fail t-body-sm" role="status">
          {{ ko.fail.file }} <button class="btn btn-tertiary" type="button" @click.stop="emit('reload')">{{ ko.fail.fileRetry }}</button>
        </div>
        <div v-else class="hook" aria-hidden="true"></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.artframe{position:relative;display:inline-flex;max-width:100%;flex-direction:column;align-items:center;padding-top:28px}
/* 위에서 비추는 조명(부채꼴) */
.artframe.lit::before{content:"";position:absolute;top:-8px;left:50%;width:min(180%,100vw);height:calc(100% + 24px);transform:translateX(-50%);pointer-events:none;
  background:radial-gradient(ellipse 50% 60% at 50% 0,rgba(255,255,255,.75),rgba(255,255,255,0) 70%)}
/* 흑백 액자 — 테두리 두 겹(바깥 검정 + 안쪽 가는 회색 선) + 흰 매트 + 벽에 드리운 그림자 */
.frame{position:relative;background:var(--color-ink);padding:7px;border-radius:2px;box-shadow:inset 0 0 0 2px color-mix(in srgb,var(--color-canvas) 22%,var(--color-ink)),var(--elev-3),0 3px 0 rgba(0,0,0,.35)}
.mat{background:var(--color-canvas);padding:14px;display:grid;place-items:center;box-shadow:inset 0 2px 6px rgba(0,0,0,.18)}
.is-sm .mat{padding:10px}
.is-lg .mat{padding:24px}
.mat img,.mat video{display:block;height:var(--art-h,200px);width:auto;max-width:min(calc(100vw - 96px),var(--art-max-w,340px));object-fit:contain}
.is-sm{--art-h:140px;--art-max-w:220px}
.is-lg{--art-h:min(56vh,480px);--art-max-w:min(calc(100vw - 96px),640px)}
@media (max-width:560px){.is-md{--art-h:160px}.is-lg{--art-h:min(46vh,360px)}}
.fail{height:var(--art-h,200px);width:calc(var(--art-h,200px) * 1.2);display:grid;place-items:center;text-align:center;padding:var(--s-sm)}
/* 빈 액자 걸이 — 못과 끈만 */
.empty .frame{background:transparent;box-shadow:none;border:2px dashed color-mix(in srgb,var(--color-ink) 35%,transparent)}
.empty .mat{background:transparent;height:var(--art-h,200px);width:calc(var(--art-h,200px) * .8)}
.hook{width:10px;height:10px;border-radius:50%;background:var(--color-ink);position:relative;top:calc(var(--art-h,200px) * -.5 - 10px)}
/* 금박 액자 — 금속 그라데이션 테두리(바깥 몰딩 + 안쪽 턱) + 상아색 매트 */
.gold .frame{padding:12px;border-radius:1px;
  background:linear-gradient(135deg,var(--museum-gold-3) 0%,var(--museum-gold-1) 20%,var(--museum-gold-2) 42%,var(--museum-gold-1) 60%,var(--museum-gold-3) 100%);
  box-shadow:inset 0 0 0 2px var(--museum-gold-3),inset 0 0 0 5px var(--museum-gold-1),inset 0 0 0 7px var(--museum-gold-3),0 10px 24px rgba(0,0,0,.45),0 3px 0 rgba(0,0,0,.35)}
.gold .mat{background:var(--museum-marble-1);box-shadow:inset 0 0 0 1px var(--museum-gold-2),inset 0 3px 8px rgba(0,0,0,.25)}
.gold.empty .frame{background:transparent;box-shadow:none;border:2px dashed var(--museum-gold-2)}
.gold.empty .mat{background:transparent;box-shadow:none}
.gold .hook{background:var(--museum-gold-2)}
.gold.lit::before{background:radial-gradient(ellipse 50% 60% at 50% 0,rgba(255,236,190,.45),rgba(255,236,190,0) 70%)}
</style>
