from datetime import date, datetime, timezone
import ipaddress
import os
import re
import socket
from typing import Any
from urllib.parse import urlparse
from uuid import uuid4

import requests
from fastapi import Depends, FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy.exc import IntegrityError
from sqlalchemy import select, text
from sqlalchemy.orm import Session, selectinload

from .auth_introspect import (
    ANONYMOUS_USER,
    PLATFORM_LOGIN_URL,
    PLATFORM_LOGOUT_URL,
    SESSION_COOKIE_NAME,
    SessionUser,
    require_authenticated,
    require_platform_admin,
    resolve_session,
)
from .database import SessionLocal
from .models import (
    BugBountyNotification,
    BugBountyParticipant,
    BugBountyProgram,
    BugBountySubmission,
    PayoutRequest,
    ResearcherEarning,
)


app = FastAPI(
    title="AntCrowd Bug Bounty Service",
    description="Persistent bug bounty workflows with automated category-based criticality.",
    version="3.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS",
        "http://localhost:5173,http://localhost:5174,http://localhost:8089").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SERVICE_META = {
    "key": "bug-bounty",
    "name": "Bug Bounty Service",
    "headline": "Launch scoped bounty programs with persistent approvals, researcher joins, and automated severity ranking.",
    "tagline": "Crowdsourced vulnerability discovery with persistent oversight.",
    "programLabel": "bounty program",
    "submissionLabel": "vulnerability report",
    "joinLabel": "Join program",
}

# Legacy display names for seed data records that used demo usernames
LEGACY_DISPLAY_NAMES = {
    "platform_admin": "Platform Admin",
    "org_admin": "Organization Admin",
    "researcher": "Bob",
    "user": "Public Visitor",
}

# Kept for seed_demo_data only
_SEED_USERS = {
    "platform_admin": {"role": "platform_admin", "label": "Platform Admin", "display_name": "Platform Admin"},
    "org_admin": {"role": "org_admin", "label": "Organization Admin", "display_name": "Organization Admin"},
    "researcher": {"role": "researcher", "label": "Bob", "display_name": "Bob"},
    "user": {"role": "user", "label": "Public Visitor", "display_name": "Public Visitor"},
}

CRITICAL_CATEGORIES = {"RCE", "SSRF", "Authentication Bypass", "Privilege Escalation"}
VERY_HIGH_CATEGORIES = {"SQL Injection", "Deserialization", "Command Injection"}
HIGH_CATEGORIES = {"Sensitive Data Exposure", "IDOR", "Directory Traversal", "XXE"}
MEDIUM_CATEGORIES = {"XSS", "Broken Access Control", "CSRF", "Open Redirect"}
LOW_CATEGORIES = {"Information Disclosure", "Misconfiguration", "Other"}


# LoginInput removed — authentication is handled by platform session cookies


class ProgramCreateInput(BaseModel):
    program_name: str = Field(min_length=3, max_length=120)
    description: str = Field(min_length=10, max_length=400)
    contact_email: str = Field(default="", max_length=200)
    program_type: str = Field(min_length=3, max_length=20)
    target_assets: list[str] = Field(min_length=1)
    in_scope_targets: str = Field(min_length=3, max_length=2400)
    out_of_scope: str = Field(min_length=3, max_length=240)
    reward_range: str = Field(default="", max_length=120)
    rules_of_engagement: str = Field(min_length=5, max_length=240)
    testing_start_date: str
    testing_end_date: str
    budget: str = Field(min_length=2, max_length=80)
    poc_target_url: str = Field(min_length=8, max_length=240)


class DecisionInput(BaseModel):
    action: str
    comment: str = ""


class JoinInput(BaseModel):
    pass  # username resolved from session


class SubmissionInput(BaseModel):
    title: str = Field(min_length=3, max_length=120)
    summary: str = Field(min_length=10, max_length=400)
    vulnerable_url: str = Field(min_length=8, max_length=320)
    evidence: str = Field(min_length=3, max_length=240)
    finding_categories: list[str] = Field(min_length=1)


class PoCValidationInput(BaseModel):
    url: str = Field(min_length=8, max_length=400)
    payload: str = Field(min_length=1, max_length=500)


class NotificationReadInput(BaseModel):
    pass  # username resolved from session


class PayoutRequestInput(BaseModel):
    amount: int = Field(gt=0)
    payment_method: str
    account_details: dict[str, Any] = Field(default_factory=dict)


class PayoutDecisionInput(BaseModel):
    note: str = ""


class DisputeInput(BaseModel):
    reason: str = Field(min_length=10, max_length=2000)


class DisputeResolveInput(BaseModel):
    resolution: str = Field(min_length=5, max_length=2000)


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def parse_date(value: str) -> date | None:
    try:
        return date.fromisoformat(value)
    except ValueError:
        return None


def resolve_user_from_session(session_user: SessionUser) -> dict[str, str]:
    """Convert a SessionUser into the dict shape the rest of the code expects."""
    return {
        "role": session_user.role,
        "label": session_user.display_name,
        "display_name": session_user.display_name,
    }


def require_role_session(session_user: SessionUser, allowed: list[str]) -> dict[str, str]:
    """Check that the session user has one of the allowed roles."""
    if session_user.role not in allowed:
        raise HTTPException(status_code=403, detail="This action is not available for your account role")
    return resolve_user_from_session(session_user)


def display_name(username: str) -> str:
    """Return a human-friendly display name for a username stored in the DB."""
    legacy = LEGACY_DISPLAY_NAMES.get(username)
    if legacy:
        return legacy
    # For real email-based usernames, return the email itself
    return username


def slugify(value: str) -> str:
    collapsed = re.sub(r"[^a-z0-9]+", "-", value.strip().lower())
    collapsed = collapsed.strip("-")
    return collapsed or "program"


def generate_program_id(program_name: str) -> str:
    return f"bounty-{slugify(program_name)}-{uuid4().hex[:8]}"


def generate_submission_id() -> str:
    return f"bug-{uuid4().hex[:12]}"


def create_notification(db: Session, username: str, title: str, message: str, kind: str = "info") -> None:
    db.add(
        BugBountyNotification(
            username=username,
            title=title,
            message=message,
            kind=kind,
            is_read=False,
            created_at=utc_now(),
        ),
    )


def ensure_earning_for_submission(db: Session, submission: BugBountySubmission) -> None:
    if submission.status != "accepted" or submission.value_awarded <= 0:
        return
    existing = db.scalar(
        select(ResearcherEarning).where(ResearcherEarning.submission_id == submission.id),
    )
    if existing:
        existing.amount = submission.value_awarded
        existing.status = "paid" if existing.status == "paid" else "confirmed"
        existing.updated_at = utc_now()
        return
    db.add(
        ResearcherEarning(
            submission_id=submission.id,
            username=submission.username,
            amount=submission.value_awarded,
            status="confirmed",
            created_at=utc_now(),
            updated_at=utc_now(),
        ),
    )


def ensure_participant(db: Session, program: BugBountyProgram, username: str) -> None:
    existing = db.scalar(
        select(BugBountyParticipant).where(
            BugBountyParticipant.program_id == program.id,
            BugBountyParticipant.username == username,
        ),
    )
    if existing:
        return
    db.add(BugBountyParticipant(program_id=program.id, username=username, joined_at=utc_now()))


