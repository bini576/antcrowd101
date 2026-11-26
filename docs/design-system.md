# ANTCROWD Design System

## Source Of Truth

The main `frontend` remains the visual reference for the platform:

- `Space Grotesk` for primary headings
- `Manrope` for interface copy
- Light SaaS surfaces with restrained shadows
- Orange accent for primary actions and active emphasis
- Soft lavender-gray backgrounds with white content surfaces

## Shared Library

Repo-level library: `/shared/ui`

Primary exports:

- `DashboardLayout`
- `Sidebar`
- `Navbar`
- `PageHeader`
- `Card`
- `DataTable`
- `FormField`
- `FormSection`
- `Modal`
- `StatWidget`
- `EmptyState`
- `LoadingState`
- `Badge`
- `Avatar`
- `brandAssets`

## Visual Tokens

- Background: `#f4f1f6` to `#efedf2`
- Surface: translucent white / white
- Border: `#ddd7e6`
- Body text: `#22212c`
- Secondary text: `#655f73`
- Accent: `#f97316`
- Accent dark: `#cc5b07`
- Success: `#0f8b50`
- Warning: `#c77a0a`
- Danger: `#c24141`

## Layout Rules

- Use `DashboardLayout` for scoped command-center pages and service dashboards.
- Use `Sidebar` for stable navigation or role context.
- Use `Navbar` for top-level actions, role transitions, and notification affordances.
- Use `PageHeader` for the first viewport summary with supporting image and KPI panel.
- Use `StatWidget` for headline operational numbers.
- Use `Card` for grouped content, not for entire page sections nested inside other cards.

## Image Rules

- Shared images are stored in `/assets/images`.
- UI code should import media through `brandAssets` from `/shared/ui/assets.ts`.
- Do not use root-absolute `/branding/...` references in scoped frontends.
- Do not hotlink external images.

## Current Application

The shared system is applied to:

- `frontend` organization dashboard
- `frontend` researcher dashboard and profile shell
- VDP org admin/public shells
- Training org/researcher visual headers
- Pen org/researcher asset handling and light workspace alignment
- Pen researcher profile editing surface
- Main researcher profile aggregation surface

## Profile Surface Pattern

- Use `Avatar` for identity photos and fallback initials.
- Use `StatWidget` for contribution, rating, and progress signals.
- Keep editable service-owned profile fields inside compact bordered form groups.
- Keep platform-owned identity and approval signals read-only.
- Show cross-service derived metrics, such as Training progress, as read-only cards rather than introducing duplicate edit forms.

## Compatibility Notes

- Service business logic, APIs, and role flows remain unchanged.
- The shared UI layer is consumed through Vite aliases rather than package publishing.
- Service-local shared modules remain in place where they already own API/session concerns.
