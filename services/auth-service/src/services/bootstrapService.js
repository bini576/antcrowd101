import { config } from '../config/env.js';
import { pool, query } from '../db/pool.js';
import { hashPassword } from '../lib/password.js';
import { generateId, hashToken } from '../lib/tokens.js';
import { slugify } from '../lib/slug.js';
import {
  createOrganizationAccount,
  createPlatformAdminIfMissing,
  createResearcherAccount,
  findUserByEmail,
  findUserById,
  reviewResearcherVerification
} from '../repositories/userRepository.js';

function isDemoSeedEnabled() {
  if (config.nodeEnv === 'production') {
    return false;
  }

  const raw = String(process.env.DEMO_SEED_ENABLED ?? 'true').trim().toLowerCase();
  return !['0', 'false', 'no', 'off'].includes(raw);
}

async function generateUniqueOrganizationSlug(client, name) {
  const base = slugify(name) || 'organization';
  let candidate = base;
  let counter = 1;

  while (true) {
    const existing = await client.query('SELECT 1 FROM organizations WHERE slug = $1 LIMIT 1', [candidate]);
    if (existing.rowCount === 0) {
      return candidate;
    }
    counter += 1;
    candidate = `${base}-${counter}`;
  }
}

async function ensureOrganizationOwnership({
  userId,
  organizationName,
  website,
  billingEmail
}) {
  const existingMembership = await query(
    `
      SELECT o.id
      FROM organization_memberships om
      INNER JOIN organizations o
        ON o.id = om.organization_id
      WHERE om.user_id = $1
        AND om.role = 'owner'
      LIMIT 1
    `,
    [userId]
  );

  if (existingMembership.rowCount > 0) {
    await query(
      `
        UPDATE organizations
        SET
          name = $2,
          website = $3,
          billing_email = $4,
          owner_user_id = $1,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $5
      `,
      [userId, organizationName, website || null, billingEmail, existingMembership.rows[0].id]
    );
    return existingMembership.rows[0].id;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const organizationId = generateId();
    const membershipId = generateId();
    const slug = await generateUniqueOrganizationSlug(client, organizationName);

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
      [organizationId, organizationName, slug, website || null, billingEmail, userId]
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
    return organizationId;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function ensureOrganizationDemoAccount({
  email,
  password,
  firstName,
  lastName,
  jobTitle,
  organizationName,
  website,
  approvalStatus
}) {
  const passwordHash = await hashPassword(password);
  let user = await findUserByEmail(email);

  if (!user) {
    user = await createOrganizationAccount({
      email,
      passwordHash,
      firstName,
      lastName,
      jobTitle,
      organizationName,
      website,
      verificationTokenHash: hashToken(`demo-seed:${email}`),
      verificationTokenExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
    });
  } else {
    await query(
      `
        UPDATE users
        SET
          email = $2,
          password_hash = $3,
          account_type = 'organization',
          first_name = $4,
          last_name = $5,
          job_title = $6,
          approval_status = $7,
          email_verified_at = CURRENT_TIMESTAMP,
          verification_token_hash = NULL,
          verification_token_expires_at = NULL,
          verification_code_attempts = 0,
          verification_code_last_sent_at = NULL,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `,
      [user.id, email, passwordHash, firstName, lastName, jobTitle || null, approvalStatus]
    );
  }

  await ensureOrganizationOwnership({
    userId: user.id,
    organizationName,
    website,
    billingEmail: email
  });

  await query(
    `
      UPDATE users
      SET
        approval_status = $2,
        email_verified_at = CURRENT_TIMESTAMP,
        verification_token_hash = NULL,
        verification_token_expires_at = NULL,
        verification_code_attempts = 0,
        verification_code_last_sent_at = NULL,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `,
    [user.id, approvalStatus]
  );

  return findUserById(user.id);
}

async function ensureResearcherVerificationRow(userId) {
  await query(
    `
      INSERT INTO researcher_verifications (id, user_id, status)
      VALUES ($1, $2, 'pending_submission')
      ON CONFLICT (user_id) DO NOTHING
    `,
    [generateId(), userId]
  );
}

async function ensureResearcherDemoAccount({
  email,
  password,
  firstName,
  lastName,
  displayName,
  researcherType,
  approvalStatus,
  reviewerId
}) {
  const passwordHash = await hashPassword(password);
  let user = await findUserByEmail(email);

  if (!user) {
    user = await createResearcherAccount({
      email,
      passwordHash,
      firstName,
      lastName,
      displayName,
      researcherType,
      verificationTokenHash: hashToken(`demo-seed:${email}`),
      verificationTokenExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      emailVerifiedAt: new Date(),
      approvalStatus
    });
  } else {
    await query(
      `
        UPDATE users
        SET
          email = $2,
          password_hash = $3,
          account_type = 'researcher',
          researcher_type = $4,
          first_name = $5,
          last_name = $6,
          display_name = $7,
          approval_status = $8,
          email_verified_at = CURRENT_TIMESTAMP,
          verification_token_hash = NULL,
          verification_token_expires_at = NULL,
          verification_code_attempts = 0,
          verification_code_last_sent_at = NULL,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `,
      [user.id, email, passwordHash, researcherType, firstName, lastName, displayName || null, approvalStatus]
    );
  }

  await ensureResearcherVerificationRow(user.id);

  if (approvalStatus === 'approved') {
    await reviewResearcherVerification({
      userId: user.id,
      reviewerId,
      status: 'approved',
      reviewerNotes: 'Demo seed approved for presentation readiness.'
    });
  } else {
    await query(
      `
        UPDATE researcher_verifications
        SET
          status = 'pending_submission',
          reviewer_notes = NULL,
          reviewed_at = NULL,
          reviewed_by_user_id = NULL,
          updated_at = CURRENT_TIMESTAMP
        WHERE user_id = $1
      `,
      [user.id]
    );
    await query(
      `
        UPDATE users
        SET
          approval_status = $2,
          email_verified_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `,
      [user.id, approvalStatus]
    );
  }

  return findUserById(user.id);
}

export async function ensurePresentationSeed({ email, password, firstName, lastName }) {
  const platformAdmin = await createPlatformAdminIfMissing({
    email,
    passwordHash: await hashPassword(password),
    firstName,
    lastName
  });

  if (!isDemoSeedEnabled() || !platformAdmin) {
    if (platformAdmin) {
      console.log(`Platform admin ready for ${email}`);
    }
    return platformAdmin;
  }

  await Promise.all([
    ensureOrganizationDemoAccount({
      email: 'org-admin@antcrowd.local',
      password: 'Antcrowd123!',
      firstName: 'Acme',
      lastName: 'Owner',
      jobTitle: 'Security Program Owner',
      organizationName: 'Acme Security Group',
      website: 'https://acme.antcrowd.local',
      approvalStatus: 'approved'
    }),
    ensureOrganizationDemoAccount({
      email: 'pending-org@antcrowd.local',
      password: 'Antcrowd123!',
      firstName: 'Northwind',
      lastName: 'Owner',
      jobTitle: 'Security Program Lead',
      organizationName: 'Northwind Health',
      website: 'https://northwind.antcrowd.local',
      approvalStatus: 'submitted'
    }),
    ensureResearcherDemoAccount({
      email: 'internal1@antcrowd.local',
      password: 'Antcrowd123!',
      firstName: 'Internal',
      lastName: 'Researcher',
      displayName: 'Internal Operator One',
      researcherType: 'internal',
      approvalStatus: 'approved',
      reviewerId: platformAdmin.id
    }),
    ensureResearcherDemoAccount({
      email: 'alpha@crowd.local',
      password: 'Antcrowd123!',
      firstName: 'Alpha',
      lastName: 'Researcher',
      displayName: 'Alpha Crowd',
      researcherType: 'external',
      approvalStatus: 'approved',
      reviewerId: platformAdmin.id
    }),
    ensureResearcherDemoAccount({
      email: 'compliance-lead@antcrowd.local',
      password: process.env.DEMO_ACCOUNT_PASSWORD || 'AntcrowdDemo123!',
      firstName: 'Marcus',
      lastName: 'Adebayo',
      displayName: 'Marcus Adebayo — GRC Lead',
      researcherType: 'internal',
      approvalStatus: 'approved',
      reviewerId: platformAdmin.id
    }),
    ensureResearcherDemoAccount({
      email: 'security-eng@antcrowd.local',
      password: process.env.DEMO_ACCOUNT_PASSWORD || 'AntcrowdDemo123!',
      firstName: 'Daniel',
      lastName: 'Tegegn',
      displayName: 'Daniel Tegegn — Security Engineer',
      researcherType: 'internal',
      approvalStatus: 'approved',
      reviewerId: platformAdmin.id
    })
  ]);

  // Assign platform roles to special accounts (idempotent)
  const complianceUser = await findUserByEmail('compliance-lead@antcrowd.local');
  const developerUser = await findUserByEmail('security-eng@antcrowd.local');

  if (complianceUser) {
    await query(
      `
        INSERT INTO platform_role_assignments (id, user_id, platform_role)
        VALUES ($1, $2, 'compliance_team')
        ON CONFLICT (user_id, platform_role) DO NOTHING
      `,
      [generateId(), complianceUser.id]
    );
  }

  if (developerUser) {
    await query(
      `
        INSERT INTO platform_role_assignments (id, user_id, platform_role)
        VALUES ($1, $2, 'developer')
        ON CONFLICT (user_id, platform_role) DO NOTHING
      `,
      [generateId(), developerUser.id]
    );
  }

  console.log(`Platform admin ready for ${email}`);
  console.log('Presentation demo accounts ensured: org-admin@antcrowd.local, pending-org@antcrowd.local, internal1@antcrowd.local, alpha@crowd.local, compliance-lead@antcrowd.local, security-eng@antcrowd.local');

  return platformAdmin;
}
