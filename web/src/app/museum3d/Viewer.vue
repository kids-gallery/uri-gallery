<script setup lang="ts">
// 방문자 크게 보기(D40, SD_02 §17-13 F) — 그림 · 제목만. 한마디 · 감상평 · 그린 날 · 저장하기 없음.
// (가족은 walk/ArtViewer.vue를 그대로 쓴다.) Esc · [닫기] · 바깥 누름으로 닫고, 초점은 부르는 쪽이 돌려준다.
import { nextTick, onMounted, ref } from 'vue';
import ArtFrame from '@/components/ArtFrame.vue';
import { reducedMotion } from '@/composables/usePolling';
import type { MuseumItem } from './layout';
import { m3 } from './copy';

const props = defineProps<{ item: MuseumItem; alias: string }>();
const emit = defineEmits<{ close: [] }>();
const playing = ref(false);
const closeBtn = ref<HTMLButtonElement | null>(null);
onMounted(async () => { await nextTick(); closeBtn.value?.focus(); });
function trap(e: KeyboardEvent) {
  if (e.key === 'Escape') { e.preventDefault(); emit('close'); return; }
  if (e.key !== 'Tab') return;
  const box = (e.currentTarget as HTMLElement).querySelectorAll<HTMLElement>('button, [href]');
  const first = box[0]; const last = box[box.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
}
</script>

<template>
  <div class="vw-scrim" @click.self="emit('close')">
    <div class="vw" role="dialog" aria-modal="true" aria-labelledby="vw-title" @keydown="trap">
      <button ref="closeBtn" class="vw-close" type="button" @click="emit('close')">{{ m3.close }} <span aria-hidden="true">✕</span></button>
      <ArtFrame size="lg" variant="gold" :src="props.item.imageUrl" :video="props.item.kind === 'animated' ? props.item.videoUrl ?? null : null" :playing="playing" :alt="props.item.title ?? m3.untitled" />
      <button v-if="props.item.kind === 'animated' && props.item.videoUrl && !reducedMotion()" class="btn btn-primary" type="button" :aria-pressed="playing" @click="playing = !playing">
        {{ playing ? m3.stop : m3.play }}
      </button>
      <h2 id="vw-title">{{ props.item.title ?? m3.untitled }}</h2>
      <p>{{ m3.title(props.alias) }}</p>
    </div>
  </div>
</template>

<style scoped>
.vw-scrim{position:fixed;inset:0;z-index:50;display:grid;place-items:center;padding:16px;overflow-y:auto;background:rgba(44,34,56,.55)}
.vw{position:relative;width:min(760px,100%);max-height:calc(100dvh - 32px);overflow-y:auto;display:grid;justify-items:center;gap:12px;padding:clamp(16px,3vw,32px);
  border-radius:24px;background:#FFF6EA;color:#6E3550;box-shadow:0 16px 48px rgba(110,53,80,.14)}
.vw :deep(.is-lg){--art-max-w:min(calc(100vw - 96px),560px)}
.vw-close{justify-self:end;min-height:44px;padding:8px 14px;border:1px solid #EBD5D6;border-radius:999px;background:rgba(255,251,247,.9);color:#6E3550;font:600 15px/1 var(--font-sans);cursor:pointer}
.vw h2{margin:0;font:700 22px/1.35 var(--font-sans);text-align:center}
.vw p{margin:0;font:500 14px/1.4 var(--font-sans)}
</style>
