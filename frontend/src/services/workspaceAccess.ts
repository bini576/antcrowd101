import type { AuthUser } from '../auth/types';

export type WorkspaceAudience = 'organization' | 'internal' | 'external' | 'compliance_team' | 'developer';
export type WorkspaceStatus = 'live' | 'roadmap';
export type WorkspaceKey =
  | 'pen-org'
  | 'vdp-org'
  | 'training-org'
  | 'pen-internal'
  | 'training-internal'
  | 'pen-external'
  | 'bug-bounty'
  | 'ai-redteam'
  | 'challenge'
  | 'code-org'
  | 'code-internal'
  | 'trust-center'
  | 'trust-admin'
  | 'trust-org'
  | 'compliance'
  | 'developer';

export type WorkspaceDefinition = {
  key: WorkspaceKey;
  audience: WorkspaceAudience | 'shared';
  status: WorkspaceStatus;
  service: string;
  title: string;
  description: string;
  badge: string;
  href?: string;
};

export const liveWorkspaceDefinitions: WorkspaceDefinition[] = [
  {
    key: 'pen-org',
    audience: 'organization',
    status: 'live',
    service: 'Penetration Testing',
    title: 'Penetration Testing',
    description:
      'Launch the organization pentest workspace for scope planning, assignments, findings, and remediation progress.',
    badge: 'Live',
    href: '/workspace/pen/org/'
  },
  {
    key: 'vdp-org',
    audience: 'organization',
    status: 'live',
    service: 'Vulnerability Disclosure Program',
    title: 'Vulnerability Disclosure Program',
    description:
      'Open the VDP organization command center for disclosure policy, triage lanes, and researcher communication.',
    badge: 'Live',
    href: '/workspace/vdp/org/org-admin'
  },
  {
    key: 'training-org',
    audience: 'organization',
    status: 'live',
    service: 'Security Training',
    title: 'Security Training',
    description:
      'Move into the training organization workspace for requests, quotes, readiness planning, and outcome reporting.',
    badge: 'Live',
    href: '/workspace/training/org/organization/training'
  },
  {
    key: 'pen-internal',
    audience: 'internal',
    status: 'live',
    service: 'Penetration Testing',
    title: 'Penetration Testing',
    description:
      'Run assigned pentest operations, validation tasks, and secure evidence handling in the internal portal.',
    badge: 'Live',
    href: '/workspace/pen/internal/'
  },
  {
    key: 'training-internal',
    audience: 'internal',
    status: 'live',
    service: 'Security Training',
    title: 'Security Training',
    description:
      'Move into trainer operations for delivery tracking, readiness execution, and assigned program support.',
    badge: 'Live',
    href: '/workspace/training/researcher/researcher'
  },
  {
    key: 'pen-external',
    audience: 'external',
    status: 'live',
    service: 'Penetration Testing',
    title: 'Penetration Testing',
    description:
      'Open your external pentest portal directly and continue with assigned programs without another login.',
    badge: 'Live',
    href: '/workspace/pen/external/'
  },
  {
    key: 'bug-bounty',
    audience: 'organization',
    status: 'live',
    service: 'Bug Bounty',
    title: 'Bug Bounty',
    description:
      'Create and manage scoped bug bounty programs, review vulnerability reports, and track researcher participation.',
    badge: 'Live',
    href: '/workspace/bug-bounty/'
  },
  {
    key: 'ai-redteam',
    audience: 'organization',
    status: 'live',
    service: 'AI Red Team',
    title: 'AI Red Team',
    description:
      'Launch AI red teaming engagements, define scope and model access, and review attack reports from researchers.',
    badge: 'Live',
    href: '/workspace/ai-redteam/'
  },
  {
    key: 'challenge',
    audience: 'organization',
    status: 'live',
    service: 'Challenge',
    title: 'Challenge',
    description:
      'Create time-boxed CTF challenges and campaigns, manage flag verification, and review researcher submissions.',
    badge: 'Live',
    href: '/workspace/challenge/'
  },
  {
    key: 'bug-bounty',
    audience: 'external',
    status: 'live',
    service: 'Bug Bounty',
    title: 'Bug Bounty',
    description:
      'Browse open bounty programs, join active engagements, and submit vulnerability reports for automated severity ranking.',
    badge: 'Live',
    href: '/workspace/bug-bounty/'
  },
  {
    key: 'ai-redteam',
    audience: 'external',
    status: 'live',
    service: 'AI Red Team',
    title: 'AI Red Team',
    description:
      'Join AI red teaming programs, test model safety through structured attacks, and submit findings.',
    badge: 'Live',
    href: '/workspace/ai-redteam/'
  },
  {
    key: 'challenge',
    audience: 'external',
    status: 'live',
    service: 'Challenge',
    title: 'Challenge',
    description:
      'Participate in CTF challenges, capture flags, and compete on the leaderboard.',
    badge: 'Live',
    href: '/workspace/challenge/'
  },
  {
    key: 'code-org',
    audience: 'organization',
    status: 'live',
    service: 'Code Security Review',
    title: 'Code Security Review',
    description:
      'Submit source code review requests, track approval status, and receive security findings from assigned internal reviewers.',
    badge: 'Live',
    href: '/workspace/code/'
  },
  {
    key: 'code-internal',
    audience: 'internal',
    status: 'live',
    service: 'Code Security Review',
    title: 'Code Security Review',
    description:
      'View assigned code review requests, submit security findings, and track assignment notifications.',
    badge: 'Live',
    href: '/workspace/code/'
  },
  {
    key: 'trust-org',
    audience: 'organization',
    status: 'live',
    service: 'Security Trust Center',
    title: 'Security Trust Center',
    description:
      'Manage your organization trust page content, compliance certifications, subprocessors, FAQ, and GRC controls.',
    badge: 'Live',
    href: '/workspace/trust-org/'
  },
  {
    key: 'compliance',
    audience: 'compliance_team',
    status: 'live',
    service: 'Compliance',
    title: 'Compliance & GRC Hub',
    description:
      'Manage the Trust Center, review compliance certifications, and generate audit-ready reports across all platform services.',
    badge: 'Live',
    href: '/compliance'
  },
  {
    key: 'developer',
    audience: 'developer',
    status: 'live',
    service: 'Engineering',
    title: 'Developer Security Console',
    description:
      'View vulnerability reports assigned to you, add clarification comments, and mark issues as fixed for researcher retest.',
    badge: 'Live',
    href: '/developer'
  }
];

