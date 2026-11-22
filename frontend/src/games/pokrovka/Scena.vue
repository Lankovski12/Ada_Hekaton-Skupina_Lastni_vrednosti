<script setup lang="ts">
// Prerez Ljubljanske kotline: hrib (Pasja ravan) levo, mesto z dimnikom desno.
// Ozadje je obarvano po temperaturi na vsaki višini (modro = mraz, oranžno = toplo), zato se inverzija vidi kot
// topla plast nad mrzlim dnom. Dim iz dimnika se dviga do pokrovke in se tam razleze vstran.
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { HRIB_M, NAJVEC, temperatura, visinaPokrovke } from './fizika'

const props = withDefaults(
  defineProps<{
    tDolina: number
    tHrib: number
    cilj?: number | null // črtkana zlata črta (višina v m)
    resnica?: number | null // rdeča črta po odgovoru
    noc?: boolean
    veter?: boolean
    hladniTok?: boolean // puščice hladnega zraka po pobočjih (zgodba)
    poudariPokrovko?: boolean
  }>(),
  { cilj: null, resnica: null, noc: false, veter: false, hladniTok: false, poudariPokrovko: false },
)

// gladek prehod temperatur (za zgodbo in drsnike)
const tD = ref(props.tDolina)
const tH = ref(props.tHrib)
const W = 800
const TLA = 400
const VRH = 40
const y = (z: number) => TLA - Math.sqrt(Math.max(0, z) / NAJVEC) * (TLA - VRH)
const zOd = (yy: number) => ((TLA - yy) / (TLA - VRH)) ** 2 * NAJVEC

const pokrovka = computed(() => visinaPokrovke(tD.value, tH.value))
const imaPokrovko = computed(() => pokrovka.value < NAJVEC - 10)

function barva(t: number): string {
  // -10 °C temno modra, 0 °C svetlo modra, +12 °C oranžna
  const c = (a: number[], b: number[], k: number) => a.map((v, i) => Math.round(v + (b[i]! - v) * k))
  const k = Math.max(-1, Math.min(1, t / (t < 0 ? 10 : 12)))
  const rgb = k < 0 ? c([214, 236, 255], [70, 130, 230], -k) : c([214, 236, 255], [255, 170, 80], k)
  return `rgb(${rgb.join(',')})`
}
const stops = computed(() =>
  Array.from({ length: 24 }, (_, i) => {
    const off = i / 23
    const z = zOd(VRH + off * (TLA - VRH))
    return { off, col: barva(temperatura(z, tD.value, tH.value)) }
  }),
)

const hrib = `M0 ${TLA} L0 ${y(300)} L80 ${y(560)} L150 ${y(HRIB_M)} L215 ${y(520)} L290 ${y(150)} L340 ${y(20)} L340 ${TLA} Z`
const hribDesno = `M700 ${TLA} L740 ${y(180)} L800 ${y(260)} L800 ${TLA} Z`
const hise = Array.from({ length: 14 }, (_, i) => ({ x: 380 + i * 22, h: 10 + ((i * 29) % 26) }))
const DIMNIK = { x: 560, z: 25 }

// --- dim (canvas nad SVG) ---
const canvas = ref<HTMLCanvasElement | null>(null)
interface Delec { z: number; x: number; vx: number; a: number; r: number }
let delci: Delec[] = []
let raf = 0
let last = 0

