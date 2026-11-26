import time

from sqlalchemy import select, text
from sqlalchemy.exc import OperationalError

from app.core.config import settings
from app.core.database import SessionLocal, engine
from app.models import User, UserRole
from app.services.auth import hash_password


def wait_for_db(max_attempts: int = 30, sleep_seconds: int = 2) -> None:
    for attempt in range(1, max_attempts + 1):
        try:
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            return
        except OperationalError:
            if attempt == max_attempts:
                raise
            time.sleep(sleep_seconds)


def seed_initial_admin() -> None:
    wait_for_db()

    with SessionLocal() as db:
        existing = db.scalar(select(User).where(User.email == settings.initial_admin_email))
        if existing:
            return

        admin = User(
            email=settings.initial_admin_email,
            hashed_password=hash_password(settings.initial_admin_password),
            role=UserRole.admin,
        )
        db.add(admin)
        db.commit()


if __name__ == "__main__":
    seed_initial_admin()
