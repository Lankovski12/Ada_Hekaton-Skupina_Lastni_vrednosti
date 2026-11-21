<script setup lang="ts">
// 3D zemljevid Ljubljane: relief (Copernicus DEM), stavbe (GURS kataster), občutljive lokacije (OSM) in postaje ARSO.
// Podatke pripravi backend/scripts/zemljevid_3d.py → public/assets/map/.
// Drsnik »megla« dvigne plast hladnega zraka nad dnom kotline in pokaže, katere lokacije ostanejo pod njo.
import { computed, onBeforeUnmount, onMounted, reactive, ref, shallowRef, watch } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { useAirData } from '@/composables/useAirData'
import { levelFor } from '@/lib/airQuality'

interface Teren {
  vir: string
  izhodisce: [number, number]
  celica: number
  stolpci: number
  vrstice: number
  zahod: number
  sever: number
  zMin: number
  zMax: number
  dno: number
  meja: [number, number][]
  postaje: { id: string; ime: string; x: number; y: number }[]
}
interface Lokacija {
  ime: string | null
  kat: string
  naslov: string | null
  x: number
  y: number
  z: number
  nadDnom: number
}

const KAT: Record<string, { ime: string; mn: string; color: string }> = {
  vrtec: { ime: 'Vrtci', mn: 'vrtcev', color: '#ffb547' },
  sola: { ime: 'Šole', mn: 'šol', color: '#5aa2ff' },
  bolnisnica: { ime: 'Bolnišnice', mn: 'bolnišnic', color: '#e5484d' },
  zdravstveni_dom: { ime: 'Zdravstveni domovi', mn: 'zdravstvenih domov', color: '#ff7eb6' },
  dom_za_starejse: { ime: 'Domovi za starejše', mn: 'domov za starejše', color: '#b48cff' },
}
const KAT_IME: Record<string, string> = {
  vrtec: 'vrtec',
  sola: 'šola',
  bolnisnica: 'bolnišnica',
  zdravstveni_dom: 'zdravstveni dom',
  dom_za_starejse: 'dom za starejše',
}

const S = 1 / 100 // 1 enota = 100 m
const VZ = 2.5 // povečanje višin, da se relief lepo vidi

const { now } = useAirData()

const host = ref<HTMLDivElement | null>(null)
const loading = ref(true)
const error = ref('')
const active = ref(false) // ali uporabnik upravlja zemljevid (sicer se počasi vrti in ne lovi drsenja strani)
const fog = ref(30) // višina megle nad dnom kotline (m)
const show = reactive<Record<string, boolean>>(Object.fromEntries(Object.keys(KAT).map((k) => [k, true])))
const lokacije = shallowRef<Lokacija[]>([])
const tip = ref<{ x: number; y: number; l: Lokacija } | null>(null)
const labels = ref<{ ime: string; pm: number | null; color: string; x: number; y: number; vis: boolean }[]>([])
const vir = ref('')

const counts = computed(() => {
  const c: Record<string, { vse: number; pod: number }> = {}
  for (const k of Object.keys(KAT)) c[k] = { vse: 0, pod: 0 }
  for (const l of lokacije.value) {
    const e = c[l.kat]
    if (!e) continue
    e.vse++
    if (l.nadDnom <= fog.value) e.pod++
  }
  return c
})
const podSkupaj = computed(() => Object.values(counts.value).reduce((a, b) => a + b.pod, 0))

// --- three.js stanje ---
let renderer: THREE.WebGLRenderer | undefined
let scene: THREE.Scene | undefined
let camera: THREE.PerspectiveCamera | undefined
let controls: OrbitControls | undefined
let fogMesh: THREE.Mesh | undefined
let raf = 0
let visible = true
let io: IntersectionObserver | undefined
let ro: ResizeObserver | undefined
const pins: { mesh: THREE.InstancedMesh; items: Lokacija[]; kat: string }[] = []
const pillars: { mesh: THREE.Mesh; id: string; ime: string; top: THREE.Vector3 }[] = []
const raycaster = new THREE.Raycaster()
const pointer = new THREE.Vector2()

const base = import.meta.env.BASE_URL
async function load<T>(path: string, kind: 'json' | 'bin'): Promise<T> {
  const r = await fetch(`${base}assets/map/${path}`)
  if (!r.ok) throw new Error(`${path}: ${r.status}`)
  return (kind === 'json' ? r.json() : r.arrayBuffer()) as Promise<T>
}

