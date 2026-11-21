<script setup lang="ts">
// Poglavje »Zakaj je pozimi v kotlini megla?«: Kotlina čez cel zaslon, koraki ji nastavljajo uro.
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import ScrollStory from '@/components/ScrollStory.vue'
import Kotlina from '@/scenes/Kotlina.vue'
import { useAirData } from '@/composables/useAirData'
import { useProfile } from '@/composables/useProfile'
import { levelFor } from '@/lib/airQuality'
import { klimaLabel, typicalPm25 } from '@/lib/klima'

const { scene, currentPm25 } = useAirData()
const { sensitivity } = useProfile()

const active = ref(0)
const hour = ref(0)
const playing = ref(false)
const ure = computed(() => scene.value?.ure ?? [])
const hourOf = (iso: string) => new Date(iso).getHours()

// poiščemo ure v podatkih, ki najbolje pokažejo vsak korak
function pick(filter: (i: number) => boolean, score: (i: number) => number, fallback = 0) {
  let best = -1
  ure.value.forEach((_, i) => {
    if (filter(i) && (best < 0 || score(i) > score(best))) best = i
  })
  return best < 0 ? fallback : best
}
const isNight = (i: number) => {
  const h = hourOf(ure.value[i]!.cas_utc)
  return h >= 21 || h <= 5
}
const steps = computed(() => {
  const night = pick((i) => isNight(i) && ure.value[i]!.inverzija, (i) => -i)
  const worst = pick((i) => ure.value[i]!.inverzija, (i) => ure.value[i]!.pm25, night)
  const clear = pick((i) => !ure.value[i]!.inverzija, (i) => -ure.value[i]!.pm25, worst)
  return [
    {
      kicker: 'Zakaj je pozimi v kotlini megla?',
      title: 'Ljubljana leži v skledi',
      text: 'Okoli mesta so hribi. Ponoči se zrak ob tleh ohladi. Hladen zrak je težji, zato zdrsne na dno kotline in tam obleži.',
      hour: night,
    },
    {
      kicker: 'Temperaturna inverzija',
      title: 'Kot pod pokrovko',
      text: 'Nad hladnim zrakom leži plast toplejšega. Dim iz dimnikov in izpuhov ne more navzgor, zato se megla zgosti in zrak je slabši.',
      hour: worst,
    },
    {
      kicker: 'Sredi dneva',
      title: 'Sonce dvigne pokrovko',
      text: 'Sonce ogreje tla, zrak se začne mešati in delci se razredčijo v višino. Megla se dvigne in zrak je bolj čist.',
      hour: clear,
    },
    {
      kicker: 'Zdaj ti',
      title: 'Predvajaj dan',
      text: 'Pritisni gumb ali povleci drsnik in opazuj, kako se megla čez dan spušča in dviga.',
      hour: -1, // uro izbiraš sam
    },
  ]
})
watch(
  [active, steps],
  () => {
    const h = steps.value[active.value]?.hour ?? -1
    if (h >= 0) {
      hour.value = h
      playing.value = false
    }
  },
  { immediate: true },
)
const level = computed(() => levelFor(ure.value[hour.value]?.pm25 ?? currentPm25.value ?? typicalPm25(), sensitivity.value))
const clock = computed(() => {
  const u = ure.value[hour.value]
  return u ? `${String(hourOf(u.cas_utc)).padStart(2, '0')}:00` : ''
})

let timer: number | undefined
watch(playing, (on) => {
  window.clearInterval(timer)
  if (on) timer = window.setInterval(() => (hour.value = (hour.value + 1) % ure.value.length), 700)
})
onBeforeUnmount(() => window.clearInterval(timer))
</script>

<template>
  <ScrollStory v-if="scene" v-model:active="active" :count="steps.length" :color="level.color">
    <template #stage>
      <div class="kot-stage">
        <Kotlina v-model:hour="hour" :scene="scene" bare :controls="false" />
      </div>
      <div class="readout" aria-live="polite">
        <span class="num">{{ ure[hour] ? Math.round(ure[hour]!.pm25) : '–' }}</span>
        <span class="unit">µg/m³ PM2.5</span>
        <span class="lvl">{{ clock }} · {{ ure[hour]?.inverzija ? 'inverzija – zrak je ujet' : 'zrak se meša' }}</span>
        <span class="lvl src">{{
          scene.vir === 'klima'
            ? `običajne razmere (${klimaLabel})`
            : 'vreme: Open-Meteo (Bežigrad in Pasja ravan)'
        }}</span>
      </div>
    </template>
    <template #step="{ i }">
      <span class="kicker">{{ steps[i]!.kicker }}</span>
      <h2>{{ steps[i]!.title }}</h2>
      <p>{{ steps[i]!.text }}</p>
      <div v-if="steps[i]!.hour < 0" class="slider">
        <button class="btn play" :aria-pressed="playing" @click="playing = !playing">
          {{ playing ? '⏸ Ustavi' : '▶ Predvajaj dan' }}
        </button>
        <input v-model.number="hour" type="range" min="0" :max="ure.length - 1" aria-label="Ura" />
        <span>{{ clock }} · {{ ure[hour] ? Math.round(ure[hour]!.pm25) : '–' }} µg/m³ · {{ level.kids }}</span>
      </div>
    </template>
  </ScrollStory>
</template>

<style scoped>
.kot-stage {
  position: absolute;
  inset: 0;
}
.kot-stage::after {
  /* mehak prehod v ozadje strani zgoraj (spodaj ne, da so napisi na temnem mestu čitljivi) */
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: linear-gradient(var(--scene-bg) 0, transparent 18%);
}
@media (max-width: 720px) {
  .kot-stage {
    bottom: 48%;
  }
  .kot-stage::after {
    display: none; /* na telefonu je številka zgoraj – brez prehoda, da se bere */
  }
}
</style>
