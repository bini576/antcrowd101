# Main Frontend Integration Contract

This repository branch prepares only these owned services for a shared `main frontend`:

- `services/vdp-service`
- `services/pen-service`
- `services/training-service`

## Canonical Roles

Use these role names at the integration boundary:

- `platform_admin`
- `organization`
- `researcher_internal`
- `researcher_external`

Services may still keep legacy internal role values in storage, but shared auth responses should expose these canonical identities.

## Auth Contract

The shared auth service should expose these concepts:

- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/register`
- `POST /api/auth/session/introspect`

Current service bases:

- Main frontend auth gateway: `/api/auth/*`
- Downstream services should trust identity from auth-service instead of keeping independent primary auth flows.

## Login Response Shape

The main frontend should expect this shape:

```json
{
  "user": {
    "id": "user-id",
    "email": "user@example.com",
    "firstName": "User",
    "lastName": "Name",
    "accountType": "organization",
    "researcherType": null,
    "approvalStatus": "not_required",
    "organization_id": "org-id-or-null",
    "organization_role": "owner"
  }
}
```

Notes:

- Services should consume the auth-service session cookie or introspection response rather than minting their own first-class login model.

## Provisioning Model

Use this onboarding model:

- `platform_admin`: invite or bootstrap only
- `organization`: self-register or invite
- `researcher_internal`: invite-only
- `researcher_external`: self-register with approval workflow

Current implementation state:

- Organizations self-register in the auth service and then launch downstream services.
- Internal researchers are invited by platform admins.
- External researchers self-register, verify email, and submit verification evidence for approval.

## Module Access Map

- `platform_admin` -> `["vdp", "pen", "training"]`
- `organization` -> one or more of `["vdp", "pen", "training", "trust-center", "bug-bounty"]`
- `researcher_internal` -> `["pen", "training", "trust-center"]`
- `researcher_external` -> `["pen", "bug-bounty", "challenge"]`

## Main Frontend Responsibilities

The shared main frontend should:

1. authenticate once
2. store the shared session cookie
3. call `/api/auth/me` and route users by canonical identity
4. hide modules the user cannot access
5. use `/api/auth/session/introspect` when a backend service needs normalized identity

## Backend Responsibilities

Each service must still enforce authorization server-side. The main frontend is only a UX gate, not a security boundary.
