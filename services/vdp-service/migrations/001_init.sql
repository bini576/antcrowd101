CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS disclosure_procedures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL,
    overview TEXT NOT NULL,
    scope TEXT NOT NULL,
    out_of_scope TEXT NOT NULL,
    reporting_requirements TEXT NOT NULL,
    severity_rules TEXT NOT NULL,
    response_timeline TEXT NOT NULL,
    legal_safe_harbor TEXT NOT NULL,
    prohibited_actions TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vdp_programs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL,
    procedure_id UUID NOT NULL REFERENCES disclosure_procedures(id) ON DELETE RESTRICT,
    visibility TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vdp_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    program_id UUID NOT NULL REFERENCES vdp_programs(id) ON DELETE RESTRICT,
    hacker_id UUID NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    severity TEXT NOT NULL,
    poc TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS policy_acceptances (
    user_id UUID NOT NULL,
    procedure_id UUID NOT NULL REFERENCES disclosure_procedures(id) ON DELETE CASCADE,
    accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, procedure_id)
);

CREATE INDEX IF NOT EXISTS idx_disclosure_procedures_org_id ON disclosure_procedures(org_id);
CREATE INDEX IF NOT EXISTS idx_vdp_programs_org_id ON vdp_programs(org_id);
CREATE INDEX IF NOT EXISTS idx_vdp_programs_procedure_id ON vdp_programs(procedure_id);
CREATE INDEX IF NOT EXISTS idx_vdp_reports_program_id ON vdp_reports(program_id);
CREATE INDEX IF NOT EXISTS idx_vdp_reports_hacker_id ON vdp_reports(hacker_id);
CREATE INDEX IF NOT EXISTS idx_policy_acceptances_user_id ON policy_acceptances(user_id);
