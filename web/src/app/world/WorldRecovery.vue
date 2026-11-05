<script setup lang="ts">
import { reloadWorld } from './screenRecovery';

function recover() {
  if (window.confirm('화면을 다시 열까요? 저장하지 않은 입력은 사라질 수 있고 아이를 다시 골라야 할 수 있어요. 사진을 올리는 중이었다면 다시 올리기 전에 보관함에서 접수 여부를 확인해 주세요.')) reloadWorld();
}
</script>

<template>
  <button class="world-recovery" type="button" @click="recover">화면 새로고침</button>
</template>

<style scoped>
.world-recovery{position:fixed;z-index:2147483647;top:calc(env(safe-area-inset-top, 0px) + 62px);left:12px;min-height:44px;padding:8px 12px;border:1px solid #755c44;border-radius:10px;background:#fffdf8;color:#443529;font:600 14px/1.2 sans-serif;box-shadow:0 2px 6px #0004;cursor:pointer}
/* 자르기 창은 나가는 길이 따로 있고, 이 버튼이 안내 문장을 덮는다 */
:global(body:has(.fx-scrim) .world-recovery){display:none}
.world-recovery:focus-visible{outline:3px solid #235dc1;outline-offset:2px}
</style>
