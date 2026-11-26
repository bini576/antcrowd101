from datetime import date, datetime, timezone
import os
import re
from typing import Any
from uuid import uuid4

from fastapi import Depends, FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy import select, text
from sqlalchemy.exc import IntegrityError
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
    ChallengeNotification,
    ChallengeParticipant,
    ChallengeProgram,
    ChallengeSubmission,
    CtfFlagSubmission,
    CtfLevel,
)
from .views import JUICE_SHOP_CHALLENGES, JUICE_SHOP_PROGRAM_ID


app = FastAPI(
    title="AntCrowd Challenge Service",
    description="Persistent challenge and CTF workflows for the AntCrowd demo platform.",
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
    "key": "challenge",
    "name": "Challenge Service",
    "headline": "Run AntCrowd challenge programs and the persistent AntCrowd Web Security Lab from one workspace.",
    "tagline": "Operational CTF programs with live progress tracking and notifications.",
    "programLabel": "challenge",
    "submissionLabel": "challenge report",
    "joinLabel": "Join challenge",
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


# LoginInput removed — authentication is handled by platform session cookies


class ProgramCreateInput(BaseModel):
    program_name: str = Field(min_length=3, max_length=120)
    description: str = Field(min_length=10, max_length=400)
    contact_email: str = Field(default="", max_length=200)
    difficulty_level: str = Field(min_length=2, max_length=40)
    challenge_categories: list[str] = Field(min_length=1)
    prize_pool_etb: str = Field(min_length=2, max_length=80)
    start_date: str
    end_date: str
    flag_format: str = Field(default="", max_length=80)
    correct_flag: str | None = Field(default=None, max_length=180)


class DecisionInput(BaseModel):
    action: str
    comment: str = ""


class JoinInput(BaseModel):
    pass  # username resolved from session


class SubmissionInput(BaseModel):
    title: str = Field(min_length=3, max_length=120)
    summary: str = Field(min_length=10, max_length=400)
    evidence: str = Field(min_length=3, max_length=240)
    impact: str = Field(default="Medium", min_length=2, max_length=40)
    flag: str = Field(default="", max_length=180)


class JuiceShopSubmissionInput(BaseModel):
    username: str
    challenge_id: str = Field(min_length=3, max_length=80)
    submitted_flag: str = Field(min_length=3, max_length=180)


class NotificationReadInput(BaseModel):
    pass  # username resolved from session


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
    return username


def slugify(value: str) -> str:
    collapsed = re.sub(r"[^a-z0-9]+", "-", value.strip().lower())
    collapsed = collapsed.strip("-")
    return collapsed or "program"


def generate_program_id(program_name: str) -> str:
    return f"challenge-{slugify(program_name)}-{uuid4().hex[:8]}"


def generate_submission_id(prefix: str) -> str:
    return f"{prefix}-{uuid4().hex[:12]}"


def create_notification(db: Session, username: str, title: str, message: str, kind: str = "info") -> None:
    db.add(
        ChallengeNotification(
            username=username,
            title=title,
            message=message,
            kind=kind,
            is_read=False,
            created_at=utc_now(),
        ),
    )


def ensure_participant(db: Session, program: ChallengeProgram, username: str) -> None:
    existing = db.scalar(
        select(ChallengeParticipant).where(
            ChallengeParticipant.program_id == program.id,
            ChallengeParticipant.username == username,
        ),
    )
    if existing:
        return
    db.add(
        ChallengeParticipant(
            program_id=program.id,
            username=username,
            joined_at=utc_now(),
        ),
    )


def require_joined_participant(program: ChallengeProgram, username: str, detail: str) -> None:
    if not any(item.username == username for item in program.participants):
        raise HTTPException(status_code=400, detail=detail)


def serialize_notification(item: ChallengeNotification) -> dict[str, Any]:
    return {
        "id": item.id,
        "title": item.title,
        "message": item.message,
        "kind": item.kind,
        "isRead": item.is_read,
        "createdAt": item.created_at.isoformat(),
    }


def serialize_submission(item: ChallengeSubmission) -> dict[str, Any]:
    return {
        "id": item.id,
        "programId": item.program_id,
        "programTitle": item.program_title,
        "username": item.username,
        "usernameLabel": display_name(item.username),
        "title": item.title,
        "summary": item.summary,
        "impact": item.impact,
        "evidence": item.evidence,
        "status": item.status,
        "valueAwarded": item.value_awarded,
        "createdAt": item.created_at.isoformat(),
        "assigned_developer": item.assigned_developer,
        "assignedDeveloper": item.assigned_developer,
        "developer_tag": item.developer_tag,
        "developerTag": item.developer_tag,
    }


def ctf_progress_for_user(program: ChallengeProgram, username: str) -> dict[str, Any]:
    level_map = {level.id: level for level in sorted(program.ctf_levels, key=lambda row: row.display_order)}
    correct_rows = [
        row for row in program.ctf_flag_submissions if row.username == username and row.is_correct and row.challenge_id in level_map
    ]
    solved_ids = {row.challenge_id for row in correct_rows}
    total_points = sum(level.points for level in level_map.values())
    earned_points = sum(level_map[row.challenge_id].points for row in correct_rows)
    levels = []
    for level in level_map.values():
        levels.append(
            {
                "id": level.id,
                "title": level.title,
                "category": level.category,
                "difficulty": level.difficulty,
                "description": level.description,
                "startingPoint": level.starting_point,
                "points": level.points,
                "solved": level.id in solved_ids,
            },
        )
    return {
        "solvedCount": len(solved_ids),
        "totalLevels": len(levels),
        "pointsEarned": earned_points,
        "totalPoints": total_points,
        "levels": levels,
    }


def effective_status(program: ChallengeProgram) -> str:
    if program.status == "deleted":
        return "deleted"
    if program.status == "closed":
        return "closed"
    if program.status == "approved" and program.end_date and program.end_date < date.today():
        return "expired"
    return program.status


def serialize_program(program: ChallengeProgram, viewer_role: str | None = None, viewer_username: str | None = None) -> dict[str, Any]:
    ordered_submissions = sorted(program.submissions, key=lambda row: row.created_at, reverse=True)
    participant_names = [display_name(participant.username) for participant in sorted(program.participants, key=lambda row: row.joined_at)]
    payload = {
        "id": program.id,
        "title": program.title,
        "summary": program.summary,
        "status": effective_status(program),
        "owner": program.owner_username,
        "scope": program.scope,
        "reward": program.reward,
        "rewardValue": program.reward_value,
        "rules": program.rules,
        "track": program.track,
        "priority": program.priority,
        "participants": participant_names,
        "participantCount": len(participant_names),
        "submissionCount": len(program.submissions),
        "createdAt": program.created_at.isoformat(),
        "isCtf": program.id == JUICE_SHOP_PROGRAM_ID,
        "recentSubmissions": [serialize_submission(item) for item in ordered_submissions[:3]],
    }
    if program.id == JUICE_SHOP_PROGRAM_ID:
        payload["ctfProgress"] = ctf_progress_for_user(program, viewer_username or "")
    if viewer_role and viewer_role in ("platform_admin", "org_admin"):
        payload["contactEmail"] = program.contact_email
    return payload


def program_for_update(db: Session, program_id: str) -> ChallengeProgram:
    program = db.scalar(
        select(ChallengeProgram)
        .where(ChallengeProgram.id == program_id)
        .options(
            selectinload(ChallengeProgram.participants),
            selectinload(ChallengeProgram.submissions),
            selectinload(ChallengeProgram.ctf_levels),
            selectinload(ChallengeProgram.ctf_flag_submissions),
        ),
    )
    if not program:
        raise HTTPException(status_code=404, detail="Program not found")
    return program


def find_level(program: ChallengeProgram, challenge_id: str) -> CtfLevel:
    for level in program.ctf_levels:
        if level.id == challenge_id:
            return level
    raise HTTPException(status_code=404, detail="Challenge level not found")


def validate_program_window(start_value: str, end_value: str) -> tuple[date | None, date | None]:
    start_date = parse_date(start_value)
    end_date = parse_date(end_value)
    if start_value and start_date is None:
        raise HTTPException(status_code=400, detail="Start date must use YYYY-MM-DD format")
    if end_value and end_date is None:
        raise HTTPException(status_code=400, detail="End date must use YYYY-MM-DD format")
    if start_date and end_date and end_date < start_date:
        raise HTTPException(status_code=400, detail="End date must be on or after the start date")
    return start_date, end_date


def normalize_categories(items: list[str]) -> list[str]:
    cleaned: list[str] = []
    seen: set[str] = set()
    for item in items:
        value = item.strip()
        if value and value not in seen:
            cleaned.append(value)
            seen.add(value)
    if not cleaned:
        raise HTTPException(status_code=400, detail="Select at least one challenge category")
    return cleaned


def build_leaderboard(db: Session) -> list[dict[str, Any]]:
    scores: dict[str, int] = {}
    challenge_rows = db.scalars(select(ChallengeSubmission)).all()
    for item in challenge_rows:
        scores[item.username] = scores.get(item.username, 0) + item.value_awarded
    ctf_rows = db.scalars(select(CtfFlagSubmission).where(CtfFlagSubmission.is_correct.is_(True))).all()
    for row in ctf_rows:
        scores[row.username] = scores.get(row.username, 0) + row.points_awarded
    ranking = sorted(scores.items(), key=lambda pair: pair[1], reverse=True)
    return [{"name": display_name(name), "score": score, "label": "points"} for name, score in ranking]


def build_dashboard(db: Session, session_user: SessionUser) -> dict[str, Any]:
    username = session_user.username
    role = session_user.role
    programs = db.scalars(
        select(ChallengeProgram)
        .options(
            selectinload(ChallengeProgram.participants),
            selectinload(ChallengeProgram.submissions),
            selectinload(ChallengeProgram.ctf_levels),
            selectinload(ChallengeProgram.ctf_flag_submissions),
        )
        .order_by(ChallengeProgram.created_at.desc()),
    ).all()
    non_deleted = [program for program in programs if program.status != "deleted"]
    approved = [program for program in non_deleted if program.status in ("approved", "closed")]
    pending = [program for program in non_deleted if program.status == "pending"]
    joined = [program for program in approved if any(item.username == username for item in program.participants)]
    available = [program for program in approved if program.status != "closed" and all(item.username != username for item in program.participants)]
    owned = [program for program in programs if program.owner_username == username]

    all_submissions = db.scalars(select(ChallengeSubmission).order_by(ChallengeSubmission.created_at.desc())).all()
    if role == "platform_admin":
        visible_programs = non_deleted
        visible_submissions = all_submissions
    elif role == "org_admin":
        visible_programs = owned
        visible_submissions = [item for item in all_submissions if program_for_update(db, item.program_id).owner_username == username]
    elif role == "researcher":
        visible_programs = approved
        visible_submissions = [item for item in all_submissions if item.username == username]
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
        select(ChallengeNotification)
        .where(ChallengeNotification.username == notify_key)
        .order_by(ChallengeNotification.created_at.desc()),
    ).all()

    ctf_correct = db.scalars(
        select(CtfFlagSubmission).where(CtfFlagSubmission.username == username, CtfFlagSubmission.is_correct.is_(True)),
    ).all()
    ctf_points = sum(row.points_awarded for row in ctf_correct)
    report_points = sum(item.value_awarded for item in visible_submissions if item.username == username)
    user_value = ctf_points + report_points

    summary = {
        "approvedPrograms": len(approved),
        "pendingPrograms": len(pending),
        "participants": sum(len(program.participants) for program in approved),
        "submissions": len(all_submissions) + len(db.scalars(select(CtfFlagSubmission).where(CtfFlagSubmission.is_correct.is_(True))).all()),
        "userJoined": len(joined),
        "userSubmissions": len(visible_submissions) + len(ctf_correct),
        "userValue": user_value,
        "unreadNotifications": sum(0 if item.is_read else 1 for item in notifications),
    }

    return {
        "service": SERVICE_META,
        "role": {"username": username, "name": role, "label": session_user.display_name, "displayName": session_user.display_name},
        "summary": summary,
        "metrics": [
            {"label": "Approved Challenges", "value": summary["approvedPrograms"]},
            {"label": "Pending Requests", "value": summary["pendingPrograms"]},
            {"label": "Researchers Active", "value": summary["participants"]},
            {"label": "Reports And Flags", "value": summary["submissions"]},
        ],
        "programs": [serialize_program(program, role, username) for program in visible_programs],
        "pendingPrograms": [serialize_program(program, role, username) for program in pending],
        "joinedPrograms": [serialize_program(program, role, username) for program in joined],
        "availablePrograms": [serialize_program(program, role, username) for program in available],
        "submissions": [serialize_submission(item) for item in visible_submissions],
        "leaderboard": build_leaderboard(db),
        "notifications": [serialize_notification(item) for item in notifications],
    }


