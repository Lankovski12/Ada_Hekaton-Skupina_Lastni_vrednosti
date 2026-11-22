// Včerajšnje jutro (/api/pokrovka, model Open-Meteo) ali dan iz arhiva (meritve ARSO).

export interface Jutro {
  datum: string
  vir: string
  t_dolina: number // °C ob 7h, Ljubljana Bežigrad
  t_hrib: number // °C ob 7h, Pasja ravan (1019 m)
  vlaga: number | null // % v dolini
  pm25: number | null // povprečje dneva v Ljubljani
}

let arhiv: Jutro[] | null = null

export async function naloziArhiv(): Promise<Jutro[]> {
  if (!arhiv) arhiv = ((await (await fetch(`${import.meta.env.BASE_URL}assets/pokrovka/arhiv.json`)).json()) as { dnevi: Jutro[] }).dnevi
  return arhiv
}

export async function naloziVceraj(): Promise<{ jutro: Jutro; izArhiva: boolean }> {
  try {
    const r = await fetch('/api/pokrovka', { signal: AbortSignal.timeout(8000) })
    if (r.ok && r.headers.get('content-type')?.includes('json')) return { jutro: (await r.json()) as Jutro, izArhiva: false }
  } catch {
    /* zaledje ni dosegljivo */
  }
  // zadnji dan z inverzijo iz arhiva – da je igra zanimiva
  const a = await naloziArhiv()
  const inv = a.filter((d) => d.t_hrib > d.t_dolina)
  return { jutro: inv[inv.length - 1] ?? a[a.length - 1]!, izArhiva: true }
}

export async function nakljucnoJutro(razen?: string): Promise<Jutro> {
  const a = (await naloziArhiv()).filter((d) => d.datum !== razen)
  return a[Math.floor(Math.random() * a.length)]!
}

export const datumSl = (iso: string) =>
  new Date(iso).toLocaleDateString('sl-SI', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
