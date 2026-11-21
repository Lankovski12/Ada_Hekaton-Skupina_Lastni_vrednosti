<script setup lang="ts">
// Poglavje »Kdaj je najboljši čas za ven?«: 48-urna napoved, koraki izberejo najslabšo in najboljšo uro.
import { computed, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import ScrollStory from '@/components/ScrollStory.vue'
import ForecastStrip from '@/components/ForecastStrip.vue'
import { useAirData } from '@/composables/useAirData'
import { useProfile } from '@/composables/useProfile'
import { formatDayHour, levelFor } from '@/lib/airQuality'
import { klimaLabel, typicalPm25 } from '@/lib/klima'

const { forecast, origin, currentPm25 } = useAirData()
const { profile, sensitivity } = useProfile()

const active = ref(0)
const selected = ref(0)
const ure = computed(() => forecast.value?.ure ?? [])
const bestIdx = computed(() => Math.max(0, ure.value.findIndex((u) => u.cas_utc === forecast.value?.najboljsa_ura)))
const worstIdx = computed(() => ure.value.reduce((w, u, i, a) => (u.pm25 > a[w]!.pm25 ? i : w), 0))
const steps = computed(() => {
  const best = ure.value[bestIdx.value]
  const worst = ure.value[worstIdx.value]
  return [
    {
      kicker: 'Kdaj je najboljši čas za ven?',
      title: 'Naslednjih 48 ur',
      text: 'Vsak stolpec je ena ura. Višji in bolj rdeč kot je, več delcev bo v zraku.',
      sel: 0,
    },
    {
      kicker: 'Najslabša ura',
      title: worst ? `${formatDayHour(worst.cas_utc)}h` : '',
      text: `Takrat bo v zraku največ delcev${worst ? ` (${worst.pm25} µg/m³)` : ''}. Pozimi je to najpogosteje zvečer, ko ljudje kurijo, zrak pa se umiri.`,
      sel: worstIdx.value,
    },
    {
      kicker: 'Najboljša ura ⭐',
      title: best ? `${formatDayHour(best.cas_utc)}h` : '',
      text: 'Najčistejša ura podnevi. Takrat je pravi čas za igro zunaj, sprehod ali zračenje stanovanja.',
      sel: bestIdx.value,
    },
    {
      kicker: 'Zdaj ti',
      title: 'Poišči svojo uro',
      text: 'Povleci s prstom ali miško čez stolpce in poglej, kakšen bo zrak ob uri, ki jo izbereš.',
      sel: -1,
    },
  ]
})
watch(
  [active, steps],
  () => {
    const s = steps.value[active.value]?.sel ?? -1
    if (s >= 0) selected.value = s
  },
  { immediate: true },
)
const level = computed(() => levelFor(ure.value[selected.value]?.pm25 ?? currentPm25.value ?? typicalPm25(), sensitivity.value))
</script>

<template>
  <ScrollStory v-if="forecast" v-model:active="active" :count="steps.length" :color="level.color">
    <template #stage>
      <div class="panel-stage">
        <div class="panel fc-panel">
          <ForecastStrip v-model:selected="selected" :forecast="forecast" :sensitivity="sensitivity" />
        </div>
      </div>
    </template>
    <template #naslov="{ i }">{{ steps[i]!.kicker }}</template>
    <template #step="{ i }">
      <h2>{{ steps[i]!.title }}</h2>
      <p>{{ steps[i]!.text }}</p>
      <p v-if="i === 0" class="src">
        Vir:
        {{
          forecast.model === 'klima'
            ? `napoved ni na voljo – običajne vrednosti (${klimaLabel})`
            : `napoved CAMS (Open-Meteo)${origin === 'predpomnilnik' ? ', shranjena' : ''}`
        }}
        ·
        <template v-if="profile.astma">upoštevam strožje meje za astmo</template>
        <RouterLink v-else to="/nastavitve">Ima vaš otrok astmo? Nastavite profil.</RouterLink>
      </p>
    </template>
  </ScrollStory>
</template>

<style scoped>
.fc-panel {
  --bars-h: clamp(180px, 34vh, 320px);
}
.src a {
  color: inherit;
}
@media (max-width: 720px) {
  .fc-panel {
    --bars-h: 160px;
  }
}
</style>
