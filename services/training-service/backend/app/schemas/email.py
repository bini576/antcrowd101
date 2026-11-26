import re
from typing import Annotated

from pydantic import AfterValidator, StringConstraints

EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


def validate_portal_email(value: str) -> str:
    normalized = str(value or "").strip().lower()
    if not normalized:
        raise ValueError("email is required")
    if not EMAIL_RE.fullmatch(normalized):
        raise ValueError("value is not a valid email address")
    return normalized


PortalEmail = Annotated[
    str,
    StringConstraints(max_length=254),
    AfterValidator(validate_portal_email),
]
