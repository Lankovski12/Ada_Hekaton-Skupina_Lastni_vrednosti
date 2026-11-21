<script setup lang="ts">
// Naloga 7: iz vremenskih namigov sklepaj, ali je bil zrak včeraj boljši ali slabši kot predvčerajšnjim.
import { computed, ref } from 'vue'
import { levelFor } from '@/lib/airQuality'
import type { Dan, Vreme } from '../dan'
import { bezigrad, type Rezultat } from '../vrste'

const props = defineProps<{ dan: Dan }>()
const emit = defineEmits<{ konec: [Rezultat] }>()

type Izbira = 'boljsi' | 'podoben' | 'slabsi'
const MOZNOSTI: { id: Izbira; ime: string; barva: string }[] = [
  { id: 'boljsi', ime: 'Boljši', barva: 'green' },
  { id: 'podoben', ime: 'Podoben', barva: 'yellow' },
  { id: 'slabsi', ime: 'Slabši', barva: 'pink' },
]

const danes = computed(() => bezigrad(props.dan) ?? 0)
const prej = computed(() => props.dan.prejsnji?.pm25 ?? 0)
const v = computed(() => props.dan.vreme!)
const vp = computed(() => props.dan.prejsnji!.vreme!)
const resnica = computed<Izbira>(() => {
  const d = danes.value - prej.value
  return d <= -3 ? 'boljsi' : d >= 3 ? 'slabsi' : 'podoben'
})
const izbira = ref<Izbira | null>(null)

const fmt = (x: number | null, enota: string) => (x == null ? '–' : `${Math.round(x * 10) / 10} ${enota}`)
const namigi = (w: Vreme) => [
  { ime: 'Dež', val: fmt(w.padavine_mm, 'mm') },
  { ime: 'Veter', val: fmt(w.veter_kmh, 'km/h') },
  { ime: 'Temperatura', val: fmt(w.temp_c, '°C') },
  { ime: 'Pokrovka zjutraj', val: fmt(w.mejna_plast_m, 'm') },
]

/** Kaj pravijo namigi (dež in veter pomagata, nizka pokrovka in mraz ne). */
function razlogi(): string[] {
  const r: string[] = []
  const a = v.value
  const b = vp.value
  if ((a.padavine_mm ?? 0) >= 2 && (a.padavine_mm ?? 0) > (b.padavine_mm ?? 0) + 1) r.push('včeraj je deževalo, dež spere delce')
  if ((a.veter_kmh ?? 0) > (b.veter_kmh ?? 0) + 3) r.push('včeraj je bilo več vetra, ki premeša zrak')
  if ((a.veter_kmh ?? 0) < (b.veter_kmh ?? 0) - 3) r.push('včeraj je bilo manj vetra, zrak je obstal')
  if ((a.mejna_plast_m ?? 0) < (b.mejna_plast_m ?? 0) * 0.6) r.push('pokrovka je bila nižja, smog je bil bolj stisnjen')
  if ((a.mejna_plast_m ?? 0) > (b.mejna_plast_m ?? 0) * 1.6) r.push('pokrovka je bila višja, zrak se je bolj premešal')
  if ((a.temp_c ?? 0) < (b.temp_c ?? 0) - 3) r.push('bilo je hladneje, zato se je več kurilo')
  return r
}

function izberi(i: Izbira) {
  if (izbira.value) return
  izbira.value = i
  const order: Izbira[] = ['boljsi', 'podoben', 'slabsi']
  const d = Math.abs(order.indexOf(i) - order.indexOf(resnica.value))
  const r = razlogi()
  emit('konec', {
    zvezdice: d === 0 ? 3 : d === 1 ? 1 : 0,
    razlaga:
      `Predvčerajšnjim je bilo ${Math.round(prej.value)} µg/m³, včeraj ${Math.round(danes.value)} µg/m³ – zrak je bil ${{ boljsi: 'boljši', podoben: 'podoben kot dan prej', slabsi: 'slabši' }[resnica.value]}. ` +
      (r.length ? `Namigi: ${r.join(', ')}.` : 'Tokrat vreme ni povedalo vsega – pomembni so tudi kurjenje in promet.'),
  })
}
</script>

<template>
  <div class="naloga">
    <p class="vprasanje">Detektivska naloga! Je bil zrak včeraj <strong>boljši ali slabši</strong> kot predvčerajšnjim? Poglej namige.</p>
    <div class="days">
      <div class="day">
        <h4>Predvčerajšnjim</h4>
        <ul>
          <li v-for="n in namigi(vp)" :key="n.ime"><span>{{ n.ime }}</span><strong>{{ n.val }}</strong></li>
        </ul>
        <div class="pm" :style="{ background: levelFor(prej).hex }">{{ Math.round(prej) }} µg/m³</div>
      </div>
      <div class="day">
        <h4>Včeraj</h4>
        <ul>
          <li v-for="n in namigi(v)" :key="n.ime"><span>{{ n.ime }}</span><strong>{{ n.val }}</strong></li>
        </ul>
        <div class="pm" :class="{ hidden: !izbira }" :style="{ background: izbira ? levelFor(danes).hex : '#c9d3dd' }">
          {{ izbira ? `${Math.round(danes)} µg/m³` : '? µg/m³' }}
        </div>
      </div>
    </div>
    <div class="choices">
      <button
        v-for="m in MOZNOSTI"
        :key="m.id"
        class="k-btn"
        :class="[m.barva, { dim: izbira && izbira !== m.id && resnica !== m.id, right: izbira && resnica === m.id }]"
        :disabled="!!izbira"
        @click="izberi(m.id)"
      >
        {{ m.ime }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.days {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.day {
  padding: 12px;
  border-radius: 22px;
  background: #f1f8ff;
  border: 3px solid #bfe3ff;
}
.day h4 {
  margin: 0 0 8px;
  font-family: var(--font-head);
  font-size: 1.2rem;
  color: #3fa9f5;
}
.day ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 4px;
  text-align: left;
}
.day li {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  padding: 4px 8px;
  border-radius: 10px;
  background: #fff;
  font-size: 0.95rem;
}
.pm {
  margin-top: 10px;
  padding: 8px;
  border-radius: 14px;
  color: #fff;
  font-family: var(--font-head);
  font-size: 1.4rem;
  font-weight: 800;
  transition: background 0.4s;
}
.pm.hidden {
  color: #5b6b7b;
}
.choices {
  display: flex;
  gap: 10px;
  justify-content: center;
  flex-wrap: wrap;
  margin-top: 14px;
}
.k-btn.dim {
  opacity: 0.4;
}
.k-btn.right {
  outline: 4px solid #1d3557;
  outline-offset: 3px;
}
</style>
