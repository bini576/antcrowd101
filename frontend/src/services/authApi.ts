import type { AccountType, ApprovalStatus, AuthUser, ResearcherType } from '../auth/types';

const AUTH_API_BASE = (import.meta.env.VITE_AUTH_API_BASE ?? '/api/auth').trim().replace(/\/$/, '');
const AUTH_CSRF_COOKIE_NAME = (import.meta.env.VITE_AUTH_CSRF_COOKIE_NAME ?? 'antcrowd_csrf').trim();

let csrfBootstrapPromise: Promise<string> | null = null;

type LoginResponse = {
  message: string;
  user?: AuthUser;
  requiresTwoFactor?: boolean;
  challengeToken?: string;
  email?: string;
  rememberMe?: boolean;
};

export type RegisterPayload =
  | {
      accountType: 'researcher';
      researcherType: ResearcherType;
      firstName: string;
      lastName: string;
      displayName: string;
      email: string;
      password: string;
    }
  | {
      accountType: 'organization';
      firstName: string;
      lastName: string;
      jobTitle: string;
      organizationName: string;
      website: string;
      email: string;
      password: string;
    };

export type ResearcherVerification = {
  status: ApprovalStatus;
  countryOfIssue: string;
  certificationsSummary: string;
  nationalIdDocumentName: string | null;
  nationalIdDocumentUrl: string | null;
  certificationDocumentName: string | null;
  certificationDocumentUrl: string | null;
  reviewerNotes: string;
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewerName: string | null;
};

export type ResearcherVerificationState = {
  approvalStatus: ApprovalStatus;
  verification: ResearcherVerification;
};

export type ResearcherInvitation = {
  email: string;
  researcherType: ResearcherType;
  notes: string;
};

export type ResearcherVerificationQueueItem = {
  id: string;
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName: string | null;
  researcherType: ResearcherType;
  verification: ResearcherVerification;
};

export type PlatformOverview = {
  researchers: Array<{
    researcher_type: ResearcherType;
    approval_status: ApprovalStatus;
    count: number;
  }>;
  verifications: Array<{
    status: ApprovalStatus;
    count: number;
  }>;
  organizations: number;
  organizationApprovals?: Array<{
    approval_status: ApprovalStatus;
    count: number;
  }>;
};

export type PlatformResearcherInvitationListItem = {
  id: string;
  email: string;
  researcherType: ResearcherType;
  notes: string;
  acceptedAt: string | null;
  expiresAt: string | null;
  createdAt: string | null;
  invitedBy: string | null;
};

export type PlatformOrganizationListItem = {
  id: string;
  name: string;
  slug: string;
  website: string | null;
  billingEmail: string;
  createdAt: string;
  memberCount: number;
  ownerUserId?: string;
  approvalStatus?: ApprovalStatus;
  ownerApprovalStatus?: ApprovalStatus;
  ownerName: string | null;
  ownerEmail: string | null;
};

export type AuthAuditEvent = {
  id: string;
  eventType: string;
  outcome: string;
  accountType: AccountType | null;
  subjectType: string;
  subjectId: string | null;
  occurredAt: string;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: Record<string, unknown>;
  actorName: string | null;
  actorEmail: string | null;
  targetName: string | null;
  targetEmail: string | null;
};

export type VerificationDeliveryResponse = {
  message: string;
  emailDelivery?: 'sent' | 'failed';
  fallbackCode?: string;
  fallbackLink?: string;
};

async function readErrorMessage(response: Response, fallback: string) {
  const contentType = response.headers.get('content-type') ?? '';

  if (contentType.includes('application/json')) {
    try {
      const body = (await response.clone().json()) as { message?: string; error?: string };
      if (typeof body.message === 'string' && body.message.trim()) {
        return body.message;
      }
      if (typeof body.error === 'string' && body.error.trim()) {
        return body.error;
      }
    } catch {
      // Ignore JSON parsing errors.
    }
  }

  try {
    const text = (await response.text()).trim();
    if (text) {
      return text;
    }
  } catch {
    // Ignore text parsing errors.
  }

  return fallback;
}

function readCookie(name: string) {
  if (typeof document === 'undefined') {
    return '';
  }

  const cookies = document.cookie ? document.cookie.split('; ') : [];
  const target = `${name}=`;
  const match = cookies.find((entry) => entry.startsWith(target));
  if (!match) {
    return '';
  }

  return decodeURIComponent(match.slice(target.length));
}