def require_joined_participant(program: BugBountyProgram, username: str) -> None:
    if not any(item.username == username for item in program.participants):
        raise HTTPException(status_code=400, detail="Join this bug bounty program before submitting a report")


def severity_from_categories(categories: list[str]) -> str:
    selected = set(categories)
    if selected & CRITICAL_CATEGORIES:
        return "Critical"
    if selected & VERY_HIGH_CATEGORIES:
        return "Very High"
    if selected & HIGH_CATEGORIES:
        return "High"
    if selected & MEDIUM_CATEGORIES:
        return "Medium"
    return "Low"


def award_from_severity(severity: str, base_value: int) -> int:
    multiplier = {"Critical": 1.0, "Very High": 0.86, "High": 0.72, "Medium": 0.45, "Low": 0.22}.get(severity, 0.18)
    return max(int(base_value * multiplier), 250)


def serialize_notification(item: BugBountyNotification) -> dict[str, Any]:
    return {
        "id": item.id,
        "title": item.title,
        "message": item.message,
        "kind": item.kind,
        "isRead": item.is_read,
        "createdAt": item.created_at.isoformat(),
    }


def serialize_submission(item: BugBountySubmission) -> dict[str, Any]:
    return {
        "id": item.id,
        "programId": item.program_id,
        "programTitle": item.program_title,
        "username": item.username,
        "usernameLabel": display_name(item.username),
        "title": item.title,
        "summary": item.summary,
        "impact": item.severity,
        "severity": item.severity,
        "vulnerableUrl": item.vulnerable_url,
        "findingCategories": item.finding_categories,
        "evidence": item.evidence,
        "status": item.status,
        "valueAwarded": item.value_awarded,
        "createdAt": item.created_at.isoformat(),
        "disputeReason": item.dispute_reason,
        "disputedAt": item.disputed_at.isoformat() if item.disputed_at else None,
        "assigned_developer": item.assigned_developer,
        "assignedDeveloper": item.assigned_developer,
        "developer_tag": item.developer_tag,
        "developerTag": item.developer_tag,
    }


def effective_status(program: BugBountyProgram) -> str:
    if program.status == "deleted":
        return "deleted"
    if program.status == "closed":
        return "closed"
    if program.status == "approved" and program.testing_end_date and program.testing_end_date < date.today():
        return "expired"
    return program.status


def serialize_program(program: BugBountyProgram, viewer_role: str | None = None) -> dict[str, Any]:
    participant_names = [display_name(participant.username) for participant in sorted(program.participants, key=lambda row: row.joined_at)]
    recent_submissions = [serialize_submission(item) for item in sorted(program.submissions, key=lambda row: row.created_at, reverse=True)[:3]]
    result = {
        "id": program.id,
        "title": program.title,
        "summary": program.summary,
        "status": effective_status(program),
        "owner": program.owner_username,
        "scope": f"Type: {program.program_type} | Assets: {', '.join(program.target_assets)} | In scope: {program.in_scope_targets}",
        "reward": f"Budget {program.budget}",
        "rewardValue": program.reward_value,
        "rules": f"Out of scope: {program.out_of_scope} | Period: {program.testing_start_date} to {program.testing_end_date} | {program.rules_of_engagement}",
        "track": program.program_type,
        "priority": ", ".join(program.target_assets),
        "participants": participant_names,
        "participantCount": len(participant_names),
        "submissionCount": len(program.submissions),
        "pocTargetUrl": program.poc_target_url,
        "defaultTestPayload": program.default_test_payload,
        "inScopeTargets": program.in_scope_targets,
        "createdAt": program.created_at.isoformat(),
        "recentSubmissions": recent_submissions,
    }
    if viewer_role and viewer_role in ("platform_admin", "org_admin"):
        result["contactEmail"] = program.contact_email
    return result


def build_leaderboard(db: Session) -> list[dict[str, Any]]:
    scores: dict[str, int] = {}
    rows = db.scalars(select(BugBountySubmission)).all()
    for row in rows:
        scores[row.username] = scores.get(row.username, 0) + row.value_awarded
    ranking = sorted(scores.items(), key=lambda pair: pair[1], reverse=True)
    return [{"name": display_name(name), "score": score, "label": "USD"} for name, score in ranking]


def earning_summary_for(db: Session, username: str) -> dict[str, int]:
    earnings = db.scalars(select(ResearcherEarning).where(ResearcherEarning.username == username)).all()
    payouts = db.scalars(select(PayoutRequest).where(PayoutRequest.username == username)).all()
    total_earned = sum(item.amount for item in earnings if item.status in {"pending", "confirmed", "paid"})
    paid_out = sum(item.amount for item in payouts if item.status == "paid")
    pending_payout = sum(item.amount for item in payouts if item.status in {"pending", "approved"})
    confirmed_balance = sum(item.amount for item in earnings if item.status == "confirmed")
    available_balance = max(confirmed_balance - pending_payout, 0)
    return {
        "totalEarned": total_earned,
        "availableBalance": available_balance,
        "pendingPayout": pending_payout,
        "paidOut": paid_out,
        "minimumPayout": 100,
    }


def serialize_earning(item: ResearcherEarning, submission: BugBountySubmission | None = None) -> dict[str, Any]:
    return {
        "id": item.id,
        "submissionId": item.submission_id,
        "submissionTitle": submission.title if submission else item.submission_id,
        "programTitle": submission.program_title if submission else "",
        "username": item.username,
        "researcherName": display_name(item.username),
        "amount": item.amount,
        "status": item.status,
        "createdAt": item.created_at.isoformat(),
        "updatedAt": item.updated_at.isoformat(),
    }


def serialize_payout(item: PayoutRequest) -> dict[str, Any]:
    return {
        "id": item.id,
        "username": item.username,
        "researcherName": display_name(item.username),
        "amount": item.amount,
        "paymentMethod": item.payment_method,
        "accountDetails": item.account_details,
        "status": item.status,
        "adminNote": item.admin_note or "",
        "requestedAt": item.requested_at.isoformat(),
        "updatedAt": item.updated_at.isoformat(),
        "approvedAt": item.approved_at.isoformat() if item.approved_at else None,
        "paidAt": item.paid_at.isoformat() if item.paid_at else None,
        "rejectedAt": item.rejected_at.isoformat() if item.rejected_at else None,
    }


def validate_payout_details(method: str, details: dict[str, Any]) -> str:
    normalized = method.strip().lower().replace("_", "-").replace(" ", "-")
    method_map = {
        "bank": "bank-transfer",
        "bank-transfer": "bank-transfer",
        "mobile-money": "mobile-money",
        "mobile": "mobile-money",
        "paypal": "paypal",
    }
    payment_method = method_map.get(normalized, normalized)
    if payment_method not in {"bank-transfer", "mobile-money", "paypal"}:
        raise HTTPException(status_code=400, detail="Payment method must be bank transfer, mobile money, or PayPal")
    required_fields = {
        "bank-transfer": ("accountName", "bankName", "accountNumber"),
        "mobile-money": ("provider", "phoneNumber", "accountName"),
        "paypal": ("email",),
    }[payment_method]
    missing = [field for field in required_fields if not str(details.get(field, "")).strip()]
    if missing:
        raise HTTPException(status_code=400, detail=f"Missing payout account details: {', '.join(missing)}")
    return payment_method


