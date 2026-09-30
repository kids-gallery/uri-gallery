<script setup lang="ts">
// 사진 고치기(D39, SD_02 §17-12): 이젤 위 편집판 — 네 모서리 끌기(처음 값 = 자동 찾기 추정, D35) · 90° 돌리기 · 원래대로 · 저장.
// 늘 원본에서 다시 편다(여러 번 고쳐도 흐려지지 않게). 저장하면 브라우저가 편 판(JPEG 0.92, 긴 변 최대 2400px)을 만들어 PUT /v1/artworks/{id}/photo.
import { computed, nextTick, onMounted, ref } from 'vue';
import { ko } from '@/copy/ko';
import { detectPaper, warpQuad } from './autocrop';

const props = defineProps<{ artworkId: string; originalUrl: string }>();
const emit = defineEmits<{ close: []; saved: [] }>();
type P = [number, number];
const img = ref<HTMLImageElement | null>(null);
const W = ref(0); const H = ref(0);
const quad = ref<P[]>([]);
const rot = ref(0); // 0 · 90 · 180 · 270
const sel = ref(0);
const busy = ref(false); const msg = ref('');
const preview = ref<HTMLCanvasElement | null>(null);
const box = ref<HTMLElement | null>(null);
const dialog = ref<HTMLElement | null>(null);

onMounted(async () => {
  const r = await fetch(props.originalUrl, { credentials: 'include' });
  const bm = await createImageBitmap(await r.blob());
  const c = document.createElement('canvas'); c.width = bm.width; c.height = bm.height; c.getContext('2d')!.drawImage(bm, 0, 0);
  const im = new Image(); im.src = c.toDataURL('image/jpeg', 0.95); await im.decode(); img.value = im;
  W.value = im.naturalWidth; H.value = im.naturalHeight;
  const d = detectPaper(im, W.value, H.value);
  const g = (d.quad ?? d.guess) as P[] | null;
  quad.value = g ?? [[0, 0], [W.value, 0], [W.value, H.value], [0, H.value]];
  await nextTick(); draw(); dialog.value?.querySelector<HTMLElement>('button')?.focus();
});
const pts = computed(() => quad.value.map(([x, y]) => `${x},${y}`).join(' '));
function draw() {
  if (!img.value || !preview.value) return;
  const flat = warpQuad(img.value, quad.value, 1200) as HTMLCanvasElement;
  const c = preview.value, turn = rot.value % 180 !== 0;
  c.width = turn ? flat.height : flat.width; c.height = turn ? flat.width : flat.height;
  const g = c.getContext('2d')!; g.save(); g.translate(c.width / 2, c.height / 2); g.rotate((rot.value * Math.PI) / 180); g.drawImage(flat, -flat.width / 2, -flat.height / 2); g.restore();
}
let dragging = -1;
function toImg(e: PointerEvent): P {
  const r = box.value!.getBoundingClientRect();
  return [Math.max(0, Math.min(W.value, ((e.clientX - r.left) / r.width) * W.value)), Math.max(0, Math.min(H.value, ((e.clientY - r.top) / r.height) * H.value))];
}
function down(i: number, e: PointerEvent) { dragging = i; sel.value = i; (e.target as Element).setPointerCapture(e.pointerId); }
function move(e: PointerEvent) { if (dragging < 0) return; quad.value[dragging] = toImg(e); }
function up() { if (dragging >= 0) { dragging = -1; draw(); } }
function key(i: number, e: KeyboardEvent) {
  const s = (e.shiftKey ? 10 : 1) * (W.value / 400);
  const d: Record<string, P> = { ArrowLeft: [-s, 0], ArrowRight: [s, 0], ArrowUp: [0, -s], ArrowDown: [0, s] };
  const v = d[e.key]; if (!v) return;
  e.preventDefault(); const [x, y] = quad.value[i]!;
  quad.value[i] = [Math.max(0, Math.min(W.value, x + v[0])), Math.max(0, Math.min(H.value, y + v[1]))]; draw();
}
function turn(d: number) { rot.value = (rot.value + d + 360) % 360; draw(); }
function reset() { quad.value = [[0, 0], [W.value, 0], [W.value, H.value], [0, H.value]]; rot.value = 0; draw(); }
async function save() {
  if (!img.value || busy.value) return;
  busy.value = true; msg.value = '';
  try {
    const flat = warpQuad(img.value, quad.value, 2400) as HTMLCanvasElement;
    const c = document.createElement('canvas'), t = rot.value % 180 !== 0;
    c.width = t ? flat.height : flat.width; c.height = t ? flat.width : flat.height;
    const g = c.getContext('2d')!; g.translate(c.width / 2, c.height / 2); g.rotate((rot.value * Math.PI) / 180); g.drawImage(flat, -flat.width / 2, -flat.height / 2);
    const blob = await new Promise<Blob>((ok, no) => c.toBlob((b) => (b ? ok(b) : no(new Error('blob'))), 'image/jpeg', 0.92));
    const fd = new FormData(); fd.append('photo', blob, 'fixed.jpg');
    const r = await fetch(`/v1/artworks/${props.artworkId}/photo`, { method: 'PUT', body: fd, credentials: 'same-origin' });
    if (!r.ok) throw new Error(String(r.status));
    emit('saved');
  } catch { msg.value = ko.fix.fail; }
  busy.value = false;
}
function trap(e: KeyboardEvent) { if (e.key === 'Escape') { e.preventDefault(); emit('close'); } }
</script>

