// 보호자 인증 7경로 + /v1/me + 팀원 로그인(T046~T050, UC13·UC14, FR-31·32, G26·G27, R-24).
// 가입·재발송·찾기는 가입 여부와 관계없이 항상 202(결정 ④). 토큰 오류는 400 token_invalid 하나(결정 ③).
import argon2 from 'argon2';
import { Router, type Request, type Response } from 'express';
import type { Pool } from 'mysql2/promise';
import { z } from 'zod';
import type { Config } from '../../config.js';
import { withTx } from '../../db/pool.js';
import { Problem, isDup } from '../../lib/problem.js';
import { guardianAuth } from '../../auth/guards.js';
import { GUARDIAN_COOKIE, IDLE_MINUTES, STAFF_COOKIE, createSession, destroyAllFor, destroySession } from '../../auth/session.js';
import type { Mailer, MailMessage } from '../mail/mailer.js';
import { RateLimiter, normEmail } from './rateLimit.js';
import { issueToken, lockValidToken, useToken } from './tokens.js';

const email = z.string().trim().max(254).email();
const password = z.string().min(8).max(200); // 규칙 예시 8자 이상 [U19]
const DUMMY_HASH = argon2.hash('timing-equalizer-not-a-password');

function parse<T>(schema: z.ZodType<T>, body: unknown): T {
  const r = schema.safeParse(body);
  if (!r.success) {
    throw new Problem('validation_failed', 'invalid_fields', undefined,
      r.error.issues.map((i) => ({ name: String(i.path[0] ?? ''), reason: i.code === 'custom' ? i.message : i.code })));
  }
  return r.data;
}

const withConfirm = <T extends z.ZodRawShape>(shape: T) =>
  z.object({ ...shape, password, passwordConfirm: z.string() })
    .refine((v) => v.password === v.passwordConfirm, { path: ['passwordConfirm'], message: 'password_mismatch' });

export function maskEmail(e: string): string {
  const [u, d = ''] = e.split('@');
  return `${u.slice(0, 2)}***@${d}`;
}

