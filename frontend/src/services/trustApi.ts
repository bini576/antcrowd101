const TRUST_API_BASE = '/api/security-trust/api/v1';

export async function fetchTrustStatus() {
  const response = await fetch(`${TRUST_API_BASE}/trust-center/antcrowd`);
  if (!response.ok) {
    throw new Error('Failed to fetch trust status');
  }
  return response.json();
}
