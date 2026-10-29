<script setup lang="ts">
// 지금 저장 상태 한 묶음(3D미술관_재설계 §2-22 6·검토 4). 개인정보·이용 안내와 설정의 백업 묶음이 같은 문장을 쓴다. 바꾸면 두 곳이 함께 바뀐다
import type { StorageMode } from './deviceStorage';

/** persisted: 브라우저가 이 미술관 자료를 지우지 않기로 했는가(null = 이 브라우저는 알려 주지 않음) */
defineProps<{ persisted: boolean | null; lastBackup: number | null; mode: StorageMode }>();
</script>

<template>
  <div class="w-store-state">
    <p v-if="mode === 'ios-tab'" class="w-risk">Safari 탭으로 쓰고 있어요. 7일 동안 열지 않으면 작품이 지워질 수 있어요. 홈 화면에 추가한 뒤 그 앱에서 써 주세요. Safari 탭에서 올린 작품은 홈 화면 앱에 보이지 않아요.</p>
    <p>{{ persisted === true ? '이 브라우저는 저장 공간이 부족해도 이 미술관 자료를 지우지 않기로 했어요.' : persisted === false ? '이 브라우저는 저장 공간이 부족하면 자료를 지울 수 있어요.' : '이 브라우저는 자료를 지우지 않고 둘지 알려 주지 않아요.' }}
      마지막 백업: {{ lastBackup ? new Date(lastBackup).toLocaleDateString('ko-KR') : '아직 없어요' }}</p>
  </div>
</template>

<style scoped>
.w-store-state{display:grid;gap:6px}
.w-store-state p{margin:0;font-size:14px;line-height:1.6;word-break:keep-all}
.w-risk{padding:8px 10px;border-radius:10px;background:#fbe9dc;color:#7a2f1c}
</style>
