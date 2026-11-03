import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { ApiError } from '../api/client';
import Session from '../app/world/WorldSession.vue';
const s=vi.hoisted(()=>({me:vi.fn(),login:vi.fn(),logout:vi.fn(),clear:vi.fn(),authProviders:vi.fn(),query:{} as Record<string,string>,replace:vi.fn()}));
vi.mock('../app/world/server',async (original)=>({...await original<typeof import('../app/world/server')>(),...s}));
vi.mock('vue-router',()=>({useRoute:()=>({path:'/app/world',query:s.query}),useRouter:()=>({replace:s.replace})}));
vi.mock('../app/world/server/upload',()=>({SERVER_WORLD:true,clearWorldWorks:s.clear}));
vi.mock('../app/world/WorldView.vue',()=>({__esModule:true,default:{template:'<div data-private>가족 작품<button class=logout @click="$emit(\'logout\')">로그아웃</button></div>'}}));
const views:ReturnType<typeof mount>[]=[];
const open=()=>{if(!s.authProviders.getMockImplementation())s.authProviders.mockResolvedValue({kakao:false,emailSignup:true});const w=mount(Session,{global:{stubs:{RouterLink:true}}});views.push(w);return w;};
afterEach(()=>{views.forEach(w=>w.unmount());views.length=0;vi.resetAllMocks();s.query={};});
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

// #88 카카오로 시작(마스터플랜 3-3)
const loggedOut = () => s.me.mockRejectedValue(new ApiError(401, null));
const kakaoOn = () => s.authProviders.mockResolvedValue({ kakao: true, emailSignup: true });
it('카카오가 켜지면 큰 버튼만 보이고 이메일 로그인은 눌러야 펼쳐지며 가입 링크는 없다', async () => {
  loggedOut(); kakaoOn();
  const w = open();
  await flushPromises(); await flushPromises();
  expect(w.find('.kakao').text()).toBe('카카오로 시작하기');
  expect(w.find('form').exists()).toBe(false);
  expect(w.findComponent({ name: 'RouterLink' }).exists()).toBe(false);
  expect(w.text()).not.toContain('로그인 상태 다시 확인');
  await w.find('.email-toggle').trigger('click');
  expect(w.find('form').exists()).toBe(true);
});
it('카카오 키가 없으면 버튼을 숨기고 지금 이메일 화면을 그대로 둔다', async () => {
  loggedOut();
  const w = open();
  await flushPromises(); await flushPromises();
  expect(w.find('.kakao').exists()).toBe(false);
  expect(w.find('form').exists()).toBe(true);
});
it('켜짐 확인이 실패해도 이메일로 들어갈 수 있고 다시 확인을 누르면 카카오가 나타난다', async () => {
  loggedOut();
  s.authProviders.mockRejectedValueOnce(new Error('down')).mockResolvedValue({ kakao: true, emailSignup: true });
  const w = open();
  await flushPromises(); await flushPromises();
  expect(w.find('.kakao').exists()).toBe(false);
  expect(w.find('form').exists()).toBe(true);
  await w.findAll('button').find((b) => b.text() === '로그인 상태 다시 확인')!.trigger('click');
  await flushPromises(); await flushPromises();
  expect(w.find('.kakao').exists()).toBe(true);
});
it('통신 실패면 카카오가 켜져 있어도 로그인 상태 다시 확인을 준다', async () => {
  kakaoOn();
  s.me.mockRejectedValue(new ApiError(502, null));
  const w = open();
  await flushPromises(); await flushPromises();
  expect(w.text()).toContain('로그인 상태 다시 확인');
});
it.each([['cancelled', '로그인을 취소했어요'], ['failed', '카카오 로그인이 되지 않았어요']])('카카오 %s로 돌아오면 안내를 보이고 주소에서 지운다', async (kind, text) => {
  loggedOut(); kakaoOn(); s.query = { kakao: kind };
  const w = open();
  await flushPromises(); await flushPromises();
  expect(w.text()).toContain(text);
  expect(s.replace).toHaveBeenCalledWith({ path: '/app/world', query: {} });
  expect(w.find('.kakao').exists()).toBe(true);
});
it('첫 로그인이 붙인 쿼리도 주소에서 지운다', async () => {
  s.me.mockResolvedValue({ hasFamily: true }); s.query = { welcome: '1' };
  open();
  await flushPromises(); await flushPromises();
  expect(s.replace).toHaveBeenCalledWith({ path: '/app/world', query: {} });
});
it('측정용 쿼리는 그대로 두고 콜백 쿼리만 지운다', async () => {
  s.me.mockResolvedValue({ hasFamily: true }); s.query = { kakao: 'failed', measure: '1' };
  open();
  await flushPromises(); await flushPromises();
  expect(s.replace).toHaveBeenCalledWith({ path: '/app/world', query: { measure: '1' } });
});
it('다른 쿼리뿐이면 주소를 건드리지 않는다', async () => {
  s.me.mockResolvedValue({ hasFamily: true }); s.query = { measure: '1' };
  open();
  await flushPromises();
  expect(s.replace).not.toHaveBeenCalled();
});
describe('켜짐 확인이 멈출 때(#93 리뷰)', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });
  it('3초 뒤 로그인 화면이 열리고, 늦은 응답이 카카오 버튼을 보이되 입력 중인 칸을 접지 않는다', async () => {
    loggedOut();
    let late!: (v: object) => void;
    s.authProviders.mockImplementation(() => new Promise((r) => { late = r; }));
    const w = open();
    await vi.advanceTimersByTimeAsync(2_900);
    expect(w.find('form').exists()).toBe(false);
    await vi.advanceTimersByTimeAsync(200);
    expect(w.find('form').exists()).toBe(true);
    await w.find('input[type=email]').setValue('a@example.test');
    late({ kakao: true, emailSignup: true });
    await vi.advanceTimersByTimeAsync(0);
    expect(w.find('.kakao').exists()).toBe(true);
    expect(w.find('form').exists()).toBe(true);
  });
  it('켜짐 확인이 멈춘 채 로그아웃이 거절돼도 다시 시도를 보인다', async () => {
    s.me.mockResolvedValue({ hasFamily: true });
    s.authProviders.mockImplementation(() => new Promise(() => undefined));
    s.logout.mockRejectedValue(new Error('down'));
    const w = open();
    await vi.advanceTimersByTimeAsync(0);
    await w.find('.logout').trigger('click');
    await vi.advanceTimersByTimeAsync(0);
    expect(w.text()).toContain('로그아웃 다시 시도');
  });
});
it('세션이 복원되면 카카오 실패 안내를 지워 로그아웃 안내를 가리지 않는다', async () => {
  s.me.mockResolvedValue({ hasFamily: true }); s.logout.mockResolvedValue(undefined); s.query = { kakao: 'failed' };
  const w = open();
  await flushPromises(); await flushPromises();
  await w.find('.logout').trigger('click');
  await flushPromises(); await flushPromises();
  expect(w.text()).toContain('로그아웃했어요');
  expect(w.text()).not.toContain('카카오 로그인이 되지');
});
it('카카오 키도 메일도 없으면 가입 링크 대신 알린다', async () => {
  loggedOut(); s.authProviders.mockResolvedValue({ kakao: false, emailSignup: false });
  const w = open();
  await flushPromises(); await flushPromises();
  expect(w.text()).toContain('지금은 새로 가입할 수 없어요');
  expect(w.findComponent({ name: 'RouterLink' }).exists()).toBe(false);
});
