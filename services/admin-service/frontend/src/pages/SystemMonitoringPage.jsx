import { useCallback, useEffect, useState } from "react";

const SERVICES = [
  { key: "auth", name: "Auth Service", url: "/api/auth/health" },
  { key: "pen", name: "Pen Service", url: "/api/pen/health" },
  { key: "vdp", name: "VDP Service", url: "/api/vdp/health" },
  { key: "training", name: "Training Service", url: "/api/training/health" },
  { key: "bug-bounty", name: "Bug Bounty", url: "/api/bug-bounty/health" },
  { key: "ai-redteam", name: "AI Red Team", url: "/api/ai-redteam/health" },
  { key: "challenge", name: "Challenges", url: "/api/challenge/health" },
  { key: "code", name: "Code Security", url: "/api/code/health" },
  { key: "trust", name: "Security Trust", url: "/api/security-trust/health" },
  { key: "grc", name: "GRC Service", url: "/api/grc/health" },
];

const REFRESH_INTERVAL = 30_000;

export default function SystemMonitoringPage() {
  const [statuses, setStatuses] = useState({});
  const [lastChecked, setLastChecked] = useState(null);

  const checkAll = useCallback(async () => {
    const results = {};
    await Promise.all(
      SERVICES.map(async (svc) => {
        try {
          const res = await fetch(svc.url, { credentials: "include", signal: AbortSignal.timeout(5000) });
          results[svc.key] = { online: res.ok, status: res.status };
        } catch {
          results[svc.key] = { online: false, status: 0 };
        }
      })
    );
    setStatuses(results);
    setLastChecked(new Date());
  }, []);

  useEffect(() => {
    checkAll();
    const interval = setInterval(checkAll, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [checkAll]);

  const onlineCount = Object.values(statuses).filter((s) => s.online).length;
  const offlineCount = Object.values(statuses).filter((s) => !s.online).length;

  return (
    <>
      <section className="org-hero">
        <div className="org-copy">
          <p className="hero-tag">Platform Operations</p>
          <h1>System Monitoring</h1>
          <p>
            Real-time health status for all platform services.
            Auto-refreshes every 30 seconds.
            {lastChecked && <span> Last checked: {lastChecked.toLocaleTimeString()}</span>}
          </p>
          <div className="badge-stack hero-badges">
            <button className="ghost" onClick={checkAll}>Refresh Now</button>
          </div>
        </div>
      </section>

      <section className="kpi-grid">
        <article className="kpi"><span>Total Services</span><strong>{SERVICES.length}</strong></article>
        <article className="kpi"><span>Online</span><strong style={{ color: "#34d399" }}>{onlineCount}</strong></article>
        <article className="kpi"><span>Offline</span><strong style={{ color: offlineCount > 0 ? "#f87171" : "inherit" }}>{offlineCount}</strong></article>
      </section>

      <section className="grid four">
        {SERVICES.map((svc) => {
          const status = statuses[svc.key];
          const isOnline = status?.online;
          const checked = status !== undefined;
          return (
            <article
              className="card compact-card"
              key={svc.key}
              style={{
                borderLeft: checked
                  ? `3px solid ${isOnline ? "#34d399" : "#f87171"}`
                  : "3px solid #475569",
              }}
            >
              <h3>{svc.name}</h3>
              <p className="stat" style={{ color: checked ? (isOnline ? "#34d399" : "#f87171") : "#94a3b8" }}>
                {!checked ? "Checking..." : isOnline ? "Online" : "Offline"}
              </p>
              <p className="muted">{svc.url}</p>
              {lastChecked && <p className="muted">{lastChecked.toLocaleTimeString()}</p>}
            </article>
          );
        })}
      </section>
    </>
  );
}
