<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import ForecastStrip from '@/components/ForecastStrip.vue'
import { useAirData } from '@/composables/useAirData'
import { useProfile } from '@/composables/useProfile'
import { formatDayHour, levelFor } from '@/lib/airQuality'

const { now, forecast, facts, places, origin, currentPm25 } = useAirData()
const { profile, sensitivity } = useProfile()

const child = computed(() => profile.ime || 'vaš otrok')
const today = computed(() => levelFor(currentPm25.value ?? 15, sensitivity.value))
const originLabel = computed(() => (origin.value === 'api' ? 'žive meritve ARSO' : 'demo podatki'))
const bestHour = computed(() => (forecast.value ? formatDayHour(forecast.value.najboljsa_ura) : '–'))
const kidPlaces = computed(() => places.value.filter((p) => p.tip === 'vrtec' || p.tip === 'sola'))
const placeIcon: Record<string, string> = { vrtec: '🧸', sola: '🏫', bolnisnica: '🏥' }
</script>

<template>
  <section class="container page">
    <h1>Za starše</h1>
    <p class="sub">
      Kdaj na igrišče, kdaj zračiti in kdaj ostati doma – na podlagi zraka v Ljubljani. Vir: <span class="pill">{{ originLabel }}</span>
      <template v-if="profile.astma"> · Upoštevam <strong>strožje meje, ker ima {{ child }} astmo</strong> (podatek ostane samo na tej napravi).</template>
      <template v-else> · <RouterLink to="/nastavitve">Ima vaš otrok astmo ali občutljiva pljuča? Nastavite profil.</RouterLink></template>
    </p>

    <div class="card advice" :style="{ '--lvl': today.color }">
      <span class="kicker">Danes za {{ profile.ime || 'vašega otroka' }}</span>
      <h2>{{ today.label }} <small>{{ Math.round(currentPm25 ?? 0) }} µg/m³ PM2.5</small></h2>
      <p>{{ today.parents }}</p>
      <p class="muted">Otroku lahko poveste: »{{ today.kids }}«</p>
    </div>

    <div class="grid">
      <div class="card span2">
        <h2>Načrtujte dan: napoved 48 ur</h2>
        <p class="muted">Najboljši čas za igrišče, sprehod ali zračenje otroške sobe: <strong>{{ bestHour }}h</strong></p>
        <ForecastStrip v-if="forecast" :forecast="forecast" :sensitivity="sensitivity" />
      </div>

      <div class="card">
        <h2>Merilne postaje zdaj</h2>
        <ul class="list">
          <li v-for="s in now?.postaje ?? []" :key="s.id">
            <span class="dot" :style="{ background: levelFor(s.pm25 ?? 0, sensitivity).color }" />
            <span class="name">{{ s.ime }}</span>
            <strong>{{ s.pm25 ?? '–' }}</strong>
            <span class="pill">{{ s.vir }}</span>
          </li>
        </ul>
      </div>

      <div class="card">
        <h2>Otroci in zrak: ali ste vedeli?</h2>
        <ul class="facts">
          <li v-for="(f, i) in facts" :key="i">
            <strong v-if="f.stevilka" class="num">{{ f.stevilka }}</strong>
            {{ f.besedilo }}
            <small>— {{ f.vir }}</small>
          </li>
        </ul>
      </div>

      <div class="card span2">
        <h2>Vrtci in šole v bližini</h2>
        <p class="muted">Kraji, kjer otroci preživijo največ časa (vir: OpenStreetMap). Tu pride zemljevid.</p>
        <div class="places">
          <span v-for="p in kidPlaces" :key="p.ime" class="pill">{{ placeIcon[p.tip] ?? '📍' }} {{ p.ime }}</span>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.page {
  padding-top: 32px;
}
h1 {
  font-size: clamp(2rem, 5vw, 3rem);
}
h2 {
  font-size: 1.4rem;
}
.sub,
.muted {
  color: var(--ink-soft);
}
.advice {
  margin-bottom: 18px;
  border-left: 8px solid var(--lvl);
}
.advice .kicker {
  text-transform: uppercase;
  letter-spacing: 0.15em;
  font-size: 0.75rem;
  font-weight: 800;
  color: var(--lvl);
}
.advice h2 {
  margin: 4px 0;
}
.advice h2 small {
  font-size: 1rem;
  color: var(--ink-soft);
}
.advice p {
  font-size: 1.1rem;
  margin: 6px 0 0;
}
.grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 18px;
}
.span2 {
  grid-column: span 2;
}
.list,
.facts {
  list-style: none;
  padding: 0;
  margin: 0;
}
.list li {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 0;
  border-bottom: 1px solid var(--line);
}
.name {
  flex: 1;
}
.dot {
  width: 14px;
  height: 14px;
  border-radius: 50%;
}
.facts li {
  padding: 10px 0;
  border-bottom: 1px solid var(--line);
}
.facts small {
  display: block;
  color: var(--ink-soft);
}
.num {
  font-family: var(--font-head);
  font-size: 1.4rem;
  color: var(--brand);
  margin-right: 6px;
}
.places {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
@media (max-width: 720px) {
  .grid {
    grid-template-columns: 1fr;
  }
  .span2 {
    grid-column: auto;
  }
}
</style>
