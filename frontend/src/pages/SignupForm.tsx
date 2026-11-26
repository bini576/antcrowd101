import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { ResearcherType } from '../auth/types';
import AuthField from '../components/auth/AuthField';
import { register } from '../services/authApi';

type SignupAccountType = 'researcher' | 'organization';

function getPasswordStrength(password: string) {
  let score = 0;
  if (password.length >= 10) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[a-z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  return score;
}

function strengthColor(s: number) {
  if (s <= 1) return 'bg-red-500';
  if (s <= 2) return 'bg-orange-500';
  if (s <= 3) return 'bg-amber-500';
  if (s <= 4) return 'bg-lime-500';
  return 'bg-emerald-500';
}
function strengthLabel(s: number) {
  if (s <= 1) return 'Weak';
  if (s <= 2) return 'Fair';
  if (s <= 3) return 'Good';
  if (s <= 4) return 'Strong';
  return 'Excellent';
}

const highlights: Record<SignupAccountType, string[]> = {
  researcher: [
    'External researcher self-registration',
    'Internal researchers activate from an invitation email',
    'Modern password requirements with email code verification',
    'Email-based 2FA available after sign-in',
  ],
  organization: [
    'Owner account plus organization workspace provisioning',
    'Company-ready contact fields and role-aware login',
    'Platform-admin approval before first organization sign-in',
    'Invite teammates with secure activation links',
  ],
};

export default function SignupForm() {
  const { type } = useParams();
  const navigate = useNavigate();
  const accountType: SignupAccountType = type === 'researcher' ? 'researcher' : 'organization';

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    displayName: '',
    researcherType: 'external' as ResearcherType,
    organizationName: '',
    website: '',
    jobTitle: '',
    email: '',
    password: '',
    confirmPassword: '',
    acceptedTerms: false
  });
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const passwordStrength = getPasswordStrength(form.password);
  const step = 1;
  const totalSteps = accountType === 'organization' ? 3 : 2;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError('');

    if (!form.acceptedTerms) {
      setError('Please accept the Terms & Conditions and Privacy Policy to continue.');
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    try {
      setIsSubmitting(true);
      let registrationResult;

      if (accountType === 'researcher') {
        registrationResult = await register({
          accountType: 'researcher',
          researcherType: form.researcherType,
          firstName: form.firstName,
          lastName: form.lastName,
          displayName: form.displayName,
          email: form.email,
          password: form.password
        });
      } else {
        registrationResult = await register({
          accountType: 'organization',
          firstName: form.firstName,
          lastName: form.lastName,
          jobTitle: form.jobTitle,
          organizationName: form.organizationName,
          website: form.website,
          email: form.email,
          password: form.password
        });
      }

      navigate('/researchers/confirm-email', {
        replace: true,
        state: {
          email: form.email,
          accountType,
          statusMessage: registrationResult?.message ?? '',
          emailDelivery: registrationResult?.emailDelivery,
          fallbackCode: registrationResult?.fallbackCode ?? '',
          fallbackLink: registrationResult?.fallbackLink ?? ''
        }
      });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to create your account.');
    } finally {
      setIsSubmitting(false);
    }
  }

  const tips = highlights[accountType];

  return (
    <div className="min-h-screen flex bg-slate-950">
      {/* Left branding */}
      <div className="hidden lg:flex w-[480px] flex-col justify-between p-10 bg-gradient-to-br from-slate-900 via-slate-800 to-amber-900/20 border-r border-slate-800">
        <div className="space-y-8">
          <div>
            <div className="text-amber-500 font-extrabold text-2xl tracking-tight mb-1">AntCrowd</div>
            <p className="text-slate-500 text-sm">{accountType === 'researcher' ? 'Researcher Signup' : 'Organization Signup'}</p>
          </div>
          <div className="space-y-3">
            <h2 className="text-white text-xl font-bold leading-snug">
              {accountType === 'researcher' ? 'Researcher registration built for trust and speed' : 'Professional onboarding for security program owners'}
            </h2>
            <p className="text-slate-400 text-sm leading-relaxed max-w-xs">
              {accountType === 'researcher'
                ? 'AntCrowd onboarding is optimized for clear identity, safe access, and a smooth first login experience.'
                : 'Organization registration creates both the owner identity and the initial company workspace in one flow.'}
            </p>
          </div>
          <ul className="space-y-3 text-sm text-slate-300">
            {tips.map((t, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full bg-amber-500/15 text-amber-500 flex items-center justify-center text-xs font-bold">✓</span>{t}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-slate-500 text-xs">&copy; 2026 AntCrowd. All rights reserved.</p>
      </div>

      {/* Right form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-lg space-y-5">
          <p className="text-sm text-slate-400 text-right">Already registered?{' '}
            <Link to={accountType === 'researcher' ? '/researchers/login' : '/login'} className="text-amber-500 font-semibold hover:text-amber-400 transition">Sign in</Link>
          </p>

          <div className="bg-slate-800/60 backdrop-blur border border-slate-700/50 rounded-2xl shadow-2xl p-8 space-y-6">
            {/* Step indicator */}
            <div className="flex items-center gap-2">
              {Array.from({ length: totalSteps }).map((_, i) => (
                <div key={i} className="flex items-center gap-2 flex-1">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition ${
                    step > i + 1 ? 'bg-emerald-500 text-white' : step === i + 1 ? 'bg-amber-500 text-slate-900' : 'bg-slate-700 text-slate-400'
                  }`}>{step > i + 1 ? '✓' : i + 1}</div>
                  {i < totalSteps - 1 && <div className={`flex-1 h-0.5 rounded ${step > i + 1 ? 'bg-emerald-500' : 'bg-slate-700'}`} />}
                </div>
              ))}
            </div>

            <div>
              <h1 className="text-xl font-bold text-white">{accountType === 'researcher' ? 'Create your researcher account' : 'Launch your organization workspace'}</h1>
              <p className="text-slate-400 text-sm mt-1">{accountType === 'researcher' ? 'External researchers register here. Internal researchers use an invitation link.' : 'After email verification, a platform admin reviews and approves access.'}</p>
            </div>

            {error && <div className="rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-3">{error}</div>}

            <form className="space-y-5" onSubmit={handleSubmit}>
              {accountType === 'researcher' ? (
                <div className="space-y-3">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Researcher access model</span>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border-2 border-amber-500/40 bg-amber-500/5 px-4 py-3 text-left">
                      <div className="font-semibold text-amber-400 text-sm">External researcher</div>
                      <div className="mt-1 text-xs text-slate-400">Direct registration for independent researchers.</div>
                    </div>
                    <div className="rounded-xl border border-slate-700 bg-slate-800/40 px-4 py-3 text-left">
                      <div className="font-semibold text-slate-400 text-sm">Internal researcher</div>
                      <div className="mt-1 text-xs text-slate-500">Invite-only via platform admin link.</div>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <AuthField label="Organization name" name="organizationName" onChange={e => setForm(c => ({ ...c, organizationName: e.target.value }))} placeholder="Acme Security" required type="text" value={form.organizationName} />
                  <AuthField label="Company website" name="website" onChange={e => setForm(c => ({ ...c, website: e.target.value }))} placeholder="https://acme.com" type="url" value={form.website} />
                </>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <AuthField label="First name" name="firstName" onChange={e => setForm(c => ({ ...c, firstName: e.target.value }))} required type="text" value={form.firstName} />
                <AuthField label="Last name" name="lastName" onChange={e => setForm(c => ({ ...c, lastName: e.target.value }))} required type="text" value={form.lastName} />
              </div>

              {accountType === 'researcher' ? (
                <AuthField hint="Shown on your researcher profile." label="Display name" name="displayName" onChange={e => setForm(c => ({ ...c, displayName: e.target.value }))} placeholder="handle or public name" type="text" value={form.displayName} />
              ) : (
                <AuthField label="Job title" name="jobTitle" onChange={e => setForm(c => ({ ...c, jobTitle: e.target.value }))} placeholder="Security Program Manager" type="text" value={form.jobTitle} />
              )}

              <AuthField autoComplete="email" label="Email address" name="email" onChange={e => setForm(c => ({ ...c, email: e.target.value }))} placeholder={accountType === 'researcher' ? 'researcher@antcrowd.com' : 'security@company.com'} required type="email" value={form.email} />

              <div className="space-y-3">
                <AuthField autoComplete="new-password" label="Password" name="password" onChange={e => setForm(c => ({ ...c, password: e.target.value }))} placeholder="Choose a strong password" required type="password" value={form.password} />

                {/* Password strength bar */}
                {form.password && (
                  <div>
                    <div className="mb-1.5 flex items-center justify-between text-xs font-semibold uppercase tracking-widest">
                      <span className="text-slate-500">Strength</span>
                      <span className={`${passwordStrength >= 4 ? 'text-emerald-400' : passwordStrength >= 3 ? 'text-amber-400' : 'text-red-400'}`}>{strengthLabel(passwordStrength)}</span>
                    </div>
                    <div className="flex gap-1.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${i < passwordStrength ? strengthColor(passwordStrength) : 'bg-slate-700'}`} />
                      ))}
                    </div>
                  </div>
                )}

                <AuthField autoComplete="new-password" label="Confirm password" name="confirmPassword" onChange={e => setForm(c => ({ ...c, confirmPassword: e.target.value }))} placeholder="Re-enter your password" required type="password" value={form.confirmPassword} />
              </div>

              <label className="flex items-start gap-3 rounded-xl bg-slate-900/60 border border-slate-700/40 px-4 py-3 text-sm text-slate-400 cursor-pointer">
                <input checked={form.acceptedTerms} className="mt-0.5 w-4 h-4 rounded border-slate-600 bg-slate-900 text-amber-500 focus:ring-amber-500/30" onChange={e => setForm(c => ({ ...c, acceptedTerms: e.target.checked }))} type="checkbox" />
                <span>I agree to the Terms & Conditions and Privacy Policy, and I understand email verification is required before login.</span>
              </label>

              <button type="submit" disabled={isSubmitting}
                className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold text-sm transition disabled:opacity-40">
                {isSubmitting ? 'Creating your account…' : 'Create account'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
