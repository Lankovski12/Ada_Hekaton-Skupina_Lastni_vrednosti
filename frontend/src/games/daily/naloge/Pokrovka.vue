<script setup lang="ts">
// Naloga 6: na prerezu kotline povleci »pokrovko« (vrh plasti, v kateri se zrak meša) na pravo višino.
// Prava vrednost je jutranja višina mejne plasti iz vremenskega modela (Open-Meteo / ERA5) – ocena, ne meritev.
import { computed, ref } from 'vue'
import type { Dan } from '../dan'
import type { Rezultat } from '../vrste'

const props = defineProps<{ dan: Dan }>()
const emit = defineEmits<{ konec: [Rezultat] }>()

const H = 300 // višina risbe (px v viewBox)
const MAXM = 1500 // m nad tlemi na vrhu risbe
// korenska lestvica: nizke višine (kjer je zanimivo) so bolj raztegnjene
const toY = (m: number) => H - Math.sqrt(Math.max(0, m) / MAXM) * (H - 20)
const toM = (y: number) => Math.round(((H - y) / (H - 20)) ** 2 * MAXM)

const prav = computed(() => Math.round(props.dan.vreme?.mejna_plast_m ?? 100))
const ugib = ref(400)
const odgovorjeno = ref(false)
const svg = ref<SVGSVGElement | null>(null)
let vlecem = false

function nastavi(e: PointerEvent) {
  if (!svg.value || odgovorjeno.value) return
  const r = svg.value.getBoundingClientRect()
  const y = ((e.clientY - r.top) / r.height) * 340
  ugib.value = Math.min(MAXM, Math.max(10, toM(Math.min(H, Math.max(20, y)))))
}
function down(e: PointerEvent) {
  vlecem = true
  svg.value?.setPointerCapture(e.pointerId)
  nastavi(e)
}
function move(e: PointerEvent) {
  if (vlecem) nastavi(e)
}

// prerez: Rožnik (~100 m nad mestom), mesto, Grajski grič (~80 m), Šmarna gora (~370 m)
const teren = [
  `M60 ${H}`, `L60 ${toY(30)}`, `L150 ${toY(100)}`, `L215 ${toY(6)}`, `L300 ${toY(6)}`, `L330 ${toY(80)}`,
  `L360 ${toY(6)}`, `L470 ${toY(6)}`, `L530 ${toY(370)}`, `L600 ${toY(90)}`, `L600 ${H}`, 'Z',
].join(' ')

const LANDMARKS = [
  { ime: 'Nebotičnik', m: 70, x: 250 },
  { ime: 'Grajski grič', m: 80, x: 330 },
  { ime: 'Rožnik', m: 100, x: 150 },
  { ime: 'Šmarna gora', m: 370, x: 520 },
]

function potrdi() {
  odgovorjeno.value = true
  const ratio = Math.abs(Math.log(ugib.value / Math.max(10, prav.value)))
  const zvezdice = ratio <= Math.log(1.35) ? 3 : ratio <= Math.log(2) ? 2 : ratio <= Math.log(3.5) ? 1 : 0
  const pod = LANDMARKS.filter((l) => l.m > prav.value).map((l) => l.ime)
  emit('konec', {
    zvezdice,
    razlaga:
      `Včeraj zjutraj se je zrak mešal približno do ${prav.value} m nad tlemi, ti si rekel ${ugib.value} m. ` +
      (pod.length ? `Pokrovka je bila nižja od: ${pod.join(', ')}. Ves dim mesta je bil ujet tako nizko! ` : 'Zrak se je mešal visoko, zato se je smog razredčil. ') +
      'To je ocena vremenskega modela, ne meritev.',
  })
}
</script>

