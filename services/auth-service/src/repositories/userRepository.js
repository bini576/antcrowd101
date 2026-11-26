import path from 'node:path';
import { pool, query } from '../db/pool.js';
import { generateId } from '../lib/tokens.js';
import { slugify } from '../lib/slug.js';

function mapUser(row) {
  if (!row) {
    return null;
  }

  return {
    ...row,
    organization: row.organization_id
      ? {
          id: row.organization_id,
          name: row.organization_name,
          slug: row.organization_slug,
          website: row.organization_website,
          role: row.organization_role
        }
      : null
  };
}

function mapVerification(row) {
  if (!row) {
    return null;
  }

  return {
    ...row,
    national_id_document_file: row.national_id_document_path
      ? path.basename(row.national_id_document_path)
      : null,
    certification_document_file: row.certification_document_path
      ? path.basename(row.certification_document_path)
      : null
  };
}

const baseUserSelect = `
  SELECT
    u.*,
    o.id AS organization_id,
    o.name AS organization_name,
    o.slug AS organization_slug,
    o.website AS organization_website,
    om.role AS organization_role
  FROM users u
  LEFT JOIN organization_memberships om
    ON om.user_id = u.id
    AND om.status = 'active'
  LEFT JOIN organizations o
    ON o.id = om.organization_id
`;

async function generateUniqueOrganizationSlug(client, name) {
  const base = slugify(name) || 'organization';
  let candidate = base;
  let counter = 1;

  while (true) {
    const result = await client.query('SELECT 1 FROM organizations WHERE slug = $1 LIMIT 1', [candidate]);
    if (result.rowCount === 0) {
      return candidate;
    }

    counter += 1;
    candidate = `${base}-${counter}`;
  }
}

export async function findUserByEmail(email) {
  const result = await query(
    `${baseUserSelect}
     WHERE u.email = $1
     ORDER BY CASE WHEN om.role = 'owner' THEN 0 ELSE 1 END
     LIMIT 1`,
    [email]
  );

  return mapUser(result.rows[0]);
}

export async function findUserById(id) {
  const result = await query(
    `${baseUserSelect}
     WHERE u.id = $1
     ORDER BY CASE WHEN om.role = 'owner' THEN 0 ELSE 1 END
     LIMIT 1`,
    [id]
  );

  return mapUser(result.rows[0]);
}

export async function createPlatformAdminIfMissing({ email, passwordHash, firstName, lastName }) {
  const existingUser = await findUserByEmail(email);
  if (existingUser) {
    await query(
      `
        UPDATE users
        SET
          password_hash = $2,
          first_name = $3,
          last_name = $4,
          account_type = 'platform_admin',
          approval_status = 'not_required',
          email_verified_at = COALESCE(email_verified_at, CURRENT_TIMESTAMP),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `,
      [existingUser.id, passwordHash, firstName, lastName]
    );

    return findUserById(existingUser.id);
  }

  const id = generateId();
  await query(
    `
      INSERT INTO users (
        id,
        email,
        password_hash,
        account_type,
        first_name,
        last_name,
        approval_status,
        email_verified_at
      )
      VALUES ($1, $2, $3, 'platform_admin', $4, $5, 'not_required', CURRENT_TIMESTAMP)
    `,
    [id, email, passwordHash, firstName, lastName]
  );

  return findUserById(id);
}

export async function createResearcherAccount({
  email,
  passwordHash,
  firstName,
  lastName,
  displayName,
  researcherType,
  verificationTokenHash,
  verificationTokenExpiresAt,
  invitedByUserId = null,
  emailVerifiedAt = null,
  approvalStatus = 'pending_submission'
}) {
  const id = generateId();

  await query(
    `
      INSERT INTO users (
        id,
        email,
        password_hash,
        account_type,
        researcher_type,
        first_name,
        last_name,
        display_name,
        approval_status,
        invited_by_user_id,
        email_verified_at,
        verification_token_hash,
        verification_token_expires_at,
        verification_code_attempts,
        verification_code_last_sent_at
      )
      VALUES ($1, $2, $3, 'researcher', $4, $5, $6, $7, $8, $9, $10, $11, $12, 0, CURRENT_TIMESTAMP)
    `,
    [
      id,
      email,
      passwordHash,
      researcherType,
      firstName,
      lastName,
      displayName || null,
      approvalStatus,
      invitedByUserId,
      emailVerifiedAt,
      verificationTokenHash,
      verificationTokenExpiresAt
    ]
  );

  await query(
    `
      INSERT INTO researcher_verifications (id, user_id, status)
      VALUES ($1, $2, 'pending_submission')
    `,
    [generateId(), id]
  );

  return findUserById(id);
}

