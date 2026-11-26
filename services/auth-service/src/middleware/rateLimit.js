import rateLimit from 'express-rate-limit';
import { config } from '../config/env.js';

function buildLimiter(max, message) {
  return rateLimit({
    windowMs: config.rateLimit.windowMs,
    limit: max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message }
  });
}

export const authMutationLimiter = buildLimiter(
  config.rateLimit.mutationMax,
  'Too many authentication requests. Please try again shortly.'
);

export const loginLimiter = buildLimiter(
  config.rateLimit.loginMax,
  'Too many login attempts. Please wait before trying again.'
);
