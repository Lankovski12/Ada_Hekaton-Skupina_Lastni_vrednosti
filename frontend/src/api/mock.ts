// Lažni podatki, ki jih aplikacija uporabi, dokler Python zaledje ne teče.
// Oblika je ista kot pri pravem API-ju, zato jih kasneje samo izklopimo.
import type { DailyGame, Fact, ForecastResponse, NowResponse, Place, SceneResponse } from '@/lib/types'

const HOUR = 3600_000

function startOfHour(d = new Date()) {
  const c = new Date(d)
  c.setMinutes(0, 0, 0)
  return c
}

/** Tipičen zimski dnevni hod v Ljubljani: zjutraj in zvečer več delcev (kurišča, promet). */
function typicalPm25(date: Date, seed = 0): number {
  const h = date.getHours()
  const evening = Math.exp(-((h - 20) ** 2) / 8) * 30
  const morning = Math.exp(-((h - 8) ** 2) / 4) * 18
  const day = Math.floor(date.getTime() / (24 * HOUR))
  const dayFactor = 0.7 + 0.5 * Math.abs(Math.sin(day * 1.7 + seed))
  return Math.round((10 + evening + morning) * dayFactor)
}

export function mockNow(): NowResponse {
  const now = startOfHour()
  const base = typicalPm25(now)
  const postaje = [
    { id: 'LJ-BEZ', ime: 'Ljubljana Bežigrad', lat: 46.0656, lon: 14.5126, f: 1 },
    { id: 'LJ-CEL', ime: 'Ljubljana Celovška', lat: 46.0636, lon: 14.4914, f: 1.2 },
    { id: 'LJ-VIC', ime: 'Ljubljana Vič', lat: 46.0425, lon: 14.4874, f: 0.9 },
  ]
  return {
    cas_utc: now.toISOString(),
    postaje: postaje.map((p) => ({
      id: p.id,
      ime: p.ime,
      lat: p.lat,
      lon: p.lon,
      pm25: Math.round(base * p.f),
      pm10: Math.round(base * p.f * 1.3),
      vir: 'meritev' as const,
      cas_utc: now.toISOString(),
    })),
  }
}

export function mockForecast(h = 48): ForecastResponse {
  const start = startOfHour()
  const ure = Array.from({ length: h }, (_, i) => {
    const t = new Date(start.getTime() + (i + 1) * HOUR)
    const pm25 = typicalPm25(t)
    return { cas_utc: t.toISOString(), pm25, pm10: Math.round(pm25 * 1.3) }
  })
  // najboljša ura podnevi (7–20), ko otroci lahko gredo ven
  const day = ure.filter((u) => {
    const hh = new Date(u.cas_utc).getHours()
    return hh >= 7 && hh <= 20
  })
  const best = (day.length ? day : ure).reduce((a, b) => (b.pm25 < a.pm25 ? b : a))
  return { izdano_utc: start.toISOString(), lat: 46.05, lon: 14.51, ure, najboljsa_ura: best.cas_utc }
}

export function mockScene(): SceneResponse {
  const start = startOfHour()
  return {
    ure: Array.from({ length: 24 }, (_, i) => {
      const t = new Date(start.getTime() + i * HOUR)
      const pm25 = typicalPm25(t)
      const h = t.getHours()
      const inverzija = h < 10 || h > 17
      return {
        cas_utc: t.toISOString(),
        pm25,
        inverzija,
        visina_megle_m: inverzija ? 330 + pm25 : 600 + (24 - pm25) * 8,
      }
    }),
  }
}

export function mockDailyGame(): DailyGame {
  return {
    datum: new Date().toISOString().slice(0, 10),
    vprasanje: 'Bo jutri ob 8h zrak v Ljubljani boljši ali slabši kot danes?',
    moznosti: ['Boljši', 'Enak', 'Slabši'],
    vceraj: { vprasanje: 'Bo danes popoldne megla?', pravilen_odgovor: 'Da' },
  }
}

export function mockFacts(): Fact[] {
  return [
    { besedilo: 'Večina delcev PM2.5 v ljubljanski kotlini pozimi prihaja iz kurjenja lesa.', stevilka: '~ 60 %', vir: 'ARSO (primer – preveri)' },
    { besedilo: 'Ob temperaturni inverziji ostane onesnažen zrak ujet v kotlini kot pod pokrovko.', vir: 'ARSO' },
    { besedilo: 'Zračenje: na kratko in na široko odpri okno, ko je zrak najčistejši.', vir: 'NIJZ (primer – preveri)' },
  ]
}

export function mockPlaces(): Place[] {
  return [
    { ime: 'Vrtec Mladi rod', tip: 'vrtec', lat: 46.045, lon: 14.52 },
    { ime: 'OŠ Prule', tip: 'sola', lat: 46.043, lon: 14.507 },
    { ime: 'UKC Ljubljana', tip: 'bolnisnica', lat: 46.0546, lon: 14.5229 },
  ]
}
