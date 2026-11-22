// Edini kraj, ki ve, kje je API.
// - Docker in fly.io: frontend in API sta na istem naslovu.
// - npm run dev: Vite preusmeri /api na http://localhost:8000 (vite.config.ts).
// Če zaledje ne odgovori, vrnemo zadnji shranjen odgovor ali povprečja meritev ARSO (api/mock.ts),
// da aplikacija in igre delujejo tudi brez interneta.

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true'

export type DataOrigin = 'api' | 'predpomnilnik' | 'arhiv ARSO'

export async function getJson<T>(
  path: string,
  fallback: () => T,
): Promise<{ data: T; origin: DataOrigin }> {
  const cacheKey = `zrak-cache:${path}`
  if (!USE_MOCK) {
    try {
      const res = await fetch(path, { signal: AbortSignal.timeout(6000) })
      if (!res.ok || !res.headers.get('content-type')?.includes('json')) throw new Error(`${res.status}`)
      const data = (await res.json()) as T
      try {
        localStorage.setItem(cacheKey, JSON.stringify(data))
      } catch {
        /* zasebni način ipd. */
      }
      return { data, origin: 'api' }
    } catch {
      try {
        const cached = localStorage.getItem(cacheKey)
        if (cached) return { data: JSON.parse(cached) as T, origin: 'predpomnilnik' }
      } catch {
        /* ignoriraj */
      }
    }
  }
  return { data: fallback(), origin: 'arhiv ARSO' }
}
