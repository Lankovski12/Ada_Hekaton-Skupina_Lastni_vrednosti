// Teren Ljubljane iz public/assets/terrain (pripravi backend/scripts/build_game_assets.py).
// Koordinate sveta: x = vzhod (m), z = jug (m), izhodišče v središču karte, y = (višina - h0) * vex.
import { SVET } from '../config'

export interface TerrainMeta {
  lon: [number, number]
  lat: [number, number]
  lat0: number
  sirina_m: number
  visina_m: number
  teren: { nx: number; nz: number; min_m: number; max_m: number }
  mreza: { nx: number; nz: number }
}

const BASE = `${import.meta.env.BASE_URL}assets/terrain/`

export class Terrain {
  readonly W: number
  readonly H: number
  private readonly mPerLon: number
  private readonly lonC: number
  private readonly latC: number

  constructor(
    readonly meta: TerrainMeta,
    readonly heights: Float32Array, // m n. v., vrstica 0 = sever
    readonly mesto: Uint8Array,
    readonly smog: Uint8Array,
  ) {
    this.W = meta.sirina_m
    this.H = meta.visina_m
    this.mPerLon = 111_320 * Math.cos((meta.lat0 * Math.PI) / 180)
    this.lonC = (meta.lon[0] + meta.lon[1]) / 2
    this.latC = (meta.lat[0] + meta.lat[1]) / 2
  }

  static async load(): Promise<Terrain> {
    const [meta, h, m, s] = await Promise.all([
      fetch(`${BASE}teren.json`).then((r) => r.json() as Promise<TerrainMeta>),
      fetch(`${BASE}teren.bin`).then((r) => r.arrayBuffer()),
      fetch(`${BASE}mesto.bin`).then((r) => r.arrayBuffer()),
      fetch(`${BASE}smog.bin`).then((r) => r.arrayBuffer()),
    ])
    const dm = new Uint16Array(h)
    const heights = new Float32Array(dm.length)
    for (let i = 0; i < dm.length; i++) heights[i] = dm[i]! / 10
    return new Terrain(meta, heights, new Uint8Array(m), new Uint8Array(s))
  }

  /** geografske koordinate -> svet (x, z) v metrih */
  toXZ(lat: number, lon: number): [number, number] {
    return [(lon - this.lonC) * this.mPerLon, -(lat - this.latC) * 111_320]
  }

  /** višina v metrih n. v. (bilinearno) */
  heightAt(x: number, z: number): number {
    const { nx, nz } = this.meta.teren
    return bilinear(this.heights, nx, nz, (x / this.W + 0.5) * nx - 0.5, (z / this.H + 0.5) * nz - 0.5)
  }

  /** gostota mesta ali izpustov (0–1) na mreži 'mreza' */
  gridAt(arr: Uint8Array, x: number, z: number): number {
    const { nx, nz } = this.meta.mreza
    return bilinear(arr, nx, nz, (x / this.W + 0.5) * nx - 0.5, (z / this.H + 0.5) * nz - 0.5) / 255
  }

  /** y v svetu za višino v metrih */
  static Y(m: number): number {
    return (m - SVET.h0) * SVET.vex
  }
  static fromY(y: number): number {
    return y / SVET.vex + SVET.h0
  }

  groundY(x: number, z: number): number {
    return Terrain.Y(this.heightAt(x, z))
  }
}

function bilinear(a: ArrayLike<number>, nx: number, nz: number, fx: number, fz: number): number {
  fx = Math.max(0, Math.min(nx - 1.001, fx))
  fz = Math.max(0, Math.min(nz - 1.001, fz))
  const x0 = Math.floor(fx)
  const z0 = Math.floor(fz)
  const tx = fx - x0
  const tz = fz - z0
  const i = z0 * nx + x0
  return (
    a[i]! * (1 - tx) * (1 - tz) + a[i + 1]! * tx * (1 - tz) + a[i + nx]! * (1 - tx) * tz + a[i + nx + 1]! * tx * tz
  )
}
