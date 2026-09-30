<script setup lang="ts">
// 미술관 셸(D34 ④ · 고객 요구 §7 C②, SD_02 §17-8): 미술관 화면에서는 메뉴 줄 · 계정 · 로그아웃을 [메뉴] 버튼 하나로 접고,
// 지름길 [올리기] · [목록]은 늘 보인다. 메뉴 판은 Esc · 바깥 누름 · [닫기]로 닫히고 초점은 [메뉴]로 돌아온다.
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import { ko } from '@/copy/ko';
import type { MenuItem } from './RoleHeader.vue';

defineProps<{ account?: string; menu: MenuItem[] }>();
const emit = defineEmits<{ logout: [] }>();
const route = useRoute();
const open = ref(false);
const btn = ref<HTMLButtonElement | null>(null);
const panel = ref<HTMLElement | null>(null);
async function show() { open.value = true; await nextTick(); panel.value?.querySelector<HTMLElement>('a, button')?.focus(); }
async function hide() { open.value = false; await nextTick(); btn.value?.focus(); }
function onKey(e: KeyboardEvent) { if (open.value && e.key === 'Escape') { e.preventDefault(); void hide(); } }
watch(() => route.fullPath, () => { open.value = false; });
onMounted(() => window.addEventListener('keydown', onKey));
onBeforeUnmount(() => window.removeEventListener('keydown', onKey));
</script>

<template>
  <header class="mbar" data-shell="app">
    <RouterLink class="mbar-mark" to="/app">{{ ko.shell.appName }}</RouterLink>
    <nav class="mbar-quick" :aria-label="ko.shell.quick">
      <RouterLink class="mbar-pill" to="/app/upload">{{ ko.shell.quickUpload }}</RouterLink>
      <RouterLink class="mbar-pill" :to="{ path: '/app/list', query: route.query.child ? { child: route.query.child } : {} }">{{ ko.shell.quickList }}</RouterLink>
      <button ref="btn" class="mbar-pill mbar-menu" type="button" :aria-expanded="open" aria-controls="mbar-panel" @click="open ? hide() : show()">
        <span aria-hidden="true">☰</span> {{ ko.shell.menuOpen }}
      </button>
    </nav>
    <div v-if="open" class="mbar-scrim" @click="hide"></div>
    <div v-if="open" id="mbar-panel" ref="panel" class="mbar-panel" role="dialog" :aria-label="ko.shell.menuOpen">
      <nav :aria-label="'보호자 메뉴'">
        <RouterLink v-for="m in menu" :key="m.to" :to="m.to" class="mbar-link">{{ m.label }}</RouterLink>
        <RouterLink v-if="account" to="/app/account" class="mbar-link">{{ ko.auth.myAccount }} - {{ account }}</RouterLink>
      </nav>
      <div class="mbar-foot">
        <button class="btn btn-secondary" type="button" @click="emit('logout')">{{ ko.auth.logout }}</button>
        <button class="btn btn-tertiary" type="button" @click="hide">{{ ko.walk.close }}</button>
      </div>
    </div>
  </header>
</template>

<style scoped>
.mbar{position:relative;z-index:40;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px clamp(12px,2.5vw,32px);background:var(--color-canvas);border-bottom:1px solid var(--color-hairline)}
.mbar-mark{font:750 18px/1 var(--font-sans);color:var(--color-primary);text-decoration:none;white-space:nowrap}
.mbar-quick{display:flex;gap:6px;align-items:center}
.mbar-pill{display:inline-flex;align-items:center;gap:6px;min-height:44px;padding:8px 14px;border:1px solid var(--color-hairline);border-radius:var(--r-pill);background:var(--color-canvas);
  color:var(--color-ink);font:600 14px/1 var(--font-sans);text-decoration:none;cursor:pointer;white-space:nowrap}
.mbar-pill:hover{background:var(--color-surface-soft)}
.mbar-menu{background:var(--color-primary);color:var(--color-on-primary);border-color:var(--color-primary)}
.mbar-scrim{position:fixed;inset:0;background:rgba(44,34,56,.28);z-index:41}
.mbar-panel{position:absolute;right:clamp(12px,2.5vw,32px);top:calc(100% + 6px);z-index:42;width:min(320px,calc(100vw - 24px));background:var(--color-canvas);
  border:1px solid var(--color-hairline);border-radius:var(--r-lg);box-shadow:var(--elev-3);padding:var(--s-sm);display:grid;gap:var(--s-sm)}
.mbar-panel nav{display:grid}
.mbar-link{display:block;padding:12px 12px;border-radius:var(--r-md);color:var(--color-ink);font:500 16px/1.3 var(--font-sans);text-decoration:none}
.mbar-link:hover,.mbar-link:focus-visible{background:var(--color-surface-soft)}
.mbar-foot{display:flex;gap:8px;justify-content:space-between;border-top:1px solid var(--color-hairline);padding-top:var(--s-sm)}
@media (max-width:420px){.mbar-mark{font-size:16px}.mbar-pill{padding:8px 10px;font-size:13px}}
</style>
