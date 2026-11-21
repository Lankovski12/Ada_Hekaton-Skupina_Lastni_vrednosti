// Smog nad Ljubljano: mreža gostote (0–1) + plasti prosojnih ploskev, ki jo narišejo.
// Osnovna gostota = današnji PM2.5 × (kotlina pod vrhom inverzije) × (kje so izpusti kurišč in prometa).
import * as THREE from 'three'
import { PIH, regeneracija } from '../config'
import { Terrain } from './terrain'

export interface Conditions {
  pm25: number
  vrhPlastiM: number // m n. v. – do kod sega onesnažena plast
  inverzija: boolean
  megla: boolean // prava megla (bela), sicer smog (rjavkasto siv)
}

const LAYERS = 9

export class Smog {
  readonly group = new THREE.Group()
  private readonly nx: number
  private readonly nz: number
  private base: Float32Array
  private d: Float32Array
  private weight: Float32Array // mesto šteje več kot Barje
  private sumBase = 1
  private readonly texData: Uint8Array
  private readonly tex: THREE.DataTexture
  private readonly cx: Float32Array // središča celic
  private readonly cz: Float32Array
  private readonly materials: THREE.ShaderMaterial[] = []
  readonly color = new THREE.Color()
  topY = 0
  private regen = 0.02

  constructor(private readonly t: Terrain) {
    this.nx = t.meta.mreza.nx
    this.nz = t.meta.mreza.nz
    const n = this.nx * this.nz
    this.base = new Float32Array(n)
    this.d = new Float32Array(n)
    this.weight = new Float32Array(n)
    this.texData = new Uint8Array(n)
    this.cx = new Float32Array(n)
    this.cz = new Float32Array(n)
    for (let k = 0; k < this.nz; k++)
      for (let i = 0; i < this.nx; i++) {
        this.cx[k * this.nx + i] = ((i + 0.5) / this.nx - 0.5) * t.W
        this.cz[k * this.nx + i] = ((k + 0.5) / this.nz - 0.5) * t.H
      }
    this.tex = new THREE.DataTexture(this.texData, this.nx, this.nz, THREE.RedFormat, THREE.UnsignedByteType)
    this.tex.magFilter = THREE.LinearFilter
    this.tex.minFilter = THREE.LinearFilter
    this.tex.needsUpdate = true
  }

  setConditions(c: Conditions, intensity: number) {
    const top = c.vrhPlastiM
    const [ox, oz] = this.t.toXZ(46.054, 14.512) // središče mesta
    let sum = 0
    for (let j = 0; j < this.base.length; j++) {
      const h = this.t.heightAt(this.cx[j]!, this.cz[j]!)
      const valley = smoothstep(top + 50, top - 70, h) // 1 = pod vrhom plasti
      const emis = this.t.smog[j]! / 255
      // največ smoga tam, kjer se kuri in vozi; Barje dobi le tanko plast
      let b = valley * intensity * (0.12 + 0.88 * Math.min(1, emis * 1.3))
      if (c.megla) b = Math.max(b, valley * 0.7)
      this.base[j] = Math.min(1, b)
      // točke štejejo nad mestom (krog ~5 km okoli centra), predvsem tam, kjer je izpustov največ
      const r = Math.hypot(this.cx[j]! - ox, this.cz[j]! - oz)
      this.weight[j] = (0.03 + emis * emis) * smoothstep(5500, 4000, r)
      sum += this.base[j]! * this.weight[j]!
    }
    this.sumBase = Math.max(1e-3, sum)
    this.d.set(this.base)
    this.regen = regeneracija(c.pm25)
    this.color.set(c.megla ? '#eef1f3' : '#b9ab97')
    if (c.megla && c.pm25 > 25) this.color.lerp(new THREE.Color('#b8ab97'), 0.5) // megla + smog = sivo rjava
    this.buildLayers(top)
    this.upload()
  }

