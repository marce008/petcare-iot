import hashlib
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock, patch

from bson import ObjectId
from fastapi import HTTPException

from backend import main


class DeviceAuthenticationTests(unittest.IsolatedAsyncioTestCase):
    async def test_device_token_is_saved_on_account_not_pet(self):
        user_id = str(ObjectId())
        pet_id = str(ObjectId())
        user_collection = SimpleNamespace(
            update_one=AsyncMock(
                return_value=SimpleNamespace(matched_count=1)
            )
        )
        request = SimpleNamespace(
            app=SimpleNamespace(
                state=SimpleNamespace(
                    database=SimpleNamespace(usuarios=user_collection)
                )
            )
        )

        with (
            patch.object(
                main, "_owned_pet", new=AsyncMock(return_value={"_id": ObjectId(pet_id)})
            ),
            patch.object(main.secrets, "token_urlsafe", return_value="account-token"),
        ):
            result = await main.create_account_device_token(
                pet_id, request, user_id
            )

        self.assertEqual(result, {"device_token": "account-token"})
        user_collection.update_one.assert_awaited_once_with(
            {"_id": ObjectId(user_id)},
            {
                "$set": {
                    "device_token_hash": hashlib.sha256(
                        b"account-token"
                    ).hexdigest()
                }
            },
        )

    async def test_device_token_resolves_to_account_without_environment_email(self):
        user_id = ObjectId()
        token = "issued-device-token"
        user = {"_id": user_id, "email": "owner@example.com"}
        users = SimpleNamespace(find_one=AsyncMock(return_value=user))
        request = SimpleNamespace(
            app=SimpleNamespace(
                state=SimpleNamespace(
                    database=SimpleNamespace(usuarios=users)
                )
            )
        )

        result = await main._authenticated_device(request, token)

        self.assertEqual(result, user)
        users.find_one.assert_awaited_once_with(
            {"device_token_hash": hashlib.sha256(token.encode("utf-8")).hexdigest()}
        )

    async def test_schedule_list_includes_only_pets_owned_by_token_account(self):
        user_id = str(ObjectId())
        first_pet_id = ObjectId()
        second_pet_id = ObjectId()
        pet_records = [
            {"_id": first_pet_id, "usuario_id": user_id, "nombre": "Luna"},
            {"_id": second_pet_id, "usuario_id": user_id, "nombre": "Max"},
        ]
        schedule_records = [
            {
                "_id": ObjectId(),
                "mascota_id": first_pet_id,
                "hora": "08:00",
                "porcion_gramos": 35,
            },
            {
                "_id": ObjectId(),
                "mascota_id": second_pet_id,
                "hora": "09:00",
                "porcion_gramos": 40,
            },
        ]

        class Cursor:
            def __init__(self, records):
                self.records = records

            def sort(self, *args):
                self.sort_args = args
                return self

            async def to_list(self):
                return self.records

        schedules = SimpleNamespace(
            find=Mock(return_value=Cursor(schedule_records))
        )
        pets = SimpleNamespace(
            find=Mock(return_value=Cursor(pet_records))
        )
        recalculate = AsyncMock(side_effect=lambda *args: args[2])
        request = SimpleNamespace(
            app=SimpleNamespace(
                state=SimpleNamespace(
                    database=SimpleNamespace(
                        horarios_alimentacion=schedules,
                        mascotas=pets,
                    )
                )
            )
        )

        with (
            patch.object(
                main,
                "_authenticated_device",
                new=AsyncMock(return_value={"_id": ObjectId(user_id)}),
            ),
            patch.object(
                main,
                "_recalculate_feeding_schedule_portions",
                new=recalculate,
            ),
        ):
            result = await main.device_feeding_schedules(request, "device-token")

        pets.find.assert_called_once_with({"usuario_id": user_id}, unittest.mock.ANY)
        schedules.find.assert_called_once_with(
            {
                "activo": 1,
                "usuario_id": user_id,
                "mascota_id": {"$in": [first_pet_id, second_pet_id]},
            }
        )
        self.assertEqual(len(result["schedules"]), 2)
        self.assertEqual(
            {schedule["mascota_id"] for schedule in result["schedules"]},
            {str(first_pet_id), str(second_pet_id)},
        )
        self.assertEqual(recalculate.await_count, 2)

    async def test_unknown_device_token_is_rejected(self):
        users = SimpleNamespace(find_one=AsyncMock(return_value=None))
        request = SimpleNamespace(
            app=SimpleNamespace(
                state=SimpleNamespace(
                    database=SimpleNamespace(
                        usuarios=users,
                    )
                )
            )
        )

        with self.assertRaises(HTTPException) as error:
            await main._authenticated_device(request, "unknown-token")

        self.assertEqual(error.exception.status_code, 401)
        users.find_one.assert_awaited_once()
