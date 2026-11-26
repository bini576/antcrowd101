CREATE TABLE IF NOT EXISTS vdp_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID,
  report_id UUID REFERENCES vdp_reports(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  attempt_count INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 8,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_error TEXT,
  locked_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (channel IN ('email','webhook')),
  CHECK (status IN ('pending','processing','failed','sent'))
);

CREATE INDEX IF NOT EXISTS idx_vdp_outbox_status_next_attempt ON vdp_outbox(status, next_attempt_at);
CREATE INDEX IF NOT EXISTS idx_vdp_outbox_org_id ON vdp_outbox(org_id);
CREATE INDEX IF NOT EXISTS idx_vdp_outbox_report_id ON vdp_outbox(report_id);

CREATE TABLE IF NOT EXISTS vdp_idempotency_keys (
  idempotency_key TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  scope TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  response_code INTEGER,
  response_body JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '24 hours',
  PRIMARY KEY (idempotency_key, endpoint, scope),
  CHECK (status IN ('pending', 'completed'))
);

CREATE INDEX IF NOT EXISTS idx_vdp_idempotency_expires_at ON vdp_idempotency_keys(expires_at);

DELETE FROM vdp_idempotency_keys WHERE expires_at < NOW();
