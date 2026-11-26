ALTER TABLE vdp_report_attachments
  ADD COLUMN IF NOT EXISTS checksum_sha256 TEXT;

CREATE INDEX IF NOT EXISTS idx_vdp_report_attachments_checksum ON vdp_report_attachments(checksum_sha256);
CREATE UNIQUE INDEX IF NOT EXISTS ux_vdp_report_attachments_report_email_checksum
  ON vdp_report_attachments(report_id, uploaded_by_email, checksum_sha256)
  WHERE checksum_sha256 IS NOT NULL;

UPDATE vdp_report_attachments
SET checksum_sha256 = encode(digest(object_key || ':' || filename || ':' || size_bytes::text, 'sha256'), 'hex')
WHERE checksum_sha256 IS NULL;
