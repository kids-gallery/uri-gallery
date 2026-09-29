<script setup lang="ts">
// 홈 = 전시실(제안, SD_02 §17-2 — S8 가족 전시를 홈으로 확장). 로그인 뒤 첫 화면.
// 로비 배너("{별칭}의 미술관") → 평면 안내도(가운데 복도, 양옆 N세관 — 긴 회랑과 번호 붙은 방) → 세관마다 명판·벽·흑백 액자·조명·명패.
// 작품을 누르면 "작품 앞": 큰 액자 + 월 라벨(제목·별칭·나이·그린 날·결과 종류·아이의 한마디·AI 해설). 움직이는 그림은 누를 때만(UX4).
// 전시 데이터는 GET /v1/gallery 그대로(exhibited만, 제작일 순, 낮춤 표시 없음 — UX3·D3). 준비 중 작품 수는 GET /v1/artworks.
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '@/api/client';
import type { BlockNotice as Notice } from '@/api/client';
import type { components } from '@/api/types.gen';
import ArtFrame from '@/components/ArtFrame.vue';
import BlockNotice from '@/components/BlockNotice.vue';
import { ko } from '@/copy/ko';
import NoticeBlock from '../components/NoticeBlock.vue';
import { blockOf, type ArtworkSummary } from '../artwork';

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
const open = ref<Item | null>(null);
const playing = ref(false);
const showOriginal = ref(false);
const block = ref<Notice | null>(null);
const labelEl = ref<HTMLElement | null>(null);

const alias = computed(() => children.value?.find((c) => c.id === childId.value)?.alias ?? '');
const rooms = computed(() => g.value?.groups ?? []);
const count = computed(() => rooms.value.reduce((n, r) => n + r.items.length, 0));

const WALLS = ['cream', 'mint', 'lilac', 'pink', 'lime', 'coral'];
// D24 ⑤ 전시실 예외: 토큰 파스텔을 석조 톤과 반씩 섞어 채도를 낮춘다(미술관 벽처럼 차분하게)
const wallOf = (i: number) => `color-mix(in srgb,var(--color-block-${WALLS[i % WALLS.length]}) 50%,var(--stone))`;

function still(it: Item) { return it.kind === 'frame' ? it.originalUrl : it.kind === 'relief' ? it.auxUrl ?? it.originalUrl : it.posterUrl ?? it.originalUrl; }

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
    if (!children.value.some((c) => c.id === childId.value)) childId.value = children.value[0]?.id ?? '';
    if (!children.value.length) g.value = { childId: '', groups: [] };
  } catch (e) { block.value = blockOf(e); }
});
watch(childId, (id) => { open.value = null; if (id) void router.replace({ query: { ...route.query, child: id } }); void load(); });

async function show(it: Item) {
  open.value = it; playing.value = false; showOriginal.value = false;
  await nextTick(); labelEl.value?.focus(); window.scrollTo({ top: 0 });
}
async function goRoom(age: number) {
  await nextTick();
  const el = document.getElementById(`room-${age}`);
  el?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  el?.querySelector<HTMLElement>('h2')?.focus();
}
</script>

