import { config } from '../config/env.js';
import { forbidden } from '../lib/httpError.js';
import { generateToken } from '../lib/tokens.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function csrfCookieOptions() {
  return {
    httpOnly: false,
    sameSite: config.cookie.sameSite,
    secure: config.cookie.secure,
    domain: config.cookie.domain,
    path: '/',
    maxAge: config.cookie.rememberMaxAgeMs
  };
}

export function ensureCsrfCookie(req, res) {
  const existingToken = req.cookies?.[config.csrf.cookieName];
  if (existingToken) {
    return existingToken;
  }

  const csrfToken = generateToken();
  res.cookie(config.csrf.cookieName, csrfToken, csrfCookieOptions());
  return csrfToken;
}

export function issueCsrfToken(req, res) {
  const csrfToken = ensureCsrfCookie(req, res);
  res.json({ csrfToken });
}

export function requireCsrfToken(req, res, next) {
  if (SAFE_METHODS.has(req.method)) {
    next();
    return;
  }

  const cookieToken = ensureCsrfCookie(req, res);
  const headerToken = String(req.get('x-csrf-token') ?? '').trim();

  if (!headerToken || headerToken !== cookieToken) {
    next(forbidden('Invalid CSRF token. Refresh the page and try again.'));
    return;
  }

  next();
}
