// Igralna zanka: povezuje teren, zmaja, smog in piš. Vue komponenta ga samo ustvari in posluša.
import * as THREE from 'three'
import { GAME, gostotaDanes } from '../config'
import { Breath } from './breath'
import { Dragon, type SteerInput } from './dragon'
import { type Conditions, Smog } from './smog'
import { Terrain } from './terrain'
import { buildWorld, GRAD } from './world'

export type { Conditions }

export interface HudState {
  casDo: number // preostale sekunde
  ocisceno: number // 0–1
  piha: boolean
  rob: boolean // zmaj je na robu karte
  vMegli: boolean
}

export interface GameEvents {
  onHud?: (s: HudState) => void
  onEnd?: (ocisceno: number) => void
}

export class ZmajEngine {
  private renderer!: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera = new THREE.PerspectiveCamera(60, 1, 5, 40000)
  private terrain!: Terrain
  private dragon!: Dragon
  private smog!: Smog
  private breath = new Breath()
  private raf = 0
  private clock = new THREE.Clock()
  private time = 0
  private playing = false
  private timeLeft = GAME.trajanje
  private input: SteerInput = { x: 0, y: 0 }
  private blowing = false
  private skyClear = new THREE.Color('#8fc6ee')
  private sky = new THREE.Color()
  private lookAt = new THREE.Vector3()
  private hudAcc = 0
  private ro?: ResizeObserver
  private conditions!: Conditions

  constructor(private readonly host: HTMLElement, private readonly events: GameEvents = {}) {}

