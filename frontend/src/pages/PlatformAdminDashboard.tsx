import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import AuthNotice from '../components/auth/AuthNotice';
import {
  createResearcherInvite,
  getPlatformOverview,
  listPlatformAuditEvents,
  listPlatformOrganizations,
  listPlatformResearcherInvitations,
  listResearcherVerificationQueue,
  reviewResearcherVerification,
  type AuthAuditEvent,
  type PlatformOrganizationListItem,
  type PlatformOverview,
  type PlatformResearcherInvitationListItem,
  type ResearcherVerificationQueueItem
} from '../services/authApi';

type InviteForm = {
  email: string;
  fullName: string;
  researcherType: 'internal' | 'external';
  notes: string;
};

const emptyOverview: PlatformOverview = {
  researchers: [],
  verifications: [],
  organizations: 0
};

const connectedServicePortals = [
  {
    title: 'Penetration Testing',
    description: 'Unified platform-admin command view for pentesting oversight, assignments, and finding review.',
    to: '/admin/'
  },
  {
    title: 'Vulnerability Disclosure Program',
    description: 'Global platform-admin VDP oversight for portfolio monitoring, quality, and cross-org governance.',
    to: '/platform/vdp-admin'
  },
  {
    title: 'Security Training',
    description: 'Platform-admin training operations for delivery planning, commercial workflows, and readiness tracking.',
    to: '/platform/training-admin'
  },
  {
    title: 'Bug Bounty',
    description: 'Oversee bug bounty programs, review vulnerability reports, and manage researcher participation.',
    to: '/workspace/bug-bounty/'
  },
  {
    title: 'AI Red Team',
    description: 'Manage AI red teaming engagements, review attack findings, and oversee model safety assessments.',
    to: '/workspace/ai-redteam/'
  },
  {
    title: 'Challenge',
    description: 'Administer CTF challenges and campaigns, review flag submissions, and track researcher performance.',
    to: '/workspace/challenge/'
  },
  {
    title: 'Code Security Review',
    description: 'Review code audit requests, assign internal researchers, and oversee security findings across repositories.',
    to: '/workspace/code/'
  },
  {
    title: 'Security Trust Center',
    description: 'Manage platform-wide trust pages, GRC frameworks, compliance content, and review demo request leads.',
    to: '/workspace/trust-admin/'
  }
];

function totalResearchers(overview: PlatformOverview) {
  return overview.researchers.reduce((sum, item) => sum + Number(item.count ?? 0), 0);
}

