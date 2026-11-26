import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  fetchLeaderboardEntries,
  initialsFor,
  rankBadge,
  rankBadgeTone,
  type LeaderboardEntry,
  type LeaderboardServiceKey
} from '../services/leaderboardApi';

const TABS: Array<{ key: LeaderboardServiceKey; label: string }> = [
  { key: 'all', label: 'All services' },
  { key: 'pen', label: 'Pentest' },
  { key: 'bug-bounty', label: 'Bug bounty' },
  { key: 'challenge', label: 'Challenge' },
  { key: 'ai-redteam', label: 'AI red team' }
];

const avatarTones = [
  'from-amber-400 to-orange-500',
  'from-sky-400 to-cyan-500',
  'from-emerald-400 to-teal-500',
  'from-fuchsia-400 to-pink-500',
  'from-red-400 to-rose-500'
];

function podiumHeight(index: number) {
  if (index === 0) return 'lg:min-h-[290px]';
  if (index === 1) return 'lg:min-h-[240px]';
  return 'lg:min-h-[210px]';
}

function PodiumCard({ entry, rank, index }: { entry: LeaderboardEntry; rank: number; index: number }) {
  return (
    <article className={`relative flex flex-col justify-between overflow-hidden rounded-[1.75rem] border border-slate-800 bg-slate-900/75 p-6 shadow-[0_24px_90px_rgba(2,6,23,0.45)] ${podiumHeight(index)}`}>
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber-400 via-red-400 to-sky-400" />
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-amber-300">Rank #{rank}</p>
          <h2 className="mt-3 font-space text-2xl font-bold text-white">{entry.name}</h2>
        </div>
        <div className={`grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br ${avatarTones[index % avatarTones.length]} text-lg font-black text-slate-950 shadow-lg`}>
          {initialsFor(entry.name)}
        </div>
      </div>
      <div className="mt-8">
        <div className="text-4xl font-black text-white">{entry.score.toLocaleString()}</div>
        <div className="mt-2 text-sm text-slate-400">total points</div>
        <span className={`mt-5 inline-flex rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.12em] ${rankBadgeTone(entry.score)}`}>
          {rankBadge(entry.score)}
        </span>
      </div>
    </article>
  );
}

function SkeletonLeaderboard() {
  return (
    <div className="space-y-8">
      <div className="grid gap-5 lg:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <div key={item} className="h-64 animate-pulse rounded-[1.75rem] border border-slate-800 bg-slate-900/60" />
        ))}
      </div>
      <div className="h-96 animate-pulse rounded-[1.75rem] border border-slate-800 bg-slate-900/60" />
    </div>
  );
}

