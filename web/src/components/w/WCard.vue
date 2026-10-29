<script setup lang="ts">
// 명패 모양 카드(SD_02 17-20-2): 흰 판, 선 하나, 왼쪽 띠. alert면 띠가 오류 색.
withDefaults(defineProps<{ title?: string; meta?: string; alert?: boolean; as?: string }>(), { title: '', meta: '', alert: false, as: 'section' });
</script>

<template>
  <component :is="as" class="w-card" :class="{ 'w-card--alert': alert }">
    <h3 v-if="title" class="w-card__title">{{ title }}</h3>
    <p v-if="meta" class="w-card__meta">{{ meta }}</p>
    <slot />
  </component>
</template>
