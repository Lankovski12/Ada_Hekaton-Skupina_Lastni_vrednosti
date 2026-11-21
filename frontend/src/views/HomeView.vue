<script setup lang="ts">
// Domača stran = zgodba, ki naredi nevidno vidno (navdih: »Seeing the Invisible«, WHO + Google Arts & Culture).
// Tri poglavja v istem slogu: scena ostane pripeta, besedilo drsi čez njo; vsak korak sceni pove, kaj naj pokaže.
//   1. Oblak delcev (DataSculpture)   2. Kotlina z meglo   3. Napoved za 48 ur
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import DataSculpture from '@/scenes/DataSculpture.vue'
import ForecastStrip from '@/components/ForecastStrip.vue'
import AirBuddy from '@/components/AirBuddy.vue'
import ScrollStory from '@/components/ScrollStory.vue'
import Kotlina from '@/scenes/Kotlina.vue'
import { useAirData } from '@/composables/useAirData'
import { useProfile } from '@/composables/useProfile'
import { formatDayHour, levelFor } from '@/lib/airQuality'

const { currentPm25, forecast, scene, origin, now } = useAirData()
const { sensitivity } = useProfile()

const live = computed(() => currentPm25.value ?? 15)

/* ---------- 1. poglavje: oblak delcev ---------- */
const myPm = ref(30) // zadnji korak: »ustvari svoj zrak«

interface Step {
  kicker: string
  title: string
  text: string
  pm: () => number
  interactive?: boolean
}
const steps: Step[] = [
  {
    kicker: 'Nevidno postane vidno',
    title: 'Zrak, ki ga dihamo',
    text: 'Drobnih delcev PM2.5 z očmi ne vidiš. Tukaj jih lahko. Vsaka pika je delček zraka nad Ljubljano. Povleci, da ga zavrtiš.',
    pm: () => live.value,
  },
  {
    kicker: 'Ljubljana, ta trenutek',
    title: '',
    text: 'Toliko mikrogramov drobnih delcev je v vsakem kubičnem metru zraka. Bolj ko je oblak nemiren in bodičast, slabši je zrak.',
    pm: () => live.value,
  },
  {
    kicker: 'Kako majhno je to?',
    title: '~30× tanjše od lasu',
    text: 'Delec PM2.5 je velik največ 2,5 mikrometra. Tako je majhen, da ga vdihneš globoko v pljuča. Otroci dihajo hitreje kot odrasli, zato vdihnejo več.',
    pm: () => live.value,
  },
  {
    kicker: 'Smernica WHO',
    title: '15 µg/m³ na dan',
    text: 'Svetovna zdravstvena organizacija priporoča, naj dnevno povprečje ne preseže 15 µg/m³. Tako izgleda zrak tik pod to mejo.',
    pm: () => 15,
  },
  {
    kicker: 'Zimski večer z inverzijo',
    title: '65 µg/m³',
    text: 'Hladen zrak obleži na dnu kotline kot pod pokrovko. Dim iz dimnikov in izpuhov ne more ven – oblak postane nemiren in temen.',
    pm: () => 65,
  },
  {
    kicker: 'Poletno jutro po dežju',
    title: '4 µg/m³',
    text: 'Dež spere delce, veter jih odnese. Oblak se umiri in diha počasi.',
    pm: () => 4,
  },
  {
    kicker: 'Zdaj ti',
    title: 'Ustvari svoj zrak',
    text: 'Povleci drsnik in poglej, kako se oblak spreminja.',
    pm: () => myPm.value,
    interactive: true,
  },
]

const active = ref(0)
const pm = computed(() => steps[active.value]!.pm())
const level = computed(() => levelFor(pm.value, sensitivity.value))
const isMeasured = computed(() => origin.value === 'api' && now.value?.postaje.some((p) => p.vir === 'meritev'))
const stationTime = computed(() => {
  const t = now.value?.cas_utc
  return t ? new Date(t).toLocaleTimeString('sl-SI', { hour: '2-digit', minute: '2-digit' }) : ''
})

