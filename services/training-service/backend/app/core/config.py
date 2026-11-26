from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    environment: str = "development"
    project_name: str = "Training Management Service"
    database_url: str = "postgresql+psycopg2://antcrowd:antcrowd123@localhost:5544/training_service"
    jwt_secret_key: str = "change-me"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60
    cors_origins: str = "http://localhost:5279,http://localhost:5274,http://localhost:5275"
    initial_admin_email: str = "admin@acmecorp.com"
    initial_admin_password: str = "Admin123!"
    auth_service_introspect_url: str = "http://auth-service:8080/session/introspect"
    auth_internal_service_token: str = "antcrowd-internal-dev-token"
    auth_session_cookie_name: str = "antcrowd_session"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @property
    def cors_origins_list(self) -> list[str]:
        value = self.cors_origins.strip()
        if not value:
            return []
        if value.startswith("[") and value.endswith("]"):
            # Supports JSON-style list value in env.
            import json

            parsed = json.loads(value)
            return [str(origin).strip() for origin in parsed if str(origin).strip()]
        return [origin.strip() for origin in value.split(",") if origin.strip()]

    def validate_runtime(self) -> None:
        env = self.environment.strip().lower()
        if env not in {"production", "staging"}:
            return

        if not self.jwt_secret_key.strip() or self.jwt_secret_key == "change-me":
            raise ValueError("JWT_SECRET_KEY must be set to a secure value in production/staging")

        if self.initial_admin_password == "Admin123!":
            raise ValueError("INITIAL_ADMIN_PASSWORD must not use the default value in production/staging")


settings = Settings()
