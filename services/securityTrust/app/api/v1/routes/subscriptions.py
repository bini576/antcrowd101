import secrets

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from uuid import UUID

from app.db import get_db
from app import models, schemas

router = APIRouter()


@router.post("/{org_id}", response_model=schemas.TrustSubscriptionOut)
def create_subscription(
    org_id: UUID, payload: schemas.TrustSubscriptionCreate, db: Session = Depends(get_db)
):
    token = secrets.token_urlsafe(32)
    record = models.TrustSubscription(
        organization_id=org_id,
        unsubscribe_token=token,
        **payload.model_dump(),
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


@router.delete("/{token}")
def unsubscribe(token: str, db: Session = Depends(get_db)):
    subscription = db.query(models.TrustSubscription).filter_by(
        unsubscribe_token=token
    ).first()
    if not subscription:
        raise HTTPException(status_code=404, detail="Subscription not found or already unsubscribed.")
    subscription.is_active = False
    db.commit()
    return {"message": "You have been successfully unsubscribed."}
