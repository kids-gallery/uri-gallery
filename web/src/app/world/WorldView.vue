<script setup lang="ts">
const props = defineProps<{ selectedChildName?: string }>();
const emit = defineEmits<{ logout: []; changeChild: [] }>();
// 3D 가족 미술관 로컬 판(3D미술관_재설계 §2, 기초 설계 v2 §5). 경로 /app/world. 서버 호출 없음.
import '@/styles/game.css';
import { computed, defineAsyncComponent, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import { MuseumEngine, type Selection,type InteractionPrompt } from './engine';
import * as store from './store';
import type { Account, Artwork, Prefs } from './store';
import { THEMES, type ThemeId } from './themes';
import { curatorNote, guideText, plaqueOf, roomTitle } from './curation';
import { MAX_AGE } from './museum';
import { DECOR_KINDS, SPOT_LABEL, type DecorItem, type DecorKind, type DecorSpot } from './decor';
import { setSoundEnabled, speak, stopSpeaking } from './sound';
import type { AvatarConfig } from './avatar';
import WorldUpload from './WorldUpload.vue';
import { SERVER_WORLD, selectedChild, worldWorks } from './server/upload';
import { deleteArtwork, decide, failureOf, failureReason, getArtwork, getWorldLayout, putWorldLayout, type Decision, type Failure } from './server';
import { galleryFailure, isStale, watchIds } from './server/gallery';
import { openLayout } from './server/openLayout';
import { useArtworkWatch } from './server/watch';
import WorldArchive from './WorldArchive.vue';
import WorldConfirm from './WorldConfirm.vue';
import WorldDecision from './WorldDecision.vue';
import { ko } from '@/copy/ko';
import type { ArtworkDetail } from './server';
import WorldAvatar from './WorldAvatar.vue';
import WorldOverview from './WorldOverview.vue';
import WorldPrivacy from './WorldPrivacy.vue';
import WorldStorageState from './WorldStorageState.vue';
import WorldUsage from './WorldUsage.vue';
import WorldStorageGate from './WorldStorageGate.vue';
import { STYLES, STYLE_NAME, type MuseumStyle } from '../character/names';
import { WORLD_LOOKS } from './outdoor';
import { setAmbience, stopAmbience } from './sound';
import {LocalSocialStore,type PublicBuilding} from './social';
import { BackupError, exportBackup, importBackup } from './backup';
import { EMOTES } from './emotes';
import { safeName } from './relief3d';
import { SUBJECTS } from './subjects';
import { backupDue, currentDevice, storageMode } from './deviceStorage';
import { EMPTY_USAGE, bump, dayNumber, normalizeUsage, visit, type Usage } from './usage';
import { saveFile, shareNow, type SaveResult } from './shareFile';
import { cardText, drawCard } from './shareCard';

// title=시작 화면, starting=시작 연출 중, ready=조작 중(§2-17)
type Phase = 'checking' | 'title' | 'starting' | 'ready' | 'nostorage';
type Panel = null | 'upload' | 'archive' | 'avatar' | 'theme' | 'settings' | 'social' | 'play' | 'help' | 'view' | 'overview' | 'privacy' | 'storage' | 'usage';

// 빌드할 때 값이 정해지는 조건만 쓴다 — 일반 배포 빌드에서는 이 불러오기 코드가 통째로 빠진다(AT-UC01-02)
const TestEntry = import.meta.env.DEV || import.meta.env.MODE === 'localtest' ? defineAsyncComponent(() => import('./WorldTestEntry.vue')) : null;
const WorldPlay=defineAsyncComponent(()=>import('./WorldPlay.vue'));
const TestFamilies=import.meta.env.DEV||import.meta.env.MODE==='localtest'?defineAsyncComponent(()=>import('./WorldFamilies.vue')):null;
// 친구 초대·마을·방문은 같은 기기의 시험 가족끼리만 된다(§2-22 9): 테스트 입구와 같은 빌드 조건으로 배포본에서 뺀다
const LOCAL_SOCIAL=import.meta.env.DEV||import.meta.env.MODE==='localtest';
const WorldSocial=LOCAL_SOCIAL?defineAsyncComponent(()=>import('./WorldSocial.vue')):null;
const SocialButton=LOCAL_SOCIAL?defineAsyncComponent(()=>import('./WorldSocialButton.vue')):null;
// 휴대폰 측정 표시(§2-22 13): 개발 서버나 측정용 빌드(VITE_MEASURE=1)에서 주소에 ?measure가 있을 때만. 배포본에는 들어가지 않는다
const MEASURE_ON=(import.meta.env.DEV||import.meta.env.VITE_MEASURE==='1')&&new URLSearchParams(location.search).has('measure');
const Measure=MEASURE_ON?defineAsyncComponent(()=>import('./WorldMeasure.vue')):null;
function measure(name:'title-shown'|'start-ready'|'start-pressed'|'inside'|'first-saved'){
  if(!MEASURE_ON)return;
  performance.mark('uam-measure:'+name); // 측정 표시 조각이 늦게 받아져도 measure.ts가 이 값으로 채운다
  window.dispatchEvent(new CustomEvent('uam-measure',{detail:name}));
}
const social=new LocalSocialStore();
const visiting=ref<PublicBuilding|null>(null),townBuildings=ref<PublicBuilding[]>([]),selectedBuilding=ref<PublicBuilding|null>(null);
const inviteToken=ref(LOCAL_SOCIAL?new URLSearchParams(location.search).get('invite')??'':'');
let socialChannel:BroadcastChannel|null=null;
const phase = ref<Phase>('checking');
const progress = ref({ done: 0, total: store.SAMPLES.length });
const account = ref<Account | null>(null);
const serverChildName = computed(() => props.selectedChildName || account.value?.child || '아이');
const artworks = shallowRef<Artwork[]>([]);
const rooms = ref<number[]>([]);
const prefs = ref<Prefs | null>(null);
const engine = shallowRef<MuseumEngine | null>(null);
const webglFailed = ref(false);
const stage = ref<HTMLElement | null>(null);
const worldRoot=ref<HTMLElement|null>(null);
let panelTrigger:HTMLElement|null=null;
const place = ref('바깥 광장');
const space=ref<'plaza'|'town'|'inside'>('plaza');
const uiLook=computed(()=>WORLD_LOOKS[prefs.value?.theme??'classic']);
// 위치 카드 아래 모드 이름 단추(§2-18): 다른 모드가 있다는 것을 메뉴를 뒤지지 않고 알게 한다
const themeLabel=computed(()=>THEMES.find(t=>t.id===(prefs.value?.theme??'classic'))?.label??'클래식');
const interaction=ref<InteractionPrompt|null>(null);
// 시작 연출과 도착(§2-17): 공간 전환은 엔진이 흰빛으로 덮었다 걷는다(검은 화면 없음)
const startWaiting=ref(false),hudIntro=ref(false),bandOn=ref(false),hintOn=ref(false),firstPrompt=ref(false);
const startBtn=ref<HTMLButtonElement|null>(null),firstPick=ref<HTMLInputElement|null>(null);
const pendingReveal=ref<string|null>(null);
const realCount=computed(()=>artworks.value.filter(a=>!a.sample).length);
/** 시작 화면 한 줄: 가족이 없으면 가치, 있으면 이 미술관 이름과 작품 수 */
const startLead=computed(()=>{const a=account.value;if(!a)return '아이 작품을 사진으로 남기면 우리 미술관에 걸려요.';const n=realCount.value;return `${serverChildName.value}의 미술관 · ${n?`작품 ${n}점`:artworks.value.length?'견본 작품으로 둘러보는 중':'첫 작품을 기다리고 있어요'}`;});
let arriveTimers:number[]=[];
const nearId = ref<string | null>(null);
const selection = ref<Selection>(null);
const panel = ref<Panel>(null);
const moreTools=ref(false);
const playPanel=ref<{requestClose:()=>void}|null>(null),uploadPanel=ref<{requestClose:()=>void}|null>(null);
const archiveFocus = ref<string | null>(null);
const toast = ref('');
const recentSaved=ref<string|null>(null);
const savedCount=ref(0),rotating=ref(false),pendingFiles=ref<File[]>([]);
// 결과 카드(§2-23 B·다듬기 ①): 걸린 전시관 이름과 화면용 사본 미리보기(돌리면 바로 바뀐다)
const savedLine=computed(()=>{const a=recentSaved.value?byId.value.get(recentSaved.value):null;if(!a)return '';return savedCount.value>1?`작품 ${savedCount.value}점을 걸었어요. 마지막 작품 앞이에요.`:`작품을 ‘${roomTitle(a.age)}’에 걸었어요.`;});
// 결과 카드 질문(§2-22 4): 나이(묶음에 한 번) → 주제(작품마다) → 끝. 미리보기·돌리기는 지금 묻는 작품에 쓴다
const savedIds=ref<string[]>([]),askStep=ref<'age'|'subject'|'done'>('done'),askIndex=ref(0),askBusy=ref(false),askMsg=ref('');
const askWork=computed(()=>{const id=askStep.value==='subject'?savedIds.value[askIndex.value]:recentSaved.value;return id?byId.value.get(id)??null:null;});
// §2-22 검토 5: 낮은 화면에서 카드 안을 넘겼어도 질문 단계가 바뀌면 맨 위(걸린 곳·처리 상태·돌리기)부터 보인다
const savedCard=ref<HTMLElement|null>(null);
watch([askStep,askIndex],async()=>{
  await nextTick();const c=savedCard.value;if(!c)return;c.scrollTop=0;
  // 답한 단추가 사라졌거나 카드 안에 초점이 있었으면 새 질문의 첫 단추(끝 단계면 첫 행동 단추)로 옮긴다. 카드 밖 초점은 건드리지 않는다
  const at=document.activeElement;if(!(at===document.body||(at&&c.contains(at))))return;
  const el=c.querySelector<HTMLElement>('.w-ask-opts button, .w-saved-actions button');if(!el)return;el.focus({preventScroll:true});
  // 키보드로 옮긴 초점은 보여야 한다: 카드 아래 가장자리에 가려지면 가려진 만큼만 카드 안을 넘긴다(§2-22 검토 5)
  if(el.matches(':focus-visible')){const r=el.getBoundingClientRect(),box=c.getBoundingClientRect(),pad=8;if(r.bottom>box.bottom-pad)c.scrollTop+=r.bottom-box.bottom+pad;}
});
const PICK_SUBJECTS=SUBJECTS.filter(s=>s.id!=='etc'); // '그 밖'은 [건너뛰기]와 같다
/** 배경 지우기 상태 문구(§2-22 2). done은 미술관의 입체가 바로 보여 주므로 따로 쓰지 않는다 */
const CUT_LINE:Partial<Record<string,string>>={pending:'입체로 만드는 중이에요',none:'배경을 찾지 못해 사진 그대로 걸었어요'};
const askStatus=computed(()=>CUT_LINE[askWork.value?.cutoutState??'']??'');
const savedThumb=ref('');
watch(()=>askWork.value?.display,(b)=>{if(savedThumb.value)URL.revokeObjectURL(savedThumb.value);savedThumb.value=b?URL.createObjectURL(b):'';});
const confirmReset = ref(false);
const emoteMenu = ref(false);
// 백업 내보내기·가져오기(§2-19 기준 1)
const backupBusy=ref<''|'export'|'import'>(''),backupMsg=ref(''),backupInput=ref<HTMLInputElement|null>(null);
// §2-23 F: 결과 문구가 나오면 설정 창 안에서 보이는 자리로 스크롤한다
const backupNote=ref<HTMLElement|null>(null);
watch(backupMsg,async(m)=>{if(!m)return;await nextTick();backupNote.value?.scrollIntoView({block:'nearest'});});
// 저장 상태와 백업 권유(§2-22 5~8)
const saveMode=storageMode(currentDevice());
const persisted=ref<boolean|null>(null),backupMark=ref<store.BackupMark>({}),nudge=ref(false);
/** 공유 시트가 "누른 직후가 아니다"로 거절했을 때 한 번 더 누를 파일 */
const resend=shallowRef<{file:File;title:string;kind:'backup'|'card';count:number;at:number}|null>(null);
// §2-22 검토 3: 설정을 닫으면 백업 [파일 보내기]를 지운다(닫히는 길이 여러 곳이라 창 값을 지켜본다)
watch(panel,(_,old)=>{if(old!=='settings')return;if(resend.value?.kind==='backup')resend.value=null;backupMsg.value='';});
/** 백업 결과 문구: 설정이 열려 있으면 그 안에, 만드는 동안 닫혔으면 짧은 알림으로(§2-22 검토 3) */
function tellBackup(msg:string){if(panel.value==='settings')backupMsg.value=msg;else say(msg);}
const lastBackup=computed(()=>backupMark.value.lastAt??null);
/** recount=false면 마지막 백업 날짜만 새로 읽는다. 권유는 앱을 열 때 한 번 계산한다(§2-22 7, 검토 10) */
async function checkBackup(recount=true){
  if(!account.value||visiting.value)return;
  try{backupMark.value=await store.getBackupMark();if(recount)nudge.value=backupDue(backupMark.value,artworks.value.filter(a=>!a.sample).map(a=>a.createdAt),Date.now());}catch{if(recount)nudge.value=false;}
}
/** at: 백업 파일을 만든 때(§2-22 검토 3). 뒤늦게 보내도 마지막 백업 날짜는 만든 때로 적는다 */
async function backupSaved(result:SaveResult,count:number,at:number){
  if(result==='shared'||result==='downloaded'){try{await store.markBackup('done',at);}catch{/* 날짜 기록은 덤이다 */}await checkBackup();}
  tellBackup(result==='shared'?`작품 ${count}점을 담은 백업 파일을 보냈어요. 받은 곳에 잘 보관해 주세요`:result==='downloaded'?`작품 ${count}점을 담은 백업 파일을 내려받았어요. 안전한 곳에 보관해 주세요`:result==='cancelled'?'보내지 않았어요':panel.value==='settings'?'[파일 보내기]를 한 번 더 눌러 주세요':'백업 파일을 보내지 못했어요. 설정에서 다시 내보내 주세요');
}
async function doExport(){
  if(backupBusy.value)return;backupBusy.value='export';backupMsg.value='';resend.value=null;
  const at=Date.now(); // 이 시각 뒤에 올린 작품은 이 백업에 없다
  try{const b=await exportBackup(),{result,file}=await saveFile(b.blob,b.name,'우리 아이 미술관 백업',coarse);if(result==='retry'&&panel.value==='settings')resend.value={file,title:'우리 아이 미술관 백업',kind:'backup',count:b.count,at};await backupSaved(result,b.count,at);} // 만드는 동안 설정을 닫았으면 [파일 보내기]를 만들지 않는다
  catch{tellBackup('백업을 만들지 못했어요. 다시 해 주세요');}
  finally{backupBusy.value='';}
}
/** [파일 보내기]: 누른 그 자리에서 공유 시트를 연다(§2-22 8) */
async function sendAgain(){
  const r=resend.value;if(!r)return;
  let result:SaveResult;try{result=await shareNow(r.file,r.title);}catch{result='cancelled';}
  if(result!=='retry')resend.value=null;
  if(r.kind==='backup')await backupSaved(result,r.count,r.at);else cardSaved(result);
}
async function backupLater(){nudge.value=false;try{await store.markBackup('later');}catch{/* 이번에만 닫힌다 */}}
function backupFromNudge(){nudge.value=false;openSettings();void doExport();}
async function doImport(e:Event){
  const input=e.target as HTMLInputElement,f=input.files?.[0];input.value='';
  if(!f||backupBusy.value)return;backupBusy.value='import';backupMsg.value='';
  try{
    const r=await importBackup(f);
    if(r.prefsRestored)await boot(false);else await reload();
    runCutouts(); // 가져온 작품 중 처리 전인 것도 이어서 한다(§2-22 검토 8)
    tellBackup(`작품 ${r.added}점을 가져왔어요`+(r.skipped?`. 이미 있는 ${r.skipped}점은 건너뛰었어요`:''));
  }catch(err){
    backupMsg.value=err instanceof BackupError?(err.reason==='newer'?'더 새 판에서 만든 백업이에요. 화면을 새로 고친 뒤 다시 해 주세요':err.reason==='broken'?'백업 파일 일부가 빠져 있어요. 다른 백업 파일을 골라 주세요':'우리 아이 미술관 백업 파일이 아니에요')
      :store.isQuotaError(err)?'저장 공간이 부족해요. 가져온 만큼은 남아 있어요':'가져오지 못했어요. 가져온 만큼은 남아 있어요. 다시 해 주세요';
    await reload();
  }finally{backupBusy.value='';}
}
const coarse = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;
const helpTip = ref(true);
try { helpTip.value = sessionStorage.getItem('uam-world-help-seen') !== 'yes'; } catch { /* Optional preference; storage can be blocked. */ }
function dismissHelpTip() {
  helpTip.value = false;
  try { sessionStorage.setItem('uam-world-help-seen', 'yes'); } catch { /* Dismissal still works for this view. */ }
}
/** 휴대폰 화면 값(§2-23 D): 둘러보기 안내 카드는 이만큼(초) 뒤 저절로 닫는다 */
const MOBILE = { guideSeconds: 8 } as const;
let helpTimer: ReturnType<typeof setTimeout> | undefined;
watch(() => helpTip.value && phase.value === 'ready', (on) => { clearTimeout(helpTimer); if (on) helpTimer = setTimeout(dismissHelpTip, MOBILE.guideSeconds * 1000); });
let toastTimer = 0;

// 사용 기록(§2-22 11): 가족마다 숫자만 센다. 친구 방문 중에는 세지 않는다. 쓰기는 하나씩 차례로 한다
const usage=ref<Usage>({...EMPTY_USAGE});
let usageChain:Promise<void>=Promise.resolve();
function countUse(change:(u:Usage)=>Usage){
  if(visiting.value||!account.value)return;
  usageChain=usageChain.then(async()=>{try{const next=change(normalizeUsage(await store.getUsageRecord()));await store.putUsageRecord(next);usage.value=next;}catch{/* 기록은 덤이다. 실패해도 화면은 그대로 */}});
}
let seenDay=0;
const noteVisit=()=>{seenDay=dayNumber(store.today());const day=seenDay;countUse(u=>visit(u,day));};
/** §2-22 검토 9: 홈 화면 앱은 며칠 뒤 돌아와도 다시 불러오지 않는다. 화면이 다시 보일 때 날이 바뀌었으면 앱을 연 때로 본다 */
function onResume(){
  if(document.visibilityState!=='visible'||!account.value||visiting.value||phase.value!=='ready')return;
  if (SERVER_WORLD) void refreshServerLayout();
  if(dayNumber(store.today())===seenDay)return;
  noteVisit();void checkBackup();
}
async function openUsage(){try{usage.value=normalizeUsage(await store.getUsageRecord());}catch{usage.value={...EMPTY_USAGE};}await checkBackup(false);openPanel('usage');}
async function clearUsage(){try{await store.putUsageRecord({...EMPTY_USAGE});usage.value={...EMPTY_USAGE};say('사용 기록을 지웠어요');}catch{say('지우지 못했어요. 다시 해 주세요');}}

// 올린 뒤 배경 지우기(§2-22 1~3): 한 장씩 처리하고, 작품이 움직이는 동안은 기다렸다가 미술관을 다시 그린다.
// 창을 닫거나 새로 고치면 다음에 열 때 pending 작품부터 이어서 한다
const CUTOUT = { waitMs: 400, tries: 2 } as const;
let cutoutRun:Promise<void>|null=null;
let alive=true; // 화면을 떠나면 배경 지우기 차례를 멈춘다(§2-22 검토 10)
function runCutouts(){
  if(!alive||cutoutRun||visiting.value||!account.value)return;
  // 차례 규칙(같은 방향 CUTOUT.tries번, 돌려서 버린 시도는 세지 않음)은 store.cutoutQueue가 정한다(§2-22 검토 8)
  cutoutRun=store.cutoutQueue({
    pending:()=>!alive||visiting.value?[]:artworks.value.filter(a=>a.cutoutState==='pending'&&!a.sample),
    make:(id)=>store.makeCutout(id),
    after:async()=>{while(alive&&engine.value?.performing())await new Promise(r=>setTimeout(r,CUTOUT.waitMs));if(!alive||visiting.value)return false;await reload();return true;},
    tries:CUTOUT.tries,
  }).catch(()=>{/* 저장하지 못했으면 다음에 열 때 다시 한다 */}).finally(()=>{cutoutRun=null;});
}

// iPhone·iPad 브라우저 탭에서 첫 작품 전 저장 안내(§2-22 5, UI 계약 9절). 이 탭에서 [그래도 여기서 올리기]를 누르면 다시 묻지 않는다
const gateOk=ref(false);
try{gateOk.value=sessionStorage.getItem('uam-world-tab-ok')==='yes';}catch{/* 이번 화면에서만 기억한다 */}
let gateNext:(()=>void)|null=null;
function beforeUpload(go:()=>void){
  if(saveMode==='ios-tab'&&realCount.value===0&&!gateOk.value&&!visiting.value){gateNext=go;openPanel('storage');return;}
  go();
}
function gateGo(){
  gateOk.value=true;try{sessionStorage.setItem('uam-world-tab-ok','yes');}catch{/* 이번 화면에서만 기억한다 */}
  // 누른 그 자리에서 사진 고르기를 연다. 처음 누른 단추(panelTrigger)는 그대로 두어, 이어서 연 창을 닫으면 그 단추로 초점이 돌아온다(§2-22 검토 10)
  const go=gateNext;gateNext=null;void closePanel();go?.();
}

function say(msg: string) {
  toast.value = msg;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => (toast.value = ''), 3200);
}

