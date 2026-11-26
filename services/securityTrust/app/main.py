import os
import uuid
from datetime import datetime, timezone
import json
import re
from typing import Any, Optional

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import func, text

from app.db import Base, engine, get_db, SessionLocal
from app import models, schemas
from app.auth.dependencies import (
    ANONYMOUS_USER, PLATFORM_LOGIN_URL, PLATFORM_LOGOUT_URL,
    SESSION_COOKIE_NAME, SessionUser, resolve_session,
    require_authenticated, require_platform_admin, require_org_admin,
)

app = FastAPI(title="AntCrowd Trust Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS",
        "http://localhost:5173,http://localhost:5174,http://localhost:8089").split(","),
    allow_credentials=True,
    allow_methods=["*"], allow_headers=["*"],
)

ANTCROWD_ORG_ID = "00000000-0000-4000-a000-000000000001"
ANTCROWD_ORG_SLUG = "antcrowd"

# ── helpers ──────────────────────────────────────────────────────────
def utc_now():
    return datetime.now(timezone.utc)


def _run_ddl(sql: str) -> None:
    """Execute a single DDL statement, silently logging any error."""
    try:
        with engine.begin() as conn:
            conn.execute(text(sql))
    except Exception as exc:
        print(f"[migration] DDL skipped/failed ({exc.__class__.__name__}): {sql[:80]}")

def get_org_for_admin(db: Session, session_user: SessionUser):
    """Return the org record that belongs to the logged-in org admin."""
    if not session_user.org_id:
        raise HTTPException(status_code=403, detail="No organization associated with this account.")
    org_uuid = uuid.UUID(session_user.org_id) if isinstance(session_user.org_id, str) else session_user.org_id
    org = db.query(models.Organization).filter_by(id=org_uuid).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found.")
    return org

# ── startup ──────────────────────────────────────────────────────────
@app.on_event("startup")
def startup():
    try:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE organizations ADD COLUMN IF NOT EXISTS trust_center_published BOOLEAN DEFAULT FALSE NOT NULL"))
    except Exception as e:
        print(f"Failed to add trust_center_published column on startup: {e}")

    # Ensure trust_requests table and all required columns exist
    _run_ddl("CREATE TABLE IF NOT EXISTS trust_requests (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), org_id VARCHAR NOT NULL, org_name VARCHAR NOT NULL, org_email VARCHAR, status VARCHAR NOT NULL DEFAULT 'pending', content TEXT, submitted_at TIMESTAMPTZ DEFAULT NOW(), reviewed_at TIMESTAMPTZ, reviewed_by VARCHAR)")
    for _col in [
        "ALTER TABLE trust_requests ADD COLUMN IF NOT EXISTS org_id VARCHAR",
        "ALTER TABLE trust_requests ADD COLUMN IF NOT EXISTS org_name VARCHAR NOT NULL DEFAULT ''",
        "ALTER TABLE trust_requests ADD COLUMN IF NOT EXISTS org_email VARCHAR",
        "ALTER TABLE trust_requests ADD COLUMN IF NOT EXISTS status VARCHAR NOT NULL DEFAULT 'pending'",
        "ALTER TABLE trust_requests ADD COLUMN IF NOT EXISTS content TEXT",
        "ALTER TABLE trust_requests ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ DEFAULT NOW()",
        "ALTER TABLE trust_requests ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ",
        "ALTER TABLE trust_requests ADD COLUMN IF NOT EXISTS reviewed_by VARCHAR",
    ]:
        _run_ddl(_col)
    _run_ddl("CREATE INDEX IF NOT EXISTS ix_trust_requests_org_id ON trust_requests (org_id)")

    # Ensure trust_org_notifications table and all required columns exist
    _run_ddl("CREATE TABLE IF NOT EXISTS trust_org_notifications (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), org_id VARCHAR NOT NULL, title VARCHAR NOT NULL, message TEXT, kind VARCHAR NOT NULL DEFAULT 'info', is_read BOOLEAN NOT NULL DEFAULT FALSE, created_at TIMESTAMPTZ DEFAULT NOW())")
    for _col in [
        "ALTER TABLE trust_org_notifications ADD COLUMN IF NOT EXISTS org_id VARCHAR",
        "ALTER TABLE trust_org_notifications ADD COLUMN IF NOT EXISTS title VARCHAR NOT NULL DEFAULT ''",
        "ALTER TABLE trust_org_notifications ADD COLUMN IF NOT EXISTS message TEXT",
        "ALTER TABLE trust_org_notifications ADD COLUMN IF NOT EXISTS kind VARCHAR NOT NULL DEFAULT 'info'",
        "ALTER TABLE trust_org_notifications ADD COLUMN IF NOT EXISTS is_read BOOLEAN NOT NULL DEFAULT FALSE",
        "ALTER TABLE trust_org_notifications ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW()",
    ]:
        _run_ddl(_col)
    _run_ddl("CREATE INDEX IF NOT EXISTS ix_trust_org_notifications_org_id ON trust_org_notifications (org_id)")

    Base.metadata.create_all(bind=engine)
    seed_data()

