import { Link } from 'react-router-dom';

const facts = [
  ['Mission', 'Help organizations find, validate, and fix meaningful security risk through trusted human expertise.'],
  ['Community', 'Bring researchers, developers, compliance teams, and organizations into one connected workflow.'],
  ['Trust', 'Make security progress visible with clear evidence, approvals, metrics, and audit-ready records.']
];

export default function AboutUs() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="h-1 bg-gradient-to-r from-amber-500 via-red-500 to-sky-400" />
      <section className="mx-auto max-w-7xl px-6 py-20">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-amber-300">Company</p>
        <h1 className="mt-4 max-w-3xl font-space text-4xl font-black tracking-tight text-white sm:text-6xl">
          AntCrowd connects security work to measurable trust.
        </h1>
        <p className="mt-6 max-w-2xl text-base leading-8 text-slate-400">
          We are building a unified platform for crowdsourced security, pentesting, code review, training, trust center publishing, and GRC readiness.
        </p>
      </section>

      <section className="border-y border-slate-800 bg-slate-900/35">
        <div className="mx-auto grid max-w-7xl gap-5 px-6 py-16 md:grid-cols-3">
          {facts.map(([title, body]) => (
            <article key={title} className="rounded-[1.5rem] border border-slate-800 bg-slate-950/72 p-6 shadow-[0_18px_60px_rgba(2,6,23,0.35)]">
              <h2 className="font-space text-xl font-bold text-white">{title}</h2>
              <p className="mt-3 text-sm leading-7 text-slate-400">{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-16">
        <div className="rounded-[1.75rem] border border-amber-400/20 bg-amber-400/10 p-8">
          <h2 className="font-space text-3xl font-black text-white">Ready to talk?</h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-amber-50/80">
            Contact the AntCrowd team to prepare your workspace and launch the right service path.
          </p>
          <Link to="/company/contact" className="mt-6 inline-flex rounded-xl bg-amber-400 px-6 py-3 text-sm font-black text-slate-950 transition hover:bg-amber-300">
            Contact us
          </Link>
        </div>
      </section>
    </main>
  );
}