function terrainColor(z: number, t: Teren): THREE.Color {
  // dno kotline modro-sivo, hribi temnejši zeleno-modri – kot gore v sceni Kotlina
  const k = Math.min(1, Math.max(0, (z - t.dno) / 350))
  const low = new THREE.Color('#34566e')
  const mid = new THREE.Color('#2a4a5a')
  const high = new THREE.Color('#3d5f55')
  return k < 0.3 ? low.lerp(mid, k / 0.3) : mid.clone().lerp(high, (k - 0.3) / 0.7)
}

async function build() {
  const [t, tb, sb, lok] = await Promise.all([
    load<Teren>('teren.json', 'json'),
    load<ArrayBuffer>('teren.bin', 'bin'),
    load<ArrayBuffer>('stavbe.bin', 'bin'),
    load<Lokacija[]>('lokacije.json', 'json'),
  ])
  vir.value = t.vir
  lokacije.value = lok
  const el = host.value
  if (!el) return

  const Z = new Uint16Array(tb)
  const { stolpci: C, vrstice: R, celica: cell } = t
  const zAt = (x: number, y: number) => {
    // bilinearno iz mreže (x proti vzhodu, y proti severu, v metrih od izhodišča)
    const fc = Math.min(C - 1.001, Math.max(0, (x - t.zahod) / cell))
    const fr = Math.min(R - 1.001, Math.max(0, (t.sever - y) / cell))
    const c = Math.floor(fc), r = Math.floor(fr), dc = fc - c, dr = fr - r
    const v = (rr: number, cc: number) => Z[rr * C + cc]! / 10
    return (v(r, c) * (1 - dc) + v(r, c + 1) * dc) * (1 - dr) + (v(r + 1, c) * (1 - dc) + v(r + 1, c + 1) * dc) * dr
  }
  const Y = (z: number) => (z - t.dno) * VZ * S // višina v sceni

  // --- osnova ---
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  el.appendChild(renderer.domElement)
  scene = new THREE.Scene()
  scene.fog = new THREE.Fog('#05080f', 170, 380)
  camera = new THREE.PerspectiveCamera(40, 1, 1, 1000)
  scene.add(new THREE.HemisphereLight('#cfe3ff', '#0b1422', 1.6))
  const sun = new THREE.DirectionalLight('#fff4dd', 2.2)
  sun.position.set(-80, 120, 60)
  scene.add(sun)

  // --- teren (nizko-poligonski: ploskve z ravnim senčenjem) ---
  {
    const pos = new Float32Array(R * C * 3)
    const col = new Float32Array(R * C * 3)
    for (let r = 0; r < R; r++)
      for (let c = 0; c < C; c++) {
        const i = r * C + c
        const z = Z[i]! / 10
        pos.set([(t.zahod + c * cell) * S, Y(z), -(t.sever - r * cell) * S], i * 3)
        const cc = terrainColor(z, t)
        col.set([cc.r, cc.g, cc.b], i * 3)
      }
    const idx = new Uint32Array((R - 1) * (C - 1) * 6)
    let k = 0
    for (let r = 0; r < R - 1; r++)
      for (let c = 0; c < C - 1; c++) {
        const a = r * C + c, b = a + 1, d = a + C, e = d + 1
        idx.set([a, d, b, b, d, e], k)
        k += 6
      }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('color', new THREE.BufferAttribute(col, 3))
    g.setIndex(new THREE.BufferAttribute(idx, 1))
    scene.add(new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true })))
  }

  // --- meja MOL ---
  {
    const pts = t.meja.map(([x, y]) => new THREE.Vector3(x * S, Y(zAt(x, y)) + 0.4, -y * S))
    const line = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineDashedMaterial({ color: '#9fb3c8', dashSize: 1.2, gapSize: 0.8, transparent: true, opacity: 0.6 }),
    )
    line.computeLineDistances()
    scene.add(line)
  }

  // --- stavbe: ena geometrija, stene + strehe ---
  {
    const a = new Int16Array(sb)
    const verts: number[] = []
    const ind: number[] = []
    for (let i = 0; i < a.length; ) {
      const n = a[i++]!
      const h = a[i++]! / 10
      const ring: THREE.Vector2[] = []
      let cx = 0, cy = 0
      for (let j = 0; j < n; j++) {
        const x = a[i++]! * 0.5, y = a[i++]! * 0.5
        ring.push(new THREE.Vector2(x, y))
        cx += x
        cy += y
      }
      const z0 = zAt(cx / n, cy / n)
      const y0 = Y(z0) - 0.05, y1 = Y(z0) + h * VZ * S
      const v0 = verts.length / 3
      for (const p of ring) verts.push(p.x * S, y0, -p.y * S)
      for (const p of ring) verts.push(p.x * S, y1, -p.y * S)
      for (let j = 0; j < n; j++) {
        const j2 = (j + 1) % n
        ind.push(v0 + j, v0 + j2, v0 + n + j, v0 + j2, v0 + n + j2, v0 + n + j)
      }
      for (const [p, q, r] of THREE.ShapeUtils.triangulateShape(ring, [])) ind.push(v0 + n + p!, v0 + n + q!, v0 + n + r!)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3))
    g.setIndex(ind)
    const m = new THREE.MeshLambertMaterial({ color: '#9db4c8', flatShading: true, side: THREE.DoubleSide })
    scene.add(new THREE.Mesh(g, m))
  }

  // --- megla (plast hladnega zraka nad dnom kotline) ---
  {
    const w = (C - 1) * cell * S, d = (R - 1) * cell * S
    const g = new THREE.PlaneGeometry(w, d)
    g.rotateX(-Math.PI / 2)
    g.translate((t.zahod * S + w / 2), 0, -(t.sever * S - d / 2))
    fogMesh = new THREE.Mesh(
      g,
      new THREE.MeshBasicMaterial({ color: '#cfd8e2', transparent: true, opacity: 0.42, depthWrite: false }),
    )
    scene.add(fogMesh)
  }

  // --- bucike za lokacije ---
  {
    const head = new THREE.OctahedronGeometry(0.9, 0)
    head.translate(0, 3.2, 0)
    const stick = new THREE.CylinderGeometry(0.12, 0.12, 2.6, 5).toNonIndexed() // obe geometriji brez indeksa
    stick.translate(0, 1.3, 0)
    const pinGeo = mergeGeometries([head, stick])!
    for (const [kat, info] of Object.entries(KAT)) {
      const items = lok.filter((l) => l.kat === kat)
      const mesh = new THREE.InstancedMesh(pinGeo, new THREE.MeshLambertMaterial({ color: '#ffffff', flatShading: true }), items.length)
      const mtx = new THREE.Matrix4()
      items.forEach((l, i) => {
        mtx.makeTranslation(l.x * S, Y(zAt(l.x, l.y)), -l.y * S)
        mesh.setMatrixAt(i, mtx)
        mesh.setColorAt(i, new THREE.Color(info.color))
      })
      mesh.userData.kat = kat
      scene.add(mesh)
      pins.push({ mesh, items, kat })
    }
  }

  // --- stolpci na merilnih postajah (višina = PM2.5 zdaj) ---
  for (const p of t.postaje) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 1, 6), new THREE.MeshLambertMaterial({ color: '#ffffff', flatShading: true }))
    mesh.position.set(p.x * S, Y(zAt(p.x, p.y)), -p.y * S)
    scene.add(mesh)
    pillars.push({ mesh, id: p.id, ime: p.ime, top: new THREE.Vector3() })
  }
  updatePillars()
  updateFog()

  // --- kamera in upravljanje ---
  const target = new THREE.Vector3(-48, Y(300), 2) // središče mesta
  camera.position.set(target.x - 60, 120, target.z + 150)
  controls = new OrbitControls(camera, renderer.domElement)
  controls.target.copy(target)
  controls.enableDamping = true
  controls.maxPolarAngle = Math.PI * 0.45
  controls.minDistance = 15
  controls.maxDistance = 320
  controls.autoRotate = true
  controls.autoRotateSpeed = 0.35
  setActive(false)

  renderer.domElement.addEventListener('pointermove', onPointer)
  renderer.domElement.addEventListener('pointerdown', onPointer)
  renderer.domElement.addEventListener('pointerleave', () => (tip.value = null))

  resize()
  ro = new ResizeObserver(resize)
  ro.observe(el)
  io = new IntersectionObserver(([e]) => (visible = !!e?.isIntersecting))
  io.observe(el)
  loading.value = false
  raf = requestAnimationFrame(loop)
}

