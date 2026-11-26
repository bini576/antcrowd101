import uuid
from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from app.dependencies import get_current_user, get_db, require_roles
from app.models import Organization, QuoteStatus, RequestStatus, Trainer, TrainingPlan, TrainingQuote, TrainingRequest, User, UserRole
from app.models import InvoiceStatus, PaymentVerificationStatus, TrainingInvoice
from app.schemas import (
    TrainingPlanCreate,
    TrainingPlanRead,
    TrainingRequestAssignResearcher,
    TrainingRequestCreate,
    TrainingRequestRead,
    TrainingRequestStatusUpdate,
)

router = APIRouter(prefix="/training", tags=["training"])

MANUAL_STATUS_TRANSITIONS = {
    RequestStatus.pending: {RequestStatus.approved, RequestStatus.rejected},
    RequestStatus.approved: {RequestStatus.scheduled, RequestStatus.rejected},
    RequestStatus.rejected: set(),
    RequestStatus.scheduled: {RequestStatus.completed},
    RequestStatus.completed: set(),
}


@router.post("/requests", response_model=TrainingRequestRead, status_code=status.HTTP_201_CREATED)
def create_training_request(
    payload: TrainingRequestCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.admin, UserRole.organization)),
):
    organization = db.query(Organization).filter(Organization.id == payload.organization_id).first()
    if not organization:
        raise HTTPException(status_code=404, detail="Organization not found")

    if current_user.role == UserRole.organization and current_user.organization_id != payload.organization_id:
        raise HTTPException(status_code=403, detail="You can only submit requests for your own organization")

    request = TrainingRequest(**payload.model_dump())
    db.add(request)
    db.commit()
    db.refresh(request)
    return request


@router.get("/requests", response_model=list[TrainingRequestRead])
def list_training_requests(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.admin, UserRole.organization, UserRole.trainer)),
):
    query = db.query(TrainingRequest).options(joinedload(TrainingRequest.organization))

    if current_user.role == UserRole.organization:
        query = query.filter(TrainingRequest.organization_id == current_user.organization_id)

    if current_user.role == UserRole.trainer:
        query = query.outerjoin(TrainingPlan).filter(
            or_(
                TrainingRequest.researcher_id == current_user.trainer_id,
                TrainingPlan.trainer_id == current_user.trainer_id,
            )
        )

    return query.order_by(TrainingRequest.created_at.desc()).all()


@router.patch("/requests/{request_id}/status", response_model=TrainingRequestRead)
def update_request_status(
    request_id: uuid.UUID,
    payload: TrainingRequestStatusUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.admin)),
):
    request = db.query(TrainingRequest).filter(TrainingRequest.id == request_id).first()
    if not request:
        raise HTTPException(status_code=404, detail="Training request not found")

    allowed_targets = MANUAL_STATUS_TRANSITIONS.get(request.status, set())
    if payload.status not in allowed_targets:
        raise HTTPException(
            status_code=409,
            detail=f"Cannot change status from {request.status.value} to {payload.status.value}",
        )

    request.status = payload.status
    request.status_changed_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(request)
    return request


@router.patch("/requests/{request_id}/assign-researcher", response_model=TrainingRequestRead)
def assign_researcher(
    request_id: uuid.UUID,
    payload: TrainingRequestAssignResearcher,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.admin)),
):
    request = db.query(TrainingRequest).filter(TrainingRequest.id == request_id).first()
    if not request:
        raise HTTPException(status_code=404, detail="Training request not found")

    if request.status != RequestStatus.approved:
        raise HTTPException(status_code=409, detail="Only approved requests can be assigned to a researcher")

    researcher = db.query(Trainer).filter(Trainer.id == payload.researcher_id).first()
    if not researcher:
        raise HTTPException(status_code=404, detail="Researcher not found")

    request.researcher_id = payload.researcher_id
    db.commit()
    db.refresh(request)
    return request


