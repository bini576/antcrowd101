import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

const TRUST_API = (import.meta as any).env?.VITE_TRUST_API_URL || '/api/security-trust';

interface Overview {
  summary: string;
  security_commitment: string;
  contact_email: string;
}
interface Compliance {
  id: string;
  framework: string;
  status: string;
  evidence_url?: string;
}
interface Subprocessor {
  id: string;
  name: string;
  purpose: string;
  location: string;
}
interface FAQ {
  id: string;
  question: string;
  answer: string;
}
interface Update {
  id: string;
  title: string;
  content: string;
  published_at: string;
}
interface TrustData {
  organization: { id: string; name: string; slug: string };
  overview: Overview | null;
  compliance: Compliance[];
  subprocessors: Subprocessor[];
  faq: FAQ[];
  updates: Update[];
  badge: { id: string; level: string } | null;
}

function BadgePill({ level }: { level: string }) {
  const colors: Record<string, string> = {
    gold: 'bg-yellow-400/20 text-yellow-300 border-yellow-400/40',
    silver: 'bg-slate-400/20 text-slate-300 border-slate-400/40',
    bronze: 'bg-amber-700/20 text-amber-400 border-amber-700/40',
  };
  const cl = colors[level.toLowerCase()] ?? 'bg-sky-400/20 text-sky-300 border-sky-400/40';
  return (
    <span className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wider ${cl}`}>
      {level} Trust
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'compliant' || status === 'certified')
    return <span className="rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2.5 py-0.5 text-xs font-semibold">Certified</span>;
  if (status === 'in-progress' || status === 'in_progress')
    return <span className="rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2.5 py-0.5 text-xs font-semibold">In Progress</span>;
  return <span className="rounded-full bg-slate-700/60 text-slate-400 border border-slate-600/40 px-2.5 py-0.5 text-xs font-semibold">Planned</span>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="font-space text-xl font-black text-white mb-5 pb-3 border-b border-slate-800">{title}</h2>
      {children}
    </section>
  );
}

function AccordionItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden mb-3">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 text-left text-sm font-semibold text-slate-200 hover:text-white transition-colors"
      >
        <span>{question}</span>
        <span className={`ml-4 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}>
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </span>
      </button>
      {open && (
        <div className="px-5 pb-5 text-sm text-slate-400 leading-relaxed border-t border-slate-800 pt-4">
          {answer}
        </div>
      )}
    </div>
  );
}

