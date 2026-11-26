import type { AuthUser } from '../auth/types';
import { getLiveWorkspacesForUser } from './workspaceAccess';

export type WorkspaceSignal = {
  label: string;
  value: string;
  detail: string;
};

export type WorkspaceSummaryCard = {
  title: string;
  value: string;
  detail: string;
  service: string;
  tone?: 'default' | 'success' | 'warning';
};

export type WorkspaceActivityItem = {
  id: string;
  service: string;
  title: string;
  detail: string;
  occurredAt?: string | null;
};

export type WorkspaceOverview = {
  signals: WorkspaceSignal[];
  summaryCards: WorkspaceSummaryCard[];
  activity: WorkspaceActivityItem[];
  attentionItems: string[];
  serviceErrors: string[];
};

const emptyOverview: WorkspaceOverview = {
  signals: [],
  summaryCards: [],
  activity: [],
  attentionItems: [],
  serviceErrors: []
};

type PenDashboardResponse = {
  openEngagements?: number;
  highCriticalFindings?: number;
  readyForRetest?: number;
  internalResearchersActive?: number;
  externalResearchersActive?: number;
};

type PenMetricsResponse = {
  findingsTotal?: number;
  slaBreached?: number;
  openPrograms?: number;
  closedPrograms?: number;
  mttaHours?: number;
  mttrHours?: number;
};

type PenNotification = {
  id: number | string;
  title?: string;
  message?: string;
  createdAt?: string;
  read?: boolean;
};

type PenResearcherEarnings = {
  totalEarned?: number;
  pendingPayouts?: number;
  paidHistory?: Array<{ id?: string | number }>;
};

type PenResearcherNotification = {
  id: number | string;
  title?: string;
  message?: string;
  createdAt?: string;
};

type VdpMetricsResponse = {
  counts?: {
    total?: number;
    new?: number;
    triaged?: number;
    accepted?: number;
    resolved?: number;
    overdue_triage?: number;
    overdue_resolution?: number;
  };
  sla_compliance?: {
    triage_on_time_rate?: number;
    resolution_on_time_rate?: number;
  };
  quality?: {
    average_score?: number;
  };
};

type VdpNotification = {
  id: string | number;
  title?: string;
  message?: string;
  created_at?: string;
  createdAt?: string;
};

type TrainingRequest = {
  id: string;
  status?: string;
  created_at?: string;
  organization_name?: string;
  package_type?: string;
  preferred_date?: string;
};

type TrainingPlan = {
  id: string;
  request_id?: string;
  start_date?: string;
  end_date?: string;
};

type TrainingReport = {
  id: string;
  training_plan_id?: string;
  created_at?: string;
  summary?: string;
};

type GrcSummary = {
  controls?: number;
  risks?: number;
  frameworks?: number;
};

async function parseJson<T>(response: Response): Promise<T> {
  return response.json() as Promise<T>;
}

async function bootstrapWorkspace(path: string) {
  const response = await fetch(path, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({})
  });

  const body: { access_token?: string; token?: string; error?: string; detail?: string } = await parseJson<{
    access_token?: string;
    token?: string;
    error?: string;
    detail?: string;
  }>(response).catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error || body.detail || `Unable to connect (${response.status})`);
  }

  return body.access_token || body.token || '';
}

