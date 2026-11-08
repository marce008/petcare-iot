import base64
import asyncio
import os
import hashlib
import hmac
import json
import logging
import re
import secrets
import time
import urllib.error
import urllib.request
from contextlib import asynccontextmanager
from datetime import date, datetime, time as datetime_time, timedelta, timezone
from enum import Enum
from html import escape
from io import BytesIO
from pathlib import Path
from threading import Lock  
from typing import Any, AsyncIterator, Literal
import unicodedata
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

import matplotlib
matplotlib.use("Agg")
from matplotlib import pyplot as plt
import pandas as pd
import seaborn as sns
from dotenv import load_dotenv
from bson import ObjectId
from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, EmailStr, Field
from pymongo import AsyncMongoClient
from pymongo.errors import DuplicateKeyError, PyMongoError
from starlette.concurrency import run_in_threadpool
from starlette.responses import StreamingResponse
from weasyprint import HTML
from feeding import (
    MIN_FEEDING_INTERVAL_MINUTES,
    WEEK_DAYS,
    daily_portion_grams,
    distribute_daily_portion,
    find_schedule_conflict,
)

load_dotenv(Path(__file__).with_name(".env"))

MONGODB_URI = os.getenv("MONGO_URI")
if not MONGODB_URI:
    raise RuntimeError("La variable MONGO_URI debe configurarse.")
MONGODB_DATABASE = os.getenv("MONGODB_DATABASE", "petcare_iot")
TOKEN_SECRET = os.getenv("PETCARE_TOKEN_SECRET")
if not TOKEN_SECRET or not TOKEN_SECRET.strip():
    raise RuntimeError("La variable PETCARE_TOKEN_SECRET debe configurarse con una clave estable.")
ESP32_DEVICE_TOKEN = os.getenv("ESP32_DEVICE_TOKEN", "").strip()
ESP32_DEVICE_USER_EMAIL = os.getenv("ESP32_DEVICE_USER_EMAIL", "").strip().lower()
ABSTRACT_EMAIL_REPUTATION_API_KEY = (
    os.getenv("ABSTRACT_EMAIL_REPUTATION_API_KEY")
    or os.getenv("ABSTRACT_EMAIL_VALIDATION_API_KEY", "")
).strip()
TOKEN_LIFETIME_SECONDS = 60 * 60 * 12
PASSWORD_RESET_TOKEN_LIFETIME = timedelta(minutes=10)
PASSWORD_RESET_ATTEMPT_WINDOW = timedelta(minutes=15)
PASSWORD_RESET_MAX_ATTEMPTS = 5
COLLECTION_INDEXES = {
    "usuarios": [],
    "mascotas": [("usuario_id", 1)],
    "horarios_alimentacion": [("usuario_id", 1), ("mascota_id", 1)],
    "historial_alimentacion": [("usuario_id", 1), ("mascota_id", 1), ("fecha_hora", -1)],
    "vacunas": [("mascota_id", 1), ("proxima_dosis", 1)],
    "historial_medico": [("mascota_id", 1), ("fecha", -1)],
    "citas": [("mascota_id", 1), ("fecha", 1)],
    "alertas_dispositivo": [("usuario_id", 1), ("leida", 1), ("fecha_hora", -1)],
    "reportes_exportados": [("usuario_id", 1), ("fecha_exportacion", -1)],
}
COLLECTION_NAMES = tuple(COLLECTION_INDEXES)
bearer_scheme = HTTPBearer()
chart_lock = Lock()
logger = logging.getLogger(__name__)


class ChartType(str, Enum):
    HISTOGRAM = "histograma"
    BAR = "barras"
    LINE = "lineas"


class RegisterInput(BaseModel):
    nombre: str
    email: EmailStr
    password: str
    telefono: str | None = None


class LoginInput(BaseModel):
    email: EmailStr
    password: str


class PasswordResetRequestInput(BaseModel):
    email: EmailStr
    nombre: str = Field(min_length=1, max_length=200)


class PasswordResetConfirmInput(BaseModel):
    token: str = Field(min_length=32, max_length=256)
    password: str = Field(min_length=8, max_length=1024)


class PetInput(BaseModel):
    nombre: str
    especie: str
    raza: str | None = None
    tamano: Literal["Pequeña", "Mediana", "Grande"]
    fecha_nacimiento: str | None = None
    genero: str | None = None
    peso: float | None = None
    racion_diaria_veterinaria_gramos: float | None = Field(
        default=None, gt=0, allow_inf_nan=False
    )
    color_pelaje: str | None = None
    microchip_id: str | None = None
    notas: str | None = None
    foto_perfil: str | None = Field(default=None, max_length=7_000_000)


class AppointmentInput(BaseModel):
    mascota_id: str
    titulo: str
    fecha: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    hora: str = Field(pattern=r"^([01]\d|2[0-3]):([0-5]\d)$")
    zona_horaria: str | None = None
    lugar_veterinaria: str | None = None
    veterinario: str | None = None
    notas: str | None = None


class VaccineInput(BaseModel):
    mascota_id: str
    nombre_vacuna: str
    fecha_aplicacion: str | None = None
    proxima_dosis: str | None = None
    veterinario: str | None = None
    clinica: str | None = None
    numero_lote: str | None = None
    notas: str | None = None


class VaccineUpdateInput(BaseModel):
    nombre_vacuna: str | None = None
    fecha_aplicacion: str | None = None
    proxima_dosis: str | None = None
    veterinario: str | None = None
    clinica: str | None = None
    numero_lote: str | None = None
    notas: str | None = None


class FeedingScheduleInput(BaseModel):
    mascota_id: str
    hora: str
    tipo_comida: str | None = None
    tipo_alimento: str | None = None
    repetir: str | None = None
    notas: str | None = None


class FeedingScheduleSlotInput(BaseModel):
    momento_comida: Literal["Desayuno", "Almuerzo", "Merienda"]
    hora: str = Field(pattern=r"^([01]\d|2[0-3]):([0-5]\d)$")
    tipo_comida: str | None = None
    tipo_alimento: str | None = None
    notas: str | None = None


class FeedingScheduleBatchInput(BaseModel):
    mascota_id: str
    repetir: str
    horarios: list[FeedingScheduleSlotInput] = Field(min_length=1, max_length=3)


class FeedingHistoryInput(BaseModel):
    mascota_id: str
    porcion_entregada: float | None = None
    horario_id: str | None = None
    tipo_dispensacion: str


class ProfileInput(BaseModel):
    nombre: str
    email: EmailStr
    telefono: str | None = None
    ciudad: str | None = None
    biografia: str | None = None
    foto_perfil: str | None = Field(default=None, max_length=7_000_000)


class PetProfileImageInput(BaseModel):
    foto_perfil: str | None = Field(default=None, max_length=7_000_000)
    nombre: str | None = None
    especie: str | None = None
    raza: str | None = None
    tamano: Literal["Pequeña", "Mediana", "Grande"] | None = None
    fecha_nacimiento: str | None = None
    genero: str | None = None
    peso: float | None = None
    racion_diaria_veterinaria_gramos: float | None = Field(
        default=None, gt=0, allow_inf_nan=False
    )
    color_pelaje: str | None = None
    microchip_id: str | None = None
    notas: str | None = None


class BodyConditionInput(BaseModel):
    puntuacion: Literal[1, 2, 3, 4, 5, 6, 7, 8, 9]


class PushTokenInput(BaseModel):
    token: str = Field(min_length=10, max_length=512)


class DeviceFeedingEventInput(BaseModel):
    evento_id: str = Field(min_length=1, max_length=128)
    horario_id: str = Field(min_length=1, max_length=64)
    porcion_entregada: float = Field(gt=0)