const byId = computed(() => new Map(artworks.value.map((a) => [a.id, a])));
const shownWork = computed<Artwork | null>(() => {
  const s = selection.value;
  if (s?.type === 'work') return byId.value.get(s.id) ?? null;
  return nearId.value ? byId.value.get(nearId.value) ?? null : null;
});
const shownPlaque = computed(() => {
  const a = shownWork.value;
  const acc = account.value;
  if (!a || !acc) return null;
  if(visiting.value)return {plaque:{title:a.title||'새 작품',byline:`${visiting.value.child}의 작품`,detail:'',number:''},note:{lines:[],quote:null},guide:a.title||'새 작품'};
  const input = { no: a.no, title: a.title, kind: a.kind, subject: a.subject, material: a.material, age: a.age, madeOn: a.madeOn, words: a.words, child: serverChildName.value };
  return { plaque: plaqueOf(input), note: curatorNote(input), guide: guideText(input) };
});
const masterpiece = computed(() => {
  const s = selection.value;
  if (s?.type !== 'masterpiece') return null;
  return engine.value?.museum.masterpieces[s.index] ?? null;
});
const hasSamples = computed(() => artworks.value.some((a) => a.sample));
// 다른 곳으로 걸어가면 누른 작품의 명패를 닫는다(도착한 곳의 가까운 작품 명패가 대신 뜬다)
watch(place, () => { selection.value = null; });
watch(space, (s) => { if (s === 'inside') measure('inside'); });
// 팀 Coach.vue의 초점 가두기·복귀 원칙을 공간별 패널에 적용한다.
watch(panel,async(next,previous)=>{
  engine.value?.setInputPaused(!!next);
  if(next&&!previous)panelTrigger=document.activeElement as HTMLElement|null;
  await nextTick();
  // 긴 창(개인정보 안내 등)은 첫 버튼이 아래에 있어도 글을 처음부터 보이게 스크롤하지 않는다
  if(next)worldRoot.value?.querySelector<HTMLElement>('[role="dialog"] button:not(:disabled), [role="dialog"] input')?.focus({preventScroll:true});
  else if(panelTrigger?.isConnected){
    // §2-23 E: 메뉴에서 연 창을 닫으면 메뉴는 접은 채 [더보기]로 초점을 돌려준다
    if(panelTrigger.closest('.w-secondary-tools'))worldRoot.value?.querySelector<HTMLElement>('.w-more-tools')?.focus({preventScroll:true});
    else panelTrigger.focus({preventScroll:true});
  }else{
    // 명패·첫 작품 안내처럼 패널이 열린 동안 사라졌다가 다시 그려진 버튼이면 같은 글자의 버튼으로 돌아간다(§2-14 가까이 보기, §2-22 검토 7 저장 안내 [닫기])
    const label=panelTrigger?.textContent?.trim();
    const again=label?[...worldRoot.value?.querySelectorAll<HTMLElement>('.plaque button, .w-first-work button')??[]].find(b=>b.textContent?.trim()===label):undefined;
    (again??worldRoot.value?.querySelector<HTMLElement>(coarse?'.w-first-help button, .w-more-tools':'.w-help-trigger'))?.focus({preventScroll:true});
  }
});

/** 저장된 작품을 다시 읽어 그린다. 배경 지우기·질문 저장·돌리기가 겹쳐도 앞의 것이 끝난 뒤 새로 읽도록 차례로 한다(§2-22) */
let reloading:Promise<void>=Promise.resolve();
function reload():Promise<void>{
  const run=async()=>{
    artworks.value = await worldWorks();
    rooms.value = SERVER_WORLD ? serverRooms(artworks.value) : await store.getRooms();
    if (engine.value && account.value) await engine.value.setWorld(SERVER_WORLD ? serverChildName.value : account.value.child, artworks.value, rooms.value);
  };
  reloading=reloading.then(run,run);
  return reloading;
}

// 서버 설정이 확인되지 않으면 이 기기의 다른 가족 설정을 서버에 보내지 않는다.
let layoutRevision: number | null = null;
let layoutRooms: number[] = [];
let layoutBusy = false;
async function loadServerLayout(local: Prefs, hasLocalAccount: boolean): Promise<Prefs> {
  layoutRevision = null;
  layoutRooms = [];
  const layout = await openLayout({
    get: getWorldLayout, put: putWorldLayout, localRooms: store.getRooms,
    localDecor: local.decor ?? [], hasLocalAccount,
    confirmImport: () => window.confirm('이 기기에 저장된 전시실과 꾸미기를 현재 가족 계정으로 가져올까요? 같은 가족의 다른 기기에도 표시돼요.'),
    active: () => alive,
  });
  layoutRooms = layout.rooms;
  layoutRevision = layout.revision;
  return { ...local, decor: layout.decor };
}
async function saveServerLayout(rooms: number[], decor: DecorItem[]) {
  if (!SERVER_WORLD) return;
  if (layoutRevision === null || layoutBusy) throw new Error('layout_unavailable');
  layoutBusy = true;
  try {
    const saved = await putWorldLayout({ revision: layoutRevision, rooms, decor });
    if (!alive) throw new Error('view_closed');
    layoutRevision = saved.revision;
    layoutRooms = rooms;
  } finally { layoutBusy = false; }
}
async function refreshServerLayout() {
  if (layoutRevision === null || layoutBusy || editing.value || panel.value) return;
  layoutBusy = true;
  try {
    const latest = await getWorldLayout();
    if (!alive || editing.value || panel.value || !latest.exists || latest.revision <= layoutRevision) return;
    layoutRevision = latest.revision;
    layoutRooms = latest.rooms;
    if (prefs.value) prefs.value = { ...prefs.value, decor: latest.decor };
    engine.value?.setDecor(latest.decor);
    await reload();
  } catch { /* 기존 화면을 유지하고 다음 복귀 또는 새로고침에서 다시 확인한다. */ }
  finally { layoutBusy = false; }
}

// 서버에서 읽은 소품을 이전 기기 저장본에 덮어쓰지 않는다.
async function saveDevicePrefs(p: Prefs) {
  if (!SERVER_WORLD) return store.savePrefs(p);
  const local = await store.getPrefs();
  return store.savePrefs({ ...p, decor: local.decor });
}
function serverRooms(works: Artwork[]): number[] {
  return [...new Set([...layoutRooms, ...works.map((a) => a.age)])].sort((a, b) => a - b);
}

