<script setup lang="ts">
import { computed, ref } from 'vue';
import { confirmKind, failureOf, failureReason, getArtwork, type ArtworkDetail, type ConfirmKind, type Failure } from './server';
import { ko } from '@/copy/ko';

const props = defineProps<{ detail: ArtworkDetail }>();
const emit = defineEmits<{ close: []; confirmed: [detail: ArtworkDetail]; refreshed: [detail: ArtworkDetail] }>();
const detail = ref(props.detail);
const busy = ref(false);
const failure = ref<Failure | null>(null);
const selected = ref<ConfirmKind | null>(null);
const choices = computed(() => {
  const blocked = new Map((detail.value.unavailableChoices ?? []).map((entry) => [entry.choice, entry.reason]));
  return (['animated', 'relief', 'frame', 'sculpture'] as const)
    .filter((kind) => detail.value.choices.includes(kind) || blocked.has(kind))
    .map((kind) => ({ kind, reason: blocked.get(kind), available: detail.value.choices.includes(kind) }));
});
const choiceLabel = (kind: ConfirmKind) => ko.kind[kind] ?? kind;
async function submit(kind: ConfirmKind) {
  if (busy.value || !detail.value.choices.includes(kind)) return;
  busy.value = true;
  failure.value = null;
  try {
    const updated = await confirmKind(detail.value.id, kind);
    emit('confirmed', updated);
  } catch (error) {
    failure.value = failureOf(error);
    if (error instanceof Error && 'status' in error && error.status === 409) {
      try {
        detail.value = await getArtwork(detail.value.id);
        selected.value = null;
        emit('refreshed', detail.value);
      } catch (refreshError) {
        failure.value = failureOf(refreshError);
      }
    }
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <section class="shade" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
    <div class="card">
      <h2 id="confirm-title">이 결과로 할까요?</h2>
      <img v-if="detail.cutoutUrl || detail.originalUrl" :src="detail.cutoutUrl || detail.originalUrl || ''" alt="올린 작품">
      <p>{{ detail.suggestion ? ko.confirm.suggestion[detail.suggestion] || '원하는 방식을 골라 주세요' : '원하는 방식을 골라 주세요' }}</p>
      <div class="choices" role="group" aria-label="전시 방식">
        <button v-for="choice in choices" :key="choice.kind" type="button"
          :disabled="busy || !choice.available" :aria-pressed="selected === choice.kind"
          :title="choice.reason ? ko.review.unavailable[choice.reason] : undefined"
          @click="selected = choice.available ? choice.kind : selected">
          {{ choiceLabel(choice.kind) }}<small v-if="!choice.available">{{ ko.review.unavailable[choice.reason || 'model_disabled'] }}</small>
        </button>
      </div>
      <p v-if="failure" role="alert">{{ failureReason(failure) }}</p>
      <div class="actions">
        <button type="button" :disabled="busy || !selected" @click="selected && submit(selected)">{{ busy ? '확정하는 중' : '확정하기' }}</button>
        <button type="button" :disabled="busy" @click="emit('close')">나중에</button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.shade{position:absolute;inset:0;z-index:75;display:grid;place-items:center;padding:16px;background:#0006}
.card{width:min(560px,100%);max-height:90%;overflow:auto;display:grid;gap:14px;padding:22px;box-sizing:border-box;border:1px solid #c9b38f;border-radius:18px;background:#fffdf8;color:#443529}
h2,p{margin:0;line-height:1.5}
img{width:100%;max-height:220px;object-fit:contain;background:#f5eddf;border-radius:12px}
.choices{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
button{min-height:48px;padding:8px 12px;border:1px solid #ad557e;border-radius:10px;background:#93405f;color:white;font:inherit}
button:disabled{opacity:.58}
small{display:block;font-size:12px}
.actions{display:flex;justify-content:flex-end;gap:8px}
.actions button:last-child{background:#fffdf8;color:#443529}
</style>
