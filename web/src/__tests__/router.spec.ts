// T004 골격 시험: 보호자 /app · 운영 /ops 가 따로 열리고, 모르는 주소는 /app 으로 간다.
import { describe, expect, it } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createRouter, createMemoryHistory } from 'vue-router';
import App from '../App.vue';
import { routes } from '../router';

async function open(path: string) {
  const router = createRouter({ history: createMemoryHistory(), routes });
  await router.push(path);
  await router.isReady();
  const w = mount(App, { global: { plugins: [router] } });
  await flushPromises();
  return { w, router };
}

describe('라우터 골격', () => {
  it('/app 은 보호자 셸', async () => {
    const { w } = await open('/app');
    expect(w.find('h1').text()).toBe('우리 아이 미술관');
  });
  it('/ops 는 운영 셸', async () => {
    const { w } = await open('/ops');
    expect(w.find('h1').text()).toBe('운영 화면');
  });
  it('모르는 주소는 /app 으로', async () => {
    const { router } = await open('/nowhere');
    expect(router.currentRoute.value.path).toBe('/app');
  });
});
