<script setup lang="ts">
// 한눈에 보기(3D미술관_재설계 §2-18): 보호자가 걷지 않고 나이별 전시실 순서로 작품 전체를 본다.
// 카드를 고르면 3D의 그 작품 앞으로 가거나 보관함에서 고친다. 원본·정보는 읽기만 한다.
import { computed, onBeforeUnmount, ref } from 'vue';
import type { Artwork } from './store';
import { ageGroups, plaqueOf, whenLine } from './curation';

// inline: 3D를 못 그리는 기기의 본 화면(§2-19 기준 5). 닫기·[미술관에서 보기]·[고치기] 없이 보기만 둔다(올리기는 위쪽 버튼)
const props = defineProps<{ artworks: Artwork[]; child: string; inline?: boolean }>();
const emit = defineEmits<{ close: []; goto: [id: string]; edit: [id: string]; upload: [] }>();

const sel = ref<string | null>(null);
const urls = new Map<string, string>();
function urlOf(a: Artwork) {
  let u = urls.get(a.id);
  if (!u) { u = URL.createObjectURL(a.display); urls.set(a.id, u); }
  return u;
}
const groups = computed(() => ageGroups(props.artworks).map((g) => ({
  ...g,
  cards: g.works.map((a) => ({ a, plaque: plaqueOf({ ...a, child: props.child }), when: whenLine(a) })),
})));
onBeforeUnmount(() => { for (const u of urls.values()) URL.revokeObjectURL(u); });
</script>

<template>
  <div class="w-overview" :class="{ 'is-inline': inline }" :role="inline ? undefined : 'dialog'" :aria-modal="inline ? undefined : 'true'" aria-label="한눈에 보기">
    <div class="w-ov-card">
      <header class="w-ov-head">
        <div>
          <h2>{{ child }}의 작품 한눈에 보기</h2>
          <p>{{ artworks.length }}점 · 나이별 전시실 순서</p>
        </div>
        <button v-if="!inline" class="g-btn" type="button" @click="emit('close')">닫기</button>
      </header>

      <div v-if="!artworks.length" class="w-ov-empty">
        <p>아직 걸린 작품이 없어요.</p>
        <button v-if="!inline" class="g-btn g-btn--primary" type="button" @click="emit('upload')">작품 올리기</button>
      </div>

      <section v-for="g in groups" :key="g.age" class="w-ov-room" :aria-label="g.title">
        <h3>{{ g.title }} <small>{{ g.works.length }}점</small></h3>
        <ul class="w-ov-grid">
          <li v-for="c in g.cards" :key="c.a.id" class="w-ov-item" :class="{ 'is-open': sel === c.a.id }">
            <button class="w-ov-pick" type="button" :disabled="inline" :aria-expanded="inline ? undefined : sel === c.a.id" @click="sel = sel === c.a.id ? null : c.a.id">
              <span class="w-ov-frame"><img :src="urlOf(c.a)" :alt="c.plaque.title" loading="lazy" /></span>
              <strong>{{ c.plaque.title }}<em v-if="c.a.sample"> 견본</em></strong>
              <span v-if="c.when" class="w-ov-when">{{ c.when }}</span>
              <q v-if="c.a.words.trim()">{{ c.a.words.trim() }}</q>
            </button>
            <div v-if="sel === c.a.id" class="w-ov-actions">
              <button class="g-btn g-btn--primary" type="button" @click="emit('goto', c.a.id)">미술관에서 보기</button>
              <button class="g-btn" type="button" @click="emit('edit', c.a.id)">고치기</button>
            </div>
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>

<style scoped>
.w-overview{position:absolute;inset:0;z-index:25;display:flex;padding:calc(env(safe-area-inset-top,0px) + 16px) 16px calc(env(safe-area-inset-bottom,0px) + 16px);background:rgba(40,28,20,.45)}
.w-overview.is-inline{position:static;padding:0;background:none}
.w-ov-pick:disabled{cursor:default}
.w-ov-card{flex:1;max-width:1100px;margin:0 auto;overflow:auto;border-radius:18px;background:#fbf7ef;color:#3b2a1e;padding:18px 20px 24px;box-shadow:0 12px 40px rgba(0,0,0,.25)}
.w-ov-head{position:sticky;top:-18px;z-index:1;display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin:-18px -20px 8px;padding:18px 20px 12px;background:#fbf7ef;border-bottom:1px solid #eadfcb}
.w-ov-head h2{margin:0;font:600 21px var(--g-serif);color:var(--g-plum-deep);word-break:keep-all}
.w-ov-head p{margin:4px 0 0;font-size:14px;color:#7a6650}
.w-ov-empty{display:grid;justify-items:start;gap:10px;padding:24px 0}
.w-ov-room{margin-top:18px}
.w-ov-room h3{margin:0 0 10px;font:600 17px var(--g-serif)}
.w-ov-room h3 small{font:400 13px inherit;color:#7a6650}
.w-ov-grid{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:14px}
.w-ov-item{display:grid;gap:8px;align-content:start}
.w-ov-pick{display:grid;gap:4px;text-align:left;padding:10px;border-radius:14px;border:1.5px solid #eadfcb;background:#fff;cursor:pointer;font:inherit;color:inherit;min-height:44px}
.w-ov-pick:hover,.w-ov-item.is-open .w-ov-pick{border-color:var(--g-plum)}
.w-ov-pick:focus-visible{outline:3px solid #f29c31;outline-offset:2px}
.w-ov-frame{display:block;aspect-ratio:4/3;border-radius:8px;background:#f1ebdf;overflow:hidden}
.w-ov-frame img{display:block;width:100%;height:100%;object-fit:contain}
.w-ov-pick strong{font-size:15px;word-break:keep-all}
.w-ov-pick em{font-style:normal;font-size:12px;color:#7a6650;margin-left:4px}
.w-ov-when{font-size:13px;color:#7a6650}
.w-ov-pick q{font-size:13px;color:#5a4636;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.w-ov-actions{display:flex;flex-wrap:wrap;gap:6px}
.w-ov-actions .g-btn{min-height:40px;padding:6px 12px;font-size:14px}
@media (max-width:600px){.w-ov-head h2{font-size:18px}.w-overview{padding:calc(env(safe-area-inset-top,0px) + 8px) 8px calc(env(safe-area-inset-bottom,0px) + 8px)}.w-ov-card{padding:14px}.w-ov-head{margin:-14px -14px 8px;padding:14px 14px 10px;top:-14px}.w-ov-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}}
</style>
