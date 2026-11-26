-- AntCrowd admin workspace database
-- PostgreSQL-oriented schema for:
-- frontend -> src/services/adminApi.ts -> Go admin backend -> database

BEGIN;

CREATE TABLE IF NOT EXISTS admin_roles (
  name TEXT PRIMARY KEY,
  description TEXT NOT NULL,
  scope TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_permissions (
  key TEXT PRIMARY KEY,
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_role_permissions (
  role_name TEXT NOT NULL REFERENCES admin_roles(name) ON DELETE CASCADE,
  permission_key TEXT NOT NULL REFERENCES admin_permissions(key) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (role_name, permission_key)
);

CREATE TABLE IF NOT EXISTS admin_accounts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role_name TEXT NOT NULL REFERENCES admin_roles(name),
  scope TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Active',
  mfa_required BOOLEAN NOT NULL DEFAULT FALSE,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_sessions (
  token TEXT PRIMARY KEY,
  admin_account_id TEXT NOT NULL REFERENCES admin_accounts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  ip_address TEXT,
  user_agent TEXT
);

CREATE TABLE IF NOT EXISTS trust_center_requests (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  headcount TEXT NOT NULL,
  country TEXT NOT NULL,
  hear_about TEXT,
  status TEXT NOT NULL DEFAULT 'New',
  notes TEXT,
  reviewed_by_account_id TEXT REFERENCES admin_accounts(id) ON DELETE SET NULL,
  reviewed_by_name TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS admin_users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role_label TEXT NOT NULL,
  scope TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Pending',
  mfa TEXT NOT NULL DEFAULT 'Off',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_records (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  owner TEXT NOT NULL,
  category TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Draft',
  updated_at DATE NOT NULL DEFAULT CURRENT_DATE,
  summary TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_audit_events (
  id TEXT PRIMARY KEY,
  actor_account_id TEXT REFERENCES admin_accounts(id) ON DELETE SET NULL,
  actor_name TEXT NOT NULL,
  action TEXT NOT NULL,
  target TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  details TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_accounts_role_name ON admin_accounts(role_name);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_account_id ON admin_sessions(admin_account_id);
CREATE INDEX IF NOT EXISTS idx_requests_status ON trust_center_requests(status);
CREATE INDEX IF NOT EXISTS idx_requests_reviewed_by ON trust_center_requests(reviewed_by_account_id);
CREATE INDEX IF NOT EXISTS idx_admin_users_role_label ON admin_users(role_label);
CREATE INDEX IF NOT EXISTS idx_admin_records_status ON admin_records(status);
CREATE INDEX IF NOT EXISTS idx_admin_audit_occurred_at ON admin_audit_events(occurred_at DESC);

INSERT INTO admin_roles (name, description, scope, priority) VALUES
  ('Platform Admin', 'Full-system oversight across tenants, auth, records, and audit trails.', 'Global', 100),
  ('Compliance / GRC', 'Evidence, policy workflow, control review, and audit readiness.', 'Trust Center', 80),
  ('Developer / Engineering', 'Operational visibility into incidents, technical records, integrations, and logs.', 'Product Engineering', 70),
  ('Client Owner', 'Tenant-level access for organization owners and admins.', 'Client Account', 60),
  ('Researcher', 'Research operations access for program participation and reporting.', 'Research Ops', 50)
ON CONFLICT (name) DO NOTHING;

INSERT INTO admin_permissions (key, description) VALUES
  ('manage_requests', 'Review and update trust center submissions.'),
  ('manage_users', 'Create, update, and delete managed users.'),
  ('manage_records', 'Create, update, and delete records and evidence.'),
  ('view_audit', 'Read the audit trail.'),
  ('manage_auth', 'Manage admin sign-in and session lifecycle.'),
  ('manage_roles', 'Assign and maintain access roles.'),
  ('export_evidence', 'Export trust center and compliance evidence.'),
  ('view_overview', 'View dashboard and workspace summary.'),
  ('manage_orgs', 'Operate organization-level access and membership.'),
  ('manage_research_ops', 'Operate researcher-related workflows.')
ON CONFLICT (key) DO NOTHING;

INSERT INTO admin_role_permissions (role_name, permission_key) VALUES
  ('Platform Admin', 'manage_requests'),
  ('Platform Admin', 'manage_users'),
  ('Platform Admin', 'manage_records'),
  ('Platform Admin', 'view_audit'),
  ('Platform Admin', 'manage_auth'),
  ('Platform Admin', 'manage_roles'),
  ('Platform Admin', 'export_evidence'),
  ('Platform Admin', 'view_overview'),
  ('Platform Admin', 'manage_orgs'),
  ('Platform Admin', 'manage_research_ops'),
  ('Compliance / GRC', 'manage_requests'),
  ('Compliance / GRC', 'manage_records'),
  ('Compliance / GRC', 'view_audit'),
  ('Compliance / GRC', 'export_evidence'),
  ('Compliance / GRC', 'view_overview'),
  ('Developer / Engineering', 'manage_records'),
  ('Developer / Engineering', 'view_audit'),
  ('Developer / Engineering', 'view_overview'),
  ('Client Owner', 'manage_requests'),
  ('Client Owner', 'manage_orgs'),
  ('Client Owner', 'view_overview'),
  ('Researcher', 'manage_research_ops'),
  ('Researcher', 'view_overview')
ON CONFLICT DO NOTHING;

INSERT INTO admin_accounts (
  id, name, email, password_hash, role_name, scope, status, mfa_required, last_login_at
) VALUES
  ('acct-platform', 'Platform Admin', 'admin@antcrowd.com', 'REPLACE_WITH_BCRYPT_HASH', 'Platform Admin', 'Global', 'Active', TRUE, NULL),
  ('acct-grc', 'GRC Lead', 'grc@antcrowd.com', 'REPLACE_WITH_BCRYPT_HASH', 'Compliance / GRC', 'Trust Center', 'Active', TRUE, NULL),
  ('acct-eng', 'Engineering Lead', 'eng@antcrowd.com', 'REPLACE_WITH_BCRYPT_HASH', 'Developer / Engineering', 'Product Engineering', 'Active', TRUE, NULL),
  ('acct-owner', 'Acme Owner', 'owner@acme.com', 'REPLACE_WITH_BCRYPT_HASH', 'Client Owner', 'Acme Health', 'Active', FALSE, NULL),
  ('acct-researcher', 'Research Ops', 'researcher@antcrowd.com', 'REPLACE_WITH_BCRYPT_HASH', 'Researcher', 'Research Ops', 'Active', TRUE, NULL)
ON CONFLICT (email) DO NOTHING;

INSERT INTO admin_users (id, name, email, role_label, scope, status, mfa) VALUES
  ('user-001', 'Amina Tesfaye', 'amina@acme.co', 'Client Owner', 'Acme Health', 'Active', 'Enabled'),
  ('user-002', 'Lucas Grant', 'lucas@antcrowd.com', 'Platform Admin', 'Global', 'Active', 'Required'),
  ('user-003', 'Meklit T.', 'meklit.researcher@antcrowd.com', 'Internal Researcher', 'Bug Bounty', 'Active', 'Enabled'),
  ('user-004', 'Nadia Hussain', 'nadia@vendor.net', 'External Researcher', 'VDP', 'Pending', 'Enabled'),
  ('user-005', 'Sofia Mendez', 'sofia@antcrowd.com', 'Compliance / GRC', 'Trust Center', 'Suspended', 'Required')
ON CONFLICT (email) DO NOTHING;

INSERT INTO admin_records (id, title, owner, category, status, updated_at, summary) VALUES
  ('record-001', 'Security questionnaire export', 'Compliance / GRC', 'Trust Center', 'Published', DATE '2026-04-10', 'Customer-facing evidence bundle.'),
  ('record-002', 'Org access review log', 'Platform Admin', 'Identity', 'In review', DATE '2026-04-12', 'Quarterly access attestation.'),
  ('record-003', 'Researcher payout ledger', 'Finance Ops', 'Payments', 'Draft', DATE '2026-04-13', 'Pending payout reconciliation.'),
  ('record-004', 'Incident response evidence', 'Developer / Engineering', 'Operations', 'Archived', DATE '2026-04-02', 'Post-incident analysis reference.')
ON CONFLICT (id) DO NOTHING;

INSERT INTO trust_center_requests (
  id, email, headcount, country, hear_about, status, notes, reviewed_by_account_id, reviewed_by_name, submitted_at, updated_at, ip_address
) VALUES
  ('req-001', 'ops@acme.co', '51-200', 'ethiopia', NULL, 'New', NULL, NULL, NULL, NOW() - INTERVAL '2 hours', NOW() - INTERVAL '2 hours', '127.0.0.1'),
  ('req-002', 'security@northwind.io', '201-1000', 'kenya', NULL, 'Reviewed', 'Requested NDA follow-up.', 'acct-platform', 'Lucas Grant', NOW() - INTERVAL '24 hours', NOW() - INTERVAL '24 hours', '127.0.0.1')
ON CONFLICT (id) DO NOTHING;

INSERT INTO admin_audit_events (
  id, actor_account_id, actor_name, action, target, entity_type, entity_id, details, occurred_at
) VALUES
  ('audit-001', 'acct-platform', 'Lucas Grant', 'Revoked stale token', 'org/acme-health', 'organization', 'org-acme-health', NULL, NOW() - INTERVAL '2 minutes'),
  ('audit-002', 'acct-grc', 'Sofia Mendez', 'Exported evidence pack', 'trust-center', 'record', 'record-001', NULL, NOW() - INTERVAL '18 minutes'),
  ('audit-003', 'acct-researcher', 'Nadia Hussain', 'Submitted vulnerability report', 'report #8421', 'report', 'report-8421', NULL, NOW() - INTERVAL '1 hour'),
  ('audit-004', 'acct-owner', 'Amina Tesfaye', 'Updated org owners', 'Acme Health', 'organization', 'org-acme-health', NULL, NOW() - INTERVAL '4 hours')
ON CONFLICT (id) DO NOTHING;

COMMIT;
