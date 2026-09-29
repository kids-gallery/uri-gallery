<script setup lang="ts">
// S2 작품 올리기(T066, SD_02 §5, UC2 BF2·BF3·BF4, G5·G6, BR-INT-01·03).
// 화면이 먼저 형식(JPEG·PNG·HEIC)·용량(20MB)을 검사하고, 서버도 같은 검사를 한다(매직 바이트).
// 같은 사진을 다시 보내면 같은 Idempotency-Key — 두 번 눌러도 작품은 하나(BR-INT-03). 접수(202)되면 S3로 간다.
// 다시 찍기(S5 → S2)는 ?child=&retakeOf= 로 아이를 미리 고른다(UC2 A7, H7).
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api, ApiError, toBlock, type BlockNotice as Notice } from '@/api/client';
import type { components } from '@/api/types.gen';
import BlockNotice from '@/components/BlockNotice.vue';
import JourneyRail from '@/components/JourneyRail.vue';
import ReasonButton from '@/components/ReasonButton.vue';
import { ko, problemCopy } from '@/copy/ko';
import { JOURNEY_FROM_CHILD } from '../authForm';
import type { ArtworkDetail } from '../artwork';

type Child = components['schemas']['Child'];
const MAX_BYTES = 20 * 1024 * 1024;
const TYPES = ['image/jpeg', 'image/png', 'image/heic', 'image/heif'];
const EXT = /\.(jpe?g|png|hei[cf])$/i;

const route = useRoute();
const router = useRouter();
const children = ref<Child[] | null>(null);
const childId = ref(typeof route.query.child === 'string' ? route.query.child : '');
const retakeOf = typeof route.query.retakeOf === 'string' ? route.query.retakeOf : undefined;
const file = ref<File | null>(null);
const preview = ref<string | null>(null);
const key = ref<string>('');
const busy = ref(false);
const block = ref<Notice | null>(null);
const cameraEl = ref<HTMLInputElement | null>(null);
const albumEl = ref<HTMLInputElement | null>(null);

const tooBig = computed(() => !!file.value && file.value.size > MAX_BYTES);
const reason = computed(() => (!childId.value ? ko.upload.needChild : !file.value ? ko.upload.needPhoto
  : tooBig.value ? ko.upload.tooBig : busy.value ? ko.upload.sending : ''));

onMounted(async () => {
  try {
    children.value = await api.get<Child[]>('/v1/children');
    if (!childId.value && children.value.length === 1) childId.value = children.value[0]!.id;
    if (childId.value && !children.value.some((c) => c.id === childId.value)) childId.value = '';
  } catch (e) { block.value = toBlock(e instanceof ApiError ? e : new ApiError(0, null)); }
});
onBeforeUnmount(() => { if (preview.value) URL.revokeObjectURL(preview.value); });

function gate5(reasonCode: 'format' | 'over_20mb' | 'missing_photo'): Notice {
  return { ...problemCopy({ gate: 'G5', reason: reasonCode }), actions: [...problemCopy({ gate: 'G5', reason: reasonCode }).actions], gate: 'G5', fields: [] };
}

function pick(ev: Event) {
  const f = (ev.target as HTMLInputElement).files?.[0] ?? null;
  (ev.target as HTMLInputElement).value = '';
  if (!f) return;
  block.value = null;
  if (preview.value) { URL.revokeObjectURL(preview.value); preview.value = null; }
  file.value = f;
  key.value = crypto.randomUUID(); // 새 사진이면 새 요청 번호, 같은 사진 재전송은 같은 번호
  if (!(TYPES.includes(f.type) || EXT.test(f.name))) { block.value = gate5('format'); file.value = null; return; }
  if (f.size > MAX_BYTES) { block.value = gate5('over_20mb'); return; }
  if (f.type !== 'image/heic' && f.type !== 'image/heif' && !/\.hei[cf]$/i.test(f.name)) preview.value = URL.createObjectURL(f); // HEIC는 브라우저가 못 그리므로 파일 이름만
}
const mb = (n: number) => `${(n / 1024 / 1024).toFixed(1)}MB`;

