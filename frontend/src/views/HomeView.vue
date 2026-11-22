<script setup lang="ts">
// Domača stran za starše in otroke: najprej odgovori na vprašanje »Kakšen zrak dihamo danes?«
// – številka in ocena, en nasvet za starše (kdaj ven, kdaj prezračiti) in eno sporočilo za otroka.
// Pljuča iz pik dihajo današnji zrak. Okenca so razdeljena v dva stolpca: »Za otroke« in »Za starše«;
// privzeto so odprta, klik na pljuča jih skrije.
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import PljucaPike from '@/scenes/PljucaPike.vue'
import { useAirData } from '@/composables/useAirData'
import { useProfile } from '@/composables/useProfile'
import { LEVELS, levelFor } from '@/lib/airQuality'
import { klimaLabel, typicalPm25 } from '@/lib/klima'
import { oknaOdprta } from '@/composables/useOkna'
import VirZnacka from '@/components/VirZnacka.vue'

const { currentPm25, now, forecast } = useAirData()
const { sensitivity } = useProfile()

const pm = computed(() => currentPm25.value ?? typicalPm25())
// pljuča so vedno zelena (med prvotno in neon zeleno); kakovost zraka pokaže hitrost dihanja in število delcev okoli
const NEON = '#4e9f35'
const level = computed(() => levelFor(pm.value, sensitivity.value))
const izmerjeno = computed(() => now.value?.postaje.some((p) => p.vir === 'meritev') ?? false)

// en nasvet: kdaj je danes (podnevi, 7–20 h) zrak najčistejši – iz napovedi modela CAMS ali iz povprečja meritev
const hh = (h: number) => `${String(h).padStart(2, '0')}:00`
const nasvet = computed(() => {
  const ure = (forecast.value?.ure ?? []).slice(0, 24).map((u) => ({ h: new Date(u.cas_utc).getHours(), pm: u.pm25 }))
  const vrsta: 'model' | 'ocena' = forecast.value?.model === 'klima' || !forecast.value ? 'ocena' : 'model'
  const stopnja = LEVELS.findIndex((l) => l.key === level.value.key)
  const dan = ure.filter((u) => u.h >= 7 && u.h <= 20)
  const naj = dan.reduce<(typeof dan)[number] | null>((a, b) => (!a || b.pm < a.pm ? b : a), null)
  if (stopnja <= 1) return { text: level.value.parents, vrsta: null }
  if (!naj) return { text: level.value.parents, vrsta: null }
  if (naj === dan[0] && ure[0]?.h === naj.h)
    return { text: 'Zdaj je najčistejša ura dneva: pravi čas za igro zunaj in za zračenje (5–10 minut na široko).', vrsta }
  return {
    text: `Z igro zunaj in zračenjem počakajte do ${hh(naj.h)}, takrat bo zrak najčistejši (okoli ${Math.round(naj.pm)} µg/m³).`,
    vrsta,
  }
})

// okenca: ob prvem obisku zaprta; ko jih odpreš, ostanejo odprta med premikanjem po zavihkih
const odprto = oknaOdprta

// pri odprtih okencih pljuča naredijo prostor ob straneh, da se nič ne prekriva
const sirina = ref(typeof window !== 'undefined' ? window.innerWidth : 1200)
const onResize = () => (sirina.value = window.innerWidth)
onMounted(() => window.addEventListener('resize', onResize))
onBeforeUnmount(() => window.removeEventListener('resize', onResize))
const rezerva = computed(() => {
  const w = sirina.value
  if (!odprto.value || w <= 720) return 0
  const stolpec = Math.min(300, Math.max(230, w * 0.24))
  return stolpec + Math.max(24, w * 0.04) + 28
})

