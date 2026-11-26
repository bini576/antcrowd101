import json
from urllib import error as urllib_error
from urllib import request as urllib_request

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth_contract import parse_requested_role, serialize_user
from app.core.config import settings
from app.dependencies import get_current_user, get_db, require_roles
from app.models import Organization, Trainer, User, UserRole
from app.schemas import LoginRequest, RegisterRequest, Token, UserRead
from app.services.auth import create_access_token, hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])


def _platform_session_token(request: Request) -> str:
    auth_header = request.headers.get("authorization", "").strip()
    if auth_header.lower().startswith("bearer "):
        token = auth_header[7:].strip()
        if token:
            return token
    return request.cookies.get(settings.auth_session_cookie_name, "").strip()


def _read_platform_introspection_error(exc: urllib_error.HTTPError) -> str:
    try:
        payload = json.loads(exc.read().decode("utf-8"))
        if isinstance(payload, dict):
            detail = payload.get("message") or payload.get("error")
            if isinstance(detail, str) and detail.strip():
                return detail
    except Exception:
        pass
    return "Your AntCrowd session is no longer valid"


def _introspect_platform_user(request: Request) -> dict:
    session_token = _platform_session_token(request)
    if not session_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Sign in through AntCrowd first")

    body = json.dumps({"sessionToken": session_token}).encode("utf-8")
    introspect_request = urllib_request.Request(
        settings.auth_service_introspect_url,
        data=body,
        method="POST",
        headers={
            "Content-Type": "application/json",
            "X-Internal-Service-Token": settings.auth_internal_service_token,
        },
    )

    try:
        with urllib_request.urlopen(introspect_request, timeout=5) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except urllib_error.HTTPError as exc:
        detail = _read_platform_introspection_error(exc)
        status_code = exc.code if exc.code in (401, 403) else status.HTTP_502_BAD_GATEWAY
        raise HTTPException(status_code=status_code, detail=detail) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Unable to confirm your AntCrowd session right now",
        ) from exc

    user = payload.get("user")
    if not isinstance(user, dict):
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Invalid AntCrowd session response")
    return user


def _platform_full_name(user: dict) -> str:
    first_name = str(user.get("firstName") or "").strip()
    last_name = str(user.get("lastName") or "").strip()
    combined = f"{first_name} {last_name}".strip()
    if combined:
        return combined
    display_name = str(user.get("displayName") or "").strip()
    if display_name:
        return display_name
    return str(user.get("email") or "").strip()


def _ensure_training_organization(db: Session, platform_user: dict) -> Organization:
    org_summary = platform_user.get("organization") or {}
    org_name = str(org_summary.get("name") or "").strip() or "AntCrowd Organization"
    owner_email = str(platform_user.get("email") or "").strip().lower()
    contact_person = _platform_full_name(platform_user)

    org = db.query(Organization).filter(Organization.contact_email == owner_email).first()
    if not org:
        org = Organization(
            name=org_name,
            sector="Technology",
            contact_person=contact_person,
            contact_email=owner_email,
            phone="+251-000-000-000",
            address="AntCrowd organization workspace",
        )
        db.add(org)
        db.flush()
        return org

    org.name = org_name
    org.contact_person = contact_person
    org.phone = org.phone or "+251-000-000-000"
    org.address = org.address or "AntCrowd organization workspace"
    return org


def _ensure_trainer(db: Session, platform_user: dict) -> Trainer:
    trainer_email = str(platform_user.get("email") or "").strip().lower()
    trainer_name = _platform_full_name(platform_user)
    default_expertise = "Application Security, Internal Security Operations, Security Readiness"

    trainer = db.query(Trainer).filter(Trainer.email == trainer_email).first()
    if not trainer:
        trainer = Trainer(
            name=trainer_name,
            email=trainer_email,
            expertise=default_expertise,
        )
        db.add(trainer)
        try:
            db.flush()
            return trainer
        except IntegrityError:
            db.rollback()
            trainer = db.query(Trainer).filter(Trainer.email == trainer_email).first()
            if not trainer:
                raise

    trainer.name = trainer_name
    trainer.expertise = trainer.expertise or default_expertise
    return trainer


