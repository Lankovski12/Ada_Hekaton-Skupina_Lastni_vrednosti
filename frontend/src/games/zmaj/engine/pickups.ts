// Stvari na nebu, ki jih zmaj ujame:
// - Oblaček Kapljica: na tistem mestu nekaj sekund dežuje in spere del smoga
// - obroč vetra: sunek vetra pospeši zmaja in razširi piš
// - dimnik: dim zgosti smog okoli (otrok vidi, od kod smog prihaja)
// - krog z vprašajem: vprašanje, pravilen odgovor = več časa
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DEZ, DIM, SVET, VETER, VPRASANJA } from '../config'
import type { Dragon } from './dragon'
import type { Smog } from './smog'
import type { Terrain } from './terrain'

export type PickupKind = 'dez' | 'veter' | 'dim' | 'vprasanje'

const V = SVET.vex
const lambert = (color: string) => new THREE.MeshLambertMaterial({ color, flatShading: true })

// --- Oblaček Kapljica ------------------------------------------------------

class RainCloud {
  readonly obj = new THREE.Group()
  private readonly body: THREE.MeshLambertMaterial
  state: 'caka' | 'dezuje' | 'skrit' = 'caka'
  timer = 0
  riseTo = 0 // ko dežuje, se oblaček dvigne nad zmaja

  constructor() {
    this.body = lambert('#e6f3ff')
    const puff = (r: number, x: number, y: number, z: number) => {
      const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), this.body)
      m.position.set(x, y, z)
      this.obj.add(m)
    }
    puff(1, 0, 0, 0)
    puff(0.75, 0.95, -0.2, 0)
    puff(0.75, -0.95, -0.2, 0)
    puff(0.7, 0.4, 0.55, -0.1)
    puff(0.6, -0.45, 0.45, 0)
    const black = lambert('#1d2b3a')
    for (const x of [-0.32, 0.32]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), black)
      eye.position.set(x, 0.1, 0.93)
      const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), lambert('#ff9fb0'))
      cheek.position.set(x * 1.75, -0.15, 0.82)
      this.obj.add(eye, cheek)
    }
    const smile = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.045, 6, 14, Math.PI), black)
    smile.rotation.z = Math.PI
    smile.position.set(0, -0.12, 0.96)
    this.obj.add(smile)
    // kapljica pod oblačkom – da je jasno, da prinaša dež
    const drop = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.45, 8), lambert('#5aa8e6'))
    drop.position.set(0, -1.15, 0.2)
    drop.rotation.x = Math.PI
    this.obj.add(drop)
    this.obj.scale.setScalar(80)
  }

  setRaining(on: boolean) {
    this.body.color.set(on ? '#9db3c8' : '#e6f3ff')
  }
}

// --- dež (črtice, ki padajo) ---------------------------------------------

class RainFx {
  readonly lines: THREE.LineSegments
  private readonly pos: Float32Array
  private readonly n = 700
  private cx = 0
  private cz = 0
  private top = 0
  private ground = 0
  active = 0

  constructor() {
    this.pos = new Float32Array(this.n * 6)
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3))
    this.lines = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: '#a8c8e8', transparent: true, opacity: 0.65 }))
    this.lines.frustumCulled = false
    this.lines.visible = false
  }

  start(x: number, z: number, top: number, ground: number, seconds: number) {
    this.cx = x
    this.cz = z
    this.top = top
    this.ground = ground
    this.active = seconds
    for (let i = 0; i < this.n; i++) this.respawn(i, Math.random())
    this.lines.visible = true
  }

  private respawn(i: number, h: number) {
    const a = Math.random() * Math.PI * 2
    const r = Math.sqrt(Math.random()) * DEZ.polmer * 0.8
    const x = this.cx + Math.cos(a) * r
    const z = this.cz + Math.sin(a) * r
    const y = this.ground + (this.top - this.ground) * h
    this.pos.set([x, y, z, x - 4, y - 70, z], i * 6)
  }

  update(dt: number) {
    if (this.active <= 0) {
      this.lines.visible = false
      return
    }
    this.active -= dt
    for (let i = 0; i < this.n; i++) {
      this.pos[i * 6 + 1]! -= 700 * dt
      this.pos[i * 6 + 4]! -= 700 * dt
      if (this.pos[i * 6 + 4]! < this.ground) this.respawn(i, 1)
    }
    this.lines.geometry.attributes.position!.needsUpdate = true
  }
}

