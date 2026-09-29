<script setup lang="ts">
// T004 자리표시 화면. T040(라우터·레이아웃)에서 실제 셸로 바꾼다.
defineProps<{ shell: 'app' | 'ops' }>();
</script>

<template>
  <main>
    <h1>{{ shell === 'app' ? '우리 아이 미술관' : '운영 화면' }}</h1>
  </main>
</template>
