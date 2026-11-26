from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from uuid import UUID
from app.db import get_db
from app import models, schemas

router = APIRouter()# ----------------------------
# Compliance
# ----------------------------
@router.post("/organizations/{org_id}/compliance", response_model=schemas.TrustComplianceOut)
def create_compliance(org_id: UUID, payload: schemas.TrustComplianceCreate, db: Session = Depends(get_db)):
    item = models.TrustCompliance(organization_id=org_id, **payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.get("/organizations/{org_id}/compliance", response_model=list[schemas.TrustComplianceOut])
def list_compliance(org_id: UUID, db: Session = Depends(get_db)):
    return db.query(models.TrustCompliance).filter_by(organization_id=org_id, published=True).all()

