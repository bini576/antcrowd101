import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

interface OrgEntry {
  name: string;
  slug: string;
  summary: string;
  contact_email: string;
}

const TRUST_API = (import.meta as any).env?.VITE_TRUST_API_URL || '/api/security-trust';

export default function TrustDirectory() {
  const [orgs, setOrgs] = useState<OrgEntry[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch(`${TRUST_API}/api/v1/organizations/public`)
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((data: OrgEntry[]) => { setOrgs(data); setLoading(false); })
      .catch(() => { setError(true); setLoading(false); });
  }, []);

  const filtered = orgs.filter((o) =>
    o.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="h-1 bg-gradient-to-r from-amber-500 via-red-500 to-sky-400" />

      <header className="sticky top-0 z-40 border-b border-slate-800/70 backdrop-blur-md bg-slate-950/80">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <Link to="/" className="font-space text-2xl font-black text-amber-400">AntCrowd</Link>
          <nav className="flex items-center gap-4 text-sm font-semibold text-slate-300">
            <Link to="/solutions" className="hover:text-amber-300 transition-colors">Solutions</Link>
            <Link to="/trust" className="rounded-xl border border-amber-400/50 px-4 py-2 text-amber-300 hover:bg-amber-400/10 transition-colors">
              Trust Directory
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero – merged from old TrustCenter */}
      <section className="mx-auto grid max-w-7xl gap-10 px-6 pt-20 pb-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-amber-300">Trust Center Directory</p>
          <h1 className="mt-4 font-space text-4xl font-black tracking-tight text-white sm:text-6xl">
            Share security proof without slowing down sales.
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-8 text-slate-400">
            AntCrowd Trust Center gives organizations a dark, branded, self-service surface for security posture, compliance artifacts, subprocessors, FAQs, and updates. Browse verified trust centers below.
          </p>
        </div>
        <div className="rounded-[1.75rem] border border-slate-800 bg-slate-900/70 p-6 shadow-[0_24px_90px_rgba(2,6,23,0.45)]">
          <div className="space-y-4">
            {[
              ['Security overview', 'Publish posture, ownership, and operating principles for customer review.'],
              ['Compliance evidence', 'Present frameworks, controls, resources, and security updates in one place.'],
              ['Access workflow', 'Collect customer access requests and route them to the right internal team.'],
            ].map(([title, body]) => (
              <article key={title} className="rounded-2xl border border-slate-800 bg-slate-950/65 p-5">
                <h2 className="font-space text-xl font-bold text-white">{title}</h2>
                <p className="mt-2 text-sm leading-7 text-slate-400">{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-6"><div className="border-t border-slate-800/70" /></div>

      {/* Directory */}
      <section className="mx-auto max-w-7xl px-6 py-14">
        <div className="mb-8">
          <h2 className="font-space text-2xl font-black text-white mb-2">Published Trust Centers</h2>
          <p className="text-slate-400 text-sm">Search organizations that have made their security posture publicly available.</p>
        </div>

        <div className="relative mb-8">
          <span className="absolute inset-y-0 left-4 flex items-center text-slate-500 pointer-events-none">
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
          </span>
          <input
            id="trust-directory-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by organization name…"
            className="w-full rounded-xl border border-slate-700 bg-slate-900 py-3 pl-12 pr-4 text-sm text-slate-100 placeholder:text-slate-500 focus:border-amber-400/60 focus:outline-none focus:ring-2 focus:ring-amber-400/20 transition"
          />
        </div>

        {loading && (
          <div className="flex justify-center py-24">
            <div className="h-10 w-10 rounded-full border-4 border-slate-700 border-t-amber-400 animate-spin" />
          </div>
        )}

        {!loading && error && (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-8 text-center">
            <p className="text-lg font-semibold text-red-400 mb-1">Failed to load directory</p>
            <p className="text-sm text-slate-500">Please try again later.</p>
          </div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-16 text-center">
            <div className="text-5xl mb-4">🔍</div>
            <p className="text-lg font-semibold text-slate-300 mb-2">
              {orgs.length === 0 ? 'No organizations have published their trust center yet.' : 'No results match your search.'}
            </p>
            <p className="text-sm text-slate-500">
              {orgs.length === 0 ? 'Check back soon — organizations are onboarding now.' : 'Try a different keyword.'}
            </p>
          </div>
        )}

        {!loading && !error && filtered.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((org) => (
              <article
                key={org.slug}
                className="group rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-lg transition hover:border-amber-400/40 hover:bg-slate-900"
              >
                <div className="mb-3 flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center font-black text-slate-950 text-lg shadow-lg shadow-amber-500/20">
                    {org.name.charAt(0).toUpperCase()}
                  </div>
                  <h3 className="font-space text-lg font-bold text-white truncate">{org.name}</h3>
                </div>
                <p className="text-sm text-slate-400 leading-relaxed mb-5 line-clamp-2">
                  {org.summary.length > 120 ? org.summary.slice(0, 120) + '…' : org.summary}
                </p>
                <Link
                  to={`/trust/${org.slug}`}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-amber-400 hover:text-amber-300 transition-colors"
                >
                  View Trust Center →
                </Link>
              </article>
            ))}
          </div>
        )}
      </section>

      <footer className="border-t border-slate-800/70 mt-8 py-10 text-center text-xs text-slate-600">
        © {new Date().getFullYear()} AntCrowd. All rights reserved.
      </footer>
    </main>
  );
}
