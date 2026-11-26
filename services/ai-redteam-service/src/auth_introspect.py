"""
Session-based authentication via AntCrowd auth-service introspection.

Reads the session cookie from the incoming request, calls the auth service's
introspection endpoint, and maps the returned account type / researcher subtype
to the internal role names used by this service.
"""

import os
from typing import Any

import requests
from fastapi import HTTPException, Request

AUTH_INTROSPECT_URL = os.getenv(
    "AUTH_SERVICE_INTROSPECT_URL",
    "http://auth-service:8080/session/introspect",
)
AUTH_SERVICE_TOKEN = os.getenv(
    "AUTH_INTERNAL_SERVICE_TOKEN",
    "antcrowd-internal-dev-token",
)
SESSION_COOKIE_NAME = os.getenv("AUTH_SESSION_COOKIE_NAME", "antcrowd_session")

# Login / logout URLs forwarded to frontends via /api/whoami
PLATFORM_LOGIN_URL = os.getenv("PLATFORM_LOGIN_URL", "/login")
PLATFORM_LOGOUT_URL = os.getenv("PLATFORM_LOGOUT_URL", "/api/auth/logout")


def _map_role(account_type: str, researcher_type: str | None) -> str:
    """Map auth-service identity to the four internal role names.

    - platform_admin  → platform_admin
    - organization    → org_admin
    - researcher + external → researcher
    - researcher + internal → researcher
    - anything else / missing → user
    """
    if account_type == "platform_admin":
        return "platform_admin"
    if account_type == "organization":
        return "org_admin"
    if account_type == "researcher":
        if researcher_type in ("external", "internal"):
            return "researcher"
        return "user"
    if account_type == "compliance_team":
        return "compliance_team"
    if account_type == "developer":
        return "developer"
    return "user"


def introspect_session(session_token: str) -> dict[str, Any] | None:
    """Call the auth service introspection endpoint.

    Returns the parsed JSON response on success, or None if the token
    is missing / invalid / the auth service is unreachable.
    """
    if not session_token:
        return None
    try:
        response = requests.post(
            AUTH_INTROSPECT_URL,
            json={"sessionToken": session_token},
            headers={
                "x-internal-service-token": AUTH_SERVICE_TOKEN,
                "Content-Type": "application/json",
            },
            timeout=5,
        )
        if response.status_code == 200:
            return response.json()
    except requests.RequestException:
        pass
    return None


class SessionUser:
    """Resolved session identity used throughout the service."""

    __slots__ = ("username", "role", "email", "display_name", "account_type", "researcher_type", "user_id")

    def __init__(
        self,
        username: str,
        role: str,
        email: str,
        display_name: str,
        account_type: str = "",
        researcher_type: str = "",
        user_id: str = "",
    ):
        self.username = username
        self.role = role
        self.email = email
        self.display_name = display_name
        self.account_type = account_type
        self.researcher_type = researcher_type
        self.user_id = user_id

    def to_dict(self) -> dict[str, str]:
        return {
            "username": self.username,
            "role": self.role,
            "email": self.email,
            "displayName": self.display_name,
        }


# Unauthenticated visitor
ANONYMOUS_USER = SessionUser(
    username="__anonymous__",
    role="user",
    email="",
    display_name="Public Visitor",
)


def resolve_session(request: Request) -> SessionUser:
    """FastAPI dependency — resolve the current session to a SessionUser.

    Returns ANONYMOUS_USER when there is no valid session cookie.
    Never raises; unauthenticated visitors get the 'user' role.
    """
    session_token = request.cookies.get(SESSION_COOKIE_NAME, "")
    if not session_token:
        return ANONYMOUS_USER

    data = introspect_session(session_token)
    if data is None:
        return ANONYMOUS_USER

    user_data = data.get("user", {})
    identity = data.get("identity", {})

    # Seeded platform-admin accounts may carry the role at the response root as
    # `platformRole` rather than as `accountType` inside identity/user — mirror
    # the same fallback that was added to vdp-service/handlers/auth.go.
    account_type = (
        identity.get("accountType")
        or user_data.get("accountType")
        or data.get("platformRole")
        or ""
    )
    researcher_type = identity.get("researcherType") or user_data.get("researcherType", "")
    email = identity.get("email") or user_data.get("email", "")
    first_name = user_data.get("firstName", "")
    last_name = user_data.get("lastName", "")
    display = user_data.get("displayName", "")
    user_id = identity.get("userId") or user_data.get("id", "")

    role = _map_role(account_type, researcher_type)

    # Platform role assignment overrides the researcher base role.
    # e.g. a researcher with platformRole="compliance_team" is a GRC lead and
    # must be allowed compliance_team access across all services.
    platform_role_override = data.get("platformRole", "")
    if platform_role_override in ("compliance_team", "developer", "platform_admin"):
        role = platform_role_override

    # If role still resolves to 'user' (unauthenticated view), return anonymous
    if role == "user":
        return ANONYMOUS_USER

    # Build a human-friendly display name
    if display:
        display_name = display
    elif first_name and last_name:
        display_name = f"{first_name} {last_name}"
    else:
        display_name = email

    return SessionUser(
        username=email,
        role=role,
        email=email,
        display_name=display_name,
        account_type=account_type,
        researcher_type=researcher_type,
        user_id=user_id,
    )


def require_authenticated(session_user: SessionUser) -> SessionUser:
    """Raise 401 if the session user is anonymous."""
    if session_user is ANONYMOUS_USER or session_user.role == "user":
        raise HTTPException(status_code=401, detail="Authentication required")
    return session_user


def require_platform_admin(session_user: SessionUser) -> SessionUser:
    """Raise 403 if the session user is not a platform admin."""
    require_authenticated(session_user)
    if session_user.role != "platform_admin":
        raise HTTPException(status_code=403, detail="Platform admin access required")
    return session_user
