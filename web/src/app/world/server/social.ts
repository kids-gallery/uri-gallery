// 서버 판 친구(마스터플랜 3-3 #137): /v1/neighbors, /v1/town, /v1/visit를 화면의 SocialStore로 잇는다.
// 방문은 서버가 정한 값만 받는다. 모르는 가족 건물은 들어갈 수 없어 마을에 그리지 않는다.
import { api, ApiError } from '@/api/client';
import type { MuseumStyle } from '../../character/names';
import { DEFAULT_AVATAR } from '../avatar';
import { exhibitBlob } from '../exhibit';
import { LocalSocialStore, SocialError, type PublicBuilding, type SocialStore, type VisitGallery, type VisitWork } from '../social';
import * as store from '../store';
import { SERVER_WORLD } from './upload';

const o = { noRedirect: true } as const;
const KEY = 'uam-world-invite';

/** 주소의 초대를 탭 저장소에 두고 돌려준다. 카카오 로그인을 다녀오면 주소에서 사라진다 */
export function pendingInvite(): string {
  const q = new URLSearchParams(location.search).get('invite');
  try {
    if (q) sessionStorage.setItem(KEY, q);
    return q ?? sessionStorage.getItem(KEY) ?? '';
  } catch { return q ?? ''; }
}
export function clearInvite() { try { sessionStorage.removeItem(KEY); } catch { /* 저장소를 못 써도 다음 수락에서 막힌다 */ } }

interface Building { id: string; relation: 'mine' | 'neighbor' | 'stranger'; style: MuseumStyle | null; children?: { id: string; alias: string }[]; online?: boolean }
interface VisitItem { id: string; kind: string; title: string | null; primaryUrl: string | null; auxUrl: string | null; making: boolean }

async function guard<T>(run: Promise<T>): Promise<T> {
  try { return await run; } catch (e) {
    if (e instanceof ApiError) {
      if (e.code === 'token_invalid') throw new SocialError('token_invalid');
      if (e.code === 'not_found') throw new SocialError('not_found');
      if (e.code === 'conflict') throw new SocialError('conflict', e.reason === 'own_family' || e.reason === 'neighbor_full' ? e.reason : undefined);
    }
    throw e;
  }
}
async function file(url: string): Promise<Blob> {
  const res = await fetch(url, { credentials: 'same-origin' });
  if (!res.ok) throw new Error(`file ${res.status}`);
  return res.blob();
}

export class ServerSocialStore implements SocialStore {
  private children = new Map<string, string>();
  private building(b: Building): PublicBuilding {
    const first = b.children?.[0];
    if (first) this.children.set(b.id, first.id);
    return { id: b.id, child: first?.alias ?? '친구', style: b.style ?? 'column_temple', mine: b.relation === 'mine', avatar: DEFAULT_AVATAR, avatarImage: null, online: b.online };
  }
  async neighbors(): Promise<PublicBuilding[]> {
    const list = await guard(api.get<Building[]>('/v1/neighbors', o));
    return list.filter((b) => b.children?.length).map((b) => this.building(b));
  }
  async town(): Promise<PublicBuilding[]> {
    const { buildings } = await guard(api.get<{ buildings: Building[] }>('/v1/town', o));
    return buildings.filter((b) => b.relation === 'mine' || (b.relation === 'neighbor' && b.children?.length)).map((b) => this.building(b));
  }
  async invites() { return guard(api.get<{ id: string; expiresAt: string }[]>('/v1/neighbors/invites', o)); }
  async createInvite() {
    const i = await guard(api.post<{ id: string; link: string; expiresAt: string }>('/v1/neighbors/invites', { ...o, body: {} }));
    const token = new URL(i.link, location.origin).searchParams.get('token') ?? '';
    return { ...i, link: `${location.origin}/app/world?invite=${encodeURIComponent(token)}` }; // 3D 화면으로 바로 온다
  }
  async cancelInvite(_family: string, id: string) { await guard(api.del<void>(`/v1/neighbors/invites/${encodeURIComponent(id)}`, o)); }
  /** 새로 맺은 친구의 건물 id를 돌려준다. 이미 친구였으면 빈 값이다(서버 응답은 본문이 없어 전후 목록을 비교한다) */
  async accept(_family: string, token: string) {
    const before = new Set((await this.neighbors().catch(() => [])).map((b) => b.id));
    await guard(api.post<void>('/v1/neighbors/accept', { ...o, body: { token } }));
    clearInvite();
    return (await this.neighbors().catch(() => [])).find((b) => !before.has(b.id))?.id ?? '';
  }
  async unlink(_family: string, id: string) { await guard(api.del<void>(`/v1/neighbors/${encodeURIComponent(id)}`, o)); }
  async gallery(_family: string, id: string): Promise<VisitGallery> {
    const building = (await this.neighbors()).find((b) => b.id === id);
    const child = this.children.get(id);
    if (!building || !child) throw new SocialError('not_found');
    const g = await guard(api.get<{ rooms: { room: number; items: VisitItem[] }[] }>(`/v1/visit/children/${encodeURIComponent(child)}/gallery`, o));
    const works: VisitWork[] = [];
    for (const { room, items } of g.rooms) {
      for (const it of items) {
        try { // 한 장을 못 받아도 나머지는 건다
          const base = { id: it.id, title: it.title ?? '', kind: it.making ? 'making' as const : 'drawing' as const, room, behavior: 'etc' };
          if (it.kind === 'relief' && it.auxUrl) {
            const cutout = await file(it.auxUrl);
            const depth = it.making && it.primaryUrl ? await file(it.primaryUrl).catch(() => null) : null;
            works.push({ ...base, cutout, depth, display: await exhibitBlob(cutout).catch(() => cutout) });
          } else {
            const url = it.kind === 'animated' ? it.auxUrl : it.primaryUrl;
            if (!url) continue;
            works.push({ ...base, cutout: null, display: (await store.processImage(await file(url), false)).display });
          }
        } catch { /* 건너뛴다 */ }
      }
    }
    return { building, works, rooms: g.rooms.map((r) => r.room) };
  }
}

/** 서버 판은 서버로, 개발 기기 판은 같은 기기의 시험 가족끼리 */
export const socialStore = (): SocialStore => (SERVER_WORLD ? new ServerSocialStore() : new LocalSocialStore());
