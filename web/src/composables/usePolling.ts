import { getCurrentScope, onScopeDispose, ref, shallowRef, type Ref, type ShallowRef } from 'vue'

/** R-12 기본 간격: 3초 → 6초 → 10초, 그 뒤로는 10초를 유지한다. */
export const TRANSITION_INTERVALS = [3000, 6000, 10000] as const
/** SD_02 S11 모델 상태 표만 2초 고정(SD_02 S11 영역별 설계 "2초 폴링, 화면이 안 보이면 멈춤"). */
export const MODEL_STATUS_INTERVALS = [2000] as const

export interface PollingOptions<T> {
  /** 받은 값이 아직 전이 중이면 true — false가 되면 폴링을 멈춘다(판정 중·처리 중·삭제 중 등). */
  shouldContinue: (value: T) => boolean
  /** 다음 호출까지 기다릴 간격들. 마지막 값을 계속 쓴다. */
  intervals?: readonly number[]
  /** start() 때 곧바로 한 번 부를지. 화면이 열 때 이미 읽었다면 false(기본). */
  immediate?: boolean
}

export interface Polling<T> {
  data: ShallowRef<T | undefined>
  error: ShallowRef<unknown>
  /** 폴링이 켜져 있는지(숨김 탭으로 잠시 멈춘 동안에도 true). */
  active: Ref<boolean>
  start: () => void
  stop: () => void
}

/**
 * 전이 중 상태만 폴링한다(R-12). 푸시는 쓰지 않는다.
 * - 간격은 3→6→10초로 늘어난다.
 * - 탭이 숨겨지면 타이머를 멈추고, 다시 보이면 곧바로 한 번 읽고 간격을 처음부터 센다 [추론 — 숨긴 동안 바뀌었을 수 있어서].
 * - 요청이 겹치지 않는다. 실패해도 멈추지 않고 다음 간격에 다시 읽는다(전역 실패 표시는 화면이 error로 한다).
 * - 컴포넌트가 사라지면 스스로 멈춘다.
 */
export function usePolling<T>(fetcher: () => Promise<T>, options: PollingOptions<T>): Polling<T> {
  const intervals = options.intervals?.length ? options.intervals : TRANSITION_INTERVALS
  const data = shallowRef<T>()
  const error = shallowRef<unknown>()
  const active = ref(false)
  let step = 0
  let timer: ReturnType<typeof setTimeout> | undefined
  let inFlight = false

  const hidden = () => typeof document !== 'undefined' && document.visibilityState === 'hidden'

  function clear() {
    if (timer !== undefined) clearTimeout(timer)
    timer = undefined
  }

  function schedule() {
    clear()
    if (!active.value || hidden()) return
    const wait = intervals[Math.min(step, intervals.length - 1)]
    step += 1
    timer = setTimeout(tick, wait)
  }

  async function tick() {
    timer = undefined
    if (!active.value || inFlight || hidden()) return
    inFlight = true
    try {
      const value = await fetcher()
      data.value = value
      error.value = undefined
      if (!options.shouldContinue(value)) {
        stop()
        return
      }
    } catch (e) {
      error.value = e
    } finally {
      inFlight = false
    }
    schedule()
  }

  function onVisibility() {
    if (!active.value) return
    if (hidden()) {
      clear()
    } else {
      step = 0
      void tick()
    }
  }

  function start() {
    if (active.value) return
    active.value = true
    step = 0
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisibility)
    if (options.immediate) void tick()
    else schedule()
  }

  function stop() {
    active.value = false
    clear()
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisibility)
  }

  if (getCurrentScope()) onScopeDispose(stop)

  return { data, error, active, start, stop }
}
