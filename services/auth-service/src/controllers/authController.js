import crypto, { randomInt } from 'node:crypto';
import { config } from '../config/env.js';
import { pool } from '../db/pool.js';

import {
  clearSessionCookie,
  setSessionCookie,
  signSessionToken,
  signTwoFactorChallenge,
  verifyJwt
} from '../lib/jwt.js';
import { badRequest, conflict, forbidden, notFound, unauthorized } from '../lib/httpError.js';
import { hashPassword, verifyPassword } from '../lib/password.js';

import { generateId, generateToken, hashToken } from '../lib/tokens.js';
import { readSessionToken } from '../middleware/auth.js';
import { issueCsrfToken } from '../middleware/csrf.js';
import {
  acceptOrganizationInvitation,
  acceptResearcherInvitation,
  createOrganizationAccount,
  createOrganizationInvitation,
  createResearcherAccount,
  createResearcherInvitation,
  disableTwoFactorEmail,
  enableTwoFactorEmail,
  findOrganizationById,
  findOrganizationInvitationByTokenHash,
  findResearcherInvitationByTokenHash,
  findResearcherVerificationByDocumentPath,
  findResearcherVerificationByUserId,
  findPendingEmailVerificationByEmail,
  findUserByEmail,
  findUserById,
  incrementVerificationCodeAttempts,
  getPlatformMetrics,
  listAuthAuditEvents,
  listInternalResearchers,
  listOrganizations,
  listResearcherInvitations,
  listResearcherVerifications,
  resetPasswordByTokenHash,
  reviewOrganizationApproval,
  reviewResearcherVerification,
  storePasswordResetToken,
  storeTwoFactorOtp,
  getTwoFactorOtpData,
  incrementOtpAttempts,
  resetTwoFactorOtp,
  submitResearcherVerification,
  updateVerificationToken,
  verifyUserByEmailAndCodeHash,
  verifyUserByTokenHash
} from '../repositories/userRepository.js';
import {
  sendOrganizationDecisionEmail,
  sendOrganizationInviteEmail,
  sendPasswordResetEmail,
  sendResearcherDecisionEmail,
  sendResearcherInviteEmail,
  sendTwoFactorOtpEmail,
  sendVerificationEmail,
  verifyEmailTransport
} from '../services/emailService.js';
import { recordAuditEvent } from '../services/auditService.js';
import {
  ensureStorageReady,
  normalizeStoredObjectKey,
  readVerificationDocument,
  storeVerificationDocument
} from '../services/storageService.js';

function normalizeEmail(email) {
  return String(email ?? '').trim().toLowerCase();
}

function sanitizeUser(user) {
  return {
    id: user.id,
    email: user.email,
    accountType: user.account_type,
    researcherType: user.researcher_type,
    firstName: user.first_name,
    lastName: user.last_name,
    displayName: user.display_name,
    jobTitle: user.job_title,
    emailVerified: Boolean(user.email_verified_at),
    twoFactorEnabled: Boolean(user.two_factor_enabled_at),
    approvalStatus: user.approval_status,
    organization: user.organization
  };
}

function buildVerificationEntryUrl(email, accountType) {
  const query = new URLSearchParams({
    email,
    accountType
  });
  return `${config.frontendBaseUrl}/researchers/confirm-email?${query.toString()}`;
}

function generateVerificationCode() {
  const digits = Math.max(4, config.security.verificationCodeLength);
  const upper = 10 ** digits;
  const lower = 10 ** (digits - 1);
  return String(randomInt(lower, upper));
}

function buildPasswordResetUrl(token) {
  return `${config.frontendBaseUrl}/reset-password?token=${encodeURIComponent(token)}`;
}

function buildOrganizationInvitationUrl(token) {
  return `${config.frontendBaseUrl}/company/invite/accept?token=${encodeURIComponent(token)}`;
}

function buildResearcherInvitationUrl(token) {
  return `${config.frontendBaseUrl}/create-password?token=${encodeURIComponent(token)}`;
}

function buildUploadUrl(filePath) {
  const normalizedPath = normalizeStoredObjectKey(filePath);
  if (!normalizedPath) {
    return null;
  }

  const encodedPath = normalizedPath
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');

  return `${config.publicAuthBaseUrl}/uploads/${encodedPath}`;
}

function buildServiceIdentity(user) {
  return {
    userId: user.id,
    email: user.email,
    accountType: user.account_type,
    researcherType: user.researcher_type,
    approvalStatus: user.approval_status,
    organizationId: user.organization?.id ?? null,
    organizationSlug: user.organization?.slug ?? null,
    organizationRole: user.organization?.role ?? null,
    emailVerified: Boolean(user.email_verified_at),
    twoFactorEnabled: Boolean(user.two_factor_enabled_at)
  };
}

function buildForwardedIdentityHeaders(identity) {
  return Object.fromEntries(
    Object.entries({
      'x-antcrowd-user-id': identity.userId,
      'x-antcrowd-account-type': identity.accountType,
      'x-antcrowd-email': identity.email,
      'x-antcrowd-researcher-type': identity.researcherType,
      'x-antcrowd-approval-status': identity.approvalStatus,
      'x-antcrowd-organization-id': identity.organizationId,
      'x-antcrowd-organization-role': identity.organizationRole,
      'x-antcrowd-organization-slug': identity.organizationSlug
    }).filter(([, value]) => value !== null && value !== undefined && value !== '')
  );
}