async function ensureCsrfToken() {
  const existingToken = readCookie(AUTH_CSRF_COOKIE_NAME);
  if (existingToken) {
    return existingToken;
  }

  if (!csrfBootstrapPromise) {
    csrfBootstrapPromise = fetch(`${AUTH_API_BASE}/csrf`, {
      credentials: 'include'
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(await readErrorMessage(response, 'Unable to initialize secure session.'));
        }
        const payload = (await response.json()) as { csrfToken?: string };
        return payload.csrfToken ?? readCookie(AUTH_CSRF_COOKIE_NAME);
      })
      .finally(() => {
        csrfBootstrapPromise = null;
      });
  }

  return csrfBootstrapPromise;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  const headers = new Headers(init?.headers ?? {});
  const isFormDataBody = typeof FormData !== 'undefined' && init?.body instanceof FormData;
  const method = (init?.method ?? 'GET').toUpperCase();

  if (!isFormDataBody && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    const csrfToken = await ensureCsrfToken();
    if (csrfToken && !headers.has('X-CSRF-Token')) {
      headers.set('X-CSRF-Token', csrfToken);
    }
  }

  try {
    response = await fetch(`${AUTH_API_BASE}${path}`, {
      credentials: 'include',
      ...init,
      headers
    });
  } catch {
    throw new Error('Authentication service is unavailable right now. Please try again shortly.');
  }

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, 'Authentication request failed'));
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

function resolveDefaultResearcherDashboard(user: AuthUser) {
  return user.researcherType === 'internal' ? '/dashboard/internal' : '/dashboard/external';
}

export function requiresResearcherApproval(user: AuthUser | null | undefined) {
  return user?.accountType === 'researcher' && user.approvalStatus !== 'approved';
}

