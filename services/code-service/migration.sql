CREATE TABLE IF NOT EXISTS contact_requests (
  id SERIAL PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  company TEXT NOT NULL,
  job_title TEXT NOT NULL,
  reason TEXT NOT NULL,
  phone TEXT,
  country TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS code_review_requests (
  id SERIAL PRIMARY KEY,
  organization_email TEXT NOT NULL,
  submitted_by TEXT NOT NULL,
  repository_name TEXT NOT NULL,
  repository_url TEXT DEFAULT '',
  review_type TEXT NOT NULL,
  primary_language TEXT NOT NULL,
  description TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'pending',
  assigned_to TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS code_review_findings (
  id SERIAL PRIMARY KEY,
  request_id INTEGER NOT NULL REFERENCES code_review_requests(id),
  researcher_email TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  file_path TEXT DEFAULT '',
  line_number INTEGER DEFAULT 0,
  severity TEXT NOT NULL DEFAULT 'medium',
  category TEXT NOT NULL DEFAULT 'Other',
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS code_notifications (
  id SERIAL PRIMARY KEY,
  user_email TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'info',
  read BOOLEAN NOT NULL DEFAULT FALSE,
  reference_id INTEGER DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE code_review_requests ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE code_review_requests ADD COLUMN IF NOT EXISTS end_date DATE;
ALTER TABLE code_review_findings ADD COLUMN IF NOT EXISTS developer_tag VARCHAR(50);

