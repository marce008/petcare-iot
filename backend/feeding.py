from __future__ import annotations

import math
import unicodedata
from typing import Any


WEEK_DAYS = ("Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom")
MIN_FEEDING_INTERVAL_MINUTES = 60
GRAMS_PER_KG_BY_SPECIES_AND_SIZE = {
    "perro": {"pequena": 30, "mediana": 24, "grande": 18},
    "gato": {"pequena": 25, "mediana": 20, "grande": 16},
    "ave": {"pequena": 30, "mediana": 25, "grande": 20},
    "roedor": {"pequena": 35, "mediana": 28, "grande": 22},
    "conejo": {"pequena": 30, "mediana": 25, "grande": 20},
    "caballo": {"pequena": 20, "mediana": 17, "grande": 14},
    "reptil": {"pequena": 12, "mediana": 10, "grande": 8},
    "pez": {"pequena": 8, "mediana": 6, "grande": 4},
}
DEFAULT_GRAMS_PER_KG_BY_SIZE = {"pequena": 25, "mediana": 20, "grande": 16}


def _normalize(value: str) -> str:
    normalized = unicodedata.normalize("NFD", value.strip().lower())
    return "".join(
        character for character in normalized
        if not unicodedata.combining(character)
    )


def daily_portion_grams(pet: dict[str, Any]) -> float:
    veterinary_daily_grams = pet.get("racion_diaria_veterinaria_gramos")
    if veterinary_daily_grams is not None:
        if (
            isinstance(veterinary_daily_grams, bool)
            or not isinstance(veterinary_daily_grams, (int, float))
            or not math.isfinite(veterinary_daily_grams)
            or veterinary_daily_grams <= 0
        ):
            raise ValueError("La ración veterinaria diaria debe ser mayor que cero.")
        return round(float(veterinary_daily_grams), 1)

    weight = pet.get("peso")
    species = _normalize(str(pet.get("especie", "")))
    if not isinstance(weight, (int, float)) or weight <= 0:
        raise ValueError("La mascota debe tener un peso válido para calcular la ración.")
    inferred_size = "Pequeña" if weight <= 10 else "Mediana" if weight <= 25 else "Grande"
    size = _normalize(str(pet.get("tamano") or inferred_size))
    if size not in {"pequena", "mediana", "grande"}:
        raise ValueError("Selecciona el tamaño de la mascota para calcular la ración.")

    rates = GRAMS_PER_KG_BY_SPECIES_AND_SIZE.get(
        species, DEFAULT_GRAMS_PER_KG_BY_SIZE
    )
    return round(weight * rates[size], 1)


def schedule_days(schedule: dict[str, Any]) -> tuple[str, ...]:
    repeating_days = {
        day.strip()
        for day in str(schedule.get("repetir") or "").split(",")
        if day.strip()
    }
    if not repeating_days:
        return WEEK_DAYS
    return tuple(day for day in WEEK_DAYS if day in repeating_days) or WEEK_DAYS


def find_schedule_conflict(
    schedules: list[dict[str, Any]], candidate: dict[str, Any]
) -> dict[str, Any] | None:
    def time_minutes(value: Any) -> int | None:
        if not isinstance(value, str):
            return None
        parts = value.split(":")
        if len(parts) != 2 or not all(part.isdigit() for part in parts):
            return None
        hour, minute = map(int, parts)
        if not 0 <= hour < 24 or not 0 <= minute < 60:
            return None
        return hour * 60 + minute

    candidate_time = time_minutes(candidate.get("hora"))
    if candidate_time is None:
        return None

    week_minutes = len(WEEK_DAYS) * 24 * 60
    candidate_occurrences = {
        WEEK_DAYS.index(day) * 24 * 60 + candidate_time
        for day in schedule_days(candidate)
    }

    for schedule in schedules:
        schedule_time = time_minutes(schedule.get("hora"))
        if schedule_time is None:
            continue
        schedule_occurrences = {
            WEEK_DAYS.index(day) * 24 * 60 + schedule_time
            for day in schedule_days(schedule)
        }
        for candidate_occurrence in candidate_occurrences:
            for schedule_occurrence in schedule_occurrences:
                difference = abs(candidate_occurrence - schedule_occurrence)
                distance = min(difference, week_minutes - difference)
                if distance < MIN_FEEDING_INTERVAL_MINUTES:
                    return schedule
    return None


def distribute_daily_portion(
    schedules: list[dict[str, Any]], daily_grams: float
) -> list[dict[str, Any]]:
    day_counts = {day: 0 for day in WEEK_DAYS}
    schedule_day_sets = [schedule_days(schedule) for schedule in schedules]
    for days in schedule_day_sets:
        for day in days:
            day_counts[day] += 1

    portions = []
    for days in schedule_day_sets:
        grams_by_day = {
            day: round(daily_grams / day_counts[day], 1)
            for day in days
            if day_counts[day]
        }
        average_portion = round(sum(grams_by_day.values()) / len(grams_by_day), 1)
        portions.append(
            {
                "porcion_diaria_gramos": daily_grams,
                "gramos_por_dia": grams_by_day,
                "porcion_gramos": average_portion,
            }
        )
    return portions
