const AUTH_API_BASE = (import.meta.env.VITE_AUTH_API_BASE_URL || "/api/auth").replace(/\/$/, "");
const AUTH_CSRF_COOKIE_NAME = (import.meta.env.VITE_AUTH_CSRF_COOKIE_NAME || "antcrowd_csrf").trim();

let csrfBootstrapPromise = null;

function readCookie(name) {
  if (typeof document === "undefined") return "";
  const parts = document.cookie ? document.cookie.split("; ") : [];
  const target = `${name}=`;
  const found = parts.find((item) => item.startsWith(target));
  if (!found) return "";
  return decodeURIComponent(found.slice(target.length));
}

async function readErrorMessage(response, fallback) {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    try {
      const payload = await response.clone().json();
      const candidates = [payload?.message, payload?.error, payload?.detail];
      const first = candidates.find((value) => typeof value === "string" && value.trim());
      if (first) return first;
      if (Array.isArray(payload?.detail) && payload.detail.length) {
        return payload.detail.join(" ");
      }
    } catch {
      // ignore JSON parse errors
    }
  }

  try {
    const text = (await response.text()).trim();
    if (text) return text;
  } catch {
    // ignore text read failures
  }

  return fallback;
}

async function ensureCsrfToken() {
  const existing = readCookie(AUTH_CSRF_COOKIE_NAME);
  if (existing) return existing;

  if (!csrfBootstrapPromise) {
    csrfBootstrapPromise = fetch(`${AUTH_API_BASE}/csrf`, {
      credentials: "include",
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(await readErrorMessage(response, "Unable to initialize secure admin session."));
        }
        const payload = await response.json().catch(() => ({}));
        return payload?.csrfToken || readCookie(AUTH_CSRF_COOKIE_NAME);
      })
      .finally(() => {
        csrfBootstrapPromise = null;
      });
  }

  return csrfBootstrapPromise;
}

async function request(path, options = {}) {
  const method = String(options.method || "GET").toUpperCase();
  const headers = new Headers(options.headers || {});
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;

  if (!isFormData && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
    const csrfToken = await ensureCsrfToken();
    if (csrfToken && !headers.has("X-CSRF-Token")) {
      headers.set("X-CSRF-Token", csrfToken);
    }
  }

  let response;
  try {
    response = await fetch(`${AUTH_API_BASE}${path}`, {
      credentials: "include",
      ...options,
      headers,
    });
  } catch {
    throw new Error("Auth service is unavailable right now.");
  }

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Auth request failed."));
  }

  if (response.status === 204) return null;
  return response.json();
}

export const authAdminApi = {
  bootstrapCsrf: ensureCsrfToken,
  login: (email, password, rememberMe = true) =>
    request("/login", {
      method: "POST",
      body: JSON.stringify({ email, password, rememberMe }),
    }),
  me: () => request("/me"),
  logout: () =>
    request("/logout", {
      method: "POST",
    }),
  getPlatformOverview: () => request("/platform/overview"),
  createResearcherInvitation: ({ email, fullName, researcherType = "internal", notes = "" }) =>
    request("/platform/researcher-invitations", {
      method: "POST",
      body: JSON.stringify({ email, fullName, researcherType, notes }),
    }),
  listResearcherVerifications: () => request("/platform/researcher-verifications"),
  listPlatformOrganizations: () => request("/platform/organizations"),
  reviewResearcherVerification: (userId, status, reviewerNotes = "") =>
    request(`/platform/researcher-verifications/${encodeURIComponent(userId)}/review`, {
      method: "POST",
      body: JSON.stringify({ status, reviewerNotes }),
    }),
  reviewOrganizationApproval: (organizationId, status, reviewerNotes = "") =>
    request(`/platform/organizations/${encodeURIComponent(organizationId)}/review`, {
      method: "POST",
      body: JSON.stringify({ status, reviewerNotes }),
    }),
  getFeedback: () => request("/platform/feedback"),
};
