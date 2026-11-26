# VDP Service

AntCrowd Vulnerability Disclosure Program service with:
- public report intake
- policy/procedure governance
- report workflow and SLA automation
- triage assistant and evidence-quality gates
- webhook outbox for reliable delivery
- first-class JWT auth for `platform_admin`, `organization_admin`, and `hacker`

## Local run

```bash
cd services/vdp-service
cp .env.example .env
go run .
```

## Frontend workspaces (compose)

- Public VDP pages: `http://localhost:5284`
- Organization VDP admin workspace: `http://localhost:5285`
- Platform admin global VDP oversight: `http://localhost:5279/admin/vdp`

Role separation:

- `frontend-public`: public submission and tracking
- `frontend-admin`: organization VDP management (scope, SLA, triage, publish controls)
- `admin-service/frontend:/admin/vdp`: platform-level global oversight

## Health endpoints

- `GET /health`
- `GET /ready` (database readiness check)

## Auth endpoints

- `POST /api/vdp/auth/login`
- `POST /api/vdp/auth/register`
- `GET /api/vdp/auth/me`

Compatibility aliases:

- `POST /auth/login`
- `POST /auth/register`
- `GET /auth/me`

## Demo credentials

- Platform admin:
  - email: `platform-admin@antcrowd.local`
  - password: `Antcrowd123!`
- Organization admin:
  - email: `org-admin@acme.local`
  - password: `Antcrowd123!`
- Hacker:
  - email: `hacker@crowd.local`
  - password: `Antcrowd123!`

`hacker` registration can be self-service. Higher-privilege users should be created by `platform_admin`.

## Production/staging requirements

Set `APP_ENV=production` (or `staging`) and provide secure values for:
- `JWT_SECRET` (minimum 32 chars)
- `MINIO_ACCESS_KEY` and `MINIO_SECRET_KEY` (no defaults)
- `DB_DSN` (no placeholder password)
- `FROM_EMAIL`

The service fails fast on startup if these rules are violated.