/** title이면 시작 화면(앱을 열 때, §2-17). 아니면 곧바로 광장(가족 전환, 마을에서 돌아오기, 개발용 입구) */
async function boot(title = true) {
  account.value = (await store.getAccount()) ?? null;
  prefs.value = await store.getPrefs();
  if (SERVER_WORLD) {
    try { prefs.value = await loadServerLayout(prefs.value, !!account.value); }
    catch { layoutRevision = null; prefs.value = { ...prefs.value, decor: [] }; say('전시실 설정을 불러오지 못했어요. 새로 고침해 다시 확인해 주세요'); }
  }
  setSoundEnabled(prefs.value.sound);
  artworks.value=account.value?await worldWorks():[];rooms.value=account.value ? (SERVER_WORLD ? serverRooms(artworks.value) : await store.getRooms()) : [];
  const showTitle=title||!account.value;
  // 시작 버튼은 엔진이 시작 화면을 그리고 작품을 다 불러온 뒤에 보인다(그 전에 누르면 연출이 시작되지 않고 멈췄다)
  if(showTitle)phase.value='checking';
  await nextTick();
  if(!stage.value)return;
  if(!engine.value){try{engine.value=new MuseumEngine(stage.value,{onView:id=>{const a=byId.value.get(id);if(a)void openView(a);},onPrompt:p=>interaction.value=p,onInteractBuilding:id=>{selectedBuilding.value=townBuildings.value.find(b=>b.id===id)??null;void visitSelected();},onSelect:s=>selection.value=s,onNear:id=>nearId.value=id,onPlace:label=>place.value=label,onAction:a=>{if(a==='addRoom')void addRoom();else if(a==='firstWork')pickFirst();},onSpace:s=>{space.value=s;},onBuilding:id=>{selectedBuilding.value=townBuildings.value.find(b=>b.id===id)??null;},onStart:onStartStage,onRevealed,onPlay:()=>countUse(u=>bump(u,'plays'))});}catch{webglFailed.value=true;await startWithoutWebgl();return;}}
  const e=engine.value;
  // 시작 화면은 도착할 모드·건물·캐릭터로 그린다. 가족이 없으면 새 가족이 받을 값으로 그린다
  e.setTheme(account.value?prefs.value.theme:store.NEW_FAMILY_THEME);e.setInterior(prefs.value.interior??'gallery');e.setBuilding(prefs.value.building??'column_temple',SERVER_WORLD ? serverChildName.value : account.value?.child??store.NEW_FAMILY_CHILD,account.value?.id??'mine');
  e.setFeaturedId(prefs.value.featured??null);e.setDecor(prefs.value.decor??[]);
  if(showTitle){e.showTitle();e.start();} // 작품을 불러오는 동안에도 시작 화면 배경을 그린다
  await e.setAvatar(prefs.value.avatar,prefs.value.avatarImage);await e.setWorld(SERVER_WORLD ? serverChildName.value : account.value?.child??store.NEW_FAMILY_CHILD,artworks.value,rooms.value);
  if(showTitle){phase.value='title';measure('start-ready');await nextTick();startBtn.value?.focus({preventScroll:true});}
  else{e.showPlaza(false);phase.value='ready';showHud(false);if(inviteToken.value)panel.value='social';runCutouts();}
  e.start();if(account.value){void e.loadDecor();noteVisit();void checkBackup();}
  if(import.meta.env.DEV||import.meta.env.MODE==='localtest')(window as unknown as {__uamWorld?:MuseumEngine}).__uamWorld=e;
}
/** [시작하기](§2-17): 가족이 없으면 만들고, 시작 연출로 대표작 앞까지 들어간다. 실패하면 시작 화면으로 돌아온다 */
async function start(sample=false){
  const e=engine.value;
  if(phase.value!=='title'||!e)return;
  measure('start-pressed');
  phase.value='starting';startWaiting.value=false;progress.value={done:0,total:0};
  const ready=(async()=>{
    if(account.value)return;
    await store.createLocalFamily(sample,(done,total)=>{progress.value={done,total};});
    account.value=(await store.getAccount())??null;prefs.value=await store.getPrefs();
    if (SERVER_WORLD) prefs.value = await loadServerLayout(prefs.value, false);
    if(!account.value)throw new Error('가족을 만들지 못했어요');
    artworks.value=await worldWorks();rooms.value=SERVER_WORLD ? serverRooms(artworks.value) : await store.getRooms();
    await e.setWorld(account.value.child,artworks.value,rooms.value);
    void e.loadDecor(); // 가족이 생긴 뒤 명화·흉상 장식을 불러온다(가족이 있던 경우는 boot에서 부른다)
  })();
  try{await e.playStart(ready);if(phase.value==='starting')arrived();} // 연출 없이 끝났어도 화면이 '시작 중'에 멈추지 않게 한다
  catch{phase.value='title';startWaiting.value=false;say('시작하지 못했어요. 다시 해 주세요');await nextTick();startBtn.value?.focus({preventScroll:true});}
}
function onStartStage(stage:'wait'|'go'|'hud'){if(stage==='wait')startWaiting.value=true;else if(stage==='go')startWaiting.value=false;else arrived();}
/** 도착(§2-17): HUD를 차례로 보이고, 저장 안내는 6초, 키 안내는 8초 동안만 둔다. 작품이 없으면 첫 작품 안내를 연다 */
function showHud(intro:boolean){
  for(const t of arriveTimers)window.clearTimeout(t);
  hudIntro.value=intro;bandOn.value=true;hintOn.value=true;
  arriveTimers=[window.setTimeout(()=>(hudIntro.value=false),1200),window.setTimeout(()=>(bandOn.value=false),6000),window.setTimeout(()=>(hintOn.value=false),8000)];
}
function arrived(){
  phase.value='ready';startWaiting.value=false;showHud(true);
  const acc=account.value,p=prefs.value;
  if(acc&&p)engine.value?.setBuilding(p.building??'column_temple',serverChildName.value,acc.id);
  firstPrompt.value=!!acc&&artworks.value.length===0;
  setAmbience(p?.theme??'classic');
  if(acc){noteVisit();runCutouts();}
  if(inviteToken.value&&acc)panel.value='social';
  // 시작 버튼이 사라졌으니 초점을 다음 할 일로 옮긴다(첫 작품이면 [사진 고르기], 아니면 화면)
  void nextTick(()=>{const next=firstPrompt.value?worldRoot.value?.querySelector<HTMLElement>('.w-first-work .g-btn--primary'):null;if(next)next.focus({preventScroll:true});else (document.activeElement as HTMLElement|null)?.blur?.();});
}
/** 첫 작품 안내(§2-17): [사진 고르기]와 빈 대표작 액자는 운영체제 사진 선택을 바로 연다 */
function pickFirst(){if(visiting.value||panel.value)return;beforeUpload(()=>firstPick.value?.click());}
function onFirstPicked(e:Event){const input=e.target as HTMLInputElement,files=Array.from(input.files??[]);input.value='';if(!files.length)return;firstPrompt.value=false;pendingFiles.value=files;openPanel('upload');}
function onRevealed(id:string){if(pendingReveal.value!==id)return;pendingReveal.value=null;recentSaved.value=id;}
async function familyChanged(){visiting.value=null;selectedBuilding.value=null;panel.value=null;selection.value=null;nearId.value=null;await boot(false);}
async function showTown(focus?:string){if(!account.value)return;panel.value=null;try{visiting.value=null;selection.value=null;nearId.value=null;await reload();engine.value?.setBuilding(prefs.value?.building??'column_temple',serverChildName.value,account.value.id);townBuildings.value=await social.town(account.value.id);selectedBuilding.value=townBuildings.value.find(b=>b.id===focus)??null;engine.value?.showTown(townBuildings.value,focus);void engine.value?.setResidents(townBuildings.value);inviteToken.value='';}catch{say('마을을 열지 못했어요. 다시 해 주세요');}}
async function visitSelected(){const b=selectedBuilding.value;if(!b||!account.value)return;if(b.mine){await familyChanged();engine.value?.enterMuseum();return;}try{const gallery=await social.gallery(account.value.id,b.id);visiting.value=gallery.building;artworks.value=gallery.works.map((w,i)=>({id:w.id,no:i+1,title:w.title,kind:w.kind,display:w.display,cutout:w.cutout,age:w.room,subject:w.behavior,material:'',madeOn:'',words:'',original:new Blob(),sample:false,createdAt:0}));rooms.value=gallery.rooms;selection.value=null;nearId.value=null;engine.value?.setBuilding(b.style,b.child,b.id);engine.value?.showPlaza();await engine.value?.setWorld(b.child,artworks.value,rooms.value,true);engine.value?.enterMuseum();}catch{say('지금은 이 미술관에 들어갈 수 없어요');await showTown();}}
async function recheckFriend(){if(!account.value)return;try{const list=await social.neighbors(account.value.id);if(visiting.value&&!list.some(b=>b.id===visiting.value!.id)){say('친구 관계가 끝나 미술관에서 나왔어요');await showTown();}else if(space.value==='town'){townBuildings.value=await social.town(account.value.id);engine.value?.showTown(townBuildings.value);void engine.value?.setResidents(townBuildings.value);}}catch{if(visiting.value){visiting.value=null;await familyChanged();}say('친구 정보를 확인하지 못했어요');}}
function outside(){if(visiting.value)void showTown();else engine.value?.showPlaza();}
async function setBuilding(style:MuseumStyle){if(!prefs.value)return;const next={...prefs.value,building:style};try{await saveDevicePrefs(next);prefs.value=next;engine.value?.setBuilding(style,serverChildName.value);}catch{say('미술관 모양을 저장하지 못했어요');}}
function enterMuseum(){engine.value?.enterMuseum();setAmbience(prefs.value?.theme??'classic');}

/** 개발용 테스트 입구(§2-15): 시작 연출 없이 광장으로 간다(기존 검사용) */
async function enterTest() {
  phase.value = 'starting'; startWaiting.value = true; progress.value = { done: 0, total: store.SAMPLES.length };
  try {
    await store.createTestAccount((done, total) => { progress.value = { done, total }; });
    startWaiting.value = false;
    await boot(false);
  } catch {
    phase.value = 'title'; startWaiting.value = false;
    say('테스트 계정을 만들지 못했어요. 다시 해 주세요');
  }
}

async function addRoom() {
  const top = Math.max(0, ...rooms.value, ...artworks.value.map((a) => a.age));
  if(visiting.value)return;
  if (top >= MAX_AGE) { say(`${MAX_AGE}세관까지 열 수 있어요`); return; }
  const next = top + 1;
  try {
    await saveServerLayout([...rooms.value, next], prefs.value?.decor ?? []);
    if (!SERVER_WORLD) await store.saveRooms([...rooms.value, next]);
    await reload();
    say(`${next}세관을 열었어요`);
  } catch { say('전시실을 저장하지 못했어요. 다른 기기에서 변경했으면 새로 고침해 주세요'); }
}

// ───────── 공간 꾸미기(§2-15 꾸미기 규칙): 감상과 분리된 편집 상태. [완료]만 저장한다 ─────────
const editing = ref(false), decorKind = ref<DecorKind>('plant'), decorDraft = ref<DecorItem[]>([]), decorSaving = ref(false), decorMsg = ref(''), confirmDecorLeave = ref(false);
let decorBase: DecorItem[] = [];
const decorHistory = ref<DecorItem[][]>([]);
const clone = (l: DecorItem[]) => l.map((i) => ({ ...i }));
const decorWork = computed(() => (editing.value && selection.value?.type === 'work' ? selection.value.id : null));
const decorChanged = computed(() => JSON.stringify(decorDraft.value) !== JSON.stringify(decorBase));
const decorSpots = computed(() => {
  const w = decorWork.value, kind = DECOR_KINDS.find((k) => k.id === decorKind.value)!;
  if (!w) return [];
  return kind.spots.map((spot) => {
    const taken = decorDraft.value.some((i) => i.work === w && i.spot === spot && engine.value?.decorShown(i.id));
    // checkDecor의 null은 '놓을 수 있음'이므로 ??로 덮지 않는다
    return { spot, reason: taken ? '이미 놓여 있어요' : engine.value ? engine.value.checkDecor(decorKind.value, w, spot, decorDraft.value) : '준비 중이에요' };
  });
});
const decorHidden = computed(() => decorDraft.value.filter((i) => !engine.value?.decorShown(i.id)).length);
function openDecor() {
  if (visiting.value || !prefs.value) return;
  panel.value = null; recentSaved.value = null; selection.value = null;
  if (space.value !== 'inside') enterMuseum();
  decorBase = clone(prefs.value.decor ?? []); decorDraft.value = clone(decorBase); decorHistory.value = []; decorMsg.value = ''; confirmDecorLeave.value = false; editing.value = true;
}
function applyDraft(next: DecorItem[]) { decorHistory.value = [...decorHistory.value, clone(decorDraft.value)]; decorDraft.value = next; engine.value?.setDecor(next); decorMsg.value = ''; }
function placeDecor(spot: DecorSpot) { const w = decorWork.value; if (!w) return; applyDraft([...clone(decorDraft.value), { id: store.newId(), kind: decorKind.value, work: w, spot }]); }
function clearDecorAt(work: string) { applyDraft(decorDraft.value.filter((i) => i.work !== work)); }
function undoDecor() { const prev = decorHistory.value.at(-1); if (!prev) return; decorHistory.value = decorHistory.value.slice(0, -1); decorDraft.value = prev; engine.value?.setDecor(prev); }
async function finishDecor() {
  if (!prefs.value || decorSaving.value) return;
  decorSaving.value = true; decorMsg.value = '';
  const next = { ...prefs.value, decor: clone(decorDraft.value) };
  try { await saveServerLayout(rooms.value, next.decor ?? []); await saveDevicePrefs(next); prefs.value = next; editing.value = false; selection.value = null; say('꾸민 배치를 저장했어요'); }
  catch { decorMsg.value = '저장하지 못했어요. 다른 기기에서 변경했으면 새로 고침해 주세요'; }
  finally { decorSaving.value = false; }
}
function cancelDecor() {
  if (decorSaving.value) return;
  if (decorChanged.value && !confirmDecorLeave.value) { confirmDecorLeave.value = true; return; }
  leaveDecor();
}
function leaveDecor() { engine.value?.setDecor(decorBase); decorDraft.value = clone(decorBase); confirmDecorLeave.value = false; editing.value = false; selection.value = null; }

/** 업로드 결과(§2-15): 다시 그리고, 마지막 작품을 앞마당 대표작 자리에 공개하며 그 앞으로 간다.
 *  결과 카드는 액자 빛이 켜진 뒤(엔진 onRevealed)에 보인다(§2-17) */
const artWatch = useArtworkWatch(); // 서버 판에서 올린 작품만 묻는다(#37). 기기 판은 add를 부르지 않아 요청이 없다
const { failure: watchFailure, retrying: watchRetrying } = artWatch;
const setDetail = (d: ArtworkDetail) => { artWatch.details.value = new Map(artWatch.details.value).set(d.id, d); };
const confirmOpenId = ref<string | null>(null);
const confirmPrompt = computed(() => [...artWatch.details.value.values()].find((d) => d.state !== 'awaiting_review' && d.state !== 'failed' && !d.confirmedKind && d.choices.length > 0) ?? null);
const decisionOpenId = ref<string | null>(null), decisionBusy = ref(false), decisionError = ref<Failure | null>(null);
const decisionPrompt = computed(() => [...artWatch.details.value.values()].find(d => (d.state === 'awaiting_review' || d.state === 'failed') && d.choices.length > 0) ?? null);
const decisionDetail = computed(() => decisionOpenId.value ? artWatch.details.value.get(decisionOpenId.value) ?? null : null);
watch(decisionDetail, (d) => { if (decisionOpenId.value && (!d || !d.choices.length || (d.state !== 'awaiting_review' && d.state !== 'failed'))) decisionOpenId.value = null; });
async function submitWorldDecision(id: string, decision: Decision) {
  if (!alive || decisionBusy.value) return;
  const childId = artWatch.details.value.get(id)?.childId;
  decisionBusy.value=true; decisionError.value=null;
  try {
    const out=await decide(id,decision);
    if (!alive) return;
    if(decision==='retake'){if(recentSaved.value===id)recentSaved.value=null;selectedChild.value=out.retake?.childId ?? childId ?? selectedChild.value; const next = new Map(artWatch.details.value); next.delete(id); artWatch.details.value = next; await reload();if (!alive) return;say('다시 찍을 준비가 됐어요. 작품 올리기에서 새 사진을 선택해 주세요.');}
    else {if(out.artwork)setDetail(out.artwork);artWatch.add([id]);say(decision==='use_lower'?ko.review.afterLower:'선택한 방식으로 작품을 전시에 반영할게요.');}
    decisionOpenId.value=null;
  } catch(e) {
    if (!alive) return;
    decisionError.value=failureOf(e);
    try {const fresh=await getArtwork(id);if(alive)setDetail(fresh);}
    catch(retryError){if(alive)decisionError.value=failureOf(retryError);}
  } finally {decisionBusy.value=false;}
}
const confirmDetail = computed(() => confirmOpenId.value ? artWatch.details.value.get(confirmOpenId.value) ?? null : null);
watch(confirmDetail, (d) => { if (confirmOpenId.value && (!d || d.confirmedKind || !d.choices.length || d.state === 'awaiting_review' || d.state === 'failed')) confirmOpenId.value = null; });
const worldFailure = computed(() => watchFailure.value ?? galleryFailure.value);
async function retryWorld() { await artWatch.retry(); if (alive && galleryFailure.value) await reload(); }
if (SERVER_WORLD) {
  let staleSeen = ''; // 같은 차이로 되풀이해 읽지 않는다. 못 여는 사진은 차이가 영구히 남는다(마스터플랜 3-3)
  watch(artWatch.details, (d) => { // 승인되어 걸린 결과가 바뀌면 다시 그린다
    const stale = [...d.values()].filter(isStale).map((x) => `${x.id}:${x.hungResultKind}`).sort().join();
    if (stale && stale !== staleSeen) void reload();
    staleSeen = stale;
  });
}
async function onSaved(ids: string[], reveal = true, from: 'upload' | 'play' = 'upload') {
  if (SERVER_WORLD && from === 'upload') artWatch.add(ids);
  panel.value = null; pendingFiles.value = []; firstPrompt.value = false;
  await reload();
  const last = ids.at(-1) ?? null;
  savedCount.value = ids.length; recentSaved.value = null; pendingReveal.value = reveal ? last : null; selection.value = null;
  savedIds.value = [...ids]; askStep.value = SERVER_WORLD ? 'done' : 'age'; askIndex.value = 0; askMsg.value = ''; // §2-22 4: 질문은 처음부터. 서버 판은 서버가 이야기를 채우고 올린 뒤 고칠 수 없다(D46)
  if (from === 'upload' && ids.length) { countUse((u) => bump(u, 'uploads', ids.length)); measure('first-saved'); }
  if (reveal && last) engine.value?.reveal(last); // 결과 카드가 상태를 알리므로 같은 말의 알림은 띄우지 않는다
  else if (ids.length) say(`${ids.length}점을 보관했어요`);
  runCutouts(); // §2-22 1: 건 뒤 같은 기기에서 배경 지우기를 이어서 한다
}
/** 나이(§2-22 4 ①): 묶음 전체를 그 나이 전시관으로 옮기고 마지막 작품 앞에 다시 선다 */
async function pickAge(age: number) {
  if (askBusy.value || rotating.value) return; // §2-22 검토 2: 돌리는 동안은 고르지 않는다
  askBusy.value = true; askMsg.value = '';
  try {
    for (const id of savedIds.value) { const a = byId.value.get(id); if (a) await store.updateArtworkInfo(id, { title: a.title, age, madeOn: a.madeOn, words: a.words, material: a.material, kind: a.kind, subject: a.subject }); }
    await reload();
    const last = savedIds.value.at(-1); if (last) engine.value?.jumpTo(last);
    askStep.value = 'subject'; askIndex.value = 0;
  } catch { askMsg.value = '나이를 저장하지 못했어요. 다시 골라 주세요'; }
  finally { askBusy.value = false; }
}
function skipAge() { askMsg.value = ''; askStep.value = 'subject'; askIndex.value = 0; }
/** 주제(§2-22 4 ②): 작품마다 고른다. 행동은 subjects.ts 표가 정한다 */
async function pickSubject(subject: string) {
  const id = savedIds.value[askIndex.value], a = id ? byId.value.get(id) : null;
  if (!id || askBusy.value || rotating.value) return;
  if (!a) { nextSubject(); return; } // 묻던 작품이 그사이 지워졌으면 다음으로(§2-22 검토 10)
  askBusy.value = true; askMsg.value = '';
  try { await store.updateArtworkInfo(id, { title: a.title, age: a.age, madeOn: a.madeOn, words: a.words, material: a.material, kind: a.kind, subject }); await reload(); nextSubject(); }
  catch { askMsg.value = '주제를 저장하지 못했어요. 다시 골라 주세요'; }
  finally { askBusy.value = false; }
}
function nextSubject() { askMsg.value = ''; if (askIndex.value < savedIds.value.length - 1) askIndex.value++; else askStep.value = 'done'; }
function playSaved() { if (recentSaved.value) engine.value?.play(recentSaved.value); }