async function requestWithBearer<T>(path: string, token: string) {
  const response = await fetch(path, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  const body = await parseJson<T & { error?: string; detail?: string }>(response).catch(() => ({} as T & { error?: string; detail?: string }));
  if (!response.ok) {
    throw new Error((body as { error?: string; detail?: string }).error || (body as { detail?: string }).detail || `Request failed (${response.status})`);
  }
  return body as T;
}

function activityDateValue(value?: string | null) {
  if (!value) return 0;
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function sortActivity(items: WorkspaceActivityItem[]) {
  return [...items].sort((left, right) => activityDateValue(right.occurredAt) - activityDateValue(left.occurredAt)).slice(0, 8);
}

function asCurrency(value: number | undefined) {
  return `${Number(value ?? 0).toLocaleString()} ETB`;
}

function actorKey(user: AuthUser) {
  if (user.accountType === 'organization') return 'organization';
  return user.researcherType === 'internal' ? 'internal' : 'external';
}

async function loadOrganizationOverview(): Promise<WorkspaceOverview> {
  const serviceErrors: string[] = [];

  const [penResult, vdpResult, trainingResult, codeResult, grcResult] = await Promise.allSettled([
    (async () => {
      const token = await bootstrapWorkspace('/api/pen/api/auth/bootstrap');
      const [dashboard, metrics, notifications] = await Promise.all([
        requestWithBearer<PenDashboardResponse>('/api/pen/api/dashboard', token),
        requestWithBearer<PenMetricsResponse>('/api/pen/api/metrics', token),
        requestWithBearer<PenNotification[]>('/api/pen/api/notifications', token).catch(() => [])
      ]);
      return { dashboard, metrics, notifications };
    })(),
    (async () => {
      const token = await bootstrapWorkspace('/api/vdp/auth/bootstrap');
      const [metrics, notifications] = await Promise.all([
        requestWithBearer<VdpMetricsResponse>('/api/vdp/org/metrics', token),
        requestWithBearer<VdpNotification[]>('/api/vdp/org/notifications', token).catch(() => [])
      ]);
      return { metrics, notifications };
    })(),
    (async () => {
      const token = await bootstrapWorkspace('/api/training/auth/bootstrap');
      const [requests, plans, reports, quotes, invoices] = await Promise.all([
        requestWithBearer<TrainingRequest[]>('/api/training/training/requests', token).catch(() => []),
        requestWithBearer<TrainingPlan[]>('/api/training/training/plans', token).catch(() => []),
        requestWithBearer<TrainingReport[]>('/api/training/reports', token).catch(() => []),
        requestWithBearer<Array<{ id: string; status?: string }>>('/api/training/commercial/quotes', token).catch(() => []),
        requestWithBearer<Array<{ id: string; payment_verification_status?: string; status?: string }>>(
          '/api/training/commercial/invoices',
          token
        ).catch(() => [])
      ]);
      return { requests, plans, reports, quotes, invoices };
    })(),
    (async () => {
      const token = await bootstrapWorkspace('/api/code/api/auth/bootstrap');
      const [dashboard, notifications] = await Promise.all([
        requestWithBearer<{ metrics?: Array<{ label: string; value: number }>; notifications?: Array<{ id: number; title?: string; message?: string; created_at?: string }> }>('/api/code/api/dashboard', token),
        requestWithBearer<Array<{ id: number; title?: string; message?: string; created_at?: string }>>('/api/code/api/notifications', token).catch(() => [])
      ]);
      return { dashboard, notifications };
    })(),
    (async () => {
      const token = await bootstrapWorkspace('/api/grc/api/v1/auth/platform/bootstrap');
      const summary = await requestWithBearer<GrcSummary>('/api/grc/api/v1/summary', token);
      return { summary };
    })()
  ]);

  const pen = penResult.status === 'fulfilled' ? penResult.value : null;
  const vdp = vdpResult.status === 'fulfilled' ? vdpResult.value : null;
  const training = trainingResult.status === 'fulfilled' ? trainingResult.value : null;
  const code = codeResult.status === 'fulfilled' ? codeResult.value : null;
  const grc = grcResult.status === 'fulfilled' ? grcResult.value : null;

  const codeMetrics = code?.dashboard?.metrics ?? [];
  const codePending = codeMetrics.find((m: { label: string }) => m.label === 'Pending Review')?.value ?? codeMetrics.find((m: { label: string }) => m.label === 'Total Requests')?.value ?? 0;
  const codeActive = codeMetrics.find((m: { label: string }) => m.label === 'Active Reviews')?.value ?? 0;

  if (penResult.status === 'rejected') serviceErrors.push(`Pen Service: ${penResult.reason instanceof Error ? penResult.reason.message : 'unavailable'}`);
  if (vdpResult.status === 'rejected') serviceErrors.push(`VDP Service: ${vdpResult.reason instanceof Error ? vdpResult.reason.message : 'unavailable'}`);
  if (trainingResult.status === 'rejected') serviceErrors.push(`Training Service: ${trainingResult.reason instanceof Error ? trainingResult.reason.message : 'unavailable'}`);
  if (codeResult.status === 'rejected') serviceErrors.push(`Code Service: ${codeResult.reason instanceof Error ? codeResult.reason.message : 'unavailable'}`);
  if (grcResult.status === 'rejected') serviceErrors.push(`GRC Service: ${grcResult.reason instanceof Error ? grcResult.reason.message : 'unavailable'}`);

  const penOpenPrograms = Number(pen?.dashboard?.openEngagements ?? pen?.metrics?.openPrograms ?? 0);
  const vdpOpenReports = Number(vdp?.metrics?.counts?.total ?? 0);
  const trainingRequests = training?.requests ?? [];
  const trainingQuotes = training?.quotes ?? [];
  const trainingInvoices = training?.invoices ?? [];
  const trainingReports = training?.reports ?? [];
  const trainingPlans = training?.plans ?? [];
  const trainingActivePrograms = trainingRequests.filter((item) => ['approved', 'scheduled'].includes(String(item.status || '').toLowerCase())).length;
  const trainingPendingDecisions = trainingQuotes.filter((item) => String(item.status || '').toLowerCase() === 'sent').length;
  const trainingPendingPayments = trainingInvoices.filter((item) => {
    const verificationStatus = String(item.payment_verification_status || '').toLowerCase();
    const invoiceStatus = String(item.status || '').toLowerCase();
    return verificationStatus === 'pending' || invoiceStatus === 'unpaid';
  }).length;

  const signals: WorkspaceSignal[] = [
    {
      label: 'Connected services',
      value: `${getLiveWorkspacesForUser({ accountType: 'organization' } as AuthUser).length} live`,
      detail: 'Pentest, VDP, and training are connected behind the same approved organization session.'
    },
    {
      label: 'Active security programs',
      value: `${penOpenPrograms + trainingActivePrograms}`,
      detail: 'Live pentest engagements plus active training programs currently managed from the platform.'
    },
    {
      label: 'VDP intake',
      value: `${vdpOpenReports}`,
      detail: 'Open disclosure reports visible to the organization VDP triage workspace.'
    },
    {
      label: 'GRC controls',
      value: `${Number(grc?.summary?.controls ?? 0)} controls`,
      detail: `${Number(grc?.summary?.risks ?? 0)} risks and ${Number(grc?.summary?.frameworks ?? 0)} frameworks tracked in the GRC workspace.`
    }
  ];

  const summaryCards: WorkspaceSummaryCard[] = [
    {
      title: 'Pentest command lane',
      value: `${penOpenPrograms} open programs`,
      detail: `${Number(pen?.metrics?.slaBreached ?? 0)} SLA breaches and ${Number(pen?.dashboard?.highCriticalFindings ?? 0)} high/critical findings currently need attention.`,
      service: 'Pen Service',
      tone: Number(pen?.metrics?.slaBreached ?? 0) > 0 ? 'warning' : 'default'
    },
    {
      title: 'VDP triage lane',
      value: `${vdpOpenReports} reports`,
      detail: `${Number(vdp?.metrics?.counts?.new ?? 0)} new, ${Number(vdp?.metrics?.counts?.triaged ?? 0)} triaged, and ${Number(vdp?.metrics?.counts?.overdue_triage ?? 0)} overdue for triage.`,
      service: 'VDP Service',
      tone: Number(vdp?.metrics?.counts?.overdue_triage ?? 0) > 0 ? 'warning' : 'default'
    },
    {
      title: 'Training delivery lane',
      value: `${trainingRequests.length} requests`,
      detail: `${trainingPendingDecisions} quotations awaiting review, ${trainingPendingPayments} payment checks in progress, and ${trainingReports.length} delivered reports.`,
      service: 'Training Service',
      tone: trainingPendingDecisions > 0 || trainingPendingPayments > 0 ? 'warning' : 'success'
    },
    {
      title: 'Code review lane',
      value: `${codePending} requests`,
      detail: `${codeActive} active reviews in progress.`,
      service: 'Code Security',
      tone: codePending > 0 ? 'warning' : 'default'
    },
    {
      title: 'GRC readiness lane',
      value: `${Number(grc?.summary?.controls ?? 0)} controls`,
      detail: `${Number(grc?.summary?.risks ?? 0)} risks and ${Number(grc?.summary?.frameworks ?? 0)} frameworks are linked to this organization.`,
      service: 'GRC Service',
      tone: Number(grc?.summary?.risks ?? 0) > 0 ? 'warning' : 'success'
    }
  ];

  const activity = sortActivity([
    ...(pen?.notifications ?? []).map((item) => ({
      id: `pen-${item.id}`,
      service: 'Pen Service',
      title: item.title || 'Pentest update',
      detail: item.message || 'A pentest event was recorded.',
      occurredAt: item.createdAt
    })),
    ...(vdp?.notifications ?? []).map((item) => ({
      id: `vdp-${item.id}`,
      service: 'VDP Service',
      title: item.title || 'VDP update',
      detail: item.message || 'A VDP report event was recorded.',
      occurredAt: item.created_at || item.createdAt
    })),
    ...trainingRequests.slice(0, 4).map((item) => ({
      id: `training-request-${item.id}`,
      service: 'Training Service',
      title: `${item.organization_name || 'Organization'} request`,
      detail: `${String(item.package_type || 'training').replace(/_/g, ' ')} request is ${String(item.status || 'requested').replace(/_/g, ' ')}.`,
      occurredAt: item.created_at
    })),
    ...trainingReports.slice(0, 2).map((item) => ({
      id: `training-report-${item.id}`,
      service: 'Training Service',
      title: 'Training report submitted',
      detail: item.summary || 'A delivery report was uploaded for review.',
      occurredAt: item.created_at
    }))
  ]);

  const attentionItems = [
    Number(pen?.metrics?.slaBreached ?? 0) > 0
      ? `${Number(pen?.metrics?.slaBreached ?? 0)} pentest findings are outside SLA and should be reviewed.`
      : null,
    Number(vdp?.metrics?.counts?.overdue_triage ?? 0) > 0
      ? `${Number(vdp?.metrics?.counts?.overdue_triage ?? 0)} VDP reports are overdue for triage.`
      : null,
    trainingPendingDecisions > 0
      ? `${trainingPendingDecisions} training quotation decisions are waiting on organization review.`
      : null,
    trainingPlans.length > 0 && trainingReports.length === 0
      ? `${trainingPlans.length} training plans are scheduled, but no completion reports have been delivered yet.`
      : null
  ].filter((item): item is string => Boolean(item));

  return {
    signals,
    summaryCards,
    activity,
    attentionItems,
    serviceErrors
  };
}

async function loadInternalOverview(): Promise<WorkspaceOverview> {
  const serviceErrors: string[] = [];

  const [penResult, trainingResult, codeResult] = await Promise.allSettled([
    (async () => {
      const token = await bootstrapWorkspace('/api/pen-researcher/api/auth/bootstrap');
      const [engagements, invitations, findings, notifications, earnings] = await Promise.all([
        requestWithBearer<Array<{ id: string; title?: string; status?: string; createdAt?: string }>>('/api/pen-researcher/api/researcher/engagements', token).catch(() => []),
        requestWithBearer<Array<{ id: string; status?: string; engagementTitle?: string; createdAt?: string }>>('/api/pen-researcher/api/researcher/invitations', token).catch(() => []),
        requestWithBearer<Array<{ id: string; title?: string; status?: string; severity?: string; createdAt?: string }>>('/api/pen-researcher/api/researcher/findings', token).catch(() => []),
        requestWithBearer<PenResearcherNotification[]>('/api/pen-researcher/api/researcher/notifications', token).catch(() => []),
        requestWithBearer<PenResearcherEarnings>('/api/pen-researcher/api/researcher/earnings', token).catch(() => ({ totalEarned: 0, pendingPayouts: 0, paidHistory: [] }))
      ]);
      return { engagements, invitations, findings, notifications, earnings };
    })(),
    (async () => {
      const token = await bootstrapWorkspace('/api/training/auth/bootstrap');
      const [requests, plans, reports] = await Promise.all([
        requestWithBearer<TrainingRequest[]>('/api/training/training/requests', token).catch(() => []),
        requestWithBearer<TrainingPlan[]>('/api/training/training/plans', token).catch(() => []),
        requestWithBearer<TrainingReport[]>('/api/training/reports', token).catch(() => [])
      ]);
      return { requests, plans, reports };
    })(),
    (async () => {
      const token = await bootstrapWorkspace('/api/code/api/auth/bootstrap');
      const [dashboard, notifications] = await Promise.all([
        requestWithBearer<{ metrics?: Array<{ label: string; value: number }>; notifications?: Array<{ id: number; title?: string; message?: string; created_at?: string }> }>('/api/code/api/dashboard', token),
        requestWithBearer<Array<{ id: number; title?: string; message?: string; created_at?: string }>>('/api/code/api/notifications', token).catch(() => [])
      ]);
      return { dashboard, notifications };
    })()
  ]);

  const pen = penResult.status === 'fulfilled' ? penResult.value : null;
  const training = trainingResult.status === 'fulfilled' ? trainingResult.value : null;
  const codeInt = codeResult.status === 'fulfilled' ? codeResult.value : null;

  if (penResult.status === 'rejected') serviceErrors.push(`Pen Service: ${penResult.reason instanceof Error ? penResult.reason.message : 'unavailable'}`);
  if (trainingResult.status === 'rejected') serviceErrors.push(`Training Service: ${trainingResult.reason instanceof Error ? trainingResult.reason.message : 'unavailable'}`);
  if (codeResult.status === 'rejected') serviceErrors.push(`Code Service: ${codeResult.reason instanceof Error ? codeResult.reason.message : 'unavailable'}`);

  const codeIntMetrics = codeInt?.dashboard?.metrics ?? [];
  const codeAssigned = codeIntMetrics.find((m: { label: string }) => m.label === 'Assigned Requests')?.value ?? 0;
  const codeFindings = codeIntMetrics.find((m: { label: string }) => m.label === 'Submitted Findings')?.value ?? 0;
  const codeUnread = (codeInt?.notifications ?? []).filter((n) => !(n as any).read).length;

  const readyToReport = Math.max(0, Number(training?.plans?.length ?? 0) - Number(training?.reports?.length ?? 0));

  return {
    signals: [
      {
        label: 'Assigned pentest tracks',
        value: `${pen?.engagements?.length ?? 0}`,
        detail: 'Internal pentest and validation engagements currently visible in your researcher workspace.'
      },
      {
        label: 'Training plans',
        value: `${training?.plans?.length ?? 0}`,
        detail: 'Scheduled training plans linked to the internal researcher training workspace.'
      },
      {
        label: 'Ready for reporting',
        value: `${readyToReport}`,
        detail: 'Training plans that still need a completion report or outcome summary.'
      }
    ],
    summaryCards: [
      {
        title: 'Pentest workload',
        value: `${pen?.findings?.length ?? 0} findings`,
        detail: `${pen?.invitations?.length ?? 0} invitations and ${pen?.notifications?.length ?? 0} recent portal notifications are available in the pentest researcher workspace.`,
        service: 'Pen Service',
        tone: (pen?.notifications?.length ?? 0) > 0 ? 'default' : 'success'
      },
      {
        title: 'Training delivery',
        value: `${training?.requests?.length ?? 0} assigned requests`,
        detail: `${training?.reports?.length ?? 0} submitted reports and ${readyToReport} plans still waiting for final reporting.`,
        service: 'Training Service',
        tone: readyToReport > 0 ? 'warning' : 'success'
      },
      {
        title: 'Researcher earnings',
        value: asCurrency(Number(pen?.earnings?.totalEarned ?? 0)),
        detail: `${asCurrency(Number(pen?.earnings?.pendingPayouts ?? 0))} is still pending payout authorization.`,
        service: 'Pen Service',
        tone: Number(pen?.earnings?.pendingPayouts ?? 0) > 0 ? 'warning' : 'success'
      },
      {
        title: 'Code review workload',
        value: `${codeAssigned} assignments`,
        detail: `${codeFindings} findings submitted across assigned code review requests.`,
        service: 'Code Security',
        tone: codeAssigned > 0 ? 'default' : 'success'
      }
    ],
    activity: sortActivity([
      ...(pen?.notifications ?? []).map((item) => ({
        id: `pen-note-${item.id}`,
        service: 'Pen Service',
        title: item.title || 'Pentest update',
        detail: item.message || 'A pentest event needs your review.',
        occurredAt: item.createdAt
      })),
      ...(training?.requests ?? []).slice(0, 4).map((item) => ({
        id: `training-request-${item.id}`,
        service: 'Training Service',
        title: 'Training request assignment',
        detail: `${item.organization_name || 'Organization'} request is ${String(item.status || 'scheduled').replace(/_/g, ' ')}.`,
        occurredAt: item.created_at
      })),
      ...(training?.reports ?? []).slice(0, 3).map((item) => ({
        id: `training-report-${item.id}`,
        service: 'Training Service',
        title: 'Training report delivered',
        detail: item.summary || 'A training report was submitted from the internal workspace.',
        occurredAt: item.created_at
      }))
    ]),
    attentionItems: [
      readyToReport > 0 ? `${readyToReport} training plans still need final delivery reports.` : null,
      (pen?.invitations?.length ?? 0) > 0 ? `${pen?.invitations?.length ?? 0} pentest invitations are waiting for a response.` : null,
      codeUnread > 0 ? `${codeUnread} unread code review assignment notifications.` : null
    ].filter((item): item is string => Boolean(item)),
    serviceErrors
  };
}

async function loadExternalOverview(): Promise<WorkspaceOverview> {
  const serviceErrors: string[] = [];

  const penResult = await Promise.allSettled([
    (async () => {
      const token = await bootstrapWorkspace('/api/pen-researcher/api/auth/bootstrap');
      const [engagements, invitations, findings, notifications, earnings] = await Promise.all([
        requestWithBearer<Array<{ id: string; title?: string; status?: string; createdAt?: string }>>('/api/pen-researcher/api/researcher/engagements', token).catch(() => []),
        requestWithBearer<Array<{ id: string; status?: string; engagementTitle?: string; createdAt?: string }>>('/api/pen-researcher/api/researcher/invitations', token).catch(() => []),
        requestWithBearer<Array<{ id: string; title?: string; status?: string; severity?: string; createdAt?: string }>>('/api/pen-researcher/api/researcher/findings', token).catch(() => []),
        requestWithBearer<PenResearcherNotification[]>('/api/pen-researcher/api/researcher/notifications', token).catch(() => []),
        requestWithBearer<PenResearcherEarnings>('/api/pen-researcher/api/researcher/earnings', token).catch(() => ({ totalEarned: 0, pendingPayouts: 0, paidHistory: [] }))
      ]);
      return { engagements, invitations, findings, notifications, earnings };
    })()
  ]);

  const pen = penResult[0].status === 'fulfilled' ? penResult[0].value : null;
  if (penResult[0].status === 'rejected') {
    serviceErrors.push(`Pen Service: ${penResult[0].reason instanceof Error ? penResult[0].reason.message : 'unavailable'}`);
  }

  const acceptedFindings = (pen?.findings ?? []).filter((item) => ['accepted', 'paid'].includes(String(item.status || '').toLowerCase())).length;

  return {
    signals: [
      {
        label: 'Live engagements',
        value: `${pen?.engagements?.length ?? 0}`,
        detail: 'Invited pentest programs currently available in the external researcher workspace.'
      },
      {
        label: 'Open invitations',
        value: `${pen?.invitations?.length ?? 0}`,
        detail: 'Program invitations waiting on your review or response.'
      },
      {
        label: 'Pending payout',
        value: asCurrency(Number(pen?.earnings?.pendingPayouts ?? 0)),
        detail: `${acceptedFindings} accepted findings are currently in the payout pipeline.`
      }
    ],
    summaryCards: [
      {
        title: 'Finding pipeline',
        value: `${pen?.findings?.length ?? 0} submissions`,
        detail: `${acceptedFindings} accepted or paid findings and ${(pen?.notifications ?? []).length} recent workspace notifications.`,
        service: 'Pen Service'
      },
      {
        title: 'Researcher earnings',
        value: asCurrency(Number(pen?.earnings?.totalEarned ?? 0)),
        detail: `${(pen?.earnings?.paidHistory ?? []).length} completed payout records are visible in the pentest workspace.`,
        service: 'Pen Service',
        tone: Number(pen?.earnings?.totalEarned ?? 0) > 0 ? 'success' : 'default'
      },
      {
        title: 'Response lane',
        value: `${(pen?.notifications ?? []).length} updates`,
        detail: 'Invitation responses, finding review decisions, and payout notices remain tied to the same researcher session.',
        service: 'Pen Service',
        tone: (pen?.notifications?.length ?? 0) > 0 ? 'warning' : 'default'
      }
    ],
    activity: sortActivity(
      (pen?.notifications ?? []).map((item) => ({
        id: `pen-note-${item.id}`,
        service: 'Pen Service',
        title: item.title || 'Pentest update',
        detail: item.message || 'A pentest event needs your attention.',
        occurredAt: item.createdAt
      }))
    ),
    attentionItems: [
      (pen?.invitations?.length ?? 0) > 0 ? `${pen?.invitations?.length ?? 0} pentest invitations still need a response.` : null,
      Number(pen?.earnings?.pendingPayouts ?? 0) > 0
        ? `${asCurrency(Number(pen?.earnings?.pendingPayouts ?? 0))} is still pending payout.`
        : null
    ].filter((item): item is string => Boolean(item)),
    serviceErrors
  };
}

async function loadComplianceOverview(): Promise<WorkspaceOverview> {
  return {
    signals: [
      { label: 'Trust Center', value: 'Active', detail: 'The AntCrowd Trust Center is published and publicly accessible.' },
      { label: 'GRC Frameworks', value: '7 tracked', detail: 'Ethiopian and ISO compliance frameworks are tracked across the platform.' },
      { label: 'Report Exporter', value: 'Ready', detail: 'Generate audit-ready reports pulling evidence from all platform services.' }
    ],
    summaryCards: [
      { title: 'Trust Center Content', value: 'Manageable', detail: 'Edit overview, compliance certifications, subprocessors, FAQ, and security updates.', service: 'Trust Service', tone: 'success' },
      { title: 'Compliance Reports', value: 'On demand', detail: 'Generate cross-service compliance reports with date filtering and service selection.', service: 'Compliance', tone: 'default' }
    ],
    activity: [],
    attentionItems: [],
    serviceErrors: []
  };
}

async function loadDeveloperOverview(): Promise<WorkspaceOverview> {
  return {
    signals: [
      { label: 'Console Status', value: 'Active', detail: 'The Developer Security Console is connected and monitoring assigned reports.' },
      { label: 'Services Monitored', value: '5', detail: 'Bug Bounty, AI Red Team, Challenge, Code Review, and VDP services are integrated.' }
    ],
    summaryCards: [
      { title: 'Assigned Reports', value: 'View Console', detail: 'Open the Developer Console to see vulnerability reports assigned to you across all services.', service: 'Engineering', tone: 'default' },
      { title: 'Actions Available', value: 'Comment & Fix', detail: 'Add clarification comments and mark issues as fixed to request researcher retest.', service: 'Engineering', tone: 'default' }
    ],
    activity: [],
    attentionItems: [],
    serviceErrors: []
  };
}

export async function loadWorkspaceOverview(user: AuthUser | null | undefined): Promise<WorkspaceOverview> {
  if (!user) {
    return emptyOverview;
  }

  // Platform role users bypass the standard approval check
  if (user.platformRole === 'compliance_team') {
    return loadComplianceOverview();
  }
  if (user.platformRole === 'developer') {
    return loadDeveloperOverview();
  }

  if (!['approved', 'not_required'].includes(user.approvalStatus)) {
    return {
      signals: [
        {
          label: 'Access state',
          value: 'Pending approval',
          detail:
            user.accountType === 'organization'
              ? 'The organization workspace will unlock after platform-admin approval.'
              : 'Researcher services unlock after identity and certification review.'
        }
      ],
      summaryCards: [],
      activity: [],
      attentionItems: [],
      serviceErrors: []
    };
  }

  const role = actorKey(user);
  if (role === 'organization') {
    return loadOrganizationOverview();
  }
  if (role === 'internal') {
    return loadInternalOverview();
  }
  return loadExternalOverview();
}
