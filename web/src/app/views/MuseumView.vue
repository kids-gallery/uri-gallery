<script setup lang="ts">
// 홈 = 전시실(SD_02 §17-2, D25 — S8 가족 전시를 홈으로 확장). 로그인 뒤 첫 화면. 르네상스 전시관(D25 ⑥, museum.css 팔레트).
// 로비(볼트 홀: 걸린 배너 · 받침대의 최근 작품 · 소장 작품 명판) → 건축 평면도(두꺼운 벽선 · 문 틈 · 실 번호 · 가운데 회랑 ·
// 양옆 전시실 · 로비와 입구 계단 · 방위, 누르면 그 관으로) → 세관마다 한 점 투시 전시실(카세톤 볼트 천장과 채광창 · 다마스크 벽 ·
// 코니스 · 대리석 바닥 · 벤치, 안쪽 벽에 금박 액자와 명패, 많으면 벽을 따라 옆으로 이어짐).
// 작품을 누르면 "작품 앞"(주소 ?art={id}): 큰 금박 액자 + 월 라벨 = 전시 해설(작품명 · 작가 줄 · 결과 종류 · 규칙 문장 해설 ·
// 보호자 감상평 · 승인된 AI 해설). 뒤로가기는 [← 전시실로] · 브라우저 뒤로가기 · Esc. 움직이는 그림은 누를 때만(UX4).
// 전시 데이터는 GET /v1/gallery 그대로(exhibited만, 제작일 순, 낮춤 표시 없음 — UX3·D3). 준비 중 작품 수는 GET /v1/artworks.
// CSS 투시(clip-path · perspective)만 쓰고 3D 엔진·외부 이미지는 쓰지 않는다.
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '@/api/client';
import type { BlockNotice as Notice } from '@/api/client';
import type { components } from '@/api/types.gen';
import ArtFrame from '@/components/ArtFrame.vue';
import BlockNotice from '@/components/BlockNotice.vue';
import { ko } from '@/copy/ko';
import NoticeBlock from '../components/NoticeBlock.vue';
import { blockOf, type ArtworkSummary } from '../artwork';
import { reducedMotion } from '@/composables/usePolling';

type Child = components['schemas']['Child'];
type Gallery = components['schemas']['Gallery'];
type Item = components['schemas']['GalleryItem'];

const route = useRoute();
const router = useRouter();
const joined = route.query.joined === '1';
const children = ref<Child[] | null>(null);
const childId = ref(typeof route.query.child === 'string' ? route.query.child : '');
const g = ref<Gallery | null>(null);
const preparing = ref(0);
const playing = ref(false);
const showOriginal = ref(false);
const block = ref<Notice | null>(null);
const labelEl = ref<HTMLElement | null>(null);
/** 이 화면에서 작품을 열었으면 뒤로가기는 history.back — 주소로 바로 들어왔으면 전시실 주소로 바꾼다 */
let pushed = false;
let lastOpenedId = '';

const alias = computed(() => children.value?.find((c) => c.id === childId.value)?.alias ?? '');
const rooms = computed(() => g.value?.groups ?? []);
const all = computed(() => rooms.value.flatMap((r) => r.items));
const count = computed(() => all.value.length);
/** 로비 받침대: 가장 최근에 그린 작품 */
const latest = computed(() => [...all.value].sort((a, b) => b.madeOn.localeCompare(a.madeOn))[0] ?? null);
const open = computed<Item | null>(() => {
  const id = typeof route.query.art === 'string' ? route.query.art : '';
  return id ? all.value.find((it) => it.id === id) ?? null : null;
});

// 세관 벽색 — 짙은 다마스크(보르도 · 짙은 초록 · 남색 · 테라코타를 세관마다, D25 ⑥)
const WALLS = ['bordeaux', 'green', 'navy', 'terracotta'];
const wallOf = (i: number) => `var(--museum-${WALLS[i % WALLS.length]})`;
const roomIndexOf = (it: Item) => Math.max(0, rooms.value.findIndex((r) => r.items.some((x) => x.id === it.id)));

