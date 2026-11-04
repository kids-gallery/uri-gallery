<script setup lang="ts">
// 미니맵(마스터플랜 3-3 #137). 조작을 막지 않게 누를 수 없고, 1초에 여덟 번만 다시 그린다.
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { drawMinimap, type MinimapData } from './minimap';

const props = defineProps<{ read: () => MinimapData | null }>();
const canvas = ref<HTMLCanvasElement | null>(null);
let timer: ReturnType<typeof setInterval> | null = null;

onMounted(() => {
  const c = canvas.value!, g = c.getContext('2d');
  if (!g) return;
  const size = c.clientWidth || 92, ratio = Math.min(window.devicePixelRatio || 1, 2);
  c.width = c.height = Math.round(size * ratio);
  g.scale(ratio, ratio);
  const draw = () => { const d = props.read(); if (d?.floors.length) drawMinimap(g, size, d); };
  draw();
  timer = setInterval(draw, 125);
});
onBeforeUnmount(() => { if (timer) clearInterval(timer); });
</script>

<template>
  <canvas ref="canvas" class="w-minimap" role="img" aria-label="미술관 지도" />
</template>

<style scoped>
.w-minimap{position:absolute;z-index:9;right:max(12px,env(safe-area-inset-right,0px));bottom:calc(env(safe-area-inset-bottom,0px) + 126px);width:92px;height:92px;border-radius:14px;background:rgba(20,18,16,.55);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,.22);pointer-events:none}
@media (min-width:900px){.w-minimap{width:148px;height:148px;bottom:calc(env(safe-area-inset-bottom,0px) + 74px)}}
</style>
