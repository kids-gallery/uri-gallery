// 감정 표현(3D미술관_재설계 §2-20). 한 줄 = 한 동작. avatar.ts의 animateAvatar는 이 표를 적용만 한다.
// 뼈 하나의 각도 = base + amp × sin(freq × 시간 + phase). 몸 전체는 bob(위아래)·sway(좌우 기울기)·spin(한 바퀴 돌기).
// 특정 게임의 춤을 복제하지 않고 흔한 몸짓으로 새로 만든다.
import type { JointName } from './avatarMesh';

export interface EmoteChannel { bone: JointName; axis: 'x' | 'y' | 'z'; base: number; amp?: number; freq?: number; phase?: number }
export interface Emote { id: string; label: string; seconds: number; bob?: number; bobFreq?: number; sway?: number; spin?: number; channels: readonly EmoteChannel[] }

const P = Math.PI;
export const EMOTES = [
  { id: 'wave', label: '손 흔들기', seconds: 2.4, sway: 0.07, channels: [{ bone: 'armR', axis: 'z', base: 2.3 }, { bone: 'forearmR', axis: 'z', base: 0, amp: 0.45, freq: 8 }] },
  { id: 'dance', label: '신나는 춤', seconds: 2.4, bob: 0.12, bobFreq: 4, sway: 0.07, channels: [{ bone: 'spine', axis: 'z', base: 0, amp: 0.15, freq: 4 }, { bone: 'armL', axis: 'z', base: -1, amp: 0.5, freq: 5 }, { bone: 'armR', axis: 'z', base: 1, amp: 0.5, freq: 5 }] },
  { id: 'cheer', label: '만세', seconds: 2, bob: 0.1, bobFreq: 6, channels: [{ bone: 'armL', axis: 'z', base: -2.6, amp: 0.15, freq: 6 }, { bone: 'armR', axis: 'z', base: 2.6, amp: 0.15, freq: 6, phase: P }] },
  { id: 'clap', label: '박수', seconds: 2, bob: 0.02, bobFreq: 8, channels: [{ bone: 'armL', axis: 'x', base: -1.3 }, { bone: 'armR', axis: 'x', base: -1.3 }, { bone: 'armL', axis: 'z', base: 0.25, amp: 0.25, freq: 10 }, { bone: 'armR', axis: 'z', base: -0.25, amp: 0.25, freq: 10, phase: P }] }, // z는 armR +가 바깥(손 흔들기 2.3), 박수는 안쪽으로 모은다
  { id: 'spin', label: '빙글빙글', seconds: 2, bob: 0.05, bobFreq: 5, spin: 2 * P, channels: [{ bone: 'armL', axis: 'z', base: -1.4 }, { bone: 'armR', axis: 'z', base: 1.4 }] },
  { id: 'lpose', label: '엘 춤', seconds: 2.6, bob: 0.1, bobFreq: 5, sway: 0.12, channels: [{ bone: 'armR', axis: 'z', base: 2.2 }, { bone: 'forearmR', axis: 'z', base: 1.3 }, { bone: 'legL', axis: 'x', base: -0.3, amp: 0.3, freq: 5 }, { bone: 'legR', axis: 'x', base: -0.3, amp: 0.3, freq: 5, phase: P }] },
] as const satisfies readonly Emote[];

export type EmoteId = (typeof EMOTES)[number]['id'];
const BY_ID = new Map<string, Emote>(EMOTES.map((e) => [e.id, e]));
export const emoteOf = (id: string): Emote | undefined => BY_ID.get(id);
