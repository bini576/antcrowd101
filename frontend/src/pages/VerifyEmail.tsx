import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import AuthNotice from '../components/auth/AuthNotice';
import AuthShell from '../components/auth/AuthShell';
import { verifyEmailToken } from '../services/authApi';

export default function VerifyEmail() {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const token = searchParams.get('token') ?? '';
  const prefillEmail = searchParams.get('email') ?? '';
  const accountType = searchParams.get('accountType') === 'organization' ? 'organization' : 'researcher';
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Validating your verification link...');
  const [nextLink, setNextLink] = useState('/login');

  useEffect(() => {
    let cancelled = false;

    async function verify() {
      if (!token) {
        setStatus('error');
        setMessage('Verification link is missing or incomplete. Continue with the 6-digit code sent to your email.');
        return;
      }

      try {
        const response = await verifyEmailToken(token);
        if (!cancelled) {
          setStatus('success');
          setMessage(response.message);
          setNextLink(response.user.accountType === 'researcher' ? '/researchers/login' : '/login');
        }
      } catch (error) {
        if (!cancelled) {
          setStatus('error');
          setMessage(error instanceof Error ? error.message : 'Unable to verify your email.');
        }
      }
    }

    void verify();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const codeEntryQuery = new URLSearchParams({
    ...(prefillEmail ? { email: prefillEmail } : {}),
    accountType
  }).toString();
  const codeEntryPath = `/researchers/confirm-email${codeEntryQuery ? `?${codeEntryQuery}` : ''}`;

  return (
    <AuthShell
      asideBody="AntCrowd now uses one-time email codes for primary verification. This page supports legacy link verification and redirects you to code verification if needed."
      asideTitle="Complete account verification"
      description="Use the verification code from your inbox to activate sign-in access."
      eyebrow="Email verification"
      highlights={[
        'One-time code verification for new signups',
        'Legacy links still supported',
        'Works for researcher and organization accounts'
      ]}
      title="Verify your account"
      topLinkLabel="Go to sign in"
      topLinkPrompt="Ready to continue?"
      topLinkTo={nextLink}
    >
      <div className="space-y-5">
        <AuthNotice tone={status === 'success' ? 'success' : status === 'error' ? 'error' : 'info'}>{message}</AuthNotice>

        {status === 'success' ? (
          <div className="flex flex-wrap gap-3">
            <Link className="auth-button-primary" to={nextLink}>
              Continue to sign in
            </Link>
            <Link className="auth-button-secondary" to="/researchers/2fa-setup">
              Open 2FA setup page
            </Link>
          </div>
        ) : status === 'error' ? (
          <Link className="auth-button-secondary w-full" to={codeEntryPath}>
            Verify with email code
          </Link>
        ) : null}
      </div>
    </AuthShell>
  );
}
