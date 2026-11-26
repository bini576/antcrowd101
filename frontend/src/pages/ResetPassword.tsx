import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import AuthField from '../components/auth/AuthField';
import AuthNotice from '../components/auth/AuthNotice';
import AuthShell from '../components/auth/AuthShell';
import { resetPassword } from '../services/authApi';

export default function ResetPassword() {
  const location = useLocation();
  const token = new URLSearchParams(location.search).get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setStatus('');
    setError('');

    if (!token) {
      setError('Reset token is missing.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await resetPassword(token, password);
      setStatus(response.message);
      setPassword('');
      setConfirmPassword('');
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to reset your password.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthShell
      asideBody="Reset tokens are time-limited and single-use. When the password changes, older sessions are invalidated for safety."
      asideTitle="Choose a new password securely"
      description="Use the password reset link from your email to set a new password for your account."
      eyebrow="Secure password reset"
      highlights={[
        '30 minute reset token expiry',
        'Session version bumps after password change',
        'Strong password requirements enforced'
      ]}
      title="Create a new password"
      topLinkLabel="Back to sign in"
      topLinkPrompt="Already reset it?"
      topLinkTo="/login"
    >
      <div className="space-y-5">
        {!token ? <AuthNotice tone="error">Reset token is missing from the URL.</AuthNotice> : null}

        <form className="space-y-5" onSubmit={handleSubmit}>
          <AuthField
            autoComplete="new-password"
            label="New password"
            name="password"
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter a strong password"
            required
            type="password"
            value={password}
          />

          <AuthField
            autoComplete="new-password"
            label="Confirm password"
            name="confirmPassword"
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder="Re-enter your password"
            required
            type="password"
            value={confirmPassword}
          />

          {status ? <AuthNotice tone="success">{status}</AuthNotice> : null}
          {error ? <AuthNotice tone="error">{error}</AuthNotice> : null}

          <button className="auth-button-accent" disabled={isSubmitting || !token} type="submit">
            {isSubmitting ? 'Updating password...' : 'Reset password'}
          </button>
        </form>

        {status ? (
          <Link className="auth-button-secondary w-full" to="/login">
            Continue to sign in
          </Link>
        ) : null}
      </div>
    </AuthShell>
  );
}
