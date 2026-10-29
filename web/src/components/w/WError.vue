<script setup lang="ts">
// 오류(SD_02 17-20-2): 무엇이 안 됐는지와 다시 하기. 오류 원문·코드는 보이지 않는다(BR-PRV-01).
import WButton from './WButton.vue';

withDefaults(defineProps<{ title?: string; body?: string; retryLabel?: string; retry?: boolean }>(), {
  title: '지금은 불러올 수 없어요', body: '', retryLabel: '다시 불러오기', retry: true,
});
const emit = defineEmits<{ retry: [] }>();
</script>

<template>
  <section class="w-state w-state--alert" role="alert">
    <h2 class="w-state__title">{{ title }}</h2>
    <p v-if="body" class="w-state__body">{{ body }}</p>
    <WButton v-if="retry" :label="retryLabel" variant="secondary" @click="emit('retry')" />
    <slot />
  </section>
</template>
