<script setup lang="ts">
// Stran z igrami – zgrajena kot domača stran: na sredini velik Oblaček (z očmi sledi miški, ob kliku poskoči),
// ob njem so vedno vidna tri enako velika okenca z igrami (dve levo, ena desno).
// Pri vsaki igri piše rekord (Zmajček) ali koliko dni zapored se otrok vrača (Vedeževalec, Pokrovka).
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import AirBuddy from '@/components/AirBuddy.vue'
import { useAirData } from '@/composables/useAirData'
import { levelFor } from '@/lib/airQuality'
import { typicalPm25 } from '@/lib/klima'
import { useProgressStore } from '@/stores/progress'
import PixelIkona from '@/games/skupno/PixelIkona.vue'
import { napredek } from '@/games/daily/napredek'
import { dniZapored, nizIgre, trenutniNiz } from '@/games/skupno/niz'

const progress = useProgressStore()
const { currentPm25 } = useAirData()
const pm = computed(() => currentPm25.value ?? typicalPm25())
const level = computed(() => levelFor(pm.value))

// okenca so vedno odprta (prej jih je odprl klik na Oblačka)
const odprto = true

// velikost Oblačka glede na zaslon (pri odprtih okencih nekoliko manjši, da je prostor ob straneh)
const w = ref(typeof window !== 'undefined' ? window.innerWidth : 1200)
const h = ref(typeof window !== 'undefined' ? window.innerHeight : 800)
const onResize = () => {
  w.value = window.innerWidth
  h.value = window.innerHeight
}
onMounted(() => window.addEventListener('resize', onResize))
onBeforeUnmount(() => window.removeEventListener('resize', onResize))
const velikost = computed(() => {
  if (w.value <= 720) return Math.min(240, w.value * 0.6)
  const prostor = w.value - 2 * (Math.min(300, Math.max(230, w.value * 0.24)) + 60)
  return Math.max(200, Math.min(420, prostor, h.value * 0.5))
})

type Ikona = 'zmaj' | 'krogla' | 'pokrovka'
interface Okno {
  to: string
  kicker: string
  title: string
  text: string
  color: string
  ikona: Ikona
  stat: () => string
  ready: boolean
}

// dve levo, ena desno
const okna: Okno[] = [
  {
    to: '/igre/zmaj',
    kicker: 'Leti',
    title: 'Zmajček čisti nebo',
    text: 'Leti nad 3D Ljubljano in odpihni smog. Oblaček prinese dež, dimnikom se izogni.',
    color: 'var(--mint)',
    ikona: 'zmaj',
    stat: () => `tvoj rekord: ${progress.najboljse.zmaj ?? 0} %`,
    ready: true,
  },
  {
    to: '/igre/daily',
    kicker: 'Ugani',
    title: 'Vremenski vedeževalec',
    text: 'Vsak dan novo vprašanje o včerajšnjem zraku: zemljevid, drsnik, ura, detektiv.',
    color: 'var(--lilac)',
    ikona: 'krogla',
    stat: () => dniZapored(trenutniNiz(napredek.niz, napredek.zadnjiDan)),
    ready: true,
  },
  {
    to: '/igre/pokrovka',
    kicker: 'Razišči',
    title: 'Naredi pokrovko',
    text: 'Spreminjaj temperaturo v dolini in na hribu in ujemi včerajšnjo pokrovko.',
    color: 'var(--accent)',
    ikona: 'pokrovka',
    stat: () => dniZapored(nizIgre('pokrovka')),
    ready: true,
  },
]
const levo = okna.slice(0, 2)
const desno = okna.slice(2)
</script>

