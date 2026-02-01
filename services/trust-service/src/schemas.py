from pydantic import BaseModel
from typing import List, Optional

class TrustProfileOut(BaseModel):
    overview: Optional[str]
    security_commitment: Optional[str]
    contact_email: Optional[str]

class VDPOut(BaseModel):
    policy_text: str
    scope: Optional[str]
    safe_harbor: bool

class ComplianceOut(BaseModel):
    name: str
    status: str

class TrustBadgeOut(BaseModel):
    level: str
