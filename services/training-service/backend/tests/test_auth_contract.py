import unittest

from fastapi import HTTPException

from app.auth_contract import canonical_role, parse_requested_role
from app.models import UserRole


class AuthContractTests(unittest.TestCase):
    def test_parse_requested_role_accepts_canonical_aliases(self) -> None:
        self.assertEqual(parse_requested_role("platform_admin"), UserRole.admin)
        self.assertEqual(parse_requested_role("organization_admin"), UserRole.organization)
        self.assertEqual(parse_requested_role("trainer"), UserRole.trainer)

    def test_parse_requested_role_rejects_unknown_role(self) -> None:
        with self.assertRaises(HTTPException):
            parse_requested_role("hacker")

    def test_canonical_role_maps_internal_roles(self) -> None:
        self.assertEqual(canonical_role(UserRole.admin), "platform_admin")
        self.assertEqual(canonical_role(UserRole.organization), "organization_admin")
        self.assertEqual(canonical_role(UserRole.trainer), "trainer")
