import asyncio
import unittest
from datetime import datetime, timedelta
from types import SimpleNamespace
from unittest.mock import AsyncMock

from bson import ObjectId

from backend import main


class FakeCursor:
    def __init__(self, records):
        self.records = records

    def sort(self, *_args):
        return self

    def limit(self, _limit):
        return self

    async def to_list(self, length=None):
        return self.records if length is None else self.records[:length]


class FakeCollection:
    def __init__(self, records=None, document=None):
        self.records = records or []
        self.document = document

    def find(self, *_args):
        return FakeCursor(self.records)

    async def find_one(self, *_args):
        return self.document


class NotificationTests(unittest.TestCase):
    def test_converts_utc_feeding_time_to_ecuador_local_time(self):
        feeding_time = main._parse_notification_datetime(
            "2026-11-11T03:37:00+00:00"
        )

        self.assertIsNotNone(feeding_time)
        self.assertEqual(
            feeding_time.isoformat(timespec="minutes"),
            "2026-11-10T22:37-05:00",
        )

    def test_keeps_date_only_notification_on_local_calendar_day(self):
        notification_date = main._parse_notification_datetime("2026-11-11")

        self.assertIsNotNone(notification_date)
        self.assertEqual(
            notification_date.isoformat(timespec="minutes"),
            "2026-11-11T00:00-05:00",
        )

    def test_parses_appointment_in_saved_device_timezone(self):
        appointment = main._parse_appointment_datetime(
            "2026-06-15", "09:30", "America/Guayaquil"
        )

        self.assertIsNotNone(appointment)
        self.assertEqual(appointment.isoformat(), "2026-06-15T09:30:00-05:00")

    def test_lists_recent_feeding_vaccine_and_upcoming_appointments(self):
        user_id = str(ObjectId())
        pet_id = ObjectId()
        now = datetime.now().astimezone()
        upcoming_appointment = now + timedelta(days=1)
        later_appointment = now + timedelta(days=2)
        past_appointment = now - timedelta(days=1)
        database = SimpleNamespace(
            usuarios=FakeCollection(document={"language": "Español"}),
            mascotas=FakeCollection(records=[{"_id": pet_id, "nombre": "Luna"}]),
            historial_alimentacion=FakeCollection(
                records=[{
                    "_id": ObjectId(),
                    "mascota_id": pet_id,
                    "fecha_hora": (now - timedelta(hours=2)).isoformat(),
                    "porcion_entregada": 35,
                }]
            ),
            alertas_dispositivo=FakeCollection(),
            citas=FakeCollection(
                records=[
                    {
                        "_id": ObjectId(),
                        "mascota_id": pet_id,
                        "titulo": "Cita en dos días",
                        "fecha": later_appointment.strftime("%Y-%m-%d"),
                        "hora": later_appointment.strftime("%H:%M"),
                    },
                    {
                        "_id": ObjectId(),
                        "mascota_id": pet_id,
                        "titulo": "Control veterinario",
                        "fecha": upcoming_appointment.strftime("%Y-%m-%d"),
                        "hora": upcoming_appointment.strftime("%H:%M"),
                    },
                    {
                        "_id": ObjectId(),
                        "mascota_id": pet_id,
                        "titulo": "Cita pasada",
                        "fecha": past_appointment.strftime("%Y-%m-%d"),
                        "hora": past_appointment.strftime("%H:%M"),
                    },
                ]
            ),
            vacunas=FakeCollection(
                records=[{
                    "_id": ObjectId(),
                    "mascota_id": pet_id,
                    "nombre_vacuna": "Rabia",
                    "proxima_dosis": (now + timedelta(days=2)).isoformat(),
                }, {
                    "_id": ObjectId(),
                    "mascota_id": pet_id,
                    "nombre_vacuna": "Moquillo",
                    "proxima_dosis": (now + timedelta(days=3)).isoformat(),
                }]
            ),
        )
        request = SimpleNamespace(
            app=SimpleNamespace(state=SimpleNamespace(database=database))
        )

        notifications = asyncio.run(
            main.list_user_notifications(user_id, request, user_id)
        )

        sources = {notification["fuente"] for notification in notifications}
        self.assertEqual(sources, {"alimentacion", "vacuna", "cita"})
        appointment = next(
            notification for notification in notifications
            if notification["fuente"] == "cita"
        )
        self.assertEqual(appointment["tipo"], "cita")
        self.assertIn("Control veterinario", appointment["mensaje"])
        self.assertNotIn("Cita pasada", str(notifications))
        self.assertNotIn("Cita en dos días", str(notifications))
        vaccine = next(
            notification for notification in notifications
            if notification["fuente"] == "vacuna"
        )
        self.assertIn("Rabia", vaccine["mensaje"])
        self.assertNotIn("Moquillo", str(notifications))

    def test_reminder_day_matches_configured_days_before(self):
        target = datetime(2026, 6, 15, 9, 30)

        self.assertTrue(
            main._is_notification_day(
                target,
                target.date() - timedelta(days=1),
                days_before=1,
            )
        )
        self.assertFalse(
            main._is_notification_day(
                target,
                target.date() - timedelta(days=2),
                days_before=1,
            )
        )
        self.assertTrue(
            main._is_notification_day(
                target,
                target.date() - timedelta(days=2),
                days_before=2,
            )
        )
