<script setup lang="ts">
// 움직여 보기 창(마스터플랜 3-3 #137): 작품이 움직이는 것을 보고 [나가기]로 전시실에 돌아온다.
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { MotionStage, type MotionSource } from './motionStage';

const props = defineProps<{ source: MotionSource }>();
const emit = defineEmits<{ close: []; failed: [] }>();
const canvas = ref<HTMLCanvasElement | null>(null);
const playing = ref(true);
let stage: MotionStage | null = null;

function again() { playing.value = true; stage?.play(); }
onMounted(() => {
  try {
    stage = new MotionStage(canvas.value!, props.source, () => { playing.value = false; });
    stage.play();
  } catch {
    emit('failed');
  }
});
onBeforeUnmount(() => stage?.dispose());
</script>

<template>
  <div class="w-motion" role="dialog" aria-modal="true" aria-label="움직여 보기">
    <div class="g-panel w-motion-card">
      <div class="w-motion-stage"><canvas ref="canvas" aria-label="작품이 움직이는 모습" /></div>
      <div class="w-motion-actions">
        <button class="g-btn" type="button" :disabled="playing" @click="again">{{ playing ? '움직이는 중…' : '다시 움직이기' }}</button>
        <button class="g-btn g-btn--primary" type="button" @click="emit('close')">나가기</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.w-motion{position:absolute;inset:0;z-index:20;display:grid;place-items:center;box-sizing:border-box;padding:calc(env(safe-area-inset-top,0px) + 12px) 12px calc(env(safe-area-inset-bottom,0px) + 12px);background:rgba(40,28,18,.55)}
.w-motion-card{box-sizing:border-box;width:min(680px,100%);height:min(680px,100%);display:grid;grid-template-rows:1fr auto;gap:10px;padding:12px}
.w-motion-stage{position:relative;min-height:0;border-radius:12px;overflow:hidden;background:linear-gradient(#fdf8ec 0 64%,#efe2c6 64% 100%)}
.w-motion-stage canvas{position:absolute;inset:0;width:100%;height:100%;display:block}
.w-motion-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.w-motion-actions .g-btn{min-height:48px;justify-content:center}
</style>