// --- obroč vetra ------------------------------------------------------------

class WindRing {
  readonly obj = new THREE.Group()
  private readonly swirl = new THREE.Group()
  timer = 0

  constructor() {
    const mat = new THREE.MeshBasicMaterial({ color: '#c6f1ff', transparent: true, opacity: 0.9 })
    this.obj.add(new THREE.Mesh(new THREE.TorusGeometry(110, 9, 8, 40), mat))
    const arcMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.7 })
    for (let k = 0; k < 3; k++) {
      const arc = new THREE.Mesh(new THREE.TorusGeometry(65, 4, 6, 20, Math.PI * 0.7), arcMat)
      arc.rotation.z = (k * Math.PI * 2) / 3
      this.swirl.add(arc)
    }
    this.obj.add(this.swirl)
  }

  update(dt: number) {
    this.swirl.rotation.z += dt * 3
  }
}

// --- dimnik -------------------------------------------------------------------

class Chimney {
  readonly obj = new THREE.Group()
  readonly smoke: THREE.Points
  private readonly sp: Float32Array
  private readonly n = 30
  cooldown = 0
  x = 0
  z = 0
  private base = 0
  private height = 400
  private top = 76 // višina vrha dimnika nad tlemi (svet)

  constructor() {
    // začasen kvader, dokler se ne naloži model (ali če ga ni)
    const stack = new THREE.Mesh(new THREE.BoxGeometry(22, 70, 22), lambert('#9b4b36'))
    stack.position.y = 35
    stack.name = 'nadomestek'
    this.obj.add(stack)
    this.sp = new Float32Array(this.n * 3)
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(this.sp, 3))
    this.smoke = new THREE.Points(
      g,
      new THREE.PointsMaterial({ color: '#6f675f', size: 140, transparent: true, opacity: 0.55, depthWrite: false, map: softDot() }),
    )
    this.smoke.frustumCulled = false
  }

  /** Zamenja kvader z modelom dimnika. */
  setModel(model: THREE.Object3D, top: number) {
    const old = this.obj.getObjectByName('nadomestek')
    if (old) this.obj.remove(old)
    this.obj.add(model)
    this.top = top
    this.base = this.obj.position.y + top
  }

  place(x: number, z: number, groundY: number, topY: number) {
    this.x = x
    this.z = z
    this.base = groundY + this.top
    this.height = Math.max(200, topY - groundY + 120 * V)
    this.obj.position.set(x, groundY, z)
    for (let i = 0; i < this.n; i++) this.sp.set([x, this.base + (i / this.n) * this.height, z], i * 3)
  }

  update(dt: number, time: number) {
    if (this.cooldown > 0) this.cooldown -= dt
    for (let i = 0; i < this.n; i++) {
      let y = this.sp[i * 3 + 1]! + 90 * dt
      if (y > this.base + this.height) y = this.base
      const h = (y - this.base) / this.height
      this.sp[i * 3] = this.x + Math.sin(time * 0.8 + i) * 25 * h + h * 120
      this.sp[i * 3 + 1] = y
      this.sp[i * 3 + 2] = this.z + Math.cos(time * 0.7 + i) * 25 * h
    }
    this.smoke.geometry.attributes.position!.needsUpdate = true
  }
}

let dot: THREE.Texture | null = null
function softDot(): THREE.Texture {
  if (dot) return dot
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d')!
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32)
  grd.addColorStop(0, 'rgba(255,255,255,1)')
  grd.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grd
  g.fillRect(0, 0, 64, 64)
  dot = new THREE.CanvasTexture(c)
  return dot
}

