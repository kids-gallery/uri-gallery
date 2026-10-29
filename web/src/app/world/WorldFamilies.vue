<script setup lang="ts">
import {onMounted,ref} from 'vue';
import * as store from './store';
const emit=defineEmits<{change:[]}>();
const families=ref<store.Account[]>([]),busy=ref(false),message=ref('');
onMounted(async()=>{families.value=await store.listFamilies();});
async function add(){busy.value=true;message.value='견본을 준비하고 있어요';try{const a=await store.createTestAccount();a.child=`새 가족 ${families.value.length+1}`;await store.saveAccount(a);families.value=await store.listFamilies();emit('change');}catch{message.value='가족을 만들지 못했어요. 다시 해 주세요';}finally{busy.value=false;}}
async function choose(id:string){try{await store.selectFamily(id);emit('change');}catch{message.value='가족을 열지 못했어요';}}
</script>
<template><section class="w-families"><p>이 기기 안의 테스트 가족끼리만 친구가 돼요</p><button class="g-btn" type="button" :disabled="busy" @click="add">테스트 가족 추가</button><label>가족 바꾸기<select class="w-family-select" :disabled="busy" @change="choose(($event.target as HTMLSelectElement).value)"><option value="">가족을 골라 주세요</option><option v-for="f in families" :key="f.id" :value="f.id">{{f.child}}</option></select></label><p role="status">{{message}}</p></section></template>
<style scoped>.w-families{display:grid;gap:10px}.w-families p{font-size:14px;margin:0}.w-families label{display:grid;gap:6px}.w-family-select{min-height:44px;border:1px solid #bda881;border-radius:10px;padding:8px;font:inherit;background:#fff9ed}</style>
