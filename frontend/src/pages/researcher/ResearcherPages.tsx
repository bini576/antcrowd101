import { type ChangeEvent, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { useWorkspaceOverview } from '../../hooks/useWorkspaceOverview';
import WorkspaceLaunchLink from '../../components/WorkspaceLaunchLink';
import RankIndicator from '../../components/RankIndicator';
import {
  fetchResearcherProfile,
  fetchTrainingProgress,
  type ResearcherProfileUpdatePayload,
  type ServiceResearcherProfile,
  type TrainingProgressSummary,
  updateResearcherProfile,
  uploadResearcherProfilePhoto
} from '../../services/researcherProfileApi';
import {
  fetchResearcherEarnings,
  type EarningsSummary,
  type ResearcherEarning
} from '../../services/paymentsApi';
import {
  Avatar,
  Badge,
  Card,
  EmptyState as UiEmptyState,
  StatWidget
} from '@ant-ui';
import {
  getLiveWorkspacesForUser,
  getRoadmapWorkspacesForUser,
  type WorkspaceDefinition
} from '../../services/workspaceAccess';
import './ResearcherDashboard.css';

function badgeText(status: string) {
  if (status === 'approved') return 'Approved';
  if (status === 'submitted') return 'Under review';
  if (status === 'rejected') return 'Resubmission required';
  return 'Verification required';
}



function DashboardIcon({
  name,
  className = 'h-5 w-5'
}: {
  name:
    | 'activity'
    | 'mail'
    | 'wallet'
    | 'launch'
    | 'shield'
    | 'spark'
    | 'alert'
    | 'timeline'
    | 'roadmap'
    | 'ops';
  className?: string;
}) {
  if (name === 'mail') {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M4 6.75h16v10.5H4z" />
        <path d="m5 8 7 5 7-5" />
      </svg>
    );
  }
  if (name === 'wallet') {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M4 7.75A1.75 1.75 0 0 1 5.75 6h9.5A1.75 1.75 0 0 1 17 7.75V9h1.25A1.75 1.75 0 0 1 20 10.75v5.5A1.75 1.75 0 0 1 18.25 18H5.75A1.75 1.75 0 0 1 4 16.25v-8.5Z" />
        <path d="M16.5 13.5h3.25" />
      </svg>
    );
  }
  if (name === 'launch') {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M14 5h5v5" />
        <path d="M10 14 19 5" />
        <path d="M19 13v4.25A1.75 1.75 0 0 1 17.25 19H6.75A1.75 1.75 0 0 1 5 17.25V6.75A1.75 1.75 0 0 1 6.75 5H11" />
      </svg>
    );
  }
  if (name === 'shield') {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M12 3.75 5.75 6.2v5c0 4.1 2.55 7.82 6.25 9.2 3.7-1.38 6.25-5.1 6.25-9.2v-5L12 3.75Z" />
        <path d="m9.5 12.25 1.7 1.7 3.3-3.45" />
      </svg>
    );
  }
  if (name === 'alert') {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M12 4.5 20 18.5H4L12 4.5Z" />
        <path d="M12 9v4.5" />
        <circle cx="12" cy="16.25" r="0.8" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  if (name === 'timeline') {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M6 6.75h12" />
        <path d="M6 12h8" />
        <path d="M6 17.25h10" />
        <circle cx="18" cy="12" r="2.25" />
      </svg>
    );
  }
  if (name === 'roadmap') {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M5 18.5V5.5" />
        <path d="M5 6h8l-1.4 3L13 12H5" />
        <path d="M12 14h7l-1.2 2.5L19 19h-7" />
      </svg>
    );
  }
  if (name === 'ops') {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M4.75 6.75h14.5v10.5H4.75z" />
        <path d="M8 10.25h3.5" />
        <path d="M8 13.75h8" />
        <path d="M14.75 10.25h1.25" />
      </svg>
    );
  }
  if (name === 'spark') {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="m12 3 1.7 4.3L18 9l-4.3 1.7L12 15l-1.7-4.3L6 9l4.3-1.7L12 3Z" />
        <path d="m18.25 14 .7 1.75 1.75.7-1.75.7-.7 1.75-.7-1.75-1.75-.7 1.75-.7.7-1.75Z" />
        <path d="m5.75 15.25 .7 1.75 1.75.7-1.75.7-.7 1.75-.7-1.75-1.75-.7 1.75-.7.7-1.75Z" />
      </svg>
    );
  }

  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 12h4l2-5 4 10 2-5h4" />
    </svg>
  );
}


function formatExperienceLevel(value?: string | null) {
  if (!value) return 'Not set';
  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function buildProfileForm(profile?: ServiceResearcherProfile | null): ResearcherProfileUpdatePayload {
  return {
    phone: profile?.phone ?? '',
    bio: profile?.bio ?? '',
    skills: profile?.skills ?? '',
    specialization: profile?.specialization ?? '',
    experienceLevel: profile?.experienceLevel ?? '',
    socialLinks: {
      github: profile?.socialLinks?.github ?? '',
      linkedin: profile?.socialLinks?.linkedin ?? '',
      x: profile?.socialLinks?.x ?? '',
      website: profile?.socialLinks?.website ?? profile?.socialLinks?.portfolio ?? ''
    }
  };
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(new Error('Unable to read the selected image.'));
    reader.readAsDataURL(file);
  });
}

