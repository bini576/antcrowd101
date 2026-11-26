import axios from "axios";



function currentLocationHostname() {
  if (typeof window === "undefined") return "localhost";
  return window.location.hostname || "localhost";
}

function rewriteLocalhostHost(rawUrl) {
  if (typeof window === "undefined") return rawUrl;
  const currentHost = currentLocationHostname();
  if (!currentHost) return rawUrl;

  try {
    const parsed = new URL(rawUrl);
    if (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") {
      parsed.hostname = currentHost;
      return parsed.toString();
    }
  } catch {
    // Keep the original value if it is not a fully-qualified URL.
  }

  return rawUrl;
}

function buildDefaultUrl(port) {
  const protocol = typeof window === "undefined" ? "http:" : window.location.protocol || "http:";
  return `${protocol}//${currentLocationHostname()}:${port}`;
}

function resolveServiceUrl(envValue, fallback) {
  return rewriteLocalhostHost((envValue || fallback).trim());
}

export const SERVICES = {
  challenge: {
    key: "challenge",
    name: "Challenge Service",
    shortName: "Challenges",
    apiBase: resolveServiceUrl(import.meta.env.VITE_CHALLENGE_API_BASE, buildDefaultUrl(8003)),
    frontendUrl: resolveServiceUrl(import.meta.env.VITE_CHALLENGE_FRONTEND_URL, buildDefaultUrl(3000)),
    trackLabel: "Challenge Track",
    priorityLabel: "Difficulty",
    valueLabel: "points",
  },
  "ai-redteam": {
    key: "ai-redteam",
    name: "AI Red Team Service",
    shortName: "AI Red Team",
    apiBase: resolveServiceUrl(import.meta.env.VITE_AI_REDTEAM_API_BASE, buildDefaultUrl(8004)),
    frontendUrl: resolveServiceUrl(import.meta.env.VITE_AI_REDTEAM_FRONTEND_URL, buildDefaultUrl(3001)),
    trackLabel: "Attack Focus",
    priorityLabel: "Risk Level",
    valueLabel: "risk credits",
  },
  "bug-bounty": {
    key: "bug-bounty",
    name: "Bug Bounty Service",
    shortName: "Bug Bounty",
    apiBase: resolveServiceUrl(import.meta.env.VITE_BUG_BOUNTY_API_BASE, buildDefaultUrl(8005)),
    frontendUrl: resolveServiceUrl(import.meta.env.VITE_BUG_BOUNTY_FRONTEND_URL, buildDefaultUrl(3002)),
    trackLabel: "Program Type",
    priorityLabel: "Severity Band",
    valueLabel: "USD",
  },
};

export const CURRENT_SERVICE_KEY = "ai-redteam";
export const CURRENT_SERVICE = SERVICES[CURRENT_SERVICE_KEY];

const clients = Object.fromEntries(
  Object.entries(SERVICES).map(([serviceKey, config]) => [
    serviceKey,
    axios.create({
      baseURL: config.apiBase,
      withCredentials: true,
      headers: {
        "Content-Type": "application/json",
      },
    }),
  ]),
);

/**
 * Call the backend's /api/whoami endpoint to resolve the current session.
 * Returns { authenticated, role, email, displayName, username, loginUrl, logoutUrl, service }.
 */
export async function fetchWhoAmI() {
  const { data } = await clients[CURRENT_SERVICE_KEY].get("/api/whoami");
  return data;
}

export async function fetchPublicSnapshot(serviceKey) {
  const { data } = await clients[serviceKey].get("/api/public");
  return data;
}

export async function fetchDashboard(serviceKey) {
  const { data } = await clients[serviceKey].get("/api/dashboard", { withCredentials: true });
  return data;
}

export async function createProgram(serviceKey, payload) {
  const { data } = await clients[serviceKey].post("/api/programs", payload);
  return data;
}

export async function decideProgram(serviceKey, programId, payload) {
  const { data } = await clients[serviceKey].post(`/api/programs/${programId}/decision`, payload);
  return data;
}

export async function deleteProgram(serviceKey, programId, payload) {
  const { data } = await clients[serviceKey].delete(`/api/programs/${programId}`, { data: payload });
  return data;
}

export async function closeProgram(serviceKey, programId, payload) {
  const { data } = await clients[serviceKey].post(`/api/programs/${programId}/close`, payload);
  return data;
}

export async function joinProgram(serviceKey, programId) {
  const { data } = await clients[serviceKey].post(`/api/programs/${programId}/join`, {});
  return data;
}

export async function submitFinding(serviceKey, programId, payload) {
  const { data } = await clients[serviceKey].post(`/api/programs/${programId}/submissions`, payload);
  return data;
}

export async function validatePoC(payload) {
  const { data } = await clients["bug-bounty"].post("/api/validate-poc", payload);
  return data;
}

export async function scanEndpoint(payload) {
  const { data } = await clients["ai-redteam"].post("/api/scan-endpoint", payload);
  return data;
}

export async function fetchNotifications(serviceKey) {
  const { data } = await clients[serviceKey].get("/api/notifications", { withCredentials: true });
  return data;
}

export async function markNotificationRead(serviceKey, notificationId) {
  const { data } = await clients[serviceKey].post(`/api/notifications/${notificationId}/read`, {});
  return data;
}
