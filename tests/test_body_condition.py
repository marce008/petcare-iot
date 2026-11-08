import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from bson import ObjectId
from fastapi import HTTPException

from backend import main


class BodyConditionCollection:
    def __init__(self, updated_pet):
        self.updated_pet = updated_pet
        self.update_one = AsyncMock()

    async def find_one(self, query):
        if query.get("_id") == self.updated_pet["_id"]:
            return dict(self.updated_pet)
        return None


class BodyConditionTests(unittest.IsolatedAsyncioTestCase):
    async def test_clears_previous_assessment_when_pet_weight_changes(self):
        user_id = str(ObjectId())
        pet_id = ObjectId()
        pet = {
            "_id": pet_id,
            "usuario_id": user_id,
            "especie": "Perro",
            "peso": 5.0,
            "condicion_corporal_puntaje": 5,
            "condicion_corporal_fecha": "2026-01-01T10:00:00+00:00",
        }
        pets = BodyConditionCollection(pet)
        database = SimpleNamespace(
            mascotas=pets,
            horarios_alimentacion=SimpleNamespace(find_one=AsyncMock(return_value=None)),
        )
        request = SimpleNamespace(app=SimpleNamespace(state=SimpleNamespace(database=database)))

        with patch.object(main, "_owned_pet", new=AsyncMock(return_value=pet)):
            await main.update_pet(
                str(pet_id), main.PetProfileImageInput(peso=6.0), request, user_id
            )

        pets.update_one.assert_awaited_once()
        update = pets.update_one.await_args.args[1]
        self.assertEqual(update["$set"], {"peso": 6.0})
        self.assertEqual(
            update["$unset"],
            {
                "condicion_corporal_puntaje": "",
                "condicion_corporal_fecha": "",
            },
        )

    async def test_recalculates_active_schedules_when_veterinary_ration_changes(self):
        user_id = str(ObjectId())
        pet_id = ObjectId()
        pet = {
            "_id": pet_id,
            "usuario_id": user_id,
            "nombre": "Luna",
            "especie": "Perro",
            "tamano": "Mediana",
            "peso": 10.0,
            "racion_diaria_veterinaria_gramos": 180.0,
        }
        pets = BodyConditionCollection(pet)
        async def apply_pet_update(_filter, update):
            pet.update(update.get("$set", {}))

        pets.update_one.side_effect = apply_pet_update
        database = SimpleNamespace(
            mascotas=pets,
            horarios_alimentacion=SimpleNamespace(
                find_one=AsyncMock(return_value={"_id": ObjectId()})
            ),
        )
        request = SimpleNamespace(app=SimpleNamespace(state=SimpleNamespace(database=database)))

        with (
            patch.object(main, "_owned_pet", new=AsyncMock(return_value=pet)),
            patch.object(main, "_recalculate_feeding_schedule_portions", new=AsyncMock()) as recalculate,
        ):
            await main.update_pet(
                str(pet_id),
                main.PetProfileImageInput(racion_diaria_veterinaria_gramos=165.0),
                request,
                user_id,
            )

        recalculate.assert_awaited_once()
        self.assertEqual(
            recalculate.await_args.args[1]["racion_diaria_veterinaria_gramos"],
            165.0,
        )

    async def test_saves_score_and_assessment_date_for_owned_dog(self):
        user_id = str(ObjectId())
        pet_id = ObjectId()
        pet = {"_id": pet_id, "usuario_id": user_id, "especie": "Perro"}
        pets = BodyConditionCollection(pet)
        request = SimpleNamespace(
            app=SimpleNamespace(state=SimpleNamespace(database=SimpleNamespace(mascotas=pets)))
        )

        with patch.object(main, "_owned_pet", new=AsyncMock(return_value=pet)):
            updated = await main.update_pet_body_condition(
                str(pet_id), main.BodyConditionInput(puntuacion=5), request, user_id
            )

        pets.update_one.assert_awaited_once()
        update = pets.update_one.await_args.args[1]["$set"]
        self.assertEqual(update["condicion_corporal_puntaje"], 5)
        self.assertTrue(update["condicion_corporal_fecha"])
        self.assertEqual(updated["id"], str(pet_id))

    async def test_rejects_unsupported_species(self):
        user_id = str(ObjectId())
        pet_id = ObjectId()
        pet = {"_id": pet_id, "usuario_id": user_id, "especie": "Conejo"}
        pets = BodyConditionCollection(pet)
        request = SimpleNamespace(
            app=SimpleNamespace(state=SimpleNamespace(database=SimpleNamespace(mascotas=pets)))
        )

        with patch.object(main, "_owned_pet", new=AsyncMock(return_value=pet)):
            with self.assertRaises(HTTPException) as error:
                await main.update_pet_body_condition(
                    str(pet_id), main.BodyConditionInput(puntuacion=5), request, user_id
                )

        self.assertEqual(error.exception.status_code, 422)
        pets.update_one.assert_not_awaited()
