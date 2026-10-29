<script setup lang="ts">
// 로컬 테스트 계정 입구(3D미술관_재설계 §2-8). 개발 서버 · `--mode localtest` 빌드에서만 불러온다 — 일반 배포 빌드에는 이 파일이 들어가지 않는다.
const emit = defineEmits<{ enter: [] }>();
</script>

<template>
  <button class="g-btn g-btn--primary g-btn--big" type="button" @click="emit('enter')">테스트 계정으로 들어가기</button>
</template>