function frame(t: number) {
  const dt = Math.min(0.05, (t - last) / 1000 || 0.016)
  last = t
  // temperature počasi sledijo props
  tD.value += (props.tDolina - tD.value) * Math.min(1, dt * 4)
  tH.value += (props.tHrib - tH.value) * Math.min(1, dt * 4)

  const c = canvas.value
  const ctx = c?.getContext('2d')
  if (!c || !ctx) return
  const sx = c.width / W
  const sy = c.height / 440
  if (Math.random() < dt * 14) delci.push({ z: DIMNIK.z, x: DIMNIK.x, vx: 0, a: 0.55, r: 6 })
  const lid = pokrovka.value
  ctx.clearRect(0, 0, c.width, c.height)
  for (const d of delci) {
    const doLid = lid - d.z
    // dviga se, dokler ni pod pokrovko; tam se ustavi in razleze vstran
    if (doLid > 6) d.z += Math.min(120, 15 + doLid * 0.8) * dt
    else {
      // pod pokrovko se dim razleze vstran (vsak delec v svojo smer)
      if (d.vx === 0) d.vx = (Math.random() < 0.5 ? -1 : 1) * (25 + Math.random() * 35)
      d.z = Math.max(4, d.z + (Math.random() - 0.6) * 10 * dt)
    }
    d.x += d.vx * dt + (props.veter ? 40 * dt : 0)
    d.r = Math.min(26, d.r + dt * 5)
    d.a -= dt * (imaPokrovko.value ? 0.045 : 0.09)
    ctx.globalAlpha = Math.max(0, d.a)
    ctx.fillStyle = '#7d756c'
    ctx.beginPath()
    ctx.arc(d.x * sx, y(d.z) * sy, d.r * sx, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1
  delci = delci.filter((d) => d.a > 0 && d.x > -40 && d.x < W + 40)
  raf = requestAnimationFrame(frame)
}

function resize() {
  const c = canvas.value
  if (!c) return
  const r = c.getBoundingClientRect()
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  c.width = r.width * dpr
  c.height = r.height * dpr
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
watch(
  () => props.noc,
  () => (delci = []),
)

const fmt = (t: number) => `${t > 0 ? '+' : ''}${String(Math.round(t * 10) / 10).replace('.', ',')} °C`
const smogOpacity = computed(() => (imaPokrovko.value ? Math.max(0.08, 0.6 - pokrovka.value / 700) : 0))
</script>

<template>
  <div class="scena">
    <svg :viewBox="`0 0 ${W} 440`" preserveAspectRatio="xMidYMid meet" role="img" :aria-label="`Pokrovka na ${pokrovka} m`">
      <defs>
        <linearGradient id="temp" gradientUnits="userSpaceOnUse" x1="0" :y1="VRH" x2="0" :y2="TLA">
          <stop v-for="s in stops" :key="s.off" :offset="s.off" :stop-color="s.col" />
        </linearGradient>
      </defs>
      <rect width="800" height="440" fill="url(#temp)" />
      <rect v-if="noc" width="800" height="440" fill="#0b1630" opacity="0.45" />
      <circle v-if="!noc" cx="700" cy="70" r="26" fill="#ffd54a" />
      <circle v-else cx="700" cy="70" r="18" fill="#f3f0d8" />

      <!-- višinska lestvica -->
      <g class="axis">
        <template v-for="m in [50, 100, 200, 400, 700, 1000, 1500]" :key="m">
          <line x1="0" x2="800" :y1="y(m)" :y2="y(m)" />
          <text x="796" :y="y(m) - 3" text-anchor="end">{{ m }} m</text>
        </template>
      </g>

      <!-- smog pod pokrovko -->
      <rect v-if="imaPokrovko" x="0" :y="y(pokrovka)" width="800" :height="TLA - y(pokrovka)" fill="#8f877c" :opacity="smogOpacity" class="smog" />

      <!-- hribi in mesto -->
      <path :d="hrib" fill="#5e9150" />
      <path :d="hribDesno" fill="#6fa35a" />
      <rect x="0" :y="TLA" width="800" height="40" fill="#557f45" />
      <g fill="#c9a78f">
        <rect v-for="(h, i) in hise" :key="i" :x="h.x" :y="y(h.h)" width="16" :height="TLA - y(h.h)" />
      </g>
      <rect x="470" :y="y(70)" width="14" :height="TLA - y(70)" fill="#e8e2d8" stroke="#8a7a6a" />
      <rect :x="DIMNIK.x - 6" :y="y(DIMNIK.z)" width="12" :height="TLA - y(DIMNIK.z)" fill="#d9d9d9" stroke="#666" />
      <rect :x="DIMNIK.x - 6" :y="y(DIMNIK.z)" width="12" height="6" fill="#e5484d" />

      <!-- vremenska postaja na hribu -->
      <line x1="150" :x2="150" :y1="y(HRIB_M)" :y2="y(HRIB_M) - 20" stroke="#333" stroke-width="2" />
      <rect x="143" :y="y(HRIB_M) - 26" width="14" height="8" fill="#fff" stroke="#333" />

      <!-- hladen zrak polzi v dolino -->
      <g v-if="hladniTok" class="cold">
        <path :d="`M95 ${y(500)} Q200 ${y(150)} 330 ${y(15)}`" />
        <path :d="`M790 ${y(240)} Q760 ${y(100)} 700 ${y(15)}`" />
      </g>
      <!-- veter -->
      <g v-if="veter" class="wind">
        <path v-for="i in 4" :key="i" :d="`M-60 ${70 + i * 45} h160`" :style="{ animationDelay: `${i * 0.3}s` }" />
      </g>

      <!-- pokrovka -->
      <g v-if="imaPokrovko" :class="{ glow: poudariPokrovko }">
        <line x1="0" x2="800" :y1="y(pokrovka)" :y2="y(pokrovka)" class="lid" />
        <text x="350" :y="y(pokrovka) - 8" class="lidtxt">pokrovka ~{{ pokrovka }} m</text>
      </g>
      <text v-else x="350" y="60" class="lidtxt">ni pokrovke – dim se dviga visoko</text>

      <!-- cilj in resnica -->
      <g v-if="cilj != null && resnica == null">
        <line x1="0" x2="800" :y1="y(cilj)" :y2="y(cilj)" class="goal" />
        <text x="10" :y="y(cilj) + 18" class="goaltxt">cilj: {{ cilj }} m</text>
      </g>
      <g v-if="resnica != null">
        <line x1="0" x2="800" :y1="y(resnica)" :y2="y(resnica)" class="truth" />
        <text x="10" :y="y(resnica) - 8" class="truthtxt">včeraj: {{ resnica }} m</text>
      </g>

      <!-- termometra -->
      <g :transform="`translate(150 ${y(HRIB_M) - 58})`">
        <rect x="-44" y="-18" width="88" height="30" rx="15" class="badge" :fill="barva(tH)" />
        <text y="3" class="badgetxt">{{ fmt(tH) }}</text>
      </g>
      <g :transform="`translate(520 ${TLA + 24})`">
        <rect x="-44" y="-15" width="88" height="30" rx="15" class="badge" :fill="barva(tD)" />
        <text y="6" class="badgetxt">{{ fmt(tD) }}</text>
      </g>
      <text x="150" :y="y(HRIB_M) - 82" class="place">Pasja ravan</text>
      <text x="640" :y="TLA + 30" class="place">Ljubljana</text>
    </svg>
    <canvas ref="canvas" class="smoke" aria-hidden="true" />
  </div>
</template>

<style scoped>
.scena {
  position: relative;
  border-radius: 24px;
  overflow: hidden;
  box-shadow: inset 0 0 0 4px rgba(255, 255, 255, 0.6);
}
svg,
.smoke {
  display: block;
  width: 100%;
  aspect-ratio: 800 / 440;
}
.smoke {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
.axis line {
  stroke: rgba(29, 53, 87, 0.12);
}
.axis text {
  font-size: 11px;
  font-weight: 700;
  fill: rgba(29, 53, 87, 0.6);
}
.smog {
  transition: opacity 0.4s;
}
.lid {
  stroke: #fff;
  stroke-width: 4;
  stroke-dasharray: 14 8;
}
.glow .lid {
  animation: blink 0.8s ease-in-out infinite alternate;
}
.lidtxt,
.goaltxt,
.truthtxt,
.place,
.badgetxt {
  font-family: var(--font-head);
  font-weight: 800;
  paint-order: stroke;
}
.lidtxt {
  font-size: 18px;
  fill: #1d3557;
  stroke: #fff;
  stroke-width: 4px;
}
.goal {
  stroke: #ffb21e;
  stroke-width: 4;
  stroke-dasharray: 4 6;
}
.goaltxt {
  font-size: 16px;
  fill: #b06d00;
  stroke: #fff;
  stroke-width: 4px;
}
.truth {
  stroke: #e5484d;
  stroke-width: 4;
}
.truthtxt {
  font-size: 16px;
  fill: #e5484d;
  stroke: #fff;
  stroke-width: 4px;
}
.badge {
  stroke: #fff;
  stroke-width: 3;
}
.badgetxt {
  font-size: 16px;
  fill: #1d3557;
  text-anchor: middle;
}
.place {
  font-size: 14px;
  fill: #1d3557;
  stroke: #fff;
  stroke-width: 3px;
  text-anchor: middle;
}
.cold path {
  fill: none;
  stroke: #2f6fe0;
  stroke-width: 6;
  stroke-linecap: round;
  stroke-dasharray: 12 14;
  animation: flow 1s linear infinite;
}
.wind path {
  stroke: #fff;
  stroke-width: 5;
  stroke-linecap: round;
  opacity: 0.85;
  animation: wind 1.6s linear infinite;
}
@keyframes flow {
  to {
    stroke-dashoffset: -26;
  }
}
@keyframes wind {
  to {
    transform: translateX(900px);
  }
}
@keyframes blink {
  to {
    stroke: #ffb21e;
  }
}
</style>
