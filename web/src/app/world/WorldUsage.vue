<script setup lang="ts">
// 사용 기록 창(3D미술관_재설계 §2-22 11, UI 계약 12절, 설계도 8-2). 이 기기에 둔 숫자만 보인다. 시범 사용 중이면 이 화면을 캡처해 보내 달라고 한다.
import { ref } from 'vue';
import type { Usage } from './usage';
import { SERVER_WORLD } from './server/upload';

defineProps<{ usage: Usage; lastBackup: number | null }>();
const emit = defineEmits<{ close: []; clear: [] }>();
const confirm = ref(false);
</script>

<template>
  <div class="sheet" role="dialog" aria-modal="true" aria-label="사용 기록">
    <div class="g-panel sheet-card w-usage">
      <h2>사용 기록</h2>
      <p class="small">이 숫자는 이 기기에만 있어요. 사진과 글은 담지 않고 밖으로 보내지 않아요.</p>
      <dl>
        <dt>올린 작품</dt><dd>{{ usage.uploads }}점</dd>
        <dt>작품을 움직인 횟수</dt><dd>{{ usage.plays }}번</dd>
        <dt>들어온 날</dt><dd>{{ usage.days }}일</dd>
        <dt>자랑하기</dt><dd>{{ usage.shares }}번</dd>
        <template v-if="!SERVER_WORLD"><dt>마지막 백업</dt><dd>{{ lastBackup ? new Date(lastBackup).toLocaleDateString('ko-KR') : '아직 없어요' }}</dd></template>
      </dl>
      <div v-if="!confirm" class="row">
        <button class="g-btn" type="button" @click="confirm = true">기록 지우기</button>
        <button class="g-btn g-btn--primary" type="button" @click="emit('close')">닫기</button>
      </div>
      <div v-else class="row" role="alert">
        <p>사용 기록을 지울까요? 작품은 그대로예요.</p>
        <button class="g-btn g-btn--primary" type="button" @click="confirm = false; emit('clear')">지우기</button>
        <button class="g-btn" type="button" @click="confirm = false">그만두기</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.w-usage dl{display:grid;grid-template-columns:auto 1fr;gap:8px 16px;margin:16px 0}
.w-usage dt{font-weight:600}.w-usage dd{margin:0;text-align:right;font-variant-numeric:tabular-nums}
.w-usage p{margin:0;word-break:keep-all}
.w-usage .row{margin-top:8px;align-items:center}
</style>
