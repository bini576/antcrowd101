import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../auth/AuthContext';

type ServiceReport = {
  id: string; service: string; title: string; severity: string;
  status: string; summary: string; description?: string;
  stepsToReproduce?: string; evidence?: string; assignedAt?: string;
  submittedBy?: string; tag?: string; username?: string;
};

const TAG_META: Record<string, { bg: string; label: string }> = {
  accepted:        { bg: '#22c55e', label: '✓ Accepted' },
  declined:        { bg: '#ef4444', label: '✗ Declined' },
  retest_required: { bg: '#f59e0b', label: '↺ Retest Required' },
};

const TAG_ENDPOINTS: Record<string, (id: string) => string> = {
  'Bug Bounty': id => `/api/bug-bounty/api/submissions/${id}/developer-tag`,
  'AI Red Team': id => `/api/ai-redteam/api/submissions/${id}/developer-tag`,
  'Challenge':   id => `/api/challenge/api/submissions/${id}/developer-tag`,
  'Code Review': id => `/api/code/api/findings/${id}/developer-tag`,
};

async function fetchJson<T>(url: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(url, { credentials: 'include' });
    if (!res.ok) return fallback;
    return await res.json();
  } catch { return fallback; }
}

async function loadBugBountyReports(): Promise<ServiceReport[]> {
  const dash = await fetchJson<any>('/api/bug-bounty/api/dashboard', {});
  return (Array.isArray(dash?.submissions) ? dash.submissions : []).map((s: any) => ({
    id: s.id, service: 'Bug Bounty', title: s.title,
    severity: s.severity ?? s.impact ?? 'medium', status: s.status ?? 'submitted',
    summary: s.summary ?? '', description: s.summary, evidence: s.evidence,
    assignedAt: s.createdAt, submittedBy: s.usernameLabel ?? s.username,
    tag: s.developer_tag ?? s.developerTag, username: s.username,
  }));
}

async function loadAiRedteamReports(): Promise<ServiceReport[]> {
  const dash = await fetchJson<any>('/api/ai-redteam/api/dashboard', {});
  return (Array.isArray(dash?.submissions) ? dash.submissions : []).map((s: any) => ({
    id: s.id, service: 'AI Red Team', title: s.title,
    severity: s.impact ?? 'medium', status: s.status ?? 'submitted',
    summary: s.summary ?? '', description: s.summary, evidence: s.evidence,
    assignedAt: s.createdAt, submittedBy: s.usernameLabel ?? s.username,
    tag: s.developer_tag ?? s.developerTag, username: s.username,
  }));
}

async function loadChallengeReports(): Promise<ServiceReport[]> {
  const dash = await fetchJson<any>('/api/challenge/api/dashboard', {});
  return (Array.isArray(dash?.submissions) ? dash.submissions : []).map((s: any) => ({
    id: s.id, service: 'Challenge', title: s.title,
    severity: s.impact ?? 'medium', status: s.status ?? 'validated',
    summary: s.summary ?? '', description: s.summary, evidence: s.evidence,
    assignedAt: s.createdAt, submittedBy: s.usernameLabel ?? s.username,
    tag: s.developer_tag ?? s.developerTag, username: s.username,
  }));
}

async function loadCodeReports(): Promise<ServiceReport[]> {
  const data = await fetchJson<any[]>('/api/code/api/findings', []);
  return (Array.isArray(data) ? data : []).map((f: any) => ({
    id: String(f.id), service: 'Code Review', title: f.title ?? 'Code Finding',
    severity: f.severity ?? 'medium', status: f.status ?? 'open',
    summary: f.description ?? '', description: f.description,
    assignedAt: f.created_at, submittedBy: f.researcher_email,
    tag: f.developer_tag ?? undefined, username: f.researcher_email,
  }));
}

async function loadVdpReports(): Promise<ServiceReport[]> {
  const data = await fetchJson<any>('/api/vdp/developer/reports', []);
  return (Array.isArray(data) ? data : []).map((r: any) => ({
    id: r.id, service: 'VDP', title: r.title,
    severity: r.severity ?? 'medium', status: r.status ?? 'new',
    summary: r.description ?? '', description: r.description,
    stepsToReproduce: r.steps_to_reproduce, evidence: r.poc,
    assignedAt: r.created_at, submittedBy: r.reporter_email ?? r.reporter_name,
    tag: r.developer_tag,
  }));
}

function severityColor(s: string) {
  const m: Record<string, string> = { critical: '#ef4444', high: '#f97316', medium: '#eab308', low: '#22c55e', info: '#6366f1' };
  return m[s?.toLowerCase()] ?? '#9ca3af';
}

function statusColor(s: string) {
  const m: Record<string, string> = {
    submitted: '#3b82f6', open: '#3b82f6', fixed: '#22c55e', validated: '#8b5cf6',
    resolved: '#22c55e', closed: '#6b7280', 'retest-requested': '#f59e0b',
    accepted: '#22c55e', new: '#3b82f6', acknowledged: '#a855f7',
  };
  return m[s?.toLowerCase()] ?? '#9ca3af';
}

