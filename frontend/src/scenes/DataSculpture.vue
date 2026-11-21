<script setup lang="ts">
// »Podatkovna skulptura«: oblak delcev, ki ga oblikuje PM2.5.
// Čist zrak = mirna, gladka krogla, ki počasi diha. Umazan zrak = nemirna, bodičasta oblika
// in vedno več zbeglih delcev okoli nje. Povleci (miška ali prst), da jo zavrtiš.
// Narejeno s canvas 2D (brez knjižnic), da teče tudi na telefonu v Capacitorju.
import { onBeforeUnmount, onMounted, ref } from 'vue'

const props = withDefaults(defineProps<{ pm25: number; color: string; core?: number }>(), { core: 1600 })

const canvas = ref<HTMLCanvasElement | null>(null)

type V3 = [number, number, number]
interface Stray {
  d: V3
  r: number
  speed: number
  phase: number
}

// --- geometrija ---
function fibSphere(n: number): V3[] {
  const pts: V3[] = []
  const g = Math.PI * (3 - Math.sqrt(5))
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2
    const r = Math.sqrt(1 - y * y)
    pts.push([Math.cos(g * i) * r, y, Math.sin(g * i) * r])
  }
  return pts
}
function randUnit(): V3 {
  const u = Math.random() * 2 - 1
  const t = Math.random() * Math.PI * 2
  const s = Math.sqrt(1 - u * u)
  return [s * Math.cos(t), u, s * Math.sin(t)]
}
const corePts = fibSphere(props.core)
const waves = Array.from({ length: 5 }, () => ({ w: randUnit(), f: 2 + Math.random() * 3, s: 0.5 + Math.random(), p: Math.random() * 6.28 }))
const strays: Stray[] = Array.from({ length: 700 }, () => ({
  d: randUnit(),
  r: 1.15 + Math.random() * 0.9,
  speed: (Math.random() - 0.5) * 0.6,
  phase: Math.random() * 6.28,
}))

// --- stanje (gladko sledi props) ---
let pm = props.pm25
let rgb = hexToRgb(props.color)
let yaw = 0.4
let pitch = -0.25
let yawVel = 0.0025
let pitchVel = 0
let dragging = false
let lastX = 0
let lastY = 0
let raf = 0
let w = 0
let h = 0
let dpr = 1
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

  // gladek prehod med stanji
  pm += (props.pm25 - pm) * 0.04
  const target = hexToRgb(props.color)
  rgb = rgb.map((v, i) => v + (target[i]! - v) * 0.05) as V3

  const bad = Math.min(1, pm / 80)
  const amp = 0.03 + bad * 0.5
  const freq = 1 + bad * 2.2
  const speed = (reduced ? 0.2 : 1) * (0.35 + bad * 1.6)
  const breath = 1 + 0.045 * Math.sin((t * Math.PI * 2) / 5) // en vdih na ~5 s

  if (!dragging) {
    yaw += yawVel
    pitch += pitchVel
    yawVel += (0.0025 - yawVel) * 0.02
    pitchVel *= 0.95
  }
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch)

  // na širokem zaslonu levo od besedila, na telefonu nad kartico
  const wide = w > 900
  const R = Math.min(wide ? w * 0.55 : w, h) * (wide ? 0.3 : 0.32)
  const ox = wide ? w * 0.34 : w / 2
  const oy = wide ? h / 2 : h * 0.36
  const fov = 3.2

  // ozadje s sledjo (motion blur)
  ctx.globalCompositeOperation = 'source-over'
  ctx.fillStyle = 'rgba(5, 8, 15, 0.45)'
  ctx.fillRect(0, 0, w, h)
  ctx.globalCompositeOperation = 'lighter'

  const draw = (x: number, y: number, z: number, size: number, alpha: number, col: V3) => {
    // vrtenje
    const x1 = x * cy - z * sy
    const z1 = x * sy + z * cy
    const y1 = y * cp - z1 * sp
    const z2 = y * sp + z1 * cp
    const s = fov / (fov + z2)
    const depth = (1 - z2) / 2 // 0 zadaj, 1 spredaj
    ctx.fillStyle = `rgba(${col[0] | 0},${col[1] | 0},${col[2] | 0},${alpha * (0.25 + 0.75 * depth)})`
    const px = ox + x1 * R * s
    const py = oy + y1 * R * s
    const r = size * (0.5 + depth) * s
    ctx.fillRect(px - r / 2, py - r / 2, r, r)
  }

  // jedro
  for (const p of corePts) {
    let n = 0
    for (const wv of waves) n += Math.sin(wv.f * freq * (p[0] * wv.w[0] + p[1] * wv.w[1] + p[2] * wv.w[2]) + t * wv.s * speed + wv.p)
    const r = breath * (1 + (amp * n) / waves.length) * (1 + bad * 0.08 * Math.sin(t * 9 + p[0] * 40))
    draw(p[0] * r, p[1] * r, p[2] * r, 2.2, 0.85, rgb)
  }

  // zbegani delci – več jih je, bolj ko je zrak umazan
  const nStray = Math.round(Math.min(strays.length, pm * 7))
  const grey: V3 = [rgb[0] * 0.5 + 90, rgb[1] * 0.5 + 80, rgb[2] * 0.5 + 70]
  for (let i = 0; i < nStray; i++) {
    const s = strays[i]!
    const a = t * s.speed * speed + s.phase
    const ca = Math.cos(a), sa = Math.sin(a)
    const x = s.d[0] * ca - s.d[2] * sa
    const z = s.d[0] * sa + s.d[2] * ca
    const rr = s.r * breath * (1 + 0.05 * Math.sin(t * 2 + s.phase))
    draw(x * rr, (s.d[1] + 0.08 * Math.sin(a * 3)) * rr, z * rr, 1.6, 0.5, grey)
  }

  raf = requestAnimationFrame(frame)
}

function onDown(e: PointerEvent) {
  dragging = true
  lastX = e.clientX
  lastY = e.clientY
  canvas.value?.setPointerCapture(e.pointerId)
}
function onMove(e: PointerEvent) {
  if (!dragging) return
  const dx = e.clientX - lastX
  const dy = e.clientY - lastY
  lastX = e.clientX
  lastY = e.clientY
  yawVel = dx * 0.006
  pitchVel = dy * 0.004
  yaw += yawVel
  pitch = Math.max(-1.2, Math.min(1.2, pitch + pitchVel))
}
function onUp() {
  dragging = false
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
    class="sculpture"
    role="img"
    :aria-label="`Oblak delcev pri ${Math.round(pm25)} µg/m³ PM2.5. Povleci, da ga zavrtiš.`"
    @pointerdown="onDown"
    @pointermove="onMove"
    @pointerup="onUp"
    @pointercancel="onUp"
  />
</template>

<style scoped>
.sculpture {
  display: block;
  width: 100%;
  height: 100%;
  cursor: grab;
  touch-action: pan-y; /* navpično drsenje strani še vedno deluje */
}
.sculpture:active {
  cursor: grabbing;
}
</style>
