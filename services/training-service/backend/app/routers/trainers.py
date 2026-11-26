from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.dependencies import get_db, require_roles
from app.models import Trainer, User, UserRole
from app.schemas import TrainerCreate, TrainerRead

router = APIRouter(prefix="/trainers", tags=["trainers"])
researchers_router = APIRouter(prefix="/researchers", tags=["researchers"])


@router.post("", response_model=TrainerRead, status_code=status.HTTP_201_CREATED)
def create_trainer(
    payload: TrainerCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.admin)),
):
    trainer = Trainer(**payload.model_dump())
    db.add(trainer)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Trainer email already exists")
    db.refresh(trainer)
    return trainer


@router.get("", response_model=list[TrainerRead])
def list_trainers(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.admin, UserRole.trainer)),
):
    return db.query(Trainer).order_by(Trainer.created_at.desc()).all()


@researchers_router.post("", response_model=TrainerRead, status_code=status.HTTP_201_CREATED)
def create_researcher(
    payload: TrainerCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.admin)),
):
    return create_trainer(payload=payload, db=db, _=_)


@researchers_router.get("", response_model=list[TrainerRead])
def list_researchers(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.admin, UserRole.trainer)),
):
    return list_trainers(db=db, _=_)