def _ensure_platform_linked_user(
    db: Session,
    *,
    email: str,
    role: UserRole,
    organization_id=None,
    trainer_id=None,
) -> User:
    user = db.query(User).filter(User.email == email).first()
    if not user:
        user = User(
            email=email,
            hashed_password=hash_password(f"platform-sso:{email}"),
            role=role,
            organization_id=organization_id,
            trainer_id=trainer_id,
        )
        db.add(user)
        try:
            db.flush()
            return user
        except IntegrityError:
            db.rollback()
            user = db.query(User).filter(User.email == email).first()
            if not user:
                raise

    user.role = role
    user.organization_id = organization_id
    user.trainer_id = trainer_id
    return user


@router.post("/register", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def register_user(
    payload: RegisterRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.admin)),
):
    requested_role = parse_requested_role(payload.role)
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    if requested_role == UserRole.organization:
        if not payload.organization_id:
            raise HTTPException(status_code=400, detail="organization_id is required for organization role")
        org = db.query(Organization).filter(Organization.id == payload.organization_id).first()
        if not org:
            raise HTTPException(status_code=404, detail="Organization not found")

    if requested_role == UserRole.trainer:
        if not payload.trainer_id:
            raise HTTPException(status_code=400, detail="trainer_id is required for trainer role")
        trainer = db.query(Trainer).filter(Trainer.id == payload.trainer_id).first()
        if not trainer:
            raise HTTPException(status_code=404, detail="Trainer not found")

    user = User(
        email=payload.email,
        hashed_password=hash_password(payload.password),
        role=requested_role,
        organization_id=payload.organization_id,
        trainer_id=payload.trainer_id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return serialize_user(user)


@router.post("/invite", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def invite_user(
    payload: RegisterRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.admin)),
):
    return register_user(payload=payload, db=db, _=_)


@router.post("/login", response_model=Token)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    token = create_access_token(str(user.id))
    return Token(access_token=token, token=token, user=serialize_user(user))


@router.post("/bootstrap", response_model=Token)
def bootstrap(request: Request, db: Session = Depends(get_db)):
    platform_user = _introspect_platform_user(request)
    account_type = str(platform_user.get("accountType") or "").strip().lower()
    approval_status = str(platform_user.get("approvalStatus") or "").strip().lower()
    email = str(platform_user.get("email") or "").strip().lower()
    email_verified = bool(platform_user.get("emailVerified"))

    if not email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Platform session is missing an email")
    if not email_verified:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Verify your AntCrowd email before using training")

    if account_type == "organization":
        if approval_status not in {"approved", "not_required"}:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Your organization must be approved before using the training workspace",
            )
        org = _ensure_training_organization(db, platform_user)
        user = _ensure_platform_linked_user(
            db,
            email=email,
            role=UserRole.organization,
            organization_id=org.id,
            trainer_id=None,
        )
    elif account_type == "researcher" and str(platform_user.get("researcherType") or "").strip().lower() == "internal":
        if approval_status not in {"approved", "not_required"}:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Your internal researcher account must be approved before using training",
            )
        trainer = _ensure_trainer(db, platform_user)
        user = _ensure_platform_linked_user(
            db,
            email=email,
            role=UserRole.trainer,
            organization_id=None,
            trainer_id=trainer.id,
        )
    elif account_type == "platform_admin":
        user = _ensure_platform_linked_user(
            db,
            email=email,
            role=UserRole.admin,
            organization_id=None,
            trainer_id=None,
        )
    else:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This training workspace is not available for your role")

    db.commit()
    db.refresh(user)
    token = create_access_token(str(user.id))
    return Token(access_token=token, token=token, user=serialize_user(user))


@router.get("/me", response_model=UserRead)
def me(current_user: User = Depends(get_current_user)):
    return serialize_user(current_user)
