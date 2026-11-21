<script setup lang="ts">
// 3D zemljevid Ljubljane: relief (Copernicus DEM), stavbe (GURS kataster), občutljive lokacije (OSM) in postaje ARSO.
// Podatke pripravi backend/scripts/zemljevid_3d.py → public/assets/map/.
// Drsnik »megla« dvigne plast hladnega zraka nad dnom kotline in pokaže, katere lokacije ostanejo pod njo.
// Gumb »Zdaj v Ljubljani« nastavi meglo in njeno barvo po trenutnih podatkih (PM2.5, inverzija) in približa mesto.
// Gumb »Izberi dan« pokaže katerikoli dan od 2016: dnevno povprečje na postajah in meglo iz jutranje radiosondaže
// (podatke pripravi backend/scripts/zemljevid_dnevi.py → public/assets/map/dnevi.json).
import { computed, onBeforeUnmount, onMounted, reactive, ref, shallowRef, watch } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { useAirData } from '@/composables/useAirData'
import { levelFor, type AirLevel } from '@/lib/airQuality'

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
interface Dnevi {
  vir: string
  od: string
  do: string
  postaje: { id: string; ime: string }[]
  pm25: (number | null)[][]
  pm10: (number | null)[][]
  invUr: (number | null)[]
  megla: (number | null)[]
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

// koda = vrsta stavbe v stavbe.bin (glej backend/scripts/zemljevid_3d.py)
const KAT: Record<string, { ime: string; mn: string; color: string; koda: number }> = {
  vrtec: { ime: 'Vrtci', mn: 'vrtcev', color: '#ffb547', koda: 1 },
  sola: { ime: 'Šole', mn: 'šol', color: '#5aa2ff', koda: 2 },
  bolnisnica: { ime: 'Bolnišnice', mn: 'bolnišnic', color: '#e5484d', koda: 3 },
  zdravstveni_dom: { ime: 'Zdravstveni domovi', mn: 'zdravstvenih domov', color: '#ff7eb6', koda: 4 },
  dom_za_starejse: { ime: 'Domovi za starejše', mn: 'domov za starejše', color: '#b48cff', koda: 5 },
}
const STAVBA = '#9db4c8' // barva navadnih stavb
const KAT_IME: Record<string, string> = {
  vrtec: 'vrtec',
  sola: 'šola',
  bolnisnica: 'bolnišnica',
  zdravstveni_dom: 'zdravstveni dom',
  dom_za_starejse: 'dom za starejše',
}

const S = 1 / 100 // 1 enota = 100 m
const VZ = 2.5 // povečanje višin, da se relief lepo vidi

const { now, scene: sceneData, currentPm25 } = useAirData()

const host = ref<HTMLDivElement | null>(null)
const loading = ref(true)
const error = ref('')
const active = ref(false) // ali uporabnik upravlja zemljevid (sicer se počasi vrti in ne lovi drsenja strani)
const fog = ref(30) // višina megle nad dnom kotline (m)
const show = reactive<Record<string, boolean>>(Object.fromEntries(Object.keys(KAT).map((k) => [k, true])))
const lokacije = shallowRef<Lokacija[]>([])
const tip = ref<{ x: number; y: number; l: Lokacija } | null>(null)
const labels = ref<{ ime: string; pm: number | null; unit: string; color: string; x: number; y: number; vis: boolean }[]>([])
const vir = ref('')
const live = ref(false) // način »Zdaj v Ljubljani«

// trenutno stanje iz podatkov: PM2.5 in plast megle iz /api/scene (prva ura)
const zdaj = computed(() => {
  const u = sceneData.value?.ure[0]
  const pm = currentPm25.value ?? u?.pm25 ?? null
  if (pm == null) return null
  const lvl: AirLevel = levelFor(pm)
  const inv = u?.inverzija ?? false
  const nadDnom = u ? Math.round(u.visina_megle_m - (dno.value ?? 278)) : 0
  return { pm, lvl, inv, nadDnom, ura: u ? new Date(u.cas_utc).getHours() : new Date().getHours() }
})
const dno = ref<number | null>(null)

// --- izbran dan (časovni stroj) ---
const DAY = 86_400_000
const dnevi = shallowRef<Dnevi | null>(null)
const dan = ref<string | null>(null) // YYYY-MM-DD; null = način »dan« ni vklopljen
const danMin = ref(false) // pomanjšano okno »Ljubljana na izbrani dan«
const isoOf = (i: number) => new Date(Date.parse(dnevi.value!.od) + i * DAY).toISOString().slice(0, 10)
// PM10 ima po evropskem indeksu ravno dvakrat višje meje kot PM2.5 → za barvo in velikost delimo z 2
const eqOf = (pm25: number | null, pm10: number | null) => (pm25 ?? (pm10 != null ? pm10 / 2 : null))
const meanOf = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null)

