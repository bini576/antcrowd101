import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';

function resolveCookieOptions(rememberMe = false) {
  return {
    httpOnly: true,
    sameSite: config.cookie.sameSite,
    secure: config.cookie.secure,
    domain: config.cookie.domain,
    path: '/',
    maxAge: rememberMe ? config.cookie.rememberMaxAgeMs : config.cookie.maxAgeMs
  };
}

export function signSessionToken(user, rememberMe = false) {
  return jwt.sign(
    {
      kind: 'session',
      sub: user.id,
      accountType: user.account_type,
      researcherType: user.researcher_type,
      sessionVersion: user.session_version
    },
    config.jwtSecret,
    { expiresIn: rememberMe ? config.rememberSessionExpiresIn : config.sessionExpiresIn }
  );
}

export function signTwoFactorChallenge(userId) {
  return jwt.sign(
    {
      kind: '2fa-challenge',
      sub: userId
    },
    config.jwtSecret,
    { expiresIn: config.challengeExpiresIn }
  );
}

export function verifyJwt(token) {
  return jwt.verify(token, config.jwtSecret);
}

export function setSessionCookie(res, token, rememberMe = false) {
  res.cookie(config.cookie.name, token, resolveCookieOptions(rememberMe));
}

export function clearSessionCookie(res) {
  res.clearCookie(config.cookie.name, {
    httpOnly: true,
    sameSite: config.cookie.sameSite,
    secure: config.cookie.secure,
    domain: config.cookie.domain,
    path: '/'
  });
}