<template>
  <main class="museum">
    <div class="container">
      <NoticeBlock v-if="joined" :title="ko.family.joined" />
      <BlockNotice v-if="block" :notice="block" @action="load" />
    </div>

    <!-- 작품 앞: 큰 액자 + 월 라벨 -->
    <section v-if="open" class="viewing" aria-labelledby="wl-title">
      <div class="container viewing-in">
        <div class="wall-piece">
          <ArtFrame size="lg" :src="(showOriginal ? open.originalUrl : still(open)) ?? null"
            :video="!showOriginal && open.kind === 'animated' ? open.primaryUrl ?? null : null" :playing="playing" :alt="open.title" @reload="load" />
        </div>
        <aside ref="labelEl" class="walllabel" tabindex="-1" aria-live="polite">
          <h1 id="wl-title" class="wl-title">{{ open.title }}</h1>
          <p class="wl-meta">{{ alias }}, {{ ko.museum.plaque(open.madeOn, open.ageAtMaking) }}</p>
          <p class="wl-kind">{{ ko.museum.kind[open.kind] }}</p>
          <p v-if="open.backsideEstimated" class="wl-note">{{ ko.gallery.backside }}</p>
          <div v-if="open.childWords" class="wl-block">
            <p class="wl-h">{{ ko.museum.childWords }}</p>
            <p class="wl-words">{{ open.childWords }}</p>
          </div>
          <div v-if="open.guardianNote" class="wl-block">
            <p class="wl-h">{{ ko.museum.guardianNote }}</p>
            <p class="wl-note-text">{{ open.guardianNote }}</p>
          </div>
          <div v-if="open.aiCaption?.body" class="wl-block">
            <p class="wl-h">{{ ko.museum.commentary }}</p>
            <p>{{ open.aiCaption.body }}</p>
          </div>
          <div class="wl-acts">
            <button v-if="open.kind === 'animated' && !showOriginal && open.primaryUrl" class="btn btn-light" type="button" :aria-pressed="playing"
              @click="playing = !playing">{{ playing ? ko.museum.stop : ko.museum.play }}</button>
            <button v-if="open.kind !== 'frame'" class="btn btn-light" type="button" :aria-pressed="showOriginal"
              @click="showOriginal = !showOriginal; playing = false">{{ showOriginal ? ko.museum.showWork : ko.museum.showOriginal }}</button>
            <button class="btn btn-ghost" type="button" @click="open = null">{{ ko.museum.back }}</button>
          </div>
        </aside>
      </div>
    </section>

    <template v-else>
      <!-- 로비 -->
      <header class="lobby">
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
        </div>
      </header>

      <!-- 평면 안내도: 가운데 복도, 양옆 세관 -->
      <nav v-if="rooms.length" class="container plan" :aria-label="ko.museum.plan">
        <p class="plan-h">{{ ko.museum.plan }}</p>
        <div class="plan-map">
          <div class="corridor" aria-hidden="true" :style="{ gridRow: `1 / span ${Math.max(1, Math.ceil(rooms.length / 2))}` }"><span>{{ ko.museum.entrance }}</span></div>
          <button v-for="(r, i) in rooms" :key="r.ageAtMaking" type="button" class="plan-room" :class="i % 2 ? 'right' : 'left'"
            :style="{ gridRow: Math.floor(i / 2) + 1 }" @click="goRoom(r.ageAtMaking)">
            <b>{{ ko.museum.room(r.ageAtMaking) }}</b><span>{{ r.items.length }}</span>
          </button>
        </div>
      </nav>

      <!-- 세관 -->
      <section v-for="(r, ri) in rooms" :id="`room-${r.ageAtMaking}`" :key="r.ageAtMaking" class="room" :style="{ '--room-wall': wallOf(ri) }" :aria-labelledby="`rh-${r.ageAtMaking}`">
        <div class="container">
          <h2 :id="`rh-${r.ageAtMaking}`" class="signplate" tabindex="-1">{{ ko.museum.room(r.ageAtMaking) }}</h2>
        </div>
        <div class="wall">
          <ul class="container hang">
            <li v-for="it in r.items" :key="it.id">
              <button class="piece" type="button" :aria-label="it.title" @click="show(it)">
                <ArtFrame :src="still(it) ?? null" :alt="it.title" />
              </button>
              <p class="plaque"><b>{{ it.title }}</b><span>{{ ko.museum.plaque(it.madeOn, it.ageAtMaking) }}</span></p>
            </li>
          </ul>
          <div class="floor" aria-hidden="true"></div>
        </div>
      </section>

      <!-- 빈 전시실: 빈 액자 걸이 -->
      <section v-if="g && !count" class="room" aria-labelledby="rh-empty">
        <div class="wall">
          <ul class="container hang">
            <li><ArtFrame :lit="true" /></li>
            <li class="hide-m"><ArtFrame :lit="true" /></li>
            <li class="hide-m"><ArtFrame :lit="true" /></li>
          </ul>
          <div class="container empty-cta">
            <h2 id="rh-empty" class="t-headline">{{ ko.museum.emptyTitle }}</h2>
            <RouterLink class="btn btn-primary" :to="children?.length ? '/app/upload' : '/app/children'">{{ ko.museum.upload }}</RouterLink>
          </div>
          <div class="floor" aria-hidden="true"></div>
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
/* 전시관 — 흰 바탕 없이 석조 벽 톤(SD_02 §17-2 토큰 사상). 새 색 없음: 토큰과 color-mix만 */
.room{--room-wall:var(--wall)}
.museum{--stone:color-mix(in srgb,var(--color-block-cream) 70%,var(--color-surface-soft));--wall:color-mix(in srgb,var(--color-block-cream) 55%,var(--color-canvas));
  background:radial-gradient(ellipse 70% 420px at 50% 0,rgba(255,255,255,.85),rgba(255,255,255,0) 70%),var(--stone);
  padding-bottom:var(--s-section);word-break:keep-all;overflow-x:clip;min-height:100vh}
