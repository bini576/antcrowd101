from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc, func
from uuid import UUID

from app.db import get_db
from app import models, schemas

router = APIRouter()


# ----------------------------
# Frameworks
# ----------------------------
@router.post("/frameworks", response_model=schemas.GRCFrameworkOut)
def create_framework(payload: schemas.GRCFrameworkCreate, db: Session = Depends(get_db)):
    record = models.GRCFramework(**payload.model_dump())
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


@router.get("/frameworks", response_model=list[schemas.GRCFrameworkOut])
def list_frameworks(db: Session = Depends(get_db)):
    return db.query(models.GRCFramework).filter_by(published=True).all()


# ----------------------------
# Controls
# ----------------------------
@router.post("/frameworks/{framework_id}/controls", response_model=schemas.GRCControlOut)
def create_control(
    framework_id: UUID, payload: schemas.GRCControlCreate, db: Session = Depends(get_db)
):
    framework = db.query(models.GRCFramework).filter_by(id=framework_id).first()
    if not framework:
        raise HTTPException(404, "Framework not found")
    record = models.GRCControl(framework_id=framework_id, **payload.model_dump())
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


@router.get("/frameworks/{framework_id}/controls", response_model=list[schemas.GRCControlOut])
def list_controls(framework_id: UUID, db: Session = Depends(get_db)):
    return (
        db.query(models.GRCControl)
        .filter_by(framework_id=framework_id, published=True)
        .all()
    )


# ----------------------------
# Evidence
# ----------------------------
@router.post("/organizations/{org_id}/evidence", response_model=schemas.GRCEvidenceOut)
def create_evidence(
    org_id: UUID, payload: schemas.GRCEvidenceCreate, db: Session = Depends(get_db)
):
    record = models.GRCEvidence(organization_id=org_id, **payload.model_dump())
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


@router.get("/organizations/{org_id}/evidence", response_model=list[schemas.GRCEvidenceOut])
def list_evidence(org_id: UUID, db: Session = Depends(get_db)):
    return (
        db.query(models.GRCEvidence)
        .filter_by(organization_id=org_id, published=True)
        .order_by(desc(models.GRCEvidence.collected_at))
        .all()
    )


# ----------------------------
# Integrations (scaffold)
# ----------------------------
@router.post("/organizations/{org_id}/integrations", response_model=schemas.GRCIntegrationOut)
def upsert_integration(
    org_id: UUID, payload: schemas.GRCIntegrationCreate, db: Session = Depends(get_db)
):
    existing = (
        db.query(models.GRCIntegration)
        .filter_by(organization_id=org_id, provider=payload.provider)
        .first()
    )
    if existing:
        existing.status = payload.status
        existing.config = payload.config
        existing.published = payload.published
        db.add(existing)
        db.commit()
        db.refresh(existing)
        return existing

    record = models.GRCIntegration(organization_id=org_id, **payload.model_dump())
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


@router.get("/organizations/{org_id}/integrations", response_model=list[schemas.GRCIntegrationOut])
def list_integrations(org_id: UUID, db: Session = Depends(get_db)):
    return (
        db.query(models.GRCIntegration)
        .filter_by(organization_id=org_id, published=True)
        .all()
    )


@router.post("/organizations/{org_id}/integrations/{provider}/sync", response_model=schemas.GRCIntegrationOut)
def mock_sync_integration(org_id: UUID, provider: str, db: Session = Depends(get_db)):
    integration = (
        db.query(models.GRCIntegration)
        .filter_by(organization_id=org_id, provider=provider)
        .first()
    )
    if not integration:
        raise HTTPException(404, "Integration not found")
    integration.status = "connected"
    integration.last_sync_at = func.now()
    integration.last_error = None
    db.add(integration)
    db.commit()
    db.refresh(integration)
    return integration


# ----------------------------
# Evaluation
# ----------------------------
@router.post("/organizations/{org_id}/evaluate", response_model=list[schemas.GRCControlStatusOut])
def evaluate_controls(org_id: UUID, db: Session = Depends(get_db)):
    controls = db.query(models.GRCControl).filter_by(published=True).all()
    statuses = []

    for control in controls:
        latest_evidence = (
            db.query(models.GRCEvidence)
            .filter_by(
                organization_id=org_id,
                evidence_type=control.evidence_type,
                published=True,
            )
            .order_by(desc(models.GRCEvidence.collected_at))
            .first()
        )

        status = "unknown"
        details = None

        if control.check_type == "evidence_present":
            status = "pass" if latest_evidence else "fail"
            details = "Evidence found" if latest_evidence else "No evidence found"
        elif control.check_type == "evidence_equals":
            if latest_evidence and control.expected_value is not None:
                if latest_evidence.value == control.expected_value:
                    status = "pass"
                    details = "Evidence matches expected value"
                else:
                    status = "fail"
                    details = (
                        f"Expected {control.expected_value}, got {latest_evidence.value}"
                    )
            else:
                status = "unknown"
                details = "Missing evidence or expected value"

        # Upsert status
        existing = (
            db.query(models.GRCControlStatus)
            .filter_by(organization_id=org_id, control_id=control.id)
            .first()
        )
        if existing:
            existing.status = status
            existing.details = details
            existing.framework_id = control.framework_id
            db.add(existing)
            db.commit()
            db.refresh(existing)
            statuses.append(existing)
        else:
            record = models.GRCControlStatus(
                organization_id=org_id,
                control_id=control.id,
                framework_id=control.framework_id,
                status=status,
                details=details,
            )
            db.add(record)
            db.commit()
            db.refresh(record)
            statuses.append(record)

    return statuses


