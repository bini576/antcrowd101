from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+psycopg2://postgres:postgres@postgres:5432/grc_db"
    SECRET_KEY: str = "change-me"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    API_PREFIX: str = "/api/v1"
    AUTH_SERVICE_INTROSPECT_URL: str = "http://auth-service:8080/session/introspect"
    AUTH_INTERNAL_SERVICE_TOKEN: str = "antcrowd-internal-dev-token"
    AUTH_SESSION_COOKIE_NAME: str = "antcrowd_session"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")


settings = Settings()
