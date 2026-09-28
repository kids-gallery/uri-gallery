// 팀원 계정·역할 CLI(T018, BR-ACC-05, 보완 S5): npm run ops:staff -- add --email e --role operator[,evaluator]
//   비밀번호는 표준 입력으로 받는다(인자·로그에 남기지 않음).
import argon2 from 'argon2';
import mysql from 'mysql2/promise';
import { loadConfig } from '../../src/config.js';

const argv = process.argv.slice(3);
const arg = (k: string) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : undefined; };
const email = arg('email');
const roles = (arg('role') ?? '').split(',').filter(Boolean);
if (process.argv[2] !== 'add' || !email || !roles.length || !roles.every((r) => ['operator', 'evaluator', 'integrator'].includes(r))) {
  console.error('사용법: ops:staff add --email <메일> --role operator|evaluator|integrator[,…]  (비밀번호는 표준 입력)');
  process.exit(2);
}
const pw = await new Promise<string>((res) => { let s = ''; process.stdin.on('data', (d) => (s += d)).on('end', () => res(s.trim())); });
if (pw.length < 8) { console.error('비밀번호는 8자 이상'); process.exit(2); }
const c = loadConfig().db;
const conn = await mysql.createConnection({ host: c.socketPath ? undefined : c.host, port: c.socketPath ? undefined : c.port, socketPath: c.socketPath, user: c.user, password: c.password, database: c.database });
await conn.beginTransaction();
const [ins] = await conn.query(`INSERT INTO team_member (email, password_hash) VALUES (?, ?)`, [email, await argon2.hash(pw, { type: argon2.argon2id })]);
const id = (ins as { insertId: number }).insertId;
for (const r of roles) await conn.query(`INSERT INTO team_member_role (member_id, role) VALUES (?, ?)`, [id, r]);
await conn.commit();
console.log(`팀원 ${id} 등록(역할 ${roles.join(',')})`);
await conn.end();
