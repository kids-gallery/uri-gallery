<script setup lang="ts">
// 아직 만들지 않은 화면의 자리(T040). 각 화면 작업(T0xx)에서 실제 화면으로 바꾼다.
defineProps<{ screen: string; title: string; task: string }>();
</script>

<template>
  <main class="container page">
    <p class="t-eyebrow">{{ screen }}</p>
    <h1 class="t-headline">{{ title }}</h1>
    <p class="t-body-sm">{{ task }}에서 만든다.</p>
  </main>
</template>
