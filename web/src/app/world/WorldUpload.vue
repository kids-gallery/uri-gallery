<script setup lang="ts">
// 작품 올리기(3D미술관_재설계 §2-15·§2-22): 사진 선택 → 한 장씩 원본 확인·전시용 사진 만들기·보관 → 전시. 입력은 묻지 않는다.
// 배경 지우기는 걸고 난 뒤 미술관 화면이 이어서 한다(cutoutState 'pending').
// 원본은 그대로 저장하고, 실패한 항목만 다시 시도한다. 성공한 작품은 남는다.
// 서버 판(VITE_WORLD_SERVER=1, 마스터플랜 3-3)은 기기 저장 대신 서버로 보낸다. 형식·용량을 먼저 보고, 다시 시도해도 요청 번호는 같다.
import { computed, onMounted, ref } from 'vue';
import PhotoFixer from '@/app/upload/PhotoFixer.vue';
import * as store from './store';
import { SERVER_WORLD, checkPhoto, newUploadKey, sendPhoto } from './server/upload';
import { CROP_BOXES } from './cropBoxes';

export type UploadStatus = 'crop' | 'wait' | 'check' | 'make' | 'save' | 'done' | 'fail' | 'skip';
interface Item { key: string; name: string; file: File; status: UploadStatus; reason: string; artworkId: string; retryable: boolean; uploadKey: string; hung: boolean }

/** 한 번에 받는 묶음(§2-15): 10장, 합계 100MB. 처리는 한 장씩 차례로 한다 */
const MAX_BATCH = 10, MAX_BATCH_BYTES = 100 * 1024 * 1024;
const LABEL: Record<UploadStatus, string> = { crop: '작품 고르는 중', wait: '기다리는 중', check: '원본 확인 중', make: '전시용 사진 만드는 중', save: '보관하는 중', done: '전시 준비 끝', fail: '실패', skip: '건너뜀' };

const props = defineProps<{ initialFiles?: File[] }>();
const emit = defineEmits<{ close: []; saved: [ids: string[], reveal: boolean] }>();

const step = ref<'pick' | 'run' | 'done'>('pick');
const items = ref<Item[]>([]);
const notice = ref('');
const running = ref(false);
let stopRequested = false;
const stopping = ref(false);
const album = ref<HTMLInputElement | null>(null);
const camera = ref<HTMLInputElement | null>(null);
let known: Set<string> | null = null;
const hashes = new Map<string, string>(); // 이 묶음의 원본 해시 → 항목 키

const stored = computed(() => items.value.filter((i) => i.status === 'done'));
/** 화면에 걸린 작품. 서버 판에서 보관됐지만 이 브라우저가 그리지 못한 사진은 뺀다 */
const doneIds = computed(() => stored.value.filter((i) => i.hung).map((i) => i.artworkId));
const failed = computed(() => items.value.filter((i) => i.status === 'fail'));
/** 다시 해서 될 수 있는 실패(저장 실패·멈춤). 빈 파일·손상·형식은 같은 사진으로 다시 해도 안 된다 */
const retryable = computed(() => failed.value.filter((i) => i.retryable));
const skipped = computed(() => items.value.filter((i) => i.status === 'skip'));

const confirmDiscard = ref(false);
function requestClose() {
  if (running.value) { notice.value = '지금 사진을 마칠 때까지 기다려 주세요. 남은 사진을 그만 올리려면 [멈추기]를 눌러요'; return; }
  // 저장하지 못한 사진은 확인 없이 버리지 않는다(불변식: 저장 실패 후 사진 유지)
  if (retryable.value.length && !confirmDiscard.value) { confirmDiscard.value = true; return; }
  finishClose();
}
function finishClose() { confirmDiscard.value = false; if (doneIds.value.length) emit('saved', doneIds.value, false); else emit('close'); }
defineExpose({ requestClose });

function onPick(e: Event) {
  const input = e.target as HTMLInputElement;
  const files = Array.from(input.files ?? []);
  input.value = ''; // 같은 파일을 다시 고를 수 있게
  if (!files.length) return; // 취소: 지금 화면과 작품은 그대로
  accept(files);
}

function accept(files: File[]) {
  notice.value = '';
  const room = MAX_BATCH - items.value.filter((i) => i.status !== 'done' && i.status !== 'skip' && i.status !== 'fail').length;
  let bytes = 0, taken = 0;
  const left: string[] = [];
  for (const f of files) {
    if (taken >= room || bytes + f.size > MAX_BATCH_BYTES) { left.push(f.name); continue; }
    bytes += f.size; taken++;
    items.value.push({ key: store.newId(), name: f.name || '사진', file: f, status: SERVER_WORLD && !checkPhoto(f) ? 'crop' : 'wait', reason: '', artworkId: store.newId(), retryable: false, uploadKey: newUploadKey(), hung: true });
  }
  if (left.length) notice.value = `한 번에 ${MAX_BATCH}장, 모두 합해 100MB까지 올릴 수 있어요. ${left.length}장은 다음에 다시 골라 주세요`;
  if (SERVER_WORLD) { step.value = 'run'; nextCrop(); } else void run();
}

