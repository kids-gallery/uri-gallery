<script setup lang="ts">
// C1 진행 레일(T038, SD_02 §3-2). 기본 · 막힘(게이트 ID + 막힌 자리 보기) · 대기(닫아도 계속) · 전시 보류(C8 자리) · 종결(삭제 중).
// 레일 단계는 누를 수 없다. 작품 레일(상태 7단계)과 여정 레일(작품 없는 S1·S2)을 steps로 바꿔 쓴다.
import { computed } from 'vue';
import { ko } from '@/copy/ko';

export type RailVariant = 'default' | 'blocked' | 'waiting' | 'hold' | 'final';
export interface RailStep { key: string; label: string }

const ARTWORK: RailStep[] = (['received', 'judging', 'awaiting_confirm', 'processing', 'awaiting_review', 'approved', 'exhibited'] as const)
  .map((k) => ({ key: k, label: ko.state[k] }));

const props = withDefaults(defineProps<{ current: string; variant?: RailVariant; gate?: string | null; steps?: RailStep[]; blockedLabel?: string }>(), {
  variant: 'default', gate: null, steps: undefined, blockedLabel: undefined,
});
const emit = defineEmits<{ showBlock: [] }>();
const list = computed(() => props.steps ?? ARTWORK);
const label = (s: RailStep) => {
  if (s.key !== props.current) return s.label;
  if (props.variant === 'blocked' && props.blockedLabel) return props.blockedLabel;
  if (props.variant === 'waiting' && s.key === 'processing') return ko.state.processing_queued;
  return s.label;
};
</script>

<template>
  <div class="journey">
    <ol v-if="variant !== 'final'" class="rail" :aria-label="'진행'">
      <li
        v-for="s in list"
        :key="s.key"
        :class="{ 'is-now': s.key === current && variant !== 'blocked', 'is-blocked': s.key === current && variant === 'blocked' }"
        :aria-current="s.key === current ? 'step' : undefined"
      >
        {{ label(s) }}<span v-if="s.key === current && gate && (variant === 'blocked' || variant === 'hold')" class="gate">{{ gate }}</span>
      </li>
    </ol>
    <ol v-else class="rail" aria-label="진행">
      <li class="is-blocked" aria-current="step">{{ ko.state.deleting }}</li>
    </ol>
    <p v-if="variant === 'blocked'" class="t-body-sm"><a href="#" @click.prevent="emit('showBlock')">{{ ko.rail.showBlock }}</a></p>
    <p v-else-if="variant === 'waiting'" class="t-body-sm">{{ ko.rail.leaveOk }}</p>
    <slot v-else-if="variant === 'hold'" name="hold" />
  </div>
</template>
