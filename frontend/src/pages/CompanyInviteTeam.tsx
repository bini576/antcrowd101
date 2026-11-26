import { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { createOrgInvite } from '../services/authApi';

export default function CompanyInviteTeam() {
  const { user } = useAuth();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('manager');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [inviteLink, setInviteLink] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleInvite(event: React.FormEvent) {
    event.preventDefault();
    setStatus('');
    setError('');
    setInviteLink('');
    setIsSubmitting(true);

    try {
      const response = await createOrgInvite(email, role);
      setStatus(response.message);
      setInviteLink(response.inviteLink ?? '');
      setEmail('');
    } catch (inviteError) {
      setError(inviteError instanceof Error ? inviteError.message : 'Unable to create invitation.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-10 text-white">
      <div className="mx-auto max-w-3xl rounded-[32px] border border-slate-800 bg-slate-900 p-8 shadow-panel">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-200">Organization invitations</p>
        <h1 className="mt-4 font-space text-3xl font-bold">Invite a teammate to {user?.organization?.name ?? 'your workspace'}</h1>
        <p className="mt-4 text-sm leading-7 text-slate-300">
          Invitations are emailed through the configured SMTP provider and expire automatically. Owners and admins can create team access links for supported organization roles.
        </p>

        <form className="mt-8 space-y-5" onSubmit={handleInvite}>
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-200">Invitee email</span>
            <input
              className="auth-input bg-white text-slate-900"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="teammate@company.com"
              required
              type="email"
              value={email}
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-200">Role</span>
            <select className="auth-select bg-white text-slate-900" onChange={(event) => setRole(event.target.value)} value={role}>
              <option value="admin">Admin</option>
              <option value="manager">Manager</option>
              <option value="member">Member</option>
            </select>
          </label>

          {status ? <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">{status}</div> : null}
          {error ? <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div> : null}

          <button className="auth-button-accent" disabled={isSubmitting} type="submit">
            {isSubmitting ? 'Sending invitation...' : 'Send invitation'}
          </button>
        </form>

        {inviteLink ? (
          <div className="mt-6 rounded-2xl border border-slate-700 bg-slate-950 px-4 py-4 text-sm text-slate-300">
            <div className="font-semibold text-slate-100">Invitation link preview</div>
            <div className="mt-2 break-all text-brand-200">{inviteLink}</div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