export async function createOrganizationAccount({
  email,
  passwordHash,
  firstName,
  lastName,
  jobTitle,
  organizationName,
  website,
  verificationTokenHash,
  verificationTokenExpiresAt
}) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const userId = generateId();
    const organizationId = generateId();
    const membershipId = generateId();
    const slug = await generateUniqueOrganizationSlug(client, organizationName);

    await client.query(
      `
        INSERT INTO users (
          id,
          email,
          password_hash,
          account_type,
          first_name,
          last_name,
          job_title,
          approval_status,
          verification_token_hash,
          verification_token_expires_at,
          verification_code_attempts,
          verification_code_last_sent_at
        )
        VALUES ($1, $2, $3, 'organization', $4, $5, $6, 'submitted', $7, $8, 0, CURRENT_TIMESTAMP)
      `,
      [
        userId,
        email,
        passwordHash,
        firstName,
        lastName,
        jobTitle || null,
        verificationTokenHash,
        verificationTokenExpiresAt
      ]
    );

    await client.query(
      `
        INSERT INTO organizations (
          id,
          name,
          slug,
          website,
          billing_email,
          owner_user_id
        )
        VALUES ($1, $2, $3, $4, $5, $6)
      `,
      [organizationId, organizationName, slug, website || null, email, userId]
    );

    await client.query(
      `
        INSERT INTO organization_memberships (
          id,
          organization_id,
          user_id,
          role
        )
        VALUES ($1, $2, $3, 'owner')
      `,
      [membershipId, organizationId, userId]
    );

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  return findUserByEmail(email);
}

export async function updateVerificationToken(userId, tokenHash, expiresAt) {
  await query(
    `
      UPDATE users
      SET
        verification_token_hash = $2,
        verification_token_expires_at = $3,
        verification_code_attempts = 0,
        verification_code_last_sent_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `,
    [userId, tokenHash, expiresAt]
  );
}

export async function verifyUserByTokenHash(tokenHash) {
  const result = await query(
    `
      UPDATE users
      SET
        email_verified_at = CURRENT_TIMESTAMP,
        verification_token_hash = NULL,
        verification_token_expires_at = NULL,
        verification_code_attempts = 0,
        verification_code_last_sent_at = NULL,
        updated_at = CURRENT_TIMESTAMP
      WHERE verification_token_hash = $1
        AND verification_token_expires_at > CURRENT_TIMESTAMP
      RETURNING id
    `,
    [tokenHash]
  );

  if (result.rowCount === 0) {
    return null;
  }

  return findUserById(result.rows[0].id);
}

export async function findPendingEmailVerificationByEmail(email) {
  const result = await query(
    `
      SELECT
        id,
        email,
        account_type,
        first_name,
        last_name,
        email_verified_at,
        verification_token_hash,
        verification_token_expires_at,
        verification_code_attempts,
        verification_code_last_sent_at
      FROM users
      WHERE email = $1
      LIMIT 1
    `,
    [email]
  );

  return result.rows[0] ?? null;
}

export async function incrementVerificationCodeAttempts(userId) {
  const result = await query(
    `
      UPDATE users
      SET
        verification_code_attempts = verification_code_attempts + 1,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING verification_code_attempts
    `,
    [userId]
  );

  return result.rows[0]?.verification_code_attempts ?? null;
}

