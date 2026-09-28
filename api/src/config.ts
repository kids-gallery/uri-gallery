// 앱 API 설정 — 환경 변수만 읽는다(.env.example, research R-21). 이름은 serving/common/config.py(A)와 같다.
import path from 'node:path';

const bool = (v: string | undefined, d = false) =>
  v === undefined ? d : ['1', 'true', 'yes', 'on'].includes(v.trim().toLowerCase());

export interface Config {
  port: number;
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
  secureCookies: boolean;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return {
    port: Number(env.APP_PORT ?? 3000),
    db: {
      host: env.DB_HOST ?? '127.0.0.1',
      port: Number(env.DB_PORT ?? 3306),
      user: env.DB_USER ?? 'uam',
      password: env.DB_PASSWORD ?? '',
      database: env.DB_NAME ?? 'uam',
      socketPath: env.DB_SOCKET || undefined,
    },
    sessionSecret: env.SESSION_SECRET ?? '',
    storageRoot: env.STORAGE_ROOT ?? path.resolve('.data/store'),
    modelApiUrl: env.MODEL_API_INTERNAL_URL ?? 'http://127.0.0.1:8100',
    llmServerUrl: env.LLM_SERVER_URL ?? 'http://127.0.0.1:8200',
    mailSmtpUrl: env.MAIL_SMTP_URL ?? 'smtp://127.0.0.1:1025',
    mailFrom: env.MAIL_FROM ?? 'no-reply@localhost',
    appBaseUrl: env.APP_BASE_URL ?? 'http://127.0.0.1:5173',
    authHmacSecret: env.AUTH_HMAC_SECRET ?? '',
    captionEnabled: bool(env.CAPTION_ENABLED), // P0에서는 꺼짐(llm-contract.md)
    secureCookies: bool(env.SECURE_COOKIES, true),
  };
}
