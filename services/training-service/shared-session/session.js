function normalizeRole(role) {
  const value = String(role || "").trim().toLowerCase();
  if (value === "admin") return "platform_admin";
  if (value === "organization") return "organization_admin";
  if (value === "trainer") return "trainer";
  return value;
}

export function getStoredToken() {
  return localStorage.getItem("access_token");
}

export function getStoredUser() {
  const raw = localStorage.getItem("auth_user");
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearSession() {
  localStorage.removeItem("access_token");
  localStorage.removeItem("auth_user");
}

export function storeSession(token, user) {
  localStorage.setItem("access_token", token);
  localStorage.setItem(
    "auth_user",
    JSON.stringify({
      ...user,
      role: normalizeRole(user?.role),
    })
  );
}

export function applySessionFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token") || params.get("access_token");

  if (token) {
    localStorage.setItem("access_token", token);
  }

  const role = normalizeRole(params.get("role"));
  const email = params.get("email");
  const organizationId = params.get("organization_id");
  const safeEmail = email && !email.includes("<") && !email.includes(">") ? email : "";

  if (role || email || organizationId) {
    const current = getStoredUser() || {};
    const next = {
      ...current,
      role: role || current.role,
      email: safeEmail || current.email,
      organization_id: organizationId || current.organization_id
    };
    localStorage.setItem("auth_user", JSON.stringify(next));
  }

  if (token || role || email || organizationId) {
    const cleanUrl = `${window.location.origin}${window.location.pathname}`;
    window.history.replaceState({}, document.title, cleanUrl);
  }
}