export async function verifyUserByEmailAndCodeHash(email, codeHash, maxAttempts) {
  const result = await query(
    `
      UPDATE users
      SET
        email_verified_at = CURRENT_TIMESTAMP,
        verification_token_hash = NULL,
        verification_token_expires_at = NULL,
        verification_code_attempts = 0,
        verification_code_last_sent_at = NULL,
        updated_at = CURRENT_TIMESTAMP
      WHERE email = $1
        AND verification_token_hash = $2
        AND verification_token_expires_at > CURRENT_TIMESTAMP
        AND email_verified_at IS NULL
        AND verification_code_attempts < $3
      RETURNING id
    `,
    [email, codeHash, maxAttempts]
  );

  if (result.rowCount === 0) {
    return null;
  }

  return findUserById(result.rows[0].id);
}

export async function storePasswordResetToken(userId, tokenHash, expiresAt) {
  await query(
    `
      UPDATE users
      SET
        password_reset_token_hash = $2,
        password_reset_expires_at = $3,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `,
    [userId, tokenHash, expiresAt]
  );
}

export async function resetPasswordByTokenHash(tokenHash, passwordHash) {
  const result = await query(
    `
      UPDATE users
      SET
        password_hash = $2,
        password_reset_token_hash = NULL,
        password_reset_expires_at = NULL,
        session_version = session_version + 1,
        updated_at = CURRENT_TIMESTAMP
      WHERE password_reset_token_hash = $1
        AND password_reset_expires_at > CURRENT_TIMESTAMP
      RETURNING id
    `,
    [tokenHash, passwordHash]
  );

  if (result.rowCount === 0) {
    return null;
  }

  return findUserById(result.rows[0].id);
}

export async function storeTwoFactorOtp(userId, otpHash, expiresAt) {
  await query(
    `
      UPDATE users
      SET
        two_factor_otp_hash = $1,
        two_factor_otp_expires_at = $2,
        two_factor_otp_attempts = 0,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
    `,
    [otpHash, expiresAt, userId]
  );
}

export async function getTwoFactorOtpData(userId) {
  const result = await query(
    `
      SELECT two_factor_otp_hash, two_factor_otp_expires_at, two_factor_otp_attempts
      FROM users
      WHERE id = $1
    `,
    [userId]
  );

  return result.rows[0] ?? null;
}

export async function incrementOtpAttempts(userId) {
  await query(
    `
      UPDATE users
      SET
        two_factor_otp_attempts = two_factor_otp_attempts + 1,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `,
    [userId]
  );
}

export async function resetTwoFactorOtp(userId) {
  await query(
    `
      UPDATE users
      SET
        two_factor_otp_hash = NULL,
        two_factor_otp_expires_at = NULL,
        two_factor_otp_attempts = 0,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `,
    [userId]
  );
}

export async function enableTwoFactorEmail(userId) {
  const result = await query(
    `
      UPDATE users
      SET
        two_factor_enabled_at = NOW(),
        two_factor_secret = NULL,
        two_factor_temp_secret = NULL,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `,
    [userId]
  );

  if (result.rowCount === 0) {
    return null;
  }

  return findUserById(userId);
}

export async function disableTwoFactorEmail(userId) {
  await query(
    `
      UPDATE users
      SET
        two_factor_enabled_at = NULL,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `,
    [userId]
  );

  return findUserById(userId);
}

export async function createOrganizationInvitation({
  organizationId,
  invitedByUserId,
  email,
  role,
  tokenHash,
  expiresAt
}) {
  const invitationId = generateId();

  await query(
    `
      INSERT INTO organization_invitations (
        id,
        organization_id,
        email,
        role,
        token_hash,
        invited_by_user_id,
        expires_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `,
    [invitationId, organizationId, email, role, tokenHash, invitedByUserId, expiresAt]
  );

  const result = await query(
    `
      SELECT
        oi.id,
        oi.email,
        oi.role,
        oi.expires_at,
        o.name AS organization_name,
        o.slug AS organization_slug
      FROM organization_invitations oi
      INNER JOIN organizations o ON o.id = oi.organization_id
      WHERE oi.id = $1
      LIMIT 1
    `,
    [invitationId]
  );

  return result.rows[0];
}

