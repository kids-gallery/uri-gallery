import { describe, expect, it } from 'vitest';
import { httpKakao } from '../src/modules/auth/kakao.js';

describe('카카오 계정 전환', () => {
  const client = httpKakao({ restApiKey: 'key', clientSecret: 'secret', redirectUri: 'https://example.test/callback', authBase: 'https://kakao.test', apiBase: 'https://api.test' });
  it('일반 로그인은 유지하고 계정 전환은 재인증을 요청한다', () => {
    expect(new URL(client.authorizeUrl('normal')).searchParams.get('prompt')).toBeNull();
    const url = new URL(client.authorizeUrl('switch-state', true));
    expect(url.searchParams.get('prompt')).toBe('login');
    expect(url.searchParams.get('state')).toBe('switch-state');
  });
});