<template>
  <div class="landing" :class="{ odprto }" :style="{ '--lvl': level.color }">
    <header class="naslov">
      <h1>Igre</h1>
      <p class="hint">Katero igro boš igral?</p>
    </header>

    <div class="oblacek">
      <AirBuddy :mood="level.mood * 0.6" color="#7cc8ff" :size="velikost" />
      <span class="senca" aria-hidden="true" />
    </div>

    <nav class="okna" aria-label="Igre">
      <div v-for="(stolpec, si) in [levo, desno]" :key="si" class="stolpec" :class="si === 0 ? 'levo' : 'desno'">
        <component
          :is="o.ready ? RouterLink : 'div'"
          v-for="(o, i) in stolpec"
          :key="o.to"
          :to="o.ready ? o.to : undefined"
          class="okno"
          :class="{ kmalu: !o.ready }"
          :style="{ '--c': o.color, '--d': `${(si * 2 + i) * 90}ms` }"
          :tabindex="odprto && o.ready ? 0 : -1"
          :aria-hidden="!odprto"
        >
          <span class="ikona" aria-hidden="true"><PixelIkona :name="o.ikona" :size="40" /></span>
          <span class="k">{{ o.kicker }}</span>
          <strong>{{ o.title }}</strong>
          <span class="t">{{ o.text }}</span>
          <span class="noga">
            <span v-if="o.ready" class="stat">{{ o.stat() }}</span>
            <span v-else class="stat">kmalu</span>
            <span v-if="o.ready" class="go" aria-hidden="true">→</span>
          </span>
        </component>
      </div>
    </nav>
  </div>
</template>

