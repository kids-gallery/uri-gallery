<script setup lang="ts">
// 입체 보관함(유스케이스 UC-08 · UC-12): 원본 사진과 입체를 돌려 보고 내려받거나 지운다.
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import * as THREE from 'three';
import { updateArtworkInfo,type Artwork } from './store';
import { SUBJECTS } from './subjects';
import { SERVER_WORLD } from './server/upload';
import { plaqueOf, curatorNote, defaultTitle } from './curation';
import { reliefOf, exportGlb, download, safeName, extOf } from './relief3d';

const props = defineProps<{ artworks: Artwork[]; child: string; focus: string | null }>();
const emit = defineEmits<{ close: []; delete: [id: string]; goto: [id: string]; updated: [] }>();

const sel = ref<string | null>(props.focus ?? props.artworks[props.artworks.length - 1]?.id ?? null);
const confirmDel = ref(false);
const busy = ref('');
const msg = ref('');
const editing=ref(false);
const draft=ref({title:'',age:1,madeOn:'',words:'',material:'',kind:'drawing' as 'drawing'|'making',subject:'etc'});
function editInfo(){const a=current.value;if(!a)return;draft.value={title:a.title,age:a.age,madeOn:a.madeOn,words:a.words,material:a.material,kind:a.kind,subject:a.subject};editing.value=true;}
async function saveInfo(){const a=current.value;if(!a||busy.value)return;busy.value='info';msg.value='';try{await updateArtworkInfo(a.id,draft.value);editing.value=false;emit('updated');msg.value='추억을 고쳤어요. 원본 사진은 그대로예요';}catch{msg.value='저장하지 못했어요. 적은 내용은 남아 있어요. 다시 저장해 주세요';}finally{busy.value='';}}

const viewer = ref<HTMLElement | null>(null);
const urls = new Map<string, string>();

function urlOf(b: Blob, key: string) {
  let u = urls.get(key);
  if (!u) { u = URL.createObjectURL(b); urls.set(key, u); }
  return u;
}

const current = computed(() => props.artworks.find((a) => a.id === sel.value) ?? null);
const info = computed(() => {
  const a = current.value;
  if (!a) return null;
  const inp = { no: a.no, title: a.title, kind: a.kind, subject: a.subject, material: a.material, age: a.age, madeOn: a.madeOn, words: a.words, child: props.child };
  return { p: plaqueOf(inp), n: curatorNote(inp) };
});

// 작은 3D 창
let renderer: THREE.WebGLRenderer | null = null;
let scene: THREE.Scene | null = null;
let camera: THREE.PerspectiveCamera | null = null;
let current3d: { mesh: THREE.Mesh; dispose(): void } | null = null;
let raf = 0;
let yaw = 0.5, dragging = false, lastX = 0, auto = true;

function setup() {
  if (!viewer.value) return;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  } catch { renderer = null; return; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  viewer.value.appendChild(renderer.domElement);
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(35, 1, 0.01, 20);
  camera.position.set(0, 0.1, 2.6);
  scene.add(new THREE.HemisphereLight('#ffffff', '#b9a58a', 1.3));
  const d = new THREE.DirectionalLight('#ffffff', 1.4);
  d.position.set(1.5, 2, 2.5);
  scene.add(d);
  const el = renderer.domElement;
  el.style.touchAction = 'none';
  el.addEventListener('pointerdown', (e) => { dragging = true; auto = false; lastX = e.clientX; el.setPointerCapture(e.pointerId); });
  el.addEventListener('pointermove', (e) => { if (dragging) { yaw += (e.clientX - lastX) * 0.01; lastX = e.clientX; } });
  el.addEventListener('pointerup', () => { dragging = false; });
  const loop = () => {
    raf = requestAnimationFrame(loop);
    if (!renderer || !scene || !camera || !viewer.value) return;
    const w = viewer.value.clientWidth, h = viewer.value.clientHeight;
    if (renderer.domElement.width !== Math.floor(w * renderer.getPixelRatio())) { renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); }
    if (auto) yaw += 0.01;
    if (current3d) current3d.mesh.rotation.y = yaw;
    renderer.render(scene, camera);
  };
  loop();
}

async function show() {
  if (current3d && scene) { scene.remove(current3d.mesh); current3d.dispose(); current3d = null; }
  const a = current.value;
  if (!a || !scene) return;
  const r = await reliefOf(a, 1);
  if (current.value?.id !== a.id) { r.dispose(); return; }
  current3d = r;
  scene.add(r.mesh);
}

