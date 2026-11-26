const GRC_API_BASE = '/api/grc';

export async function fetchControls() {
  const response = await fetch(`${GRC_API_BASE}/controls`);
  if (!response.ok) {
    throw new Error('Failed to fetch controls');
  }
  return response.json();
}
