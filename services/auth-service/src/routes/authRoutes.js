import express from 'express';
import {
  acceptOrganizationWorkspaceInvitation,
  acceptResearcherAccessInvitation,
  beginTwoFactorSetup,
  createOrganizationMemberInvitation,
  createResearcherAccessInvitation,
  downloadVerificationDocument,
  disableTwoFactorForAccount,
  enableTwoFactorForAccount,
  forgotPassword,
  getCsrfToken,
  getCurrentSession,
  getOrganizationInvitation,
  getPlatformOverview,
  getPlatformAuditFeed,
  getPlatformOrganizations,
  getPlatformResearcherInvitations,
  getPlatformResearchers,
  getResearcherAccessInvitation,
  getResearcherVerification,
  introspectSession,
  listFeedback,
  login,
  listResearcherVerificationQueue,
  logout,
  readiness,
  register,
  reviewOrganizationApprovalSubmission,
  reviewResearcherVerificationSubmission,
  resendVerificationEmail,
  resetPassword,
  submitFeedback,
  submitResearcherVerificationDocuments,
  verifyEmail,
  verifyLoginTwoFactor
} from '../controllers/authController.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { requireAuth, requireInternalServiceAuth, requirePlatformAdmin, requireResearcher } from '../middleware/auth.js';
import { requireCsrfToken } from '../middleware/csrf.js';
import { researcherVerificationUpload } from '../middleware/uploads.js';
import { authMutationLimiter, loginLimiter } from '../middleware/rateLimit.js';

export const authRouter = express.Router();

authRouter.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

authRouter.get('/ready', asyncHandler(readiness));
authRouter.get('/csrf', asyncHandler(getCsrfToken));
authRouter.post('/register', requireCsrfToken, authMutationLimiter, asyncHandler(register));
authRouter.post('/verify-email/resend', requireCsrfToken, authMutationLimiter, asyncHandler(resendVerificationEmail));
authRouter.post('/verify-email', requireCsrfToken, authMutationLimiter, asyncHandler(verifyEmail));
authRouter.post('/login', requireCsrfToken, loginLimiter, asyncHandler(login));
authRouter.post('/login/2fa', requireCsrfToken, loginLimiter, asyncHandler(verifyLoginTwoFactor));
authRouter.post('/forgot-password', requireCsrfToken, authMutationLimiter, asyncHandler(forgotPassword));
authRouter.post('/reset-password', requireCsrfToken, authMutationLimiter, asyncHandler(resetPassword));
authRouter.get('/me', asyncHandler(requireAuth), asyncHandler(getCurrentSession));
authRouter.post('/logout', asyncHandler(requireAuth), requireCsrfToken, asyncHandler(logout));
authRouter.post('/session/introspect', asyncHandler(requireInternalServiceAuth), asyncHandler(introspectSession));
// Internal service endpoint — protected by x-internal-service-token, not a session cookie.
// Used by code-service to enumerate platform researchers for the assign-reviewer dropdown.
authRouter.get('/platform/researchers', asyncHandler(requireInternalServiceAuth), asyncHandler(getPlatformResearchers));
authRouter.get('/uploads/*', asyncHandler(requireAuth), asyncHandler(downloadVerificationDocument));
authRouter.post('/2fa/setup', asyncHandler(requireAuth), requireCsrfToken, authMutationLimiter, asyncHandler(beginTwoFactorSetup));
authRouter.post('/2fa/enable', asyncHandler(requireAuth), requireCsrfToken, authMutationLimiter, asyncHandler(enableTwoFactorForAccount));
authRouter.post('/2fa/disable', asyncHandler(requireAuth), requireCsrfToken, authMutationLimiter, asyncHandler(disableTwoFactorForAccount));
authRouter.post(
  '/organizations/invitations',
  asyncHandler(requireAuth),
  requireCsrfToken,
  authMutationLimiter,
  asyncHandler(createOrganizationMemberInvitation)
);
authRouter.get('/organizations/invitations/:token', authMutationLimiter, asyncHandler(getOrganizationInvitation));
authRouter.post(
  '/organizations/invitations/accept',
  requireCsrfToken,
  authMutationLimiter,
  asyncHandler(acceptOrganizationWorkspaceInvitation)
);
authRouter.get(
  '/researcher/verification',
  asyncHandler(requireAuth),
  asyncHandler(requireResearcher),
  asyncHandler(getResearcherVerification)
);
authRouter.post(
  '/researcher/verification',
  asyncHandler(requireAuth),
  asyncHandler(requireResearcher),
  requireCsrfToken,
  authMutationLimiter,
  researcherVerificationUpload,
  asyncHandler(submitResearcherVerificationDocuments)
);
authRouter.get(
  '/platform/overview',
  asyncHandler(requireAuth),
  asyncHandler(requirePlatformAdmin),
  asyncHandler(getPlatformOverview)
);
authRouter.get(
  '/platform/researcher-verifications',
  asyncHandler(requireAuth),
  asyncHandler(requirePlatformAdmin),
  asyncHandler(listResearcherVerificationQueue)
);
authRouter.get(
  '/platform/researcher-invitations',
  asyncHandler(requireAuth),
  asyncHandler(requirePlatformAdmin),
  asyncHandler(getPlatformResearcherInvitations)
);
authRouter.get(
  '/platform/organizations',
  asyncHandler(requireAuth),
  asyncHandler(requirePlatformAdmin),
  asyncHandler(getPlatformOrganizations)
);
authRouter.get(
  '/platform/audit',
  asyncHandler(requireAuth),
  asyncHandler(requirePlatformAdmin),
  asyncHandler(getPlatformAuditFeed)
);
authRouter.post(
  '/platform/organizations/:organizationId/review',
  asyncHandler(requireAuth),
  asyncHandler(requirePlatformAdmin),
  requireCsrfToken,
  authMutationLimiter,
  asyncHandler(reviewOrganizationApprovalSubmission)
);
authRouter.post(
  '/platform/researcher-verifications/:userId/review',
  asyncHandler(requireAuth),
  asyncHandler(requirePlatformAdmin),
  requireCsrfToken,
  authMutationLimiter,
  asyncHandler(reviewResearcherVerificationSubmission)
);
authRouter.post(
  '/platform/researcher-invitations',
  asyncHandler(requireAuth),
  asyncHandler(requirePlatformAdmin),
  requireCsrfToken,
  authMutationLimiter,
  asyncHandler(createResearcherAccessInvitation)
);
authRouter.get('/platform/researcher-invitations/:token', authMutationLimiter, asyncHandler(getResearcherAccessInvitation));
authRouter.post(
  '/platform/researcher-invitations/accept',
  requireCsrfToken,
  authMutationLimiter,
  asyncHandler(acceptResearcherAccessInvitation)
);
authRouter.post(
  '/feedback',
  asyncHandler(requireAuth),
  requireCsrfToken,
  authMutationLimiter,
  asyncHandler(submitFeedback)
);
authRouter.get(
  '/platform/feedback',
  asyncHandler(requireAuth),
  asyncHandler(requirePlatformAdmin),
  asyncHandler(listFeedback)
);