export async function findOrganizationInvitationByTokenHash(tokenHash) {
  const result = await query(
    `
      SELECT
        oi.*,
        o.name AS organization_name,
        o.slug AS organization_slug
      FROM organization_invitations oi
      INNER JOIN organizations o ON o.id = oi.organization_id
      WHERE oi.token_hash = $1
        AND oi.accepted_at IS NULL
        AND oi.expires_at > CURRENT_TIMESTAMP
      LIMIT 1
    `,
    [tokenHash]
  );

  return result.rows[0] ?? null;
}

export async function acceptOrganizationInvitation({
  tokenHash,
  passwordHash,
  firstName,
  lastName
}) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const invitationResult = await client.query(
      `
        SELECT *
        FROM organization_invitations
        WHERE token_hash = $1
          AND accepted_at IS NULL
          AND expires_at > CURRENT_TIMESTAMP
        LIMIT 1
      `,
      [tokenHash]
    );

    const invitation = invitationResult.rows[0];
    if (!invitation) {
      await client.query('ROLLBACK');
      return null;
    }

    const existingUserResult = await client.query('SELECT id FROM users WHERE email = $1 LIMIT 1', [
      invitation.email
    ]);

    if (existingUserResult.rowCount > 0) {
      throw new Error('A user with this email already exists');
    }

    const userId = generateId();
    const membershipId = generateId();
    const first = firstName || 'Organization';
    const last = lastName || 'Member';

    await client.query(
      `
        INSERT INTO users (
          id,
          email,
          password_hash,
          account_type,
          first_name,
          last_name,
          approval_status,
          email_verified_at
        )
        VALUES ($1, $2, $3, 'organization', $4, $5, 'not_required', CURRENT_TIMESTAMP)
      `,
      [userId, invitation.email, passwordHash, first, last]
    );

    await client.query(
      `
        INSERT INTO organization_memberships (
          id,
          organization_id,
          user_id,
          role
        )
        VALUES ($1, $2, $3, $4)
      `,
      [membershipId, invitation.organization_id, userId, invitation.role]
    );

    await client.query(
      `
        UPDATE organization_invitations
        SET accepted_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `,
      [invitation.id]
    );

    await client.query('COMMIT');

    return findUserById(userId);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function createResearcherInvitation({
  email,
  researcherType,
  invitedByUserId,
  notes,
  tokenHash,
  expiresAt
}) {
  const invitationId = generateId();

  await query(
    `
      INSERT INTO researcher_invitations (
        id,
        email,
        researcher_type,
        token_hash,
        invited_by_user_id,
        notes,
        expires_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `,
    [invitationId, email, researcherType, tokenHash, invitedByUserId, notes || null, expiresAt]
  );

  const result = await query(
    `
      SELECT *
      FROM researcher_invitations
      WHERE id = $1
      LIMIT 1
    `,
    [invitationId]
  );

  return result.rows[0] ?? null;
}

export async function findResearcherInvitationByTokenHash(tokenHash) {
  const result = await query(
    `
      SELECT *
      FROM researcher_invitations
      WHERE token_hash = $1
        AND accepted_at IS NULL
        AND expires_at > CURRENT_TIMESTAMP
      LIMIT 1
    `,
    [tokenHash]
  );

  return result.rows[0] ?? null;
}

