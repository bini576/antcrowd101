import { Link } from 'react-router-dom';

const researcherFeatures = [
  ['Program clarity', 'Scope, rules, evidence expectations, and service handoff stay visible before you start testing.'],
  ['Verified impact', 'Accepted findings, CTF solves, and AI red team reports feed a shared platform reputation model.'],
  ['Reward readiness', 'Track earnings and payout requests from the researcher wallet once bounty reports are accepted.'],
  ['Trusted workflow', 'Responsible disclosure, invitations, and profile signals stay connected to the central platform session.']
];

export default function Researchers() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="h-1 bg-gradient-to-r from-amber-500 via-red-500 to-sky-400" />
      <section className="mx-auto grid max-w-7xl gap-10 px-6 py-20 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-amber-300">Researcher community</p>
          <h1 className="mt-4 font-space text-4xl font-black tracking-tight text-white sm:text-6xl">
            Build reputation through real security impact.
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-8 text-slate-400">
            Join approved programs, submit high-quality reports, solve challenges, and climb a competitive leaderboard backed by live AntCrowd services.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <Link to="/researchers/signup" className="rounded-xl bg-amber-400 px-6 py-3 text-sm font-black text-slate-950 shadow-lg shadow-amber-500/20 transition hover:bg-amber-300">
              Join the community
            </Link>
            <Link to="/researchers/leaderboard" className="rounded-xl border border-slate-700 px-6 py-3 text-sm font-bold text-slate-200 transition hover:border-amber-400/50 hover:text-amber-200">
              View leaderboard
            </Link>
          </div>
        </div>

        <div className="rounded-[1.75rem] border border-slate-800 bg-slate-900/70 p-6 shadow-[0_24px_90px_rgba(2,6,23,0.45)]">
          <div className="grid gap-4">
            {['Accepted report', 'Flag solved', 'AI impact accepted', 'Payout requested'].map((item, index) => (
              <div key={item} className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-950/65 px-4 py-4">
                <span className="font-semibold text-slate-200">{item}</span>
                <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs font-black text-amber-200">
                  +{[700, 250, 1000, 320][index]} pts
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-slate-800 bg-slate-900/35">
        <div className="mx-auto max-w-7xl px-6 py-16">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-red-300">Researcher operating model</p>
            <h2 className="mt-3 font-space text-3xl font-black text-white">Everything needed to work cleanly</h2>
          </div>
          <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {researcherFeatures.map(([title, body]) => (
              <article key={title} className="rounded-[1.5rem] border border-slate-800 bg-slate-950/72 p-6 shadow-[0_18px_60px_rgba(2,6,23,0.35)]">
                <h3 className="font-space text-xl font-bold text-white">{title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-400">{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-16">
        <div className="rounded-[1.75rem] border border-amber-400/20 bg-amber-400/10 p-8">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-amber-200">Leaderboard preview</p>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-5">
            <div>
              <h2 className="font-space text-3xl font-black text-white">See who is leading across the platform.</h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-amber-50/80">
                The leaderboard combines accepted scores from pentest, bug bounty, challenge, and AI red team services.
              </p>
            </div>
            <Link to="/researchers/leaderboard" className="rounded-xl bg-amber-400 px-6 py-3 text-sm font-black text-slate-950 transition hover:bg-amber-300">
              Open leaderboard
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