def payout_for_update(db: Session, payout_id: int) -> PayoutRequest:
    payout = db.scalar(select(PayoutRequest).where(PayoutRequest.id == payout_id))
    if not payout:
        raise HTTPException(status_code=404, detail="Payout request not found")
    return payout


def mark_confirmed_earnings_paid(db: Session, username: str, amount: int) -> None:
    remaining = amount
    earnings = db.scalars(
        select(ResearcherEarning)
        .where(ResearcherEarning.username == username, ResearcherEarning.status == "confirmed")
        .order_by(ResearcherEarning.created_at.asc()),
    ).all()
    for earning in earnings:
        if remaining <= 0:
            return
        earning.status = "paid"
        earning.updated_at = utc_now()
        remaining -= earning.amount


def program_for_update(db: Session, program_id: str) -> BugBountyProgram:
    program = db.scalar(
        select(BugBountyProgram)
        .where(BugBountyProgram.id == program_id)
        .options(selectinload(BugBountyProgram.participants), selectinload(BugBountyProgram.submissions)),
    )
    if not program:
        raise HTTPException(status_code=404, detail="Program not found")
    return program


def build_dashboard(db: Session, session_user: SessionUser) -> dict[str, Any]:
    username = session_user.username
    role = session_user.role
    programs = db.scalars(
        select(BugBountyProgram)
        .options(selectinload(BugBountyProgram.participants), selectinload(BugBountyProgram.submissions))
        .order_by(BugBountyProgram.created_at.desc()),
    ).all()
    non_deleted = [program for program in programs if program.status != "deleted"]
    approved = [program for program in non_deleted if program.status in ("approved", "closed")]
    pending = [program for program in non_deleted if program.status == "pending"]
    joined = [program for program in approved if any(item.username == username for item in program.participants)]
    available = [program for program in approved if program.status != "closed" and all(item.username != username for item in program.participants)]
    owned = [program for program in programs if program.owner_username == username]

    all_submissions = db.scalars(select(BugBountySubmission).order_by(BugBountySubmission.created_at.desc())).all()
    if role == "platform_admin":
        visible_programs = non_deleted
        visible_submissions = all_submissions
    elif role == "org_admin":
        visible_programs = owned
        visible_submissions = [row for row in all_submissions if program_for_update(db, row.program_id).owner_username == username]
    elif role == "researcher":
        visible_programs = approved
        visible_submissions = [row for row in all_submissions if row.username == username]
    elif role == "developer":
        # Developers see all submissions across all programs for security review
        visible_programs = non_deleted
        visible_submissions = all_submissions
    else:
        visible_programs = approved
        visible_submissions = []

    # platform_admin notifications are keyed on the literal string "platform_admin"
    # (see create_notification calls), not the admin's email address.
    notify_key = "platform_admin" if role == "platform_admin" else username
    notifications = db.scalars(
        select(BugBountyNotification).where(BugBountyNotification.username == notify_key).order_by(BugBountyNotification.created_at.desc()),
    ).all()

    summary = {
        "approvedPrograms": len(approved),
        "pendingPrograms": len(pending),
        "participants": sum(len(program.participants) for program in approved),
        "submissions": len(all_submissions),
        "userJoined": len(joined),
        "userSubmissions": len([row for row in all_submissions if row.username == username]),
        "userValue": sum(row.value_awarded for row in all_submissions if row.username == username),
        "unreadNotifications": sum(0 if item.is_read else 1 for item in notifications),
    }

    return {
        "service": SERVICE_META,
        "role": {"username": username, "name": role, "label": session_user.display_name, "displayName": session_user.display_name},
        "summary": summary,
        "metrics": [
            {"label": "Approved Programs", "value": summary["approvedPrograms"]},
            {"label": "Pending Reviews", "value": summary["pendingPrograms"]},
            {"label": "Researchers Active", "value": summary["participants"]},
            {"label": "Vulnerability Reports", "value": summary["submissions"]},
        ],
        "programs": [serialize_program(program, role) for program in visible_programs],
        "pendingPrograms": [serialize_program(program, role) for program in pending],
        "joinedPrograms": [serialize_program(program, role) for program in joined],
        "availablePrograms": [serialize_program(program, role) for program in available],
        "submissions": [serialize_submission(item) for item in visible_submissions],
        "leaderboard": build_leaderboard(db),
        "notifications": [serialize_notification(item) for item in notifications],
    }


def normalize_http_url(raw_url: str) -> str:
    normalized = raw_url.strip()
    if not normalized:
        return ""
    if "://" not in normalized:
        return f"https://{normalized}"
    return normalized


def is_valid_http_url(raw_url: str) -> bool:
    parsed = urlparse(raw_url)
    return parsed.scheme in {"http", "https"} and bool(parsed.netloc)


def validate_program_window(start_value: str, end_value: str) -> tuple[date | None, date | None]:
    start_date = parse_date(start_value)
    end_date = parse_date(end_value)
    if start_value and start_date is None:
        raise HTTPException(status_code=400, detail="Testing start date must use YYYY-MM-DD format")
    if end_value and end_date is None:
        raise HTTPException(status_code=400, detail="Testing end date must use YYYY-MM-DD format")
    if start_date and end_date and end_date < start_date:
        raise HTTPException(status_code=400, detail="Testing end date must be on or after the start date")
    return start_date, end_date


def normalize_categories(categories: list[str]) -> list[str]:
    cleaned: list[str] = []
    seen: set[str] = set()
    for item in categories:
        value = item.strip()
        if value and value not in seen:
            cleaned.append(value)
            seen.add(value)
    if not cleaned:
        raise HTTPException(status_code=400, detail="Select at least one finding category")
    return cleaned

def _is_safe_url(url: str) -> bool:
    try:
        parsed = urlparse(url)
        if parsed.scheme not in {"http", "https"}:
            return False
        hostname = parsed.hostname
        if not hostname or hostname.lower() in {"localhost", "metadata.google.internal"}:
            return False
        ip = socket.gethostbyname(hostname)
        addr = ipaddress.ip_address(ip)
        return not (addr.is_private or addr.is_loopback or addr.is_link_local or addr.is_reserved)
    except Exception:
        return False


