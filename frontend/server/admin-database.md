# Admin Database Plan

This repo currently has the admin workspace UI in React and the admin API in Go, but the Go handlers still keep most admin data in memory.

## Target Flow

`frontend` -> `src/services/adminApi.ts` -> `server/admin-api.go` -> database

## What The Database Stores

- Admin login accounts and roles
- Bearer sessions for admin sign-in
- Trust center requests submitted by customers
- Managed users shown in the admin panel
- Records/evidence shown in the admin panel
- Append-only audit events for every admin action
- Role-to-permission mapping for access control

## Tables

- `admin_roles`
- `admin_permissions`
- `admin_role_permissions`
- `admin_accounts`
- `admin_sessions`
- `trust_center_requests`
- `admin_users`
- `admin_records`
- `admin_audit_events`

## How The Current UI Maps

- `src/pages/AdminPanel.tsx` loads a bootstrap payload containing the admin profile, requests, users, records, and audit log.
- `src/services/adminApi.ts` already matches the intended API surface.
- The backend should replace the current in-memory slices with database queries and writes.

## Recommended Backend Behavior

- `POST /api/admin/auth/login` verifies against `admin_accounts` and creates a row in `admin_sessions`.
- `GET /api/admin/bootstrap` loads the dashboard payload from the database.
- `PUT/DELETE /api/admin/requests/:id` mutates `trust_center_requests` and appends an audit event.
- `POST/PUT/DELETE /api/admin/users` mutates `admin_users` and appends an audit event.
- `POST/PUT/DELETE /api/admin/records` mutates `admin_records` and appends an audit event.
- `GET /api/admin/audit` reads from `admin_audit_events`.

## Notes

- The schema in `server/admin-schema.sql` is PostgreSQL-oriented.
- Passwords should be stored as hashes, not plaintext.
- Audit events should be append-only.
- If you want, the next step is to turn the Go handlers into a real repository layer that reads and writes these tables.
