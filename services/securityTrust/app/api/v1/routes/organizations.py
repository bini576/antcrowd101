from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from uuid import UUID

from app.db import get_db
from app import models, schemas

router = APIRouter()


# ----------------------------
# Organization
# ----------------------------
@router.post("/organizations", response_model=schemas.OrganizationOut)
def create_organization(payload: schemas.OrganizationCreate, db: Session = Depends(get_db)):
    org = models.Organization(**payload.model_dump())
    db.add(org)
    db.commit()
    db.refresh(org)
    return org