<style scoped>
.landing {
  position: relative;
  height: calc(100svh - 64px); /* zgornja navigacija */
  min-height: 560px;
  overflow: hidden;
  color: var(--scene-ink);
}
.naslov {
  position: absolute;
  top: max(20px, 3vh);
  left: 0;
  right: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  pointer-events: none;
  padding: 0 16px;
  z-index: 2;
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
  color: var(--scene-ink);
}
.pika {
  display: inline-block;
  vertical-align: -1px;
  margin-right: 6px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--mint);
  animation: utrip 2s ease-out infinite;
}
@keyframes utrip {
  0% {
    box-shadow: 0 0 0 0 var(--mint);
  }
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

/* --- Oblaček na sredini --- */
.oblacek {
  position: absolute;
  left: 50%;
  top: 56%;
  transform: translate(-50%, -50%);
  z-index: 1;
  display: grid;
  justify-items: center;
  padding: 0;
  border: 0;
  background: none;
  cursor: pointer;
  transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.oblacek:hover {
  transform: translate(-50%, -50%) scale(1.03);
}
.oblacek:focus-visible {
  outline: 3px solid var(--brand);
  outline-offset: 8px;
  border-radius: 40px;
}
.senca {
  width: 60%;
  height: 18px;
  margin-top: 6px;
  border-radius: 50%;
  background: radial-gradient(closest-side, rgba(31, 45, 77, 0.18), transparent);
  animation: senca 4s ease-in-out infinite;
}
@keyframes senca {
  50% {
    transform: scaleX(0.85);
    opacity: 0.7;
  }
}

/* --- okenca: dva stolpca ob Oblačku (enako kot na domači strani) --- */
.okna {
  position: absolute;
  left: 0;
  right: 0;
  top: 170px;
  bottom: 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 max(24px, 4vw);
  pointer-events: none;
  z-index: 2;
}
.stolpec {
  display: flex;
  flex-direction: column;
  gap: 22px;
  width: clamp(230px, 24vw, 300px);
}
.okno {
  position: relative;
  display: grid;
  grid-template-columns: auto 1fr;
  column-gap: 12px;
  row-gap: 2px;
  align-items: center;
  padding: 16px 20px;
  height: 226px; /* vsa okenca enako velika */
  box-sizing: border-box;
  align-content: start;
  grid-template-rows: auto auto 1fr auto;
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
.levo .okno {
  transform: translateX(40px) scale(0.9);
}
.desno .okno {
  transform: translateX(-40px) scale(0.9);
}
/* črtkana nit proti Oblačku */
.okno::after {
  content: '';
  position: absolute;
  top: 50%;
  width: 28px;
  border-top: 2px dashed color-mix(in srgb, var(--c) 60%, transparent);
}
.levo .okno::after {
  left: 100%;
}
.desno .okno::after {
  right: 100%;
}
.odprto .okno {
  opacity: 1;
  pointer-events: auto;
  transform: none;
}
.odprto .okno.kmalu {
  opacity: 0.55;
  pointer-events: none;
}
.odprto a.okno:hover {
  transform: translateY(-4px);
  box-shadow:
    0 10px 0 color-mix(in srgb, var(--c) 40%, transparent),
    0 26px 44px -24px rgba(31, 45, 77, 0.5);
}
.ikona {
  grid-row: span 2;
  display: grid;
  place-items: center;
  width: 52px;
  height: 52px;
  border-radius: 16px;
  background: color-mix(in srgb, var(--c) 22%, transparent);
  transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.okno:hover .ikona {
  transform: rotate(-8deg) scale(1.08);
}
.okno .k {
  font-size: 0.75rem;
  font-weight: 800;
  letter-spacing: 0.04em;
  color: color-mix(in srgb, var(--c) 70%, var(--scene-ink));
}
.okno strong {
  font-family: var(--font-head);
  font-size: 1.45rem;
  line-height: 1.05;
}
.okno .t {
  grid-column: 1 / -1;
  margin-top: 8px;
  color: var(--scene-text);
  font-size: 0.92rem;
}
.noga {
  grid-column: 1 / -1;
  align-self: end;
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 6px;
}
.stat {
  padding: 2px 10px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--c) 16%, transparent);
  font-size: 0.8rem;
  font-weight: 800;
  color: color-mix(in srgb, var(--c) 60%, var(--scene-ink));
}
.go {
  font-size: 1.3rem;
  font-weight: 800;
  color: color-mix(in srgb, var(--c) 70%, var(--scene-ink));
  transition: transform 0.2s;
}
.okno:hover .go {
  transform: translateX(5px);
}

/* nizek zaslon: manjša okenca */
@media (max-height: 760px) and (min-width: 721px) {
  .okna {
    top: 150px;
  }
  .stolpec {
    gap: 12px;
  }
  .okno {
    height: 178px;
    padding: 10px 14px;
  }
  .okno .t {
    font-size: 0.82rem;
    margin-top: 4px;
  }
  .okno strong {
    font-size: 1.25rem;
  }
}

/* telefon: Oblaček zgoraj, okenca kot kratek seznam spodaj */
@media (max-width: 720px) {
  .landing {
    height: calc(100svh - 64px - 88px - env(safe-area-inset-bottom)); /* zgornja in spodnja navigacija */
    min-height: 520px;
  }
  .badge {
    font-size: 0.72rem;
    margin-bottom: 6px;
  }
  .oblacek {
    top: 52%;
  }
  .odprto .oblacek {
    top: 41%;
    transform: translate(-50%, -50%) scale(0.62);
  }
  .okna {
    top: auto;
    left: 16px;
    right: 16px;
    bottom: 12px;
    display: grid;
    gap: 8px;
    padding: 0;
  }
  .stolpec {
    display: contents;
  }
  .okno,
  .levo .okno,
  .desno .okno {
    grid-template-columns: auto 1fr auto;
    height: 58px;
    align-content: center;
    padding: 6px 12px;
    transform: translateY(16px);
  }
  .okno::after,
  .okno .t,
  .okno .k,
  .stat {
    display: none;
  }
  .ikona {
    grid-row: auto;
    width: 38px;
    height: 38px;
    border-radius: 12px;
  }
  .ikona :deep(svg) {
    width: 30px;
    height: 30px;
  }
  .okno strong {
    font-size: 1.1rem;
  }
  .noga {
    grid-column: auto;
    grid-row: auto;
    margin: 0;
  }
  .okno,
  .levo .okno,
  .desno .okno {
    grid-template-rows: none;
  }
  .odprto .okno {
    transform: none;
  }
}
</style>
