import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'
import { MODEL_STATUS_INTERVALS, usePolling } from './usePolling'

let visibility: DocumentVisibilityState = 'visible'
function setVisibility(v: DocumentVisibilityState) {
  visibility = v
  document.dispatchEvent(new Event('visibilitychange'))
}

beforeEach(() => {
  vi.useFakeTimers()
  visibility = 'visible'
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility })
})
afterEach(() => {
  vi.useRealTimers()
})

/** 상태 목록을 차례로 돌려주는 가짜 GET /v1/artworks/{id} */
function fakeFetch(states: string[]) {
  let i = 0
  return vi.fn(async () => ({ status: states[Math.min(i++, states.length - 1)] }))
}
const inTransition = (a: { status: string }) => ['판정 중', '처리 중', '삭제 중'].includes(a.status)

describe('usePolling(T037, R-12)', () => {
  it('3초 → 6초 → 10초 → 10초 간격으로 부른다', async () => {
    const fetch = fakeFetch(['처리 중'])
    const p = usePolling(fetch, { shouldContinue: inTransition })
    p.start()
    await vi.advanceTimersByTimeAsync(2999); expect(fetch).toHaveBeenCalledTimes(0)
    await vi.advanceTimersByTimeAsync(1); expect(fetch).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(6000); expect(fetch).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(9999); expect(fetch).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(1); expect(fetch).toHaveBeenCalledTimes(3)
    await vi.advanceTimersByTimeAsync(10000); expect(fetch).toHaveBeenCalledTimes(4)
    p.stop()
  })

  it('전이가 끝난 상태를 받으면 멈춘다', async () => {
    const fetch = fakeFetch(['처리 중', '확인 대기'])
    const p = usePolling(fetch, { shouldContinue: inTransition })
    p.start()
    await vi.advanceTimersByTimeAsync(3000 + 6000)
    expect(p.data.value).toEqual({ status: '확인 대기' })
    expect(p.active.value).toBe(false)
    await vi.advanceTimersByTimeAsync(60000)
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('탭이 숨겨지면 멈추고, 다시 보이면 곧바로 읽고 3초부터 다시 센다', async () => {
    const fetch = fakeFetch(['처리 중'])
    const p = usePolling(fetch, { shouldContinue: inTransition })
    p.start()
    await vi.advanceTimersByTimeAsync(3000); expect(fetch).toHaveBeenCalledTimes(1)
    setVisibility('hidden')
    await vi.advanceTimersByTimeAsync(60000); expect(fetch).toHaveBeenCalledTimes(1)
    setVisibility('visible')
    await vi.advanceTimersByTimeAsync(0); expect(fetch).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(3000); expect(fetch).toHaveBeenCalledTimes(3)
    p.stop()
  })

  it('실패해도 멈추지 않고 오류를 남긴 채 다음 간격에 다시 읽는다', async () => {
    const fetch = vi.fn().mockRejectedValueOnce(new Error('503')).mockResolvedValue({ status: '처리 중' })
    const p = usePolling(fetch, { shouldContinue: inTransition })
    p.start()
    await vi.advanceTimersByTimeAsync(3000)
    expect(p.error.value).toBeInstanceOf(Error)
    await vi.advanceTimersByTimeAsync(6000)
    expect(p.error.value).toBeUndefined()
    expect(p.active.value).toBe(true)
    p.stop()
  })

  it('앞 요청이 끝나기 전에는 겹쳐 부르지 않는다', async () => {
    let resolve!: (v: { status: string }) => void
    const fetch = vi.fn(() => new Promise<{ status: string }>((r) => { resolve = r }))
    const p = usePolling(fetch, { shouldContinue: inTransition, intervals: [1000] })
    p.start()
    await vi.advanceTimersByTimeAsync(5000)
    expect(fetch).toHaveBeenCalledTimes(1)
    resolve({ status: '처리 중' })
    await vi.advanceTimersByTimeAsync(1000)
    expect(fetch).toHaveBeenCalledTimes(2)
    p.stop()
  })

  it('S11 모델 상태 표는 2초 고정 간격을 쓴다', async () => {
    const fetch = fakeFetch(['loading'])
    const p = usePolling(fetch, { shouldContinue: () => true, intervals: MODEL_STATUS_INTERVALS, immediate: true })
    p.start()
    await vi.advanceTimersByTimeAsync(0); expect(fetch).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(2000); expect(fetch).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(2000); expect(fetch).toHaveBeenCalledTimes(3)
    p.stop()
  })

  it('컴포넌트 범위가 사라지면 스스로 멈춘다', async () => {
    const fetch = fakeFetch(['처리 중'])
    const scope = effectScope()
    const p = scope.run(() => usePolling(fetch, { shouldContinue: inTransition }))!
    p.start()
    scope.stop()
    await vi.advanceTimersByTimeAsync(30000)
    expect(fetch).toHaveBeenCalledTimes(0)
    expect(p.active.value).toBe(false)
  })
})
