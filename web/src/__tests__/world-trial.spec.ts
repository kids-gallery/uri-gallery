// #135 시연 체험 빌드에서만 견본을 고를 수 있다(마스터플랜 3-5).
import { mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';

async function load(trial: boolean) {
  vi.stubEnv('VITE_WORLD_SERVER', '1');
  vi.stubEnv('VITE_TRIAL', trial ? '1' : '');
  vi.resetModules();
  return (await import('@/app/world/WorldUpload.vue')).default;
}

afterEach(() => { vi.unstubAllEnvs(); });

describe('올리기 창의 견본', () => {
  it('체험 빌드에서는 견본 6개를 고를 수 있다', async () => {
    const w = mount(await load(true), { attachTo: document.body });
    const picks = w.findAll('.w-trial-btn');
    expect(picks).toHaveLength(6);
    expect(picks[0]?.attributes('aria-label')).toContain('견본 고르기');
    w.unmount();
  });

  it('일반 빌드에는 보이지 않는다', async () => {
    const w = mount(await load(false), { attachTo: document.body });
    expect(w.find('.w-trial').exists()).toBe(false);
    w.unmount();
  });
});