/* ---------- 2. poglavje: kotlina ---------- */
const kotActive = ref(0)
const kotHour = ref(0)
const kotPlaying = ref(false)
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
const kotSteps = computed(() => {
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
  [kotActive, kotSteps],
  () => {
    const h = kotSteps.value[kotActive.value]?.hour ?? -1
    if (h >= 0) {
      kotHour.value = h
      kotPlaying.value = false
    }
  },
  { immediate: true },
)
const kotLevel = computed(() => levelFor(ure.value[kotHour.value]?.pm25 ?? live.value, sensitivity.value))
const kotClock = computed(() => {
  const u = ure.value[kotHour.value]
  return u ? `${String(hourOf(u.cas_utc)).padStart(2, '0')}:00` : ''
})

let timer: number | undefined
watch(kotPlaying, (on) => {
  window.clearInterval(timer)
  if (on) timer = window.setInterval(() => (kotHour.value = (kotHour.value + 1) % ure.value.length), 700)
})
onBeforeUnmount(() => window.clearInterval(timer))

/* ---------- 3. poglavje: napoved ---------- */
const fcActive = ref(0)
const fcSelected = ref(0)
const fcUre = computed(() => forecast.value?.ure ?? [])
const fcBest = computed(() => Math.max(0, fcUre.value.findIndex((u) => u.cas_utc === forecast.value?.najboljsa_ura)))
const fcWorst = computed(() => fcUre.value.reduce((w, u, i, a) => (u.pm25 > a[w]!.pm25 ? i : w), 0))
const fcSteps = computed(() => {
  const best = fcUre.value[fcBest.value]
  const worst = fcUre.value[fcWorst.value]
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
      sel: fcWorst.value,
    },
    {
      kicker: 'Najboljša ura ⭐',
      title: best ? `${formatDayHour(best.cas_utc)}h` : '',
      text: 'Najčistejša ura podnevi. Takrat je pravi čas za igro zunaj, sprehod ali zračenje stanovanja.',
      sel: fcBest.value,
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
  [fcActive, fcSteps],
  () => {
    const s = fcSteps.value[fcActive.value]?.sel ?? -1
    if (s >= 0) fcSelected.value = s
  },
  { immediate: true },
)
const fcLevel = computed(() => levelFor(fcUre.value[fcSelected.value]?.pm25 ?? live.value, sensitivity.value))
</script>

<template>
  <!-- en korenski element, da animacija prehoda med stranmi (App.vue) deluje -->
  <div class="home">
  <div class="story">
    <!-- 1. POGLAVJE: oblak delcev -->
    <ScrollStory v-model:active="active" :count="steps.length" :color="level.color" plain-first>
      <template #stage>
        <DataSculpture :pm25="pm" :color="level.hex" />
        <div class="readout" aria-live="polite">
          <span class="num">{{ Math.round(pm) }}</span>
          <span class="unit">µg/m³ PM2.5</span>
          <span class="lvl">{{ level.label }}</span>
        </div>
      </template>
      <template #step="{ i }">
        <span class="kicker">{{ steps[i]!.kicker }}</span>
        <h1 v-if="i === 0">{{ steps[i]!.title }}</h1>
        <h2 v-else-if="i === 1" class="big">
          {{ live }} <small>µg/m³</small>
        </h2>
        <h2 v-else>{{ steps[i]!.title }}</h2>
        <p>{{ steps[i]!.text }}</p>
        <p v-if="i === 1" class="src">
          {{ isMeasured ? `Meritev ARSO ob ${stationTime}` : 'Demo vrednost – meritve ARSO še niso prispele' }}
        </p>
        <label v-if="steps[i]!.interactive" class="slider">
          <input v-model.number="myPm" type="range" min="0" max="100" aria-label="PM2.5" />
          <span>{{ myPm }} µg/m³ · {{ levelFor(myPm).kids }}</span>
        </label>
        <span v-if="i === 0" class="scroll-hint" aria-hidden="true">↓ drsi</span>
      </template>
    </ScrollStory>

    <!-- 2. POGLAVJE: kotlina z meglo -->
    <ScrollStory v-if="scene" v-model:active="kotActive" :count="kotSteps.length" :color="kotLevel.color">
      <template #stage>
        <div class="kot-stage">
          <Kotlina v-model:hour="kotHour" :scene="scene" bare :controls="false" />
        </div>
        <div class="readout" aria-live="polite">
          <span class="num">{{ ure[kotHour]?.pm25 }}</span>
          <span class="unit">µg/m³ PM2.5</span>
          <span class="lvl">{{ kotClock }} · {{ ure[kotHour]?.inverzija ? 'inverzija – zrak je ujet' : 'zrak se meša' }}</span>
        </div>
      </template>
      <template #step="{ i }">
        <span class="kicker">{{ kotSteps[i]!.kicker }}</span>
        <h2>{{ kotSteps[i]!.title }}</h2>
        <p>{{ kotSteps[i]!.text }}</p>
        <div v-if="kotSteps[i]!.hour < 0" class="slider">
          <button class="btn play" :aria-pressed="kotPlaying" @click="kotPlaying = !kotPlaying">
            {{ kotPlaying ? '⏸ Ustavi' : '▶ Predvajaj dan' }}
          </button>
          <input v-model.number="kotHour" type="range" min="0" :max="ure.length - 1" aria-label="Ura" />
          <span>{{ kotClock }} · {{ ure[kotHour]?.pm25 }} µg/m³ · {{ kotLevel.kids }}</span>
        </div>
      </template>
    </ScrollStory>

    <!-- 3. POGLAVJE: napoved za 48 ur -->
    <ScrollStory v-if="forecast" v-model:active="fcActive" :count="fcSteps.length" :color="fcLevel.color">
      <template #stage>
        <div class="fc-stage">
          <div class="fc-panel">
            <ForecastStrip v-model:selected="fcSelected" :forecast="forecast" :sensitivity="sensitivity" />
          </div>
        </div>
      </template>
      <template #step="{ i }">
        <span class="kicker">{{ fcSteps[i]!.kicker }}</span>
        <h2>{{ fcSteps[i]!.title }}</h2>
        <p>{{ fcSteps[i]!.text }}</p>
      </template>
    </ScrollStory>

    <div class="story-end" aria-hidden="true" />
  </div>

  <section class="container section doors">
    <RouterLink to="/otroci" class="door kids">
      <AirBuddy :mood="levelFor(live).mood" :color="levelFor(live).color" :size="140" />
      <h3>Poučne naloge</h3>
      <p>Igre na pravih podatkih: pomagaj zmajčku očistiti nebo in ugani jutrišnji zrak.</p>
      <span class="btn">Igraj →</span>
    </RouterLink>
    <RouterLink to="/starsi" class="door parents">
      <span class="emoji">👨‍👩‍👧</span>
      <h3>Blogi</h3>
      <p>Napoved, nasveti in opozorila – z upoštevanjem astme, ki ostane samo na tvojem telefonu.</p>
      <span class="btn">Poglej →</span>
    </RouterLink>
  </section>
  </div>
</template>

<style scoped>
/* --- zgodba: vedno temna, kot razstava --- */
.story {
  position: relative;
  background: #05080f;
  color: #eaf2fb;
  /* temne barve tudi za vgrajene komponente (Kotlina, ForecastStrip), ne glede na temo strani */
  --ink: #eaf2fb;
  --ink-soft: #9fb3c8;
  --line: rgba(255, 255, 255, 0.14);
  --card: #0b1422;
  --bg-soft: rgba(255, 255, 255, 0.08);
  --sky-top: #3a78ad;
  --sky-bottom: #8fbedf;
  --mountain-far: #2d4a60;
  --mountain-mid: #20364a;
  --mountain-near: #142433;
  --city: #0b1621;
}

/* 1. poglavje */
.readout {
  position: absolute;
  left: 24px;
  bottom: 24px;
  display: grid;
  grid-template-columns: auto auto;
  align-items: baseline;
  column-gap: 10px;
  pointer-events: none;
  z-index: 1;
}
.readout .num {
  font-family: var(--font-head);
  font-size: clamp(3rem, 9vw, 6rem);
  line-height: 1;
  color: var(--lvl);
  transition: color 0.6s;
}
.readout .unit {
  color: #9fb3c8;
  font-weight: 700;
}
.readout .lvl {
  grid-column: 1 / -1;
  text-transform: uppercase;
  letter-spacing: 0.2em;
  font-size: 0.8rem;
  font-weight: 800;
  color: var(--lvl);
}

/* 2. poglavje */
.kot-stage {
  position: absolute;
  inset: 0;
}
.kot-stage::after {
  /* mehak prehod v temno ozadje zgoraj in spodaj */
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: linear-gradient(#05080f 0, transparent 18%, transparent 85%, #05080f 100%);
}

/* 3. poglavje */
.fc-stage {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  padding: 0 calc(420px + max(56px, 6vw) + 40px) 0 max(24px, 5vw);
  background: radial-gradient(ellipse at 30% 60%, color-mix(in srgb, var(--lvl) 18%, transparent), transparent 60%);
  transition: background 0.6s;
}
.fc-panel {
  width: 100%;
  padding: 24px 26px;
  border-radius: var(--radius);
  background: rgba(10, 18, 30, 0.62);
  border: 1px solid rgba(255, 255, 255, 0.08);
  --bars-h: clamp(180px, 34vh, 320px);
}

/* besedilo na karticah – enako v vseh poglavjih */
.kicker {
  display: block;
  text-transform: uppercase;
  letter-spacing: 0.2em;
  font-size: 0.75rem;
  font-weight: 800;
  color: var(--lvl);
  margin-bottom: 8px;
  transition: color 0.6s;
}
h1 {
  font-size: clamp(2.6rem, 7vw, 4.6rem);
}
.story h2 {
  font-size: clamp(1.8rem, 5vw, 2.8rem);
  text-transform: none;
}
h2.big {
  font-size: clamp(3rem, 9vw, 5rem);
  color: var(--lvl);
}
h2.big small {
  font-size: 1.2rem;
  color: #9fb3c8;
}
.story p {
  color: #c4d3e2;
  font-size: 1.1rem;
  margin: 0;
}
.story .src {
  margin-top: 10px;
  font-size: 0.85rem;
  color: #8197ad;
}
.slider {
  display: grid;
  gap: 6px;
  margin-top: 14px;
  font-weight: 700;
}
.slider input {
  accent-color: var(--lvl);
}
.slider .play {
  justify-self: start;
  background: var(--lvl);
  color: #05080f;
}
.scroll-hint {
  display: inline-block;
  margin-top: 24px;
  color: #8197ad;
  font-weight: 700;
  animation: hint 1.6s ease-in-out infinite;
}
@keyframes hint {
  50% {
    transform: translateY(6px);
  }
}
.story-end {
  height: 120px;
  background: linear-gradient(#05080f, var(--bg));
}

/* --- vrata: otroci / starši --- */
.section {
  padding-top: 32px;
}
.doors {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}
.door {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  padding: 28px;
  border-radius: var(--radius);
  color: var(--ink);
  text-decoration: none;
  border: 1px solid var(--line);
  box-shadow: var(--shadow);
  transition: transform 0.2s ease;
}
.door:hover {
  transform: translateY(-4px) rotate(-0.5deg);
}
.door p {
  color: var(--ink-soft);
  flex: 1;
}
.door.kids {
  background: linear-gradient(135deg, color-mix(in srgb, var(--accent) 35%, var(--card)), var(--card));
}
.door.parents {
  background: linear-gradient(135deg, color-mix(in srgb, var(--brand) 25%, var(--card)), var(--card));
}
.emoji {
  font-size: 3rem;
}

@media (max-width: 1000px) {
  .fc-stage {
    align-items: flex-start;
    padding: 24px 40px 0 16px;
  }
}
@media (max-width: 720px) {
  .readout {
    left: 16px;
    top: 14px;
    bottom: auto;
  }
  .readout .num {
    font-size: 2.6rem;
  }
  .kot-stage {
    bottom: 48%;
  }
  .fc-panel {
    padding: 16px;
    --bars-h: 160px;
  }
  .doors {
    grid-template-columns: 1fr;
  }
}
</style>
