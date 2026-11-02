import { afterEach, expect, it, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createRouter, createMemoryHistory } from 'vue-router';
import { ApiError } from '../api/client';
import Signup from '../app/world/WorldSignup.vue';
import Verify from '../app/world/WorldVerify.vue';
const calls=vi.hoisted(()=>({signup:vi.fn(),verifyEmail:vi.fn(),resendVerify:vi.fn(),me:vi.fn()}));
vi.mock('../app/world/server',async(original)=>({...await original<typeof import('../app/world/server')>(),...calls}));
afterEach(()=>vi.resetAllMocks());
it('비밀번호가 다르면 전송하지 않고 입력을 보존한다',async()=>{const w=mount(Signup,{global:{stubs:{RouterLink:true}}});const fields=w.findAll('input');await fields[0]!.setValue('test@example.com');await fields[1]!.setValue('abcdefgh');await fields[2]!.setValue('different');await w.find('form').trigger('submit');expect(calls.signup).not.toHaveBeenCalled();expect(w.text()).toContain('서로 달라요');w.unmount();});
it('가입 응답 뒤에만 메일 안내를 보이고 재발송은 이메일만 보낸다',async()=>{calls.signup.mockResolvedValue(undefined);calls.resendVerify.mockResolvedValue(undefined);const w=mount(Signup,{global:{stubs:{RouterLink:true}}});for(const [i,value] of ['test@example.com','abcdefgh','abcdefgh'].entries())await w.findAll('input')[i]!.setValue(value);await w.find('form').trigger('submit');await flushPromises();expect(calls.signup).toHaveBeenCalledWith({email:'test@example.com',password:'abcdefgh',passwordConfirm:'abcdefgh'});expect(w.findAll('input')).toHaveLength(0);await w.find('button').trigger('click');await flushPromises();expect(calls.resendVerify).toHaveBeenCalledWith('test@example.com');w.unmount();});
it('확인 경로는 토큰을 호출에 보존하고 주소에서 제거하며 실패시 재발송을 제공한다',async()=>{calls.verifyEmail.mockRejectedValue(new ApiError(400, {type:'x',title:'invalid',status:400,gate:'G27',reason:'token_invalid',code:'token_invalid'}));const router=createRouter({history:createMemoryHistory(),routes:[{path:'/app/verify',component:Verify}]});await router.push('/app/verify?token=sample-unit-token');await router.isReady();const w=mount(Verify,{global:{plugins:[router]}});await flushPromises();expect(calls.verifyEmail).toHaveBeenCalledWith('sample-unit-token');expect(router.currentRoute.value.query.token).toBeUndefined();expect(w.text()).toContain('링크를 쓸 수 없어요');expect(w.text()).not.toContain('sample-unit-token');expect(w.find('form').exists()).toBe(true);w.unmount();});

async function openVerify(token = '') {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{path:'/app/verify',component:Verify}, {path:'/app/world',component:{template:'<div>미술관</div>'}}],
  });
  await router.push(token ? '/app/verify?token='+token : '/app/verify');
  await router.isReady();
  const w = mount(Verify,{global:{plugins:[router]}});
  await flushPromises();
  return {w,router};
}
it('확인 성공은 다시 로그인하라는 안내 없이 미술관 입장을 안내한다', async () => {
  calls.verifyEmail.mockResolvedValue(undefined);
  const {w,router} = await openVerify('unit-only');
  expect(w.text()).toContain('미술관으로 들어가기');
  expect(w.text()).not.toContain('로그인하러');
  expect(router.currentRoute.value.query.token).toBeUndefined();
  expect(w.find('form').exists()).toBe(false);
  w.unmount();
});
it('성공 뒤 토큰 없는 새로 고침은 실제 세션을 확인하고 미술관으로 보낸다', async () => {
  calls.me.mockResolvedValue({hasFamily:true});
  const {w,router} = await openVerify();
  expect(calls.me).toHaveBeenCalledOnce();
  expect(calls.verifyEmail).not.toHaveBeenCalled();
  expect(router.currentRoute.value.path).toBe('/app/world');
  w.unmount();
});
it('확인 요청의 502는 다시 시도로 같은 메모리 토큰을 보내 복구한다', async () => {
  calls.verifyEmail.mockRejectedValueOnce(new ApiError(502,null)).mockResolvedValueOnce(undefined);
  const {w} = await openVerify('unit-only');
  expect(w.text()).toContain('미술관에 연결되지 않아요');
  const retry = w.findAll('button').find(b=>b.text()==='다시 시도')!;
  await retry.trigger('click'); await flushPromises();
  expect(calls.verifyEmail.mock.calls).toEqual([['unit-only'],['unit-only']]);
  expect(w.text()).toContain('이메일을 확인했어요');
  w.unmount();
});
it('토큰 없는 화면의 통신 장애는 잘못된 링크로 단정하지 않고 다시 확인한다', async () => {
  calls.me.mockRejectedValueOnce(new ApiError(502,null)).mockResolvedValueOnce({hasFamily:true});
  const {w,router} = await openVerify();
  expect(w.text()).not.toContain('링크가 없거나');
  await w.findAll('button').find(b=>b.text()==='다시 시도')!.trigger('click');
  await flushPromises();
  expect(router.currentRoute.value.path).toBe('/app/world');
  w.unmount();
});
it('토큰도 세션도 없으면 확인 메일을 다시 받을 수 있다', async () => {
  calls.me.mockRejectedValue(new ApiError(401,null));
  const {w} = await openVerify();
  expect(w.text()).toContain('확인 링크가 없거나');
  expect(w.find('form').exists()).toBe(true);
  w.unmount();
});
