ALTER TABLE vdp_programs
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS contact_email TEXT;

UPDATE vdp_programs p
SET
  title = COALESCE(
    NULLIF(BTRIM(p.title), ''),
    (
      SELECT NULLIF(BTRIM(o.name), '') || ' Vulnerability Disclosure Program'
      FROM organizations o
      WHERE o.id = p.org_id
    )
  ),
  description = COALESCE(
    NULLIF(BTRIM(p.description), ''),
    (
      SELECT NULLIF(BTRIM(d.overview), '')
      FROM disclosure_procedures d
      WHERE d.id = p.procedure_id
    ),
    (
      SELECT NULLIF(BTRIM(o.description), '')
      FROM organizations o
      WHERE o.id = p.org_id
    )
  ),
  contact_email = COALESCE(
    NULLIF(BTRIM(p.contact_email), ''),
    (
      SELECT NULLIF(BTRIM(o.contact_email), '')
      FROM organizations o
      WHERE o.id = p.org_id
    )
  );

UPDATE vdp_programs
SET title = 'Vulnerability Disclosure Program'
WHERE title IS NULL OR BTRIM(title) = '';

UPDATE vdp_programs
SET description = 'Security researchers may submit vulnerability findings through this program.'
WHERE description IS NULL OR BTRIM(description) = '';

WITH ranked AS (
  SELECT
    id,
    org_id,
    FIRST_VALUE(id) OVER (PARTITION BY org_id ORDER BY created_at DESC, id DESC) AS keep_id,
    ROW_NUMBER() OVER (PARTITION BY org_id ORDER BY created_at DESC, id DESC) AS rn
  FROM vdp_programs
),
relinked AS (
  UPDATE vdp_reports r
  SET program_id = ranked.keep_id
  FROM ranked
  WHERE ranked.rn > 1
    AND r.program_id = ranked.id
  RETURNING r.id
)
DELETE FROM vdp_programs p
USING ranked
WHERE ranked.rn > 1
  AND p.id = ranked.id;

DROP INDEX IF EXISTS idx_vdp_programs_org_id;
CREATE UNIQUE INDEX IF NOT EXISTS idx_vdp_programs_org_id_unique ON vdp_programs(org_id);
