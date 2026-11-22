"""SQLAlchemy modeli. V bazi so SAMO podatki o zraku – nič o uporabnikih."""
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, create_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker

from .config import DATABASE_URL

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {})
SessionLocal = sessionmaker(bind=engine, autoflush=False)


class Base(DeclarativeBase):
    pass


class Station(Base):
    __tablename__ = "stations"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    ime: Mapped[str] = mapped_column(String)
    lat: Mapped[float] = mapped_column(Float)
    lon: Mapped[float] = mapped_column(Float)
    vir: Mapped[str] = mapped_column(String)  # arso
    tip: Mapped[str | None] = mapped_column(String, nullable=True)


class Measurement(Base):
    __tablename__ = "measurements"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    station_id: Mapped[str] = mapped_column(ForeignKey("stations.id"), index=True)
    time_utc: Mapped[datetime] = mapped_column(DateTime, index=True)
    onesnazevalo: Mapped[str] = mapped_column(String)  # pm25 | pm10
    vrednost: Mapped[float] = mapped_column(Float)
    vir: Mapped[str] = mapped_column(String)
    vrsta: Mapped[str] = mapped_column(String, default="meritev")  # meritev | ocena (po umerjanju)


class Weather(Base):
    __tablename__ = "weather"
    time_utc: Mapped[datetime] = mapped_column(DateTime, primary_key=True)
    temp_dolina: Mapped[float | None] = mapped_column(Float, nullable=True)
    temp_hrib: Mapped[float | None] = mapped_column(Float, nullable=True)
    veter: Mapped[float | None] = mapped_column(Float, nullable=True)
    visina_mejne_plasti: Mapped[float | None] = mapped_column(Float, nullable=True)
    inverzija: Mapped[bool | None] = mapped_column(Boolean, nullable=True)


def init_db() -> None:
    Base.metadata.create_all(engine)
