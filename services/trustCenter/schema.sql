CREATE TABLE IF NOT EXISTS trust_center_requests (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  headcount TEXT NOT NULL,
  country TEXT NOT NULL,
  hear_about TEXT,
  status TEXT NOT NULL DEFAULT 'New',
  notes TEXT,
  reviewed_by_account_id TEXT,
  reviewed_by_name TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_trust_center_requests_status ON trust_center_requests(status);
CREATE INDEX IF NOT EXISTS idx_trust_center_requests_submitted_at ON trust_center_requests(submitted_at DESC);

