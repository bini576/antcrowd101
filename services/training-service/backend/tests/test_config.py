import unittest

from app.core.config import Settings


class SettingsTests(unittest.TestCase):
    def test_cors_origins_list_parses_csv(self) -> None:
        settings = Settings(cors_origins="http://localhost:5279,http://localhost:5274")
        self.assertEqual(settings.cors_origins_list, ["http://localhost:5279", "http://localhost:5274"])

    def test_cors_origins_list_parses_json(self) -> None:
        settings = Settings(cors_origins='["http://localhost:5279", "http://localhost:5274"]')
        self.assertEqual(settings.cors_origins_list, ["http://localhost:5279", "http://localhost:5274"])

    def test_validate_runtime_allows_development_defaults(self) -> None:
        settings = Settings(environment="development")
        settings.validate_runtime()

    def test_validate_runtime_rejects_default_secret_in_production(self) -> None:
        settings = Settings(
            environment="production",
            jwt_secret_key="change-me",
            initial_admin_password="StrongAdmin123!"
        )

        with self.assertRaises(ValueError):
            settings.validate_runtime()

    def test_validate_runtime_rejects_default_admin_password_in_staging(self) -> None:
        settings = Settings(
            environment="staging",
            jwt_secret_key="this-is-a-secure-secret-value-for-tests",
            initial_admin_password="Admin123!"
        )

        with self.assertRaises(ValueError):
            settings.validate_runtime()
