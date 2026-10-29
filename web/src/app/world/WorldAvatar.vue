<script setup lang="ts">
// 캐릭터 꾸미기(유스케이스 UC-09): 기본 캐릭터 7분류 또는 내 그림·사진 캐릭터. 바꿀 때마다 미술관 안 캐릭터에 바로 보인다.
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { OPTIONS, PALETTE, randomAvatar, type AvatarConfig } from './avatar';
import * as store from './store';
import type { Artwork } from './store';
import { JOINT_NAMES, JOINT_LABELS, estimateJoints, normalizeJoints, type JointName } from './avatarMesh';
import { blobToImage, maskFromCutout } from './cutout';

const props = defineProps<{ config: AvatarConfig; image: Blob | null; artworks: Artwork[] }>();
const emit = defineEmits<{ preview: [cfg: AvatarConfig, image: Blob | null]; save: [cfg: AvatarConfig, image: Blob | null]; close: [] }>();

const cfg = ref<AvatarConfig>({ ...props.config });
const image = ref<Blob | null>(props.image);
const original=ref<Blob|null>(props.image);
onMounted(async()=>{if(original.value){const p=await store.processImage(original.value,true);image.value=p.cutout??p.display;}});
const tab = ref<'basic' | 'image'>(props.config.mode === 'image' ? 'image' : 'basic');
const busy = ref(false);
const joint = ref<JointName>('head');
const editing = ref(false);
const advanced = ref(false);
const jointCanvas = ref<HTMLElement|null>(null);
async function prepareJoints() {
 if(!image.value)return; const img=await blobToImage(image.value); const c=document.createElement('canvas');c.width=img.naturalWidth;c.height=img.naturalHeight;c.getContext('2d')!.drawImage(img,0,0);
 const result=estimateJoints(maskFromCutout(c));cfg.value={...cfg.value,joints:result.joints,motion:'whole'};
 msg.value='자동으로 맞췄어요. 점을 찍지 않고 바로 저장할 수 있어요';
 emit('preview',cfg.value,image.value);
}
function moveJoint(e:PointerEvent){if(!editing.value||!jointCanvas.value)return;const r=jointCanvas.value.getBoundingClientRect();const joints=normalizeJoints(cfg.value.joints);joints[joint.value]={x:Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),y:Math.max(0,Math.min(1,(e.clientY-r.top)/r.height))};cfg.value={...cfg.value,joints,motion:'joints',articulation:'experimental'};emit('preview',cfg.value,image.value);}
function startJoint(n:JointName,e:PointerEvent){joint.value=n;editing.value=true;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);moveJoint(e);}
function keyJoint(n:JointName,e:KeyboardEvent){const dirs:Record<string,[number,number]>={ArrowLeft:[-.01,0],ArrowRight:[.01,0],ArrowUp:[0,-.01],ArrowDown:[0,.01]};const d=dirs[e.key];if(!d)return;e.preventDefault();const joints=normalizeJoints(cfg.value.joints);joints[n]={x:Math.max(0,Math.min(1,joints[n].x+d[0])),y:Math.max(0,Math.min(1,joints[n].y+d[1]))};cfg.value={...cfg.value,joints,motion:'joints',articulation:'experimental'};emit('preview',cfg.value,image.value);}
const msg = ref('');
const input = ref<HTMLInputElement | null>(null);
const urls: string[] = [];
const url = (b: Blob) => { const u = URL.createObjectURL(b); urls.push(u); return u; };
const thumbs = new Map<string, string>();
const thumbOf = (a: Artwork) => { let u = thumbs.get(a.id); if (!u) { u = url(a.cutout ?? a.display); thumbs.set(a.id, u); } return u; };
const imageUrl = computed(() => (image.value ? url(image.value) : ''));
// §2-18: 올린 작품은 배경 지운 사본이 없으므로(§2-15) 거르지 않고 최근 12점을 모두 보인다
const withCutout = computed(() => props.artworks.slice(-12).reverse());

function set<K extends keyof AvatarConfig>(k: K, v: AvatarConfig[K]) {
  cfg.value = { ...cfg.value, [k]: v };
  emit('preview', cfg.value, image.value);
}

function useBasic() { tab.value = 'basic'; set('mode', 'basic'); }
function random() { cfg.value = { ...randomAvatar() }; tab.value = 'basic'; emit('preview', cfg.value, image.value); }

async function onPick(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0];
  (e.target as HTMLInputElement).value = '';
  if (!f) return;
  if (!f.type.startsWith('image/') || f.size > store.MAX_FILE) { msg.value = '20MB보다 작은 사진 파일을 골라 주세요'; return; }
  busy.value = true;
  msg.value = '';
  try {
    const p = await store.processImage(f, true);
    original.value=f;image.value = p.cutout ?? p.display;
    if (!p.cutout) msg.value = '배경을 찾지 못해 사진 그대로 써요';
    cfg.value = { ...cfg.value, mode: 'image', imageSource:'upload' };
    await prepareJoints();
  } catch { msg.value = '사진을 열지 못했어요. 다른 사진을 골라 주세요'; }
  finally { busy.value = false; }
}

