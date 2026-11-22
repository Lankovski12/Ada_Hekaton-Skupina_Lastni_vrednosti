// Razredi kakovosti zraka za PM2.5 (µg/m³).
// Meje so po starejšem evropskem indeksu (EEA) – preproste za razlago otrokom.
// Vsak razred ima dve besedili: sporočilo za otroka (kids) in nasvet za starše (parents).
// Če ima otrok astmo, telefon zamakne meje navzdol (glej useProfile.sensitivity).

export interface AirLevel {
  key: 'odlicno' | 'dobro' | 'zmerno' | 'slabo' | 'zeloSlabo' | 'izjemnoSlabo'
  label: string
  kids: string // sporočilo za otroka (Oblaček pravi …)
  parents: string // nasvet za starše
  color: string // CSS spremenljivka
  hex: string // ista barva za canvas
  mood: number // 0 = vesel oblaček, 1 = zelo žalosten
  max: number
}

export const LEVELS: AirLevel[] = [
  { key: 'odlicno', label: 'Odlično', kids: 'Zrak je čist, čas za igro zunaj!', parents: 'Odličen dan za igrišče, kolo in dolg sprehod. Okna lahko mirno odprete.', color: 'var(--aq-1)', hex: '#2bb673', mood: 0, max: 10 },
  { key: 'dobro', label: 'Dobro', kids: 'Super dan za igro zunaj.', parents: 'Otroci se lahko brez skrbi igrajo zunaj. Dober čas za zračenje.', color: 'var(--aq-2)', hex: '#8ccf3f', mood: 0.15, max: 20 },
  { key: 'zmerno', label: 'Zmerno', kids: 'Ne ostani zunaj predolgo.', parents: 'Igra zunaj je v redu, pri otrocih z astmo pazite na kašelj in težko dihanje.', color: 'var(--aq-3)', hex: '#f2c335', mood: 0.4, max: 25 },
  { key: 'slabo', label: 'Slabo', kids: 'Primeren čas za mirnejšo igro.', parents: 'Skrajšajte igro zunaj in se izogibajte prometnim cestam. Zračite na kratko.', color: 'var(--aq-4)', hex: '#f28c28', mood: 0.65, max: 50 },
  { key: 'zeloSlabo', label: 'Zelo slabo', kids: 'Ostani notri in zapri okno.', parents: 'Otroci naj ostanejo notri. Okna zaprta, telovadbo prestavite v telovadnico.', color: 'var(--aq-5)', hex: '#e5484d', mood: 0.85, max: 75 },
  { key: 'izjemnoSlabo', label: 'Izjemno slabo', kids: 'Danes je zrak res umazan, raje ostani noter.', parents: 'Ostanite doma. Otrok z astmo naj ima zdravila pri roki; ob težavah pokličite zdravnika.', color: 'var(--aq-6)', hex: '#8e4ec6', mood: 1, max: Infinity },
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