def _send_expo_push(
    token: str,
    title: str,
    body: str,
    notification_data: dict[str, str],
) -> dict[str, Any]:
    payload = json.dumps(
        {
            "to": token,
            "title": title,
            "body": body,
            "sound": "default",
            "priority": "high",
            "channelId": "petcare-alerts",
            "data": notification_data,
        }
    ).encode()
    request = urllib.request.Request(
        "https://exp.host/--/api/v2/push/send",
        data=payload,
        headers={"Accept": "application/json", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=8) as response:
            result = json.loads(response.read())
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as error:
        return {"status": "error", "message": str(error)}
    ticket = result.get("data", {})
    if ticket.get("status") != "ok":
        return {"status": "error", "message": ticket.get("message", "Expo rechazó la notificación")}
    return {"status": "sent"}


class ReportExportInput(BaseModel):
    mascota_id: str = Field(min_length=1, max_length=64)
    tipo_reporte: str = Field(min_length=1, max_length=120)
    nombre_archivo: str = Field(min_length=1, max_length=180)


def _validate_email_deliverability(email: str) -> None:
    if not ABSTRACT_EMAIL_REPUTATION_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="La validación de correo no está configurada en el servidor. Configura ABSTRACT_EMAIL_REPUTATION_API_KEY en backend/.env y reinicia el backend.",
        )

    query = urllib.parse.urlencode({
        "api_key": ABSTRACT_EMAIL_REPUTATION_API_KEY,
        "email": email,
    })
    request = urllib.request.Request(
        f"https://emailreputation.abstractapi.com/v1/?{query}",
        headers={"Accept": "application/json"},
    )
    try:
        with urllib.request.urlopen(request, timeout=8) as response:
            result = json.loads(response.read())
    except urllib.error.HTTPError as error:
        if error.code in (401, 403):
            raise HTTPException(
                status_code=503,
                detail="Abstract API rechazó la clave de Email Reputation. Verifica que ABSTRACT_EMAIL_REPUTATION_API_KEY corresponda a ese producto, esté activa y reinicia el backend.",
            ) from error
        if error.code == 429 or error.code >= 500:
            raise HTTPException(
                status_code=503,
                detail="El servicio de validación de correo no está disponible.",
            ) from error
        raise HTTPException(
            status_code=503,
            detail="No se pudo completar la validación del correo.",
        ) from error
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as error:
        raise HTTPException(
            status_code=503,
            detail="No se pudo conectar con el servicio de validación de correo.",
        ) from error

    if not isinstance(result, dict) or result.get("error"):
        raise HTTPException(
            status_code=503,
            detail="El servicio de validación de correo devolvió una respuesta inválida.",
        )

    reputation_deliverability = result.get("deliverability")
    if isinstance(reputation_deliverability, str):
        is_deliverable = (
            reputation_deliverability.upper() == "DELIVERABLE"
            and result.get("is_valid_format") is True
            and result.get("is_mx_found") is True
            and result.get("is_smtp_valid") is True
            and result.get("is_disposable_email") is not True
        )
    else:
        deliverability = result.get("email_deliverability")
        if isinstance(deliverability, dict):
            is_deliverable = (
                deliverability.get("status") == "deliverable"
                and deliverability.get("is_format_valid") is True
                and deliverability.get("is_mx_valid") is True
                and deliverability.get("is_smtp_valid") is True
            )
            quality = result.get("email_quality")
            if isinstance(quality, dict) and quality.get("is_disposable") is True:
                is_deliverable = False
        else:
            def result_value(field: str) -> bool:
                value = result.get(field)
                return value.get("value") is True if isinstance(value, dict) else False

            is_deliverable = all(
                result_value(field)
                for field in ("is_valid_format", "is_mx_found", "is_smtp_valid")
            ) and not result_value("is_disposable")

    if not is_deliverable:
        raise HTTPException(
            status_code=422,
            detail="El correo no parece ser una dirección real y entregable. Revisa la dirección e intenta de nuevo.",
        )


def _encode_token(user_id: str) -> str:
    payload = base64.urlsafe_b64encode(
        json.dumps({"sub": user_id, "exp": int(time.time()) + TOKEN_LIFETIME_SECONDS}).encode()
    ).decode().rstrip("=")
    signature = hmac.new(TOKEN_SECRET.encode(), payload.encode(), hashlib.sha256).digest()
    encoded_signature = base64.urlsafe_b64encode(signature).decode().rstrip("=")
    return f"{payload}.{encoded_signature}"


def _decode_token(token: str) -> str:
    try:
        payload, signature = token.split(".", 1)
        expected_signature = base64.urlsafe_b64encode(
            hmac.new(TOKEN_SECRET.encode(), payload.encode(), hashlib.sha256).digest()
        ).decode().rstrip("=")
        if not hmac.compare_digest(signature, expected_signature):
            raise ValueError("Invalid token signature")
        claims = json.loads(base64.urlsafe_b64decode(payload + "=" * (-len(payload) % 4)))
        if int(claims["exp"]) < int(time.time()):
            raise ValueError("Expired token")
        user_id = claims["sub"]
        if not ObjectId.is_valid(user_id):
            raise ValueError("Invalid user id")
        return user_id
    except (ValueError, KeyError, TypeError, json.JSONDecodeError) as error:
        raise HTTPException(status_code=401, detail="Sesión inválida o expirada") from error