async function useArtwork(a: Artwork) {
  if (busy.value) return;
  // 돌려 건 작품은 원본이 돌아가 있지 않으므로 돌린 화면용 사본을 캐릭터 원본으로 쓴다(§2-18)
  const src = a.rotation ? a.display : a.original;
  busy.value = true;
  msg.value = '';
  try {
    const p = a.cutout && !a.rotation ? { cutout: a.cutout, display: a.display } : await store.processImage(src, true);
    original.value = src; image.value = p.cutout ?? p.display;
    if (!p.cutout) msg.value = '배경을 찾지 못해 사진 그대로 써요';
    cfg.value = { ...cfg.value, mode: 'image', imageSource:'artwork' };
    await prepareJoints();
  } catch { msg.value = '작품을 열지 못했어요. 다른 작품을 골라 주세요'; }
  finally { busy.value = false; }
}

const sections = computed(() => [
  { key: 'skin' as const, label: '피부', colors: PALETTE.skin },
  { key: 'hair' as const, label: '머리', options: OPTIONS.hair, colorKey: 'hairColor' as const, colors: PALETTE.hair },
  { key: 'face' as const, label: '얼굴', options: OPTIONS.face },
  { key: 'top' as const, label: '윗옷', options: OPTIONS.top, colorKey: 'topColor' as const, colors: PALETTE.cloth },
  { key: 'bottom' as const, label: '아래옷', options: OPTIONS.bottom, colorKey: 'bottomColor' as const, colors: PALETTE.cloth },
  { key: 'hat' as const, label: '모자', options: OPTIONS.hat },
  { key: 'prop' as const, label: '소품', options: OPTIONS.prop },
]);

onBeforeUnmount(() => { for (const u of urls) URL.revokeObjectURL(u); });
</script>

<template>
  <div class="side" role="dialog" aria-modal="true" aria-label="캐릭터 꾸미기">
    <div class="g-panel w-card">
      <header class="w-head">
        <h2>캐릭터 꾸미기</h2>
        <button class="g-btn" type="button" @click="emit('close')">닫기</button>
      </header>
      <div class="w-tabs" role="tablist">
        <button role="tab" type="button" class="g-btn" :aria-selected="tab === 'basic'" :aria-pressed="tab === 'basic'" @click="useBasic">기본 캐릭터</button>
        <button role="tab" type="button" class="g-btn" :aria-selected="tab === 'image'" :aria-pressed="tab === 'image'" @click="tab = 'image'">내 그림·사진으로</button>
      </div>

      <template v-if="tab === 'basic'">
        <section v-for="s in sections" :key="s.key" class="sec">
          <h3>{{ s.label }}</h3>
          <div v-if="s.options" class="chips">
            <button v-for="o in s.options" :key="o.id" type="button" class="chip" :aria-pressed="cfg[s.key] === o.id" @click="set(s.key, o.id as never)">{{ o.label }}</button>
          </div>
          <div v-if="s.colors" class="swatches">
            <button
              v-for="c in s.colors" :key="c" type="button" class="swatch" :style="{ background: c }"
              :aria-pressed="(s.colorKey ? cfg[s.colorKey] : cfg[s.key]) === c" :aria-label="`${s.label} 색 ${c}`"
              @click="set((s.colorKey ?? s.key) as 'skin', c)"
            />
          </div>
        </section>
        <button class="g-btn" type="button" @click="random">무작위</button>
      </template>

      <template v-else>
        <p class="lead">그림을 고르면 자동으로 입체 모양을 만들어요. 옆과 뒤는 그림의 모양과 색으로 추정해요. 원본은 그대로 보관해요.</p>
        <div v-if="image" ref="jointCanvas" class="w-joint-canvas" @pointermove="moveJoint" @pointerup="editing=false" @pointercancel="editing=false">
          <img :src="imageUrl" alt="캐릭터로 쓸 그림" draggable="false" />
          <template v-if="advanced && cfg.joints && cfg.motion !== 'whole'">
            <button v-for="n in JOINT_NAMES" :key="n" type="button" class="w-joint" :style="{left:cfg.joints[n].x*100+'%',top:cfg.joints[n].y*100+'%'}" :aria-label="JOINT_LABELS[n]+' 점'" :title="JOINT_LABELS[n]" @pointerdown.prevent="startJoint(n,$event)" @keydown="keyJoint(n,$event)">{{ JOINT_LABELS[n] }}</button>
          </template>
        </div>
        <input ref="input" class="hidden" type="file" accept="image/*" @change="onPick" />
        <button class="g-btn g-btn--primary" type="button" :disabled="busy" @click="input?.click()">{{ busy ? '배경을 지우는 중…' : '사진 고르기' }}</button>
        <template v-if="withCutout.length">
          <h3>내 작품에서 고르기</h3>
          <ul class="mine">
            <li v-for="a in withCutout" :key="a.id">
              <button type="button" class="thumb" :disabled="busy" @click="useArtwork(a)"><img :src="thumbOf(a)" :alt="a.title || '작품'" /></button>
            </li>
          </ul>
        </template>
        <div v-if="image" class="w-motion-options">
          <button class="g-btn" type="button" @click="prepareJoints">자동으로 다시 맞추기</button>
          <button class="g-btn" type="button" :aria-pressed="cfg.motion === 'whole'" @click="set('motion','whole')">형태를 유지하며 움직이기</button>
          <button class="g-btn" type="button" :aria-expanded="advanced" @click="advanced=!advanced">팔다리 움직임 조정 {{ advanced ? '접기' : '열기' }}</button>
          <template v-if="advanced">
            <p>시험 중인 기능이에요. 그림이 비틀리면 형태를 유지하는 동작으로 돌아가세요.</p>
            <button class="g-btn" type="button" @click="set('articulation','experimental');set('motion','joints')">자동 관절로 움직여 보기</button>
            <p v-if="cfg.motion === 'joints'">점을 끌거나 방향키로 위치를 고칠 수 있어요.</p>
          </template>
        </div>
        <p v-if="msg" class="g-note" role="status">{{ msg }}</p>
      </template>

      <div class="row">
        <button class="g-btn g-btn--primary" type="button" @click="emit('save', cfg, cfg.mode === 'image' ? original : null)">저장</button>
        <button class="g-btn" type="button" @click="emit('close')">그만두기</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.side{position:absolute;z-index:20;top:calc(env(safe-area-inset-top,0px) + 30px);right:12px;bottom:12px;width:min(400px,calc(100% - 24px));display:flex}