export default function Leaderboard() {
  const [activeTab, setActiveTab] = useState<LeaderboardServiceKey>('all');
  const [combined, setCombined] = useState<LeaderboardEntry[]>([]);
  const [byService, setByService] = useState<Map<Exclude<LeaderboardServiceKey, 'all'>, LeaderboardEntry[]>>(new Map());
  const [serviceErrors, setServiceErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchLeaderboardEntries()
      .then((payload) => {
        if (!active) return;
        setCombined(payload.combined);
        setByService(payload.byService);
        setServiceErrors(payload.serviceErrors);
      })
      .catch((error) => {
        if (!active) return;
        setCombined([]);
        setByService(new Map());
        setServiceErrors([error instanceof Error ? error.message : 'Leaderboards are temporarily unavailable']);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const entries = useMemo(() => {
    if (activeTab === 'all') return combined;
    return byService.get(activeTab) ?? [];
  }, [activeTab, byService, combined]);

  const podium = entries.slice(0, 3);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="h-1 bg-gradient-to-r from-amber-500 via-red-500 to-sky-400" />
      <header className="border-b border-slate-800/70">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <Link to="/" className="font-space text-2xl font-black text-amber-400">AntCrowd</Link>
          <nav className="flex items-center gap-4 text-sm font-semibold text-slate-300">
            <Link to="/researchers" className="hover:text-amber-300">Researchers</Link>
            <Link to="/login" className="rounded-xl border border-slate-700 px-4 py-2 hover:border-amber-400/50 hover:text-amber-300">Log in</Link>
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-6 py-14">
        <div className="max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-amber-300">Competitive security leaderboard</p>
          <h1 className="mt-4 font-space text-4xl font-black tracking-tight text-white sm:text-6xl">Researcher rankings</h1>
          <p className="mt-5 text-base leading-8 text-slate-400">
            Combined impact from accepted pentest findings, bug bounty awards, CTF flags, and AI red team reports.
          </p>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`rounded-full border px-4 py-2 text-sm font-bold transition ${
                activeTab === tab.key
                  ? 'border-amber-400 bg-amber-400 text-slate-950'
                  : 'border-slate-700 bg-slate-900/70 text-slate-300 hover:border-amber-400/50 hover:text-amber-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {serviceErrors.length ? (
          <div className="mt-6 rounded-2xl border border-amber-400/25 bg-amber-400/10 px-5 py-4 text-sm text-amber-100">
            Some service leaderboards did not respond, so this view is showing the data that is available.
          </div>
        ) : null}

        <div className="mt-10">
          {loading ? (
            <SkeletonLeaderboard />
          ) : entries.length === 0 ? (
            <section className="rounded-[1.75rem] border border-slate-800 bg-slate-900/70 p-10 text-center shadow-[0_24px_90px_rgba(2,6,23,0.45)]">
              <h2 className="font-space text-2xl font-bold text-white">No ranked researchers yet</h2>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-slate-400">
                Accepted reports, validated CTF solves, and paid findings will appear here as soon as services record score-bearing activity.
              </p>
            </section>
          ) : (
            <div className="space-y-8">
              <section className="grid gap-5 lg:grid-cols-3 lg:items-end">
                {podium.map((entry, index) => (
                  <PodiumCard key={`${entry.name}-${entry.score}`} entry={entry} rank={index + 1} index={index} />
                ))}
              </section>

              <section className="overflow-hidden rounded-[1.75rem] border border-slate-800 bg-slate-900/70 shadow-[0_24px_90px_rgba(2,6,23,0.45)]">
                <div className="border-b border-slate-800 px-6 py-5">
                  <h2 className="font-space text-xl font-bold text-white">Full ranking</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] text-left text-sm">
                    <thead className="bg-slate-950/50 text-xs uppercase tracking-[0.16em] text-slate-500">
                      <tr>
                        <th className="px-6 py-4">Position</th>
                        <th className="px-6 py-4">Researcher</th>
                        <th className="px-6 py-4">Badge</th>
                        <th className="px-6 py-4">Score</th>
                        <th className="px-6 py-4">Services</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {entries.map((entry, index) => (
                        <tr key={`${entry.name}-${index}`} className="hover:bg-slate-800/35">
                          <td className="px-6 py-4 font-black text-slate-300">#{index + 1}</td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className={`grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br ${avatarTones[index % avatarTones.length]} text-xs font-black text-slate-950`}>
                                {initialsFor(entry.name)}
                              </div>
                              <span className="font-bold text-white">{entry.name}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.12em] ${rankBadgeTone(entry.score)}`}>
                              {rankBadge(entry.score)}
                            </span>
                          </td>
                          <td className="px-6 py-4 font-black text-white">{entry.score.toLocaleString()}</td>
                          <td className="px-6 py-4">
                            <div className="flex flex-wrap gap-2">
                              {entry.services.map((service) => (
                                <span key={`${entry.name}-${service.service}`} className="rounded-full border border-slate-700 bg-slate-950/70 px-3 py-1 text-xs font-semibold text-slate-300">
                                  {service.serviceName}
                                </span>
                              ))}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