function totalPendingReviews(overview: PlatformOverview) {
  return overview.verifications
    .filter((item) => item.status === 'submitted' || item.status === 'rejected' || item.status === 'pending_submission')
    .reduce((sum, item) => sum + Number(item.count ?? 0), 0);
}

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return 'Pending';
  }

  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export default function PlatformAdminDashboard() {
  const { user, signOut } = useAuth();

  useEffect(() => {
    document.body.style.backgroundColor = '#020617';
    return () => {
      document.body.style.backgroundColor = '';
    };
  }, []);

  const [overview, setOverview] = useState<PlatformOverview>(emptyOverview);
  const [queue, setQueue] = useState<ResearcherVerificationQueueItem[]>([]);
  const [organizations, setOrganizations] = useState<PlatformOrganizationListItem[]>([]);
  const [researcherInvitations, setResearcherInvitations] = useState<PlatformResearcherInvitationListItem[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuthAuditEvent[]>([]);
  const [inviteForm, setInviteForm] = useState<InviteForm>({
    email: '',
    fullName: '',
    researcherType: 'internal',
    notes: ''
  });
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [statusMessage, setStatusMessage] = useState('');
  const [error, setError] = useState('');
  const [inviteLink, setInviteLink] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmittingInvite, setIsSubmittingInvite] = useState(false);
  const [activeReviewUserId, setActiveReviewUserId] = useState('');

  async function loadWorkspace() {
    setIsLoading(true);
    setError('');

    try {
      const [overviewResponse, queueResponse, organizationResponse, invitationResponse, auditResponse] = await Promise.all([
        getPlatformOverview(),
        listResearcherVerificationQueue(),
        listPlatformOrganizations(),
        listPlatformResearcherInvitations(),
        listPlatformAuditEvents()
      ]);
      setOverview(overviewResponse);
      setQueue(queueResponse.queue);
      setOrganizations(organizationResponse.organizations);
      setResearcherInvitations(invitationResponse.invitations);
      setAuditEvents(auditResponse.audit);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load the platform admin workspace.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadWorkspace();
  }, []);

  const researcherCount = useMemo(() => totalResearchers(overview), [overview]);
  const pendingReviewCount = useMemo(() => totalPendingReviews(overview), [overview]);

  async function handleInvite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setStatusMessage('');
    setInviteLink('');
    setIsSubmittingInvite(true);

    try {
      const response = await createResearcherInvite(inviteForm);
      setStatusMessage(response.message);
      setInviteLink(response.inviteLink ?? '');
      setInviteForm({
        email: '',
        fullName: '',
        researcherType: 'internal',
        notes: ''
      });
      await loadWorkspace();
    } catch (inviteError) {
      setError(inviteError instanceof Error ? inviteError.message : 'Unable to create researcher invitation.');
    } finally {
      setIsSubmittingInvite(false);
    }
  }

  async function handleReview(userId: string, status: 'approved' | 'rejected') {
    setError('');
    setStatusMessage('');
    setActiveReviewUserId(userId);

    try {
      const response = await reviewResearcherVerification({
        userId,
        status,
        reviewerNotes: reviewNotes[userId] ?? ''
      });
      setStatusMessage(response.message);
      await loadWorkspace();
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : 'Unable to update researcher verification.');
    } finally {
      setActiveReviewUserId('');
    }
  }

  if (isLoading) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-950 text-slate-100">
        Loading the platform admin workspace...
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#020617_0%,#0f172a_35%,#111827_100%)] px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <section className="overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(145deg,rgba(15,23,42,0.98),rgba(30,41,59,0.92))] p-8 shadow-panel">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand-200">Platform admin</p>
              <h1 className="mt-4 font-space text-4xl font-bold text-white">Platform access, invited researcher onboarding, and verification review</h1>
              <p className="mt-4 text-base leading-8 text-slate-300">
                This workspace manages invite-only internal researchers, external researcher approval, and the operational queue for identity and certification review.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link className="auth-button-secondary" to="/security/2fa">
                Manage 2FA
              </Link>
              <button className="auth-button-primary" onClick={() => void signOut()} type="button">
                Sign out
              </button>
            </div>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-4">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <div className="text-sm text-slate-300">Platform admin</div>
              <div className="mt-2 text-lg font-semibold text-white">{user?.email}</div>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <div className="text-sm text-slate-300">Organizations</div>
              <div className="mt-2 text-3xl font-bold text-white">{overview.organizations}</div>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <div className="text-sm text-slate-300">Researchers</div>
              <div className="mt-2 text-3xl font-bold text-white">{researcherCount}</div>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <div className="text-sm text-slate-300">Verification queue</div>
              <div className="mt-2 text-3xl font-bold text-white">{pendingReviewCount}</div>
            </div>
          </div>
        </section>

        {statusMessage ? <AuthNotice tone="success">{statusMessage}</AuthNotice> : null}
        {error ? <AuthNotice tone="error">{error}</AuthNotice> : null}

        <section className="rounded-[32px] border border-slate-800 bg-slate-900/90 p-6 shadow-panel">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-300">Connected services</p>
              <h2 className="mt-3 font-space text-2xl font-bold text-white">Open role-aligned service dashboards</h2>
            </div>
            <div className="text-sm text-slate-400">{connectedServicePortals.length} links</div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {connectedServicePortals.map((service) => (
              <a
                key={service.title}
                className="rounded-3xl border border-slate-800 bg-slate-950 px-5 py-5 transition hover:border-brand-400/40 block no-underline"
                href={service.to}
                target="_blank"
                rel="noopener noreferrer"
              >
                <div className="text-lg font-semibold text-white">{service.title}</div>
                <div className="mt-3 text-sm leading-7 text-slate-300">{service.description}</div>
              </a>
            ))}
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <article className="rounded-[32px] border border-slate-800 bg-slate-900/90 p-6 shadow-panel">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-300">Invite researchers</p>
            <h2 className="mt-4 font-space text-2xl font-bold text-white">Invite Internal Researcher or controlled external access</h2>
            <p className="mt-3 text-sm leading-7 text-slate-300">
              Internal researchers are invite-only. External researchers can also be invited here when you want controlled onboarding instead of self-registration.
            </p>

            <form className="mt-6 space-y-5" onSubmit={handleInvite}>
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-200">Researcher name</span>
                <input
                  className="auth-input bg-white text-slate-900"
                  onChange={(event) => setInviteForm((current) => ({ ...current, fullName: event.target.value }))}
                  placeholder="Jane Doe"
                  required
                  type="text"
                  value={inviteForm.fullName}
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-200">Researcher email</span>
                <input
                  className="auth-input bg-white text-slate-900"
                  onChange={(event) => setInviteForm((current) => ({ ...current, email: event.target.value }))}
                  placeholder="researcher@example.com"
                  required
                  type="email"
                  value={inviteForm.email}
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-200">Researcher type</span>
                <select
                  className="auth-select bg-white text-slate-900"
                  onChange={(event) =>
                    setInviteForm((current) => ({
                      ...current,
                      researcherType: event.target.value as InviteForm['researcherType']
                    }))
                  }
                  value={inviteForm.researcherType}
                >
                  <option value="internal">Internal researcher</option>
                  <option value="external">External researcher</option>
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-200">Invite notes</span>
                <textarea
                  className="min-h-[120px] w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-brand-400 focus:ring-4 focus:ring-brand-100"
                  onChange={(event) => setInviteForm((current) => ({ ...current, notes: event.target.value }))}
                  placeholder="Optional context for the invited researcher."
                  value={inviteForm.notes}
                />
              </label>

              <button className="auth-button-accent" disabled={isSubmittingInvite} type="submit">
                {isSubmittingInvite ? 'Sending invitation...' : 'Invite internal researcher'}
              </button>
            </form>

            {inviteLink ? (
              <div className="mt-6 rounded-2xl border border-slate-700 bg-slate-950 px-4 py-4 text-sm text-slate-300">
                <div className="font-semibold text-slate-100">Invite link</div>
                <div className="mt-2 break-all text-brand-200">{inviteLink}</div>
              </div>
            ) : null}
          </article>

          <article className="rounded-[32px] border border-slate-800 bg-slate-900/90 p-6 shadow-panel">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-300">Verification queue</p>
                <h2 className="mt-3 font-space text-2xl font-bold text-white">Approve or reject researcher submissions</h2>
              </div>
              <div className="text-sm text-slate-400">{queue.length} submissions loaded</div>
            </div>

            <div className="mt-6 space-y-4">
              {queue.length === 0 ? (
                <div className="rounded-3xl border border-slate-800 bg-slate-950 px-5 py-6 text-sm text-slate-300">
                  No researcher submissions are waiting right now.
                </div>
              ) : null}

              {queue.map((item) => (
                <article key={item.id} className="rounded-3xl border border-slate-800 bg-slate-950 px-5 py-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:justify-between">
                    <div>
                      <div className="text-lg font-semibold text-white">
                        {item.firstName} {item.lastName}
                        {item.displayName ? <span className="ml-2 text-sm font-normal text-slate-400">({item.displayName})</span> : null}
                      </div>
                      <div className="mt-1 text-sm text-slate-400">{item.email}</div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full border border-brand-400/30 bg-brand-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-brand-200">
                        {item.researcherType} researcher
                      </span>
                      <span className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">
                        {item.verification.status.replace('_', ' ')}
                      </span>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-4 text-sm text-slate-300 md:grid-cols-2">
                    <div>
                      <div className="font-semibold text-white">Country of issue</div>
                      <div className="mt-1">{item.verification.countryOfIssue || 'Not provided'}</div>
                    </div>
                    <div>
                      <div className="font-semibold text-white">Submitted at</div>
                      <div className="mt-1">{item.verification.submittedAt ?? 'Not submitted yet'}</div>
                    </div>
                    <div>
                      <div className="font-semibold text-white">National ID</div>
                      {item.verification.nationalIdDocumentUrl ? (
                        <a
                          className="mt-1 inline-flex text-brand-300 hover:text-brand-200"
                          href={item.verification.nationalIdDocumentUrl}
                          rel="noreferrer"
                          target="_blank"
                        >
                          {item.verification.nationalIdDocumentName}
                        </a>
                      ) : (
                        <div className="mt-1 text-slate-500">Missing</div>
                      )}
                    </div>
                    <div>
                      <div className="font-semibold text-white">Certification</div>
                      {item.verification.certificationDocumentUrl ? (
                        <a
                          className="mt-1 inline-flex text-brand-300 hover:text-brand-200"
                          href={item.verification.certificationDocumentUrl}
                          rel="noreferrer"
                          target="_blank"
                        >
                          {item.verification.certificationDocumentName}
                        </a>
                      ) : (
                        <div className="mt-1 text-slate-500">Missing</div>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-900/60 px-4 py-4 text-sm text-slate-300">
                    <div className="font-semibold text-white">Certifications summary</div>
                    <div className="mt-2">{item.verification.certificationsSummary || 'No summary provided.'}</div>
                  </div>

                  <label className="mt-4 block">
                    <span className="mb-2 block text-sm font-semibold text-slate-200">Reviewer notes</span>
                    <textarea
                      className="min-h-[110px] w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-100 shadow-sm outline-none transition focus:border-brand-400 focus:ring-4 focus:ring-brand-500/20"
                      onChange={(event) =>
                        setReviewNotes((current) => ({
                          ...current,
                          [item.userId]: event.target.value
                        }))
                      }
                      placeholder="Explain approval details or what needs to be corrected."
                      value={reviewNotes[item.userId] ?? item.verification.reviewerNotes ?? ''}
                    />
                  </label>

                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      className="auth-button-accent"
                      disabled={activeReviewUserId === item.userId}
                      onClick={() => void handleReview(item.userId, 'approved')}
                      type="button"
                    >
                      {activeReviewUserId === item.userId ? 'Saving review...' : 'Approve researcher'}
                    </button>
                    <button
                      className="auth-button-secondary"
                      disabled={activeReviewUserId === item.userId}
                      onClick={() => void handleReview(item.userId, 'rejected')}
                      type="button"
                    >
                      Request resubmission
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </article>
        </section>

        <section className="grid gap-6 xl:grid-cols-3">
          <article className="rounded-[32px] border border-slate-800 bg-slate-900/90 p-6 shadow-panel">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-300">Organizations</p>
                <h2 className="mt-3 font-space text-2xl font-bold text-white">Recently created workspaces</h2>
              </div>
              <div className="text-sm text-slate-400">{organizations.length} loaded</div>
            </div>

            <div className="mt-6 space-y-4">
              {organizations.length === 0 ? (
                <div className="rounded-3xl border border-slate-800 bg-slate-950 px-5 py-6 text-sm text-slate-300">
                  No organization workspaces have been created yet.
                </div>
              ) : null}

              {organizations.slice(0, 5).map((organization) => (
                <article key={organization.id} className="rounded-3xl border border-slate-800 bg-slate-950 px-5 py-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-lg font-semibold text-white">{organization.name}</div>
                      <div className="mt-1 text-sm text-slate-400">
                        {organization.ownerName ?? 'Owner pending'} • {organization.ownerEmail ?? organization.billingEmail}
                      </div>
                    </div>
                    <span className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">
                      {organization.memberCount} members
                    </span>
                  </div>
                  <div className="mt-4 grid gap-3 text-sm text-slate-300">
                    <div>Workspace slug: {organization.slug}</div>
                    <div>Created: {formatDateTime(organization.createdAt)}</div>
                    <div>Website: {organization.website || 'Not provided'}</div>
                  </div>
                </article>
              ))}
            </div>
          </article>

          <article className="rounded-[32px] border border-slate-800 bg-slate-900/90 p-6 shadow-panel">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-300">Invitations</p>
                <h2 className="mt-3 font-space text-2xl font-bold text-white">Recent researcher invites</h2>
              </div>
              <div className="text-sm text-slate-400">{researcherInvitations.length} loaded</div>
            </div>

            <div className="mt-6 space-y-4">
              {researcherInvitations.length === 0 ? (
                <div className="rounded-3xl border border-slate-800 bg-slate-950 px-5 py-6 text-sm text-slate-300">
                  No researcher invitations have been sent yet.
                </div>
              ) : null}

              {researcherInvitations.slice(0, 5).map((invitation) => (
                <article key={invitation.id} className="rounded-3xl border border-slate-800 bg-slate-950 px-5 py-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-lg font-semibold text-white">{invitation.email}</div>
                      <div className="mt-1 text-sm text-slate-400">Invited by {invitation.invitedBy ?? 'Platform admin'}</div>
                    </div>
                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${
                        invitation.acceptedAt
                          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                          : 'border-amber-500/30 bg-amber-500/10 text-amber-200'
                      }`}
                    >
                      {invitation.acceptedAt ? 'Accepted' : 'Pending'}
                    </span>
                  </div>
                  <div className="mt-4 grid gap-3 text-sm text-slate-300">
                    <div>Type: {invitation.researcherType} researcher</div>
                    <div>Created: {formatDateTime(invitation.createdAt)}</div>
                    <div>Expires: {formatDateTime(invitation.expiresAt)}</div>
                    <div>Notes: {invitation.notes || 'No notes added.'}</div>
                  </div>
                </article>
              ))}
            </div>
          </article>

          <article className="rounded-[32px] border border-slate-800 bg-slate-900/90 p-6 shadow-panel">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-300">Audit trail</p>
                <h2 className="mt-3 font-space text-2xl font-bold text-white">Latest security events</h2>
              </div>
              <div className="text-sm text-slate-400">{auditEvents.length} loaded</div>
            </div>

            <div className="mt-6 space-y-4">
              {auditEvents.length === 0 ? (
                <div className="rounded-3xl border border-slate-800 bg-slate-950 px-5 py-6 text-sm text-slate-300">
                  No audit events recorded yet.
                </div>
              ) : null}

              {auditEvents.slice(0, 6).map((event) => (
                <article key={event.id} className="rounded-3xl border border-slate-800 bg-slate-950 px-5 py-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-300">{event.eventType.replace(/_/g, ' ')}</div>
                      <div className="mt-2 text-base font-semibold text-white">{event.actorName ?? event.actorEmail ?? 'System event'}</div>
                    </div>
                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${
                        event.outcome === 'success'
                          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                          : 'border-rose-500/30 bg-rose-500/10 text-rose-200'
                      }`}
                    >
                      {event.outcome}
                    </span>
                  </div>
                  <div className="mt-4 space-y-2 text-sm text-slate-300">
                    <div>Target: {event.targetName ?? event.targetEmail ?? event.subjectId ?? 'N/A'}</div>
                    <div>Occurred: {formatDateTime(event.occurredAt)}</div>
                    <div>Account type: {event.accountType ?? 'n/a'}</div>
                  </div>
                </article>
              ))}
            </div>
          </article>
        </section>
      </div>
    </main>
  );
}
