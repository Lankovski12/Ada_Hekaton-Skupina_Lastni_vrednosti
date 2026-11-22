// Pretvorba GPS (WGS84) → slovenske koordinate D96/TM (EPSG:3794), v katerih so podatki ARSOhack
// (relief, stavbe, občutljive lokacije). Prečna Mercatorjeva projekcija na elipsoidu GRS80:
// srednji poldnevnik 15° V, merilo 0,9999, lažni vzhod 500 000 m, lažni sever −5 000 000 m.
// Napaka pod 1 m – več kot dovolj za iskanje najbližje postaje ali višine terena.

const a = 6378137
const f = 1 / 298.257222101
const k0 = 0.9999
const lon0 = (15 * Math.PI) / 180
const FE = 500000
const FN = -5000000

export function wgs84ToD96(lat: number, lon: number): { e: number; n: number } {
  const e2 = f * (2 - f)
  const ep2 = e2 / (1 - e2)
  const φ = (lat * Math.PI) / 180
  const λ = (lon * Math.PI) / 180
  const sinφ = Math.sin(φ)
  const cosφ = Math.cos(φ)
  const tanφ = Math.tan(φ)
  const N = a / Math.sqrt(1 - e2 * sinφ * sinφ)
  const T = tanφ * tanφ
  const C = ep2 * cosφ * cosφ
  const A = (λ - lon0) * cosφ
  const e4 = e2 * e2
  const e6 = e4 * e2
  const M =
    a *
    ((1 - e2 / 4 - (3 * e4) / 64 - (5 * e6) / 256) * φ -
      ((3 * e2) / 8 + (3 * e4) / 32 + (45 * e6) / 1024) * Math.sin(2 * φ) +
      ((15 * e4) / 256 + (45 * e6) / 1024) * Math.sin(4 * φ) -
      ((35 * e6) / 3072) * Math.sin(6 * φ))
  const e =
    FE +
    k0 * N * (A + ((1 - T + C) * A ** 3) / 6 + ((5 - 18 * T + T * T + 72 * C - 58 * ep2) * A ** 5) / 120)
  const n =
    FN +
    k0 *
      (M +
        N * tanφ * ((A * A) / 2 + ((5 - T + 9 * C + 4 * C * C) * A ** 4) / 24 + ((61 - 58 * T + T * T + 600 * C - 330 * ep2) * A ** 6) / 720))
  return { e, n }
}

/** razdalja med dvema GPS točkama v metrih (haversine) */
export function razdalja(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000
  const r = Math.PI / 180
  const dφ = (lat2 - lat1) * r
  const dλ = (lon2 - lon1) * r
  const h = Math.sin(dφ / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(dλ / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

/** Obratno od wgs84ToD96: D96/TM (EPSG:3794) -> WGS84. Newtonova iteracija, natančnost pod 1 mm v Sloveniji. */
export function d96ToWgs84(e: number, n: number): { lat: number; lon: number } {
  let lat = 46.05
  let lon = 14.5
  const h = 1e-6
  for (let i = 0; i < 8; i++) {
    const p = wgs84ToD96(lat, lon)
    const fe = p.e - e
    const fn = p.n - n
    if (Math.abs(fe) < 1e-4 && Math.abs(fn) < 1e-4) break
    const pl = wgs84ToD96(lat + h, lon)
    const po = wgs84ToD96(lat, lon + h)
    const a = (pl.e - p.e) / h, b = (po.e - p.e) / h // ∂e/∂lat, ∂e/∂lon
    const c = (pl.n - p.n) / h, d = (po.n - p.n) / h // ∂n/∂lat, ∂n/∂lon
    const det = a * d - b * c
    lat -= (d * fe - b * fn) / det
    lon -= (a * fn - c * fe) / det
  }
  return { lat, lon }
}
