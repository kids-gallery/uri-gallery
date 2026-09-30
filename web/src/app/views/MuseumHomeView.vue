<script setup lang="ts">
// 홈 /app = 아이 미술관(D43, SD_02 §17-13 G): 아이 1명 → 바로 그 미술관 · 여럿 → 캐릭터 카드로 고르기(고른 아이는 이 브라우저에 기억해 다음엔 바로) · 0명 → 캐릭터 만들기.
// ?pick=1이면 기억한 아이가 있어도 고르기를 보인다([다른 아이 미술관]).
// 올리기 끝(D34 · D44): /app?child={id}&hung={artworkId} → 그 아이 미술관으로 hung을 그대로 넘겨 거는 장면을 재생한다.
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '@/api/client';
import CharacterAvatar from '@/app/character/CharacterAvatar.vue';
import MuseumBuilding from '@/app/character/MuseumBuilding.vue';
import { DEFAULT_COLOR, DEFAULT_KIND, DEFAULT_STYLE, isColor, isKind, isStyle } from '@/app/character/names';
import { home as hc } from '@/app/town/copy';
import { lastChild, rememberChild } from '@/app/town/lastChild';

interface Child { id: string; alias: string; character?: string | null; color?: string | null; museumStyle?: string | null }
const route = useRoute();
const router = useRouter();
const kids = ref<Child[] | null>(null);
const failed = ref(false);

const go = (id: string) => {
  rememberChild(id);
  const hung = typeof route.query.hung === 'string' ? route.query.hung : undefined;
  return router.replace({ path: `/app/museum/${id}`, query: hung ? { hung } : {} });
};

async function load() {
  failed.value = false;
  try {
    const list = await api.get<Child[]>('/v1/children');
    if (!list.length) return void (await router.replace('/app/children/new'));
    const last = lastChild();
    const asked = typeof route.query.child === 'string' ? route.query.child : null;
    if (asked && list.some((c) => c.id === asked)) return void (await go(asked));
    if (route.query.pick !== '1') {
      if (list.length === 1) return void (await go(list[0]!.id));
      if (last && list.some((c) => c.id === last)) return void (await go(last));
    }
    kids.value = list;
  } catch { failed.value = true; }
}
onMounted(load);
</script>

<template>
  <main class="mh">
    <div v-if="failed" class="center" role="alert">
      <p class="t-body">{{ hc.unavailable }}</p>
      <button class="btn btn-primary" type="button" @click="load">{{ hc.retry }}</button>
    </div>
    <template v-else-if="kids">
      <h1 class="t-headline mh-h">{{ hc.pickTitle }}</h1>
      <ul class="cards">
        <li v-for="c in kids" :key="c.id">
          <button class="card-btn" type="button" @click="go(c.id)">
            <MuseumBuilding :museum-style="isStyle(c.museumStyle) ? c.museumStyle : DEFAULT_STYLE" :color="isColor(c.color) ? c.color : undefined" :size="120" decorative />
            <CharacterAvatar class="who" :kind="isKind(c.character) ? c.character : DEFAULT_KIND" :color="isColor(c.color) ? c.color : DEFAULT_COLOR" :size="64" />
            <span class="name">{{ hc.museumOf(c.alias) }}</span>
          </button>
        </li>
      </ul>
      <div class="acts">
        <RouterLink class="btn btn-secondary" to="/app/children/new">{{ hc.addChild }}</RouterLink>
        <RouterLink class="btn btn-secondary" to="/app/town">{{ hc.toTown }}</RouterLink>
      </div>
    </template>
    <p v-else class="center t-body" role="status">{{ hc.loading }}</p>
  </main>
</template>

<style scoped>
.mh{min-height:calc(100dvh - 64px);padding:24px 16px 32px;display:grid;align-content:start;gap:20px;justify-items:center;
  background:linear-gradient(#fffdf8,#fff6ea)}
.mh-h{text-align:center;margin:8px 0 0}
.center{display:grid;place-items:center;gap:12px;min-height:50vh;text-align:center}
.cards{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,200px));gap:16px;justify-content:center;width:100%;max-width:960px}
.card-btn{position:relative;width:100%;display:grid;justify-items:center;gap:6px;padding:16px 12px 14px;border:1px solid var(--color-hairline);border-radius:24px;
  background:#fff;cursor:pointer;box-shadow:0 4px 14px rgba(74,52,65,.08);transition:transform .15s}
.card-btn:hover,.card-btn:focus-visible{transform:translateY(-3px);border-color:var(--color-primary)}
.who{position:absolute;right:10px;top:84px}
.name{font:650 17px/1.3 var(--font-sans);color:var(--color-ink);text-align:center}
.acts{display:flex;gap:10px;flex-wrap:wrap;justify-content:center}
@media (prefers-reduced-motion:reduce){.card-btn{transition:none}.card-btn:hover{transform:none}}
</style>