/** 사진 돌리기(§2-15·§2-23 B): 원본은 그대로 두고 화면용 사본만 왼쪽·오른쪽으로 90° 다시 만든다. 다시 그린 질감이 바로 보인다 */
async function rotateSaved(dir: 1 | -1) {
  const a = askWork.value;
  if (!a || rotating.value || askBusy.value) return; // §2-22 검토 2: 나이·주제를 저장하는 동안은 돌리지 않는다
  rotating.value = true;
  try { await store.setRotation(a.id, store.turned(a.rotation ?? 0, dir)); await reload(); say('사진을 돌렸어요'); runCutouts(); }
  catch { say('사진을 돌리지 못했어요. 다시 해 주세요'); }
  finally { rotating.value = false; }
}


async function onDelete(id: string) {
  try {
    await (SERVER_WORLD ? deleteArtwork(id) : store.deleteArtwork(id));
    if (SERVER_WORLD) artWatch.forget(id);
    if (recentSaved.value === id) recentSaved.value = null;
    if (selection.value?.type === 'work' && selection.value.id === id) selection.value = null;
    await reload();
    say('작품을 지웠어요');
  } catch (e) { say(SERVER_WORLD ? failureReason(failureOf(e)) : '지우지 못했어요. 다시 해 주세요'); }
}

async function toggleSamples() {
  try {
    if (hasSamples.value) { await store.removeSamples(); say('견본을 치웠어요'); }
    else { await store.addSamples(); say('견본을 다시 걸었어요'); }
    await reload();
  } catch { say('바꾸지 못했어요. 다시 해 주세요'); }
}

const changingScene=ref(false);
async function changeScene(kind:'theme'|'interior',id:ThemeId|'gallery'|'cathedral'){
  if(!prefs.value||changingScene.value)return;
  const before=prefs.value,next={...before,[kind]:id};changingScene.value=true;
  try{
    if(kind==='theme')engine.value?.setTheme(id as ThemeId);else engine.value?.setInterior(id as 'gallery'|'cathedral');
    await saveDevicePrefs(next);prefs.value=next;
    if(kind==='theme'){setAmbience(id as ThemeId);if(space.value==='town')void engine.value?.setResidents(townBuildings.value);}
  }catch{
    try{if(kind==='theme')engine.value?.setTheme(before.theme);else engine.value?.setInterior(before.interior??'gallery');}catch{say('공간을 복구하지 못했어요. 화면을 새로 열어 주세요');return;}
    say('공간을 바꾸지 못했어요. 이전 설정을 유지했어요. 다시 눌러 주세요');
  }finally{changingScene.value=false;}
}
async function setTheme(id:ThemeId){await changeScene('theme',id);}

async function toggleSound() {
  if (!prefs.value) return;
  prefs.value = { ...prefs.value, sound: !prefs.value.sound };
  setSoundEnabled(prefs.value.sound);
  if (!prefs.value.sound) stopSpeaking();
  try { await saveDevicePrefs(prefs.value); } catch { say('설정을 저장하지 못했어요'); }
}

async function previewAvatar(cfg: AvatarConfig, image: Blob | null) { await engine.value?.setAvatar(cfg, image); }

async function saveAvatar(cfg: AvatarConfig, image: Blob | null) {
  if (!prefs.value) return;
  const next={ ...prefs.value, avatar: cfg, avatarImage: image };
  try { await saveDevicePrefs(next);prefs.value=next;say('캐릭터를 저장했어요');closePanel(); } catch { say('캐릭터를 저장하지 못했어요'); }
}

function openPanel(p: Panel) {
  if(visiting.value&&p!=='theme'&&p!=='help'&&p!=='view')return;
  panel.value = p;
  moreTools.value=false;
  engine.value?.setCustomizing(p === 'avatar');
}
async function closePanel() {
  if (panel.value === 'avatar' && prefs.value) await engine.value?.setAvatar(prefs.value.avatar, prefs.value.avatarImage);
  if(panel.value==='social'&&inviteToken.value){inviteToken.value='';history.replaceState(null,'','/app/world');}
  if(panel.value==='view')closeView();
  if(panel.value==='storage')gateNext=null;
  panel.value = null;
  confirmReset.value = false;
  engine.value?.setCustomizing(false);
}

async function saveChild(name: string, age: number) {
  if (!account.value) return;
  const n = name.trim().slice(0, 20);
  if (!n) { say('아이 이름을 적어 주세요'); return; }
  account.value = { ...account.value, child: n, childAge: Math.min(MAX_AGE, Math.max(0, age)) }; // 0은 모름(§2-15)
  try { await store.saveAccount(account.value); await reload(); say('저장했어요'); } catch { say('저장하지 못했어요'); }
}

async function resetAll() {
  try {
    await store.clearAll();
    engine.value?.dispose();
    engine.value = null;
    account.value = null;
    panel.value = null;
    confirmReset.value = false;
    visiting.value=null;selection.value=null;nearId.value=null;
    await boot();
  } catch { say('지우지 못했어요. 다시 해 주세요'); }
}

// 움직임이 끝날 때까지 명패를 접어 작품을 가리지 않는다.
const plaqueFolded = ref(false);
async function playShown() {
  if (!shownWork.value || !engine.value || plaqueFolded.value) return;
  engine.value.play(shownWork.value.id);
  plaqueFolded.value = true;
  try {
    while (alive && engine.value?.performing()) await new Promise(r => setTimeout(r, CUTOUT.waitMs));
  } finally { plaqueFolded.value = false; }
}
function listen() {
  const g = shownPlaque.value?.guide;
  if (g && !speak(g)) say('이 브라우저는 읽어 주기를 지원하지 않아요');
}
function openArchive(id: string | null) { archiveFocus.value = id; openPanel('archive'); }
/** 3D를 만들지 못한 기기(§2-19 기준 5): 가족이 없으면 만들고 한눈에 보기 화면으로 바로 쓴다 */
async function startWithoutWebgl() {
  try { if (!account.value) { account.value = await store.createLocalFamily(false); prefs.value = await store.getPrefs(); if (SERVER_WORLD) prefs.value = await loadServerLayout(prefs.value, false); } await reload(); }
  catch { say('이 기기에 저장할 수 없어요. 브라우저 설정을 확인해 주세요'); }
  phase.value = 'ready';
  // 3D가 없어도 앱을 열 때 하는 일은 같다: 들어온 날, 백업 권유, 처리 전 작품 이어서 하기(§2-22 검토 10)
  if (account.value) { noteVisit(); void checkBackup(); runCutouts(); }
}
/** 보관함·한눈에 보기의 [미술관에서 보기](§2-18): 창을 닫고 걸어가는 동안 [더보기]를 다시 펼치지 않는다 */
function gotoWork(id: string) { panelTrigger = null; void closePanel(); engine.value?.jumpTo(id); } // §2-23 C: 걷지 않고 흰빛 전환

// 가까이 보기(§2-14): 화면용 원본을 크게 보고, 아이가 한 말을 그 자리에서 적는다. 저장은 기존 words 칸만 쓴다
const viewWork=shallowRef<Artwork|null>(null),viewUrl=ref(''),storyDraft=ref(''),storyBusy=ref(false),storyMsg=ref('');
// §2-22 검토 10: 가까이 보기를 닫거나 다른 작품으로 바꾸면 앞 그림의 자랑하기 [파일 보내기]를 지운다(이야기 저장은 같은 작품이라 남긴다)
watch(()=>viewWork.value?.id,(id,old)=>{if(id!==old&&resend.value?.kind==='card')resend.value=null;});
function openView(a:Artwork){closeView();viewWork.value=a;viewUrl.value=URL.createObjectURL(a.display);storyDraft.value=a.words;storyMsg.value='';cardPick.value={child:false,age:false};cardMsg.value='';openPanel('view');}
// 자랑하기(§2-22 10): 사진과 명패 한 장. 이름·나이는 보호자가 고를 때만 넣고, 휴대폰에서는 공유 시트로 보낸다
const cardPick=ref({child:false,age:false}),cardBusy=ref(false),cardMsg=ref('');
const SHARE_URL=(import.meta.env.VITE_SHARE_URL as string|undefined)??''; // 배포 주소가 정해지면 빌드 설정값으로 넣는다
function cardSaved(result:SaveResult){
  if(result==='shared'||result==='downloaded')countUse(u=>bump(u,'shares'));
  cardMsg.value=result==='shared'?'자랑하기 그림을 보냈어요':result==='downloaded'?'자랑하기 그림을 내려받았어요':result==='cancelled'?'보내지 않았어요':'[파일 보내기]를 한 번 더 눌러 주세요';
}
async function shareWork(){
  const a=viewWork.value;if(!a||visiting.value||cardBusy.value)return;
  cardBusy.value=true;cardMsg.value='';resend.value=null;
  try{
    const t=cardText(a,serverChildName.value,cardPick.value,SHARE_URL);
    const font=(worldRoot.value?getComputedStyle(worldRoot.value).getPropertyValue('--g-serif').trim():'')||'serif';
    await document.fonts?.ready;
    const {result,file}=await saveFile(await drawCard(a.display,t,font),`우리아이미술관_${safeName(t.title)}.png`,t.title,coarse);
    if(result==='retry')resend.value={file,title:t.title,kind:'card',count:0,at:Date.now()};
    cardSaved(result);
  }catch{cardMsg.value='그림을 만들지 못했어요. 다시 해 주세요';}
  finally{cardBusy.value=false;}
}
function closeView(){if(viewUrl.value)URL.revokeObjectURL(viewUrl.value);viewUrl.value='';viewWork.value=null;}
async function saveStory(){
  const a=viewWork.value;if(!a||visiting.value||storyBusy.value)return;
  storyBusy.value=true;storyMsg.value='';
  try{await store.updateArtworkInfo(a.id,{title:a.title,age:a.age,madeOn:a.madeOn,words:storyDraft.value,material:a.material,kind:a.kind,subject:a.subject});await reload();viewWork.value=byId.value.get(a.id)??a;storyMsg.value='이야기를 남겼어요. 원본 사진은 그대로예요';}
  catch{storyMsg.value='저장하지 못했어요. 적은 내용은 남아 있어요. 다시 저장해 주세요';}
  finally{storyBusy.value=false;}
}
// 대표작 고르기(§2-14): 로비 가운데 액자와 광장 현수막에 건다. 이 기기의 내 가족 설정에만 저장한다
async function setFeatured(id:string){
  if(!prefs.value||visiting.value)return;
  const next={...prefs.value,featured:id};
  try{await saveDevicePrefs(next);prefs.value=next;engine.value?.setFeaturedId(id);say('대표작으로 걸었어요');}catch{say('대표작을 저장하지 못했어요');}
}
const featuredId=computed(()=>engine.value&&!visiting.value?(prefs.value?.featured&&byId.value.has(prefs.value.featured)?prefs.value.featured:[...artworks.value].sort((a,b)=>b.createdAt-a.createdAt)[0]?.id??null):null);

// 조이스틱
const joy = ref<{ x: number; y: number } | null>(null);
let joyId = -1;
let joyRect: DOMRect | null = null;
function joyDown(e: PointerEvent) {
  joyId = e.pointerId;
  joyRect = (e.currentTarget as HTMLElement).getBoundingClientRect();
  (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  joyMove(e);
}
function joyMove(e: PointerEvent) {
  if (e.pointerId !== joyId || !joyRect) return;
  const r = joyRect.width / 2;
  let x = (e.clientX - joyRect.left - r) / r, y = (e.clientY - joyRect.top - r) / r;
  const l = Math.hypot(x, y);
  if (l > 1) { x /= l; y /= l; }
  joy.value = { x, y };
  engine.value?.setJoystick(x, y);
}
function joyUp(e: PointerEvent) {
  if (e.pointerId !== joyId) return;
  joyId = -1;
  joy.value = null;
  engine.value?.setJoystick(0, 0);
}

function onKey(e: KeyboardEvent) {
  if(e.key==='Escape'&&!panel.value&&(confirmOpenId.value||decisionOpenId.value)){e.preventDefault();if(decisionBusy.value)return;confirmOpenId.value=null;decisionOpenId.value=null;return;}
  // [더보기]는 Escape로 접고 초점을 [더보기]로 돌린다(§2-17)
  if(e.key==='Escape'&&moreTools.value&&!panel.value){e.preventDefault();moreTools.value=false;worldRoot.value?.querySelector<HTMLElement>('.w-more-tools')?.focus();return;}
  if(!panel.value&&!confirmOpenId.value&&!decisionOpenId.value)return;
  if(e.key==='Escape'&&editing.value&&!panel.value){e.preventDefault();cancelDecor();return;}
  if(e.key==='Escape'){e.preventDefault();if(panel.value==='play')playPanel.value?.requestClose();else if(panel.value==='upload')uploadPanel.value?.requestClose();else void closePanel();return;}
  if(e.key!=='Tab')return;
  const dialog=worldRoot.value?.querySelector<HTMLElement>('[role="dialog"]');
  const controls=Array.from(dialog?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]')??[]).filter(el=>el.getClientRects().length>0);
  const first=controls[0],last=controls.at(-1);if(!first)return;
  if(!dialog?.contains(document.activeElement)){e.preventDefault();first.focus();}
  else if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}
  else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
}

