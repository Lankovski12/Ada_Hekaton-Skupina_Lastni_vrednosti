<script setup lang="ts">
// Pljuča iz pik (enak slog kot nekdanja krogla delcev), ki dihajo zrak, ki ga pokaže PM2.5.
// Čist zrak = počasno, globoko dihanje in malo delcev okoli. Umazan zrak = hitro, plitvo, nemirno dihanje
// in vedno več zbeglih delcev. Povleci (miška ali prst), da jih zavrtiš; klik sproži dogodek »klik«.
// Narejeno s canvas 2D (brez knjižnic), da teče tudi na telefonu v Capacitorju.
import { onBeforeUnmount, onMounted, ref } from 'vue'

const props = defineProps<{ pm25: number; color: string }>()
const emit = defineEmits<{ klik: [] }>()

const canvas = ref<HTMLCanvasElement | null>(null)

type V3 = [number, number, number]
interface Pt {
  p: V3
  lung: number // -1 desno krilo (levo na zaslonu), 1 levo krilo, 0 sapnik in bronhiji
  r: number // velikost pike
  a: number // osnovna prosojnost (notranje pike so bolj prosojne)
  ph: number // faza za lebdenje in utripanje
  low: number // 0 vrh, 1 dno krila (dno se ob vdihu razširi bolj)
}
interface Stray {
  d: V3
  r: number
  speed: number
  phase: number
}