function questionTexture(): THREE.Texture {
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const g = c.getContext('2d')!
  const grd = g.createRadialGradient(128, 128, 60, 128, 128, 128)
  grd.addColorStop(0, 'rgba(255,200,60,1)')
  grd.addColorStop(0.75, 'rgba(255,170,30,0.9)')
  grd.addColorStop(1, 'rgba(255,170,30,0)')
  g.fillStyle = grd
  g.beginPath()
  g.arc(128, 128, 128, 0, Math.PI * 2)
  g.fill()
  g.fillStyle = '#ffffff'
  g.font = '900 150px Nunito, system-ui, sans-serif'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText('?', 128, 138)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

// --- upravljalec ---------------------------------------------------------------

export class Pickups {
  readonly group = new THREE.Group()
  private readonly clouds: RainCloud[] = []
  private readonly rings: WindRing[] = []
  private readonly chimneys: Chimney[] = []
  private readonly rain = new RainFx()
  private rainAt: { x: number; z: number } | null = null
  private readonly question: THREE.Sprite
  private questionLife = 0

  constructor(private readonly t: Terrain, private readonly smog: Smog) {
    for (let i = 0; i < DEZ.oblackov; i++) this.clouds.push(new RainCloud())
    for (let i = 0; i < VETER.obrocev; i++) this.rings.push(new WindRing())
    for (let i = 0; i < DIM.dimnikov; i++) this.chimneys.push(new Chimney())
    this.question = new THREE.Sprite(new THREE.SpriteMaterial({ map: questionTexture(), transparent: true, depthWrite: false }))
    this.question.scale.set(170, 170, 1)
    this.question.visible = false
    this.group.add(this.rain.lines, this.question)
    for (const c of this.clouds) this.group.add(c.obj)
    for (const r of this.rings) this.group.add(r.obj)
    for (const c of this.chimneys) this.group.add(c.obj, c.smoke)
    this.loadChimneyModel()
  }

  /** Model dimnika (public/assets/models/dimnik.glb): ~1,17 enote visok, središče v izhodišču. */
  private async loadChimneyModel() {
    try {
      const gltf = await new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}assets/models/dimnik.glb`)
      const src = gltf.scene
      const box = new THREE.Box3().setFromObject(src)
      const height = DIM.visina * V // svet
      const scale = height / (box.max.y - box.min.y)
      for (const c of this.chimneys) {
        const m = src.clone(true)
        m.scale.setScalar(scale)
        m.position.y = -box.min.y * scale // dno na tleh
        // vrh dimnika (brez kepe dima na modelu) je pri ~85 % višine
        c.setModel(m, height * 0.85)
        c.place(c.x, c.z, c.obj.position.y, this.smog.topY)
      }
    } catch {
      // ostane preprost kvader
    }
  }

  /** Nova razporeditev za novo igro (po setConditions, ker je odvisna od smoga). */
  reset() {
    for (const c of this.clouds) this.placeCloud(c)
    for (const r of this.rings) this.placeRing(r)
    const spots = this.smog.hotspots(DIM.dimnikov, 2200)
    this.chimneys.forEach((c, i) => {
      const [x, z] = spots[i] ?? this.smog.randomSmogCell()
      c.place(x, z, this.t.groundY(x, z), this.smog.topY)
      c.cooldown = 0
    })
    this.question.visible = false
    this.questionLife = 0
    this.rain.active = 0
    this.rainAt = null
  }

  private placeCloud(c: RainCloud) {
    const [x, z] = this.smog.randomSmogCell()
    c.obj.position.set(x, this.smog.topY + (90 + Math.random() * 80) * V, z)
    c.obj.visible = true
    c.state = 'caka'
    c.setRaining(false)
  }

  private placeRing(r: WindRing) {
    const [x, z] = this.smog.randomSmogCell()
    r.obj.position.set(x, this.smog.topY + (Math.random() * 90 - 10) * V, z)
    r.obj.rotation.y = Math.random() * Math.PI
    r.obj.visible = true
    r.timer = 0
  }

  /** Vprašaj se pojavi pred zmajem, da ga lahko ujame. */
  spawnQuestion(d: Dragon) {
    const f = d.forward()
    const side = new THREE.Vector3(-f.z, 0, f.x).normalize()
    const p = d.position.clone().addScaledVector(new THREE.Vector3(f.x, 0, f.z).normalize(), 1700)
    p.addScaledVector(side, (Math.random() - 0.5) * 700)
    const lim = (v: number, half: number) => THREE.MathUtils.clamp(v, -half + 1200, half - 1200)
    p.x = lim(p.x, this.t.W / 2)
    p.z = lim(p.z, this.t.H / 2)
    p.y = Math.max(d.position.y, this.t.groundY(p.x, p.z) + 80 * V)
    this.question.position.copy(p)
    this.question.visible = true
    this.questionLife = VPRASANJA.zivi
  }

  update(dt: number, time: number, d: Dragon, camera: THREE.Camera, active: boolean): PickupKind[] {
    const caught: PickupKind[] = []
    const p = d.position

    for (const c of this.clouds) {
      c.obj.position.y += Math.sin(time * 1.3 + c.obj.position.x) * 0.3
      c.obj.rotation.y = Math.atan2(camera.position.x - c.obj.position.x, camera.position.z - c.obj.position.z)
      if (c.state === 'caka' && active && p.distanceTo(c.obj.position) < 190) {
        c.state = 'dezuje'
        c.timer = DEZ.trajanje
        c.setRaining(true)
        c.riseTo = Math.max(c.obj.position.y, p.y) + 220 * V
        this.rainAt = { x: c.obj.position.x, z: c.obj.position.z }
        this.rain.start(c.obj.position.x, c.obj.position.z, c.riseTo - 60, this.t.groundY(c.obj.position.x, c.obj.position.z), DEZ.trajanje)
        caught.push('dez')
      } else if (c.state === 'dezuje') {
        c.obj.position.y += (c.riseTo - c.obj.position.y) * Math.min(1, dt * 3)
        c.timer -= dt
        if (c.timer <= 0) {
          c.state = 'skrit'
          c.obj.visible = false
          c.timer = DEZ.ponovno
        }
      } else if (c.state === 'skrit') {
        c.timer -= dt
        if (c.timer <= 0) this.placeCloud(c)
      }
    }
    if (this.rain.active > 0 && this.rainAt) {
      this.smog.shiftScore(this.rainAt.x, this.rainAt.z, (DEZ.bonus * Math.min(dt, this.rain.active)) / DEZ.trajanje)
    }
    this.rain.update(dt)

    for (const r of this.rings) {
      r.update(dt)
      if (!r.obj.visible) {
        r.timer -= dt
        if (r.timer <= 0) this.placeRing(r)
      } else if (active && p.distanceTo(r.obj.position) < 130) {
        r.obj.visible = false
        r.timer = 6
        caught.push('veter')
      }
    }

    for (const c of this.chimneys) {
      c.update(dt, time)
      const horiz = Math.hypot(p.x - c.x, p.z - c.z)
      if (active && c.cooldown <= 0 && horiz < 170 && p.y < this.smog.topY + 150 * V) {
        c.cooldown = 6
        this.smog.thicken(c.x, c.z, DIM.polmer, DIM.kolicina)
        this.smog.shiftScore(c.x, c.z, -DIM.kazen)
        caught.push('dim')
      }
    }

    if (this.question.visible) {
      this.questionLife -= dt
      const s = 170 + Math.sin(time * 5) * 20
      this.question.scale.set(s, s, 1)
      if (this.questionLife <= 0) this.question.visible = false
      else if (active && p.distanceTo(this.question.position) < 200) {
        this.question.visible = false
        caught.push('vprasanje')
      }
    }
    return caught
  }
}
