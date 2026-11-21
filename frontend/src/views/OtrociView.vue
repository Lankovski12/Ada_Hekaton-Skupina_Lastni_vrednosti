<script setup lang="ts">
// Podstran z igrami – v istem slogu kot Zemljevid in Podatki (nadnaslov, temen naslov, bele kartice).
import { RouterLink } from 'vue-router'
import { useProgressStore } from '@/stores/progress'
import GameIcon from '@/games/skupno/GameIcon.vue'
import { skupajZvezdic } from '@/games/daily/napredek'

const progress = useProgressStore()

function zvezdicePokrovka(): number {
  try {
    return JSON.parse(localStorage.getItem('zrak-pokrovka') ?? '{}').zvezdice ?? 0
  } catch {
    return 0
  }
}

// Seznam iger. Novo igro dodaš tako, da narediš mapo v src/games/ in jo vpišeš sem + v router.
const games = [
  {
    to: '/igre/zmaj',
    id: 'zmaj',
    icon: 'zmaj' as const,
    title: 'Zmajček čisti nebo',
    desc: 'Leti nad 3D Ljubljano in odpihni smog. Oblaček prinese dež, obroč vetra pospešek, dimnikom se izogni.',
    color: 'var(--mint)',
    stat: () => `rekord: ${progress.najboljse.zmaj ?? 0} %`,
    ready: true,
  },
  {
    to: '/igre/daily',
    id: 'daily',
    icon: 'vprasaj' as const,
    title: 'Vremenski vedeževalec',
    desc: 'Vsak dan novo vprašanje o včerajšnjem zraku: zemljevid, drsnik, ura, detektiv in še več.',
    color: 'var(--lilac)',
    stat: () => `zvezdice: ${skupajZvezdic()}`,
    ready: true,
  },
  {
    to: '/igre/pokrovka',
    id: 'pokrovka',
    icon: 'pokrovka' as const,
    title: 'Naredi pokrovko',
    desc: 'Spreminjaj temperaturo v dolini in na hribu in ujemi včerajšnjo pokrovko nad Ljubljano.',
    color: 'var(--accent)',
    stat: () => `zvezdice: ${zvezdicePokrovka()}`,
    ready: true,
  },
  {
    to: '/igre/ujemanje',
    id: 'ujemanje',
    icon: 'oblak' as const,
    title: 'Ujemanje megle',
    desc: 'Kako se v kotlini dela megla in kaj je smog.',
    color: 'var(--brand)',
    stat: () => '',
    ready: false,
  },
]
</script>

<template>
  <div class="story igre">
    <section class="container page">
      <span class="kicker">Igre</span>
      <h1>Igraj in se nauči</h1>
      <p class="lead">
        Vse igre uporabljajo prave podatke o zraku v Ljubljani – meritve ARSO od včeraj ali iz preteklih zim.
        Med igro izveš, zakaj se smog pozimi ujame v kotlini in kaj ga odnese.
      </p>
      <div class="grid">
        <component
          :is="g.ready ? RouterLink : 'div'"
          v-for="g in games"
          :key="g.id"
          :to="g.ready ? g.to : undefined"
          class="tile"
          :class="{ soon: !g.ready }"
          :style="{ '--c': g.color }"
        >
          <span class="icon"><GameIcon :name="g.icon" :size="56" /></span>
          <h3>{{ g.title }}</h3>
          <p>{{ g.desc }}</p>
          <span class="foot">
            <span v-if="g.ready" class="pill">{{ g.stat() }}</span>
            <span v-else class="pill">kmalu</span>
            <span v-if="g.ready" class="btn play">Igraj</span>
          </span>
        </component>
      </div>
    </section>
  </div>
</template>

<style scoped>
.page {
  --lvl: var(--coral);
  padding-top: 40px;
}
.page h1 {
  font-size: clamp(2rem, 5vw, 3.2rem);
}
.lead {
  max-width: 720px;
  margin-bottom: 26px !important;
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 18px;
}
.tile {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 22px;
  border-radius: var(--radius);
  background: var(--panel);
  border: 1px solid var(--panel-line);
  box-shadow: var(--shadow);
  color: var(--ink);
  text-decoration: none;
  transition: transform 0.2s ease;
}
a.tile:hover {
  transform: translateY(-4px);
}
a.tile:active {
  transform: scale(0.98);
}
.tile.soon {
  opacity: 0.6;
}
.icon {
  display: grid;
  place-items: center;
  width: 84px;
  height: 84px;
  margin-bottom: 6px;
  border-radius: 28px;
  background: color-mix(in srgb, var(--c) 22%, transparent);
}
.tile h3 {
  margin: 0;
  font-size: 1.35rem;
}
.tile p {
  flex: 1;
  font-size: 1rem;
}
.foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 8px;
}
.play {
  --btn: var(--c);
  min-height: 40px;
  padding: 8px 18px;
  color: #10192e;
}
</style>