function sanitizeVerification(verification) {
  if (!verification) {
    return {
      status: 'pending_submission',
      countryOfIssue: '',
      certificationsSummary: '',
      nationalIdDocumentName: null,
      nationalIdDocumentUrl: null,
      certificationDocumentName: null,
      certificationDocumentUrl: null,
      reviewerNotes: '',
      submittedAt: null,
      reviewedAt: null,
      reviewerName: null
    };
  }

  return {
    status: verification.status,
    countryOfIssue: verification.country_of_issue ?? '',
    certificationsSummary: verification.certifications_summary ?? '',
    nationalIdDocumentName: verification.national_id_document_name,
    nationalIdDocumentUrl: buildUploadUrl(verification.national_id_document_path),
    certificationDocumentName: verification.certification_document_name,
    certificationDocumentUrl: buildUploadUrl(verification.certification_document_path),
    reviewerNotes: verification.reviewer_notes ?? '',
    submittedAt: verification.submitted_at,
    reviewedAt: verification.reviewed_at,
    reviewerName:
      verification.reviewer_first_name && verification.reviewer_last_name
        ? `${verification.reviewer_first_name} ${verification.reviewer_last_name}`
        : null
  };
}

function requireStrongPassword(password) {
  if (typeof password !== 'string' || password.length < 10) {
    throw badRequest('Password must be at least 10 characters long.');
  }

  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
    throw badRequest('Password must include uppercase, lowercase, and numeric characters.');
  }
}

function ensurePlatformAdmin(req) {
  if (req.user.account_type !== 'platform_admin') {
    throw forbidden('Platform admin access is required.');
  }
}

function ensureResearcher(req) {
  if (req.user.account_type !== 'researcher') {
    throw forbidden('Researcher access is required.');
  }
}

function isNonProduction() {
  return config.nodeEnv !== 'production';
}

function buildDeliveryPayload(basePayload, {
  deliveryStatus = 'sent',
  fallbackLink = null,
  fallbackCode = null,
  fallbackMessage = null
} = {}) {
  return {
    ...basePayload,
    emailDelivery: deliveryStatus,
    ...(fallbackLink && isNonProduction() ? { fallbackLink } : {}),
    ...(fallbackCode && isNonProduction() ? { fallbackCode } : {}),
    ...(fallbackMessage ? { message: fallbackMessage } : {})
  };
}

export async function readiness(req, res) {
  await pool.query('SELECT 1');
  await ensureStorageReady();
  const deepEmailCheck = String(req.query.deep ?? '').trim() === '1';
  const emailTransport = deepEmailCheck
    ? await verifyEmailTransport()
    : {
        ok: true,
        provider: config.email.provider,
        skipped: true
      };

  res.status(emailTransport.ok ? 200 : 503).json({
    status: emailTransport.ok ? 'ok' : 'degraded',
    emailProvider: config.email.provider,
    storageProvider: config.storage.provider,
    emailTransport
  });
}

export function getCsrfToken(req, res) {
  issueCsrfToken(req, res);
}

export async function introspectSession(req, res) {
  const sessionToken = String(req.body.sessionToken ?? readSessionToken(req) ?? '').trim();
  if (!sessionToken) {
    throw badRequest('Session token is required.');
  }

  let payload;
  try {
    payload = verifyJwt(sessionToken);
  } catch {
    throw unauthorized('Invalid session token.');
  }

  if (payload.kind !== 'session') {
    throw unauthorized('Invalid session token.');
  }

  const user = await findUserById(payload.sub);
  if (!user || user.session_version !== payload.sessionVersion) {
    throw unauthorized('Session is no longer valid.');
  }

  // Look up platform role assignment
  const roleResult = await pool.query(
    'SELECT platform_role FROM platform_role_assignments WHERE user_id = $1 LIMIT 1',
    [user.id]
  );
  const platformRole = roleResult.rows.length > 0 ? roleResult.rows[0].platform_role : null;

  const identity = buildServiceIdentity(user);
  res.json({
    user: sanitizeUser(user),
    identity,
    headers: buildForwardedIdentityHeaders(identity),
    platformRole
  });
}

export async function register(req, res) {
  const accountType = String(req.body.accountType ?? '').trim().toLowerCase();
  const email = normalizeEmail(req.body.email);
  const password = String(req.body.password ?? '');
  const firstName = String(req.body.firstName ?? '').trim();
  const lastName = String(req.body.lastName ?? '').trim();

  if (!['researcher', 'organization'].includes(accountType)) {
    throw badRequest('Please choose either a researcher or organization account.');
  }

  if (!email || !firstName || !lastName) {
    throw badRequest('First name, last name, and email are required.');
  }

  requireStrongPassword(password);

  const existingUser = await findUserByEmail(email);
  if (existingUser) {
    throw conflict('An account with that email already exists.');
  }

  const passwordHash = await hashPassword(password);
  const verificationCode = generateVerificationCode();
  const verificationTokenHash = hashToken(verificationCode);
  const verificationTokenExpiresAt = new Date(Date.now() + config.security.verificationMinutes * 60 * 1000);

  let user;

  if (accountType === 'researcher') {
    const researcherType = String(req.body.researcherType ?? '').trim().toLowerCase();
    if (researcherType !== 'external') {
      throw badRequest('Internal researchers are invite-only. Ask a platform admin for an invitation link.');
    }

    user = await createResearcherAccount({
      email,
      passwordHash,
      firstName,
      lastName,
      displayName: String(req.body.displayName ?? '').trim(),
      researcherType,
      verificationTokenHash,
      verificationTokenExpiresAt,
      approvalStatus: 'pending_submission'
    });
  } else {
    const organizationName = String(req.body.organizationName ?? '').trim();
    if (!organizationName) {
      throw badRequest('Organization name is required.');
    }

    user = await createOrganizationAccount({
      email,
      passwordHash,
      firstName,
      lastName,
      jobTitle: String(req.body.jobTitle ?? '').trim(),
      organizationName,
      website: String(req.body.website ?? '').trim(),
      verificationTokenHash,
      verificationTokenExpiresAt
    });
  }

  const verificationEntryUrl = buildVerificationEntryUrl(user.email, accountType);
  let responsePayload = {
    message:
      accountType === 'researcher'
        ? `External researcher account created. Enter the ${config.security.verificationCodeLength}-digit code from your email to verify, then submit your verification documents for approval.`
        : `Organization account created. Enter the ${config.security.verificationCodeLength}-digit code from your email to verify, then wait for platform admin approval before first login.`,
    user: sanitizeUser(user)
  };
  try {
    await sendVerificationEmail({
      to: user.email,
      firstName: user.first_name,
      verificationCode,
      verificationEntryUrl,
      accountType
    });
    responsePayload = buildDeliveryPayload(responsePayload);
  } catch (error) {
    responsePayload = buildDeliveryPayload(responsePayload, {
      deliveryStatus: 'failed',
      fallbackLink: verificationEntryUrl,
      fallbackCode: verificationCode,
      fallbackMessage:
        'Account created, but verification code delivery is unavailable right now. Use the fallback page below in development or retry after email is restored.'
    });
  }
  await recordAuditEvent(req, {
    actorUserId: user.id,
    targetUserId: user.id,
    eventType: 'account_registered',
    accountType: user.account_type,
    subjectType: accountType,
    subjectId: user.id,
    metadata:
      accountType === 'researcher'
        ? { researcherType: user.researcher_type }
        : { organizationId: user.organization?.id ?? null }
  });

  res.status(201).json({
    ...responsePayload
  });
}

