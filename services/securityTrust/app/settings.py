import os


def _normalize_database_url(raw_url: str) -> str:
    if raw_url.startswith("postgresql://"):
        return raw_url.replace("postgresql://", "postgresql+psycopg2://", 1)
    return raw_url


class Settings:
    DATABASE_URL = _normalize_database_url(
        os.getenv("DATABASE_URL", "postgresql+psycopg2://antcrowd:antcrowd123@postgres:5432/trust_db"),
    )
    AUTH_SERVICE_INTROSPECT_URL = os.getenv(
        "AUTH_SERVICE_INTROSPECT_URL",
        "http://auth-service:8080/session/introspect",
    )
    AUTH_INTERNAL_SERVICE_TOKEN = os.getenv(
        "AUTH_INTERNAL_SERVICE_TOKEN",
        "antcrowd-internal-dev-token",
    )
    AUTH_SESSION_COOKIE_NAME = os.getenv("AUTH_SESSION_COOKIE_NAME", "antcrowd_session")
    PLATFORM_LOGIN_URL = os.getenv("PLATFORM_LOGIN_URL", "/login")
    PLATFORM_LOGOUT_URL = os.getenv("PLATFORM_LOGOUT_URL", "/api/auth/logout")


settings = Settings()
