import { clearSessionCookie, verifyJwt } from '../lib/jwt.js';
import { forbidden, unauthorized } from '../lib/httpError.js';
import { findUserById } from '../repositories/userRepository.js';
import { config } from '../config/env.js';

function readAuthorizationBearer(req) {
  const authorization = String(req.get('authorization') ?? '').trim();
  if (!authorization.toLowerCase().startsWith('bearer ')) {
    return null;
  }

  return authorization.slice(7).trim() || null;
}

export function readSessionToken(req) {
  return readAuthorizationBearer(req) || req.cookies[config.cookie.name] || null;
}

export async function requireAuth(req, res, next) {
  try {
    const token = readSessionToken(req);
    if (!token) {
      throw unauthorized('Authentication required');
    }

    const payload = verifyJwt(token);
    if (payload.kind !== 'session') {
      throw unauthorized('Invalid session');
    }

    const user = await findUserById(payload.sub);
    if (!user || user.session_version !== payload.sessionVersion) {
      clearSessionCookie(res);
      throw unauthorized('Your session has expired. Please sign in again.');
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      clearSessionCookie(res);
      next(unauthorized('Your session has expired. Please sign in again.'));
      return;
    }

    next(error);
  }
}

export function requirePlatformAdmin(req, _res, next) {
  if (req.user?.account_type !== 'platform_admin') {
    next(forbidden('Platform admin access is required.'));
    return;
  }

  next();
}

export function requireInternalServiceAuth(req, _res, next) {
  const providedToken = String(req.get('x-internal-service-token') ?? '').trim();
  if (!providedToken || providedToken !== config.internalServiceToken) {
    next(unauthorized('Internal service authentication failed.'));
    return;
  }

  next();
}

export function requireResearcher(req, _res, next) {
  if (req.user?.account_type !== 'researcher') {
    next(forbidden('Researcher access is required.'));
    return;
  }

  next();
}