def run_poc_validator(url: str, payload: str) -> dict[str, Any]:
    if not _is_safe_url(url):
        return {"is_valid": False, "risk_score": 0, "message": "Target URL is not allowed."}
    if not is_valid_http_url(url):
        return {"is_valid": False, "risk_score": 2.0, "message": "Invalid URL. Provide a full http/https target URL."}

    timeout_seconds = 6
    baseline_status = None
    try:
        baseline = requests.get(url, timeout=timeout_seconds)
        baseline_status = baseline.status_code
    except requests.RequestException:
        baseline_status = None

    injected_calls = [
        ("GET", lambda: requests.get(url, params={"q": payload, "input": payload}, headers={"X-AntCrowd-Payload": payload}, timeout=timeout_seconds)),
        ("POST", lambda: requests.post(url, data={"input": payload}, headers={"X-AntCrowd-Payload": payload}, timeout=timeout_seconds)),
    ]
    indicators = ("success", "sql", "syntax error", "xss", "alert(", "injection")
    any_response = False

    for method, call in injected_calls:
        try:
            response = call()
            any_response = True
        except requests.Timeout:
            continue
        except requests.RequestException:
            continue

        body = response.text.lower()
        status_changed = baseline_status is not None and response.status_code != baseline_status
        indicator_hit = any(token in body for token in indicators)
        reflected_payload = payload.lower() in body and payload.strip() != ""
        if status_changed or indicator_hit or reflected_payload:
            return {"is_valid": True, "risk_score": 7.5, "message": f"Potential injection behavior detected via {method} probe."}

    if not any_response:
        return {"is_valid": False, "risk_score": 2.0, "message": "Target unreachable or timed out during validation probes."}

    return {"is_valid": False, "risk_score": 2.0, "message": "No clear injection indicators detected in quick validation probes."}


def seed_demo_data() -> None:
    with SessionLocal() as db:
        if db.scalar(select(BugBountyProgram.id).limit(1)):
            return

        programs = [
            BugBountyProgram(
                id="bounty-raven-cloud",
                title="Raven Cloud",
                summary="Public-facing cloud control plane with tiered rewards for validated vulnerabilities.",
                status="approved",
                owner_username="org_admin",
                program_type="Public",
                target_assets=["Web App", "API"],
                in_scope_targets="app.raven-cloud.test\napi.raven-cloud.test",
                out_of_scope="phishing, employee targeting",
                reward_range="USD 250 - 4,500",
                rules_of_engagement="Be respectful, avoid destructive testing, and include clear reproduction evidence.",
                testing_start_date=date(2026, 4, 10),
                testing_end_date=date(2026, 5, 10),
                budget="USD 15,000",
                poc_target_url="https://app.raven-cloud.test",
                default_test_payload="' OR '1'='1",
                reward_value=4500,
                created_at=utc_now(),
                updated_at=utc_now(),
            ),
            BugBountyProgram(
                id="bounty-orbit-ops",
                title="Orbit Ops",
                summary="New infrastructure bounty request waiting on platform approval before launch.",
                status="pending",
                owner_username="org_admin",
                program_type="Private",
                target_assets=["API", "Mobile Backend"],
                in_scope_targets="ops.orbit.test\nedge.orbit.test",
                out_of_scope="DDoS",
                reward_range="USD 300 - 5,000",
                rules_of_engagement="Stay inside listed assets and avoid availability-impacting tests.",
                testing_start_date=date(2026, 4, 20),
                testing_end_date=date(2026, 5, 20),
                budget="USD 18,000",
                poc_target_url="https://ops.orbit.test",
                default_test_payload="<script>alert(1)</script>",
                reward_value=5000,
                created_at=utc_now(),
                updated_at=utc_now(),
            ),
        ]
        db.add_all(programs)
        db.flush()
        db.add(BugBountyParticipant(program_id="bounty-raven-cloud", username="researcher", joined_at=utc_now()))
        seed_submission = BugBountySubmission(
            id="bug-1",
            program_id="bounty-raven-cloud",
            program_title="Raven Cloud",
            username="researcher",
            title="Privilege escalation through stale access token",
            summary="Reused a stale scoped token to reach administrative actions after role downgrade.",
            vulnerable_url="https://app.raven-cloud.test/admin",
            evidence="stale-token-repro.txt",
            finding_categories=["Broken Access Control", "Sensitive Data Exposure"],
            severity="High",
            status="accepted",
            value_awarded=3200,
            assigned_developer="luckyfella2235@gmail.com",
            created_at=utc_now(),
        )
        db.add(seed_submission)
        db.flush()
        ensure_earning_for_submission(db, seed_submission)
        for username in _SEED_USERS:
            create_notification(
                db,
                username,
                "Bug bounty service ready",
                "Bug bounty programs, notifications, and report severity are now persisted in PostgreSQL.",
                "announcement",
            )
        db.commit()


@app.on_event("startup")
def startup_event() -> None:
    run_migrations()
    seed_demo_data()


def run_migrations() -> None:
    """Add columns that were introduced after the initial schema."""
    with SessionLocal() as db:
        try:
            db.execute(text("ALTER TABLE bug_bounty_programs ADD COLUMN contact_email VARCHAR(200) NOT NULL DEFAULT ''"))
            db.commit()
        except Exception:
            db.rollback()
        try:
            db.execute(
                text(
                    """
CREATE TABLE IF NOT EXISTS bug_bounty_researcher_earnings (
  id SERIAL PRIMARY KEY,
  submission_id VARCHAR(80) NOT NULL UNIQUE REFERENCES bug_bounty_submissions(id) ON DELETE CASCADE,
  username VARCHAR(40) NOT NULL,
  amount INTEGER NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'confirmed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)
                    """,
                ),
            )
            db.execute(text("CREATE INDEX IF NOT EXISTS ix_bug_bounty_researcher_earnings_submission_id ON bug_bounty_researcher_earnings (submission_id)"))
            db.execute(text("CREATE INDEX IF NOT EXISTS ix_bug_bounty_researcher_earnings_username ON bug_bounty_researcher_earnings (username)"))
            db.execute(text("CREATE INDEX IF NOT EXISTS ix_bug_bounty_researcher_earnings_status ON bug_bounty_researcher_earnings (status)"))
            db.execute(text("CREATE INDEX IF NOT EXISTS ix_bug_bounty_researcher_earnings_created_at ON bug_bounty_researcher_earnings (created_at)"))
            db.execute(
                text(
                    """
CREATE TABLE IF NOT EXISTS bug_bounty_payout_requests (
  id SERIAL PRIMARY KEY,
  username VARCHAR(40) NOT NULL,
  amount INTEGER NOT NULL,
  payment_method VARCHAR(32) NOT NULL,
  account_details JSON NOT NULL DEFAULT '{}'::json,
  status VARCHAR(24) NOT NULL DEFAULT 'pending',
  admin_note TEXT NULL,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at TIMESTAMPTZ NULL,
  paid_at TIMESTAMPTZ NULL,
  rejected_at TIMESTAMPTZ NULL
)
                    """,
                ),
            )
            db.execute(text("CREATE INDEX IF NOT EXISTS ix_bug_bounty_payout_requests_username ON bug_bounty_payout_requests (username)"))
            db.execute(text("CREATE INDEX IF NOT EXISTS ix_bug_bounty_payout_requests_status ON bug_bounty_payout_requests (status)"))
            db.execute(text("CREATE INDEX IF NOT EXISTS ix_bug_bounty_payout_requests_requested_at ON bug_bounty_payout_requests (requested_at)"))
            db.execute(
                text(
                    """
INSERT INTO bug_bounty_researcher_earnings (submission_id, username, amount, status, created_at, updated_at)
SELECT id, username, value_awarded, 'confirmed', created_at, NOW()
FROM bug_bounty_submissions
WHERE status = 'accepted'
  AND value_awarded > 0
ON CONFLICT (submission_id) DO UPDATE
SET amount = EXCLUDED.amount,
    updated_at = NOW()
                    """,
                ),
            )
            db.commit()
        except Exception:
            db.rollback()
        # Dispute columns migration
        for col, coltype in [("dispute_reason", "TEXT"), ("dispute_resolution", "TEXT"),
                             ("disputed_at", "TIMESTAMPTZ"), ("dispute_resolved_at", "TIMESTAMPTZ")]:
            try:
                db.execute(text(f"ALTER TABLE bug_bounty_submissions ADD COLUMN {col} {coltype} NULL"))
                db.commit()
            except Exception:
                db.rollback()
        # assigned_developer column migration
        try:
            db.execute(text("ALTER TABLE bug_bounty_submissions ADD COLUMN assigned_developer VARCHAR(200) NULL"))
            db.execute(text("CREATE INDEX IF NOT EXISTS ix_bug_bounty_submissions_assigned_developer ON bug_bounty_submissions (assigned_developer)"))
            db.commit()
        except Exception:
            db.rollback()
        try:
            db.execute(text("ALTER TABLE bug_bounty_submissions ADD COLUMN developer_tag VARCHAR(50) NULL"))
            db.commit()
        except Exception:
            db.rollback()


