<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import AirBuddy from '@/components/AirBuddy.vue'
import ParticleField from '@/components/ParticleField.vue'
import ForecastStrip from '@/components/ForecastStrip.vue'
import Kotlina from '@/scenes/Kotlina.vue'
import { useAirData } from '@/composables/useAirData'
import { useProfile } from '@/composables/useProfile'
import { levelFor } from '@/lib/airQuality'

const { currentPm25, forecast, scene, origin } = useAirData()
const { sensitivity } = useProfile()

// Drsnik »Kaj če?« – začne na trenutni vrednosti, otrok pa se lahko igra.
const pm = ref(15)
const touched = ref(false)
watch(currentPm25, (v) => {
  if (v != null && !touched.value) pm.value = v
}, { immediate: true })

const level = computed(() => levelFor(pm.value, sensitivity.value))
const isLive = computed(() => !touched.value)
</script>

<template>
  <section class="hero" :style="{ '--lvl': level.color }">
    <ParticleField :pm25="pm" />
    <div class="container hero-inner">
      <div class="copy">
        <span class="pill">{{ isLive ? (origin === 'api' ? '● v živo' : '● demo podatki') : '🧪 Kaj če …?' }} · Ljubljana</span>
        <h1>
          Danes je zrak
          <span class="lvl">{{ level.label.toLowerCase() }}</span>
        </h1>
        <p class="lead">{{ level.kids }}</p>
        <div class="big">
          <strong>{{ pm }}</strong>
          <span>µg/m³ drobnih delcev PM2.5</span>
        </div>
        <label class="slider">
          <span>Povleci in poglej, kako se spremeni zrak 👇</span>
          <input v-model.number="pm" type="range" min="0" max="100" @input="touched = true" />
        </label>
        <button v-if="touched" class="btn ghost" @click="touched = false; pm = currentPm25 ?? 15">↺ Nazaj na pravo vrednost</button>
        <p class="hint">Namig: s prstom ali miško odpihni delce!</p>
      </div>
      <div class="buddy-wrap">
        <AirBuddy :mood="level.mood" :color="level.color" :size="280" />
      </div>
    </div>
  </section>

  <section class="container section">
    <div class="section-head">
      <h2>Zakaj je pozimi v kotlini megla?</h2>
      <p>Ponoči se hladen zrak ujame na dnu kotline – kot pod pokrovko. Dim iz dimnikov ne more ven. Predvajaj dan in opazuj meglo.</p>
    </div>
    <Kotlina v-if="scene" :scene="scene" />
  </section>

  <section class="container section">
    <div class="section-head">
      <h2>Kdaj je najboljši čas za ven?</h2>
      <p>Napoved za naslednjih 48 ur. Zvezdica ⭐ pokaže najčistejšo uro podnevi.</p>
    </div>
    <div class="card">
      <ForecastStrip v-if="forecast" :forecast="forecast" :sensitivity="sensitivity" />
    </div>
  </section>

  <section class="container section doors">
    <RouterLink to="/otroci" class="door kids">
      <span class="emoji">🐉</span>
      <h3>Za otroke</h3>
      <p>Igre na pravih podatkih: pomagaj zmaju očistiti nebo in ugani jutrišnji zrak.</p>
      <span class="btn">Igraj →</span>
    </RouterLink>
    <RouterLink to="/starsi" class="door parents">
      <span class="emoji">👨‍👩‍👧</span>
      <h3>Za starše</h3>
      <p>Napoved, nasveti in opozorila – z upoštevanjem astme, ki ostane samo na tvojem telefonu.</p>
      <span class="btn">Poglej →</span>
    </RouterLink>
  </section>
</template>

<style scoped>
.hero {
  position: relative;
  overflow: hidden;
  background:
    radial-gradient(1200px 500px at 80% 10%, color-mix(in srgb, var(--lvl) 30%, transparent), transparent 60%),
    linear-gradient(180deg, var(--bg-soft), var(--bg));
  transition: background 0.6s ease;
  border-bottom: 1px solid var(--line);
}
.hero-inner {
  position: relative;
  display: grid;
  grid-template-columns: 1.2fr 1fr;
  align-items: center;
  gap: 24px;
  padding-top: 48px;
  padding-bottom: 48px;
}
h1 {
  font-size: clamp(2.2rem, 6vw, 4rem);
  margin-top: 12px;
}
.lvl {
  color: var(--lvl);
  transition: color 0.4s;
}
.lead {
  font-size: 1.25rem;
  color: var(--ink-soft);
  margin: 0 0 16px;
}
.big {
  display: flex;
  align-items: baseline;
  gap: 10px;
  flex-wrap: wrap;
}
.big strong {
  font-family: var(--font-head);
  font-size: 4.5rem;
  line-height: 1;
  color: var(--lvl);
}
.big span {
  color: var(--ink-soft);
  font-weight: 700;
}
.slider {
  display: block;
  margin: 18px 0 8px;
  max-width: 460px;
  font-weight: 700;
}
.hint {
  color: var(--ink-soft);
  font-size: 0.9rem;
}
.buddy-wrap {
  display: grid;
  place-items: center;
}
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
  .hero-inner {
    grid-template-columns: 1fr;
    padding-top: 24px;
  }
  .buddy-wrap {
    order: -1;
  }
  .buddy-wrap :deep(svg) {
    width: 180px;
    height: 144px;
  }
  .doors {
    grid-template-columns: 1fr;
  }
}
</style>
