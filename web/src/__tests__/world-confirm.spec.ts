import { mount, flushPromises } from '@vue/test-utils';
import { afterEach, expect, it, vi } from 'vitest';
import WorldConfirm from '../app/world/WorldConfirm.vue';
import type { ArtworkDetail } from '../app/world/server';
const api = vi.hoisted(() => ({ confirmKind: vi.fn(), getArtwork: vi.fn() }));
vi.mock('../app/world/server', async (original) => ({ ...await original<typeof import('../app/world/server')>(), ...api }));
afterEach(() => vi.resetAllMocks());
it('allows a frame-only confirmation and prevents duplicate requests', async () => {
  const detail = { id: 'frame-1', choices: ['frame'], unavailableChoices: [] } as unknown as ArtworkDetail;
  let resolve!: (value: ArtworkDetail) => void;
  api.confirmKind.mockImplementation(() => new Promise((done) => { resolve = done; }));
  const w = mount(WorldConfirm, { props: { detail } });
  await w.find('.choices button').trigger('click');
  await w.find('.actions button').trigger('click');
  await w.find('.actions button').trigger('click');
  expect(api.confirmKind).toHaveBeenCalledExactlyOnceWith('frame-1', 'frame');
  const updated = { ...detail, confirmedKind: 'frame' } as ArtworkDetail;
  resolve(updated); await flushPromises();
  expect(w.emitted('confirmed')?.[0]).toEqual([updated]);
  w.unmount();
});

it('가짜 움직임은 선택과 권유에서 제외하고 허용된 선택지만 활성화한다', () => {
  const detail = { id: 'one', suggestion: 'animated', choices: ['animated', 'frame'], unavailableChoices: [{ choice: 'relief', reason: 'model_disabled' }] } as unknown as ArtworkDetail;
  const w = mount(WorldConfirm, { props: { detail } });
  expect(w.text()).not.toContain('움직이는 그림');
  expect(w.text()).toContain('원하는 방식을 골라 주세요');
  const choices = w.findAll('.choices button');
  expect(choices).toHaveLength(2);
  expect(choices.filter(b => !b.attributes('disabled') && b.attributes('disabled') !== '')).toHaveLength(1);
  expect(choices.find(b => b.text().includes('입체'))?.attributes('disabled')).toBeDefined();
  w.unmount();
});

it('열린 창에 새 상세와 선택 가능 여부를 반영한다', async () => {
  const detail = { id: 'one', choices: ['frame', 'relief'], unavailableChoices: [] } as unknown as ArtworkDetail;
  const w = mount(WorldConfirm, { props: { detail } });
  await w.findAll('.choices button').find(b => b.text().includes('입체'))!.trigger('click');
  expect(w.find('[aria-pressed="true"]').text()).toContain('입체');
  await w.setProps({ detail: { ...detail, choices: ['frame'] } });
  expect(w.find('[aria-pressed="true"]').exists()).toBe(false);
  expect(w.find('.actions button').attributes('disabled')).toBeDefined();
  w.unmount();
});

it('409면 최신 상세를 refreshed로 전달하고 선택을 비운다', async () => {
  const detail = { id: 'one', choices: ['frame'], unavailableChoices: [] } as unknown as ArtworkDetail;
  const fresh = { ...detail, confirmedKind: 'frame' } as ArtworkDetail;
  api.confirmKind.mockRejectedValue(Object.assign(new Error('conflict'), { status: 409 }));
  api.getArtwork.mockResolvedValue(fresh);
  const w = mount(WorldConfirm, { props: { detail } });
  await w.find('.choices button').trigger('click');
  await w.find('.actions button').trigger('click');
  await flushPromises();
  expect(w.emitted('refreshed')?.[0]).toEqual([fresh]);
  expect(w.find('[aria-pressed="true"]').exists()).toBe(false);
  w.unmount();
});

it('창이 제거된 뒤 도착한 확정 응답을 전달하지 않는다', async () => {
  const detail = { id: 'one', choices: ['frame'], unavailableChoices: [] } as unknown as ArtworkDetail;
  let resolve!: (value: ArtworkDetail) => void;
  api.confirmKind.mockImplementation(() => new Promise(done => { resolve = done; }));
  const w = mount(WorldConfirm, { props: { detail } });
  await w.find('.choices button').trigger('click');
  await w.find('.actions button').trigger('click');
  w.unmount(); resolve(detail); await flushPromises();
  expect(w.emitted('confirmed')).toBeUndefined();
});
