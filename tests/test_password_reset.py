import hashlib
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from bson import ObjectId
from fastapi import HTTPException

from backend import main


class FakeDatabase:
    def __init__(self, users, reset_attempts=None):
        self.usuarios = users
        self.reset_attempts = reset_attempts

    def __getitem__(self, key):
        if key == "password_reset_attempts":
            return self.reset_attempts
        raise KeyError(key)


class PasswordResetTests(unittest.IsolatedAsyncioTestCase):
    def make_request(self, users, reset_attempts=None):
        database = FakeDatabase(users, reset_attempts)
        return SimpleNamespace(
            app=SimpleNamespace(state=SimpleNamespace(database=database)),
            client=SimpleNamespace(host="192.0.2.1"),
        )

    async def test_matching_email_and_name_returns_a_hashed_temporary_token(self):
        user = {"_id": ObjectId(), "nombre": "Sofía García"}
        users = SimpleNamespace(
            find_one=AsyncMock(return_value=user),
            update_one=AsyncMock(),
        )
        request = self.make_request(users)

        with patch.object(main, "_check_password_reset_attempt_limit", new=AsyncMock()):
            before_request = main.datetime.now(main.timezone.utc)
            result = await main.request_password_reset(
                main.PasswordResetRequestInput(
                    email="Person@example.com",
                    nombre="  SOFÍA   GARCÍA ",
                ),
                request,
            )

        token = result["reset_token"]
        update = users.update_one.await_args.args[1]
        token_hash = update["$set"]["password_reset_token_hash"]
        self.assertNotEqual(token_hash, token)
        self.assertEqual(token_hash, hashlib.sha256(token.encode()).hexdigest())
        self.assertLessEqual(
            update["$set"]["password_reset_expires_at"] - before_request,
            main.PASSWORD_RESET_TOKEN_LIFETIME + main.timedelta(seconds=1),
        )
        self.assertGreaterEqual(
            update["$set"]["password_reset_expires_at"],
            before_request + main.PASSWORD_RESET_TOKEN_LIFETIME,
        )
        self.assertEqual(users.find_one.await_args.args[0], {"email": "person@example.com"})

    async def test_nonmatching_email_or_name_does_not_issue_token(self):
        users = SimpleNamespace(
            find_one=AsyncMock(return_value={"_id": ObjectId(), "nombre": "Sara Garcia"}),
            update_one=AsyncMock(),
        )
        request = self.make_request(users)

        with patch.object(main, "_check_password_reset_attempt_limit", new=AsyncMock()):
            with self.assertRaises(HTTPException) as context:
                await main.request_password_reset(
                    main.PasswordResetRequestInput(
                        email="person@example.com",
                        nombre="Otra persona",
                    ),
                    request,
                )

        self.assertEqual(context.exception.status_code, 400)
        users.update_one.assert_not_awaited()

    async def test_unknown_email_does_not_issue_token(self):
        users = SimpleNamespace(find_one=AsyncMock(return_value=None), update_one=AsyncMock())
        request = self.make_request(users)

        with patch.object(main, "_check_password_reset_attempt_limit", new=AsyncMock()):
            with self.assertRaises(HTTPException) as context:
                await main.request_password_reset(
                    main.PasswordResetRequestInput(
                        email="unknown@example.com",
                        nombre="Persona desconocida",
                    ),
                    request,
                )

        self.assertEqual(context.exception.status_code, 400)
        users.update_one.assert_not_awaited()

    async def test_attempt_limit_is_checked_before_user_lookup(self):
        users = SimpleNamespace(find_one=AsyncMock())
        request = self.make_request(users)
        with patch.object(
            main,
            "_check_password_reset_attempt_limit",
            new=AsyncMock(
                side_effect=HTTPException(status_code=429, detail="Rate limit")
            ),
        ):
            with self.assertRaises(HTTPException) as context:
                await main.request_password_reset(
                    main.PasswordResetRequestInput(
                        email="person@example.com",
                        nombre="Persona",
                    ),
                    request,
                )

        self.assertEqual(context.exception.status_code, 429)
        users.find_one.assert_not_awaited()

    async def test_valid_token_replaces_password_and_is_consumed(self):
        raw_token = "a" * 43
        user = {"_id": ObjectId()}
        users = SimpleNamespace(
            find_one=AsyncMock(return_value=user),
            find_one_and_update=AsyncMock(return_value=user),
        )
        request = self.make_request(users)

        result = await main.confirm_password_reset(
            main.PasswordResetConfirmInput(
                token=raw_token,
                password="new-password",
            ),
            request,
        )

        query = users.find_one_and_update.await_args.args[0]
        update = users.find_one_and_update.await_args.args[1]
        self.assertEqual(
            result["message"],
            "La contraseña se restableció correctamente. Ya puedes iniciar sesión.",
        )
        self.assertEqual(
            query["password_reset_token_hash"],
            hashlib.sha256(raw_token.encode()).hexdigest(),
        )
        self.assertTrue(
            main._password_matches(
                "new-password",
                update["$set"]["password_hash"],
            )
        )
        self.assertIn("password_reset_token_hash", update["$unset"])
        self.assertIn("password_reset_expires_at", update["$unset"])

    async def test_expired_or_unknown_token_is_rejected_before_hashing_password(self):
        users = SimpleNamespace(
            find_one=AsyncMock(return_value=None),
            find_one_and_update=AsyncMock(),
        )
        request = self.make_request(users)

        with patch.object(main, "_password_hash") as password_hash:
            with self.assertRaises(HTTPException) as context:
                await main.confirm_password_reset(
                    main.PasswordResetConfirmInput(
                        token="b" * 43,
                        password="new-password",
                    ),
                    request,
                )

        self.assertEqual(context.exception.status_code, 400)
        password_hash.assert_not_called()
        users.find_one_and_update.assert_not_awaited()

    async def test_attempt_limit_uses_expiring_database_bucket(self):
        bucket = SimpleNamespace(
            update_one=AsyncMock(),
            find_one=AsyncMock(return_value={"attempts": 6}),
        )
        users = SimpleNamespace()
        request = self.make_request(users, bucket)

        with self.assertRaises(HTTPException) as context:
            await main._check_password_reset_attempt_limit(request, "person@example.com")

        self.assertEqual(context.exception.status_code, 429)
        bucket.update_one.assert_awaited_once()
        self.assertTrue(bucket.update_one.await_args.kwargs["upsert"])


if __name__ == "__main__":
    unittest.main()