export default function DeveloperPage() {
  const { user, isLoading } = useAuth();
  const [reports, setReports] = useState<ServiceReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [fixDesc, setFixDesc] = useState('');
  const [actionMsg, setActionMsg] = useState<Record<string, string>>({});
  const [tagging, setTagging] = useState<Record<string, boolean>>({});

  const loadAll = useCallback(async () => {
    setLoading(true);
    const results = await Promise.allSettled([
      loadBugBountyReports(), loadAiRedteamReports(), loadChallengeReports(),
      loadCodeReports(), loadVdpReports(),
    ]);
    const all: ServiceReport[] = [];
    for (const r of results) { if (r.status === 'fulfilled') all.push(...r.value); }
    setReports(all);
    setLoading(false);
  }, []);

  useEffect(() => { if (user?.platformRole === 'developer') loadAll(); }, [user, loadAll]);

  const tagReport = async (report: ServiceReport, tag: 'accepted' | 'declined' | 'retest_required') => {
    const epFn = TAG_ENDPOINTS[report.service];
    if (!epFn) return;
    const key = `${report.service}-${report.id}`;
    setTagging(p => ({ ...p, [key]: true }));
    setActionMsg(p => ({ ...p, [report.id]: 'Updating…' }));
    try {
      const res = await fetch(epFn(report.id), {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ developer_tag: tag }),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      setReports(prev => prev.map(r =>
        r.id === report.id && r.service === report.service ? { ...r, tag } : r
      ));
      setActionMsg(p => ({ ...p, [report.id]: `${TAG_META[tag].label} ✓` }));
    } catch {
      setActionMsg(p => ({ ...p, [report.id]: 'Failed to update tag' }));
    } finally {
      setTagging(p => ({ ...p, [key]: false }));
    }
  };

  const addComment = async (report: ServiceReport) => {
    if (!comment.trim()) return;
    setActionMsg(p => ({ ...p, [report.id]: 'Posting comment…' }));
    try {
      const eps: Record<string, string> = {
        'Bug Bounty': `/api/bug-bounty/api/submissions/${report.id}/comments`,
        'AI Red Team': `/api/ai-redteam/api/submissions/${report.id}/comments`,
        'Challenge':   `/api/challenge/api/submissions/${report.id}/comments`,
        'Code Review': `/api/code/api/requests/${report.id}/findings`,
        'VDP':         `/api/vdp/reports/${report.id}/comments`,
      };
      const url = eps[report.service];
      if (url) await fetch(url, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: comment, comment }) });
      setActionMsg(p => ({ ...p, [report.id]: 'Comment posted ✓' }));
      setComment('');
    } catch { setActionMsg(p => ({ ...p, [report.id]: 'Failed to post comment' })); }
  };

  const markFixed = async (report: ServiceReport) => {
    if (!fixDesc.trim()) return;
    setActionMsg(p => ({ ...p, [report.id]: 'Marking fixed…' }));
    try {
      const eps: Record<string, { url: string; method: string }> = {
        'Bug Bounty': { url: `/api/bug-bounty/api/submissions/${report.id}/status`, method: 'PUT' },
        'AI Red Team': { url: `/api/ai-redteam/api/submissions/${report.id}/status`, method: 'PUT' },
        'Challenge':   { url: `/api/challenge/api/submissions/${report.id}/status`, method: 'PUT' },
        'Code Review': { url: `/api/code/api/requests/${report.id}/findings`, method: 'POST' },
        'VDP':         { url: `/api/vdp/reports/${report.id}/status`, method: 'PATCH' },
      };
      const ep = eps[report.service];
      if (ep) await fetch(ep.url, { method: ep.method, credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'retest-requested', fix_description: fixDesc, status_reason: `Fix: ${fixDesc}` }) });
      setActionMsg(p => ({ ...p, [report.id]: 'Marked fixed — retest requested ✓' }));
      setFixDesc(''); loadAll();
    } catch { setActionMsg(p => ({ ...p, [report.id]: 'Failed to update status' })); }
  };

  if (isLoading) return <div className="developer-page"><div className="developer-loading">Loading…</div></div>;

  if (!user || user.platformRole !== 'developer') {
    return (
      <div className="developer-page">
        <div className="developer-denied">
          <div className="developer-denied-icon">🔒</div>
          <h1>Access Restricted</h1>
          <p>This area is reserved for the Developer / Engineering Team.</p>
          <a href="/" className="developer-home-link">Return to Home</a>
        </div>
      </div>
    );
  }

  return (
    <div className="developer-page">
      <header className="developer-header">
        <div className="developer-header-content">
          <div className="developer-header-left">
            <span className="developer-badge">Engineering</span>
            <h1>Developer Security Console</h1>
            <p>Welcome, {user.displayName || user.firstName}. Review and act on all platform vulnerability reports.</p>
          </div>
          <div className="developer-header-right">
            <a href="/" className="developer-nav-link">← Platform Home</a>
          </div>
        </div>
      </header>

      <main className="developer-main">
        {loading ? (
          <div className="developer-loading">Loading reports from all services…</div>
        ) : reports.length === 0 ? (
          <div className="developer-empty">
            <div className="developer-empty-icon">📋</div>
            <h2>No Reports Found</h2>
            <p>No vulnerability reports are available across any service yet.</p>
          </div>
        ) : (
          <div className="developer-reports">
            <div className="developer-reports-header">
              <h2>{reports.length} Report{reports.length !== 1 ? 's' : ''} across all services</h2>
            </div>
            <div className="developer-report-list">
              {reports.map(r => {
                const key = `${r.service}-${r.id}`;
                const isExp = expanded === key;
                const tagInfo = r.tag ? TAG_META[r.tag] : null;
                const isBusy = !!tagging[key];
                return (
                  <div key={key} className={`developer-report-item ${isExp ? 'expanded' : ''}`}>
                    <div className="developer-report-summary" onClick={() => setExpanded(isExp ? null : key)}>
                      <div className="developer-report-title">
                        <span className="developer-severity-dot" style={{ background: severityColor(r.severity) }} />
                        <span className="developer-report-name">{r.title}</span>
                      </div>
                      <div className="developer-report-meta">
                        <span className="developer-service-tag">{r.service}</span>
                        <span className="developer-severity-tag" style={{ color: severityColor(r.severity) }}>{r.severity}</span>
                        <span className="developer-status-tag" style={{ background: statusColor(r.status) }}>{r.status}</span>
                        {tagInfo && <span className="developer-dev-tag" style={{ background: tagInfo.bg }}>{tagInfo.label}</span>}
                        {r.assignedAt && <span className="developer-date">{new Date(r.assignedAt).toLocaleDateString()}</span>}
                      </div>
                      <span className="developer-expand-icon">{isExp ? '▲' : '▼'}</span>
                    </div>

                    {isExp && (
                      <div className="developer-report-details">
                        <div className="developer-detail-grid">
                          {r.submittedBy && <div><strong>Submitted by:</strong> {r.submittedBy}</div>}
                          <div><strong>Description:</strong><p>{r.description || r.summary || '—'}</p></div>
                          {r.stepsToReproduce && <div><strong>Steps to Reproduce:</strong><p>{r.stepsToReproduce}</p></div>}
                          {r.evidence && <div><strong>Evidence / PoC:</strong><p>{r.evidence}</p></div>}
                        </div>

                        {/* ── Developer Decision ── */}
                        {TAG_ENDPOINTS[r.service] && (
                          <div className="developer-tag-section">
                            <h4>Developer Review Decision</h4>
                            {tagInfo && (
                              <div className="developer-current-tag" style={{ color: tagInfo.bg }}>
                                Current decision: <strong>{tagInfo.label}</strong>
                              </div>
                            )}
                            <div className="developer-tag-buttons">
                              <button
                                className="dev-tag-btn accept"
                                disabled={isBusy || r.tag === 'accepted'}
                                onClick={() => tagReport(r, 'accepted')}
                              >✓ Accept</button>
                              <button
                                className="dev-tag-btn decline"
                                disabled={isBusy || r.tag === 'declined'}
                                onClick={() => tagReport(r, 'declined')}
                              >✗ Decline</button>
                              <button
                                className="dev-tag-btn retest"
                                disabled={isBusy || r.tag === 'retest_required'}
                                onClick={() => tagReport(r, 'retest_required')}
                              >↺ Retest Required</button>
                            </div>
                          </div>
                        )}

                        {/* ── Comments & Fix ── */}
                        <div className="developer-actions">
                          <div className="developer-action-section">
                            <h4>Add Clarification Comment</h4>
                            <textarea placeholder="Ask a question or add context…" value={comment} onChange={e => setComment(e.target.value)} rows={3} />
                            <button onClick={() => addComment(r)} disabled={!comment.trim()}>Post Comment</button>
                          </div>
                          <div className="developer-action-section">
                            <h4>Mark as Fixed &amp; Request Retest</h4>
                            <textarea placeholder="Describe what was fixed…" value={fixDesc} onChange={e => setFixDesc(e.target.value)} rows={3} />
                            <button className="developer-fix-btn" onClick={() => markFixed(r)} disabled={!fixDesc.trim()}>Mark Fixed &amp; Request Retest</button>
                          </div>
                        </div>

                        {actionMsg[r.id] && (
                          <p className={`developer-action-msg ${actionMsg[r.id].includes('✓') ? 'success' : actionMsg[r.id].includes('Failed') ? 'error' : ''}`}>
                            {actionMsg[r.id]}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
