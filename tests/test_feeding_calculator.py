import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from bson import ObjectId
from fastapi import HTTPException

from backend import main
from backend.feeding import (
    MIN_FEEDING_INTERVAL_MINUTES,
    daily_portion_grams,
    distribute_daily_portion,
    find_schedule_conflict,
)


class ScheduleCursor:
    def __init__(self, records):
        self.records = records

    async def to_list(self, length=None):
        return self.records[:length]


class ScheduleCollection:
    def __init__(self, records):
        self.records = records
        self.query = None
        self.insert_one = AsyncMock()

    def find(self, query):
        self.query = query
        return ScheduleCursor(self.records)


class BatchScheduleCollection:
    def __init__(self, records=None):
        self.records = list(records or [])
        self.find_query = None
        self.insert_one = AsyncMock(side_effect=self._insert_one)
        self.delete_many = AsyncMock(side_effect=self._delete_many)

    async def _insert_one(self, record):
        inserted_id = ObjectId()
        self.records.append({**record, "_id": inserted_id})
        return SimpleNamespace(inserted_id=inserted_id)

    async def _delete_many(self, query):
        ids_to_delete = set(query["_id"]["$in"])
        original_count = len(self.records)
        self.records = [
            record for record in self.records if record["_id"] not in ids_to_delete
        ]
        return SimpleNamespace(deleted_count=original_count - len(self.records))

    def find(self, query):
        self.find_query = query
        return ScheduleCursor(self.records)


class DailyPortionTests(unittest.TestCase):
    def test_daily_portion_uses_species_size_and_weight(self):
        dog = {"especie": "Perro", "tamano": "Mediana", "peso": 10}
        cat = {"especie": "Gato", "tamano": "Mediana", "peso": 10}
        small_dog = {"especie": "Perro", "tamano": "Pequeña", "peso": 10}
        large_dog = {"especie": "Perro", "tamano": "Grande", "peso": 10}

        self.assertEqual(daily_portion_grams(dog), 240)
        self.assertEqual(daily_portion_grams(cat), 200)
        self.assertEqual(daily_portion_grams(small_dog), 300)
        self.assertEqual(daily_portion_grams(large_dog), 180)

    def test_daily_portion_uses_configurable_fallback_for_other_species(self):
        pet = {"especie": "Erizo", "tamano": "Pequeña", "peso": 2}

        self.assertEqual(daily_portion_grams(pet), 50)

    def test_veterinary_daily_portion_overrides_general_estimate(self):
        pet = {
            "especie": "Perro",
            "tamano": "Mediana",
            "peso": 10,
            "racion_diaria_veterinaria_gramos": 175.5,
        }

        self.assertEqual(daily_portion_grams(pet), 175.5)

    def test_veterinary_daily_portion_must_be_positive_and_finite(self):
        for value in (0, -1, float("inf"), float("nan")):
            with self.subTest(value=value):
                with self.assertRaises(ValueError):
                    daily_portion_grams(
                        {
                            "especie": "Perro",
                            "peso": 10,
                            "racion_diaria_veterinaria_gramos": value,
                        }
                    )

    def test_daily_portion_infers_size_for_legacy_pets_and_rejects_invalid_weight(self):
        self.assertEqual(
            daily_portion_grams({"especie": "Perro", "peso": 5}),
            150,
        )
        with self.assertRaises(ValueError):
            daily_portion_grams(
                {"especie": "Perro", "tamano": "Grande", "peso": 0}
            )

    def test_daily_portion_is_split_among_schedules_for_each_day(self):
        schedules = [
            {"repetir": "Lun, Mar"},
            {"repetir": "Lun"},
        ]

        result = distribute_daily_portion(schedules, 240)

        self.assertEqual(result[0]["gramos_por_dia"], {"Lun": 120, "Mar": 240})
        self.assertEqual(result[0]["porcion_gramos"], 180)
        self.assertEqual(result[1]["gramos_por_dia"], {"Lun": 120})

    def test_schedule_conflict_requires_minimum_interval_on_matching_days(self):
        schedules = [
            {"hora": "17:00", "repetir": "Lun, Mar", "mascota_id": "perro"},
        ]

        self.assertIsNotNone(
            find_schedule_conflict(
                schedules,
                {"hora": "17:59", "repetir": "Mar, Mié"},
            )
        )
        self.assertIsNone(
            find_schedule_conflict(
                schedules,
                {"hora": "18:00", "repetir": "Mar"},
            )
        )
        self.assertIsNone(
            find_schedule_conflict(
                schedules,
                {"hora": "17:59", "repetir": "Mié"},
            )
        )
        self.assertEqual(MIN_FEEDING_INTERVAL_MINUTES, 60)

    def test_schedule_without_repeating_days_conflicts_every_day(self):
        self.assertIsNotNone(
            find_schedule_conflict(
                [{"hora": "17:00", "repetir": ""}],
                {"hora": "17:30", "repetir": "Dom"},
            )
        )

    def test_schedule_interval_checks_across_midnight_and_week_boundary(self):
        self.assertIsNotNone(
            find_schedule_conflict(
                [{"hora": "23:30", "repetir": "Dom"}],
                {"hora": "00:29", "repetir": "Lun"},
            )
        )
        self.assertIsNone(
            find_schedule_conflict(
                [{"hora": "23:30", "repetir": "Dom"}],
                {"hora": "00:30", "repetir": "Lun"},
            )
        )


