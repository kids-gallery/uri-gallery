// 3D 화면 ↔ app-api 연결 층(마스터플랜 3-3, #28). 창들은 서버를 이 파일로만 부른다.
// - HTTP는 /app과 같은 api/client.ts(같은 출처·쿠키·Problem Details)를 쓴다. 여기에는 #19 대응표 한 줄에 함수 하나만 둔다.
// - 모든 호출은 noRedirect: 401에 /app/login으로 옮기지 않고 3D 화면 안의 로그인 창을 연다(#30).
// - 서버에 닿지 않아도 기기 저장(store.ts)으로 바꾸지 않는다. 창은 failureOf의 종류대로 알리고 다시 시도하게 한다.
import { api, ApiError } from '@/api/client';
import type { components, paths } from '@/api/types.gen';
import type { ArtworkDetail, ArtworkSummary } from '@/app/artwork';
import { problemCopy } from '@/copy/ko';
import type { GuardianMe } from '@/stores/session';

type Json<P extends keyof paths, M extends 'get' | 'post'> =
  NonNullable<paths[P][M]> extends { requestBody?: { content: { 'application/json': infer B } } } ? B : never;
type Ok<P extends keyof paths, M extends 'get' | 'post'> =
  NonNullable<paths[P][M]> extends { responses: infer R } ? { [S in keyof R & (200 | 201 | 202)]: R[S] extends { content: { 'application/json': infer B } } ? B : never }[keyof R & (200 | 201 | 202)] : never;

export type Child = components['schemas']['Child'];
export type Gallery = components['schemas']['Gallery'];
export type ConfirmKind = Json<'/v1/artworks/{artworkId}/confirm', 'post'>['kind'];
export type Decision = Json<'/v1/artworks/{artworkId}/decision', 'post'>['decision'];
export type { ArtworkDetail, ArtworkSummary, GuardianMe };

const o = { noRedirect: true } as const;
// 인증된 호출에서만 만료를 알린다. 로그인 입력 오류의 401은 여기에 넣지 않는다.
async function authenticated<T>(request: Promise<T>): Promise<T> {
  try {
    return await request;
  } catch (e) {
    if (failureOf(e).kind === 'login') window.dispatchEvent(new Event('world-session-expired'));
    throw e;
  }
}
const art = (id: string, tail = '') => `/v1/artworks/${encodeURIComponent(id)}${tail}`;

export const signup = (body: Json<'/v1/auth/signup', 'post'>) => api.post<void>('/v1/auth/signup', { ...o, body });
export const verifyEmail = (token: string) => api.post<void>('/v1/auth/email/verify', { ...o, body: { token } });
export const resendVerify = (email: string) => api.post<void>('/v1/auth/email/verify/resend', { ...o, body: { email } });
export const login = (body: Json<'/v1/auth/login', 'post'>) => api.post<void>('/v1/auth/login', { ...o, body });
export const logout = () => api.post<void>('/v1/auth/logout', o);
export const authProviders = () => api.get<{ kakao: boolean; emailSignup: boolean }>('/v1/auth/providers', o);
export const me = () => authenticated(api.get<GuardianMe>('/v1/me', o));

export const listChildren = () => authenticated(api.get<Child[]>('/v1/children', o));
export const addChild = (alias: string) => authenticated(api.post<Child>('/v1/children', { ...o, body: { alias } }));

/** 다시 보낼 때는 같은 key를 넘긴다. 서버가 기존 작품을 돌려줘 작품이 두 번 생기지 않는다(계약 Idempotency-Key). */
export function uploadArtwork(childId: string, photo: Blob, key: string, making = false) {
  const form = new FormData();
  form.append('childId', childId);
  form.append('making', String(making));
  form.append('photo', photo);
  return authenticated(api.post<ArtworkDetail>('/v1/artworks', { ...o, form, headers: { 'Idempotency-Key': key } }));
}
export const listArtworks = () => authenticated(api.get<ArtworkSummary[]>('/v1/artworks', o));
export const getArtwork = (id: string) => authenticated(api.get<ArtworkDetail>(art(id), o));
export const deleteArtwork = (id: string) => authenticated(api.del<void>(art(id), o));
export const confirmKind = (id: string, kind: ConfirmKind) => authenticated(api.post<ArtworkDetail>(art(id, '/confirm'), { ...o, body: { kind } }));
export const decide = (id: string, decision: Decision) =>
  authenticated(api.post<Ok<'/v1/artworks/{artworkId}/decision', 'post'>>(art(id, '/decision'), { ...o, body: { decision } }));
export const gallery = (childId?: string) => authenticated(api.get<Gallery>('/v1/gallery', { ...o, query: { child: childId } }));

export type Failure =
  | { kind: 'offline' }
  | { kind: 'login' }
  | { kind: 'refused'; reason: string; fields: { name: string; reason: string }[] };

/** 창에 보일 문장. 화면 글에 "서버"를 쓰지 않는다(D48) */
export function failureReason(f: Failure): string {
  if (f.kind === 'offline') return '미술관에 연결되지 않아요. 다시 시도해 주세요';
  if (f.kind === 'login') return '로그인이 필요해요. 로그인한 뒤 다시 시도해 주세요';
  return f.reason;
}

/** 창에 넘길 오류 종류(마스터플랜 3-3 표). ApiError가 아닌 것(코드 오류 등)도 서버에 닿지 않은 것으로 다룬다. */
export function failureOf(e: unknown): Failure {
  if (!(e instanceof ApiError) || e.unavailable) return { kind: 'offline' };
  if (e.status === 401) return { kind: 'login' };
  const fields = (e.problem?.fields ?? []).map((f) => ({ name: f.name ?? '', reason: f.reason ?? '' }));
  return { kind: 'refused', reason: problemCopy({ gate: e.gate, reason: e.reason, code: e.code }).reason, fields };
}
