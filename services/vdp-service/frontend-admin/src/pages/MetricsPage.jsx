import { useEffect, useMemo, useState } from "react";
import { EmptyState, LoadingCard, MiniBarList, SeverityBadge } from "../components/AdminUI";
import { getOrgMetrics, listOrgReports } from "../services/api";

function hours(seconds) {
  if (!seconds) return "-";
  return `${Math.round(Number(seconds) / 3600)}h`;
}

export default function MetricsPage() {
  const [metrics, setMetrics] = useState(null);
  const [reportList, setReportList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [metricData, reports] = await Promise.all([
        getOrgMetrics(),
        listOrgReports({}),
      ]);
      setMetrics(metricData);
      setReportList(reports || []);
    } catch (e) {
      setError(e?.response?.data?.error || e?.response?.data?.detail || "Failed to load metrics");
    } finally {
      setLoading(false);
    }
  }

  const severityBreakdown = useMemo(() => {
    const counts = reportList.reduce((acc, report) => {
      const key = String(report.severity || "unknown").toLowerCase();
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    return [
      { label: "Critical", value: counts.critical || 0, tone: "tone-critical" },
      { label: "High", value: counts.high || 0, tone: "tone-high" },
      { label: "Medium", value: counts.medium || 0, tone: "tone-medium" },
      { label: "Low", value: counts.low || 0, tone: "tone-low" },
    ];
  }, [reportList]);

  if (loading) {
    return (
      <section className="section">
        <LoadingCard label="Loading VDP metrics..." />
      </section>
    );
  }

  return (
    <section className="section">
      <div className="section-header">
        <div>
          <h2>Metrics</h2>
          <p className="muted">Track operational volume, SLA performance, evidence quality, and severity mix across the active disclosure program.</p>
        </div>
      </div>

      {error ? <div className="error">{error}</div> : null}

      {!metrics ? (
        <EmptyState
          icon="chart"
          title="Metrics are not ready yet"
          description="Once reports start moving through triage and resolution, this dashboard will fill with actionable VDP performance data."
        />
      ) : (
        <>
          <div className="stats-grid">
            <article className="metric-card">
              <span>Total Reports</span>
              <strong>{metrics.counts?.total ?? 0}</strong>
            </article>
            <article className="metric-card">
              <span>New</span>
              <strong>{metrics.counts?.new ?? 0}</strong>
            </article>
            <article className="metric-card">
              <span>Triaged</span>
              <strong>{metrics.counts?.triaged ?? 0}</strong>
            </article>
            <article className="metric-card">
              <span>Accepted</span>
              <strong>{metrics.counts?.accepted ?? 0}</strong>
            </article>
            <article className="metric-card">
              <span>Rejected</span>
              <strong>{metrics.counts?.rejected ?? 0}</strong>
            </article>
            <article className="metric-card">
              <span>Resolved</span>
              <strong>{metrics.counts?.resolved ?? 0}</strong>
            </article>
          </div>

          <div className="card-grid">
            <div className="card field">
              <h3>SLA Compliance</h3>
              <MiniBarList
                items={[
                  { label: "Overdue triage", value: metrics.counts?.overdue_triage ?? 0, tone: "tone-danger" },
                  { label: "Overdue resolution", value: metrics.counts?.overdue_resolution ?? 0, tone: "tone-warning" },
                  { label: "Triage on-time rate", value: Math.round(metrics.sla_compliance?.triage_on_time_rate ?? 0), tone: "tone-success" },
                  { label: "Resolution on-time rate", value: Math.round(metrics.sla_compliance?.resolution_on_time_rate ?? 0), tone: "tone-success" },
                ]}
                formatter={(value) => `${value}${value > 100 ? "" : value === 0 ? "" : value <= 100 ? "%" : ""}`}
              />
            </div>

            <div className="card field">
              <h3>Response Timing</h3>
              <div className="stats-grid compact-grid">
                <article className="metric-card">
                  <span>MTTA</span>
                  <strong>{hours(metrics.mtta_seconds)}</strong>
                </article>
                <article className="metric-card">
                  <span>MTTR</span>
                  <strong>{hours(metrics.mttr_seconds)}</strong>
                </article>
                <article className="metric-card">
                  <span>Avg Evidence Score</span>
                  <strong>{Math.round(metrics.quality?.average_score ?? 0)}</strong>
                </article>
                <article className="metric-card">
                  <span>Actionable Rate</span>
                  <strong>{Math.round(metrics.outcomes?.actionable_rate ?? 0)}%</strong>
                </article>
              </div>
            </div>
          </div>

          <div className="card-grid">
            <div className="card field">
              <h3>Severity Breakdown</h3>
              <div className="severity-stack">
                {severityBreakdown.map((item) => (
                  <div key={item.label} className="severity-row">
                    <SeverityBadge severity={item.label.toLowerCase()} />
                    <strong>{item.value}</strong>
                  </div>
                ))}
              </div>
              <MiniBarList items={severityBreakdown} />
            </div>

            <div className="card field">
              <h3>Outcome Snapshot</h3>
              <MiniBarList
                items={[
                  { label: "Needs Info", value: metrics.counts?.needs_info ?? 0, tone: "tone-warning" },
                  { label: "Retesting", value: metrics.counts?.retesting ?? 0, tone: "tone-warning" },
                  { label: "Duplicate", value: metrics.counts?.duplicate ?? 0, tone: "tone-neutral" },
                  { label: "Informative", value: metrics.counts?.informative ?? 0, tone: "tone-neutral" },
                  { label: "Not Applicable", value: metrics.counts?.not_applicable ?? 0, tone: "tone-neutral" },
                  { label: "Low Quality Open", value: metrics.quality?.low_quality_open ?? 0, tone: "tone-danger" },
                ]}
              />
            </div>
          </div>
        </>
      )}
    </section>
  );
}