<template>
  <div class="naloga">
    <p class="vprasanje">Kako visoko je včeraj zjutraj segala <strong>pokrovka</strong> nad Ljubljano? Povleci meglo gor ali dol.</p>
    <svg ref="svg" class="cut" viewBox="0 0 600 340" @pointerdown="down" @pointermove="move" @pointerup="vlecem = false">
      <defs>
        <linearGradient id="nebo" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8fd3ff" /><stop offset="1" stop-color="#e7f6ff" /></linearGradient>
        <linearGradient id="megla" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c9c1b6" stop-opacity="0.55" /><stop offset="1" stop-color="#a99f92" stop-opacity="0.9" /></linearGradient>
      </defs>
      <rect width="600" height="340" fill="url(#nebo)" />
      <!-- lestvica -->
      <g class="axis">
        <template v-for="m in [50, 100, 200, 400, 800, 1500]" :key="m">
          <line x1="60" :x2="600" :y1="toY(m)" :y2="toY(m)" />
          <text x="56" :y="toY(m) + 4" text-anchor="end">{{ m }} m</text>
        </template>
      </g>
      <!-- teren: Rožnik, mesto, grad, Šmarna gora -->
      <path :d="teren" fill="#6fa35a" />
      <rect v-for="i in 12" :key="i" :x="200 + i * 20" :y="toY(8 + ((i * 37) % 20))" width="14" :height="H - toY(8 + ((i * 37) % 20))" fill="#c9a78f" />
      <rect x="244" :y="toY(70)" width="12" :height="H - toY(70)" fill="#e8e2d8" stroke="#8a7a6a" />
      <text v-for="l in LANDMARKS" :key="l.ime" :x="l.x" :y="toY(l.m) - 8" text-anchor="middle" class="lm">{{ l.ime }}</text>
      <!-- tvoja pokrovka -->
      <rect x="60" :y="toY(ugib)" width="540" :height="H - toY(ugib)" fill="url(#megla)" class="fog" />
      <line x1="60" x2="600" :y1="toY(ugib)" :y2="toY(ugib)" class="lid" />
      <g :transform="`translate(560 ${toY(ugib)})`" class="handle">
        <circle r="18" />
        <path d="M-6 -4 L0 -10 L6 -4 M-6 4 L0 10 L6 4" />
      </g>
      <text x="80" :y="toY(ugib) - 10" class="you">ti: {{ ugib }} m</text>
      <!-- prava -->
      <g v-if="odgovorjeno" class="truth">
        <line x1="60" x2="600" :y1="toY(prav)" :y2="toY(prav)" />
        <text x="320" :y="toY(prav) - 10" text-anchor="middle">pravilno: {{ prav }} m</text>
      </g>
    </svg>
    <input v-model.number="ugib" class="sr" type="range" min="10" :max="MAXM" :disabled="odgovorjeno" aria-label="Višina pokrovke v metrih" />
    <button v-if="!odgovorjeno" class="k-btn green" @click="potrdi">Potrdi</button>
  </div>
</template>

<style scoped>
.cut {
  width: 100%;
  border-radius: 24px;
  touch-action: none;
  cursor: ns-resize;
}
.axis line {
  stroke: rgba(29, 53, 87, 0.12);
}
.axis text {
  font-size: 11px;
  font-weight: 700;
  fill: #5b6b7b;
}
.lm {
  font-size: 12px;
  font-weight: 800;
  fill: #1d3557;
  paint-order: stroke;
  stroke: #fff;
  stroke-width: 3px;
}
.lid {
  stroke: #6e6458;
  stroke-width: 3;
  stroke-dasharray: 8 6;
}
.handle circle {
  fill: #ffc22e;
  stroke: #fff;
  stroke-width: 4;
}
.handle path {
  stroke: #5c3d00;
  stroke-width: 2.5;
  fill: none;
}
.you {
  font-family: var(--font-head);
  font-size: 16px;
  font-weight: 800;
  fill: #1d3557;
}
.truth line {
  stroke: #e5484d;
  stroke-width: 4;
}
.truth text {
  font-family: var(--font-head);
  font-size: 18px;
  font-weight: 800;
  fill: #e5484d;
  paint-order: stroke;
  stroke: #fff;
  stroke-width: 4px;
}
.sr {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}
</style>
