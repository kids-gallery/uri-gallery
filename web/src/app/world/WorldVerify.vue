<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { verifyEmail, resendVerify, failureOf } from './server';
const route=useRoute(), router=useRouter();
let token=typeof route.query.token==='string'?route.query.token:'';
const busy=ref(false), verified=ref(false), notice=ref(''), email=ref(''), retry=ref(false);
async function verify(){if(busy.value)return;if(!token){notice.value='확인 링크가 없거나 올바르지 않아요. 확인 메일을 다시 받아 주세요';return;}busy.value=true;retry.value=false;try{await verifyEmail(token);verified.value=true;token='';notice.value='이메일을 확인했어요. 로그인해 미술관을 열어 주세요';}catch(e){const f=failureOf(e);retry.value=f.kind==='offline';notice.value=retry.value?'미술관에 연결되지 않아요. 잠시 뒤 다시 시도해 주세요':'확인 링크가 올바르지 않거나 유효 시간이 지났어요. 확인 메일을 다시 받아 주세요';}finally{busy.value=false;}}
async function resend(){if(busy.value)return;busy.value=true;try{await resendVerify(email.value.trim());notice.value='확인 메일을 요청했어요. 메일함을 확인해 주세요';}catch(e){const f=failureOf(e);notice.value=f.kind==='refused'?f.reason:'메일을 요청하지 못했어요. 잠시 뒤 다시 시도해 주세요';}finally{busy.value=false;}}
onMounted(async()=>{await router.replace({path:'/app/verify',query:{}});void verify();});
</script>
<template><main class="auth"><section class="card" aria-labelledby="verify-title"><h1 id="verify-title">이메일 확인</h1><p role="status">{{busy?'확인하는 중이에요':notice}}</p><button v-if="retry" type="button" :disabled="busy" @click="verify">다시 시도</button><form v-if="!verified" @submit.prevent="resend"><label>가입한 이메일<input v-model="email" type="email" autocomplete="email" required maxlength="254" :disabled="busy"></label><button :disabled="busy">확인 메일 다시 보내기</button></form><RouterLink to="/app/world">로그인하러 가기</RouterLink></section></main></template>
<style scoped>
.auth{min-height:100dvh;display:grid;place-items:center;padding:24px 16px;box-sizing:border-box;background:#fff8ec;color:#443529}.card{width:min(440px,100%);box-sizing:border-box;padding:24px;display:grid;gap:16px;border:1px solid #c9b38f;border-radius:18px;background:#fffdf8}h1{margin:0;font-size:26px}p{margin:0;line-height:1.6}form,label{display:grid;gap:8px}form{gap:16px}input{width:100%;box-sizing:border-box;min-height:44px;padding:10px;border:1px solid #bda881;border-radius:10px;font:inherit}button,a{min-height:44px}button{font:inherit;border:1px solid #ad557e;border-radius:10px;padding:10px 16px;background:#93405f;color:white;cursor:pointer}button:disabled{opacity:.6;cursor:wait}a{color:#78324f;display:inline-flex;align-items:center}ul{margin:0;padding-left:20px}.note{color:#8c302b}
</style>