/** [더보기] 바깥을 누르면 접는다 */
function onOutside(e:PointerEvent){if(moreTools.value&&!(e.target as HTMLElement|null)?.closest('.tools'))moreTools.value=false;}
function onMenuPick(e:MouseEvent){if((e.target as HTMLElement|null)?.closest('button'))moreTools.value=false;}
onMounted(async () => {
  measure('title-shown'); // 시작 화면(제목 묶음)이 그려진 때
  window.addEventListener('keydown', onKey);window.addEventListener('pointerdown',onOutside,true);
  document.addEventListener('visibilitychange',onResume);window.addEventListener('pageshow',onResume);
  if(LOCAL_SOCIAL){window.addEventListener('uam-world-social',recheckFriend);window.addEventListener('focus',recheckFriend);
    if(typeof BroadcastChannel!=='undefined'){socialChannel=new BroadcastChannel('uam-world-social');socialChannel.onmessage=()=>void recheckFriend();}}
  else if(new URLSearchParams(location.search).has('invite')){const u=new URL(location.href);u.searchParams.delete('invite');history.replaceState(null,'',u.pathname+u.search+u.hash);} // §2-22 9: 배포본은 초대 값을 무시하고 지운다
  if (!(await store.storageWorks())) { phase.value = 'nostorage'; return; }
  void store.keepStorage().then((v) => { persisted.value = v; }); // §2-19 기준 1: 브라우저가 저장 공간을 비울 때 이 미술관은 남기도록 요청
  await boot();
  if (SERVER_WORLD) void artWatch.resume(() => watchIds(selectedChild.value)); // 새로 고침해도 진행 중인 작품과 확정·결정을 기다리는 작품을 이어서 본다
});
onBeforeUnmount(() => {
  alive=false;
  window.removeEventListener('keydown', onKey);window.removeEventListener('pointerdown',onOutside,true);for(const t of arriveTimers)window.clearTimeout(t);
  document.removeEventListener('visibilitychange',onResume);window.removeEventListener('pageshow',onResume);
  if(LOCAL_SOCIAL){window.removeEventListener('uam-world-social',recheckFriend);window.removeEventListener('focus',recheckFriend);socialChannel?.close();}stopAmbience();
  stopSpeaking();
  closeView();
  engine.value?.dispose();
});

const childName = ref('');
const childAge = ref(6);
function openSettings() {
  childName.value = account.value?.child ?? '';
  childAge.value = account.value?.childAge ?? 6;
  openPanel('settings');
}
</script>