// --- geometrija: mehka, nesimetrična pljuča ---
let seed = 3
const rnd = () => {
  seed = (seed * 16807) % 2147483647
  return (seed - 1) / 2147483646
}
function randUnit(): V3 {
  const u = rnd() * 2 - 1
  const t = rnd() * Math.PI * 2
  const s = Math.sqrt(1 - u * u)
  return [s * Math.cos(t), u, s * Math.sin(t)]
}
/** smer na krogli -> točka pljučnega krila; f < 1 pomeni točko v notranjosti */
function lungShape([x, y, z]: V3, side: number, f: number): V3 {
  const k = (1 - y) / 2 // 0 vrh, 1 dno
  // desno krilo (levo na zaslonu) je širše in krajše, levo ožje in daljše
  const sirina = side < 0 ? 0.86 : 0.74
  const visina = side < 0 ? 1.1 : 1.2
  const width = 0.28 + 0.72 * Math.pow(k, 0.5)
  // nepravilen, valovit rob (kot pravi organ, ne geometrijsko telo)
  const th = Math.atan2(z, x)
  const val = 1 + 0.045 * Math.sin(3 * th + side * 1.3 + y * 2.1) + 0.03 * Math.sin(5 * y + th * 2)
  let nx = x * width * sirina * val
  const medial = nx * side < 0 // stran proti srcu
  if (medial) nx *= 0.42
  let ny = y * visina
  if (y < -0.3) ny += 0.33 * (1 - x * x - z * z) * (-y - 0.3) // vbočeno dno (prepona)
  let nz = z * width * 0.56 * val
  if (side > 0 && medial && y < 0.15 && y > -0.85 && z < 0.1) nx *= 0.5 // srčna zareza
  // reža med režnji: točke blizu poševne ravnine potegnemo malo navznoter
  const reza = Math.abs(y + 0.15 - side * 0.55 * x)
  if (reza < 0.12 && f > 0.9) {
    const v = 1 - (0.12 - reza) * 0.55
    nx *= v
    nz *= v
  }
  return [(nx * f) + side * 0.6, ny * (0.85 + 0.15 * f) - 0.2, nz * f]
}
const pts: Pt[] = []
for (const side of [-1, 1]) {
  // površje
  for (let i = 0; i < 1250; i++) {
    const d = randUnit()
    pts.push({ p: lungShape(d, side, 1), lung: side, r: 1.6 + rnd() * 1.3, a: 0.85, ph: rnd() * 6.28, low: (1 - d[1]) / 2 })
  }
  // notranjost: redkejši, prosojnejši oblak
  for (let i = 0; i < 420; i++) {
    const d = randUnit()
    const f = 0.35 + Math.pow(rnd(), 0.6) * 0.55
    pts.push({ p: lungShape(d, side, f), lung: side, r: 1.4 + rnd(), a: 0.35, ph: rnd() * 6.28, low: (1 - d[1]) / 2 })
  }
}
/** ukrivljena veja (kvadratna Bézierjeva krivulja); debelejše veje kot obroči, tanke kot niz pik */
function veja(a: V3, b: V3, bend: V3, r: number, n: number, per: number) {
  const c: V3 = [(a[0] + b[0]) / 2 + bend[0], (a[1] + b[1]) / 2 + bend[1], (a[2] + b[2]) / 2 + bend[2]]
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t
    const q: V3 = [u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1],
      u * u * a[2] + 2 * u * t * c[2] + t * t * b[2]]
    for (let j = 0; j < per; j++) {
      const ang = (j / per) * Math.PI * 2 + i * 0.5
      const rr = r * (1 - t * 0.35)
      pts.push({ p: [q[0] + Math.cos(ang) * rr, q[1], q[2] + Math.sin(ang) * rr], lung: 0, r: 1.5 + rnd() * 0.6, a: 0.85, ph: rnd() * 6.28, low: 0 })
    }
  }
}
/** bronhialno drevo: vsaka veja se razcepi na dve manjši, do globine 3 */
function drevo(a: V3, dir: V3, len: number, r: number, depth: number) {
  const b: V3 = [a[0] + dir[0] * len, a[1] + dir[1] * len, a[2] + dir[2] * len]
  veja(a, b, [(rnd() - 0.5) * len * 0.3, (rnd() - 0.5) * len * 0.2, (rnd() - 0.5) * len * 0.3], r, Math.max(3, Math.round(len * 22)), r > 0.05 ? 7 : 1)
  if (depth <= 0) return
  for (const s of [-1, 1]) {
    const ang = s * (0.45 + rnd() * 0.35)
    const ca = Math.cos(ang), sa = Math.sin(ang)
    const nd: V3 = [dir[0] * ca - dir[1] * sa, dir[0] * sa + dir[1] * ca, dir[2] + (rnd() - 0.5) * 0.5]
    const l = Math.hypot(nd[0], nd[1], nd[2])
    drevo(b, [nd[0] / l, nd[1] / l, nd[2] / l], len * (0.62 + rnd() * 0.15), r * 0.6, depth - 1)
  }
}
const fork: V3 = [0, 0.72, 0]
veja([0, 1.36, 0.02], fork, [0.02, 0, -0.02], 0.095, 16, 10) // sapnik
for (const s of [-1, 1]) {
  const b: V3 = [s * 0.42, 0.36, 0]
  veja(fork, b, [0, 0.06, 0], 0.07, 9, 8) // glavni bronhij
  drevo(b, [s * 0.35, -0.94, 0], 0.38, 0.05, 3)
  drevo(b, [s * 0.9, -0.3, 0.1], 0.26, 0.04, 2)
}
const strays: Stray[] = Array.from({ length: 700 }, () => ({
  d: randUnit(),
  r: 1.5 + Math.random() * 0.9,
  speed: (Math.random() - 0.5) * 0.6,
  phase: Math.random() * 6.28,
}))

// --- stanje (gladko sledi props) ---
let pm = props.pm25
let rgb = hexToRgb(props.color)
let yaw = 0
let pitch = -0.1
let yawVel = 0
let pitchVel = 0
let dragging = false
let lastX = 0
let lastY = 0
let downX = 0
let downY = 0
let downT = 0
let raf = 0
let w = 0
let h = 0
let dpr = 1
let breathPhase = 0
let lastMs = 0
let box = { x0: 0, y0: 0, x1: 0, y1: 0 } // obseg pljuč na zaslonu (za klik)
const hover = ref(false)
const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

