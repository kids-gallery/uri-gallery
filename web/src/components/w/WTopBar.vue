<script setup lang="ts">
// 화면 위 막대(SD_02 17-20-2). 안쪽 폭은 본문 폭(--w-content)과 같다. 메뉴는 nav 칸에 넣는다.
withDefaults(defineProps<{ title?: string; to?: string; navLabel?: string }>(), { title: '우리 아이 미술관', to: '/app', navLabel: '메뉴' });
</script>

<template>
  <header class="w-topbar">
    <div class="w-topbar__in">
      <RouterLink v-if="$router" class="w-topbar__title" :to="to">{{ title }}</RouterLink>
      <a v-else class="w-topbar__title" :href="to">{{ title }}</a>
      <nav class="w-topbar__nav" :aria-label="navLabel"><slot /></nav>
    </div>
  </header>
</template>
