import { useEffect, useMemo, useState } from 'react';
import type { AuthUser } from '../auth/types';
import {
  fetchLeaderboardEntries,
  rankBadge,
  rankBadgeTone,
  type LeaderboardEntry
} from '../services/leaderboardApi';

function displayNameFor(user: AuthUser | null | undefined) {
  return (
    user?.displayName ||
    `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim() ||
    user?.email ||
    ''
  );
}

function matchesUser(entry: LeaderboardEntry, user: AuthUser | null | undefined) {
  const name = displayNameFor(user).toLowerCase();
  const email = String(user?.email || '').toLowerCase();
  const entryName = entry.name.toLowerCase();
  return Boolean(entryName && (entryName === name || entryName === email));
}

export default function RankIndicator({ user }: { user: AuthUser | null }) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchLeaderboardEntries()
      .then((payload) => {
        if (active) setEntries(payload.combined);
      })
      .catch(() => {
        if (active) setEntries([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const rank = useMemo(() => {
    const index = entries.findIndex((entry) => matchesUser(entry, user));
    if (index < 0) return null;
    return { position: index + 1, entry: entries[index] };
  }, [entries, user]);

  const score = rank?.entry.score ?? 0;

  return (
    <article className="rounded-[1.5rem] border border-slate-800 bg-slate-950/72 px-5 py-4 shadow-[0_20px_60px_rgba(2,6,23,0.35)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Platform rank</p>
          <div className="mt-1 font-space text-2xl font-bold text-white">
            {loading ? 'Loading' : rank ? `#${rank.position}` : 'Unranked'}
          </div>
        </div>
        <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.12em] ${rankBadgeTone(score)}`}>
          {rankBadge(score)}
        </span>
      </div>
      <p className="mt-3 text-sm text-slate-400">
        {rank ? `${score.toLocaleString()} combined points across ${rank.entry.services.length} service lane${rank.entry.services.length === 1 ? '' : 's'}.` : 'Earn points from accepted reports, CTF flags, and validated findings.'}
      </p>
    </article>
  );
}