function resize() {
  const el = host.value
  if (!el || !renderer || !camera) return
  renderer.setSize(el.clientWidth, el.clientHeight)
  camera.aspect = el.clientWidth / el.clientHeight
  camera.updateProjectionMatrix()
}

function setActive(on: boolean) {
  active.value = on
  if (!controls || !renderer) return
  controls.enabled = on
  controls.autoRotate = !on
  // brez aktivacije zemljevid ne lovi kolesca in prstov, da lahko stran normalno drsiš naprej
  renderer.domElement.style.touchAction = on ? 'none' : 'pan-y'
}

function updateFog() {
  if (!fogMesh) return
  fogMesh.position.y = fog.value * VZ * S
  // lokacije nad meglo so bledejše
  for (const p of pins) {
    const c = new THREE.Color(KAT[p.kat]!.color)
    p.items.forEach((l, i) => {
      p.mesh.setColorAt(i, l.nadDnom <= fog.value ? c : c.clone().lerp(new THREE.Color('#05080f'), 0.6))
    })
    if (p.mesh.instanceColor) p.mesh.instanceColor.needsUpdate = true
  }
}
watch(fog, updateFog)

function updatePillars() {
  const st = now.value?.postaje ?? []
  for (const p of pillars) {
    const m = st.find((s) => s.id === p.id || s.ime.includes(p.ime))
    const pm = m?.pm25 ?? null
    const h = Math.max(1, (pm ?? 5) * 0.45)
    p.mesh.scale.y = h
    p.mesh.position.y = p.mesh.userData.y0 ?? (p.mesh.userData.y0 = p.mesh.position.y)
    p.mesh.position.y += h / 2
    ;(p.mesh.material as THREE.MeshLambertMaterial).color.set(levelFor(pm ?? 0).hex)
    p.top.set(p.mesh.position.x, p.mesh.position.y + h / 2 + 1, p.mesh.position.z)
    p.mesh.userData.pm = pm
  }
}
watch(now, updatePillars)

