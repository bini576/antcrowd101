import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.dependencies import get_db, require_roles
from app.models import RequestStatus, TrainingPlan, TrainingReport, TrainingRequest, User, UserRole
from app.schemas import TrainingReportCreate, TrainingReportFeedbackUpdate, TrainingReportRead

router = APIRouter(prefix="/reports", tags=["reports"])


@router.post("", response_model=TrainingReportRead, status_code=status.HTTP_201_CREATED)
def create_report(
    payload: TrainingReportCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.admin, UserRole.trainer)),
):
    plan = db.query(TrainingPlan).filter(TrainingPlan.id == payload.training_plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Training plan not found")

    if current_user.role == UserRole.trainer and plan.trainer_id != current_user.trainer_id:
        raise HTTPException(status_code=403, detail="You can only report on your assigned plans")

    if plan.request.status != RequestStatus.scheduled:
        raise HTTPException(
            status_code=409,
            detail=f"Report can only be submitted for scheduled trainings, current status is {plan.request.status.value}",
        )

    existing = db.query(TrainingReport).filter(TrainingReport.training_plan_id == payload.training_plan_id).first()
    if existing:
        raise HTTPException(status_code=409, detail="Report already exists for this training plan")

    if payload.post_assessment_score < payload.pre_assessment_score:
        raise HTTPException(status_code=400, detail="post_assessment_score must be greater than or equal to pre_assessment_score")

    report = TrainingReport(**payload.model_dump())
    db.add(report)

    plan.request.status = RequestStatus.completed

    db.commit()
    db.refresh(report)
    return report


@router.get("", response_model=list[TrainingReportRead])
def list_reports(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.admin, UserRole.organization, UserRole.trainer)),
):
    query = db.query(TrainingReport)

    if current_user.role == UserRole.organization:
        query = query.join(TrainingPlan).join(TrainingRequest).filter(
            TrainingRequest.organization_id == current_user.organization_id
        )

    if current_user.role == UserRole.trainer:
        query = query.join(TrainingPlan).filter(TrainingPlan.trainer_id == current_user.trainer_id)

    return query.order_by(TrainingReport.created_at.desc()).all()


@router.patch("/{report_id}/feedback", response_model=TrainingReportRead)
def submit_organization_feedback(
    report_id: uuid.UUID,
    payload: TrainingReportFeedbackUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.organization)),
):
    report = db.query(TrainingReport).filter(TrainingReport.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    request = report.training_plan.request
    if not request or request.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403, detail="You can only rate reports for your organization")

    report.organization_rating = payload.organization_rating
    report.organization_feedback = payload.organization_feedback
    report.organization_feedback_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(report)
    return report
