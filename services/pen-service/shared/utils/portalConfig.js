export function getResearcherPortalConfig() {
  const pathname = typeof window !== "undefined" ? window.location.pathname : "";
  const inferredRole = pathname.includes("/workspace/pen/internal")
    ? "researcher_internal"
    : pathname.includes("/workspace/pen/external")
      ? "researcher_external"
      : "";
  const expectedRole = import.meta.env.VITE_EXPECTED_RESEARCHER_ROLE || inferredRole;
  const portalLabel =
    import.meta.env.VITE_PORTAL_LABEL ||
    (expectedRole === "researcher_internal"
      ? "Internal"
      : expectedRole === "researcher_external"
        ? "External"
        : "Researcher");
  const loginHint =
    import.meta.env.VITE_LOGIN_HINT ||
    (expectedRole === "researcher_internal"
      ? "Use your invited internal researcher credentials."
      : "Use your researcher credentials.");
  const isInternalPortal = expectedRole === "researcher_internal";

  return {
    expectedRole,
    portalLabel,
    loginHint,
    isInternalPortal,
  };
}
