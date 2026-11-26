import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../auth/AuthContext';

const TRUST_BASE = '/api/security-trust';
const ANTCROWD_ORG_ID = '00000000-0000-4000-a000-000000000001';

type TrustItem = { id: string; [k: string]: unknown };
type TrustReqItem = { id: string; org_id: string; org_name: string; status: string; submitted_at: string; content: Record<string, unknown>; };

async function trustFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${TRUST_BASE}${path}`, { credentials: 'include', ...opts, headers: { 'Content-Type': 'application/json', ...(opts?.headers ?? {}) } });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

/* ── sub-components ─────────────────────────────────────────────── */

function TrustSection({ title, items, fields, apiBase, orgId, onRefresh }: {
  title: string; items: TrustItem[]; fields: { key: string; label: string; type?: string }[];
  apiBase: string; orgId: string; onRefresh: () => void;
}) {
  const [form, setForm] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const resetForm = () => { setForm({}); setEditing(null); };

  const save = async () => {
    setSaving(true); setMsg('');
    try {
      if (editing) {
        // For overview, use PUT
        if (apiBase.includes('/overview')) {
          await trustFetch(`/api/v1/overview/${orgId}`, { method: 'PUT', body: JSON.stringify({ ...form, published: true }) });
        }
      } else {
        await trustFetch(`/api/v1/${apiBase}/organizations/${orgId}/${apiBase}`, { method: 'POST', body: JSON.stringify({ ...form, published: true }) });
      }
      setMsg('Saved successfully'); resetForm(); onRefresh();
    } catch { setMsg('Save failed'); }
    setSaving(false);
  };

  const remove = async (id: string) => {
    try { await trustFetch(`/api/v1/${apiBase}/${id}`, { method: 'DELETE' }); onRefresh(); } catch { setMsg('Delete failed'); }
  };

  return (
    <div className="compliance-trust-section">
      <h3>{title}</h3>
      {items.length === 0 && <p style={{ color: '#9ca3af', fontStyle: 'italic' }}>No items yet.</p>}
      <div className="compliance-trust-items">
        {items.map(item => (
          <div key={item.id} className="compliance-trust-item">
            <div className="compliance-trust-item-body">
              {fields.map(f => (
                <div key={f.key}><span className="compliance-field-label">{f.label}:</span> <span>{String(item[f.key] ?? '—')}</span></div>
              ))}
            </div>
            <div className="compliance-trust-item-actions">
              <button onClick={() => { const populated: Record<string, string> = {}; fields.forEach(f => { populated[f.key] = String(item[f.key] ?? ''); }); setForm(populated); setEditing(item.id); }}>Edit</button>
              <button className="danger" onClick={() => remove(item.id)}>Remove</button>
            </div>
          </div>
        ))}
      </div>
      <div className="compliance-trust-form">
        {fields.map(f => (
          <div key={f.key} className="compliance-form-field">
            <label>{f.label}</label>
            {f.type === 'textarea' ? (
              <textarea value={form[f.key] ?? ''} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} rows={3} />
            ) : (
              <input value={form[f.key] ?? ''} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} />
            )}
          </div>
        ))}
        <div className="compliance-form-actions">
          <button onClick={save} disabled={saving}>{saving ? 'Saving…' : editing ? 'Update' : 'Add'}</button>
          {editing && <button onClick={resetForm}>Cancel</button>}
        </div>
        {msg && <p className={msg.includes('fail') ? 'compliance-error' : 'compliance-success'}>{msg}</p>}
      </div>
    </div>
  );
}

function OverviewSection({ overview, orgId, onRefresh }: { overview: TrustItem | null; orgId: string; onRefresh: () => void }) {
  const [form, setForm] = useState({ summary: '', security_commitment: '', contact_email: '' });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (overview) setForm({ summary: String(overview.summary ?? ''), security_commitment: String(overview.security_commitment ?? ''), contact_email: String(overview.contact_email ?? '') });
  }, [overview]);

  const save = async () => {
    setSaving(true); setMsg('');
    try {
      await trustFetch(`/api/v1/overview/${orgId}`, { method: 'PUT', body: JSON.stringify({ ...form, published: true }) });
      setMsg('Overview saved'); onRefresh();
    } catch { setMsg('Save failed'); }
    setSaving(false);
  };

  return (
    <div className="compliance-trust-section">
      <h3>Trust Overview</h3>
      <div className="compliance-trust-form">
        <div className="compliance-form-field"><label>Summary</label><textarea value={form.summary} onChange={e => setForm(p => ({ ...p, summary: e.target.value }))} rows={3} /></div>
        <div className="compliance-form-field"><label>Security Commitment</label><textarea value={form.security_commitment} onChange={e => setForm(p => ({ ...p, security_commitment: e.target.value }))} rows={3} /></div>
        <div className="compliance-form-field"><label>Contact Email</label><input value={form.contact_email} onChange={e => setForm(p => ({ ...p, contact_email: e.target.value }))} /></div>
        <button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save Overview'}</button>
        {msg && <p className={msg.includes('fail') ? 'compliance-error' : 'compliance-success'}>{msg}</p>}
      </div>
    </div>
  );
}

/* ── report exporter ────────────────────────────────────────────── */

type ServiceSummary = { service: string; programs?: number; findings?: number; resolved?: number; error?: string };

function ReportExporter() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [services, setServices] = useState<Record<string, boolean>>({ 'bug-bounty': true, 'ai-redteam': true, challenge: true, code: true, vdp: true });
  const [generating, setGenerating] = useState(false);
  const [report, setReport] = useState<ServiceSummary[] | null>(null);

  const toggle = (s: string) => setServices(p => ({ ...p, [s]: !p[s] }));

  const fetchSummary = async (service: string): Promise<ServiceSummary> => {
    const base: Record<string, string> = {
      'bug-bounty': '/api/bug-bounty/api/compliance/summary',
      'ai-redteam': '/api/ai-redteam/api/compliance/summary',
      challenge: '/api/challenge/api/compliance/summary',
      code: '/api/code/api/compliance/summary',
      vdp: '/api/vdp/compliance/summary',
    };
    const params = new URLSearchParams();
    if (startDate) params.set('start_date', startDate);
    if (endDate) params.set('end_date', endDate);
    const qs = params.toString() ? `?${params}` : '';
    try {
      const res = await fetch(base[service] + qs, { credentials: 'include' });
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json();
      if (service === 'vdp') {
        return { service, programs: data.programs ?? 0, findings: data.findings ?? 0, resolved: data.resolved ?? 0 };
      }
      return { service, programs: data.approvedPrograms ?? 0, findings: data.totalSubmissions ?? 0 };
    } catch {
      return { service, error: 'Service unreachable' };
    }
  };

  const generate = async () => {
    setGenerating(true);
    const selected = Object.entries(services).filter(([,v]) => v).map(([k]) => k);
    const results = await Promise.all(selected.map(fetchSummary));
    setReport(results);
    setGenerating(false);
  };

  const downloadReport = () => {
    if (!report) return;
    const lines = [
      '═══════════════════════════════════════════════════════════',
      '         ANTCROWD PLATFORM — COMPLIANCE REPORT',
      '═══════════════════════════════════════════════════════════',
      `Report Period: ${startDate || 'N/A'} to ${endDate || 'N/A'}`,
      `Generated: ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`,
      '',
      '───────────────────────────────────────────────────────────',
      'SERVICE SUMMARIES',
      '───────────────────────────────────────────────────────────',
    ];
    let totalFindings = 0, totalResolved = 0, totalPrograms = 0;
    for (const s of report) {
      lines.push('');
      lines.push(`▸ ${s.service.toUpperCase()}`);
      if (s.error) { lines.push(`  Status: ${s.error}`); continue; }
      lines.push(`  Programs / Requests: ${s.programs ?? 0}`);
      lines.push(`  Findings / Submissions: ${s.findings ?? 0}`);
      if (s.resolved !== undefined) lines.push(`  Resolved: ${s.resolved}`);
      totalPrograms += s.programs ?? 0;
      totalFindings += s.findings ?? 0;
      totalResolved += s.resolved ?? 0;
    }
    lines.push('', '───────────────────────────────────────────────────────────', 'AGGREGATE', '───────────────────────────────────────────────────────────');
    lines.push(`Total Programs: ${totalPrograms}`, `Total Findings: ${totalFindings}`, `Total Resolved: ${totalResolved}`, `Coverage: ${report.filter(s => !s.error).length}/${report.length} services reporting`);
    lines.push('', '═══════════════════════════════════════════════════════════', 'END OF REPORT', '═══════════════════════════════════════════════════════════');
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `antcrowd-compliance-report-${new Date().toISOString().slice(0,10)}.txt`; a.click();
  };

  return (
    <div className="compliance-report-section">
      <h3>Compliance Report Exporter</h3>
      <p className="compliance-report-desc">Generate an audit-ready report pulling evidence from across the platform's services.</p>
      <div className="compliance-report-form">
        <div className="compliance-report-dates">
          <div className="compliance-form-field"><label>Start Date</label><input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} /></div>
          <div className="compliance-form-field"><label>End Date</label><input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} /></div>
        </div>
        <div className="compliance-report-services">
          <label className="compliance-report-services-label">Include Services:</label>
          {Object.keys(services).map(s => (
            <label key={s} className="compliance-checkbox"><input type="checkbox" checked={services[s]} onChange={() => toggle(s)} />{s.replace(/-/g, ' ')}</label>
          ))}
        </div>
        <button onClick={generate} disabled={generating}>{generating ? 'Generating…' : 'Generate Report'}</button>
      </div>
      {report && (
        <div className="compliance-report-preview">
          <h4>Report Preview</h4>
          <div className="compliance-report-cards">
            {report.map(s => (
              <div key={s.service} className={`compliance-report-card ${s.error ? 'error' : ''}`}>
                <strong>{s.service.replace(/-/g, ' ')}</strong>
                {s.error ? <span className="compliance-error">{s.error}</span> : (
                  <><span>{s.programs ?? 0} programs</span><span>{s.findings ?? 0} findings</span>{s.resolved !== undefined && <span>{s.resolved} resolved</span>}</>
                )}
              </div>
            ))}
          </div>
          <button onClick={downloadReport} className="compliance-download-btn">Download Report</button>
        </div>
      )}
    </div>
  );
}

/* ── main page ──────────────────────────────────────────────────── */

export default function ComplianceTeamPage() {
  const { user, isLoading } = useAuth();
  const [overview, setOverview] = useState<TrustItem | null>(null);
  const [compliance, setCompliance] = useState<TrustItem[]>([]);
  const [subprocessors, setSubprocessors] = useState<TrustItem[]>([]);
  const [faq, setFaq] = useState<TrustItem[]>([]);
  const [updates, setUpdates] = useState<TrustItem[]>([]);
  const [tab, setTab] = useState<'trust' | 'report' | 'requests'>('trust');
  const [trustRequests, setTrustRequests] = useState<TrustReqItem[]>([]);
  const [reqsLoading, setReqsLoading] = useState(false);
  const [reqsMsg, setReqsMsg] = useState('');
  const [expandedReq, setExpandedReq] = useState<string | null>(null);

  const isAuthorized = user && (
    user.platformRole === 'compliance_team' || 
    user.accountType === 'organization' || 
    user.accountType === 'platform_admin'
  );

  const targetOrgId = user?.accountType === 'organization' && user.organization?.id 
    ? user.organization.id 
    : ANTCROWD_ORG_ID;

  const load = useCallback(async () => {
    try {
      const [o, c, s, f, u] = await Promise.all([
        trustFetch<TrustItem>(`/api/v1/overview/${targetOrgId}`).catch(() => null),
        trustFetch<TrustItem[]>(`/api/v1/compliance/organizations/${targetOrgId}/compliance`).catch(() => []),
        trustFetch<TrustItem[]>(`/api/v1/subprocessors/organizations/${targetOrgId}/subprocessors`).catch(() => []),
        trustFetch<TrustItem[]>(`/api/v1/faq/organizations/${targetOrgId}/faq`).catch(() => []),
        trustFetch<TrustItem[]>(`/api/v1/updates/organizations/${targetOrgId}/updates`).catch(() => []),
      ]);
      setOverview(o); setCompliance(c); setSubprocessors(s); setFaq(f); setUpdates(u);
    } catch { /* ignore */ }
  }, [targetOrgId]);

  const loadTrustRequests = useCallback(async () => {
    setReqsLoading(true);
    try {
      const data = await trustFetch<TrustReqItem[]>('/api/v1/trust-requests');
      setTrustRequests(data);
    } catch { setTrustRequests([]); }
    setReqsLoading(false);
  }, []);

  useEffect(() => { if (isAuthorized) load(); }, [isAuthorized, load]);
  useEffect(() => { if (isAuthorized && tab === 'requests') loadTrustRequests(); }, [isAuthorized, tab, loadTrustRequests]);

  if (isLoading) return <div className="compliance-page"><div className="compliance-loading">Loading…</div></div>;

  if (!isAuthorized) {
    return (
      <div className="compliance-page">
        <div className="compliance-denied">
          <div className="compliance-denied-icon">🔒</div>
          <h1>Access Restricted</h1>
          <p>This area is reserved for the Compliance Team and Organization Administrators.</p>
          <a href="/" className="compliance-home-link">Return to Home</a>
        </div>
      </div>
    );
  }

  return (
    <div className="compliance-page">
      <header className="compliance-header">
        <div className="compliance-header-content">
          <div className="compliance-header-left">
            <span className="compliance-badge">Compliance Hub</span>
            <h1>Compliance & GRC Console</h1>
            <p>Welcome, {user.displayName || user.firstName}. Manage trust center content and generate audit-ready reports.</p>
          </div>
          <div className="compliance-header-right">
            <a href="/" className="compliance-nav-link">← Platform Home</a>
          </div>
        </div>
      </header>
      <nav className="compliance-tabs">
        <button className={tab === 'trust' ? 'active' : ''} onClick={() => setTab('trust')}>Trust Center Manager</button>
        <button className={tab === 'report' ? 'active' : ''} onClick={() => setTab('report')}>Report Exporter</button>
        <button className={tab === 'requests' ? 'active' : ''} onClick={() => setTab('requests')}>Org Trust Requests</button>
      </nav>
      <main className="compliance-main">
        {tab === 'trust' && (
          <div className="compliance-trust-manager">
            <OverviewSection overview={overview} orgId={targetOrgId} onRefresh={load} />
            <TrustSection title="Compliance Certifications" items={compliance} fields={[{ key: 'framework', label: 'Framework' }, { key: 'status', label: 'Status' }, { key: 'evidence_url', label: 'Evidence URL' }]} apiBase="compliance" orgId={targetOrgId} onRefresh={load} />
            <TrustSection title="Subprocessors" items={subprocessors} fields={[{ key: 'name', label: 'Name' }, { key: 'purpose', label: 'Purpose' }, { key: 'location', label: 'Location' }]} apiBase="subprocessors" orgId={targetOrgId} onRefresh={load} />
            <TrustSection title="FAQ" items={faq} fields={[{ key: 'question', label: 'Question', type: 'textarea' }, { key: 'answer', label: 'Answer', type: 'textarea' }, { key: 'order_index', label: 'Order' }]} apiBase="faq" orgId={targetOrgId} onRefresh={load} />
            <TrustSection title="Security Updates" items={updates} fields={[{ key: 'title', label: 'Title' }, { key: 'content', label: 'Content', type: 'textarea' }]} apiBase="updates" orgId={targetOrgId} onRefresh={load} />
          </div>
        )}
        {tab === 'report' && <ReportExporter />}
        {tab === 'requests' && (
          <div className="compliance-trust-manager">
            <h3 style={{ color: '#e2e8f0', marginBottom: '1rem' }}>Organization Trust Requests</h3>
            {reqsMsg && <p style={{ color: reqsMsg.includes('ailed') ? '#f87171' : '#34d399', marginBottom: '1rem' }}>{reqsMsg}</p>}
            {reqsLoading && <p style={{ color: '#9ca3af' }}>Loading…</p>}
            {!reqsLoading && trustRequests.length === 0 && <p style={{ color: '#9ca3af', fontStyle: 'italic' }}>No trust requests found.</p>}
            {trustRequests.map(req => (
              <div key={req.id} className="compliance-trust-section" style={{ marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                  <div>
                    <strong style={{ color: '#e2e8f0' }}>{req.org_name}</strong>
                    <span style={{ marginLeft: '0.75rem', fontSize: '0.75rem', color: '#9ca3af' }}>{new Date(req.submitted_at).toLocaleDateString()}</span>
                    <span style={{
                      marginLeft: '0.75rem', fontSize: '0.75rem', fontWeight: 700, borderRadius: '999px', padding: '0.15rem 0.6rem',
                      background: req.status === 'approved' ? 'rgba(16,185,129,0.15)' : req.status === 'declined' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)',
                      color: req.status === 'approved' ? '#34d399' : req.status === 'declined' ? '#f87171' : '#fbbf24',
                    }}>{req.status}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button onClick={() => setExpandedReq(expandedReq === req.id ? null : req.id)} className="btn btn-ghost" style={{ fontSize: '0.8rem' }}>
                      {expandedReq === req.id ? 'Collapse' : 'View Content'}
                    </button>
                    {req.status === 'pending' && (<>
                      <button className="btn btn-primary btn-sm" onClick={async () => {
                        try {
                          await trustFetch(`/api/v1/trust-requests/${req.id}/approve`, { method: 'PATCH' });
                          setReqsMsg(`✓ Approved trust center for ${req.org_name}`);
                          loadTrustRequests();
                        } catch { setReqsMsg('Approval failed. Please try again.'); }
                      }}>Approve</button>
                      <button className="compliance-trust-item-actions" style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '6px', padding: '0.3rem 0.8rem', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }} onClick={async () => {
                        try {
                          await trustFetch(`/api/v1/trust-requests/${req.id}/decline`, { method: 'PATCH' });
                          setReqsMsg(`Declined trust center request from ${req.org_name}.`);
                          loadTrustRequests();
                        } catch { setReqsMsg('Decline failed. Please try again.'); }
                      }}>Decline</button>
                    </>)}
                  </div>
                </div>
                {expandedReq === req.id && (
                  <div style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(15,23,42,0.6)', borderRadius: '8px', border: '1px solid #334155' }}>
                    <p style={{ color: '#94a3b8', fontSize: '0.8rem', marginBottom: '0.5rem' }}>Org ID: {req.org_id}</p>
                    {(req.content as any)?.overview && (
                      <div style={{ marginBottom: '0.75rem' }}>
                        <strong style={{ color: '#e2e8f0', fontSize: '0.85rem' }}>Overview</strong>
                        <p style={{ color: '#94a3b8', fontSize: '0.8rem', marginTop: '0.25rem' }}>{(req.content as any).overview.summary}</p>
                        {(req.content as any).overview.contact_email && <p style={{ color: '#94a3b8', fontSize: '0.8rem' }}>Contact: {(req.content as any).overview.contact_email}</p>}
                      </div>
                    )}
                    {((req.content as any)?.compliance || []).length > 0 && (
                      <div style={{ marginBottom: '0.5rem' }}>
                        <strong style={{ color: '#e2e8f0', fontSize: '0.85rem' }}>Compliance</strong>
                        {((req.content as any).compliance as any[]).map((c: any, i: number) => <p key={i} style={{ color: '#94a3b8', fontSize: '0.8rem' }}>{c.framework} — {c.status}</p>)}
                      </div>
                    )}
                    {((req.content as any)?.faq || []).length > 0 && (
                      <div style={{ marginBottom: '0.5rem' }}>
                        <strong style={{ color: '#e2e8f0', fontSize: '0.85rem' }}>FAQ ({((req.content as any).faq as any[]).length} entries)</strong>
                      </div>
                    )}
                    {((req.content as any)?.updates || []).length > 0 && (
                      <div>
                        <strong style={{ color: '#e2e8f0', fontSize: '0.85rem' }}>Security Updates ({((req.content as any).updates as any[]).length} entries)</strong>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
