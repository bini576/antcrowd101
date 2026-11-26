from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from uuid import UUID

from app.db import get_db
from app import models, schemas

router = APIRouter()# ----------------------------
# Updates
# ----------------------------
@router.post("/organizations/{org_id}/updates", response_model=schemas.TrustUpdateOut)
def create_update(org_id: UUID, payload: schemas.TrustUpdateCreate, db: Session = Depends(get_db)):
    update = models.TrustUpdate(organization_id=org_id, **payload.model_dump())
    db.add(update)
    db.commit()
    db.refresh(update)
    return update


@router.get("/organizations/{org_id}/updates", response_model=list[schemas.TrustUpdateOut])
def list_updates(org_id: UUID, db: Session = Depends(get_db)):
    return db.query(models.TrustUpdate).filter_by(organization_id=org_id, published=True).all()