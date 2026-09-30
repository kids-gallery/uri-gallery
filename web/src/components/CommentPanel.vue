<script setup lang="ts">
// 부모 댓글(D46 ④, SD_02 §17-14): 가족 보호자만 읽고 쓴다(가족 밖 방문 화면에는 붙이지 않는다). 내 댓글만 [지우기], 걸린 뒤 7일 동안만.
import { computed, onMounted, ref } from 'vue';
import { api, ApiError } from '@/api/client';
import { ko } from '@/copy/ko';

interface Comment { id: string; body: string; createdAt: string; mine: boolean; author: 'me' | 'owner' | 'co' | 'gone' }
const props = defineProps<{ artworkId: string }>();
const list = ref<Comment[]>([]);
const open = ref(false);
const until = ref<string | null>(null);
const text = ref('');
const busy = ref(false);
const msg = ref('');
const when = (iso: string) => new Date(iso).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
// 7일 기한(D46 ④): 걸린 뒤 7일만 쓰고 지운다. 그 뒤로는 보기만(서버도 409 comments_closed).
const daysLeft = computed(() => (until.value ? Math.max(1, Math.ceil((Date.parse(until.value) - Date.now()) / 86400000)) : 0));
async function load() {
  try { const r = await api.get<{ items: Comment[]; open: boolean; openUntil: string }>(`/v1/artworks/${props.artworkId}/comments`); list.value = r.items; open.value = r.open; until.value = r.openUntil; }
  catch { list.value = []; open.value = false; }
}
async function send() {
  if (!text.value.trim() || busy.value) return;
  busy.value = true; msg.value = '';
  try { const c = await api.post<Comment>(`/v1/artworks/${props.artworkId}/comments`, { body: { body: text.value } }); list.value.push(c); text.value = ''; }
  catch (e) { if (e instanceof ApiError && e.reason === 'comments_closed') open.value = false; msg.value = open.value ? ko.comment.fail : ko.comment.closed; }
  busy.value = false;
}
async function del(c: Comment) {
  try { await api.del(`/v1/artworks/${props.artworkId}/comments/${c.id}`); list.value = list.value.filter((x) => x.id !== c.id); } catch { /* 그대로 둔다 */ }
}
onMounted(load);
</script>

<template>
  <section class="cm" :aria-label="ko.comment.title">
    <h3 class="cm-h">💬 {{ ko.comment.title }}</h3>
    <ul v-if="list.length" class="cm-list">
      <li v-for="c in list" :key="c.id" class="cm-item" :class="{ mine: c.mine }">
        <p class="cm-body">{{ c.body }}</p>
        <p class="cm-meta">{{ ko.comment[c.author] }} · {{ when(c.createdAt) }}
          <button v-if="c.mine && open" class="cm-del" type="button" @click="del(c)">{{ ko.comment.del }}</button></p>
      </li>
    </ul>
    <p v-else class="cm-empty">{{ ko.comment.empty }}</p>
    <p class="cm-when">{{ open ? ko.comment.left(daysLeft) : ko.comment.closed }}</p>
    <form v-if="open" class="cm-form" @submit.prevent="send">
      <label class="sr-only" for="cm-in">{{ ko.comment.ph }}</label>
      <textarea id="cm-in" v-model="text" class="input" rows="2" maxlength="500" :placeholder="ko.comment.ph"></textarea>
      <button class="btn btn-primary" type="submit" :disabled="busy || !text.trim()">{{ ko.comment.send }}</button>
    </form>
    <p class="cm-msg" role="status" aria-live="polite">{{ msg }}</p>
  </section>
</template>

<style scoped>
.cm{display:grid;gap:10px}
.cm-h{margin:0;font:700 17px/1.3 var(--mc-serif,serif);color:#4a3526}
.cm-list{list-style:none;margin:0;padding:0;display:grid;gap:8px;max-height:260px;overflow:auto}
.cm-item{background:#fffdf8;border-radius:14px;padding:10px 12px;box-shadow:0 0 0 1px rgba(201,165,82,.35)}
.cm-item.mine{background:#fff6e4}
.cm-body{margin:0;white-space:pre-wrap;font:500 15px/1.5 var(--font-sans);color:var(--color-ink)}
.cm-meta{margin:4px 0 0;font:500 12px/1.3 var(--font-sans);color:#7a6555;display:flex;gap:8px;align-items:center}
.cm-del{border:0;background:none;color:var(--color-primary);font:700 12px/1 var(--font-sans);cursor:pointer;padding:6px;min-height:32px}
.cm-when{margin:0;font:500 12px/1.3 var(--font-sans);color:#7a6555}
.cm-empty{margin:0;font:500 14px/1.4 var(--font-sans);color:#7a6555}
.cm-form{display:grid;grid-template-columns:1fr auto;gap:8px;align-items:end}
.cm-form .btn{min-height:44px}
.cm-msg{margin:0;min-height:1.2em;font:500 13px/1.3 var(--font-sans);color:#8a2b2b}
.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
</style>
