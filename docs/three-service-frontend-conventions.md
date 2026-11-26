# AntCrowd Frontend Conventions

Core domain services:

- `services/vdp-service`
- `services/pen-service`
- `services/training-service`

Unified admin control plane:

- `services/admin-service`

## Target Convention

Use this service layout going forward:

```text
services/<service>/
  backend/
  frontends/
    public/
    org/
    admin/
    researcher/
  shared-ui/
  shared-api/
  docs/
```

## Current Incremental Mapping

The current codebase is not fully renamed yet. Treat these folders as the role-aligned frontends:

- `vdp-service/frontend-public` -> `frontends/public`
- `vdp-service/frontend-admin` -> `frontends/org-admin` (organization VDP workspace)
- `pen-service/frontend` -> `frontends/org`
- `admin-service/frontend` -> `frontends/admin` (single platform-admin source)
- `pen-service/researcher-frontend` -> `frontends/researcher/internal`
- `pen-service/external-researcher-frontend` -> `frontends/researcher/external`
- `training-service/frontend-organization` -> `frontends/org`
- `training-service/frontend-researcher` -> `frontends/researcher`

Deprecated (not active in compose/CI):

- `training-service/frontend-platform`

## Applied Now

- Training now has shared frontend foundations:
  - `services/training-service/shared-ui`
  - `services/training-service/shared-api`
  - `services/training-service/shared-session`
- Unified platform-admin console now lives in:
  - `services/admin-service/frontend`
- CI and Docker builds were updated to support those shared folders.
- Main-frontend auth and role expectations are documented in:
  - `docs/main-frontend-integration.md`

## Next Rename Pass

When the team is ready for a folder rename, do it service by service instead of repo-wide:

1. Add `frontends/` inside one service.
2. Move the existing role folders into it.
3. Update Dockerfiles, workflows, and compose paths together.
4. Remove the old names only after the frontend builds pass.
