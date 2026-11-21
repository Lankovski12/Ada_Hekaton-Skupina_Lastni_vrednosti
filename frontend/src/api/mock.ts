// Rezervni podatki, kadar zaledje ne odgovori in ni shranjenega odgovora (npr. telefon brez interneta).
// Nič ni izmišljeno: vse vrednosti so povprečja meritev ARSO za isti mesec in uro (paket ARSOhack,
// src/data/zgodovina.json) in so v aplikaciji označene kot »običajno«, ne kot meritev.
// Oblika je ista kot pri pravem API-ju (backend/app/main.py dela enako, ko nima meritev).
import type { DailyGame, Fact, ForecastResponse, NowResponse, Place, SceneResponse } from '@/lib/types'
import { klimaLabel, typical } from '@/lib/klima'
import z from '@/data/zgodovina.json'

const HOUR = 3600_000
const ARSO_OFFSET_H = 1
const MEGLA_MIN = 299 + 30 // Bežigrad + 30 m (isto kot v zaledju)
const MEGLA_MAX = 1200
const fmt = (n: number) => n.toLocaleString('sl-SI', { maximumFractionDigits: 1 })

function startOfHour(d = new Date()) {
  const c = new Date(d)
  c.setMinutes(0, 0, 0)
  return c
}

export function mockNow(): NowResponse {
  const t = startOfHour()
  return {
    cas_utc: t.toISOString(),
    postaje: [
      {
        id: 'klima',
        ime: `Ljubljana – običajno ob tej uri (${klimaLabel})`,
        lat: 46.0655,
        lon: 14.5127,
        pm25: typical(t, 'pm25'),
        pm10: typical(t, 'pm10'),
        vir: 'ocena',
        cas_utc: t.toISOString(),
      },
    ],
  }
}

export function mockForecast(h = 48): ForecastResponse {
  const start = startOfHour()
  const ure = Array.from({ length: h }, (_, i) => {
    const t = new Date(start.getTime() + (i + 1) * HOUR)
    return { cas_utc: t.toISOString(), pm25: typical(t, 'pm25'), pm10: typical(t, 'pm10') }
  })
  // najboljša ura podnevi (7–20 po lokalnem času ARSO), kot v backend/app/forecast.py
  const day = ure.filter((u) => {
    const hh = (new Date(u.cas_utc).getUTCHours() + ARSO_OFFSET_H) % 24
    return hh >= 7 && hh <= 20
  })
  const best = (day.length ? day : ure).reduce((a, b) => (b.pm25 < a.pm25 ? b : a))
  return { izdano_utc: start.toISOString(), lat: 46.05, lon: 14.51, ure, najboljsa_ura: best.cas_utc, model: 'klima' }
}

export function mockScene(): SceneResponse {
  const start = startOfHour()
  return {
    vir: 'klima',
    ure: Array.from({ length: 24 }, (_, i) => {
      const t = new Date(start.getTime() + (i + 1) * HOUR)
      return {
        cas_utc: t.toISOString(),
        pm25: typical(t, 'pm25'),
        // v vsaj četrtini takih ur (isti mesec in ura) je bila v preteklosti inverzija (Bežigrad – Pasja ravan)
        inverzija: typical(t, 'inverzija') >= 0.25,
        visina_megle_m: Math.min(MEGLA_MAX, Math.max(MEGLA_MIN, 299 + typical(t, 'mejnaPlast'))),
      }
    }),
  }
}

export function mockDailyGame(): DailyGame {
  // brez zaledja ne vemo, kakšen je bil zrak včeraj – zato brez »včeraj«
  return {
    datum: new Date().toISOString().slice(0, 10),
    vprasanje: 'Bo jutri ob 8h zrak v Ljubljani boljši ali slabši kot danes ob 8h?',
    moznosti: ['Boljši', 'Enak', 'Slabši'],
  }
}

export function mockFacts(): Fact[] {
  const vir = 'ARSO (ARSOhack)'
  const { who, inverzija: inv, leta } = z
  const prvo = leta[0]!
  const zadnje = leta[leta.length - 1]!
  return [
    {
      besedilo: `Leta ${who.leto} je bilo dnevno povprečje PM2.5 na Bežigradu nad smernico WHO (15 µg/m³) kar ${who.dni} od ${who.izmed} dni.`,
      stevilka: `${who.dni} dni`,
      vir: `${vir}; smernica WHO 2021`,
    },
    {
      besedilo: `Ob temperaturni inverziji je pozimi v zraku povprečno ${fmt(inv.z)} µg/m³ PM2.5, brez nje ${fmt(inv.brez)} µg/m³. Inverzija je v ${inv.delezUr} % zimskih ur.`,
      stevilka: `${fmt(inv.z / inv.brez)}×`,
      vir,
    },
    {
      besedilo: `Povprečje PM10 na Bežigradu je od leta ${prvo.leto} do ${zadnje.leto} padlo s ${fmt(prvo.pm10)} na ${fmt(zadnje.pm10)} µg/m³.`,
      stevilka: `−${Math.round((1 - zadnje.pm10 / prvo.pm10) * 100)} %`,
      vir,
    },
  ]
}

export function mockPlaces(): Place[] {
  // brez zaledja ni seznama; 3D zemljevid ima svoje lokacije v public/assets/map/lokacije.json
  return []
}
