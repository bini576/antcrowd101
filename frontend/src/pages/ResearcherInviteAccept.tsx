import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import AuthNotice from '../components/auth/AuthNotice';
import AuthShell from '../components/auth/AuthShell';
import { acceptResearcherInvite, getResearcherInvite, type ResearcherInvitation } from '../services/authApi';

export default function ResearcherInviteAccept() {
  const location = useLocation();
  const navigate = useNavigate();
  const token = new URLSearchParams(location.search).get('token') ?? '';
  const isCreatePasswordFlow = location.pathname === '/create-password';
  const [invite, setInvite] = useState<ResearcherInvitation | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [status, setStatus] = useState<'loading' | 'ready' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadInvitation() {
      if (!token) {
        setStatus('error');
        setMessage('Researcher invitation token missing.');
        return;
      }

      try {
        const response = await getResearcherInvite(token);
        if (!cancelled) {
          setInvite(response);
          setStatus('ready');
        }
      } catch (error) {
        if (!cancelled) {
          setStatus('error');
          setMessage(error instanceof Error ? error.message : 'Researcher invitation not found.');
        }
      }
    }

    void loadInvitation();

    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (status !== 'success') {
      return undefined;
    }

    const redirectTimer = window.setTimeout(() => {
      navigate('/researchers/login', { replace: true });
    }, 1400);

    return () => {
      window.clearTimeout(redirectTimer);
    };
  }, [navigate, status]);

  async function handleAccept(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');

    if (password !== confirmPassword) {
      setStatus('error');
      setMessage('Passwords do not match.');
      return;
    }

    setStatus('loading');

    try {
      const response = await acceptResearcherInvite({
        token,
        password,
        firstName,
        lastName,
        displayName
      });
      setStatus('success');
      setMessage(response.message);
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'Unable to activate the researcher account.');
    }
  }

  return (
    <AuthShell
      asideBody={
        isCreatePasswordFlow
          ? 'This secure activation step is how invited internal researchers create their ANTCROWD password, validate their one-time invite token, and unlock the first sign-in.'
          : 'Platform-admin invitations are the onboarding path for internal researchers and can also be used for controlled external access. The activation step sets the password and marks the invitation as accepted.'
      }
      asideTitle={isCreatePasswordFlow ? 'Create your ANTCROWD password' : 'Activate your invited researcher account'}
      description={
        isCreatePasswordFlow
          ? 'Set your password to activate the account behind this one-time invitation. After activation, sign in and complete your verification submission.'
          : 'This flow is used for invited researcher access. After activation, sign in and complete the verification submission to unlock platform services.'
      }
      eyebrow={isCreatePasswordFlow ? 'Account activation' : 'Researcher invitation'}
      highlights={[
        'Invite-only activation for internal researchers',
        'Secure password setup with role-aware account creation',
        'Verification submission required before service access'
      ]}
      title={isCreatePasswordFlow ? 'Create your ANTCROWD account' : 'Accept researcher invitation'}
      topLinkLabel="Back to sign in"
      topLinkPrompt="Already activated?"
      topLinkTo="/researchers/login"
    >
      <div className="space-y-5">
        {status === 'loading' && !invite ? <AuthNotice tone="info">Loading invitation...</AuthNotice> : null}

        {invite ? (
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-700">
            <div>
              <strong>Email:</strong> {invite.email}
            </div>
            <div className="mt-2">
              <strong>Researcher type:</strong> <span className="capitalize">{invite.researcherType}</span>
            </div>
            {invite.notes ? (
              <div className="mt-2">
                <strong>Notes:</strong> {invite.notes}
              </div>
            ) : null}
          </div>
        ) : null}

        {status !== 'success' && invite ? (
          <form className="space-y-5" onSubmit={handleAccept}>
            <div className="grid gap-5 sm:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">First name</span>
                <input
                  className="auth-input"
                  onChange={(event) => setFirstName(event.target.value)}
                  required
                  type="text"
                  value={firstName}
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">Last name</span>
                <input
                  className="auth-input"
                  onChange={(event) => setLastName(event.target.value)}
                  required
                  type="text"
                  value={lastName}
                />
              </label>
            </div>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">Display name</span>
              <input
                className="auth-input"
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="public researcher handle"
                type="text"
                value={displayName}
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">Create password</span>
              <input
                className="auth-input"
                onChange={(event) => setPassword(event.target.value)}
                required
                type="password"
                value={password}
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">Confirm password</span>
              <input
                className="auth-input"
                onChange={(event) => setConfirmPassword(event.target.value)}
                required
                type="password"
                value={confirmPassword}
              />
            </label>

            <button className="auth-button-primary" type="submit">
              {isCreatePasswordFlow ? 'Create account' : 'Activate researcher account'}
            </button>
          </form>
        ) : null}

        {message ? <AuthNotice tone={status === 'success' ? 'success' : 'error'}>{message}</AuthNotice> : null}

        {status === 'success' ? (
          <Link className="auth-button-primary" to="/researchers/login">
            Continue to sign in
          </Link>
        ) : null}
      </div>
    </AuthShell>
  );
}
