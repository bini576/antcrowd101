export type ResearcherReputationStats = {
  averageRating: number;
  ratingCount: number;
  acceptedFindings: number;
  resolvedFindings: number;
  paidFindings: number;
  totalBounty: number;
};

export type ServiceResearcherProfile = {
  id: number;
  fullName: string;
  handle: string;
  email: string;
  isInternal: boolean;
  skills: string;
  status: string;
  phone: string;
  bio: string;
  specialization: string;
  experienceLevel: string;
  socialLinks: Record<string, string>;
  photoDataUrl: string;
  reputationStats: ResearcherReputationStats;
  submissionsCount: number;
};

export type ResearcherProfileUpdatePayload = {
  phone: string;
  bio: string;
  skills: string;
  specialization: string;
  experienceLevel: string;
  socialLinks: Record<string, string>;
};

export type TrainingProgressSummary = {
  assignedRequests: number;
  scheduledPlans: number;
  submittedReports: number;
  averageImprovement: number;
  averageAttendance: number;
  averageOrganizationRating: number;
};

type BootstrapResponse = {
  access_token?: string;
  token?: string;
  error?: string;
  detail?: string;
  message?: string;
};

type TrainingRequestRecord = {
  id: string;
  status: string;
};

type TrainingPlanRecord = {
  id: string;
};

type TrainingReportRecord = {
  id: string;
  pre_assessment_score?: number | null;
  post_assessment_score?: number | null;
  attendance_rate?: number | null;
  organization_rating?: number | null;
};

async function readErrorMessage(response: Response, fallback: string) {
  const contentType = response.headers.get('content-type') ?? '';

  if (contentType.includes('application/json')) {
    try {
      const body = (await response.clone().json()) as { error?: string; detail?: string; message?: string };
      if (typeof body.error === 'string' && body.error.trim()) return body.error;
      if (typeof body.detail === 'string' && body.detail.trim()) return body.detail;
      if (typeof body.message === 'string' && body.message.trim()) return body.message;
    } catch {
      // Ignore JSON parse failures.
    }
  }

  try {
    const text = (await response.text()).trim();
    if (text) return text;
  } catch {
    // Ignore text parse failures.
  }

  return fallback;
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

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, 'Unable to connect the service workspace.'));
  }

  const payload = (await response.json()) as BootstrapResponse;
  const token = payload.access_token ?? payload.token ?? '';
  if (!token) {
    throw new Error('The service workspace did not return an access token.');
  }
  return token;
}

async function workspaceRequest<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers ?? {});
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (init?.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(path, {
    ...init,
    headers
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Request failed for ${path}`));
  }

  return response.json() as Promise<T>;
}

async function getPenToken() {
  return bootstrapWorkspace('/api/pen-researcher/api/auth/bootstrap');
}

async function getTrainingToken() {
  return bootstrapWorkspace('/api/training/auth/bootstrap');
}

export async function fetchResearcherProfile() {
  const token = await getPenToken();
  return workspaceRequest<ServiceResearcherProfile>('/api/pen-researcher/api/researcher/profile', token);
}

export async function updateResearcherProfile(payload: ResearcherProfileUpdatePayload) {
  const token = await getPenToken();
  return workspaceRequest<ServiceResearcherProfile>('/api/pen-researcher/api/researcher/profile', token, {
    method: 'PATCH',
    body: JSON.stringify(payload)
  });
}

export async function uploadResearcherProfilePhoto(photoDataUrl: string) {
  const token = await getPenToken();
  return workspaceRequest<ServiceResearcherProfile>('/api/pen-researcher/api/researcher/profile/photo', token, {
    method: 'POST',
    body: JSON.stringify({ photoDataUrl })
  });
}

function average(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export async function fetchTrainingProgress() {
  const token = await getTrainingToken();
  const [requests, plans, reports] = await Promise.all([
    workspaceRequest<TrainingRequestRecord[]>('/api/training/training/requests', token),
    workspaceRequest<TrainingPlanRecord[]>('/api/training/training/plans', token),
    workspaceRequest<TrainingReportRecord[]>('/api/training/reports', token)
  ]);

  const improvementScores = reports.map((report) =>
    Math.max(0, Number(report.post_assessment_score ?? 0) - Number(report.pre_assessment_score ?? 0))
  );
  const attendanceScores = reports.map((report) => Number(report.attendance_rate ?? 0)).filter((value) => value > 0);
  const orgRatings = reports.map((report) => Number(report.organization_rating ?? 0)).filter((value) => value > 0);

  const summary: TrainingProgressSummary = {
    assignedRequests: requests.length,
    scheduledPlans: plans.length,
    submittedReports: reports.length,
    averageImprovement: average(improvementScores),
    averageAttendance: average(attendanceScores),
    averageOrganizationRating: average(orgRatings)
  };

  return summary;
}
