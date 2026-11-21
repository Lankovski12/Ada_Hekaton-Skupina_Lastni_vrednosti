// Povprečja meritev ARSO (paket ARSOhack) za vsak mesec in uro – iz src/data/zgodovina.json
// (izračuna backend/scripts/blog_statistika.py). Uporabimo jih, kadar ni žive meritve ali napovedi,
// namesto izmišljenih številk. Isto datoteko bere zaledje (backend/data/zgodovina.json).
import z from '@/data/zgodovina.json'

type Key = 'pm25' | 'pm10' | 'inverzija' | 'mejnaPlast'
const ARSO_OFFSET_H = 1 // ARSO: lokalni čas UTC+1 brez poletnega premika

export function typical(date: Date, key: Key): number {
  const local = new Date(date.getTime() + ARSO_OFFSET_H * 3600_000)
  return z.klima[key][local.getUTCMonth()]![local.getUTCHours()]!
}

/** Običajen PM2.5 v Ljubljani ob tej uri v tem mesecu (povprečje meritev ARSO). */
export const typicalPm25 = (date = new Date()) => Math.round(typical(date, 'pm25'))

export const klimaLabel = `ARSO Bežigrad ${z.pm25Od}–${z.zadnjeLeto}`
