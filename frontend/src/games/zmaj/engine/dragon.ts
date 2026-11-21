// Zmaj: model iz public/assets/models/zmaj.glb, krila mahajo s shaderjem (model nima okostja),
// let: sam leti naprej, miška določa zavijanje in vzpon.
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { GAME, SVET } from '../config'
import { Terrain } from './terrain'

const URL = `${import.meta.env.BASE_URL}assets/models/zmaj.glb`

export interface SteerInput {
  x: number // -1 levo … 1 desno
  y: number // -1 gor … 1 dol (kot na zaslonu)
}

export class Dragon {
  readonly group = new THREE.Group() // položaj in smer
  private readonly body = new THREE.Group() // nagib, zibanje
  private readonly mouth = new THREE.Object3D()
  private readonly uniforms = { uTime: { value: 0 }, uFlap: { value: 7 } }
  yaw = 0
  pitch = 0
  roll = 0
  outOfBounds = false

  static async load(onProgress?: (p: number) => void): Promise<Dragon> {
    const gltf = await new GLTFLoader().loadAsync(URL, (e) => e.total && onProgress?.(e.loaded / e.total))
    return new Dragon(gltf.scene)
  }

  private constructor(model: THREE.Object3D) {
    // model: glava proti +z, noge na y = 0, visok ~0.66
    model.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      const mat = m.material as THREE.MeshStandardMaterial
      mat.onBeforeCompile = (sh) => {
        sh.uniforms.uTime = this.uniforms.uTime
        sh.uniforms.uFlap = this.uniforms.uFlap
        sh.vertexShader = sh.vertexShader
          .replace('#include <common>', '#include <common>\nuniform float uTime;\nuniform float uFlap;')
          .replace(
            '#include <begin_vertex>',
            /* glsl */ `#include <begin_vertex>
            // krila: lokalno |x| > 0.11, višina (-z) 0.17–0.44, zadaj (y < 0.10)
            float ax = abs(position.x);
            float wing = step(0.11, ax) * step(position.z, -0.17) * step(-0.44, position.z) * step(position.y, 0.10);
            float w = wing * smoothstep(0.11, 0.30, ax);
            float ang = (sin(uTime * uFlap) * 0.8 + 0.15) * w;
            float r = ax - 0.11;
            transformed.x = sign(position.x) * (0.11 + r * cos(ang));
            transformed.z = position.z - r * sin(ang);`,
          )
      }
      mat.needsUpdate = true
    })
    this.mouth.position.set(0, 0.45, 0.24) // pred gobcem (koordinate modela)
    model.add(this.mouth)
    model.rotation.y = Math.PI // glava proti -z (naprej)
    model.position.y = -0.33 // središče telesa v izhodišču
    const tilt = new THREE.Group()
    tilt.rotation.x = -0.55 // nagnjen naprej kot v letu
    tilt.add(model)
    tilt.scale.setScalar(80) // ~50 m visok – lepo viden nad mestom
    this.body.add(tilt)
    this.group.add(this.body)
    this.group.rotation.order = 'YXZ'
  }

  get position() {
    return this.group.position
  }

  forward(out = new THREE.Vector3()) {
    return out.set(-Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch))
  }

  mouthWorld(out = new THREE.Vector3()) {
    return this.mouth.getWorldPosition(out)
  }

  update(dt: number, time: number, input: SteerInput, t: Terrain, blowing: boolean, speedMul = 1) {
    // zavijanje in vzpon
    let yawRate = -input.x * GAME.zavijanje
    const targetPitch = -input.y * GAME.vzpon

    // rob karte: nežno obrni proti sredini
    const p = this.group.position
    const mx = t.W / 2 - GAME.rob
    const mz = t.H / 2 - GAME.rob
    this.outOfBounds = Math.abs(p.x) > mx || Math.abs(p.z) > mz
    if (this.outOfBounds) {
      const toCenter = Math.atan2(p.x, p.z) // yaw, ki gleda proti (0,0)
      let diff = toCenter - this.yaw
      diff = Math.atan2(Math.sin(diff), Math.cos(diff))
      yawRate = Math.sign(diff) * GAME.zavijanje * 1.2
    }

    this.yaw += yawRate * dt
    this.pitch += (targetPitch - this.pitch) * Math.min(1, dt * 2.5)
    this.roll += (-input.x * 0.7 - this.roll) * Math.min(1, dt * 3)

    const f = this.forward()
    p.addScaledVector(f, GAME.hitrost * speedMul * dt)
    p.x = THREE.MathUtils.clamp(p.x, -t.W / 2 + 100, t.W / 2 - 100)
    p.z = THREE.MathUtils.clamp(p.z, -t.H / 2 + 100, t.H / 2 - 100)

    // ne v hrib in ne v vesolje
    const minY = t.groundY(p.x, p.z) + GAME.minNadTerenom * SVET.vex
    if (p.y < minY) {
      p.y += (minY - p.y) * Math.min(1, dt * 6)
      this.pitch = Math.max(this.pitch, 0.1)
    }
    const maxY = Terrain.Y(GAME.strop)
    if (p.y > maxY) {
      p.y = maxY
      this.pitch = Math.min(this.pitch, 0)
    }

    this.group.rotation.set(this.pitch, this.yaw, this.roll)
    this.body.position.y = Math.sin(time * 3.5) * 3
    this.uniforms.uTime.value = time
    this.uniforms.uFlap.value = blowing ? 4 : this.pitch > 0.15 ? 11 : 7
  }
}