/* 로비 — 천장에서 끈 두 줄로 걸린 배너 */
.lobby{padding:var(--s-xl) 0 var(--s-lg);position:relative}
/* 입구 홀 기둥(홈 파인 기둥, 넓은 화면만) — 흰 선과 그림자 줄무늬 */
.lobby-in{position:relative}
@media (min-width:961px){.lobby-in::before,.lobby-in::after{content:"";position:absolute;top:-32px;bottom:-24px;width:56px;border-radius:6px 6px 0 0;
  background:repeating-linear-gradient(90deg,color-mix(in srgb,var(--color-canvas) 70%,var(--stone)) 0 8px,color-mix(in srgb,var(--color-ink) 10%,var(--stone)) 8px 11px);
  box-shadow:var(--elev-2)}.lobby-in::before{left:var(--s-xl)}.lobby-in::after{right:var(--s-xl)}}
.lobby::before{content:"";position:absolute;inset:0 0 auto;height:14px;background:linear-gradient(180deg,color-mix(in srgb,var(--color-ink) 18%,transparent),transparent)}
.lobby-in{display:grid;gap:var(--s-md);justify-items:center;text-align:center}
.banner{background:var(--color-block-lime);border-radius:0 0 var(--r-lg) var(--r-lg);padding:var(--s-xl) var(--s-xxl) var(--s-xxl);position:relative;box-shadow:var(--elev-3);max-width:720px;width:100%}
.banner::before,.banner::after{content:"";position:absolute;top:-32px;width:2px;height:32px;background:var(--color-ink)}
.banner::before{left:18%}.banner::after{right:18%}
.banner-eyebrow{font:400 14px/1.3 var(--font-mono);letter-spacing:.54px;text-transform:uppercase}
.banner-title{margin:var(--s-xs) 0 0;font:340 48px/1.1 var(--font-sans);letter-spacing:-.8px}
@media (max-width:560px){.banner{padding:var(--s-lg) var(--s-md) var(--s-xl)}.banner-title{font-size:32px}}
.pick{min-width:220px}
/* 평면 안내도 — 가운데 복도, 양옆 세관 */
.plan{margin:var(--s-lg) auto var(--s-xl)}
.plan-h{font:400 14px/1.3 var(--font-mono);letter-spacing:.54px;text-transform:uppercase;text-align:center;margin-bottom:var(--s-sm)}
.plan-map{display:grid;grid-template-columns:1fr 64px 1fr;gap:10px 0;max-width:560px;margin:0 auto;position:relative;background:var(--color-canvas);padding:14px;border:2px solid var(--color-ink);border-radius:var(--r-sm);box-shadow:var(--elev-2)}
.corridor{grid-column:2;background:repeating-linear-gradient(0deg,var(--color-surface-soft) 0 14px,var(--color-hairline) 14px 15px);border-left:2px solid var(--color-ink);border-right:2px solid var(--color-ink);display:flex;align-items:flex-end;justify-content:center;min-height:100%}
.corridor span{font:400 12px/1 var(--font-mono);letter-spacing:.6px;padding:6px 0;writing-mode:vertical-rl}
.plan-room{border:2px solid var(--color-ink);background:var(--wall);min-height:56px;display:flex;align-items:center;justify-content:space-between;gap:var(--s-xs);padding:8px 14px;font:330 16px/1.2 var(--font-sans);cursor:pointer;color:var(--color-ink)}
.plan-room b{font-weight:540}
.plan-room span{font:400 12px/1 var(--font-mono)}
.plan-room.left{grid-column:1;border-right:0;border-radius:var(--r-sm) 0 0 var(--r-sm)}
.plan-room.right{grid-column:3;border-left:0;border-radius:0 var(--r-sm) var(--r-sm) 0}
.plan-room:hover{background:var(--color-block-cream)}
/* 세관 — 명판, 몰딩, 벽(세관별 색), 걸레받이, 원근 바닥 */
.room{margin-top:var(--s-xl)}
.signplate{display:inline-flex;align-items:center;gap:10px;background:var(--color-inverse-canvas);color:var(--color-inverse-ink);font:540 22px/1 var(--font-sans);padding:14px 24px;border-radius:var(--r-sm);box-shadow:var(--elev-3);margin-bottom:-18px;position:relative;z-index:1}
.wall{position:relative;padding:var(--s-xxl) 0 0;
  background:
    linear-gradient(180deg,color-mix(in srgb,var(--color-ink) 22%,transparent) 0 6px,color-mix(in srgb,var(--color-canvas) 60%,transparent) 6px 9px,transparent 9px),
    radial-gradient(ellipse 60% 180px at 50% 0,rgba(255,255,255,.55),rgba(255,255,255,0) 80%),
    var(--room-wall);
  box-shadow:inset 0 -18px 0 color-mix(in srgb,var(--color-ink) 78%,var(--room-wall))}
