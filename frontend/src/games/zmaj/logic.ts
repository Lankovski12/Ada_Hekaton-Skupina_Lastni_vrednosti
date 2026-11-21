// Logika igre »Zmajček čisti nebo« – ločena od prikaza, da jo lahko testiramo
// in kasneje prestavimo v 3D (TresJS) brez spreminjanja pravil.

export interface Smoke {
  id: number
  x: number // 0–100 (%)
  y: number // 0–100 (%)
  size: number
  born: number
}

export interface Level {
  ime: string
  trajanje: number // sekunde
  maxNaZaslonu: number // toliko oblakov in zmajček zakašlja
}

export const LEVELS: Level[] = [
  { ime: 'Sončen dan', trajanje: 30, maxNaZaslonu: 12 },
  { ime: 'Meglen večer', trajanje: 30, maxNaZaslonu: 10 },
  { ime: 'Inverzija!', trajanje: 40, maxNaZaslonu: 9 },
]

/** Koliko novih oblakov na sekundo – odvisno od pravega PM2.5 zdaj. */
export function spawnRate(pm25: number, levelIdx: number): number {
  return 0.6 + pm25 / 25 + levelIdx * 0.4
}

let nextId = 1
export function makeSmoke(now: number): Smoke {
  return {
    id: nextId++,
    x: 8 + Math.random() * 84,
    y: 10 + Math.random() * 60,
    size: 48 + Math.random() * 40,
    born: now,
  }
}
