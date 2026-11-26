const RETURN_TO_KEY = 'antcrowd.researcher.returnTo';

const ALLOWED_PREFIXES = ['/dashboard', '/programs', '/reports', '/inbox', '/settings', '/payments', '/invitations'];

function getWindow(): Window | null {
  if (typeof window === 'undefined') {
    return null;
  }
  return window;
}

export function isAllowedResearcherPath(path: string): boolean {
  if (!path || !path.startsWith('/')) return false;
  if (path.startsWith('//')) return false;
  if (path.includes('://')) return false;

  const pathOnly = path.split('?')[0].split('#')[0];

  for (const prefix of ALLOWED_PREFIXES) {
    if (pathOnly === prefix || pathOnly.startsWith(`${prefix}/`)) {
      return true;
    }
  }

  // Allow profile routes like /username
  if (/^\/[A-Za-z0-9_-]+$/.test(pathOnly)) {
    return true;
  }

  return false;
}

export function storeResearcherReturnTo(path: string) {
  const win = getWindow();
  if (!win) return;
  if (!isAllowedResearcherPath(path)) return;
  win.sessionStorage.setItem(RETURN_TO_KEY, path);
}

export function peekResearcherReturnTo(): string | null {
  const win = getWindow();
  if (!win) return null;
  const stored = win.sessionStorage.getItem(RETURN_TO_KEY);
  if (!stored || !isAllowedResearcherPath(stored)) {
    return null;
  }
  return stored;
}

export function consumeResearcherReturnTo(): string | null {
  const win = getWindow();
  if (!win) return null;
  const stored = win.sessionStorage.getItem(RETURN_TO_KEY);
  win.sessionStorage.removeItem(RETURN_TO_KEY);
  if (!stored || !isAllowedResearcherPath(stored)) {
    return null;
  }
  return stored;
}

export function clearResearcherReturnTo() {
  const win = getWindow();
  if (!win) return;
  win.sessionStorage.removeItem(RETURN_TO_KEY);
}

export function resolveResearcherRedirect({
  from,
  fallback = '/dashboard'
}: {
  from?: string | null;
  fallback?: string;
}) {
  const fromPath = from && isAllowedResearcherPath(from) ? from : null;
  if (fromPath) {
    clearResearcherReturnTo();
    return fromPath;
  }
  const stored = consumeResearcherReturnTo();
  return stored ?? fallback;
}
