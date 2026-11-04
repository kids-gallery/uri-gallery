// 앱 API 설정 — 환경 변수를 읽는다(.env.example, research R-21). 이름은 serving/common/config.py(A)와 같다.
// 비밀 값은 NAME_FILE이 있으면 그 파일에서 읽는다(compose secrets, SD_04 4-3).
import fs from 'node:fs';
import path from 'node:path';

const bool = (v: string | undefined, d = false) =>
  v === undefined ? d : ['1', 'true', 'yes', 'on'].includes(v.trim().toLowerCase());
/** NAME_FILE이 있으면 그 파일(끝 줄바꿈 하나 뺌), 없으면 NAME. 파일을 못 읽으면 예외로 기동을 멈춘다 */
const secret = (env: NodeJS.ProcessEnv, name: string) => {
  const file = env[`${name}_FILE`];
  return file ? fs.readFileSync(file, 'utf8').replace(/\r?\n$/, '') : env[name] ?? '';
};

export interface Config {
  port: number;
  /** 바인딩 주소. compose는 0.0.0.0(SD_04 4-3) */
  host: string;
  /** Express trust proxy 값(쉼표로 여러 개). 요청 한도가 믿는 입구 뒤의 사용자 주소로 걸린다 */
  trustProxy: string;
  db: { host: string; port: number; user: string; password: string; database: string; socketPath?: string };
  sessionSecret: string;
  storageRoot: string;
  modelApiUrl: string;
  llmServerUrl: string;
  mailSmtpUrl: string;
  mailFrom: string;
  appBaseUrl: string;
  authHmacSecret: string;
  captionEnabled: boolean;
  gpuEnabled: boolean;
  modelCheckEnabled: boolean;
  manifestPath: string;
  contractsDir: string;
  apiGuideTestKey: string | null;
  secureCookies: boolean;
  /** 메일 발송(R-23 갱신 2, D36): 끄면 발송 대신 로그에 종류만. 기본 켬(기존 이메일 흐름·E2E), p1은 .env에서 끈다 */
  mailEnabled: boolean;
  /** 카카오 로그인(R-26, D36). restApiKey·clientSecret이 둘 다 있어야 켜진다. 값은 로그에 남기지 않는다 */
  kakao: { restApiKey: string; clientSecret: string; redirectUri: string; authBase: string; apiBase: string };
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  validateProduction(env);
  return {
    port: Number(env.APP_PORT ?? 9521),
    host: env.APP_HOST || '127.0.0.1',
    trustProxy: env.TRUST_PROXY || 'loopback',
    db: {
      host: env.DB_HOST ?? '127.0.0.1',
      port: Number(env.DB_PORT ?? 3306),
      user: env.DB_USER ?? 'uam',
      password: secret(env, 'DB_PASSWORD'),
      database: env.DB_NAME ?? 'uam',
      socketPath: env.DB_SOCKET || undefined,
    },
    sessionSecret: secret(env, 'SESSION_SECRET'),
    storageRoot: env.STORAGE_ROOT ?? path.resolve('.data/store'),
    modelApiUrl: env.MODEL_API_INTERNAL_URL ?? 'http://127.0.0.1:9541',
    llmServerUrl: env.LLM_SERVER_URL ?? 'http://127.0.0.1:8200',
    mailSmtpUrl: env.MAIL_SMTP_URL ?? 'smtp://127.0.0.1:1025',
    mailFrom: env.MAIL_FROM ?? 'no-reply@localhost',
    appBaseUrl: env.APP_BASE_URL ?? 'http://127.0.0.1:9501',
    authHmacSecret: secret(env, 'AUTH_HMAC_SECRET'),
    captionEnabled: bool(env.CAPTION_ENABLED), // P0에서는 꺼짐(llm-contract.md)
    gpuEnabled: bool(env.GPU_ENABLED), // U2 — 꺼져 있으면 M5는 cpu_vision(BR-SRV-02)
    modelCheckEnabled: bool(env.MODEL_CHECK_ENABLED), // D20 ⑨ — serving 점검 실행기(stage-job §13) 배포 뒤에만 켠다
    contractsDir: env.CONTRACTS_DIR ?? path.resolve('../contracts'), // 계약 사본(T134) — /openapi.json 원천
    apiGuideTestKey: env.API_GUIDE_TEST_KEY || null, // key_kind='test' 원문(ops:key issue --kind test), 로그 금지
    manifestPath: env.MODEL_MANIFEST ?? path.resolve('../models/manifest.yaml'), // A 소유(serving/common/config.py와 같은 변수)
    secureCookies: bool(env.SECURE_COOKIES, true),
    mailEnabled: bool(env.MAIL_ENABLED, true),
    kakao: {
      restApiKey: env.KAKAO_REST_API_KEY ?? '',
      clientSecret: env.KAKAO_CLIENT_SECRET ?? '',
      // 카카오 디벨로퍼스 Redirect URI와 글자까지 같아야 한다(p1: https://p1.sumzip.com/v1/auth/kakao/callback)
      redirectUri: env.KAKAO_REDIRECT_URI ?? `${env.APP_BASE_URL ?? 'http://127.0.0.1:9501'}/v1/auth/kakao/callback`,
      authBase: env.KAKAO_AUTH_BASE ?? 'https://kauth.kakao.com', // 시험(E2E)만 가짜 서버로 바꾼다
      apiBase: env.KAKAO_API_BASE ?? 'https://kapi.kakao.com',
    },
  };
}

/** Production is explicit; reject demo defaults before opening the DB or listener. */
export function validateProduction(env: NodeJS.ProcessEnv) {
  const mode = env.UAM_ENV ?? 'development';
  if (!['development', 'test', 'production'].includes(mode)) throw new Error('Invalid UAM_ENV');
  if (mode !== 'production') return;
  const fake = (env.UAM_FAKE_MODELS ?? '').trim().toLowerCase();
  if (fake && !['0', 'false', 'off', 'no'].includes(fake)) throw new Error('Production forbids fake models');
  if (bool(env.DEV_ACTIVATE_MODELS)) throw new Error('Production forbids development model activation');
  if (!bool(env.SECURE_COOKIES) || !env.APP_BASE_URL?.startsWith('https://')) throw new Error('Production requires HTTPS and secure cookies');
  let smtp: URL;
  try { smtp = new URL(env.MAIL_SMTP_URL ?? ''); } catch { throw new Error('Production requires explicit SMTP'); }
  if (!['smtp:', 'smtps:'].includes(smtp.protocol) || ['mailpit','localhost','127.0.0.1','[::1]'].includes(smtp.hostname)) throw new Error('Production forbids test mail transport');
  for (const key of ['DB_PASSWORD','SESSION_SECRET','AUTH_HMAC_SECRET']) if (secret(env,key).length < 32) throw new Error(`Production requires strong ${key}`);
}
