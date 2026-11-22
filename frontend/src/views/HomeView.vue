<script setup lang="ts">
// Domača stran = zgodba za starše in otroke, ki naredi nevidno vidno (navdih: »Seeing the Invisible«, WHO + Google Arts & Culture).
// Skulptura ostane pripeta, besedilo drsi čez njo; vsak korak skulpturi pove, kakšen zrak naj pokaže.
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import DataSculpture from '@/scenes/DataSculpture.vue'
import ForecastStrip from '@/components/ForecastStrip.vue'
import AirBuddy from '@/components/AirBuddy.vue'
import Kotlina from '@/scenes/Kotlina.vue'
import { useAirData } from '@/composables/useAirData'
import { useProfile } from '@/composables/useProfile'
import { levelFor } from '@/lib/airQuality'

const { currentPm25, forecast, scene, origin, now } = useAirData()
const { sensitivity } = useProfile()

const live = computed(() => currentPm25.value ?? 15)
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
    kicker: 'Za otroke in starše',
    title: 'Zrak, ki ga dihajo naši otroci',
    text: 'Drobnih delcev PM2.5 z očmi ne vidimo, otroška pljuča pa jih čutijo. Tukaj jih lahko vidite skupaj. Vsaka pika je delček zraka nad Ljubljano. Povleci, da ga zavrtiš.',
    pm: () => live.value,
  },
  {
    kicker: 'Ljubljana, ta trenutek',
    title: '',
    text: 'Toliko mikrogramov drobnih delcev je zdaj v vsakem kubičnem metru zraka, ki ga dihajo otroci na igrišču. Bolj ko je oblak nemiren in bodičast, slabši je zrak.',
    pm: () => live.value,
  },
  {
    kicker: 'Zakaj so otroci bolj občutljivi?',
    title: 'Mala pljuča, hiter dih',
    text: 'Otrok vdihne pogosteje kot odrasel in glede na svojo težo vdihne več zraka. Pljuča mu rastejo do najstniških let, zato jih delci prizadenejo bolj. Pa še bližje tlom so, kjer so izpuhi.',
    pm: () => live.value,
  },
  {
    kicker: 'Kako majhno je to?',
    title: '~30× tanjše od lasu',
    text: 'Delec PM2.5 je velik največ 2,5 mikrometra. Tako je majhen, da ga vdihnemo globoko v pljuča – pri otrocih z astmo lahko sproži kašelj ali napad.',
    pm: () => live.value,
  },
  {
    kicker: 'Smernica WHO',
    title: '15 µg/m³ na dan',
    text: 'Svetovna zdravstvena organizacija priporoča, naj dnevno povprečje ne preseže 15 µg/m³. Tak zrak je primeren za igro zunaj.',
    pm: () => 15,
  },
  {
    kicker: 'Zimski večer z inverzijo',
    title: '65 µg/m³',
    text: 'Hladen zrak obleži na dnu kotline kot pod pokrovko, dim iz dimnikov ne more ven. Takrat naj se otroci igrajo v hiši, okna pa ostanejo zaprta.',
    pm: () => 65,
  },
  {
    kicker: 'Poletno jutro po dežju',
    title: '4 µg/m³',
    text: 'Dež spere delce, veter jih odnese. Pravi čas za igrišče, kolo in odprto okno v otroški sobi.',
    pm: () => 4,
  },
  {
    kicker: 'Zdaj vi – skupaj z otrokom',
    title: 'Ustvari svoj zrak',
    text: 'Povleci drsnik in poglejta, kako se oblak spreminja in kaj to pomeni za igro zunaj.',
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

const stepEls = ref<HTMLElement[]>([])
let io: IntersectionObserver | undefined
onMounted(() => {
  io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) if (e.isIntersecting) active.value = Number((e.target as HTMLElement).dataset.i)
    },
    { rootMargin: '-45% 0px -45% 0px' },
  )
  stepEls.value.forEach((el) => io!.observe(el))
})
onBeforeUnmount(() => io?.disconnect())
</script>

