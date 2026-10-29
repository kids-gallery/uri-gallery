<script setup lang="ts">
// 빈 상태(SD_02 17-20-2): 무엇이 비었는지(제목)와 무엇을 하면 채워지는지(설명·행동).
defineProps<{ title: string; body?: string }>();
</script>

<template>
  <section class="w-state" :aria-label="title">
    <h2 class="w-state__title">{{ title }}</h2>
    <p v-if="body" class="w-state__body">{{ body }}</p>
    <slot />
  </section>
</template>