async function glb() {
  const a = current.value;
  if (!a) return;
  busy.value = 'glb';
  msg.value = '';
  try { download(await exportGlb(a), `${safeName(a.title || info.value?.p.title || '작품')}.glb`); msg.value = '입체 파일을 내려받았어요'; }
  catch { msg.value = '입체 파일을 만들지 못했어요. 다시 해 주세요'; }
  finally { busy.value = ''; }
}

function original() {
  const a = current.value;
  if (!a) return;
  download(a.original, `${safeName(a.title || info.value?.p.title || '작품')}_${SERVER_WORLD ? '사진' : '원본'}.${extOf(a.original.type)}`);
}

function del() {
  const a = current.value;
  if (!a) return;
  emit('delete', a.id);
  confirmDel.value = false;
  const rest = props.artworks.filter((x) => x.id !== a.id);
  sel.value = rest[rest.length - 1]?.id ?? null;
}

watch(sel, () => { editing.value=false;confirmDel.value = false; msg.value = ''; void show(); });
onMounted(() => { setup(); void show(); });
onBeforeUnmount(() => {
  cancelAnimationFrame(raf);
  current3d?.dispose();
  renderer?.dispose();
  for (const u of urls.values()) URL.revokeObjectURL(u);
});
</script>

<template>
  <div class="sheet" role="dialog" aria-modal="true" aria-label="입체 보관함">
    <div class="g-panel w-card">
      <header class="w-head">
        <h2>입체 보관함 <small>{{ artworks.length }}점</small></h2>
        <button class="g-btn" type="button"  :disabled="busy === 'info'" @click="emit('close')">닫기</button>
      </header>

      <p v-if="!artworks.length" class="g-note">아직 보관한 작품이 없어요. [작품 올리기]로 첫 작품을 걸어 보세요.</p>

      <template v-else>
        <div v-if="current && info" class="detail">
          <figure class="orig">
            <img :src="urlOf(current.original, `o-${current.id}`)" :alt="SERVER_WORLD ? '올린 사진' : '원본 사진'" />
            <figcaption>{{ SERVER_WORLD ? '올린 사진(고른 부분만 보관)' : '원본 사진(그대로 보관)' }}</figcaption>
          </figure>
          <figure class="solid">
            <div ref="viewer" class="viewer" aria-label="입체 작품, 끌어서 돌려 보기" />
            <figcaption>입체 작품 · 끌어서 돌려 보기</figcaption>
          </figure>
          <div class="meta">
            <p class="w-no">{{ info.p.number }}</p>
            <h3>{{ info.p.title }}</h3>
            <p class="by">{{ info.p.byline }}<template v-if="info.p.detail"> · {{ info.p.detail }}</template></p>
            <p v-for="(l, i) in info.n.lines" :key="i" class="cnote">{{ l }}</p>
            <p v-if="info.n.quote" class="w-quote">“{{ info.n.quote }}”</p>
            <p v-if="current.sample" class="small">견본 그림이에요(팀이 코드로 그림).</p>
          </div>
          <form v-if="editing" class="w-edit" @submit.prevent="saveInfo">
            <label>제목<input v-model="draft.title" maxlength="40" /></label>
            <label>그때 나이<select v-model.number="draft.age"><option :value="0">모름(새로 온 작품)</option><option v-for="n in 13" :value="n" :key="n">{{n}}세</option></select></label>
            <label>만든 날<input v-model="draft.madeOn" type="date" /></label>
            <label>종류<select v-model="draft.kind"><option value="drawing">그림</option><option value="making">만들기</option></select></label>
            <label>주제<select v-model="draft.subject"><option v-for="s in SUBJECTS" :value="s.id" :key="s.id">{{s.label}}</option></select></label>
            <label>재료<input v-model="draft.material" maxlength="20" /></label>
            <label>아이가 한 말<textarea v-model="draft.words" maxlength="200" rows="2" /></label>
            <div class="row"><button class="g-btn g-btn--primary" type="submit" :disabled="!!busy">{{busy==='info'?'저장 중…':'추억 저장'}}</button><button class="g-btn" type="button" :disabled="!!busy" @click="editing=false">취소</button></div>
          </form>
          <div class="row">
            <button v-if="!SERVER_WORLD" class="g-btn" type="button" :disabled="!!busy" @click="editInfo">제목·추억 고치기</button>
            <button class="g-btn g-btn--primary" type="button" :disabled="!!busy" @click="glb">{{ busy === 'glb' ? '만드는 중…' : '입체 내려받기' }}</button>
            <button class="g-btn" type="button" @click="original">{{ SERVER_WORLD ? '사진 내려받기' : '원본 내려받기' }}</button>
            <button class="g-btn" type="button" @click="emit('goto', current.id)">미술관에서 보기</button>
            <button v-if="!confirmDel" class="g-btn" type="button" @click="confirmDel = true">지우기</button>
          </div>
          <div v-if="confirmDel" class="confirm">
            <p class="g-note">이 작품을 지울까요? {{ SERVER_WORLD ? '올린 사진' : '원본 사진' }}과 입체가 함께 지워져요. 이미 내려받은 파일은 기기에 남아요.</p>
            <div class="row">
              <button class="g-btn g-btn--primary" type="button" @click="del">지우기</button>
              <button class="g-btn" type="button" @click="confirmDel = false">그만두기</button>
            </div>
          </div>
          <p v-if="msg" class="small" role="status">{{ msg }}</p>
        </div>

        <ul class="w-grid" aria-label="보관한 작품">
          <li v-for="a in [...artworks].reverse()" :key="a.id">
            <button type="button" class="thumb" :aria-pressed="a.id === sel" @click="sel = a.id">
              <img :src="urlOf(a.cutout ?? a.display, `t-${a.id}`)" :alt="a.title || '작품'" />
              <span>{{ a.age ? `${a.age}세 · ` : '' }}{{ a.title || defaultTitle(a.subject, a.kind) }}<em v-if="a.sample" class="w-sample-tag"> · 체험용 작품</em></span>
            </button>
          </li>
        </ul>
      </template>
    </div>
  </div>
