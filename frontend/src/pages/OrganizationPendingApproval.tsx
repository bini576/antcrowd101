import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export default function OrganizationPendingApproval() {
  const { user, signOut } = useAuth();
  const isRejected = user?.approvalStatus === 'rejected';
  const title = isRejected
    ? 'Your organization requires an approval update'
    : 'Your organization is awaiting platform admin approval';
  const body = isRejected
    ? 'Your email is verified, but the organization workspace has not been approved yet. Contact the AntCrowd platform admin to review the submission and share the next required steps.'
    : 'We verified your email and created the organization record successfully. A platform admin must approve your organization before workspace and service access are unlocked.';

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-white">
      <div className="mx-auto max-w-3xl rounded-[32px] border border-white/10 bg-[linear-gradient(145deg,#0f172a_0%,#172554_65%,#1d4ed8_100%)] p-8 shadow-panel">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-200">
          {isRejected ? 'Organization review update' : 'Organization review pending'}
        </p>
        <h1 className="mt-4 font-space text-4xl font-bold">{title}</h1>
        <p className="mt-4 text-base leading-8 text-slate-200">
          {body} This account is signed in as <strong>{user?.organization?.name ?? 'your organization'}</strong>.
        </p>

        <div className="mt-6 rounded-3xl border border-white/10 bg-white/10 p-5">
          <div className="text-sm text-brand-100">Signed-in account</div>
          <div className="mt-2 text-lg font-semibold">{user?.email}</div>
          <div className="mt-3 text-sm text-slate-200">
            Current status: <span className="font-semibold capitalize">{user?.approvalStatus?.replace('_', ' ')}</span>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link className="rounded-2xl border border-white/20 px-4 py-3 text-sm font-semibold text-white hover:border-white/40" to="/security/2fa">
            Manage 2FA
          </Link>
          <button
            className="rounded-2xl bg-brand-500 px-4 py-3 text-sm font-semibold text-white hover:bg-brand-600"
            onClick={() => void signOut()}
            type="button"
          >
            Sign out
          </button>
        </div>
      </div>
    </main>
  );
}
