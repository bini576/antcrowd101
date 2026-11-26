# ANTCROWD Unified UI Redesign

## Objective

Reposition ANTCROWD as a single enterprise cybersecurity platform UI while preserving the current backend contract:

- Existing backend services stay in place
- API paths stay unchanged
- Authentication and role rules stay unchanged
- Database models stay unchanged
- Existing route entrypoints stay unchanged

## Layout Architecture

The platform now centers on one shell language:

- `Sidebar`
  Role identity, primary navigation, trust posture, module context
- `Topbar`
  Global brand, current workspace label, fast actions, operator shortcuts
- `Content Area`
  Page header, metrics strip, module overview, tables, activity, queue-driven work

Shared shell implementation lives in `shared/ui` and is consumed by the main frontend plus service portals where the app already supports shared imports.

## Global Design System

Core brand system:

- Dark operational background
- Red ANTCROWD accent derived from the official logo
- Neutral slate surfaces for enterprise density
- White/high-contrast text for dashboard scanning
- Official mark and wordmark packaged in `shared/ui/assets.ts`

Shared components:

- `DashboardLayout`
- `Sidebar`
- `Navbar`
- `PageHeader`
- `Card`
- `StatWidget`
- `DataTable`
- `Badge`
- `Avatar`
- `EmptyState`
- `LoadingState`
- `Modal`

The shared styles live in `shared/ui/styles.css` and act as the source of truth for shell tokens, spacing, borders, table styling, states, and brand treatment.

## Role-Based Platform Model

The UI model is role-aware, not app-fragmented.

Organization operators:

- `/organization/workspace`
- Same shell, org-specific modules
- Cross-service overview for Pentest, VDP, and Training

Internal researchers:

- `/dashboard/internal`
- Same shell, internal-only module access
- Pentest + training visibility

External researchers:

- `/dashboard/external`
- Same shell, external-only module access
- Pentest-focused workflow surface

Service portals keep their existing routes and bootstrapping, but now inherit the same visual system so they read as ANTCROWD modules instead of separate products.

## Shared Dashboard Structure

Each primary dashboard follows the same information model:

1. Command header
   Role, workspace identity, security posture, primary actions
2. Metrics strip
   High-signal counters and health indicators
3. Module overview
   Pentest, VDP, Training entry modules with live status
4. Reports or operational table
   Structured tabular work queue
5. Activity feed
   Recent cross-service events
6. Attention queue
   Immediate actions, SLA pressure, pending decisions

## UI Structure Examples

Organization command center:

- Header with organization identity and trust posture
- Live modules: Pentest, VDP, Training
- Operational summary cards
- Immediate follow-up queue
- Cross-service activity timeline

Researcher command center:

- Header with role and approval posture
- Role-available modules only
- Workload metrics
- Recent updates
- Launch matrix for live and staged services

VDP organization module:

- Same ANTCROWD shell
- Disclosure policy, triage, metrics, notifications
- Dark branded service workspace rather than standalone utility UI

Training organization and trainer modules:

- Same brand language at login and in-session
- Request, quote, invoice, plan, and report flows remain backed by existing service APIs

Pentest organization and researcher modules:

- Same dark operational identity
- Shared surface language for engagements, findings, assignments, payouts, and inbox activity

## Backend Integration Approach

No backend redesign was introduced.

Main platform aggregation:

- `frontend/src/hooks/useWorkspaceOverview.ts`
- `frontend/src/services/workspaceSnapshots.ts`

This layer keeps the current bootstrap flow:

- Pentest via `/api/pen/api/auth/bootstrap`
- VDP via `/api/vdp/auth/bootstrap`
- Training via `/api/training/auth/bootstrap`

Existing service clients remain intact:

- Main frontend auth and routing still use `frontend/src/services/authApi.ts`
- VDP portals keep `services/vdp-service/frontend-*/src/services/api.js`
- Pentest portals keep `services/pen-service/*/src/api.js`
- Training portals keep `services/training-service/shared-api/*`

Session and routing behavior remain unchanged:

- Existing basenames remain in each Vite app
- Existing role guards stay in place
- Existing service handoff routes remain the bridge between platform shell and module workspaces

## Implementation Notes

Brand asset packaging:

- `assets/images/antcrowd-mark-official.png`
- `assets/images/antcrowd-wordmark-official.png`

Primary system changes:

- `shared/ui/styles.css`
- `shared/ui/assets.ts`
- `shared/ui/components/Navbar.tsx`
- `shared/ui/components/Sidebar.tsx`
- `shared/ui/components/DashboardLayout.tsx`

Platform shell consumers updated:

- `frontend/src/pages/CompanyOnboarding.tsx`
- `frontend/src/pages/researcher/ResearcherPages.tsx`
- `services/vdp-service/frontend-admin/src/layouts/AdminLayout.jsx`
- `services/vdp-service/frontend-public/src/layouts/PublicLayout.jsx`
- `services/training-service/shared-ui/*`
- `services/pen-service/*/src/base.css`
- `services/pen-service/*/src/styles.css`
- `services/vdp-service/frontend-*/src/styles.css`

## Result

ANTCROWD now presents as one enterprise cybersecurity platform with role-aware surfaces, shared branding, and consistent module behavior, while still relying on the current backend services and API contracts.
