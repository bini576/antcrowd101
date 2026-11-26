import { Link } from 'react-router-dom';

const trustSignals = [
  ['Security overview', 'Publish posture, ownership, and operating principles for customer review.'],
  ['Compliance evidence', 'Present frameworks, controls, resources, and security updates in one place.'],
  ['Access workflow', 'Collect customer access requests and route them to the right internal team.']
];

export default function TrustCenter() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="h-1 bg-gradient-to-r from-amber-500 via-red-500 to-sky-400" />
      <header className="border-b border-slate-800/70">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <Link to="/" className="font-space text-2xl font-black text-amber-400">AntCrowd</Link>
          <nav className="flex items-center gap-4 text-sm font-semibold text-slate-300">
            <Link to="/solutions" className="hover:text-amber-300">Solutions</Link>
            <Link to="/trust" className="rounded-xl border border-slate-700 px-4 py-2 hover:border-amber-400/50 hover:text-amber-300">Open trust portal</Link>
          </nav>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-10 px-6 py-20 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-amber-300">Trust Center</p>
          <h1 className="mt-4 font-space text-4xl font-black tracking-tight text-white sm:text-6xl">
            Share security proof without slowing down sales.
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-8 text-slate-400">
            AntCrowd Trust Center gives organizations a dark, branded, self-service surface for security posture, compliance artifacts, subprocessors, FAQs, and updates.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <Link to="/trust" className="rounded-xl bg-amber-400 px-6 py-3 text-sm font-black text-slate-950 shadow-lg shadow-amber-500/20 transition hover:bg-amber-300">
              View live portal
            </Link>
          </div>
        </div>

        <div className="rounded-[1.75rem] border border-slate-800 bg-slate-900/70 p-6 shadow-[0_24px_90px_rgba(2,6,23,0.45)]">
          <div className="space-y-4">
            {trustSignals.map(([title, body]) => (
              <article key={title} className="rounded-2xl border border-slate-800 bg-slate-950/65 p-5">
                <h2 className="font-space text-xl font-bold text-white">{title}</h2>
                <p className="mt-2 text-sm leading-7 text-slate-400">{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