async def current_user_id(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> str:
    return _decode_token(credentials.credentials)


def _password_hash(password: str, salt: bytes | None = None) -> str:
    if len(password) < 8:
        raise HTTPException(status_code=422, detail="La contraseña debe tener al menos 8 caracteres")
    salt = salt or secrets.token_bytes(16)
    derived = hashlib.scrypt(password.encode(), salt=salt, n=2**14, r=8, p=1)
    return f"{base64.b64encode(salt).decode()}:{base64.b64encode(derived).decode()}"


def _password_matches(password: str, stored: str) -> bool:
    try:
        salt_text, hash_text = stored.split(":", 1)
        derived = hashlib.scrypt(
            password.encode(), salt=base64.b64decode(salt_text), n=2**14, r=8, p=1
        )
        expected = base64.b64encode(derived).decode()
        return hmac.compare_digest(expected, hash_text)
    except (ValueError, TypeError, UnicodeEncodeError):
        return False


def _normalize_account_name(name: str) -> str:
    normalized = unicodedata.normalize("NFKC", " ".join(name.split()))
    return normalized.casefold()


def _password_reset_attempt_key(email: str, remote_ip: str) -> str:
    value = f"{email}\0{remote_ip}".encode()
    return hmac.new(TOKEN_SECRET.encode(), value, hashlib.sha256).hexdigest()


async def _check_password_reset_attempt_limit(
    request: Request,
    email: str,
) -> None:
    now = datetime.now(timezone.utc)
    bucket = request.app.state.database["password_reset_attempts"]
    key = _password_reset_attempt_key(
        email,
        request.client.host if request.client else "unknown",
    )
    await bucket.update_one(
        {"_id": key},
        [
            {
                "$set": {
                    "attempts": {
                        "$cond": [
                            {"$gt": ["$expires_at", now]},
                            {"$add": [{"$ifNull": ["$attempts", 0]}, 1]},
                            1,
                        ]
                    },
                    "expires_at": {
                        "$cond": [
                            {"$gt": ["$expires_at", now]},
                            "$expires_at",
                            now + PASSWORD_RESET_ATTEMPT_WINDOW,
                        ]
                    },
                }
            }
        ],
        upsert=True,
    )
    attempts = await bucket.find_one({"_id": key}, {"attempts": 1})
    if attempts and attempts.get("attempts", 0) > PASSWORD_RESET_MAX_ATTEMPTS:
        raise HTTPException(
            status_code=429,
            detail="Demasiados intentos. Espera 15 minutos e inténtalo de nuevo.",
        )


def _public_user(user: dict[str, Any]) -> dict[str, str]:
    return {"id": str(user["_id"]), "nombre": user["nombre"], "email": user["email"]}


def _serialize(document: dict[str, Any]) -> dict[str, Any]:
    document["id"] = str(document.pop("_id"))
    return document


def _parse_notification_datetime(value: Any) -> datetime | None:
    if isinstance(value, datetime):
        parsed = value
    elif isinstance(value, str):
        try:
            parsed = datetime.fromisoformat(value.strip().replace("Z", "+00:00"))
        except ValueError:
            return None
    else:
        return None

    if parsed.tzinfo is None:
        return parsed.astimezone()
    return parsed.astimezone()


def _parse_appointment_datetime(
    date_value: Any, time_value: Any, timezone_name: str | None
) -> datetime | None:
    if isinstance(date_value, datetime):
        date_value = date_value.date().isoformat()
    if not isinstance(date_value, str) or not isinstance(time_value, str):
        return None

    try:
        local_datetime = datetime.combine(
            date.fromisoformat(date_value),
            datetime_time.fromisoformat(time_value),
        )
    except ValueError:
        return None

    if timezone_name:
        try:
            return local_datetime.replace(tzinfo=ZoneInfo(timezone_name))
        except ZoneInfoNotFoundError:
            return None
    return _parse_notification_datetime(local_datetime)


def _is_notification_day(target: datetime, current_date: date, days_before: int) -> bool:
    return (target.date() - current_date).days == days_before


async def _owned_pet(database: Any, pet_id: str, user_id: str) -> dict[str, Any]:
    if not ObjectId.is_valid(pet_id):
        raise HTTPException(status_code=422, detail="Identificador de mascota inválido")
    pet = await database.mascotas.find_one({"_id": ObjectId(pet_id), "usuario_id": user_id})
    if not pet:
        raise HTTPException(status_code=404, detail="Mascota no encontrada")
    return pet


async def _recalculate_feeding_schedule_portions(
    database: Any, pet: dict[str, Any], schedules: list[dict[str, Any]] | None = None
) -> list[dict[str, Any]]:
    try:
        daily_grams = daily_portion_grams(pet)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error

    if schedules is None:
        schedules = await database.horarios_alimentacion.find(
            {
                "usuario_id": pet["usuario_id"],
                "mascota_id": pet["_id"],
                "activo": 1,
            }
        ).to_list()

    calculated_portions = distribute_daily_portion(schedules, daily_grams)
    for schedule, portion in zip(schedules, calculated_portions):
        schedule.update(portion)
        if schedule.get("_id") is not None:
            await database.horarios_alimentacion.update_one(
                {"_id": schedule["_id"]},
                {"$set": portion},
            )
    return schedules


async def _list_pet_records(database: Any, collection: str, user_id: str) -> list[dict[str, Any]]:
    pets = await database.mascotas.find({"usuario_id": user_id}, {"_id": 1}).to_list()
    pet_ids = [pet["_id"] for pet in pets]
    records = await database[collection].find({"mascota_id": {"$in": pet_ids}}).to_list()
    pet_names = {
        str(pet["_id"]): pet["nombre"]
        for pet in await database.mascotas.find({"_id": {"$in": pet_ids}}, {"nombre": 1}).to_list()
    }
    for record in records:
        record["mascota_nombre"] = pet_names.get(str(record.get("mascota_id")), "")
        record["mascota_id"] = str(record["mascota_id"])
    return [_serialize(record) for record in records]


def _render_chart(
    records: list[dict[str, Any]],
    chart_type: ChartType,
    field: str,
) -> BytesIO:
    # Matplotlib usa estado compartido; el bloqueo evita interferencias entre solicitudes.
    with chart_lock:
        dataframe = pd.DataFrame(records)
        figure, axis = plt.subplots(figsize=(8, 4.5), facecolor="#FFFFFF")
        figure.patch.set_facecolor("#FFFFFF")
        axis.set_facecolor("white")

        try:
            if chart_type == ChartType.HISTOGRAM:
                raw_values = (
                    dataframe[field]
                    if field in dataframe
                    else pd.Series(dtype="float64")
                )
                values = pd.to_numeric(raw_values, errors="coerce").dropna()

                if values.empty:
                    raise HTTPException(
                        status_code=422,
                        detail="No hay porciones numéricas para mostrar.",
                    )

                sns.histplot(
                    x=values,
                    bins="auto",
                    kde=len(values) > 1,
                    color="#22C55E",
                    edgecolor="#16A34A",
                    alpha=0.85,
                    line_kws={
                        "color": "#16A34A",
                        "linewidth": 2,
                    },
                    ax=axis,
                )
                axis.set(
                    xlabel="Porción servida (g)",
                    ylabel="Cantidad de registros",
                )
                axis.set_title("Distribución de porciones")

            elif chart_type == ChartType.BAR:
                raw_values = (
                    dataframe[field]
                    if field in dataframe
                    else pd.Series(dtype="object")
                )
                counts = (
                    raw_values.dropna()
                    .astype(str)
                    .value_counts()
                    .head(20)
                )

                if counts.empty:
                    raise HTTPException(
                        status_code=422,
                        detail="No hay mascotas con registros de alimentación.",
                    )

                sns.barplot(
                    x=counts.index,
                    y=counts.values,
                    color="#2E7D32",
                    edgecolor="#1B5E20",
                    linewidth=0.8,
                    ax=axis,
                )
                axis.set(
                    xlabel="Mascota",
                    ylabel="Registros de alimentación",
                )
                axis.set_title("Alimentaciones por mascota")
                axis.tick_params(axis="x", labelrotation=25)

            else:
                raw_dates = (
                    dataframe["fecha"]
                    if "fecha" in dataframe
                    else pd.Series(dtype="object")
                )
                raw_values = (
                    dataframe[field]
                    if field in dataframe
                    else pd.Series(dtype="float64")
                )

                dates = pd.to_datetime(
                    raw_dates,
                    errors="coerce",
                    utc=True,
                )
                values = pd.to_numeric(raw_values, errors="coerce")
                trend = pd.DataFrame({
                    "fecha": dates,
                    field: values,
                }).dropna()

                if trend.empty:
                    raise HTTPException(
                        status_code=422,
                        detail="No hay fechas y porciones para mostrar.",
                    )

                trend["fecha"] = trend["fecha"].dt.date
                trend = (
                    trend.groupby("fecha", as_index=False)[field]
                    .sum()
                    .sort_values("fecha")
                )

                axis.fill_between(
                    trend["fecha"],
                    trend[field],
                    color="#DCFCE7",
                    alpha=0.8,
                )
                sns.lineplot(
                    data=trend,
                    x="fecha",
                    y=field,
                    marker="o",
                    color="#22C55E",
                    linewidth=2.5,
                    markersize=7,
                    markerfacecolor="#22C55E",
                    markeredgecolor="#FFFFFF",
                    markeredgewidth=1.5,
                    ax=axis,
                )
                axis.set(
                    xlabel="Fecha",
                    ylabel="Consumo total (g)",
                )
                axis.set_title("Consumo diario de alimento")
                axis.tick_params(axis="x", labelrotation=25)

            axis.set_axisbelow(True)
            axis.grid(
                axis="y",
                linestyle=":",
                linewidth=0.8,
                color="#E5E7EB",
            )
            axis.grid(axis="x", visible=False)

            axis.spines["top"].set_visible(False)
            axis.spines["right"].set_visible(False)
            axis.spines["left"].set_color("#E5E7EB")
            axis.spines["bottom"].set_color("#E5E7EB")

            axis.tick_params(axis="both", colors="#6B7280", labelsize=9)
            axis.xaxis.label.set_color("#6B7280")
            axis.yaxis.label.set_color("#6B7280")
            axis.xaxis.label.set_size(9)
            axis.yaxis.label.set_size(9)
            axis.title.set_color("#111827")
            axis.title.set_size(11)
            axis.title.set_weight("bold")

            figure.tight_layout()
            image = BytesIO()
            figure.savefig(
                image,
                format="png",
                dpi=140,
                facecolor="#FFFFFF",
            )
            image.seek(0)
            return image
        finally:
            plt.close(figure)

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    client = AsyncMongoClient(MONGODB_URI, serverSelectionTimeoutMS=5000)
    try:
        await client.admin.command({"ping": 1})
    except PyMongoError:
        await client.close()
        raise

    app.state.mongo_client = client
    app.state.database = client[MONGODB_DATABASE]
    try:
        existing_collections = set(await app.state.database.list_collection_names())
        for collection_name in COLLECTION_NAMES:
            if collection_name not in existing_collections:
                await app.state.database.create_collection(collection_name)

        await app.state.database["usuarios"].create_index("email", unique=True, sparse=True)
        for collection_name, indexes in COLLECTION_INDEXES.items():
            for index in indexes:
                await app.state.database[collection_name].create_index([index])
        await app.state.database["historial_alimentacion"].create_index(
            "evento_id", unique=True, sparse=True
        )
        await app.state.database["alertas_dispositivo"].create_index(
            "evento_id", unique=True, sparse=True
        )
        await app.state.database["password_reset_attempts"].create_index(
            "expires_at", expireAfterSeconds=0
        )
        yield
    finally:
        await client.close()


app = FastAPI(title="PetCare API", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root() -> dict[str, str]:
    return {"message": "PetCare API"}


@app.get("/health")
async def health(request: Request) -> dict[str, str | list[str]]:
    try:
        await request.app.state.database.command({"ping": 1})
        collections = sorted(await request.app.state.database.list_collection_names())
    except PyMongoError as error:
        raise HTTPException(status_code=503, detail="MongoDB is unavailable") from error

    return {
        "status": "ok",
        "database": "connected",
        "collections": collections,
    }


@app.post("/auth/register")
async def register(data: RegisterInput, request: Request) -> dict[str, Any]:
    database = request.app.state.database
    email = str(data.email).lower()
    if await database.usuarios.find_one({"email": email}, {"_id": 1}):
        raise HTTPException(status_code=409, detail="El correo electrónico ya está registrado")
    await run_in_threadpool(_validate_email_deliverability, email)
    user = {
        "nombre": data.nombre.strip(),
        "email": email,
        "password_hash": _password_hash(data.password),
        "telefono": data.telefono,
        "push_notifications": 1,
        "email_notifications": 1,
        "feeding_reminders": 1,
        "vaccine_reminders": 1,
        "appointment_reminders": 1,
        "dark_mode": 0,
        "biometric_access": 0,
        "auto_sync": 1,
        "language": "Español",
        "units": "Métrico (kg)",
        "date_format": "DD/MM/AAAA",
    }
    try:
        result = await database.usuarios.insert_one(user)
    except DuplicateKeyError as error:
        raise HTTPException(
            status_code=409,
            detail="El correo electrónico ya está registrado",
        ) from error
    user["_id"] = result.inserted_id
    return {"access_token": _encode_token(str(result.inserted_id)), "user": _public_user(user)}


@app.post("/auth/login")
async def login(data: LoginInput, request: Request) -> dict[str, Any]:
    user = await request.app.state.database.usuarios.find_one({"email": str(data.email).lower()})
    if not user or not _password_matches(data.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Correo o contraseña incorrectos")
    return {"access_token": _encode_token(str(user["_id"])), "user": _public_user(user)}


@app.post("/auth/password-reset/request", status_code=202)
async def request_password_reset(
    data: PasswordResetRequestInput,
    request: Request,
) -> dict[str, str]:
    database = request.app.state.database
    email = str(data.email).lower()
    await _check_password_reset_attempt_limit(request, email)
    user = await database.usuarios.find_one(
        {"email": email},
        {"_id": 1, "nombre": 1},
    )
    if not user:
        raise HTTPException(
            status_code=400,
            detail="El correo y el nombre completo no coinciden con una cuenta.",
        )
    stored_name = _normalize_account_name(user.get("nombre", ""))
    submitted_name = _normalize_account_name(data.nombre)
    if not hmac.compare_digest(stored_name.encode(), submitted_name.encode()):
        raise HTTPException(
            status_code=400,
            detail="El correo y el nombre completo no coinciden con una cuenta.",
        )

    now = datetime.now(timezone.utc)
    raw_token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
    await database.usuarios.update_one(
        {"_id": user["_id"]},
        {
            "$set": {
                "password_reset_token_hash": token_hash,
                "password_reset_expires_at": now + PASSWORD_RESET_TOKEN_LIFETIME,
            },
            "$unset": {"password_reset_requested_at": ""},
        },
    )
    return {
        "reset_token": raw_token,
        "message": "Los datos coinciden. Elige una contraseña nueva.",
    }


@app.post("/auth/password-reset/confirm")
async def confirm_password_reset(
    data: PasswordResetConfirmInput,
    request: Request,
) -> dict[str, str]:
    database = request.app.state.database
    token_hash = hashlib.sha256(data.token.encode()).hexdigest()
    now = datetime.now(timezone.utc)
    token_query = {
        "password_reset_token_hash": token_hash,
        "password_reset_expires_at": {"$gt": now},
    }
    user = await database.usuarios.find_one(token_query, {"_id": 1})
    if not user:
        raise HTTPException(
            status_code=400,
            detail="El código temporal no es válido o ya venció. Verifica tus datos de nuevo.",
        )

    password_hash = _password_hash(data.password)
    updated_user = await database.usuarios.find_one_and_update(
        {"_id": user["_id"], **token_query},
        {
            "$set": {
                "password_hash": password_hash,
                "password_changed_at": now,
            },
            "$unset": {
                "password_reset_token_hash": "",
                "password_reset_expires_at": "",
            },
        },
    )
    if not updated_user:
        raise HTTPException(
            status_code=400,
            detail="El código temporal no es válido o ya venció. Verifica tus datos de nuevo.",
        )

    return {"message": "La contraseña se restableció correctamente. Ya puedes iniciar sesión."}


@app.get("/profile")
async def get_profile(request: Request, user_id: str = Depends(current_user_id)) -> dict[str, Any]:
    user = await request.app.state.database.usuarios.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    user.pop("password_hash", None)
    return _serialize(user)


@app.patch("/profile")
async def update_profile(
    data: ProfileInput,
    request: Request,
    user_id: str = Depends(current_user_id),
) -> dict[str, str]:
    database = request.app.state.database
    object_id = ObjectId(user_id)
    current_user = await database.usuarios.find_one({"_id": object_id})
    if not current_user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    email = str(data.email).lower()
    duplicate = await database.usuarios.find_one(
        {"email": email, "_id": {"$ne": ObjectId(user_id)}}, {"_id": 1}
    )
    if duplicate:
        raise HTTPException(status_code=409, detail="El correo ya está en uso")
    await database.usuarios.update_one(
        {"_id": object_id},
        {
            "$set": {**data.model_dump(), "email": email},
            "$unset": {
                "telefono_verificado": "",
                "phone_verification_pending": "",
                "phone_verification_sent_at": "",
            },
        },
    )
    user = await database.usuarios.find_one({"_id": object_id})
    return _public_user(user)


@app.patch("/settings")
async def update_settings(
    settings: dict[str, Any],
    request: Request,
    user_id: str = Depends(current_user_id),
) -> dict[str, bool]:
    allowed = {
        "push_notifications", "email_notifications", "feeding_reminders",
        "vaccine_reminders", "appointment_reminders", "dark_mode",
        "biometric_access", "auto_sync", "language", "units", "date_format",
    }
    if not settings or not set(settings).issubset(allowed):
        raise HTTPException(status_code=422, detail="Configuración inválida")
    await request.app.state.database.usuarios.update_one(
        {"_id": ObjectId(user_id)}, {"$set": settings}
    )
    return {"updated": True}


@app.post("/notifications/push-token")
async def register_push_token(
    data: PushTokenInput,
    request: Request,
    user_id: str = Depends(current_user_id),
) -> dict[str, bool]:
    if not data.token.startswith(("ExponentPushToken[", "ExpoPushToken[")):
        raise HTTPException(status_code=422, detail="El token push de Expo no es válido")
    await request.app.state.database.usuarios.update_one(
        {"_id": ObjectId(user_id)},
        {"$addToSet": {"expo_push_tokens": data.token}},
    )
    return {"registered": True}


@app.get("/pets")
async def list_pets(
    request: Request, user_id: str = Depends(current_user_id)
) -> list[dict[str, Any]]:
    pets = await request.app.state.database.mascotas.find({"usuario_id": user_id}).sort("nombre", 1).to_list()
    for pet in pets:
        try:
            pet["porcion_diaria_estimada_gramos"] = daily_portion_grams(pet)
        except ValueError:
            pet["porcion_diaria_estimada_gramos"] = None
    return [_serialize(pet) for pet in pets]


@app.post("/pets", status_code=201)
async def create_pet(
    data: PetInput,
    request: Request,
    user_id: str = Depends(current_user_id),
) -> dict[str, Any]:
    pet = data.model_dump()
    pet.update({"usuario_id": user_id, "creado_en": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())})
    result = await request.app.state.database.mascotas.insert_one(pet)
    pet["_id"] = result.inserted_id
    return _serialize(pet)


@app.patch("/pets/{pet_id}")
async def update_pet(
    pet_id: str,
    data: PetProfileImageInput,
    request: Request,
    user_id: str = Depends(current_user_id),
) -> dict[str, Any]:
    database = request.app.state.database
    pet = await _owned_pet(database, pet_id, user_id)
    updates = data.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(status_code=422, detail="No hay datos de mascota para actualizar")
    if "nombre" in updates and not (updates["nombre"] or "").strip():
        raise HTTPException(status_code=422, detail="El nombre de la mascota es obligatorio")
    if "especie" in updates and not (updates["especie"] or "").strip():
        raise HTTPException(status_code=422, detail="La especie de la mascota es obligatoria")
    if "peso" in updates and updates["peso"] is not None and updates["peso"] <= 0:
        raise HTTPException(status_code=422, detail="El peso debe ser mayor que cero")
    recalculate_portions = False
    if {"peso", "tamano", "especie", "racion_diaria_veterinaria_gramos"} & updates.keys():
        active_schedule = await database.horarios_alimentacion.find_one(
            {
                "usuario_id": user_id,
                "mascota_id": pet["_id"],
                "activo": 1,
            },
            {"_id": 1},
        )
        recalculate_portions = active_schedule is not None
        if recalculate_portions:
            try:
                daily_portion_grams({**pet, **updates})
            except ValueError as error:
                raise HTTPException(status_code=422, detail=str(error)) from error
    update_operation: dict[str, Any] = {"$set": updates}
    if {"peso", "tamano", "especie"} & updates.keys():
        update_operation["$unset"] = {
            "condicion_corporal_puntaje": "",
            "condicion_corporal_fecha": "",
        }
    await database.mascotas.update_one(
        {"_id": pet["_id"], "usuario_id": user_id},
        update_operation,
    )
    updated_pet = await database.mascotas.find_one(
        {"_id": pet["_id"], "usuario_id": user_id}
    )
    if recalculate_portions:
        await _recalculate_feeding_schedule_portions(database, updated_pet)
    return _serialize(updated_pet)


@app.patch("/pets/{pet_id}/body-condition")
async def update_pet_body_condition(
    pet_id: str,
    data: BodyConditionInput,
    request: Request,
    user_id: str = Depends(current_user_id),
) -> dict[str, Any]:
    database = request.app.state.database
    pet = await _owned_pet(database, pet_id, user_id)
    if (pet.get("especie") or "").strip().lower() not in {"perro", "gato"}:
        raise HTTPException(
            status_code=422,
            detail="La evaluación orientativa está disponible para perros y gatos.",
        )

    await database.mascotas.update_one(
        {"_id": pet["_id"], "usuario_id": user_id},
        {
            "$set": {
                "condicion_corporal_puntaje": data.puntuacion,
                "condicion_corporal_fecha": datetime.now().astimezone().isoformat(timespec="seconds"),
            }
        },
    )
    updated_pet = await database.mascotas.find_one(
        {"_id": pet["_id"], "usuario_id": user_id}
    )
    return _serialize(updated_pet)


@app.delete("/pets/{pet_id}")
async def delete_pet(
    pet_id: str,
    request: Request,
    user_id: str = Depends(current_user_id),
) -> dict[str, int]:
    database = request.app.state.database
    pet = await _owned_pet(database, pet_id, user_id)
    pet_filter = {"mascota_id": pet["_id"]}
    deleted = {"mascota": 0}
    for collection_name in (
        "horarios_alimentacion",
        "historial_alimentacion",
        "vacunas",
        "historial_medico",
        "citas",
        "alertas_dispositivo",
    ):
        result = await database[collection_name].delete_many(pet_filter)
        deleted[collection_name] = result.deleted_count
    result = await database.mascotas.delete_one(
        {"_id": pet["_id"], "usuario_id": user_id}
    )
    deleted["mascota"] = result.deleted_count
    return deleted


async def _authenticated_device_user(
    request: Request, candidate: str | None
) -> dict[str, Any]:
    if not ESP32_DEVICE_TOKEN or not ESP32_DEVICE_USER_EMAIL:
        raise HTTPException(
            status_code=503,
            detail="El acceso del dispensador no está configurado en el servidor.",
        )
    if not candidate or not hmac.compare_digest(
        candidate.encode("utf-8"), ESP32_DEVICE_TOKEN.encode("utf-8")
    ):
        raise HTTPException(
            status_code=401, detail="Credenciales del dispositivo inválidas"
        )

    user = await request.app.state.database.usuarios.find_one(
        {"email": ESP32_DEVICE_USER_EMAIL}
    )
    if not user:
        raise HTTPException(
            status_code=503,
            detail="La cuenta asociada al dispensador no está disponible.",
        )
    return user


@app.post("/pets/{pet_id}/device-token")
async def create_pet_device_token(
    pet_id: str,
    request: Request,
    user_id: str = Depends(current_user_id),
) -> dict[str, str]:
    database = request.app.state.database
    pet = await _owned_pet(database, pet_id, user_id)
    device_token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(device_token.encode()).hexdigest()
    await database.mascotas.update_one(
        {"_id": pet["_id"], "usuario_id": user_id},
        {"$set": {"device_token_hash": token_hash}},
    )
    return {"device_token": device_token}


@app.get("/device/feeding/schedules")
async def device_feeding_schedules(
    request: Request,
    device_token: str | None = Header(default=None, alias="X-Device-Token"),
) -> dict[str, Any]:
    database = request.app.state.database
    user = await _authenticated_device_user(request, device_token)
    user_id = str(user["_id"])
    schedules = await database.horarios_alimentacion.find(
        {
            "activo": 1,
            "usuario_id": user_id,
        }
    ).sort("hora", 1).to_list()
    pets = await database.mascotas.find(
        {"usuario_id": user_id},
        {
            "nombre": 1,
            "especie": 1,
            "raza": 1,
            "peso": 1,
            "tamano": 1,
            "racion_diaria_veterinaria_gramos": 1,
            "usuario_id": 1,
        },
    ).to_list()
    pet_map = {str(pet["_id"]): pet for pet in pets}
    schedules_by_pet: dict[str, list[dict[str, Any]]] = {}
    for schedule in schedules:
        schedules_by_pet.setdefault(str(schedule["mascota_id"]), []).append(schedule)

    for pet_id, pet in pet_map.items():
        pet_schedules = schedules_by_pet.get(pet_id, [])
        if pet_schedules:
            await _recalculate_feeding_schedule_portions(
                database, pet, pet_schedules
            )

    device_schedules = []
    for schedule in schedules:
        pet_id = str(schedule["mascota_id"])
        pet = pet_map.get(pet_id)
        if not pet:
            continue
        device_schedules.append(
            {
                "horario_id": str(schedule["_id"]),
                "mascota_id": pet_id,
                "mascota": {
                    "nombre": pet.get("nombre", ""),
                    "especie": pet.get("especie", ""),
                    "raza": pet.get("raza"),
                    "peso": pet.get("peso"),
                    "tamano": pet.get("tamano"),
                },
                "hora": schedule["hora"],
                "dias": schedule.get("repetir", ""),
                "porcion_gramos": schedule.get("porcion_gramos"),
                "gramos_por_dia": schedule.get("gramos_por_dia", {}),
                "tipo_comida": schedule.get("tipo_comida"),
                "tipo_alimento": schedule.get("tipo_alimento"),
                "notas": schedule.get("notas"),
            }
        )
    return {
        "server_time": datetime.now().astimezone().isoformat(timespec="seconds"),
        "schedules": device_schedules,
    }


@app.post("/device/feeding/events")
async def record_device_feeding(
    data: DeviceFeedingEventInput,
    request: Request,
    device_token: str | None = Header(default=None, alias="X-Device-Token"),
) -> dict[str, Any]:
    device_user = await _authenticated_device_user(request, device_token)
    database = request.app.state.database
    user_id = str(device_user["_id"])
    if not ObjectId.is_valid(data.horario_id):
        raise HTTPException(status_code=422, detail="Identificador de horario inválido")

    schedule = await database.horarios_alimentacion.find_one(
        {
            "_id": ObjectId(data.horario_id),
            "activo": 1,
            "usuario_id": user_id,
        }
    )
    if not schedule:
        raise HTTPException(status_code=404, detail="Horario de alimentación no encontrado")
    pet = await database.mascotas.find_one(
        {"_id": schedule["mascota_id"], "usuario_id": user_id}
    )
    if not pet:
        raise HTTPException(status_code=404, detail="Mascota del horario no encontrada")

    existing = await database.historial_alimentacion.find_one(
        {"evento_id": data.evento_id, "usuario_id": user_id}
    )
    if existing:
        existing["mascota_id"] = str(existing["mascota_id"])
        existing_alert = await database.alertas_dispositivo.find_one(
            {"evento_id": data.evento_id}, {"_id": 1}
        )
        return {
            **_serialize(existing),
            "duplicado": True,
            "alerta_id": str(existing_alert["_id"]) if existing_alert else None,
        }

    now = datetime.now().astimezone()
    portion = data.porcion_entregada

    record = {
        "evento_id": data.evento_id,
        "mascota_id": pet["_id"],
        "usuario_id": schedule["usuario_id"],
        "horario_id": str(schedule["_id"]),
        "porcion_entregada": portion,
        "tipo_dispensacion": "ESP32",
        "origen": "esp32",
        "fecha_hora": now.isoformat(timespec="seconds"),
    }
    try:
        result = await database.historial_alimentacion.insert_one(record)
    except DuplicateKeyError:
        existing = await database.historial_alimentacion.find_one(
            {"evento_id": data.evento_id}
        )
        if not existing or existing.get("usuario_id") != user_id:
            raise HTTPException(
                status_code=409, detail="El identificador del evento ya está en uso."
            )
        existing["mascota_id"] = str(existing["mascota_id"])
        return {**_serialize(existing), "duplicado": True}
    record["_id"] = result.inserted_id

    user = await database.usuarios.find_one(
        {"_id": ObjectId(schedule["usuario_id"])},
        {"expo_push_tokens": 1, "push_notifications": 1, "feeding_reminders": 1, "language": 1},
    )
    is_english = user and user.get("language") == "Inglés"
    if is_english:
        title = "Feeding completed"
        message = f"{pet['nombre']} received {portion:g} g of food at {now.strftime('%H:%M')}."
    else:
        title = "Alimentación completada"
        message = f"{pet['nombre']} recibió {portion:g} g de alimento a las {now.strftime('%H:%M')}."

    alert = {
        "usuario_id": schedule["usuario_id"],
        "mascota_id": pet["_id"],
        "mascota_nombre": pet["nombre"],
        "tipo": "alimentacion",
        "titulo": title,
        "mensaje": message,
        "prioridad": "normal",
        "fecha_hora": now,
        "leida": 0,
        "origen": "esp32",
        "evento_id": data.evento_id,
        "registro_alimentacion_id": record["_id"],
        "horario_id": schedule["_id"],
        "porcion_entregada": portion,
        "push_status": "pending",
    }
    alert_result = await database.alertas_dispositivo.insert_one(alert)
    alert["_id"] = alert_result.inserted_id

    push_status = "disabled"
    if user and user.get("push_notifications", 1) and user.get("feeding_reminders", 1):
        tokens = user.get("expo_push_tokens", [])
        if isinstance(tokens, str):
            tokens = [tokens]
        if tokens:
            deliveries = await asyncio.gather(
                *(
                    run_in_threadpool(
                        _send_expo_push,
                        token,
                        title,
                        message,
                        {"alertId": str(alert["_id"])},
                    )
                    for token in tokens
                )
            )
            push_status = (
                "sent" if all(item["status"] == "sent" for item in deliveries) else "failed"
            )
            for delivery in deliveries:
                if delivery["status"] != "sent":
                    print(f"Expo push delivery failed ({delivery['status']}).")
        else:
            push_status = "no_registered_token"

    record["push_status"] = push_status
    alert["push_status"] = push_status
    await database.historial_alimentacion.update_one(
        {"_id": record["_id"]},
        {"$set": {"push_status": push_status}},
    )
    await database.alertas_dispositivo.update_one(
        {"_id": alert["_id"]},
        {"$set": {"push_status": push_status}},
    )
    record["mascota_nombre"] = pet["nombre"]
    record["mascota_id"] = str(pet["_id"])
    return {
        **_serialize(record),
        "duplicado": False,
        "push_status": push_status,
        "alerta_id": str(alert["_id"]),
    }


@app.get("/appointments")
async def list_appointments(
    request: Request, user_id: str = Depends(current_user_id)
) -> list[dict[str, Any]]:
    return await _list_pet_records(request.app.state.database, "citas", user_id)


@app.post("/appointments", status_code=201)
async def create_appointment(
    data: AppointmentInput,
    request: Request,
    user_id: str = Depends(current_user_id),
) -> dict[str, Any]:
    try:
        date.fromisoformat(data.fecha)
    except ValueError as error:
        raise HTTPException(status_code=422, detail="Fecha de cita inválida") from error
    if data.zona_horaria:
        try:
            ZoneInfo(data.zona_horaria)
        except ZoneInfoNotFoundError as error:
            raise HTTPException(
                status_code=422, detail="Zona horaria inválida"
            ) from error
    pet = await _owned_pet(request.app.state.database, data.mascota_id, user_id)
    record = data.model_dump(exclude={"mascota_id"})
    record["mascota_id"] = pet["_id"]
    result = await request.app.state.database.citas.insert_one(record)
    record["_id"] = result.inserted_id
    record["mascota_id"] = str(pet["_id"])
    record["mascota_nombre"] = pet["nombre"]
    return _serialize(record)


@app.get("/vaccines")
async def list_vaccines(
    request: Request, user_id: str = Depends(current_user_id)
) -> list[dict[str, Any]]:
    return await _list_pet_records(request.app.state.database, "vacunas", user_id)


@app.post("/vaccines", status_code=201)
async def create_vaccine(
    data: VaccineInput,
    request: Request,
    user_id: str = Depends(current_user_id),
) -> dict[str, Any]:
    pet = await _owned_pet(request.app.state.database, data.mascota_id, user_id)
    record = data.model_dump(exclude={"mascota_id"})
    record["mascota_id"] = pet["_id"]
    result = await request.app.state.database.vacunas.insert_one(record)
    record["_id"] = result.inserted_id
    record["mascota_id"] = str(pet["_id"])
    record["mascota_nombre"] = pet["nombre"]
    return _serialize(record)


@app.patch("/vaccines/{vaccine_id}")
async def update_vaccine(
    vaccine_id: str,
    data: VaccineUpdateInput,
    request: Request,
    user_id: str = Depends(current_user_id),
) -> dict[str, Any]:
    if not ObjectId.is_valid(vaccine_id):
        raise HTTPException(status_code=422, detail="Identificador de vacuna inválido")

    database = request.app.state.database
    vaccine_object_id = ObjectId(vaccine_id)
    record = await database.vacunas.find_one({"_id": vaccine_object_id})
    if not record:
        raise HTTPException(status_code=404, detail="Registro de vacuna no encontrado")

    pet = await _owned_pet(database, str(record["mascota_id"]), user_id)
    updates = data.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(status_code=422, detail="No hay cambios para guardar")
    if "nombre_vacuna" in updates and not (updates["nombre_vacuna"] or "").strip():
        raise HTTPException(status_code=422, detail="El nombre de la vacuna es obligatorio")
    if "nombre_vacuna" in updates:
        updates["nombre_vacuna"] = updates["nombre_vacuna"].strip()

    await database.vacunas.update_one(
        {"_id": vaccine_object_id, "mascota_id": pet["_id"]},
        {"$set": updates},
    )
    updated_record = {**record, **updates}
    updated_record["mascota_id"] = str(pet["_id"])
    updated_record["mascota_nombre"] = pet["nombre"]
    return _serialize(updated_record)


@app.get("/feeding/schedules")
async def list_feeding_schedules(
    request: Request, user_id: str = Depends(current_user_id)
) -> list[dict[str, Any]]:
    database = request.app.state.database
    schedules = await database.horarios_alimentacion.find(
        {"usuario_id": user_id, "activo": 1}
    ).sort("hora", 1).to_list()
    pets = await database.mascotas.find(
        {"usuario_id": user_id},
        {
            "nombre": 1,
            "especie": 1,
            "peso": 1,
            "tamano": 1,
            "usuario_id": 1,
            "racion_diaria_veterinaria_gramos": 1,
            "condicion_corporal_puntaje": 1,
        },
    ).to_list()
    pet_map = {str(pet["_id"]): pet for pet in pets}
    schedules_by_pet: dict[str, list[dict[str, Any]]] = {}
    for schedule in schedules:
        schedules_by_pet.setdefault(str(schedule["mascota_id"]), []).append(schedule)

    for pet_id, pet in pet_map.items():
        try:
            await _recalculate_feeding_schedule_portions(
                database, pet, schedules_by_pet.get(pet_id, [])
            )
        except HTTPException as error:
            if error.status_code != 422:
                raise

    for schedule in schedules:
        pet_id = str(schedule["mascota_id"])
        pet = pet_map.get(pet_id, {})
        schedule["mascota_id"] = pet_id
        schedule["mascota_nombre"] = pet.get("nombre", "")
        schedule["mascota_especie"] = pet.get("especie", "")
        schedule["mascota_condicion_corporal_puntaje"] = pet.get(
            "condicion_corporal_puntaje"
        )
        schedule["mascota_racion_diaria_veterinaria_gramos"] = pet.get(
            "racion_diaria_veterinaria_gramos"
        )
    return [_serialize(schedule) for schedule in schedules]


@app.delete("/feeding/schedules/{schedule_id}")
async def delete_feeding_schedule(
    schedule_id: str,
    request: Request,
    user_id: str = Depends(current_user_id),
) -> dict[str, Any]:
    if not ObjectId.is_valid(schedule_id):
        raise HTTPException(status_code=422, detail="Identificador de horario inválido")

    database = request.app.state.database
    schedule_id_object = ObjectId(schedule_id)
    schedule_filter = {
        "_id": schedule_id_object,
        "usuario_id": user_id,
        "activo": 1,
    }
    schedule = await database.horarios_alimentacion.find_one(schedule_filter)
    if not schedule:
        raise HTTPException(status_code=404, detail="Horario de alimentación no encontrado")

    pet = await _owned_pet(database, str(schedule["mascota_id"]), user_id)
    result = await database.horarios_alimentacion.update_one(
        schedule_filter,
        {"$set": {"activo": 0}},
    )
    if result.modified_count != 1:
        raise HTTPException(status_code=404, detail="El horario ya no está activo")

    try:
        await _recalculate_feeding_schedule_portions(database, pet)
    except Exception:
        try:
            await database.horarios_alimentacion.update_one(
                {"_id": schedule_id_object, "usuario_id": user_id},
                {"$set": {"activo": 1}},
            )
            await _recalculate_feeding_schedule_portions(database, pet)
        except Exception:
            logger.exception(
                "No se pudo restaurar el horario tras fallar la actualización de porciones"
            )
        raise

    return {"id": schedule_id, "activo": 0}


@app.post("/feeding/schedules", status_code=201)
async def create_feeding_schedule(
    data: FeedingScheduleInput,
    request: Request,
    user_id: str = Depends(current_user_id),
) -> dict[str, Any]:
    database = request.app.state.database
    pet = await _owned_pet(database, data.mascota_id, user_id)
    try:
        daily_portion_grams(pet)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error

    active_schedules = await database.horarios_alimentacion.find(
        {"usuario_id": user_id, "activo": 1}
    ).to_list()
    if find_schedule_conflict(
        active_schedules,
        {"hora": data.hora, "repetir": data.repetir},
    ):
        raise HTTPException(
            status_code=409,
            detail=(
                f"El dispensador requiere al menos "
                f"{MIN_FEEDING_INTERVAL_MINUTES} minutos entre alimentaciones. "
                "Elige otro horario o días."
            ),
        )

    schedule = data.model_dump(exclude={"mascota_id"})
    schedule.update({"mascota_id": pet["_id"], "usuario_id": user_id, "activo": 1})
    result = await database.horarios_alimentacion.insert_one(schedule)
    schedule["_id"] = result.inserted_id
    schedules = await _recalculate_feeding_schedule_portions(
        database, pet
    )
    schedule = next(
        item for item in schedules if item.get("_id") == result.inserted_id
    )
    schedule["mascota_id"] = str(pet["_id"])
    schedule["mascota_nombre"] = pet["nombre"]
    schedule["mascota_especie"] = pet.get("especie", "")
    return _serialize(schedule)


@app.post("/feeding/schedules/batch", status_code=201)
async def create_feeding_schedule_batch(
    data: FeedingScheduleBatchInput,
    request: Request,
    user_id: str = Depends(current_user_id),
) -> list[dict[str, Any]]:
    database = request.app.state.database
    pet = await _owned_pet(database, data.mascota_id, user_id)
    try:
        daily_portion_grams(pet)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error

    selected_days = [day.strip() for day in data.repetir.split(",") if day.strip()]
    if (
        not selected_days
        or len(selected_days) != len(set(selected_days))
        or any(day not in WEEK_DAYS for day in selected_days)
    ):
        raise HTTPException(
            status_code=422,
            detail="Selecciona días de alimentación válidos y sin repetir.",
        )
    meal_names = [slot.momento_comida for slot in data.horarios]
    if len(meal_names) != len(set(meal_names)):
        raise HTTPException(
            status_code=422,
            detail="Cada horario de comida debe tener un nombre distinto.",
        )

    active_schedules = await database.horarios_alimentacion.find(
        {"usuario_id": user_id, "activo": 1}
    ).to_list()
    proposed_schedules: list[dict[str, Any]] = []
    for slot in data.horarios:
        candidate = {"hora": slot.hora, "repetir": ", ".join(selected_days)}
        conflict = find_schedule_conflict(
            active_schedules + proposed_schedules,
            candidate,
        )
        if conflict:
            conflicting_meal = conflict.get("momento_comida")
            conflict_description = (
                f"{conflicting_meal} a las {conflict['hora']}"
                if conflicting_meal
                else (
                    f"{conflict.get('mascota_nombre') or 'otra mascota'} "
                    f"a las {conflict['hora']}"
                )
            )
            raise HTTPException(
                status_code=409,
                detail=(
                    f"El dispensador requiere al menos "
                    f"{MIN_FEEDING_INTERVAL_MINUTES} minutos entre alimentaciones. "
                    f"El horario de {slot.momento_comida.lower()} entra en conflicto "
                    f"con {conflict_description}. Cambia la hora o los días."
                ),
            )
        proposed_schedules.append(
            {**candidate, "momento_comida": slot.momento_comida}
        )

    created_ids: list[ObjectId] = []
    try:
        for slot in data.horarios:
            schedule = slot.model_dump()
            schedule.update(
                {
                    "repetir": ", ".join(selected_days),
                    "mascota_id": pet["_id"],
                    "usuario_id": user_id,
                    "activo": 1,
                }
            )
            result = await database.horarios_alimentacion.insert_one(schedule)
            created_ids.append(result.inserted_id)
    except PyMongoError:
        if created_ids:
            try:
                await database.horarios_alimentacion.delete_many(
                    {
                        "_id": {"$in": created_ids},
                        "mascota_id": pet["_id"],
                        "usuario_id": user_id,
                    }
                )
            except PyMongoError:
                logger.exception("No se pudieron revertir los horarios insertados parcialmente")
        logger.exception("No se pudieron guardar todos los horarios de comida")
        raise

    try:
        schedules = await _recalculate_feeding_schedule_portions(database, pet)
    except Exception:
        try:
            await database.horarios_alimentacion.delete_many(
                {
                    "_id": {"$in": created_ids},
                    "mascota_id": pet["_id"],
                    "usuario_id": user_id,
                }
            )
            await _recalculate_feeding_schedule_portions(database, pet)
        except Exception:
            logger.exception(
                "No se pudieron revertir los horarios tras fallar el cálculo de porciones"
            )
        raise

    created_schedules = [
        {
            **schedule,
            "mascota_id": str(pet["_id"]),
            "mascota_nombre": pet["nombre"],
            "mascota_especie": pet.get("especie", ""),
            "mascota_condicion_corporal_puntaje": pet.get(
                "condicion_corporal_puntaje"
            ),
            "mascota_racion_diaria_veterinaria_gramos": pet.get(
                "racion_diaria_veterinaria_gramos"
            ),
        }
        for schedule in schedules
        if schedule.get("_id") in created_ids
    ]
    if len(created_schedules) != len(created_ids):
        raise HTTPException(
            status_code=500,
            detail="Se guardaron los horarios, pero no se pudieron recuperar sus detalles.",
        )
    return [_serialize(schedule) for schedule in created_schedules]


@app.get("/feeding/history")
async def list_feeding_history(
    request: Request, user_id: str = Depends(current_user_id)
) -> list[dict[str, Any]]:
    return await _list_pet_records(request.app.state.database, "historial_alimentacion", user_id)


@app.post("/feeding/history", status_code=201)
async def create_feeding_history(
    data: FeedingHistoryInput,
    request: Request,
    user_id: str = Depends(current_user_id),
) -> dict[str, Any]:
    pet = await _owned_pet(request.app.state.database, data.mascota_id, user_id)
    record = data.model_dump(exclude={"mascota_id"})
    portion = data.porcion_entregada
    if data.horario_id:
        database = request.app.state.database
        if not ObjectId.is_valid(data.horario_id):
            raise HTTPException(status_code=422, detail="Identificador de horario inválido")
        schedule = await database.horarios_alimentacion.find_one(
            {
                "_id": ObjectId(data.horario_id),
                "usuario_id": user_id,
                "mascota_id": pet["_id"],
                "activo": 1,
            }
        )
        if not schedule:
            raise HTTPException(status_code=404, detail="Horario de alimentación no encontrado")
        schedules = await _recalculate_feeding_schedule_portions(database, pet)
        schedule = next(item for item in schedules if item["_id"] == schedule["_id"])
        day = WEEK_DAYS[datetime.now().weekday()]
        portion = schedule.get("gramos_por_dia", {}).get(day)
        if portion is None:
            raise HTTPException(
                status_code=422,
                detail="Este horario no está programado para el día de hoy.",
            )
    if portion is None or portion <= 0:
        raise HTTPException(status_code=422, detail="La porción calculada no es válida.")
    record["porcion_entregada"] = portion
    record.update({
        "mascota_id": pet["_id"],
        "usuario_id": user_id,
        "fecha_hora": time.strftime("%Y-%m-%d %H:%M:%S", time.localtime()),
    })
    result = await request.app.state.database.historial_alimentacion.insert_one(record)
    record["_id"] = result.inserted_id
    record["mascota_id"] = str(pet["_id"])
    record["mascota_nombre"] = pet["nombre"]
    return _serialize(record)

@app.post("/reports/exports")
async def create_report_export(
    data: ReportExportInput,
    request: Request,
    user_id: str = Depends(current_user_id),
) -> StreamingResponse:
    database = request.app.state.database
    pet = await _owned_pet(database, data.mascota_id, user_id)
    records = await database.historial_alimentacion.find(
        {"usuario_id": user_id, "mascota_id": pet["_id"]}
    ).sort("fecha_hora", -1).limit(50).to_list(length=50)

    if not records:
        raise HTTPException(
            status_code=404,
            detail="No hay registros para exportar."
        )

    chart_records = [
        {**record, "fecha": record.get("fecha_hora")}
        for record in records
    ]
    portion_chart = await run_in_threadpool(
        _render_chart,
        chart_records,
        ChartType.HISTOGRAM,
        "porcion_entregada",
    )
    daily_chart = await run_in_threadpool(
        _render_chart,
        chart_records,
        ChartType.LINE,
        "porcion_entregada",
    )
    portion_chart_base64 = base64.b64encode(portion_chart.getvalue()).decode("ascii")
    daily_chart_base64 = base64.b64encode(daily_chart.getvalue()).decode("ascii")

    filas_html = ""
    for record in records:
        fecha = escape(str(record.get("fecha_hora", "")))
        porcion = escape(str(record.get("porcion_entregada", "")))
        tipo = escape(str(record.get("tipo_dispensacion", "Alimento")))
        filas_html += f"""
            <tr>
                <td>{fecha}</td>
                <td>{tipo}</td>
                <td>{porcion} g</td>
            </tr>
        """

    report_title = escape(data.tipo_reporte)
    pet_name = escape(str(pet["nombre"]))
    html_content = f"""
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <title>{report_title}</title>
        <style>
            body {{ font-family: Helvetica, Arial, sans-serif; color: #111827; background: #FFFFFF; margin: 18px; }}
            .header {{ text-align: center; color: #166534; padding: 14px 16px; border-bottom: 2px solid #22C55E; background: #FFFFFF; border-radius: 16px; }}
            h1 {{ margin: 0; font-size: 24px; }}
            h2 {{ color: #111827; margin: 16px 0 8px; font-size: 18px; }}
            .charts {{ width: 100%; border-collapse: separate; border-spacing: 8px 0; margin: 0 0 12px; }}
            .chart {{ width: 50%; vertical-align: top; text-align: center; padding: 8px; background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 16px; }}
            .chart img {{ display: block; width: 100%; max-height: 165px; height: auto; }}
            .records {{ width: 100%; border-collapse: collapse; margin-top: 12px; background: #FFFFFF; }}
            th, td {{ padding: 10px 12px; text-align: left; border-bottom: 1px solid #E5E7EB; }}
            th {{ background-color: #DCFCE7; color: #166534; font-weight: bold; }}
            .footer {{ margin-top: 20px; text-align: center; font-size: 12px; color: #6B7280; }}
        </style>
    </head>
    <body>
        <div class="header">
            <h1>PETCARE IoT</h1>
            <p>{report_title}</p>
            <p>Mascota: {pet_name}</p>
        </div>
        <h2>Estadísticas de alimentación</h2>
        <table class="charts">
            <tbody><tr>
            <td class="chart">
                <img src="data:image/png;base64,{daily_chart_base64}"
                     alt="Consumo diario de alimento de {pet_name}">
            </td>
            <td class="chart">
                <img src="data:image/png;base64,{portion_chart_base64}"
                     alt="Distribución de porciones de {pet_name}">
            </td>
            </tr></tbody>
        </table>
        <table class="records">
            <thead>
                <tr>
                    <th>Fecha y Hora</th>
                    <th>Tipo de Alimento</th>
                    <th>Porción Servida</th>
                </tr>
            </thead>
            <tbody>
                {filas_html}
            </tbody>
        </table>
        <div class="footer">
            Generado automáticamente por PETCARE IoT App.
        </div>
    </body>
    </html>
    """

    try:
        pdf_bytes = HTML(string=html_content).write_pdf()
    except Exception as e:
        raise HTTPException(status_code=500, detail="Error generando el archivo PDF.") from e

    requested_name = data.nombre_archivo.replace("\\", "/").rsplit("/", 1)[-1]
    requested_stem = requested_name.rsplit(".", 1)[0]
    safe_stem = re.sub(r"[^A-Za-z0-9_-]+", "_", requested_stem).strip("_")
    filename = f"{safe_stem or 'reporte_alimentacion'}.pdf"
    user = await database.usuarios.find_one(
        {"_id": ObjectId(user_id)}, {"nombre": 1}
    )
    await database.reportes_exportados.insert_one({
        "usuario_id": user_id,
        "usuario_nombre": user.get("nombre", "") if user else "",
        "mascota_id": pet["_id"],
        "mascota_nombre": pet["nombre"],
        "tipo_reporte": data.tipo_reporte,
        "nombre_archivo": filename,
        "formato": "pdf",
        "fecha_exportacion": datetime.now().astimezone(),
        "cantidad_registros": len(records),
        "registros_ids": [record["_id"] for record in records],
    })

    return StreamingResponse(
        BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        },
    )


@app.get(
    "/api/v1/graficas/usuario/{tipo_grafica}",
    response_class=StreamingResponse,
)
async def get_user_chart(
    tipo_grafica: ChartType,
    request: Request,
    user_id: str = Depends(current_user_id),
) -> StreamingResponse:
    """Genera una gráfica del historial de alimentación del usuario."""
    database = request.app.state.database
    field = (
        "mascota_nombre"
        if tipo_grafica == ChartType.BAR
        else "porcion_entregada"
    )

    try:
        records = await database.historial_alimentacion.find(
            {"usuario_id": user_id},
            {
                "_id": 0,
                "mascota_id": 1,
                "fecha_hora": 1,
                "porcion_entregada": 1,
            },
        ).limit(10_000).to_list(length=10_000)

        if tipo_grafica == ChartType.BAR:
            pets = await database.mascotas.find(
                {"usuario_id": user_id},
                {"_id": 1, "nombre": 1},
            ).to_list()

            pet_names = {
                pet["_id"]: pet["nombre"]
                for pet in pets
            }
            for record in records:
                record["mascota_nombre"] = pet_names.get(
                    record.get("mascota_id"),
                    "Sin nombre",
                )

        elif tipo_grafica == ChartType.LINE:
            for record in records:
                record["fecha"] = record.get("fecha_hora")

    except PyMongoError as error:
        raise HTTPException(
            status_code=503,
            detail="No se pudo consultar el historial de alimentación.",
        ) from error

    if not records:
        raise HTTPException(
            status_code=404,
            detail="Aún no hay registros de alimentación para generar la gráfica.",
        )

    image = await run_in_threadpool(
        _render_chart,
        records,
        tipo_grafica,
        field,
    )
    return StreamingResponse(image, media_type="image/png")

@app.get("/alerts")
async def list_alerts(
    request: Request, user_id: str = Depends(current_user_id)
) -> list[dict[str, Any]]:
    alerts = await request.app.state.database.alertas_dispositivo.find(
        {"usuario_id": user_id}
    ).sort("fecha_hora", -1).limit(50).to_list()
    return [_serialize(alert) for alert in alerts]


@app.get("/api/notificaciones/{usuario_id}")
async def list_user_notifications(
    usuario_id: str,
    request: Request,
    authenticated_user_id: str = Depends(current_user_id),
) -> list[dict[str, Any]]:
    if usuario_id != authenticated_user_id:
        raise HTTPException(status_code=403, detail="No puedes consultar notificaciones de otro usuario")

    database = request.app.state.database
    now = datetime.now().astimezone()
    cutoff = now.timestamp() - (24 * 60 * 60)
    try:
        user = await database.usuarios.find_one(
            {"_id": ObjectId(authenticated_user_id)}, {"language": 1}
        )
        is_english = user and user.get("language") == "Inglés"
        pets = await database.mascotas.find(
            {"usuario_id": authenticated_user_id},
            {"_id": 1, "nombre": 1},
        ).to_list()
        pet_ids = [pet["_id"] for pet in pets]
        pet_names = {str(pet["_id"]): pet.get("nombre", "Tu mascota") for pet in pets}
        if not pet_ids:
            return []

        feeding_records = await database.historial_alimentacion.find(
            {
                "usuario_id": authenticated_user_id,
                "mascota_id": {"$in": pet_ids},
            },
            {
                "_id": 1,
                "mascota_id": 1,
                "fecha_hora": 1,
                "porcion_entregada": 1,
                "origen": 1,
                "push_status": 1,
            },
        ).sort("fecha_hora", -1).limit(100).to_list(length=100)
        device_alerts = await database.alertas_dispositivo.find(
            {
                "usuario_id": authenticated_user_id,
                "mascota_id": {"$in": pet_ids},
            },
            {
                "_id": 1,
                "mascota_id": 1,
                "tipo": 1,
                "titulo": 1,
                "mensaje": 1,
                "prioridad": 1,
                "fecha_hora": 1,
                "origen": 1,
                "push_status": 1,
                "leida": 1,
            },
        ).sort("fecha_hora", -1).limit(100).to_list(length=100)
        appointments = await database.citas.find(
            {"mascota_id": {"$in": pet_ids}},
            {
                "_id": 1,
                "mascota_id": 1,
                "titulo": 1,
                "fecha": 1,
                "hora": 1,
                "zona_horaria": 1,
            },
        ).to_list()
        vaccine_records = await database.vacunas.find(
            {"mascota_id": {"$in": pet_ids}},
            {
                "_id": 1,
                "mascota_id": 1,
                "nombre_vacuna": 1,
                "proxima_dosis": 1,
            },
        ).to_list()
    except PyMongoError as error:
        raise HTTPException(
            status_code=503,
            detail="No se pudieron consultar las notificaciones.",
        ) from error

    notifications: list[tuple[int, float, dict[str, Any]]] = []
    for record in feeding_records:
        if record.get("origen") == "esp32":
            continue
        feeding_date = _parse_notification_datetime(record.get("fecha_hora"))
        if not feeding_date or feeding_date.timestamp() < cutoff:
            continue
        pet_name = pet_names.get(str(record.get("mascota_id")), "Tu mascota")
        portion = record.get("porcion_entregada", 0)
        portion_text = f"{portion:g}" if isinstance(portion, (int, float)) else str(portion)
        if is_english:
            title = "Feeding"
            message = f"{pet_name} ate {portion_text} g at {feeding_date.strftime('%H:%M')}."
        else:
            title = "Alimentación"
            message = f"{pet_name} ya comió su porción de {portion_text}g a las {feeding_date.strftime('%H:%M')}."
        notifications.append(
            (
                3,
                -feeding_date.timestamp(),
                {
                    "id": str(record["_id"]),
                    "tipo": "alimentacion",
                    "titulo": title,
                    "mensaje": message,
                    "fecha_hora": feeding_date.isoformat(timespec="seconds"),
                    "prioridad": "normal",
                    "fuente": "alimentacion",
                    "origen": record.get("origen"),
                    "push_enviada": record.get("push_status") == "sent",
                },
            )
        )

    for alert in device_alerts:
        alert_date = _parse_notification_datetime(alert.get("fecha_hora"))
        if not alert_date or alert_date.timestamp() < cutoff:
            continue
        notifications.append(
            (
                3,
                -alert_date.timestamp(),
                {
                    "id": str(alert["_id"]),
                    "tipo": alert.get("tipo", "alimentacion"),
                    "titulo": alert.get("titulo", ""),
                    "mensaje": alert.get("mensaje", ""),
                    "fecha_hora": alert_date.isoformat(timespec="seconds"),
                    "prioridad": alert.get("prioridad", "normal"),
                    "fuente": "alerta_dispositivo",
                    "origen": alert.get("origen"),
                    "push_enviada": alert.get("push_status") == "sent",
                    "leida": bool(alert.get("leida", 0)),
                },
            )
        )

    for record in vaccine_records:
        next_dose = _parse_notification_datetime(record.get("proxima_dosis"))
        if not next_dose:
            continue
        days_until = (next_dose.date() - now.date()).days
        if days_until > 0 and not _is_notification_day(
            next_dose,
            now.date(),
            days_before=2,
        ):
            continue

        if days_until < 0:
            priority = 0
            priority_label = "urgent" if is_english else "urgente"
            timing = (
                f"has been overdue for {abs(days_until)} day(s)"
                if is_english
                else f"está vencida desde hace {abs(days_until)} día(s)"
            )
        elif days_until <= 3:
            priority = 1
            priority_label = "high" if is_english else "alta"
            timing = (
                "is due today" if days_until == 0 else f"is due in {days_until} day(s)"
            ) if is_english else (
                "vence hoy" if days_until == 0 else f"vence en {days_until} día(s)"
            )
        else:
            priority = 2
            priority_label = "medium" if is_english else "media"
            timing = (
                f"is due in {days_until} days"
                if is_english
                else f"vence en {days_until} días"
            )

        pet_name = pet_names.get(str(record.get("mascota_id")), "Tu mascota")
        vaccine_name = record.get("nombre_vacuna") or ("a vaccine" if is_english else "Una vacuna")
        title = "Health" if is_english else "Salud"
        message = (
            f"Attention! {pet_name}'s {vaccine_name} vaccine {timing}."
            if is_english
            else f"¡Atención! La vacuna contra {vaccine_name} de {pet_name} {timing}."
        )
        notifications.append(
            (
                priority,
                next_dose.timestamp(),
                {
                    "id": str(record["_id"]),
                    "tipo": "salud",
                    "titulo": title,
                    "mensaje": message,
                    "fecha_hora": next_dose.isoformat(timespec="seconds"),
                    "prioridad": priority_label,
                    "fuente": "vacuna",
                },
            )
        )

    for appointment in appointments:
        appointment_date = _parse_appointment_datetime(
            appointment.get("fecha"),
            appointment.get("hora") or "00:00",
            appointment.get("zona_horaria"),
        )
        if not appointment_date:
            continue
        appointment_local_now = now.astimezone(appointment_date.tzinfo)
        days_until = (appointment_date.date() - appointment_local_now.date()).days
        if not _is_notification_day(
            appointment_date,
            appointment_local_now.date(),
            days_before=1,
        ):
            continue

        time_until = appointment_date - now
        priority = 1 if time_until <= timedelta(days=3) else 2
        priority_label = (
            ("high" if is_english else "alta")
            if priority == 1
            else ("medium" if is_english else "media")
        )
        if is_english:
            timing = (
                "is coming up soon"
                if days_until == 0
                else f"is in {days_until} day(s)"
            )
            title = "Appointment"
            message = (
                f"{appointment.get('titulo') or 'Veterinary appointment'} for "
                f"{pet_names.get(str(appointment.get('mascota_id')), 'your pet')} "
                f"{timing} at {appointment_date.strftime('%H:%M')}."
            )
        else:
            timing = (
                "está programada para hoy"
                if days_until == 0
                else f"está programada en {days_until} día(s)"
            )
            title = "Cita próxima"
            message = (
                f"{appointment.get('titulo') or 'Cita veterinaria'} de "
                f"{pet_names.get(str(appointment.get('mascota_id')), 'tu mascota')} "
                f"{timing} a las {appointment_date.strftime('%H:%M')}."
            )
        notifications.append(
            (
                priority,
                appointment_date.timestamp(),
                {
                    "id": str(appointment["_id"]),
                    "tipo": "cita",
                    "titulo": title,
                    "mensaje": message,
                    "fecha_hora": appointment_date.isoformat(timespec="seconds"),
                    "prioridad": priority_label,
                    "fuente": "cita",
                },
            )
        )

    notifications.sort(key=lambda item: (item[0], item[1]))
    return [notification for _, _, notification in notifications[:50]]


@app.patch("/alerts/read-all")
async def mark_all_alerts_read(
    request: Request, user_id: str = Depends(current_user_id)
) -> dict[str, int]:
    result = await request.app.state.database.alertas_dispositivo.update_many(
        {"usuario_id": user_id, "leida": 0}, {"$set": {"leida": 1}}
    )
    return {"updated": result.modified_count}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", 10000)))
