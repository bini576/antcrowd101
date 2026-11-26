# AntCrowd Auth Integration

## Canonical actors

- `platform_admin`
- `organization`
- `researcher` with `researcherType=internal`
- `researcher` with `researcherType=external`

Code and UI should use `organization` and `researcher` consistently. Avoid mixing in legacy terms like `client`, `customer_admin`, or `hacker` at the auth boundary.

## Onboarding rules

- Organizations: self-register, verify email, sign in, and invite teammates.
- External researchers: self-register, verify email, submit National ID plus certification evidence, then wait for platform-admin approval.
- Internal researchers: invite-only. They activate from email, sign in, submit verification evidence, and wait for platform-admin approval.
- Platform admins: bootstrap or invite only.

## Shared identity contract

The auth service is the source of truth for cross-service identity.

- Browser session: HttpOnly cookie `antcrowd_session`
- CSRF protection: double-submit cookie `antcrowd_csrf` plus `X-CSRF-Token`
- Service introspection: `POST /api/auth/session/introspect` with `X-Internal-Service-Token`

`/session/introspect` returns:

```json
{
  "identity": {
    "userId": "usr_123",
    "email": "researcher@example.com",
    "accountType": "researcher",
    "researcherType": "external",
    "approvalStatus": "approved",
    "organizationId": null,
    "organizationRole": null,
    "emailVerified": true,
    "twoFactorEnabled": true
  },
  "headers": {
    "x-antcrowd-user-id": "usr_123",
    "x-antcrowd-account-type": "researcher",
    "x-antcrowd-researcher-type": "external",
    "x-antcrowd-approval-status": "approved"
  }
}
```

## Security controls

- Login blocked until email verification completes.
- Email verification uses a short-lived one-time numeric code sent by email (default: 6 digits, 10 minutes, max 5 attempts).
- Password reset uses time-limited hashed tokens.
- TOTP 2FA uses `otplib` and QR provisioning.
- Researcher verification documents are stored through the auth storage layer and downloaded only by the owning researcher or a platform admin.
- Auth audit events capture registration, verification, login, reset, invites, approval, and 2FA state changes.

## Email providers

- Production default: Brevo SMTP
- Local fallback: Mailpit

Switch with `AUTH_EMAIL_PROVIDER=brevo` or `AUTH_EMAIL_PROVIDER=mailpit`.
For Brevo, use the SMTP Login from Brevo (`SMTP & API -> SMTP`) in `AUTH_SMTP_USER`; it must be in the format `xxxxxxxx@smtp-brevo.com` and is different from your normal Brevo login email.
