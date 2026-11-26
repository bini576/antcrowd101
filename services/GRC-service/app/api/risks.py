import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_db_session
from app.models.organization import Organization
from app.models.risk import Risk
from app.schemas.risk import RiskCreate, RiskRead

router = APIRouter(prefix="/risks", tags=["risks"])


@router.post("", response_model=RiskRead, status_code=status.HTTP_201_CREATED)
def create_risk(payload: RiskCreate, db: Session = Depends(get_db_session)) -> Risk:
    org = db.query(Organization).filter(Organization.id == payload.organization_id).first()
    if not org:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")

    risk = Risk(**payload.model_dump())
    db.add(risk)
    db.commit()
    db.refresh(risk)
    return risk


@router.get("/organizations/{organization_id}", response_model=list[RiskRead])
def list_risks_for_org(organization_id: uuid.UUID, db: Session = Depends(get_db_session)) -> list[Risk]:
    return db.query(Risk).filter(Risk.organization_id == organization_id).all()
