# Changelog

## Phase 1 - Analysis Baseline

- Added `IMPLEMENTATION_ANALYSIS.md` with scoped implementation status classification.
- Added baseline `WORKFLOW_VALIDATION.md` with current routes, roles, gaps, and validation targets.
- Established the modernization baseline before UI, workflow, or schema changes.

## Phase 2 - Shared Design System Alignment

- Added repo-level `/shared/ui` with reusable dashboard layout, navigation, card, state, and table primitives.
- Added `/assets/images` as the shared local source for ANTCROWD branding and photography.
- Wired `frontend`, VDP, Pen, and Training frontends to the shared UI layer through Vite aliases.
- Modernized the main organization and researcher dashboards plus the VDP shells around the shared visual system.
- Replaced scoped hotlinked and root-absolute image usage with imported local assets in the modernized surfaces.

## Phase 3 - Modern Visual Experience

- Reused shared local ANTCROWD imagery across dashboard headers, landing surfaces, and empty-state-adjacent visual panels.
- Standardized responsive image handling through `brandAssets` so scoped services bundle media locally instead of hotlinking.
- Extended the modernized visuals into Pen researcher workspaces and Training researcher/profile surfaces.

## Phase 4 - Image Loading Audit And Workflow Validation

- Confirmed the root cause of broken logos/images was root-absolute `/branding/...` usage under workspace subpaths such as `/workspace/vdp/org/`.
- Normalized scoped frontends to import assets through `@ant-ui` instead of assuming domain-root static paths.
- Validated VDP, Pen, and Training workflow routes against their existing APIs and role gates without rebuilding the underlying logic.
- Verified all scoped frontends still build successfully after the asset and shell changes.

## Phase 5 - Researcher Profile Upgrade

- Added additive `pen_researcher_profiles` schema support in the Pen backends without replacing existing researcher records.
- Extended the Pen researcher API with editable profile updates and profile photo upload support.
- Added reputation stats, submission counts, bio, phone, specialization, experience level, and social links to the Pen researcher profile surface.
- Connected the main `frontend` researcher profile to the Pen profile API and surfaced read-only Training progress for internal researchers.

## Phase 6 - Safe Scoped Cleanup

- Moved the deprecated Training platform frontend to `archive_future_use/services/training-service/frontend-platform`.
- Updated scoped Training service docs to reflect the archive move and removed stale ignore rules for the old in-place directory.
- Recorded active, partially used, future, and cleanup-safe items in `CLEANUP_REPORT.md`.

## Phase 7 - Final Quality Pass

- Rebuilt all scoped frontends successfully after the final profile and cleanup changes.
- Ran containerized Go tests for `services/pen-service/backend` and `services/pen-service/researcher-backend`.
- Finalized the analysis, workflow validation, design-system, cleanup, and changelog documentation for the scoped modernization pass.