function still(it: Item) { return it.kind === 'frame' ? it.originalUrl : it.kind === 'relief' ? it.auxUrl ?? it.originalUrl : it.posterUrl ?? it.originalUrl; }
const yearOf = (d: string) => d.slice(0, 4);
const monthOf = (d: string) => Number(d.slice(5, 7));

async function load() {
  if (!childId.value) return;
  try {
    const [gal, list] = await Promise.all([
      api.get<Gallery>('/v1/gallery', { query: { child: childId.value } }),
      api.get<ArtworkSummary[]>('/v1/artworks', { query: { child: childId.value } }).catch(() => [] as ArtworkSummary[]),
    ]);
    g.value = gal; preparing.value = list.filter((a) => a.state !== 'exhibited').length; block.value = null;
  } catch (e) { block.value = blockOf(e); }
}
onMounted(async () => {
  try {
    children.value = await api.get<Child[]>('/v1/children');
    // 주소의 아이가 그대로 맞으면 watch가 돌지 않으므로 여기서 불러온다(?child=&art= 로 바로 들어온 경우)
    if (!children.value.some((c) => c.id === childId.value)) childId.value = children.value[0]?.id ?? ''; else void load();
    if (!children.value.length) g.value = { childId: '', groups: [] };
  } catch (e) { block.value = blockOf(e); }
});
watch(childId, (id, prev) => {
  const q: Record<string, unknown> = { ...route.query, child: id };
  if (prev) delete q.art; // 아이를 바꾸면 전시실로
  if (id) void router.replace({ query: q as typeof route.query });
  void load();
});

async function show(it: Item) {
  lastOpenedId = it.id; pushed = true;
  await router.push({ query: { ...route.query, art: it.id } });
}
function back() {
  if (!open.value) return;
  if (pushed) { pushed = false; router.back(); return; }
  const q = { ...route.query }; delete q.art;
  void router.replace({ query: q });
}
// 작품 앞에 들어가면 라벨로 초점, 나오면 열었던 작품으로 초점을 돌려준다
watch(open, async (it, prev) => {
  playing.value = false; showOriginal.value = false;
  await nextTick();
  if (it) { labelEl.value?.focus(); window.scrollTo({ top: 0 }); return; }
  if (!it && prev) { pushed = false; document.querySelector<HTMLElement>(`[data-art="${lastOpenedId || prev.id}"]`)?.focus(); }
});
function onKey(e: KeyboardEvent) { if (e.key === 'Escape' && open.value) { e.preventDefault(); back(); } }
onMounted(() => window.addEventListener('keydown', onKey));
onBeforeUnmount(() => window.removeEventListener('keydown', onKey));

async function goRoom(age: number) {
  await nextTick();
  const el = document.getElementById(`room-${age}`);
  el?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  el?.querySelector<HTMLElement>('h2')?.focus();
}
/** 평면도 칸: 왼쪽·오른쪽 번갈아, 두 칸이 한 줄 */
const planRows = computed(() => Math.max(1, Math.ceil(rooms.value.length / 2)));
</script>