export const roadmapWorkspaceDefinitions: WorkspaceDefinition[] = [];

type ActorKey = 'organization' | 'internal' | 'external' | 'platform_admin' | 'compliance_team' | 'developer' | 'guest';

// const liveHrefToKey = new Map(
//   liveWorkspaceDefinitions
//     .filter((item): item is WorkspaceDefinition & { href: string } => Boolean(item.href))
//     .map((item) => [item.href, item.key])
// );

function resolveActor(user: AuthUser | null | undefined): ActorKey {
  if (!user) return 'guest';
  if (user.accountType === 'platform_admin') return 'platform_admin';
  if (user.platformRole === 'compliance_team') return 'compliance_team';
  if (user.platformRole === 'developer') return 'developer';
  if (user.accountType === 'organization') return 'organization';
  return user.researcherType === 'internal' ? 'internal' : 'external';
}

export function getActorDisplayLabel(user: AuthUser | null | undefined) {
  const actor = resolveActor(user);
  if (actor === 'organization') return 'Organization';
  if (actor === 'internal') return 'Internal Researcher';
  if (actor === 'external') return 'External Researcher';
  if (actor === 'platform_admin') return 'Platform Admin';
  if (actor === 'compliance_team') return 'Compliance Team';
  if (actor === 'developer') return 'Developer';
  return 'Guest';
}

export function isApprovedForWorkspaceLaunch(user: AuthUser | null | undefined) {
  if (!user) return false;
  if (user.accountType === 'platform_admin') return false;
  if (user.platformRole === 'compliance_team' || user.platformRole === 'developer') return true;
  return ['approved', 'not_required'].includes(user.approvalStatus);
}

export function getLiveWorkspacesForUser(user: AuthUser | null | undefined) {
  const actor = resolveActor(user);
  return liveWorkspaceDefinitions.filter((item) => {
    if (actor === 'compliance_team') return item.audience === 'compliance_team';
    if (actor === 'developer') return item.audience === 'developer';
    if (actor === 'organization') return item.audience === 'organization';
    if (actor === 'internal') return item.audience === 'internal';
    if (actor === 'external') return item.audience === 'external';
    return false;
  });
}

export function getRoadmapWorkspacesForUser(user: AuthUser | null | undefined) {
  const actor = resolveActor(user);
  if (actor === 'organization') {
    return roadmapWorkspaceDefinitions;
  }
  if (actor === 'internal' || actor === 'external') {
    return roadmapWorkspaceDefinitions.filter((item) => item.key !== 'trust-center');
  }
  return [];
}

export function canAccessWorkspace(user: AuthUser | null | undefined, href: string) {
  // Find ALL workspace keys that share this href (e.g. code-org and code-external both use /workspace/code/)
  const matchingKeys = liveWorkspaceDefinitions
    .filter((item): item is WorkspaceDefinition & { href: string } => item.href === href)
    .map((item) => item.key);

  if (matchingKeys.length === 0) {
    return true;
  }

  if (!isApprovedForWorkspaceLaunch(user)) {
    return false;
  }

  return getLiveWorkspacesForUser(user).some((item) => matchingKeys.includes(item.key));
}

export function getWorkspaceCountLabel(user: AuthUser | null | undefined) {
  const liveCount = getLiveWorkspacesForUser(user).length;
  const roadmapCount = getRoadmapWorkspacesForUser(user).length;
  return {
    liveCount,
    roadmapCount
  };
}
