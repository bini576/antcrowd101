from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from uuid import UUID

from app.db import get_db
from app import models, schemas

router = APIRouter()
# ----------------------------
# Resources
# ----------------------------
@router.post("/organizations/{org_id}/resources", response_model=schemas.TrustResourceOut)
def create_resource(org_id: UUID, payload: schemas.TrustResourceCreate, db: Session = Depends(get_db)):
    resource = models.TrustResource(organization_id=org_id, **payload.model_dump())
    db.add(resource)
    db.commit()
    db.refresh(resource)
    return resource


@router.get("/organizations/{org_id}/resources", response_model=list[schemas.TrustResourceOut])
def list_resources(org_id: UUID, db: Session = Depends(get_db)):
    return db.query(models.TrustResource).filter_by(organization_id=org_id, published=True).all()
