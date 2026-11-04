import { describe, expect, it, vi } from 'vitest';
import { openLayout } from '../app/world/server/openLayout';

const empty = { exists: false, revision: 0, rooms: [], decor: [] };
function deps() {
  return { get: vi.fn().mockResolvedValue(empty), put: vi.fn().mockResolvedValue({ revision: 1 }),
    localRooms: vi.fn().mockResolvedValue([4, 7]), localDecor: [], hasLocalAccount: false,
    confirmImport: vi.fn().mockReturnValue(true), active: vi.fn().mockReturnValue(true) };
}
describe('기기별 기존 방 가져오기', () => {
  it('새 기기는 서버에 빈 설정을 쓰지 않아 다른 기기의 가져오기를 막지 않는다', async () => {
    const d = deps();
    expect(await openLayout(d)).toEqual(empty);
    expect(d.put).not.toHaveBeenCalled(); expect(d.confirmImport).not.toHaveBeenCalled();
  });
  it('기존 설정은 사용자가 선택할 때만 가져오고 원본을 변경하지 않는다', async () => {
    const d = deps(); d.hasLocalAccount = true;
    expect(await openLayout(d)).toMatchObject({ exists: true, revision: 1, rooms: [4, 7] });
    expect(d.put).toHaveBeenCalledWith({ revision: 0, rooms: [4, 7], decor: [] });
    const declined = deps(); declined.hasLocalAccount = true; declined.confirmImport.mockReturnValue(false);
    expect(await openLayout(declined)).toEqual(empty); expect(declined.put).not.toHaveBeenCalled();
  });
  it('계정 화면을 떠난 뒤 도착한 응답은 설정을 업로드하지 않는다', async () => {
    const d = deps(); d.hasLocalAccount = true; d.active.mockReturnValue(false);
    await expect(openLayout(d)).rejects.toThrow('view_closed'); expect(d.put).not.toHaveBeenCalled();
  });
});
