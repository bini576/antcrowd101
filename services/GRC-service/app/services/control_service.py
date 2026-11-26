import uuid

from sqlalchemy.orm import Session

from app.models.control import Control
from app.schemas.control import ControlCreate


def create_control(db: Session, payload: ControlCreate) -> Control:
    control = Control(**payload.model_dump())
    db.add(control)
    db.commit()
    db.refresh(control)
    return control


def list_controls(db: Session, organization_id: uuid.UUID) -> list[Control]:
    return db.query(Control).filter(Control.organization_id == organization_id).all()
