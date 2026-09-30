<script setup lang="ts">
import { ko } from '@/copy/ko';
// 보호자 셸(T040, C9). 운영 화면으로 가는 링크가 없다(UX8).
import { computed } from 'vue';
import { RouterView, useRoute, useRouter } from 'vue-router';
import RoleHeader from '@/components/RoleHeader.vue';
import MuseumBar from '@/components/MuseumBar.vue';
import { APP_MENU } from '@/router/menu';
import { useSession } from '@/stores/session';

const s = useSession();
const router = useRouter();
const route = useRoute();
/** 미술관 화면에서는 메뉴를 한 버튼으로 접는다(D34 ④ · SD_02 §17-8) */
const inMuseum = computed(() => ['/app', '/app/list', '/app/hall'].includes(route.path));
/** 계정 표시: 이메일, 카카오 로그인이면 "카카오 계정"(D36) */
const account = computed(() => s.guardian?.emailMasked ?? (s.guardian?.loginMethod === 'kakao' ? ko.kakao.account : undefined));
async function logout() { await s.logoutGuardian(); await router.push('/app/login'); }
</script>

<template>
  <MuseumBar v-if="inMuseum" :account="account" :menu="APP_MENU" @logout="logout" />
  <RoleHeader v-else shell="app" :account="account" :menu="APP_MENU" @logout="logout" />
  <RouterView />
</template>
