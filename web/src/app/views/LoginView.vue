<script setup lang="ts">
// S0a 보호자 로그인(T053, SD_02 §4-5 D21·D22 ③). POST /v1/auth/login → GET /v1/me.
// 성공: ?next(같은 셸 상대 경로만) → 가족 없음이면 S1d → 그 밖에는 S4. 불일치는 한 문구(가입 여부 비노출).
// 메일 확인 전(403 email_unverified)은 입력한 이메일로 확인 메일을 다시 받게 하고, 요청 한도(429)는 보류 블록.
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api, ApiError, toBlock, type BlockNotice as Notice } from '@/api/client';
import BlockNotice from '@/components/BlockNotice.vue';
import ReasonButton from '@/components/ReasonButton.vue';
import { ko } from '@/copy/ko';
import { safeNext } from '@/router/menu';
import { useSession } from '@/stores/session';
import PublicHeader from '../components/PublicHeader.vue';
import NoticeBlock from '../components/NoticeBlock.vue';
import { emailProblem } from '../authForm';

const route = useRoute();
const router = useRouter();
const session = useSession();
const email = ref('');
const password = ref('');
const busy = ref(false);
const block = ref<Notice | null>(null);
const resent = ref(false);
const emailEl = ref<HTMLInputElement | null>(null);
const resetDone = route.query.reset === '1';

const reason = computed(() => emailProblem(email.value) || (password.value ? '' : ko.auth.needPassword));

async function submit() {
  if (reason.value || busy.value) return;
  busy.value = true; block.value = null; resent.value = false;
  try {
    await api.post('/v1/auth/login', { body: { email: email.value.trim(), password: password.value }, noRedirect: true });
    const me = await session.loadGuardian(true);
    const next = safeNext(route.query.next, 'app');
    // 초대 수락(S1c)은 가족이 없어도 간다. 그 밖에는 가족이 없으면 S1d
    await router.replace(!me.hasFamily && !next.startsWith('/app/invite') ? '/app/no-family' : next);
  } catch (e) {
    const err = e instanceof ApiError ? e : new ApiError(0, null);
    if (err.status === 409 && err.reason === 'no_family') { await router.replace('/app/no-family'); return; }
    block.value = toBlock(err);
    password.value = '';
  } finally { busy.value = false; }
}

async function onAction(label: string) {
  if (label === ko.auth.forgot) { await router.push('/app/recovery'); return; }
  if (label === ko.auth.resendVerify) {
    await api.post('/v1/auth/email/verify/resend', { body: { email: email.value.trim() }, noRedirect: true }).catch(() => undefined);
    block.value = null; resent.value = true; return;
  }
  emailEl.value?.focus();
}
</script>

<template>
  <PublicHeader link="signup" />
  <main class="container page stack">
    <NoticeBlock v-if="resetDone" :title="ko.auth.resetDone" />
    <NoticeBlock v-if="resent" :title="ko.auth.checkMailbox"><p>{{ ko.auth.mailboxHint }}</p></NoticeBlock>
    <form class="card stack auth-form" novalidate @submit.prevent="submit">
      <h1 class="t-headline">{{ ko.auth.loginTitle }}</h1>
      <div class="field">
        <label for="li-email">{{ ko.auth.email }}</label>
        <input id="li-email" ref="emailEl" v-model="email" class="input" type="email" autocomplete="username">
      </div>
      <div class="field">
        <label for="li-pw">{{ ko.auth.password }}</label>
        <input id="li-pw" v-model="password" class="input" type="password" autocomplete="current-password">
      </div>
      <BlockNotice v-if="block" :notice="block" @action="onAction" />
      <div class="row-acts">
        <ReasonButton :label="ko.auth.login" :disabled="!!reason || busy" :reason="reason" @click="submit" />
        <RouterLink class="btn btn-tertiary" to="/app/recovery">{{ ko.auth.forgot }}</RouterLink>
      </div>
    </form>
  </main>
</template>

<style scoped>
.auth-form{max-width:560px}
.row-acts{display:flex;flex-wrap:wrap;gap:var(--s-sm);align-items:center}
</style>