  async load(onProgress?: (p: number) => void) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75))
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.host.appendChild(this.renderer.domElement)
    this.renderer.domElement.style.display = 'block'
    this.renderer.domElement.style.touchAction = 'none'

    const [terrain, dragon] = await Promise.all([Terrain.load(), Dragon.load(onProgress)])
    this.terrain = terrain
    this.dragon = dragon
    this.smog = new Smog(terrain)

    this.scene.add(buildWorld(terrain), this.smog.group, this.dragon.group, this.breath.points)
    this.scene.add(new THREE.HemisphereLight('#dfefff', '#56663f', 1.6))
    const sun = new THREE.DirectionalLight('#fff0d8', 2.2)
    sun.position.set(-4000, 3000, 3000) // nizko zimsko sonce z jugozahoda
    this.scene.add(sun)
    this.scene.fog = new THREE.Fog(this.skyClear, 3000, 22000)

    this.bindInput()
    this.resize()
    this.ro = new ResizeObserver(() => this.resize())
    this.ro.observe(this.host)
    this.resetDragon()
    this.clock.start()
    this.raf = requestAnimationFrame(this.loop)
  }

  /** Današnje stanje zraka (pred začetkom igre). */
  setConditions(c: Conditions) {
    this.conditions = c
    const k = gostotaDanes(c.pm25)
    this.smog.setConditions(c, k)
    this.sky.copy(this.skyClear).lerp(this.smog.color, Math.min(0.6, k * 0.6))
    this.scene.background = this.sky
    ;(this.scene.fog as THREE.Fog).color.copy(this.sky)
  }

  start() {
    this.setConditions(this.conditions) // svež smog za vsako igro
    this.resetDragon()
    this.timeLeft = GAME.trajanje
    this.playing = true
  }

  dispose() {
    cancelAnimationFrame(this.raf)
    this.ro?.disconnect()
    this.unbindInput()
    this.renderer?.dispose()
    this.renderer?.domElement.remove()
  }

  private resetDragon() {
    // začne južno od centra tik nad smogom in leti proti gradu
    const [gx, gz] = this.terrain.toXZ(GRAD.lat, GRAD.lon)
    const [sx, sz] = this.terrain.toXZ(46.022, 14.49)
    this.dragon.position.set(sx, this.smog.topY + Terrain.Y(250 + 60), sz)
    this.dragon.yaw = Math.atan2(-(gx - sx), -(gz - sz))
    this.dragon.pitch = 0
    const f = this.dragon.forward()
    this.camera.position.copy(this.dragon.position).addScaledVector(f, -260).add(new THREE.Vector3(0, 90, 0))
    this.lookAt.copy(this.dragon.position)
  }

  private loop = () => {
    const dt = Math.min(0.05, this.clock.getDelta())
    this.time += dt

    // pred igro in po njej zmaj sam kroži, da je za menijem živa slika
    const input = this.playing ? this.input : { x: 0.25, y: 0.05 }
    const blowing = this.playing && this.blowing
    this.dragon.update(dt, this.time, input, this.terrain, blowing)

    const f = this.dragon.forward()
    const mouth = this.dragon.mouthWorld()
    this.breath.update(dt, blowing, mouth, f, f.clone().multiplyScalar(GAME.hitrost))
    if (blowing) this.smog.blow(this.dragon.position, this.dragon.yaw, dt)
    this.smog.update(dt, this.time, this.camera, this.host.clientHeight)

    this.updateCamera(dt)
    this.updateAtmosphere()

    if (this.playing) {
      this.timeLeft -= dt
      this.hudAcc += dt
      if (this.hudAcc > 0.1) {
        this.hudAcc = 0
        this.events.onHud?.({
          casDo: Math.max(0, this.timeLeft),
          ocisceno: this.smog.cleared(),
          piha: blowing,
          rob: this.dragon.outOfBounds,
          vMegli: this.camera.position.y < this.smog.topY,
        })
      }
      if (this.timeLeft <= 0) {
        this.playing = false
        this.blowing = false
        this.events.onEnd?.(this.smog.cleared())
      }
    }

    this.renderer.render(this.scene, this.camera)
    this.raf = requestAnimationFrame(this.loop)
  }

  private updateCamera(dt: number) {
    const p = this.dragon.position
    const yaw = this.dragon.yaw
    const back = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw))
    const desired = p.clone().addScaledVector(back, 230).add(new THREE.Vector3(0, 85, 0))
    const k = 1 - Math.exp(-dt * 3.2)
    this.camera.position.lerp(desired, k)
    const minY = this.terrain.groundY(this.camera.position.x, this.camera.position.z) + 25
    if (this.camera.position.y < minY) this.camera.position.y = minY
    this.lookAt.lerp(p.clone().addScaledVector(this.dragon.forward(), 160), 1 - Math.exp(-dt * 6))
    this.camera.lookAt(this.lookAt)
  }

  /** Ko je kamera v smogu, se vidljivost zmanjša. */
  private updateAtmosphere() {
    const fog = this.scene.fog as THREE.Fog
    const c = this.camera.position
    const inside = c.y < this.smog.topY ? this.smog.densityAt(c.x, c.z) : 0
    const depth = c.y < this.smog.topY ? Math.min(1, (this.smog.topY - c.y) / 200) : 0
    const v = inside * (0.4 + 0.6 * depth)
    fog.near = THREE.MathUtils.lerp(3000, 60, v)
    fog.far = THREE.MathUtils.lerp(22000, 2200, v)
    fog.color.copy(this.sky).lerp(this.smog.color, v)
  }

  private resize() {
    const w = this.host.clientWidth
    const h = this.host.clientHeight
    if (!w || !h) return
    this.renderer.setSize(w, h)
    this.camera.aspect = w / h
    this.camera.fov = w < h ? 75 : 60 // pokončen telefon: širši pogled
    this.camera.updateProjectionMatrix()
  }

  // --- vnos: miška (in za zdaj enako s prstom; nagib telefona pride kasneje) ---
  private onMove = (e: PointerEvent) => {
    const r = this.host.getBoundingClientRect()
    const nx = ((e.clientX - r.left) / r.width) * 2 - 1
    const ny = ((e.clientY - r.top) / r.height) * 2 - 1
    const dz = (v: number) => (Math.abs(v) < 0.06 ? 0 : Math.sign(v) * Math.min(1, (Math.abs(v) - 0.06) / 0.8))
    this.input = { x: dz(nx), y: dz(ny) }
  }
  private onDown = (e: PointerEvent) => {
    if (e.button !== 0) return
    this.blowing = true
    this.onMove(e)
    this.renderer.domElement.setPointerCapture(e.pointerId)
  }
  private onUp = () => {
    this.blowing = false
  }
  private onKey = (e: KeyboardEvent) => {
    if (e.code === 'Space') {
      this.blowing = e.type === 'keydown'
      e.preventDefault()
    }
  }
  private noMenu = (e: Event) => e.preventDefault()

  private bindInput() {
    const el = this.renderer.domElement
    el.addEventListener('pointermove', this.onMove)
    el.addEventListener('pointerdown', this.onDown)
    el.addEventListener('pointerup', this.onUp)
    el.addEventListener('pointercancel', this.onUp)
    el.addEventListener('contextmenu', this.noMenu)
    window.addEventListener('keydown', this.onKey)
    window.addEventListener('keyup', this.onKey)
  }
  private unbindInput() {
    const el = this.renderer?.domElement
    el?.removeEventListener('pointermove', this.onMove)
    el?.removeEventListener('pointerdown', this.onDown)
    el?.removeEventListener('pointerup', this.onUp)
    el?.removeEventListener('pointercancel', this.onUp)
    el?.removeEventListener('contextmenu', this.noMenu)
    window.removeEventListener('keydown', this.onKey)
    window.removeEventListener('keyup', this.onKey)
  }
}
