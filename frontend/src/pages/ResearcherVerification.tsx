import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import AuthNotice from '../components/auth/AuthNotice';
import {
  getResearcherVerification,
  submitResearcherVerification,
  type ResearcherVerification
} from '../services/authApi';

type VerificationForm = {
  countryOfIssue: string;
  certificationsSummary: string;
  nationalIdDocument: File | null;
  certificationDocument: File | null;
};

const defaultVerification: ResearcherVerification = {
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

const statusCopy = {
  pending_submission: {
    badge: 'Awaiting submission',
    tone: 'border-amber-200 bg-amber-50 text-amber-800',
    title: 'Submit your verification documents to unlock researcher services.',
    description: 'National ID and certification review are required before program access, report submission, and payouts.'
  },
  submitted: {
    badge: 'Under review',
    tone: 'border-sky-200 bg-sky-50 text-sky-800',
    title: 'Your verification package is with the platform admin team.',
    description: 'You can update the submission if you need to replace documents while the review is in progress.'
  },
  approved: {
    badge: 'Approved',
    tone: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    title: 'Your researcher account is approved for platform access.',
    description: 'You can now work inside the researcher portal, access programs, and use the available services.'
  },
  rejected: {
    badge: 'Changes required',
    tone: 'border-rose-200 bg-rose-50 text-rose-800',
    title: 'Your submission needs updates before approval.',
    description: 'Review the platform admin notes, replace any required documents, and resubmit.'
  },
  not_required: {
    badge: 'Not required',
    tone: 'border-slate-200 bg-slate-50 text-slate-700',
    title: 'Verification is not required for this account.',
    description: 'This status is normally only used for non-researcher accounts.'
  }
} as const;

export default function ResearcherVerificationPage() {
  const { user, refreshSession } = useAuth();
  const [approvalStatus, setApprovalStatus] = useState(user?.approvalStatus ?? 'pending_submission');
  const [verification, setVerification] = useState<ResearcherVerification>(defaultVerification);
  const [form, setForm] = useState<VerificationForm>({
    countryOfIssue: '',
    certificationsSummary: '',
    nationalIdDocument: null,
    certificationDocument: null
  });
  const [statusMessage, setStatusMessage] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    document.body.style.backgroundColor = '#020617';
    let cancelled = false;

    async function loadVerification() {
      try {
        const response = await getResearcherVerification();
        if (cancelled) {
          return;
        }

        setApprovalStatus(response.approvalStatus);
        setVerification(response.verification);
        setForm((current) => ({
          ...current,
          countryOfIssue: response.verification.countryOfIssue,
          certificationsSummary: response.verification.certificationsSummary
        }));
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Unable to load your verification status.');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadVerification();

    return () => {
      cancelled = true;
      document.body.style.backgroundColor = '';
    };
  }, []);

  const copy = useMemo(() => statusCopy[approvalStatus] ?? statusCopy.pending_submission, [approvalStatus]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatusMessage('');
    setError('');
    setIsSubmitting(true);

    const payload = new FormData();
    payload.append('countryOfIssue', form.countryOfIssue);
    payload.append('certificationsSummary', form.certificationsSummary);

    if (form.nationalIdDocument) {
      payload.append('nationalIdDocument', form.nationalIdDocument);
    }

    if (form.certificationDocument) {
      payload.append('certificationDocument', form.certificationDocument);
    }

    try {
      const response = await submitResearcherVerification(payload);
      setApprovalStatus(response.approvalStatus);
      setVerification(response.verification);
      setStatusMessage(response.message);
      setForm((current) => ({
        ...current,
        nationalIdDocument: null,
        certificationDocument: null
      }));
      await refreshSession();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to submit verification documents.');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-950 text-slate-100">
        Loading your researcher verification workspace...
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#020617_0%,#0f172a_45%,#111827_100%)] px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <section className="overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(145deg,rgba(15,23,42,0.98),rgba(30,41,59,0.92))] p-8 shadow-panel">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand-200">Researcher verification</p>
              <h1 className="mt-4 font-space text-4xl font-bold text-white">
                Identity and certification review for {user?.researcherType === 'internal' ? 'internal' : 'external'} researchers
              </h1>
              <p className="mt-4 text-base leading-8 text-slate-300">{copy.description}</p>
            </div>

            <div className={`inline-flex rounded-full border px-4 py-2 text-sm font-semibold ${copy.tone}`}>
              {copy.badge}
            </div>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <div className="text-sm text-slate-300">Email</div>
              <div className="mt-2 text-lg font-semibold text-white">{user?.email}</div>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <div className="text-sm text-slate-300">Researcher type</div>
              <div className="mt-2 text-lg font-semibold capitalize text-white">{user?.researcherType ?? 'Researcher'}</div>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <div className="text-sm text-slate-300">Authenticator app 2FA</div>
              <div className="mt-2 text-lg font-semibold text-white">{user?.twoFactorEnabled ? 'Enabled' : 'Recommended'}</div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <article className="rounded-[32px] border border-slate-800 bg-slate-900/90 p-6 shadow-panel">
            <div className="flex flex-col gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-300">Submission</p>
              <h2 className="font-space text-2xl font-bold text-white">{copy.title}</h2>
            </div>

            <div className="mt-6 space-y-4">
              {statusMessage ? <AuthNotice tone="success">{statusMessage}</AuthNotice> : null}
              {error ? <AuthNotice tone="error">{error}</AuthNotice> : null}

              <form className="space-y-5" onSubmit={handleSubmit}>
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-200">Country of issue</span>
                  <input
                    className="auth-input bg-white text-slate-900"
                    onChange={(event) => setForm((current) => ({ ...current, countryOfIssue: event.target.value }))}
                    placeholder="Ethiopia"
                    required
                    type="text"
                    value={form.countryOfIssue}
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-200">Certifications summary</span>
                  <textarea
                    className="min-h-[140px] w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-brand-400 focus:ring-4 focus:ring-brand-100"
                    onChange={(event) =>
                      setForm((current) => ({ ...current, certificationsSummary: event.target.value }))
                    }
                    placeholder="List certifications, issue dates, training background, and any notes that support review."
                    value={form.certificationsSummary}
                  />
                </label>

                <div className="grid gap-5 md:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold text-slate-200">National ID document</span>
                    <input
                      accept=".pdf,.png,.jpg,.jpeg,.webp"
                      className="block w-full rounded-2xl border border-dashed border-slate-600 bg-slate-950 px-4 py-3 text-sm text-slate-200 file:mr-4 file:rounded-full file:border-0 file:bg-brand-500 file:px-4 file:py-2 file:font-semibold file:text-white"
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          nationalIdDocument: event.target.files?.[0] ?? null
                        }))
                      }
                      type="file"
                    />
                    <p className="mt-2 text-xs text-slate-400">
                      Accepted: PDF, PNG, JPG, WEBP. Max 8MB.
                    </p>
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold text-slate-200">Certification document</span>
                    <input
                      accept=".pdf,.png,.jpg,.jpeg,.webp"
                      className="block w-full rounded-2xl border border-dashed border-slate-600 bg-slate-950 px-4 py-3 text-sm text-slate-200 file:mr-4 file:rounded-full file:border-0 file:bg-brand-500 file:px-4 file:py-2 file:font-semibold file:text-white"
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          certificationDocument: event.target.files?.[0] ?? null
                        }))
                      }
                      type="file"
                    />
                    <p className="mt-2 text-xs text-slate-400">
                      Upload a certification, transcript, or approved proof of training.
                    </p>
                  </label>
                </div>

                <button className="auth-button-accent" disabled={isSubmitting} type="submit">
                  {isSubmitting
                    ? 'Submitting verification...'
                    : approvalStatus === 'rejected'
                      ? 'Resubmit verification'
                      : 'Submit verification'}
                </button>
              </form>
            </div>
          </article>

          <div className="space-y-6">
            <article className="rounded-[32px] border border-slate-800 bg-slate-900/90 p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-300">Current review</p>
              <div className="mt-4 space-y-4 text-sm text-slate-300">
                <div>
                  <div className="font-semibold text-white">Submission status</div>
                  <div className="mt-1 capitalize">{verification.status.replace('_', ' ')}</div>
                </div>

                <div>
                  <div className="font-semibold text-white">National ID</div>
                  {verification.nationalIdDocumentName ? (
                    <a
                      className="mt-1 inline-flex text-brand-300 hover:text-brand-200"
                      href={verification.nationalIdDocumentUrl ?? '#'}
                      rel="noreferrer"
                      target="_blank"
                    >
                      {verification.nationalIdDocumentName}
                    </a>
                  ) : (
                    <div className="mt-1 text-slate-400">No file uploaded yet.</div>
                  )}
                </div>

                <div>
                  <div className="font-semibold text-white">Certification document</div>
                  {verification.certificationDocumentName ? (
                    <a
                      className="mt-1 inline-flex text-brand-300 hover:text-brand-200"
                      href={verification.certificationDocumentUrl ?? '#'}
                      rel="noreferrer"
                      target="_blank"
                    >
                      {verification.certificationDocumentName}
                    </a>
                  ) : (
                    <div className="mt-1 text-slate-400">No file uploaded yet.</div>
                  )}
                </div>

                <div>
                  <div className="font-semibold text-white">Reviewer notes</div>
                  <div className="mt-1 text-slate-300">{verification.reviewerNotes || 'No reviewer notes yet.'}</div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <div className="font-semibold text-white">Submitted</div>
                    <div className="mt-1 text-slate-300">{verification.submittedAt ?? 'Not submitted yet'}</div>
                  </div>
                  <div>
                    <div className="font-semibold text-white">Reviewed by</div>
                    <div className="mt-1 text-slate-300">{verification.reviewerName ?? 'Pending review'}</div>
                  </div>
                </div>
              </div>
            </article>

            <article className="rounded-[32px] border border-slate-800 bg-slate-900/90 p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-300">Next actions</p>
              <div className="mt-4 space-y-3 text-sm leading-7 text-slate-300">
                <p>Enable 2FA before broad service access and keep your contact details current.</p>
                <p>Use a clear scan for the national ID and attach a certification or approved equivalent for faster review.</p>
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <Link className="auth-button-secondary" to="/security/2fa">
                  Manage 2FA
                </Link>
                {approvalStatus === 'approved' ? (
                  <Link className="auth-button-primary" to={user?.researcherType === 'internal' ? '/dashboard/internal' : '/dashboard/external'}>
                    Open dashboard
                  </Link>
                ) : null}
              </div>
            </article>
          </div>
        </section>
      </div>
    </main>
  );
}
