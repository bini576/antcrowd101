import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_db_session
from app.models.control import Control
from app.models.organization import Organization
from app.schemas.control import ControlCreate, ControlRead
from app.services.control_service import create_control, list_controls

router = APIRouter(prefix="/controls", tags=["controls"])


@router.post("", response_model=ControlRead, status_code=status.HTTP_201_CREATED)
def create_control_record(payload: ControlCreate, db: Session = Depends(get_db_session)) -> Control:
    org = db.query(Organization).filter(Organization.id == payload.organization_id).first()
    if not org:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")
    return create_control(db, payload)


@router.get("/organizations/{organization_id}", response_model=list[ControlRead])
def list_controls_for_org(organization_id: uuid.UUID, db: Session = Depends(get_db_session)) -> list[Control]:
    return list_controls(db, organization_id)