const izbran = computed(() => {
  const d = dnevi.value
  if (!d || !dan.value) return null
  const i = Math.round((Date.parse(dan.value) - Date.parse(d.od)) / DAY)
  if (i < 0 || i >= d.invUr.length) return null
  const postaje = d.postaje.map((p, k) => {
    const pm25 = d.pm25[k]![i] ?? null
    const pm10 = d.pm10[k]![i] ?? null
    return { id: p.id, pm: pm25 ?? pm10, unit: pm25 != null ? 'PM2.5' : pm10 != null ? 'PM10' : '', eq: eqOf(pm25, pm10) }
  })
  const z25 = postaje.filter((p) => p.unit === 'PM2.5').map((p) => p.pm!)
  const z10 = d.pm10.map((s) => s[i]).filter((v): v is number => v != null)
  const val = z25.length ? Math.round(meanOf(z25)!) : z10.length ? Math.round(meanOf(z10)!) : null
  const unit = z25.length ? 'PM2.5' : 'PM10'
  const eq = meanOf(postaje.map((p) => p.eq).filter((v): v is number => v != null))
  return { i, postaje, val, unit, eq, lvl: levelFor(eq ?? 0), invUr: d.invUr[i] ?? null, megla: d.megla[i] ?? null }
})
const izbranDatum = computed(() =>
  dan.value ? new Date(dan.value).toLocaleDateString('sl-SI', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : '',
)
// bližnjice: najslabši in najčistejši dan v vseh podatkih
const posebni = computed(() => {
  const d = dnevi.value
  if (!d) return null
  let max = -1, min = -1, vMax = -Infinity, vMin = Infinity
  for (let i = 0; i < d.invUr.length; i++) {
    const vals = d.postaje.map((_, k) => eqOf(d.pm25[k]![i] ?? null, d.pm10[k]![i] ?? null)).filter((v): v is number => v != null)
    if (vals.length < 1) continue
    const m = meanOf(vals)!
    if (m > vMax) (vMax = m), (max = i)
    if (m < vMin) (vMin = m), (min = i)
  }
  return { najslabsi: isoOf(max), najcistejsi: isoOf(min), zadnji: d.do }
})

// stanje, po katerem se obarva megla: »zdaj« ali izbran dan
const stanje = computed(() => {
  if (live.value && zdaj.value) return { lvl: zdaj.value.lvl, pm: zdaj.value.pm, inv: zdaj.value.inv }
  const z = izbran.value
  if (z && z.eq != null) return { lvl: z.lvl, pm: z.eq, inv: (z.megla ?? 0) > 0 }
  return null
})

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
const pins: { mesh: THREE.InstancedMesh; items: Lokacija[]; kat: string; pos: THREE.Vector3[] }[] = []
const buildingMats: Record<number, THREE.MeshLambertMaterial> = {}
let pinScale = 1
let fly: { from: THREE.Vector3; to: THREE.Vector3; tFrom: THREE.Vector3; tTo: THREE.Vector3; t0: number } | null = null
// merilne postaje ARSO: prosojna kupola nad postajo, večja in v barvi kakovosti zraka, ko je PM2.5 višji
interface Postaja {
  id: string
  ime: string
  ground: THREE.Vector3
  top: THREE.Vector3
  pm: number | null
  unit: string
  kupola: THREE.Mesh
}
const pillars: Postaja[] = []
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
  dno.value = t.dno
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

  // --- stavbe: stene + strehe; ena geometrija za navadne in po ena za vsako vrsto občutljivih stavb ---
  {
    const a = new Int16Array(sb)
    const groups: Record<number, { verts: number[]; ind: number[] }> = {}
    for (let i = 0; i < a.length; ) {
      const n = a[i++]!
      const h = a[i++]! / 10
      const kod = a[i++]!
      const grp = (groups[kod] ??= { verts: [], ind: [] })
      const verts = grp.verts
      const ind = grp.ind
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
    for (const [kod, grp] of Object.entries(groups)) {
      const k = Number(kod)
      const g = new THREE.BufferGeometry()
      g.setAttribute('position', new THREE.Float32BufferAttribute(grp.verts, 3))
      g.setIndex(grp.ind)
      const info = Object.values(KAT).find((x) => x.koda === k)
      const m = new THREE.MeshLambertMaterial({
        color: info?.color ?? STAVBA,
        emissive: info ? new THREE.Color(info.color).multiplyScalar(0.35) : new THREE.Color('#000000'),
        flatShading: true,
        side: THREE.DoubleSide,
      })
      buildingMats[k] = m
      scene.add(new THREE.Mesh(g, m))
    }
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
      const pos = items.map((l) => new THREE.Vector3(l.x * S, Y(zAt(l.x, l.y)), -l.y * S))
      items.forEach((_, i) => mesh.setColorAt(i, new THREE.Color(info.color)))
      mesh.userData.kat = kat
      scene.add(mesh)
      pins.push({ mesh, items, kat, pos })
    }
  }

  // --- merilne postaje (PM2.5 zdaj) ---
  for (const p of t.postaje) {
    const ground = new THREE.Vector3(p.x * S, Y(zAt(p.x, p.y)), -p.y * S)
    const kupola = new THREE.Mesh(
      new THREE.SphereGeometry(1, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshLambertMaterial({ flatShading: true, transparent: true, opacity: 0.45, depthWrite: false }),
    )
    scene.add(kupola)
    pillars.push({ id: p.id, ime: p.ime, ground, top: new THREE.Vector3(), pm: null, unit: '', kupola })
  }
  updatePillars()
  updateFog()
  setPinScale(1)

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
  // v načinu »zdaj« ali »dan« je megla obarvana po kakovosti zraka in gostejša, ko je zrak slabši
  const mat = fogMesh.material as THREE.MeshBasicMaterial
  const z = stanje.value
  if (z) {
    mat.color.set('#cfd8e2').lerp(new THREE.Color(z.lvl.hex), 0.45)
    mat.opacity = z.inv ? Math.min(0.75, 0.3 + z.pm / 120) : 0.12
  } else {
    mat.color.set('#cfd8e2')
    mat.opacity = 0.42
  }
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

/** bucike so manjše, ko približaš zemljevid */
function setPinScale(s: number) {
  pinScale = s
  const m = new THREE.Matrix4()
  const sc = new THREE.Vector3(s, s, s)
  const q = new THREE.Quaternion()
  for (const p of pins) {
    p.pos.forEach((v, i) => p.mesh.setMatrixAt(i, m.compose(v, q, sc)))
    p.mesh.instanceMatrix.needsUpdate = true
    p.mesh.computeBoundingSphere()
  }
}

/** »Zdaj v Ljubljani«: megla po trenutnih podatkih in let kamere nad mesto */
function toggleLive() {
  live.value = !live.value
  dan.value = null
  const z = zdaj.value
  if (live.value && z) {
    // ob inverziji je plast ujeta nizko; sicer se zrak meša in megle skoraj ni
    fog.value = z.inv ? Math.max(0, Math.min(200, Math.round(z.nadDnom / 5) * 5)) : 0
    flyTo(new THREE.Vector3(-90, 75, 95), new THREE.Vector3(-46, 0, 0))
  } else {
    fog.value = 30
  }
  updateFog()
}
function onFogInput() {
  if (live.value) {
    live.value = false
    updateFog()
  }
}

/** »Izberi dan«: naloži dnevne podatke (enkrat) in pokaže zadnji dan */
async function toggleDan() {
  if (dan.value) {
    dan.value = null
    fog.value = 30
    return
  }
  live.value = false
  if (!dnevi.value) {
    try {
      dnevi.value = await load<Dnevi>('dnevi.json', 'json')
    } catch {
      return
    }
  }
  dan.value = dnevi.value.do
  flyTo(new THREE.Vector3(-90, 75, 95), new THREE.Vector3(-46, 0, 0))
}
function korak(n: number) {
  const d = dnevi.value
  if (!d || !dan.value) return
  const t = new Date(Date.parse(dan.value) + n * DAY).toISOString().slice(0, 10)
  if (t >= d.od && t <= d.do) dan.value = t
}
watch(izbran, (z) => {
  // megla izbranega dne: višina iz jutranje radiosondaže (0 = brez inverzije)
  if (z) fog.value = Math.max(0, Math.min(200, Math.round((z.megla ?? 0) / 5) * 5))
  updatePillars()
  updateFog()
})
function flyTo(pos: THREE.Vector3, target: THREE.Vector3) {
  if (!camera || !controls) return
  fly = { from: camera.position.clone(), to: pos, tFrom: controls.target.clone(), tTo: target, t0: performance.now() }
}

function updatePillars() {
  const st = now.value?.postaje ?? []
  const z = izbran.value
  for (const p of pillars) {
    let eq: number | null
    if (z) {
      // izbran dan: dnevno povprečje (PM2.5, za starejše dni PM10)
      const v = z.postaje.find((x) => x.id === p.id)
      p.pm = v?.pm ?? null
      p.unit = v?.unit ?? ''
      eq = v?.eq ?? null
    } else {
      const m = st.find((s) => s.vir !== 'ocena' && (s.id === p.id || s.ime.includes(p.ime)))
      // brez živih meritev zaledje vrne eno oceno »običajno ob tej uri« (povprečje meritev na Bežigradu)
      const ocena = !m && p.id === 'E403' ? st.find((s) => s.vir === 'ocena') : undefined
      const v = (m ?? ocena)?.pm25
      p.pm = v == null ? null : Math.round(v)
      p.unit = ocena ? 'običajno' : ''
      eq = p.pm
    }
    // polmer kupole raste s PM2.5
    const r = 1.8 + (eq ?? 5) * 0.14
    p.kupola.scale.setScalar(r)
    p.kupola.position.copy(p.ground)
    p.kupola.visible = !z || eq != null
    p.kupola.userData.eq = eq
    ;(p.kupola.material as THREE.MeshLambertMaterial).color.set(levelFor(eq ?? 0).hex)
    p.top.set(p.ground.x, p.ground.y + r + 1, p.ground.z)
  }
}
watch(now, updatePillars)

watch(show, () => {
  for (const p of pins) p.mesh.visible = show[p.kat] ?? true
  // skrite vrste: stavbe dobijo navadno barvo
  for (const [kat, info] of Object.entries(KAT)) {
    const m = buildingMats[info.koda]
    if (!m) continue
    const on = show[kat] ?? true
    m.color.set(on ? info.color : STAVBA)
    m.emissive.set(on ? new THREE.Color(info.color).multiplyScalar(0.35) : new THREE.Color('#000000'))
  }
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
  if (fly) {
    const k = Math.min(1, (performance.now() - fly.t0) / 1400)
    const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2
    camera.position.lerpVectors(fly.from, fly.to, e)
    controls.target.lerpVectors(fly.tFrom, fly.tTo, e)
    if (k >= 1) fly = null
  }
  controls.update()
  // bucike: polna velikost od daleč, manjše od blizu
  const s = Math.min(1, Math.max(0.22, camera.position.distanceTo(controls.target) / 190))
  if (Math.abs(s - pinScale) > 0.03) setPinScale(s)
  renderer.render(scene, camera)
  // oznake postaj
  const el = host.value!
  labels.value = pillars.map((p) => {
    const v = p.top.clone().project(camera!)
    return {
      ime: p.ime,
      pm: p.pm,
      unit: p.unit === 'PM10' || p.unit === 'običajno' ? p.unit : '',
      color: levelFor((p.kupola.userData.eq as number | null) ?? 0).color,
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
  <div class="map" :class="{ 'is-live': live || !!dan }">
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
        {{ l.ime }} <strong>{{ l.pm ?? '–' }}</strong><small v-if="l.unit"> {{ l.unit }}</small>
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

      <div class="actions">
        <button class="btn explore" :class="{ on: live }" :disabled="!zdaj" @click="toggleLive">
          <template v-if="live">Zapri</template>
          <template v-else><span class="long">Zdaj v Ljubljani</span><span class="short">Zdaj</span></template>
        </button>
        <button class="btn explore" :class="{ on: !!dan }" @click="toggleDan">
          {{ dan ? 'Zapri' : 'Izberi dan' }}
        </button>
        <button class="btn explore" @click="setActive(!active)">
          <template v-if="active">Končaj</template>
          <template v-else><span class="long">Raziskuj zemljevid</span><span class="short">Raziskuj</span></template>
        </button>
      </div>

      <!-- trenutno stanje -->
      <div v-if="live && zdaj" class="now" :style="{ '--c': zdaj.lvl.color }">
        <span class="k">Ljubljana zdaj · {{ String(zdaj.ura).padStart(2, '0') }}:00</span>
        <span class="v"><strong>{{ zdaj.pm }}</strong> µg/m³ PM2.5 · {{ zdaj.lvl.label }}</span>
        <span>
          {{
            zdaj.inv
              ? `🌫️ Inverzija: hladen zrak je ujet do približno ${fog} m nad dnom kotline.`
              : '🌬️ Zrak se meša, megle na dnu kotline ni.'
          }}
        </span>
        <span class="kids">{{ zdaj.lvl.kids }}</span>
      </div>

      <!-- izbran dan -->
      <div v-if="dan && dnevi" class="now day" :class="{ min: danMin }" :style="{ '--c': izbran?.lvl.color ?? '#9fb3c8' }">
        <div class="head">
          <span class="k">Ljubljana na izbrani dan</span>
          <button class="minbtn" :aria-label="danMin ? 'Razširi okno' : 'Pomanjšaj okno'" :aria-expanded="!danMin" @click="danMin = !danMin">
            {{ danMin ? '+' : '–' }}
          </button>
        </div>
        <!-- pomanjšano: samo datum, vrednost in puščici -->
        <div v-if="danMin" class="daypick">
          <button class="arrow" aria-label="Prejšnji dan" :disabled="dan <= dnevi.od" @click="korak(-1)">‹</button>
          <span class="mini">
            {{ new Date(dan).toLocaleDateString('sl-SI', { day: 'numeric', month: 'numeric', year: 'numeric' }) }}
            <strong v-if="izbran && izbran.val != null">{{ izbran.val }} µg/m³</strong>
          </span>
          <button class="arrow" aria-label="Naslednji dan" :disabled="dan >= dnevi.do" @click="korak(1)">›</button>
        </div>
        <template v-else>
          <div class="daypick">
            <button class="arrow" aria-label="Prejšnji dan" :disabled="dan <= dnevi.od" @click="korak(-1)">‹</button>
            <input v-model="dan" type="date" :min="dnevi.od" :max="dnevi.do" aria-label="Datum" required />
            <button class="arrow" aria-label="Naslednji dan" :disabled="dan >= dnevi.do" @click="korak(1)">›</button>
          </div>
          <span class="date">{{ izbranDatum }}</span>
          <template v-if="izbran && izbran.val != null">
            <span class="v"><strong>{{ izbran.val }}</strong> µg/m³ {{ izbran.unit }} · {{ izbran.lvl.label }}</span>
            <span v-if="izbran.megla && izbran.megla > 0">
              Zjutraj je bil hladen zrak ujet do približno {{ izbran.megla }} m nad dnom kotline<template v-if="izbran.invUr != null">, inverzija je trajala {{ izbran.invUr }} od 24 ur</template>.
            </span>
            <span v-else-if="izbran.megla === 0">
              Zjutraj ni bilo prizemne inverzije, zrak se je mešal<template v-if="izbran.invUr">, inverzija čez dan {{ izbran.invUr }} ur</template>.
            </span>
            <span v-else>Za ta dan ni podatka o inverziji.</span>
            <small v-if="izbran.unit === 'PM10'" class="note">PM2.5 se je takrat še ni merilo, prikazan je PM10.</small>
          </template>
          <span v-else>Za ta dan ni celodnevnih meritev.</span>
          <div v-if="posebni" class="quick">
            <button class="chip" @click="dan = posebni.najslabsi">Najslabši dan</button>
            <button class="chip" @click="dan = posebni.najcistejsi">Najčistejši dan</button>
            <button class="chip" @click="dan = posebni.zadnji">Zadnji dan</button>
          </div>
        </template>
      </div>

      <!-- megla -->
      <div class="fogbox">
        <label>
          <span>🌫️ Megla ob inverziji: <strong>{{ fog }} m</strong> nad dnom kotline</span>
          <input v-model.number="fog" type="range" min="0" max="200" step="5" aria-label="Višina megle" @input="onFogInput" />
        </label>
        <p v-if="live && zdaj && !zdaj.inv">Zdaj ni inverzije, zato se onesnažen zrak ne ujame na dnu kotline.</p>
        <p v-else-if="izbran && fog === 0">Ta dan zjutraj ni bilo inverzije, zato se onesnažen zrak ni ujel na dnu kotline.</p>
        <p v-else>
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
.actions {
  position: absolute;
  top: 14px;
  right: 14px;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
}
.explore {
  min-height: 40px;
  padding: 8px 16px;
  font-size: 0.9rem;
  background: rgba(10, 18, 30, 0.85);
  color: #eaf2fb;
  border: 1px solid rgba(255, 255, 255, 0.18);
}
.explore.on {
  background: #eaf2fb;
  color: #05080f;
}
.explore:disabled {
  opacity: 0.5;
}
.now {
  position: absolute;
  top: 172px;
  right: 14px;
  display: grid;
  gap: 2px;
  max-width: 300px;
  padding: 14px 16px;
  border-radius: var(--radius-sm);
  background: rgba(10, 18, 30, 0.88);
  border: 1px solid var(--c);
  color: #c4d3e2;
  font-size: 0.85rem;
  backdrop-filter: blur(8px);
}
.now .k {
  text-transform: uppercase;
  letter-spacing: 0.15em;
  font-size: 0.7rem;
  font-weight: 800;
  color: var(--c);
}
.now .v {
  color: #eaf2fb;
  font-weight: 700;
}
.now .v strong {
  font-family: var(--font-head);
  font-size: 1.8rem;
  color: var(--c);
}
.now.day {
  max-width: 330px;
}
.now .head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.minbtn {
  width: 28px;
  height: 28px;
  flex: none;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(255, 255, 255, 0.06);
  color: #eaf2fb;
  font-size: 1.1rem;
  font-weight: 800;
  line-height: 1;
}
.now.min {
  padding: 10px 12px;
}
.now .mini {
  flex: 1;
  text-align: center;
  font-weight: 700;
  color: #c4d3e2;
}
.now .mini strong {
  margin-left: 6px;
  color: var(--c);
}
.daypick {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 6px 0 2px;
}
.daypick input {
  flex: 1;
  min-width: 0;
  padding: 6px 8px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(255, 255, 255, 0.06);
  color: #eaf2fb;
  font: inherit;
  font-weight: 700;
  color-scheme: dark;
}
.daypick .arrow {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(255, 255, 255, 0.06);
  color: #eaf2fb;
  font-size: 1.2rem;
  line-height: 1;
}
.daypick .arrow:disabled {
  opacity: 0.35;
}
.now .date {
  color: #9fb3c8;
  font-weight: 700;
}
.now .date::first-letter {
  text-transform: uppercase;
}
.explore .short {
  display: none;
}
.now .note {
  color: #8197ad;
}
.quick {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}
.quick .chip {
  font-size: 0.75rem;
  padding: 4px 10px;
}
.station small {
  margin-left: 3px;
  color: #9fb3c8;
  font-weight: 700;
}
.now .kids {
  margin-top: 4px;
  font-weight: 700;
  color: #eaf2fb;
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
  .actions {
    left: 14px;
    right: 14px;
    flex-direction: row;
    flex-wrap: wrap;
    justify-content: space-between;
  }
  .explore {
    font-size: 0.8rem;
    padding: 6px 12px;
  }
  .explore .long {
    display: none;
  }
  .explore .short {
    display: inline;
  }
  .map.is-live .fogbox {
    display: none; /* na telefonu v načinu »zdaj« pokažemo samo kartico s stanjem */
  }
  .now {
    top: auto;
    bottom: 14px;
    left: 14px;
    right: 14px;
    max-width: none;
  }
  .fogbox {
    right: 14px;
    max-width: none;
  }
}
</style>
