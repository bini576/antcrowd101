from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db import get_db
from app.models import TrustOverview
from app.api.v1.schemas.overview import TrustOverviewCreate, TrustOverviewRead

router = APIRouter()

@router.post("", response_model=TrustOverviewRead)
def create_overview(payload: TrustOverviewCreate, db: Session = Depends(get_db)):
    item = TrustOverview(**payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item

@router.get("", response_model=list[TrustOverviewRead])
def list_overviews(db: Session = Depends(get_db)):
    return db.query(TrustOverview).all()