<template>
  <main class="museum">
    <div class="container">
      <NoticeBlock v-if="joined" :title="ko.family.joined" />
      <BlockNotice v-if="block" :notice="block" @action="load" />
    </div>

    <!-- 작품 앞: 다마스크 벽의 큰 금박 액자 + 월 라벨(전시 해설) -->
    <section v-if="open" class="viewing museum-damask" :style="{ '--wall': wallOf(roomIndexOf(open)) }" aria-labelledby="wl-title">
      <div class="museum-cornice" aria-hidden="true"></div>
      <div class="container viewing-in">
        <div class="wall-piece">
          <ArtFrame size="lg" gold :src="(showOriginal ? open.originalUrl : still(open)) ?? null"
            :video="!showOriginal && open.kind === 'animated' ? open.primaryUrl ?? null : null" :playing="playing" :alt="open.title" @reload="load" />
        </div>
        <aside ref="labelEl" class="walllabel" tabindex="-1" aria-live="polite">
          <button class="wl-back" type="button" @click="back"><span aria-hidden="true">←</span> {{ ko.museum.back }}</button>
          <p class="wl-eyebrow">{{ ko.museum.label }}</p>
          <h1 id="wl-title" class="wl-title">{{ open.title }}</h1>
          <p class="wl-artist">{{ ko.museum.artist(alias, open.ageAtMaking, yearOf(open.madeOn)) }}</p>
          <p class="wl-kind">{{ ko.museum.kind[open.kind] }}</p>
          <p class="wl-desc">
            {{ ko.museum.intro(open.title, alias, open.ageAtMaking, yearOf(open.madeOn), monthOf(open.madeOn)) }}
            <template v-if="open.childWords">{{ ko.museum.wordsBefore }}<span class="wl-words">{{ open.childWords }}</span>{{ ko.museum.wordsAfter }}</template>
            <template v-if="ko.museum.kindLine[open.kind]">{{ ko.museum.kindLine[open.kind] }}</template>
          </p>
          <p v-if="open.backsideEstimated" class="wl-note">{{ ko.gallery.backside }}</p>
          <div v-if="open.guardianNote" class="wl-block">
            <p class="wl-h">{{ ko.museum.guardianNote }}</p>
            <p class="wl-note-text">{{ open.guardianNote }}</p>
          </div>
          <div v-if="open.aiCaption?.body" class="wl-block">
            <p class="wl-h">{{ ko.museum.commentary }}</p>
            <p>{{ open.aiCaption.body }}</p>
          </div>
          <div v-if="open.kind !== 'frame'" class="wl-acts">
            <button v-if="open.kind === 'animated' && !showOriginal && open.primaryUrl && !reducedMotion()" class="btn btn-light" type="button" :aria-pressed="playing"
              @click="playing = !playing">{{ playing ? ko.museum.stop : ko.museum.play }}</button>
            <button class="btn btn-light" type="button" :aria-pressed="showOriginal"
              @click="showOriginal = !showOriginal; playing = false">{{ showOriginal ? ko.museum.showWork : ko.museum.showOriginal }}</button>
          </div>
        </aside>
      </div>
      <div class="viewing-floor museum-marble" aria-hidden="true"></div>
    </section>

    <template v-else>
      <!-- 로비: 카세톤 볼트 홀, 걸린 배너, 받침대의 최근 작품, 소장 작품 명판 -->
      <header class="lobby">
        <div class="vault" aria-hidden="true"></div>
        <div class="container lobby-in">
          <div class="banner" aria-live="polite">
            <p class="banner-eyebrow">{{ ko.museum.name }}</p>
            <h1 class="banner-title">{{ alias ? ko.museum.hall(alias) : ko.museum.name }}</h1>
          </div>
          <div v-if="(children?.length ?? 0) > 1" class="field pick">
            <label for="ms-child">{{ ko.museum.child }}</label>
            <select id="ms-child" v-model="childId" class="input">
              <option v-for="c in children ?? []" :key="c.id" :value="c.id">{{ c.alias }}</option>
            </select>
          </div>
          <div v-if="latest" class="pedestal-set">
            <p class="museum-plate plate-sm">{{ ko.museum.latest }}</p>
            <button class="pedestal-piece" type="button" :aria-label="ko.museum.latest" @click="show(latest)">
              <ArtFrame size="sm" gold :src="still(latest) ?? null" :alt="latest.title" />
            </button>
            <div class="pedestal" aria-hidden="true"></div>
            <p class="museum-plate collection">{{ ko.museum.collection(count) }}</p>
          </div>
        </div>
        <div class="lobby-floor museum-marble" aria-hidden="true"></div>
      </header>

      <!-- 건축 평면도: 두꺼운 벽선, 문 틈, 실 번호, 가운데 회랑, 양옆 전시실, 아래 로비와 입구 계단, 방위 -->
      <nav v-if="rooms.length" class="container plan" :aria-label="ko.museum.plan">
        <p class="plan-h">{{ ko.museum.plan }}</p>
        <div class="blueprint">
          <p class="compass" aria-hidden="true"><span>▲</span>{{ ko.museum.north }}</p>
          <p class="bp-title" aria-hidden="true">{{ ko.museum.floorPlan }}</p>
          <div class="plan-map" :style="{ gridTemplateRows: `repeat(${planRows}, minmax(64px,auto)) 56px` }">
            <div class="corridor" aria-hidden="true" :style="{ gridRow: `1 / span ${planRows}` }"><span>{{ ko.museum.corridor }}</span></div>
            <button v-for="(r, i) in rooms" :key="r.ageAtMaking" type="button" class="plan-room" :class="i % 2 ? 'right' : 'left'"
              :style="{ gridRow: Math.floor(i / 2) + 1, '--wall': wallOf(i) }" @click="goRoom(r.ageAtMaking)">
              <span class="no" aria-hidden="true">{{ String(i + 1).padStart(2, '0') }}</span>
              <b>{{ ko.museum.room(r.ageAtMaking) }}</b><span class="n">{{ r.items.length }}</span>
            </button>
            <div class="plan-lobby" aria-hidden="true" :style="{ gridRow: planRows + 1 }">{{ ko.museum.lobby }}</div>
          </div>
          <div class="stairs" aria-hidden="true"><span>{{ ko.museum.entrance }}</span></div>
        </div>
      </nav>

      <!-- 세관: 한 점 투시 전시실 -->
      <section v-for="(r, ri) in rooms" :id="`room-${r.ageAtMaking}`" :key="r.ageAtMaking" class="room" :style="{ '--wall': wallOf(ri) }" :aria-labelledby="`rh-${r.ageAtMaking}`">
        <div class="hall">
          <div class="ceiling" aria-hidden="true"><div class="skylight"></div></div>
          <div class="side left museum-damask" aria-hidden="true"></div>
          <div class="side right museum-damask" aria-hidden="true"></div>
          <div class="floor" aria-hidden="true"><div class="tiles museum-marble"></div></div>
          <div class="backwall museum-damask">
            <div class="museum-cornice" aria-hidden="true"></div>
            <h2 :id="`rh-${r.ageAtMaking}`" class="signplate museum-plate" tabindex="-1">{{ ko.museum.room(r.ageAtMaking) }}</h2>
            <div class="hang-scroll" tabindex="0" role="region" :aria-label="ko.museum.hangOf(r.ageAtMaking)">
            <ul class="hang">
              <li v-for="it in r.items" :key="it.id">
                <button class="piece" type="button" :aria-label="it.title" :data-art="it.id" @click="show(it)">
                  <ArtFrame size="sm" gold :src="still(it) ?? null" :alt="it.title" />
                </button>
                <p class="plaque museum-plate"><b>{{ it.title }}</b><span>{{ ko.museum.plaque(it.madeOn, it.ageAtMaking) }}</span></p>
              </li>
            </ul>
            </div>
          </div>
          <div class="bench" aria-hidden="true"></div>
        </div>
      </section>

      <!-- 빈 전시실: 빈 액자 걸이 -->
      <section v-if="g && !count" class="room" :style="{ '--wall': wallOf(0) }" aria-labelledby="rh-empty">
        <div class="hall">
          <div class="ceiling" aria-hidden="true"><div class="skylight"></div></div>
          <div class="side left museum-damask" aria-hidden="true"></div>
          <div class="side right museum-damask" aria-hidden="true"></div>
          <div class="floor" aria-hidden="true"><div class="tiles museum-marble"></div></div>
          <div class="backwall museum-damask">
            <div class="museum-cornice" aria-hidden="true"></div>
            <ul class="hang empty">
              <li><ArtFrame size="sm" gold :lit="true" /></li>
              <li class="hide-m"><ArtFrame size="sm" gold :lit="true" /></li>
            </ul>
          </div>
        </div>
        <div class="container empty-cta">
          <h2 id="rh-empty" class="t-headline">{{ ko.museum.emptyTitle }}</h2>
          <RouterLink class="btn btn-primary" :to="children?.length ? '/app/upload' : '/app/children'">{{ ko.museum.upload }}</RouterLink>
        </div>
      </section>

      <div v-if="preparing" class="container prep">
        <p class="t-body-sm">{{ ko.museum.preparing(preparing) }}</p>
        <RouterLink class="btn btn-secondary" to="/app/works">{{ ko.museum.manage }}</RouterLink>
      </div>
    </template>
  </main>
