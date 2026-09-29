// T035 시험: 문구 사전이 문서(docs/C_화면문구.md)의 사유 코드를 모두 덮고, 금지 표현이 없다.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ko, problemCopy, problemKeys } from '../copy/ko';

const doc = readFileSync(resolve(process.cwd(), '../docs/C_화면문구.md'), 'utf8');

describe('화면 문구(T035)', () => {
  it('문서 §3의 reason 코드가 모두 사전에 있다(리다이렉트 전용 제외)', () => {
    const sec = doc.slice(doc.indexOf('## 3.'), doc.indexOf('## 4.'));
    const reasons = new Set([...sec.matchAll(/`([a-z][a-z0-9_]+)`/g)].map((m) => m[1]!));
    for (const skip of ['login_required', 'session_revoked', 'no_family', 'not_saved', 'reason', 'code', 'gate', 'waiting_stop']) reasons.delete(skip);
    const have = new Set(problemKeys.map((k) => k.split(':')[1]));
    expect([...reasons].filter((r) => !have.has(r))).toEqual([]);
  });
  it('SD_02 문구를 쓴다(스타일가이드 문구 아님)', () => {
    expect(ko.state.retrying).toBe('다시 시도 중');
    expect(ko.state.not_delivered).toBe('처리하지 못함');
  });
  it('점수·확률·실패 표현이 없다', () => {
    const all = JSON.stringify(ko) + JSON.stringify(problemKeys.map((k) => problemCopy({ gate: k.split(':')[0], reason: k.split(':')[1] })));
    for (const bad of ['점수', '확률', '%', '실패했', '!']) expect(all).not.toContain(bad);
  });
  it('모르는 사유는 기본 문구', () => {
    expect(problemCopy({ reason: 'zzz' }).reason).toContain('잠시 뒤');
  });
});
