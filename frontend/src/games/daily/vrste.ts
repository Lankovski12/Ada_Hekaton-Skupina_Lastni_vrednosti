// Sedem vrst vprašanj. Vsak dan je na vrsti ena (po dnevu v letu), če za dan ni podatkov, naslednja možna.
import type { Dan } from './dan'

export type Vrsta = 'zemljevid' | 'drsnik' | 'ura' | 'barvanje' | 'razvrsti' | 'pokrovka' | 'detektiv'

export const VRSTE: { id: Vrsta; ime: string }[] = [
  { id: 'zemljevid', ime: 'Zemljevid' },
  { id: 'drsnik', ime: 'Drsnik' },
  { id: 'ura', ime: 'Ura' },
  { id: 'barvanje', ime: 'Pobarvaj dan' },
  { id: 'razvrsti', ime: 'Razvrsti' },
  { id: 'pokrovka', ime: 'Pokrovka' },
  { id: 'detektiv', ime: 'Detektiv' },
]

/** Rezultat naloge: 0–3 zvezdice in razlaga za otroka. */
export interface Rezultat {
  zvezdice: number
  razlaga: string
}

export function mozna(v: Vrsta, d: Dan): boolean {
  const ure = d.ure.filter((x) => x != null).length
  switch (v) {
    case 'zemljevid':
      return d.postaje.length >= 4
    case 'drsnik':
      return d.postaje.some((p) => p.id === 'E403' || p.ime === 'LJ Bežigrad')
    case 'ura':
    case 'barvanje':
      return ure >= 18
    case 'razvrsti':
      return new Set(d.postaje.map((p) => p.ime.split(' ')[0])).size >= 4
    case 'pokrovka':
      return d.vreme?.mejna_plast_m != null
    case 'detektiv': {
      const a = d.vreme
      const b = d.prejsnji?.vreme
      if (d.prejsnji?.pm25 == null || !a || !b) return false
      // če sta dneva po vremenu enaka (napaka v vhodnih podatkih), iz namigov ni mogoče sklepati
      return !(a.temp_c === b.temp_c && a.veter_kmh === b.veter_kmh && a.padavine_mm === b.padavine_mm)
    }
  }
}

function dayOfYear(iso: string): number {
  const d = new Date(iso)
  return Math.floor((d.getTime() - new Date(d.getFullYear(), 0, 0).getTime()) / 86_400_000)
}

/** Vrsta za dan: kroži po sedmih, preskoči tiste, za katere ni podatkov. */
export function vrstaZaDan(d: Dan, nakljucno = false): Vrsta {
  const start = nakljucno ? Math.floor(Math.random() * 7) : dayOfYear(d.datum) % 7
  for (let k = 0; k < 7; k++) {
    const v = VRSTE[(start + k) % 7]!.id
    if (mozna(v, d)) return v
  }
  return 'drsnik'
}

/** Bežigrad (dnevno povprečje) */
export function bezigrad(d: Dan): number | null {
  return d.postaje.find((p) => p.id === 'E403' || p.ime === 'LJ Bežigrad')?.pm25 ?? null
}
