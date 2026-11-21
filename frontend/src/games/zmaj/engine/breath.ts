// Zmajev piš: delci, ki letijo iz gobca naprej in se širijo.
import * as THREE from 'three'

const N = 420

export class Breath {
  readonly points: THREE.Points
  private readonly pos = new Float32Array(N * 3)
  private readonly vel = new Float32Array(N * 3)
  private readonly age = new Float32Array(N).fill(2)
  private next = 0
  private acc = 0

  constructor() {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3))
    geo.setAttribute('aAge', new THREE.BufferAttribute(this.age, 1))
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        attribute float aAge; varying float vAge;
        void main() {
          vAge = aAge;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aAge > 1.0 ? 0.0 : (10.0 + 95.0 * aAge) * (300.0 / -mv.z);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        varying float vAge;
        void main() {
          float r = length(gl_PointCoord - 0.5);
          float a = smoothstep(0.5, 0.0, r) * (1.0 - vAge) * 0.38;
          gl_FragColor = vec4(mix(vec3(0.85, 0.97, 1.0), vec3(0.6, 0.85, 1.0), vAge), a);
        }`,
    })
    this.points = new THREE.Points(geo, mat)
    this.points.frustumCulled = false
  }

  update(dt: number, blowing: boolean, origin: THREE.Vector3, dir: THREE.Vector3, carry: THREE.Vector3) {
    if (blowing) {
      this.acc += dt * 260
      while (this.acc >= 1) {
        this.acc -= 1
        const i = this.next
        this.next = (this.next + 1) % N
        this.pos.set([origin.x, origin.y, origin.z], i * 3)
        const sp = 420 + Math.random() * 120
        const s = 0.22
        this.vel[i * 3] = (dir.x + (Math.random() - 0.5) * s) * sp + carry.x
        this.vel[i * 3 + 1] = (dir.y + (Math.random() - 0.5) * s) * sp + carry.y
        this.vel[i * 3 + 2] = (dir.z + (Math.random() - 0.5) * s) * sp + carry.z
        this.age[i] = 0
      }
    }
    for (let i = 0; i < N; i++) {
      if (this.age[i]! > 1) continue
      this.age[i]! += dt / 1.3
      this.pos[i * 3]! += this.vel[i * 3]! * dt
      this.pos[i * 3 + 1]! += this.vel[i * 3 + 1]! * dt
      this.pos[i * 3 + 2]! += this.vel[i * 3 + 2]! * dt
      this.vel[i * 3]! *= 0.985
      this.vel[i * 3 + 1]! *= 0.985
      this.vel[i * 3 + 2]! *= 0.985
    }
    this.points.geometry.attributes.position!.needsUpdate = true
    this.points.geometry.attributes.aAge!.needsUpdate = true
  }
}
