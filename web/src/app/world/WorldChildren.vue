<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { addChild, failureOf, failureReason, listChildren, type Child, type Failure } from './server';
import { selectedChild } from './server/upload';
import { clearGallery } from './server/gallery';

const props = defineProps<{ changing?: boolean }>();
const emit = defineEmits<{ selected: [child: Child]; cancel: [] }>();
const children = ref<Child[]>([]);
const alias = ref('');
const busy = ref(false);
const notice = ref('');
const failure = ref<Failure | null>(null);
const selected = computed(() => children.value.find((child) => child.id === selectedChild.value) ?? null);

async function load() {
  busy.value = true;
  failure.value = null;
  try {
    children.value = await listChildren();
    if (children.value.length === 1 && !props.changing) choose(children.value[0]!);
    else if (selectedChild.value && !children.value.some((child) => child.id === selectedChild.value)) selectedChild.value = null;
  } catch (error) {
    failure.value = failureOf(error);
    notice.value = failureReason(failure.value);
  } finally {
    busy.value = false;
  }
}
function choose(child: Child) {
  if (selectedChild.value !== child.id) {
    selectedChild.value = child.id;
    clearGallery();
  }
  notice.value = '';
  emit('selected', child);
}
async function create() {
  const value = alias.value.trim();
  if (!value || busy.value) return;
  busy.value = true;
  notice.value = '';
  try {
    const child = await addChild(value);
    children.value = [...children.value, child];
    alias.value = '';
    choose(child);
  } catch (error) {
    failure.value = failureOf(error);
    notice.value = failureReason(failure.value);
  } finally {
    busy.value = false;
  }
}
onMounted(load);
</script>

<template>
  <section class="children" role="dialog" aria-modal="true" aria-labelledby="children-title">
    <div class="card">
      <h2 id="children-title">누구의 미술관을 열까요?</h2>
      <button v-if="changing" type="button" class="children-close" @click="emit('cancel')">닫기</button>
      <p v-if="busy" role="status">아이 목록을 불러오고 있어요</p>
      <p v-if="notice" role="alert">{{ notice }}</p>
      <ul v-if="children.length" aria-label="아이 목록">
        <li v-for="child in children" :key="child.id">
          <button type="button" :aria-pressed="selectedChild === child.id" :disabled="busy" @click="choose(child)">
            {{ child.alias }}의 미술관
          </button>
        </li>
      </ul>
      <p v-if="children.length > 1">아이를 바꾸면 다른 아이 작품은 보이지 않아요.</p>
      <form @submit.prevent="create">
        <label for="child-alias">{{ children.length ? '아이 더 등록하기' : '아이 별칭' }}</label>
        <input id="child-alias" v-model="alias" maxlength="20" required :disabled="busy" autocomplete="off">
        <button type="submit" :disabled="busy || !alias.trim()">{{ busy ? '저장하는 중' : '아이 등록하기' }}</button>
      </form>
      <button v-if="selected" type="button" @click="emit('selected', selected)">미술관 열기</button>
      <button v-if="failure" type="button" :disabled="busy" @click="load">다시 시도</button>
    </div>
  </section>
</template>

<style scoped>
.children{position:absolute;inset:0;z-index:80;display:grid;place-items:center;padding:16px;background:#0006}
.card{width:min(440px,100%);max-height:90%;overflow:auto;display:grid;gap:14px;padding:24px;box-sizing:border-box;border:1px solid #c9b38f;border-radius:18px;background:#fffdf8;color:#443529}
h2,p{margin:0;line-height:1.5}
ul{display:grid;gap:8px;margin:0;padding:0;list-style:none}
label{font-weight:600}
form{display:grid;gap:8px}
input,button{min-height:44px;box-sizing:border-box;font:inherit}
input{width:100%;padding:10px;border:1px solid #bda881;border-radius:10px}
button{padding:8px 14px;border:1px solid #ad557e;border-radius:10px;background:#93405f;color:white;cursor:pointer}
.children-close{justify-self:end;background:transparent;color:#93405f}
button:disabled{opacity:.6}
</style>
