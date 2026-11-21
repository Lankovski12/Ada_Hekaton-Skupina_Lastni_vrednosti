<script setup lang="ts">
// Domača stran: pljuča iz pik, ki dihajo današnji zrak. Klik na pljuča odpre tri okenca:
// Igre in Zemljevid na eni strani, Podatki (grafi) na drugi.
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import PljucaPike from '@/scenes/PljucaPike.vue'
import { useAirData } from '@/composables/useAirData'
import { useProfile } from '@/composables/useProfile'
import { levelFor } from '@/lib/airQuality'
import { typicalPm25 } from '@/lib/klima'

const { currentPm25, now } = useAirData()
const { sensitivity } = useProfile()

const pm = computed(() => currentPm25.value ?? typicalPm25())
const level = computed(() => levelFor(pm.value, sensitivity.value))
const izmerjeno = computed(() => now.value?.postaje.some((p) => p.vir === 'meritev') ?? false)

const odprto = ref(false)

// okenca: dve na levi, eno na desni (besedila bomo še spreminjali)
const okna = [
  {
    to: '/igre',
    kicker: 'Igraj',
    title: 'Igre',
    text: 'Pomagaj zmajčku očistiti nebo in ugani jutrišnji zrak.',
    color: 'var(--aq-1)',
    pos: 'l1',
  },
  {
    to: '/zemljevid',
    kicker: 'Raziskuj',
    title: 'Zemljevid',
    text: '3D Ljubljana: kje so vrtci, šole in bolnišnice, ko se v kotlini ujame megla.',
    color: '#ffb547',
    pos: 'l2',
  },
  {
    to: '/grafi',
    kicker: 'Poglej',
    title: 'Podatki',
    text: 'Kaj kažejo meritve ARSO: megla v kotlini, deset let zraka in napoved za dva dni.',
    color: '#5aa2ff',
    pos: 'r1',
  },
]
</script>

<template>
  <div class="landing" :class="{ odprto }" :style="{ '--lvl': level.color }">
    <PljucaPike class="scena" :pm25="pm" :color="level.hex" @klik="odprto = !odprto" />

    <header class="naslov">
      <span class="kicker">
        Ljubljana {{ izmerjeno ? 'zdaj' : 'običajno ob tej uri' }} · {{ Math.round(pm) }} <span class="unit">µg/m³</span> PM2.5 ·
        {{ level.label }}
      </span>
      <h1>Zrak, ki ga dihamo</h1>
      <p class="hint">{{ odprto ? 'Kam greš naprej?' : 'Klikni na pljuča' }}</p>
    </header>

    <RouterLink to="/nastavitve" class="profil">Profil</RouterLink>

    <nav class="okna" aria-label="Kam naprej">
      <RouterLink
        v-for="(o, i) in okna"
        :key="o.to"
        :to="o.to"
        class="okno"
        :class="o.pos"
        :style="{ '--c': o.color, '--d': `${i * 90}ms` }"
        :tabindex="odprto ? 0 : -1"
        :aria-hidden="!odprto"
      >
        <span class="k">{{ o.kicker }}</span>
        <strong>{{ o.title }}</strong>
        <span class="t">{{ o.text }}</span>
        <span class="go" aria-hidden="true">→</span>
      </RouterLink>
    </nav>
  </div>
</template>

<style scoped>
.landing {
  position: relative;
  height: 100svh;
  min-height: 560px;
  overflow: hidden;
  background: #05080f;
  color: #eaf2fb;
}
.scena {
  position: absolute;
  inset: 0;
}
.naslov {
  position: absolute;
  top: max(28px, 5vh);
  left: 0;
  right: 0;
  text-align: center;
  pointer-events: none;
  padding: 0 16px;
}
.kicker .unit {
  text-transform: none; /* sicer bi »µ« postal »M« */
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
h1 {
  font-size: clamp(2.4rem, 6vw, 4.2rem);
  margin: 0;
}
.hint {
  margin: 6px 0 0;
  color: #8197ad;
  font-weight: 700;
  animation: hint 1.8s ease-in-out infinite;
}
@keyframes hint {
  50% {
    opacity: 0.45;
  }
}
.profil {
  position: absolute;
  top: 18px;
  right: 18px;
  padding: 6px 14px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  color: #c4d3e2;
  font-weight: 700;
  font-size: 0.9rem;
  text-decoration: none;
  background: rgba(10, 18, 30, 0.6);
}

/* --- okenca --- */
.okno {
  position: absolute;
  width: min(300px, 26vw);
  display: grid;
  gap: 4px;
  padding: 18px 20px;
  border-radius: var(--radius);
  background: rgba(10, 18, 30, 0.72);
  border: 1px solid color-mix(in srgb, var(--c) 55%, transparent);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  color: #eaf2fb;
  text-decoration: none;
  opacity: 0;
  pointer-events: none;
  transition:
    opacity 0.45s ease var(--d),
    transform 0.45s cubic-bezier(0.3, 0.8, 0.3, 1) var(--d),
    box-shadow 0.2s;
}
.okno.l1,
.okno.l2 {
  left: max(24px, 7vw);
  transform: translateX(40px) scale(0.96);
}
.okno.r1 {
  right: max(24px, 7vw);
  top: 44%;
  transform: translateX(-40px) scale(0.96);
}
.okno.l1 {
  top: 30%;
}
.okno.l2 {
  top: 56%;
}
/* črtica proti pljučem */
.okno::after {
  content: '';
  position: absolute;
  top: 50%;
  width: 5vw;
  height: 1px;
  background: linear-gradient(90deg, color-mix(in srgb, var(--c) 70%, transparent), transparent);
}
.okno.l1::after,
.okno.l2::after {
  left: 100%;
}
.okno.r1::after {
  right: 100%;
  transform: scaleX(-1);
}
.odprto .okno {
  opacity: 1;
  pointer-events: auto;
  transform: none;
}
.okno:hover {
  box-shadow: 0 0 0 1px var(--c), 0 18px 40px -18px var(--c);
}
.okno .k {
  text-transform: uppercase;
  letter-spacing: 0.18em;
  font-size: 0.7rem;
  font-weight: 800;
  color: var(--c);
}
.okno strong {
  font-family: var(--font-head);
  font-size: 1.7rem;
  line-height: 1.1;
}
.okno .t {
  color: #c4d3e2;
  font-size: 0.95rem;
}
.okno .go {
  justify-self: end;
  font-size: 1.3rem;
  color: var(--c);
  transition: transform 0.2s;
}
.okno:hover .go {
  transform: translateX(4px);
}

@media (max-width: 720px) {
  .landing {
    height: calc(100svh - 72px); /* spodnja navigacija na telefonu */
  }
  .okna {
    position: absolute;
    left: 16px;
    right: 16px;
    bottom: 16px;
    display: grid;
    gap: 8px;
    pointer-events: none;
  }
  .okno,
  .okno.l1,
  .okno.l2,
  .okno.r1 {
    position: relative;
    inset: auto;
    width: auto;
    padding: 12px 14px;
    transform: translateY(16px);
  }
  .okno::after {
    display: none;
  }
  .okno strong {
    font-size: 1.25rem;
  }
  .okno .t {
    display: none; /* na telefonu kratka okenca, da se pljuča še vidijo */
  }
  .okno {
    gap: 0;
  }
  .profil {
    display: none; /* Profil je v spodnji navigaciji */
  }
  .okno .go {
    position: absolute;
    right: 14px;
    top: 50%;
    transform: translateY(-50%);
  }
  .odprto .okno {
    transform: none;
  }
}
</style>
