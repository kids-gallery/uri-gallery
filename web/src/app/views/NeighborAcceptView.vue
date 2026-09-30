<script setup lang="ts">
// 이웃 초대 받기(D40, SD_02 §17-13 E, UC_16 BF2·BF3·A1·E1~E3): /app/neighbor?token= — 로그인 전이면 가드가 로그인으로 보낸다(next 유지).
// 받기 전에 무엇이 보이는지(그림·별칭·제목만)와 언제든 끊을 수 있음을 먼저 보인다. 거절: 400 token_invalid · 409 own_family · 409 neighbor_full.
import { ref } from 'vue';
import { useRoute } from 'vue-router';
import { api, ApiError } from '@/api/client';
import { neighbor as nc } from '@/app/town/copy';

const route = useRoute();
const token = typeof route.query.token === 'string' ? route.query.token : '';
const busy = ref(false);
const done = ref(false);
const err = ref(token ? '' : nc.noToken);

async function accept() {
  if (busy.value || !token) return;
  busy.value = true; err.value = '';
  try {
    await api.post('/v1/neighbors/accept', { body: { token } });
    done.value = true;
  } catch (e) {
    const r = e instanceof ApiError ? e.reason : null;
    const st = e instanceof ApiError ? e.status : 0;
    // 링크 문제(400 token_invalid · 422 형식)만 "이미 쓰였거나 끝났어요", 끊김 · 서버 문제는 잠시 뒤 다시(링크는 아직 쓸 수 있다)
    err.value = r === 'own_family' ? nc.ownFamily : r === 'neighbor_full' ? nc.fullAccept
      : r === 'token_invalid' || st === 400 || st === 422 ? nc.tokenInvalid : nc.tryLater;
  } finally { busy.value = false; }
}
</script>

<template>
  <main class="container page stack">
    <section class="card stack-sm nb" aria-labelledby="nb-h">
      <h1 id="nb-h" class="t-headline">{{ nc.acceptTitle }}</h1>
      <template v-if="!done">
        <p class="t-body">{{ nc.accept1 }}</p>
        <p class="t-body-sm">{{ nc.accept2 }}</p>
        <p class="t-body-sm">{{ nc.accept3 }}</p>
        <p v-if="err" class="t-body" role="alert">{{ err }}</p>
        <div class="acts">
          <button class="btn btn-primary" type="button" :disabled="busy || !token" @click="accept">{{ nc.acceptGo }}</button>
        </div>
      </template>
      <template v-else>
        <p class="t-body" role="status">{{ nc.accepted }}</p>
        <div class="acts"><RouterLink class="btn btn-primary" to="/app/town">{{ nc.toTown }}</RouterLink></div>
      </template>
    </section>
  </main>
</template>

<style scoped>
.nb{max-width:640px}
.stack-sm{display:grid;gap:var(--s-sm)}
.acts{display:flex;flex-wrap:wrap;gap:var(--s-sm)}
</style>
