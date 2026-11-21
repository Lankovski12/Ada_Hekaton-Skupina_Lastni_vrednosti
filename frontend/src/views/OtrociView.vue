<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { useProgressStore } from '@/stores/progress'

const progress = useProgressStore()

// Seznam iger. Novo igro dodaš tako, da narediš mapo v src/games/ in jo vpišeš sem + v router.
const games = [
  { to: '/igre/zmaj', id: 'zmaj', emoji: '🐉', title: 'Zmajček čisti nebo', desc: 'Pihaj in poberi delce, preden zmajček zakašlja.', color: 'var(--aq-1)', ready: true },
  { to: '/igre/daily', id: 'daily', emoji: '🔮', title: 'Vremenski vedeževalec', desc: 'Ugani jutrišnji zrak. Jutri izveš, ali si imel prav!', color: 'var(--brand)', ready: true },
  { to: '/igre/ujemanje', id: 'ujemanje', emoji: '🧩', title: 'Ujemanje megle', desc: 'Kako se v kotlini dela megla in kaj je smog', color: 'var(--accent)', ready: false },
]
</script>

<template>
  <section class="container page">
    <h1>Igre</h1>
    <p class="sub">Vse igre uporabljajo prave podatke o zraku v Ljubljani. Zbiraj zvezdice!</p>
    <div class="grid">
      <RouterLink v-for="g in games" :key="g.id" :to="g.to" class="tile" :style="{ '--c': g.color }">
        <span class="emoji">{{ g.emoji }}</span>
        <h3>{{ g.title }}</h3>
        <p>{{ g.desc }}</p>
        <span class="meta">
          <span v-if="!g.ready" class="pill">kmalu</span>
          <span v-else class="pill">rekord: {{ progress.najboljse[g.id] ?? 0 }}</span>
        </span>
      </RouterLink>
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
.sub {
  color: var(--ink-soft);
  margin-top: 0;
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 18px;
}
.tile {
  position: relative;
  display: flex;
  flex-direction: column;
  padding: 24px;
  border-radius: var(--radius);
  background: linear-gradient(160deg, color-mix(in srgb, var(--c) 22%, var(--card)), var(--card) 70%);
  border: 1px solid var(--line);
  box-shadow: var(--shadow);
  color: var(--ink);
  text-decoration: none;
  transition: transform 0.2s ease;
}
.tile:hover {
  transform: translateY(-4px) scale(1.01);
}
.tile:active {
  transform: scale(0.98);
}
.emoji {
  font-size: 3.2rem;
  margin-bottom: 8px;
}
.tile p {
  color: var(--ink-soft);
  flex: 1;
}
</style>
