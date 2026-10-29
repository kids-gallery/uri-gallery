<script setup lang="ts">
// iPhone·iPad 브라우저 탭에서 첫 작품을 올리기 전 저장 안내(3D미술관_재설계 §2-22 5, UI 계약 9절).
// 근거: WebKit은 7일 동안 열지 않은 사이트의 저장소를 지우고, 홈 화면 앱은 빼되 자료를 따로 둔다.
import { ref } from 'vue';

const emit = defineEmits<{ go: []; close: [] }>();
const how = ref(false);
</script>

<template>
  <div class="sheet" role="dialog" aria-modal="true" aria-label="홈 화면에 추가하기">
    <div class="g-panel sheet-card w-gate">
      <h2>홈 화면에 추가한 뒤 올려 주세요</h2>
      <p>홈 화면에 추가한 뒤 그 앱에서 올려 주세요. Safari 탭으로 쓰면 7일 동안 열지 않을 때 작품이 지워질 수 있어요.</p>
      <ol v-if="how" class="w-gate-steps">
        <li>화면의 공유 단추(네모에서 위로 향한 화살표)를 눌러요.</li>
        <li>‘홈 화면에 추가’를 눌러요.</li>
        <li>홈 화면에 생긴 ‘우리 아이 미술관’으로 열어요.</li>
      </ol>
      <p class="small">Safari 탭에서 올린 작품은 홈 화면 앱에 보이지 않아요. 둘은 따로 저장돼요.</p>
      <div class="row">
        <button class="g-btn g-btn--primary" type="button" :aria-expanded="how" @click="how = !how">추가하는 방법</button>
        <button class="g-btn" type="button" @click="emit('go')">그래도 여기서 올리기</button>
        <button class="g-btn" type="button" @click="emit('close')">닫기</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.w-gate p{margin:0 0 10px;line-height:1.6;word-break:keep-all}
.w-gate-steps{margin:0 0 12px;padding-left:22px;line-height:1.7;word-break:keep-all}
/* §2-22 검토 7: 폭 375px 이하에서도 단추가 화면 안에 들게 줄을 바꾼다 */
.w-gate .row{flex-wrap:wrap}
</style>
