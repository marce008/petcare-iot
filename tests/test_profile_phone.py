import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock

from bson import ObjectId

from backend import main


class ProfilePhoneTests(unittest.IsolatedAsyncioTestCase):
    async def test_profile_phone_can_be_updated_without_sms_verification(self):
        user_id = ObjectId()
        user = {
            "_id": user_id,
            "nombre": "Sara",
            "email": "sara@example.com",
            "telefono": "+593991234567",
            "telefono_verificado": "+593991234567",
            "phone_verification_pending": "+593991234567",
            "phone_verification_sent_at": "old-verification",
        }
        updated_user = {**user, "telefono": "+593987654321"}
        users = SimpleNamespace(
            find_one=AsyncMock(side_effect=[user, None, updated_user]),
            update_one=AsyncMock(),
        )
        request = SimpleNamespace(
            app=SimpleNamespace(state=SimpleNamespace(database=SimpleNamespace(usuarios=users)))
        )
        data = main.ProfileInput(
            nombre="Sara",
            email="sara@example.com",
            telefono="+593987654321",
        )

        result = await main.update_profile(data, request, str(user_id))

        self.assertEqual(result["id"], str(user_id))
        update = users.update_one.await_args.args[1]
        self.assertEqual(update["$set"]["telefono"], "+593987654321")
        self.assertEqual(
            set(update["$unset"]),
            {
                "telefono_verificado",
                "phone_verification_pending",
                "phone_verification_sent_at",
            },
        )


if __name__ == "__main__":
    unittest.main()
