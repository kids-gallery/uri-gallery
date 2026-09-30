<script setup lang="ts">
// S2 작품 올리기(T066, SD_02 §5, UC2 BF2·BF3·BF4, G5·G6, BR-INT-01·03).
// 화면이 먼저 형식(JPEG·PNG·HEIC)·용량(20MB)을 검사하고, 서버도 같은 검사를 한다(매직 바이트).
// 같은 사진을 다시 보내면 같은 Idempotency-Key — 두 번 눌러도 작품은 하나(BR-INT-03). 접수(202)되면 S3로 간다.
// 다시 찍기(S5 → S2)는 ?child=&retakeOf= 로 아이를 미리 고른다(UC2 A7, H7).
// 작품 영역 자르기(D32, C11, UC2 A10): 사각형이 사진 전체가 아니면 브라우저에서 그 영역만 새 이미지로 만들어 올린다 —
// 잘린 부분과 위치 정보(EXIF)는 서버로 가지 않는다. 사각형을 바꾸지 않았거나 브라우저가 못 여는 사진은 고른 파일 그대로.
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api, ApiError, toBlock, type BlockNotice as Notice } from '@/api/client';
import type { components } from '@/api/types.gen';
import BlockNotice from '@/components/BlockNotice.vue';
import CropBox from '@/components/CropBox.vue';
import { croppedName, full, isFull, JPEG_QUALITY, outputSize, outputType, snap, type Rect } from '@/app/crop';
import JourneyRail from '@/components/JourneyRail.vue';
import ReasonButton from '@/components/ReasonButton.vue';
import CharacterAvatar from '@/app/character/CharacterAvatar.vue';
import { DEFAULT_COLOR, DEFAULT_KIND, type CharacterColor, type CharacterKind } from '@/app/character/names';
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
/** 아틀리에의 아이 캐릭터(D40 캐릭터 · D38 움직임): 사진을 고르면 그림을 들고 이젤로, 올리면 벽에 걸러 걸어 나간다 */
const buddy = computed(() => {
  const c = children.value?.find((x) => x.id === childId.value) as (Child & { character?: CharacterKind | null; color?: CharacterColor | null }) | undefined;
  return { kind: c?.character ?? DEFAULT_KIND, color: c?.color ?? DEFAULT_COLOR };
});
const retakeOf = typeof route.query.retakeOf === 'string' ? route.query.retakeOf : undefined;
const file = ref<File | null>(null);
const preview = ref<string | null>(null);
const key = ref<string>('');
const busy = ref(false);
const block = ref<Notice | null>(null);
const cameraEl = ref<HTMLInputElement | null>(null);
const albumEl = ref<HTMLInputElement | null>(null);
// 자르기 상태 — ready: 사각형을 보인다 · unreadable: 브라우저가 못 연 사진(자르기 없이 그대로) · none: 사진 없음
const crop = ref<'none' | 'ready' | 'unreadable'>('none');
const size = ref({ w: 0, h: 0 });
const rect = ref<Rect>(full(1, 1));
const cutting = ref(false);
let bitmap: ImageBitmap | null = null;
let generatedPreview = false;
const cropped = computed(() => crop.value === 'ready' && !isFull(rect.value, size.value.w, size.value.h));
const outSize = computed(() => outputSize(snap(rect.value, size.value.w, size.value.h)));
watch(rect, () => { if (file.value) key.value = crypto.randomUUID(); }, { deep: true }); // 다른 영역 = 다른 사진(BR-INT-03)

const tooBig = computed(() => !!file.value && file.value.size > MAX_BYTES);
const reason = computed(() => (!childId.value ? ko.upload.needChild : !file.value ? ko.upload.needPhoto
  : tooBig.value ? ko.upload.tooBig : cutting.value ? ko.upload.crop.cutting : busy.value ? ko.upload.sending : ''));

onMounted(async () => {
  try {
    children.value = await api.get<Child[]>('/v1/children');
    if (!childId.value && children.value.length === 1) childId.value = children.value[0]!.id;
    if (childId.value && !children.value.some((c) => c.id === childId.value)) childId.value = '';
  } catch (e) { block.value = toBlock(e instanceof ApiError ? e : new ApiError(0, null)); }
});
onBeforeUnmount(() => { clearPhoto(); });

function clearPhoto() {
  if (preview.value) URL.revokeObjectURL(preview.value);
  preview.value = null; bitmap?.close?.(); bitmap = null; generatedPreview = false; crop.value = 'none';
}

