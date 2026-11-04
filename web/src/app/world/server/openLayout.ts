import type { DecorItem } from '../decor';
import type { WorldLayout } from './index';

interface OpenLayoutDeps {
  get: () => Promise<WorldLayout>;
  put: (data: Omit<WorldLayout, 'exists'>) => Promise<{ revision: number }>;
  localRooms: () => Promise<number[]>;
  localDecor: DecorItem[];
  hasLocalAccount: boolean;
  confirmImport: () => boolean;
  active: () => boolean;
}

/** 이전 기기 설정은 사용자 선택으로만 서버에 가져온다. 빈 기기는 서버를 초기화하지 않는다. */
export async function openLayout(d: OpenLayoutDeps): Promise<WorldLayout> {
  let layout = await d.get();
  if (!d.active()) throw new Error('view_closed');
  if (!layout.exists && d.hasLocalAccount && d.confirmImport()) {
    const initial = { revision: 0, rooms: await d.localRooms(), decor: d.localDecor };
    if (!d.active()) throw new Error('view_closed');
    const saved = await d.put(initial);
    if (!d.active()) throw new Error('view_closed');
    layout = { ...initial, exists: true, revision: saved.revision };
  }
  return layout;
}
