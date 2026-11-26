import json
import re
import urllib.error
import urllib.request
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.api.deps import get_db_session
from app.models.organization import Organization
from app.models.user import User
from app.schemas.user import Token, UserLogin
from app.security import create_access_token, get_password_hash, verify_password
from app.settings import settings

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=Token)
def login(payload: UserLogin, db: Session = Depends(get_db_session)) -> Token:
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    return Token(access_token=create_access_token(subject=str(user.id)))


def _slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.strip().lower()).strip("-")
    return slug or "organization"


def _unique_org_slug(db: Session, base: str) -> str:
    slug = _slugify(base)
    candidate = slug
    suffix = 2
    while db.query(Organization).filter(Organization.slug == candidate).first():
        candidate = f"{slug}-{suffix}"
        suffix += 1
    return candidate


def _display_name(user_data: dict, identity: dict) -> str:
    display = str(user_data.get("displayName") or "").strip()
    if display:
        return display
    first = str(user_data.get("firstName") or "").strip()
    last = str(user_data.get("lastName") or "").strip()
    if first or last:
        return f"{first} {last}".strip()
    return str(identity.get("email") or user_data.get("email") or "GRC User")


@router.post("/platform/bootstrap", response_model=Token)
def platform_bootstrap(request: Request, db: Session = Depends(get_db_session)) -> Token:
    session_token = request.cookies.get(settings.AUTH_SESSION_COOKIE_NAME, "")
    if not session_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Platform session cookie is required")

    body = json.dumps({"sessionToken": session_token}).encode("utf-8")
    introspect_request = urllib.request.Request(
        settings.AUTH_SERVICE_INTROSPECT_URL,
        data=body,
        headers={
            "x-internal-service-token": settings.AUTH_INTERNAL_SERVICE_TOKEN,
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(introspect_request, timeout=5) as response:
            status_code = response.status
            response_body = response.read().decode("utf-8")
    except urllib.error.HTTPError as exc:
        status_code = exc.code
        response_body = exc.read().decode("utf-8")
    except urllib.error.URLError:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Auth service is unavailable")

    if status_code != 200:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Platform session is invalid")

    try:
        data = json.loads(response_body or "{}")
    except json.JSONDecodeError:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Auth service returned an invalid introspection response",
        )
    user_data = data.get("user", {})
    identity = data.get("identity", {})
    account_type = identity.get("accountType") or user_data.get("accountType")
    platform_role = user_data.get("platformRole") or identity.get("platformRole") or ""
    if account_type not in {"organization", "platform_admin"} and platform_role != "compliance_team":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="GRC workspace requires organization, platform admin, or compliance team access")

    email = str(identity.get("email") or user_data.get("email") or "").strip().lower()
    if not email:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Platform identity is missing an email")

    org_payload = user_data.get("organization") or {}
    org_name = str(org_payload.get("name") or "AntCrowd GRC Workspace").strip()
    org_slug = str(org_payload.get("slug") or "").strip() or _slugify(org_name)
    organization = db.query(Organization).filter(Organization.slug == org_slug).first()
    if not organization:
        organization = db.query(Organization).filter(Organization.name == org_name).first()
    if not organization:
        organization = Organization(name=org_name, slug=_unique_org_slug(db, org_name))
        db.add(organization)
        db.flush()

    user = db.query(User).filter(User.email == email).first()
    if not user:
        user = User(
            email=email,
            full_name=_display_name(user_data, identity),
            hashed_password=get_password_hash(f"platform-session:{email}"),
            is_active=True,
            organization_id=organization.id,
        )
        db.add(user)
    else:
        user.full_name = _display_name(user_data, identity)
        user.organization_id = organization.id
        user.is_active = True

    db.commit()
    db.refresh(user)
    return Token(access_token=create_access_token(subject=str(user.id)))