  private buildLayers(topM: number) {
    this.group.clear()
    this.materials.length = 0
    const bottom = Terrain.Y(255)
    this.topY = Terrain.Y(topM)
    for (let l = 0; l < LAYERS; l++) {
      const f = l / (LAYERS - 1)
      const geo = new THREE.PlaneGeometry(this.t.W, this.t.H)
      geo.rotateX(-Math.PI / 2)
      const m = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: {
          uDens: { value: this.tex },
          uTime: { value: 0 },
          uLayer: { value: f },
          uColor: { value: this.color },
        },
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: /* glsl */ `
          uniform sampler2D uDens; uniform float uTime; uniform float uLayer; uniform vec3 uColor;
          varying vec2 vUv;
          float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
          float noise(vec2 p) {
            vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
            return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
          }
          void main() {
            // vrstica 0 v podatkih = sever; uv.y = 1 je sever
            float d = texture2D(uDens, vec2(vUv.x, 1.0 - vUv.y)).r;
            vec2 q = vUv * vec2(28.0, 23.0) + uLayer * 7.3;
            float n = 0.6 * noise(q + vec2(uTime * 0.05, uTime * 0.03)) + 0.4 * noise(q * 2.3 - uTime * 0.04);
            float edge = smoothstep(0.0, 0.04, vUv.x) * smoothstep(1.0, 0.96, vUv.x) * smoothstep(0.0, 0.04, vUv.y) * smoothstep(1.0, 0.96, vUv.y);
            float a = d * (0.5 + 0.7 * n) * 0.42 * edge;
            // zgornje plasti: kopasti vrh, kot morje megle, iz katerega gledajo hribi
            if (uLayer > 0.6) a *= smoothstep(0.25, 0.75, n + d * 0.35 - (uLayer - 0.6));
            gl_FragColor = vec4(uColor * (0.92 + 0.16 * n), a);
          }`,
      })
      const mesh = new THREE.Mesh(geo, m)
      mesh.position.y = bottom + (this.topY - bottom) * f
      mesh.renderOrder = 2
      this.group.add(mesh)
      this.materials.push(m)
    }
  }

  /** Zmaj piha: zmanjša gostoto v stožcu pred njim. */
  blow(pos: THREE.Vector3, yaw: number, dt: number) {
    const fx = -Math.sin(yaw)
    const fz = -Math.cos(yaw)
    const tanK = Math.tan(PIH.kot)
    // višje nad plastjo = slabši učinek
    const above = Math.max(0, pos.y - this.topY)
    const vf = Math.max(0.25, 1 - above / Terrain.Y(250 + 500))
    for (let j = 0; j < this.d.length; j++) {
      if (this.d[j]! <= 0.001) continue
      const dx = this.cx[j]! - pos.x
      const dz = this.cz[j]! - pos.z
      const along = dx * fx + dz * fz
      if (along < -120 || along > PIH.doseg) continue
      const perp = Math.abs(dx * fz - dz * fx)
      const width = PIH.sirina + Math.max(0, along) * tanK
      if (perp > width) continue
      const s = (1 - Math.max(0, along) / PIH.doseg) * (1 - perp / width)
      this.d[j] = Math.max(0, this.d[j]! - PIH.moc * s * vf * dt)
    }
  }

  /** Smog se počasi vrača (hitreje, če je danes več PM2.5). */
  update(dt: number, time: number) {
    const k = Math.min(1, this.regen * dt)
    for (let j = 0; j < this.d.length; j++) this.d[j]! += (this.base[j]! - this.d[j]!) * k
    for (const m of this.materials) m.uniforms.uTime!.value = time
    this.upload()
  }

  private upload() {
    for (let j = 0; j < this.d.length; j++) this.texData[j] = Math.round(this.d[j]! * 255)
    this.tex.needsUpdate = true
  }

  /** delež očiščenega neba (0–1) */
  cleared(): number {
    let s = 0
    for (let j = 0; j < this.d.length; j++) s += this.d[j]! * this.weight[j]!
    return Math.max(0, Math.min(1, 1 - s / this.sumBase))
  }

  densityAt(x: number, z: number): number {
    const i = Math.floor((x / this.t.W + 0.5) * this.nx)
    const k = Math.floor((z / this.t.H + 0.5) * this.nz)
    if (i < 0 || k < 0 || i >= this.nx || k >= this.nz) return 0
    return this.d[k * this.nx + i]!
  }
}

function smoothstep(e0: number, e1: number, x: number) {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)))
  return t * t * (3 - 2 * t)
}