</template>

<style scoped>
/* 르네상스 전시관(SD_02 §17-2 D25 ⑥) — 색은 museum.css의 --museum-* 전용 팔레트만. 관리 화면은 스타일가이드 그대로 */
.museum{background:var(--museum-stone);color:var(--museum-ink);padding-bottom:var(--s-section);word-break:keep-all;overflow-x:clip;min-height:100vh}

/* ---- 로비: 카세톤 볼트 천장 + 벽기둥 + 대리석 바닥 ---- */
.lobby{position:relative;padding:var(--s-xl) 0 0;overflow:hidden;
  background:linear-gradient(180deg,var(--museum-stone-2),var(--museum-stone) 60%)}
.vault{position:absolute;inset:0 0 auto;height:220px;opacity:.9;
  background:
    radial-gradient(ellipse 60% 100% at 50% 0,rgba(255,244,214,.75),rgba(255,244,214,0) 70%),
    repeating-linear-gradient(90deg,transparent 0 58px,var(--museum-gold-3) 58px 60px,var(--museum-stone) 60px 64px,var(--museum-gold-3) 64px 66px),
    repeating-linear-gradient(180deg,transparent 0 44px,var(--museum-stone-2) 44px 50px),
    linear-gradient(180deg,color-mix(in srgb,var(--museum-stone-2) 80%,var(--museum-ink)),var(--museum-stone-2));
  -webkit-mask-image:linear-gradient(180deg,#000 55%,transparent);mask-image:linear-gradient(180deg,#000 55%,transparent)}
.lobby-in{position:relative;display:grid;gap:var(--s-md);justify-items:center;text-align:center;padding-bottom:var(--s-lg)}
@media (min-width:961px){.lobby-in::before,.lobby-in::after{content:"";position:absolute;top:0;bottom:0;width:48px;
  background:linear-gradient(180deg,var(--museum-gold-2) 0 14px,var(--museum-gold-3) 14px 18px,transparent 18px),
    repeating-linear-gradient(90deg,var(--museum-marble-1) 0 8px,var(--museum-stone-2) 8px 11px);box-shadow:0 8px 18px rgba(0,0,0,.25)}
  .lobby-in::before{left:var(--s-md)}.lobby-in::after{right:var(--s-md)}}
.banner{background:var(--museum-bordeaux);color:var(--museum-marble-1);border:3px solid var(--museum-gold-2);border-top:0;border-radius:0 0 var(--r-md) var(--r-md);
  padding:var(--s-xl) var(--s-xxl) var(--s-xxl);position:relative;box-shadow:0 14px 30px rgba(0,0,0,.35);max-width:720px;width:100%;
  clip-path:polygon(0 0,100% 0,100% 88%,50% 100%,0 88%)}
.banner::before,.banner::after{content:"";position:absolute;top:0;width:2px;height:22px;background:var(--museum-gold-2)}
.banner::before{left:18%}.banner::after{right:18%}
.banner-eyebrow{font:400 14px/1.3 var(--font-mono);letter-spacing:.54px;color:var(--museum-gold-1)}
.banner-title{margin:var(--s-xs) 0 0;font:340 48px/1.1 var(--font-sans);letter-spacing:-.8px}
@media (max-width:560px){.banner{padding:var(--s-lg) var(--s-md) var(--s-xl)}.banner-title{font-size:32px}}
.pick{min-width:220px}
.pick label{color:var(--museum-ink)}
/* 받침대의 최근 작품 */
.pedestal-set{display:grid;justify-items:center;gap:var(--s-xs);margin-top:var(--s-sm)}
.pedestal-piece{border:0;background:none;padding:0;cursor:pointer}
.pedestal-piece :deep(.artframe){--art-h:120px;--art-max-w:200px}
.pedestal{width:170px;height:70px;margin-top:-6px;
  background:linear-gradient(180deg,var(--museum-marble-1) 0 12px,var(--museum-gold-3) 12px 14px,var(--museum-marble-2) 14px 22px,var(--museum-marble-1) 22px 60px,var(--museum-stone-2) 60px);
  clip-path:polygon(0 0,100% 0,92% 20%,92% 86%,100% 100%,0 100%,8% 86%,8% 20%);box-shadow:0 12px 20px rgba(0,0,0,.25)}
.museum-plate{border-radius:var(--r-xs);padding:6px 14px;font:540 15px/1.3 var(--font-sans)}
.plate-sm{font:400 12px/1.2 var(--font-mono);letter-spacing:.4px;padding:5px 10px}
.lobby-floor{height:34px;transform:perspective(200px) rotateX(38deg);transform-origin:top;margin:0 -10%}

/* ---- 건축 평면도(청사진 대신 양피지 위 먹선) ---- */
.plan{margin:var(--s-xl) auto var(--s-xl)}
.plan-h{font:400 14px/1.3 var(--font-mono);letter-spacing:.54px;text-transform:uppercase;text-align:center;margin-bottom:var(--s-sm)}
.blueprint{position:relative;max-width:620px;margin:0 auto;padding:40px 18px 0;background:
  repeating-linear-gradient(0deg,transparent 0 23px,rgba(125,90,30,.12) 23px 24px),repeating-linear-gradient(90deg,transparent 0 23px,rgba(125,90,30,.12) 23px 24px),var(--museum-marble-1);
  border:1px solid var(--museum-gold-3);box-shadow:0 10px 24px rgba(0,0,0,.2)}
.bp-title{position:absolute;top:12px;left:18px;font:400 12px/1 var(--font-mono);letter-spacing:.6px}
.compass{position:absolute;top:8px;right:16px;display:grid;justify-items:center;font:540 12px/1 var(--font-mono)}
.compass span{font-size:14px;color:var(--museum-bordeaux)}
.plan-map{display:grid;grid-template-columns:1fr 72px 1fr;border:6px solid var(--museum-ink);background:var(--museum-marble-1)}
.corridor{grid-column:2;border-left:3px solid var(--museum-ink);border-right:3px solid var(--museum-ink);display:flex;align-items:center;justify-content:center;
  background:repeating-linear-gradient(45deg,transparent 0 10px,rgba(29,26,22,.07) 10px 11px)}
.corridor span{font:400 12px/1 var(--font-mono);letter-spacing:.6px;writing-mode:vertical-rl}
.plan-room{position:relative;border:0;border-bottom:3px solid var(--museum-ink);background:color-mix(in srgb,var(--wall) 14%,var(--museum-marble-1));min-height:64px;
  display:flex;align-items:center;justify-content:center;gap:var(--s-xs);padding:10px 14px;font:330 16px/1.2 var(--font-sans);cursor:pointer;color:var(--museum-ink)}
.plan-room b{font-weight:600}
.plan-room .n{font:400 12px/1 var(--font-mono);border:1px solid var(--museum-ink);border-radius:var(--r-pill);padding:3px 7px}
.plan-room .no{position:absolute;top:6px;font:400 11px/1 var(--font-mono);opacity:.75}
.plan-room.left{grid-column:1}.plan-room.left .no{left:8px}
.plan-room.right{grid-column:3}.plan-room.right .no{right:8px}
/* 문 틈: 회랑 쪽 벽선을 끊는다 */
.plan-room::after{content:"";position:absolute;top:50%;height:26px;width:10px;transform:translateY(-50%);background:var(--museum-marble-1)}
.plan-room.left::after{right:-7px}.plan-room.right::after{left:-7px}
.plan-room:hover,.plan-room:focus-visible{background:color-mix(in srgb,var(--wall) 30%,var(--museum-marble-1))}
.plan-lobby{grid-column:1 / -1;display:grid;place-items:center;font:400 13px/1 var(--font-mono);letter-spacing:.6px;background:color-mix(in srgb,var(--museum-gold-1) 30%,var(--museum-marble-1))}
.stairs{width:120px;margin:0 auto;padding:6px 0 10px;display:grid;justify-items:center;font:400 12px/1 var(--font-mono);letter-spacing:.6px;
  background:repeating-linear-gradient(180deg,var(--museum-ink) 0 2px,transparent 2px 7px) top/100% 22px no-repeat;padding-top:28px}

/* ---- 세관: 한 점 투시 전시실 ---- */
.room{margin-top:var(--s-xl);scroll-margin-top:var(--s-md)}
.hall{position:relative;height:clamp(460px,62vw,600px);overflow:hidden;background:var(--museum-ink);--bx:16%;--by:18%;--bb:80%}
.ceiling,.side,.floor{position:absolute;inset:0}
.ceiling{clip-path:polygon(0 0,100% 0,calc(100% - var(--bx)) var(--by),var(--bx) var(--by));
  background:
    repeating-linear-gradient(90deg,transparent 0 46px,var(--museum-gold-3) 46px 48px),
    repeating-linear-gradient(180deg,transparent 0 22px,var(--museum-gold-3) 22px 23px),
    linear-gradient(180deg,var(--museum-stone-2),var(--museum-stone))}
.skylight{position:absolute;left:38%;right:38%;top:3%;height:9%;background:linear-gradient(180deg,#fffaf0,var(--museum-marble-2));border:2px solid var(--museum-gold-3);box-shadow:0 0 40px 12px rgba(255,248,225,.55)}
.side.left{clip-path:polygon(0 0,var(--bx) var(--by),var(--bx) var(--bb),0 100%);filter:brightness(.72)}
.side.right{clip-path:polygon(100% 0,calc(100% - var(--bx)) var(--by),calc(100% - var(--bx)) var(--bb),100% 100%);filter:brightness(.6)}
.floor{clip-path:polygon(0 100%,var(--bx) var(--bb),calc(100% - var(--bx)) var(--bb),100% 100%);overflow:hidden;transform:translateZ(0)}
.tiles{position:absolute;left:-60%;right:-60%;top:var(--bb);height:60%;transform:perspective(260px) rotateX(58deg);transform-origin:top}
.backwall{position:absolute;left:var(--bx);right:var(--bx);top:var(--by);bottom:calc(100% - var(--bb));display:grid;grid-template-rows:auto auto 1fr;
  box-shadow:inset 0 -10px 0 color-mix(in srgb,var(--museum-ink) 80%,var(--wall)),inset 0 40px 60px -30px rgba(255,244,214,.35)}
.signplate{justify-self:center;margin:8px 0 0;font:600 18px/1 var(--font-sans);padding:9px 20px}
.hang-scroll{overflow-x:auto;scroll-snap-type:x proximity;scrollbar-width:thin;align-self:end;min-width:0}
.hang{list-style:none;margin:0;padding:10px 16px 18px;display:flex;gap:var(--s-lg);align-items:flex-end;justify-content:safe center;min-width:min-content}
.hang-scroll:focus-visible{outline:3px solid var(--museum-gold-1);outline-offset:-3px}
.hang li{display:grid;justify-items:center;gap:6px;flex:none;scroll-snap-align:center}
.hang :deep(.artframe){--art-h:clamp(96px,16vw,170px);--art-max-w:clamp(120px,22vw,260px)}
.piece{border:0;background:none;padding:0;cursor:pointer;transition:transform .2s ease}
.piece:hover{transform:translateY(-3px)}
.plaque{display:grid;gap:2px;text-align:center;min-width:120px;max-width:200px;padding:5px 10px}
.plaque b{font:600 14px/1.25 var(--font-sans)}
.plaque span{font:400 11px/1.2 var(--font-mono);letter-spacing:.3px}
.bench{position:absolute;z-index:2;left:50%;bottom:6%;width:min(34%,260px);height:22px;transform:translateX(-50%);border-radius:3px;
  background:linear-gradient(180deg,var(--museum-bordeaux) 0 55%,color-mix(in srgb,var(--museum-bordeaux) 60%,var(--museum-ink)) 55%);
  box-shadow:0 22px 0 -14px var(--museum-gold-3),0 30px 20px rgba(0,0,0,.35)}
@media (max-width:560px){.hall{--bx:7%;--by:12%;--bb:84%;height:480px}.bench{display:none}.hide-m{display:none}}
.hang.empty{justify-content:center}
.empty-cta{display:grid;justify-items:center;gap:var(--s-md);padding:var(--s-lg) 0;text-align:center}
.prep{display:flex;flex-wrap:wrap;gap:var(--s-sm);align-items:center;justify-content:center;margin-top:var(--s-xl)}

/* ---- 작품 앞: 다마스크 벽, 큰 금박 액자, 상아색 월 라벨 ---- */
.museum:has(> .viewing){padding-bottom:0}
.viewing{position:relative;padding:0;overflow-x:clip;min-height:calc(100dvh - 64px);display:grid;grid-template-rows:auto 1fr auto}
.viewing-in{display:grid;grid-template-columns:minmax(0,1.6fr) minmax(260px,1fr);gap:var(--s-xxl);align-items:center;padding:var(--s-xl) 0}
@media (max-width:900px){.viewing-in{grid-template-columns:minmax(0,1fr);justify-items:center}}
.wall-piece{display:grid;place-items:center;max-width:100%}
.walllabel{background:var(--museum-marble-1);color:var(--museum-ink);border:1px solid var(--museum-gold-2);border-radius:var(--r-xs);padding:var(--s-lg);display:grid;gap:var(--s-sm);
  max-width:420px;width:100%;box-shadow:0 14px 30px rgba(0,0,0,.4),inset 0 0 0 4px var(--museum-marble-1),inset 0 0 0 5px var(--museum-gold-2)}
.wl-back{justify-self:start;background:none;border:1px solid var(--museum-gold-3);border-radius:var(--r-pill);padding:6px 14px;font:540 15px/1 var(--font-sans);color:var(--museum-ink);cursor:pointer}
.wl-back:hover{background:color-mix(in srgb,var(--museum-gold-1) 40%,transparent)}
.wl-eyebrow{font:400 12px/1 var(--font-mono);letter-spacing:.6px;color:var(--museum-gold-3)}
.wl-title{margin:0;font:600 26px/1.3 var(--font-sans)}
.wl-title::before{content:"「"}.wl-title::after{content:"」"}
.wl-artist{font:400 15px/1.4 var(--font-sans)}
.wl-kind{font:400 13px/1.4 var(--font-mono);letter-spacing:.3px;border-top:1px solid var(--museum-gold-2);padding-top:var(--s-sm)}
.wl-desc{font:330 17px/1.7 var(--font-sans)}
.wl-words{font-weight:540}
.wl-note{font:330 14px/1.45 var(--font-sans)}
.wl-block{display:grid;gap:4px;border-top:1px solid var(--museum-gold-2);padding-top:var(--s-sm)}
.wl-h{font:400 12px/1 var(--font-mono);letter-spacing:.6px;color:var(--museum-gold-3)}
.wl-note-text{font:330 italic 16px/1.6 var(--font-sans)}
.wl-acts{display:flex;flex-wrap:wrap;gap:var(--s-xs);margin-top:var(--s-xs)}
.btn-light{background:var(--museum-ink);color:var(--museum-marble-1);padding:8px 16px;font-size:16px}
.viewing-floor{height:56px;transform:perspective(220px) rotateX(40deg);transform-origin:top;margin:0 -12%}
</style>
