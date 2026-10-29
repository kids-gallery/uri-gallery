<script setup lang="ts">
// 입력 한 묶음(SD_02 17-20-2): 이름표와 입력을 for·id로 잇고, 도움말·오류를 aria-describedby로 읽는다. 오류면 aria-invalid.
import { computed, useId } from 'vue';

const props = withDefaults(defineProps<{ label: string; hint?: string; error?: string; type?: string; placeholder?: string; id?: string; autocomplete?: string }>(), {
  hint: '', error: '', type: 'text', placeholder: '', id: '', autocomplete: undefined,
});
const model = defineModel<string>({ default: '' });
const auto = useId();
const fid = computed(() => props.id || `w-in-${auto}`);
const described = computed(() => [props.hint && `${fid.value}-hint`, props.error && `${fid.value}-err`].filter(Boolean).join(' ') || undefined);
</script>

<template>
  <div class="w-field" :class="{ 'w-field--error': !!error }">
    <label class="w-field__label" :for="fid">{{ label }}</label>
    <input :id="fid" v-model="model" class="w-input" :type="type" :placeholder="placeholder || undefined" :autocomplete="autocomplete"
      :aria-invalid="error ? 'true' : undefined" :aria-describedby="described" />
    <p v-if="hint" :id="`${fid}-hint`" class="w-field__hint">{{ hint }}</p>
    <p v-if="error" :id="`${fid}-err`" class="w-field__error">{{ error }}</p>
  </div>
</template>
