// Smog nad Ljubljano.
// - mreža gostote (0–1) nad karto: koliko smoga je kje
// - »oblaki«: ~1.800 mehkih kep v kotlini; vsaka je toliko vidna, kolikor je smoga v njeni celici
// - tanka meglica (plasti) pod njimi, da je kotlina zabrisana
// Ko zmaj piha, gostota v stožcu pade in kepe izginejo; potem se počasi vrnejo (hitreje pri več PM2.5).
import * as THREE from 'three'
import { PIH, regeneracija, SVET } from '../config'
import { Terrain } from './terrain'

export interface Conditions {
  pm25: number
  vrhPlastiM: number // m n. v. – do kod sega onesnažena plast
  inverzija: boolean
  megla: boolean // prava megla (bela), sicer smog (sivo rjav)
}

const LAYERS = 6
const PUFFS = 1800

export class Smog {
  readonly group = new THREE.Group()
  readonly color = new THREE.Color()
  topY = 0
  private readonly nx: number
  private readonly nz: number
  private readonly base: Float32Array
  private readonly d: Float32Array
  private readonly weight: Float32Array // točke štejejo nad mestom
  private sumBase = 1
  private regen = 0.02
  private readonly texData: Uint8Array
  private readonly tex: THREE.DataTexture
  private readonly cx: Float32Array
  private readonly cz: Float32Array
  private readonly layerMats: THREE.ShaderMaterial[] = []

  // kepe
  private readonly puffPos = new Float32Array(PUFFS * 3)
  private readonly puffHome = new Float32Array(PUFFS * 3)
  private readonly puffCell = new Int32Array(PUFFS)
  private readonly puffAlpha = new Float32Array(PUFFS)
  private readonly puffSize = new Float32Array(PUFFS)
  private readonly puffSeed = new Float32Array(PUFFS)
  private readonly puffs: THREE.Points
  private readonly puffMat: THREE.ShaderMaterial

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

