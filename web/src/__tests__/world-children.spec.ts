import { afterEach, expect, it, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import WorldChildren from '../app/world/WorldChildren.vue';
const mocks = vi.hoisted(() => ({ listChildren: vi.fn(), clearGallery: vi.fn() }));
vi.mock('../app/world/server', async (original) => ({ ...await original<typeof import('../app/world/server')>(), listChildren: mocks.listChildren }));
vi.mock('../app/world/server/gallery', () => ({ clearGallery: mocks.clearGallery }));
afterEach(() => vi.resetAllMocks());
it('automatically selects a single child on entry', async () => {
  mocks.listChildren.mockResolvedValue([{ id: 'one', alias: '별이' }]);
  const wrapper = mount(WorldChildren); await flushPromises();
  expect(wrapper.emitted('selected')?.[0]?.[0]).toEqual({ id: 'one', alias: '별이' }); wrapper.unmount();
});
it('keeps child selection open when switching a single child', async () => {
  mocks.listChildren.mockResolvedValue([{ id: 'one', alias: '별이' }]);
  const wrapper = mount(WorldChildren, { props: { changing: true } }); await flushPromises();
  expect(wrapper.emitted('selected')).toBeUndefined();
  expect(wrapper.text()).toContain('아이 더 등록하기'); wrapper.unmount();
});

it('아이를 바꾸는 중에만 닫기가 있고, 누르면 고르지 않고 돌아간다(#188)', async () => {
  mocks.listChildren.mockResolvedValue([{ id: 'one', alias: '별이' }, { id: 'two', alias: '하늘' }]);
  const changing = mount(WorldChildren, { props: { changing: true } }); await flushPromises();
  await changing.find('.children-close').trigger('click');
  expect(changing.emitted('cancel')).toHaveLength(1);
  expect(changing.emitted('selected')).toBeUndefined();
  changing.unmount();
  const first = mount(WorldChildren, { props: { changing: false } }); await flushPromises();
  expect(first.find('.children-close').exists()).toBe(false);
  first.unmount();
});
