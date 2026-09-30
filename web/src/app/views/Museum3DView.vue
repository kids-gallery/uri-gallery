<script setup lang="ts">
// 아이 미술관 — 1인칭 CSS 3D(D40, SD_02 §17-13 B · C · F). 경로 파라미터 childId, ?visit=1이면 이웃 방문.
// 가족: GET /v1/children(별칭 · 캐릭터 · 색) + GET /v1/gallery?child= → 크게 보기는 walk/ArtViewer(한마디 · 해설 · 저장하기).
// 방문자: GET /v1/visit/children/{id}/gallery → 방 이름 "전시실 N", 크게 보기는 그림 · 제목만(저장 없음). 이웃이 아니면 404 → 자물쇠 안내.
// [밖으로] → 마을(/app/town).
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api, ApiError } from '@/api/client';
import type { BlockNotice as Notice } from '@/api/client';
import type { components } from '@/api/types.gen';
import BlockNotice from '@/components/BlockNotice.vue';
import { blockOf } from '../artwork';
import ArtViewer from '../walk/ArtViewer.vue';
import Scene from '../museum3d/Scene.vue';
import Viewer from '../museum3d/Viewer.vue';
import { fromGallery, fromVisit, type ChildInfo, type VisitGallery } from '../museum3d/adapters';
import { buildMuseumLayout, type MuseumInput, type MuseumItem } from '../museum3d/layout';
import { m3 } from '../museum3d/copy';

type Child = components['schemas']['Child'];
type Gallery = components['schemas']['Gallery'];
type GalleryItem = components['schemas']['GalleryItem'];

/** 홈 감싸개가 아이를 골라 넘길 수 있다(경로 파라미터가 없을 때). exitTo = [밖으로]가 갈 곳 */
const props = withDefaults(defineProps<{ childId?: string; visit?: boolean; exitTo?: string }>(), { childId: undefined, visit: undefined, exitTo: '/app/town' });
const route = useRoute();
const router = useRouter();
const childId = computed(() => props.childId ?? String(route.params.childId ?? ''));
const visitor = computed(() => props.visit ?? (route.query.visit === '1' || route.query.visit === 'true'));

const input = shallowRef<MuseumInput | null>(null);
const byId = shallowRef(new Map<string, GalleryItem>());
const block = ref<Notice | null>(null);
const locked = ref(false);
const loading = ref(true);
const loadNo = ref(0);
/** 걸리는 장면(D44 ④): ?hung={작품 id} — 장면을 시작할 때 주소에서 지운다(새로고침해도 다시 재생하지 않게) */
const hangId = ref<string | null>(null);
const viewing = ref<MuseumItem | null>(null);
let opener: HTMLElement | null = null;

const layout = computed(() => (input.value ? buildMuseumLayout(input.value) : null));
const itemCount = computed(() => input.value?.groups.reduce((n, g) => n + g.items.length, 0) ?? 0);
const familyItem = computed(() => (viewing.value && !visitor.value ? byId.value.get(viewing.value.id) ?? null : null));

async function load() {
  const id = childId.value; hangId.value = null; loading.value = true; block.value = null; locked.value = false; input.value = null;
  try {
    if (visitor.value) {
      const v = await api.get<VisitGallery>(`/v1/visit/children/${encodeURIComponent(id)}/gallery`);
      input.value = fromVisit(v);
    } else {
      const [kids, g] = await Promise.all([api.get<Child[]>('/v1/children'), api.get<Gallery>('/v1/gallery', { query: { child: id } })]);
      const c = kids.find((k) => k.id === id);
      const info: ChildInfo = { alias: c?.alias ?? '', character: c?.character ?? null, color: c?.color ?? null, museumStyle: c?.museumStyle ?? null };
      byId.value = new Map(g.groups.flatMap((grp) => grp.items).map((it) => [it.id, it]));
      input.value = fromGallery(g, info);
      const hung = typeof route.query.hung === 'string' ? route.query.hung : '';
      if (hung) { hangId.value = hung; const q = { ...route.query }; delete q.hung; void router.replace({ query: q }); }
    }
  } catch (e) {
    if (visitor.value && e instanceof ApiError && e.status === 404) locked.value = true;
    else block.value = blockOf(e);
  } finally { loading.value = false; loadNo.value++; }
}
watch([childId, visitor], () => { void load(); });

function open(item: MuseumItem) { opener = document.activeElement as HTMLElement | null; viewing.value = item; }
async function close() { viewing.value = null; await nextTick(); opener?.focus({ preventScroll: true }); }
function exit() { void router.push(props.exitTo); }

// 장면 높이: 셸 머리 아래를 꽉 채운다(가로 넘침 없음)
const rootEl = ref<HTMLElement | null>(null);
const top = ref(64);
function measure() { const r = rootEl.value?.getBoundingClientRect(); if (r) top.value = Math.max(0, r.top + window.scrollY); }
onMounted(() => { measure(); window.addEventListener('resize', measure); void load(); });
onBeforeUnmount(() => window.removeEventListener('resize', measure));
</script>

<template>
  <main ref="rootEl" class="m3v" :style="{ '--m3-top': `${top}px` }">
    <h1 class="m3v-sr">{{ m3.title(input?.childAlias ?? layout?.alias ?? '') }}</h1>
    <Scene v-if="layout" :key="loadNo" :layout="layout" :character="input?.character" :color="input?.color" :paused="!!viewing"
      :companion="!visitor" :hang="visitor ? null : hangId" @open="open" @exit="exit">
      <p v-if="visitor" class="m3v-badge">{{ m3.visitBadge }}</p>
      <div v-if="!itemCount" class="m3v-empty" role="status">
        <p>{{ visitor ? m3.emptyVisit : m3.empty }}</p>
      </div>
    </Scene>
    <div v-else class="m3v-gate">
      <p v-if="loading" role="status">{{ m3.loading }}</p>
      <template v-else-if="locked">
        <p role="alert">{{ m3.visitLocked }}</p>
        <button class="btn btn-primary" type="button" @click="exit">{{ m3.toTown }}</button>
      </template>
      <BlockNotice v-else-if="block" :notice="block" @action="load" />
    </div>

    <ArtViewer v-if="viewing && familyItem" :item="familyItem" :alias="layout?.alias ?? ''" :still="viewing.imageUrl" @close="close" />
    <Viewer v-else-if="viewing" :item="viewing" :alias="layout?.alias ?? ''" @close="close" />
  </main>
</template>

<style scoped>
.m3v{position:relative;width:100%;max-width:100vw;height:max(520px,calc(100dvh - var(--m3-top)));overflow:hidden;background:#F7F3EC}
.m3v-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;margin:0}
.m3v-gate{height:100%;display:grid;place-content:center;justify-items:center;gap:14px;padding:16px;text-align:center;color:#6E3550;font:600 17px/1.5 var(--font-sans)}
.m3v-badge{position:absolute;top:118px;left:14px;z-index:8;margin:0;padding:6px 12px;border-radius:999px;background:rgba(224,243,239,.92);color:#2F5E57;font:700 13px/1 var(--font-sans)}
.m3v-empty{position:absolute;left:50%;top:124px;transform:translateX(-50%);z-index:7;width:min(420px,calc(100% - 32px));pointer-events:none;text-align:center}
.m3v-empty p{margin:0;padding:12px 16px;border-radius:16px;background:rgba(255,251,247,.9);color:#6E3550;font:600 15px/1.5 var(--font-sans);box-shadow:0 12px 30px -20px rgba(74,52,65,.5)}
</style>