/** 서버 판(#118): 사진마다 작품 부분을 고른 뒤 그 판만 보낸다. 잘린 부분은 브라우저 밖으로 나가지 않는다 */
const cropping = ref<{ it: Item; url: string } | null>(null);
function nextCrop() {
  if (cropping.value) URL.revokeObjectURL(cropping.value.url);
  const it = items.value.find((i) => i.status === 'crop');
  cropping.value = it ? { it, url: URL.createObjectURL(it.file) } : null;
  if (!it) void run();
}
function cropDone(blob: Blob) {
  const { it } = cropping.value!;
  it.file = new File([blob], it.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
  it.status = 'wait';
  nextCrop();
}
function cropSkip() {
  const { it } = cropping.value!;
  it.status = 'skip'; it.reason = '올리지 않았어요';
  nextCrop();
}
function cropUnreadable() {
  const { it } = cropping.value!;
  it.status = 'fail'; it.retryable = false;
  it.reason = heicLike(it.file) ? '이 브라우저는 HEIC 사진을 열 수 없어요. JPEG로 저장해 다시 골라 주세요' : '이 사진은 열 수 없어요. 다른 사진을 골라 주세요';
  nextCrop();
}

async function knownHashes() {
  if (known) return known;
  known = new Set<string>();
  for (const a of await store.listArtworks()) { try { known.add(await store.sha256(a.original)); } catch { /* 읽지 못한 원본은 비교에서 뺀다 */ } }
  return known;
}

const heicLike = (f: File) => /^image\/hei[cf]/i.test(f.type) || /\.hei[cf]$/i.test(f.name);

async function runItem(it: Item) {
  it.status = 'check'; it.reason = ''; it.retryable = false;
  const f = it.file;
  if (!f.size) { it.status = 'fail'; it.reason = '빈 파일이에요'; return; }
  if (f.size > store.MAX_FILE) { it.status = 'fail'; it.reason = '사진이 너무 커요(한 장 20MB까지)'; return; }
  if (f.type && !f.type.startsWith('image/') && !heicLike(f)) { it.status = 'fail'; it.reason = '사진 파일이 아니에요'; return; }
  let hash = '';
  try {
    hash = await store.sha256(f);
    const seen = await knownHashes(), other = hashes.get(hash);
    if (seen.has(hash) || (other && other !== it.key)) { it.status = 'skip'; it.reason = '이미 보관한 사진이에요'; return; }
    hashes.set(hash, it.key);
  } catch { it.status = 'fail'; it.reason = '사진을 읽지 못했어요'; return; }
  it.status = 'make';
  let display: Blob;
  try { display = (await store.processImage(f, false)).display; }
  catch { it.status = 'fail'; it.reason = heicLike(f) ? '이 브라우저는 HEIC 사진을 열 수 없어요. JPEG로 저장해 다시 골라 주세요' : '이 사진은 열 수 없어요. 다른 사진을 골라 주세요'; hashes.delete(hash); return; }
  it.status = 'save';
  try {
    const no = (await store.listArtworks()).reduce((m, a) => Math.max(m, a.no), 0) + 1;
    // 같은 ID로 저장하므로 다시 시도해도 한 점만 생긴다. 작품과 전시실은 한 번에 저장된다
    await store.saveArtworkAndRoom({ id: it.artworkId, no, title: '', kind: 'drawing', subject: 'etc', material: '', age: store.UNSORTED_AGE, madeOn: '', words: '', original: f, display, cutout: null, cutoutState: 'pending', sample: false, createdAt: Date.now(), rotation: 0 });
    known?.add(hash);
    it.status = 'done';
  } catch (e) {
    // §2-19 기준 5: 저장 공간 부족은 원인과 다음 할 일을 말한다
    it.status = 'fail'; it.reason = store.isQuotaError(e) ? '저장 공간이 부족해요. 설정에서 백업을 내보낸 뒤 작품을 정리해 주세요' : '보관하지 못했어요. 다시 해 주세요'; it.retryable = true; hashes.delete(hash);
  }
}

async function runServerItem(it: Item) {
  it.status = 'check'; it.reason = ''; it.retryable = false;
  const bad = checkPhoto(it.file);
  if (bad) { it.status = 'fail'; it.reason = bad; return; }
  it.status = 'save';
  const r = await sendPhoto(it.file, it.uploadKey);
  if (!r.ok) { it.status = 'fail'; it.reason = r.reason; it.retryable = r.retryable; return; }
  it.status = 'done'; it.artworkId = r.id; it.hung = r.hung;
  if (!r.hung) it.reason = '보관했지만 이 브라우저가 열 수 없는 사진이라 미술관에 걸지 못했어요';
}

async function run() {
  if (running.value) return;
  step.value = 'run'; running.value = true;
  try {
    for (const it of items.value) {
      if (stopRequested) break;
      if (it.status === 'wait') await (SERVER_WORLD ? runServerItem(it) : runItem(it));
    }
  } finally {
    running.value = false;
    if (stopRequested) { for (const it of items.value) if (it.status === 'wait') { it.status = 'fail'; it.reason = '멈춰서 올리지 않았어요'; it.retryable = true; } }
    stopRequested = false; stopping.value = false;
  }
  if (!failed.value.length && doneIds.value.length && doneIds.value.length === stored.value.length && !notice.value) { emit('saved', doneIds.value, true); return; }
  step.value = 'done';
}

function stop() { if (running.value) { stopRequested = true; stopping.value = true; } }
function retry(it: Item) { if (running.value) return; it.status = 'wait'; it.reason = ''; void run(); }
function retryAll() { if (running.value) return; for (const it of retryable.value) { it.status = 'wait'; it.reason = ''; } void run(); }

onMounted(() => { if (props.initialFiles?.length) accept(props.initialFiles); });
</script>

<template>
  <div class="sheet" role="dialog" aria-modal="true" aria-label="작품 올리기">
    <div class="g-panel w-card">
      <header class="w-head">
        <h2>작품 올리기</h2>
        <button class="g-btn" type="button" :disabled="running" @click="requestClose">닫기</button>
      </header>

      <input ref="album" class="hidden" type="file" :accept="SERVER_WORLD ? 'image/jpeg,image/png,image/heic,image/heif,.heic,.heif' : 'image/*'" multiple @change="onPick" />
      <input ref="camera" class="hidden" type="file" accept="image/*" capture="environment" @change="onPick" />
      <PhotoFixer v-if="cropping" :key="cropping.it.key" :src="cropping.url" :box-options="CROP_BOXES" box-ask="사진에 아이가 같이 찍혔나요?" hint="작품에 맞게 네 모서리를 옮겨 주세요. 아이 얼굴이 들어가지 않게 해 주세요. 네모 밖은 보내지 않아요." close-label="올리지 않기" @close="cropSkip" @done="cropDone" @unreadable="cropUnreadable" />

      <template v-if="step === 'pick'">
        <p class="lead">아이의 그림이나 만들기 사진을 골라 주세요. 고르면 바로 미술관에 걸려요. 제목과 이야기는 나중에 적어도 돼요.</p>
        <div class="row"><button class="g-btn g-btn--primary g-btn--big" type="button" @click="album?.click()">앨범에서 고르기</button><button class="g-btn g-btn--big" type="button" @click="camera?.click()">사진 찍기</button></div>
        <p v-if="SERVER_WORLD" class="small">한 번에 10장까지, JPEG·PNG·HEIC 사진을 한 장 20MB까지 골라요. 작품 부분만 골라 우리 미술관으로 보내요. 아이 얼굴이 들어가지 않게 고른 뒤 올려요.</p>
        <p v-else class="small">한 번에 10장까지, 한 장 20MB까지 골라요. 원본 사진은 그대로 보관하고 이 기기에 저장돼요.</p>
      </template>

      <template v-else>
        <p class="lead" role="status">
          <template v-if="running">{{ stopping ? '지금 사진을 마치고 멈춰요' : '사진을 한 장씩 전시하고 있어요' }}</template>
          <template v-else>{{ stored.length }}점을 보관했어요<template v-if="failed.length"> · 실패 {{ failed.length }}점</template><template v-if="skipped.length"> · 건너뜀 {{ skipped.length }}점</template></template>
        </p>
        <ul class="w-upload-list" aria-live="polite">
          <li v-for="it in items" :key="it.key" :class="'w-st-' + it.status">
            <span class="w-up-name">{{ it.name }}</span>
            <span class="w-up-state"><template v-if="it.status === 'done' && it.reason">{{ it.reason }}</template><template v-else>{{ LABEL[it.status] }}<template v-if="it.reason">: {{ it.reason }}</template></template></span>
            <button v-if="it.status === 'fail' && it.retryable && !running" class="g-btn w-up-retry" type="button" @click="retry(it)">다시 시도</button>
          </li>
        </ul>
        <div class="row">
          <template v-if="running"><button class="g-btn" type="button" :disabled="stopping" @click="stop">멈추기</button><span class="small">창을 닫으면 남은 사진도 올리지 않아요.</span></template>
          <template v-else>
            <button v-if="doneIds.length" class="g-btn g-btn--primary" type="button" @click="emit('saved', doneIds, true)">성공한 작품 보러 가기</button>
            <button v-if="retryable.length > 1" class="g-btn" type="button" @click="retryAll">실패한 사진 모두 다시 시도</button>
            <button class="g-btn" type="button" @click="album?.click()">사진 더 고르기</button>
          </template>
        </div>
      </template>

      <section v-if="confirmDiscard" class="w-discard" role="alert"><p>아직 보관하지 못한 사진이 {{ retryable.length }}장 있어요.</p><button class="g-btn g-btn--primary" type="button" @click="confirmDiscard = false">계속 보관하기</button><button class="g-btn" type="button" @click="finishClose">보관하지 않고 닫기</button></section>
      <p v-if="notice" class="g-note" role="alert">{{ notice }}</p>
    </div>
  </div>
</template>

<style scoped>
.sheet{position:absolute;inset:0;z-index:20;display:grid;place-items:center;padding:16px;background:rgba(40,28,18,.25)}
.w-card{width:min(680px,100%);max-height:min(92vh,900px);overflow:auto;padding:20px 22px;display:grid;gap:12px}
.w-head{display:flex;justify-content:space-between;align-items:center;gap:8px}
.w-head h2{margin:0;font:600 22px var(--g-serif);color:var(--g-plum-deep)}
.lead{margin:0;font-size:16px;line-height:1.55;word-break:keep-all}
.small{margin:0;font-size:13px;color:#7a6650;word-break:keep-all}
.hidden{display:none}
.pick{justify-self:start}
.preview{display:grid;place-items:center;min-height:180px;max-height:320px;border-radius:16px;border:1.5px solid var(--g-gold-soft);
  background:conic-gradient(#eee 25%,#fff 0 50%,#eee 0 75%,#fff 0) 0 0/24px 24px}
.preview img{max-width:100%;max-height:300px;object-fit:contain}
.w-field{display:grid;gap:6px;font-size:14px;border:none;margin:0;padding:0}
.w-field legend{font-size:14px;margin-bottom:6px}
.w-field legend small{color:#7a6650;margin-left:6px}
.group{display:grid;grid-template-columns:52px 1fr;gap:6px;align-items:start;margin-bottom:4px}
.glabel{font-size:13px;color:#7a6650;padding-top:10px}
.chips{display:flex;flex-wrap:wrap;gap:6px}
.chip{min-height:40px;padding:6px 14px;border-radius:999px;border:1.5px solid var(--g-gold-soft);background:#fffaf0;font:inherit;font-size:15px;cursor:pointer;color:inherit}
.chip[aria-pressed="true"]{background:linear-gradient(#ad557e,#93405f);color:#fff8ec;border-color:var(--g-gold)}
.w-input{min-height:44px;padding:8px 12px;border-radius:12px;border:1.5px solid var(--g-gold-soft);background:#fffdf8;font:inherit;width:100%;box-sizing:border-box}
textarea.w-input{resize:vertical}
.two{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.row{display:flex;flex-wrap:wrap;gap:8px}
.err{border-color:#c0504d}
@media (max-width:480px){.two{grid-template-columns:1fr}.group{grid-template-columns:1fr}.glabel{padding-top:0}}
.w-details{display:grid;gap:14px;border:0;padding:0;margin:0}.w-save-row{position:sticky;bottom:-20px;background:#fff8ec;padding:12px 0;z-index:2}.w-save-row .g-btn--primary{flex:1}
.w-upload-list{list-style:none;margin:0;padding:0;display:grid;gap:6px;max-height:42vh;overflow:auto}
.w-upload-list li{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:4px 10px;align-items:center;padding:8px 12px;border-radius:12px;border:1.5px solid var(--g-gold-soft);background:#fffdf8}
.w-up-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:14px}
.w-up-state{font-size:13px;color:#5f4d3a;word-break:keep-all}
.w-st-done .w-up-state{color:#2f6b3a}
.w-st-fail .w-up-state{color:#a3332e;grid-column:1/-1} /* §2-23 다듬기 ②: 긴 실패 사유는 다음 줄로, 파일 이름이 남은 폭을 쓴다 */
.w-up-retry{grid-column:1/-1;justify-self:start;min-height:44px}
</style>
