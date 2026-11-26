from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.core.config import settings
from app.core.database import engine
from app.routers import auth, commercial, organizations, reports, trainers, training

settings.validate_runtime()

app = FastAPI(title=settings.project_name, version="1.0.0")

# Allow local frontend during development.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/ready")
def ready_check() -> dict[str, str]:
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database not ready",
        ) from exc
    return {"status": "ok"}


@app.get("/")
def root() -> dict[str, str]:
    return {
        "service": settings.project_name,
        "status": "ok",
        "docs": "/docs",
        "health": "/health",
        "ready": "/ready",
    }


app.include_router(auth.router)
app.include_router(organizations.router)
app.include_router(trainers.router)
app.include_router(trainers.researchers_router)
app.include_router(training.router)
app.include_router(commercial.router)
app.include_router(reports.router)
