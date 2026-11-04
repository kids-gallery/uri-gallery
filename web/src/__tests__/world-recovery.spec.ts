import { afterEach, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import WorldRecovery from '../app/world/WorldRecovery.vue';

const reload = vi.hoisted(() => vi.fn());
vi.mock('../app/world/screenRecovery', () => ({ reloadWorld: reload }));
afterEach(() => { vi.restoreAllMocks(); reload.mockClear(); });

it('저장하지 않은 입력과 업로드 접수 확인을 안내하고, 취소하면 그대로 둔다', async () => {
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
  const view = mount(WorldRecovery);
  await view.get('button').trigger('click');
  expect(confirm).toHaveBeenCalledWith(expect.stringMatching(/저장하지 않은 입력.*접수 여부/));
  expect(reload).not.toHaveBeenCalled();
  view.unmount();
});

it('보호자가 확인하면 현재 화면을 한 번 새로 연다', async () => {
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  const view = mount(WorldRecovery);
  await view.get('button').trigger('click');
  expect(reload).toHaveBeenCalledTimes(1);
  view.unmount();
});
