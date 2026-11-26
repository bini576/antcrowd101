CREATE TABLE IF NOT EXISTS vdp_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  report_id UUID REFERENCES vdp_reports(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_vdp_notifications_org_id ON vdp_notifications(org_id);
CREATE INDEX IF NOT EXISTS idx_vdp_notifications_read_at ON vdp_notifications(read_at);