.hang{list-style:none;margin:0 auto;display:flex;flex-wrap:wrap;justify-content:center;align-items:flex-end;gap:var(--s-xxl) var(--s-xl);padding-bottom:calc(var(--s-xl) + 18px)}
.hang li{display:grid;justify-items:center;gap:var(--s-sm)}
.piece{border:0;background:none;padding:0;cursor:pointer;transition:transform .2s ease}
.piece:hover{transform:translateY(-3px)}
.plaque{background:var(--color-inverse-canvas);color:var(--color-inverse-ink);border-radius:var(--r-xs);padding:8px 12px;display:grid;gap:2px;text-align:center;min-width:160px;max-width:260px;box-shadow:var(--elev-2)}
.plaque b{font:540 16px/1.3 var(--font-sans)}
.plaque span{font:400 12px/1.2 var(--font-mono);letter-spacing:.4px;opacity:.85}
/* 원근 바닥: 앞으로 넓어지는 줄눈 */
.floor{height:44px;background:
  repeating-linear-gradient(90deg,transparent 0 63px,color-mix(in srgb,var(--color-ink) 12%,transparent) 63px 64px),
  linear-gradient(180deg,color-mix(in srgb,var(--stone) 70%,var(--color-ink)) 0,var(--stone) 100%);
  transform:perspective(160px) rotateX(24deg);transform-origin:top;margin:0 -4%}
.empty-cta{display:grid;justify-items:center;gap:var(--s-md);padding-bottom:var(--s-xl);text-align:center}
@media (max-width:560px){.hide-m{display:none}}
.prep{display:flex;flex-wrap:wrap;gap:var(--s-sm);align-items:center;justify-content:center;margin-top:var(--s-xl)}
/* 작품 앞 — 한 벽, 한 작품, 옆 월 라벨 */
.viewing{background:radial-gradient(ellipse 60% 70% at 38% 20%,rgba(255,255,255,.6),rgba(255,255,255,0) 70%),var(--wall);padding:var(--s-xl) 0 var(--s-section);overflow-x:clip;min-height:80vh;box-shadow:inset 0 -18px 0 color-mix(in srgb,var(--color-ink) 78%,var(--wall))}
.viewing-in{display:grid;grid-template-columns:minmax(0,1.6fr) minmax(260px,1fr);gap:var(--s-xxl);align-items:center}
@media (max-width:900px){.viewing-in{grid-template-columns:minmax(0,1fr);justify-items:center}}
.wall-piece{display:grid;place-items:center;max-width:100%}
.walllabel{background:var(--color-inverse-canvas);color:var(--color-inverse-ink);border-radius:var(--r-xs);padding:var(--s-lg);display:grid;gap:var(--s-sm);max-width:420px;width:100%;box-shadow:var(--elev-3)}
.wl-title{margin:0;font:540 26px/1.3 var(--font-sans)}
.wl-meta{font:400 14px/1.4 var(--font-mono);letter-spacing:.3px;opacity:.9}
.wl-kind{font:330 16px/1.45 var(--font-sans);border-top:1px solid rgba(255,255,255,.25);padding-top:var(--s-sm)}
.wl-note{font:330 14px/1.45 var(--font-sans);opacity:.85}
.wl-block{display:grid;gap:4px;border-top:1px solid rgba(255,255,255,.25);padding-top:var(--s-sm)}
.wl-h{font:400 12px/1 var(--font-mono);letter-spacing:.6px;text-transform:uppercase;opacity:.8}
.wl-words{font:330 20px/1.45 var(--font-sans)}
.wl-note-text{font:330 italic 17px/1.55 var(--font-sans);opacity:.95}
.wl-acts{display:flex;flex-wrap:wrap;gap:var(--s-xs);margin-top:var(--s-xs)}
.btn-light{background:var(--color-inverse-ink);color:var(--color-ink);padding:8px 16px;font-size:16px}
.btn-ghost{background:transparent;color:var(--color-inverse-ink);border:1px solid rgba(255,255,255,.5);padding:8px 16px;font-size:16px}
</style>
