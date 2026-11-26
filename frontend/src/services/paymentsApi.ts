export type EarningsSummary = {
  totalEarned: number;
  availableBalance: number;
  pendingPayout: number;
  paidOut: number;
  minimumPayout: number;
};

export type ResearcherEarning = {
  id: number;
  submissionId: string;
  submissionTitle: string;
  programTitle: string;
  amount: number;
  status: string;
  createdAt: string;
};

export type PayoutRequest = {
  id: number;
  amount: number;
  paymentMethod: string;
  accountDetails: Record<string, string>;
  status: string;
  adminNote: string;
  requestedAt: string;
  updatedAt: string;
};

export type PayoutRequestPayload = {
  amount: number;
  payment_method: string;
  account_details: Record<string, string>;
};

async function parseJson<T>(response: Response): Promise<T> {
  return response.json().catch(() => ({})) as Promise<T>;
}

async function request<T>(path: string, options: RequestInit = {}) {
  const response = await fetch(`/api/bug-bounty${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    ...options
  });
  const body = await parseJson<T & { detail?: string; error?: string }>(response);
  if (!response.ok) {
    throw new Error(body.detail || body.error || `Payment request failed (${response.status})`);
  }
  return body as T;
}

export async function fetchResearcherEarnings() {
  const bootstrapRes = await fetch('/api/pen-researcher/api/auth/bootstrap', {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({})
  });
  const bootstrapBody = await bootstrapRes.json().catch(() => ({}));
  if (!bootstrapRes.ok) {
    throw new Error(bootstrapBody.error || bootstrapBody.detail || `Unable to bootstrap pen-researcher session (${bootstrapRes.status})`);
  }
  const token = bootstrapBody.access_token || bootstrapBody.token || '';

  const earningsRes = await fetch('/api/pen-researcher/api/researcher/earnings', {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
  const earningsData = await earningsRes.json().catch(() => ({}));
  if (!earningsRes.ok) {
    throw new Error(earningsData.error || earningsData.detail || `Failed to fetch earnings (${earningsRes.status})`);
  }

  const paidHistory = earningsData.paidHistory || [];
  const pendingFindings = earningsData.pendingFindings || [];
  const allFindings = [...paidHistory, ...pendingFindings];

  allFindings.sort((a, b) => (b.id || 0) - (a.id || 0));

  const earnings: ResearcherEarning[] = allFindings.map((f: any) => ({
    id: f.id,
    submissionId: String(f.id),
    submissionTitle: f.title || `Finding ${f.id}`,
    programTitle: f.jobTitle || 'Penetration Testing Service',
    amount: f.bounty || 0,
    status: f.status,
    createdAt: f.createdAt || new Date().toISOString()
  }));

  const summary: EarningsSummary = {
    totalEarned: earningsData.totalEarned || 0,
    availableBalance: 0,
    pendingPayout: earningsData.pendingPayouts || 0,
    paidOut: earningsData.totalEarned || 0,
    minimumPayout: 100
  };

  return {
    summary,
    earnings,
    payoutRequests: [] as PayoutRequest[]
  };
}

export async function submitPayoutRequest(payload: PayoutRequestPayload) {
  return request<{
    summary: EarningsSummary;
    payoutRequest: PayoutRequest;
    message: string;
  }>('/api/researcher/payout-requests', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}
