INSERT INTO organizations (id, name, slug)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'Acme Corp', 'acme')
ON CONFLICT (id) DO NOTHING;

INSERT INTO disclosure_procedures (
  id, org_id, overview, scope, out_of_scope, reporting_requirements,
  severity_rules, response_timeline, legal_safe_harbor, prohibited_actions, status
) VALUES (
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000001',
  'Report security issues affecting Acme Corp systems.',
  'acme.com, api.acme.com, mobile apps',
  'third-party services, social engineering, physical attacks',
  'Provide steps to reproduce, impact, and PoC when possible.',
  'Use CVSS base score or explain severity rationale.',
  'Initial response within 5 business days.',
  'Good faith security research is authorized under this policy.',
  'No data destruction, no privacy violations, no service disruption.',
  'active'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO vdp_programs (id, org_id, procedure_id, visibility, status)
VALUES (
  '00000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002',
  'public',
  'active'
) ON CONFLICT (id) DO NOTHING;
