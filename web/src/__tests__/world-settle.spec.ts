// #131 입장 준비: 끝나지 않는 컴파일이 입장을 막지 않는다.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { settleWithin } from '@/app/world/settle';

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe('settleWithin', () => {
  it('끝나지 않는 작업은 시간이 지나면 놓아 준다', async () => {
    let done = false;
    void settleWithin(() => new Promise(() => undefined), 8000).then(() => { done = true; });
    await vi.advanceTimersByTimeAsync(7999);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(done).toBe(true);
  });
  it('일찍 끝나면 바로 넘어간다', async () => {
    await expect(settleWithin(async () => 'x', 8000)).resolves.toBeUndefined();
  });
  it('작업이 실패해도 막지 않는다', async () => {
    await expect(settleWithin(async () => { throw new Error('x'); }, 8000)).resolves.toBeUndefined();
    await expect(settleWithin(() => { throw new Error('x'); }, 8000)).resolves.toBeUndefined();
  });
});
