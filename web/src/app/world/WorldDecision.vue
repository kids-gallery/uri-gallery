<script setup lang="ts">
import { computed, ref, onMounted } from 'vue';
import { failureReason, type ArtworkDetail, type Decision, type Failure } from './server';
import { DECISION_ORDER, resultImage } from '../artwork';
import { ko } from '@/copy/ko';
const props=defineProps<{detail:ArtworkDetail;busy:boolean;error:Failure|null}>();
const emit=defineEmits<{close:[];decide:[choice:Decision]}>();
const asking=ref(false);
const root=ref<HTMLElement|null>(null);
onMounted(()=>root.value?.querySelector<HTMLElement>('button:not(:disabled)')?.focus());
const image=computed(()=>resultImage(props.detail));
const choices=computed(()=>{const off=new Map((props.detail.unavailableChoices??[]).map(x=>[x.choice,x.reason]));return DECISION_ORDER.filter(x=>props.detail.choices.includes(x)||off.has(x)).map(code=>({code,available:props.detail.choices.includes(code),reason:off.get(code)}));});
function choose(c:Decision){if(c==='retake'){asking.value=true;return;} emit('decide',c);}
</script>
<template>
<section ref="root" class="shade" role="dialog" aria-modal="true" aria-labelledby="decision-title">
 <div class="card">
  <h2 id="decision-title">{{ detail.state==='failed' ? '작품을 처리하지 못했어요' : '결과를 확인해 주세요' }}</h2>
  <div class="preview">
    <figure v-if="detail.originalUrl"><img :src="detail.originalUrl" alt="올린 사진"><figcaption>올린 사진</figcaption></figure>
    <figure v-if="image.video"><video :src="image.video" :poster="image.still || undefined" controls aria-label="만들어진 움직이는 결과"/><figcaption>결과</figcaption></figure>
    <figure v-else-if="image.still && image.still!==detail.originalUrl"><img :src="image.still" alt="만들어진 결과"><figcaption>결과</figcaption></figure>
  </div>
  <p v-if="detail.downgrade">원하는 방식으로 만들기 어려워 낮춘 방식으로 준비했어요.</p>
  <div class="choices" role="group" aria-label="작품 결정">
   <button v-for="c in choices" :key="c.code" type="button" :disabled="busy||!c.available" :title="c.reason ? ko.review.unavailable[c.reason] : undefined" @click="choose(c.code)">{{ko.review.decision[c.code]}}<small v-if="!c.available">{{ko.review.unavailable[c.reason||'needs_result']}}</small></button>
  </div>
  <p v-if="error" role="alert">{{failureReason(error)}}</p>
  <div v-if="asking" class="ask" role="alertdialog" aria-modal="true" aria-label="다시 찍기 확인">
   <p>{{ko.review.retakeBody}}</p>
   <button type="button" :disabled="busy" @click="asking=false">취소</button>
   <button type="button" :disabled="busy" @click="emit('decide','retake')">다시 찍기</button>
  </div>
  <div class="actions"><button type="button" :disabled="busy" @click="emit('close')">나중에</button></div>
 </div>
</section>
</template>
<style scoped>
.shade{position:absolute;inset:0;z-index:76;display:grid;place-items:center;padding:16px;background:#0006}.card{width:min(620px,100%);max-height:90%;overflow:auto;display:grid;gap:14px;padding:22px;box-sizing:border-box;border:1px solid #c9b38f;border-radius:18px;background:#fffdf8;color:#443529}h2,p{margin:0;line-height:1.5}.preview{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.preview img,.preview video{width:100%;max-height:240px;object-fit:contain;background:#f5eddf;border-radius:10px}figure{margin:0;display:grid;gap:4px;align-content:start}figcaption{text-align:center;font-size:14px}.choices{display:grid;gap:8px}button{min-height:48px;padding:8px 12px;border:1px solid #ad557e;border-radius:10px;background:#93405f;color:white;font:inherit}button:disabled{opacity:.58}small{display:block;font-size:12px}.actions{display:flex;justify-content:flex-end}.actions button{background:#fffdf8;color:#443529}.ask{position:fixed;inset:0;z-index:2;display:grid;place-content:center;gap:12px;padding:24px;background:#0008}.ask p{max-width:24em;padding:20px;border-radius:14px;background:#fffdf8}
</style>
