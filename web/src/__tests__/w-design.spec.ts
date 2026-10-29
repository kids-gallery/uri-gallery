// 시각 체계 "C 명패"(SD_02 17-20-2) 시험: 토큰 대비 4.5:1, 컴포넌트 CSS에 토큰 밖 값 없음, 공통 컴포넌트 7종의 접근성 규칙.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { WButton, WCard, WEmpty, WError, WInput, WLoading, WTopBar } from '@/components/w';

const STYLES = path.resolve(__dirname, '../styles');
const tokensCss = fs.readFileSync(path.join(STYLES, 'w-tokens.css'), 'utf8');
const compCss = fs.readFileSync(path.join(STYLES, 'w-components.css'), 'utf8');

function block(sel: string): Record<string, string> {
  const m = tokensCss.match(new RegExp(`${sel.replace('.', '\\.')}\\s*\\{([^}]*)\\}`));
  const out: Record<string, string> = {};
  for (const [, k, v] of (m?.[1] ?? '').matchAll(/(--w-[a-z0-9-]+)\s*:\s*([^;]+);/g)) out[k!] = v!.trim();
  return out;
}
const lum = (hex: string) => {
  const c = [0, 2, 4].map((i) => parseInt(hex.slice(1 + i, 3 + i), 16) / 255).map((x) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
};
const ratio = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x! + 0.05) / (y! + 0.05); };

describe('C 명패 토큰', () => {
  const light = block(':root');
  const dark = { ...light, ...block('.w-dark') };
  const pairs: [string, string][] = [['--w-ink', '--w-panel'], ['--w-ink-2', '--w-panel'], ['--w-on-accent', '--w-accent'], ['--w-accent', '--w-panel'],
    ['--w-ink', '--w-off'], ['--w-off-ink', '--w-off'], ['--w-alert', '--w-panel']];
  it.each(pairs)('밝은 판 %s / %s 4.5:1 이상(벽 위 포함)', (fg, bg) => {
    expect(ratio(light[fg]!, light[bg]!)).toBeGreaterThanOrEqual(4.5);
    if (bg === '--w-panel' && fg !== '--w-on-accent') expect(ratio(light[fg]!, light['--w-bg']!)).toBeGreaterThanOrEqual(4.5);
  });
  it.each(pairs)('어두운 판 %s / %s 4.5:1 이상', (fg, bg) => {
    expect(ratio(dark[fg]!, dark[bg]!)).toBeGreaterThanOrEqual(4.5);
  });
  it('1차 비활성 보조 글자 #6A675F/#E6E3DC는 미달이라 쓰지 않는다', () => {
    expect(ratio('#6A675F', '#E6E3DC')).toBeLessThan(4.5);
    expect(light['--w-off-ink']).not.toBe('#6A675F');
  });
  it('파스텔 블록 토큰이 새 토큰 파일에 없다', () => expect(tokensCss).not.toMatch(/block-|pastel|lilac|mint|pink/i));
});

describe('공통 컴포넌트 CSS', () => {
  it('색·크기 숫자를 쓰지 않고 w-tokens 변수만 쓴다', () => {
    const body = compCss.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(body.match(/#[0-9a-f]{3,8}\b/gi) ?? []).toEqual([]);
    expect(body.match(/rgba?\(|hsla?\(/gi) ?? []).toEqual([]);
    expect(body.match(/\b\d+(\.\d+)?(px|rem|em)\b/g) ?? []).toEqual([]);
    for (const v of body.match(/var\((--[a-z0-9-]+)/g) ?? []) expect(v).toMatch(/^var\(--w-/);
  });
  it('새 클래스는 모두 w- 접두', () => {
    const classes = [...compCss.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/\.([a-zA-Z][\w-]*)/g)].map((m) => m[1]!);
    expect(classes.filter((c) => !c.startsWith('w-'))).toEqual([]);
  });
});

describe('공통 컴포넌트 7종', () => {
  it('WButton: 막히면 aria-disabled, 이유는 둘째 줄·말풍선·설명이 같고 "(비활성)" 글자가 없다, 누르면 blocked만', async () => {
    const w = mount(WButton, { props: { label: '올리기', disabled: true, reason: '사진을 골라 주세요' } });
    expect(w.attributes('aria-disabled')).toBe('true');
    expect(w.attributes('disabled')).toBeUndefined();
    expect(w.find('.w-btn__why').text()).toBe('사진을 골라 주세요');
    expect(w.attributes('title')).toBe('사진을 골라 주세요');
    expect(w.attributes('aria-describedby')).toBe(w.find('.w-btn__why').attributes('id'));
    expect(w.text()).not.toContain('비활성');
    await w.trigger('click');
    expect(w.emitted('blocked')).toHaveLength(1);
    expect(w.emitted('click')).toBeUndefined();
  });
  it('WButton: 활성이면 click, 이유 줄 없음', async () => {
    const w = mount(WButton, { props: { label: '들어가기', reason: '쓰이지 않음' } });
    await w.trigger('click');
    expect(w.emitted('click')).toHaveLength(1);
    expect(w.find('.w-btn__why').exists()).toBe(false);
  });
  it('WInput: 이름표와 입력이 이어지고 도움말·오류를 읽는다', async () => {
    const w = mount(WInput, { props: { label: '제목', hint: '적지 않아도 돼요', error: '20자까지 적을 수 있어요', modelValue: '' } });
    const input = w.find('input');
    expect(w.find('label').attributes('for')).toBe(input.attributes('id'));
    const desc = input.attributes('aria-describedby')!.split(' ');
    expect(desc.map((d) => w.find(`#${CSS.escape(d)}`).text())).toEqual(['적지 않아도 돼요', '20자까지 적을 수 있어요']);
    expect(input.attributes('aria-invalid')).toBe('true');
    await input.setValue('무지개');
    expect(w.emitted('update:modelValue')?.[0]).toEqual(['무지개']);
  });
  it('WCard: 명패 제목·정보, 오류 변형', () => {
    const w = mount(WCard, { props: { title: '무지개 집', meta: '2026-10-29 · 6살', alert: true } });
    expect(w.find('.w-card__title').text()).toBe('무지개 집');
    expect(w.classes()).toContain('w-card--alert');
  });
  it('WTopBar: 서비스 이름과 메뉴 자리', () => {
    const w = mount(WTopBar, { slots: { default: '<a href="/app/list">목록</a>' }, global: { stubs: { RouterLink: { template: '<a><slot /></a>' } } } });
    expect(w.find('.w-topbar__title').text()).toBe('우리 아이 미술관');
    expect(w.find('nav').attributes('aria-label')).toBe('메뉴');
  });
  it('WEmpty·WLoading·WError: 빈 화면으로 두지 않고 글자로 알린다', async () => {
    expect(mount(WEmpty, { props: { title: '아직 작품이 없어요', body: '사진을 올리면 여기에 걸려요' } }).text()).toContain('사진을 올리면');
    const l = mount(WLoading);
    expect(l.attributes('role')).toBe('status');
    expect(l.text()).toBe('불러오는 중이에요');
    const e = mount(WError, { props: { body: '잠시 뒤 다시 해 주세요' } });
    expect(e.attributes('role')).toBe('alert');
    expect(e.text()).not.toMatch(/\b(500|503|error|Error)\b/);
    await e.find('button').trigger('click');
    expect(e.emitted('retry')).toHaveLength(1);
  });
});