watch(show, () => {
  for (const p of pins) p.mesh.visible = show[p.kat] ?? true
})

function onPointer(e: PointerEvent) {
  if (!renderer || !camera) return
  const r = renderer.domElement.getBoundingClientRect()
  pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
  raycaster.setFromCamera(pointer, camera)
  const hit = raycaster.intersectObjects(pins.filter((p) => p.mesh.visible).map((p) => p.mesh))[0]
  if (hit && hit.instanceId != null) {
    const p = pins.find((pp) => pp.mesh === hit.object)!
    tip.value = { x: e.clientX - r.left, y: e.clientY - r.top, l: p.items[hit.instanceId]! }
  } else if (e.type === 'pointerdown' || active.value) {
    tip.value = null
  }
}

function loop() {
  raf = requestAnimationFrame(loop)
  if (!visible || !renderer || !scene || !camera || !controls) return
  controls.update()
  renderer.render(scene, camera)
  // oznake postaj
  const el = host.value!
  labels.value = pillars.map((p) => {
    const v = p.top.clone().project(camera!)
    const pm = p.mesh.userData.pm as number | null
    return {
      ime: p.ime,
      pm,
      color: levelFor(pm ?? 0).color,
      x: ((v.x + 1) / 2) * el.clientWidth,
      y: ((1 - v.y) / 2) * el.clientHeight,
      vis: v.z < 1,
    }
  })
}

onMounted(() => {
  build().catch((e) => {
    error.value = `Zemljevida ni bilo mogoče naložiti (${e.message}).`
    loading.value = false
  })
})
onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  io?.disconnect()
  ro?.disconnect()
  controls?.dispose()
  scene?.traverse((o) => {
    const m = o as THREE.Mesh
    m.geometry?.dispose()
    const mat = m.material as THREE.Material | THREE.Material[] | undefined
    if (Array.isArray(mat)) mat.forEach((x) => x.dispose())
    else mat?.dispose()
  })
  renderer?.dispose()
  renderer?.domElement.remove()
})
</script>

<template>
  <div class="map">
    <div ref="host" class="canvas" />

    <div v-if="loading" class="state">Nalagam 3D model Ljubljane …</div>
    <div v-else-if="error" class="state">{{ error }}</div>

    <template v-else>
      <!-- oznake postaj ARSO -->
      <div
        v-for="l in labels"
        v-show="l.vis"
        :key="l.ime"
        class="station"
        :style="{ left: `${l.x}px`, top: `${l.y}px`, '--c': l.color }"
      >
        {{ l.ime }} <strong>{{ l.pm ?? '–' }}</strong>
      </div>

      <!-- legenda / filter -->
      <div class="legend">
        <button
          v-for="(info, k) in KAT"
          :key="k"
          class="chip"
          :class="{ off: !show[k] }"
          :style="{ '--c': info.color }"
          :aria-pressed="show[k]"
          @click="show[k] = !show[k]"
        >
          <span class="dot" />{{ info.ime }} <small>{{ counts[k]?.vse }}</small>
        </button>
      </div>

      <button class="btn explore" @click="setActive(!active)">
        {{ active ? '✓ Končaj' : '🖐 Raziskuj zemljevid' }}
      </button>

      <!-- megla -->
      <div class="fogbox">
        <label>
          <span>🌫️ Megla ob inverziji: <strong>{{ fog }} m</strong> nad dnom kotline</span>
          <input v-model.number="fog" type="range" min="0" max="200" step="5" aria-label="Višina megle" />
        </label>
        <p>
          Pod meglo je <strong>{{ podSkupaj }}</strong> od {{ lokacije.length }} lokacij:
          <template v-for="(info, k, i) in KAT" :key="k">
            <span v-if="counts[k]?.pod">{{ i ? ' · ' : '' }}{{ counts[k]?.pod }} {{ info.mn }}</span>
          </template>
          <small> (ocena iz reliefa)</small>
        </p>
      </div>

      <!-- podrobnosti lokacije -->
      <div v-if="tip" class="tip" :style="{ left: `${tip.x}px`, top: `${tip.y}px` }">
        <strong>{{ tip.l.ime ?? 'Brez imena' }}</strong>
        <span>{{ KAT_IME[tip.l.kat] }}<template v-if="tip.l.naslov"> · {{ tip.l.naslov }}</template></span>
        <span>{{ tip.l.z }} m n. v. · {{ tip.l.nadDnom }} m nad dnom kotline</span>
        <span :class="tip.l.nadDnom <= fog ? 'under' : 'over'">
          {{ tip.l.nadDnom <= fog ? '🌫️ pod meglo' : '☀️ nad meglo' }}
        </span>
      </div>
    </template>
  </div>
  <p class="credit">{{ vir }}</p>