def seed_demo_data() -> None:
    with SessionLocal() as db:
        if db.scalar(select(ChallengeProgram.id).limit(1)):
            return

        programs = [
            ChallengeProgram(
                id=JUICE_SHOP_PROGRAM_ID,
                title="AntCrowd Web Security Lab",
                summary="An AntCrowd Web Security Lab with seven tracked levels, persistent progress, and service-side scoring.",
                status="approved",
                owner_username="org_admin",
                scope="Category: Web | Runtime: Web Security Lab | Levels: 7 | Submission mode: AntCrowd flag validation",
                reward="1,900 points available",
                reward_value=1900,
                rules="Join the lab, solve levels inside the AntCrowd Web Security Lab, and submit each flag back through AntCrowd.",
                track="Web Security Lab",
                priority="Medium",
                challenge_categories=["Web", "Authentication", "Access Control"],
                prize_pool_etb="0",
                flag_format="ctf{antcrowd_*}",
                auto_approved=True,
                created_at=utc_now(),
                updated_at=utc_now(),
            ),
            ChallengeProgram(
                id="challenge-phoenix-forge",
                title="Phoenix Forge",
                summary="A persistent web exploitation challenge focused on auth bypass, chained flags, and vault access.",
                status="approved",
                owner_username="org_admin",
                scope="Category: Web, Crypto | Dates: 2026-04-18 to 2026-04-25 | Flag: flag{phoenix_*}",
                reward="ETB 45,000 prize pool",
                reward_value=1200,
                rules="No destructive scans and every flag or report needs a short write-up.",
                track="Hard",
                priority="Web, Crypto",
                challenge_categories=["Web", "Crypto"],
                prize_pool_etb="45000",
                start_date=date(2026, 4, 18),
                end_date=date(2026, 4, 25),
                flag_format="flag{phoenix_*}",
                correct_flag="flag{phoenix_stage3}",
                created_at=utc_now(),
                updated_at=utc_now(),
            ),
            ChallengeProgram(
                id="challenge-kestrel-mobile",
                title="Kestrel Mobile",
                summary="A mobile-focused challenge pack waiting for platform approval.",
                status="pending",
                owner_username="org_admin",
                scope="Category: Mobile, Reverse | Dates: 2026-04-20 to 2026-04-28 | Flag: flag{kestrel_*}",
                reward="ETB 60,000 prize pool",
                reward_value=1400,
                rules="Static analysis and sanctioned runtime instrumentation only.",
                track="Hard",
                priority="Mobile, Reverse",
                challenge_categories=["Mobile", "Reverse"],
                prize_pool_etb="60000",
                start_date=date(2026, 4, 20),
                end_date=date(2026, 4, 28),
                flag_format="flag{kestrel_*}",
                correct_flag="flag{kestrel_core}",
                created_at=utc_now(),
                updated_at=utc_now(),
            ),
        ]
        db.add_all(programs)
        db.flush()

        db.add(
            ChallengeParticipant(
                program_id="challenge-phoenix-forge",
                username="researcher",
                joined_at=utc_now(),
            ),
        )
        db.add(
            ChallengeSubmission(
                id="flag-1",
                program_id="challenge-phoenix-forge",
                program_title="Phoenix Forge",
                username="researcher",
                title="Auth bypass into segmented vault",
                summary="Chained a token confusion issue into a restricted panel and extracted the stage-three flag.",
                evidence="bob-auth-bypass.md",
                impact="Critical",
                status="validated",
                value_awarded=600,
                assigned_developer="luckyfella2235@gmail.com",
                created_at=utc_now(),
            ),
        )

        for index, challenge in enumerate(JUICE_SHOP_CHALLENGES, start=1):
            db.add(
                CtfLevel(
                    id=challenge["id"],
                    program_id=JUICE_SHOP_PROGRAM_ID,
                    title=challenge["title"],
                    category=challenge["category"],
                    difficulty=challenge["difficulty"],
                    description=challenge["description"],
                    starting_point=challenge["starting_point"],
                    flag=challenge["flag"],
                    points=challenge["points"],
                    display_order=index,
                ),
            )

        for username in _SEED_USERS:
            create_notification(
                db,
                username,
                "AntCrowd Web Security Lab is live",
                "The AntCrowd Web Security Lab is approved by default and ready for researchers to join.",
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
            db.execute(text("ALTER TABLE challenge_programs ADD COLUMN contact_email VARCHAR(200) NOT NULL DEFAULT ''"))
            db.commit()
        except Exception:
            db.rollback()
        # assigned_developer column migration
        try:
            db.execute(text("ALTER TABLE challenge_submissions ADD COLUMN assigned_developer VARCHAR(200) NULL"))
            db.execute(text("CREATE INDEX IF NOT EXISTS ix_challenge_submissions_assigned_developer ON challenge_submissions (assigned_developer)"))
            db.commit()
        except Exception:
            db.rollback()
        try:
            db.execute(text("ALTER TABLE challenge_submissions ADD COLUMN developer_tag VARCHAR(50) NULL"))
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
    """Bootstrap endpoint for WorkspaceLaunchLink session handoff."""
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
    programs = db.scalars(select(ChallengeProgram)).all()
    submissions = db.scalars(select(ChallengeSubmission)).all()
    non_deleted = [p for p in programs if p.status != "deleted"]
    return {
        "service": SERVICE_META["key"],
        "serviceName": SERVICE_META["name"],
        "approvedPrograms": len([p for p in non_deleted if p.status in ("approved", "closed")]),
        "pendingPrograms": len([p for p in non_deleted if p.status == "pending"]),
        "totalSubmissions": len(submissions),
        "totalParticipants": db.scalar(select(text("count(*)")).select_from(ChallengeParticipant)) or 0,
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
    """Tag a submission as accepted/declined/retest_required. Requires developer or platform_admin."""
    if session_user.role not in ("developer", "platform_admin"):
        raise HTTPException(status_code=403, detail="Developer access required")
    valid_tags = ("accepted", "declined", "retest_required")
    if payload.developer_tag not in valid_tags:
        raise HTTPException(status_code=400, detail=f"Invalid tag. Must be one of: {valid_tags}")
    submission = db.scalar(select(ChallengeSubmission).where(ChallengeSubmission.id == submission_id))
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    submission.developer_tag = payload.developer_tag
    tag_label = {"accepted": "accepted", "declined": "declined", "retest_required": "marked for retest"}[payload.developer_tag]
    notify_kind = "success" if payload.developer_tag == "accepted" else "warning" if payload.developer_tag == "declined" else "info"
    create_notification(
        db, submission.username,
        f"Challenge report '{submission.title}' has been {tag_label}",
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
    q_programs = select(ChallengeProgram)
    q_submissions = select(ChallengeSubmission)
    if start_date:
        q_programs = q_programs.where(ChallengeProgram.created_at >= start_date)
        q_submissions = q_submissions.where(ChallengeSubmission.created_at >= start_date)
    if end_date:
        end_dt = end_date + "T23:59:59"
        q_programs = q_programs.where(ChallengeProgram.created_at <= end_dt)
        q_submissions = q_submissions.where(ChallengeSubmission.created_at <= end_dt)
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
        select(ChallengeProgram)
        .where(ChallengeProgram.status.in_(["approved", "closed"]))
        .options(
            selectinload(ChallengeProgram.participants),
            selectinload(ChallengeProgram.submissions),
            selectinload(ChallengeProgram.ctf_levels),
            selectinload(ChallengeProgram.ctf_flag_submissions),
        )
        .order_by(ChallengeProgram.created_at.desc()),
    ).all()
    return {
        "service": SERVICE_META,
        "summary": {
            "approvedPrograms": len(approved),
            "participants": sum(len(program.participants) for program in approved),
            "submissions": len(db.scalars(select(ChallengeSubmission)).all()) + len(db.scalars(select(CtfFlagSubmission).where(CtfFlagSubmission.is_correct.is_(True))).all()),
        },
        "highlights": [
            "Persistent challenge requests, approvals, and notifications live in PostgreSQL.",
            "AntCrowd Web Security Lab tracks seven levels with saved progress and scoring.",
            "Platform and organization admins can see who joined every approved challenge.",
        ],
        "programs": [serialize_program(program) for program in approved],
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


@app.get("/api/dashboard/{username}")
def dashboard_legacy(username: str, request: Request, db: Session = Depends(get_db), session_user: SessionUser = Depends(resolve_session)) -> dict[str, Any]:
    """Backward-compatible dashboard endpoint — ignores path username, uses session."""
    require_authenticated(session_user)
    return build_dashboard(db, session_user)


@app.get("/api/notifications/{username}")
def notifications(username: str, db: Session = Depends(get_db)) -> dict[str, Any]:
    # user already authenticated via session
    rows = db.scalars(
        select(ChallengeNotification)
        .where(ChallengeNotification.username == username)
        .order_by(ChallengeNotification.created_at.desc()),
    ).all()
    return {
        "items": [serialize_notification(item) for item in rows],
        "unreadCount": sum(0 if item.is_read else 1 for item in rows),
    }


@app.post("/api/notifications/{notification_id}/read")
def mark_notification_read(notification_id: int, request: Request, db: Session = Depends(get_db), session_user: SessionUser = Depends(resolve_session)) -> dict[str, str]:
    require_authenticated(session_user)
    item = db.scalar(
        select(ChallengeNotification).where(
            ChallengeNotification.id == notification_id,
            ChallengeNotification.username == session_user.username,
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
    categories = normalize_categories(payload.challenge_categories)
    start_date, end_date = validate_program_window(payload.start_date, payload.end_date)
    program = ChallengeProgram(
        id=generate_program_id(payload.program_name),
        title=payload.program_name,
        summary=payload.description,
        status="pending",
        owner_username=username,
        scope=f"Category: {', '.join(categories)} | Dates: {payload.start_date} to {payload.end_date} | Flag: {payload.flag_format}",
        reward=f"ETB {payload.prize_pool_etb} prize pool",
        reward_value=800,
        rules="Submitted for platform review.",
        track=payload.difficulty_level,
        priority=", ".join(categories),
        challenge_categories=categories,
        prize_pool_etb=payload.prize_pool_etb,
        start_date=start_date,
        end_date=end_date,
        flag_format=payload.flag_format,
        correct_flag=payload.correct_flag,
        contact_email=payload.contact_email,
        created_at=utc_now(),
        updated_at=utc_now(),
    )
    db.add(program)
    create_notification(db, "platform_admin", "New challenge request", f"{payload.program_name} was submitted for approval.", "action")
    create_notification(db, username, "Challenge request submitted", f"{payload.program_name} is waiting for platform approval.", "info")
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="A challenge request with similar details already exists")
    db.refresh(program)
    return {"message": "Challenge request submitted for platform approval.", "program": serialize_program(program, session_user.role)}


@app.post("/api/programs/{program_id}/decision")
def decide_program(program_id: str, payload: DecisionInput, request: Request, db: Session = Depends(get_db), session_user: SessionUser = Depends(resolve_session)) -> dict[str, Any]:
    require_role_session(session_user, ["platform_admin"])
    action = payload.action.lower()
    if action not in {"approve", "decline"}:
        raise HTTPException(status_code=400, detail="Action must be approve or decline")
    program = program_for_update(db, program_id)
    if program.auto_approved:
        raise HTTPException(status_code=400, detail="This AntCrowd challenge is approved by default")
    program.status = "approved" if action == "approve" else "declined"
    program.updated_at = utc_now()
    create_notification(db, program.owner_username, "Challenge request updated", f"{program.title} was {program.status}.", "action")
    if action == "approve":
        create_notification(db, "researcher", "New challenge available", f"{program.title} is now available in Challenge Service.", "success")
    db.commit()
    return {
        "message": f"Challenge request {program.title} marked as {program.status}.",
        "program": serialize_program(program, session_user.role),
        "comment": payload.comment,
    }


@app.post("/api/programs/{program_id}/join")
def join_program(program_id: str, payload: JoinInput, request: Request, db: Session = Depends(get_db), session_user: SessionUser = Depends(resolve_session)) -> dict[str, Any]:
    require_role_session(session_user, ["researcher"])
    username = session_user.username
    program = program_for_update(db, program_id)
    if program.status == "closed":
        raise HTTPException(status_code=400, detail="This challenge is closed and no longer accepting new researchers")
    if program.status == "deleted":
        raise HTTPException(status_code=404, detail="Challenge not found")
    if program.status != "approved":
        raise HTTPException(status_code=400, detail="Only approved challenges can be joined")
    if program.end_date and program.end_date < date.today():
        raise HTTPException(status_code=400, detail="This challenge has expired and is no longer accepting new researchers")
    already_joined = any(item.username == username for item in program.participants)
    ensure_participant(db, program, username)
    if not already_joined:
        create_notification(db, "platform_admin", "Researcher joined challenge", f"{session_user.display_name} joined {program.title}.", "info")
        create_notification(db, program.owner_username, "Researcher joined your challenge", f"{session_user.display_name} joined {program.title}.", "info")
        create_notification(db, username, "Challenge joined", f"You joined {program.title}.", "success")
        create_notification(
            db,
            username,
            "New task assigned",
            "Open the joined challenge card to submit reports, or launch AntCrowd Web Security Lab if this is the CTF.",
            "info",
        )
        db.commit()
        program = program_for_update(db, program_id)
    return {"message": f"You joined {program.title}.", "program": serialize_program(program, session_user.role)}


@app.post("/api/programs/{program_id}/submissions")
def submit_report(program_id: str, payload: SubmissionInput, request: Request, db: Session = Depends(get_db), session_user: SessionUser = Depends(resolve_session)) -> dict[str, Any]:
    require_role_session(session_user, ["researcher"])
    username = session_user.username
    program = program_for_update(db, program_id)
    if program.status != "approved":
        raise HTTPException(status_code=400, detail="This challenge is not open for reports")
    require_joined_participant(program, username, "Join this challenge before submitting a report")
    if program.correct_flag and payload.flag.strip() and payload.flag.strip() != program.correct_flag:
        raise HTTPException(status_code=400, detail="The submitted flag is incorrect. Please try again.")
    submission = ChallengeSubmission(
        id=generate_submission_id("challenge-report"),
        program_id=program.id,
        program_title=program.title,
        username=username,
        title=payload.title,
        summary=payload.summary,
        evidence=payload.evidence,
        impact=payload.impact,
        status="validated",
        value_awarded=max(program.reward_value // 2, 250),
        created_at=utc_now(),
    )
    db.add(submission)
    create_notification(db, "platform_admin", "New challenge report", f"{session_user.display_name} submitted a report for {program.title}.", "action")
    create_notification(db, program.owner_username, "New submission received", f"{session_user.display_name} submitted a report for {program.title}.", "action")
    create_notification(db, username, "Leaderboard updated", f"Your report for {program.title} was recorded.", "success")
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="This challenge report could not be saved. Please retry.")
    return {"message": "Challenge report submitted and scored.", "submission": serialize_submission(submission)}


@app.get("/api/antcrowd-ctf/{username}")
def antcrowd_ctf_state(username: str, request: Request, db: Session = Depends(get_db), session_user: SessionUser = Depends(resolve_session)) -> dict[str, Any]:
    require_authenticated(session_user)
    username = session_user.username
    program = program_for_update(db, JUICE_SHOP_PROGRAM_ID)
    joined = any(item.username == username for item in program.participants)
    return {
        "program": serialize_program(program, session_user.role, username),
        "joined": joined,
        "progress": ctf_progress_for_user(program, username),
    }


@app.get("/api/ctf/admin/progress")
def ctf_admin_progress(
    request: Request,
    db: Session = Depends(get_db),
    session_user: SessionUser = Depends(resolve_session),
) -> dict[str, Any]:
    require_role_session(session_user, ["platform_admin"])
    program = program_for_update(db, JUICE_SHOP_PROGRAM_ID)
    participants = program.participants
    total_levels = len(program.ctf_levels)
    all_correct = [row for row in program.ctf_flag_submissions if row.is_correct]
    researcher_rows = []
    for participant in participants:
        uname = participant.username
        correct = [row for row in all_correct if row.username == uname]
        levels_solved = len({row.challenge_id for row in correct})
        pts = sum(row.points_awarded for row in correct)
        last_activity = max((row.created_at for row in correct), default=participant.joined_at)
        researcher_rows.append({
            "username": uname,
            "levelsCompleted": levels_solved,
            "totalLevels": total_levels,
            "totalPoints": pts,
            "lastActivity": last_activity.isoformat() if last_activity else None,
        })
    return {
        "totalResearchers": len(participants),
        "totalFlags": len(all_correct),
        "totalPoints": sum(row.points_awarded for row in all_correct),
        "researchers": researcher_rows,
    }


@app.post("/api/antcrowd-ctf/submissions")
def submit_ctf_flag(payload: JuiceShopSubmissionInput, request: Request, db: Session = Depends(get_db), session_user: SessionUser = Depends(resolve_session)) -> dict[str, Any]:
    require_role_session(session_user, ["researcher"])
    username = session_user.username
    program = program_for_update(db, JUICE_SHOP_PROGRAM_ID)
    require_joined_participant(program, username, "Join AntCrowd Web Security Lab before submitting flags")
    level = find_level(program, payload.challenge_id)
    existing_correct = db.scalar(
        select(CtfFlagSubmission).where(
            CtfFlagSubmission.program_id == program.id,
            CtfFlagSubmission.challenge_id == level.id,
            CtfFlagSubmission.username == username,
            CtfFlagSubmission.is_correct.is_(True),
        ),
    )
    is_correct = payload.submitted_flag.strip() == level.flag
    points_awarded = level.points if is_correct and not existing_correct else 0
    submission = CtfFlagSubmission(
        program_id=program.id,
        challenge_id=level.id,
        username=username,
        submitted_flag=payload.submitted_flag,
        is_correct=is_correct,
        points_awarded=points_awarded,
        created_at=utc_now(),
    )
    db.add(submission)
    if is_correct:
        create_notification(db, username, "Flag accepted", f"{level.title} is now marked as solved.", "success")
        create_notification(db, "platform_admin", "New CTF flag submission", f"{session_user.display_name} solved {level.title} in AntCrowd Web Security Lab.", "action")
        create_notification(db, program.owner_username, "New CTF progress", f"{session_user.display_name} solved {level.title} in AntCrowd Web Security Lab.", "info")
    db.commit()
    progress = ctf_progress_for_user(program_for_update(db, program.id), username)
    if is_correct and points_awarded:
        message = f"Flag accepted. {points_awarded} points awarded."
    elif is_correct:
        message = "Flag already solved earlier. Progress kept."
    else:
        message = "Flag rejected. Keep investigating the target."
    return {
        "message": message,
        "isCorrect": is_correct,
        "pointsAwarded": points_awarded,
        "progress": progress,
    }


@app.delete("/api/programs/{program_id}")
def delete_program(program_id: str, payload: DecisionInput, request: Request, db: Session = Depends(get_db), session_user: SessionUser = Depends(resolve_session)) -> dict[str, Any]:
    require_role_session(session_user, ["platform_admin"])
    program = program_for_update(db, program_id)
    if program.auto_approved:
        raise HTTPException(status_code=400, detail="This AntCrowd challenge cannot be deleted")
    if program.status == "deleted":
        raise HTTPException(status_code=400, detail="Challenge is already deleted")
    program.status = "deleted"
    program.updated_at = utc_now()
    create_notification(db, program.owner_username, "Challenge deleted", f"{program.title} was deleted by platform admin.", "action")
    db.commit()
    return {"message": f"Challenge {program.title} has been deleted."}


@app.post("/api/programs/{program_id}/close")
def close_program(program_id: str, payload: DecisionInput, request: Request, db: Session = Depends(get_db), session_user: SessionUser = Depends(resolve_session)) -> dict[str, Any]:
    require_role_session(session_user, ["platform_admin"])
    program = program_for_update(db, program_id)
    if program.status != "approved":
        raise HTTPException(status_code=400, detail="Only approved challenges can be closed")
    program.status = "closed"
    program.updated_at = utc_now()
    create_notification(db, program.owner_username, "Challenge closed", f"{program.title} has been closed to new researchers.", "action")
    create_notification(db, "researcher", "Challenge closed", f"{program.title} is no longer accepting new researchers.", "info")
    db.commit()
    return {"message": f"Challenge {program.title} has been closed."}


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
    submission = db.scalar(select(ChallengeSubmission).where(ChallengeSubmission.id == submission_id))
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
    submission = db.scalar(select(ChallengeSubmission).where(ChallengeSubmission.id == submission_id))
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

