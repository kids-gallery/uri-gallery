<script setup lang="ts">
// S0a 보호자 로그인(T053, SD_02 §4-5 D21·D22 ③). POST /v1/auth/login → GET /v1/me.
// 성공: ?next(같은 셸 상대 경로만) → 가족 없음이면 S1d → 그 밖에는 S4. 불일치는 한 문구(가입 여부 비노출).
// 2026-09-30 D36(SD_02 §17-7): 크게 [카카오로 시작하기](키 없으면 "준비 중이에요" 비활성), 아래 작게 "이메일로 로그인(기존 회원)".
// 카카오 취소·실패는 ?kakao=cancelled|failed 안내. 메일 관련 문구(확인·다시 받기·찾기)는 보이지 않는다 — 메일을 보내지 않는다.
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api, ApiError, toBlock, type BlockNotice as Notice } from '@/api/client';
import BlockNotice from '@/components/BlockNotice.vue';
import ReasonButton from '@/components/ReasonButton.vue';
import { ko } from '@/copy/ko';
import { safeNext } from '@/router/menu';
import { neighbor as nbc } from '@/app/town/copy';
import { markEntered } from '../entrance';
import { useSession } from '@/stores/session';
import NoticeBlock from '../components/NoticeBlock.vue';
import { emailProblem } from '../authForm';

const route = useRoute();
const router = useRouter();
/** 친구 링크로 왔는가(§17-16) — 초대 안내 한 줄 + 미술관 배경 */
// 로그인 화면을 거쳐 왔으면 입장 화면을 다시 보이지 않는다(D53 ④, 외부 피드백 4차 ②) — 로그인 뒤 바로 내 미술관
markEntered();
const fromFriend = typeof route.query.next === 'string' && route.query.next.startsWith('/app/neighbor');
const session = useSession();
const email = ref('');
const password = ref('');
const busy = ref(false);
const block = ref<Notice | null>(null);
const resent = ref(false);
const emailEl = ref<HTMLInputElement | null>(null);
const resetDone = route.query.reset === '1';
const kakaoOn = ref<boolean | null>(null);
const showEmail = ref(false);
const kakaoNote = route.query.kakao === 'cancelled' ? ko.kakao.cancelled : route.query.kakao === 'failed' ? ko.kakao.failed : '';
onMounted(async () => {
  try { kakaoOn.value = (await api.get<{ kakao: boolean }>('/v1/auth/providers', { noRedirect: true })).kakao; } catch { kakaoOn.value = false; }
});
// D47: 로그인 전에 연 주소(이웃 링크 등)는 카카오를 다녀와도 그대로 — next를 넘긴다(safeNext, 기본 /app이면 넘기지 않음)
function startKakao() {
  if (!kakaoOn.value) return;
  const next = safeNext(route.query.next, 'app');
  window.location.assign(next === '/app' ? '/v1/auth/kakao/start' : `/v1/auth/kakao/start?next=${encodeURIComponent(next)}`);
}
// 초대 링크(S1c)로 왔는데 계정이 없으면 초대받은 이메일로 가입(UC15 A4) — next의 token을 가입에 넘긴다
const inviteToken = computed(() => {
  const n = typeof route.query.next === 'string' ? route.query.next : '';
  return n.startsWith('/app/invite') ? new URLSearchParams(n.split('?')[1] ?? '').get('token') : null;
});

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
    // 불일치 블록은 SD_02 S0a 와이어프레임대로 "막힘 G0"(API는 gate 없이 보낸다) — 메일 확인 G27 블록과 표기를 맞춘다
    const b = toBlock(err);
    // 메일을 보내지 않으므로(D36) 확인 전 계정에 "메일 다시 받기"를 주지 않는다
    block.value = err.reason === 'email_unverified' ? { ...b, reason: ko.kakao.unverified, actions: [] }
      : { ...b, gate: err.gate ?? (err.reason === 'bad_credentials' ? 'G0' : null), actions: b.actions.filter((a) => a !== ko.auth.forgot && a !== ko.auth.resendVerify) };
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
  <header class="topnav"><div class="container"><RouterLink class="wordmark" to="/app/login">{{ ko.shell.appName }}</RouterLink></div></header>
  <main class="container page stack" :class="{ 'from-friend': fromFriend }">
    <p v-if="fromFriend" class="friend-note t-body" role="status">{{ nbc.loginNote }}</p>
    <NoticeBlock v-if="resetDone" :title="ko.auth.resetDone" />
    <section class="card stack auth-form">
      <h1 class="t-headline">{{ ko.auth.loginTitle }}</h1>
      <p v-if="kakaoNote" class="t-body kakao-note" role="status">{{ kakaoNote }}</p>
      <ReasonButton class="kakao-btn" :label="ko.kakao.start" :disabled="!kakaoOn" :reason="kakaoOn === false ? ko.kakao.preparing : ''" @click="startKakao" />
      <button class="btn btn-tertiary email-toggle" type="button" :aria-expanded="showEmail" aria-controls="li-form" @click="showEmail = !showEmail">{{ ko.kakao.emailLogin }}</button>
    </section>
    <form v-if="showEmail" id="li-form" class="card stack auth-form" novalidate @submit.prevent="submit">
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
        <ReasonButton :label="ko.auth.login" :disabled="!!reason || busy" :reason="reason" type="submit" />
      </div>
    </form>
  </main>
</template>

<style scoped>
.auth-form{max-width:560px}
.row-acts{display:flex;flex-wrap:wrap;gap:var(--s-sm);align-items:center}
.kakao-btn{width:100%;min-height:56px;font-size:18px;background:#FEE500;color:#191600;border-color:#FEE500} /* 카카오 노랑(§17-16) */
.kakao-btn:hover{background:#f5dc00}
.from-friend{background:radial-gradient(120% 80% at 50% 0%,var(--color-block-cream),var(--color-canvas));border-radius:24px;padding-top:24px}
.friend-note{margin:0;padding:12px 16px;border-radius:14px;background:var(--color-block-lime);font-weight:600}
.email-toggle{justify-self:start;font-size:14px}
.kakao-note{margin:0}
</style>
