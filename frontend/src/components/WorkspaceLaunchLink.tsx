import { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { canAccessWorkspace, getActorDisplayLabel } from '../services/workspaceAccess';

type WorkspaceLaunchLinkProps = {
  href: string;
  className?: string;
  children: React.ReactNode;
};

type WorkspaceBootstrapResponse = {
  access_token?: string;
  token?: string;
  user?: {
    email?: string;
    role?: string;
    organization_id?: string;
    org_id?: string;
  };
  error?: string;
  detail?: string;
  message?: string;
};

const WORKSPACE_BOOTSTRAP_PATHS: Record<string, string> = {
  '/workspace/pen/org/': '/api/pen/api/auth/bootstrap',
  '/workspace/pen/internal/': '/api/pen-researcher/api/auth/bootstrap',
  '/workspace/pen/external/': '/api/pen-researcher/api/auth/bootstrap',
  '/workspace/vdp/org/': '/api/vdp/auth/bootstrap',
  '/workspace/vdp/org/org-admin': '/api/vdp/auth/bootstrap',
  '/workspace/training/org/': '/api/training/auth/bootstrap',
  '/workspace/training/org/organization/training': '/api/training/auth/bootstrap',
  '/workspace/training/researcher/': '/api/training/auth/bootstrap',
  '/workspace/training/researcher/researcher': '/api/training/auth/bootstrap',
  '/workspace/bug-bounty/': '/api/bug-bounty/api/auth/bootstrap',
  '/workspace/ai-redteam/': '/api/ai-redteam/api/auth/bootstrap',
  '/workspace/challenge/': '/api/challenge/api/auth/bootstrap',
  '/workspace/code/': '/api/code/api/auth/bootstrap',
  '/workspace/trust-admin/': '/api/security-trust/api/auth/bootstrap',
  '/workspace/trust-org/': '/api/security-trust/api/auth/bootstrap'
};

function renderLoadingShell(popup: Window) {
  popup.document.write(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Opening AntCrowd workspace...</title>
    <style>
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background:
          radial-gradient(circle at 12% 0%, rgba(249, 115, 22, 0.22), transparent 24%),
          radial-gradient(circle at 88% 0%, rgba(34, 197, 94, 0.12), transparent 24%),
          linear-gradient(180deg, #0a0f1c 0%, #0f172a 52%, #111827 100%);
        color: #e2e8f0;
        font-family: Manrope, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      main {
        width: min(92vw, 32rem);
        padding: 2.2rem;
        border: 1px solid rgba(148, 163, 184, 0.22);
        border-radius: 1.75rem;
        background: linear-gradient(180deg, rgba(15, 23, 42, 0.86), rgba(15, 23, 42, 0.72));
        box-shadow: 0 30px 90px rgba(2, 6, 23, 0.55);
        backdrop-filter: blur(16px);
      }
      .eyebrow {
        margin: 0 0 0.75rem;
        font-size: 0.72rem;
        font-weight: 700;
        letter-spacing: 0.24em;
        text-transform: uppercase;
        color: #fb923c;
      }
      h1 {
        margin: 0;
        font-size: 2rem;
        line-height: 1.08;
      }
      p {
        margin: 0.9rem 0 0;
        color: #94a3b8;
        line-height: 1.7;
      }
      .status {
        margin-top: 1.4rem;
        display: inline-flex;
        align-items: center;
        gap: 0.65rem;
        border-radius: 999px;
        padding: 0.7rem 1rem;
        background: rgba(249, 115, 22, 0.12);
        border: 1px solid rgba(249, 115, 22, 0.28);
        color: #fdba74;
        font-size: 0.9rem;
        font-weight: 700;
      }
      .dot {
        width: 0.7rem;
        height: 0.7rem;
        border-radius: 999px;
        background: #22c55e;
        box-shadow: 0 0 0 0.35rem rgba(34, 197, 94, 0.18);
      }
    </style>
  </head>
  <body>
    <main>
      <p class="eyebrow">AntCrowd Workspace</p>
      <h1>Connecting your secure session</h1>
      <p>We are preparing the service workspace and handing off your verified platform session.</p>
      <div class="status"><span class="dot"></span>Secure bootstrap in progress</div>
    </main>
  </body>
</html>`);
  popup.document.close();
}

function renderErrorShell(popup: Window, {
  title,
  message
}: {
  title: string;
  message: string;
}) {
  popup.document.write(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${title}</title>
    <style>
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background:
          radial-gradient(circle at 12% 0%, rgba(249, 115, 22, 0.22), transparent 24%),
          radial-gradient(circle at 88% 0%, rgba(248, 113, 113, 0.16), transparent 24%),
          linear-gradient(180deg, #0a0f1c 0%, #0f172a 52%, #111827 100%);
        color: #e2e8f0;
        font-family: Manrope, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      main {
        width: min(92vw, 34rem);
        padding: 2.2rem;
        border: 1px solid rgba(248, 113, 113, 0.28);
        border-radius: 1.75rem;
        background: linear-gradient(180deg, rgba(15, 23, 42, 0.86), rgba(15, 23, 42, 0.72));
        box-shadow: 0 30px 90px rgba(2, 6, 23, 0.55);
        backdrop-filter: blur(16px);
      }
      .eyebrow {
        margin: 0 0 0.75rem;
        font-size: 0.72rem;
        font-weight: 700;
        letter-spacing: 0.24em;
        text-transform: uppercase;
        color: #fb923c;
      }
      h1 {
        margin: 0;
        font-size: 2rem;
        line-height: 1.08;
      }
      p {
        margin: 0.9rem 0 0;
        color: #94a3b8;
        line-height: 1.7;
      }
      button {
        margin-top: 1.5rem;
        border: none;
        border-radius: 999px;
        padding: 0.95rem 1.3rem;
        background: linear-gradient(135deg, #f97316, #ea580c);
        color: white;
        font: inherit;
        font-weight: 700;
        cursor: pointer;
        box-shadow: 0 18px 38px rgba(249, 115, 22, 0.22);
      }
    </style>
  </head>
  <body>
    <main>
      <p class="eyebrow">AntCrowd Workspace</p>
      <h1>${title}</h1>
      <p>${message}</p>
      <button type="button" onclick="window.close()">Close tab</button>
    </main>
  </body>
</html>`);
  popup.document.close();
}

async function requestWorkspaceBootstrap(path: string) {
  const response = await fetch(path, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({})
  });

  const contentType = response.headers.get('content-type') ?? '';
  let body: WorkspaceBootstrapResponse = {};

  if (contentType.includes('application/json')) {
    body = (await response.json().catch(() => ({}))) as WorkspaceBootstrapResponse;
  } else {
    const text = (await response.text().catch(() => '')).trim();
    if (!response.ok) {
      throw new Error(text || `Unable to open workspace (${response.status})`);
    }
  }

  if (!response.ok) {
    throw new Error(body.error || body.detail || body.message || `Unable to open workspace (${response.status})`);
  }

  return body;
}

function buildWorkspaceLaunchUrl(href: string, payload: WorkspaceBootstrapResponse, fallbackEmail: string, fallbackOrgId?: string | null) {
  const targetUrl = new URL(href, window.location.origin);
  const token = payload.access_token || payload.token;

  if (!token) {
    return targetUrl.toString();
  }

  targetUrl.searchParams.set('token', token);

  const role = payload.user?.role;
  if (role) {
    targetUrl.searchParams.set('role', role);
  }

  const email = payload.user?.email || fallbackEmail;
  if (email) {
    targetUrl.searchParams.set('email', email);
  }

  const organizationId = payload.user?.organization_id || payload.user?.org_id || fallbackOrgId;
  if (organizationId) {
    targetUrl.searchParams.set('organization_id', organizationId);
  }

  return targetUrl.toString();
}

export default function WorkspaceLaunchLink({ href, className, children }: WorkspaceLaunchLinkProps) {
  const { user } = useAuth();
  const [launching, setLaunching] = useState(false);

  async function handleClick(event: React.MouseEvent<HTMLAnchorElement>) {
    const bootstrapPath = WORKSPACE_BOOTSTRAP_PATHS[href];

    if (!bootstrapPath || launching) {
      if (launching) {
        event.preventDefault();
      }
      return;
    }

    event.preventDefault();

    if (!canAccessWorkspace(user, href)) {
      const popup = window.open('', '_blank');
      if (popup) {
        renderErrorShell(popup, {
          title: 'Workspace not assigned to this account',
          message: `${getActorDisplayLabel(user)} access does not include this workspace yet. Return to your dashboard and open one of the services assigned to your approved role.`
        });
      }
      return;
    }

    const popup = window.open('', '_blank');
    if (!popup) {
      window.location.assign(href);
      return;
    }

    renderLoadingShell(popup);
    setLaunching(true);

    try {
      const payload = await requestWorkspaceBootstrap(bootstrapPath);

      // Validate that the backend session role matches the current frontend role.
      // If they mismatch, it indicates the user session has changed in another tab,
      // so we reload the main app to refresh the dashboard/routing.
      const backendRole = payload.user?.role;
      const frontendRole = user?.accountType;
      
      const isRoleMatching = (fRole: string | undefined, bRole: string | undefined) => {
        if (!fRole || !bRole) return true;
        const f = fRole.toLowerCase();
        const b = bRole.toLowerCase();
        if (f === 'organization' && (b === 'org_admin' || b === 'organization')) return true;
        // Internal researchers receive service-specific derived roles: 'reviewer' in the
        // code service and 'trainer' in the training service. All are valid mappings.
        if (f === 'researcher' && (b === 'researcher' || b.startsWith('researcher') || b === 'reviewer' || b === 'trainer')) return true;
        if (f === 'platform_admin' && b === 'platform_admin') return true;
        return false;
      };

      if (backendRole && frontendRole && !isRoleMatching(frontendRole, backendRole)) {
        popup.close();
        window.location.reload();
        return;
      }

      const targetUrl = buildWorkspaceLaunchUrl(href, payload, user?.email ?? '', user?.organization?.id ?? null);
      popup.location.replace(targetUrl);
    } catch (error) {
      console.error(error);
      const errorMsg = error instanceof Error ? error.message : '';
      if (
        errorMsg.toLowerCase().includes('unauthorized') ||
        errorMsg.toLowerCase().includes('auth') ||
        errorMsg.toLowerCase().includes('login') ||
        errorMsg.toLowerCase().includes('authenticated')
      ) {
        popup.close();
        window.location.reload();
        return;
      }

      renderErrorShell(popup, {
        title: 'Unable to open workspace right now',
        message:
          error instanceof Error
            ? error.message
            : 'The secure session handoff did not complete. Sign in again from the main dashboard and retry.'
      });
    } finally {
      setLaunching(false);
    }
  }

  return (
    <a
      aria-busy={launching || undefined}
      className={className}
      href={href}
      onClick={handleClick}
      rel="noopener noreferrer"
      target="_blank"
    >
      {children}
    </a>
  );
}