export async function resendVerificationEmail(req, res) {
  const email = normalizeEmail(req.body.email);
  if (!email) {
    throw badRequest('Email is required.');
  }

  const user = await findUserByEmail(email);
  if (!user) {
    res.json({ message: 'If that account exists, a new verification code has been sent.' });
    return;
  }

  if (user.email_verified_at) {
    res.json({ message: 'That email address is already verified.' });
    return;
  }

  const lastSentAt = user.verification_code_last_sent_at
    ? new Date(user.verification_code_last_sent_at).getTime()
    : null;
  if (lastSentAt) {
    const cooldownMs = config.security.verificationResendCooldownSeconds * 1000;
    const remainingMs = lastSentAt + cooldownMs - Date.now();
    if (remainingMs > 0) {
      const remainingSeconds = Math.ceil(remainingMs / 1000);
      throw badRequest(`Please wait ${remainingSeconds}s before requesting another verification code.`);
    }
  }

  const verificationCode = generateVerificationCode();
  const verificationTokenHash = hashToken(verificationCode);
  const verificationTokenExpiresAt = new Date(Date.now() + config.security.verificationMinutes * 60 * 1000);

  await updateVerificationToken(user.id, verificationTokenHash, verificationTokenExpiresAt);
  const verificationEntryUrl = buildVerificationEntryUrl(user.email, user.account_type);
  let message = 'If that account exists, a new verification code has been sent.';
  let deliveryStatus = 'sent';
  try {
    await sendVerificationEmail({
      to: user.email,
      firstName: user.first_name,
      verificationCode,
      verificationEntryUrl,
      accountType: user.account_type
    });
  } catch {
    message = 'Verification code delivery is unavailable right now. Retry when email is restored.';
    deliveryStatus = 'failed';
  }
  await recordAuditEvent(req, {
    actorUserId: user.id,
    targetUserId: user.id,
    eventType: 'verification_email_resent',
    accountType: user.account_type,
    subjectType: user.account_type,
    subjectId: user.id
  });

  res.json(
    buildDeliveryPayload(
      { message },
      {
        deliveryStatus,
        fallbackLink: verificationEntryUrl,
        fallbackCode: deliveryStatus === 'failed' ? verificationCode : null
      }
    )
  );
}

export async function verifyEmail(req, res) {
  const token = String(req.body.token ?? req.query.token ?? '').trim();
  const email = normalizeEmail(req.body.email);
  const code = String(req.body.code ?? '').trim();

  let user = null;

  if (token) {
    user = await verifyUserByTokenHash(hashToken(token));
    if (!user) {
      throw badRequest('That verification link is invalid or has expired.');
    }
  } else {
    if (!email || !code) {
      throw badRequest('Email and verification code are required.');
    }
    if (!/^\d+$/.test(code) || code.length !== config.security.verificationCodeLength) {
      throw badRequest(`Verification code must be ${config.security.verificationCodeLength} digits.`);
    }

    user = await verifyUserByEmailAndCodeHash(
      email,
      hashToken(code),
      config.security.verificationCodeMaxAttempts
    );
    if (!user) {
      const verification = await findPendingEmailVerificationByEmail(email);
      if (!verification || verification.email_verified_at) {
        throw badRequest('Verification code is invalid or has expired.');
      }

      if (
        !verification.verification_token_expires_at ||
        new Date(verification.verification_token_expires_at).getTime() <= Date.now()
      ) {
        throw badRequest('Verification code has expired. Request a new code and try again.');
      }

      const currentAttempts = Number(verification.verification_code_attempts ?? 0);
      if (currentAttempts >= config.security.verificationCodeMaxAttempts) {
        throw badRequest('Too many incorrect attempts. Request a new verification code.');
      }

      const nextAttempts = await incrementVerificationCodeAttempts(verification.id);
      const attemptsUsed = Number(nextAttempts ?? currentAttempts + 1);
      const attemptsRemaining = Math.max(0, config.security.verificationCodeMaxAttempts - attemptsUsed);
      throw badRequest(
        attemptsRemaining > 0
          ? `Incorrect verification code. ${attemptsRemaining} attempt(s) remaining.`
          : 'Too many incorrect attempts. Request a new verification code.'
      );
    }
  }
  await recordAuditEvent(req, {
    actorUserId: user.id,
    targetUserId: user.id,
    eventType: 'email_verified',
    accountType: user.account_type,
    subjectType: user.account_type,
    subjectId: user.id
  });

  const verificationMessage =
    user.account_type === 'organization' && !['approved', 'not_required'].includes(user.approval_status)
      ? 'Your email has been verified. A platform admin must approve your organization before first login.'
      : 'Your email has been verified. You can now sign in.';

  res.json({
    message: verificationMessage,
    user: sanitizeUser(user)
  });
}

