from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from src.db import get_db
from src import models

router = APIRouter(prefix="/trust", tags=["Trust Center"])

@router.get("/{slug}")
def get_trust_profile(slug: str, db: Session = Depends(get_db)):
    org = db.query(models.Organization).filter_by(slug=slug).first()
    if not org:
        raise HTTPException(404, "Organization not found")

    profile = db.query(models.TrustProfile).filter_by(
        organization_id=org.id
    ).first()

    return profile

@router.get("/{slug}/vdp")
def get_vdp(slug: str, db: Session = Depends(get_db)):
    org = db.query(models.Organization).filter_by(slug=slug).first()
    policy = db.query(models.VDPPolicy).filter_by(
        organization_id=org.id
    ).first()
    return policy

@router.get("/{slug}/compliance")
def get_compliance(slug: str, db: Session = Depends(get_db)):
    org = db.query(models.Organization).filter_by(slug=slug).first()
    return db.query(models.ComplianceFramework).filter_by(
        organization_id=org.id
    ).all()

@router.get("/{slug}/badge")
def get_badge(slug: str, db: Session = Depends(get_db)):
    org = db.query(models.Organization).filter_by(slug=slug).first()
    return db.query(models.TrustBadge).filter_by(
        organization_id=org.id
    ).first()

@router.get("/.well-known/security.txt")
def security_txt():
    return (
        "Contact: security@antcrowd.io\n"
        "Policy: https://antcrowd.io/trust\n"
        "Preferred-Languages: en\n"
    )
