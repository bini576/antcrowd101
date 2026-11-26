import unittest

from fastapi import HTTPException

from app.services.auth import create_access_token, decode_access_token, hash_password, verify_password


class AuthServiceTests(unittest.TestCase):
    def test_password_hash_round_trip(self) -> None:
        password = "Antcrowd123!"
        hashed = hash_password(password)

        self.assertNotEqual(hashed, password)
        self.assertTrue(verify_password(password, hashed))

    def test_create_and_decode_access_token(self) -> None:
        token = create_access_token("123e4567-e89b-12d3-a456-426614174000")
        payload = decode_access_token(token)

        self.assertEqual(payload["sub"], "123e4567-e89b-12d3-a456-426614174000")
        self.assertIn("exp", payload)

    def test_decode_access_token_rejects_invalid_token(self) -> None:
        with self.assertRaises(HTTPException) as context:
            decode_access_token("not-a-token")

        self.assertEqual(context.exception.status_code, 401)
