import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import type { AuthUser } from '../auth/types';
import { useAuth } from '../auth/AuthContext';
import { login, resolvePostLoginPath, verifyTwoFactorLogin } from '../services/authApi';
import { resolveResearcherRedirect } from '../researcher/researcherAuth';

type PortalAccountType = 'researcher' | 'organization';

const OTP_LENGTH = 6;

const highlights: Record<PortalAccountType, string[]> = {
  researcher: [
    'Unified sign-in for external & invited internal researchers',
    'Email verification required before first login',
    'Email-based two-factor authentication for added security',
  ],
  organization: [
    'Role-based organization onboarding & ownership',
    'Email verification and secure password reset flows',
    'Team invitation support for organization members',
  ],
};

/* ── OTP input ─────────────────────────────────────────────────── */

function OtpInput({ value, onChange, onComplete, disabled }: {
  value: string; onChange: (v: string) => void; onComplete: (v: string) => void; disabled: boolean;
}) {
  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/\D/g, '').slice(0, OTP_LENGTH);
    onChange(raw);
    if (raw.length === OTP_LENGTH) onComplete(raw);
  }
  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH);
    if (pasted) {
      onChange(pasted);
      if (pasted.length === OTP_LENGTH) onComplete(pasted);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <label style={{ color: '#94a3b8', fontSize: '0.8125rem', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
        Enter 6-digit code
      </label>
      <input
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={OTP_LENGTH}
        value={value}
        onChange={handleChange}
        onPaste={handlePaste}
        disabled={disabled}
        autoFocus
        placeholder="000000"
        style={{
          width: '100%',
          padding: '14px 20px',
          fontSize: '2rem',
          fontWeight: 700,
          textAlign: 'center',
          letterSpacing: '0.6em',
          borderRadius: '12px',
          border: '2px solid #f59e0b',
          background: '#0f172a',
          color: '#ffffff',
          outline: 'none',
          boxSizing: 'border-box',
          opacity: disabled ? 0.5 : 1,
          fontFamily: 'monospace',
          caretColor: '#f59e0b',
        }}
      />
    </div>
  );
}

/* ── Main component ────────────────────────────────────────────── */

export function SharedLoginPage({ defaultAccountType = 'organization' }: { defaultAccountType?: PortalAccountType }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { setAuthenticatedUser } = useAuth();

  const [activeType, setActiveType] = useState<PortalAccountType>(defaultAccountType);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [challengeToken, setChallengeToken] = useState('');
  const [challengeEmail, setChallengeEmail] = useState('');
  const [otpValue, setOtpValue] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const returnTo = new URLSearchParams(location.search).get('returnTo');
  const fromState = (location.state as { from?: string } | null)?.from ?? null;

  async function completeLogin(user: AuthUser) {
    setAuthenticatedUser(user);
    navigate(resolvePostLoginPath(user, resolveResearcherRedirect({ from: returnTo || fromState })), { replace: true });
  }

  async function submitOtp(code: string) {
    setError(''); setIsSubmitting(true);
    try { await completeLogin((await verifyTwoFactorLogin({ challengeToken, code, rememberMe })).user); }
    catch (e) { setError(e instanceof Error ? e.message : 'Invalid code.'); }
    finally { setIsSubmitting(false); }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setError(''); setIsSubmitting(true);
    try {
      if (challengeToken) { await submitOtp(otpValue); return; }
      const res = await login({ email, password, rememberMe });
      if (res.requiresTwoFactor && res.challengeToken) {
        setChallengeToken(res.challengeToken);
        setChallengeEmail(res.email || email);
        setOtpValue('');
        return;
      }
      if (res.user) await completeLogin(res.user);
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to sign in right now.'); }
    finally { setIsSubmitting(false); }
  }

  function resetTwoFactor() { setChallengeToken(''); setChallengeEmail(''); setOtpValue(''); setError(''); }

  /* ── 2FA step ── */
  if (challengeToken) {
    return (
      <div className="min-h-screen flex bg-slate-950">
        {/* Left branding */}
        <div className="hidden lg:flex w-[480px] flex-col justify-between p-10 bg-gradient-to-br from-slate-900 via-slate-800 to-amber-900/20 border-r border-slate-800">
          <div>
            <div className="text-amber-500 font-extrabold text-2xl tracking-tight mb-1">AntCrowd</div>
            <p className="text-slate-500 text-sm">Security Intelligence Platform</p>
          </div>
          <p className="text-slate-500 text-xs">&copy; 2026 AntCrowd. All rights reserved.</p>
        </div>

        {/* Right card */}
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-md bg-slate-800/60 backdrop-blur border border-slate-700/50 rounded-2xl shadow-2xl p-8 space-y-6">
            <div className="text-center space-y-2">
              <div className="text-5xl">📧</div>
              <h1 className="text-2xl font-bold text-white">Check your email</h1>
              <p className="text-slate-400 text-sm">We sent a 6-digit code to <span className="text-white font-medium">{challengeEmail}</span></p>
            </div>

            {error && <div className="rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-3">{error}</div>}

            <form onSubmit={handleSubmit} className="space-y-6">
              <OtpInput value={otpValue} onChange={setOtpValue} onComplete={submitOtp} disabled={isSubmitting} />
              <button type="submit" disabled={isSubmitting || otpValue.replace(/\s/g, '').length < OTP_LENGTH}
                className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold text-sm transition disabled:opacity-40">
                {isSubmitting ? 'Verifying…' : 'Verify and continue'}
              </button>
            </form>

            <div className="text-center">
              <button onClick={resetTwoFactor} className="text-sm text-slate-400 hover:text-white transition">← Back to sign in</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ── Normal login ── */
  const tips = highlights[activeType];

  return (
    <div className="min-h-screen flex bg-slate-950">
      {/* Left branding panel */}
      <div className="hidden lg:flex w-[480px] flex-col justify-between p-10 bg-gradient-to-br from-slate-900 via-slate-800 to-amber-900/20 border-r border-slate-800">
        <div className="space-y-8">
          <div>
            <div className="text-amber-500 font-extrabold text-2xl tracking-tight mb-1">AntCrowd</div>
            <p className="text-slate-500 text-sm">Security Intelligence Platform</p>
          </div>
          <div className="space-y-3">
            <h2 className="text-white text-xl font-bold leading-snug">
              {activeType === 'researcher' ? 'Find high-signal programs\nand move faster' : 'Secure your customer-facing\nsecurity workspace'}
            </h2>
            <p className="text-slate-400 text-sm leading-relaxed max-w-xs">
              {activeType === 'researcher'
                ? 'Use a single AntCrowd account to access programs, reports, inbox, and reputation.'
                : 'Launch programs, manage VDP operations, and coordinate security initiatives.'}
            </p>
          </div>
          <ul className="space-y-3">
            {tips.map((t, i) => (
              <li key={i} className="flex items-start gap-3 text-sm text-slate-300">
                <span className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full bg-amber-500/15 text-amber-500 flex items-center justify-center text-xs font-bold">✓</span>
                {t}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-slate-500 text-xs">&copy; 2026 AntCrowd. All rights reserved.</p>
      </div>

      {/* Right login card */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md space-y-6">
          {/* Top link */}
          <p className="text-sm text-slate-400 text-right">New to AntCrowd?{' '}
            <Link to="/signup" className="text-amber-500 font-semibold hover:text-amber-400 transition">Create an account</Link>
          </p>

          <div className="bg-slate-800/60 backdrop-blur border border-slate-700/50 rounded-2xl shadow-2xl p-8 space-y-6">
            <div>
              <h1 className="text-xl font-bold text-white">
                Sign in as {activeType === 'researcher' ? 'a researcher' : 'an organization user'}
              </h1>
              <p className="text-slate-400 text-sm mt-1">Secure, role-aware authentication for researchers and organizations.</p>
            </div>

            {/* Account type toggle */}
            <div className="flex rounded-xl bg-slate-900/60 p-1 border border-slate-700/40">
              {(['researcher', 'organization'] as PortalAccountType[]).map(t => (
                <button key={t} type="button" onClick={() => setActiveType(t)}
                  className={`flex-1 py-2 text-sm font-semibold rounded-lg transition ${
                    activeType === t ? 'bg-amber-500 text-slate-900 shadow' : 'text-slate-400 hover:text-white'}`}>
                  {t === 'researcher' ? 'Researcher' : 'Organization'}
                </button>
              ))}
            </div>

            {error && <div className="rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-3">{error}</div>}

            <form className="space-y-4" onSubmit={handleSubmit}>
              {/* Email */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Email address</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
                  </span>
                  <input type="email" required value={email} onChange={e => setEmail(e.target.value)} autoComplete="email"
                    placeholder={activeType === 'researcher' ? 'researcher@antcrowd.com' : 'security@company.com'}
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-600 bg-slate-900/60 text-white placeholder-slate-500
                               text-sm focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none transition" />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Password</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
                  </span>
                  <input type="password" required value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password"
                    placeholder="Enter your password"
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-600 bg-slate-900/60 text-white placeholder-slate-500
                               text-sm focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none transition" />
                </div>
              </div>

              {/* Remember + forgot */}
              <div className="flex items-center justify-between text-sm">
                <label className="flex items-center gap-2 text-slate-400">
                  <input type="checkbox" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-900 text-amber-500 focus:ring-amber-500/30" />
                  Keep me signed in
                </label>
                <Link to="/forgot-password" className="text-amber-500 font-semibold hover:text-amber-400 text-sm transition">Forgot password?</Link>
              </div>

              <button type="submit" disabled={isSubmitting}
                className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold text-sm transition disabled:opacity-40">
                {isSubmitting ? 'Signing in…' : 'Sign in'}
              </button>
            </form>
          </div>

          {/* Helper info */}
          <div className="rounded-xl bg-slate-800/40 border border-slate-700/40 px-4 py-3 text-sm text-slate-400">
            {activeType === 'researcher' ? (<>
              Internal researcher? You need an invitation link from a platform admin.{' '}
              <button className="text-amber-500 font-semibold" onClick={() => setActiveType('organization')} type="button">Switch to organization</button>
            </>) : (<>
              Platform admins use this same sign-in.{' '}
              <Link className="text-amber-500 font-semibold" to="/researchers/login">Go to researcher sign-in</Link>
            </>)}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Login() {
  return <SharedLoginPage defaultAccountType="organization" />;
}
