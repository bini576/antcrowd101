"""
Session-based authentication via AntCrowd auth-service introspection.

Reads the session cookie from the incoming request, calls the auth service's
introspection endpoint, and maps the returned account type to the internal
role names used by the trust service.

Roles in this service:
  - platform_admin  → full platform management
  - org_admin       → manage own organization trust content
  - user            → public visitor (unauthenticated or researcher)
"""

import os
from typing import Any

import requests
from fastapi import HTTPException, Request

from app.settings import settings

AUTH_INTROSPECT_URL = settings.AUTH_SERVICE_INTROSPECT_URL
AUTH_SERVICE_TOKEN = settings.AUTH_INTERNAL_SERVICE_TOKEN
SESSION_COOKIE_NAME = settings.AUTH_SESSION_COOKIE_NAME
PLATFORM_LOGIN_URL = settings.PLATFORM_LOGIN_URL
PLATFORM_LOGOUT_URL = settings.PLATFORM_LOGOUT_URL


def _map_role(account_type: str, researcher_type: str | None, platform_role: str | None = None) -> str:
    """Map auth-service identity to internal role names.

    - platform_admin  → platform_admin
    - organization    → org_admin
    - compliance_team platformRole → compliance_team
    - researcher      → user  (researchers don't have a role in trust service)
    - anything else   → user
    """
    if account_type == "platform_admin":
        return "platform_admin"
    if platform_role == "compliance_team":
        return "compliance_team"
    if account_type == "organization":
        return "org_admin"
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

    __slots__ = ("username", "role", "email", "display_name", "account_type", "user_id", "org_id", "platform_role")

    def __init__(
        self,
        username: str,
        role: str,
        email: str,
        display_name: str,
        account_type: str = "",
        user_id: str = "",
        org_id: str = "",
        platform_role: str = "",
    ):
        self.username = username
        self.role = role
        self.email = email
        self.display_name = display_name
        self.account_type = account_type
        self.user_id = user_id
        self.org_id = org_id
        self.platform_role = platform_role

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

    account_type = identity.get("accountType") or user_data.get("accountType", "")
    researcher_type = identity.get("researcherType") or user_data.get("researcherType", "")
    email = identity.get("email") or user_data.get("email", "")
    first_name = user_data.get("firstName", "")
    last_name = user_data.get("lastName", "")
    display = user_data.get("displayName", "")
    user_id = identity.get("userId") or user_data.get("id", "")
    org_id = user_data.get("organizationId", "") or identity.get("organizationId", "")
    platform_role = data.get("platformRole") or ""

    role = _map_role(account_type, researcher_type, platform_role or None)

    # If role resolves to 'user' (public visitor), return anonymous
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
        user_id=user_id,
        org_id=org_id,
        platform_role=platform_role,
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


def require_org_admin(session_user: SessionUser) -> SessionUser:
    """Raise 403 if the session user is not an org admin."""
    require_authenticated(session_user)
    if session_user.role != "org_admin":
        raise HTTPException(status_code=403, detail="Organization admin access required")
    return session_user