/** 사진을 연다(EXIF 방향 보정). 못 열면 자르기 없이 그대로 올린다(D32 ⑥). HEIC처럼 <img>가 못 그리는 형식은 캔버스로 미리보기를 만든다. */
async function openPhoto(f: File, isHeic: boolean) {
  if (typeof createImageBitmap !== 'function') { crop.value = 'unreadable'; return; }
  try {
    const bm = await createImageBitmap(f, { imageOrientation: 'from-image' });
    if (file.value !== f) { bm.close?.(); return; } // 그 사이 다른 사진을 골랐다
    bitmap = bm; size.value = { w: bm.width, h: bm.height }; rect.value = full(bm.width, bm.height);
    if (isHeic) {
      const s = Math.min(1, 1600 / Math.max(bm.width, bm.height));
      const c = document.createElement('canvas'); c.width = Math.round(bm.width * s); c.height = Math.round(bm.height * s);
      c.getContext('2d')!.drawImage(bm, 0, 0, c.width, c.height);
      const blob = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/jpeg', 0.85));
      if (!blob) throw new Error('preview');
      preview.value = URL.createObjectURL(blob); generatedPreview = true;
    }
    crop.value = 'ready';
  } catch { crop.value = 'unreadable'; }
}

/** 올릴 파일 — 사각형이 사진 전체가 아니면 그 영역만 새 이미지로 만든다. 실패하면 null. */
async function fileToSend(): Promise<File | null> {
  const f = file.value!;
  if (!cropped.value || !bitmap) return f;
  const r = snap(rect.value, size.value.w, size.value.h); const o = outputSize(r); const type = outputType(f.type, f.name);
  const c = document.createElement('canvas'); c.width = o.w; c.height = o.h;
  const ctx = c.getContext('2d'); if (!ctx) return null;
  ctx.drawImage(bitmap, r.x, r.y, r.w, r.h, 0, 0, o.w, o.h);
  const blob = await new Promise<Blob | null>((res) => c.toBlob(res, type, type === 'image/jpeg' ? JPEG_QUALITY : undefined));
  return blob ? new File([blob], croppedName(f.name, type), { type }) : null;
}
function cropFailed(): Notice {
  const g = problemCopy({ gate: 'G5', reason: 'format' });
  return { variant: 'block', gate: null, summary: ko.upload.crop.failed, reason: ko.upload.crop.failed, releaser: g.releaser, self: true,
    actions: [ko.upload.crop.reset, g.actions[0]!], fields: [] };
}

function gate5(reasonCode: 'format' | 'over_20mb' | 'missing_photo'): Notice {
  return { ...problemCopy({ gate: 'G5', reason: reasonCode }), actions: [...problemCopy({ gate: 'G5', reason: reasonCode }).actions], gate: 'G5', fields: [] };
}

function pick(ev: Event) {
  const f = (ev.target as HTMLInputElement).files?.[0] ?? null;
  (ev.target as HTMLInputElement).value = '';
  if (!f) return;
  block.value = null;
  clearPhoto();
  file.value = f;
  key.value = crypto.randomUUID(); // 새 사진이면 새 요청 번호, 같은 사진 재전송은 같은 번호
  if (!(TYPES.includes(f.type) || EXT.test(f.name))) { block.value = gate5('format'); file.value = null; return; }
  if (f.size > MAX_BYTES) { block.value = gate5('over_20mb'); return; }
  const heic = f.type === 'image/heic' || f.type === 'image/heif' || /\.hei[cf]$/i.test(f.name);
  if (!heic) preview.value = URL.createObjectURL(f); // HEIC는 <img>가 못 그리는 브라우저가 많다 — 열리면 openPhoto가 캔버스 미리보기를 만든다
  void openPhoto(f, heic);
}

async function submit() {
  if (reason.value || !file.value) return;
  busy.value = true; block.value = null;
  try {
    cutting.value = cropped.value;
    const photo = await fileToSend();
    cutting.value = false;
    if (!photo) { block.value = cropFailed(); return; }
    if (photo.size > MAX_BYTES) { block.value = gate5('over_20mb'); return; }
    const form = new FormData();
    form.append('childId', childId.value);
    form.append('photo', photo, photo.name);
    if (retakeOf) form.append('retakeOf', retakeOf);
    const a = await api.post<ArtworkDetail>('/v1/artworks', { form, headers: { 'Idempotency-Key': key.value } });
    // D34: 올리면 바로 걸린다 → 전시로 가서 걸리는 장면(?hung)을 본다(옛 확정 화면으로 가지 않는다)
    await router.push({ path: '/app', query: { child: childId.value, hung: a.id } });
  } catch (e) {
    const err = e instanceof ApiError ? e : new ApiError(0, null);
    block.value = err.status === 413 ? gate5('over_20mb') : toBlock(err);
  } finally { busy.value = false; cutting.value = false; }
}

