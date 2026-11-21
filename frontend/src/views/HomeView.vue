<script setup lang="ts">
// Domača stran: pljuča iz pik, ki dihajo današnji zrak. Klik na pljuča odpre tri okenca:
// Igre in Zemljevid na eni strani, Podatki (grafi) na drugi.
// Ko so okenca enkrat odprta, ostanejo odprta tudi ob vrnitvi na to stran (do zaprtja zavihka brskalnika).
import { computed, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import PljucaPike from '@/scenes/PljucaPike.vue'
import { useAirData } from '@/composables/useAirData'
import { useProfile } from '@/composables/useProfile'
import { levelFor } from '@/lib/airQuality'
import { typicalPm25 } from '@/lib/klima'

const { currentPm25, now } = useAirData()
const { sensitivity } = useProfile()

const pm = computed(() => currentPm25.value ?? typicalPm25())
// pljuča so vedno zelena (med prvotno in neon zeleno); kakovost zraka pokaže hitrost dihanja in število delcev okoli
const NEON = '#5adc32'
const level = computed(() => levelFor(pm.value, sensitivity.value))
const izmerjeno = computed(() => now.value?.postaje.some((p) => p.vir === 'meritev') ?? false)

// okenca: odprta, če jih je uporabnik v tem obisku že odprl
const KEY = 'zrak-okna-odprta'
function prebrano() {
  try {
    return sessionStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}
const odprto = ref(prebrano())
watch(odprto, (v) => {
  try {
    if (v) sessionStorage.setItem(KEY, '1')
  } catch {
    /* ni pomembno */
  }
})

// okenca: dve na levi, eno na desni (besedila bomo še spreminjali)
const okna = [
  {
    to: '/igre',
    kicker: 'Igraj',
    title: 'Igre',
    text: 'Pomagaj zmajčku očistiti nebo in ugani jutrišnji zrak.',
    color: 'var(--mint)',
    ikona: 'igre',
    pos: 'l1',
  },
  {
    to: '/zemljevid',
    kicker: 'Raziskuj',
    title: 'Zemljevid',
    text: '3D Ljubljana: kje so vrtci, šole in bolnišnice, ko se v kotlini ujame megla.',
    color: 'var(--accent)',
    ikona: 'zemljevid',
    pos: 'l2',
  },
  {
    to: '/grafi',
    kicker: 'Poglej',
    title: 'Podatki',
    text: 'Kaj kažejo meritve ARSO: megla v kotlini, deset let zraka in napoved za dva dni.',
    color: 'var(--brand)',
    ikona: 'podatki',
    pos: 'r1',
  },
]
</script>

<template>
  <div class="landing" :class="{ odprto }" :style="{ '--lvl': level.color }">
    <PljucaPike class="scena" :pm25="pm" :color="NEON" @klik="odprto = !odprto" />

    <header class="naslov">
      <span class="badge">
        <span class="pika" />
        Ljubljana {{ izmerjeno ? 'zdaj' : 'običajno ob tej uri' }} · <strong>{{ Math.round(pm) }}</strong> µg/m³ PM2.5 ·
        {{ level.label }}
      </span>
      <h1>Zrak, ki ga dihamo</h1>
      <p class="hint">{{ odprto ? 'Kam greš naprej?' : 'Klikni na pljuča' }}</p>
    </header>

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
        <span class="ikona" aria-hidden="true">
          <svg v-if="o.ikona === 'igre'" viewBox="0 0 32 32">
            <rect x="4" y="10" width="24" height="14" rx="7" />
            <path d="M10 14v6M7 17h6" />
            <circle cx="21" cy="15.5" r="1.3" class="fill" />
            <circle cx="24" cy="18.5" r="1.3" class="fill" />
          </svg>
          <svg v-else-if="o.ikona === 'zemljevid'" viewBox="0 0 32 32">
            <path d="M4 9l7-3 10 3 7-3v17l-7 3-10-3-7 3z" />
            <path d="M11 6v17M21 9v17" />
          </svg>
          <svg v-else viewBox="0 0 32 32">
            <path d="M5 26h22" />
            <rect x="7" y="15" width="4" height="9" rx="1.5" />
            <rect x="14" y="9" width="4" height="15" rx="1.5" />
            <rect x="21" y="12" width="4" height="12" rx="1.5" />
          </svg>
        </span>
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
  color: var(--scene-ink);
}
:root[data-theme='dark'] .landing {
  background: var(--scene-bg);
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
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  pointer-events: none;
  padding: 0 16px;
}
.badge {
  display: inline-block;
  padding: 5px 14px;
  border-radius: 999px;
  background: var(--panel);
  border: 1px solid var(--panel-line);
  box-shadow: var(--panel-shadow);
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--scene-text);
  margin-bottom: 12px;
}
.badge strong {
  color: color-mix(in srgb, var(--lvl) 75%, var(--scene-ink));
}
.pika {
  display: inline-block;
  vertical-align: -1px;
  margin-right: 6px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--lvl);
  box-shadow: 0 0 0 0 var(--lvl);
  animation: utrip 2s ease-out infinite;
}
@keyframes utrip {
  70% {
    box-shadow: 0 0 0 8px transparent;
  }
}
h1 {
  font-size: clamp(2.4rem, 6vw, 4.2rem);
  margin: 0;
}
.hint {
  margin: 6px 0 0;
  color: var(--scene-muted);
  font-weight: 800;
  animation: hint 1.8s ease-in-out infinite;
}
@keyframes hint {
  50% {
    transform: translateY(3px);
    opacity: 0.6;
  }
}
/* --- okenca --- */
.okno {
  position: absolute;
  width: min(300px, 26vw);
  display: grid;
  grid-template-columns: auto 1fr;
  column-gap: 12px;
  row-gap: 2px;
  align-items: center;
  padding: 18px 20px;
  min-height: 212px; /* vsa okenca enako visoka, da so poravnana */
  border-radius: var(--radius);
  background: var(--panel);
  border: 2px solid color-mix(in srgb, var(--c) 55%, transparent);
  box-shadow:
    0 6px 0 color-mix(in srgb, var(--c) 35%, transparent),
    0 22px 40px -24px rgba(31, 45, 77, 0.45);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  color: var(--scene-ink);
  text-decoration: none;
  opacity: 0;
  pointer-events: none;
  transition:
    opacity 0.45s ease var(--d),
    transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) var(--d),
    box-shadow 0.2s;
}
.okno.l1,
.okno.l2 {
  left: max(24px, 7vw);
  transform: translateX(40px) scale(0.9);
}
.okno.r1 {
  right: max(24px, 7vw);
  top: 44%;
  transform: translateX(-40px) scale(0.9);
}
.okno.l1 {
  top: 29%;
}
.okno.l2 {
  top: 57%;
}
/* črtkana nit proti pljučem */
.okno::after {
  content: '';
  position: absolute;
  top: 50%;
  width: 5vw;
  border-top: 2px dashed color-mix(in srgb, var(--c) 60%, transparent);
}
.okno.l1::after,
.okno.l2::after {
  left: 100%;
}
.okno.r1::after {
  right: 100%;
}
.odprto .okno {
  opacity: 1;
  pointer-events: auto;
}
.odprto .okno {
  transform: none;
}
.odprto .okno:hover {
  transform: translateY(-4px);
  box-shadow:
    0 10px 0 color-mix(in srgb, var(--c) 40%, transparent),
    0 26px 44px -24px rgba(31, 45, 77, 0.5);
}
.ikona {
  grid-row: span 2;
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
  border-radius: 16px;
  background: color-mix(in srgb, var(--c) 22%, transparent);
  transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.okno:hover .ikona {
  transform: rotate(-8deg) scale(1.08);
}
.ikona svg {
  width: 30px;
  height: 30px;
  fill: none;
  stroke: color-mix(in srgb, var(--c) 70%, var(--scene-ink));
  stroke-width: 2.2;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.ikona svg .fill {
  fill: color-mix(in srgb, var(--c) 70%, var(--scene-ink));
  stroke: none;
}
.okno .k {
  font-size: 0.75rem;
  font-weight: 800;
  letter-spacing: 0.04em;
  color: color-mix(in srgb, var(--c) 70%, var(--scene-ink));
}
.okno strong {
  font-family: var(--font-head);
  font-size: 1.7rem;
  line-height: 1.05;
}
.okno .t {
  grid-column: 1 / -1;
  margin-top: 8px;
  color: var(--scene-text);
  font-size: 0.95rem;
}
.okno .go {
  grid-column: 1 / -1;
  justify-self: end;
  font-size: 1.3rem;
  font-weight: 800;
  color: color-mix(in srgb, var(--c) 70%, var(--scene-ink));
  transition: transform 0.2s;
}
.okno:hover .go {
  transform: translateX(5px);
}

@media (max-width: 720px) {
  .landing {
    height: calc(100svh - 72px); /* spodnja navigacija na telefonu */
  }
  .badge {
    font-size: 0.75rem;
    max-width: 100%;
  }
  .okna {
    position: absolute;
    left: 16px;
    right: 16px;
    bottom: 16px;
    display: grid;
    gap: 10px;
    pointer-events: none;
  }
  .okno,
  .okno.l1,
  .okno.l2,
  .okno.r1 {
    position: relative;
    inset: auto;
    width: auto;
    min-height: 0;
    padding: 10px 14px;
    transform: translateY(16px);
  }
  .okno::after {
    display: none;
  }
  .ikona {
    width: 40px;
    height: 40px;
    border-radius: 13px;
  }
  .ikona svg {
    width: 24px;
    height: 24px;
  }
  .okno strong {
    font-size: 1.25rem;
  }
  .okno .t {
    display: none; /* na telefonu kratka okenca, da se pljuča še vidijo */
  }
  .okno .go {
    position: absolute;
    right: 16px;
    top: 50%;
    transform: translateY(-50%);
  }
  .odprto .okno.l1,
  .odprto .okno.l2,
  .odprto .okno.r1 {
    transform: none;
  }
}
</style>
