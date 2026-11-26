
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from uuid import UUID

from app.db import get_db
from app import models, schemas

router = APIRouter()# ----------------------------
# FAQ
# ----------------------------
@router.post("/organizations/{org_id}/faq", response_model=schemas.TrustFAQOut)
def create_faq(org_id: UUID, payload: schemas.TrustFAQCreate, db: Session = Depends(get_db)):
    faq = models.TrustFAQ(organization_id=org_id, **payload.model_dump())
    db.add(faq)
    db.commit()
    db.refresh(faq)
    return faq


@router.get("/organizations/{org_id}/faq", response_model=list[schemas.TrustFAQOut])
def list_faq(org_id: UUID, db: Session = Depends(get_db)):
    return (
        db.query(models.TrustFAQ)
        .filter_by(organization_id=org_id, published=True)
        .order_by(models.TrustFAQ.order_index)
        .all()
    )