@app.get("/")
def root() -> dict[str, str]:
    return {"service": SERVICE_META["key"], "status": "running"}


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "healthy", "service": SERVICE_META["key"]}


@app.get("/ready")
def ready(db: Session = Depends(get_db)) -> dict[str, str]:
    try:
        db.execute(text("SELECT 1"))
        return {"status": "ok"}
    except Exception:
        raise HTTPException(status_code=503, detail="Database not ready")


@app.post("/api/demo/login")
def login_legacy() -> dict[str, Any]:
    """Removed — authentication is handled by platform session cookies."""
    raise HTTPException(status_code=410, detail="Demo login has been removed. Use the platform login page.")


@app.get("/api/whoami")
def whoami(request: Request, session_user: SessionUser = Depends(resolve_session)) -> dict[str, Any]:
    """Return the resolved role and identity for the current session."""
    return {
        "authenticated": session_user.role != "user",
        "role": session_user.role,
        "email": session_user.email,
        "displayName": session_user.display_name,
        "username": session_user.username,
        "loginUrl": PLATFORM_LOGIN_URL,
        "logoutUrl": PLATFORM_LOGOUT_URL,
        "service": SERVICE_META,
    }


@app.post("/api/auth/bootstrap")
def auth_bootstrap(request: Request, session_user: SessionUser = Depends(resolve_session)) -> dict[str, Any]:
    """Bootstrap endpoint for WorkspaceLaunchLink session handoff.

    Reads the platform session cookie, introspects it via auth-service,
    and returns the session token + user identity so the main frontend
    can pass them as URL query-params to the workspace frontend.
    """
    if session_user.role == "user":
        raise HTTPException(status_code=401, detail="Authentication required")

    session_token = request.cookies.get(SESSION_COOKIE_NAME, "")
    return {
        "access_token": session_token,
        "token": session_token,
        "user": {
            "role": session_user.role,
            "email": session_user.email,
            "displayName": session_user.display_name,
            "username": session_user.username,
        },
    }


@app.get("/api/admin/summary")
def admin_summary(
    request: Request,
    db: Session = Depends(get_db),
    session_user: SessionUser = Depends(resolve_session),
) -> dict[str, Any]:
    """Platform-admin-only summary metrics for the admin dashboard."""
    require_platform_admin(session_user)
    programs = db.scalars(select(BugBountyProgram)).all()
    submissions = db.scalars(select(BugBountySubmission)).all()
    non_deleted = [p for p in programs if p.status != "deleted"]
    return {
        "service": SERVICE_META["key"],
        "serviceName": SERVICE_META["name"],
        "approvedPrograms": len([p for p in non_deleted if p.status in ("approved", "closed")]),
        "pendingPrograms": len([p for p in non_deleted if p.status == "pending"]),
        "totalSubmissions": len(submissions),
        "totalParticipants": db.scalar(select(text("count(*)")).select_from(BugBountyParticipant)) or 0,
    }



class DeveloperTagInput(BaseModel):
    developer_tag: str


