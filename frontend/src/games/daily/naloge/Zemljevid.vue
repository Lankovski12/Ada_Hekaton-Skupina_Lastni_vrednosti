<script setup lang="ts">
// Naloga 1: na zemljevidu tapni postajo, kjer je bil včeraj zrak najbolj umazan.
import { computed, onMounted, ref } from 'vue'
import { levelFor } from '@/lib/airQuality'
import { kraj, type Dan, type Postaja } from '../dan'
import type { Rezultat } from '../vrste'

const props = defineProps<{ dan: Dan }>()
const emit = defineEmits<{ konec: [Rezultat] }>()

const obris = ref<[number, number][]>([])
const izbran = ref<Postaja | null>(null)
const odgovorjeno = ref(false)

onMounted(async () => {
  try {
    obris.value = (await (await fetch(`${import.meta.env.BASE_URL}assets/daily/slovenija.json`)).json()).obris
  } catch {
    /* brez obrisa */
  }
})

const KX = Math.cos((46.1 * Math.PI) / 180)
const px = (lon: number) => lon * KX * 100
const py = (lat: number) => -lat * 100

// pogled: cela Slovenija, če so postaje razpršene, sicer približamo
const view = computed(() => {
  const ps = props.dan.postaje
  const lons = ps.map((p) => p.lon)
  const lats = ps.map((p) => p.lat)
  const spread = Math.max(...lons) - Math.min(...lons)
  const [lo0, lo1, la0, la1] =
    spread > 1.2 ? [13.35, 16.62, 45.4, 46.9] : [Math.min(...lons) - 0.25, Math.max(...lons) + 0.25, Math.min(...lats) - 0.15, Math.max(...lats) + 0.15]
  const x = px(lo0)
  const y = py(la1)
  return { x, y, w: px(lo1) - x, h: py(la0) - y }
})
const r = computed(() => view.value.w * 0.02)
const path = computed(() => (obris.value.length ? 'M' + obris.value.map(([lo, la]) => `${px(lo)},${py(la)}`).join('L') + 'Z' : ''))

// en kraj = ena pika (npr. Ljubljana ima tri postaje – vzamemo najbolj onesnaženo)
const kraji = computed<Postaja[]>(() => {
  const m = new Map<string, Postaja>()
  for (const p of props.dan.postaje) {
    const k = kraj(p.ime)
    if (!m.has(k) || p.pm25 > m.get(k)!.pm25) m.set(k, p)
  }
  return [...m.values()]
})
const najvec = computed(() => kraji.value.reduce((a, b) => (b.pm25 > a.pm25 ? b : a)))
const najmanj = computed(() => kraji.value.reduce((a, b) => (b.pm25 < a.pm25 ? b : a)))
const top = computed(() => new Set([...kraji.value].sort((a, b) => b.pm25 - a.pm25).slice(0, 3).map((p) => p.id)))
const pokaziIme = (p: Postaja) =>
  izbran.value?.id === p.id || (odgovorjeno.value && (top.value.has(p.id) || p.id === najmanj.value.id))
const maxPm = computed(() => najvec.value.pm25)

function potrdi() {
  if (!izbran.value) return
  odgovorjeno.value = true
  const v = izbran.value.pm25
  const sorted = props.dan.postaje.map((p) => p.pm25).sort((a, b) => a - b)
  const mediana = sorted[Math.floor(sorted.length / 2)]!
  const zvezdice = izbran.value.id === najvec.value.id ? 3 : v >= 0.85 * maxPm.value ? 2 : v >= mediana ? 1 : 0
  emit('konec', {
    zvezdice,
    razlaga:
      `Najbolj umazan zrak je bil v kraju ${kraj(najvec.value.ime)}: ${Math.round(maxPm.value)} µg/m³. ` +
      `Najčistejši v kraju ${kraj(najmanj.value.ime)}: ${Math.round(najmanj.value.pm25)} µg/m³. ` +
      'Kraji v kotlinah in ozkih dolinah imajo pozimi pogosto več smoga, ker zrak tam obstane.',
  })
}
</script>

<template>
  <div class="naloga">
    <p class="vprasanje">Kje je bil včeraj zrak <strong>najbolj umazan</strong>? Tapni postajo na zemljevidu.</p>
    <svg class="map" :viewBox="`${view.x} ${view.y} ${view.w} ${view.h}`" role="img" aria-label="Zemljevid merilnih postaj">
      <path v-if="path" :d="path" class="land" />
      <g v-for="p in kraji" :key="p.id" class="pin" :class="{ on: izbran?.id === p.id, done: odgovorjeno }" @click="!odgovorjeno && (izbran = p)">
        <circle
          :cx="px(p.lon)"
          :cy="py(p.lat)"
          :r="odgovorjeno ? r * (0.6 + (p.pm25 / maxPm) * 0.9) : r"
          :fill="odgovorjeno ? levelFor(p.pm25).hex : izbran?.id === p.id ? '#ffc22e' : '#3fa9f5'"
        />
        <circle v-if="odgovorjeno && p.id === najvec.id" :cx="px(p.lon)" :cy="py(p.lat)" :r="r * 1.9" class="ring" />
        <text v-if="pokaziIme(p)" :x="px(p.lon)" :y="py(p.lat) - r * 1.6" :font-size="r * 1.4" text-anchor="middle">
          {{ kraj(p.ime) }}{{ odgovorjeno ? ` ${Math.round(p.pm25)}` : '' }}
        </text>
      </g>
    </svg>
    <p v-if="izbran && !odgovorjeno" class="izbira">Izbral si: <strong>{{ kraj(izbran.ime) }}</strong></p>
    <p v-else-if="!odgovorjeno" class="izbira">Vsaka pika je en kraj z merilno postajo.</p>
    <button v-if="!odgovorjeno" class="k-btn green" :disabled="!izbran" @click="potrdi">Potrdi</button>
  </div>
</template>

<style scoped>
.map {
  width: 100%;
  max-height: 52vh;
  background: #dff1ff;
  border-radius: 24px;
  touch-action: manipulation;
}
.land {
  fill: #b8e3a1;
  stroke: #6fb46a;
  stroke-width: 0.6;
  vector-effect: non-scaling-stroke;
}
.pin {
  cursor: pointer;
}
.pin.done {
  cursor: default;
}
.pin circle:first-child {
  stroke: #fff;
  stroke-width: 3;
  vector-effect: non-scaling-stroke;
  transition: r 0.6s cubic-bezier(0.2, 1.6, 0.4, 1), fill 0.3s;
}
.pin.on circle:first-child {
  stroke: #e08a00;
  stroke-width: 4;
}
.ring {
  fill: none;
  stroke: #e5484d;
  stroke-width: 3;
  vector-effect: non-scaling-stroke;
  animation: ping 1.2s ease-out infinite;
  transform-box: fill-box;
  transform-origin: center;
}
text {
  fill: #1d3557;
  font-family: var(--font-head);
  font-weight: 800;
  paint-order: stroke;
  stroke: #fff;
  stroke-width: 3px;
  vector-effect: non-scaling-stroke;
  pointer-events: none;
}
.izbira {
  margin: 8px 0 0;
}
@keyframes ping {
  from {
    transform: scale(0.8);
    opacity: 1;
  }
  to {
    transform: scale(1.3);
    opacity: 0;
  }
}
</style>