    for (let p = 0; p < PUFFS; p++) this.puffSeed[p] = Math.random()
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(this.puffPos, 3))
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.puffAlpha, 1))
    geo.setAttribute('aSize', new THREE.BufferAttribute(this.puffSize, 1))
    geo.setAttribute('aSeed', new THREE.BufferAttribute(this.puffSeed, 1))
    this.puffMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { uColor: { value: this.color }, uScale: { value: 500 }, uTime: { value: 0 } },
      vertexShader: /* glsl */ `
        attribute float aAlpha; attribute float aSize; attribute float aSeed;
        uniform float uScale;
        varying float vAlpha; varying float vSeed; varying float vFade;
        void main() {
          vAlpha = aAlpha; vSeed = aSeed;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          float dist = -mv.z;
          vFade = smoothstep(20.0, 180.0, dist); // ne zakrij kamere, ko letiš skozi
          gl_PointSize = aAlpha < 0.01 ? 0.0 : min(aSize * uScale / dist, 900.0);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor; uniform float uTime;
        varying float vAlpha; varying float vSeed; varying float vFade;
        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float noise(vec2 p) {
          vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
        }
        void main() {
          vec2 c = gl_PointCoord - 0.5;
          float r = length(c);
          float n = noise(c * 4.0 + vSeed * 50.0 + uTime * 0.05) * 0.6 + noise(c * 9.0 - vSeed * 20.0) * 0.4;
          float a = smoothstep(0.5, 0.1, r + (n - 0.5) * 0.25) * vAlpha * vFade;
          if (a < 0.01) discard;
          // spodaj malo temnejše, zgoraj svetlejše – da je kepa videti okrogla
          vec3 col = uColor * (0.86 + 0.3 * (0.5 - c.y));
          gl_FragColor = vec4(col, a * 0.72);
        }`,
    })
    this.puffs = new THREE.Points(geo, this.puffMat)
    this.puffs.frustumCulled = false
    this.puffs.renderOrder = 3
  }

  setConditions(c: Conditions, intensity: number) {
    const top = c.vrhPlastiM
    this.topY = Terrain.Y(top)
    const [ox, oz] = this.t.toXZ(46.054, 14.512) // središče mesta
    let sum = 0
    for (let j = 0; j < this.base.length; j++) {
      const h = this.t.heightAt(this.cx[j]!, this.cz[j]!)
      const valley = smoothstep(top + 20, top - 60, h) // 1 = pod vrhom plasti
      const emis = this.t.smog[j]! / 255
      // največ smoga tam, kjer se kuri in vozi; Barje dobi tanjšo plast
      let b = valley * intensity * (0.3 + 0.7 * Math.min(1, emis * 1.4))
      if (c.megla) b = Math.max(b, valley * 0.8)
      this.base[j] = Math.min(1, b)
      const r = Math.hypot(this.cx[j]! - ox, this.cz[j]! - oz)
      this.weight[j] = (0.05 + emis * emis) * smoothstep(5500, 4000, r)
      sum += this.base[j]! * this.weight[j]!
    }
    this.sumBase = Math.max(1e-3, sum)
    this.d.set(this.base)
    this.regen = regeneracija(c.pm25)
    this.color.set(c.megla ? '#f1f3f5' : '#d2cdc4') // smog: svetlo siv z rahlim rjavim odtenkom
    if (c.megla && c.pm25 > 25) this.color.lerp(new THREE.Color('#d6cfc2'), 0.5)
    this.placePuffs()
    this.buildLayers()
    this.upload()
  }

  /** Kepe razporedimo po celicah, kjer je smog – več kep tam, kjer ga je več. */
  private placePuffs() {
    const cells: number[] = []
    const cum: number[] = []
    let acc = 0
    for (let j = 0; j < this.base.length; j++)
      if (this.base[j]! > 0.05) {
        acc += this.base[j]!
        cells.push(j)
        cum.push(acc)
      }
    const cw = this.t.W / this.nx
    const ch = this.t.H / this.nz
    for (let p = 0; p < PUFFS; p++) {
      if (!cells.length) {
        this.puffCell[p] = -1
        continue
      }
      const u = Math.random() * acc
      let lo = 0
      let hi = cum.length - 1
      while (lo < hi) {
        const mid = (lo + hi) >> 1
        if (cum[mid]! < u) lo = mid + 1
        else hi = mid
      }
      const j = cells[lo]!
      const x = this.cx[j]! + (Math.random() - 0.5) * cw
      const z = this.cz[j]! + (Math.random() - 0.5) * ch
      const g = this.t.groundY(x, z)
      const y = g + 10 + Math.random() * Math.max(10, this.topY - g - 10)
      this.puffHome.set([x, y, z], p * 3)
      this.puffPos.set([x, y, z], p * 3)
      this.puffCell[p] = j
      this.puffSize[p] = 350 + Math.random() * 400 // m
    }
    this.puffs.geometry.attributes.position!.needsUpdate = true
    this.puffs.geometry.attributes.aSize!.needsUpdate = true
  }

  /** Tanka meglica pod kepami, da je kotlina zabrisana. */
  private buildLayers() {
    this.group.clear()
    this.layerMats.length = 0
    const bottom = Terrain.Y(SVET.dnoKotline - 20)
    for (let l = 0; l < LAYERS; l++) {
      const f = l / (LAYERS - 1)
      const geo = new THREE.PlaneGeometry(this.t.W, this.t.H)
      geo.rotateX(-Math.PI / 2)
      const m = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: { uDens: { value: this.tex }, uLayer: { value: f }, uColor: { value: this.color } },
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: /* glsl */ `
          uniform sampler2D uDens; uniform float uLayer; uniform vec3 uColor;
          varying vec2 vUv;
          void main() {
            float d = texture2D(uDens, vec2(vUv.x, 1.0 - vUv.y)).r; // vrstica 0 = sever
            float edge = smoothstep(0.0, 0.03, vUv.x) * smoothstep(1.0, 0.97, vUv.x) * smoothstep(0.0, 0.03, vUv.y) * smoothstep(1.0, 0.97, vUv.y);
            gl_FragColor = vec4(uColor, d * 0.16 * (1.0 - uLayer * 0.5) * edge);
          }`,
      })
      const mesh = new THREE.Mesh(geo, m)
      mesh.position.y = bottom + (this.topY - bottom) * f
      mesh.renderOrder = 2
      this.group.add(mesh)
      this.layerMats.push(m)
    }
    this.group.add(this.puffs)
  }

  /** Zmaj piha: zmanjša gostoto v stožcu pred njim (vodoravno). */
  blow(pos: THREE.Vector3, yaw: number, dt: number, widthMul = 1) {
    const fx = -Math.sin(yaw)
    const fz = -Math.cos(yaw)
    const tanK = Math.tan(PIH.kot)
    const above = Math.max(0, pos.y - this.topY) // visoko nad plastjo piha slabše
    const vf = Math.max(0.3, 1 - above / Terrain.Y(SVET.h0 + 400))
    for (let j = 0; j < this.d.length; j++) {
      if (this.d[j]! <= 0.001) continue
      const dx = this.cx[j]! - pos.x
      const dz = this.cz[j]! - pos.z
      const along = dx * fx + dz * fz
      if (along < -150 || along > PIH.doseg) continue
      const perp = Math.abs(dx * fz - dz * fx)
      const width = (PIH.sirina + Math.max(0, along) * tanK) * widthMul
      if (perp > width) continue
      const s = (1 - Math.max(0, along) / PIH.doseg) * (1 - perp / width)
      this.d[j] = Math.max(0, this.d[j]! - PIH.moc * s * vf * dt)
    }
  }

  /** Dež: v krogu okoli (x, z) spere del smoga (moc = delež na sekundo v središču). */
  rain(x: number, z: number, radius: number, moc: number, dt: number) {
    for (let j = 0; j < this.d.length; j++) {
      const r = Math.hypot(this.cx[j]! - x, this.cz[j]! - z)
      if (r > radius) continue
      const f = 1 - (r / radius) ** 2
      this.d[j]! *= 1 - Math.min(1, moc * f * dt)
    }
  }

  /** Dim iz dimnika: v krogu okoli (x, z) doda smog. */
  thicken(x: number, z: number, radius: number, amount: number) {
    for (let j = 0; j < this.d.length; j++) {
      const r = Math.hypot(this.cx[j]! - x, this.cz[j]! - z)
      if (r > radius) continue
      this.d[j] = Math.min(1, this.d[j]! + amount * (1 - r / radius))
    }
  }

  /** Celice z največ izpusti iz kurišč (za dimnike) in naključne celice s smogom (za oblačke, obroče). */
  hotspots(n: number, minDist: number): [number, number][] {
    const idx = Array.from(this.base.keys()).sort((a, b) => this.t.smog[b]! - this.t.smog[a]!)
    const out: [number, number][] = []
    for (const j of idx) {
      if (this.base[j]! < 0.2) continue
      const x = this.cx[j]!
      const z = this.cz[j]!
      if (out.every(([ox, oz]) => Math.hypot(ox - x, oz - z) > minDist)) out.push([x, z])
      if (out.length >= n) break
    }
    return out
  }

  randomSmogCell(): [number, number] {
    for (let tries = 0; tries < 200; tries++) {
      const j = Math.floor(Math.random() * this.base.length)
      if (this.base[j]! > 0.25) return [this.cx[j]!, this.cz[j]!]
    }
    return [0, 0]
  }

  /** Smog se vrača; kepe sledijo gostoti svoje celice in se rahlo premikajo. */
  update(dt: number, time: number, camera: THREE.PerspectiveCamera, viewportH: number) {
    const k = Math.min(1, this.regen * dt)
    for (let j = 0; j < this.d.length; j++) this.d[j]! += (this.base[j]! - this.d[j]!) * k
    this.upload()

    for (let p = 0; p < PUFFS; p++) {
      const j = this.puffCell[p]!
      const target = j < 0 ? 0 : Math.min(1, this.d[j]! * 1.25)
      // kepa hitro izgine in počasi spet zraste
      const rate = target < this.puffAlpha[p]! ? 6 : 1.2
      this.puffAlpha[p]! += (target - this.puffAlpha[p]!) * Math.min(1, rate * dt)
      const s = this.puffSeed[p]!
      this.puffPos[p * 3] = this.puffHome[p * 3]! + Math.sin(time * 0.05 + s * 40) * 60
      this.puffPos[p * 3 + 1] = this.puffHome[p * 3 + 1]! + Math.sin(time * 0.2 + s * 20) * 6
      this.puffPos[p * 3 + 2] = this.puffHome[p * 3 + 2]! + Math.cos(time * 0.04 + s * 30) * 60
    }
    const g = this.puffs.geometry.attributes
    g.position!.needsUpdate = true
    g.aAlpha!.needsUpdate = true
    this.puffMat.uniforms.uTime!.value = time
    this.puffMat.uniforms.uScale!.value = viewportH / (2 * Math.tan((camera.fov * Math.PI) / 360))
  }

  private upload() {
    for (let j = 0; j < this.d.length; j++) this.texData[j] = Math.round(this.d[j]! * 255)
    this.tex.needsUpdate = true
  }

  /** delež očiščenega neba nad mestom (0–1) */
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