export async function login(req, res) {
  const email = normalizeEmail(req.body.email);
  const password = String(req.body.password ?? '');
  const rememberMe = Boolean(req.body.rememberMe);

  if (!email || !password) {
    throw badRequest('Email and password are required.');
  }

  const user = await findUserByEmail(email);
  if (!user) {
    throw unauthorized('Invalid email or password.');
  }

  const passwordMatches = await verifyPassword(password, user.password_hash);
  if (!passwordMatches) {
    throw unauthorized('Invalid email or password.');
  }

  if (!user.email_verified_at) {
    throw forbidden('Please verify your email with the code we sent before logging in.');
  }

  if (user.two_factor_enabled_at) {
    const otp = String(randomInt(100000, 999999));
    const otpHash = crypto.createHash('sha256').update(otp).digest('hex');
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await storeTwoFactorOtp(user.id, otpHash, otpExpiresAt);
    try {
      await sendTwoFactorOtpEmail(user.email, user.display_name || user.first_name, otp);
    } catch (emailError) {
      console.warn('Failed to send 2FA OTP email', emailError?.message ?? emailError);
    }
    const challengeToken = signTwoFactorChallenge(user.id);
    await recordAuditEvent(req, {
      actorUserId: user.id,
      targetUserId: user.id,
      eventType: 'login_two_factor_challenge_issued',
      accountType: user.account_type,
      subjectType: user.account_type,
      subjectId: user.id
    });
    res.status(202).json({
      message: 'Code sent to your email.',
      requiresTwoFactor: true,
      challengeToken,
      email: user.email,
      rememberMe
    });
    return;
  }

  const token = signSessionToken(user, rememberMe);
  setSessionCookie(res, token, rememberMe);
  await recordAuditEvent(req, {
    actorUserId: user.id,
    targetUserId: user.id,
    eventType: 'login_succeeded',
    accountType: user.account_type,
    subjectType: user.account_type,
    subjectId: user.id
  });

  // Look up platform role for the logged-in user
  const loginRoleResult = await pool.query(
    'SELECT platform_role FROM platform_role_assignments WHERE user_id = $1 LIMIT 1',
    [user.id]
  );
  const loginPlatformRole = loginRoleResult.rows.length > 0 ? loginRoleResult.rows[0].platform_role : null;

  res.json({
    message: 'Login successful.',
    user: { ...sanitizeUser(user), platformRole: loginPlatformRole }
  });
}

export async function verifyLoginTwoFactor(req, res) {
  const challengeToken = String(req.body.challengeToken ?? '').trim();
  const code = String(req.body.code ?? '').trim();
  const rememberMe = Boolean(req.body.rememberMe);

  if (!challengeToken || !code) {
    throw badRequest('Two-factor challenge and code are required.');
  }

  let payload;
  try {
    payload = verifyJwt(challengeToken);
  } catch {
    throw unauthorized('Your two-factor challenge has expired. Please sign in again.');
  }

  if (payload.kind !== '2fa-challenge') {
    throw unauthorized('Invalid two-factor challenge.');
  }

  const user = await findUserById(payload.sub);
  if (!user) {
    throw unauthorized('Two-factor authentication is not enabled for this account.');
  }

  const otpData = await getTwoFactorOtpData(user.id);
  if (!otpData || !otpData.two_factor_otp_hash) {
    throw unauthorized('No pending code. Sign in again.');
  }

  if (otpData.two_factor_otp_attempts >= 5) {
    await resetTwoFactorOtp(user.id);
    throw unauthorized('Too many failed attempts. Sign in again.');
  }

  if (new Date(otpData.two_factor_otp_expires_at) < new Date()) {
    await resetTwoFactorOtp(user.id);
    throw unauthorized('Code expired. Sign in again.');
  }

  const submittedHash = crypto.createHash('sha256').update(code.trim()).digest('hex');
  if (submittedHash !== otpData.two_factor_otp_hash) {
    await incrementOtpAttempts(user.id);
    throw unauthorized('Invalid code.');
  }

  await resetTwoFactorOtp(user.id);

  const token = signSessionToken(user, rememberMe);
  setSessionCookie(res, token, rememberMe);
  await recordAuditEvent(req, {
    actorUserId: user.id,
    targetUserId: user.id,
    eventType: 'login_two_factor_verified',
    accountType: user.account_type,
    subjectType: user.account_type,
    subjectId: user.id
  });

  // Look up platform role for the logged-in user
  const tfaRoleResult = await pool.query(
    'SELECT platform_role FROM platform_role_assignments WHERE user_id = $1 LIMIT 1',
    [user.id]
  );
  const tfaPlatformRole = tfaRoleResult.rows.length > 0 ? tfaRoleResult.rows[0].platform_role : null;

  res.json({
    message: 'Login successful.',
    user: { ...sanitizeUser(user), platformRole: tfaPlatformRole }
  });
}

export async function forgotPassword(req, res) {
  const email = normalizeEmail(req.body.email);
  if (!email) {
    throw badRequest('Email is required.');
  }

  const user = await findUserByEmail(email);
  if (!user) {
    res.json({ message: 'If that account exists, password reset instructions have been sent.' });
    return;
  }

  const token = generateToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + config.security.passwordResetMinutes * 60 * 1000);

  await storePasswordResetToken(user.id, tokenHash, expiresAt);
  const resetUrl = buildPasswordResetUrl(token);
  let message = 'If that account exists, password reset instructions have been sent.';
  let deliveryStatus = 'sent';
  try {
    await sendPasswordResetEmail({
      to: user.email,
      firstName: user.first_name,
      resetUrl
    });
  } catch {
    message = 'Password reset delivery is unavailable right now. Use the fallback link below in development or retry when email is restored.';
    deliveryStatus = 'failed';
  }
  await recordAuditEvent(req, {
    actorUserId: user.id,
    targetUserId: user.id,
    eventType: 'password_reset_requested',
    accountType: user.account_type,
    subjectType: user.account_type,
    subjectId: user.id
  });

  res.json(
    buildDeliveryPayload(
      { message },
      {
        deliveryStatus,
        fallbackLink: resetUrl
      }
    )
  );
}

