// T038·T039 시험: 차단 블록 세 줄·포커스·변형, 비활성 버튼 사유·blocked, 진행 레일 변형, 배지 문구, 헤더 역할 메뉴.
import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createRouter, createMemoryHistory } from 'vue-router';
import BlockNotice from '../components/BlockNotice.vue';
import ReasonButton from '../components/ReasonButton.vue';
import JourneyRail from '../components/JourneyRail.vue';
import StatusBadge from '../components/StatusBadge.vue';
import RoleHeader from '../components/RoleHeader.vue';
import type { BlockNotice as Notice } from '../api/client';

const notice = (o: Partial<Notice> = {}): Notice => ({ variant: 'block', gate: 'G11', summary: '저장하지 못했어요', reason: '그린 날은 오늘 이후일 수 없어요', releaser: '보호자 - 지금 이 화면', self: true, actions: ['그린 날 고치기'], fields: [], ...o });

describe('C2 BlockNotice', () => {
  it('제목·사유·해제 주체·다음 행동을 보이고 제목에 포커스', async () => {
    const w = mount(BlockNotice, { props: { notice: notice() }, attachTo: document.body });
    await new Promise((r) => setTimeout(r));
    expect(w.find('.head').text()).toContain('막힘G11');
    expect(w.find('dl').text()).toContain('그린 날은 오늘 이후일 수 없어요');
    expect(w.find('dl').text()).toContain('보호자 - 지금 이 화면');
    expect(document.activeElement).toBe(w.find('.head').element);
    await w.find('button').trigger('click');
    expect(w.emitted('action')).toEqual([['그린 날 고치기']]);
    expect(w.attributes('role')).toBe('alert');
    w.unmount();
  });
  it('보류는 점선 변형·status, 종결은 요약 없이', () => {
    expect(mount(BlockNotice, { props: { notice: notice({ variant: 'hold', gate: 'G19' }) } }).classes()).toContain('is-hold');
    const f = mount(BlockNotice, { props: { notice: notice({ variant: 'final', gate: null, actions: [] }) } });
    expect(f.find('.head').text()).toBe('되돌릴 수 없어요');
    expect(f.find('button').exists()).toBe(false);
  });
});

describe('C3 ReasonButton', () => {
  it('비활성이면 aria-disabled·사유·title이 같고, 누르면 blocked만', async () => {
    const w = mount(ReasonButton, { props: { label: '저장', disabled: true, reason: '그린 날을 고쳐 주세요' } });
    expect(w.attributes('aria-disabled')).toBe('true');
    expect(w.attributes('disabled')).toBeUndefined();
    expect(w.text()).toContain('(비활성) - 그린 날을 고쳐 주세요');
    expect(w.attributes('title')).toBe('(비활성) - 그린 날을 고쳐 주세요');
    await w.trigger('click');
    expect(w.emitted('blocked')).toHaveLength(1);
    expect(w.emitted('click')).toBeUndefined();
  });
  it('type=submit: 활성이면 폼 제출, 비활성이면 제출 막고 blocked(Enter 제출, SD_02 C3)', async () => {
    const onSubmit = vi.fn((e: Event) => e.preventDefault());
    const form = document.createElement('form');
    form.addEventListener('submit', onSubmit);
    document.body.appendChild(form);
    const off = mount(ReasonButton, { props: { label: '로그인', type: 'submit', disabled: true, reason: '비밀번호를 입력해 주세요' }, attachTo: form });
    expect(off.attributes('type')).toBe('submit');
    (off.element as HTMLButtonElement).click();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(off.emitted('blocked')).toHaveLength(1);
    await off.setProps({ disabled: false });
    (off.element as HTMLButtonElement).click();
    expect(onSubmit).toHaveBeenCalledTimes(1);
    off.unmount(); form.remove();
  });
  it('활성이면 click', async () => {
    const w = mount(ReasonButton, { props: { label: '저장' } });
    await w.trigger('click');
    expect(w.emitted('click')).toHaveLength(1);
  });
});

describe('C1 JourneyRail', () => {
  it('기본: 현재 단계만 is-now', () => {
    const w = mount(JourneyRail, { props: { current: 'awaiting_confirm' } });
    expect(w.findAll('li.is-now').map((l) => l.text())).toEqual(['확정 대기']);
    expect(w.findAll('li')).toHaveLength(7);
  });
  it('막힘: 게이트 ID와 막힌 자리 보기', async () => {
    const w = mount(JourneyRail, { props: { current: 'processing', variant: 'blocked', gate: 'G9', blockedLabel: '처리하지 못함' } });
    expect(w.find('li.is-blocked').text()).toBe('처리하지 못함G9');
    await w.find('a').trigger('click');
    expect(w.emitted('showBlock')).toHaveLength(1);
  });
  it('대기: 닫아도 계속, 종결: 삭제 중만', () => {
    expect(mount(JourneyRail, { props: { current: 'processing', variant: 'waiting' } }).text()).toContain('화면을 닫아도 계속돼요');
    const f = mount(JourneyRail, { props: { current: 'x', variant: 'final' } });
    expect(f.findAll('li').map((l) => l.text())).toEqual(['삭제 중']);
  });
});

describe('C4 StatusBadge · C9 RoleHeader', () => {
  it('배지 문구', () => {
    expect(mount(StatusBadge, { props: { state: 'not_delivered' } }).text()).toBe('처리하지 못함');
    expect(mount(StatusBadge, { props: { state: 'retry_wait', kind: 'stage' } }).text()).toBe('다시 시도 중');
  });
  it('운영 헤더: 역할 표시, 주어진 메뉴만, 보호자 앱 링크 없음', async () => {
    const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/:p(.*)*', component: { template: '<div/>' } }] });
    const w = mount(RoleHeader, { props: { shell: 'ops', account: 'jo***@su.kr', roles: ['integrator'], menu: [{ to: '/ops/status', label: '상태-지표' }] }, global: { plugins: [router] } });
    expect(w.text()).toContain('연동 개발');
    expect(w.findAll('nav a').map((a) => a.attributes('href'))).toEqual(['/ops/status']);
    expect(w.html()).not.toContain('/app');
    await w.find('button').trigger('click');
    expect(w.emitted('logout')).toHaveLength(1);
  });
});