@router.get("/organizations/{org_id}/status", response_model=list[schemas.GRCControlStatusOut])
def list_status(org_id: UUID, db: Session = Depends(get_db)):
    return (
        db.query(models.GRCControlStatus)
        .filter_by(organization_id=org_id)
        .order_by(desc(models.GRCControlStatus.evaluated_at))
        .all()
    )


@router.get("/organizations/{org_id}/overview", response_model=schemas.GRCOverviewOut)
def grc_overview(org_id: UUID, db: Session = Depends(get_db)):
    statuses = (
        db.query(models.GRCControlStatus)
        .filter_by(organization_id=org_id)
        .all()
    )
    total = len(statuses)
    counts = {"pass": 0, "fail": 0, "partial": 0, "na": 0, "unknown": 0}
    for s in statuses:
        counts[s.status] = counts.get(s.status, 0) + 1

    framework_map = {}
    for s in statuses:
        fw = framework_map.get(s.framework_id)
        if not fw:
            framework = db.query(models.GRCFramework).filter_by(id=s.framework_id).first()
            if not framework:
                continue
            fw = {
                "framework_id": framework.id,
                "name": framework.name,
                "code": framework.code,
                "pass_count": 0,
                "fail_count": 0,
                "partial_count": 0,
                "na_count": 0,
                "unknown_count": 0,
            }
            framework_map[s.framework_id] = fw
        key = f"{s.status}_count"
        fw[key] = fw.get(key, 0) + 1

    return {
        "organization_id": org_id,
        "total_controls": total,
        "pass_count": counts["pass"],
        "fail_count": counts["fail"],
        "partial_count": counts["partial"],
        "na_count": counts["na"],
        "unknown_count": counts["unknown"],
        "frameworks": list(framework_map.values()),
    }


# ----------------------------
# Seed (Ethiopia + ISO baseline placeholders)
# ----------------------------
@router.post("/seed/ethiopia-iso", response_model=list[schemas.GRCFrameworkOut])
def seed_frameworks(db: Session = Depends(get_db)):
    seeds = [
        {
            "name": "Ethiopia Personal Data Protection Proclamation",
            "code": "ET-PDPP",
            "jurisdiction": "Ethiopia",
            "sector": "all",
        },
        {
            "name": "Ethiopia Electronic Transactions Proclamation",
            "code": "ET-ETP",
            "jurisdiction": "Ethiopia",
            "sector": "all",
        },
        {
            "name": "Ethiopia IT Products Security Clearance and Control",
            "code": "ET-ITPSCC",
            "jurisdiction": "Ethiopia",
            "sector": "all",
        },
        {
            "name": "Ethiopia Health Service Administration and Regulation",
            "code": "ET-HSAR",
            "jurisdiction": "Ethiopia",
            "sector": "healthcare",
        },
        {
            "name": "NBE IT Management Directive (Banks)",
            "code": "ET-NBE-IT",
            "jurisdiction": "Ethiopia",
            "sector": "fintech",
        },
        {
            "name": "NBE National Payment System Proclamation",
            "code": "ET-NBE-NPS",
            "jurisdiction": "Ethiopia",
            "sector": "fintech",
        },
        {
            "name": "Banking Business Proclamation",
            "code": "ET-BANK",
            "jurisdiction": "Ethiopia",
            "sector": "fintech",
        },
        {
            "name": "General Education Proclamation",
            "code": "ET-EDU",
            "jurisdiction": "Ethiopia",
            "sector": "education",
        },
        {
            "name": "Schools Licensing and Renewal Directive",
            "code": "ET-EDU-LIC",
            "jurisdiction": "Ethiopia",
            "sector": "education",
        },
        {
            "name": "ISO/IEC 27001",
            "code": "ISO-27001",
            "jurisdiction": "ISO",
            "sector": "all",
        },
        {
            "name": "ISO/IEC 27701",
            "code": "ISO-27701",
            "jurisdiction": "ISO",
            "sector": "all",
        },
        {
            "name": "ISO 22301",
            "code": "ISO-22301",
            "jurisdiction": "ISO",
            "sector": "all",
        },
    ]

    created = []
    for seed in seeds:
        exists = db.query(models.GRCFramework).filter_by(code=seed["code"]).first()
        if exists:
            created.append(exists)
            continue
        record = models.GRCFramework(**seed)
        db.add(record)
        db.commit()
        db.refresh(record)
        created.append(record)

    return created