export async function resetPassword(req, res) {
  const token = String(req.body.token ?? '').trim();
  const password = String(req.body.password ?? '');

  if (!token) {
    throw badRequest('Reset token is required.');
  }

  requireStrongPassword(password);

  const passwordHash = await hashPassword(password);
  const user = await resetPasswordByTokenHash(hashToken(token), passwordHash);
  if (!user) {
    throw badRequest('That reset link is invalid or has expired.');
  }
  await recordAuditEvent(req, {
    actorUserId: user.id,
    targetUserId: user.id,
    eventType: 'password_reset_completed',
    accountType: user.account_type,
    subjectType: user.account_type,
    subjectId: user.id
  });

  clearSessionCookie(res);
  res.json({ message: 'Your password has been updated. Please sign in with your new password.' });
}

export async function getCurrentSession(req, res) {
  // Look up platform role assignment
  const roleResult = await pool.query(
    'SELECT platform_role FROM platform_role_assignments WHERE user_id = $1 LIMIT 1',
    [req.user.id]
  );
  const platformRole = roleResult.rows.length > 0 ? roleResult.rows[0].platform_role : null;

  res.json({
    user: { ...sanitizeUser(req.user), platformRole }
  });
}

export async function logout(_req, res) {
  clearSessionCookie(res);
  res.json({ message: 'Logged out successfully.' });
}

export async function beginTwoFactorSetup(req, res) {
  res.json({
    message: 'Use your security settings to enable email 2FA.'
  });
}

export async function enableTwoFactorForAccount(req, res) {
  const password = String(req.body.password ?? '');

  if (!password) {
    throw badRequest('Password is required.');
  }

  const passwordMatches = await verifyPassword(password, req.user.password_hash);
  if (!passwordMatches) {
    throw badRequest('Incorrect password.');
  }

  const updatedUser = await enableTwoFactorEmail(req.user.id);
  await recordAuditEvent(req, {
    actorUserId: req.user.id,
    targetUserId: req.user.id,
    eventType: 'two_factor_enabled',
    accountType: req.user.account_type,
    subjectType: req.user.account_type,
    subjectId: req.user.id
  });

  res.json({
    message: 'Two-factor authentication enabled. A code will be emailed at next login.',
    user: sanitizeUser(updatedUser)
  });
}

export async function disableTwoFactorForAccount(req, res) {
  const password = String(req.body.password ?? '');

  if (!password) {
    throw badRequest('Password is required.');
  }

  const passwordMatches = await verifyPassword(password, req.user.password_hash);
  if (!passwordMatches) {
    throw unauthorized('Your password is incorrect.');
  }

  const updatedUser = await disableTwoFactorEmail(req.user.id);
  await recordAuditEvent(req, {
    actorUserId: req.user.id,
    targetUserId: req.user.id,
    eventType: 'two_factor_disabled',
    accountType: req.user.account_type,
    subjectType: req.user.account_type,
    subjectId: req.user.id
  });
  res.json({
    message: 'Two-factor authentication disabled.',
    user: sanitizeUser(updatedUser)
  });
}

export async function createOrganizationMemberInvitation(req, res) {
  if (req.user.account_type !== 'organization' || !req.user.organization) {
    throw forbidden('Only organization users can invite teammates.');
  }

  const organizationRole = req.user.organization.role;
  if (!['owner', 'admin'].includes(organizationRole)) {
    throw forbidden('Only owners and admins can invite teammates.');
  }

  const email = normalizeEmail(req.body.email);
  const role = String(req.body.role ?? '').trim().toLowerCase();
  if (!email || !['admin', 'manager', 'member'].includes(role)) {
    throw badRequest('Invite email and role are required.');
  }

  const existingUser = await findUserByEmail(email);
  if (existingUser) {
    throw conflict('An account with that email already exists.');
  }

  const invitationToken = generateToken();
  await createOrganizationInvitation({
    organizationId: req.user.organization.id,
    invitedByUserId: req.user.id,
    email,
    role,
    tokenHash: hashToken(invitationToken),
    expiresAt: new Date(Date.now() + config.security.inviteHours * 60 * 60 * 1000)
  });

  const inviteUrl = buildOrganizationInvitationUrl(invitationToken);
  let message = 'Invitation sent successfully.';
  let deliveryStatus = 'sent';
  try {
    await sendOrganizationInviteEmail({
      to: email,
      organizationName: req.user.organization.name,
      inviteUrl,
      role
    });
  } catch {
    message = 'Invitation created, but email delivery is unavailable right now. Share the invite link below or resend later.';
    deliveryStatus = 'failed';
  }
  await recordAuditEvent(req, {
    actorUserId: req.user.id,
    eventType: 'organization_invitation_created',
    accountType: req.user.account_type,
    subjectType: 'organization_invitation',
    subjectId: req.user.organization.id,
    metadata: {
      email,
      role,
      organizationId: req.user.organization.id
    }
  });

  res.status(201).json(
    buildDeliveryPayload(
      {
        message,
        inviteLink: inviteUrl
      },
      {
        deliveryStatus,
        fallbackLink: inviteUrl
      }
    )
  );
}

export async function getOrganizationInvitation(req, res) {
  const token = String(req.params.token ?? '').trim();
  if (!token) {
    throw badRequest('Invitation token is required.');
  }

  const invitation = await findOrganizationInvitationByTokenHash(hashToken(token));
  if (!invitation) {
    throw notFound('Invitation not found or expired.');
  }

  res.json({
    email: invitation.email,
    orgName: invitation.organization_name,
    role: invitation.role
  });
}