<template>
  <div class="fx-scrim" @click.self="emit('close')">
    <div ref="dialog" class="fx" role="dialog" aria-modal="true" aria-labelledby="fx-t" @keydown="trap">
      <h2 id="fx-t" class="fx-t">{{ ko.fix.title }}</h2>
      <p class="fx-hint">{{ ko.fix.hint }}</p>
      <div class="fx-body">
        <div v-if="img" ref="box" class="fx-photo" :style="{ aspectRatio: `${W} / ${H}` }" @pointermove="move" @pointerup="up" @pointercancel="up">
          <img :src="img.src" alt="" draggable="false">
          <svg :viewBox="`0 0 ${W} ${H}`" preserveAspectRatio="none" aria-hidden="true"><polygon :points="pts" /></svg>
          <button v-for="(p, i) in quad" :key="i" class="fx-h" :class="{ on: sel === i }" type="button" :style="{ left: `${(p[0] / W) * 100}%`, top: `${(p[1] / H) * 100}%` }"
            :aria-label="ko.fix.corner[i]" @pointerdown="down(i, $event)" @keydown="key(i, $event)" @focus="sel = i"></button>
        </div>
        <div v-else class="fx-photo fx-load">{{ ko.save.busy }}</div>
        <div class="fx-side">
          <p class="fx-cap">{{ ko.fix.preview }}</p>
          <canvas ref="preview" class="fx-prev" role="img" :aria-label="ko.fix.preview"></canvas>
        </div>
      </div>
      <div class="fx-acts">
        <button class="btn btn-secondary" type="button" @click="turn(-90)">↺ {{ ko.fix.left }}</button>
        <button class="btn btn-secondary" type="button" @click="turn(90)">↻ {{ ko.fix.right }}</button>
        <button class="btn btn-tertiary" type="button" @click="reset">{{ ko.fix.reset }}</button>
        <span class="sp"></span>
        <button class="btn btn-secondary" type="button" @click="emit('close')">{{ ko.walk.close }}</button>
        <button class="btn btn-primary" type="button" :disabled="busy || !img" @click="save">{{ busy ? ko.save.busy : ko.fix.save }}</button>
      </div>
      <p class="fx-msg" role="status" aria-live="polite">{{ msg }}</p>
    </div>
  </div>
</template>

<style scoped>
.fx-scrim{position:fixed;inset:0;z-index:60;display:grid;place-items:center;padding:12px;background:rgba(40,26,16,.62);backdrop-filter:blur(6px);animation:fx-in var(--dur-2,480ms) var(--ease-spring,ease) both}
@keyframes fx-in{from{opacity:0}}
.fx{width:min(1040px,100%);max-height:calc(100dvh - 24px);overflow:auto;background:#fbf6ee;border-radius:22px;padding:clamp(14px,3vw,28px);display:grid;gap:12px;
  box-shadow:0 0 0 1px rgba(201,165,82,.5),0 40px 80px -30px rgba(0,0,0,.6);animation:fx-up var(--dur-3,800ms) var(--ease-spring,ease) both}
@keyframes fx-up{from{transform:translateY(24px) scale(.98);opacity:0}}
.fx-t{margin:0;font:700 22px/1.25 var(--mc-serif,serif);color:#3a2a1f}
.fx-hint{margin:0;font:500 14px/1.5 var(--font-sans);color:#5a4636}
.fx-body{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(0,1fr);gap:16px;align-items:start}
@media (max-width:760px){.fx-body{grid-template-columns:1fr}}
.fx-photo{position:relative;width:100%;max-height:62vh;background:#2b2019;border-radius:8px;overflow:visible;touch-action:none;user-select:none;margin-inline:auto}
.fx-photo img{width:100%;height:100%;object-fit:contain;display:block;border-radius:8px}
.fx-photo svg{position:absolute;inset:0;width:100%;height:100%}
.fx-photo polygon{fill:rgba(230,203,134,.18);stroke:#e6cb86;stroke-width:0.4%;vector-effect:non-scaling-stroke}
.fx-load{display:grid;place-items:center;aspect-ratio:4/3;color:#fff}
.fx-h{position:absolute;width:30px;height:30px;margin:-15px 0 0 -15px;border-radius:50%;border:3px solid #fff;background:#a0496b;box-shadow:0 2px 8px rgba(0,0,0,.5);cursor:grab;touch-action:none}
.fx-h.on{outline:3px solid #e6cb86;outline-offset:2px}
.fx-h:focus-visible{outline:3px solid #fff;outline-offset:3px}
.fx-side{display:grid;gap:6px;justify-items:center}
.fx-cap{margin:0;font:600 13px/1.2 var(--font-sans);color:#5a4636}
.fx-prev{max-width:100%;max-height:40vh;background:#fffeef;padding:10px;border-radius:2px;box-shadow:0 0 0 8px #d8b766,0 20px 30px -18px rgba(0,0,0,.6)}
.fx-acts{display:flex;flex-wrap:wrap;gap:8px;align-items:center}.fx-acts .sp{flex:1}
.fx-acts .btn{min-height:44px}
.fx-msg{margin:0;min-height:1.3em;font:500 14px/1.3 var(--font-sans);color:#8a2b2b}
</style>