<template>
  <!-- ZGODBA: pripeta skulptura + besedilo, ki drsi čez -->
  <section class="story" :style="{ '--lvl': level.color }">
    <div class="stage">
      <DataSculpture :pm25="pm" :color="level.hex" />
      <div class="readout" aria-live="polite">
        <span class="num">{{ Math.round(pm) }}</span>
        <span class="unit">µg/m³ PM2.5</span>
        <span class="lvl">{{ level.label }}</span>
      </div>
      <ol class="dots" aria-hidden="true">
        <li v-for="(s, i) in steps" :key="i" :class="{ on: i === active }" />
      </ol>
    </div>

    <div class="steps">
      <article v-for="(s, i) in steps" :key="i" ref="stepEls" :data-i="i" class="step">
        <div class="step-card" :class="{ first: i === 0 }">
          <span class="kicker">{{ s.kicker }}</span>
          <h1 v-if="i === 0">{{ s.title }}</h1>
          <h2 v-else-if="i === 1" class="big">
            {{ live }} <small>µg/m³</small>
          </h2>
          <h2 v-else>{{ s.title }}</h2>
          <p>{{ s.text }}</p>
          <p v-if="i === 1" class="src">
            {{ isMeasured ? `Meritev ARSO ob ${stationTime}` : 'Demo vrednost – meritve ARSO še niso prispele' }}
          </p>
          <label v-if="s.interactive" class="slider">
            <input v-model.number="myPm" type="range" min="0" max="100" aria-label="PM2.5" />
            <span>{{ myPm }} µg/m³ · {{ levelFor(myPm).kids }}</span>
          </label>
          <span v-if="i === 0" class="scroll-hint" aria-hidden="true">↓ drsi</span>
        </div>
      </article>
    </div>
  </section>

  <section class="container section">
    <div class="section-head">
      <h2>Zakaj je pozimi v kotlini megla?</h2>
      <p>Ponoči se hladen zrak ujame na dnu kotline – kot pod pokrovko, dim iz dimnikov ne more ven. Predvajajte dan skupaj z otrokom in opazujte, kdaj se megla dvigne.</p>
    </div>
    <Kotlina v-if="scene" :scene="scene" />
  </section>

  <section class="container section">
    <div class="section-head">
      <h2>Kdaj gremo lahko ven?</h2>
      <p>Napoved za naslednjih 48 ur. Zvezdica ⭐ pokaže najčistejšo uro podnevi – takrat je najboljši čas za igrišče, sprehod ali zračenje otroške sobe.</p>
    </div>
    <div class="card">
      <ForecastStrip v-if="forecast" :forecast="forecast" :sensitivity="sensitivity" />
    </div>
  </section>

  <section class="container section doors">
    <RouterLink to="/otroci" class="door kids">
      <AirBuddy :mood="levelFor(live).mood" :color="levelFor(live).color" :size="140" />
      <h3>Za otroke</h3>
      <p>Oblaček pove, kakšen je zrak danes. Igraj igre na pravih podatkih: pomagaj zmajčku očistiti nebo in ugani jutrišnji zrak.</p>
      <span class="btn">Igraj →</span>
    </RouterLink>
    <RouterLink to="/starsi" class="door parents">
      <span class="emoji">👨‍👩‍👧</span>
      <h3>Za starše</h3>
      <p>Kdaj na igrišče, kdaj zračiti in kdaj ostati doma. Napoved in nasveti, prilagojeni vašemu otroku – podatek o astmi ostane samo na vašem telefonu.</p>
      <span class="btn">Poglej →</span>
    </RouterLink>
  </section>
</template>

<style scoped>
/* --- zgodba: vedno temna, kot razstava --- */
.story {
  position: relative;
  background: #05080f;
  color: #eaf2fb;
}
.stage {
  position: sticky;
  top: 64px;
  height: calc(100svh - 64px);
  overflow: hidden;
}
.readout {
  position: absolute;
  left: 24px;
  bottom: 24px;
  display: grid;
  grid-template-columns: auto auto;
  align-items: baseline;
  column-gap: 10px;
  pointer-events: none;
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
.dots {
  position: absolute;
  right: 18px;
  top: 50%;
  transform: translateY(-50%);
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 10px;
}
.dots li {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.25);
  transition: transform 0.3s, background 0.3s;
}
.dots li.on {
  background: var(--lvl);
  transform: scale(1.6);
}
.steps {
  position: relative;
  margin-top: calc(-100svh + 64px);
  pointer-events: none; /* da lahko skulpturo vrtiš skozi besedilo */
}
.step {
  min-height: 100svh;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: 0 max(56px, 6vw) 0 24px;
}
.step-card {
  pointer-events: auto;
  max-width: 420px;
  padding: 24px 26px;
  border-radius: var(--radius);
  background: rgba(10, 18, 30, 0.62);
  border: 1px solid rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(10px);
}
.step-card.first {
  background: transparent;
  border: 0;
  backdrop-filter: none;
  max-width: 520px;
}
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
.step-card h1 {
  font-size: clamp(2.6rem, 7vw, 4.6rem);
}
.step-card h2 {
  font-size: clamp(1.8rem, 5vw, 2.8rem);
}
.step-card h2.big {
  font-size: clamp(3rem, 9vw, 5rem);
  color: var(--lvl);
}
.step-card h2.big small {
  font-size: 1.2rem;
  color: #9fb3c8;
}
.step-card p {
  color: #c4d3e2;
  font-size: 1.1rem;
  margin: 0;
}
.step-card .src {
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

/* --- ostale sekcije --- */
.section {
  padding-top: 56px;
}
.section-head {
  max-width: 680px;
  margin-bottom: 18px;
}
.section-head p {
  color: var(--ink-soft);
  margin: 0;
}
h2 {
  font-size: clamp(1.6rem, 4vw, 2.3rem);
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

@media (max-width: 720px) {
  .step {
    justify-content: center;
    align-items: flex-end;
    padding: 0 16px 140px;
  }
  .step-card.first {
    background: rgba(10, 18, 30, 0.5);
  }
  .readout {
    left: 16px;
    top: 14px;
    bottom: auto;
  }
  .readout .num {
    font-size: 2.6rem;
  }
  .dots {
    right: 10px;
  }
  .doors {
    grid-template-columns: 1fr;
  }
}
</style>
