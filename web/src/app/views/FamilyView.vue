<script setup lang="ts">
// S1b 가족 보호자 관리(T107, SD_02 §4-5, UC15 BF2·BF3·A1~A3·A5·E6·E8·E9, G29, U1 확정 — 부모 두 명까지).
// 초대하기·해제·대기 초대 취소는 만든 보호자 화면에만. 두 명 찼으면 초대는 사유 달린 C3. 공동 보호자 화면은 [가족 공간에서 나가기]만.
// 초대 응답은 항상 "초대 메일을 보냈어요"(가입 여부 비노출). 서버 거절(403 invite_owner_only · 409 co_guardian_full)은 C2.
// 나가기는 세션이 모두 지워져 로그인 화면으로 간다(다시 로그인하면 S1d).
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { api, ApiError, toBlock, type BlockNotice as Notice } from '@/api/client';
import BlockNotice from '@/components/BlockNotice.vue';
import ReasonButton from '@/components/ReasonButton.vue';
import { ko } from '@/copy/ko';
import { useSession } from '@/stores/session';
import NoticeBlock from '../components/NoticeBlock.vue';
import { emailProblem } from '../authForm';

interface Member { id?: string; role?: 'owner' | 'co'; emailMasked?: string; isMe?: boolean }
interface Invite { id?: string; emailMasked?: string; expiresAt?: string }

const router = useRouter();
const s = useSession();
const members = ref<Member[] | null>(null);
const invites = ref<Invite[]>([]);
const email = ref('');
const busy = ref(false);
const sent = ref(false);
const block = ref<Notice | null>(null);
const asking = ref<{ kind: 'release' | 'leave'; member?: Member } | null>(null);

const amOwner = computed(() => members.value?.find((m) => m.isMe)?.role === 'owner');
const full = computed(() => (members.value?.length ?? 0) >= 2);
const why = computed(() => (full.value ? ko.family.full : emailProblem(email.value) || (busy.value ? ko.upload.sending : '')));
const when = (iso?: string) => (iso ? iso.slice(0, 16).replace('T', ' ') : '');

async function load() {
  try {
    members.value = await api.get<Member[]>('/v1/family/members');
    invites.value = amOwner.value ? await api.get<Invite[]>('/v1/family/invites') : [];
    block.value = null;
  } catch (e) { block.value = toBlock(e instanceof ApiError ? e : new ApiError(0, null)); }
}
onMounted(load);

async function run(fn: () => Promise<unknown>) {
  busy.value = true; block.value = null;
  try { await fn(); } catch (e) { block.value = toBlock(e instanceof ApiError ? e : new ApiError(0, null)); } finally { busy.value = false; }
}
const invite = () => (why.value ? undefined : run(async () => { // 검사는 busy가 켜지기 전에(켜진 뒤엔 "보내는 중"이 사유가 된다)
  await api.post('/v1/family/invites', { body: { email: email.value.trim() } });
  email.value = ''; sent.value = true; await load();
}));
const cancelInvite = (i: Invite) => run(async () => { await api.del(`/v1/family/invites/${i.id}`); await load(); });
async function confirm() {
  const a = asking.value; asking.value = null;
  if (!a) return;
  if (a.kind === 'release' && a.member) await run(async () => { await api.del(`/v1/family/members/${a.member!.id}`); await load(); });
  else await run(async () => { await api.post('/v1/family/leave'); s.reset(); await router.push('/app/login'); });
}
</script>

