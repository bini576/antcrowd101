# Admin Service

`admin-service` is the unified AntCrowd platform admin control plane.

## Structure

```text
services/admin-service/
├── frontend/     # Unified admin React app
├── backend/      # Reserved for future admin aggregation backend
├── Dockerfile    # Frontend container build
└── README.md
```

## Frontend

The frontend is the single source of truth for admin operations across:

- Pentesting
- VDP
- Training
- Researchers
- Organizations
- Payments
- Reports & Analytics
- Settings

Local Vite development runs on `5179`.

In the integrated stack, Traefik exposes the admin console at `http://localhost:8089/admin/`.

This console is for `platform_admin` role workflows only.
Organization VDP administrators use `services/vdp-service/frontend-admin` (default port `5285`) for organization-scoped program management.

## Proxy routing

The frontend uses Vite proxy routes for backend integration:

- `/api/pen/*` -> Pen backend
- `/api/vdp/*` -> VDP backend
- `/api/training/*` -> Training backend
- `/api/auth/*` -> Auth backend (platform-admin approvals for researchers and organizations)

Proxy targets can be overridden via:

- `VITE_PEN_PROXY_TARGET`
- `VITE_VDP_PROXY_TARGET`
- `VITE_TRAINING_PROXY_TARGET`
- `VITE_AUTH_PROXY_TARGET`
