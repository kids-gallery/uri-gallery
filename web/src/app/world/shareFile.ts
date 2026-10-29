// 파일 내보내기(3D미술관_재설계 §2-22 8): 터치가 주 입력인 기기에서 파일 공유가 되면 공유 시트, 아니면 내려받기.
// 데스크톱은 내려받기가 익숙하므로 공유 시트를 쓰지 않는다. 백업 파일과 자랑하기 그림이 같은 길을 쓴다.
import { download } from './relief3d';

/** shared 보냄 · downloaded 내려받음 · cancelled 사용자가 닫음 · retry 브라우저가 "누른 직후가 아니다"로 거절(한 번 더 누르게 한다) */
export type SaveResult = 'shared' | 'downloaded' | 'cancelled' | 'retry';

export function shareable(file: File, touch: boolean): boolean {
  try { return touch && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] }); } catch { return false; }
}
/** 공유 시트를 연다. 누른 그 자리에서 불러야 한다(retry 뒤의 [파일 보내기] 단추) */
export async function shareNow(file: File, title: string): Promise<SaveResult> {
  try { await navigator.share({ files: [file], title }); return 'shared'; }
  catch (e) {
    const name = (e as { name?: string } | null)?.name;
    if (name === 'AbortError') return 'cancelled';
    if (name === 'NotAllowedError') return 'retry';
    throw e;
  }
}
export async function saveFile(blob: Blob, name: string, title: string, touch: boolean): Promise<{ result: SaveResult; file: File }> {
  const file = new File([blob], name, { type: blob.type });
  if (shareable(file, touch)) return { result: await shareNow(file, title), file };
  download(blob, name);
  return { result: 'downloaded', file };
}