def seed_data():
    with SessionLocal() as db:
        # Seed AntCrowd organization
        org = db.query(models.Organization).filter_by(slug=ANTCROWD_ORG_SLUG).first()
        if not org:
            org = models.Organization(id=uuid.UUID(ANTCROWD_ORG_ID), name="AntCrowd", slug=ANTCROWD_ORG_SLUG)
            db.add(org)
            db.flush()

        # Ensure the org is discoverable in the public trust directory
        if not org.trust_center_published:
            org.trust_center_published = True

        oid = org.id

        # Trust overview
        if not db.query(models.TrustOverview).filter_by(organization_id=oid).first():
            db.add(models.TrustOverview(
                organization_id=oid, published=True,
                summary="AntCrowd is committed to the highest standards of security, privacy, and transparency. Our platform undergoes regular independent audits and continuous monitoring.",
                security_commitment="We implement defense-in-depth across infrastructure, application, and operational layers. All data is encrypted in transit and at rest.",
                contact_email="security@antcrowd.io",
            ))

        # Compliance
        if not db.query(models.TrustCompliance).filter_by(organization_id=oid).first():
            for fw, st in [("SOC 2 Type II","compliant"),("ISO 27001:2022","compliant"),("GDPR","compliant"),("ISO 27701","in-progress")]:
                db.add(models.TrustCompliance(organization_id=oid, framework=fw, status=st, published=True))

        # Subprocessors
        if not db.query(models.TrustSubprocessor).filter_by(organization_id=oid).first():
            for n, p, l in [("AWS","Cloud infrastructure","US"),("Cloudflare","CDN & DDoS protection","Global"),("Brevo","Transactional email","EU"),("PostgreSQL (managed)","Primary database","US")]:
                db.add(models.TrustSubprocessor(organization_id=oid, name=n, purpose=p, location=l, published=True))

        # FAQ
        if not db.query(models.TrustFAQ).filter_by(organization_id=oid).first():
            faqs = [
                ("How does AntCrowd protect my data?", "All data is encrypted in transit (TLS 1.3) and at rest (AES-256). Access is controlled via role-based permissions with mandatory multi-factor authentication.", 0),
                ("Does AntCrowd conduct penetration testing?", "Yes. We engage independent security firms for annual penetration tests and address all findings before report finalization.", 1),
                ("How can I report a security vulnerability?", "Submit reports through our Bug Bounty program or email security@antcrowd.io. We follow coordinated disclosure practices.", 2),
            ]
            for q, a, i in faqs:
                db.add(models.TrustFAQ(organization_id=oid, question=q, answer=a, order_index=i, published=True))

        # Resources
        if not db.query(models.TrustResource).filter_by(organization_id=oid).first():
            for t, rt in [("Security Whitepaper","whitepaper"),("Privacy Policy","policy"),("Incident Response Plan","policy")]:
                db.add(models.TrustResource(organization_id=oid, title=t, resource_type=rt, published=True))

        # Security updates
        if not db.query(models.TrustUpdate).filter_by(organization_id=oid).first():
            db.add(models.TrustUpdate(
                organization_id=oid, title="Platform Security Audit Complete",
                content="Annual SOC 2 Type II audit completed with zero critical findings.",
                published=True, published_at=utc_now(),
            ))

        # GRC framework seeds
        seed_grc_frameworks(db)
        seed_grc_controls(db)

        db.commit()

def seed_grc_frameworks(db: Session):
    seeds = [
        {"name":"Ethiopia Personal Data Protection Proclamation","code":"ET-PDPP","jurisdiction":"Ethiopia","sector":"all"},
        {"name":"Ethiopia Electronic Transactions Proclamation","code":"ET-ETP","jurisdiction":"Ethiopia","sector":"all"},
        {"name":"Ethiopia IT Products Security Clearance and Control","code":"ET-ITPSCC","jurisdiction":"Ethiopia","sector":"all"},
        {"name":"NBE IT Management Directive (Banks)","code":"ET-NBE-IT","jurisdiction":"Ethiopia","sector":"fintech"},
        {"name":"ISO/IEC 27001","code":"ISO-27001","jurisdiction":"ISO","sector":"all"},
        {"name":"ISO/IEC 27701","code":"ISO-27701","jurisdiction":"ISO","sector":"all"},
        {"name":"ISO 22301","code":"ISO-22301","jurisdiction":"ISO","sector":"all"},
    ]
    for s in seeds:
        if not db.query(models.GRCFramework).filter_by(code=s["code"]).first():
            db.add(models.GRCFramework(**s))
    db.flush()

def seed_grc_controls(db: Session):
    frameworks = {f.code: f for f in db.query(models.GRCFramework).all()}
    ctrl_seeds = [
        ("ET-PDPP","PD-1","Data Inventory","Maintain a data inventory.","administrative","data_inventory","evidence_present",None,"high"),
        ("ET-PDPP","PD-2","Lawful Basis","Define lawful basis for processing.","administrative","privacy_policy","evidence_present",None,"high"),
        ("ET-ETP","ET-1","Record Integrity","Protect integrity of electronic records.","technical","backup_policy","evidence_present",None,"medium"),
        ("ISO-27001","ISO-1","ISMS Scope","Define ISMS scope and context.","administrative","isms_scope","evidence_present",None,"high"),
        ("ISO-27001","ISO-2","Access Control","Implement access control policy.","administrative","access_control_policy","evidence_present",None,"high"),
        ("ISO-27701","ISO-P1","Privacy Roles","Define privacy roles and responsibilities.","administrative","privacy_roles","evidence_present",None,"medium"),
        ("ISO-22301","BCP-1","Business Continuity Plan","Maintain BCP policy and plan.","administrative","bcp_policy","evidence_present",None,"high"),
    ]
    for fw_code, code, title, req, ct, et, ck, ev, sev in ctrl_seeds:
        fw = frameworks.get(fw_code)
        if not fw:
            continue
        if not db.query(models.GRCControl).filter_by(framework_id=fw.id, code=code).first():
            db.add(models.GRCControl(framework_id=fw.id, code=code, title=title, requirement=req,
                                     control_type=ct, evidence_type=et, check_type=ck, expected_value=ev, severity=sev))
    db.flush()

