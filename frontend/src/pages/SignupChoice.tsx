import { Link } from 'react-router-dom';

const signupOptions = [
  {
    to: '/signup/researcher',
    eyebrow: 'Researcher access',
    title: 'Join as a researcher',
    description: 'Create an external researcher account for platform access. Internal researchers are onboarded through a platform-admin invitation link.',
    bullets: ['External researcher self-registration', 'Internal researchers are invite-only', 'One-time email code verification and authenticator-app 2FA supported']
  },
  {
    to: '/signup/company',
    eyebrow: 'Organization workspace',
    title: 'Create an organization account',
    description: 'Set up an organization workspace for VDP, bug bounty, training, and security program management.',
    bullets: ['Provision an owner account for your organization', 'Invite team members after signup', 'Use secure password reset and one-time email code verification']
  }
];

export default function SignupChoice() {
  return (
    <main className="min-h-screen bg-slate-950 bg-[radial-gradient(circle_at_top_left,_rgba(245,158,11,0.08),_transparent_35%)] px-4 py-12 sm:px-6 lg:px-8 flex flex-col justify-center">
      <div className="mx-auto w-full max-w-5xl space-y-10">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between border-b border-slate-800/80 pb-8">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-500">Create your AntCrowd account</p>
            <h1 className="font-space text-3xl sm:text-4xl font-extrabold tracking-tight text-white">Choose the account type that fits your role</h1>
            <p className="max-w-2xl text-sm leading-relaxed text-slate-400">
              Researchers and organizations use the same secure authentication platform, with registration tailored to the work each role needs to do.
            </p>
          </div>

          <div className="self-start md:self-center shrink-0 rounded-full border border-slate-800 bg-slate-900/60 backdrop-blur px-5 py-2.5 text-sm text-slate-400 shadow-xl shadow-black/10">
            Already have an account?{' '}
            <Link className="font-bold text-amber-500 hover:text-amber-400 transition" to="/login">
              Sign in
            </Link>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {signupOptions.map((option) => (
            <Link
              key={option.to}
              className="group relative overflow-hidden bg-slate-900/40 border border-slate-800/80 rounded-2xl p-8 transition-all duration-300 hover:border-amber-500/30 hover:bg-slate-800/60 hover:-translate-y-1 hover:shadow-2xl hover:shadow-amber-500/5 flex flex-col justify-between"
              to={option.to}
            >
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-500">{option.eyebrow}</p>
                <h2 className="mt-5 font-space text-2xl font-bold text-white group-hover:text-amber-400 transition duration-300">{option.title}</h2>
                <p className="mt-3 text-sm leading-relaxed text-slate-400">{option.description}</p>

                <div className="mt-6 space-y-3">
                  {option.bullets.map((bullet) => (
                    <div key={bullet} className="flex items-start gap-3 rounded-xl bg-slate-950/60 border border-slate-850 px-4 py-3 text-xs text-slate-300">
                      <span className="mt-1.5 inline-flex h-2 w-2 shrink-0 rounded-full bg-amber-500/80" />
                      <span>{bullet}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-8 inline-flex items-center gap-2 text-sm font-bold text-white transition group-hover:text-amber-400">
                Continue
                <span className="transition-transform duration-300 group-hover:translate-x-1" aria-hidden="true">→</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}