export async function acceptOrganizationWorkspaceInvitation(req, res) {
  const token = String(req.body.token ?? '').trim();
  const password = String(req.body.password ?? '');
  const firstName = String(req.body.firstName ?? '').trim();
  const lastName = String(req.body.lastName ?? '').trim();

  if (!token) {
    throw badRequest('Invitation token is required.');
  }

  requireStrongPassword(password);

  const user = await acceptOrganizationInvitation({
    tokenHash: hashToken(token),
    passwordHash: await hashPassword(password),
    firstName,
    lastName
  });

  if (!user) {
    throw badRequest('Invitation not found or expired.');
  }

  await recordAuditEvent(req, {
    actorUserId: user.id,
    targetUserId: user.id,
    eventType: 'organization_invitation_accepted',
    accountType: user.account_type,
    subjectType: 'organization',
    subjectId: user.organization?.id ?? null
  });
  res.status(201).json({
    message: 'Invitation accepted. You can now sign in.',
    user: sanitizeUser(user)
  });
}

export async function getResearcherVerification(req, res) {
  ensureResearcher(req);

  const verification = await findResearcherVerificationByUserId(req.user.id);
  res.json({
    approvalStatus: req.user.approval_status,
    verification: sanitizeVerification(verification)
  });
}

export async function submitResearcherVerificationDocuments(req, res) {
  ensureResearcher(req);

  const countryOfIssue = String(req.body.countryOfIssue ?? '').trim();
  const certificationsSummary = String(req.body.certificationsSummary ?? '').trim();
  const files = req.files ?? {};
  const nationalIdFile = files.nationalIdDocument?.[0] ?? null;
  const certificationFile = files.certificationDocument?.[0] ?? null;
  const existingVerification = await findResearcherVerificationByUserId(req.user.id);

  if (!countryOfIssue && !existingVerification?.country_of_issue) {
    throw badRequest('Country of issue is required.');
  }

  if (!nationalIdFile && !existingVerification?.national_id_document_path) {
    throw badRequest('A national ID document is required.');
  }

  if (!certificationFile && !existingVerification?.certification_document_path) {
    throw badRequest('A certification document is required.');
  }

  const nationalIdUpload = nationalIdFile
    ? await storeVerificationDocument({
        category: 'national-ids',
        userId: req.user.id,
        file: nationalIdFile
      })
    : null;
  const certificationUpload = certificationFile
    ? await storeVerificationDocument({
        category: 'certifications',
        userId: req.user.id,
        file: certificationFile
      })
    : null;

  const verification = await submitResearcherVerification({
    userId: req.user.id,
    countryOfIssue,
    certificationsSummary,
    nationalIdDocumentName: nationalIdUpload?.originalName,
    nationalIdDocumentPath: nationalIdUpload?.objectKey,
    certificationDocumentName: certificationUpload?.originalName,
    certificationDocumentPath: certificationUpload?.objectKey
  });
  const user = await findUserById(req.user.id);
  await recordAuditEvent(req, {
    actorUserId: req.user.id,
    targetUserId: req.user.id,
    eventType: 'researcher_verification_submitted',
    accountType: req.user.account_type,
    subjectType: 'researcher_verification',
    subjectId: req.user.id,
    metadata: {
      researcherType: req.user.researcher_type,
      includedNationalId: Boolean(nationalIdUpload || existingVerification?.national_id_document_path),
      includedCertification: Boolean(certificationUpload || existingVerification?.certification_document_path)
    }
  });

  res.json({
    message: 'Verification documents submitted for platform admin review.',
    approvalStatus: user.approval_status,
    verification: sanitizeVerification(verification)
  });
}

export async function createResearcherAccessInvitation(req, res) {
  ensurePlatformAdmin(req);

  const email = normalizeEmail(req.body.email);
  const fullName = String(req.body.fullName ?? '').trim();
  const researcherType = String(req.body.researcherType ?? '').trim().toLowerCase();
  const notes = String(req.body.notes ?? '').trim();

  if (!email || !['internal', 'external'].includes(researcherType)) {
    throw badRequest('Invite email and researcher type are required.');
  }

  const existingUser = await findUserByEmail(email);
  if (existingUser) {
    throw conflict('An account with that email already exists.');
  }

  const invitationToken = generateToken();
  await createResearcherInvitation({
    email,
    researcherType,
    invitedByUserId: req.user.id,
    notes,
    tokenHash: hashToken(invitationToken),
    expiresAt: new Date(Date.now() + config.security.researcherInviteHours * 60 * 60 * 1000)
  });

  const inviteUrl = buildResearcherInvitationUrl(invitationToken);
  let message = 'Researcher invitation sent successfully.';
  let deliveryStatus = 'sent';
  try {
    await sendResearcherInviteEmail({
      to: email,
      inviteUrl,
      fullName,
      researcherType,
      notes
    });
  } catch {
    message = 'Researcher invitation created, but email delivery is unavailable right now. Share the invite link below or resend later.';
    deliveryStatus = 'failed';
  }
  await recordAuditEvent(req, {
    actorUserId: req.user.id,
    eventType: 'researcher_invitation_created',
    accountType: req.user.account_type,
    subjectType: 'researcher_invitation',
    subjectId: email,
    metadata: {
      email,
      researcherType,
      fullName: fullName || null
    }
  });

  res.status(201).json(
    buildDeliveryPayload(
      {
        message,
        inviteLink: inviteUrl
      },
      {
        deliveryStatus,
        fallbackLink: inviteUrl
      }
    )
  );
}

export async function getResearcherAccessInvitation(req, res) {
  const token = String(req.params.token ?? '').trim();
  if (!token) {
    throw badRequest('Invitation token is required.');
  }

  const invitation = await findResearcherInvitationByTokenHash(hashToken(token));
  if (!invitation) {
    throw notFound('Invitation not found or expired.');
  }

  res.json({
    email: invitation.email,
    researcherType: invitation.researcher_type,
    notes: invitation.notes ?? ''
  });
}

