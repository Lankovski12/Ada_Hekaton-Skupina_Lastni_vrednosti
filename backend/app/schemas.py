"""Oblika JSON odgovorov. Mora se ujemati s frontend/src/lib/types.ts."""
from typing import Literal

from pydantic import BaseModel


class StationNow(BaseModel):
    id: str
    ime: str
    lat: float
    lon: float
    pm25: float | None
    pm10: float | None
    vir: Literal["meritev", "model", "ocena"]
    cas_utc: str


class NowResponse(BaseModel):
    cas_utc: str
    postaje: list[StationNow]


class ForecastHour(BaseModel):
    cas_utc: str
    pm25: float
    pm10: float


class ForecastResponse(BaseModel):
    izdano_utc: str
    lat: float
    lon: float
    ure: list[ForecastHour]
    najboljsa_ura: str
    model: Literal["cams", "klima", "model"] = "cams"  # klima = povprečje meritev ARSO za ta mesec in uro


class SceneHour(BaseModel):
    cas_utc: str
    visina_megle_m: float
    pm25: float
    inverzija: bool
    megla: bool = False  # prava megla (vodne kapljice) po Open-Meteo: koda vremena 45/48 ali vidljivost < 1 km


class SceneResponse(BaseModel):
    ure: list[SceneHour]
    vir: Literal["open-meteo", "klima"] = "open-meteo"  # klima = običajne razmere iz ARSOhack (ni povezave)


class FactOut(BaseModel):
    besedilo: str
    stevilka: str | None = None
    vir: str


class PlaceOut(BaseModel):
    ime: str
    tip: str
    lat: float
    lon: float
