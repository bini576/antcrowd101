import { useEffect, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';

const DEFAULT_PORTAL_URLS: Record<string, string> = {
  pen: '/workspace/pen/org/',
  'pen-org': '/workspace/pen/org/',
  'pen-admin': '/admin/',
  'pen-internal': '/workspace/pen/internal/',
  'pen-external': '/workspace/pen/external/',
  vdp: '/workspace/vdp/org/org-admin',
  'vdp-org': '/workspace/vdp/org/org-admin',
  'vdp-researcher': '/workspace/vdp/researcher',
  'vdp-admin': '/admin/vdp',
  training: '/workspace/training/org/organization/training',
  'training-org': '/workspace/training/org/organization/training',
  'training-researcher': '/workspace/training/researcher/researcher',
  'training-admin': '/admin/training',
  'bug-bounty': 'http://localhost:3002',
  challenge: 'http://localhost:3000',
  'ai-redteam': 'http://localhost:3001',
  'trust-center': '/trust',
  'trust-admin': '/workspace/trust-admin/',
  'trust-org': '/workspace/trust-org/',
  compliance: '/compliance',
  developer: '/developer'
};

function resolvePortalUrl(service: string | undefined): string {
  if (!service) return '';
  const normalized = service.trim().toLowerCase();

  if (normalized === 'pen' || normalized === 'pen-org') {
    return (
      import.meta.env.VITE_PEN_ORG_PORTAL_URL ??
      import.meta.env.VITE_PEN_PORTAL_URL ??
      DEFAULT_PORTAL_URLS['pen-org']
    ).trim();
  }
  if (normalized === 'pen-admin') {
    return (import.meta.env.VITE_PEN_ADMIN_PORTAL_URL ?? DEFAULT_PORTAL_URLS['pen-admin']).trim();
  }
  if (normalized === 'pen-internal') {
    return (import.meta.env.VITE_PEN_INTERNAL_PORTAL_URL ?? DEFAULT_PORTAL_URLS['pen-internal']).trim();
  }
  if (normalized === 'pen-external') {
    return (import.meta.env.VITE_PEN_EXTERNAL_PORTAL_URL ?? DEFAULT_PORTAL_URLS['pen-external']).trim();
  }
  if (normalized === 'vdp' || normalized === 'vdp-org') {
    return (
      import.meta.env.VITE_VDP_ORG_PORTAL_URL ??
      import.meta.env.VITE_VDP_PORTAL_URL ??
      DEFAULT_PORTAL_URLS['vdp-org']
    ).trim();
  }
  if (normalized === 'vdp-researcher' || normalized === 'vdp-hacker') {
    return (import.meta.env.VITE_VDP_RESEARCHER_PORTAL_URL ?? DEFAULT_PORTAL_URLS['vdp-researcher']).trim();
  }
  if (normalized === 'vdp-admin') {
    return (import.meta.env.VITE_VDP_ADMIN_PORTAL_URL ?? DEFAULT_PORTAL_URLS['vdp-admin']).trim();
  }
  if (normalized === 'training' || normalized === 'training-org') {
    return (
      import.meta.env.VITE_TRAINING_ORG_PORTAL_URL ??
      import.meta.env.VITE_TRAINING_PORTAL_URL ??
      DEFAULT_PORTAL_URLS['training-org']
    ).trim();
  }
  if (normalized === 'training-researcher') {
    return (
      import.meta.env.VITE_TRAINING_RESEARCHER_PORTAL_URL ?? DEFAULT_PORTAL_URLS['training-researcher']
    ).trim();
  }
  if (normalized === 'training-admin') {
    return (import.meta.env.VITE_TRAINING_ADMIN_PORTAL_URL ?? DEFAULT_PORTAL_URLS['training-admin']).trim();
  }
  if (normalized === 'bug-bounty') {
    return (import.meta.env.VITE_BUG_BOUNTY_PORTAL_URL ?? DEFAULT_PORTAL_URLS['bug-bounty']).trim();
  }
  if (normalized === 'challenge') {
    return (import.meta.env.VITE_CHALLENGE_PORTAL_URL ?? DEFAULT_PORTAL_URLS.challenge).trim();
  }
  if (normalized === 'ai-redteam') {
    return (import.meta.env.VITE_AI_REDTEAM_PORTAL_URL ?? DEFAULT_PORTAL_URLS['ai-redteam']).trim();
  }
  if (normalized === 'code' || normalized === 'code-org' || normalized === 'code-external') {
    return (import.meta.env.VITE_CODE_PORTAL_URL ?? '/workspace/code/').trim();
  }
  if (normalized === 'trust-center') {
    return (import.meta.env.VITE_TRUST_CENTER_PORTAL_URL ?? DEFAULT_PORTAL_URLS['trust-center']).trim();
  }
  if (normalized === 'trust-admin') {
    return (import.meta.env.VITE_TRUST_ADMIN_PORTAL_URL ?? DEFAULT_PORTAL_URLS['trust-admin']).trim();
  }
  if (normalized === 'trust-org') {
    return (import.meta.env.VITE_TRUST_ORG_PORTAL_URL ?? DEFAULT_PORTAL_URLS['trust-org']).trim();
  }
  if (normalized === 'compliance') {
    return DEFAULT_PORTAL_URLS.compliance;
  }
  if (normalized === 'developer') {
    return DEFAULT_PORTAL_URLS.developer;
  }

  return '';
}

export default function PlatformRedirect() {
  const { service } = useParams<{ service: string }>();
  const target = useMemo(() => resolvePortalUrl(service), [service]);

  useEffect(() => {
    if (!target) return;
    window.location.replace(target);
  }, [target]);

  if (!target) {
    return (
      <main style={{ padding: '2rem' }}>
        <h1>Platform service not found</h1>
        <p>The requested service does not exist.</p>
        <p>
          <Link to="/">Go back home</Link>
        </p>
      </main>
    );
  }

  return (
    <main style={{ padding: '2rem' }}>
      <h1>Opening workspace...</h1>
      <p>
        If redirect does not start automatically, open{' '}
        <a href={target} target="_self" rel="noreferrer">
          {target}
        </a>
        .
      </p>
    </main>
  );
}