export async function acceptResearcherInvitation({
  tokenHash,
  passwordHash,
  firstName,
  lastName,
  displayName
}) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const invitationResult = await client.query(
      `
        SELECT *
        FROM researcher_invitations
        WHERE token_hash = $1
          AND accepted_at IS NULL
          AND expires_at > CURRENT_TIMESTAMP
        LIMIT 1
      `,
      [tokenHash]
    );

    const invitation = invitationResult.rows[0];
    if (!invitation) {
      await client.query('ROLLBACK');
      return null;
    }

    const existingUserResult = await client.query('SELECT id FROM users WHERE email = $1 LIMIT 1', [
      invitation.email
    ]);

    if (existingUserResult.rowCount > 0) {
      throw new Error('A user with this email already exists');
    }

    const userId = generateId();
    const verificationId = generateId();
    const autoApproveInternal = invitation.researcher_type === 'internal';
    const approvalStatus = autoApproveInternal ? 'approved' : 'pending_submission';
    const verificationStatus = autoApproveInternal ? 'approved' : 'pending_submission';
    await client.query(
      `
        INSERT INTO users (
          id,
          email,
          password_hash,
          account_type,
          researcher_type,
          first_name,
          last_name,
          display_name,
          approval_status,
          invited_by_user_id,
          email_verified_at
        )
        VALUES ($1, $2, $3, 'researcher', $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)
      `,
      [
        userId,
        invitation.email,
        passwordHash,
        invitation.researcher_type,
        firstName || 'Researcher',
        lastName || 'Invitee',
        displayName || null,
        approvalStatus,
        invitation.invited_by_user_id
      ]
    );

    await client.query(
      `
        INSERT INTO researcher_verifications (
          id,
          user_id,
          status,
          reviewed_at,
          reviewed_by_user_id,
          reviewer_notes
        )
        VALUES ($1, $2, $3, $4, $5, $6)
      `,
      [
        verificationId,
        userId,
        verificationStatus,
        autoApproveInternal ? new Date() : null,
        autoApproveInternal ? invitation.invited_by_user_id : null,
        autoApproveInternal ? 'Auto-approved from trusted internal researcher invitation.' : null
      ]
    );

    await client.query(
      `
        UPDATE researcher_invitations
        SET accepted_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `,
      [invitation.id]
    );

    await client.query('COMMIT');
    return findUserById(userId);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function findResearcherVerificationByUserId(userId) {
  const result = await query(
    `
      SELECT
        rv.*,
        reviewer.first_name AS reviewer_first_name,
        reviewer.last_name AS reviewer_last_name
      FROM researcher_verifications rv
      LEFT JOIN users reviewer
        ON reviewer.id = rv.reviewed_by_user_id
      WHERE rv.user_id = $1
      LIMIT 1
    `,
    [userId]
  );

  return mapVerification(result.rows[0]);
}

export async function findResearcherVerificationByDocumentPath(documentPath) {
  const result = await query(
    `
      SELECT
        rv.*,
        u.email,
        u.first_name,
        u.last_name,
        u.display_name,
        u.researcher_type,
        reviewer.first_name AS reviewer_first_name,
        reviewer.last_name AS reviewer_last_name
      FROM researcher_verifications rv
      INNER JOIN users u
        ON u.id = rv.user_id
      LEFT JOIN users reviewer
        ON reviewer.id = rv.reviewed_by_user_id
      WHERE rv.national_id_document_path = $1
         OR rv.certification_document_path = $1
      LIMIT 1
    `,
    [documentPath]
  );

  return mapVerification(result.rows[0]);
}

export async function submitResearcherVerification({
  userId,
  countryOfIssue,
  certificationsSummary,
  nationalIdDocumentName,
  nationalIdDocumentPath,
  certificationDocumentName,
  certificationDocumentPath
}) {
  const existing = await findResearcherVerificationByUserId(userId);

  if (!existing) {
    await query(
      `
        INSERT INTO researcher_verifications (
          id,
          user_id,
          status,
          country_of_issue,
          national_id_document_name,
          national_id_document_path,
          certification_document_name,
          certification_document_path,
          certifications_summary,
          submitted_at,
          updated_at
        )
        VALUES ($1, $2, 'submitted', $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `,
      [
        generateId(),
        userId,
        countryOfIssue || null,
        nationalIdDocumentName || null,
        nationalIdDocumentPath || null,
        certificationDocumentName || null,
        certificationDocumentPath || null,
        certificationsSummary || null
      ]
    );
  } else {
    await query(
      `
        UPDATE researcher_verifications
        SET
          status = 'submitted',
          country_of_issue = COALESCE($2, country_of_issue),
          national_id_document_name = COALESCE($3, national_id_document_name),
          national_id_document_path = COALESCE($4, national_id_document_path),
          certification_document_name = COALESCE($5, certification_document_name),
          certification_document_path = COALESCE($6, certification_document_path),
          certifications_summary = COALESCE($7, certifications_summary),
          reviewer_notes = NULL,
          reviewed_at = NULL,
          reviewed_by_user_id = NULL,
          submitted_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
        WHERE user_id = $1
      `,
      [
        userId,
        countryOfIssue || null,
        nationalIdDocumentName || null,
        nationalIdDocumentPath || null,
        certificationDocumentName || null,
        certificationDocumentPath || null,
        certificationsSummary || null
      ]
    );
  }

  await query(
    `
      UPDATE users
      SET
        approval_status = 'submitted',
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `,
    [userId]
  );

  return findResearcherVerificationByUserId(userId);
}