export async function acceptResearcherAccessInvitation(req, res) {
  const token = String(req.body.token ?? '').trim();
  const password = String(req.body.password ?? '');
  const firstName = String(req.body.firstName ?? '').trim();
  const lastName = String(req.body.lastName ?? '').trim();
  const displayName = String(req.body.displayName ?? '').trim();

  if (!token) {
    throw badRequest('Invitation token is required.');
  }

  requireStrongPassword(password);

  const user = await acceptResearcherInvitation({
    tokenHash: hashToken(token),
    passwordHash: await hashPassword(password),
    firstName,
    lastName,
    displayName
  });

  if (!user) {
    throw badRequest('Invitation not found or expired.');
  }

  await recordAuditEvent(req, {
    actorUserId: user.id,
    targetUserId: user.id,
    eventType: 'researcher_invitation_accepted',
    accountType: user.account_type,
    subjectType: 'researcher',
    subjectId: user.id,
    metadata: {
      researcherType: user.researcher_type
    }
  });
  res.status(201).json({
    message:
      user.researcher_type === 'internal'
        ? 'Researcher account activated. Sign in to open your ANTCROWD workspace.'
        : 'Researcher account activated. Sign in and complete your verification submission.',
    user: sanitizeUser(user)
  });
}

export async function getPlatformOverview(req, res) {
  ensurePlatformAdmin(req);
  const metrics = await getPlatformMetrics();
  res.json(metrics);
}

export async function getPlatformResearcherInvitations(req, res) {
  ensurePlatformAdmin(req);
  const invitations = await listResearcherInvitations();
  res.json({
    invitations: invitations.map((item) => ({
      id: item.id,
      email: item.email,
      researcherType: item.researcher_type,
      notes: item.notes ?? '',
      acceptedAt: item.accepted_at,
      expiresAt: item.expires_at,
      createdAt: item.created_at,
      invitedBy:
        item.inviter_first_name && item.inviter_last_name
          ? `${item.inviter_first_name} ${item.inviter_last_name}`
          : null
    }))
  });
}

export async function getPlatformOrganizations(req, res) {
  ensurePlatformAdmin(req);
  const organizations = await listOrganizations();
  res.json({
    organizations: organizations.map((item) => ({
      id: item.id,
      name: item.name,
      slug: item.slug,
      website: item.website,
      billingEmail: item.billing_email,
      createdAt: item.created_at,
      memberCount: Number(item.member_count ?? 0),
      ownerUserId: item.owner_user_id,
      ownerApprovalStatus: item.owner_approval_status ?? 'submitted',
      approvalStatus: item.owner_approval_status ?? 'submitted',
      ownerName:
        item.owner_first_name && item.owner_last_name
          ? `${item.owner_first_name} ${item.owner_last_name}`
          : null,
      ownerEmail: item.owner_email
    }))
  });
}

export async function getPlatformAuditFeed(req, res) {
  ensurePlatformAdmin(req);
  const audit = await listAuthAuditEvents();
  res.json({
    audit: audit.map((item) => ({
      id: item.id,
      eventType: item.event_type,
      outcome: item.outcome,
      accountType: item.account_type,
      subjectType: item.subject_type,
      subjectId: item.subject_id,
      occurredAt: item.occurred_at,
      ipAddress: item.ip_address,
      userAgent: item.user_agent,
      metadata: item.metadata ?? {},
      actorName:
        item.actor_first_name && item.actor_last_name
          ? `${item.actor_first_name} ${item.actor_last_name}`
          : item.actor_email ?? null,
      actorEmail: item.actor_email ?? null,
      targetName:
        item.target_first_name && item.target_last_name
          ? `${item.target_first_name} ${item.target_last_name}`
          : item.target_email ?? null,
      targetEmail: item.target_email ?? null
    }))
  });
}

export async function listResearcherVerificationQueue(req, res) {
  ensurePlatformAdmin(req);
  const queue = await listResearcherVerifications();
  res.json({
    queue: queue.map((item) => ({
      id: item.id,
      userId: item.user_id,
      email: item.email,
      firstName: item.first_name,
      lastName: item.last_name,
      displayName: item.display_name,
      researcherType: item.researcher_type,
      verification: sanitizeVerification(item)
    }))
  });
}

export async function reviewResearcherVerificationSubmission(req, res) {
  ensurePlatformAdmin(req);

  const userId = String(req.params.userId ?? '').trim();
  const status = String(req.body.status ?? '').trim().toLowerCase();
  const reviewerNotes = String(req.body.reviewerNotes ?? '').trim();

  if (!userId || !['approved', 'rejected'].includes(status)) {
    throw badRequest('A researcher id and review status are required.');
  }

  const researcher = await findUserById(userId);
  if (!researcher || researcher.account_type !== 'researcher') {
    throw notFound('Researcher not found.');
  }

  const currentVerification = await findResearcherVerificationByUserId(userId);
  if (!currentVerification) {
    throw badRequest('Researcher verification record is not available yet.');
  }

  const hasRequiredDocuments = Boolean(
    currentVerification.national_id_document_path && currentVerification.certification_document_path
  );
  if (currentVerification.status !== 'submitted' || !hasRequiredDocuments) {
    throw badRequest(
      'Researcher review can only be completed after the researcher submits both national ID and certification documents.'
    );
  }

  const verification = await reviewResearcherVerification({
    userId,
    reviewerId: req.user.id,
    status,
    reviewerNotes
  });

  let message = status === 'approved' ? 'Researcher approved for service access.' : 'Researcher marked for resubmission.';
  let deliveryStatus = 'sent';
  try {
    await sendResearcherDecisionEmail({
      to: researcher.email,
      firstName: researcher.first_name,
      status,
      notes: reviewerNotes
    });
  } catch {
    message =
      status === 'approved'
        ? 'Researcher approved, but the approval email could not be delivered right now.'
        : 'Researcher marked for resubmission, but the notification email could not be delivered right now.';
    deliveryStatus = 'failed';
  }
  await recordAuditEvent(req, {
    actorUserId: req.user.id,
    targetUserId: userId,
    eventType: 'researcher_verification_reviewed',
    accountType: req.user.account_type,
    subjectType: 'researcher_verification',
    subjectId: userId,
    metadata: {
      status,
      reviewerNotes
    }
  });

  res.json({
    message,
    emailDelivery: deliveryStatus,
    verification: sanitizeVerification(verification),
    user: sanitizeUser(await findUserById(userId))
  });
}

