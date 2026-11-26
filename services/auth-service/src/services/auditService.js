import { createAuthAuditEvent } from '../repositories/userRepository.js';

function extractRequestIp(req) {
  const forwarded = String(req.headers['x-forwarded-for'] ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

  return forwarded[0] || req.ip || req.socket?.remoteAddress || null;
}

function extractUserAgent(req) {
  return String(req.get('user-agent') ?? '').trim() || null;
}

export async function recordAuditEvent(req, {
  actorUserId = null,
  targetUserId = null,
  eventType,
  outcome = 'success',
  accountType = null,
  subjectType = 'account',
  subjectId = null,
  metadata = {}
}) {
  try {
    await createAuthAuditEvent({
      actorUserId,
      targetUserId,
      eventType,
      outcome,
      accountType,
      subjectType,
      subjectId,
      ipAddress: extractRequestIp(req),
      userAgent: extractUserAgent(req),
      metadata
    });
  } catch (error) {
    console.warn('Failed to persist auth audit event', {
      eventType,
      error: error?.message ?? String(error)
    });
  }
}
