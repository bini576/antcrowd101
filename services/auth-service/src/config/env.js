import 'dotenv/config';
import crypto from 'node:crypto';
import path from 'node:path';

function parseBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
}

function parseNumber(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function splitCsv(value, fallback = []) {
  if (!value) {
    return fallback;
  }

  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildDatabaseUrl() {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  const host = process.env.DB_HOST ?? 'localhost';
  const port = process.env.DB_PORT ?? '5432';
  const name = process.env.DB_NAME ?? 'auth_db';
  const user = process.env.DB_USER ?? 'auth_user';
  const password = process.env.DB_PASSWORD ?? 'auth_password';

  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${name}`;
}

const jwtSecret = process.env.JWT_SECRET?.trim();
if (!jwtSecret) {
  throw new Error('JWT_SECRET is required');
}

const frontendBaseUrl = (process.env.FRONTEND_BASE_URL ?? 'http://localhost:8089').replace(/\/$/, '');
const publicAuthBaseUrl = (process.env.PUBLIC_AUTH_BASE_URL ?? `${frontendBaseUrl}/api/auth`).replace(/\/$/, '');
const tokenSecret = process.env.TWO_FACTOR_ENCRYPTION_SECRET?.trim() || jwtSecret;
const derivedKey = crypto.createHash('sha256').update(tokenSecret).digest('hex');

export const config = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseNumber(process.env.PORT, 8080),
  databaseUrl: buildDatabaseUrl(),
  jwtSecret,
  sessionExpiresIn: process.env.JWT_SESSION_EXPIRES_IN ?? '7d',
  rememberSessionExpiresIn: process.env.JWT_REMEMBER_EXPIRES_IN ?? '30d',
  challengeExpiresIn: process.env.JWT_CHALLENGE_EXPIRES_IN ?? '10m',
  frontendBaseUrl,
  publicAuthBaseUrl,
  corsOrigins: splitCsv(process.env.CORS_ORIGINS, [
    'http://localhost:5173',
    'http://localhost:8089',
    'http://localhost:5286'
  ]),
  uploadsDir: process.env.UPLOADS_DIR
    ? path.resolve(process.env.UPLOADS_DIR)
    : path.resolve(process.cwd(), 'uploads'),
  cookie: {
    name: process.env.COOKIE_NAME ?? 'antcrowd_session',
    secure: parseBoolean(process.env.COOKIE_SECURE, false),
    sameSite: process.env.COOKIE_SAME_SITE ?? 'lax',
    domain: process.env.COOKIE_DOMAIN || undefined,
    maxAgeMs: parseNumber(process.env.COOKIE_MAX_AGE_MS, 7 * 24 * 60 * 60 * 1000),
    rememberMaxAgeMs: parseNumber(process.env.COOKIE_REMEMBER_MAX_AGE_MS, 30 * 24 * 60 * 60 * 1000)
  },
  csrf: {
    cookieName: process.env.CSRF_COOKIE_NAME ?? 'antcrowd_csrf'
  },
  security: {
    verificationMinutes: parseNumber(
      process.env.EMAIL_VERIFICATION_MINUTES,
      parseNumber(process.env.EMAIL_VERIFICATION_HOURS, 24) * 60
    ),
    verificationCodeLength: parseNumber(process.env.EMAIL_VERIFICATION_CODE_LENGTH, 6),
    verificationCodeMaxAttempts: parseNumber(process.env.EMAIL_VERIFICATION_MAX_ATTEMPTS, 5),
    verificationResendCooldownSeconds: parseNumber(process.env.EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS, 60),
    passwordResetMinutes: parseNumber(process.env.PASSWORD_RESET_MINUTES, 30),
    inviteHours: parseNumber(process.env.ORG_INVITE_HOURS, 72),
    researcherInviteHours: parseNumber(process.env.RESEARCHER_INVITE_HOURS, 120)
  },
  rateLimit: {
    windowMs: parseNumber(process.env.RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
    loginMax: parseNumber(process.env.RATE_LIMIT_LOGIN_MAX, 5),
    mutationMax: parseNumber(process.env.RATE_LIMIT_MUTATION_MAX, 10)
  },
  email: {
    provider: (process.env.EMAIL_PROVIDER ?? process.env.AUTH_EMAIL_PROVIDER ?? 'brevo').trim().toLowerCase(),
    from: process.env.SMTP_FROM ?? process.env.AUTH_SMTP_FROM ?? 'AntCrowd Security <noreply@antcrowd.local>',
    smtp: {
      host: process.env.SMTP_HOST ?? process.env.AUTH_SMTP_HOST ?? 'smtp-relay.brevo.com',
      port: parseNumber(process.env.SMTP_PORT ?? process.env.AUTH_SMTP_PORT, 587),
      secure: parseBoolean(process.env.SMTP_SECURE ?? process.env.AUTH_SMTP_SECURE, false),
      // Brevo requires the SMTP Login (SMTP & API tab), not your Brevo account email.
      // Expected format: xxxxxxxx@smtp-brevo.com
      user: process.env.SMTP_USER ?? process.env.AUTH_SMTP_USER ?? '',
      pass: process.env.SMTP_PASS ?? process.env.AUTH_SMTP_PASS ?? ''
    },
    mailpit: {
      host: process.env.MAILPIT_HOST ?? process.env.AUTH_MAILPIT_HOST ?? 'mailpit',
      port: parseNumber(process.env.MAILPIT_PORT ?? process.env.AUTH_MAILPIT_PORT, 1025)
    }
  },
  platformAdmin: {
    email: process.env.PLATFORM_ADMIN_EMAIL ?? 'platform-admin@antcrowd.local',
    password: process.env.PLATFORM_ADMIN_PASSWORD ?? 'AntcrowdAdmin123!',
    firstName: process.env.PLATFORM_ADMIN_FIRST_NAME ?? 'Platform',
    lastName: process.env.PLATFORM_ADMIN_LAST_NAME ?? 'Admin'
  },
  internalServiceToken: process.env.INTERNAL_SERVICE_TOKEN ?? 'antcrowd-internal-dev-token',
  storage: {
    provider: (process.env.STORAGE_PROVIDER ?? 'filesystem').trim().toLowerCase(),
    minio: {
      endpoint: process.env.MINIO_ENDPOINT ?? 'minio:9000',
      accessKey: process.env.MINIO_ACCESS_KEY ?? 'minio',
      secretKey: process.env.MINIO_SECRET_KEY ?? 'minio123',
      bucket: process.env.MINIO_BUCKET ?? 'auth-verifications',
      useSSL: parseBoolean(process.env.MINIO_USE_SSL, false)
    }
  },
  twoFactor: {
    issuer: process.env.TWO_FACTOR_ISSUER ?? 'AntCrowd',
    encryptionKeyHex: derivedKey
  }
};
