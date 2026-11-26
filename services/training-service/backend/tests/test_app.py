import unittest
from unittest.mock import MagicMock, patch

from fastapi import HTTPException
from sqlalchemy.exc import SQLAlchemyError

from app.main import health_check, ready_check, root


class AppRouteTests(unittest.TestCase):
    def test_health_check_returns_ok(self) -> None:
        self.assertEqual(health_check(), {"status": "ok"})

    def test_root_returns_service_metadata(self) -> None:
        payload = root()
        self.assertEqual(payload["status"], "ok")
        self.assertEqual(payload["docs"], "/docs")
        self.assertEqual(payload["health"], "/health")
        self.assertEqual(payload["ready"], "/ready")

    @patch("app.main.engine.connect")
    def test_ready_check_returns_ok_when_database_is_available(self, mock_connect: MagicMock) -> None:
        mock_connect.return_value.__enter__.return_value = MagicMock()
        self.assertEqual(ready_check(), {"status": "ok"})

    @patch("app.main.engine.connect", side_effect=SQLAlchemyError("db unavailable"))
    def test_ready_check_raises_http_503_when_database_is_unavailable(self, _mock_connect: MagicMock) -> None:
        with self.assertRaises(HTTPException) as context:
            ready_check()

        self.assertEqual(context.exception.status_code, 503)
        self.assertEqual(context.exception.detail, "Database not ready")