class FeedingScheduleValidationTests(unittest.IsolatedAsyncioTestCase):
    async def test_deletes_schedule_without_removing_its_database_record(self):
        user_id = str(ObjectId())
        schedule_id = ObjectId()
        pet_id = ObjectId()
        schedule = {
            "_id": schedule_id,
            "mascota_id": pet_id,
            "usuario_id": user_id,
            "activo": 1,
        }
        schedules = SimpleNamespace(
            find_one=AsyncMock(return_value=schedule),
            update_one=AsyncMock(return_value=SimpleNamespace(modified_count=1)),
        )
        database = SimpleNamespace(horarios_alimentacion=schedules)
        request = SimpleNamespace(app=SimpleNamespace(state=SimpleNamespace(database=database)))
        pet = {"_id": pet_id, "usuario_id": user_id, "nombre": "Luna"}

        with (
            patch.object(main, "_owned_pet", new=AsyncMock(return_value=pet)),
            patch.object(
                main,
                "_recalculate_feeding_schedule_portions",
                new=AsyncMock(return_value=[]),
            ) as recalculate,
        ):
            result = await main.delete_feeding_schedule(
                str(schedule_id), request, user_id
            )

        self.assertEqual(result, {"id": str(schedule_id), "activo": 0})
        schedules.find_one.assert_awaited_once_with(
            {"_id": schedule_id, "usuario_id": user_id, "activo": 1}
        )
        schedules.update_one.assert_awaited_once_with(
            {"_id": schedule_id, "usuario_id": user_id, "activo": 1},
            {"$set": {"activo": 0}},
        )
        recalculate.assert_awaited_once_with(database, pet)

    async def test_batch_accepts_one_or_three_meals(self):
        user_id = str(ObjectId())
        meal_slots = [
            main.FeedingScheduleSlotInput(momento_comida="Desayuno", hora="07:00"),
            main.FeedingScheduleSlotInput(momento_comida="Almuerzo", hora="12:00"),
            main.FeedingScheduleSlotInput(momento_comida="Merienda", hora="17:00"),
        ]

        for meal_count in (1, 3):
            with self.subTest(meal_count=meal_count):
                pet_id = ObjectId()
                pet = {
                    "_id": pet_id,
                    "nombre": "Luna",
                    "especie": "Perro",
                    "tamano": "Mediana",
                    "peso": 10,
                    "usuario_id": user_id,
                }
                schedules = BatchScheduleCollection()
                request = SimpleNamespace(
                    app=SimpleNamespace(
                        state=SimpleNamespace(
                            database=SimpleNamespace(
                                horarios_alimentacion=schedules
                            )
                        )
                    )
                )

                async def recalculate_portions(
                    database, _pet, schedules_to_update=None
                ):
                    return database.horarios_alimentacion.records

                with (
                    patch.object(main, "_owned_pet", new=AsyncMock(return_value=pet)),
                    patch.object(
                        main,
                        "_recalculate_feeding_schedule_portions",
                        new=AsyncMock(side_effect=recalculate_portions),
                    ),
                ):
                    result = await main.create_feeding_schedule_batch(
                        main.FeedingScheduleBatchInput(
                            mascota_id=str(pet_id),
                            repetir="Lun, Mié",
                            horarios=meal_slots[:meal_count],
                        ),
                        request,
                        user_id,
                    )

                self.assertEqual(len(result), meal_count)
                self.assertEqual(
                    [item["momento_comida"] for item in result],
                    [slot.momento_comida for slot in meal_slots[:meal_count]],
                )

    async def test_creates_multiple_meal_schedules_with_shared_days_and_portions(self):
        user_id = str(ObjectId())
        pet_id = ObjectId()
        pet = {
            "_id": pet_id,
            "nombre": "Luna",
            "especie": "Perro",
            "tamano": "Mediana",
            "peso": 10,
            "usuario_id": user_id,
        }
        schedules = BatchScheduleCollection()
        request = SimpleNamespace(
            app=SimpleNamespace(
                state=SimpleNamespace(
                    database=SimpleNamespace(horarios_alimentacion=schedules)
                )
            )
        )

        async def recalculate_portions(database, _pet, schedules_to_update=None):
            for schedule in database.horarios_alimentacion.records:
                schedule.update(
                    {
                        "porcion_diaria_gramos": 240,
                        "gramos_por_dia": {"Lun": 120, "Mié": 120},
                        "porcion_gramos": 120,
                    }
                )
            return database.horarios_alimentacion.records

        with (
            patch.object(main, "_owned_pet", new=AsyncMock(return_value=pet)),
            patch.object(
                main,
                "_recalculate_feeding_schedule_portions",
                new=AsyncMock(side_effect=recalculate_portions),
            ),
        ):
            result = await main.create_feeding_schedule_batch(
                main.FeedingScheduleBatchInput(
                    mascota_id=str(pet_id),
                    repetir="Lun, Mié",
                    horarios=[
                        main.FeedingScheduleSlotInput(
                            momento_comida="Desayuno",
                            hora="08:00",
                        ),
                        main.FeedingScheduleSlotInput(
                            momento_comida="Almuerzo",
                            hora="13:00",
                        ),
                    ],
                ),
                request,
                user_id,
            )

        self.assertEqual(len(result), 2)
        self.assertEqual(
            [item["momento_comida"] for item in result],
            ["Desayuno", "Almuerzo"],
        )
        self.assertEqual(result[0]["gramos_por_dia"], {"Lun": 120, "Mié": 120})
        self.assertTrue(all(item["mascota_nombre"] == "Luna" for item in result))
        self.assertEqual(schedules.find_query, {"usuario_id": user_id, "activo": 1})

    async def test_rejects_batch_when_two_selected_meals_are_too_close(self):
        user_id = str(ObjectId())
        pet_id = ObjectId()
        pet = {
            "_id": pet_id,
            "nombre": "Luna",
            "especie": "Perro",
            "tamano": "Mediana",
            "peso": 10,
            "usuario_id": user_id,
        }
        schedules = BatchScheduleCollection()
        request = SimpleNamespace(
            app=SimpleNamespace(
                state=SimpleNamespace(
                    database=SimpleNamespace(horarios_alimentacion=schedules)
                )
            )
        )

        with patch.object(main, "_owned_pet", new=AsyncMock(return_value=pet)):
            with self.assertRaises(HTTPException) as error:
                await main.create_feeding_schedule_batch(
                    main.FeedingScheduleBatchInput(
                        mascota_id=str(pet_id),
                        repetir="Lun",
                        horarios=[
                            main.FeedingScheduleSlotInput(
                                momento_comida="Desayuno",
                                hora="08:00",
                            ),
                            main.FeedingScheduleSlotInput(
                                momento_comida="Almuerzo",
                                hora="08:30",
                            ),
                        ],
                    ),
                    request,
                    user_id,
                )

        self.assertEqual(error.exception.status_code, 409)
        self.assertEqual(schedules.records, [])
        schedules.insert_one.assert_not_awaited()

    async def test_removes_batch_if_portion_recalculation_fails(self):
        user_id = str(ObjectId())
        pet_id = ObjectId()
        pet = {
            "_id": pet_id,
            "nombre": "Luna",
            "especie": "Perro",
            "tamano": "Mediana",
            "peso": 10,
            "usuario_id": user_id,
        }
        schedules = BatchScheduleCollection()
        request = SimpleNamespace(
            app=SimpleNamespace(
                state=SimpleNamespace(
                    database=SimpleNamespace(horarios_alimentacion=schedules)
                )
            )
        )

        recalculations = 0

        async def recalculate_portions(database, _pet, schedules_to_update=None):
            nonlocal recalculations
            recalculations += 1
            if recalculations == 1:
                raise HTTPException(status_code=422, detail="Invalid portion")
            return database.horarios_alimentacion.records

        with (
            patch.object(main, "_owned_pet", new=AsyncMock(return_value=pet)),
            patch.object(
                main,
                "_recalculate_feeding_schedule_portions",
                new=AsyncMock(side_effect=recalculate_portions),
            ),
        ):
            with self.assertRaises(HTTPException) as error:
                await main.create_feeding_schedule_batch(
                    main.FeedingScheduleBatchInput(
                        mascota_id=str(pet_id),
                        repetir="Lun",
                        horarios=[
                            main.FeedingScheduleSlotInput(
                                momento_comida="Desayuno",
                                hora="08:00",
                            ),
                        ],
                    ),
                    request,
                    user_id,
                )

        self.assertEqual(error.exception.status_code, 422)
        self.assertEqual(schedules.records, [])
        self.assertEqual(recalculations, 2)
        schedules.delete_many.assert_awaited_once()

    async def test_rejects_invalid_shared_days_without_creating_schedules(self):
        user_id = str(ObjectId())
        pet_id = ObjectId()
        pet = {
            "_id": pet_id,
            "nombre": "Luna",
            "especie": "Perro",
            "tamano": "Mediana",
            "peso": 10,
            "usuario_id": user_id,
        }
        schedules = BatchScheduleCollection()
        request = SimpleNamespace(
            app=SimpleNamespace(
                state=SimpleNamespace(
                    database=SimpleNamespace(horarios_alimentacion=schedules)
                )
            )
        )

        with patch.object(main, "_owned_pet", new=AsyncMock(return_value=pet)):
            with self.assertRaises(HTTPException) as error:
                await main.create_feeding_schedule_batch(
                    main.FeedingScheduleBatchInput(
                        mascota_id=str(pet_id),
                        repetir="Lun, Funday",
                        horarios=[
                            main.FeedingScheduleSlotInput(
                                momento_comida="Desayuno",
                                hora="08:00",
                            ),
                        ],
                    ),
                    request,
                    user_id,
                )

        self.assertEqual(error.exception.status_code, 422)
        schedules.insert_one.assert_not_awaited()

    async def test_rejects_overlapping_schedule_for_another_pet(self):
        user_id = str(ObjectId())
        pet_id = ObjectId()
        other_pet_id = ObjectId()
        schedules = ScheduleCollection(
            [{
                "hora": "17:00",
                "repetir": "Lun, Mié",
                "mascota_id": other_pet_id,
            }]
        )
        request = SimpleNamespace(
            app=SimpleNamespace(
                state=SimpleNamespace(
                    database=SimpleNamespace(horarios_alimentacion=schedules)
                )
            )
        )
        pet = {
            "_id": pet_id,
            "nombre": "Max",
            "especie": "Perro",
            "tamano": "Mediana",
            "peso": 10,
        }

        with patch.object(main, "_owned_pet", new=AsyncMock(return_value=pet)):
            with self.assertRaises(HTTPException) as error:
                await main.create_feeding_schedule(
                    main.FeedingScheduleInput(
                        mascota_id=str(pet_id),
                        hora="17:00",
                        repetir="Mié, Vie",
                    ),
                    request,
                    user_id,
                )

        self.assertEqual(error.exception.status_code, 409)
        self.assertEqual(
            schedules.query,
            {"usuario_id": user_id, "activo": 1},
        )
        schedules.insert_one.assert_not_awaited()
