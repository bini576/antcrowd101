ALTER TABLE vdp_reports
  ADD COLUMN IF NOT EXISTS duplicate_of UUID REFERENCES vdp_reports(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assignee_name TEXT,
  ADD COLUMN IF NOT EXISTS assignee_email TEXT,
  ADD COLUMN IF NOT EXISTS triage_due_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS resolution_due_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS needs_info_due_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_escalated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_vdp_reports_duplicate_of ON vdp_reports(duplicate_of);
CREATE INDEX IF NOT EXISTS idx_vdp_reports_assignee_email ON vdp_reports(assignee_email);
CREATE INDEX IF NOT EXISTS idx_vdp_reports_triage_due_at ON vdp_reports(triage_due_at);
CREATE INDEX IF NOT EXISTS idx_vdp_reports_resolution_due_at ON vdp_reports(resolution_due_at);
CREATE INDEX IF NOT EXISTS idx_vdp_reports_needs_info_due_at ON vdp_reports(needs_info_due_at);

UPDATE vdp_reports r
SET triage_due_at = COALESCE(
      r.triage_due_at,
      r.created_at + make_interval(hours => COALESCE(s.triage_sla_hours, 72))
    ),
    resolution_due_at = COALESCE(
      r.resolution_due_at,
      r.created_at + make_interval(days =>
        CASE r.severity
          WHEN 'critical' THEN COALESCE(s.resolution_sla_critical_days, 7)
          WHEN 'high' THEN COALESCE(s.resolution_sla_high_days, 14)
          WHEN 'medium' THEN COALESCE(s.resolution_sla_medium_days, 30)
          ELSE COALESCE(s.resolution_sla_low_days, 60)
        END
      )
    )
FROM vdp_programs p
LEFT JOIN org_vdp_settings s ON s.org_id = p.org_id
WHERE r.program_id = p.id;
