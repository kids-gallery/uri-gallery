import { afterEach, expect, it, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { ApiError } from '../api/client';
import Session from '../app/world/WorldSession.vue';
const s=vi.hoisted(()=>({me:vi.fn(),login:vi.fn(),logout:vi.fn(),clear:vi.fn(),selected:{value:null}}));
vi.mock('../app/world/server',async (original)=>({...await original<typeof import('../app/world/server')>(),...s}));
vi.mock('../app/world/server/upload',()=>({SERVER_WORLD:true,clearWorldWorks:s.clear,selectedChild:s.selected}));
vi.mock('../app/world/WorldView.vue',()=>({__esModule:true,default:{template:'<div data-private>가족 작품<button class=logout @click="$emit(\'logout\')">로그아웃</button></div>'}}));
vi.mock('../app/world/WorldChildren.vue', async () => {
  const { defineComponent, onMounted } = await import('vue');
  return { default: defineComponent({
    setup(_, { emit }) {
      onMounted(() => emit('selected', { id: 'child-1', alias: '별이' }));
      return () => null;
    },
  }) };
});
const views:ReturnType<typeof mount>[]=[];
const open=()=>{const w=mount(Session,{global:{stubs:{RouterLink:true}}});views.push(w);return w;};
afterEach(()=>{views.forEach(w=>w.unmount());views.length=0;vi.resetAllMocks();});
it('새로 고침의 me 결과가 올 때까지 작품을 만들지 않고 성공한 세션을 복원한다',async()=>{let done!:(x:object)=>void;s.me.mockImplementation(()=>new Promise(r=>{done=r;}));const w=open();expect(w.find('[data-private]').exists()).toBe(false);done({hasFamily:true});await flushPromises();await flushPromises();expect(w.find('[data-private]').exists()).toBe(true);expect(s.login).not.toHaveBeenCalled();});
it('로그아웃을 누르면 응답 전에도 작품을 제거하고 성공 뒤 로그인 입력을 보인다',async()=>{s.me.mockResolvedValue({hasFamily:true});s.logout.mockResolvedValue(undefined);const w=open();await flushPromises();await flushPromises();await w.find('.logout').trigger('click');expect(w.find('[data-private]').exists()).toBe(false);expect(s.clear).toHaveBeenCalled();await flushPromises();expect(w.text()).toContain('로그아웃했어요');expect(w.find('input[type=password]').exists()).toBe(true);});
it('401 만료 알림은 가족 작품을 제거하고 로그인 안내를 보여 준다',async()=>{s.me.mockResolvedValue({hasFamily:true});const w=open();await flushPromises();await flushPromises();window.dispatchEvent(new Event('world-session-expired'));await flushPromises();expect(w.find('[data-private]').exists()).toBe(false);expect(w.text()).toContain('만료됐어요');expect(s.clear).toHaveBeenCalled();});
it('로그아웃 통신 실패를 성공으로 표시하지 않고 재시도만 제공한다',async()=>{s.me.mockResolvedValue({hasFamily:true});s.logout.mockRejectedValue(new Error('offline'));const w=open();await flushPromises();await flushPromises();await w.find('.logout').trigger('click');await flushPromises();expect(w.find('[data-private]').exists()).toBe(false);expect(w.text()).toContain('마치지 못했어요');expect(w.text()).toContain('로그아웃 다시 시도');expect(w.find('form').exists()).toBe(false);});

it('502인 채 탭에 돌아와도 같은 작품 화면을 유지하고 복구 뒤에도 지우지 않는다', async () => {
  s.me.mockResolvedValueOnce({hasFamily:true})
    .mockRejectedValueOnce(new ApiError(502, null))
    .mockResolvedValueOnce({hasFamily:true});
  const w = open();
  await flushPromises(); await flushPromises();
  const original = w.find('[data-private]').element;
  Object.defineProperty(document, 'visibilityState', { configurable:true, value:'visible' });
  document.dispatchEvent(new Event('visibilitychange'));
  await flushPromises();
  expect(w.find('[data-private]').element).toBe(original);
  expect(s.clear).not.toHaveBeenCalled();
  document.dispatchEvent(new Event('visibilitychange'));
  await flushPromises();
  expect(w.find('[data-private]').element).toBe(original);
  expect(s.clear).not.toHaveBeenCalled();
});
it('처음 방문의 실제 401 분류는 만료 대신 로그인 안내를 보인다', async () => {
  s.me.mockRejectedValue(new ApiError(401, null));
  const w = open();
  await flushPromises();
  expect(w.text()).toContain('로그인해 미술관을 열어 주세요');
  expect(w.text()).not.toContain('만료됐어요');
});
