import os

from dotenv import load_dotenv


load_dotenv()


def _normalize_database_url(raw_url: str) -> str:
    if raw_url.startswith("postgresql://"):
        return raw_url.replace("postgresql://", "postgresql+psycopg2://", 1)
    return raw_url


class Settings:
    DATABASE_URL = _normalize_database_url(
        os.getenv("DATABASE_URL", "postgresql+psycopg2://antcrowd:antcrowd123@postgres:5432/challenge_db"),
    )


settings = Settings()
