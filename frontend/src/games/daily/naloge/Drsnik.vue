<script setup lang="ts">
// Naloga 2: z drsnikom uganeš, koliko drobnih delcev je bilo včeraj v Ljubljani (povprečje dneva).
import { computed, ref } from 'vue'
import { levelFor } from '@/lib/airQuality'
import type { Dan } from '../dan'
import { bezigrad, type Rezultat } from '../vrste'

const props = defineProps<{ dan: Dan }>()
const emit = defineEmits<{ konec: [Rezultat] }>()

const prav = computed(() => Math.round(bezigrad(props.dan) ?? 0))
const max = computed(() => Math.max(80, Math.ceil((prav.value * 1.6) / 10) * 10))
const ugib = ref(20)
const odgovorjeno = ref(false)
const lvl = computed(() => levelFor(ugib.value))

function potrdi() {
  odgovorjeno.value = true
  const diff = Math.abs(ugib.value - prav.value)
  const t = (pct: number, min: number) => Math.max(min, prav.value * pct)
  const zvezdice = diff <= t(0.1, 3) ? 3 : diff <= t(0.25, 7) ? 2 : diff <= t(0.45, 12) ? 1 : 0
  const krat = prav.value / 15
  emit('konec', {
    zvezdice,
    razlaga:
      `Včeraj je bilo v Ljubljani povprečno ${prav.value} µg/m³ drobnih delcev, ti si rekel ${ugib.value}. ` +
      (krat > 1.1
        ? `To je ${krat.toFixed(1).replace('.', ',')}-krat več, kot priporoča Svetovna zdravstvena organizacija (15).`
        : 'To je pod priporočilom Svetovne zdravstvene organizacije (15), zrak je bil čist.'),
  })
}
</script>

<template>
  <div class="naloga">
    <p class="vprasanje">Koliko drobnih delcev (PM2.5) je bilo včeraj v zraku v <strong>Ljubljani</strong>? Povleci drsnik.</p>
    <div class="big" :style="{ color: lvl.hex }">
      {{ ugib }} <small>µg/m³</small>
      <span class="lbl" :style="{ background: lvl.hex }">{{ lvl.label }}</span>
    </div>
    <div class="track-wrap">
      <input v-model.number="ugib" type="range" min="0" :max="max" step="1" :disabled="odgovorjeno" aria-label="Tvoj ugib" />
      <div class="who" :style="{ left: `${(15 / max) * 100}%` }"><span>WHO 15</span></div>
      <div v-if="odgovorjeno" class="truth" :style="{ left: `${(prav / max) * 100}%` }">
        <span>{{ prav }}</span>
      </div>
    </div>
    <div class="scale"><span>0</span><span>{{ max / 2 }}</span><span>{{ max }}</span></div>
    <button v-if="!odgovorjeno" class="k-btn green" @click="potrdi">Potrdi</button>
  </div>
</template>

<style scoped>
.big {
  font-family: var(--font-head);
  font-size: 4rem;
  font-weight: 800;
  line-height: 1;
  transition: color 0.2s;
}
.big small {
  font-size: 1.2rem;
  color: #5b6b7b;
}
.lbl {
  display: inline-block;
  vertical-align: middle;
  margin-left: 8px;
  padding: 4px 12px;
  border-radius: 999px;
  color: #fff;
  font-size: 1rem;
}
.track-wrap {
  position: relative;
  margin: 26px 4px 4px;
}
input[type='range'] {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 26px;
  border-radius: 999px;
  background: linear-gradient(90deg, #2bb673 0%, #8ccf3f 15%, #f2c335 30%, #f28c28 50%, #e5484d 75%, #8e4ec6 100%);
  outline: none;
}
input[type='range']::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: #fff;
  border: 6px solid #1d3557;
  cursor: grab;
}
input[type='range']::-moz-range-thumb {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: #fff;
  border: 6px solid #1d3557;
  cursor: grab;
}
.who,
.truth {
  position: absolute;
  top: -22px;
  transform: translateX(-50%);
  pointer-events: none;
}
.who span {
  font-size: 0.75rem;
  font-weight: 800;
  color: #5b6b7b;
}
.who::after {
  content: '';
  display: block;
  width: 2px;
  height: 34px;
  margin: 0 auto;
  background: #5b6b7b;
}
.truth {
  top: 30px;
  animation: drop 0.6s cubic-bezier(0.2, 1.6, 0.4, 1);
}
.truth span {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 12px;
  background: #1d3557;
  color: #fff;
  font-family: var(--font-head);
  font-weight: 800;
  font-size: 1.3rem;
}
.truth::before {
  content: '';
  display: block;
  margin: 0 auto;
  border: 9px solid transparent;
  border-bottom-color: #1d3557;
  width: 0;
}
.scale {
  display: flex;
  justify-content: space-between;
  margin: 4px 4px 0;
  color: #5b6b7b;
  font-weight: 700;
  font-size: 0.85rem;
}
button {
  margin-top: 40px;
}
@keyframes drop {
  from {
    transform: translate(-50%, -30px);
    opacity: 0;
  }
}
</style>
