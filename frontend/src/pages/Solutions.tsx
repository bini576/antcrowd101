import { Link } from 'react-router-dom';

const useCases = ['AI Security, Safety & Trust', 'Application Security', 'Continuous Security Testing'];
const industries = ['Automotive & Transportation', 'Financial Services', 'Healthcare'];

const getSlug = (item: string) =>
  item.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

function SolutionCard({ item }: { item: string }) {
  return (
    <Link
      to={`/solutions/${getSlug(item)}`}
      className="rounded-[1.5rem] border border-slate-800 bg-slate-900/70 p-6 text-slate-200 shadow-[0_18px_60px_rgba(2,6,23,0.35)] transition hover:-translate-y-1 hover:border-amber-400/40 hover:text-amber-200"
    >
      <span className="font-space text-xl font-bold">{item}</span>
      <span className="mt-4 block text-sm leading-7 text-slate-400">Operational security programs tailored to this risk profile.</span>
    </Link>
  );
}

export default function Solutions() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <section className="mx-auto max-w-7xl px-6 py-20">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-amber-300">AntCrowd solutions</p>
        <h1 className="mt-4 max-w-3xl font-space text-4xl font-black tracking-tight text-white sm:text-6xl">
          Security workflows for teams that need proof, not theater.
        </h1>
        <p className="mt-6 max-w-2xl text-base leading-8 text-slate-400">
          Choose the operating model that matches your assets, regulatory pressure, and launch risk.
        </p>
      </section>

      <section className="border-y border-slate-800 bg-slate-900/35">
        <div className="mx-auto max-w-7xl px-6 py-16">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-red-300">Use cases</p>
          <h2 className="mt-3 font-space text-3xl font-black text-white">Browse by outcome</h2>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {useCases.map((item) => <SolutionCard item={item} key={item} />)}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-16">
        <div className="rounded-[1.75rem] border border-amber-400/20 bg-amber-400/10 p-8">
          <div className="flex flex-wrap items-center justify-between gap-5">
            <h2 className="font-space text-3xl font-black text-white">Launch a connected security program.</h2>
            <Link to="/request-demo" className="rounded-xl bg-amber-400 px-6 py-3 text-sm font-black text-slate-950 transition hover:bg-amber-300">
              Get started
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-20">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-red-300">Industries</p>
        <h2 className="mt-3 font-space text-3xl font-black text-white">Browse by environment</h2>
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {industries.map((item) => <SolutionCard item={item} key={item} />)}
        </div>
      </section>
    </main>
  );
}
