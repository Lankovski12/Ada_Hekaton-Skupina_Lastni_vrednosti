// Podatki enega dneva za Vremenskega vedeževalca: včeraj (/api/vceraj) ali dan iz arhiva (vaja, rezerva).
// Oblika je enaka v obeh primerih (backend/app/daily.py in backend/scripts/build_daily_archive.py).

export interface Postaja {
  id: string
  ime: string
  lat: number
  lon: number
  pm25: number
  pm10: number | null
}

export interface Vreme {
  padavine_mm: number | null
  veter_kmh: number | null
  temp_c: number | null
  mejna_plast_m: number | null // jutranja višina mejne plasti (ocena modela)
}

export interface Dan {
  datum: string
  vir: string
  postaje: Postaja[]
  ure: (number | null)[] // 24 ur PM2.5 na Bežigradu (lokalni čas)
  vreme: Vreme | null
  prejsnji: { pm25: number | null; vreme: Vreme | null } | null
}

let arhiv: Dan[] | null = null

export async function naloziArhiv(): Promise<Dan[]> {
  if (arhiv) return arhiv
  const r = await fetch(`${import.meta.env.BASE_URL}assets/daily/arhiv.json`)
  arhiv = ((await r.json()) as { dnevi: Dan[] }).dnevi
  return arhiv
}

/** Včerajšnji dan. Če zaledje nima podatkov, vrne zadnji dan iz arhiva (in to označi). */
export async function naloziVceraj(): Promise<{ dan: Dan; izArhiva: boolean }> {
  try {
    const r = await fetch('/api/vceraj', { signal: AbortSignal.timeout(8000) })
    if (r.ok && r.headers.get('content-type')?.includes('json')) return { dan: (await r.json()) as Dan, izArhiva: false }
  } catch {
    /* zaledje ni dosegljivo */
  }
  const a = await naloziArhiv()
  return { dan: a[a.length - 1]!, izArhiva: true }
}

export async function nakljucenDan(razen?: string): Promise<Dan> {
  const a = (await naloziArhiv()).filter((d) => d.datum !== razen)
  return a[Math.floor(Math.random() * a.length)]!
}

// --- lepša imena postaj za otroke ---
const MESTA: Record<string, string> = {
  LJ: 'Ljubljana',
  MB: 'Maribor',
  CE: 'Celje',
  MS: 'Murska Sobota',
  NG: 'Nova Gorica',
  IB: 'Ilirska Bistrica',
}

/** »LJ Bežigrad« -> »Ljubljana (Bežigrad)«, »Zagorje« ostane »Zagorje«. */
export function lepoIme(ime: string): string {
  const [pre, ...rest] = ime.split(' ')
  const mesto = MESTA[pre!]
  return mesto ? `${mesto} (${rest.join(' ')})` : ime
}

/** Samo ime kraja (za razvrščanje mest). */
export function kraj(ime: string): string {
  const [pre] = ime.split(' ')
  return MESTA[pre!] ?? ime
}

export function datumSl(iso: string): string {
  return new Date(iso).toLocaleDateString('sl-SI', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}
