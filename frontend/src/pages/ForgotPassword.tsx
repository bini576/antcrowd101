import { useState } from 'react';
import AuthField from '../components/auth/AuthField';
import AuthNotice from '../components/auth/AuthNotice';
import AuthShell from '../components/auth/AuthShell';
import { forgotPassword } from '../services/authApi';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [fallbackLink, setFallbackLink] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setStatus('');
    setError('');
    setFallbackLink('');
    setIsSubmitting(true);

    try {
      const response = await forgotPassword(email);
      setStatus(response.message);
      setFallbackLink(response.fallbackLink ?? '');
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to send reset instructions.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthShell
      asideBody="Reset links are short-lived, single-use, and delivered through your platform email provider."
      asideTitle="Recover account access without weakening security"
      description="Enter the email address tied to your account and we’ll send a secure password reset link."
      eyebrow="Password recovery"
      highlights={[
        'Single-use token with a 30 minute expiry',
        'Generic response to avoid user enumeration',
        'Password reset invalidates older sessions'
      ]}
      title="Forgot your password?"
      topLinkLabel="Return to sign in"
      topLinkPrompt="Remembered it?"
      topLinkTo="/login"
    >
      <form className="space-y-5" onSubmit={handleSubmit}>
        <AuthField
          autoComplete="email"
          label="Email address"
          name="email"
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@company.com"
          required
          type="email"
          value={email}
        />

        {status ? <AuthNotice tone="success">{status}</AuthNotice> : null}
        {error ? <AuthNotice tone="error">{error}</AuthNotice> : null}
        {fallbackLink ? (
          <AuthNotice tone="info">
            Development reset link: <a className="font-semibold underline" href={fallbackLink}>{fallbackLink}</a>
          </AuthNotice>
        ) : null}

        <button className="auth-button-primary" disabled={isSubmitting} type="submit">
          {isSubmitting ? 'Sending secure link...' : 'Send reset instructions'}
        </button>
      </form>
    </AuthShell>
  );
}
