CREATE TABLE IF NOT EXISTS org_vdp_settings (
  org_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  triage_sla_hours INTEGER NOT NULL DEFAULT 72,
  resolution_sla_low_days INTEGER NOT NULL DEFAULT 60,
  resolution_sla_medium_days INTEGER NOT NULL DEFAULT 30,
  resolution_sla_high_days INTEGER NOT NULL DEFAULT 14,
  resolution_sla_critical_days INTEGER NOT NULL DEFAULT 7,
  webhook_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  webhook_url TEXT,
  webhook_secret TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (triage_sla_hours BETWEEN 1 AND 720),
  CHECK (resolution_sla_low_days BETWEEN 1 AND 365),
  CHECK (resolution_sla_medium_days BETWEEN 1 AND 365),
  CHECK (resolution_sla_high_days BETWEEN 1 AND 365),
  CHECK (resolution_sla_critical_days BETWEEN 1 AND 365)
);