function SubscribeButton({ orgId }: { orgId: string }) {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);

  const submit = async () => {
    if (!email) return;
    setBusy(true);
    try {
      await fetch(`${TRUST_API}/api/v1/subscriptions/organizations/${orgId}/subscriptions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      setSent(true);
    } catch {
      /* ignore */
    } finally {
      setBusy(false);
    }
  };

  if (sent) return <span className="text-xs text-emerald-400 font-semibold">✓ Subscribed!</span>;

  return show ? (
    <div className="flex gap-2 mt-2">
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="your@email.com"
        className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-400/60 w-52"
      />
      <button
        onClick={submit}
        disabled={busy}
        className="rounded-lg bg-amber-400 px-4 py-2 text-xs font-black text-slate-950 hover:bg-amber-300 disabled:opacity-60 transition"
      >
        {busy ? '…' : 'Subscribe'}
      </button>
    </div>
  ) : (
    <button
      onClick={() => setShow(true)}
      className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300 hover:border-amber-400/50 hover:text-amber-300 transition"
    >
      Subscribe to Updates
    </button>
  );
}

export default function PublicTrustPage() {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const [data, setData] = useState<TrustData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!orgSlug) return;
    fetch(`${TRUST_API}/api/v1/trust-center/${orgSlug}`)
      .then((r) => {
        if (r.status === 404) { setNotFound(true); setLoading(false); return null; }
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((d) => { if (d) { setData(d); setLoading(false); } })
      .catch(() => { setNotFound(true); setLoading(false); });
  }, [orgSlug]);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="h-1 bg-gradient-to-r from-amber-500 via-red-500 to-sky-400" />

      {/* Navbar */}
      <header className="sticky top-0 z-40 border-b border-slate-800/70 backdrop-blur-md bg-slate-950/80">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <Link to="/" className="font-space text-2xl font-black text-amber-400">AntCrowd</Link>
          <Link to="/trust" className="text-sm font-semibold text-slate-400 hover:text-amber-300 transition-colors">
            ← Trust Directory
          </Link>
        </div>
      </header>

      {loading && (
        <div className="flex justify-center py-32">
          <div className="h-12 w-12 rounded-full border-4 border-slate-700 border-t-amber-400 animate-spin" />
        </div>
      )}

      {!loading && notFound && (
        <div className="mx-auto max-w-lg px-6 py-32 text-center">
          <div className="text-6xl mb-6">🔒</div>
          <h1 className="font-space text-3xl font-black text-white mb-3">Trust Center Not Found</h1>
          <p className="text-slate-400 mb-8">The organization you're looking for hasn't published a trust center, or the URL is incorrect.</p>
          <Link to="/trust" className="rounded-xl bg-amber-400 px-6 py-3 text-sm font-black text-slate-950 hover:bg-amber-300 transition">
            Back to Directory
          </Link>
        </div>
      )}

      {!loading && data && (
        <div className="mx-auto max-w-4xl px-6 py-14">
          {/* Header */}
          <div className="rounded-[1.75rem] border border-slate-800 bg-slate-900/70 p-8 shadow-[0_24px_90px_rgba(2,6,23,0.45)] mb-10">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-3 mb-2">
                  <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center font-black text-slate-950 text-2xl shadow-lg shadow-amber-500/20">
                    {data.organization.name.charAt(0)}
                  </div>
                  <h1 className="font-space text-3xl font-black text-white">{data.organization.name}</h1>
                  {data.badge && <BadgePill level={data.badge.level} />}
                </div>
                {data.overview?.contact_email && (
                  <a href={`mailto:${data.overview.contact_email}`} className="text-sm text-slate-400 hover:text-amber-300 transition-colors">
                    {data.overview.contact_email}
                  </a>
                )}
              </div>
              <SubscribeButton orgId={data.organization.id} />
            </div>
          </div>

          {/* Security Overview */}
          {data.overview && (
            <Section title="Security Overview">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
                <p className="text-slate-300 leading-relaxed mb-4">{data.overview.summary}</p>
                {data.overview.security_commitment && (
                  <p className="text-sm text-slate-400 leading-relaxed border-t border-slate-800 pt-4 mt-4">
                    {data.overview.security_commitment}
                  </p>
                )}
              </div>
            </Section>
          )}

          {/* Compliance */}
          {data.compliance.length > 0 && (
            <Section title="Compliance">
              <div className="grid gap-3 sm:grid-cols-2">
                {data.compliance.map((c) => (
                  <div key={c.id} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 flex items-center justify-between gap-4">
                    <div>
                      <div className="font-semibold text-slate-200 text-sm">{c.framework}</div>
                      {c.evidence_url && (
                        <a href={c.evidence_url} target="_blank" rel="noreferrer" className="text-xs text-amber-400 hover:underline mt-0.5 block">
                          View evidence
                        </a>
                      )}
                    </div>
                    <StatusBadge status={c.status ?? ''} />
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Subprocessors */}
          {data.subprocessors.length > 0 && (
            <Section title="Subprocessors">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-800">
                      <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Provider</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Service</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Data Location</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.subprocessors.map((s, i) => (
                      <tr key={s.id} className={i < data.subprocessors.length - 1 ? 'border-b border-slate-800/60' : ''}>
                        <td className="px-5 py-4 font-semibold text-slate-200">{s.name}</td>
                        <td className="px-5 py-4 text-slate-400">{s.purpose}</td>
                        <td className="px-5 py-4 text-slate-400">{s.location}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          )}

          {/* FAQ */}
          {data.faq.length > 0 && (
            <Section title="Security FAQ">
              {data.faq.map((f) => (
                <AccordionItem key={f.id} question={f.question} answer={f.answer} />
              ))}
            </Section>
          )}

          {/* Security Updates */}
          {data.updates.length > 0 && (
            <Section title="Security Updates">
              <ol className="relative border-l border-slate-800 ml-3 space-y-6">
                {data.updates.slice(0, 5).map((u) => (
                  <li key={u.id} className="ml-6">
                    <span className="absolute -left-2 flex h-4 w-4 items-center justify-center rounded-full bg-amber-400 shadow shadow-amber-500/40" />
                    <time className="text-xs text-slate-500 font-medium">
                      {u.published_at ? new Date(u.published_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Recent'}
                    </time>
                    <h3 className="text-sm font-semibold text-slate-200 mt-0.5">{u.title}</h3>
                    <p className="text-sm text-slate-400 mt-1 leading-relaxed">{u.content}</p>
                  </li>
                ))}
              </ol>
            </Section>
          )}
        </div>
      )}

      <footer className="border-t border-slate-800/70 mt-8 py-10 text-center text-xs text-slate-600">
        © {new Date().getFullYear()} AntCrowd. All rights reserved.
      </footer>
    </main>
  );
}
