"""Višina pokrovke (višina mešanja) iz dveh temperatur – isto pravilo kot v igri (frontend/src/games/pokrovka/fizika.ts).

Poenostavljen profil: med dolino (Ljubljana, 299 m) in hribom (Pasja ravan, 1019 m) se temperatura spreminja
enakomerno, nad hribom pada za 6,5 °C na km (običajno ozračje). Zrak iz doline se dviga in pri tem ohlaja za 9,8 °C
na km (suhi adiabatni gradient). Pokrovka je prva višina, kjer je okolica za 1 °C toplejša od dvigajočega se zraka
(enako pravilo kot višina mešanja iz radiosondaže v ARSOhack, metoda »potencialna temperatura + 1 K«).
"""

HRIB_M = 720.0  # Pasja ravan je 720 m nad dnom kotline
SUHI_GRADIENT = 0.0098  # °C/m
OKOLICA_NAD_HRIBOM = -0.0065  # °C/m
NAJVEC = 1500.0


def temperatura(z: float, t_dolina: float, t_hrib: float) -> float:
    if z <= HRIB_M:
        return t_dolina + (t_hrib - t_dolina) * z / HRIB_M
    return t_hrib + OKOLICA_NAD_HRIBOM * (z - HRIB_M)


def visina_pokrovke(t_dolina: float, t_hrib: float, presezek: float = 1.0) -> float:
    """Višina (m nad dnom kotline), kjer se dvigajoči zrak ustavi."""
    z = 0.0
    while z < NAJVEC:
        z += 5
        theta = temperatura(z, t_dolina, t_hrib) + SUHI_GRADIENT * z
        if theta >= t_dolina + presezek:
            return z
    return NAJVEC


# --- včerajšnje jutro (Open-Meteo, model) -------------------------------------------

DOLINA = (46.0655, 14.5124, 299)  # Ljubljana Bežigrad
HRIB = (46.0979, 14.2282, 1019)  # Pasja ravan


def vceraj() -> dict | None:
    """Temperaturi ob 7h včeraj v dolini in na hribu (ocena modela Open-Meteo) + PM2.5 dneva, če ga imamo."""
    import datetime as dt

    import httpx

    from .daily import LOCAL, _day_measurements

    day = (dt.datetime.now(dt.UTC) + LOCAL).date() - dt.timedelta(days=1)
    params = {
        "latitude": f"{DOLINA[0]},{HRIB[0]}", "longitude": f"{DOLINA[1]},{HRIB[1]}", "elevation": f"{DOLINA[2]},{HRIB[2]}",
        "hourly": "temperature_2m,relative_humidity_2m", "timezone": "UTC",
        "start_date": day.isoformat(), "end_date": day.isoformat(),
    }
    try:
        r = httpx.get("https://api.open-meteo.com/v1/forecast", params=params, timeout=20)
        r.raise_for_status()
        dolina, hrib = r.json()
    except (httpx.HTTPError, ValueError):
        return None
    ura = f"{day.isoformat()}T06:00"  # 7h po ARSO
    try:
        i = dolina["hourly"]["time"].index(ura)
        t_d = dolina["hourly"]["temperature_2m"][i]
        t_h = hrib["hourly"]["temperature_2m"][i]
        vlaga = dolina["hourly"]["relative_humidity_2m"][i]
    except (KeyError, ValueError, IndexError):
        return None
    if t_d is None or t_h is None:
        return None
    _, _, pm25 = _day_measurements(day)
    return {"datum": day.isoformat(), "vir": "model Open-Meteo", "t_dolina": t_d, "t_hrib": t_h, "vlaga": vlaga, "pm25": pm25}
