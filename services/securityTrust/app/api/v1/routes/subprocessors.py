from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from uuid import UUID

from app.db import get_db
from app import models, schemas

router = APIRouter()# ----------------------------
# Subprocessors
# ----------------------------
@router.post("/organizations/{org_id}/subprocessors", response_model=schemas.TrustSubprocessorOut)
def create_subprocessor(org_id: UUID, payload: schemas.TrustSubprocessorCreate, db: Session = Depends(get_db)):
    sp = models.TrustSubprocessor(organization_id=org_id, **payload.model_dump())
    db.add(sp)
    db.commit()
    db.refresh(sp)
    return sp


@router.get("/organizations/{org_id}/subprocessors", response_model=list[schemas.TrustSubprocessorOut])
def list_subprocessors(org_id: UUID, db: Session = Depends(get_db)):
    return db.query(models.TrustSubprocessor).filter_by(organization_id=org_id, published=True).all()
