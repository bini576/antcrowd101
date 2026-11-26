import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { acceptOrgInvite, getOrgInvite } from '../services/authApi';

export default function CompanyInviteAccept() {
  const location = useLocation();
  const token = new URLSearchParams(location.search).get('token') ?? '';
  const [invite, setInvite] = useState<{ email: string; orgName: string; role: string } | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [status, setStatus] = useState<'loading' | 'ready' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadInvitation() {
      if (!token) {
        setStatus('error');
        setMessage('Invitation token missing.');
        return;
      }

      try {
        const response = await getOrgInvite(token);
        if (!cancelled) {
          setInvite(response);
          setStatus('ready');
        }
      } catch (error) {
        if (!cancelled) {
          setStatus('error');
          setMessage(error instanceof Error ? error.message : 'Invitation not found.');
        }
      }
    }

    void loadInvitation();

    return () => {
      cancelled = true;
    };
  }, [token]);

  async function handleAccept(event: React.FormEvent) {
    event.preventDefault();
    setMessage('');

    if (password !== confirmPassword) {
      setStatus('error');
      setMessage('Passwords do not match.');
      return;
    }

    setStatus('loading');

    try {
      const response = await acceptOrgInvite({
        token,
        password,
        firstName,
        lastName
      });
      setStatus('success');
      setMessage(response.message);
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'Unable to accept invitation.');
    }
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#0f172a_0%,#020617_100%)] px-6 py-10 text-white">
      <div className="mx-auto max-w-2xl rounded-[32px] border border-white/10 bg-white/5 p-8 shadow-panel backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-200">Organization invitation</p>
        <h1 className="mt-4 font-space text-3xl font-bold">Accept your AntCrowd workspace invitation</h1>

        {status === 'loading' ? <p className="mt-6 text-sm text-slate-300">Loading invitation...</p> : null}

        {invite ? (
          <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-5 text-sm text-slate-200">
            <div><strong>Organization:</strong> {invite.orgName}</div>
            <div className="mt-2"><strong>Role:</strong> {invite.role}</div>
            <div className="mt-2"><strong>Email:</strong> {invite.email}</div>
          </div>
        ) : null}

        {status !== 'success' && invite ? (
          <form className="mt-8 space-y-5" onSubmit={handleAccept}>
            <div className="grid gap-5 sm:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-200">First name</span>
                <input className="auth-input bg-white text-slate-900" onChange={(event) => setFirstName(event.target.value)} required type="text" value={firstName} />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-200">Last name</span>
                <input className="auth-input bg-white text-slate-900" onChange={(event) => setLastName(event.target.value)} required type="text" value={lastName} />
              </label>
            </div>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-200">Create password</span>
              <input className="auth-input bg-white text-slate-900" onChange={(event) => setPassword(event.target.value)} required type="password" value={password} />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-200">Confirm password</span>
              <input className="auth-input bg-white text-slate-900" onChange={(event) => setConfirmPassword(event.target.value)} required type="password" value={confirmPassword} />
            </label>

            <button className="auth-button-accent" type="submit">
              Create account and accept invitation
            </button>
          </form>
        ) : null}

        {message ? (
          <div className={`mt-6 rounded-2xl border px-4 py-3 text-sm ${status === 'success' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200' : 'border-rose-500/30 bg-rose-500/10 text-rose-200'}`}>
            {message}
          </div>
        ) : null}

        {status === 'success' ? (
          <Link className="mt-6 inline-flex rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-900" to="/login">
            Continue to sign in
          </Link>
        ) : null}
      </div>
    </div>
  );
}
