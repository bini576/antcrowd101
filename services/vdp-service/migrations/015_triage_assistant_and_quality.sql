ALTER TABLE vdp_reports
  ADD COLUMN IF NOT EXISTS evidence_quality_score INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS evidence_quality_grade TEXT NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS evidence_quality_flags JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS triage_assessed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS triage_model_version TEXT,
  ADD COLUMN IF NOT EXISTS triage_duplicate_of UUID REFERENCES vdp_reports(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS triage_duplicate_confidence DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS triage_suggested_severity TEXT,
  ADD COLUMN IF NOT EXISTS triage_severity_confidence DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS triage_suggested_cwe TEXT,
  ADD COLUMN IF NOT EXISTS triage_cwe_confidence DOUBLE PRECISION;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_vdp_reports_evidence_quality_grade'
  ) THEN
    ALTER TABLE vdp_reports
      ADD CONSTRAINT chk_vdp_reports_evidence_quality_grade
      CHECK (evidence_quality_grade IN ('excellent', 'good', 'fair', 'poor', 'insufficient', 'unknown'));
  END IF;
END $$;

UPDATE vdp_reports
SET evidence_quality_score = COALESCE(evidence_quality_score, 0),
    evidence_quality_grade = COALESCE(NULLIF(BTRIM(evidence_quality_grade), ''), 'unknown'),
    evidence_quality_flags = COALESCE(evidence_quality_flags, '[]'::jsonb)
WHERE evidence_quality_grade IS NULL
   OR evidence_quality_flags IS NULL;

CREATE TABLE IF NOT EXISTS vdp_report_triage_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES vdp_reports(id) ON DELETE CASCADE,
  org_id UUID NOT NULL,
  model_version TEXT NOT NULL,
  duplicate_of UUID REFERENCES vdp_reports(id) ON DELETE SET NULL,
  duplicate_confidence DOUBLE PRECISION NOT NULL DEFAULT 0,
  suggested_severity TEXT NOT NULL,
  severity_confidence DOUBLE PRECISION NOT NULL DEFAULT 0,
  suggested_cwe TEXT,
  cwe_confidence DOUBLE PRECISION NOT NULL DEFAULT 0,
  reasoning TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vdp_triage_assessments_report_created
  ON vdp_report_triage_assessments(report_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vdp_triage_assessments_org_created
  ON vdp_report_triage_assessments(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vdp_reports_quality_score
  ON vdp_reports(evidence_quality_score);
