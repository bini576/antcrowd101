from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from uuid import UUID

from app.db import get_db
from app import models, schemas

router = APIRouter()


@router.post("/organizations/{org_id}/access-requests", response_model=schemas.TrustAccessRequestOut)
def create_access_request(
    org_id: UUID, payload: schemas.TrustAccessRequestCreate, db: Session = Depends(get_db)
):
    record = models.TrustAccessRequest(organization_id=org_id, **payload.model_dump())
    db.add(record)
    db.commit()
    db.refresh(record)
    return record
