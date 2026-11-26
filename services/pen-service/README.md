# Pen Service

AntCrowd Penetration Testing as a Service (PTaaS) with separate organization and researcher portals, JWT RBAC, lifecycle governance, assignment controls, triage metrics, and export/reporting.

## Service endpoints

- Organization portal: `http://localhost:5276`
- Internal researcher portal: `http://localhost:5277`
- External researcher portal: `http://localhost:5278`
- Platform admin portal: `http://localhost:5279`
- Organization/Admin API: `http://localhost:8106`
- Researcher API: `http://localhost:8107`

## Default demo credentials (portal mapping)

- Organization admin:
  - email: `org-admin@antcrowd.local`
  - password: `Antcrowd123!`
- Platform admin:
  - email: `platform-admin@antcrowd.local`
  - password: `Antcrowd123!`
- Internal researcher:
  - email: `internal1@antcrowd.local`
  - password: `Antcrowd123!`
- External researcher:
  - email: `alpha@crowd.local`
  - password: `Antcrowd123!`

## Operating model

1. Organization creates engagement with lifecycle: `draft -> active -> in_retest -> closed`.
2. Organization selects researcher pool:
   - `external`: org assigns external researcher directly.
   - `internal`: org submits request, platform admin assigns internal researcher from admin portal.
3. Researchers see only assigned active/retest engagements.
4. Findings include evidence metadata (`evidenceUrl`, `assetPath`, `cwe`) and duplicate hints.
5. SLA is tracked via `sla_due_at` and breach detection.

## Security and governance

- JWT authentication and role-based access:
  - `platform_admin`
  - `organization_admin` (legacy internal storage may still use `org_admin`)
  - `researcher_internal`
  - `researcher_external`
- Auth payload compatibility:
  - login returns `access_token`, `token_type`, and legacy `token`
  - auth user payloads expose canonical `role`
- Organization ownership model:
  - `pen_organizations`
  - `organization_id` on engagements/researchers/users
- Audit trail:
  - `pen_audit_events`
- Notification feed:
  - `pen_notifications`
- Application review workflow:
  - `GET /api/applications` with optional `engagementId` / `status`
  - `PATCH /api/applications/{id}/status`
- Researcher invitation workflow:
  - org sends invite via `POST /api/invitations`
  - researcher portal reads `GET /api/researcher/invitations`
  - researcher responds via `POST /api/researcher/invitations/{id}/respond` with `accepted` or `declined`

## Reporting and metrics

- CSV export per engagement:
  - `GET /api/engagements/{id}/report.csv`
- Metrics endpoint:
  - `GET /api/metrics` (MTTA, MTTR, SLA breaches, severity mix)

## Run with single compose file (`infra/docker-compose.yml`)

```bash
cd infra
docker compose up --build -d \
  pen-service-backend pen-researcher-backend \
  pen-service-frontend admin-service-frontend \
  pen-researcher-frontend pen-external-researcher-frontend
```

## Smoke test

```bash
curl http://localhost:8106/health
curl http://localhost:8106/ready
curl http://localhost:8107/health
curl http://localhost:8107/ready
```

For production/staging deployments, set secure JWT values (`JWT_SECRET`) and `APP_ENV=production` (or `staging`). Startup is blocked if default JWT secret values are used.

## Branding

Brand assets are imported from the repo-level shared library:

- `/assets/images`
- `/shared/ui/assets.ts`

Avoid root-absolute `/branding/...` references in scoped frontends. Workspace deployments are served from `/workspace/...` subpaths and rely on imported asset URLs instead.

## Shared UI design system

- Canonical shared stylesheet:
  - `services/pen-service/ui/base.css`
- Synced copies used by each portal:
  - `frontend/src/base.css`
  - `researcher-frontend/src/base.css`
  - `external-researcher-frontend/src/base.css`
- Sync command after changing `ui/base.css`:

```bash
bash services/pen-service/ui/sync-base-css.sh
```
