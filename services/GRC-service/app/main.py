import os

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api import auth, controls, organizations, risks, users
from app.api.deps import get_current_user
from app.db import Base, engine, get_db
from app.models.control import Control
from app.models.framework import Framework
from app.models.risk import Risk
from app.models.user import User

app = FastAPI(title="GRC Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS",
        "http://localhost:5173,http://localhost:5174,http://localhost:8089").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup() -> None:
    Base.metadata.create_all(bind=engine)


app.include_router(auth.router, prefix="/api/v1")
app.include_router(users.router, prefix="/api/v1")
app.include_router(organizations.router, prefix="/api/v1")
app.include_router(controls.router, prefix="/api/v1")
app.include_router(risks.router, prefix="/api/v1")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/ready")
def ready(db: Session = Depends(get_db)) -> dict[str, str]:
    try:
        db.execute(text("SELECT 1"))
        return {"status": "ok"}
    except Exception:
        raise HTTPException(status_code=503, detail="Database not ready")


@app.get("/api/v1/summary")
def organization_summary(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, int | str]:
    if not current_user.organization_id:
        raise HTTPException(status_code=404, detail="No GRC organization is linked to this user")
    organization_id = current_user.organization_id
    return {
        "organizationId": str(organization_id),
        "controls": db.query(Control).filter(Control.organization_id == organization_id).count(),
        "risks": db.query(Risk).filter(Risk.organization_id == organization_id).count(),
        "frameworks": db.query(Framework).filter(Framework.organization_id == organization_id).count(),
    }


@app.get("/api/v1/platform/summary")
def platform_summary(db: Session = Depends(get_db)) -> dict[str, int | str]:
    """Returns aggregate GRC counts for the admin dashboard.
    No auth required — returns platform-wide totals."""
    return {
        "service": "grc",
        "serviceName": "GRC & Compliance",
        "totalControls": db.query(Control).count(),
        "totalRisks": db.query(Risk).count(),
        "totalFrameworks": db.query(Framework).count(),
        "totalOrganizations": db.query(User).distinct(User.organization_id).filter(User.organization_id.isnot(None)).count(),
    }