export async function listResearcherVerifications() {
  const result = await query(
    `
      SELECT
        rv.*,
        u.email,
        u.first_name,
        u.last_name,
        u.display_name,
        u.researcher_type,
        reviewer.first_name AS reviewer_first_name,
        reviewer.last_name AS reviewer_last_name
      FROM researcher_verifications rv
      INNER JOIN users u
        ON u.id = rv.user_id
      LEFT JOIN users reviewer
        ON reviewer.id = rv.reviewed_by_user_id
      WHERE u.account_type = 'researcher'
      ORDER BY
        CASE rv.status
          WHEN 'submitted' THEN 0
          WHEN 'rejected' THEN 1
          WHEN 'pending_submission' THEN 2
          WHEN 'approved' THEN 3
          ELSE 4
        END,
        COALESCE(rv.submitted_at, u.created_at) DESC
    `
  );

  return result.rows.map((row) => mapVerification(row));
}

export async function reviewResearcherVerification({
  userId,
  reviewerId,
  status,
  reviewerNotes
}) {
  await query(
    `
      UPDATE researcher_verifications
      SET
        status = $2,
        reviewer_notes = $3,
        reviewed_at = CURRENT_TIMESTAMP,
        reviewed_by_user_id = $4,
        updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $1
    `,
    [userId, status, reviewerNotes || null, reviewerId]
  );

  await query(
    `
      UPDATE users
      SET
        approval_status = $2,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `,
    [userId, status]
  );

  return findResearcherVerificationByUserId(userId);
}

export async function getPlatformMetrics() {
  const [researcherCounts, submissionCounts, organizationCounts, organizationApprovalCounts] = await Promise.all([
    query(
      `
        SELECT
          researcher_type,
          approval_status,
          COUNT(*)::int AS count
        FROM users
        WHERE account_type = 'researcher'
        GROUP BY researcher_type, approval_status
      `
    ),
    query(
      `
        SELECT
          status,
          COUNT(*)::int AS count
        FROM researcher_verifications
        GROUP BY status
      `
    ),
    query(
      `
        SELECT COUNT(*)::int AS count
        FROM organizations
      `
    ),
    query(
      `
        SELECT
          owner.approval_status,
          COUNT(*)::int AS count
        FROM organizations o
        INNER JOIN users owner
          ON owner.id = o.owner_user_id
        GROUP BY owner.approval_status
      `
    )
  ]);

  return {
    researchers: researcherCounts.rows,
    verifications: submissionCounts.rows,
    organizations: Number(organizationCounts.rows[0]?.count ?? 0),
    organizationApprovals: organizationApprovalCounts.rows
  };
}

export async function listResearcherInvitations(limit = 20) {
  const result = await query(
    `
      SELECT
        ri.id,
        ri.email,
        ri.researcher_type,
        ri.notes,
        ri.accepted_at,
        ri.expires_at,
        ri.created_at,
        inviter.first_name AS inviter_first_name,
        inviter.last_name AS inviter_last_name
      FROM researcher_invitations ri
      LEFT JOIN users inviter
        ON inviter.id = ri.invited_by_user_id
      ORDER BY ri.created_at DESC
      LIMIT $1
    `,
    [limit]
  );

  return result.rows;
}

export async function listOrganizations(limit = 20) {
  const result = await query(
    `
      SELECT
        o.id,
        o.name,
        o.slug,
        o.website,
        o.billing_email,
        o.created_at,
        o.owner_user_id,
        owner.email AS owner_email,
        owner.first_name AS owner_first_name,
        owner.last_name AS owner_last_name,
        owner.approval_status AS owner_approval_status,
        COUNT(om.user_id)::int AS member_count
      FROM organizations o
      INNER JOIN users owner
        ON owner.id = o.owner_user_id
      LEFT JOIN organization_memberships om
        ON om.organization_id = o.id
        AND om.status = 'active'
      GROUP BY
        o.id,
        o.name,
        o.slug,
        o.website,
        o.billing_email,
        o.created_at,
        o.owner_user_id,
        owner.email,
        owner.first_name,
        owner.last_name,
        owner.approval_status
      ORDER BY o.created_at DESC
      LIMIT $1
    `,
    [limit]
  );

  return result.rows;
}

