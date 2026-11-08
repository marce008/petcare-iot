import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock

from bson import ObjectId
from fastapi import HTTPException

from backend import main


class VaccineCollection:
    def __init__(self, record):
        self.record = record
        self.update_one = AsyncMock()

    async def find_one(self, query):
        if query.get("_id") == self.record["_id"]:
            return dict(self.record)
        return None


class PetCollection:
    def __init__(self, pet, owner_id):
        self.pet = pet
        self.owner_id = owner_id

    async def find_one(self, query):
        if query.get("_id") == self.pet["_id"] and query.get("usuario_id") == self.owner_id:
            return dict(self.pet)
        return None


class VaccineUpdateTests(unittest.IsolatedAsyncioTestCase):
    async def test_updates_vaccine_fields_for_owned_pet(self):
        user_id = str(ObjectId())
        pet_id = ObjectId()
        vaccine_id = ObjectId()
        vaccine = {
            "_id": vaccine_id,
            "mascota_id": pet_id,
            "nombre_vacuna": "Rabia",
            "notas": "Nota anterior",
        }
        vaccines = VaccineCollection(vaccine)
        database = SimpleNamespace(
            vacunas=vaccines,
            mascotas=PetCollection(
                {"_id": pet_id, "usuario_id": user_id, "nombre": "Luna"},
                user_id,
            ),
        )
        request = SimpleNamespace(app=SimpleNamespace(state=SimpleNamespace(database=database)))

        updated = await main.update_vaccine(
            str(vaccine_id),
            main.VaccineUpdateInput(nombre_vacuna="DHPP", notas=None),
            request,
            user_id,
        )

        vaccines.update_one.assert_awaited_once_with(
            {"_id": vaccine_id, "mascota_id": pet_id},
            {"$set": {"nombre_vacuna": "DHPP", "notas": None}},
        )
        self.assertEqual(updated["nombre_vacuna"], "DHPP")
        self.assertIsNone(updated["notas"])
        self.assertEqual(updated["mascota_nombre"], "Luna")

    async def test_rejects_vaccine_when_pet_is_not_owned(self):
        user_id = str(ObjectId())
        pet_id = ObjectId()
        vaccine_id = ObjectId()
        vaccines = VaccineCollection(
            {"_id": vaccine_id, "mascota_id": pet_id, "nombre_vacuna": "Rabia"}
        )
        database = SimpleNamespace(
            vacunas=vaccines,
            mascotas=PetCollection(
                {"_id": pet_id, "usuario_id": str(ObjectId()), "nombre": "Luna"},
                str(ObjectId()),
            ),
        )
        request = SimpleNamespace(app=SimpleNamespace(state=SimpleNamespace(database=database)))

        with self.assertRaises(HTTPException) as error:
            await main.update_vaccine(
                str(vaccine_id),
                main.VaccineUpdateInput(nombre_vacuna="DHPP"),
                request,
                user_id,
            )

        self.assertEqual(error.exception.status_code, 404)
        vaccines.update_one.assert_not_awaited()