# ── health ───────────────────────────────────────────────────────────
@app.get("/health")
def health():
    return {"status": "healthy", "service": "trust"}

@app.get("/ready")
def ready(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
        return {"status": "ok"}
    except Exception:
        raise HTTPException(status_code=503, detail="Database not ready")

@app.get("/")
def root():
    return {"service": "trust", "status": "running"}

# ── whoami ───────────────────────────────────────────────────────────
@app.get("/api/whoami")
def whoami(request: Request, session_user: SessionUser = Depends(resolve_session)):
    return {
        "authenticated": session_user.role != "user",
        "role": session_user.role,
        "email": session_user.email,
        "displayName": session_user.display_name,
        "username": session_user.username,
        "loginUrl": PLATFORM_LOGIN_URL,
        "logoutUrl": PLATFORM_LOGOUT_URL,
        "service": {"key": "trust", "name": "Trust Service"},
    }

# ── admin summary ────────────────────────────────────────────────────
@app.get("/api/admin/summary")
def admin_summary(db: Session = Depends(get_db), session_user: SessionUser = Depends(resolve_session)):
    require_platform_admin(session_user)
    orgs_with_trust = db.query(models.TrustOverview.organization_id).distinct().count()
    published = db.query(models.TrustOverview).filter_by(published=True).count()
    pending_access = db.query(models.TrustAccessRequest).filter_by(status="pending").count()
    return {
        "service": "trust", "serviceName": "Trust Service",
        "organizationsWithTrustPages": orgs_with_trust,
        "publishedTrustPages": published,
        "pendingAccessRequests": pending_access,
        "newDemoLeads": 0,
    }

# ── bootstrap (session handoff) ─────────────────────────────────────
@app.post("/api/auth/bootstrap")
def auth_bootstrap(request: Request, session_user: SessionUser = Depends(resolve_session)):
    if session_user.role == "user":
        raise HTTPException(status_code=401, detail="Authentication required")
    session_token = request.cookies.get(SESSION_COOKIE_NAME, "")
    return {
        "access_token": session_token, "token": session_token,
        "user": session_user.to_dict(),
    }

# ── public trust page (by slug) ─────────────────────────────────────
@app.get("/api/v1/trust-center/{org_slug}")
def get_trust_center_public(org_slug: str, db: Session = Depends(get_db)):
    org = db.query(models.Organization).filter_by(slug=org_slug).first()
    if not org:
        raise HTTPException(404, "Organization not found")
    overview = db.query(models.TrustOverview).filter_by(organization_id=org.id, published=True).first()
    compliance = db.query(models.TrustCompliance).filter_by(organization_id=org.id, published=True).all()
    resources = db.query(models.TrustResource).filter_by(organization_id=org.id, published=True).all()
    subprocessors = db.query(models.TrustSubprocessor).filter_by(organization_id=org.id, published=True).all()
    faq = db.query(models.TrustFAQ).filter_by(organization_id=org.id, published=True).order_by(models.TrustFAQ.order_index).all()
    updates = db.query(models.TrustUpdate).filter_by(organization_id=org.id, published=True).all()
    badge = db.query(models.TrustBadge).filter_by(organization_id=org.id).first()
    return {
        "organization": {"id": str(org.id), "name": org.name, "slug": org.slug},
        "overview": _ser_overview(overview) if overview else None,
        "compliance": [_ser_compliance(c) for c in compliance],
        "resources": [_ser_resource(r) for r in resources],
        "subprocessors": [_ser_subprocessor(s) for s in subprocessors],
        "faq": [_ser_faq(f) for f in faq],
        "updates": [_ser_update(u) for u in updates],
        "badge": {"id": str(badge.id), "level": badge.level} if badge else None,
    }

# ── public platform overview (no auth, for homepage TrustCenter page) ──
@app.get("/api/public/overview")
def public_platform_overview(db: Session = Depends(get_db)):
    """Returns the AntCrowd platform security posture for anonymous visitors.
    The main frontend TrustCenter page can call this endpoint to display
    real compliance data, badges, and framework information."""
    org = db.query(models.Organization).filter_by(slug=ANTCROWD_ORG_SLUG).first()
    if not org:
        return {"overview": None, "compliance": [], "badges": [], "frameworks": []}
    overview = db.query(models.TrustOverview).filter_by(organization_id=org.id, published=True).first()
    compliance = db.query(models.TrustCompliance).filter_by(organization_id=org.id, published=True).all()
    badge = db.query(models.TrustBadge).filter_by(organization_id=org.id).first()
    frameworks = db.query(models.GRCFramework).filter_by(published=True).all()
    return {
        "organization": {"name": org.name, "slug": org.slug},
        "overview": _ser_overview(overview) if overview else None,
        "compliance": [_ser_compliance(c) for c in compliance],
        "badges": [{"id": str(badge.id), "level": badge.level}] if badge else [],
        "frameworks": [{"name": f.name, "code": f.code, "jurisdiction": f.jurisdiction} for f in frameworks],
    }


# ── organizations CRUD ───────────────────────────────────────────────
@app.get("/api/v1/organizations/public")
def list_public_organizations(db: Session = Depends(get_db)):
    """Public directory — no auth required. Returns orgs with trust_center_published=True
    AND a published TrustOverview, ordered alphabetically by name."""
    results = (
        db.query(models.Organization, models.TrustOverview)
        .join(models.TrustOverview, models.TrustOverview.organization_id == models.Organization.id)
        .filter(
            models.Organization.trust_center_published == True,
            models.TrustOverview.published == True,
        )
        .order_by(models.Organization.name)
        .all()
    )
    return [
        {
            "name": org.name,
            "slug": org.slug,
            "summary": overview.summary,
            "contact_email": overview.contact_email,
        }
        for org, overview in results
    ]

@app.get("/api/v1/organizations")
def list_organizations(db: Session = Depends(get_db), su: SessionUser = Depends(resolve_session)):
    require_platform_admin(su)
    return [{"id": str(o.id), "name": o.name, "slug": o.slug} for o in db.query(models.Organization).all()]

@app.post("/api/v1/organizations")
def create_organization(payload: schemas.OrganizationCreate, db: Session = Depends(get_db), su: SessionUser = Depends(resolve_session)):
    require_platform_admin(su)
    org = models.Organization(name=payload.name, slug=payload.slug)
    db.add(org); db.commit(); db.refresh(org)
    return {"id": str(org.id), "name": org.name, "slug": org.slug}

@app.post("/api/v1/organizations/{org_id}/unpublish")
def unpublish_trust_center(org_id: str, db: Session = Depends(get_db), su: SessionUser = Depends(resolve_session)):
    """Org admin endpoint — removes the org from the public directory."""
    require_org_admin(su)
    org = db.query(models.Organization).filter_by(id=uuid.UUID(org_id)).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found.")
    org.trust_center_published = False
    db.commit()
    return {"message": "Your trust center has been removed from the public directory."}

# ── overview CRUD ────────────────────────────────────────────────────
@app.get("/api/v1/overview")
def list_overviews(db: Session = Depends(get_db)):
    return [_ser_overview(o) for o in db.query(models.TrustOverview).all()]

@app.get("/api/v1/overview/{org_id}")
def get_overview(org_id: str, db: Session = Depends(get_db)):
    o = db.query(models.TrustOverview).filter_by(organization_id=uuid.UUID(org_id)).first()
    if not o:
        raise HTTPException(404, "Overview not found")
    return _ser_overview(o)

@app.put("/api/v1/overview/{org_id}")
def upsert_overview(org_id: str, payload: schemas.TrustOverviewCreate, db: Session = Depends(get_db), su: SessionUser = Depends(resolve_session)):
    _require_org_access(su, org_id)
    oid = uuid.UUID(org_id)
    existing = db.query(models.TrustOverview).filter_by(organization_id=oid).first()
    if existing:
        existing.summary = payload.summary
        existing.security_commitment = payload.security_commitment
        existing.contact_email = payload.contact_email
        existing.published = payload.published
    else:
        existing = models.TrustOverview(organization_id=oid, **payload.model_dump())
        db.add(existing)
    # When publishing the overview, also make the org discoverable in the directory
    if payload.published:
        org = db.query(models.Organization).filter_by(id=oid).first()
        if org:
            org.trust_center_published = True
    db.commit(); db.refresh(existing)
    return _ser_overview(existing)

# ── compliance CRUD ──────────────────────────────────────────────────
@app.get("/api/v1/compliance/organizations/{org_id}/compliance")
def list_compliance(org_id: str, db: Session = Depends(get_db)):
    return [_ser_compliance(c) for c in db.query(models.TrustCompliance).filter_by(organization_id=uuid.UUID(org_id)).all()]

@app.post("/api/v1/compliance/organizations/{org_id}/compliance")
def create_compliance(org_id: str, payload: schemas.TrustComplianceCreate, db: Session = Depends(get_db), su: SessionUser = Depends(resolve_session)):
    _require_org_access(su, org_id)
    r = models.TrustCompliance(organization_id=uuid.UUID(org_id), **payload.model_dump())
    db.add(r); db.commit(); db.refresh(r)
    return _ser_compliance(r)

@app.delete("/api/v1/compliance/{item_id}")
def delete_compliance(item_id: str, db: Session = Depends(get_db), su: SessionUser = Depends(resolve_session)):
    require_authenticated(su)
    r = db.query(models.TrustCompliance).filter_by(id=uuid.UUID(item_id)).first()
    if not r: raise HTTPException(404)
    _require_org_access(su, str(r.organization_id))
    db.delete(r); db.commit()
    return {"message": "Deleted"}

# ── subprocessors CRUD ───────────────────────────────────────────────
@app.get("/api/v1/subprocessors/organizations/{org_id}/subprocessors")
def list_subprocessors(org_id: str, db: Session = Depends(get_db)):
    return [_ser_subprocessor(s) for s in db.query(models.TrustSubprocessor).filter_by(organization_id=uuid.UUID(org_id)).all()]

@app.post("/api/v1/subprocessors/organizations/{org_id}/subprocessors")
def create_subprocessor(org_id: str, payload: schemas.TrustSubprocessorCreate, db: Session = Depends(get_db), su: SessionUser = Depends(resolve_session)):
    _require_org_access(su, org_id)
    r = models.TrustSubprocessor(organization_id=uuid.UUID(org_id), **payload.model_dump())
    db.add(r); db.commit(); db.refresh(r)
    return _ser_subprocessor(r)

@app.delete("/api/v1/subprocessors/{item_id}")
def delete_subprocessor(item_id: str, db: Session = Depends(get_db), su: SessionUser = Depends(resolve_session)):
    require_authenticated(su)
    r = db.query(models.TrustSubprocessor).filter_by(id=uuid.UUID(item_id)).first()
    if not r: raise HTTPException(404)
    _require_org_access(su, str(r.organization_id))
    db.delete(r); db.commit()
    return {"message": "Deleted"}

# ── FAQ CRUD ─────────────────────────────────────────────────────────
@app.get("/api/v1/faq/organizations/{org_id}/faq")
def list_faq(org_id: str, db: Session = Depends(get_db)):
    return [_ser_faq(f) for f in db.query(models.TrustFAQ).filter_by(organization_id=uuid.UUID(org_id)).order_by(models.TrustFAQ.order_index).all()]

@app.post("/api/v1/faq/organizations/{org_id}/faq")
def create_faq(org_id: str, payload: schemas.TrustFAQCreate, db: Session = Depends(get_db), su: SessionUser = Depends(resolve_session)):
    _require_org_access(su, org_id)
    r = models.TrustFAQ(organization_id=uuid.UUID(org_id), **payload.model_dump())
    db.add(r); db.commit(); db.refresh(r)
    return _ser_faq(r)

@app.delete("/api/v1/faq/{item_id}")
def delete_faq(item_id: str, db: Session = Depends(get_db), su: SessionUser = Depends(resolve_session)):
    require_authenticated(su)
    r = db.query(models.TrustFAQ).filter_by(id=uuid.UUID(item_id)).first()
    if not r: raise HTTPException(404)
    _require_org_access(su, str(r.organization_id))
    db.delete(r); db.commit()
    return {"message": "Deleted"}

# ── updates CRUD ─────────────────────────────────────────────────────
@app.get("/api/v1/updates/organizations/{org_id}/updates")
def list_updates(org_id: str, db: Session = Depends(get_db)):
    return [_ser_update(u) for u in db.query(models.TrustUpdate).filter_by(organization_id=uuid.UUID(org_id)).all()]

@app.post("/api/v1/updates/organizations/{org_id}/updates")
def create_update(org_id: str, payload: schemas.TrustUpdateCreate, db: Session = Depends(get_db), su: SessionUser = Depends(resolve_session)):
    _require_org_access(su, org_id)
    r = models.TrustUpdate(organization_id=uuid.UUID(org_id), **payload.model_dump())
    db.add(r); db.commit(); db.refresh(r)
    return _ser_update(r)

@app.delete("/api/v1/updates/{item_id}")
def delete_update(item_id: str, db: Session = Depends(get_db), su: SessionUser = Depends(resolve_session)):
    require_authenticated(su)
    r = db.query(models.TrustUpdate).filter_by(id=uuid.UUID(item_id)).first()
    if not r: raise HTTPException(404)
    _require_org_access(su, str(r.organization_id))
    db.delete(r); db.commit()
    return {"message": "Deleted"}

# ── resources CRUD ───────────────────────────────────────────────────
@app.get("/api/v1/resources/organizations/{org_id}/resources")
def list_resources(org_id: str, db: Session = Depends(get_db)):
    return [_ser_resource(r) for r in db.query(models.TrustResource).filter_by(organization_id=uuid.UUID(org_id)).all()]

@app.post("/api/v1/resources/organizations/{org_id}/resources")
def create_resource(org_id: str, payload: schemas.TrustResourceCreate, db: Session = Depends(get_db), su: SessionUser = Depends(resolve_session)):
    _require_org_access(su, org_id)
    r = models.TrustResource(organization_id=uuid.UUID(org_id), **payload.model_dump())
    db.add(r); db.commit(); db.refresh(r)
    return _ser_resource(r)

# ── access requests ──────────────────────────────────────────────────
@app.get("/api/v1/access-requests/organizations/{org_id}/access-requests")
def list_access_requests(org_id: str, db: Session = Depends(get_db), su: SessionUser = Depends(resolve_session)):
    _require_org_access(su, org_id)
    return [_ser_access_req(a) for a in db.query(models.TrustAccessRequest).filter_by(organization_id=uuid.UUID(org_id)).all()]

@app.post("/api/v1/access-requests/organizations/{org_id}/access-requests")
def create_access_request(org_id: str, payload: schemas.TrustAccessRequestCreate, db: Session = Depends(get_db)):
    r = models.TrustAccessRequest(organization_id=uuid.UUID(org_id), **payload.model_dump())
    db.add(r); db.commit(); db.refresh(r)
    return _ser_access_req(r)

@app.put("/api/v1/access-requests/{item_id}/status")
def update_access_request_status(item_id: str, status: str = "approved", db: Session = Depends(get_db), su: SessionUser = Depends(resolve_session)):
    _require_org_access_or_admin(su)
    r = db.query(models.TrustAccessRequest).filter_by(id=uuid.UUID(item_id)).first()
    if not r: raise HTTPException(404)
    r.status = status
    db.commit(); db.refresh(r)
    return _ser_access_req(r)

# ── subscriptions ────────────────────────────────────────────────────
@app.post("/api/v1/subscriptions/organizations/{org_id}/subscriptions")
def create_subscription(org_id: str, payload: schemas.TrustSubscriptionCreate, db: Session = Depends(get_db)):
    r = models.TrustSubscription(organization_id=uuid.UUID(org_id), email=payload.email)
    db.add(r); db.commit(); db.refresh(r)
    return {"id": str(r.id), "email": r.email}

# ── GRC frameworks ───────────────────────────────────────────────────
@app.get("/api/v1/grc/frameworks")
def list_grc_frameworks(db: Session = Depends(get_db)):
    return [_ser_framework(f) for f in db.query(models.GRCFramework).filter_by(published=True).all()]

@app.get("/api/v1/grc/frameworks/{fw_id}/controls")
def list_grc_controls(fw_id: str, db: Session = Depends(get_db)):
    return [_ser_control(c) for c in db.query(models.GRCControl).filter_by(framework_id=uuid.UUID(fw_id), published=True).all()]

@app.get("/api/v1/grc/organizations/{org_id}/status")
def list_grc_status(org_id: str, db: Session = Depends(get_db)):
    return [_ser_ctrl_status(s) for s in db.query(models.GRCControlStatus).filter_by(organization_id=uuid.UUID(org_id)).all()]

@app.get("/api/v1/grc/organizations/{org_id}/overview")
def grc_overview(org_id: str, db: Session = Depends(get_db)):
    statuses = db.query(models.GRCControlStatus).filter_by(organization_id=uuid.UUID(org_id)).all()
    counts = {"pass":0,"fail":0,"partial":0,"na":0,"unknown":0}
    for s in statuses:
        counts[s.status] = counts.get(s.status, 0) + 1
    return {"organization_id": org_id, "total_controls": len(statuses), **{f"{k}_count": v for k, v in counts.items()}}

# ── serializers ──────────────────────────────────────────────────────
def _ser_overview(o):
    return {"id":str(o.id),"organization_id":str(o.organization_id),"summary":o.summary,"security_commitment":o.security_commitment,"contact_email":o.contact_email,"published":o.published,"updated_at":str(o.updated_at) if o.updated_at else None}

def _ser_compliance(c):
    return {"id":str(c.id),"organization_id":str(c.organization_id),"framework":c.framework,"status":c.status,"evidence_url":c.evidence_url,"published":c.published}

def _ser_resource(r):
    return {"id":str(r.id),"organization_id":str(r.organization_id),"title":r.title,"resource_type":r.resource_type,"url":r.url,"published":r.published}

def _ser_subprocessor(s):
    return {"id":str(s.id),"organization_id":str(s.organization_id),"name":s.name,"purpose":s.purpose,"location":s.location,"data_categories":s.data_categories,"published":s.published}

def _ser_faq(f):
    return {"id":str(f.id),"organization_id":str(f.organization_id),"question":f.question,"answer":f.answer,"order_index":f.order_index,"published":f.published}

def _ser_update(u):
    return {"id":str(u.id),"organization_id":str(u.organization_id),"title":u.title,"content":u.content,"published_at":str(u.published_at) if u.published_at else None,"published":u.published}

def _ser_access_req(a):
    return {"id":str(a.id),"organization_id":str(a.organization_id),"full_name":a.full_name,"email":a.email,"company_name":a.company_name,"reason":a.reason,"status":a.status,"created_at":str(a.created_at) if a.created_at else None}

def _ser_framework(f):
    return {"id":str(f.id),"name":f.name,"code":f.code,"jurisdiction":f.jurisdiction,"sector":f.sector,"version":f.version,"description":f.description,"published":f.published}

def _ser_control(c):
    return {"id":str(c.id),"framework_id":str(c.framework_id),"code":c.code,"title":c.title,"description":c.description,"control_type":c.control_type,"severity":c.severity}

def _ser_ctrl_status(s):
    return {"id":str(s.id),"organization_id":str(s.organization_id),"control_id":str(s.control_id),"framework_id":str(s.framework_id),"status":s.status,"details":s.details}

# ── access helpers ───────────────────────────────────────────────────
def _require_org_access(su: SessionUser, org_id: str):
    """Platform admin, compliance_team, and org admin can edit trust content."""
    if su.role == "platform_admin":
        return
    if su.role == "compliance_team":
        return
    require_org_admin(su)

def _require_org_access_or_admin(su: SessionUser):
    require_authenticated(su)
    if su.role not in ("platform_admin", "org_admin", "compliance_team"):
        raise HTTPException(403, "Access denied")


# ── trust requests ────────────────────────────────────────────────────

def _ser_trust_request(r):
    # Build content blob from either the raw JSON field or individual columns
    if r.content:
        try: content = json.loads(r.content)
        except Exception: content = {}
    else:
        content = {
            "overview": {
                "summary": r.overview_summary or "",
                "security_commitment": r.overview_security_commitment or "",
                "contact_email": r.overview_contact_email or "",
            },
            "compliance": json.loads(r.compliance_json or "[]"),
            "subprocessors": json.loads(r.subprocessors_json or "[]"),
            "faq": json.loads(r.faq_json or "[]"),
            "updates": json.loads(r.updates_json or "[]"),
        }
    return {
        "id": str(r.id),
        "org_id": r.org_id or str(r.organization_id),
        "org_name": r.organization_name,
        "org_email": r.org_email or "",
        "status": r.status,
        "slug": r.organization_slug,
        "content": content,
        "submitted_at": str(r.submitted_at or r.created_at),
        "reviewed_at": str(r.reviewed_at) if r.reviewed_at else None,
        "reviewed_by": r.reviewed_by,
    }


@app.post("/api/v1/trust-requests")
async def submit_trust_request(request: Request, db: Session = Depends(get_db), su: SessionUser = Depends(resolve_session)):
    """Org submits a new trust center request."""
    require_authenticated(su)
    if su.role not in ("org_admin", "platform_admin"):
        raise HTTPException(403, "Only org admins can submit trust requests")
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(400, "Invalid JSON body")
    org_id_str = str(body.get("org_id", "")).strip()
    org_name   = str(body.get("org_name", "Unknown Organization")).strip()
    org_email  = str(body.get("org_email", su.email or "")).strip()
    content    = body.get("content", {})
    if not org_id_str:
        raise HTTPException(400, "org_id is required")
    # Parse org_id as UUID (FK to organizations.id)
    try:
        org_uuid = uuid.UUID(org_id_str)
    except ValueError:
        raise HTTPException(400, "org_id must be a valid UUID")
    # Look up the org record to get canonical name and slug
    org = db.query(models.Organization).filter_by(id=org_uuid).first()
    if org:
        org_name = org_name or org.name
        org_slug = org.slug
    else:
        # Derive slug from name and create the org record
        org_slug = re.sub(r"[^a-z0-9-]", "-", org_name.lower()).strip("-")[:50] or org_id_str
        # Check for slug collision
        existing_slug = db.query(models.Organization).filter_by(slug=org_slug).first()
        if existing_slug:
            org_slug = f"{org_slug}-{org_id_str[:8]}"
        org = models.Organization(id=org_uuid, name=org_name, slug=org_slug)
        db.add(org)
        db.flush()
    # Check for duplicate pending request by organization_id
    existing = db.query(models.TrustRequest).filter_by(organization_id=org_uuid, status="pending").first()
    if existing:
        raise HTTPException(409, "A pending trust request already exists for this organization")
    req = models.TrustRequest(
        organization_id=org_uuid,
        organization_name=org_name,
        organization_slug=org_slug,
        status="pending",
        org_id=org_id_str,
        org_email=org_email,
        content=json.dumps(content),
    )
    db.add(req)
    db.commit()
    db.refresh(req)
    return {"id": str(req.id), "status": req.status}


@app.get("/api/v1/trust-requests")
def list_trust_requests(status: Optional[str] = None, db: Session = Depends(get_db), su: SessionUser = Depends(resolve_session)):
    """GRC/admin lists all trust requests."""
    require_authenticated(su)
    if su.role not in ("compliance_team", "platform_admin"):
        raise HTTPException(403, "Only GRC team or admins can view all trust requests")
    q = db.query(models.TrustRequest)
    if status:
        q = q.filter(models.TrustRequest.status == status)
    return [_ser_trust_request(r) for r in q.order_by(models.TrustRequest.submitted_at.desc()).all()]


@app.get("/api/v1/trust-requests/org/{org_id}")
def get_org_trust_request(org_id: str, db: Session = Depends(get_db), su: SessionUser = Depends(resolve_session)):
    """Org fetches their latest trust request."""
    require_authenticated(su)
    # Try by organization_id UUID first (canonical), then fall back to varchar org_id alias
    req = None
    try:
        org_uuid = uuid.UUID(org_id)
        req = db.query(models.TrustRequest).filter_by(organization_id=org_uuid)\
            .order_by(models.TrustRequest.created_at.desc()).first()
    except ValueError:
        pass
    if not req:
        req = db.query(models.TrustRequest).filter_by(org_id=org_id)\
            .order_by(models.TrustRequest.created_at.desc()).first()
    if not req:
        raise HTTPException(404, "No trust request found for this organization")
    return _ser_trust_request(req)


@app.patch("/api/v1/trust-requests/{request_id}/approve")
def approve_trust_request(request_id: str, db: Session = Depends(get_db), su: SessionUser = Depends(resolve_session)):
    """GRC approves a trust request and publishes the org's trust center."""
    require_authenticated(su)
    if su.role not in ("compliance_team", "platform_admin"):
        raise HTTPException(403, "Forbidden")
    try:
        req_uuid = uuid.UUID(request_id)
    except ValueError:
        raise HTTPException(400, "Invalid request ID")
    req = db.query(models.TrustRequest).filter_by(id=req_uuid).first()
    if not req:
        raise HTTPException(404, "Trust request not found")
    if req.status != "pending":
        raise HTTPException(400, f"Request is already {req.status}")

    req.status = "approved"
    req.reviewed_at = utc_now()
    req.reviewed_by = su.email

    # Build content from JSON blob or individual columns
    if req.content:
        try: content = json.loads(req.content)
        except Exception: content = {}
    else:
        content = {
            "overview": {"summary": req.overview_summary or "", "security_commitment": req.overview_security_commitment or "", "contact_email": req.overview_contact_email or ""},
            "compliance": json.loads(req.compliance_json or "[]"),
            "subprocessors": json.loads(req.subprocessors_json or "[]"),
            "faq": json.loads(req.faq_json or "[]"),
            "updates": json.loads(req.updates_json or "[]"),
        }
    org_uuid = req.organization_id
    org_id_str = str(org_uuid)

    # Ensure org record exists (it should since organization_id is an FK)
    org = db.query(models.Organization).filter_by(id=org_uuid).first()
    if not org:
        safe_slug = re.sub(r"[^a-z0-9-]", "-", req.organization_name.lower()).strip("-")[:50] or org_id_str
        org = models.Organization(id=org_uuid, name=req.organization_name, slug=safe_slug)
        db.add(org)
        db.flush()
    org.trust_center_published = True

    # Upsert overview
    ov_data = content.get("overview", {})
    existing_ov = db.query(models.TrustOverview).filter_by(organization_id=org.id).first()
    if existing_ov:
        existing_ov.summary = ov_data.get("summary", existing_ov.summary)
        existing_ov.security_commitment = ov_data.get("security_commitment", existing_ov.security_commitment)
        existing_ov.contact_email = ov_data.get("contact_email", existing_ov.contact_email)
        existing_ov.published = True
    else:
        db.add(models.TrustOverview(
            organization_id=org.id,
            summary=ov_data.get("summary", ""),
            security_commitment=ov_data.get("security_commitment", ""),
            contact_email=ov_data.get("contact_email", ""),
            published=True,
        ))

    for c in content.get("compliance", []):
        db.add(models.TrustCompliance(organization_id=org.id, framework=c.get("framework", ""), status=c.get("status", ""), evidence_url=c.get("evidence_url", ""), published=True))
    for s in content.get("subprocessors", []):
        db.add(models.TrustSubprocessor(organization_id=org.id, name=s.get("name", ""), purpose=s.get("purpose", ""), location=s.get("location", ""), published=True))
    for f in content.get("faq", []):
        db.add(models.TrustFAQ(organization_id=org.id, question=f.get("question", ""), answer=f.get("answer", ""), published=True))
    for u in content.get("updates", []):
        db.add(models.TrustUpdate(organization_id=org.id, title=u.get("title", ""), content=u.get("content", ""), published=True, published_at=utc_now()))

    # Notify org
    db.add(models.TrustOrgNotification(
        org_id=org_id_str,
        title="Trust Center Request Approved",
        message="Your trust center request has been approved and is now publicly visible in the trust directory.",
        kind="success",
    ))
    db.commit()
    return {"id": str(req.id), "status": "approved", "slug": org.slug}


@app.patch("/api/v1/trust-requests/{request_id}/decline")
def decline_trust_request(request_id: str, db: Session = Depends(get_db), su: SessionUser = Depends(resolve_session)):
    """GRC declines a trust request and notifies the org."""
    require_authenticated(su)
    if su.role not in ("compliance_team", "platform_admin"):
        raise HTTPException(403, "Forbidden")
    try:
        req_uuid = uuid.UUID(request_id)
    except ValueError:
        raise HTTPException(400, "Invalid request ID")
    req = db.query(models.TrustRequest).filter_by(id=req_uuid).first()
    if not req:
        raise HTTPException(404, "Trust request not found")
    if req.status != "pending":
        raise HTTPException(400, f"Request is already {req.status}")
    req.status = "declined"
    req.reviewed_at = utc_now()
    req.reviewed_by = su.email
    db.add(models.TrustOrgNotification(
        org_id=req.org_id or str(req.organization_id),
        title="Trust Center Request Declined",
        message="Your trust center request was declined by the GRC team. You may submit a new request with updated information.",
        kind="warning",
    ))
    db.commit()
    return {"id": str(req.id), "status": "declined"}


@app.get("/api/v1/published-trusts")
def list_published_trusts(db: Session = Depends(get_db)):
    """Public: list all approved org trust centers."""
    orgs = db.query(models.Organization).filter_by(trust_center_published=True).all()
    result = []
    for org in orgs:
        ov = db.query(models.TrustOverview).filter_by(organization_id=org.id, published=True).first()
        result.append({
            "id": str(org.id), "name": org.name, "slug": org.slug,
            "summary": ov.summary if ov else "",
            "contact_email": ov.contact_email if ov else "",
        })
    return result


@app.get("/api/v1/notifications/org/{org_id}")
def get_org_notifications(org_id: str, db: Session = Depends(get_db), su: SessionUser = Depends(resolve_session)):
    """Fetch unread notifications for the org portal."""
    require_authenticated(su)
    notifs = db.query(models.TrustOrgNotification).filter_by(org_id=org_id)\
        .order_by(models.TrustOrgNotification.created_at.desc()).limit(20).all()
    return [{"id": str(n.id), "title": n.title, "message": n.message, "kind": n.kind, "is_read": n.is_read, "created_at": str(n.created_at)} for n in notifs]


@app.post("/api/v1/notifications/org/{org_id}/read")
def mark_notifications_read(org_id: str, db: Session = Depends(get_db), su: SessionUser = Depends(resolve_session)):
    """Mark all org notifications as read."""
    require_authenticated(su)
    db.query(models.TrustOrgNotification).filter_by(org_id=org_id, is_read=False).update({"is_read": True})
    db.commit()
    return {"ok": True}
