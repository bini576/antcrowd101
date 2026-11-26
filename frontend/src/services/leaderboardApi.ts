export type LeaderboardServiceKey = 'all' | 'pen' | 'bug-bounty' | 'challenge' | 'ai-redteam';

export type ServiceScore = {
  service: Exclude<LeaderboardServiceKey, 'all'>;
  serviceName: string;
  score: number;
};

export type LeaderboardEntry = {
  name: string;
  score: number;
  services: ServiceScore[];
};

type RawLeaderboardItem = {
  name?: string;
  score?: number;
  label?: string;
  researcherName?: string;
  ResearcherName?: string;
  points?: number;
  Points?: number;
};

const SERVICE_ENDPOINTS: Array<{
  key: Exclude<LeaderboardServiceKey, 'all'>;
  name: string;
  path: string;
}> = [
  { key: 'pen', name: 'Pentest', path: '/api/pen/api/leaderboard' },
  { key: 'bug-bounty', name: 'Bug Bounty', path: '/api/bug-bounty/api/leaderboard' },
  { key: 'challenge', name: 'Challenge', path: '/api/challenge/api/leaderboard' },
  { key: 'ai-redteam', name: 'AI Red Team', path: '/api/ai-redteam/api/leaderboard' }
];

async function readJson(response: Response) {
  return response.json().catch(() => ({}));
}

function normalizeItems(payload: unknown): RawLeaderboardItem[] {
  if (Array.isArray(payload)) return payload as RawLeaderboardItem[];
  if (payload && typeof payload === 'object') {
    const body = payload as { items?: RawLeaderboardItem[]; leaderboard?: RawLeaderboardItem[] };
    if (Array.isArray(body.items)) return body.items;
    if (Array.isArray(body.leaderboard)) return body.leaderboard;
  }
  return [];
}

function normalizeName(item: RawLeaderboardItem) {
  return String(item.name || item.researcherName || item.ResearcherName || 'Researcher').trim();
}

function normalizeScore(item: RawLeaderboardItem) {
  return Number(item.score ?? item.points ?? item.Points ?? 0) || 0;
}

function sortEntries(entries: LeaderboardEntry[]) {
  return [...entries].sort((left, right) => right.score - left.score || left.name.localeCompare(right.name));
}

export async function fetchLeaderboardEntries() {
  const results = await Promise.allSettled(
    SERVICE_ENDPOINTS.map(async (service) => {
      const response = await fetch(service.path, { credentials: 'include' });
      const payload = await readJson(response);
      if (!response.ok) {
        throw new Error(`${service.name} leaderboard failed`);
      }
      const entries = normalizeItems(payload)
        .map((item) => ({
          name: normalizeName(item),
          score: normalizeScore(item),
          services: [{ service: service.key, serviceName: service.name, score: normalizeScore(item) }]
        }))
        .filter((item) => item.name && item.score > 0);
      return { service, entries };
    })
  );

  const byService = new Map<Exclude<LeaderboardServiceKey, 'all'>, LeaderboardEntry[]>();
  const combined = new Map<string, LeaderboardEntry>();

  results.forEach((result, index) => {
    const service = SERVICE_ENDPOINTS[index];
    const entries = result.status === 'fulfilled' ? result.value.entries : [];
    byService.set(service.key, sortEntries(entries));

    entries.forEach((entry) => {
      const key = entry.name.toLowerCase();
      const existing = combined.get(key) ?? { name: entry.name, score: 0, services: [] };
      existing.score += entry.score;
      existing.services.push(...entry.services);
      combined.set(key, existing);
    });
  });

  return {
    combined: sortEntries([...combined.values()]),
    byService,
    serviceErrors: results
      .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
      .map((result) => (result.reason instanceof Error ? result.reason.message : 'A leaderboard failed to load'))
  };
}

export function rankBadge(score: number) {
  if (score >= 6000) return 'Elite';
  if (score >= 3000) return 'Expert';
  if (score >= 1200) return 'Researcher';
  if (score >= 300) return 'Contributor';
  return 'Newcomer';
}

export function rankBadgeTone(score: number) {
  if (score >= 6000) return 'text-amber-300 border-amber-400/40 bg-amber-400/10';
  if (score >= 3000) return 'text-fuchsia-200 border-fuchsia-400/35 bg-fuchsia-400/10';
  if (score >= 1200) return 'text-sky-200 border-sky-400/35 bg-sky-400/10';
  if (score >= 300) return 'text-emerald-200 border-emerald-400/35 bg-emerald-400/10';
  return 'text-slate-300 border-slate-700 bg-slate-900/70';
}

export function initialsFor(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'R';
}