</template>

<style scoped>
.sheet{position:absolute;inset:0;z-index:20;display:grid;place-items:center;padding:16px;background:rgba(40,28,18,.25)}
.w-card{width:min(860px,100%);max-height:min(92vh,960px);overflow:auto;padding:20px 22px;display:grid;gap:14px}
.w-head{display:flex;justify-content:space-between;align-items:center}
.w-head h2{margin:0;font:600 22px var(--g-serif);color:var(--g-plum-deep)}
.w-head small{font:400 14px var(--font-sans,system-ui);color:#7a6650;margin-left:6px}
.detail{display:grid;grid-template-columns:1fr 1fr;gap:12px}
figure{margin:0;display:grid;gap:4px}
figcaption{font-size:12px;color:#7a6650}
.orig img{width:100%;height:240px;object-fit:contain;background:#fffdf8;border-radius:12px;border:1.5px solid var(--g-gold-soft)}
.viewer{height:240px;border-radius:12px;border:1.5px solid var(--g-gold-soft);background:radial-gradient(circle at 50% 40%,#fffaf0,#efe2c8);overflow:hidden}
.meta{grid-column:1/-1;display:grid;gap:4px}
.meta h3{margin:0;font:600 20px var(--g-serif);color:var(--g-plum-deep)}
.w-no{margin:0;font-size:12px;color:#8a7458;letter-spacing:.08em}
.by{margin:0;color:var(--g-plum)}
.cnote{margin:0;font-size:15px;word-break:keep-all}
.w-quote{margin:0;font:600 16px var(--g-serif)}
.small{margin:0;font-size:13px;color:#7a6650}
.row{grid-column:1/-1;display:flex;flex-wrap:wrap;gap:8px}
.confirm{grid-column:1/-1;display:grid;gap:8px}
.w-grid{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(112px,1fr));gap:10px}
.thumb{width:100%;display:grid;gap:4px;padding:6px;border-radius:14px;border:1.5px solid var(--g-gold-soft);background:#fffaf0;cursor:pointer;font:inherit;color:inherit;min-height:44px}
.thumb[aria-pressed="true"]{border-color:var(--g-plum);box-shadow:0 0 0 3px rgba(160,73,107,.2)}
.thumb img{width:100%;height:84px;object-fit:contain;background:conic-gradient(#eee 25%,#fff 0 50%,#eee 0 75%,#fff 0) 0 0/16px 16px;border-radius:8px}
.thumb span{font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
@media (max-width:560px){.detail{grid-template-columns:1fr}.orig img,.viewer{height:200px}}
.w-edit{grid-column:1/-1;display:grid;gap:10px}.w-edit label{display:grid;gap:4px}.w-edit input,.w-edit select,.w-edit textarea{min-height:44px;padding:8px;border:1px solid #d5c3a1;border-radius:10px;font:inherit;background:#fffdf8}
</style>
