// Črte hitrosti: ob sunku vetra mimo kamere švigajo bele črte (kot v risankah).
import * as THREE from 'three'

const N = 160

export class SpeedLines {
  readonly lines: THREE.LineSegments
  private readonly pos = new Float32Array(N * 6)
  private readonly seed = new Float32Array(N * 3) // kot, polmer, razdalja
  private readonly mat: THREE.LineBasicMaterial
  private strength = 0

  constructor() {
    for (let i = 0; i < N; i++) this.reset(i, Math.random())
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3))
    this.mat = new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false })
    this.lines = new THREE.LineSegments(g, this.mat)
    this.lines.frustumCulled = false
    this.lines.renderOrder = 20
  }

  private reset(i: number, d = 1) {
    this.seed[i * 3] = Math.random() * Math.PI * 2
    this.seed[i * 3 + 1] = 25 + Math.random() * 90
    this.seed[i * 3 + 2] = 60 + d * 500
  }

  /** active: ali je sunek vetra; črte so pritrjene na kamero. */
  update(dt: number, active: boolean, camera: THREE.Camera) {
    this.strength += ((active ? 1 : 0) - this.strength) * Math.min(1, dt * 5)
    this.mat.opacity = this.strength * 0.7
    this.lines.visible = this.strength > 0.02
    if (!this.lines.visible) return
    const fwd = new THREE.Vector3()
    camera.getWorldDirection(fwd)
    const right = new THREE.Vector3().crossVectors(fwd, camera.up).normalize()
    const up = new THREE.Vector3().crossVectors(right, fwd).normalize()
    const c = camera.position
    for (let i = 0; i < N; i++) {
      this.seed[i * 3 + 2]! -= 1400 * dt
      if (this.seed[i * 3 + 2]! < 20) this.reset(i)
      const a = this.seed[i * 3]!
      const r = this.seed[i * 3 + 1]!
      const d = this.seed[i * 3 + 2]!
      const ox = Math.cos(a) * r
      const oy = Math.sin(a) * r
      const len = 40 + this.strength * 60
      for (let k = 0; k < 2; k++) {
        const dd = d + k * len
        const o = i * 6 + k * 3
        this.pos[o] = c.x + fwd.x * dd + right.x * ox + up.x * oy
        this.pos[o + 1] = c.y + fwd.y * dd + right.y * ox + up.y * oy
        this.pos[o + 2] = c.z + fwd.z * dd + right.z * ox + up.z * oy
      }
    }
    this.lines.geometry.attributes.position!.needsUpdate = true
  }
}
