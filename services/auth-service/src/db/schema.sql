CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  account_type TEXT NOT NULL CHECK (account_type IN ('researcher', 'organization', 'platform_admin')),
  researcher_type TEXT NULL CHECK (researcher_type IN ('internal', 'external')),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  display_name TEXT NULL,
  job_title TEXT NULL,
  approval_status TEXT NOT NULL DEFAULT 'not_required' CHECK (approval_status IN ('not_required', 'pending_submission', 'submitted', 'approved', 'rejected')),
  invited_by_user_id TEXT NULL,
  email_verified_at TIMESTAMPTZ NULL,
  verification_token_hash TEXT NULL,
  verification_token_expires_at TIMESTAMPTZ NULL,
  verification_code_attempts INTEGER NOT NULL DEFAULT 0,
  verification_code_last_sent_at TIMESTAMPTZ NULL,
  password_reset_token_hash TEXT NULL,
  password_reset_expires_at TIMESTAMPTZ NULL,
  two_factor_secret TEXT NULL,
  two_factor_temp_secret TEXT NULL,
  two_factor_enabled_at TIMESTAMPTZ NULL,
  session_version INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_account_type_check;
ALTER TABLE users
  ADD CONSTRAINT users_account_type_check
  CHECK (account_type IN ('researcher', 'organization', 'platform_admin'));

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_approval_status_check;
ALTER TABLE users
  ADD CONSTRAINT users_approval_status_check
  CHECK (approval_status IN ('not_required', 'pending_submission', 'submitted', 'approved', 'rejected'));

ALTER TABLE users ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'not_required';
ALTER TABLE users ADD COLUMN IF NOT EXISTS invited_by_user_id TEXT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_code_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_code_last_sent_at TIMESTAMPTZ NULL;
ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_invited_by_user_id_fkey;
ALTER TABLE users
  ADD CONSTRAINT users_invited_by_user_id_fkey
  FOREIGN KEY (invited_by_user_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_otp_hash TEXT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_otp_expires_at TIMESTAMPTZ NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_otp_attempts INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  website TEXT NULL,
  billing_email TEXT NOT NULL,
  owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS organization_memberships (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'manager', 'member')),
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (organization_id, user_id)
);

CREATE TABLE IF NOT EXISTS organization_invitations (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'manager', 'member')),
  token_hash TEXT NOT NULL UNIQUE,
  invited_by_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS researcher_invitations (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  researcher_type TEXT NOT NULL CHECK (researcher_type IN ('internal', 'external')),
  token_hash TEXT NOT NULL UNIQUE,
  invited_by_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  notes TEXT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS researcher_verifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending_submission' CHECK (status IN ('pending_submission', 'submitted', 'approved', 'rejected')),
  country_of_issue TEXT NULL,
  national_id_document_name TEXT NULL,
  national_id_document_path TEXT NULL,
  certification_document_name TEXT NULL,
  certification_document_path TEXT NULL,
  certifications_summary TEXT NULL,
  reviewer_notes TEXT NULL,
  reviewed_at TIMESTAMPTZ NULL,
  reviewed_by_user_id TEXT NULL REFERENCES users(id) ON DELETE SET NULL,
  submitted_at TIMESTAMPTZ NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS auth_audit_events (
  id TEXT PRIMARY KEY,
  actor_user_id TEXT NULL REFERENCES users(id) ON DELETE SET NULL,
  target_user_id TEXT NULL REFERENCES users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  outcome TEXT NOT NULL DEFAULT 'success',
  account_type TEXT NULL,
  subject_type TEXT NOT NULL DEFAULT 'account',
  subject_id TEXT NULL,
  ip_address TEXT NULL,
  user_agent TEXT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS platform_role_assignments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform_role TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, platform_role)
);

CREATE INDEX IF NOT EXISTS idx_platform_role_assignments_user_id ON platform_role_assignments (user_id);

CREATE INDEX IF NOT EXISTS idx_users_verification_token_hash ON users (verification_token_hash);
CREATE INDEX IF NOT EXISTS idx_users_password_reset_token_hash ON users (password_reset_token_hash);
CREATE INDEX IF NOT EXISTS idx_org_invites_token_hash ON organization_invitations (token_hash);
CREATE INDEX IF NOT EXISTS idx_researcher_invites_token_hash ON researcher_invitations (token_hash);
CREATE INDEX IF NOT EXISTS idx_researcher_verifications_status ON researcher_verifications (status);
CREATE INDEX IF NOT EXISTS idx_auth_audit_events_occurred_at ON auth_audit_events (occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_audit_events_actor_user_id ON auth_audit_events (actor_user_id);

CREATE TABLE IF NOT EXISTS platform_feedback (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general' CHECK (category IN ('bug_report', 'feature_request', 'general')),
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_platform_feedback_created_at ON platform_feedback (created_at DESC);
