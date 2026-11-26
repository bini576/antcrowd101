import { authenticator } from 'otplib';
import { config } from '../config/env.js';

authenticator.options = {
  window: 1,
  step: 30
};

export function generateTotpSecret() {
  return authenticator.generateSecret();
}

export function buildTotpKeyUri(email, secret) {
  return authenticator.keyuri(email, config.twoFactor.issuer, secret);
}

export function verifyTotpCode(code, secret) {
  return authenticator.check(String(code).replace(/\s+/g, ''), secret);
}
