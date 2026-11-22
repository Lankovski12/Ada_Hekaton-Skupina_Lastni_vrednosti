<script setup lang="ts">
// Domača stran za starše in otroke: najprej odgovori na vprašanje »Kakšen zrak dihaš zdaj?«
// (številka, ocena in en nasvet: kdaj ven in kdaj prezračiti), z oznako meritev / model / ocena.
// Pljuča iz pik dihajo današnji zrak; klik nanje odpre štiri okenca (Igre, Zemljevid, Podatki, Moj zrak).
// Ko so okenca enkrat odprta, ostanejo odprta tudi ob vrnitvi na to stran (do zaprtja zavihka brskalnika).
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
// pljuča so zelena; kakovost zraka pokaže hitrost dihanja in število delcev okoli (gumb »Dodaj smog« jih počasi obarva rjavo)
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
  if (stopnja <= 1) return { text: 'Lep čas za ven in zračenje.', vrsta: null }
  if (!naj) return { text: 'Ven za krajši čas, zračite na kratko.', vrsta: null }
  if (naj === dan[0] && ure[0]?.h === naj.h) return { text: 'Zdaj je najčistejša ura dneva.', vrsta }
  return { text: `Najčistejši zrak bo ob ${hh(naj.h)}.`, vrsta }
})

// okenca: ob prvem obisku zaprta; ko jih odpreš, ostanejo odprta med premikanjem po zavihkih
const odprto = oknaOdprta

// pri odprtih okencih pljuča naredijo prostor ob straneh, da se nič ne prekriva
const sirina = ref(typeof window !== 'undefined' ? window.innerWidth : 1200)
const onResize = () => (sirina.value = window.innerWidth)
onMounted(() => window.addEventListener('resize', onResize))
onBeforeUnmount(() => window.removeEventListener('resize', onResize))

