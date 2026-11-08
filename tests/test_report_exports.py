import unittest
from io import BytesIO
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

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
        return self.records[:length]


class FakeCollection:
    def __init__(self, records=None, document=None):
        self.records = records or []
        self.document = document
        self.query = None
        self.inserted_document = None

    def find(self, query):
        self.query = query
        return FakeCursor(self.records)

    async def find_one(self, *_args):
        return self.document

    async def insert_one(self, document):
        self.inserted_document = document


class ReportExportTests(unittest.IsolatedAsyncioTestCase):
    async def test_export_saves_metadata_for_the_authenticated_users_pet(self):
        user_id = str(ObjectId())
        pet_id = ObjectId()
        feeding_record_id = ObjectId()
        pet = {"_id": pet_id, "nombre": "Luna"}
        history = FakeCollection(
            records=[{
                "_id": feeding_record_id,
                "fecha_hora": "2026-11-06 12:00:00",
                "porcion_entregada": 35,
                "tipo_dispensacion": "Alimento",
            }]
        )
        exports = FakeCollection()
        users = FakeCollection(document={"nombre": "Ana"})
        database = SimpleNamespace(
            historial_alimentacion=history,
            reportes_exportados=exports,
            usuarios=users,
        )
        request = SimpleNamespace(
            app=SimpleNamespace(state=SimpleNamespace(database=database))
        )
        html_generator = SimpleNamespace(write_pdf=lambda: b"%PDF-test")
        export_data = main.ReportExportInput(
            mascota_id=str(pet_id),
            tipo_reporte="Alimentación - Luna",
            nombre_archivo="../reporte Luna.pdf",
        )

        with (
            patch.object(main, "_owned_pet", new=AsyncMock(return_value=pet)),
            patch.object(main, "HTML", return_value=html_generator) as html_factory,
            patch.object(
                main,
                "_render_chart",
                side_effect=[BytesIO(b"daily-chart"), BytesIO(b"portion-chart")],
            ) as render_chart,
        ):
            response = await main.create_report_export(
                export_data,
                request,
                user_id,
            )

        self.assertEqual(
            history.query,
            {"usuario_id": user_id, "mascota_id": pet_id},
        )
        self.assertEqual(response.headers["content-type"], "application/pdf")
        self.assertEqual(
            response.headers["content-disposition"],
            'attachment; filename="reporte_Luna.pdf"',
        )
        self.assertEqual(exports.inserted_document["usuario_id"], user_id)
        self.assertEqual(exports.inserted_document["usuario_nombre"], "Ana")
        self.assertEqual(exports.inserted_document["mascota_id"], pet_id)
        self.assertEqual(exports.inserted_document["mascota_nombre"], "Luna")
        self.assertEqual(
            exports.inserted_document["tipo_reporte"],
            "Alimentación - Luna",
        )
        self.assertEqual(
            exports.inserted_document["registros_ids"],
            [feeding_record_id],
        )
        self.assertEqual(exports.inserted_document["cantidad_registros"], 1)
        self.assertEqual(exports.inserted_document["formato"], "pdf")
        self.assertIn("fecha_exportacion", exports.inserted_document)
        self.assertEqual(render_chart.call_count, 2)
        self.assertEqual(
            render_chart.call_args_list[0].args[1:],
            (main.ChartType.HISTOGRAM, "porcion_entregada"),
        )
        self.assertEqual(
            render_chart.call_args_list[1].args[1:],
            (main.ChartType.LINE, "porcion_entregada"),
        )
        chart_records = render_chart.call_args_list[0].args[0]
        self.assertEqual(chart_records[0]["fecha"], "2026-11-06 12:00:00")
        html_content = html_factory.call_args.kwargs["string"]
        self.assertIn("Estadísticas de alimentación", html_content)
        self.assertIn(".charts { width: 100%;", html_content)
        self.assertIn("max-height: 165px", html_content)
        self.assertNotIn(".charts { page-break-inside: avoid", html_content)
        self.assertEqual(html_content.count('<td class="chart">'), 2)
        self.assertIn("data:image/png;base64,ZGFpbHktY2hhcnQ=", html_content)
        self.assertIn("data:image/png;base64,cG9ydGlvbi1jaGFydA==", html_content)
        self.assertIn("Consumo diario de alimento de Luna", html_content)
        self.assertIn("Distribución de porciones de Luna", html_content)


