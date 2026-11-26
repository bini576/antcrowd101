import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import AuthField from '../components/auth/AuthField';
import AuthNotice from '../components/auth/AuthNotice';
import AuthShell from '../components/auth/AuthShell';
import { resendConfirmationEmail, verifyEmailCode } from '../services/authApi';

type ConfirmationAccountType = 'researcher' | 'organization';
type ConfirmationLocationState = {
  email?: string;
  accountType?: ConfirmationAccountType;
  statusMessage?: string;
  emailDelivery?: 'sent' | 'failed';
  fallbackCode?: string;
  fallbackLink?: string;
};

export default function ResearcherConfirmEmail() {
  const location = useLocation();
  const locationState = (location.state as ConfirmationLocationState | null) ?? null;
  const searchParams = new URLSearchParams(location.search);
  const initialEmail =
    locationState?.email ??
    searchParams.get('email') ??
    '';
  const accountType = (
    locationState?.accountType ??
    (searchParams.get('accountType') as ConfirmationAccountType | null) ??
    'researcher'
  );
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState('');
  const [status, setStatus] = useState(locationState?.statusMessage ?? '');
  const [error, setError] = useState('');
  const [fallbackCode, setFallbackCode] = useState(locationState?.fallbackCode ?? '');
  const [fallbackLink, setFallbackLink] = useState(locationState?.fallbackLink ?? '');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [isVerified, setIsVerified] = useState(false);

  const signInPath = accountType === 'organization' ? '/login' : '/researchers/login';

  async function handleVerify(event: React.FormEvent) {
    event.preventDefault();
    setStatus('');
    setError('');
    setIsVerifying(true);

    try {
      const response = await verifyEmailCode({ email, code });
      setStatus(response.message);
      setIsVerified(true);
    } catch (submitError) {
      setIsVerified(false);
      setError(submitError instanceof Error ? submitError.message : 'Unable to verify your email code.');
    } finally {
      setIsVerifying(false);
    }
  }

  async function handleResendCode(event: React.FormEvent) {
    event.preventDefault();
    setStatus('');
    setError('');
    setFallbackCode('');
    setFallbackLink('');
    setIsResending(true);

    try {
      const response = await resendConfirmationEmail(email);
      setStatus(response.message);
      setFallbackCode(response.fallbackCode ?? '');
      if (response.fallbackCode) {
        setCode(response.fallbackCode);
      }
      setFallbackLink(response.fallbackLink ?? '');
      setIsVerified(false);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to resend verification code.');
    } finally {
      setIsResending(false);
    }
  }

  return (
    <AuthShell
      asideBody="We verify account ownership with a short-lived one-time code before first login. This protects workspace access across researcher and organization accounts."
      asideTitle="Enter your verification code"
      description="Check your inbox for the 6-digit code, then enter it here to activate your account."
      eyebrow={accountType === 'organization' ? 'Organization verification' : 'Researcher verification'}
      highlights={[
        'Short-lived one-time verification code',
        'Login remains blocked until verification succeeds',
        'Request a fresh code any time'
      ]}
      title="Verify your email"
      topLinkLabel="Back to sign in"
      topLinkPrompt="Already verified?"
      topLinkTo={signInPath}
    >
      <div className="space-y-5">
        <form className="space-y-5" onSubmit={handleVerify}>
          <AuthField
            autoComplete="email"
            label="Email address"
            name="email"
            onChange={(event) => setEmail(event.target.value)}
            required
            type="email"
            value={email}
          />
          <AuthField
            autoComplete="one-time-code"
            inputMode="numeric"
            label="Verification code"
            name="verificationCode"
            onChange={(event) => setCode(event.target.value.replace(/\D+/g, '').slice(0, 6))}
            placeholder="123456"
            required
            type="text"
            value={code}
          />

          {status ? <AuthNotice tone="success">{status}</AuthNotice> : null}
          {error ? <AuthNotice tone="error">{error}</AuthNotice> : null}
          {fallbackCode ? (
            <AuthNotice tone="info">
              Email delivery is currently unavailable. Use this verification code in development: <strong>{fallbackCode}</strong>
            </AuthNotice>
          ) : null}
          {fallbackLink ? (
            <AuthNotice tone="info">
              Fallback verification page: <a className="font-semibold underline" href={fallbackLink}>{fallbackLink}</a>
            </AuthNotice>
          ) : null}

          <button className="auth-button-primary w-full" disabled={isVerifying} type="submit">
            {isVerifying ? 'Verifying code...' : 'Verify email'}
          </button>
        </form>

        <form onSubmit={handleResendCode}>
          <button className="auth-button-secondary w-full" disabled={isResending} type="submit">
            {isResending ? 'Sending another code...' : 'Resend verification code'}
          </button>
        </form>

        {isVerified ? (
          <Link className="auth-button-accent w-full" to={signInPath}>
            Continue to sign in
          </Link>
        ) : null}
      </div>
    </AuthShell>
  );
}