// okenca: levo za otroke, desno za starše
const okna = [
  {
    to: '/igre',
    kicker: 'Igraj',
    title: 'Igre',
    text: 'Zmajček, vremenski vedeževalec in pokrovka nad mestom – vse na pravih podatkih o zraku.',
    color: 'var(--mint)',
    ikona: 'igre',
    pos: 'l1',
  },
  {
    to: '/grafi',
    kicker: 'Razumi',
    title: 'Zakaj je pozimi smog?',
    text: 'Kako se megla ujame v kotlini in kaj kaže 10 let meritev. Preberite skupaj.',
    color: 'var(--brand)',
    ikona: 'podatki',
    pos: 'l2',
  },
  {
    to: '/moj-zrak',
    kicker: 'Načrt dneva',
    title: 'Kdaj ven, kdaj zračiti',
    text: 'Za naslednjih 24 ur tam, kjer ste: kdaj na igrišče, kdaj prezračiti, kdaj ostati notri.',
    color: 'var(--coral)',
    ikona: 'moj',
    pos: 'r1',
  },
  {
    to: '/zemljevid',
    kicker: 'Šola in vrtec',
    title: 'Zrak pri šoli',
    text: 'Poiščite otrokovo šolo ali vrtec: koliko dima je v okolici in kako pogosto je pod meglo.',
    color: 'var(--accent)',
    ikona: 'zemljevid',
    pos: 'r2',
  },
]
</script>

<template>
  <div class="landing" :class="{ odprto }" :style="{ '--lvl': level.color }">
    <PljucaPike class="scena" :pm25="pm" :color="NEON" :rezerva="rezerva" @klik="odprto = !odprto" />

    <header class="naslov">
      <span class="znamka">Zrak v Ljubljani · za otroke in starše</span>
      <h1>Kakšen zrak dihamo danes?</h1>
      <div class="odgovor">
        <p class="stanje">
          <span class="pika" />
          <strong class="lvl">{{ level.label }}</strong>
          <span class="st"><strong>{{ Math.round(pm) }}</strong> µg/m³ PM2.5</span>
          <VirZnacka :vrsta="izmerjeno ? 'meritev' : 'ocena'" />
          <small>{{ izmerjeno ? 'ARSO, zadnja ura' : `običajno ob tej uri (povprečje meritev ${klimaLabel})` }}</small>
        </p>
        <p class="nasvet">
          <span class="komu">Za starše</span>
          {{ nasvet.text }} <VirZnacka v-if="nasvet.vrsta" :vrsta="nasvet.vrsta" />
          <RouterLink to="/moj-zrak" class="vec">Načrt dneva →</RouterLink>
        </p>
        <p class="nasvet otroku">
          <span class="komu">Za otroka</span>
          Oblaček pravi: <strong>{{ level.kids }}</strong>
        </p>
      </div>
      <p v-if="!odprto" class="hint">Klikni na pljuča</p>
    </header>

    <nav class="okna" aria-label="Kam naprej">
      <div class="stolpec levo">
        <span class="skupina">Za otroke</span>
        <RouterLink
          v-for="(o, i) in okna.slice(0, 2)"
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
            <svg v-else-if="o.ikona === 'moj'" viewBox="0 0 32 32">
            <path d="M16 28s9-8.2 9-15a9 9 0 0 0-18 0c0 6.8 9 15 9 15z" />
            <circle cx="16" cy="13" r="3.2" />
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
      </div>
      <div class="stolpec desno">
        <span class="skupina">Za starše</span>
        <RouterLink
          v-for="(o, i) in okna.slice(2)"
          :key="o.to"
          :to="o.to"
          class="okno"
          :class="o.pos"
          :style="{ '--c': o.color, '--d': `${(i + 2) * 90}ms` }"
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
            <svg v-else-if="o.ikona === 'moj'" viewBox="0 0 32 32">
            <path d="M16 28s9-8.2 9-15a9 9 0 0 0-18 0c0 6.8 9 15 9 15z" />
            <circle cx="16" cy="13" r="3.2" />
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
      </div>
    </nav>
  </div>
