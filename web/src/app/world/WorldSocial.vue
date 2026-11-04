<script setup lang="ts">
import {computed,onMounted,ref} from 'vue';
import {SocialError,type PublicBuilding} from './social';
import {socialStore} from './server/social';
import {neighbor} from '../town/copy';
// 친구 창(마스터플랜 3-3 #137): 맨 위가 목록이다. 목록은 화면이 10초마다 받아 내려 준다.
const props=defineProps<{family:string;token?:string;friends:PublicBuilding[];fresh?:string}>();const emit=defineEmits<{close:[];town:[];visit:[id:string];changed:[added?:string]}>();
const social=socialStore(),pending=ref<Array<{id:string;expiresAt:string}>>([]),link=ref(''),message=ref(''),busy=ref(false),confirm=ref('');
const copy=neighbor;
const shown=computed(()=>[...props.friends].sort((a,b)=>Number(b.id===props.fresh)-Number(a.id===props.fresh)||Number(!!b.online)-Number(!!a.online)));
async function refresh(){pending.value=await social.invites(props.family);}
function explain(e:unknown){message.value=e instanceof SocialError?e.reason==='own_family'?copy.ownFamily:e.reason==='neighbor_full'?copy.fullAccept:copy.tokenInvalid:copy.tryLater;}
async function create(){busy.value=true;try{const i=await social.createInvite(props.family);link.value=i.link;await refresh();}catch(e){explain(e);}finally{busy.value=false;}}
async function cancel(id:string){try{await social.cancelInvite(props.family,id);link.value='';await refresh();}catch(e){explain(e);}}
async function sendLink(){try{if(navigator.share){await navigator.share({title:copy.linkLabel,url:link.value});return;}await navigator.clipboard.writeText(link.value);message.value=copy.copied;}catch(e){if((e as Error).name!=='AbortError')message.value=copy.copyManual;}}
async function accept(){busy.value=true;try{const id=await social.accept(props.family,props.token??'');history.replaceState(null,'','/app/world');message.value=id?'':'이미 친구예요';emit('changed',id);}catch(e){explain(e);}finally{busy.value=false;}}
async function unlink(id:string){try{await social.unlink(props.family,id);confirm.value='';message.value='친구 관계를 끝냈어요';emit('changed');}catch(e){explain(e);}}
onMounted(()=>{void refresh().catch(explain);});
</script>
<template>
 <div class="w-social-overlay" role="dialog" aria-modal="true" aria-label="친구">
  <section class="g-panel w-social-card">
   <header><h2>{{token?copy.acceptTitle:'친구'}}</h2><button class="g-btn" type="button" @click="emit('close')">닫기</button></header>
   <template v-if="token">
    <p>{{copy.accept2}}</p><p>{{copy.accept3}}</p>
    <button class="g-btn g-btn--primary" type="button" :disabled="busy" @click="accept">{{copy.acceptGo}}</button>
   </template>
   <template v-else>
    <p v-if="!friends.length" class="w-empty">{{copy.none}}. 초대 링크를 보내면 서로의 미술관에 놀러 갈 수 있어요.</p>
    <ul v-else aria-label="친구 목록">
     <li v-for="f in shown" :key="f.id" :class="{'w-fresh':f.id===fresh}">
      <div class="w-who">
       <strong>{{f.child}}의 미술관</strong>
       <small v-if="f.id===fresh">방금 친구가 됐어요</small>
       <small v-else-if="f.online!==undefined" :class="{'w-on':f.online}">{{f.online?'지금 접속 중':'접속 중 아님'}}</small>
      </div>
      <button class="g-btn g-btn--primary" type="button" @click="emit('visit',f.id)">들어가기</button>
      <button class="g-btn" type="button" @click="confirm=confirm===f.id?'':f.id">끊기</button>
      <div v-if="confirm===f.id" class="w-confirm"><p>{{copy.unlinkConfirm}}</p><button class="g-btn" type="button" @click="unlink(f.id)">{{copy.unlinkGo}}</button><button class="g-btn" type="button" @click="confirm=''">{{copy.cancel}}</button></div>
     </li>
    </ul>
    <button v-if="friends.length" class="g-btn" type="button" @click="emit('town')">마을에서 보기</button>
    <hr />
    <h3>친구 초대</h3>
    <button class="g-btn" :class="{'g-btn--primary':!friends.length&&!link}" type="button" :disabled="busy" @click="create">{{link?'새 링크 만들기':'초대 링크 만들기'}}</button>
    <template v-if="link">
     <label>{{copy.linkLabel}}<input class="w-link" readonly :value="link" @focus="($event.target as HTMLInputElement).select()" /></label>
     <button class="g-btn g-btn--primary" type="button" @click="sendLink">링크 보내기</button>
    </template>
    <p class="w-hint">{{copy.hint}}</p>
    <div v-for="i in pending" :key="i.id" class="w-pending"><span>{{copy.pending}} · {{copy.expires(new Date(i.expiresAt).toLocaleDateString('ko-KR'))}}</span><button class="g-btn" type="button" @click="cancel(i.id)">{{copy.cancelInvite}}</button></div>
    <p class="w-hint">{{copy.accept2}}</p>
   </template>
   <p role="status">{{message}}</p>
  </section>
 </div>
</template>
<style scoped>
.w-social-overlay{position:absolute;inset:0;z-index:25;background:#1c292a55;display:grid;place-items:center;padding:16px}
.w-social-card{width:min(520px,100%);max-height:85dvh;overflow:auto;padding:20px;display:grid;gap:12px;box-sizing:border-box}
.w-social-card header{position:sticky;top:-20px;z-index:1;display:flex;justify-content:space-between;align-items:center;margin:-20px 0 0;padding:14px 0 8px;background:inherit}
.w-social-card h2,.w-social-card h3,.w-social-card p{margin:0}.w-social-card h3{font-size:15px}.w-social-card hr{width:100%;margin:2px 0;border:0;border-top:1px solid #d9cfb5}
.w-social-card ul{list-style:none;margin:0;padding:0;display:grid;gap:8px}
.w-social-card li{display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:10px;border:1px solid #d9cfb5;border-radius:12px;background:#fffdf6}
.w-social-card li.w-fresh{border-color:#c99a45;box-shadow:0 0 0 2px #f2d48f}
.w-who{flex:1 1 130px;min-width:0;display:grid;gap:2px}.w-who strong{overflow-wrap:anywhere}.w-who small{font-size:13px;color:#6d6657}.w-who small.w-on{color:#23703f;font-weight:600}.w-who small.w-on::before{content:'';display:inline-block;width:8px;height:8px;margin-right:5px;border-radius:50%;background:#2f9e5b}
.w-confirm{flex:1 0 100%;display:flex;flex-wrap:wrap;align-items:center;gap:8px}.w-confirm p{flex:1 0 100%;font-size:14px}
.w-pending{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px;font-size:14px}
.w-hint,.w-empty{font-size:14px;line-height:1.5;word-break:keep-all}.w-hint{color:#6d6657}
.w-link{width:100%;min-height:44px;font:inherit;padding:8px;border:1px solid #b4aa8d;border-radius:8px;box-sizing:border-box}
</style>
