CREATE TABLE IF NOT EXISTS vdp_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL,
    org_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vdp_users_role ON vdp_users(role);
CREATE INDEX IF NOT EXISTS idx_vdp_users_org_id ON vdp_users(org_id);

INSERT INTO vdp_users (id, email, full_name, password_hash, role, org_id, status)
VALUES (
    '00000000-0000-0000-0000-000000000101',
    'platform-admin@antcrowd.local',
    'VDP Platform Admin',
    crypt('Antcrowd123!', gen_salt('bf')),
    'platform_admin',
    NULL,
    'active'
)
ON CONFLICT (email) DO NOTHING;

INSERT INTO vdp_users (id, email, full_name, password_hash, role, org_id, status)
VALUES (
    '00000000-0000-0000-0000-000000000102',
    'org-admin@acme.local',
    'Acme Organization Admin',
    crypt('Antcrowd123!', gen_salt('bf')),
    'organization_admin',
    '00000000-0000-0000-0000-000000000001',
    'active'
)
ON CONFLICT (email) DO NOTHING;

INSERT INTO vdp_users (id, email, full_name, password_hash, role, org_id, status)
VALUES (
    '00000000-0000-0000-0000-000000000103',
    'hacker@crowd.local',
    'Authenticated Hacker Demo',
    crypt('Antcrowd123!', gen_salt('bf')),
    'hacker',
    NULL,
    'active'
)
ON CONFLICT (email) DO NOTHING;