// --- gumb »Dodaj smog«: stran se počasi zamegli kot Ljubljana ob inverziji, pljuča počasi potemnijo ---
// Za primer vzamemo resničen najslabši dan iz meritev ARSO (public/assets/terrain/slabi_dnevi.json).
const smogVklopljen = ref(false)
const smog = ref(0) // 0 = čist zrak, 1 = poln smog (gladko animirano)
const slabDan = ref<{ datum: string; pm25: number } | null>(null)
const ZELENA = [0x4e, 0x9f, 0x35]
const RJAVA = [0x4a, 0x36, 0x28] // poškodovana pljuča, ki dihajo delce
let smogRaf = 0
let smogT = 0
function animirajSmog(ms: number) {
  const dt = smogT ? (ms - smogT) / 1000 : 0
  smogT = ms
  // megla se nabira počasi (~12 s), razkadi pa hitreje (~4 s)
  const cilj = smogVklopljen.value ? 1 : 0
  const korak = dt / (smogVklopljen.value ? 12 : 4)
  smog.value = cilj > smog.value ? Math.min(cilj, smog.value + korak) : Math.max(cilj, smog.value - korak)
  if (smog.value !== cilj) smogRaf = requestAnimationFrame(animirajSmog)
  else smogT = 0
}
async function preklopiSmog() {
  smogVklopljen.value = !smogVklopljen.value
  if (!slabDan.value) {
    try {
      const dnevi: { datum: string; pm25: number }[] = await (
        await fetch(`${import.meta.env.BASE_URL}assets/terrain/slabi_dnevi.json`)
      ).json()
      slabDan.value = dnevi.reduce((a, b) => (b.pm25 > a.pm25 ? b : a))
    } catch {
      slabDan.value = { datum: '2022-01-17', pm25: 70.7 }
    }
  }
  cancelAnimationFrame(smogRaf)
  smogT = 0
  smogRaf = requestAnimationFrame(animirajSmog)
}
onBeforeUnmount(() => cancelAnimationFrame(smogRaf))
const barvaPljuc = computed(() => {
  const k = smog.value
  const c = ZELENA.map((v, i) => Math.round(v + (RJAVA[i]! - v) * k))
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`
})
const pmPljuc = computed(() => pm.value + ((slabDan.value?.pm25 ?? 70) - pm.value) * smog.value)
const MESECI_RODILNIK = ['januarja', 'februarja', 'marca', 'aprila', 'maja', 'junija', 'julija', 'avgusta', 'septembra', 'oktobra', 'novembra', 'decembra']
const slabDatum = computed(() => {
  if (!slabDan.value) return ''
  const [y, m, d] = slabDan.value.datum.split('-').map(Number)
  return `${d}. ${MESECI_RODILNIK[m! - 1]} ${y}`
})
const rezerva = computed(() => {
  const w = sirina.value
  if (!odprto.value || w <= 720) return 0
  const stolpec = Math.min(300, Math.max(230, w * 0.24))
  return stolpec + Math.max(24, w * 0.04) + 28
})

// okenca: dve na levi, dve na desni (besedila bomo še spreminjali)
const okna = [
  {
    to: '/igre',
    kicker: 'Igraj',
    title: 'Igre',
    text: 'Pomagaj zmajčku očistiti Ljubljano in preveri svoje znanje',
    color: 'var(--mint)',
    ikona: 'igre',
    pos: 'l1',
  },
  {
    to: '/zemljevid',
    kicker: 'Raziskuj',
    title: 'Zemljevid',
    text: 'Razišči zemljevid in si oglej malo drugačno Ljubljano',
    color: 'var(--accent)',
    ikona: 'zemljevid',
    pos: 'l2',
  },
  {
    to: '/grafi',
    kicker: 'Poglej',
    title: 'Podatki',
    text: 'Zakaj nastane megle in kaj kaže 10 let meritev ARSO.',
    color: 'var(--brand)',
    ikona: 'podatki',
    pos: 'r1',
  },
  {
    to: '/moj-zrak',
    kicker: 'Zame',
    title: 'Moj zrak',
    text: 'Poglej si kakšen zrak dihaš sedaj',
    color: 'var(--coral)',
    ikona: 'moj',
    pos: 'r2',
  },
]
</script>

<template>
  <div class="landing" :class="{ odprto }" :style="{ '--lvl': level.color }">
    <!-- smog: plast se dviga od dna, kot hladen onesnažen zrak na dnu kotline.
         Gosta plast je za pljuči, pred njimi le tanka tančica, da se vidi, kako pljuča potemnijo. -->
    <div class="smog" :style="{ '--s': smog }" aria-hidden="true">
      <span v-for="i in 7" :key="i" class="krpa" :class="`k${i}`" />
    </div>
    <PljucaPike class="scena" :pm25="pmPljuc" :color="barvaPljuc" :rezerva="rezerva" @klik="odprto = !odprto" />
    <div class="smog tancica" :style="{ '--s': smog }" aria-hidden="true">
      <span v-for="i in 3" :key="i" class="krpa" :class="`k${i + 3}`" />
    </div>

    <!-- pod pljuči: gumb za smog in napis, kateri resnični dan kaže -->
    <div class="smog-ctrl">
      <Transition name="napis">
        <p v-if="smog > 0.6 && slabDan" class="smog-napis">
          Tak zrak je Ljubljana dihala {{ slabDatum }}: {{ Math.round(slabDan.pm25) }} µg/m³ PM2.5
          <VirZnacka vrsta="meritev" />
        </p>
      </Transition>
      <button class="smog-gumb" :class="{ on: smogVklopljen }" :aria-pressed="smogVklopljen" @click="preklopiSmog">
        <span class="tocka" aria-hidden="true" />
        {{ smogVklopljen ? 'Očisti zrak' : 'Dodaj smog' }}
      </button>
    </div>

    <header class="naslov">
      <span class="znamka">Zrak, ki ga dihamo · Ljubljana</span>
      <h1>Zrak, ki ga dihamo</h1>
      <!-- trenutna meritev: brez okvirja, ena vrstica stanja in kratek nasvet -->
      <div class="odgovor">
        <p
          class="stanje"
          :title="izmerjeno ? 'Meritev ARSO, zadnja ura' : `Običajno ob tej uri (povprečje meritev ${klimaLabel})`"
        >
          <span class="pika" />
          <span class="lvl">{{ level.label }}</span>
          <span class="loc" aria-hidden="true">·</span>
          <span class="st">{{ Math.round(pm) }} <small>µg/m³</small></span>
          <VirZnacka :vrsta="izmerjeno ? 'meritev' : 'ocena'" />
        </p>
        <p class="nasvet">
          {{ nasvet.text }}
          <RouterLink to="/moj-zrak" class="vec">Moj zrak →</RouterLink>
        </p>
      </div>
      <p class="hint">{{ odprto ? '' : 'Klikni na pljuča' }}</p>
    </header>

    <nav class="okna" aria-label="Kam naprej">
      <div class="stolpec levo">
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
  text-align: center;
}
.odgovor p {
  margin: 0;
}
.stanje {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--scene-text);
}
.stanje .lvl {
  font-family: var(--font-head);
  font-weight: 800;
  font-size: 1.2rem;
  color: color-mix(in srgb, var(--lvl) 75%, var(--scene-ink));
}
.stanje .loc {
  color: var(--scene-muted);
}
.stanje .st {
  font-family: var(--font-head);
  font-size: 1.2rem;
  color: var(--scene-ink);
}
.stanje .st small {
  font-family: var(--font-body, inherit);
  font-size: 0.8rem;
  color: var(--scene-muted);
}
.nasvet {
  margin-top: 2px !important;
  color: var(--scene-muted);
  font-weight: 600;
  font-size: 0.92rem;
}
.vec {
  margin-left: 6px;
  white-space: nowrap;
  color: var(--scene-muted);
  font-weight: 800;
  text-decoration: none;
  border-bottom: 1px solid currentColor;
}
.vec:hover {
  color: var(--scene-ink);
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
.smog-ctrl {
  position: absolute;
  left: 0;
  right: 0;
  bottom: max(18px, 3vh);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 0 16px;
  pointer-events: none;
}
.smog-gumb {
  pointer-events: auto;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 9px 20px;
  border-radius: 999px;
  border: 1px solid var(--panel-line);
  background: var(--panel);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  color: var(--scene-ink);
  font: inherit;
  font-weight: 700;
  font-size: 0.92rem;
  letter-spacing: 0.01em;
  cursor: pointer;
  box-shadow: 0 8px 24px -14px rgba(31, 45, 77, 0.45);
  transition:
    transform 0.35s cubic-bezier(0.22, 1, 0.36, 1),
    box-shadow 0.35s ease,
    background-color 0.6s ease,
    color 0.6s ease,
    border-color 0.6s ease;
}
.smog-gumb:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 28px -14px rgba(31, 45, 77, 0.55);
}
.smog-gumb:active {
  transform: translateY(0) scale(0.98);
}
.smog-gumb .tocka {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #b5a68f;
  box-shadow: 0 0 0 4px color-mix(in srgb, #b5a68f 25%, transparent);
  transition: background-color 0.6s ease, box-shadow 0.6s ease;
}
.smog-gumb.on {
  background: color-mix(in srgb, #5b4a3a 88%, transparent);
  border-color: transparent;
  color: #fff;
}
.smog-gumb.on .tocka {
  background: #8ccf3f;
  box-shadow: 0 0 0 4px rgba(140, 207, 63, 0.25);
}
.smog-napis {
  max-width: 560px;
  margin: 0;
  padding: 6px 16px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--panel) 80%, transparent);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  color: var(--scene-ink);
  font-weight: 700;
  font-size: 0.85rem;
  text-align: center;
}
.napis-enter-active,
.napis-leave-active {
  transition: opacity 0.8s ease, transform 0.8s ease;
}
.napis-enter-from,
.napis-leave-to {
  opacity: 0;
  transform: translateY(6px);
}

/* --- smog: plast se dviga od dna zaslona, krpe megle se počasi premikajo --- */
.smog {
  --s: 0;
  --megla: 214, 206, 192;
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: calc(var(--s) * 92%);
  pointer-events: none;
  opacity: min(1, calc(var(--s) * 1.6));
  background: linear-gradient(
    to top,
    rgba(var(--megla), 0.92) 0%,
    rgba(var(--megla), 0.78) 45%,
    rgba(var(--megla), 0.35) 80%,
    rgba(var(--megla), 0) 100%
  );
  overflow: hidden;
  /* mehak zgornji rob plasti */
  -webkit-mask-image: linear-gradient(to top, #000 75%, transparent);
  mask-image: linear-gradient(to top, #000 75%, transparent);
}
.smog.tancica {
  opacity: calc(var(--s) * 0.45);
  background: linear-gradient(to top, rgba(var(--megla), 0.5), rgba(var(--megla), 0) 70%);
}
:root[data-theme='dark'] .smog {
  --megla: 120, 112, 100;
}
.krpa {
  position: absolute;
  width: 60vw;
  height: 30vh;
  border-radius: 50%;
  background: radial-gradient(closest-side, rgba(var(--megla), 0.85), rgba(var(--megla), 0));
  filter: blur(8px);
  animation: krpa 26s ease-in-out infinite alternate;
}
.k1 { left: -20vw; top: 0; }
.k2 { left: 30vw; top: 8%; animation-duration: 34s; animation-delay: -6s; }
.k3 { left: 60vw; top: -4%; animation-duration: 30s; animation-delay: -12s; }
.k4 { left: 5vw; top: 35%; animation-duration: 38s; animation-delay: -3s; background: radial-gradient(closest-side, rgba(170, 155, 130, 0.6), transparent); }
.k5 { left: 45vw; top: 40%; animation-duration: 28s; animation-delay: -18s; }
.k6 { left: 75vw; top: 55%; animation-duration: 36s; animation-delay: -9s; background: radial-gradient(closest-side, rgba(150, 135, 112, 0.5), transparent); }
.k7 { left: 20vw; top: 65%; animation-duration: 32s; animation-delay: -15s; }
@keyframes krpa {
  from {
    transform: translateX(-6vw) scale(1);
  }
  to {
    transform: translateX(8vw) scale(1.15);
  }
}
@media (prefers-reduced-motion: reduce) {
  .krpa {
    animation: none;
  }
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
  .vec {
    display: none;
  }
  .nasvet {
    font-size: 0.85rem;
  }
  .smog-napis {
    font-size: 0.75rem;
    padding: 4px 12px;
    border-radius: 14px;
  }
  .smog-gumb {
    padding: 7px 16px;
    font-size: 0.85rem;
  }
  /* na telefonu so okenca spodaj – takrat gumb umaknemo */
  .odprto .smog-ctrl {
    opacity: 0;
    visibility: hidden;
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
