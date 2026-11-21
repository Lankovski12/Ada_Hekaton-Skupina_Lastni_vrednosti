<script setup lang="ts">
// Zavihek »Zemljevid«: 3D zemljevid občutljivih lokacij in stanje v Ljubljani ta trenutek.
import { defineAsyncComponent } from 'vue'
import { useAirData } from '@/composables/useAirData'
import { useProfile } from '@/composables/useProfile'
import { levelFor } from '@/lib/airQuality'

// 3D zemljevid (three.js) se naloži šele, ko odpreš ta zavihek
const Zemljevid3D = defineAsyncComponent(() => import('@/scenes/Zemljevid3D.vue'))

const { now, facts } = useAirData()
const { sensitivity } = useProfile()
</script>

<template>
  <div class="story zemljevid">
    <!-- 3D zemljevid občutljivih lokacij -->
    <section class="container mapsec">
      <span class="kicker">Zemljevid</span>
      <h1>Ljubljana v realnem času</h1>
      <p class="lead">
        Na zemljevidu so poudarjeni vrtci, šole, bolnišnice, zdravstveni domovi in domovi za starejše, ker so tam ljudje,
        ki jim onesnažen zrak najbolj škodi: otroci, ki dihajo hitreje in imajo pljuča še v razvoju, starejši in bolniki.
        Tam preživijo večji del dneva in si kraja ne morejo izbrati. Večina teh ustanov leži na dnu kotline, kjer se
        pozimi ob inverziji ujame hladen, onesnažen zrak. Premakni drsnik megle in poglej, koliko jih ostane pod njo.
      </p>
      <Zemljevid3D />
    </section>

    <!-- ta trenutek -->
    <section class="container details">
      <span class="kicker">Podrobnosti</span>
      <h2>Ta trenutek v Ljubljani</h2>

      <div class="grid">
        <div class="card">
          <h3>Postaje zdaj</h3>
          <ul class="list">
            <li v-for="s in now?.postaje ?? []" :key="s.id">
              <span class="dot" :style="{ background: levelFor(s.pm25 ?? 0, sensitivity).color }" />
              <span class="name">{{ s.ime }}</span>
              <strong>{{ s.pm25 != null ? Math.round(s.pm25) : '–' }}</strong>
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
      </div>
    </section>

    <div class="story-end" aria-hidden="true" />
  </div>
</template>

<style scoped>
.mapsec {
  --lvl: #ffb547;
  padding-top: 40px;
}
.mapsec h1 {
  font-size: clamp(2rem, 5vw, 3.2rem);
}
.mapsec .lead {
  max-width: 720px;
  margin-bottom: 20px;
}
.details {
  --lvl: #5aa2ff;
  padding-top: 80px;
  padding-bottom: 20px;
}
.details h3 {
  font-size: 1.4rem;
}
.details h2 {
  margin-bottom: 20px;
}
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
  background: var(--panel);
  border-color: var(--panel-line);
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
  color: var(--scene-text);
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
@media (max-width: 720px) {
  .grid {
    grid-template-columns: 1fr;
  }
}
</style>