@app.patch("/api/submissions/{submission_id}/developer-tag")
def tag_submission_developer(
    submission_id: str,
    payload: DeveloperTagInput,
    session_user: SessionUser = Depends(resolve_session),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Tag a submission as accepted/declined/retest_required. Requires developer or platform_admin role."""
    if session_user.role not in ("developer", "platform_admin"):
        raise HTTPException(status_code=403, detail="Developer access required")
    valid_tags = ("accepted", "declined", "retest_required")
    if payload.developer_tag not in valid_tags:
        raise HTTPException(status_code=400, detail=f"Invalid tag. Must be one of: {valid_tags}")
    submission = db.scalar(select(BugBountySubmission).where(BugBountySubmission.id == submission_id))
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    submission.developer_tag = payload.developer_tag
    tag_label = {"accepted": "accepted", "declined": "declined", "retest_required": "marked for retest"}[payload.developer_tag]
    notify_kind = "success" if payload.developer_tag == "accepted" else "warning" if payload.developer_tag == "declined" else "info"
    create_notification(
        db, submission.username,
        f"Bug Bounty report '{submission.title}' has been {tag_label}",
        f"Your submission '{submission.title}' was {tag_label} by the engineering team.",
        notify_kind,
    )
    db.commit()
    return serialize_submission(submission)


@app.get("/api/compliance/summary")
def compliance_summary(
    start_date: str | None = Query(default=None),
    end_date: str | None = Query(default=None),
    session_user: SessionUser = Depends(resolve_session),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Read-only compliance reporting for compliance_team and platform_admin."""
    if session_user.role not in ("compliance_team", "platform_admin"):
        raise HTTPException(status_code=403, detail="Compliance access required")
    q_programs = select(BugBountyProgram)
    q_submissions = select(BugBountySubmission)
    if start_date:
        q_programs = q_programs.where(BugBountyProgram.created_at >= start_date)
        q_submissions = q_submissions.where(BugBountySubmission.created_at >= start_date)
    if end_date:
        end_dt = end_date + "T23:59:59"
        q_programs = q_programs.where(BugBountyProgram.created_at <= end_dt)
        q_submissions = q_submissions.where(BugBountySubmission.created_at <= end_dt)
    programs = db.scalars(q_programs).all()
    submissions = db.scalars(q_submissions).all()
    non_deleted = [p for p in programs if p.status != "deleted"]
    return {
        "approvedPrograms": len([p for p in non_deleted if p.status in ("approved", "closed")]),
        "pendingPrograms": len([p for p in non_deleted if p.status == "pending"]),
        "totalSubmissions": len(submissions),
    }


@app.get("/api/public")
def public_snapshot(db: Session = Depends(get_db)) -> dict[str, Any]:
    approved = db.scalars(
        select(BugBountyProgram)
        .where(BugBountyProgram.status.in_(["approved", "closed"]))
        .options(selectinload(BugBountyProgram.participants), selectinload(BugBountyProgram.submissions))
        .order_by(BugBountyProgram.created_at.desc()),
    ).all()
    public_approved = [p for p in approved if p.program_type == "Public"]
    return {
        "service": SERVICE_META,
        "summary": {
            "approvedPrograms": len(public_approved),
            "participants": sum(len(p.participants) for p in public_approved),
            "submissions": len(db.scalars(select(BugBountySubmission)).all()),
        },
        "highlights": [
            "In-scope assets, approvals, submissions, and notifications persist in PostgreSQL.",
            "Severity is assigned automatically from finding categories inside the report workflow.",
            "Platform admins can see exactly who joined each approved bounty program.",
        ],
        "programs": [serialize_program(program) for program in public_approved],
    }


@app.get("/api/leaderboard")
def public_leaderboard(db: Session = Depends(get_db)) -> dict[str, Any]:
    return {
        "service": SERVICE_META,
        "items": build_leaderboard(db),
    }


@app.get("/api/dashboard")
def dashboard(
    request: Request,
    db: Session = Depends(get_db),
    session_user: SessionUser = Depends(resolve_session),
) -> dict[str, Any]:
    require_authenticated(session_user)
    return build_dashboard(db, session_user)


@app.get("/api/researcher/earnings")
def researcher_earnings(
    request: Request,
    db: Session = Depends(get_db),
    session_user: SessionUser = Depends(resolve_session),
) -> dict[str, Any]:
    require_role_session(session_user, ["researcher"])
    username = session_user.username
    earnings = db.scalars(
        select(ResearcherEarning)
        .where(ResearcherEarning.username == username)
        .order_by(ResearcherEarning.created_at.desc()),
    ).all()
    submissions = {
        item.id: item
        for item in db.scalars(
            select(BugBountySubmission).where(BugBountySubmission.id.in_([earning.submission_id for earning in earnings] or [""])),
        ).all()
    }
    payouts = db.scalars(
        select(PayoutRequest)
        .where(PayoutRequest.username == username)
        .order_by(PayoutRequest.requested_at.desc()),
    ).all()
    return {
        "summary": earning_summary_for(db, username),
        "earnings": [serialize_earning(item, submissions.get(item.submission_id)) for item in earnings],
        "payoutRequests": [serialize_payout(item) for item in payouts],
    }


@app.post("/api/researcher/payout-requests")
def create_payout_request(
    payload: PayoutRequestInput,
    request: Request,
    db: Session = Depends(get_db),
    session_user: SessionUser = Depends(resolve_session),
) -> dict[str, Any]:
    require_role_session(session_user, ["researcher"])
    username = session_user.username
    payment_method = validate_payout_details(payload.payment_method, payload.account_details)
    summary = earning_summary_for(db, username)
    if payload.amount > summary["availableBalance"]:
        raise HTTPException(status_code=400, detail="Requested amount exceeds your available balance")
    if payload.amount < summary["minimumPayout"]:
        raise HTTPException(status_code=400, detail=f"Minimum payout is {summary['minimumPayout']} ETB")
    payout = PayoutRequest(
        username=username,
        amount=payload.amount,
        payment_method=payment_method,
        account_details=payload.account_details,
        status="pending",
        requested_at=utc_now(),
        updated_at=utc_now(),
    )
    db.add(payout)
    create_notification(db, "platform_admin", "New payout request", f"{session_user.display_name} requested {payload.amount} ETB.", "action")
    create_notification(db, username, "Payout request submitted", f"Your {payload.amount} ETB payout request is pending review.", "success")
    db.commit()
    db.refresh(payout)
    return {"message": "Payout request submitted.", "payoutRequest": serialize_payout(payout), "summary": earning_summary_for(db, username)}


@app.get("/api/admin/payout-requests")
def admin_payout_requests(
    request: Request,
    db: Session = Depends(get_db),
    session_user: SessionUser = Depends(resolve_session),
) -> dict[str, Any]:
    require_platform_admin(session_user)
    payouts = db.scalars(select(PayoutRequest).order_by(PayoutRequest.requested_at.desc())).all()
    return {"items": [serialize_payout(item) for item in payouts]}


@app.post("/api/admin/payout-requests/{payout_id}/approve")
def approve_payout_request(
    payout_id: int,
    payload: PayoutDecisionInput,
    request: Request,
    db: Session = Depends(get_db),
    session_user: SessionUser = Depends(resolve_session),
) -> dict[str, Any]:
    require_platform_admin(session_user)
    payout = payout_for_update(db, payout_id)
    if payout.status != "pending":
        raise HTTPException(status_code=400, detail="Only pending payout requests can be approved")
    payout.status = "approved"
    payout.admin_note = payload.note.strip() or payout.admin_note
    payout.approved_at = utc_now()
    payout.updated_at = utc_now()
    create_notification(db, payout.username, "Payout request approved", f"Your {payout.amount} ETB payout request was approved.", "success")
    db.commit()
    db.refresh(payout)
    return {"message": "Payout request approved.", "payoutRequest": serialize_payout(payout)}


@app.post("/api/admin/payout-requests/{payout_id}/reject")
def reject_payout_request(
    payout_id: int,
    payload: PayoutDecisionInput,
    request: Request,
    db: Session = Depends(get_db),
    session_user: SessionUser = Depends(resolve_session),
) -> dict[str, Any]:
    require_platform_admin(session_user)
    payout = payout_for_update(db, payout_id)
    if payout.status not in {"pending", "approved"}:
        raise HTTPException(status_code=400, detail="Only pending or approved payout requests can be rejected")
    payout.status = "rejected"
    payout.admin_note = payload.note.strip() or payout.admin_note
    payout.rejected_at = utc_now()
    payout.updated_at = utc_now()
    create_notification(db, payout.username, "Payout request rejected", f"Your {payout.amount} ETB payout request was rejected.", "warning")
    db.commit()
    db.refresh(payout)
    return {"message": "Payout request rejected.", "payoutRequest": serialize_payout(payout)}


@app.post("/api/admin/payout-requests/{payout_id}/mark-paid")
def mark_payout_paid(
    payout_id: int,
    payload: PayoutDecisionInput,
    request: Request,
    db: Session = Depends(get_db),
    session_user: SessionUser = Depends(resolve_session),
) -> dict[str, Any]:
    require_platform_admin(session_user)
    payout = payout_for_update(db, payout_id)
    if payout.status not in {"pending", "approved"}:
        raise HTTPException(status_code=400, detail="Only pending or approved payout requests can be marked paid")
    payout.status = "paid"
    payout.admin_note = payload.note.strip() or payout.admin_note
    payout.paid_at = utc_now()
    payout.updated_at = utc_now()
    mark_confirmed_earnings_paid(db, payout.username, payout.amount)
    create_notification(db, payout.username, "Payout sent", f"Your {payout.amount} ETB payout has been marked as paid.", "success")
    db.commit()
    db.refresh(payout)
    return {"message": "Payout request marked as paid.", "payoutRequest": serialize_payout(payout)}


@app.get("/api/dashboard/{username}")
def dashboard_legacy(username: str, request: Request, db: Session = Depends(get_db), session_user: SessionUser = Depends(resolve_session)) -> dict[str, Any]:
    """Backward-compatible dashboard endpoint — ignores path username, uses session."""
    require_authenticated(session_user)
    return build_dashboard(db, session_user)


@app.get("/api/notifications")
def notifications_session(
    request: Request,
    db: Session = Depends(get_db),
    session_user: SessionUser = Depends(resolve_session),
) -> dict[str, Any]:
    require_authenticated(session_user)
    rows = db.scalars(
        select(BugBountyNotification).where(BugBountyNotification.username == session_user.username).order_by(BugBountyNotification.created_at.desc()),
    ).all()
    return {"items": [serialize_notification(item) for item in rows], "unreadCount": sum(0 if item.is_read else 1 for item in rows)}


@app.get("/api/notifications/{username}")
def notifications(username: str, request: Request, db: Session = Depends(get_db), session_user: SessionUser = Depends(resolve_session)) -> dict[str, Any]:
    require_authenticated(session_user)
    rows = db.scalars(
        select(BugBountyNotification).where(BugBountyNotification.username == session_user.username).order_by(BugBountyNotification.created_at.desc()),
    ).all()
    return {"items": [serialize_notification(item) for item in rows], "unreadCount": sum(0 if item.is_read else 1 for item in rows)}


@app.post("/api/notifications/{notification_id}/read")
def mark_notification_read(notification_id: int, request: Request, db: Session = Depends(get_db), session_user: SessionUser = Depends(resolve_session)) -> dict[str, str]:
    require_authenticated(session_user)
    item = db.scalar(
        select(BugBountyNotification).where(
            BugBountyNotification.id == notification_id,
            BugBountyNotification.username == session_user.username,
        ),
    )
    if not item:
        raise HTTPException(status_code=404, detail="Notification not found")
    item.is_read = True
    db.commit()
    return {"message": "Notification marked as read."}


@app.post("/api/programs")
def create_program(payload: ProgramCreateInput, request: Request, db: Session = Depends(get_db), session_user: SessionUser = Depends(resolve_session)) -> dict[str, Any]:
    require_role_session(session_user, ["org_admin"])
    username = session_user.username
    normalized_poc_target_url = normalize_http_url(payload.poc_target_url)
    if not is_valid_http_url(normalized_poc_target_url):
        raise HTTPException(status_code=400, detail="PoC target URL must be a valid http/https URL")
    if not payload.in_scope_targets.strip():
        raise HTTPException(status_code=400, detail="Target URLs / In-Scope Assets is required")
    start_date, end_date = validate_program_window(payload.testing_start_date, payload.testing_end_date)
    program = BugBountyProgram(
        id=generate_program_id(payload.program_name),
        title=payload.program_name,
        summary=payload.description,
        status="pending",
        owner_username=username,
        program_type=payload.program_type,
        target_assets=payload.target_assets,
        in_scope_targets=payload.in_scope_targets,
        out_of_scope=payload.out_of_scope,
        reward_range=payload.reward_range,
        rules_of_engagement=payload.rules_of_engagement,
        testing_start_date=start_date,
        testing_end_date=end_date,
        budget=payload.budget,
        poc_target_url=normalized_poc_target_url,
        default_test_payload=getattr(payload, 'default_test_payload', '') or '',
        contact_email=payload.contact_email,
        reward_value=2500,
        created_at=utc_now(),
        updated_at=utc_now(),
    )
    db.add(program)
    create_notification(db, "platform_admin", "New bug bounty request", f"{payload.program_name} was submitted for approval.", "action")
    create_notification(db, username, "Bug bounty request submitted", f"{payload.program_name} is waiting for platform review.", "info")
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="A bug bounty program with similar details already exists")
    db.refresh(program)
    return {"message": "Bug bounty request submitted for platform approval.", "program": serialize_program(program, session_user.role)}


