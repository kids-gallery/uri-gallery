<script setup lang="ts">
// [더보기] 안의 친구 초대·미술관 마을 단추(3D미술관_재설계 §2-22 9, 마스터플랜 3-3 #137). 서버 판은 서버 경로로, 개발 기기 판은 같은 기기의 시험 가족끼리 된다.
// 단추 하나가 뿌리라서 부모 화면의 메뉴 모양(scoped 스타일)과 누르기 동작이 그대로 붙는다.
const LABEL = { social: '친구 초대', town: '미술관 마을' } as const;
defineProps<{ action: keyof typeof LABEL }>();
</script>

<template>
  <button class="g-btn" type="button">{{ LABEL[action] }}</button>
</template>
