
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from uuid import UUID

from app.db import get_db
from app import models, schemas

router = APIRouter()# ----------------------------
# Badge (read-only)
# ----------------------------
@router.get("/organizations/{org_id}/badge", response_model=schemas.TrustBadgeOut)
def get_badge(org_id: UUID, db: Session = Depends(get_db)):
    badge = db.query(models.TrustBadge).filter_by(organization_id=org_id).first()
    if not badge:
        raise HTTPException(404, "Badge not issued")
    return badge