</template>

<style scoped>
.map {
  position: relative;
  height: min(78svh, 760px);
  min-height: 460px;
  border-radius: var(--radius);
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: radial-gradient(ellipse at 50% 40%, #0d1a2a, #05080f 70%);
}
.canvas {
  position: absolute;
  inset: 0;
}
.canvas :deep(canvas) {
  display: block;
}
.state {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  color: #9fb3c8;
  font-weight: 700;
}
.legend {
  position: absolute;
  top: 14px;
  left: 14px;
  right: 200px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(10, 18, 30, 0.75);
  color: #eaf2fb;
  font-size: 0.85rem;
  font-weight: 700;
  backdrop-filter: blur(6px);
  transition: opacity 0.2s;
}
.chip small {
  color: #9fb3c8;
}
.chip.off {
  opacity: 0.4;
}
.chip .dot {
  width: 10px;
  height: 10px;
  border-radius: 3px;
  transform: rotate(45deg);
  background: var(--c);
}
.explore {
  position: absolute;
  top: 14px;
  right: 14px;
  min-height: 40px;
  padding: 8px 16px;
  font-size: 0.9rem;
  background: rgba(10, 18, 30, 0.85);
  color: #eaf2fb;
  border: 1px solid rgba(255, 255, 255, 0.18);
}
.fogbox {
  position: absolute;
  left: 14px;
  bottom: 14px;
  max-width: 460px;
  padding: 14px 16px;
  border-radius: var(--radius-sm);
  background: rgba(10, 18, 30, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(8px);
}
.fogbox label {
  display: grid;
  gap: 2px;
  font-weight: 700;
  font-size: 0.9rem;
}
.fogbox input {
  accent-color: #cfd8e2;
}
.fogbox p {
  margin: 4px 0 0;
  font-size: 0.85rem;
  color: #c4d3e2;
}
.fogbox small {
  color: #8197ad;
}
.station {
  position: absolute;
  transform: translate(-50%, -100%);
  padding: 3px 9px;
  border-radius: 999px;
  background: rgba(10, 18, 30, 0.85);
  border: 1px solid var(--c);
  color: #eaf2fb;
  font-size: 0.75rem;
  font-weight: 700;
  white-space: nowrap;
  pointer-events: none;
}
.station strong {
  color: var(--c);
}
.tip {
  position: absolute;
  transform: translate(12px, -50%);
  display: grid;
  gap: 2px;
  max-width: 260px;
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  background: rgba(10, 18, 30, 0.92);
  border: 1px solid rgba(255, 255, 255, 0.15);
  color: #c4d3e2;
  font-size: 0.8rem;
  pointer-events: none;
  z-index: 3;
}
.tip strong {
  color: #eaf2fb;
  font-size: 0.95rem;
}
.tip .under {
  color: #cfd8e2;
  font-weight: 700;
}
.tip .over {
  color: #ffd54a;
  font-weight: 700;
}
.credit {
  margin-top: 8px !important;
  font-size: 0.75rem !important;
  color: #8197ad !important;
}
@media (max-width: 720px) {
  .map {
    height: 72svh;
  }
  .legend {
    right: 14px;
    top: 62px;
  }
  .chip {
    font-size: 0.75rem;
    padding: 4px 9px;
  }
  .explore {
    left: 14px;
    right: auto;
  }
  .fogbox {
    right: 14px;
    max-width: none;
  }
}
</style>