@router.post("/plans", response_model=TrainingPlanRead, status_code=status.HTTP_201_CREATED)
def create_training_plan(
    payload: TrainingPlanCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.admin)),
):
    request = db.query(TrainingRequest).filter(TrainingRequest.id == payload.request_id).first()
    if not request:
        raise HTTPException(status_code=404, detail="Training request not found")

    trainer = db.query(Trainer).filter(Trainer.id == payload.trainer_id).first()
    if not trainer:
        raise HTTPException(status_code=404, detail="Trainer not found")

    existing = db.query(TrainingPlan).filter(TrainingPlan.request_id == payload.request_id).first()
    if existing:
        raise HTTPException(status_code=409, detail="Training plan already exists for this request")

    if request.status != RequestStatus.approved:
        raise HTTPException(status_code=409, detail="Training request must be approved before planning")

    if not request.researcher_id:
        raise HTTPException(status_code=409, detail="Assign an internal researcher before creating a plan")
    if request.researcher_id != payload.trainer_id:
        raise HTTPException(
            status_code=409,
            detail="Plan trainer must match the assigned internal researcher for this request",
        )

    quote = db.query(TrainingQuote).filter(TrainingQuote.request_id == payload.request_id).first()
    if not quote:
        raise HTTPException(status_code=409, detail="Quote must be created before planning")
    if quote.status != QuoteStatus.approved:
        raise HTTPException(status_code=409, detail="Quote must be approved before planning")
    invoice = db.query(TrainingInvoice).filter(TrainingInvoice.quote_id == quote.id).first()
    if not invoice:
        raise HTTPException(status_code=409, detail="Invoice must exist before planning")
    if invoice.status == InvoiceStatus.canceled:
        raise HTTPException(status_code=409, detail="Invoice is canceled")
    if invoice.payment_verification_status != PaymentVerificationStatus.verified:
        raise HTTPException(status_code=409, detail="Payment must be verified before planning")

    if payload.end_date < payload.start_date:
        raise HTTPException(status_code=400, detail="end_date must be after or equal to start_date")

    plan = TrainingPlan(**payload.model_dump())
    db.add(plan)

    request.status = RequestStatus.scheduled

    db.commit()
    db.refresh(plan)
    return plan


@router.get("/plans", response_model=list[TrainingPlanRead])
def list_training_plans(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.admin, UserRole.organization, UserRole.trainer)),
):
    query = db.query(TrainingPlan)

    if current_user.role == UserRole.organization:
        query = query.join(TrainingRequest).filter(TrainingRequest.organization_id == current_user.organization_id)

    if current_user.role == UserRole.trainer:
        query = query.filter(TrainingPlan.trainer_id == current_user.trainer_id)

    return query.order_by(TrainingPlan.created_at.desc()).all()


class ScheduleBody(BaseModel):
    scheduled_date: date


class TimelineEntry(BaseModel):
    status: str
    timestamp: datetime


@router.patch("/requests/{request_id}/schedule", response_model=TrainingRequestRead)
def schedule_request(
    request_id: uuid.UUID,
    payload: ScheduleBody,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.admin)),
):
    raise HTTPException(
        status_code=status.HTTP_410_GONE,
        detail="This endpoint has been deprecated. Training scheduling must be completed by creating a Training Plan via POST /plans.",
    )


@router.get("/requests/{request_id}/timeline", response_model=list[TimelineEntry])
def get_request_timeline(
    request_id: uuid.UUID,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.admin, UserRole.organization, UserRole.trainer)),
):
    request = db.query(TrainingRequest).filter(TrainingRequest.id == request_id).first()
    if not request:
        raise HTTPException(status_code=404, detail="Training request not found")

    timeline: list[dict] = [{"status": "pending", "timestamp": request.created_at}]

    if request.status_changed_at and request.status.value not in {"pending"}:
        timeline.append({"status": request.status.value, "timestamp": request.status_changed_at})

    return timeline