@app.post("/api/programs/{program_id}/decision")
def decide_program(program_id: str, payload: DecisionInput, request: Request, db: Session = Depends(get_db), session_user: SessionUser = Depends(resolve_session)) -> dict[str, Any]:
    require_role_session(session_user, ["platform_admin"])
    action = payload.action.lower()
    if action not in {"approve", "decline"}:
        raise HTTPException(status_code=400, detail="Action must be approve or decline")
    program = program_for_update(db, program_id)
    program.status = "approved" if action == "approve" else "declined"
    program.updated_at = utc_now()
    create_notification(db, program.owner_username, "Bounty request updated", f"{program.title} was {program.status}.", "action")
    if action == "approve":
        create_notification(db, "researcher", "New challenge available", f"{program.title} is now available in Bug Bounty.", "success")
    db.commit()
    return {"message": f"Bounty request {program.title} marked as {program.status}.", "program": serialize_program(program, session_user.role), "comment": payload.comment}


@app.post("/api/programs/{program_id}/join")
def join_program(program_id: str, request: Request, db: Session = Depends(get_db), session_user: SessionUser = Depends(resolve_session)) -> dict[str, Any]:
    require_role_session(session_user, ["researcher"])
    username = session_user.username
    program = program_for_update(db, program_id)
    if program.status == "closed":
        raise HTTPException(status_code=400, detail="This program is closed and no longer accepting new researchers")
    if program.status == "deleted":
        raise HTTPException(status_code=404, detail="Program not found")
    if program.status != "approved":
        raise HTTPException(status_code=400, detail="Only approved programs can be joined")
    if program.testing_end_date and program.testing_end_date < date.today():
        raise HTTPException(status_code=400, detail="This program has expired and is no longer accepting new researchers")
    already_joined = any(item.username == username for item in program.participants)
    ensure_participant(db, program, username)
    if not already_joined:
        create_notification(db, "platform_admin", "Researcher joined bounty program", f"{session_user.display_name} joined {program.title}.", "info")
        create_notification(db, program.owner_username, "Researcher joined your program", f"{session_user.display_name} joined {program.title}.", "info")
        create_notification(db, username, "Program joined", f"You joined {program.title}.", "success")
        create_notification(db, username, "New task assigned", f"Start testing {program.title} and submit reports directly from your joined program card.", "info")
        db.commit()
        program = program_for_update(db, program_id)
    return {"message": f"You joined {program.title}.", "program": serialize_program(program, session_user.role)}


@app.post("/api/programs/{program_id}/submissions")
def submit_report(program_id: str, payload: SubmissionInput, request: Request, db: Session = Depends(get_db), session_user: SessionUser = Depends(resolve_session)) -> dict[str, Any]:
    require_role_session(session_user, ["researcher"])
    username = session_user.username
    program = program_for_update(db, program_id)
    if program.status != "approved":
        raise HTTPException(status_code=400, detail="This program is not open for reports")
    require_joined_participant(program, username)
    if not is_valid_http_url(payload.vulnerable_url):
        raise HTTPException(status_code=400, detail="Vulnerable URL / Location must be a valid http/https URL")
    categories = normalize_categories(payload.finding_categories)
    severity = severity_from_categories(categories)
    submission = BugBountySubmission(
        id=generate_submission_id(),
        program_id=program.id,
        program_title=program.title,
        username=username,
        title=payload.title,
        summary=payload.summary,
        vulnerable_url=payload.vulnerable_url,
        evidence=payload.evidence,
        finding_categories=categories,
        severity=severity,
        status="submitted",
        value_awarded=award_from_severity(severity, program.reward_value),
        created_at=utc_now(),
    )
    db.add(submission)
    create_notification(db, "platform_admin", "New vulnerability report", f"{session_user.display_name} submitted a {severity} report for {program.title}.", "action")
    create_notification(db, program.owner_username, "New submission received", f"{session_user.display_name} submitted a {severity} report for {program.title}.", "action")
    create_notification(db, username, "Auto-criticality assigned", f"{program.title} report tagged as {severity}.", "success")
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="This report could not be saved. Please retry.")
    return {"message": f"Vulnerability report submitted with auto-assigned severity: {severity}.", "submission": serialize_submission(submission)}