async function submit() {
  if (reason.value || !file.value) return;
  busy.value = true; block.value = null;
  try {
    const form = new FormData();
    form.append('childId', childId.value);
    form.append('photo', file.value, file.value.name);
    if (retakeOf) form.append('retakeOf', retakeOf);
    const a = await api.post<ArtworkDetail>('/v1/artworks', { form, headers: { 'Idempotency-Key': key.value } });
    await router.push(`/app/artworks/${a.id}/confirm`);
  } catch (e) {
    const err = e instanceof ApiError ? e : new ApiError(0, null);
    block.value = err.status === 413 ? gate5('over_20mb') : toBlock(err);
  } finally { busy.value = false; }
}

function onBlock(label: string) {
  if (label === '다시 올리기') void submit();
  else albumEl.value?.click();
}
</script>

<template>
  <main class="container page stack">
    <JourneyRail current="upload" :steps="JOURNEY_FROM_CHILD" />
    <h1 class="t-headline">{{ ko.shell.appMenu.upload }}</h1>

    <form class="card stack up-form" novalidate @submit.prevent="submit">
      <fieldset class="field">
        <legend class="t-card-title">{{ ko.upload.whose }}</legend>
        <label for="up-child">{{ ko.upload.child }}</label>
        <select id="up-child" v-model="childId" class="input">
          <option value="" disabled>{{ ko.upload.needChild }}</option>
          <option v-for="c in children ?? []" :key="c.id" :value="c.id">{{ c.alias }}</option>
        </select>
        <RouterLink v-if="children && !children.length" class="btn btn-secondary" to="/app/children">{{ ko.shell.appMenu.children }}</RouterLink>
      </fieldset>

      <fieldset class="field">
        <legend class="t-card-title">{{ ko.upload.photo }}</legend>
        <div class="acts">
          <button class="btn btn-secondary" type="button" @click="cameraEl?.click()">{{ ko.upload.camera }}</button>
          <button class="btn btn-secondary" type="button" @click="albumEl?.click()">{{ ko.upload.album }}</button>
        </div>
        <input ref="cameraEl" class="hidden-input" type="file" accept="image/*" capture="environment" tabindex="-1" aria-hidden="true" @change="pick">
        <input ref="albumEl" class="hidden-input" type="file" accept="image/jpeg,image/png,image/heic,image/heif,.heic,.heif" tabindex="-1" aria-hidden="true" @change="pick">
        <p class="hint">{{ ko.upload.rule }}</p>
        <p v-if="file" class="t-body-sm num">{{ file.name }} - {{ mb(file.size) }}</p>
        <img v-if="preview && !tooBig" :src="preview" alt="" class="preview">
      </fieldset>

      <BlockNotice v-if="block" :notice="block" @action="onBlock" />
      <div class="acts">
        <ReasonButton :label="ko.upload.submit" :disabled="!!reason" :reason="reason" @click="submit" @blocked="!file ? albumEl?.click() : undefined" />
      </div>

      <section class="downgrade" aria-labelledby="up-after">
        <p id="up-after" class="t-body"><b>{{ ko.upload.afterTitle }}</b></p>
        <p class="t-body-sm">{{ ko.upload.after1 }}</p>
        <p class="t-body-sm">{{ ko.upload.after2 }}</p>
      </section>
    </form>
  </main>
</template>

<style scoped>
.up-form{max-width:640px}
fieldset{border:0;margin:0;padding:0}
legend{margin-bottom:var(--s-xs)}
.acts{display:flex;flex-wrap:wrap;gap:var(--s-sm)}
.hidden-input{position:absolute;width:1px;height:1px;opacity:0;pointer-events:none}
.preview{max-width:100%;max-height:320px;border-radius:var(--r-md);background:var(--color-surface-soft);object-fit:contain}
.num{font-variant-numeric:tabular-nums}
</style>
