"""SQLAlchemy modeli. V bazi so SAMO podatki o zraku – nič o uporabnikih."""
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, Integer, String, Text, create_engine
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
    vir: Mapped[str] = mapped_column(String)  # arso | sensor_community
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


class Forecast(Base):
    __tablename__ = "forecasts"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    izdano_utc: Mapped[datetime] = mapped_column(DateTime, index=True)
    ciljni_utc: Mapped[datetime] = mapped_column(DateTime, index=True)
    lokacija: Mapped[str] = mapped_column(String)
    pm25: Mapped[float] = mapped_column(Float)
    pm10: Mapped[float | None] = mapped_column(Float, nullable=True)
    model: Mapped[str] = mapped_column(String)


class ModelMetric(Base):
    __tablename__ = "model_metrics"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    model: Mapped[str] = mapped_column(String)
    horizont_h: Mapped[int] = mapped_column(Integer)
    mae: Mapped[float] = mapped_column(Float)
    mae_vztrajnost: Mapped[float] = mapped_column(Float)


class DailyGame(Base):
    __tablename__ = "daily_game"
    datum: Mapped[date] = mapped_column(Date, primary_key=True)
    vprasanje: Mapped[str] = mapped_column(Text)
    napoved: Mapped[str | None] = mapped_column(String, nullable=True)
    pravi_odgovor: Mapped[str | None] = mapped_column(String, nullable=True)  # vpiše se naslednji dan


class Place(Base):
    __tablename__ = "places"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    ime: Mapped[str] = mapped_column(String)
    tip: Mapped[str] = mapped_column(String)  # vrtec | sola | bolnisnica
    lat: Mapped[float] = mapped_column(Float)
    lon: Mapped[float] = mapped_column(Float)


class Fact(Base):
    __tablename__ = "facts"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    besedilo: Mapped[str] = mapped_column(Text)
    stevilka: Mapped[str | None] = mapped_column(String, nullable=True)
    vir: Mapped[str] = mapped_column(String)


def init_db() -> None:
    Base.metadata.create_all(engine)


def get_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
