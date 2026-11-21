<script setup lang="ts">
// Zavihek »Blogi«: drseča zgodba iz naših podatkov (isti slog kot Domov), na koncu podrobnosti in gumb na igre.
//   1. Kotlina z meglo   2. 10 let meritev ARSO (ARSOhack)   3. Napoved za 48 ur   4. Podrobnosti
import { RouterLink } from 'vue-router'
import KotlinaStory from '@/components/stories/KotlinaStory.vue'
import ZgodovinaStory from '@/components/stories/ZgodovinaStory.vue'
import NapovedStory from '@/components/stories/NapovedStory.vue'
import StoryNext from '@/components/StoryNext.vue'
import { useAirData } from '@/composables/useAirData'
import { useProfile } from '@/composables/useProfile'
import { levelFor } from '@/lib/airQuality'

const { now, facts, places, origin } = useAirData()
const { profile, sensitivity } = useProfile()

const placeIcon: Record<string, string> = { vrtec: '🧸', sola: '🏫', bolnisnica: '🏥' }
</script>

<template>
  <div class="story blogi">
    <!-- uvod -->
    <header class="intro">
      <span class="kicker">Blogi · zgodbe iz naših podatkov</span>
      <h1>Kaj nam povedo meritve?</h1>
      <p>
        Deset let meritev ARSO, megla v kotlini in napoved za naslednja dva dni. Drsi navzdol in poglej, kdaj in zakaj
        je zrak v Ljubljani slab.
      </p>
      <span class="scroll-hint" aria-hidden="true">↓ drsi</span>
    </header>

    <KotlinaStory />
    <ZgodovinaStory />
    <NapovedStory />

    <!-- podrobnosti (zemljevid pride kasneje) -->
    <section class="container details">
      <span class="kicker">Podrobnosti</span>
      <h2>Ta trenutek v Ljubljani</h2>
      <p class="sub">
        Vir: <span class="pill">{{ origin }}</span>
        <template v-if="profile.astma"> · Upoštevam <strong>strožje meje za astmo</strong> (nastavitev ostane na napravi).</template>
        <template v-else> · <RouterLink to="/nastavitve">Ima vaš otrok astmo? Nastavite profil.</RouterLink></template>
      </p>

      <div class="grid">
        <div class="card">
          <h3>Postaje zdaj</h3>
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
          <h3>Ali ste vedeli?</h3>
          <ul class="facts">
            <li v-for="(f, i) in facts" :key="i">
              <strong v-if="f.stevilka" class="num">{{ f.stevilka }}</strong>
              {{ f.besedilo }}
              <small>— {{ f.vir }}</small>
            </li>
          </ul>
        </div>

        <div class="card span2">
          <h3>Občutljive lokacije</h3>
          <p class="muted">Vrtci, šole in bolnišnice (OSM). Tu pride zemljevid.</p>
          <div class="places">
            <span v-for="p in places" :key="p.ime" class="pill">{{ placeIcon[p.tip] ?? '📍' }} {{ p.ime }}</span>
          </div>
        </div>
      </div>
    </section>

    <StoryNext
      to="/otroci"
      label="Igre"
      kicker="Zdaj pa ti"
      title="Preizkusi, kaj že veš"
      text="Igre uporabljajo prave podatke o zraku v Ljubljani. Pomagaj zmajčku očistiti nebo in ugani jutrišnji zrak."
      color="var(--aq-1)"
    />
    <div class="story-end" aria-hidden="true" />
  </div>
</template>

<style scoped>
.intro {
  --lvl: #5aa2ff;
  min-height: calc(100svh - 64px);
  display: flex;
  flex-direction: column;
  justify-content: center;
  max-width: 1100px;
  margin: 0 auto;
  padding: 40px max(24px, 5vw);
  background: radial-gradient(ellipse at 80% 40%, rgba(90, 162, 255, 0.14), transparent 60%);
}
.intro p {
  max-width: 560px;
}
.details {
  --lvl: #5aa2ff;
  padding-top: 80px;
  padding-bottom: 20px;
}
.details h3 {
  font-size: 1.4rem;
}
.sub {
  margin-bottom: 20px !important;
}
.sub a,
.muted {
  color: var(--ink-soft);
}
.muted {
  font-size: 1rem !important;
  margin-bottom: 10px !important;
}
.grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 18px;
}
.card {
  background: rgba(10, 18, 30, 0.62);
  border-color: rgba(255, 255, 255, 0.08);
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
  color: #c4d3e2;
}
.facts small {
  display: block;
  color: var(--ink-soft);
}
.num {
  font-family: var(--font-head);
  font-size: 1.4rem;
  color: var(--lvl);
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