.w-card{flex:1;overflow:auto;padding:16px 18px;display:grid;gap:10px;align-content:start}
.w-head{display:flex;justify-content:space-between;align-items:center}
.w-head h2{margin:0;font:600 21px var(--g-serif);color:var(--g-plum-deep)}
.w-tabs{display:flex;gap:6px;flex-wrap:wrap}
.w-tabs .g-btn{min-height:42px;padding:6px 14px;font-size:15px}
.sec{display:grid;gap:6px}
.sec h3,.w-card>h3{margin:4px 0 0;font:600 15px var(--g-serif)}
.chips{display:flex;flex-wrap:wrap;gap:6px}
.chip{min-height:40px;padding:6px 12px;border-radius:999px;border:1.5px solid var(--g-gold-soft);background:#fffaf0;font:inherit;font-size:14px;cursor:pointer;color:inherit}
.chip[aria-pressed="true"]{background:linear-gradient(#ad557e,#93405f);color:#fff8ec;border-color:var(--g-gold)}
.swatches{display:flex;flex-wrap:wrap;gap:6px}
.swatch{width:36px;height:36px;border-radius:10px;border:2px solid rgba(0,0,0,.12);cursor:pointer}
.swatch[aria-pressed="true"]{outline:3px solid var(--g-plum);outline-offset:2px}
.lead{margin:0;font-size:15px;line-height:1.5;word-break:keep-all}
.hidden{display:none}
.preview{display:grid;place-items:center;height:150px;border-radius:12px;border:1.5px solid var(--g-gold-soft);background:conic-gradient(#eee 25%,#fff 0 50%,#eee 0 75%,#fff 0) 0 0/16px 16px}
.preview img{max-height:140px;max-width:100%}
.mine{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(4,1fr);gap:6px}
.thumb{width:100%;aspect-ratio:1;padding:4px;border-radius:10px;border:1.5px solid var(--g-gold-soft);background:#fffaf0;cursor:pointer}
.thumb img{width:100%;height:100%;object-fit:contain}
.row{display:flex;gap:8px;flex-wrap:wrap;margin-top:4px}
@media (max-width:600px){.side{top:auto;height:56vh}}
.w-joint-canvas{position:relative;width:100%;aspect-ratio:1;touch-action:none;background:#ece7df;border-radius:12px}.w-joint-canvas img{width:100%;height:100%;object-fit:fill;pointer-events:none}.w-joint{position:absolute;transform:translate(-50%,-50%);width:28px;height:28px;border:3px solid white;border-radius:50%;background:#235c8b;color:transparent;overflow:hidden;cursor:grab;box-shadow:0 0 0 1px #16384c}.w-joint:focus-visible{outline:3px solid #f29c31}.w-motion-options{display:grid;gap:8px}.w-motion-options p{font-size:14px;line-height:1.5}
</style>