function hexToRgb(hex: string): V3 {
  const n = parseInt(hex.replace('#', ''), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function resize() {
  const c = canvas.value
  if (!c) return
  dpr = Math.min(window.devicePixelRatio || 1, 2)
  w = c.clientWidth
  h = c.clientHeight
  c.width = w * dpr
  c.height = h * dpr
  c.getContext('2d')?.setTransform(dpr, 0, 0, dpr, 0, 0)
}

function frame(ms: number) {
  const c = canvas.value
  const ctx = c?.getContext('2d')
  if (!c || !ctx) return
  const t = ms / 1000
  const dt = Math.min(0.05, (ms - lastMs) / 1000 || 0)
  lastMs = ms

  pm += (props.pm25 - pm) * 0.04
  const target = hexToRgb(props.color)
  rgb = rgb.map((v, i) => v + (target[i]! - v) * 0.05) as V3

  const bad = Math.min(1, pm / 80)
  // čist zrak: en globok vdih na ~5 s; umazan: hitro in plitvo
  const period = 5 - bad * 2.8
  breathPhase += (dt / period) * Math.PI * 2 * (reduced ? 0.4 : 1)
  const inhale = (1 - Math.cos(breathPhase)) / 2 // 0..1
  const depth = 0.11 - bad * 0.055
  const shake = bad * bad * 0.03
  const speed = (reduced ? 0.2 : 1) * (0.35 + bad * 1.6)

  // samodejno rahlo zibanje, da pljuča večinoma gledajo naprej; povleci za vrtenje
  if (!dragging) {
    yaw = Math.atan2(Math.sin(yaw), Math.cos(yaw))
    yaw += yawVel
    yawVel *= 0.95
    // nepravilno, mehko zibanje (dve prepleteni nihanji)
    if (Math.abs(yawVel) < 0.002) yaw += (0.42 * Math.sin(t * 0.23) + 0.15 * Math.sin(t * 0.61 + 1) - yaw) * 0.015
    pitch += pitchVel
    pitchVel *= 0.9
    pitch += (-0.1 + 0.06 * Math.sin(t * 0.37) - pitch) * 0.02
  }
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch)

  const wide = w > 720
  const R = Math.min(w, h) * (wide ? 0.25 : 0.27)
  const ox = w / 2
  const oy = wide ? h * 0.6 : h * 0.43
  const fov = 3.6

  // ozadje s sledjo (kot pri krogli delcev)
  ctx.globalCompositeOperation = 'source-over'
  ctx.fillStyle = 'rgba(5, 8, 15, 0.45)'
  ctx.fillRect(0, 0, w, h)
  ctx.globalCompositeOperation = 'lighter'

  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  const draw = (x: number, y: number, z: number, size: number, alpha: number, col: V3, track = false) => {
    const xr = x * cy - z * sy
    const zr = x * sy + z * cy
    const yr = y * cp - zr * sp
    const z2 = y * sp + zr * cp
    const s = fov / (fov + z2)
    const dep = (1 - z2 / 1.4) / 2 // 0 zadaj, 1 spredaj
    const px = ox + xr * R * s
    const py = oy - yr * R * s
    const r = size * (0.5 + dep) * s
    ctx.fillStyle = `rgba(${col[0] | 0},${col[1] | 0},${col[2] | 0},${alpha * (0.25 + 0.75 * Math.max(0, Math.min(1, dep)))})`
    ctx.fillRect(px - r / 2, py - r / 2, r, r)
    if (track) {
      if (px < x0) x0 = px
      if (px > x1) x1 = px
      if (py < y0) y0 = py
      if (py > y1) y1 = py
    }
  }

  const tubeCol: V3 = [rgb[0] * 0.55 + 100, rgb[1] * 0.55 + 100, rgb[2] * 0.55 + 110]
  for (let i = 0; i < pts.length; i++) {
    const { p, lung, r, a, ph, low } = pts[i]!
    let [x, y, z] = p
    if (lung !== 0) {
      // dihanje: dno krila se razširi in spusti bolj kot vrh (kot bi se spustila prepona)
      const cx = lung * 0.6
      const k = 1 + depth * inhale * (0.55 + 0.75 * low)
      x = cx + (x - cx) * k
      z = z * k
      y = y - depth * 0.45 * inhale * low * low
    } else {
      // sapnik in bronhiji se ob vdihu rahlo raztegnejo
      y = y - depth * 0.12 * inhale * (1.36 - y)
    }
    // vsaka pika rahlo lebdi
    x += Math.sin(t * 0.9 + ph) * 0.012
    y += Math.cos(t * 0.7 + ph * 1.3) * 0.012
    z += Math.sin(t * 0.8 + ph * 0.7) * 0.012
    if (shake) {
      x += Math.sin(t * 13 + i * 1.7) * shake
      y += Math.cos(t * 11 + i) * shake
    }
    const migljaj = 0.72 + 0.28 * Math.sin(t * 1.6 + ph * 3)
    draw(x, y, z, r, a * migljaj, lung ? rgb : tubeCol, a > 0.5)
  }
  box = { x0, y0, x1, y1 }

  // zbegani delci – več jih je, bolj ko je zrak umazan; ob vdihu se približajo pljučem
  const nStray = Math.round(Math.min(strays.length, pm * 7))
  const grey: V3 = [rgb[0] * 0.5 + 90, rgb[1] * 0.5 + 80, rgb[2] * 0.5 + 70]
  for (let i = 0; i < nStray; i++) {
    const s = strays[i]!
    const a = t * s.speed * speed + s.phase
    const ca = Math.cos(a), sa = Math.sin(a)
    const x = s.d[0] * ca - s.d[2] * sa
    const z = s.d[0] * sa + s.d[2] * ca
    const rr = s.r * (1 - 0.08 * inhale) * (1 + 0.05 * Math.sin(t * 2 + s.phase))
    draw(x * rr, (s.d[1] + 0.08 * Math.sin(a * 3)) * rr * 1.1, z * rr, 1.6, 0.5, grey)
  }

  raf = requestAnimationFrame(frame)
}

function inLungs(e: PointerEvent) {
  const rect = canvas.value!.getBoundingClientRect()
  const x = e.clientX - rect.left, y = e.clientY - rect.top
  const pad = 20
  return x > box.x0 - pad && x < box.x1 + pad && y > box.y0 - pad && y < box.y1 + pad
}
function onDown(e: PointerEvent) {
  dragging = true
  lastX = downX = e.clientX
  lastY = downY = e.clientY
  downT = performance.now()
  canvas.value?.setPointerCapture(e.pointerId)
}
function onMove(e: PointerEvent) {
  if (!dragging) {
    hover.value = inLungs(e)
    return
  }
  const dx = e.clientX - lastX
  const dy = e.clientY - lastY
  lastX = e.clientX
  lastY = e.clientY
  yawVel = dx * 0.006
  pitchVel = dy * 0.004
  yaw += yawVel
  pitch = Math.max(-1.0, Math.min(1.0, pitch + pitchVel))
}
function onCancel() {
  dragging = false
}
function onUp(e: PointerEvent) {
  if (!dragging) return
  dragging = false
  // kratek dotik brez vlečenja = klik
  const moved = Math.hypot(e.clientX - downX, e.clientY - downY)
  if (moved < 8 && performance.now() - downT < 500 && inLungs(e)) emit('klik')
}

onMounted(() => {
  resize()
  window.addEventListener('resize', resize)
  raf = requestAnimationFrame(frame)
})
onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  window.removeEventListener('resize', resize)
})
</script>

<template>
  <canvas
    ref="canvas"
    class="pljuca"
    :class="{ hover }"
    role="button"
    tabindex="0"
    :aria-label="`Pljuča, ki dihajo zrak s ${Math.round(pm25)} µg/m³ PM2.5. Klikni za izbiro, povleci za vrtenje.`"
    @pointerdown="onDown"
    @pointermove="onMove"
    @pointerup="onUp"
    @pointercancel="onCancel"
    @keydown.enter.prevent="emit('klik')"
    @keydown.space.prevent="emit('klik')"
  />
</template>

<style scoped>
.pljuca {
  display: block;
  width: 100%;
  height: 100%;
  cursor: grab;
  touch-action: pan-y; /* navpično drsenje strani še vedno deluje */
  outline: none;
}
.pljuca.hover {
  cursor: pointer;
}
.pljuca:active {
  cursor: grabbing;
}
</style>
