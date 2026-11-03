import { mount } from '@vue/test-utils';
import { expect, it } from 'vitest';
import WorldDecision from '../app/world/WorldDecision.vue';
import type { ArtworkDetail } from '../app/world/server';
it('shows frame in a failed decision and requires another action before retake', async () => {
  const detail = { id: 'one', state: 'failed', choices: ['frame', 'retake'], unavailableChoices: [], originalUrl: null } as unknown as ArtworkDetail;
  const w = mount(WorldDecision, { props: { detail, busy: false, error: null } });
  const frame = w.findAll('.choices button').find(b => b.text().includes('액자'))!;
  expect(frame.exists()).toBe(true);
  await frame.trigger('click');
  expect(w.emitted('decide')?.[0]).toEqual(['frame']);
  const retake = w.findAll('.choices button').find(b => b.text().includes('다시 찍'))!;
  await retake.trigger('click');
  expect(w.emitted('decide')).toHaveLength(1);
  await w.findAll('.ask button')[1]!.trigger('click');
  expect(w.emitted('decide')?.[1]).toEqual(['retake']);
  w.unmount();
});
