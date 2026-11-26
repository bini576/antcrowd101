BEGIN;

INSERT INTO organizations (id, name, slug, contact_email, contact_name, website, description, updated_at)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'Demo Org One', 'demo-org-one', 'security@demo1.com', 'Demo Security', 'https://demo1.com', 'Public demo VDP program', NOW()),
  ('22222222-2222-2222-2222-222222222222', 'Demo Org Two', 'demo-org-two', 'security@demo2.com', 'Demo Security', 'https://demo2.com', 'Another public demo program', NOW())
ON CONFLICT DO NOTHING;

INSERT INTO disclosure_procedures (
  id, org_id, overview, scope, out_of_scope, reporting_requirements, severity_rules, response_timeline, legal_safe_harbor, prohibited_actions, status
)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111',
   'We welcome security research and responsible disclosure.',
   'Public web apps, public APIs, mobile apps',
   'Physical attacks, social engineering, DoS',
   'Provide steps to reproduce, impact, and proof of concept when possible.',
   'Use CVSS or explain severity with business impact.',
   'Acknowledge within 5 business days and resolve within 90 days.',
   'We will not pursue legal action for good-faith research within policy.',
   'No data exfiltration or disruption of service.',
   'active'
  ),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222',
   'Report vulnerabilities responsibly.',
   'Main website and APIs',
   'Third-party services, phishing, spam',
   'Include affected asset, steps, impact, and PoC if available.',
   'Severity based on impact and exploitability.',
   'Acknowledge within 3 business days and resolve within 60 days.',
   'Safe harbor for good-faith research.',
   'No destructive testing.',
   'active'
  )
ON CONFLICT DO NOTHING;

INSERT INTO vdp_programs (id, org_id, procedure_id, visibility, status)
VALUES
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'public', 'active'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', '22222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'public', 'active')
ON CONFLICT DO NOTHING;

INSERT INTO vdp_reports (
  id, program_id, hacker_id, reporter_email, reporter_name,
  title, affected_asset, vulnerability_type, description, steps_to_reproduce, impact, severity, poc, status
)
VALUES
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'cccccccc-cccc-cccc-cccc-cccccccccccc', NULL, 'reporter@demo.com', 'Demo Reporter',
   'Reflected XSS on search', 'https://demo1.com/search', 'XSS',
   'User input is reflected without encoding.',
   '1. Visit /search?q=<script>alert(1)</script>\n2. Observe script execution.',
   'Session hijack risk.', 'medium', 'Simple PoC provided', 'triaged'
  )
ON CONFLICT DO NOTHING;

COMMIT;