export function authRouter(db: Pool, cfg: Config, mailer: Mailer): Router {
  const r = Router();
  const rl = new RateLimiter(db, cfg.authHmacSecret);
  const link = (path: string, token: string) => `${cfg.appBaseUrl}${path}?token=${encodeURIComponent(token)}`;
  const cookieOpts = { httpOnly: true, sameSite: 'lax' as const, secure: cfg.secureCookies, path: '/', maxAge: IDLE_MINUTES * 60 * 1000 };
  const setGuardianCookie = (res: Response, sid: string) => res.cookie(GUARDIAN_COOKIE, sid, cookieOpts);
  const ip = (req: Request) => req.ip ?? 'unknown';

  // --- 가입(G26) ---
  r.post('/v1/auth/signup', async (req, res, next) => {
    try {
      const b = parse(withConfirm({ email }), req.body);
      const em = normEmail(b.email);
      if (!(await rl.take('signup', { email: em, ip: ip(req) }))) return void res.status(202).end();
      const hash = await argon2.hash(b.password, { type: argon2.argon2id });
      let mail: MailMessage;
      try {
        mail = await withTx(db, async (conn) => {
          const [ex] = await conn.query(`SELECT account_id FROM guardian_account WHERE email_norm = ?`, [em]);
          if ((ex as unknown[]).length) return { kind: 'already_registered', to: em } as MailMessage;
          const [f] = await conn.query(`INSERT INTO family () VALUES ()`);
          const familyId = (f as { insertId: number }).insertId;
          const [g] = await conn.query(
            `INSERT INTO guardian_account (family_id, email, password_hash, role) VALUES (?, ?, ?, 'owner')`,
            [familyId, b.email.trim(), hash],
          );
          const token = await issueToken(conn, (g as { insertId: number }).insertId, 'verify');
          return { kind: 'verify', to: em, link: link('/app/verify', token) } as MailMessage;
        });
      } catch (e) {
        if (!isDup(e, 'uq_guardian_email')) throw new Problem('not_saved', 'signup_failed');
        mail = { kind: 'already_registered', to: em }; // 동시 가입 경쟁(UC13 E4)은 E1과 같게
      }
      mailer.send(mail);
      res.status(202).end();
    } catch (e) { next(e); }
  });

  // --- 이메일 확인(G27) — 성공하면 세션 발급(UC13 BF5) ---
  r.post('/v1/auth/email/verify', async (req, res, next) => {
    try {
      const { token } = parse(z.object({ token: z.string().min(10).max(200) }), req.body);
      const accountId = await withTx(db, async (conn) => {
        const t = await lockValidToken(conn, token, 'verify');
        if (!t) throw new Problem('token_invalid', 'token_invalid', 'G27');
        await useToken(conn, t.tokenId);
        await conn.query(`UPDATE guardian_account SET email_verified_at = COALESCE(email_verified_at, UTC_TIMESTAMP()) WHERE account_id = ?`, [t.accountId]);
        return t.accountId;
      });
      setGuardianCookie(res, await createSession(db, 'guardian', accountId));
      res.status(204).end();
    } catch (e) { next(e); }
  });

  r.post('/v1/auth/email/verify/resend', async (req, res, next) => {
    try {
      const { email: e } = parse(z.object({ email }), req.body);
      const em = normEmail(e);
      if (await rl.take('resend', { email: em, ip: ip(req) })) {
        const mail = await withTx(db, async (conn) => {
          const [rows] = await conn.query(`SELECT account_id FROM guardian_account WHERE email_norm = ? AND email_verified_at IS NULL`, [em]);
          const a = (rows as { account_id: number }[])[0];
          if (!a) return null;
          return { kind: 'verify', to: em, link: link('/app/verify', await issueToken(conn, a.account_id, 'verify')) } as MailMessage;
        });
        if (mail) mailer.send(mail);
      }
      res.status(202).end();
    } catch (e) { next(e); }
  });

  // --- 로그인 ---
  r.post('/v1/auth/login', async (req, res, next) => {
    try {
      const b = parse(z.object({ email, password: z.string().min(1).max(200) }), req.body);
      const em = normEmail(b.email);
      if (await rl.exceeded('login', { email: em })) throw new Problem('rate_limited', 'login_attempts');
      const [rows] = await db.query(`SELECT account_id, password_hash, email_verified_at FROM guardian_account WHERE email_norm = ?`, [em]);
      const a = (rows as { account_id: number; password_hash: string; email_verified_at: Date | null }[])[0];
      const ok = await argon2.verify(a?.password_hash ?? (await DUMMY_HASH), b.password).catch(() => false);
      if (!a || !ok) {
        await rl.record('login', { email: em });
        throw new Problem('unauthorized', 'bad_credentials');
      }
      if (!a.email_verified_at) throw new Problem('email_unverified', 'email_unverified');
      setGuardianCookie(res, await createSession(db, 'guardian', a.account_id));
      res.status(204).end();
    } catch (e) { next(e); }
  });

  r.post('/v1/auth/logout', guardianAuth(db, { requireFamily: false }), async (req, res, next) => {
    try {
      await destroySession(db, req.sid);
      res.clearCookie(GUARDIAN_COOKIE, { path: '/' });
      res.status(204).end();
    } catch (e) { next(e); }
  });

  // --- 로그인 정보 찾기·재설정(UC14) ---
  r.post('/v1/auth/recovery', async (req, res, next) => {
    try {
      const { email: e } = parse(z.object({ email }), req.body);
      const em = normEmail(e);
      if (await rl.take('recovery', { email: em, ip: ip(req) })) {
        const mail = await withTx(db, async (conn) => {
          const [rows] = await conn.query(`SELECT account_id, email_verified_at FROM guardian_account WHERE email_norm = ?`, [em]);
          const a = (rows as { account_id: number; email_verified_at: Date | null }[])[0];
          if (!a) return null; // UC14 A1: 메일 없음, 응답 같음
          if (!a.email_verified_at) return { kind: 'verify', to: em, link: link('/app/verify', await issueToken(conn, a.account_id, 'verify')) } as MailMessage; // A2
          return { kind: 'recovery', to: em, link: link('/app/reset', await issueToken(conn, a.account_id, 'reset')) } as MailMessage;
        });
        if (mail) mailer.send(mail);
      }
      res.status(202).end();
    } catch (e) { next(e); }
  });

  r.post('/v1/auth/recovery/reset', async (req, res, next) => {
    try {
      // 규칙 위반은 토큰을 쓰기 전에 거절한다(UC14 E3)
      const b = parse(withConfirm({ token: z.string().min(10).max(200) }), req.body);
      const hash = await argon2.hash(b.password, { type: argon2.argon2id });
      try {
        await withTx(db, async (conn) => {
          const t = await lockValidToken(conn, b.token, 'reset');
          if (!t) throw new Problem('token_invalid', 'token_invalid', 'G27');
          await useToken(conn, t.tokenId);
          await conn.query(`UPDATE guardian_account SET password_hash = ?, password_changed_at = UTC_TIMESTAMP(3) WHERE account_id = ?`, [hash, t.accountId]);
          await destroyAllFor(conn, 'guardian', t.accountId); // 결정 ⑥: 현재 세션 포함 모두
        });
      } catch (e) {
        if (e instanceof Problem) throw e;
        throw new Problem('not_saved', 'reset_failed');
      }
      res.clearCookie(GUARDIAN_COOKIE, { path: '/' });
      res.status(204).end();
    } catch (e) { next(e); }
  });

  // --- 로그인한 보호자 상태(U20, /v1/me) ---
  r.get('/v1/me', guardianAuth(db, { requireFamily: false }), (req, res) => {
    const g = req.guardian!;
    res.json({ emailMasked: maskEmail(g.email), hasFamily: g.familyId !== null, role: g.familyId === null ? null : g.role });
  });

  // --- 팀원 로그인(INC2, G1) ---
  r.post('/v1/ops/auth/login', async (req, res, next) => {
    try {
      const b = parse(z.object({ email, password: z.string().min(1).max(200) }), req.body);
      const [rows] = await db.query(
        `SELECT m.member_id, m.password_hash, GROUP_CONCAT(r.role) roles FROM team_member m
           LEFT JOIN team_member_role r ON r.member_id = m.member_id
          WHERE m.email = ? AND m.disabled_at IS NULL GROUP BY m.member_id, m.password_hash`,
        [b.email.trim()],
      );
      const m = (rows as { member_id: number; password_hash: string; roles: string | null }[])[0];
      const ok = await argon2.verify(m?.password_hash ?? (await DUMMY_HASH), b.password).catch(() => false);
      if (!m || !ok) throw new Problem('unauthorized', 'bad_credentials', 'G1');
      res.cookie(STAFF_COOKIE, await createSession(db, 'staff', m.member_id), cookieOpts);
      res.json({ roles: (m.roles ?? '').split(',').filter(Boolean) });
    } catch (e) { next(e); }
  });

  return r;
}
