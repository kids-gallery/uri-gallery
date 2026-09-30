<script setup lang="ts">
import { ko } from '@/copy/ko';
// 보호자 셸(T040, C9). 운영 화면으로 가는 링크가 없다(UX8).
import { RouterView, useRouter } from 'vue-router';
import RoleHeader from '@/components/RoleHeader.vue';
import { APP_MENU } from '@/router/menu';
import { useSession } from '@/stores/session';

const s = useSession();
const router = useRouter();
async function logout() { await s.logoutGuardian(); await router.push('/app/login'); }
</script>

<template>
  <RoleHeader shell="app" :account="s.guardian?.emailMasked ?? (s.guardian?.loginMethod === 'kakao' ? ko.kakao.account : undefined)" :menu="APP_MENU" @logout="logout" />
  <RouterView />
</template>
