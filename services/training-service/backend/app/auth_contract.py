from fastapi import HTTPException, status

from app.models import User, UserRole

ROLE_ALIASES: dict[str, UserRole] = {
    "admin": UserRole.admin,
    "platform_admin": UserRole.admin,
    "organization": UserRole.organization,
    "organization_admin": UserRole.organization,
    "trainer": UserRole.trainer,
}

CANONICAL_ROLE_BY_INTERNAL: dict[UserRole, str] = {
    UserRole.admin: "platform_admin",
    UserRole.organization: "organization_admin",
    UserRole.trainer: "trainer",
}

MODULE_ACCESS_BY_ROLE: dict[str, list[str]] = {
    "platform_admin": ["training"],
    "organization_admin": ["training"],
    "trainer": ["training"],
}


def parse_requested_role(role: str) -> UserRole:
    normalized = (role or "").strip().lower()
    parsed = ROLE_ALIASES.get(normalized)
    if parsed is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported role")
    return parsed


def canonical_role(role: UserRole | str) -> str:
    if isinstance(role, UserRole):
        return CANONICAL_ROLE_BY_INTERNAL[role]
    parsed = ROLE_ALIASES.get(str(role).strip().lower())
    if parsed is None:
        return str(role).strip().lower()
    return CANONICAL_ROLE_BY_INTERNAL[parsed]


def serialize_user(user: User) -> dict:
    normalized_role = canonical_role(user.role)
    return {
        "id": user.id,
        "email": user.email,
        "role": normalized_role,
        "legacy_role": user.role.value,
        "organization_id": user.organization_id,
        "trainer_id": user.trainer_id,
        "module_access": MODULE_ACCESS_BY_ROLE.get(normalized_role, []),
        "created_at": user.created_at,
    }