export async function reviewOrganizationApprovalSubmission(req, res) {
  ensurePlatformAdmin(req);

  const organizationId = String(req.params.organizationId ?? '').trim();
  const status = String(req.body.status ?? '').trim().toLowerCase();
  const reviewerNotes = String(req.body.reviewerNotes ?? '').trim();

  if (!organizationId || !['approved', 'rejected'].includes(status)) {
    throw badRequest('An organization id and review status are required.');
  }

  const currentOrganization = await findOrganizationById(organizationId);
  if (!currentOrganization) {
    throw notFound('Organization not found.');
  }

  const reviewedOrganization = await reviewOrganizationApproval({
    organizationId,
    status
  });

  if (!reviewedOrganization) {
    throw notFound('Organization not found.');
  }

  let message =
    status === 'approved'
      ? 'Organization approved for platform access.'
      : 'Organization marked as rejected. Access remains blocked.';
  let deliveryStatus = 'sent';

  try {
    await sendOrganizationDecisionEmail({
      to: reviewedOrganization.owner_email,
      firstName: reviewedOrganization.owner_first_name ?? 'Organization owner',
      organizationName: reviewedOrganization.name,
      status,
      notes: reviewerNotes
    });
  } catch {
    message =
      status === 'approved'
        ? 'Organization approved, but the decision email could not be delivered right now.'
        : 'Organization marked as rejected, but the decision email could not be delivered right now.';
    deliveryStatus = 'failed';
  }

  await recordAuditEvent(req, {
    actorUserId: req.user.id,
    targetUserId: reviewedOrganization.owner_user_id,
    eventType: 'organization_approval_reviewed',
    accountType: req.user.account_type,
    subjectType: 'organization_approval',
    subjectId: organizationId,
    metadata: {
      status,
      reviewerNotes
    }
  });

  res.json({
    message,
    emailDelivery: deliveryStatus,
    organization: {
      id: reviewedOrganization.id,
      name: reviewedOrganization.name,
      slug: reviewedOrganization.slug,
      website: reviewedOrganization.website,
      billingEmail: reviewedOrganization.billing_email,
      createdAt: reviewedOrganization.created_at,
      memberCount: Number(reviewedOrganization.member_count ?? 0),
      ownerUserId: reviewedOrganization.owner_user_id,
      ownerName:
        reviewedOrganization.owner_first_name && reviewedOrganization.owner_last_name
          ? `${reviewedOrganization.owner_first_name} ${reviewedOrganization.owner_last_name}`
          : null,
      ownerEmail: reviewedOrganization.owner_email,
      ownerApprovalStatus: reviewedOrganization.owner_approval_status ?? status,
      approvalStatus: reviewedOrganization.owner_approval_status ?? status
    }
  });
}

export async function downloadVerificationDocument(req, res) {
  const objectKey = normalizeStoredObjectKey(decodeURIComponent(String(req.params[0] ?? '').trim()));
  if (!objectKey) {
    throw notFound('Document not found.');
  }

  if (req.user.account_type === 'platform_admin') {
    const verification = await findResearcherVerificationByDocumentPath(objectKey);
    if (!verification) {
      throw notFound('Document not found.');
    }
  } else if (req.user.account_type === 'researcher') {
    const verification = await findResearcherVerificationByUserId(req.user.id);
    const allowedKeys = [
      normalizeStoredObjectKey(verification?.national_id_document_path),
      normalizeStoredObjectKey(verification?.certification_document_path)
    ].filter(Boolean);

    if (!allowedKeys.includes(objectKey)) {
      throw forbidden('You do not have access to this verification document.');
    }
  } else {
    throw forbidden('Only researchers and platform admins can access verification documents.');
  }

  const document = await readVerificationDocument(objectKey);
  if (!document) {
    throw notFound('Document not found.');
  }

  res.setHeader('Content-Type', document.contentType);
  res.setHeader('Content-Length', String(document.contentLength));
  res.setHeader('Content-Disposition', `inline; filename="${document.filename}"`);
  document.stream.pipe(res);
}

export async function submitFeedback(req, res) {
  const subject = String(req.body.subject ?? '').trim();
  const category = String(req.body.category ?? 'general').trim().toLowerCase();
  const message = String(req.body.message ?? '').trim();

  if (!subject || !message) {
    throw badRequest('Subject and message are required.');
  }

  const validCategories = ['bug_report', 'feature_request', 'general'];
  const safeCategory = validCategories.includes(category) ? category : 'general';

  const id = generateId();
  await pool.query(
    `INSERT INTO platform_feedback (id, user_id, user_email, subject, category, message)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [id, req.user.id, req.user.email, subject, safeCategory, message]
  );

  res.status(201).json({ message: 'Feedback submitted. Thank you!' });
}

export async function getPlatformResearchers(req, res) {
  // Accessible via the internal service token so the code-service can call it
  // server-to-server from handleListReviewers without a platform admin session.
  const researchers = await listInternalResearchers();
  res.json({
    researchers: researchers.map((user) => ({
      id: user.id,
      email: user.email,
      displayName:
        (user.display_name && user.display_name.trim()) ||
        `${user.first_name || ''} ${user.last_name || ''}`.trim() ||
        user.email,
      researcherType: user.researcher_type,
      approvalStatus: user.approval_status,
    }))
  });
}

export async function listFeedback(req, res) {
  ensurePlatformAdmin(req);

  const result = await pool.query(
    `SELECT id, user_id, user_email, subject, category, message, created_at
     FROM platform_feedback ORDER BY created_at DESC LIMIT 200`
  );

  res.json({
    feedback: result.rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      userEmail: row.user_email,
      subject: row.subject,
      category: row.category,
      message: row.message,
      createdAt: row.created_at
    }))
  });
}
