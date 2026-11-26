import { useState, useEffect, type MouseEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { useWorkspaceOverview } from '../../hooks/useWorkspaceOverview';

/* ── Bootstrap API paths per service key ──────────────────────────── */
const BOOTSTRAP_PATHS: Record<string, string> = {
  'vdp':        '/api/vdp/auth/bootstrap',
  'pen':        '/api/pen/api/auth/bootstrap',
  'training':   '/api/training/auth/bootstrap',
  'bug-bounty': '/api/bug-bounty/api/auth/bootstrap',
  'ai-redteam': '/api/ai-redteam/api/auth/bootstrap',
  'challenge':  '/api/challenge/api/auth/bootstrap',
  'code':       '/api/code/api/auth/bootstrap',
  'trust':      '/api/security-trust/api/auth/bootstrap',
};

const SERVICE_CARDS = [
  {
    key: 'vdp',
    name: 'Vulnerability Disclosure Program',
    shortName: 'VDP',
    description: 'Manage your public disclosure program and triage incoming vulnerability reports.',
    icon: '🛡️',
    envKey: 'VITE_VDP_PORTAL_URL',
    fallback: '/workspace/vdp/org/org-admin',
    status: 'active' as const,
  },
  {
    key: 'bug-bounty',
    name: 'Bug Bounty',
    shortName: 'Bug Bounty',
    description: 'Run incentive-driven security testing programs with vetted researchers.',
    icon: '🐛',
    envKey: 'VITE_BUG_BOUNTY_PORTAL_URL',
    fallback: '/workspace/bug-bounty/',
    status: 'active' as const,
  },
  {
    key: 'pen',
    name: 'Penetration Testing',
    shortName: 'Penetration Testing',
    description: 'Launch structured pentesting engagements with internal and external testers.',
    icon: '🔓',
    envKey: 'VITE_PEN_PORTAL_URL',
    fallback: '/workspace/pen/org/',
    status: 'active' as const,
  },
  {
    key: 'ai-redteam',
    name: 'AI Red Team',
    shortName: 'AI Red Team',
    description: 'Adversarial testing for AI/ML models, prompt injection, and LLM security.',
    icon: '🤖',
    envKey: 'VITE_AI_REDTEAM_PORTAL_URL',
    fallback: '/workspace/ai-redteam/',
    status: 'active' as const,
  },
  {
    key: 'challenge',
    name: 'Challenge',
    shortName: 'Challenge',
    description: 'CTF-style security challenges for team skill assessment and training.',
    icon: '🏴',
    envKey: 'VITE_CHALLENGE_PORTAL_URL',
    fallback: '/workspace/challenge/',
    status: 'active' as const,
  },
  {
    key: 'training',
    name: 'Security Training',
    shortName: 'Security Training',
    description: 'Request tailored training sessions and track researcher certifications.',
    icon: '📚',
    envKey: 'VITE_TRAINING_PORTAL_URL',
    fallback: '/workspace/training/org/organization/training',
    status: 'active' as const,
  },
  {
    key: 'code',
    name: 'Code Security Review',
    shortName: 'Code Security Review',
    description: 'Submit source code review requests, track approval status, and receive security findings.',
    icon: '💻',
    envKey: 'VITE_CODE_WORKSPACE_URL',
    fallback: '/workspace/code/',
    status: 'active' as const,
  },
  {
    key: 'trust',
    name: 'Security Trust Center',
    shortName: 'Security Trust Center',
    description: 'Manage your organization trust center, compliance certifications, and security posture.',
    icon: '🛡️',
    envKey: 'VITE_TRUST_ORG_PORTAL_URL',
    fallback: '/workspace/trust-org/',
    status: 'active' as const,
  },
];

function getServiceUrl(envKey: string, fallback: string): string {
  const val = (import.meta.env[envKey] ?? '').toString().trim();
  return val || fallback;
}

const QUICK_STATS = [
  { label: 'Active Programs', value: '—', icon: '📊' },
  { label: 'Pending Reports', value: '—', icon: '📬' },
  { label: 'Researchers', value: '—', icon: '👥' },
  { label: 'Total Findings', value: '—', icon: '🔍' },
];

export default function OrganizationDashboard() {
  const { user, signOut } = useAuth();
  const { overview, loading } = useWorkspaceOverview(user);
  const [launching, setLaunching] = useState<string | null>(null);

  useEffect(() => {
    document.body.style.backgroundColor = '#020617';
    return () => {
      document.body.style.backgroundColor = '';
    };
  }, []);

  const orgName = user?.organization?.name || user?.firstName || 'Organization';
  const quickStats = [
    { ...QUICK_STATS[0], value: loading ? '...' : overview.signals[1]?.value ?? '0' },
    { ...QUICK_STATS[1], value: loading ? '...' : overview.summaryCards.find((card) => card.service === 'VDP Service')?.value ?? '0 reports' },
    { ...QUICK_STATS[2], value: loading ? '...' : overview.signals[0]?.value ?? '0 live' },
    { ...QUICK_STATS[3], value: loading ? '...' : overview.summaryCards.find((card) => card.service === 'Pen Service')?.value ?? '0 open programs' },
  ];

  async function openServiceWorkspace(event: MouseEvent<HTMLAnchorElement>, service: (typeof SERVICE_CARDS)[number]) {
    const bootstrapPath = BOOTSTRAP_PATHS[service.key];

    // If no bootstrap path is configured, allow normal navigation
    if (!bootstrapPath) return;

    event.preventDefault();

    // Prevent double-click launches
    if (launching === service.key) return;

    const targetUrl = getServiceUrl(service.envKey, service.fallback);

    setLaunching(service.key);

    try {
      const response = await fetch(bootstrapPath, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const payload: { access_token?: string; token?: string; detail?: string; error?: string; message?: string; user?: { email?: string; role?: string; organization_id?: string; org_id?: string } } = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.detail || payload.error || payload.message || `Unable to bootstrap ${service.shortName} session`);
      }

      // Build the final URL with the bootstrap token
      const url = new URL(targetUrl, window.location.origin);
      const token = payload.access_token || payload.token;
      if (token) url.searchParams.set('token', token);
      if (payload.user?.role) url.searchParams.set('role', payload.user.role);
      if (payload.user?.email || user?.email) url.searchParams.set('email', payload.user?.email || user?.email || '');
      const orgId = payload.user?.organization_id || payload.user?.org_id || user?.organization?.id;
      if (orgId) url.searchParams.set('organization_id', orgId);

      window.open(url.toString(), '_blank', 'noopener,noreferrer');
    } catch (error) {
      console.error(`[Workspace bootstrap] ${service.key}:`, error);
      window.alert(error instanceof Error ? error.message : `Unable to open ${service.shortName} workspace`);
    } finally {
      setLaunching(null);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-[Inter,-apple-system,sans-serif]">
      {/* ── Top strip ── */}
      <div className="h-1 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-400" />

      {/* ── Header ── */}
      <header className="border-b border-slate-800/70 bg-slate-950/60 backdrop-blur-md sticky top-0 z-30">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <Link to="/" className="font-space text-2xl font-black text-amber-400">AntCrowd</Link>
            <span className="h-4 w-px bg-slate-800" />
            <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Organization Console</span>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => void signOut()}
              className="rounded-xl border border-slate-700 bg-slate-900/70 px-4 py-2 text-sm font-bold text-slate-300 transition hover:border-amber-400/50 hover:text-amber-300"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-10 space-y-12">
        {/* ── Hero ──────────────────────────────────────────────── */}
        <section className="relative overflow-hidden rounded-[1.75rem] border border-slate-800 bg-slate-900/40 p-8 shadow-[0_24px_90px_rgba(2,6,23,0.45)]">
          <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-950 to-amber-950/20 opacity-50 pointer-events-none" />
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-400 pointer-events-none" />
          <div className="relative grid gap-8 lg:grid-cols-[1.2fr_0.8fr] items-center">
            <div className="space-y-4">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-amber-300">Organization Workspace</p>
              <h1 className="font-space text-4xl font-black text-white sm:text-5xl">Welcome, {orgName}</h1>
              <p className="text-sm leading-7 text-slate-400 max-w-xl">
                Your unified command center for vulnerability management, penetration testing,
                and security operations across the AntCrowd platform.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {quickStats.map((stat) => (
                <div key={stat.label} className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-950/60 p-4 transition-all duration-200 hover:border-amber-400/30">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-amber-500/10 text-xl">{stat.icon}</span>
                  <div>
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">{stat.label}</span>
                    <strong className="block mt-1 font-space text-base font-bold text-white">{stat.value}</strong>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Service Launcher Grid ─────────────────────────────── */}
        <section className="space-y-6">
          <div>
            <h2 className="font-space text-2xl font-black text-white">Service Workspaces</h2>
            <p className="mt-2 text-sm text-slate-400">
              Launch any service workspace directly. Each service runs its own admin portal with full triage, metrics, and configuration tools.
            </p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {SERVICE_CARDS.map((svc) => (
              <a
                key={svc.key}
                href={getServiceUrl(svc.envKey, svc.fallback)}
                onClick={(event) => void openServiceWorkspace(event, svc)}
                className="group relative flex flex-col justify-between rounded-[1.75rem] border border-slate-800 bg-slate-900/70 p-6 shadow-[0_18px_60px_rgba(2,6,23,0.35)] transition-all duration-300 hover:-translate-y-1 hover:border-amber-500/30 hover:bg-slate-900/90"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="grid h-12 w-12 place-items-center rounded-2xl bg-amber-500/10 border border-amber-500/20 text-2xl">{svc.icon}</span>
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${
                      svc.status === 'active' 
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}>
                      {svc.status === 'active' ? 'Active' : 'Coming Soon'}
                    </span>
                  </div>
                  <h3 className="font-space text-lg font-bold text-white group-hover:text-amber-400 transition">{svc.shortName}</h3>
                  <p className="mt-2 text-xs text-slate-400 leading-relaxed">{svc.description}</p>
                </div>
                <div className="mt-6 flex items-center gap-2 text-xs font-bold text-amber-500 group-hover:text-amber-400 transition-all duration-200">
                  <span>Go to workspace</span>
                  <svg className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </div>
              </a>
            ))}
          </div>
        </section>

        {/* ── Recent Activity ────────────────────────────────────── */}
        <section className="space-y-6">
          <h2 className="font-space text-2xl font-black text-white">Recent Activity</h2>
          <div className="space-y-3">
            <div className="flex items-start gap-4 rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
              <span className="mt-1.5 h-2 w-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
              <div className="flex-1">
                <strong className="block text-sm font-bold text-white">Workspace ready</strong>
                <p className="mt-1 text-xs text-slate-400 leading-relaxed">Your organization workspace is active. Launch any service above to begin.</p>
              </div>
              <span className="text-[10px] font-bold text-slate-600">Just now</span>
            </div>
            <div className="flex items-start gap-4 rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
              <span className="mt-1.5 h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
              <div className="flex-1">
                <strong className="block text-sm font-bold text-white">Platform connected</strong>
                <p className="mt-1 text-xs text-slate-400 leading-relaxed">Session synchronized with AntCrowd authentication service.</p>
              </div>
              <span className="text-[10px] font-bold text-slate-600">Session start</span>
            </div>
          </div>
        </section>

        {/* ── Quick Links Footer ─────────────────────────────────── */}
        <footer className="flex justify-center gap-6 border-t border-slate-800/60 pt-8 text-xs font-semibold text-slate-500">
          <span>&copy; 2026 AntCrowd</span>
        </footer>
      </main>
    </div>
  );
}
