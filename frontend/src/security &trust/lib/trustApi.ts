const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api/security-trust/api/v1";
const ORG_ID = import.meta.env.VITE_ORG_ID || "00000000-0000-4000-a000-000000000001";

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
};

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: options.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!res.ok) {
    let detail = "";
    try {
      const contentType = res.headers.get("content-type") ?? "";
      if (contentType.includes("application/json")) {
        const body = (await res.json()) as { detail?: unknown };
        if (typeof body.detail === "string") {
          detail = body.detail;
        } else if (Array.isArray(body.detail)) {
          detail = body.detail
            .map((item) => (typeof item === "object" && item && "msg" in item ? String(item.msg) : ""))
            .filter(Boolean)
            .join(", ");
        }
      } else {
        const text = (await res.text()).trim();
        if (text) detail = text;
      }
    } catch {
      detail = "";
    }

    throw new Error(detail ? `Request failed (${res.status}): ${detail}` : `Request failed (${res.status})`);
  }

  return (await res.json()) as T;
}

export type TrustOverview = {
  id: string;
  summary: string;
  security_commitment?: string | null;
  contact_email?: string | null;
  published: boolean;
};

export type TrustCompliance = {
  id: string;
  framework: string;
  status?: string | null;
  evidence_url?: string | null;
  published: boolean;
};

export type TrustResource = {
  id: string;
  title: string;
  resource_type?: string | null;
  url?: string | null;
  published: boolean;
};

export type TrustUpdate = {
  id: string;
  title: string;
  content: string;
  published_at?: string | null;
  published: boolean;
};

export type TrustSubprocessor = {
  id: string;
  name: string;
  purpose?: string | null;
  location?: string | null;
  data_categories?: string | null;
  published: boolean;
};

export type TrustFaq = {
  id: string;
  question: string;
  answer: string;
  order_index: number;
  published: boolean;
};

export type TrustAccessRequestCreate = {
  full_name: string;
  email: string;
  company_name?: string | null;
  reason?: string | null;
};

export type TrustSubscriptionCreate = {
  email: string;
};

export function hasTrustApiConfig(): boolean {
  return true;
}

export function getOrgId(): string {
  return ORG_ID;
}

export async function fetchOverviews(): Promise<TrustOverview[]> {
  return request<TrustOverview[]>("/overview");
}

export async function fetchCompliance(orgId: string): Promise<TrustCompliance[]> {
  return request<TrustCompliance[]>(`/compliance/organizations/${orgId}/compliance`);
}

export async function fetchResources(orgId: string): Promise<TrustResource[]> {
  return request<TrustResource[]>(`/resources/organizations/${orgId}/resources`);
}

export async function fetchUpdates(orgId: string): Promise<TrustUpdate[]> {
  return request<TrustUpdate[]>(`/updates/organizations/${orgId}/updates`);
}

export async function fetchSubprocessors(orgId: string): Promise<TrustSubprocessor[]> {
  return request<TrustSubprocessor[]>(`/subprocessors/organizations/${orgId}/subprocessors`);
}

export async function fetchFaq(orgId: string): Promise<TrustFaq[]> {
  return request<TrustFaq[]>(`/faq/organizations/${orgId}/faq`);
}

export async function submitAccessRequest(
  orgId: string,
  payload: TrustAccessRequestCreate
): Promise<void> {
  await request(`/access-requests/organizations/${orgId}/access-requests`, {
    method: "POST",
    body: payload,
  });
}

export async function submitSubscription(
  orgId: string,
  payload: TrustSubscriptionCreate
): Promise<void> {
  await request(`/subscriptions/organizations/${orgId}/subscriptions`, {
    method: "POST",
    body: payload,
  });
}