<template>
  <main class="container page stack">
    <BlockNotice v-if="block" :notice="block" @action="load" />
    <section v-if="members" class="stack-sm" aria-labelledby="fm-t">
      <h1 id="fm-t" class="t-headline">{{ ko.family.title(members.length) }}</h1>
      <div class="table-wrap" tabindex="0" role="region" :aria-label="ko.family.colMember">
        <table class="plain">
          <thead><tr><th>{{ ko.family.colMember }}</th><th>{{ ko.family.colRole }}</th><th>{{ ko.family.colActions }}</th></tr></thead>
          <tbody>
            <tr v-for="m in members" :key="m.id">
              <td>{{ m.emailMasked }} <template v-if="m.isMe">{{ ko.family.me }}</template></td>
              <td>{{ ko.family.role[m.role ?? ''] }}</td>
              <td>
                <button v-if="amOwner && m.role === 'co'" class="btn btn-secondary btn-sm" type="button" @click="asking = { kind: 'release', member: m }">{{ ko.family.release }}</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section v-if="asking" class="gblock is-final" role="alertdialog" aria-labelledby="fm-ask">
      <p id="fm-ask" class="head">{{ asking.kind === 'release' ? ko.family.releaseConfirm : ko.family.leaveConfirm }}</p>
      <div class="acts">
        <button class="btn btn-primary" type="button" @click="confirm">{{ asking.kind === 'release' ? ko.family.release : ko.family.leaveGo }}</button>
        <button class="btn btn-secondary" type="button" @click="asking = null">{{ ko.family.cancel }}</button>
      </div>
    </section>

    <!-- 만든 보호자: 초대하기 · 대기 초대 -->
    <template v-if="members && amOwner">
      <form class="card stack-sm inv" novalidate @submit.prevent="invite">
        <h2 class="t-card-title">{{ ko.family.inviteTitle }}</h2>
        <div v-if="!full" class="field">
          <label for="fm-email">{{ ko.family.inviteEmail }}</label>
          <input id="fm-email" v-model="email" class="input" type="email" autocomplete="off">
        </div>
        <div><ReasonButton :label="ko.family.send" :disabled="!!why" :reason="why" @click="invite" /></div>
        <p v-if="full" class="t-body-sm">{{ ko.family.fullHint }}</p>
        <p class="t-body-sm">{{ ko.family.same }}</p>
        <p class="t-body-sm">{{ ko.family.ownerOnly }}</p>
      </form>
      <NoticeBlock v-if="sent" :title="ko.family.sent" />
      <section class="stack-sm" aria-labelledby="fm-pend">
        <h2 id="fm-pend" class="t-card-title">{{ ko.family.pending(invites.length) }}</h2>
        <p v-if="full && !invites.length" class="t-body-sm">{{ ko.family.pendingFull }}</p>
        <table v-if="invites.length" class="plain">
          <thead><tr><th>{{ ko.family.colInvite }}</th><th>{{ ko.family.colExpires }}</th><th>{{ ko.family.colActions }}</th></tr></thead>
          <tbody>
            <tr v-for="i in invites" :key="i.id">
              <td>{{ i.emailMasked }}</td><td class="num">{{ when(i.expiresAt) }}</td>
              <td><button class="btn btn-secondary btn-sm" type="button" :disabled="busy" @click="cancelInvite(i)">{{ ko.family.cancelInvite }}</button></td>
            </tr>
          </tbody>
        </table>
      </section>
    </template>

    <!-- 공동 보호자: 나가기만 -->
    <div v-else-if="members">
      <button class="btn btn-secondary" type="button" @click="asking = { kind: 'leave' }">{{ ko.family.leave }}</button>
    </div>
  </main>
</template>

<style scoped>
.stack-sm{display:grid;gap:var(--s-sm)}
.inv{max-width:560px}
.acts{display:flex;flex-wrap:wrap;gap:var(--s-sm)}
.table-wrap{overflow-x:auto}
table.plain{width:100%;border-collapse:collapse;font:330 16px/1.45 var(--font-sans)}
table.plain th,table.plain td{text-align:left;padding:var(--s-sm) var(--s-sm) var(--s-sm) 0;border-bottom:1px solid var(--color-hairline-soft);vertical-align:middle}
table.plain th{font:400 12px/1 var(--font-mono);letter-spacing:.6px;text-transform:uppercase}
.btn-sm{min-height:44px;font-size:16px;padding:6px 14px}
.num{font-variant-numeric:tabular-nums}
</style>