export async function register(payload: RegisterPayload) {
  return request<VerificationDeliveryResponse & { user: AuthUser }>('/register', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function login(payload: {
  email: string;
  password: string;
  rememberMe?: boolean;
}) {
  return request<LoginResponse>('/login', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function verifyTwoFactorLogin(payload: {
  challengeToken: string;
  code: string;
  rememberMe?: boolean;
}) {
  return request<{ message: string; user: AuthUser }>('/login/2fa', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function getCurrentSession() {
  return request<{ user: AuthUser }>('/me', {
    method: 'GET'
  });
}

export async function bootstrapCsrfProtection() {
  await ensureCsrfToken();
}

export async function logout() {
  return request<{ message: string }>('/logout', {
    method: 'POST'
  });
}

export async function resendConfirmationEmail(email: string) {
  return request<VerificationDeliveryResponse>('/verify-email/resend', {
    method: 'POST',
    body: JSON.stringify({ email })
  });
}

export async function verifyEmailCode(payload: { email: string; code: string }) {
  return request<{ message: string; user: AuthUser }>('/verify-email', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function verifyEmailToken(token: string) {
  return request<{ message: string; user: AuthUser }>('/verify-email', {
    method: 'POST',
    body: JSON.stringify({ token })
  });
}

export async function forgotPassword(email: string) {
  return request<VerificationDeliveryResponse>('/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email })
  });
}

export async function resetPassword(token: string, password: string) {
  return request<{ message: string }>('/reset-password', {
    method: 'POST',
    body: JSON.stringify({ token, password })
  });
}

export async function enableTwoFactor(password: string) {
  return request<{ message: string; user: AuthUser }>('/2fa/enable', {
    method: 'POST',
    body: JSON.stringify({ password })
  });
}

export async function disableTwoFactor(password: string) {
  return request<{ message: string; user: AuthUser }>('/2fa/disable', {
    method: 'POST',
    body: JSON.stringify({ password })
  });
}

export async function createOrgInvite(email: string, role: string) {
  return request<{ message: string; inviteLink?: string }>('/organizations/invitations', {
    method: 'POST',
    body: JSON.stringify({ email, role })
  });
}

export async function getOrgInvite(token: string) {
  return request<{ email: string; orgName: string; role: string }>(
    `/organizations/invitations/${encodeURIComponent(token)}`,
    {
      method: 'GET'
    }
  );
}

export async function acceptOrgInvite(payload: {
  token: string;
  password: string;
  firstName: string;
  lastName: string;
}) {
  return request<{ message: string; user: AuthUser }>('/organizations/invitations/accept', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function getResearcherVerification() {
  return request<ResearcherVerificationState>('/researcher/verification', {
    method: 'GET'
  });
}

export async function submitResearcherVerification(payload: FormData) {
  return request<{ message: string } & ResearcherVerificationState>('/researcher/verification', {
    method: 'POST',
    body: payload
  });
}

export async function createResearcherInvite(payload: {
  email: string;
  fullName?: string;
  researcherType: ResearcherType;
  notes?: string;
}) {
  return request<{ message: string; inviteLink?: string }>('/platform/researcher-invitations', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function getResearcherInvite(token: string) {
  return request<ResearcherInvitation>(`/platform/researcher-invitations/${encodeURIComponent(token)}`, {
    method: 'GET'
  });
}

export async function acceptResearcherInvite(payload: {
  token: string;
  password: string;
  firstName: string;
  lastName: string;
  displayName: string;
}) {
  return request<{ message: string; user: AuthUser }>('/platform/researcher-invitations/accept', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function getPlatformOverview() {
  return request<PlatformOverview>('/platform/overview', {
    method: 'GET'
  });
}

export async function listPlatformResearcherInvitations() {
  return request<{ invitations: PlatformResearcherInvitationListItem[] }>('/platform/researcher-invitations', {
    method: 'GET'
  });
}

export async function listPlatformOrganizations() {
  return request<{ organizations: PlatformOrganizationListItem[] }>('/platform/organizations', {
    method: 'GET'
  });
}

export async function listPlatformAuditEvents() {
  return request<{ audit: AuthAuditEvent[] }>('/platform/audit', {
    method: 'GET'
  });
}

export async function listResearcherVerificationQueue() {
  return request<{ queue: ResearcherVerificationQueueItem[] }>('/platform/researcher-verifications', {
    method: 'GET'
  });
}

export async function reviewResearcherVerification(payload: {
  userId: string;
  status: Extract<ApprovalStatus, 'approved' | 'rejected'>;
  reviewerNotes?: string;
}) {
  return request<{
    message: string;
    verification: ResearcherVerification;
    user: AuthUser;
  }>(`/platform/researcher-verifications/${encodeURIComponent(payload.userId)}/review`, {
    method: 'POST',
    body: JSON.stringify({
      status: payload.status,
      reviewerNotes: payload.reviewerNotes ?? ''
    })
  });
}

export async function reviewOrganizationApproval(payload: {
  organizationId: string;
  status: Extract<ApprovalStatus, 'approved' | 'rejected'>;
  reviewerNotes?: string;
}) {
  return request<{
    message: string;
    emailDelivery?: 'sent' | 'failed';
    organization: PlatformOrganizationListItem;
  }>(`/platform/organizations/${encodeURIComponent(payload.organizationId)}/review`, {
    method: 'POST',
    body: JSON.stringify({
      status: payload.status,
      reviewerNotes: payload.reviewerNotes ?? ''
    })
  });
}

export async function submitFeedback(payload: {
  subject: string;
  category: string;
  message: string;
}) {
  return request<{ message: string }>('/feedback', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function resolvePostLoginPath(user: AuthUser, researcherFallback = '/dashboard') {
  if (user.accountType === 'platform_admin') {
    return '/admin/';
  }

  if (user.accountType === 'organization') {
    if (!['approved', 'not_required'].includes(user.approvalStatus)) {
      return '/organization/pending-approval';
    }
    return '/organization/workspace';
  }

  if ((user as any).platformRole === 'compliance_team') {
    return '/compliance';
  }
  if ((user as any).platformRole === 'developer') {
    return '/developer';
  }

  if (user.approvalStatus !== 'approved') {
    return '/researcher/verification';
  }

  const defaultDashboard = resolveDefaultResearcherDashboard(user);
  if (!researcherFallback || researcherFallback === '/dashboard') {
    return defaultDashboard;
  }

  return researcherFallback;
}

export function labelForAccountType(accountType: AccountType) {
  if (accountType === 'organization') {
    return 'Organization';
  }

  if (accountType === 'platform_admin') {
    return 'Platform Admin';
  }

  return 'Researcher';
}
