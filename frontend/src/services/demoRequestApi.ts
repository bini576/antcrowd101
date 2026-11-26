const trustCenterApiBaseRaw = import.meta.env.VITE_TRUST_CENTER_API_BASE_URL ?? '';
const TRUST_CENTER_API_BASE_URL = trustCenterApiBaseRaw.trim().replace(/\/$/, '');
const TRUST_CENTER_FORM_ENDPOINT = TRUST_CENTER_API_BASE_URL
  ? `${TRUST_CENTER_API_BASE_URL}/api/trust-center/request-demo`
  : '/api/trust-center/request-demo';

export const DEMO_REQUEST_SUBMIT_ERROR =
  'Unable to send your request to the AntCrowd sales and support intake right now. Please try again shortly.';

export type DemoRequestPayload = {
  email: string;
  headcount: string;
  country: string;
  hearAbout: string;
};

export function getDemoRequestNetworkErrorMessage() {
  if (!import.meta.env.DEV) {
    return DEMO_REQUEST_SUBMIT_ERROR;
  }

  const apiOrigin = TRUST_CENTER_API_BASE_URL || '/api/trust-center';
  return `Unable to reach the Trust Center intake service at ${apiOrigin}. Make sure the Trust Center backend or dev proxy is running, then try again.`;
}

export async function parseDemoRequestResponseError(response: Response): Promise<string | null> {
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    try {
      const body = (await response.clone().json()) as {
        detail?: string | string[] | Array<{ message?: string }>;
        message?: string;
        error?: string;
      };
      if (typeof body.detail === 'string') {
        return body.detail;
      }
      if (Array.isArray(body.detail)) {
        const detailText = body.detail
          .map((item) => {
            if (typeof item === 'string') return item;
            if (item && typeof item === 'object' && 'message' in item) {
              return String(item.message ?? '');
            }
            return '';
          })
          .filter(Boolean)
          .join(' ');
        if (detailText) {
          return detailText;
        }
      }
      if (typeof body.message === 'string' && body.message.trim()) {
        return body.message;
      }
      if (typeof body.error === 'string' && body.error.trim()) {
        return body.error;
      }
    } catch {
      // Fall through to text parsing below.
    }
  }

  try {
    const text = (await response.text()).trim();
    return text || null;
  } catch {
    return null;
  }
}

export async function submitDemoRequest(payload: DemoRequestPayload) {
  const response = await fetch(TRUST_CENTER_FORM_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error((await parseDemoRequestResponseError(response)) ?? DEMO_REQUEST_SUBMIT_ERROR);
  }

  return response.json().catch(() => ({}));
}
