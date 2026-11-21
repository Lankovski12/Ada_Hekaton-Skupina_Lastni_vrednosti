// Razredi kakovosti zraka za PM2.5 (µg/m³).
// Meje so po starejšem evropskem indeksu (EEA) – preprosto za razlago otrokom.
// Za astmatike telefon zamakne meje navzdol (glej useProfile.sensitivity).

export interface AirLevel {
  key: 'odlicno' | 'dobro' | 'zmerno' | 'slabo' | 'zeloSlabo' | 'izjemnoSlabo'
  label: string
  kids: string // razlaga za otroke
  color: string // CSS spremenljivka
  hex: string // ista barva za canvas
  mood: number // 0 = vesel oblaček, 1 = zelo žalosten
  max: number
}

export const LEVELS: AirLevel[] = [
  { key: 'odlicno', label: 'Odlično', kids: 'Zrak je čist kot gorski potok!', color: 'var(--aq-1)', hex: '#2bb673', mood: 0, max: 10 },
  { key: 'dobro', label: 'Dobro', kids: 'Super dan za igro zunaj.', color: 'var(--aq-2)', hex: '#8ccf3f', mood: 0.15, max: 20 },
  { key: 'zmerno', label: 'Zmerno', kids: 'V redu, a ne divjaj predolgo.', color: 'var(--aq-3)', hex: '#f2c335', mood: 0.4, max: 25 },
  { key: 'slabo', label: 'Slabo', kids: 'Danes raje mirnejša igra.', color: 'var(--aq-4)', hex: '#f28c28', mood: 0.65, max: 50 },
  { key: 'zeloSlabo', label: 'Zelo slabo', kids: 'Ostani notri in zapri okno.', color: 'var(--aq-5)', hex: '#e5484d', mood: 0.85, max: 75 },
  { key: 'izjemnoSlabo', label: 'Izjemno slabo', kids: 'Danes je zrak res umazan – igre v hiši!', color: 'var(--aq-6)', hex: '#8e4ec6', mood: 1, max: Infinity },
]

/** sensitivity < 1 pomeni strožje meje (npr. astma 0.7) */
export function levelFor(pm25: number, sensitivity = 1): AirLevel {
  return LEVELS.find((l) => pm25 <= l.max * sensitivity) ?? LEVELS[LEVELS.length - 1]!
}

export function formatHour(iso: string): string {
  return new Date(iso).toLocaleTimeString('sl-SI', { hour: '2-digit', minute: '2-digit' })
}

export function formatDayHour(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('sl-SI', { weekday: 'short', hour: '2-digit' })
}