@router.post("/seed/controls", response_model=list[schemas.GRCControlOut])
def seed_controls(db: Session = Depends(get_db)):
    frameworks = {f.code: f for f in db.query(models.GRCFramework).all()}
    if not frameworks:
        raise HTTPException(400, "No frameworks found. Seed frameworks first.")

    control_seeds = [
        # Ethiopia baseline
        ("ET-PDPP", "PD-1", "Data Inventory", "Maintain a data inventory.", "administrative", "data_inventory", "evidence_present", None, "high"),
        ("ET-PDPP", "PD-2", "Lawful Basis", "Define lawful basis for processing.", "administrative", "privacy_policy", "evidence_present", None, "high"),
        ("ET-PDPP", "PD-3", "Data Subject Rights", "Process access/erasure requests.", "administrative", "dsr_process", "evidence_present", None, "high"),
        ("ET-ETP", "ET-1", "Record Integrity", "Protect integrity of electronic records.", "technical", "backup_policy", "evidence_present", None, "medium"),
        ("ET-ITPSCC", "IT-1", "Secure Configuration", "Maintain secure system configuration baseline.", "technical", "config_baseline", "evidence_present", None, "medium"),
        # Healthcare
        ("ET-HSAR", "HL-1", "Health Data Access", "Role-based access to health data.", "technical", "rbac_enabled", "evidence_equals", "true", "high"),
        ("ET-HSAR", "HL-2", "Audit Logging", "Enable audit logging for health systems.", "technical", "audit_logging", "evidence_equals", "true", "high"),
        # Fintech
        ("ET-NBE-IT", "FT-1", "IT Risk Management", "Document IT risk management process.", "administrative", "it_risk_policy", "evidence_present", None, "high"),
        ("ET-NBE-NPS", "FT-2", "Transaction Monitoring", "Monitor and log payment transactions.", "technical", "transaction_logging", "evidence_equals", "true", "high"),
        ("ET-BANK", "FT-3", "BCP/DR", "Maintain business continuity and disaster recovery plan.", "administrative", "bcp_dr_plan", "evidence_present", None, "high"),
        # Education
        ("ET-EDU", "ED-1", "Student Data Protection", "Protect student personal data.", "administrative", "student_data_policy", "evidence_present", None, "high"),
        ("ET-EDU-LIC", "ED-2", "Institutional Records", "Maintain required institutional records.", "administrative", "records_policy", "evidence_present", None, "medium"),
        # ISO
        ("ISO-27001", "ISO-1", "ISMS Scope", "Define ISMS scope and context.", "administrative", "isms_scope", "evidence_present", None, "high"),
        ("ISO-27001", "ISO-2", "Access Control", "Implement access control policy.", "administrative", "access_control_policy", "evidence_present", None, "high"),
        ("ISO-27001", "ISO-3", "Asset Management", "Maintain asset inventory.", "administrative", "asset_inventory", "evidence_present", None, "medium"),
        ("ISO-27701", "ISO-P1", "Privacy Roles", "Define privacy roles and responsibilities.", "administrative", "privacy_roles", "evidence_present", None, "medium"),
        ("ISO-27701", "ISO-P2", "PIA/DPIA", "Perform privacy impact assessments.", "administrative", "dpia_process", "evidence_present", None, "high"),
        ("ISO-22301", "BCP-1", "Business Continuity Plan", "Maintain BCP policy and plan.", "administrative", "bcp_policy", "evidence_present", None, "high"),
    ]

    created = []
    for (
        fw_code,
        code,
        title,
        requirement,
        control_type,
        evidence_type,
        check_type,
        expected_value,
        severity,
    ) in control_seeds:
        framework = frameworks.get(fw_code)
        if not framework:
            continue
        exists = (
            db.query(models.GRCControl)
            .filter_by(framework_id=framework.id, code=code)
            .first()
        )
        if exists:
            created.append(exists)
            continue
        record = models.GRCControl(
            framework_id=framework.id,
            code=code,
            title=title,
            requirement=requirement,
            control_type=control_type,
            evidence_type=evidence_type,
            check_type=check_type,
            expected_value=expected_value,
            severity=severity,
        )
        db.add(record)
        db.commit()
        db.refresh(record)
        created.append(record)

    return created
