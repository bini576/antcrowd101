## Organization VDP Admin Portal (Status Note)

`services/vdp-service/frontend-admin` is active as the organization-scoped VDP management workspace.
This file name remains `DEPRECATED.md` for historical compatibility, but the portal itself is **not deprecated**.

Role split:

- Platform admin global oversight: `services/admin-service/frontend` at `/admin/vdp`
- Organization VDP admin operations: `services/vdp-service/frontend-admin` at `http://localhost:5285`

This portal is intended for organization users to manage their own:

- profile and program setup
- scope and out-of-scope policy
- SLA and disclosure procedure
- report triage and comments
- publish/unpublish controls
