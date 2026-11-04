<script setup lang="ts">
import { defineAsyncComponent, onMounted, onUnmounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { authProviders, login, logout, me, failureOf, failureReason, type Child, type GuardianMe } from './server';
import WorldChildren from './WorldChildren.vue';
import { SERVER_WORLD, clearWorldWorks, selectedChild } from './server/upload';

const WorldView = defineAsyncComponent(() => import('./WorldView.vue'));
const guardian = ref<GuardianMe | null>(null);
const checking = ref(true);
const childReady = ref(false);
const changingChild = ref(false);
const childName = ref('');
const busy = ref(false);
const email = ref('');
const password = ref('');
const notice = ref('');
const logoutPending = ref(false);
const providers = ref({ kakao: false, emailSignup: true }); // 확인 전·실패 때는 지금 이메일 화면(마스터플랜 3-3 #88)
const showEmail = ref(false);
const PROVIDERS_WAIT_MS = 3000;
let providersAsk = 0;
const canRetry = ref(false);
const route = useRoute();
const router = useRouter();
const kakaoNote = ref(
  route.query.kakao === 'cancelled' ? '로그인을 취소했어요. 다시 해 볼까요?'
    : route.query.kakao === 'failed' ? '카카오 로그인이 되지 않았어요. 잠시 뒤 다시 해 볼까요?' : '',
);
let epoch = 0;
let alive = true;

function clear() {
  epoch++;
  guardian.value = null;
  childReady.value = false;
  changingChild.value = false;
  childName.value = '';
  selectedChild.value = null;
  clearWorldWorks();
}
function childSelected(child: Child) {
  selectedChild.value = child.id;
  childName.value = child.alias;
  childReady.value = true;
  changingChild.value = false;
}
function expired() {
  if (!guardian.value) return;
  clear();
  kakaoNote.value = '';
  checking.value = false;
  notice.value = '로그인이 만료됐어요. 다시 로그인해 주세요';
}
async function loadProviders() {
  const mine = ++providersAsk;
  const value = await authProviders().catch(() => null);
  if (!value || !alive || mine !== providersAsk) return; // 겹치면 가장 나중 요청의 응답만 쓴다
  if (value.kakao && (email.value || password.value)) showEmail.value = true; // 입력 중인 칸을 접지 않는다
  providers.value = value;
}
function startKakao() {
  window.location.assign('/v1/auth/kakao/start');
}
function switchKakaoAccount() {
  window.location.assign('/v1/auth/kakao/start?account=switch');
}
async function restore() {
  if (logoutPending.value || busy.value) return;
  const current = epoch;
  const wasAuthenticated = !!guardian.value;
  checking.value = true;
  canRetry.value = false;
  const loading = !wasAuthenticated && !providers.value.kakao ? loadProviders() : null;
  try {
    const value = await me();
    if (alive && current === epoch) {
      guardian.value = value;
      notice.value = '';
      kakaoNote.value = '';
      if (!wasAuthenticated) childReady.value = false;
    }
  } catch (e) {
    if (!alive || current !== epoch) return;
    const f = failureOf(e);
    if (f.kind === 'login') {
      clear();
      notice.value = wasAuthenticated
        ? '로그인이 만료됐어요. 다시 로그인해 주세요'
        : '로그인해 미술관을 열어 주세요';
    } else if (!(f.kind === 'offline' && wasAuthenticated)) {
      kakaoNote.value = '';
      notice.value = failureReason(f);
      canRetry.value = true;
    }
  } finally {
    // 켜짐을 알기 전에 이메일 입력을 잠깐 보이지 않게. 응답이 멈춰도 로그인 화면은 열려야 한다
    if (loading) await Promise.race([loading, new Promise((done) => setTimeout(done, PROVIDERS_WAIT_MS))]);
    if (alive) checking.value = false;
  }
}
async function submit() {
  if (busy.value || logoutPending.value) return;
  busy.value = true;
  notice.value = '';
  kakaoNote.value = '';
  const current = epoch;
  try {
    await login({ email: email.value.trim(), password: password.value });
    const value = await me();
    if (alive && current === epoch) {
      clearWorldWorks();
      guardian.value = value;
      childReady.value = !!selectedChild.value;
      password.value = '';
    }
  } catch (e) {
    const f = failureOf(e);
    notice.value = f.kind === 'login'
      ? '이메일과 비밀번호를 다시 확인해 주세요'
      : failureReason(f);
  } finally {
    busy.value = false;
  }
}
async function signout() {
  if (busy.value) return;
  clear();
  kakaoNote.value = '';
  checking.value = false;
  busy.value = true;
  logoutPending.value = true;
  notice.value = '';
  try {
    await logout();
    logoutPending.value = false;
    notice.value = '로그아웃했어요';
  } catch {
    notice.value = '로그아웃을 마치지 못했어요. 다시 시도해 주세요';
  } finally {
    busy.value = false;
  }
}
function visible() {
  if (document.visibilityState === 'visible' && guardian.value) void restore();
}
onMounted(() => {
  const { kakao, welcome, next, ...rest } = route.query; // 콜백이 붙인 쿼리만 지운다. 새로 고침에 안내가 다시 뜨지 않게
  if (kakao !== undefined || welcome !== undefined || next !== undefined) void router.replace({ path: route.path, query: rest });
  if (SERVER_WORLD) {
    window.addEventListener('world-session-expired', expired);
    document.addEventListener('visibilitychange', visible);
    void restore();
  } else checking.value = false;
});
onUnmounted(() => {
  alive = false;
  epoch++;
  window.removeEventListener('world-session-expired', expired);
  document.removeEventListener('visibilitychange', visible);
});
</script>
<template>
  <WorldView v-if="!SERVER_WORLD" />
  <template v-else>
    <WorldChildren v-if="guardian && !childReady" :changing="changingChild" @selected="childSelected" />
    <WorldView v-else-if="guardian" :selected-child-name="childName" @logout="signout" @change-child="changingChild = true; childReady = false" />
    <main v-else class="auth">
      <section class="card" aria-labelledby="login-title">
        <h1 id="login-title">우리 아이 미술관</h1>
        <p v-if="checking" role="status">로그인을 확인하고 있어요</p>
        <template v-else>
          <p v-if="kakaoNote || notice" role="alert">{{ kakaoNote || notice }}</p>
          <button v-if="logoutPending" type="button" :disabled="busy" @click="signout">
            로그아웃 다시 시도
          </button>
          <template v-else-if="providers.kakao">
            <button class="kakao" type="button" @click="startKakao">카카오로 시작하기</button>
            <button class="switch-account" type="button" @click="switchKakaoAccount">다른 카카오 계정으로 로그인</button>
            <button class="email-toggle" type="button" :aria-expanded="showEmail" @click="showEmail = !showEmail">
              이메일로 로그인(기존 회원)
            </button>
          </template>
          <form v-if="!logoutPending && (!providers.kakao || showEmail)" @submit.prevent="submit">
            <label>이메일
              <input v-model="email" type="email" autocomplete="username" required maxlength="254" :disabled="busy">
            </label>
            <label>비밀번호
              <input v-model="password" type="password" autocomplete="current-password" required maxlength="200" :disabled="busy">
            </label>
            <button :disabled="busy">{{ busy ? '로그인하는 중' : '로그인' }}</button>
          </form>
          <button v-if="!logoutPending && (canRetry || !providers.kakao)" type="button" :disabled="busy" @click="restore">
            로그인 상태 다시 확인
          </button>
          <RouterLink v-if="!logoutPending && !providers.kakao && providers.emailSignup" to="/app/signup">처음 오셨나요? 이메일로 가입하기</RouterLink>
          <p v-if="!logoutPending && !providers.kakao && !providers.emailSignup">지금은 새로 가입할 수 없어요. 이미 가입했다면 로그인해 주세요.</p>
        </template>
      </section>
    </main>
  </template>
</template>
<style scoped>.auth{min-height:100dvh;display:grid;place-items:center;padding:24px 16px;box-sizing:border-box;background:#fff8ec;color:#443529}.card{width:min(440px,100%);box-sizing:border-box;padding:24px;display:grid;gap:16px;border:1px solid #c9b38f;border-radius:18px;background:#fffdf8}h1,p{margin:0}p{line-height:1.6}form,label{display:grid;gap:8px}form{gap:16px}input{width:100%;box-sizing:border-box;min-height:44px;padding:10px;border:1px solid #bda881;border-radius:10px;font:inherit}button{min-height:44px;font:inherit;border:1px solid #ad557e;border-radius:10px;padding:10px 16px;background:#93405f;color:white;cursor:pointer}button:disabled{opacity:.6}.kakao{background:#fee500;color:#191600;border-color:#e3c500;font-weight:700}.email-toggle,.switch-account{background:none;color:#78324f;border:0;text-decoration:underline}a{color:#78324f}</style>