@app.delete("/api/programs/{program_id}")
def delete_program(program_id: str, payload: DecisionInput, request: Request, db: Session = Depends(get_db), session_user: SessionUser = Depends(resolve_session)) -> dict[str, Any]:
    require_role_session(session_user, ["platform_admin"])
    program = program_for_update(db, program_id)
    if program.status == "deleted":
        raise HTTPException(status_code=400, detail="Program is already deleted")
    program.status = "deleted"
    program.updated_at = utc_now()
    create_notification(db, program.owner_username, "Program deleted", f"{program.title} was deleted by platform admin.", "action")
    db.commit()
    return {"message": f"Program {program.title} has been deleted."}


@app.post("/api/programs/{program_id}/close")
def close_program(program_id: str, payload: DecisionInput, request: Request, db: Session = Depends(get_db), session_user: SessionUser = Depends(resolve_session)) -> dict[str, Any]:
    require_role_session(session_user, ["platform_admin"])
    program = program_for_update(db, program_id)
    if program.status != "approved":
        raise HTTPException(status_code=400, detail="Only approved programs can be closed")
    program.status = "closed"
    program.updated_at = utc_now()
    create_notification(db, program.owner_username, "Program closed", f"{program.title} has been closed to new researchers.", "action")
    db.commit()
    return {"message": f"Program {program.title} has been closed."}


@app.post("/api/validate-poc")
def validate_poc(payload: PoCValidationInput) -> dict[str, Any]:
    return run_poc_validator(url=payload.url, payload=payload.payload)


# ── Dispute endpoints ────────────────────────────────────────────────

@app.post("/api/submissions/{submission_id}/dispute")
def dispute_submission(
    submission_id: str,
    payload: DisputeInput,
    db: Session = Depends(get_db),
    session_user: SessionUser = Depends(resolve_session),
) -> dict[str, Any]:
    """Researcher disputes a rejected submission decision."""
    require_authenticated(session_user)
    submission = db.scalar(select(BugBountySubmission).where(BugBountySubmission.id == submission_id))
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    if submission.username != session_user.username:
        raise HTTPException(status_code=403, detail="Only the submitter can dispute this decision")
    if submission.status not in ("rejected", "duplicate"):
        raise HTTPException(status_code=400, detail="Only rejected or duplicate submissions can be disputed")
    if submission.disputed_at:
        raise HTTPException(status_code=400, detail="This submission has already been disputed")
    submission.dispute_reason = payload.reason
    submission.disputed_at = utc_now()
    create_notification(db, submission.username, "Dispute filed", f"Your dispute for '{submission.title}' has been submitted.", "info")
    db.commit()
    return {"message": "Dispute submitted for admin review.", "submission": serialize_submission(submission)}


@app.get("/api/disputes")
def list_disputes(
    db: Session = Depends(get_db),
    session_user: SessionUser = Depends(resolve_session),
) -> dict[str, Any]:
    """Platform admin lists all disputed submissions."""
    require_role_session(session_user, ["platform_admin"])
    disputed = db.scalars(
        select(BugBountySubmission)
        .where(BugBountySubmission.disputed_at.isnot(None))
        .order_by(BugBountySubmission.disputed_at.desc())
    ).all()
    return {
        "disputes": [
            {
                **serialize_submission(item),
                "disputeReason": item.dispute_reason,
                "disputeResolution": item.dispute_resolution,
                "disputedAt": item.disputed_at.isoformat() if item.disputed_at else None,
                "disputeResolvedAt": item.dispute_resolved_at.isoformat() if item.dispute_resolved_at else None,
            }
            for item in disputed
        ]
    }


@app.post("/api/disputes/{submission_id}/resolve")
def resolve_dispute(
    submission_id: str,
    payload: DisputeResolveInput,
    db: Session = Depends(get_db),
    session_user: SessionUser = Depends(resolve_session),
) -> dict[str, Any]:
    """Platform admin resolves a dispute."""
    require_role_session(session_user, ["platform_admin"])
    submission = db.scalar(select(BugBountySubmission).where(BugBountySubmission.id == submission_id))
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    if not submission.disputed_at:
        raise HTTPException(status_code=400, detail="This submission has no active dispute")
    submission.dispute_resolution = payload.resolution
    submission.dispute_resolved_at = utc_now()
    create_notification(db, submission.username, "Dispute resolved", f"Your dispute for '{submission.title}' has been reviewed.", "info")
    db.commit()
    return {"message": "Dispute resolved.", "submission": serialize_submission(submission)}


# ── Developer workflow endpoints ─────────────────────────────────────

class CommentInput(BaseModel):
    author: str = ""
    text: str = ""
    comment: str = ""


class StatusUpdateInput(BaseModel):
    status: str
    fix_description: str = ""
    developer_email: str = ""


@app.post("/api/submissions/{submission_id}/comments")
def add_submission_comment(
    submission_id: str,
    payload: CommentInput,
    db: Session = Depends(get_db),
    session_user: SessionUser = Depends(resolve_session),
) -> dict[str, Any]:
    """Add a clarification comment to a submission."""
    require_authenticated(session_user)
    submission = db.scalar(select(BugBountySubmission).where(BugBountySubmission.id == submission_id))
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    comment_text = payload.text or payload.comment
    if not comment_text.strip():
        raise HTTPException(status_code=400, detail="Comment text is required")
    author = payload.author or session_user.email or session_user.username
    create_notification(
        db, submission.username,
        "Developer comment",
        f"{author} commented on '{submission.title}': {comment_text[:200]}",
        "info",
    )
    db.commit()
    return {"message": "Comment posted.", "submissionId": submission_id}


@app.put("/api/submissions/{submission_id}/status")
def update_submission_status(
    submission_id: str,
    payload: StatusUpdateInput,
    db: Session = Depends(get_db),
    session_user: SessionUser = Depends(resolve_session),
) -> dict[str, Any]:
    """Update a submission status (e.g. mark as fixed / retest-requested)."""
    require_authenticated(session_user)
    submission = db.scalar(select(BugBountySubmission).where(BugBountySubmission.id == submission_id))
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    submission.status = payload.status
    create_notification(
        db, submission.username,
        "Fix applied — retest requested",
        f"Developer {payload.developer_email or session_user.email} marked '{submission.title}' as fixed: {payload.fix_description[:300]}",
        "action",
    )
    db.commit()
    return {"message": "Status updated.", "submission": serialize_submission(submission)}
