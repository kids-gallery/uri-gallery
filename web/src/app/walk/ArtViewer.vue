<script setup lang="ts">
// 크게 보기(SD_02 §17-6): 가린 화면 위 큰 금빛 액자 + 아이의 한마디 + 전시 해설(StoryCard). 움직이는 그림은 누를 때만(UX4).
// Esc · [닫기] · 바깥 탭으로 닫고, 초점은 부모가 연 액자로 돌려준다.
import { nextTick, onMounted, ref } from 'vue';
import type { components } from '@/api/types.gen';
import ArtFrame from '@/components/ArtFrame.vue';
import StoryCard from '@/components/StoryCard.vue';
import { ko } from '@/copy/ko';
import { reducedMotion } from '@/composables/usePolling';

type Item = components['schemas']['GalleryItem'];
const props = defineProps<{ item: Item; alias: string; still: string | null }>();
const emit = defineEmits<{ close: [] }>();
const playing = ref(false);
const closeBtn = ref<HTMLButtonElement | null>(null);
onMounted(async () => { await nextTick(); closeBtn.value?.focus(); });
function trap(e: KeyboardEvent) {
  if (e.key === 'Escape') { e.preventDefault(); emit('close'); return; }
  if (e.key !== 'Tab') return;
  const box = (e.currentTarget as HTMLElement).querySelectorAll<HTMLElement>('button, [href], [tabindex]:not([tabindex="-1"])');
  const first = box[0]; const last = box[box.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
}
</script>

<template>
  <div class="av-scrim" @click.self="emit('close')">
    <div class="av" role="dialog" aria-modal="true" aria-labelledby="av-title" @keydown="trap">
      <button ref="closeBtn" class="av-close" type="button" @click="emit('close')">{{ ko.walk.close }} <span aria-hidden="true">✕</span></button>
      <div class="av-art">
        <span class="av-spot" aria-hidden="true"></span>
        <ArtFrame size="lg" variant="gold" :src="props.still" :video="props.item.kind === 'animated' ? props.item.primaryUrl ?? null : null" :playing="playing" :alt="props.item.title" />
        <button v-if="props.item.kind === 'animated' && props.item.primaryUrl && !reducedMotion()" class="btn btn-primary" type="button" :aria-pressed="playing" @click="playing = !playing">
          {{ playing ? ko.museum.stop : ko.museum.play }}
        </button>
      </div>
      <aside class="av-label">
        <div v-if="props.item.childWords" class="av-words">
          <p class="av-words-h">{{ ko.museum.childWords }}</p>
          <p class="av-words-q">“{{ props.item.childWords }}”</p>
        </div>
        <!-- 자동 제목이면 조용히 권한다(D34 ③, SD_02 §17-9) — 강요 없음 -->
        <p v-if="(props.item as { titleAuto?: boolean }).titleAuto" class="av-ask">{{ ko.photo.titleAsk }}
          <RouterLink :to="`/app/artworks/${props.item.id}/story`">{{ ko.photo.titleWrite }}</RouterLink></p>
        <StoryCard :item="props.item" :alias="props.alias" title-id="av-title" />
      </aside>
    </div>
  </div>
</template>

<style scoped>
.av-scrim{position:fixed;inset:0;z-index:50;background:rgba(44,34,56,.62);display:grid;place-items:center;padding:16px;overflow-y:auto}
.av{position:relative;width:min(1100px,100%);background:var(--walk-wall,#FFF6EA);border-radius:var(--r-lg);padding:clamp(16px,3vw,36px);
  display:grid;grid-template-columns:minmax(0,1.4fr) minmax(260px,1fr);gap:clamp(16px,3vw,40px);align-items:center;box-shadow:var(--elev-3);max-height:calc(100dvh - 32px);overflow-y:auto}
@media (max-width:860px){.av{grid-template-columns:minmax(0,1fr)}}
.av-close{justify-self:end;grid-column:1 / -1;background:rgba(255,251,247,.9);border:1px solid var(--color-hairline);border-radius:var(--r-pill);padding:8px 14px;font:600 15px/1 var(--font-sans);color:var(--color-ink);cursor:pointer;min-height:44px}
.av-art{position:relative;display:grid;justify-items:center;gap:var(--s-sm);min-width:0}
.av-spot{position:absolute;inset:-10% -5% 20%;background:radial-gradient(ellipse 55% 60% at 50% 20%,rgba(255,255,255,.75),transparent 70%);pointer-events:none}
.av-art :deep(.is-lg){--art-max-w:min(calc(100vw - 96px),620px)}
.av-label{background:var(--color-canvas);border:1px solid var(--color-hairline);border-radius:var(--r-lg);padding:var(--s-lg);display:grid;gap:var(--s-sm);color:var(--color-ink)}
.av-words{background:var(--color-block-pink);border-radius:var(--r-md);padding:var(--s-md)}
.av-words-h{font:600 13px/1.2 var(--font-sans);letter-spacing:.6px}
.av-ask{display:flex;flex-wrap:wrap;gap:8px;align-items:center;font:500 14px/1.4 var(--font-sans);color:var(--color-ink)}
.av-ask a{color:var(--color-primary);font-weight:700;text-underline-offset:3px}
.av-words-q{margin-top:6px;font:600 22px/1.45 var(--mc-serif,var(--font-sans))}
</style>