<template>
  <div ref="worldRoot" class="world" :class="{'w-hud-intro':hudIntro}" :style="{'--w-panel':uiLook.ui,'--w-ink':uiLook.ink}">
    <component :is="Measure" v-if="Measure" />
    <div v-show="!webglFailed" ref="stage" class="stage" />
    <Transition name="w-ui-fade"><p v-if="phase==='ready' && bandOn && !SERVER_WORLD" class="local-band" role="status">이 기기에 저장돼요</p></Transition>
    <!-- 백업 권유 한 줄(§2-22 7, UI 계약 10절): 앱을 열 때 한 번만, 다른 창이 없을 때 -->
    <section v-if="!SERVER_WORLD && nudge && phase==='ready' && !panel && !visiting && !recentSaved" class="w-nudge g-panel" role="status" aria-label="백업 권유">
      <span>백업 파일에 없는 작품이 쌓였어요. 백업을 내보내 둘까요?</span>
      <span class="row"><button class="g-btn g-btn--primary" type="button" @click="backupFromNudge">백업 내보내기</button><button class="g-btn" type="button" @click="backupLater">나중에</button></span>
    </section>
    <section v-if="worldFailure && phase==='ready'" class="w-nudge g-panel" role="status" aria-label="작품 처리 상태">
      <span>{{ failureReason(worldFailure) }}</span>
      <button class="g-btn g-btn--primary" type="button" :disabled="watchRetrying" @click="retryWorld">{{ worldFailure.kind === 'refused' ? '닫기' : '다시 시도' }}</button>
    </section>
    <section v-if="SERVER_WORLD && confirmPrompt && !decisionPrompt && !decisionOpenId && !worldFailure && phase==='ready' && !panel && !confirmOpenId" class="w-nudge g-panel" role="status" aria-label="전시 방식을 골라 주세요">
      <span>{{ confirmPrompt.story?.title || '새 작품' }}의 전시 방식을 골라 주세요.</span>
      <button class="g-btn g-btn--primary" type="button" @click="confirmOpenId=confirmPrompt!.id">결과 고르기</button>
    </section>
    <section v-if="SERVER_WORLD && decisionPrompt && !confirmOpenId && !worldFailure && phase==='ready' && !panel && !decisionOpenId" class="w-nudge g-panel" role="status" aria-label="작품 결과 확인">
      <span>{{ decisionPrompt.story?.title || '새 작품' }}의 결과를 골라 주세요.</span>
      <button class="g-btn g-btn--primary" type="button" @click="decisionOpenId=decisionPrompt.id">결과 확인</button>
    </section>
    <WorldDecision v-if="decisionOpenId && decisionDetail" :detail="decisionDetail" :busy="decisionBusy" :error="decisionError" @close="decisionOpenId=null" @decide="(choice: Decision)=>submitWorldDecision(decisionOpenId!,choice)" />
    <p v-if="phase === 'starting' && startWaiting" class="w-start-status" role="status">{{ progress.total ? `작품을 거는 중이에요 (${progress.done}/${progress.total})` : '미술관을 준비하고 있어요' }}</p>

    <!-- 시작 화면(§2-17): 이 가족의 미술관을 배경으로 제목과 [시작하기]. 아래 세 갈래(v-if, v-else-if, v-else)는 붙여 둔다 -->
    <section v-if="phase === 'checking' || phase === 'title' || phase === 'starting'" class="entrance w-start" :class="{ 'w-leaving': phase === 'starting' }">
      <div class="w-title-card" :inert="phase === 'starting' || undefined">
        <h1>우리 아이 미술관</h1>
        <p class="w-entry-lead">{{ startLead }}</p>
        <div v-if="phase !== 'checking'" class="w-entry-actions">
          <button ref="startBtn" class="g-btn g-btn--primary g-btn--big" type="button" :disabled="phase !== 'title'" @click="start(false)">시작하기</button>
          <button v-if="!account && !SERVER_WORLD" class="g-btn g-btn--big w-entry-secondary" type="button" :disabled="phase !== 'title'" @click="start(true)">샘플 미술관 먼저 보기</button>
        </div>
        <p v-if="!account && !SERVER_WORLD" class="w-entry-note">이 기기에 저장돼요. 브라우저 데이터를 지우면 사라질 수 있어요.</p>
      </div>
      <div v-if="TestEntry && !account && phase === 'title'" class="w-test-entry"><component :is="TestEntry" @enter="enterTest" /></div>
    </section>

    <section v-else-if="phase === 'nostorage'" class="entrance">
      <div class="g-panel entrance-card">
        <h1>우리 아이 미술관</h1>
        <p class="g-note">이 브라우저에서는 저장할 수 없어요. 개인 정보 보호 모드를 끄거나 다른 브라우저로 열어 주세요.</p>
      </div>
    </section>

    <!-- 미술관 -->
    <template v-else>

      <!-- §2-19 기준 5: 3D를 못 그리는 기기는 한눈에 보기로 작품을 보고 올린다 -->
      <section v-if="webglFailed" class="fallback">
        <p class="g-note">이 기기에서는 3D 미술관을 열 수 없어 작품을 한눈에 보여 드려요.</p>
        <WorldOverview v-if="account" inline :artworks="artworks" :child="visiting?.child ?? serverChildName" @upload="beforeUpload(() => openPanel('upload'))" />
      </section>

      <header class="hud-top" :class="{ 'w-menu-open': moreTools }">
        <div v-if="!webglFailed" class="where g-panel">
          <strong>{{ visiting?.child ?? serverChildName }}의 미술관</strong>
          <span aria-live="polite">{{ place }}</span>
          <button v-if="!webglFailed" class="w-mode-chip" type="button" :aria-label="`지금 ${themeLabel} 모드. 모드 바꾸기`" @click="openPanel('theme')">{{ themeLabel }} 모드 · 바꾸기</button>
        </div>
        <!-- 기본 HUD(§2-17): 늘 보이는 버튼은 지금 할 일만, 나머지는 [더보기] 안 -->
        <nav class="tools" aria-label="미술관 메뉴">
          <button v-if="space==='plaza' && !visiting && !webglFailed" class="g-btn g-btn--primary" type="button" @click="enterMuseum">들어가기</button>
          <button v-if="!visiting" class="g-btn g-btn--primary" type="button" @click="beforeUpload(() => openPanel('upload'))">작품 올리기</button>
          <button v-if="!visiting" class="g-btn" type="button" @click="openPanel('play')">함께 놀기</button>
          <button class="g-btn w-more-tools" type="button" :aria-expanded="moreTools" aria-controls="w-secondary-menu" @click="moreTools=!moreTools">{{moreTools?'접기':'더보기'}}</button>
          <span id="w-secondary-menu" class="w-secondary-tools" :class="{'w-expanded':moreTools}" @click="onMenuPick">
          <button v-if="!visiting" class="g-btn" type="button" @click="openPanel('overview')">한눈에 보기</button>
          <button v-if="!visiting" class="g-btn" type="button" @click="openArchive(null)">보관함</button>
          <button v-if="space==='inside' && !visiting" class="g-btn" type="button" @click="addRoom">전시실 추가</button>
          <button v-if="!visiting" class="g-btn" type="button" :disabled="webglFailed || editing" @click="openDecor">공간 꾸미기</button>
          <button class="g-btn" type="button" :disabled="webglFailed" @click="openPanel('theme')">모드</button>
          <button v-if="!visiting" class="g-btn" type="button" :disabled="webglFailed" @click="openPanel('avatar')">캐릭터</button>
          <component :is="SocialButton" v-if="SocialButton && !visiting" action="social" @click="openPanel('social')" />
          <component :is="SocialButton" v-if="SocialButton && space!=='inside' && !visiting" action="town" @click="showTown()" />
          <button class="g-btn" type="button" :aria-pressed="!prefs?.sound" @click="toggleSound">{{ prefs?.sound ? '소리 끄기' : '소리 켜기' }}</button>
          <button v-if="!visiting" class="g-btn" type="button" @click="openSettings">설정</button>
          <button class="g-btn w-help-trigger" type="button" @click="openPanel('help')">사용법</button>
          <button class="g-btn" type="button" @click="openPanel('privacy')">개인정보·이용 안내</button>
          <button v-if="!visiting" class="g-btn" type="button" @click="openUsage">사용 기록</button>
          <button v-if="space==='inside'" class="g-btn" type="button" @click="outside">밖으로</button>
          <button v-if="SERVER_WORLD" class="g-btn w-logout" type="button" @click="emit('logout')">로그아웃</button>
          <button v-if="space==='town'" class="g-btn" type="button" @click="familyChanged">우리 미술관으로</button>
          </span>
        </nav>
      </header>

      <!-- 첫 작품 안내(§2-17): 작품이 없는 가족이 도착하면 -->
      <input v-if="!visiting && artworks.length===0" ref="firstPick" class="w-hidden" type="file" accept="image/*" multiple @change="onFirstPicked" />
      <section v-if="firstPrompt && !panel && space==='inside' && !visiting" class="w-first-work g-panel" aria-label="첫 작품">
        <strong>첫 작품을 걸어 볼까요?</strong>
        <span class="w-saved-sub">사진을 고르면 전시관에 걸고 그 앞으로 데려다줘요.</span>
        <div class="row">
          <button class="g-btn g-btn--primary" type="button" @click="pickFirst">사진 고르기</button>
          <button class="g-btn" type="button" @click="firstPrompt=false">나중에</button>
        </div>
      </section>

      <section v-if="LOCAL_SOCIAL && space==='town' && !panel" class="w-town-list g-panel"><h2>친구 미술관</h2><button v-for="b in townBuildings" :key="b.id" type="button" class="g-btn" @click="selectedBuilding=b;engine?.showTown(townBuildings,b.id);engine?.setResidents(townBuildings)">{{b.child}}</button><template v-if="selectedBuilding"><p>{{selectedBuilding.child}}의 미술관</p><button class="g-btn g-btn--primary" type="button" @click="visitSelected">들어가기</button></template></section>
      <component :is="WorldSocial" v-if="WorldSocial && panel==='social' && account" :family="account.id" :token="inviteToken" @close="closePanel" @town="showTown" />
      <section v-if="editing && !panel" class="w-decor-bar g-panel" aria-label="공간 꾸미기">
        <strong>공간을 꾸미는 중</strong>
        <div class="row" role="group" aria-label="소품 고르기">
          <button v-for="k in DECOR_KINDS" :key="k.id" class="g-btn" type="button" :aria-pressed="decorKind === k.id" @click="decorKind = k.id">{{ k.label }}</button>
        </div>
        <p v-if="!decorWork" class="w-decor-tip">작품을 누르면 그 옆에 놓을 자리를 고를 수 있어요.</p>
        <div v-else class="w-decor-spots">
          <span class="w-decor-tip">{{ (byId.get(decorWork)?.title || '새 작품') }} 옆에 놓기</span>
          <div class="row">
            <span v-for="o in decorSpots" :key="o.spot" class="w-decor-spot">
              <button class="g-btn" type="button" :disabled="!!o.reason" :aria-describedby="o.reason ? `why-${o.spot}` : undefined" @click="placeDecor(o.spot)">{{ SPOT_LABEL[o.spot] }}</button>
              <small v-if="o.reason" :id="`why-${o.spot}`">{{ o.reason }}</small>
            </span>
            <button v-if="decorDraft.some((i) => i.work === decorWork)" class="g-btn" type="button" @click="clearDecorAt(decorWork!)">이 작품 옆 소품 치우기</button>
          </div>
        </div>
        <p v-if="decorHidden" class="w-decor-tip">이 공간에 맞지 않아 보관 중인 소품 {{ decorHidden }}개</p>
        <div class="row">
          <button class="g-btn" type="button" :disabled="!decorHistory.length || decorSaving" @click="undoDecor">되돌리기</button>
          <button class="g-btn" type="button" :disabled="decorSaving" @click="cancelDecor">취소</button>
          <button class="g-btn g-btn--primary" type="button" :disabled="decorSaving" @click="finishDecor">{{ decorSaving ? '저장하는 중…' : '완료' }}</button>
        </div>
        <p v-if="decorMsg" class="g-note" role="alert">{{ decorMsg }}</p>
        <div v-if="confirmDecorLeave" class="w-decor-confirm" role="alert"><p>바꾼 배치를 버릴까요?</p><button class="g-btn g-btn--primary" type="button" @click="confirmDecorLeave = false">계속 꾸미기</button><button class="g-btn" type="button" @click="leaveDecor">버리고 나가기</button></div>
      </section>

      <section v-if="recentSaved && !panel" ref="savedCard" class="w-saved g-panel" aria-label="작품 전시 완료" role="status">
        <div class="w-saved-head">
          <img v-if="savedThumb" class="w-saved-thumb" :src="savedThumb" :alt="askStep === 'subject' && savedIds.length > 1 ? `${askIndex + 1}번째 작품 미리보기` : '걸린 작품 미리보기'" />
          <div class="w-saved-text">
            <strong>{{ savedCount > 1 ? `${savedCount}점을 전시했어요` : '전시했어요' }}</strong>
            <span class="w-saved-sub">{{ savedLine }}</span>
            <span v-if="askStatus" class="w-saved-sub w-cut-state">{{ askStatus }}</span>
          </div>
          <div v-if="!SERVER_WORLD" class="w-turn" role="group" aria-label="사진 돌리기">
            <button class="g-btn" type="button" aria-label="왼쪽으로 돌리기" :disabled="rotating || askBusy" @click="rotateSaved(-1)">{{ rotating ? '돌리는 중…' : '↺ 왼쪽' }}</button>
            <button class="g-btn" type="button" aria-label="오른쪽으로 돌리기" :disabled="rotating || askBusy" @click="rotateSaved(1)">{{ rotating ? '돌리는 중…' : '↻ 오른쪽' }}</button>
          </div>
        </div>
        <!-- §2-22 4: 나이(묶음에 한 번) → 주제(작품마다) → 끝. 둘 다 건너뛸 수 있다 -->
        <div v-if="askStep === 'age'" class="w-ask" role="group" aria-label="몇 살 때 작품인가요">
          <p class="w-ask-q">몇 살 때 작품인가요?</p>
          <div class="w-ask-opts"><button v-for="n in MAX_AGE" :key="n" class="w-chip" type="button" :disabled="askBusy || rotating" @click="pickAge(n)">{{ n }}세</button></div>
        </div>
        <div v-else-if="askStep === 'subject'" class="w-ask" role="group" aria-label="무엇을 그렸나요">
          <p class="w-ask-q">무엇을 그렸나요?<small v-if="savedIds.length > 1"> {{ savedIds.length }}점 중 {{ askIndex + 1 }}번째</small></p>
          <div class="w-ask-opts w-ask-subjects"><button v-for="t in PICK_SUBJECTS" :key="t.id" class="w-chip" type="button" :disabled="askBusy || rotating" @click="pickSubject(t.id)"><span aria-hidden="true">{{ t.icon }}</span> {{ t.label }}</button></div>
        </div>
        <p v-if="askMsg" class="g-note" role="alert">{{ askMsg }}</p>
        <div class="row w-saved-actions">
          <button v-if="askStep !== 'done'" class="g-btn" type="button" :disabled="askBusy" @click="askStep === 'age' ? skipAge() : nextSubject()">건너뛰기</button>
          <template v-else>
            <button class="g-btn g-btn--primary" type="button" :disabled="webglFailed" @click="playSaved">움직여 보기</button>
            <button class="g-btn" type="button" @click="byId.get(recentSaved!) && openView(byId.get(recentSaved!)!)">{{ SERVER_WORLD ? '가까이 보기' : '이 작품 이야기' }}</button>
            <button class="g-btn" type="button" @click="recentSaved=null;openPanel('upload')">다른 작품 올리기</button>
          </template>
          <button class="g-btn" type="button" @click="recentSaved=null">계속 둘러보기</button>
        </div>
      </section>
      <!-- 가까운(또는 누른) 작품 명패 -->
      <!-- 결과 카드가 떠 있거나 곧 뜰 때는 명패를 열지 않는다(카드 하나만, §2-17) -->
      <section v-if="shownPlaque && shownWork && !plaqueFolded && !panel && !editing && !recentSaved && !pendingReveal" class="plaque g-panel" aria-live="polite">
        <p class="w-no">{{ shownPlaque.plaque.number }}</p>
        <h2>{{ shownPlaque.plaque.title }}</h2>
        <p class="by">{{ shownPlaque.plaque.byline }}<template v-if="shownPlaque.plaque.detail"> · {{ shownPlaque.plaque.detail }}</template><template v-if="shownWork?.sample"> · 체험용 작품</template></p>
        <p v-if="!visiting && CUT_LINE[shownWork.cutoutState ?? '']" class="w-cut-state">{{ CUT_LINE[shownWork.cutoutState ?? ''] }}</p>
        <p v-for="(l, i) in shownPlaque.note.lines" :key="i" class="cnote">{{ l }}</p>
        <blockquote v-if="shownPlaque.note.quote" class="w-quote">“{{ shownPlaque.note.quote }}”<small>아이가 한 말</small></blockquote>
        <div class="row">
          <!-- 작품 앞 키 안내(§2-11)는 따로 띄우지 않고 이 버튼에 E 키캡을 붙인다 -->
          <button class="g-btn g-btn--primary" type="button" @click="openView(shownWork)"><kbd v-if="!coarse && nearId===shownWork.id" class="w-key">E</kbd>가까이 보기</button>
          <button class="g-btn" type="button" :disabled="webglFailed" @click="playShown">움직이기</button>
          <button class="g-btn" type="button" @click="listen">들려주기</button>
          <button v-if="!visiting && featuredId!==shownWork.id" class="g-btn" type="button" @click="setFeatured(shownWork.id)">대표작으로 걸기</button>
          <span v-else-if="!visiting" class="w-featured-mark">미술관 건물 정면에 걸린 대표작이에요</span>
          <button v-if="!visiting" class="g-btn" type="button" @click="openArchive(shownWork.id)">보관함에서 보기</button>
        </div>
      </section>

      <div v-if="panel === 'view' && viewWork" class="sheet w-view" role="dialog" aria-modal="true" :aria-label="`${viewWork.title || '작품'} 가까이 보기`">
        <div class="g-panel sheet-card w-view-card">
          <figure class="w-view-figure">
            <img :src="viewUrl" :alt="viewWork.title || '아이 작품 사진'" />
            <figcaption>{{ visiting ? `${visiting.child}의 작품` : SERVER_WORLD ? '화면에 맞춰 줄인 사진이에요. 올린 사진은 보관함에 있어요' : '화면에 맞춰 줄인 사진이에요. 원본 파일은 보관함에 그대로 있어요' }}</figcaption>
          </figure>
          <div class="w-view-side">
            <h2>{{ (visiting ? viewWork.title : plaqueOf({ ...viewWork, child: serverChildName }).title) || '새 작품' }}</h2>
            <template v-if="!visiting">
              <p class="by">{{ plaqueOf({ ...viewWork, child: serverChildName }).byline }}</p>
              <label v-if="!SERVER_WORLD || storyDraft" class="w-field w-story">아이가 한 말, 그때 이야기
                <textarea v-model="storyDraft" class="w-input" maxlength="200" rows="4" :readonly="SERVER_WORLD" :placeholder="SERVER_WORLD ? '' : '아이에게 이 그림 이야기를 들려 달라고 해 보세요'" />
              </label>
              <p v-if="storyMsg" class="g-note" aria-live="polite">{{ storyMsg }}</p>
              <fieldset class="w-share">
                <legend>가족에게 자랑하기</legend>
                <label><input v-model="cardPick.child" type="checkbox" /> 아이 이름 넣기</label>
                <label v-if="viewWork.age > 0"><input v-model="cardPick.age" type="checkbox" /> 나이 넣기</label>
                <div class="row">
                  <button class="g-btn" type="button" :disabled="cardBusy" @click="shareWork">{{ cardBusy ? '만드는 중…' : '이 작품 자랑하기' }}</button>
                  <button v-if="resend?.kind === 'card'" class="g-btn g-btn--primary" type="button" @click="sendAgain">파일 보내기</button>
                </div>
                <p v-if="cardMsg" class="g-note" aria-live="polite">{{ cardMsg }}</p>
              </fieldset>
            </template>
            <div class="row">
              <button v-if="!visiting && !SERVER_WORLD" class="g-btn g-btn--primary" type="button" :disabled="storyBusy || storyDraft === viewWork.words" @click="saveStory">이야기 남기기</button>
              <button class="g-btn" type="button" @click="closePanel">닫기</button>
            </div>
          </div>
        </div>
      </div>

      <section v-if="masterpiece && !panel && !visiting" class="plaque g-panel" aria-live="polite">
        <h2>{{ masterpiece.title }}</h2>
        <p class="by">{{ masterpiece.artist }} · {{ masterpiece.date }}</p>
        <p class="cnote">메트로폴리탄 미술관이 누구나 쓸 수 있게 공개한 작품 이미지예요.</p>
        <div class="row"><button class="g-btn" type="button" @click="selection = null">닫기</button></div>
      </section>

      <button v-if="interaction && (interaction.kind==='building' || !shownWork) && !panel && !recentSaved" class="w-interaction g-btn g-btn--primary" @click="engine?.interact()"><kbd v-if="!coarse">E</kbd> {{interaction.label}}</button>
      <!-- 키 조작 안내는 도착 뒤 8초만(§2-17). 다시 보려면 [더보기] > 사용법 -->
      <Transition name="w-ui-fade"><p v-if="hintOn && !coarse && !interaction && !panel && !shownWork && !masterpiece && !webglFailed && !firstPrompt && !recentSaved" class="w-hint">{{space==='plaza'?'들어가서 아이의 작품을 만나 보세요':space==='town'?'친구 건물을 누르고 들어가 보세요':'작품을 골라 가까이 보고, 움직이기로 함께 놀아요'}}<br />WASD·방향키 걷기 · I J K L 둘러보기 · R 시점 복귀 · 더보기에서 사용법</p></Transition>
      <aside v-if="coarse && helpTip && space!=='town' && !firstPrompt && !panel && !interaction && !shownWork && !recentSaved && !webglFailed" class="w-first-help g-panel" aria-label="처음 둘러보기">
        <strong>{{ space==='plaza' ? '아이의 작품을 만나러 가 볼까요?' : '작품 사이를 걸어 볼까요?' }}</strong>
        <p>왼쪽 원으로 걷고, 화면을 끌어 둘러보세요.<br />두 손가락을 벌리면 가까이 볼 수 있어요.</p>
        <div class="w-help-actions"><button class="g-btn" type="button" @click="openPanel('help')">사용법</button><button class="g-btn" type="button" @click="dismissHelpTip">닫기</button></div>
      </aside>

      <div v-if="coarse && !webglFailed && !panel && !recentSaved" class="joy" :class="{ on: !!joy }" aria-label="걷기 조이스틱" role="application" @pointerdown="joyDown" @pointermove="joyMove" @pointerup="joyUp" @pointercancel="joyUp">
        <span class="knob" :style="joy ? { transform: `translate(${joy.x * 34}px, ${joy.y * 34}px)` } : undefined" />
      </div>

      <div v-if="!panel && !webglFailed && !(coarse && recentSaved)" class="w-gestures">
        <!-- §2-20 감정 표현: 표(emotes.ts)의 동작을 펼쳐 고른다 -->
        <div v-if="emoteMenu" class="w-emotes" role="menu" aria-label="감정 표현"><button v-for="m in EMOTES" :key="m.id" class="g-btn" type="button" role="menuitem" @click="engine?.gesture(m.id);emoteMenu=false">{{ m.label }}</button></div>
        <button class="g-btn" type="button" @click="engine?.gesture('wave')">손 흔들기</button><button class="g-btn" type="button" :aria-expanded="emoteMenu" @click="emoteMenu=!emoteMenu">춤 ▾</button><button class="g-btn" type="button" @click="engine?.gesture('jump')">점프</button></div>
      <!-- 모드 -->
      <div v-if="panel === 'help'" class="sheet" role="dialog" aria-modal="true" aria-label="미술관 사용법">
        <div class="g-panel sheet-card w-help-card">
          <h2>미술관 사용법</h2>
          <p>들어가기를 눌러 작품을 만나 보세요.<br />새 작품은 작품 올리기에서 보관할 수 있어요.</p>
          <dl class="w-help-controls">
            <dt>걷기</dt><dd>{{coarse?'왼쪽 원을 밀거나 바닥을 누르세요.':'WASD·방향키로 걷고 Shift를 누르면 뛰어요. 바닥을 눌러도 걸어요.'}}</dd>
            <dt>둘러보기</dt><dd>{{coarse?'화면을 끌어 돌리고, 두 손가락을 벌리거나 모아 거리를 조절하세요.':'I J K L로 시점을 돌리고 + / −로 거리를 조절해요. 마우스로 끌거나 휠을 돌려도 돼요.'}}</dd>
            <dt>작품 보기</dt><dd>작품을 누르면 명패가 열려요. 가까이 보기로 감상하고, 움직이기를 누르면 재생돼요. 작품 앞에서 E로 가까이 볼 수도 있어요.</dd>
            <dt>시점 복귀</dt><dd>{{coarse?'아래 버튼으로 처음 시점으로 돌아갈 수 있어요.':'R을 누르면 처음 시점으로 돌아가요.'}}</dd>
          </dl>
          <div class="w-help-actions"><button class="g-btn" type="button" :disabled="webglFailed" @click="engine?.resetView();closePanel()">시점 되돌리기</button><button class="g-btn g-btn--primary" type="button" @click="closePanel">닫기</button></div>
        </div>
      </div>
      <div v-if="panel === 'theme'" class="sheet" role="dialog" aria-modal="true" aria-label="미술관 모드">
        <div class="g-panel sheet-card">
          <h2>미술관 모드</h2>
          <p class="small">전시 공간과 산책길, 하늘과 건물이 함께 바뀌어요. 작품과 이야기는 그대로예요.</p>
          <div class="themes">
            <button v-for="t in THEMES" :key="t.id" type="button" class="theme" :disabled="changingScene" :aria-pressed="prefs?.theme === t.id" @click="setTheme(t.id)">
              <span class="sw"><i v-for="c in t.swatch" :key="c" :style="{ background: c }" /></span>
              <strong>{{ t.label }}</strong>
              <small>{{ t.note }}</small>
            </button>
          </div>
          <div class="row"><button class="g-btn" type="button" @click="closePanel">닫기</button></div>
        </div>
      </div>

      <!-- 설정 -->
      <div v-if="panel === 'settings'" class="sheet" role="dialog" aria-modal="true" aria-label="설정">
        <div class="g-panel sheet-card">
          <h2>설정</h2>
          <p v-if="SERVER_WORLD" class="small">작품과 전시실·꾸미기는 가족 계정에 저장돼요. 캐릭터와 나머지 화면 설정은 이 기기에 남아요.</p>
          <template v-else>
            <h3 class="w-sub">백업</h3>
            <p class="small">작품은 이 기기에만 저장돼요. 기기를 바꾸거나 브라우저 자료를 지우기 전에 백업 파일을 받아 두세요.</p>
            <WorldStorageState :persisted="persisted" :last-backup="lastBackup" :mode="saveMode" />
            <div class="row">
              <button class="g-btn g-btn--primary" type="button" :disabled="!!backupBusy" @click="doExport">{{ backupBusy === 'export' ? '만드는 중…' : '백업 내보내기' }}</button>
              <button class="g-btn" type="button" :disabled="!!backupBusy" @click="backupInput?.click()">{{ backupBusy === 'import' ? '가져오는 중…' : '백업 가져오기' }}</button>
              <input ref="backupInput" class="w-hidden" type="file" accept=".zip,application/zip" aria-label="백업 파일 고르기" @change="doImport" />
            </div>
            <p v-if="backupMsg" ref="backupNote" class="g-note" role="status">{{ backupMsg }}</p>
            <div v-if="resend?.kind === 'backup'" class="row"><button class="g-btn g-btn--primary" type="button" @click="sendAgain">파일 보내기</button></div>
          </template>
          <hr />
          <component :is="TestFamilies" v-if="TestFamilies" @change="familyChanged" />
          <div v-if="SERVER_WORLD" class="row">
            <span>{{ serverChildName }}의 작품을 보고 있어요.</span>
            <button class="g-btn g-btn--primary" type="button" @click="emit('changeChild')">아이 바꾸기</button>
          </div>
          <template v-else>
            <label class="w-field">아이 이름<input v-model="childName" class="w-input" maxlength="20" /></label>
            <label class="w-field">지금 나이
              <select v-model.number="childAge" class="w-input"><option :value="0">모름</option><option v-for="n in MAX_AGE" :key="n" :value="n">{{ n }}세</option></select>
            </label>
            <div class="row"><button class="g-btn g-btn--primary" type="button" @click="saveChild(childName, childAge)">저장</button></div>
          </template>
          <label class="w-field"><span>미술관 모양</span><select aria-label="미술관 모양" class="w-input" :value="prefs?.building" @change="setBuilding(($event.target as HTMLSelectElement).value as MuseumStyle)"><option v-for="id in STYLES" :key="id" :value="id">{{ STYLE_NAME[id] }}</option></select></label>
          <hr />
          <div class="row">
            <button class="g-btn" type="button" @click="engine?.goLobby(); closePanel()">로비로 가기</button>
            <button v-if="!SERVER_WORLD" class="g-btn" type="button" @click="toggleSamples">{{ hasSamples ? '견본 치우기' : '견본 다시 걸기' }}</button>
          </div>
          <template v-if="!SERVER_WORLD">
            <hr />
            <template v-if="!confirmReset">
              <button class="g-btn" type="button" @click="confirmReset = true">이 기기의 자료 모두 지우기</button>
            </template>
            <template v-else>
              <p class="g-note">이 기기에 저장한 작품·캐릭터·설정이 모두 지워져요. 지우기 전에 백업을 내보내 두세요. 이미 내려받은 파일은 남아요.</p>
              <div class="row">
                <button class="g-btn g-btn--primary" type="button" @click="resetAll">모두 지우기</button>
                <button class="g-btn" type="button" @click="confirmReset = false">그만두기</button>
              </div>
            </template>
          </template>
          <div class="row end"><button class="g-btn" type="button" @click="closePanel">닫기</button></div>
        </div>
      </div>

      <WorldPlay ref="playPanel" v-if="panel==='play' && account" :artworks="artworks" :child-age="account.childAge" @close="closePanel" @saved="(id: string) => onSaved([id], true, SERVER_WORLD ? 'upload' : 'play')" />
      <WorldUpload ref="uploadPanel"
        v-if="panel === 'upload' && account"
        :initial-files="pendingFiles"
        @close="pendingFiles = [];closePanel()"
        @saved="onSaved"
      />
      <WorldArchive
        v-if="panel === 'archive' && account"
        :artworks="artworks"
        :child="serverChildName"
        :focus="archiveFocus"
        @close="closePanel"
        @delete="onDelete"
        @updated="reload"
        @goto="gotoWork"
      />
      <WorldPrivacy v-if="panel === 'privacy'" :persisted="persisted" :last-backup="lastBackup" :mode="saveMode" @close="closePanel" @backup="openSettings" />
      <WorldStorageGate v-if="panel === 'storage'" @go="gateGo" @close="closePanel" />
      <WorldUsage v-if="panel === 'usage'" :usage="usage" :last-backup="lastBackup" @close="closePanel" @clear="clearUsage" />
      <WorldOverview
        v-if="panel === 'overview' && account"
        :artworks="artworks"
        :child="serverChildName"
        @close="closePanel"
        @goto="gotoWork"
        @edit="(id: string) => openArchive(id)"
        @upload="beforeUpload(() => openPanel('upload'))"
      />
      <WorldAvatar
        v-if="panel === 'avatar' && prefs"
        :config="prefs.avatar"
        :image="prefs.avatarImage"
        :artworks="artworks"
        @preview="previewAvatar"
        @save="saveAvatar"
        @close="closePanel"
      />

      <WorldConfirm v-if="confirmOpenId && confirmDetail" :detail="confirmDetail" @close="confirmOpenId=null" @confirmed="(d) => { confirmOpenId=null; setDetail(d); artWatch.add([d.id]); }" @refreshed="(d) => { setDetail(d); artWatch.add([d.id]); if (!d.choices.length || d.confirmedKind || d.state === 'awaiting_review' || d.state === 'failed') { confirmOpenId=null; say('이미 정해진 작품이에요'); } }" />
      <p v-if="toast" class="toast" role="status">{{ toast }}</p>
    </template>
  </div>
