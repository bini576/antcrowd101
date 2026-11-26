#!/usr/bin/env python3
"""Apply session-auth integration to ai-redteam-service and challenge-service main.py files.

This script performs the same refactoring already done manually on bug-bounty-service:
1. Add auth_introspect imports
2. Rename DEMO_USERS → LEGACY_DISPLAY_NAMES + _SEED_USERS
3. Remove LoginInput class
4. Remove username from Pydantic models
5. Replace resolve_user/require_role/display_name
6. Update build_dashboard
7. Replace /api/demo/login with /api/whoami + /api/admin/summary
8. Update all endpoints to use session auth
"""

import re
import sys

def patch_file(filepath: str) -> None:
    with open(filepath, "r") as f:
        content = f.read()

    original = content

    # 1. Add auth imports after existing imports
    old_import = "from fastapi import Depends, FastAPI, HTTPException"
    new_import = "from fastapi import Depends, FastAPI, HTTPException, Request"
    content = content.replace(old_import, new_import, 1)

    # Add auth_introspect import after database import line
    db_import_pattern = r"(from \.database import SessionLocal\n)"
    auth_import = (
        "from .auth_introspect import (\n"
        "    ANONYMOUS_USER,\n"
        "    PLATFORM_LOGIN_URL,\n"
        "    PLATFORM_LOGOUT_URL,\n"
        "    SessionUser,\n"
        "    require_authenticated,\n"
        "    require_platform_admin,\n"
        "    resolve_session,\n"
        ")\n"
    )
    content = re.sub(db_import_pattern, auth_import + r"\1", content, count=1)

    # 2. Rename DEMO_USERS
    demo_block = '''DEMO_USERS = {
    "platform_admin": {"role": "platform_admin", "label": "Platform Admin", "display_name": "Platform Admin"},
    "org_admin": {"role": "org_admin", "label": "Organization Admin", "display_name": "Organization Admin"},
    "researcher": {"role": "researcher", "label": "Bob", "display_name": "Bob"},
    "user": {"role": "user", "label": "Public Visitor", "display_name": "Public Visitor"},
}'''
    replacement_block = '''# Legacy display names for seed data records that used demo usernames
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
}'''
    content = content.replace(demo_block, replacement_block, 1)

    # 3. Remove LoginInput
    content = content.replace(
        'class LoginInput(BaseModel):\n    username: str\n    password: str',
        '# LoginInput removed — authentication is handled by platform session cookies',
        1
    )

    # 4. Remove username from Pydantic models (pattern: "    username: str\n" as first field)
    # This needs to be done carefully for each model
    content = re.sub(
        r'(class (?:ProgramCreateInput|DecisionInput|SubmissionInput)\(BaseModel\):\n)    username: str\n',
        r'\1',
        content
    )
    # JoinInput and NotificationReadInput just have username
    content = content.replace(
        'class JoinInput(BaseModel):\n    username: str',
        'class JoinInput(BaseModel):\n    pass  # username resolved from session'
    )
    content = content.replace(
        'class NotificationReadInput(BaseModel):\n    username: str',
        'class NotificationReadInput(BaseModel):\n    pass  # username resolved from session'
    )

    # 5. Replace resolve_user, require_role, display_name
    content = content.replace(
        '''def resolve_user(username: str) -> dict[str, str]:
    user = DEMO_USERS.get(username)
    if not user:
        raise HTTPException(status_code=404, detail="Unknown demo user")
    return user


def require_role(username: str, allowed: list[str]) -> dict[str, str]:
    user = resolve_user(username)
    if user["role"] not in allowed:
        raise HTTPException(status_code=403, detail="This action is not available for the current demo role")
    return user


def display_name(username: str) -> str:
    return resolve_user(username)["display_name"]''',
        '''def resolve_user_from_session(session_user: SessionUser) -> dict[str, str]:
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
    return username''',
        1
    )

    # 6. Update serialize_program viewer_username -> viewer_role
    content = content.replace(
        'viewer_username: str | None = None',
        'viewer_role: str | None = None'
    )
    # Fix the viewer check in serialize_program
    content = re.sub(
        r'    if viewer_username:\n        viewer = DEMO_USERS\.get\(viewer_username\)\n        if viewer and viewer\["role"\] in \("platform_admin", "org_admin"\):\n            result\["contactEmail"\] = program\.contact_email',
        '    if viewer_role and viewer_role in ("platform_admin", "org_admin"):\n        result["contactEmail"] = program.contact_email',
        content
    )

    # 7. Update build_leaderboard
    content = re.sub(
        r'    scores = \{username: 0 for username in DEMO_USERS\}',
        '    scores: dict[str, int] = {}',
        content
    )

    # 8. Update build_dashboard
    content = content.replace(
        'def build_dashboard(db: Session, username: str) -> dict[str, Any]:\n    user = resolve_user(username)',
        'def build_dashboard(db: Session, session_user: SessionUser) -> dict[str, Any]:\n    username = session_user.username\n    role = session_user.role'
    )
    content = content.replace('    if user["role"] == "platform_admin":', '    if role == "platform_admin":')
    content = content.replace('    elif user["role"] == "org_admin":', '    elif role == "org_admin":')
    content = content.replace('    elif user["role"] == "researcher":', '    elif role == "researcher":')

    # Fix the role dict in build_dashboard return
    content = re.sub(
        r'"role": \{"username": username, "name": user\["role"\], "label": user\["label"\], "displayName": user\["display_name"\]\}',
        '"role": {"username": username, "name": role, "label": session_user.display_name, "displayName": session_user.display_name}',
        content
    )
    # Fix serialize_program calls in dashboard
    content = re.sub(
        r'serialize_program\(program, username\)',
        'serialize_program(program, role)',
        content
    )

    # 9. Update seed_demo_data DEMO_USERS reference
    content = content.replace('for username in DEMO_USERS:', 'for username in _SEED_USERS:')

    # 10. Replace /api/demo/login endpoint with whoami + admin/summary
    # Find the demo login block and replace it
    # We need to handle different service-specific code, so let's find and replace the demo login
    demo_login_pattern = re.compile(
        r'@app\.post\("/api/demo/login"\)\n'
        r'def login\(payload: LoginInput\).*?'
        r'(?=\n\n@app)',
        re.DOTALL
    )
    
    # Determine service-specific values
    if 'ai-redteam' in filepath or 'AiRedTeam' in content:
        svc_key = 'ai-redteam'
        svc_name = 'AI Red Team Service'
        model_program = 'AiRedTeamProgram'
        model_submission = 'AiRedTeamSubmission'
        model_participant = 'AiRedTeamParticipant'
        model_notification = 'AiRedTeamNotification'
    else:
        svc_key = 'challenge'
        svc_name = 'Challenge Service'
        model_program = 'ChallengeProgram'
        model_submission = 'ChallengeSubmission'
        model_participant = 'ChallengeParticipant'
        model_notification = 'ChallengeNotification'

    whoami_block = f'''@app.post("/api/demo/login")
def login_legacy() -> dict[str, Any]:
    """Removed — authentication is handled by platform session cookies."""
    raise HTTPException(status_code=410, detail="Demo login has been removed. Use the platform login page.")


@app.get("/api/whoami")
def whoami(request: Request, session_user: SessionUser = Depends(resolve_session)) -> dict[str, Any]:
    """Return the resolved role and identity for the current session."""
    return {{
        "authenticated": session_user.role != "user",
        "role": session_user.role,
        "email": session_user.email,
        "displayName": session_user.display_name,
        "username": session_user.username,
        "loginUrl": PLATFORM_LOGIN_URL,
        "logoutUrl": PLATFORM_LOGOUT_URL,
        "service": SERVICE_META,
    }}


@app.get("/api/admin/summary")
def admin_summary(
    request: Request,
    db: Session = Depends(get_db),
    session_user: SessionUser = Depends(resolve_session),
) -> dict[str, Any]:
    """Platform-admin-only summary metrics for the admin dashboard."""
    require_platform_admin(session_user)
    programs = db.scalars(select({model_program})).all()
    submissions = db.scalars(select({model_submission})).all()
    non_deleted = [p for p in programs if p.status != "deleted"]
    return {{
        "service": SERVICE_META["key"],
        "serviceName": SERVICE_META["name"],
        "approvedPrograms": len([p for p in non_deleted if p.status in ("approved", "closed")]),
        "pendingPrograms": len([p for p in non_deleted if p.status == "pending"]),
        "totalSubmissions": len(submissions),
        "totalParticipants": db.scalar(select(text("count(*)")).select_from({model_participant})) or 0,
    }}'''

    content = demo_login_pattern.sub(whoami_block, content, count=1)

    # 11. Update dashboard endpoint
    content = re.sub(
        r'@app\.get\("/api/dashboard/\{username\}"\)\ndef dashboard\(username: str, db: Session = Depends\(get_db\)\) -> dict\[str, Any\]:\n    return build_dashboard\(db, username\)',
        '''@app.get("/api/dashboard")
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
    return build_dashboard(db, session_user)''',
        content, count=1
    )

    # 12. Update notifications endpoint
    content = re.sub(
        r'@app\.get\("/api/notifications/\{username\}"\)\ndef notifications\(username: str, db: Session = Depends\(get_db\)\) -> dict\[str, Any\]:\n    resolve_user\(username\)\n    rows = db\.scalars\(\n        select\(' + model_notification + r'\)\.where\(' + model_notification + r'\.username == username\)\.order_by\(' + model_notification + r'\.created_at\.desc\(\)\),\n    \)\.all\(\)\n    return \{"items": \[serialize_notification\(item\) for item in rows\], "unreadCount": sum\(0 if item\.is_read else 1 for item in rows\)\}',
        f'''@app.get("/api/notifications")
def notifications_session(
    request: Request,
    db: Session = Depends(get_db),
    session_user: SessionUser = Depends(resolve_session),
) -> dict[str, Any]:
    require_authenticated(session_user)
    rows = db.scalars(
        select({model_notification}).where({model_notification}.username == session_user.username).order_by({model_notification}.created_at.desc()),
    ).all()
    return {{"items": [serialize_notification(item) for item in rows], "unreadCount": sum(0 if item.is_read else 1 for item in rows)}}


@app.get("/api/notifications/{{username}}")
def notifications(username: str, request: Request, db: Session = Depends(get_db), session_user: SessionUser = Depends(resolve_session)) -> dict[str, Any]:
    require_authenticated(session_user)
    rows = db.scalars(
        select({model_notification}).where({model_notification}.username == session_user.username).order_by({model_notification}.created_at.desc()),
    ).all()
    return {{"items": [serialize_notification(item) for item in rows], "unreadCount": sum(0 if item.is_read else 1 for item in rows)}}''',
        content, count=1
    )

    # 13. Update mark_notification_read
    content = re.sub(
        r'def mark_notification_read\(notification_id: int, payload: NotificationReadInput, db: Session = Depends\(get_db\)\)',
        'def mark_notification_read(notification_id: int, request: Request, db: Session = Depends(get_db), session_user: SessionUser = Depends(resolve_session))',
        content
    )
    content = content.replace(
        '    resolve_user(payload.username)\n    item = db.scalar(\n        select(' + model_notification + ').where(\n            ' + model_notification + '.id == notification_id,\n            ' + model_notification + '.username == payload.username,',
        '    require_authenticated(session_user)\n    item = db.scalar(\n        select(' + model_notification + ').where(\n            ' + model_notification + '.id == notification_id,\n            ' + model_notification + '.username == session_user.username,'
    )

    # 14. Update create_program, decide_program, join_program, submit_report, delete_program, close_program
    # Replace all require_role(payload.username, ...) with require_role_session(session_user, ...)
    content = re.sub(
        r'require_role\(payload\.username, (\[.*?\])\)',
        r'require_role_session(session_user, \1)',
        content
    )

    # Add session_user dependency to all endpoint function signatures
    content = re.sub(
        r'(def (?:create_program|decide_program|delete_program|close_program|submit_report)\(.*?)db: Session = Depends\(get_db\)\)',
        r'\1request: Request, db: Session = Depends(get_db), session_user: SessionUser = Depends(resolve_session))',
        content
    )
    content = re.sub(
        r'(def join_program\(.*?)db: Session = Depends\(get_db\)\)',
        r'\1request: Request, db: Session = Depends(get_db), session_user: SessionUser = Depends(resolve_session))',
        content
    )

    # Replace payload.username with session_user.username or username local
    # Add "username = session_user.username" after role checks where needed
    # For create_program:
    content = re.sub(
        r'(require_role_session\(session_user, \["org_admin"\]\))\n(    )',
        r'\1\n    username = session_user.username\n\2',
        content, count=1
    )
    content = content.replace('owner_username=payload.username,', 'owner_username=username,')
    
    # For join_program:
    content = re.sub(
        r'(require_role_session\(session_user, \["researcher"\]\))\n(    program = program_for_update)',
        r'\1\n    username = session_user.username\n\2',
        content, count=1
    )
    content = content.replace('any(item.username == payload.username', 'any(item.username == username')
    content = content.replace('ensure_participant(db, program, payload.username)', 'ensure_participant(db, program, username)')

    # For submit_report:
    content = re.sub(
        r'(require_role_session\(session_user, \["researcher"\]\))\n(    program = program_for_update.*?\n    if program\.status)',
        r'\1\n    username = session_user.username\n\2',
        content, count=1, flags=re.DOTALL
    )
    content = content.replace('require_joined_participant(program, payload.username)', 'require_joined_participant(program, username)')
    content = content.replace('username=payload.username,', 'username=username,')
    
    # For notification messages, replace "Bob" with display_name
    content = content.replace('f"Bob joined {program.title}."', 'f"{session_user.display_name} joined {program.title}."')
    content = content.replace('f"Bob submitted a', 'f"{session_user.display_name} submitted a')

    # Replace payload.username with username in notification calls
    content = re.sub(
        r'create_notification\(db, payload\.username,',
        'create_notification(db, username,',
        content
    )

    # Fix serialize_program calls that pass payload.username
    content = re.sub(
        r'serialize_program\(program, payload\.username\)',
        'serialize_program(program, session_user.role)',
        content
    )

    if content == original:
        print(f"WARNING: No changes made to {filepath}")
        return

    with open(filepath, "w") as f:
        f.write(content)
    print(f"Patched: {filepath}")


if __name__ == "__main__":
    base = "/home/apex/Documents/integration (2)/integration/antcrowd101/services"
    patch_file(f"{base}/ai-redteam-service/src/main.py")
    patch_file(f"{base}/challenge-service/src/main.py")
    print("Done.")