function ResearcherLayout({
  title,
  subtitle,
  children
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  const { user, signOut } = useAuth();

  useEffect(() => {
    document.body.style.backgroundColor = '#020617';
    return () => {
      document.body.style.backgroundColor = '';
    };
  }, []);

  const isInternal = user?.researcherType === 'internal';
  const homePath = isInternal ? '/dashboard/internal' : '/dashboard/external';

  const navLinks = [
    { to: homePath, label: 'Dashboard' },
    { to: '/programs', label: 'Programs' },
    { to: '/reports', label: 'Reports' },
    { to: '/inbox', label: 'Inbox' },
    { to: '/payments', label: 'Payments' },
    { to: '/settings', label: 'Settings' }
  ];

  const rawName = user?.displayName || `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim() || user?.email || 'R';
  const initials = rawName.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();

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
            <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
              {isInternal ? 'Internal Researcher' : 'External Researcher'}
            </span>
          </div>
          <nav className="flex items-center gap-1">
            {navLinks.map((link) => {
              const isActive = window.location.pathname === link.to || (link.to !== homePath && window.location.pathname.startsWith(link.to));
              return (
                <Link
                  key={link.to}
                  className={`rounded-xl border px-3 py-1.5 text-xs font-bold transition ${
                    isActive
                      ? 'border-amber-400 bg-amber-400 text-slate-950'
                      : 'border-slate-700 bg-slate-900/70 text-slate-300 hover:border-amber-400/50 hover:text-amber-200'
                  }`}
                  to={link.to}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-xs font-black text-slate-950 shadow-md">
                {initials}
              </span>
              <Link
                className="rounded-xl border border-slate-700 bg-slate-900/70 px-3 py-1.5 text-xs font-bold text-slate-300 transition hover:border-amber-400/50 hover:text-amber-300"
                to="/security/2fa"
              >
                Security
              </Link>
            </div>
            <button
              onClick={() => void signOut()}
              className="rounded-xl border border-slate-700 bg-slate-900/70 px-3 py-1.5 text-xs font-bold text-slate-300 transition hover:border-amber-400/50 hover:text-amber-300"
              type="button"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-10 space-y-8">
        {/* ── Hero ────────────────────────────────── */}
        <section className="relative overflow-hidden rounded-[1.75rem] border border-slate-800 bg-slate-900/40 p-8 shadow-[0_24px_90px_rgba(2,6,23,0.45)]">
          <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-950 to-amber-950/20 opacity-50 pointer-events-none" />
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-400 pointer-events-none" />
          <div className="relative space-y-3">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-amber-300">
              {isInternal ? 'Internal Researcher Command' : 'External Researcher Command'}
            </p>
            <h1 className="font-space text-4xl font-black text-white sm:text-5xl">{title}</h1>
            <p className="text-sm leading-7 text-slate-400 max-w-2xl">{subtitle}</p>
          </div>
        </section>

        {/* ── Approval warning ───────────────────── */}
        {user?.approvalStatus !== 'approved' && (
          <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 px-5 py-4 text-sm text-amber-300/95">
            Service access is gated until verification is approved. Continue in{' '}
            <Link className="font-bold underline text-amber-400 hover:text-amber-300" to="/researcher/verification">
              researcher verification
            </Link>.
          </div>
        )}

        <div>{children}</div>
      </main>
    </div>
  );
}


function LaunchGrid({
  items,
  emphasizePrimary = false
}: {
  items: WorkspaceDefinition[];
  emphasizePrimary?: boolean;
}) {
  if (items.length === 0) {
    return null;
  }

  const [primary, ...secondary] = items;

  if (emphasizePrimary) {
    return (
      <div className="space-y-5">
        <article className="overflow-hidden rounded-[2rem] border border-amber-500/20 bg-[radial-gradient(circle_at_90%_0%,rgba(245,158,11,0.12),transparent_24%),linear-gradient(135deg,rgba(15,23,42,0.96),rgba(17,24,39,0.9))] p-7 shadow-[0_34px_110px_rgba(2,6,23,0.55)]">
          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
            <div>
              <span className="inline-flex rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-400">
                {primary.badge}
              </span>
              <div className="mt-5 flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-400">{primary.service}</p>
                  <h3 className="mt-3 font-space text-3xl font-bold text-white sm:text-4xl">{primary.title}</h3>
                </div>
                <div className="inline-flex h-14 w-14 items-center justify-center rounded-[1.2rem] border border-amber-500/20 bg-amber-500/10 text-amber-350">
                  <DashboardIcon name="launch" className="h-6 w-6" />
                </div>
              </div>
              <p className="mt-4 max-w-2xl text-sm leading-8 text-slate-300">{primary.description}</p>
            </div>
            <div className="space-y-4 rounded-[1.65rem] border border-slate-800 bg-slate-950/60 p-5">
              <div className="rounded-[1.35rem] border border-slate-800 bg-slate-900/70 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Session handoff</p>
                <p className="mt-2 text-sm text-slate-200">Open the live workspace in a new tab while keeping this command view pinned for context.</p>
              </div>
              <div className="rounded-[1.35rem] border border-slate-800 bg-slate-900/70 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Access boundary</p>
                <p className="mt-2 text-sm text-slate-200">Only the services assigned to your approved role are available here.</p>
              </div>
              {primary.href ? (
                <WorkspaceLaunchLink
                  className="inline-flex w-full items-center justify-center rounded-full bg-amber-400 px-5 py-3.5 text-sm font-bold text-slate-950 shadow-[0_20px_45px_rgba(245,158,11,0.2)] transition hover:-translate-y-0.5 hover:bg-amber-350"
                  href={primary.href}
                >
                  Open in new tab
                </WorkspaceLaunchLink>
              ) : null}
            </div>
          </div>
        </article>

        {secondary.length > 0 ? (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {secondary.map((item) =>
              item.href ? (
                <WorkspaceLaunchLink
                  className="rounded-[1.75rem] border border-slate-800 bg-slate-950/72 p-6 shadow-[0_24px_70px_rgba(2,6,23,0.42)] backdrop-blur transition hover:-translate-y-1 hover:border-amber-400/35 hover:shadow-[0_30px_90px_rgba(2,6,23,0.52)]"
                  href={item.href}
                  key={item.key}
                >
                  <span className="inline-flex rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-400">
                    {item.badge}
                  </span>
                  <div className="mt-4 flex items-start justify-between gap-4">
                    <div>
                      <h3 className="font-space text-2xl font-bold text-white">{item.title}</h3>
                      <p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{item.service}</p>
                    </div>
                    <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-amber-500/20 bg-amber-500/10 text-amber-350">
                      <DashboardIcon name="launch" className="h-5 w-5" />
                    </div>
                  </div>
                  <p className="mt-4 text-sm leading-7 text-slate-300">{item.description}</p>
                  <span className="mt-6 inline-flex text-sm font-semibold text-amber-400 hover:text-amber-350 transition">Open in new tab</span>
                </WorkspaceLaunchLink>
              ) : (
                <article className="rounded-[1.75rem] border border-dashed border-slate-700 bg-slate-950/58 p-6 shadow-[0_20px_60px_rgba(2,6,23,0.35)]" key={item.key}>
                  <span className="inline-flex rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                    {item.badge}
                  </span>
                  <div className="mt-4 flex items-start justify-between gap-4">
                    <div>
                      <h3 className="font-space text-2xl font-bold text-white">{item.title}</h3>
                      <p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{item.service}</p>
                    </div>
                    <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-700 bg-slate-900/70 text-slate-455">
                      <DashboardIcon name="roadmap" className="h-5 w-5" />
                    </div>
                  </div>
                  <p className="mt-4 text-sm leading-7 text-slate-300">{item.description}</p>
                  <span className="mt-6 inline-flex text-sm font-semibold text-slate-500">Prepared next</span>
                </article>
              )
            )}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      {items.map((item) =>
        item.href ? (
          <WorkspaceLaunchLink
            className="rounded-[1.75rem] border border-slate-800 bg-slate-950/72 p-6 shadow-[0_24px_70px_rgba(2,6,23,0.42)] backdrop-blur transition hover:-translate-y-1 hover:border-amber-400/35 hover:shadow-[0_30px_90px_rgba(2,6,23,0.52)]"
            href={item.href}
            key={item.key}
          >
            <span className="inline-flex rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-400">
              {item.badge}
            </span>
            <div className="mt-4 flex items-start justify-between gap-4">
              <div>
                <h3 className="font-space text-2xl font-bold text-white">{item.title}</h3>
                <p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{item.service}</p>
              </div>
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-amber-500/20 bg-amber-500/10 text-amber-350">
                <DashboardIcon name="launch" className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-4 text-sm leading-7 text-slate-300">{item.description}</p>
            <span className="mt-6 inline-flex text-sm font-semibold text-amber-400 hover:text-amber-350 transition">Open in new tab</span>
          </WorkspaceLaunchLink>
        ) : (
          <article
            className="rounded-[1.75rem] border border-dashed border-slate-700 bg-slate-950/58 p-6 shadow-[0_20px_60px_rgba(2,6,23,0.35)]"
            key={item.key}
          >
            <span className="inline-flex rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
              {item.badge}
            </span>
            <div className="mt-4 flex items-start justify-between gap-4">
              <div>
                <h3 className="font-space text-2xl font-bold text-white">{item.title}</h3>
                <p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{item.service}</p>
              </div>
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-700 bg-slate-900/70 text-slate-455">
                <DashboardIcon name="roadmap" className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-4 text-sm leading-7 text-slate-300">{item.description}</p>
            <span className="mt-6 inline-flex text-sm font-semibold text-slate-500">Prepared next</span>
          </article>
        )
      )}
    </div>
  );
}

export function ResearcherDashboard() {
  const { user, signOut } = useAuth();
  const { overview, loading, error } = useWorkspaceOverview(user);
  const liveWorkspaces = getLiveWorkspacesForUser(user);
  const roadmapWorkspaces = getRoadmapWorkspacesForUser(user);
  const isInternal = user?.researcherType === 'internal';
  const homePath = isInternal ? '/dashboard/internal' : '/dashboard/external';

  const navLinks = [
    { to: homePath, label: 'Dashboard' },
    { to: '/programs', label: 'Programs' },
    { to: '/reports', label: 'Reports' },
    { to: '/inbox', label: 'Inbox' },
    { to: '/payments', label: 'Payments' },
    { to: '/settings', label: 'Settings' }
  ];

  const displayName = user?.displayName || `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim() || user?.email || 'Researcher';
  const initials = displayName.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
  const approvalStatus = user?.approvalStatus ?? 'pending_submission';

  useEffect(() => {
    document.body.style.backgroundColor = '#020617';
    return () => {
      document.body.style.backgroundColor = '';
    };
  }, []);

  const stats = [
    { label: 'Researcher', value: displayName, colorClass: 'text-white' },
    { label: 'Access tier', value: isInternal ? 'Pen + Training' : 'External Pen + Code', colorClass: 'text-white' },
    { label: 'Live workspaces', value: String(liveWorkspaces.length), colorClass: 'text-emerald-450' },
    {
      label: 'Approval',
      value: badgeText(approvalStatus),
      colorClass: approvalStatus === 'approved' ? 'text-emerald-450' : approvalStatus === 'submitted' ? 'text-sky-450' : 'text-amber-455'
    }
  ];

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
            <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
              {isInternal ? 'Internal Researcher' : 'External Researcher'}
            </span>
          </div>
          <nav className="flex items-center gap-1">
            {navLinks.map((link) => {
              const isActive = link.to === homePath;
              return (
                <Link
                  key={link.to}
                  className={`rounded-xl border px-3 py-1.5 text-xs font-bold transition ${
                    isActive
                      ? 'border-amber-400 bg-amber-400 text-slate-950'
                      : 'border-slate-700 bg-slate-900/70 text-slate-300 hover:border-amber-400/50 hover:text-amber-200'
                  }`}
                  to={link.to}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-xs font-black text-slate-950 shadow-md">
                {initials}
              </span>
              <Link
                className="rounded-xl border border-slate-700 bg-slate-900/70 px-3 py-1.5 text-xs font-bold text-slate-300 transition hover:border-amber-400/50 hover:text-amber-300"
                to="/security/2fa"
              >
                Security
              </Link>
            </div>
            <button
              onClick={() => void signOut()}
              className="rounded-xl border border-slate-700 bg-slate-900/70 px-3 py-1.5 text-xs font-bold text-slate-300 transition hover:border-amber-400/50 hover:text-amber-300"
              type="button"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-10 space-y-10">
        {/* ── Hero ────────────────────────────────── */}
        <section className="relative overflow-hidden rounded-[1.75rem] border border-slate-800 bg-slate-900/40 p-8 shadow-[0_24px_90px_rgba(2,6,23,0.45)]">
          <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-950 to-amber-950/20 opacity-50 pointer-events-none" />
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-400 pointer-events-none" />
          <div className="relative space-y-3">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-amber-300">
              {isInternal ? 'Internal Researcher Command' : 'External Researcher Command'}
            </p>
            <h1 className="font-space text-4xl font-black text-white sm:text-5xl">{isInternal ? 'Internal Researcher Dashboard' : 'External Researcher Dashboard'}</h1>
            <p className="text-sm leading-7 text-slate-400 max-w-3xl">
              {isInternal
                ? 'Coordinate staff-facing validation and training delivery. Both connected service workspaces are available from this trusted launch surface.'
                : 'Focus on invited pentest work, report quality, and payout progress within your assigned access model.'}
            </p>
          </div>
        </section>

        {/* ── Approval warning ───────────────────── */}
        {approvalStatus !== 'approved' && (
          <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 px-5 py-4 text-sm text-amber-300/95">
            Service access is gated until verification is approved. Continue in{' '}
            <Link className="font-bold underline text-amber-400 hover:text-amber-300" to="/researcher/verification">researcher verification</Link>.
          </div>
        )}

        {/* ── Stats ───────────────────────────────── */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">{stat.label}</span>
              <span className={`block font-space text-lg font-bold ${stat.colorClass} truncate`}>{stat.value}</span>
            </div>
          ))}
        </div>

        <div className="mb-7">
          <RankIndicator user={user} />
        </div>

        {/* ── Live workspaces ─────────────────────── */}
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="font-space text-2xl font-black text-white">Workspaces</h2>
            <Link className="text-sm font-semibold text-amber-400 hover:text-amber-300 transition" to="/programs">Full programs view &rarr;</Link>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {liveWorkspaces.map((ws) =>
              ws.href ? (
                <WorkspaceLaunchLink
                  key={ws.key}
                  href={ws.href}
                  className="group relative flex flex-col justify-between rounded-[1.75rem] border border-slate-800 bg-slate-900/70 p-6 shadow-[0_18px_60px_rgba(2,6,23,0.35)] transition-all duration-300 hover:-translate-y-1 hover:border-amber-500/30 hover:bg-slate-900/90"
                >
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{ws.service}</span>
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                        {ws.badge}
                      </span>
                    </div>
                    <h3 className="font-space text-lg font-bold text-white group-hover:text-amber-400 transition">{ws.title}</h3>
                    <p className="mt-2 text-xs text-slate-400 leading-relaxed">{ws.description}</p>
                  </div>
                  <div className="mt-6 flex items-center gap-2 text-xs font-bold text-amber-500 group-hover:text-amber-400 transition-all duration-200">
                    <span>Open workspace</span>
                    <svg className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                  </div>
                </WorkspaceLaunchLink>
              ) : (
                <article
                  key={ws.key}
                  className="rounded-[1.75rem] border border-dashed border-slate-700 bg-slate-950/40 p-6 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{ws.service}</span>
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border bg-slate-800 text-slate-400 border-slate-700">
                        {ws.badge}
                      </span>
                    </div>
                    <h3 className="font-space text-lg font-bold text-slate-500">{ws.title}</h3>
                    <p className="mt-2 text-xs text-slate-600 leading-relaxed">{ws.description}</p>
                  </div>
                  <div className="mt-6 text-xs font-bold text-slate-600">
                    Prepared next
                  </div>
                </article>
              )
            )}
          </div>
        </section>

        {/* ── Operational Summary ─────────────────── */}
        <section className="space-y-6">
          <h2 className="font-space text-2xl font-black text-white">Operational Summary</h2>
          {loading ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-36 animate-pulse rounded-2xl border border-slate-800 bg-slate-900/50" />
              ))}
            </div>
          ) : overview.summaryCards.length > 0 ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {overview.summaryCards.map((card) => (
                <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 flex flex-col justify-between" key={card.title}>
                  <div>
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">{card.service}</span>
                    <span className="block text-xs font-bold text-slate-300 mb-3">{card.title}</span>
                  </div>
                  <div>
                    <span className="block font-space text-3xl font-black text-white mb-2">{card.value}</span>
                    <span className="block text-xs text-slate-500">{card.detail}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-850 bg-slate-950/40 p-8 text-center text-xs text-slate-550">
              Connected workspace metrics will appear after assigned services begin recording activity.
            </div>
          )}
        </section>

        {error && (
          <div className="rounded-2xl border border-amber-400/25 bg-amber-400/10 px-5 py-4 text-sm text-amber-250">
            {error}
          </div>
        )}

        {/* ── Action Queue + Activity ──────────────── */}
        <div className="grid gap-5 md:grid-cols-2">
          {/* Action Queue */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 space-y-4">
            <h3 className="font-space text-lg font-bold text-white">Action Queue</h3>
            <div className="space-y-2">
              {loading ? (
                <div className="h-10 animate-pulse rounded-xl bg-slate-800" />
              ) : overview.attentionItems.length > 0 ? (
                overview.attentionItems.map((item) => (
                  <div className="flex items-center gap-3 rounded-xl border border-slate-800/80 bg-slate-950/40 p-3 text-xs text-slate-300" key={item}>
                    <span className="h-2 w-2 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]" />
                    <span>{item}</span>
                  </div>
                ))
              ) : (
                <div className="flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs text-emerald-450">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                  <span>No urgent actions — all connected workspaces operating normally.</span>
                </div>
              )}
              <div className="rounded-xl border border-slate-850 bg-slate-950/20 p-3 text-[11px] text-slate-500 leading-relaxed">
                {isInternal
                  ? 'Internal researchers have access to pentest and training workspaces within the approved model.'
                  : 'External researchers have access to pentest and code review workspaces within the approved model.'}
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 space-y-4">
            <h3 className="font-space text-lg font-bold text-white">Recent Activity</h3>
            <div className="space-y-3">
              {loading ? (
                <div className="h-24 animate-pulse rounded-xl bg-slate-800" />
              ) : overview.activity.length > 0 ? (
                overview.activity.slice(0, 5).map((item) => (
                  <div className="rounded-xl border border-slate-800/60 bg-slate-950/40 p-4 text-xs" key={item.id}>
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-amber-500">{item.service}</span>
                      {item.occurredAt && <span className="text-[10px] text-slate-500">{new Date(item.occurredAt).toLocaleString()}</span>}
                    </div>
                    <strong className="block text-slate-200">{item.title}</strong>
                    <p className="mt-1 text-slate-400">{item.detail}</p>
                  </div>
                ))
              ) : (
                <div className="rounded-xl bg-slate-950/40 p-6 text-center text-xs text-slate-600">
                  Activity will appear after live workspaces begin recording updates.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Roadmap ─────────────────────────────── */}
        {roadmapWorkspaces.length > 0 && (
          <section className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="font-space text-2xl font-black text-white">Roadmap</h2>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">{roadmapWorkspaces.length} planned</span>
            </div>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {roadmapWorkspaces.map((ws) => (
                <article
                  key={ws.key}
                  className="rounded-[1.75rem] border border-dashed border-slate-700 bg-slate-950/40 p-6 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{ws.service}</span>
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border bg-slate-800 text-slate-400 border-slate-700">
                        {ws.badge}
                      </span>
                    </div>
                    <h3 className="font-space text-lg font-bold text-slate-500">{ws.title}</h3>
                    <p className="mt-2 text-xs text-slate-600 leading-relaxed">{ws.description}</p>
                  </div>
                  <div className="mt-6 text-xs font-bold text-slate-600">
                    Prepared next
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}




export function ResearcherPrograms() {
  const { user } = useAuth();
  const livePrograms = getLiveWorkspacesForUser(user);
  const roadmapPrograms = getRoadmapWorkspacesForUser(user);

  return (
    <ResearcherLayout
      subtitle="Program catalog for your assigned role. Live services launch in a separate tab, while future platform surfaces stay visible without breaking the role boundary."
      title="Researcher Programs"
    >
      <div className="space-y-8">
        <section className="space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-300">Live access</p>
            <h2 className="mt-2 font-space text-3xl font-bold text-white">Approved workspaces for your role</h2>
          </div>
          <LaunchGrid items={livePrograms} emphasizePrimary />
        </section>

        {roadmapPrograms.length > 0 ? (
          <section className="space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-300">Roadmap</p>
              <h2 className="mt-2 font-space text-3xl font-bold text-white">Prepared platform expansions</h2>
            </div>
            <LaunchGrid items={roadmapPrograms} />
          </section>
        ) : null}
      </div>
    </ResearcherLayout>
  );
}

export function ResearcherProgramDetail() {
  const { programName } = useParams();
  const { user } = useAuth();
  const livePrograms = getLiveWorkspacesForUser(user);
  const roadmapPrograms = getRoadmapWorkspacesForUser(user);
  const normalizedSlug = String(programName ?? '').trim().toLowerCase();
  const selectedProgram =
    [...livePrograms, ...roadmapPrograms].find(
      (item) => item.title.toLowerCase().replace(/[^a-z0-9]+/g, '-') === normalizedSlug
    ) ?? null;

  return (
    <ResearcherLayout
      subtitle="Role-aware program notes, scope expectations, and service access guidance."
      title={selectedProgram?.title ?? (programName?.replace(/-/g, ' ') ?? 'Program')}
    >
      <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
        <article className="rounded-[28px] border border-slate-800 bg-slate-950/72 p-6 shadow-[0_24px_70px_rgba(2,6,23,0.42)] backdrop-blur">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-300">
            {selectedProgram?.service ?? 'Program workspace'}
          </p>
          <h3 className="mt-3 font-space text-2xl font-bold text-white">Program context</h3>
          <p className="mt-4 text-sm leading-7 text-slate-300">
            {selectedProgram?.description ??
              'This program detail page is reserved for the connected service experience. Open the linked workspace to continue with scope, findings, or delivery activity.'}
          </p>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-4 text-sm text-slate-300">
              Access model: {selectedProgram?.status === 'live' ? 'Live workspace' : 'Roadmap surface'}
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-4 text-sm text-slate-300">
              Role boundary: {user?.researcherType === 'internal' ? 'Internal researcher' : 'External researcher'}
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-4 text-sm text-slate-300">
              Workflow owner: connected service backend
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-4 text-sm text-slate-300">
              Session handoff: trusted platform bootstrap
            </div>
          </div>
        </article>

        <article className="rounded-[28px] border border-slate-800 bg-slate-950/72 p-6 shadow-[0_24px_70px_rgba(2,6,23,0.42)] backdrop-blur">
          <h3 className="font-space text-xl font-bold text-white">Next step</h3>
          <p className="mt-3 text-sm leading-7 text-slate-300">
            Continue in the connected service workspace to work with real program data, findings, or delivery tasks.
          </p>
          {selectedProgram?.href ? (
            <WorkspaceLaunchLink
              className="mt-6 inline-flex rounded-full bg-red-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-red-400"
              href={selectedProgram.href}
            >
              Open workspace
            </WorkspaceLaunchLink>
          ) : (
            <span className="mt-6 inline-flex rounded-full border border-slate-700 bg-slate-900/70 px-5 py-3 text-sm font-semibold text-slate-400">
              Available when connected
            </span>
          )}
        </article>
      </div>
    </ResearcherLayout>
  );
}

export function ResearcherReports() {
  const { user } = useAuth();
  const livePrograms = getLiveWorkspacesForUser(user);
  const primaryLaunch = livePrograms[0];

  return (
    <ResearcherLayout
      subtitle="Connected reporting remains inside the live service workspace so evidence, timelines, and payout logic stay in sync with the backend."
      title="Reports"
    >
      <div className="grid gap-5 lg:grid-cols-2">
        <article className="rounded-[28px] border border-slate-800 bg-slate-950/72 p-6 shadow-[0_24px_70px_rgba(2,6,23,0.42)] backdrop-blur">
          <h3 className="font-space text-xl font-bold text-white">Live reporting workflow</h3>
          <p className="mt-3 text-sm leading-7 text-slate-300">
            Researcher reports, evidence, triage comments, and payout state all remain in the connected service workspace rather than being duplicated here.
          </p>
          {primaryLaunch?.href ? (
            <WorkspaceLaunchLink
              className="mt-6 inline-flex rounded-full bg-red-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-red-400"
              href={primaryLaunch.href}
            >
              Open live reporting workspace
            </WorkspaceLaunchLink>
          ) : null}
        </article>

        <article className="rounded-[28px] border border-slate-800 bg-slate-950/72 p-6 shadow-[0_24px_70px_rgba(2,6,23,0.42)] backdrop-blur">
          <h3 className="font-space text-xl font-bold text-white">Why this stays centralized</h3>
          <p className="mt-3 text-sm leading-7 text-slate-300">
            Keeping report handling in the service itself protects workflow accuracy for assignment state, severity, remediation tracking, and payout decisions.
          </p>
          <Link className="mt-6 inline-flex text-sm font-semibold text-red-300 hover:text-red-200" to="/programs">
            Review connected programs
          </Link>
        </article>
      </div>
    </ResearcherLayout>
  );
}

export function ResearcherReportNew() {
  const { user } = useAuth();
  const livePrograms = getLiveWorkspacesForUser(user);
  const primaryLaunch = livePrograms[0];

  return (
    <ResearcherLayout
      subtitle="New submissions are created inside the connected service workspace so scope, program rules, evidence, and payout logic stay consistent."
      title="Submit report"
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          'Confirm the right program and target',
          'Document reproducible impact',
          'Add clear steps and evidence',
          'Submit through the live workspace'
        ].map((item) => (
          <article className="rounded-[28px] border border-slate-800 bg-slate-950/72 p-6 text-sm text-slate-300 shadow-[0_24px_70px_rgba(2,6,23,0.42)] backdrop-blur" key={item}>
            <h3 className="font-space text-lg font-bold text-white">{item}</h3>
            <p className="mt-3 leading-7">
              {item === 'Submit through the live workspace'
                ? 'This final handoff keeps the report tied to the real backend workflow.'
                : 'Use the connected service workspace to keep every step attached to the real program state.'}
            </p>
          </article>
        ))}
      </div>

      {primaryLaunch?.href ? (
        <div className="mt-6">
          <WorkspaceLaunchLink
            className="inline-flex rounded-full bg-red-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-red-400"
            href={primaryLaunch.href}
          >
            Open report submission workspace
          </WorkspaceLaunchLink>
        </div>
      ) : null}
    </ResearcherLayout>
  );
}

export function ResearcherReportDetail() {
  const { reportId } = useParams();

  return (
    <ResearcherLayout
      subtitle="Report timelines, comments, review decisions, and remediation checkpoints stay in the connected service workspace."
      title={`Report ${reportId ?? 'Overview'}`}
    >
      <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
        <article className="rounded-[28px] border border-slate-800 bg-slate-950/72 p-6 shadow-[0_24px_70px_rgba(2,6,23,0.42)] backdrop-blur">
          <h3 className="font-space text-xl font-bold text-white">Lifecycle model</h3>
          <div className="mt-4 space-y-4 text-sm text-slate-300">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-4">Submitted with clear impact summary and supporting evidence.</div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-4">Reviewed by the service triage workflow with role-aware status changes.</div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-4">Closed only after remediation, retest, or final payout state is recorded in the live workspace.</div>
          </div>
        </article>

        <article className="rounded-[28px] border border-slate-800 bg-slate-950/72 p-6 shadow-[0_24px_70px_rgba(2,6,23,0.42)] backdrop-blur">
          <h3 className="font-space text-xl font-bold text-white">Workspace note</h3>
          <p className="mt-3 text-sm leading-7 text-slate-300">
            This platform page describes the report lifecycle, but the real report data lives inside the connected service workspace.
          </p>
        </article>
      </div>
    </ResearcherLayout>
  );
}

export function ResearcherInbox() {
  const { user } = useAuth();
  const { overview, loading, error } = useWorkspaceOverview(user);

  return (
    <ResearcherLayout
      subtitle="Cross-service activity and service notifications stay visible here so researchers always know what changed across their allowed workspaces."
      title="Inbox"
    >
      <div className="space-y-5">
        {error ? (
          <article className="rounded-[28px] border border-rose-500/30 bg-rose-500/10 px-5 py-4 text-sm text-rose-200">
            {error}
          </article>
        ) : null}

        {loading ? (
          <div className="space-y-4">
            {[0, 1, 2].map((item) => (
              <div className="h-28 animate-pulse rounded-[28px] border border-slate-800 bg-slate-950/55 shadow-[0_24px_70px_rgba(2,6,23,0.42)]" key={item} />
            ))}
          </div>
        ) : overview.activity.length > 0 ? (
          overview.activity.map((item) => (
            <article className="rounded-[28px] border border-slate-800 bg-slate-950/72 px-6 py-5 shadow-[0_24px_70px_rgba(2,6,23,0.42)] backdrop-blur" key={item.id}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-red-300">{item.service}</div>
                  <h3 className="mt-2 font-space text-xl font-bold text-white">{item.title}</h3>
                </div>
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  {item.occurredAt ? new Date(item.occurredAt).toLocaleString() : 'Live'}
                </span>
              </div>
              <p className="mt-3 text-sm leading-7 text-slate-300">{item.detail}</p>
            </article>
          ))
        ) : (
          <article className="rounded-[28px] border border-slate-800 bg-slate-950/72 px-6 py-6 text-sm text-slate-300 shadow-[0_24px_70px_rgba(2,6,23,0.42)] backdrop-blur">
            Your role-specific notifications and recent activity will appear here as soon as the connected workspaces begin recording updates.
          </article>
        )}
      </div>
    </ResearcherLayout>
  );
}

export function ResearcherSettings() {
  const { user } = useAuth();

  return (
    <ResearcherLayout
      subtitle="Researcher profile, session protection, and role-specific workspace preferences."
      title="Settings"
    >
      <div className="grid gap-5 lg:grid-cols-3">
        <article className="rounded-[28px] border border-slate-800 bg-slate-950/72 p-6 shadow-[0_24px_70px_rgba(2,6,23,0.42)] backdrop-blur">
          <h3 className="font-space text-xl font-bold text-white">Identity</h3>
          <div className="mt-4 space-y-2 text-sm text-slate-300">
            <div>
              Name: {(user?.displayName ?? `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim()) || 'Researcher'}
            </div>
            <div>Email: {user?.email}</div>
            <div>Role: {user?.researcherType === 'internal' ? 'Internal Researcher' : 'External Researcher'}</div>
          </div>
        </article>

        <article className="rounded-[28px] border border-slate-800 bg-slate-950/72 p-6 shadow-[0_24px_70px_rgba(2,6,23,0.42)] backdrop-blur">
          <h3 className="font-space text-xl font-bold text-white">Security</h3>
          <p className="mt-3 text-sm leading-7 text-slate-300">
            Two-factor authentication is {user?.twoFactorEnabled ? 'enabled and protecting this account.' : 'available and recommended for this account.'}
          </p>
          <Link className="mt-6 inline-flex text-sm font-semibold text-red-300 hover:text-red-200" to="/security/2fa">
            Manage 2FA
          </Link>
        </article>

        <article className="rounded-[28px] border border-slate-800 bg-slate-950/72 p-6 shadow-[0_24px_70px_rgba(2,6,23,0.42)] backdrop-blur">
          <h3 className="font-space text-xl font-bold text-white">Verification</h3>
          <p className="mt-3 text-sm leading-7 text-slate-300">
            Researcher access remains aligned to national ID and certification review so service permissions remain trusted.
          </p>
          <Link className="mt-6 inline-flex text-sm font-semibold text-red-300 hover:text-red-200" to="/researcher/verification">
            Review verification status
          </Link>
        </article>
      </div>
    </ResearcherLayout>
  );
}

export function ResearcherPayments() {
  const [summary, setSummary] = useState<EarningsSummary | null>(null);
  const [earnings, setEarnings] = useState<ResearcherEarning[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadPayments() {
    setLoading(true);
    setError('');
    try {
      const payload = await fetchResearcherEarnings();
      setSummary(payload.summary);
      setEarnings(payload.earnings);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load payment data.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadPayments();
  }, []);

  const stats = [
    ['Total earned', summary?.totalEarned ?? 0]
  ];

  return (
    <ResearcherLayout
      subtitle="Track accepted bounty earnings and monitor payout status from the unified researcher wallet."
      title="Payments"
    >
      <div className="space-y-5">
        {error ? (
          <article className="rounded-[28px] border border-rose-500/30 bg-rose-500/10 px-5 py-4 text-sm text-rose-200">
            {error}
          </article>
        ) : null}

        {loading ? (
          <div className="grid gap-5 lg:grid-cols-1 max-w-sm">
            <div className="h-36 animate-pulse rounded-[28px] border border-slate-800 bg-slate-950/55 shadow-[0_24px_70px_rgba(2,6,23,0.42)]" />
          </div>
        ) : (
          <div className="grid gap-5 lg:grid-cols-1 max-w-sm">
            {stats.map(([label, value]) => (
              <article className="rounded-[28px] border border-slate-800 bg-slate-950/72 p-6 shadow-[0_24px_70px_rgba(2,6,23,0.42)]" key={label}>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
                <div className="mt-3 text-3xl font-black text-white">{Number(value).toLocaleString()} ETB</div>
              </article>
            ))}
          </div>
        )}

        <section className="overflow-hidden rounded-[28px] border border-slate-800 bg-slate-950/72 shadow-[0_24px_70px_rgba(2,6,23,0.42)]">
          <div className="border-b border-slate-800 px-6 py-5">
            <h3 className="font-space text-xl font-bold text-white">Earnings history</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="bg-slate-900/80 text-xs uppercase tracking-[0.16em] text-slate-500">
                <tr><th className="px-5 py-3">Submission</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Amount</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {earnings.map((item) => (
                  <tr key={item.id}>
                    <td className="px-5 py-4"><strong className="text-white">{item.submissionTitle}</strong><span className="block text-xs text-slate-500">{item.programTitle}</span></td>
                    <td className="px-5 py-4"><span className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs font-bold uppercase text-slate-300">{item.status}</span></td>
                    <td className="px-5 py-4 font-bold text-white">{item.amount.toLocaleString()} ETB</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {earnings.length === 0 ? <div className="px-6 py-8 text-sm text-slate-400">Accepted bug bounty earnings will appear here.</div> : null}
        </section>
      </div>
    </ResearcherLayout>
  );
}

export function ResearcherInvitations() {
  const { user } = useAuth();
  const liveWorkspaces = getLiveWorkspacesForUser(user);

  return (
    <ResearcherLayout
      subtitle="Researcher invitation handling stays inside the connected service workflow so acceptance and assignment state remain synchronized."
      title="Invitations"
    >
      <div className="grid gap-5 lg:grid-cols-2">
        <article className="rounded-[28px] border border-slate-800 bg-slate-950/72 p-6 shadow-[0_24px_70px_rgba(2,6,23,0.42)] backdrop-blur">
          <h3 className="font-space text-xl font-bold text-white">Invitation processing</h3>
          <p className="mt-3 text-sm leading-7 text-slate-300">
            Invitations, acceptance decisions, and program access changes stay in the live service workspace rather than being duplicated in a second inbox.
          </p>
        </article>

        <article className="rounded-[28px] border border-slate-800 bg-slate-950/72 p-6 shadow-[0_24px_70px_rgba(2,6,23,0.42)] backdrop-blur">
          <h3 className="font-space text-xl font-bold text-white">Continue in workspace</h3>
          <p className="mt-3 text-sm leading-7 text-slate-300">
            Open the live workspace connected to your role to review invitations, assignment state, or service-specific messages.
          </p>
          {liveWorkspaces[0]?.href ? (
            <WorkspaceLaunchLink
              className="mt-6 inline-flex rounded-full bg-red-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-red-400"
              href={liveWorkspaces[0].href}
            >
              Open live workspace
            </WorkspaceLaunchLink>
          ) : null}
        </article>
      </div>
    </ResearcherLayout>
  );
}

export function ResearcherProfile() {
  const { user } = useAuth();
  const isInternal = user?.researcherType === 'internal';
  const penWorkspaceHref = isInternal ? '/workspace/pen/internal/' : '/workspace/pen/external/';
  const trainingWorkspaceHref = '/workspace/training/researcher/researcher';
  const displayName =
    user?.displayName ??
    (`${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim() || user?.email || 'Researcher Profile');

  const [profile, setProfile] = useState<ServiceResearcherProfile | null>(null);
  const [form, setForm] = useState<ResearcherProfileUpdatePayload>(buildProfileForm());
  const [trainingProgress, setTrainingProgress] = useState<TrainingProgressSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [trainingError, setTrainingError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadProfileSurface() {
      setIsLoading(true);
      setError('');
      setTrainingError('');

      try {
        const profileData = await fetchResearcherProfile();
        if (cancelled) return;
        setProfile(profileData);
        setForm(buildProfileForm(profileData));

        if (isInternal) {
          try {
            const trainingData = await fetchTrainingProgress();
            if (!cancelled) {
              setTrainingProgress(trainingData);
            }
          } catch (trainingIssue) {
            if (!cancelled) {
              setTrainingProgress(null);
              setTrainingError(
                trainingIssue instanceof Error
                  ? trainingIssue.message
                  : 'Training progress is temporarily unavailable.'
              );
            }
          }
        } else if (!cancelled) {
          setTrainingProgress(null);
        }
      } catch (profileIssue) {
        if (!cancelled) {
          setError(
            profileIssue instanceof Error
              ? profileIssue.message
              : 'Researcher profile details are unavailable right now.'
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadProfileSurface();

    return () => {
      cancelled = true;
    };
  }, [isInternal]);

  useEffect(() => {
    if (!success) return undefined;
    const timer = window.setTimeout(() => setSuccess(''), 3200);
    return () => window.clearTimeout(timer);
  }, [success]);

  function updateField(field: keyof Omit<ResearcherProfileUpdatePayload, 'socialLinks'>, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updateSocialLink(field: keyof ResearcherProfileUpdatePayload['socialLinks'], value: string) {
    setForm((current) => ({
      ...current,
      socialLinks: {
        ...current.socialLinks,
        [field]: value
      }
    }));
  }

  function resetForm() {
    setForm(buildProfileForm(profile));
  }

  async function handleSaveProfile() {
    setIsSaving(true);
    setError('');
    setSuccess('');

    try {
      const updated = await updateResearcherProfile(form);
      setProfile(updated);
      setForm(buildProfileForm(updated));
      setSuccess('Researcher profile updated.');
    } catch (saveIssue) {
      setError(saveIssue instanceof Error ? saveIssue.message : 'Unable to update the researcher profile.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handlePhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setError('');
    setSuccess('');
    if (file.size > 5 * 1024 * 1024) {
      setError('Profile photo must be 5MB or smaller.');
      event.target.value = '';
      return;
    }

    setIsUploadingPhoto(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      const updated = await uploadResearcherProfilePhoto(dataUrl);
      setProfile(updated);
      setForm(buildProfileForm(updated));
      setSuccess('Profile photo updated.');
    } catch (uploadIssue) {
      setError(uploadIssue instanceof Error ? uploadIssue.message : 'Unable to upload the profile photo.');
    } finally {
      setIsUploadingPhoto(false);
      event.target.value = '';
    }
  }

  return (
    <ResearcherLayout
      subtitle="Service-owned profile details stay editable through the connected Pentest workspace while training performance remains a read-only aggregate for approved internal researchers."
      title={displayName}
    >

      {error ? <UiEmptyState description={error} title="Profile details are still loading" /> : null}
      {success ? (
        <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-200">
          {success}
        </div>
      ) : null}

      <RankIndicator user={user} />

      <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
        <Card
          description="Platform identity remains authoritative for account approval, while service-owned fields help organizations and admins route you into the right work."
          title="Profile summary"
        >
          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="h-24 animate-pulse rounded-xl bg-white/70" />
              <div className="h-24 animate-pulse rounded-xl bg-white/70" />
              <div className="h-24 animate-pulse rounded-xl bg-white/70" />
              <div className="h-24 animate-pulse rounded-xl bg-white/70" />
            </div>
          ) : (
            <div className="grid gap-5 lg:grid-cols-[auto_1fr]">
              <div className="flex flex-col items-center gap-4 rounded-2xl border border-[#ddd7e6] bg-white px-5 py-5 text-center">
                <Avatar name={profile?.fullName ?? displayName} size="lg" src={profile?.photoDataUrl ?? ''} />
                <div className="space-y-1">
                  <div className="font-semibold text-[#26213a]">{profile?.fullName ?? displayName}</div>
                  <div className="text-sm text-[#655f73]">@{profile?.handle ?? 'researcher'}</div>
                </div>
                <Badge tone={user?.approvalStatus === 'approved' ? 'success' : 'warning'}>
                  {badgeText(user?.approvalStatus ?? 'pending_submission')}
                </Badge>
                <label className="cursor-pointer rounded-full border border-[#ddd7e6] bg-[#faf7fc] px-4 py-2 text-sm font-semibold text-[#26213a] transition hover:border-red-300 hover:text-[#dc2626]">
                  {isUploadingPhoto ? 'Uploading...' : 'Update photo'}
                  <input
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    disabled={isUploadingPhoto}
                    onChange={handlePhotoChange}
                    type="file"
                  />
                </label>
                <div className="text-xs text-[#655f73]">PNG, JPG, or WebP up to 5MB.</div>
              </div>

              <div className="grid gap-4 text-sm md:grid-cols-2">
                <div className="rounded-xl border border-[#ddd7e6] bg-white px-4 py-4">Email: {profile?.email ?? user?.email}</div>
                <div className="rounded-xl border border-[#ddd7e6] bg-white px-4 py-4">Phone: {profile?.phone || 'Not added yet'}</div>
                <div className="rounded-xl border border-[#ddd7e6] bg-white px-4 py-4">
                  Researcher type: {isInternal ? 'Internal Researcher' : 'External Researcher'}
                </div>
                <div className="rounded-xl border border-[#ddd7e6] bg-white px-4 py-4">
                  Experience: {formatExperienceLevel(profile?.experienceLevel)}
                </div>
                <div className="rounded-xl border border-[#ddd7e6] bg-white px-4 py-4 md:col-span-2">
                  Skills: {profile?.skills || 'No skills shared yet'}
                </div>
                <div className="rounded-xl border border-[#ddd7e6] bg-white px-4 py-4 md:col-span-2">
                  Specialization: {profile?.specialization || 'No specialization shared yet'}
                </div>
                <div className="rounded-xl border border-[#ddd7e6] bg-white px-4 py-4 md:col-span-2">
                  Bio: {profile?.bio || 'Add a short researcher bio to help organizations understand your focus.'}
                </div>
              </div>
            </div>
          )}
        </Card>

        <Card
          description="These numbers are pulled from live Pentest submissions and, for internal researchers, the Training workflow."
          title="Service signals"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <StatWidget label="Submissions" value={String(profile?.submissionsCount ?? 0)} />
            <StatWidget
              label="Ratings"
              value={profile?.reputationStats?.ratingCount ? String(profile.reputationStats.ratingCount) : '0'}
            />
            <StatWidget
              label="Accepted findings"
              value={String(profile?.reputationStats?.acceptedFindings ?? 0)}
            />
            <StatWidget
              label="Resolved findings"
              value={String(profile?.reputationStats?.resolvedFindings ?? 0)}
            />
            <StatWidget label="Paid findings" value={String(profile?.reputationStats?.paidFindings ?? 0)} />
            <StatWidget label="Bounty paid" value={`$${profile?.reputationStats?.totalBounty ?? 0}`} />
          </div>

          <div className="mt-5 rounded-2xl border border-[#ddd7e6] bg-white px-4 py-4">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#dc2626]">Connected workspaces</div>
            <div className="mt-3 flex flex-wrap gap-3">
              <WorkspaceLaunchLink className="antui-link-button" href={penWorkspaceHref}>
                Manage Pentest Profile
              </WorkspaceLaunchLink>
              {isInternal ? (
                <WorkspaceLaunchLink className="antui-link-button" href={trainingWorkspaceHref}>
                  Review Training Activity
                </WorkspaceLaunchLink>
              ) : null}
            </div>
          </div>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
        <Card
          description="This updates the service-owned Pen researcher profile while keeping your central account identity untouched."
          title="Editable researcher details"
        >
          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-sm font-semibold text-[#26213a]">
              Phone number
              <input
                className="rounded-xl border border-[#ddd7e6] bg-white px-4 py-3 text-sm text-[#26213a] outline-none transition focus:border-red-300"
                onChange={(event) => updateField('phone', event.target.value)}
                placeholder="+251 ..."
                value={form.phone}
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-[#26213a]">
              Experience level
              <select
                className="rounded-xl border border-[#ddd7e6] bg-white px-4 py-3 text-sm text-[#26213a] outline-none transition focus:border-red-300"
                onChange={(event) => updateField('experienceLevel', event.target.value)}
                value={form.experienceLevel}
              >
                <option value="">Select level</option>
                <option value="entry">Entry</option>
                <option value="mid">Mid</option>
                <option value="senior">Senior</option>
                <option value="lead">Lead</option>
                <option value="principal">Principal</option>
                <option value="expert">Expert</option>
              </select>
            </label>
            <label className="grid gap-2 text-sm font-semibold text-[#26213a] md:col-span-2">
              Skills
              <input
                className="rounded-xl border border-[#ddd7e6] bg-white px-4 py-3 text-sm text-[#26213a] outline-none transition focus:border-red-300"
                onChange={(event) => updateField('skills', event.target.value)}
                placeholder="Web security, API testing, cloud posture..."
                value={form.skills}
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-[#26213a] md:col-span-2">
              Specialization
              <input
                className="rounded-xl border border-[#ddd7e6] bg-white px-4 py-3 text-sm text-[#26213a] outline-none transition focus:border-red-300"
                onChange={(event) => updateField('specialization', event.target.value)}
                placeholder="Application security, red team validation, mobile security..."
                value={form.specialization}
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-[#26213a] md:col-span-2">
              Bio / about
              <textarea
                className="min-h-[148px] rounded-xl border border-[#ddd7e6] bg-white px-4 py-3 text-sm text-[#26213a] outline-none transition focus:border-red-300"
                onChange={(event) => updateField('bio', event.target.value)}
                placeholder="Share your background, preferred domains, and how you approach responsible testing."
                value={form.bio}
              />
            </label>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              className="inline-flex items-center rounded-full bg-red-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isSaving}
              onClick={handleSaveProfile}
              type="button"
            >
              {isSaving ? 'Saving...' : 'Save profile'}
            </button>
            <button
              className="inline-flex items-center rounded-full border border-[#ddd7e6] bg-white px-5 py-3 text-sm font-semibold text-[#26213a] transition hover:border-red-300 hover:text-[#dc2626]"
              onClick={resetForm}
              type="button"
            >
              Reset fields
            </button>
          </div>
        </Card>

        <Card
          description="Social links are normalized and validated before they are shared back into the researcher experience."
          title="Social links"
        >
          <div className="grid gap-4">
            <label className="grid gap-2 text-sm font-semibold text-[#26213a]">
              GitHub
              <input
                className="rounded-xl border border-[#ddd7e6] bg-white px-4 py-3 text-sm text-[#26213a] outline-none transition focus:border-red-300"
                onChange={(event) => updateSocialLink('github', event.target.value)}
                placeholder="github.com/your-handle"
                value={form.socialLinks.github ?? ''}
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-[#26213a]">
              LinkedIn
              <input
                className="rounded-xl border border-[#ddd7e6] bg-white px-4 py-3 text-sm text-[#26213a] outline-none transition focus:border-red-300"
                onChange={(event) => updateSocialLink('linkedin', event.target.value)}
                placeholder="linkedin.com/in/your-handle"
                value={form.socialLinks.linkedin ?? ''}
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-[#26213a]">
              X / Twitter
              <input
                className="rounded-xl border border-[#ddd7e6] bg-white px-4 py-3 text-sm text-[#26213a] outline-none transition focus:border-red-300"
                onChange={(event) => updateSocialLink('x', event.target.value)}
                placeholder="@yourhandle or x.com/yourhandle"
                value={form.socialLinks.x ?? ''}
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-[#26213a]">
              Website / portfolio
              <input
                className="rounded-xl border border-[#ddd7e6] bg-white px-4 py-3 text-sm text-[#26213a] outline-none transition focus:border-red-300"
                onChange={(event) => updateSocialLink('website', event.target.value)}
                placeholder="https://your-portfolio.example"
                value={form.socialLinks.website ?? ''}
              />
            </label>

            <div className="rounded-2xl border border-[#ddd7e6] bg-white px-4 py-4 text-sm text-[#655f73]">
              Connected links:
              <div className="mt-3 flex flex-wrap gap-2">
                {Object.entries(profile?.socialLinks ?? {}).length ? (
                  Object.entries(profile?.socialLinks ?? {}).map(([label, href]) => (
                    <a
                      className="rounded-full border border-[#ddd7e6] bg-[#faf7fc] px-3 py-2 font-semibold text-[#26213a] transition hover:border-red-300 hover:text-[#dc2626]"
                      href={href}
                      key={label}
                      rel="noreferrer"
                      target="_blank"
                    >
                      {label}
                    </a>
                  ))
                ) : (
                  <span>No social links connected yet.</span>
                )}
              </div>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
        <Card
          description="Training metrics remain read-only and come directly from the Training service request, plan, and report workflow."
          title="Training progress"
        >
          {!isInternal ? (
            <UiEmptyState
              description="External researchers do not receive the internal Training workflow summary."
              title="Training summary not applicable"
            />
          ) : trainingError ? (
            <UiEmptyState description={trainingError} title="Training progress is temporarily unavailable" />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <StatWidget label="Assigned requests" value={String(trainingProgress?.assignedRequests ?? 0)} />
              <StatWidget label="Scheduled plans" value={String(trainingProgress?.scheduledPlans ?? 0)} />
              <StatWidget label="Submitted reports" value={String(trainingProgress?.submittedReports ?? 0)} />
              <StatWidget
                label="Avg improvement"
                value={`${(trainingProgress?.averageImprovement ?? 0).toFixed(1)} pts`}
              />
              <StatWidget
                label="Avg attendance"
                value={`${(trainingProgress?.averageAttendance ?? 0).toFixed(1)}%`}
              />
              <StatWidget
                label="Org rating"
                value={
                  trainingProgress?.averageOrganizationRating
                    ? trainingProgress.averageOrganizationRating.toFixed(1)
                    : 'Not rated'
                }
              />
            </div>
          )}
        </Card>

        <Card
          description="This identity surface keeps the central auth record, pentest profile, and training status aligned without duplicating ownership."
          title="Platform note"
        >
          <div className="grid gap-4 text-sm">
            <div className="rounded-xl border border-[#ddd7e6] bg-white px-4 py-4">
              Display name: {displayName}
            </div>
            <div className="rounded-xl border border-[#ddd7e6] bg-white px-4 py-4">
              Central account approval: {badgeText(user?.approvalStatus ?? 'pending_submission')}
            </div>
            <div className="rounded-xl border border-[#ddd7e6] bg-white px-4 py-4">
              Canonical editable source: Pen Service researcher profile
            </div>
            <div className="rounded-xl border border-[#ddd7e6] bg-white px-4 py-4">
              Training progress source: Training request, plan, and report workflow
            </div>
          </div>
        </Card>
      </div>
    </ResearcherLayout>
  );
}
