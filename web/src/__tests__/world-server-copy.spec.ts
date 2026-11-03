// #126 서버 판은 쓸 수 없는 기능을 약속하지 않고, 기기 판은 그대로 둔다(마스터플랜 3-3 고치기와 지우기).
import { mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EMPTY_USAGE } from '@/app/world/usage';

/** SERVER_WORLD는 불러올 때 정해지므로 값을 넣고 새로 불러온다 */
async function load(server: boolean) {
  vi.stubEnv('VITE_WORLD_SERVER', server ? '1' : '');
  vi.resetModules();
  return {
    WorldUsage: (await import('@/app/world/WorldUsage.vue')).default,
    WorldUpload: (await import('@/app/world/WorldUpload.vue')).default,
  };
}

afterEach(() => { vi.unstubAllEnvs(); });

describe.each([[true, false], [false, true]])('서버 판 %s', (server, shown) => {
  it('사용 기록의 마지막 백업', async () => {
    const { WorldUsage } = await load(server);
    const w = mount(WorldUsage, { props: { usage: EMPTY_USAGE, lastBackup: null } });
    expect(w.text().includes('마지막 백업')).toBe(shown);
    expect(w.text()).toContain('올린 작품');
    w.unmount();
  });

  it('올리기 창의 나중에 적는다는 안내', async () => {
    const { WorldUpload } = await load(server);
    const w = mount(WorldUpload, { attachTo: document.body });
    expect(w.text().includes('나중에 적어도')).toBe(shown);
    expect(w.text()).toContain('아이의 그림이나 만들기 사진을 골라 주세요');
    w.unmount();
  });
});
