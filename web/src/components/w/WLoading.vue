<script setup lang="ts">
// 불러오는 중(SD_02 17-20-2): 빈 화면으로 두지 않고 글자로도 알린다. 움직임 줄이기 설정이면 막대가 멈춘다.
withDefaults(defineProps<{ label?: string }>(), { label: '불러오는 중이에요' });
</script>

<template>
  <section class="w-state" role="status" aria-live="polite">
    <p class="w-state__body">{{ label }}</p>
    <div class="w-loading__bar" aria-hidden="true"></div>
  </section>
</template>