class DeviceAlertTests(unittest.IsolatedAsyncioTestCase):
    async def test_device_feeding_saves_linked_alert_and_push_status(self):
        user_id = str(ObjectId())
        pet_id = ObjectId()
        schedule_id = ObjectId()
        feeding_id = ObjectId()
        alert_id = ObjectId()
        pet = {"_id": pet_id, "nombre": "Luna"}
        schedule = {
            "_id": schedule_id,
            "usuario_id": user_id,
            "mascota_id": pet_id,
        }
        history_collection = SimpleNamespace(
            find_one=AsyncMock(return_value=None),
            insert_one=AsyncMock(return_value=SimpleNamespace(inserted_id=feeding_id)),
            update_one=AsyncMock(),
        )
        alert_collection = SimpleNamespace(
            insert_one=AsyncMock(return_value=SimpleNamespace(inserted_id=alert_id)),
            update_one=AsyncMock(),
            find_one=AsyncMock(return_value=None),
        )
        schedule_collection = SimpleNamespace(
            find_one=AsyncMock(return_value=schedule)
        )
        user_collection = SimpleNamespace(
            find_one=AsyncMock(return_value={
                "_id": ObjectId(user_id),
                "language": "Español",
                "push_notifications": 1,
                "feeding_reminders": 1,
                "expo_push_tokens": [],
            })
        )
        pet_collection = SimpleNamespace(find_one=AsyncMock(return_value=pet))
        database = SimpleNamespace(
            historial_alimentacion=history_collection,
            alertas_dispositivo=alert_collection,
            horarios_alimentacion=schedule_collection,
            usuarios=user_collection,
            mascotas=pet_collection,
        )
        request = SimpleNamespace(
            app=SimpleNamespace(state=SimpleNamespace(database=database))
        )

        with patch.object(
            main,
            "_authenticated_device_user",
            new=AsyncMock(return_value={"_id": ObjectId(user_id)}),
        ):
            result = await main.record_device_feeding(
                main.DeviceFeedingEventInput(
                    evento_id="event-001",
                    horario_id=str(schedule_id),
                    porcion_entregada=35,
                ),
                request,
                "device-token",
            )

        alert = alert_collection.insert_one.await_args.args[0]
        self.assertEqual(result["alerta_id"], str(alert_id))
        self.assertEqual(result["push_status"], "no_registered_token")
        self.assertEqual(alert["usuario_id"], user_id)
        self.assertEqual(alert["mascota_id"], pet_id)
        self.assertEqual(alert["mascota_nombre"], "Luna")
        self.assertEqual(alert["evento_id"], "event-001")
        self.assertEqual(alert["registro_alimentacion_id"], feeding_id)
        self.assertEqual(alert["horario_id"], schedule_id)
        self.assertEqual(alert["porcion_entregada"], 35)
        self.assertEqual(alert["tipo"], "alimentacion")
        self.assertEqual(alert["origen"], "esp32")
        self.assertEqual(alert["leida"], 0)
        self.assertEqual(alert["push_status"], "no_registered_token")

        history_collection.find_one = AsyncMock(return_value={
            "_id": feeding_id,
            "mascota_id": pet_id,
            "usuario_id": user_id,
            "fecha_hora": alert["fecha_hora"].isoformat(timespec="seconds"),
            "push_status": "no_registered_token",
        })
        alert_collection.find_one = AsyncMock(return_value={"_id": alert_id})
        with patch.object(
            main,
            "_authenticated_device_user",
            new=AsyncMock(return_value={"_id": ObjectId(user_id)}),
        ):
            duplicate_result = await main.record_device_feeding(
                main.DeviceFeedingEventInput(
                    evento_id="event-001",
                    horario_id=str(schedule_id),
                    porcion_entregada=35,
                ),
                request,
                "device-token",
            )

        self.assertTrue(duplicate_result["duplicado"])
        self.assertEqual(duplicate_result["alerta_id"], str(alert_id))
        alert_collection.insert_one.assert_awaited_once()


if __name__ == "__main__":
    unittest.main()