</template>

<style scoped>
.w-first-help{position:absolute;z-index:10;left:16px;right:16px;bottom:calc(env(safe-area-inset-bottom,0px) + 160px);padding:16px;box-sizing:border-box;font-size:14px;line-height:1.5}
.w-first-help p{margin:8px 0 12px}
.w-help-actions{display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap}
.w-help-card{line-height:1.6}
.w-help-controls{display:grid;grid-template-columns:72px minmax(0,1fr);gap:16px 12px;margin:24px 0}
.w-help-controls dt{font-weight:700}.w-help-controls dd{margin:0;overflow-wrap:anywhere}
.world{transition:color .3s,background-color .3s;position:fixed;inset:0;background:#e9dfcf;color:var(--g-ink);font-family:var(--font-sans,system-ui,sans-serif);overflow:hidden}
.local-band{position:absolute;z-index:30;top:env(safe-area-inset-top,0px);left:50%;transform:translateX(-50%);margin:6px 0 0;padding:3px 12px;border-radius:999px;background:rgba(74,53,38,.78);color:#fff8ec;font-size:12px;letter-spacing:.02em;pointer-events:none;white-space:nowrap}
.stage{position:absolute;inset:0}
.entrance{position:absolute;inset:0;display:grid;place-items:center;padding:24px 16px;background:radial-gradient(circle at 50% 20%,#fffaf0,#efe2c8)}
.entrance-card{max-width:520px;width:100%;padding:32px 28px;text-align:center;display:grid;gap:14px}
.entrance-card h1{margin:0;font:600 clamp(34px,7vw,52px)/1.1 var(--g-serif);color:var(--g-plum-deep)}
.eyebrow{margin:0;font:600 15px var(--g-serif);color:var(--g-plum)}
.lead{margin:0;font-size:17px;line-height:1.55;word-break:keep-all}
.small{margin:0;font-size:13px;color:#7a6650;word-break:keep-all}
.hud-top{position:absolute;z-index:10;top:calc(env(safe-area-inset-top,0px) + 34px);left:12px;right:12px;display:flex;flex-wrap:wrap;gap:10px;align-items:flex-start;justify-content:space-between;pointer-events:none}
.hud-top>*{pointer-events:auto}
.where{display:grid;gap:2px;padding:10px 16px}
.where strong{font:600 18px var(--g-serif);color:var(--g-plum-deep)}
.where span{font-size:14px}
.w-mode-chip{justify-self:start;margin-top:4px;min-height:32px;padding:4px 10px;border-radius:999px;border:1.5px solid var(--g-gold-soft);background:rgba(255,250,240,.92);color:var(--g-plum-deep);font:inherit;font-size:13px;cursor:pointer}
.w-mode-chip:hover{border-color:var(--g-plum)}.w-mode-chip:focus-visible{outline:3px solid #f29c31;outline-offset:2px}
.tools{display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-end;max-width:min(760px,100%)}
.tools .g-btn{min-height:44px;padding:8px 16px;font-size:15px}
.plaque{position:absolute;z-index:10;left:50%;bottom:calc(env(safe-area-inset-bottom,0px) + 16px);transform:translateX(-50%);width:min(560px,calc(100% - 32px));padding:16px 20px;display:grid;gap:6px}
.plaque h2{margin:0;font:600 22px var(--g-serif);color:var(--g-plum-deep);word-break:keep-all}
.plaque .w-no{margin:0;font-size:12px;color:#8a7458;letter-spacing:.08em}
.plaque .by{margin:0;font-size:15px;color:var(--g-plum)}
.plaque .cnote{margin:0;font-size:15px;line-height:1.5;word-break:keep-all}
.w-quote{margin:4px 0 0;padding:8px 12px;border-left:4px solid var(--g-gold);background:#fffaf0;font:600 17px/1.45 var(--g-serif)}
.w-quote small{display:block;font:400 12px var(--font-sans,system-ui);color:#7a6650;margin-top:2px}
.row{display:flex;flex-wrap:wrap;gap:8px;margin-top:6px}
.row.end{justify-content:flex-end}
.w-hint{position:absolute;z-index:5;bottom:calc(env(safe-area-inset-bottom,0px) + 16px);left:50%;transform:translateX(-50%);margin:0;padding:8px 16px;border-radius:999px;background:rgba(251,244,230,.92);border:1.5px solid var(--g-gold-soft);font-size:14px;white-space:nowrap;max-width:calc(100% - 32px);overflow:hidden;text-overflow:ellipsis}
.joy{position:absolute;z-index:9;left:calc(env(safe-area-inset-left,0px) + 20px);bottom:calc(env(safe-area-inset-bottom,0px) + 24px);width:112px;height:112px;border-radius:50%;background:rgba(251,244,230,.55);border:2px solid var(--g-gold-soft);touch-action:none;display:grid;place-items:center}
.joy.on{background:rgba(251,244,230,.8)}
.knob{width:48px;height:48px;border-radius:50%;background:linear-gradient(#ad557e,#93405f);border:2px solid var(--g-gold);box-shadow:0 3px 0 var(--g-plum-deep)}
.sheet{position:absolute;inset:0;z-index:20;display:grid;place-items:end center;padding:16px;background:rgba(40,28,18,.18)}
/* 창 카드: 자식 부품 창(개인정보·저장 안내·사용 기록)에도 같은 여백을 준다. :where로 우선순위는 그대로 둔다(§2-22) */
:where(.sheet) :deep(.sheet-card){width:min(640px,100%);max-height:min(86vh,760px);overflow:auto;padding:20px 22px;display:grid;gap:12px;box-sizing:border-box}
.sheet-card h2{margin:0;font:600 22px var(--g-serif);color:var(--g-plum-deep)}
.themes{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px}.w-sub{margin:14px 0 6px;font-size:15px}
.theme{display:grid;gap:6px;text-align:left;padding:12px;border-radius:16px;border:2px solid var(--g-gold-soft);background:#fffaf0;cursor:pointer;font:inherit;color:inherit;min-height:44px}
.theme[aria-pressed="true"]{border-color:var(--g-plum);box-shadow:0 0 0 3px rgba(160,73,107,.2)}
.theme small{font-size:12px;color:#7a6650;word-break:keep-all}
.sw{display:flex;gap:4px}.sw i{width:22px;height:22px;border-radius:6px;border:1px solid rgba(0,0,0,.1)}
.w-field{display:grid;gap:6px;font-size:14px}
.w-input{min-height:44px;padding:8px 12px;border-radius:12px;border:1.5px solid var(--g-gold-soft);background:#fffdf8;font:inherit}
.w-featured-mark{align-self:center;font-size:13px;color:#7a6650}
/* 가까이 보기(§2-14): 작품이 화면의 주인공. 원본 비율 그대로, 흰 바탕 위에 */
.w-view{place-items:center;background:rgba(36,26,18,.62)}
.w-view-card{width:min(1080px,100%);max-height:min(92vh,900px);grid-template-columns:minmax(0,1.6fr) minmax(240px,1fr);align-items:start}
.w-view-figure{margin:0;display:grid;gap:6px}
.w-view-figure img{width:100%;max-height:72vh;object-fit:contain;background:#fffdf8;border-radius:8px;box-shadow:inset 0 0 0 1px rgba(0,0,0,.06)}
.w-view-figure figcaption{font-size:12px;color:#7a6650}
.w-view-side{display:grid;gap:10px}
.w-story textarea{min-height:110px;resize:vertical}
@media (max-width:700px){.w-view-card{grid-template-columns:1fr}.w-view-figure img{max-height:52vh}}
hr{border:none;border-top:1px solid var(--g-gold-soft);margin:4px 0}
.toast{position:absolute;z-index:40;left:50%;top:calc(env(safe-area-inset-top,0px) + 96px);transform:translateX(-50%);margin:0;padding:10px 18px;border-radius:999px;background:#4a3526;color:#fff8ec;font-size:15px;box-shadow:0 8px 20px -10px rgba(0,0,0,.5);max-width:calc(100% - 32px);text-align:center}
.fallback{position:absolute;inset:0;overflow:auto;padding:120px 16px 24px;display:grid;gap:12px;align-content:start}
/* §2-23 D 휴대폰(600px 이하): 위쪽은 위치 카드와 버튼을 한 줄로, 아래쪽 안내·걷기 막대·몸짓은 작게 해서 작품과 캐릭터를 가리지 않는다 */
@media (max-width:600px){
  .hud-top{flex-wrap:nowrap;gap:6px}
  .where{padding:6px 10px;gap:0;max-width:44vw}
  .where strong{font-size:13px}
  .where span{font-size:11px}
  .w-mode-chip{min-height:26px;margin-top:2px;padding:2px 8px;font-size:11px}
  .tools{flex-wrap:nowrap;gap:4px}
  .tools .g-btn{min-height:34px;padding:4px 9px;font-size:12px}
  .w-hint{display:none}
  .plaque{bottom:calc(env(safe-area-inset-bottom,0px) + 130px)}
  .w-first-work,.w-first-help{bottom:calc(env(safe-area-inset-bottom,0px) + 112px);padding:10px 12px;gap:4px;font-size:13px}
  .w-first-help p{margin:4px 0 6px}
  .w-first-work .g-btn,.w-first-help .g-btn{min-height:36px;padding:4px 12px;font-size:13px}
  .joy{width:84px;height:84px;bottom:calc(env(safe-area-inset-bottom,0px) + 16px)}
  .w-gestures .g-btn{min-height:34px;padding:4px 8px;font-size:12px}
}
.entrance{background:transparent;pointer-events:none}.w-title-card{position:absolute;left:5vw;bottom:12vh;display:grid;gap:24px;pointer-events:auto}.w-title-card h1{font:600 clamp(32px,5vw,64px) var(--g-serif);color:#fff5df;text-shadow:0 2px 18px #27352c;margin:0}.world .g-panel{background:var(--w-panel);color:var(--w-ink)}.world .g-btn{min-height:44px}.w-gestures{z-index:11;position:absolute;bottom:24px;right:24px;display:flex;gap:8px}.w-saved-thumb{display:block;max-height:96px;max-width:40%;margin:4px 0;border-radius:8px;object-fit:contain;background:#f1ebdf}.w-emotes{position:absolute;right:0;bottom:calc(100% + 8px);display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;padding:8px;border-radius:14px;background:rgba(20,18,16,.6)}.hud-top{pointer-events:none}.hud-top>*{pointer-events:auto}@media(max-width:600px){.w-title-card{left:24px;bottom:15vh}.w-gestures{bottom:18px;right:12px;gap:4px}.w-gestures .g-btn{padding:6px 10px}.tools{max-width:270px;justify-content:flex-end}}
.w-town-list{position:absolute;left:20px;bottom:120px;max-width:360px;max-height:45vh;overflow:auto;padding:18px;display:flex;gap:8px;flex-wrap:wrap}.w-town-list h2,.w-town-list p{width:100%;margin:0}
/* 결과 카드 최대 높이(§2-22 검토 5): 화면 높이에서 위쪽 HUD(바닥 약 145px)+10px와 아래 110px를 뺀 값. 넘치면 카드 안에서 넘긴다 */
.w-saved{position:absolute;z-index:12;left:50%;bottom:110px;transform:translateX(-50%);width:min(600px,90%);padding:16px;display:grid;gap:10px;box-sizing:border-box;max-height:calc(100dvh - 265px - env(safe-area-inset-top,0px));overflow:auto}.w-saved-sub{font-size:14px}.w-decor-bar{position:absolute;z-index:13;left:50%;bottom:calc(env(safe-area-inset-bottom,0px) + 16px);transform:translateX(-50%);width:min(720px,94%);padding:14px 16px;display:grid;gap:8px;max-height:52vh;overflow:auto}.w-decor-tip{margin:0;font-size:14px}.w-decor-spots{display:grid;gap:6px}.w-decor-spot{display:inline-grid;gap:2px;justify-items:start}.w-decor-spot small{font-size:12px;color:#a3332e;max-width:12em}.w-decor-confirm{display:flex;flex-wrap:wrap;gap:8px;align-items:center}.w-decor-confirm p{margin:0;flex-basis:100%}@media(max-width:600px){.w-decor-bar{bottom:calc(env(safe-area-inset-bottom,0px) + 150px);max-height:46vh}}.w-hidden{display:none}.w-entry-lead{margin:0;color:#fff5df;font-size:clamp(17px,2vw,22px);text-shadow:0 1px 10px #27352c;max-width:30em;word-break:keep-all}.w-entry-actions{display:flex;flex-wrap:wrap;gap:12px}.w-entry-note{margin:0;color:#fff5df;font-size:14px;text-shadow:0 1px 8px #27352c;word-break:keep-all}
.w-interaction{position:absolute;left:50%;bottom:106px;transform:translateX(-50%);z-index:8;min-height:48px;box-shadow:0 4px 0 #603547;animation:w-prompt-in .2s ease-out}.w-interaction kbd{border:1px solid #ffffff66;border-radius:5px;padding:2px 6px;margin-right:5px}@keyframes w-prompt-in{from{opacity:0;margin-bottom:-8px}to{opacity:1;margin-bottom:0}}@media(prefers-reduced-motion:reduce){.w-interaction{animation:none}}
</style>

<style scoped>
.g-panel{transition:background-color .3s,color .3s}
@media(prefers-reduced-motion:reduce){.world,.g-panel{transition:none}}
/* 기본 HUD(§2-17): 모든 화면에서 나머지 메뉴는 [더보기] 아래 펼침 목록 */
.tools{position:relative}
.w-more-tools{display:inline-flex}.w-secondary-tools{display:none}
/* 펼친 [더보기]가 첫 작품 카드(z 12)에 가려 아래 항목을 못 누르던 문제(§2-19 점검): 펼친 동안 위쪽 막대를 카드 위로 */
.hud-top.w-menu-open{z-index:14}
.w-secondary-tools.w-expanded{position:absolute;z-index:12;right:0;top:calc(100% + 8px);display:grid;grid-template-columns:1fr;gap:6px;width:max-content;min-width:190px;max-height:min(70dvh,560px);overflow:auto;padding:10px;border-radius:16px;box-shadow:0 10px 28px rgba(0,0,0,.28);animation:w-menu-in .16s cubic-bezier(.2,.8,.2,1)}
.w-secondary-tools.w-expanded .g-btn{justify-content:flex-start;width:100%}
/* 결과 카드 질문(§2-22 4): 단추는 두 줄 높이 안에서 넘기고, 작품을 가리지 않게 카드 높이를 묶는다 */
.w-saved-head{display:flex;gap:12px;align-items:center}.w-saved-head .w-saved-thumb{flex:0 0 auto;margin:0}.w-saved-text{display:grid;gap:2px;min-width:0;flex:1}
.w-cut-state{margin:0;font-size:13px;color:#6b5a45}
.w-turn{display:flex;gap:6px;flex:0 0 auto}.w-turn .g-btn{padding:4px 10px;font-size:13px}
.w-saved-actions{gap:8px}
.w-ask{display:grid;gap:6px}.w-ask-q{margin:0;font-weight:600}.w-ask-q small{font-weight:400;margin-left:6px;color:#6b5a45}
.w-ask-opts{display:flex;flex-wrap:wrap;gap:6px;max-height:108px;overflow-y:auto;padding:2px}
.w-ask .g-btn{justify-self:start}
.w-chip{min-height:44px;padding:6px 12px;border-radius:999px;border:1.5px solid var(--g-gold-soft,#d9c49a);background:#fffaf0;font:inherit;font-size:14px;color:#3b2a1e;cursor:pointer}
.w-chip:disabled{opacity:.6}.w-chip:focus-visible{outline:2px solid #6b3b52;outline-offset:2px}
/* 백업 권유 줄: 위쪽 HUD(위치 카드·모드 단추, 바닥 약 145px) 아래. 위에 두면 폭 945px 이하에서 둘을 덮는다(§2-22 검토 6).
   높이 500px 이하(휴대폰 가로)는 아래 @media에서 오른쪽 위 단추 아래로 옮긴다(가운데에 두면 왼쪽 아래 걷기 막대를 덮는다) */
.w-nudge{position:absolute;z-index:11;left:50%;top:calc(env(safe-area-inset-top,0px) + 154px);transform:translateX(-50%);width:min(560px,calc(100% - 32px));padding:10px 14px;display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:space-between;font-size:14px;box-sizing:border-box}
@media (max-height:500px){.w-nudge{top:calc(env(safe-area-inset-top,0px) + 92px);left:auto;right:max(16px,env(safe-area-inset-right,0px));transform:none;width:min(420px,56vw)}}
.w-share{border:1px solid #e3d5bb;border-radius:12px;padding:10px 12px;margin:8px 0 0;display:grid;gap:6px}.w-share legend{font-size:14px;font-weight:600;padding:0 4px}.w-share label{display:flex;gap:8px;align-items:center;font-size:14px;min-height:44px}
/* 휴대폰 결과 카드(§2-22 4): 작품이 보이게 낮게, 고르는 단추는 한 줄로 넘긴다. 위의 기본 규칙 뒤에 둬야 이긴다.
   휴대폰 가로·낮은 넓은 화면(높이 500px 이하)도 같은 규칙을 쓴다(검토 5: 카드가 화면 위로 넘쳐 돌리기를 누를 수 없었다).
   폭 899px 이하이면서 높이 800px 이하인 창도 같다(가운데 큰 카드가 작품의 44~70%를 가렸다). 낮은 카드가 떠 있는 동안 몸짓 단추는 숨긴다 */
@media (max-width:600px), (max-height:500px), (max-width:899px) and (max-height:800px){
 .w-saved ~ .w-gestures{display:none}
 .w-saved{bottom:calc(env(safe-area-inset-bottom,0px) + 12px);width:calc(100% - 24px);padding:10px 12px;gap:8px;max-height:52dvh;overflow:auto;box-sizing:border-box}
 .w-saved-head{gap:8px}.w-saved-head .w-saved-thumb{max-height:52px;max-width:64px}
 .w-saved-text strong{font-size:15px}.w-saved .w-saved-sub{font-size:13px}
 .w-turn{flex-direction:column;gap:4px}.w-turn .g-btn{min-height:44px;padding:2px 8px;font-size:12px}
 .w-ask-opts{flex-wrap:nowrap;overflow-x:auto;max-height:none;padding-bottom:4px;scroll-snap-type:x proximity}
 .w-chip{flex:0 0 auto;scroll-snap-align:start}
}
@keyframes w-menu-in{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}
@media(max-width:600px){
 .hud-top{gap:7px}.where{padding:6px 12px}.where strong{font-size:14px}.where span{font-size:12px}
 .tools{max-width:none;width:100%;gap:6px;justify-content:flex-start}.tools .g-btn{font-size:13px;padding:6px 10px}
 .w-secondary-tools.w-expanded{left:0;right:0;width:auto;grid-template-columns:repeat(2,minmax(0,1fr));max-height:52dvh}
}

/* 3D 화면 위 메뉴: 장면을 덜 가리는 반투명 유리 막대(3D미술관_재설계 §2-11). 팀 공통 버튼과 패널 안 버튼은 그대로 둔다 */
.hud-top .where.g-panel{background:rgba(20,18,16,.6);-webkit-backdrop-filter:blur(14px) saturate(1.15);backdrop-filter:blur(14px) saturate(1.15);border:1px solid rgba(255,255,255,.22);border-radius:14px;box-shadow:0 8px 24px rgba(0,0,0,.18);color:#fff}
.hud-top .where.g-panel strong{color:#fff;font-weight:600;letter-spacing:.01em}
.hud-top .where.g-panel span{color:rgba(255,255,255,.82)}
.hud-top .tools .g-btn,.w-gestures .g-btn{background:rgba(20,18,16,.6);-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);border:1px solid rgba(255,255,255,.24);border-radius:12px;color:#fff;font-weight:600;min-height:44px;box-shadow:0 6px 18px rgba(0,0,0,.16);text-shadow:0 1px 1px rgba(0,0,0,.25)}
.hud-top .tools .g-btn:hover,.w-gestures .g-btn:hover{background:rgba(20,18,16,.72);transform:none;box-shadow:0 6px 18px rgba(0,0,0,.2)}
.hud-top .tools .g-btn:active,.w-gestures .g-btn:active{transform:scale(.97);box-shadow:none}
.hud-top .tools .g-btn.g-btn--primary{background:linear-gradient(rgba(222,186,110,.95),rgba(190,148,66,.95));border-color:rgba(255,238,196,.75);color:#22190b;text-shadow:none}
.hud-top .tools .g-btn[aria-pressed="true"]{background:rgba(255,255,255,.3);color:#fff}
.hud-top .tools .g-btn:disabled{background:rgba(20,18,16,.35);color:rgba(255,255,255,.7);opacity:.7}
.hud-top .tools .g-btn:focus-visible,.w-gestures .g-btn:focus-visible{outline:2px solid #fff;outline-offset:2px}
.w-hint{background:rgba(20,18,16,.6);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);border:1px solid rgba(255,255,255,.2);color:#fff}
.joy{background:rgba(20,18,16,.28);border:1px solid rgba(255,255,255,.4);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)}
.joy.on{background:rgba(20,18,16,.42)}
.w-secondary-tools.w-expanded{background:rgba(20,18,16,.6);-webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px)}
@media (prefers-reduced-motion:reduce){.hud-top .tools .g-btn:active,.w-gestures .g-btn:active{transform:none}}
/* 시작 화면(§2-17): 누르면 제목 묶음이 0.3초에 아래로 12px 내려가며 사라진다. 좁은 화면은 오른쪽 여백도 둔다 */
@media (max-width:600px){.w-start .w-title-card{right:24px}}
.w-start .w-title-card{transition:opacity .3s cubic-bezier(.2,.8,.2,1),transform .3s cubic-bezier(.2,.8,.2,1)}
.w-start.w-leaving .w-title-card{opacity:0;transform:translateY(12px)}
.w-entry-secondary.g-btn{background:rgba(20,18,16,.35);color:#fff5df;border:1px solid rgba(255,245,223,.6);box-shadow:none;text-shadow:0 1px 6px rgba(0,0,0,.4)}
.w-test-entry{position:absolute;right:max(16px,env(safe-area-inset-right,0px));bottom:calc(env(safe-area-inset-bottom,0px) + 16px);pointer-events:auto;transform:scale(.7);transform-origin:right bottom;opacity:.85}
.w-start-status{position:absolute;z-index:31;left:50%;bottom:calc(env(safe-area-inset-bottom,0px) + 28px);transform:translateX(-50%);margin:0;padding:8px 16px;border-radius:999px;background:rgba(20,18,16,.6);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);color:#fff;font-size:14px;white-space:nowrap}
/* 도착(§2-17): HUD 묶음이 0.08초 간격으로 0.3초 동안 나타난다 */
.w-hud-intro .hud-top .where{animation:w-hud-in .3s cubic-bezier(.2,.8,.2,1) both}
.w-hud-intro .hud-top .tools{animation:w-hud-in .3s cubic-bezier(.2,.8,.2,1) .08s both}
.w-hud-intro .w-gestures,.w-hud-intro .joy{animation:w-hud-in .3s cubic-bezier(.2,.8,.2,1) .16s both}
.w-hud-intro .w-hint,.w-hud-intro .w-first-work,.w-hud-intro .local-band{animation:w-hud-in-center .3s cubic-bezier(.2,.8,.2,1) .16s both}
@keyframes w-hud-in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
@keyframes w-hud-in-center{from{opacity:0;transform:translate(-50%,8px)}to{opacity:1;transform:translate(-50%,0)}}
.w-ui-fade-leave-active{transition:opacity .4s ease}.w-ui-fade-leave-to{opacity:0}
/* 첫 작품 안내: 결과 카드와 같은 자리, 대표작을 가리지 않게 화면 아래. 넓은 화면은 오른쪽 아래(가운데 아래의 캐릭터도 가리지 않게) */
.w-first-work{position:absolute;z-index:12;left:50%;bottom:calc(env(safe-area-inset-bottom,0px) + 96px);transform:translateX(-50%);width:min(460px,92%);padding:16px;display:grid;gap:8px}
@media (min-width:900px){
 .w-first-work,.w-saved{left:auto;right:max(24px,env(safe-area-inset-right,0px));transform:none;bottom:calc(env(safe-area-inset-bottom,0px) + 92px);width:min(400px,36vw)}
 /* 오른쪽에 붙은 카드는 왼쪽 위치 카드와 겹치지 않으므로 오른쪽 위 단추 줄(바닥 약 78px)+14px만 비운다 */
 .w-saved{max-height:calc(100dvh - 184px - env(safe-area-inset-top,0px) - env(safe-area-inset-bottom,0px))}
 .w-hud-intro .w-first-work{animation-name:w-hud-in}
}
@media (prefers-reduced-motion:reduce){
 .w-start .w-title-card{transition:opacity .15s linear}.w-start.w-leaving .w-title-card{transform:none}
 .w-hud-intro .hud-top .where,.w-hud-intro .hud-top .tools,.w-hud-intro .w-gestures,.w-hud-intro .joy,.w-hud-intro .w-hint,.w-hud-intro .w-first-work,.w-hud-intro .local-band{animation:w-hud-fade .15s linear both}
 .w-secondary-tools.w-expanded{animation:none}
}
@keyframes w-hud-fade{from{opacity:0}to{opacity:1}}
.w-key{display:inline-grid;place-items:center;min-width:24px;height:24px;margin-right:6px;border-radius:6px;background:linear-gradient(#f2d48f,#c99a45);color:#22190b;font:700 13px/1 var(--font-sans);box-shadow:0 2px 0 #8a6427}
.w-interaction.g-btn.g-btn--primary{background:rgba(20,18,16,.62);-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);border:1px solid rgba(255,236,196,.55);color:#fff;border-radius:14px;box-shadow:0 10px 28px rgba(0,0,0,.28);font-weight:600}
.w-interaction.g-btn kbd{display:inline-grid;place-items:center;min-width:26px;height:26px;margin-right:4px;border:0;border-radius:7px;background:linear-gradient(#f2d48f,#c99a45);color:#22190b;font:700 14px/1 var(--font-sans);box-shadow:0 2px 0 #8a6427}
</style>
