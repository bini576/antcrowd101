ALTER TABLE vdp_reports ADD COLUMN IF NOT EXISTS reporter_email TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS policy_acceptances_public (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_email TEXT NOT NULL,
    procedure_id UUID NOT NULL REFERENCES disclosure_procedures(id) ON DELETE CASCADE,
    accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    accepted_ip INET
);

CREATE INDEX IF NOT EXISTS idx_policy_acceptances_public_email ON policy_acceptances_public(reporter_email);
CREATE INDEX IF NOT EXISTS idx_policy_acceptances_public_proc ON policy_acceptances_public(procedure_id);
