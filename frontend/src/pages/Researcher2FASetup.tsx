import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { enableTwoFactor, disableTwoFactor } from '../services/authApi';

export default function Researcher2FASetup() {
  const { user, isLoading: isSessionLoading, setAuthenticatedUser } = useAuth();
  const [showModal, setShowModal] = useState<'enable' | 'disable' | null>(null);
  const [modalPassword, setModalPassword] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  if (isSessionLoading) {
    return <div className="min-h-screen grid place-items-center bg-slate-950 text-slate-300">Loading your security settings…</div>;
  }
  if (!user) return <Navigate replace to="/login" />;

  const workspacePath = user.accountType === 'organization' ? '/organization/workspace' : user.accountType === 'platform_admin' ? '/admin/' : '/settings';

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault(); setError(''); setIsLoading(true);
    try {
      const action = showModal === 'enable' ? enableTwoFactor : disableTwoFactor;
      const res = await action(modalPassword);
      setAuthenticatedUser(res.user);
      setModalPassword(''); setShowModal(null); setStatus(res.message);
    } catch (err) { setError(err instanceof Error ? err.message : 'Something went wrong.'); }
    finally { setIsLoading(false); }
  }

  function closeModal() { setShowModal(null); setModalPassword(''); setError(''); }

  return (
    <div className="min-h-screen flex bg-slate-950">
      {/* Left branding */}
      <div className="hidden lg:flex w-[480px] flex-col justify-between p-10 bg-gradient-to-br from-slate-900 via-slate-800 to-amber-900/20 border-r border-slate-800">
        <div className="space-y-8">
          <div>
            <div className="text-amber-500 font-extrabold text-2xl tracking-tight mb-1">AntCrowd</div>
            <p className="text-slate-500 text-sm">Security Settings</p>
          </div>
          <div className="space-y-3">
            <h2 className="text-white text-xl font-bold leading-snug">Protect your account with email&#8209;based&nbsp;2FA</h2>
            <p className="text-slate-400 text-sm leading-relaxed max-w-xs">
              When enabled, we'll email a 6-digit code each time you sign in. No authenticator app required.
            </p>
          </div>
          <ul className="space-y-3 text-sm text-slate-300">
            {['A 6-digit code is emailed at each sign-in', 'No authenticator app required', 'Codes expire in 10 minutes with rate limiting'].map((t, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full bg-amber-500/15 text-amber-500 flex items-center justify-center text-xs font-bold">✓</span>{t}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-slate-500 text-xs">&copy; 2026 AntCrowd. All rights reserved.</p>
      </div>

      {/* Right content */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md space-y-5">
          <p className="text-sm text-slate-400 text-right">
            <Link to={workspacePath} className="text-amber-500 font-semibold hover:text-amber-400 transition">← Back to workspace</Link>
          </p>

          {/* Status / info */}
          <div className="bg-slate-800/60 backdrop-blur border border-slate-700/50 rounded-xl px-5 py-3 text-sm text-slate-300">
            Signed in as <span className="text-white font-medium">{user.email}</span>. 2FA is <span className={`font-semibold ${user.twoFactorEnabled ? 'text-emerald-400' : 'text-slate-400'}`}>{user.twoFactorEnabled ? 'enabled' : 'disabled'}</span>.
          </div>

          {status && <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm px-4 py-3">{status}</div>}

          {/* Main card */}
          <div className="bg-slate-800/60 backdrop-blur border border-slate-700/50 rounded-2xl shadow-2xl p-8 space-y-5">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-white">Two-Factor Authentication</h1>
              {user.twoFactorEnabled && (
                <span className="inline-flex items-center gap-1 px-3 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 text-xs font-bold">✓ Enabled</span>
              )}
            </div>

            <p className="text-sm text-slate-400 leading-relaxed">
              {user.twoFactorEnabled
                ? 'A sign-in code is emailed to your address each time you log in.'
                : 'Get a 6-digit code by email each time you sign in. This adds an extra layer of security to your account.'}
            </p>

            <button type="button"
              onClick={() => { setShowModal(user.twoFactorEnabled ? 'disable' : 'enable'); setError(''); setStatus(''); }}
              className={`w-full py-3 rounded-xl font-bold text-sm transition ${
                user.twoFactorEnabled
                  ? 'bg-slate-700 hover:bg-slate-600 text-white'
                  : 'bg-amber-500 hover:bg-amber-600 text-slate-900'
              }`}>
              {user.twoFactorEnabled ? 'Disable two-factor authentication' : 'Enable two-factor authentication'}
            </button>
          </div>

          <p className="text-sm text-slate-500">Need help? Go back to <Link to={workspacePath} className="text-amber-500 font-semibold">your workspace</Link>.</p>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/70 backdrop-blur-sm" onClick={e => { if (e.target === e.currentTarget) closeModal(); }}>
          <div className="w-full max-w-sm bg-slate-800 border border-slate-700 rounded-2xl p-7 shadow-2xl space-y-5 animate-in fade-in slide-in-from-bottom-4">
            <div>
              <h2 className="text-lg font-bold text-white">{showModal === 'enable' ? 'Enable email 2FA' : 'Disable email 2FA'}</h2>
              <p className="text-sm text-slate-400 mt-1">{showModal === 'enable' ? 'Enter your password to turn on email-based 2FA.' : 'Enter your password to turn off 2FA.'}</p>
            </div>

            {error && <div className="rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-3">{error}</div>}

            <form onSubmit={handleConfirm} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Password</label>
                <input type="password" autoComplete="current-password" required value={modalPassword}
                  onChange={e => setModalPassword(e.target.value)} autoFocus placeholder="Enter your password"
                  className="w-full px-4 py-3 rounded-xl border border-slate-600 bg-slate-900/60 text-white placeholder-slate-500
                             text-sm focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none transition" />
              </div>
              <div className="flex gap-3 justify-end">
                <button type="button" onClick={closeModal}
                  className="px-4 py-2.5 rounded-xl border border-slate-600 text-slate-300 text-sm font-semibold hover:bg-slate-700 transition">Cancel</button>
                <button type="submit" disabled={isLoading || !modalPassword}
                  className={`px-5 py-2.5 rounded-xl text-sm font-bold transition disabled:opacity-40 ${
                    showModal === 'enable' ? 'bg-amber-500 hover:bg-amber-600 text-slate-900' : 'bg-red-600 hover:bg-red-700 text-white'}`}>
                  {isLoading ? (showModal === 'enable' ? 'Enabling…' : 'Disabling…') : (showModal === 'enable' ? 'Enable 2FA' : 'Disable 2FA')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
