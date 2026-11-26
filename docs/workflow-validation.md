# ANTCROWD Workflow Validation

## Baseline

This document tracks the baseline workflow inventory, defects, fixes, and final validation for the scoped modernization effort.

## Canonical Roles

- `platform_admin`
- `organization`
- `researcher_internal`
- `researcher_external`

## Baseline Workflow Inventory

### Organization Dashboard (`frontend`)

- Launches live workspaces for Pen, VDP, and Training.
- Uses authenticated organization session and workspace overview aggregation.
- Needs design alignment and service summary polish, but core launch behavior already exists.

### Researcher Dashboards (`frontend`)

- Internal researchers can launch Pen and Training workspaces.
- External researchers can launch the Pen workspace.
- Current profile and settings experience is minimal compared with the rest of the platform.

### VDP Service

Validated baseline routes and capabilities:

- Org admin profile
- Program setup
- Report triage
- Metrics
- Notifications
- Public disclosure landing
- Public submission flow
- Researcher/public report tracking

Known baseline gaps:

- Branding and image assets use root-absolute paths in places where workspace subpaths are required.
- Org/public shells are visually inconsistent with the main frontend.

### Pen Service

Validated baseline routes and capabilities:

- Organization dashboard and metrics
- Engagement creation
- Internal assignment requests
- External researcher assignment
- Findings submission
- Findings review
- Notifications
- Invitations
- Researcher earnings

Known baseline gaps:

- Researcher profile endpoint is read-only and limited to basic identity data.
- Organization and researcher shells are visually inconsistent with the main frontend.
- Asset paths should be made subpath-safe.

### Training Service

Validated baseline routes and capabilities:

- Organization training request creation
- Package selection
- Quote and invoice review
- Receipt upload
- Internal researcher assignment
- Training plan tracking
- Report delivery
- Organization feedback

Known baseline gaps:

- Progress is implicit in workflow status and report metrics, not surfaced clearly in the broader ANTCROWD experience.
- Frontend shells still read as separate products instead of one unified platform.
- Asset loading needs the same subpath-safe treatment as the other workspaces.

## Baseline Defects Confirmed

1. Root-absolute asset references such as `/branding/antcrowd-logo.png` are unsafe for workspace deployments served under `/workspace/...`.
2. Shared branding photos exist, but each service duplicates usage patterns and resolves assets differently.
3. The main `frontend` researcher profile page is not yet connected to a service-owned editable profile model.
4. The scoped dashboards do not yet share a repo-level design system.

## Validation Targets For Final Pass

- Organization dashboard launches all scoped workspaces correctly.
- Internal and external researcher dashboards route to the correct service workspaces.
- VDP create -> submit -> triage lifecycle works with modernized UI.
- Pen request -> assignment -> findings -> review workflow remains intact.
- Training request -> assignment -> plan -> report -> feedback workflow remains intact.
- All scoped logos and imagery render in dev and built workspace paths.
- No scoped frontend depends on root-domain `/branding/...` asset resolution.

## Final Validation

### Image Loading Root Cause And Fix

Root cause:

1. Several scoped frontends relied on root-absolute asset paths such as `/branding/antcrowd-logo.png`.
2. The scoped services are deployed under workspace subpaths like `/workspace/pen/internal/`, `/workspace/vdp/org/`, and `/workspace/training/researcher/`.
3. Root-absolute branding paths bypassed Vite's bundled asset resolution and broke in built workspace deployments.

Fix:

1. Added repo-level shared assets in `/assets/images`.
2. Added `brandAssets` in `/shared/ui/assets.ts`.
3. Replaced scoped runtime asset references with imported asset URLs consumed through the `@ant-ui` alias.
4. Kept the existing Docker/static serving architecture intact and fixed only asset resolution behavior.

Result:

- Logos now bundle into each scoped frontend build.
- Shared images remain available in both local dev and production builds.
- No scoped runtime frontend still depends on root-domain `/branding/...` asset paths.

### VDP Workflow Validation

Validated against the existing implementation:

- Organization admin program creation remains in place.
- Public vulnerability intake remains in place.
- Report lifecycle, triage, comments, attachments, metrics, and notifications remain in place.
- Admin/public shells now share the main ANTCROWD visual language without changing route or API ownership.

Changes made:

- UI shell modernization only.
- Asset-loading hardening only.

### Pen Workflow Validation

Validated against the existing implementation:

- Organization engagement creation remains in place.
- Internal assignment requests remain in place.
- External researcher assignment/invitation flow remains in place.
- Findings submission and admin review remain in place.
- Notifications and earnings remain in place.

Upgrades added without replacing the workflow:

- `GET /api/researcher/profile` now returns the richer additive profile model.
- `PATCH /api/researcher/profile` updates service-owned researcher fields.
- `POST /api/researcher/profile/photo` stores profile-photo metadata and returns the updated profile.
- Main researcher profile experience now aggregates Pen profile data while preserving the central auth identity model.

Role validation:

- `platform_admin`: unchanged admin authority in Pen org flow.
- `organization`: unchanged engagement ownership and review access.
- `researcher_internal`: unchanged assignment gate, plus editable profile support.
- `researcher_external`: unchanged assignment gate, plus editable profile support.

### Training Workflow Validation

Validated against the existing implementation:

- Organization request creation remains in place.
- Quote and invoice approval flow remains in place.
- Internal researcher assignment remains in place.
- Training plan creation remains in place.
- Report delivery and organization feedback remain in place.

Upgrades added without replacing the workflow:

- Progress is now surfaced as a read-only aggregate derived from requests, plans, and reports.
- Internal researcher profile pages can show assigned requests, scheduled plans, submitted reports, average improvement, attendance, and organization rating.
- No LMS-style course/enrollment schema was introduced.

### Main Frontend Dashboard Validation

- Organization dashboard still acts as the launch surface for Pen, VDP, and Training workspaces.
- Internal researchers still route into Pen and Training.
- External researchers still route into Pen only.
- The researcher profile view is now service-aware instead of remaining a placeholder summary.

### Local Verification Completed

Scoped frontend builds completed successfully:

- `frontend`
- `services/vdp-service/frontend-admin`
- `services/vdp-service/frontend-public`
- `services/pen-service/frontend`
- `services/pen-service/researcher-frontend`
- `services/pen-service/external-researcher-frontend`
- `services/training-service/frontend-organization`
- `services/training-service/frontend-researcher`

Containerized Go validation completed successfully:

- `services/pen-service/backend`: `go test ./...`
- `services/pen-service/researcher-backend`: `go test ./...`

Residual note:

- Training backend Python test automation remains outside this pass because the local environment is not provisioned for that stack by default, but the active Training frontends still build successfully against the preserved request/plan/report workflow.
