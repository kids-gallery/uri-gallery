<script setup lang="ts">
// 공통 버튼(SD_02 17-20-2). 막힌 버튼 규칙은 C3과 같다(17-20-1): disabled 대신 aria-disabled로 초점을 받고,
// 이유는 이름 아래 둘째 줄·말풍선·aria-describedby가 같은 문구다. 막혔을 때 누르면 blocked만 알린다.
import { computed, useId } from 'vue';

const props = withDefaults(defineProps<{ label: string; variant?: 'primary' | 'secondary'; disabled?: boolean; reason?: string; type?: 'button' | 'submit'; block?: boolean }>(), {
  variant: 'primary', disabled: false, reason: '', type: 'button', block: false,
});
const emit = defineEmits<{ click: [ev: MouseEvent]; blocked: [] }>();
const id = useId();
const why = computed(() => (props.disabled && props.reason ? props.reason : ''));
function onClick(ev: MouseEvent) {
  if (props.disabled) { ev.preventDefault(); emit('blocked'); return; }
  emit('click', ev);
}
</script>

<template>
  <button :type="type" class="w-btn" :class="[`w-btn--${variant}`, { 'w-btn--block': block }]"
    :aria-disabled="disabled ? 'true' : undefined" :aria-describedby="why ? id : undefined" :title="why || undefined" @click="onClick">
    <span class="w-btn__label">{{ label }}</span><span v-if="why" :id="id" class="w-btn__why">{{ why }}</span>
  </button>
</template>
