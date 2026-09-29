<script setup lang="ts">
// C3 이유 달린 비활성 버튼(T038, SD_02 §3-3). disabled 대신 aria-disabled로 포커스를 받고,
// 라벨 뒤 "(비활성) - 사유"와 hover·포커스 말풍선(title)이 같은 문구다. 비활성일 때 누르면 blocked를 알린다.
import { computed, useId } from 'vue';
import { ko } from '@/copy/ko';

const props = withDefaults(defineProps<{ label: string; disabled?: boolean; reason?: string; variant?: 'primary' | 'secondary' }>(), {
  disabled: false, reason: '', variant: 'primary',
});
const emit = defineEmits<{ click: [ev: MouseEvent]; blocked: [] }>();
const id = useId();
const why = computed(() => (props.disabled && props.reason ? `${ko.block.disabled} - ${props.reason}` : ''));
function onClick(ev: MouseEvent) {
  if (props.disabled) { ev.preventDefault(); emit('blocked'); return; }
  emit('click', ev);
}
</script>

<template>
  <button
    type="button"
    class="btn"
    :class="`btn-${variant}`"
    :aria-disabled="disabled ? 'true' : undefined"
    :aria-describedby="why ? id : undefined"
    :title="why || undefined"
    @click="onClick"
  >
    {{ label }}<span v-if="why" :id="id" class="why">{{ why }}</span>
  </button>
</template>