function onBlock(label: string) {
  if (label === '다시 올리기') void submit();
  else if (label === ko.upload.crop.reset) { rect.value = full(size.value.w, size.value.h); block.value = null; }
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
        <!-- 형식 목록 · 파일 이름 · 크기는 보호자에게 보이지 않는다(D34 ④, SD_02 §17-8) — 검사는 그대로 -->
        <img v-if="preview && !tooBig && crop !== 'ready'" :src="preview" alt="" class="preview">
        <p v-if="file && !tooBig && crop === 'unreadable'" class="hint">{{ ko.upload.crop.unreadable }}</p>
      </fieldset>

      <fieldset v-if="file && !tooBig && crop === 'ready' && preview" class="field">
        <legend class="t-card-title">{{ ko.upload.crop.title }}</legend>
        <p class="hint" id="up-crop-hint">{{ ko.upload.crop.hint }}</p>
        <CropBox v-model="rect" :src="preview" :width="size.w" :height="size.h" aria-describedby="up-crop-hint up-crop-keys" />
        <p class="hint" id="up-crop-keys">{{ ko.upload.crop.keys }}</p>
        <div class="acts crop-row">
          <p class="t-body-sm num" aria-live="polite">{{ cropped ? ko.upload.crop.cropped(outSize.w, outSize.h) : ko.upload.crop.whole }}</p>
          <button v-if="cropped" class="btn btn-secondary" type="button" @click="rect = full(size.w, size.h)">{{ ko.upload.crop.reset }}</button>
        </div>
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
    <div class="up-buddy" :class="{ carry: !!file, go: busy }" aria-hidden="true"><CharacterAvatar :kind="buddy.kind" :color="buddy.color" :size="104" /><span v-if="file" class="up-sheet"></span></div>
  </main>
</template>

<style scoped>
.up-form{max-width:640px}
/* 아틀리에의 아이 캐릭터 — 사진을 고르면 종이를 들고 이젤 옆으로 통통 걸어 오고, 올리면 벽에 걸러 나간다(D38 · 로블록스 느낌 살짝) */
.up-buddy{position:fixed;left:4vw;bottom:5vh;z-index:2;pointer-events:none;transition:transform var(--dur-3,800ms) var(--ease-spring,ease)}
.up-buddy :deep(svg){animation:buddy-bob 1.6s ease-in-out infinite}
.up-buddy.carry{transform:translateX(min(22vw,180px))}
.up-buddy.carry :deep(svg){animation:buddy-hop .5s ease-in-out 3,buddy-bob 1.6s ease-in-out 1.5s infinite}
.up-buddy.go{transform:translateX(110vw);transition-duration:1.4s}
.up-sheet{position:absolute;left:62%;top:38%;width:34px;height:26px;background:#fff;border-radius:2px;box-shadow:0 0 0 2px #e4572e,0 4px 8px -4px rgba(0,0,0,.4);transform:rotate(-8deg)}
@keyframes buddy-bob{50%{transform:translateY(-4px)}}
@keyframes buddy-hop{40%{transform:translateY(-18px) rotate(-4deg)}80%{transform:translateY(0) rotate(3deg)}}
@media (max-width:560px){.up-buddy{left:2vw;bottom:2vh;transform:scale(.8)}.up-buddy.carry{transform:translateX(24vw) scale(.8)}}
@media (prefers-reduced-motion:reduce){.up-buddy,.up-buddy :deep(svg){animation:none;transition:none}}
fieldset{border:0;margin:0;padding:0}
legend{margin-bottom:var(--s-xs)}
.acts{display:flex;flex-wrap:wrap;gap:var(--s-sm)}
.hidden-input{position:absolute;width:1px;height:1px;opacity:0;pointer-events:none}
.preview{max-width:100%;max-height:320px;border-radius:var(--r-md);background:var(--color-surface-soft);object-fit:contain}
.num{font-variant-numeric:tabular-nums}
.crop-row{align-items:center;justify-content:space-between}
</style>