</template>

<style scoped>
.komu {
  display: inline-block;
  margin-right: 6px;
  padding: 1px 8px;
  border-radius: 999px;
  background: var(--bg-soft);
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--ink-soft);
  vertical-align: 1px;
}
.otroku {
  margin-top: 6px !important;
}
.skupina {
  font-family: var(--font-head);
  font-weight: 800;
  font-size: 1.05rem;
  color: var(--ink);
  opacity: 0;
  transition: opacity 0.4s;
}
.odprto .skupina {
  opacity: 1;
}
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
.znamka {
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--scene-muted);
  margin-bottom: 4px;
}
.odgovor {
  pointer-events: auto;
  margin-top: 10px;
  padding: 10px 18px;
  max-width: 640px;
  border-radius: 18px;
  background: var(--panel);
  border: 1px solid var(--panel-line);
  border-left: 5px solid var(--lvl);
  box-shadow: var(--panel-shadow);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  text-align: left;
}
.odgovor p {
  margin: 0;
}
.stanje {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 10px;
  color: var(--scene-text);
}
.stanje .lvl {
  font-family: var(--font-head);
  font-size: 1.35rem;
  color: color-mix(in srgb, var(--lvl) 70%, var(--scene-ink));
}
.stanje .st strong {
  font-family: var(--font-head);
  font-size: 1.35rem;
  color: var(--scene-ink);
}
.stanje small {
  color: var(--scene-muted);
  font-size: 0.78rem;
}
.nasvet {
  margin-top: 4px !important;
  color: var(--scene-ink);
  font-weight: 700;
  font-size: 0.95rem;
}
.vec {
  margin-left: 6px;
  white-space: nowrap;
  color: color-mix(in srgb, var(--coral) 75%, var(--scene-ink));
  font-weight: 800;
}
.pika {
  display: inline-block;
  flex: none;
  width: 12px;
  height: 12px;
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
  font-size: clamp(2rem, 4.6vw, 3.4rem);
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
/* --- okenca: zaklenjena v dva stolpca ob pljučih (levo dve, desno eno), nikoli se ne prekrivajo --- */
.okna {
  position: absolute;
  left: 0;
  right: 0;
  top: 290px; /* pod naslovom in odgovorom */
  bottom: 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 max(24px, 4vw);
  pointer-events: none;
}
.stolpec {
  display: flex;
  flex-direction: column;
  gap: 24px;
  width: clamp(230px, 24vw, 300px);
}
.okno {
  position: relative;
  display: grid;
  grid-template-columns: auto 1fr;
  column-gap: 12px;
  row-gap: 2px;
  align-items: center;
  padding: 18px 20px;
  min-height: 196px; /* vsa okenca enako visoka, da so poravnana */
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
/* črtkana nit proti pljučem */
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

/* nizek zaslon: manjša okenca, da gresta leva eno pod drugo */
@media (max-height: 760px) and (min-width: 721px) {
  .okna {
    top: 250px;
  }
  .stolpec {
    gap: 14px;
  }
  .okno {
    min-height: 0;
    padding: 12px 16px;
  }
  .okno .t {
    font-size: 0.85rem;
    margin-top: 4px;
  }
  .okno strong {
    font-size: 1.4rem;
  }
}

@media (max-width: 720px) {
  .landing {
    height: calc(100svh - 72px); /* spodnja navigacija na telefonu */
  }
  .odgovor {
    padding: 8px 12px;
  }
  .stanje small,
  .vec {
    display: none;
  }
  .nasvet {
    font-size: 0.85rem;
  }
  .okna {
    top: auto;
    left: 16px;
    right: 16px;
    bottom: 16px;
    display: grid;
    gap: 10px;
    padding: 0;
  }
  .stolpec {
    display: contents;
  }
  .okno,
  .levo .okno,
  .desno .okno {
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
  .odprto .okno {
    transform: none;
  }
}
</style>
