import { useMemo } from "react";
import { getStoredUser, setSession } from "../services/api";

function decodeJwtPayload(token) {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = payload.padEnd(payload.length + ((4 - (payload.length % 4)) % 4), "=");
    return JSON.parse(window.atob(padded));
  } catch {
    return null;
  }
}

function normalizeRole(role) {
  const value = String(role || "").trim().toLowerCase();
  if (value === "organization") return "organization_admin";
  if (value === "admin") return "platform_admin";
  return value;
}

function readAndPersistSessionFromQuery() {
  const params = new URLSearchParams(window.location.search);
  const tokenFromUrl = params.get("token") || params.get("access_token");
  const roleFromUrl = normalizeRole(params.get("role"));
  const orgIdFromUrl = params.get("org_id") || params.get("organization_id");
  const tokenPayload = decodeJwtPayload(tokenFromUrl);
  const roleFromToken = normalizeRole(tokenPayload?.role);
  const orgIdFromToken = tokenPayload?.org_id || tokenPayload?.organization_id;

  if (tokenFromUrl || roleFromUrl || roleFromToken || orgIdFromUrl || orgIdFromToken) {
    const current = getStoredUser() || {};
    setSession(tokenFromUrl, {
      ...current,
      role: roleFromUrl || roleFromToken || current.role,
      organization_id: orgIdFromUrl || orgIdFromToken || current.organization_id,
    });
  }

  if (tokenFromUrl || roleFromUrl || orgIdFromUrl) {
    window.history.replaceState({}, document.title, window.location.pathname);
  }
}

export function useOrgSession() {
  readAndPersistSessionFromQuery();

  return useMemo(() => {
    const token = sessionStorage.getItem("jwt") || localStorage.getItem("jwt");
    const user = getStoredUser();
    const role = normalizeRole(sessionStorage.getItem("vdp_role") || localStorage.getItem("vdp_role") || user?.role || "");
    const orgId = sessionStorage.getItem("vdp_org_id") || localStorage.getItem("vdp_org_id") || user?.organization_id || "";

    return {
      hasSession: Boolean(token && role === "organization_admin"),
      role,
      orgId,
      user,
    };
  }, []);
}