export async function findOrganizationById(organizationId) {
  const result = await query(
    `
      SELECT
        o.id,
        o.name,
        o.slug,
        o.website,
        o.billing_email,
        o.created_at,
        o.owner_user_id,
        owner.email AS owner_email,
        owner.first_name AS owner_first_name,
        owner.last_name AS owner_last_name,
        owner.approval_status AS owner_approval_status,
        owner.email_verified_at AS owner_email_verified_at,
        COUNT(om.user_id)::int AS member_count
      FROM organizations o
      INNER JOIN users owner
        ON owner.id = o.owner_user_id
      LEFT JOIN organization_memberships om
        ON om.organization_id = o.id
        AND om.status = 'active'
      WHERE o.id = $1
      GROUP BY
        o.id,
        o.name,
        o.slug,
        o.website,
        o.billing_email,
        o.created_at,
        o.owner_user_id,
        owner.email,
        owner.first_name,
        owner.last_name,
        owner.approval_status,
        owner.email_verified_at
      LIMIT 1
    `,
    [organizationId]
  );

  return result.rows[0] ?? null;
}

export async function reviewOrganizationApproval({ organizationId, status }) {
  const result = await query(
    `
      UPDATE users owner
      SET
        approval_status = $2,
        updated_at = CURRENT_TIMESTAMP
      FROM organizations o
      WHERE o.id = $1
        AND owner.id = o.owner_user_id
        AND owner.account_type = 'organization'
      RETURNING owner.id AS owner_user_id
    `,
    [organizationId, status]
  );

  if (result.rowCount === 0) {
    return null;
  }

  return findOrganizationById(organizationId);
}

export async function createAuthAuditEvent({
  actorUserId,
  targetUserId,
  eventType,
  outcome,
  accountType,
  subjectType,
  subjectId,
  ipAddress,
  userAgent,
  metadata
}) {
  await query(
    `
      INSERT INTO auth_audit_events (
        id,
        actor_user_id,
        target_user_id,
        event_type,
        outcome,
        account_type,
        subject_type,
        subject_id,
        ip_address,
        user_agent,
        metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb)
    `,
    [
      generateId(),
      actorUserId,
      targetUserId,
      eventType,
      outcome,
      accountType,
      subjectType,
      subjectId,
      ipAddress,
      userAgent,
      JSON.stringify(metadata ?? {})
    ]
  );
}

export async function listAuthAuditEvents(limit = 40) {
  const result = await query(
    `
      SELECT
        a.id,
        a.event_type,
        a.outcome,
        a.account_type,
        a.subject_type,
        a.subject_id,
        a.ip_address,
        a.user_agent,
        a.metadata,
        a.occurred_at,
        actor.email AS actor_email,
        actor.first_name AS actor_first_name,
        actor.last_name AS actor_last_name,
        target.email AS target_email,
        target.first_name AS target_first_name,
        target.last_name AS target_last_name
      FROM auth_audit_events a
      LEFT JOIN users actor
        ON actor.id = a.actor_user_id
      LEFT JOIN users target
        ON target.id = a.target_user_id
      ORDER BY a.occurred_at DESC
      LIMIT $1
    `,
    [limit]
  );

  return result.rows;
}

/**
 * Returns all users with account_type='researcher' and researcher_type='internal'.
 * Used by the code-service /api/reviewers endpoint to populate the assign-reviewer
 * dropdown with every eligible platform researcher, not just previously-assigned ones.
 */
export async function listInternalResearchers() {
  const result = await query(
    `SELECT id, email, first_name, last_name, display_name, researcher_type, approval_status, created_at
       FROM users
      WHERE account_type = 'researcher'
        AND researcher_type = 'internal'
      ORDER BY COALESCE(NULLIF(TRIM(display_name), ''), first_name || ' ' || last_name, email)`
  );
  return result.rows;
}
