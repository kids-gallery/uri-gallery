/** 끝나지 않을 수 있는 준비 작업을 ms까지만 기다린다. 실패도 시간 초과도 호출한 쪽을 막지 않는다 */
export function settleWithin(work: () => Promise<unknown>, ms: number): Promise<void> {
  return new Promise((done) => {
    const timer = setTimeout(done, ms);
    const end = () => { clearTimeout(timer); done(); };
    try { work().then(end, end); } catch { end(); }
  });
}
