<script setup lang="ts">
// 3D igra: zmajček leti nad Ljubljano s smogom (danes ali resničen slab dan) in ga odpihuje.
// Vsa 3D logika je v ./engine, tukaj so meniji, HUD, sporočila in vprašanja (v otroškem slogu).
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import AirBuddy from '@/components/AirBuddy.vue'
import { useAirData } from '@/composables/useAirData'
import { useProgressStore } from '@/stores/progress'
import { levelFor } from '@/lib/airQuality'
import { typicalPm25 } from '@/lib/klima'
import { DEZ, DIM, GAME, LEP_DAN_PM25, VETER, VPRASANJA, vrhZaIgro } from './config'
import { type Conditions, type HudState, type PickupKind, ZmajEngine } from './engine/Game'
import { sound } from '../skupno/sound'
import Confetti from '../skupno/Confetti.vue'
import GameIcon from '../skupno/GameIcon.vue'
import { DEJSTVA, sestaviVprasanja, type Vprasanje } from './vprasanja'

const { currentPm25, scene, now, origin } = useAirData()
const progress = useProgressStore()

const host = ref<HTMLDivElement | null>(null)
const engine = shallowRef<ZmajEngine | null>(null)
const state = ref<'nalagam' | 'start' | 'igra' | 'konec'>('nalagam')
const napaka = ref('')
const nalozeno = ref(0)
const prazenHud = (): HudState => ({ casDo: GAME.trajanje, ocisceno: 0, piha: false, rob: false, vMegli: false, veter: 0 })
const hud = ref<HudState>(prazenHud())
const rezultat = ref(0)
const zvok = ref(sound.enabled)

// Današnje stanje iz API-ja (ali demo, če zaledje ne teče).
// Za predstavitev lahko stanje povoziš v naslovu: /igre/zmaj?pm=70&megla=1&vrh=500
const route = useRoute()
const q = (k: string) => (typeof route.query[k] === 'string' ? (route.query[k] as string) : undefined)
const danes = computed<Conditions>(() => {
  const h = scene.value?.ure[0]
  const pm = q('pm') ? Number(q('pm')) : (currentPm25.value ?? h?.pm25 ?? typicalPm25())
  return {
    pm25: pm,
    vrhPlastiM: q('vrh') ? Number(q('vrh')) : (h?.visina_megle_m ?? 360),
    inverzija: q('vrh') ? true : (h?.inverzija ?? true),
    megla: q('megla') ? q('megla') === '1' : (h?.megla ?? false),
  }
})
const povozeno = computed(() => !!(q('pm') || q('megla') || q('vrh')))

// Resnični slabi dnevi iz zgodovine ARSO (public/assets/terrain/slabi_dnevi.json)
interface SlabDan { datum: string; pm25: number; vrh_m: number; visina_mesanja_m: number }
const slabiDnevi = ref<SlabDan[]>([])
const izbran = ref<SlabDan | null>(null)
const lepDan = computed(() => !danes.value.megla && danes.value.pm25 < LEP_DAN_PM25)
const naDanes = ref(false) // igralec lahko vseeno izbere današnji (čist) zrak
const zgodovina = computed(() => lepDan.value && !naDanes.value && izbran.value != null)

function izberiSlabDan() {
  const d = slabiDnevi.value
  if (d.length) izbran.value = d[Math.floor(Math.random() * d.length)]!
}
const datumSl = (iso: string) => new Date(iso).toLocaleDateString('sl-SI', { day: 'numeric', month: 'long', year: 'numeric' })

const conditions = computed<Conditions>(() => {
  const c = zgodovina.value
    ? { pm25: izbran.value!.pm25, vrhPlastiM: izbran.value!.vrh_m, inverzija: true, megla: false }
    : danes.value
  // plast mora biti dovolj debela, da zmaj leti skozi njo
  return { ...c, vrhPlastiM: vrhZaIgro(c.vrhPlastiM) }
})
const level = computed(() => levelFor(conditions.value.pm25))
const pravi = computed(() => origin.value === 'api' && (now.value?.postaje.some((p) => p.vir === 'meritev') ?? false))

// --- kartica dneva ---
const WHO = 15
const kartica = computed(() => {
  const pm = Math.round(conditions.value.pm25)
  return {
    datum: zgodovina.value ? datumSl(izbran.value!.datum) : 'Danes',
    pm,
    krat: pm > WHO ? `${Math.round(pm / WHO)}-krat` : 'v redu',
    inverzija: conditions.value.inverzija,
    plast: zgodovina.value ? izbran.value!.visina_mesanja_m : null,
    megla: conditions.value.megla,
  }
})

// --- sporočila in točke med igro ---
const toast = ref<{ naslov: string; besedilo: string; vrsta: string; tocke: string } | null>(null)
let toastTimer: number | undefined
const naucil = ref(new Set<string>()) // kaj je otrok srečal – pokažemo na koncu
const popups = ref<{ id: number; text: string; good: boolean }[]>([])
let popupId = 0

function popup(text: string, good: boolean) {
  const id = ++popupId
  popups.value.push({ id, text, good })
  window.setTimeout(() => (popups.value = popups.value.filter((p) => p.id !== id)), 1400)
}

function onPickup(kind: Exclude<PickupKind, 'vprasanje'>) {
  const d = DEJSTVA[kind]
  const tocke = kind === 'dez' ? `+${Math.round(DEZ.bonus * 100)} %` : kind === 'dim' ? `−${Math.round(DIM.kazen * 100)} %` : 'Hitreje!'
  toast.value = { naslov: d.naslov, besedilo: d.besedilo, vrsta: kind, tocke }
  if (kind !== 'veter') popup(tocke, kind === 'dez')
  naucil.value.add(d.besedilo)
  window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => (toast.value = null), 3800)
}

// sunek vetra: velik napis ob začetku
const boostKey = ref(0)
watch(
  () => hud.value.veter > 0,
  (on) => {
    if (on) boostKey.value++
  },
)

// --- vprašanja ---
const vprasanja = ref<Vprasanje[]>([])
const trenutno = ref<Vprasanje | null>(null)
const odgovor = ref<number | null>(null)
const pravilni = ref(0)
const postavljena = ref(0)
const konfeti = ref(0)
const ODGOVOR_BARVE = ['yellow', 'blue', 'pink']
const ODGOVOR_CRKE = ['A', 'B', 'C']

function onQuestion() {
  trenutno.value = vprasanja.value[postavljena.value % vprasanja.value.length] ?? null
  odgovor.value = null
  if (!trenutno.value) engine.value?.answer(false)
}
function odgovori(i: number) {
  if (odgovor.value != null || !trenutno.value) return
  odgovor.value = i
  if (i === trenutno.value.pravilen) {
    pravilni.value++
    konfeti.value++
    sound.correct()
  } else sound.wrong()
}
function naprej() {
  const v = trenutno.value
  if (!v) return
  const ok = odgovor.value === v.pravilen
  naucil.value.add(v.razlaga)
  postavljena.value++
  if (ok) popup(`+${VPRASANJA.bonusCas} s`, true)
  engine.value?.answer(ok)
  trenutno.value = null
}

// --- konec ---
const zvezdice = computed(() => (rezultat.value >= 55 ? 3 : rezultat.value >= 30 ? 2 : rezultat.value >= 12 ? 1 : 0))
const sporocilo = computed(() =>
  ['Smog je trdovraten! Poskusi še enkrat.', 'Dober začetek!', 'Super pilot!', 'Prvak čistega neba!'][zvezdice.value],
)

onMounted(async () => {
  if (!host.value) return
  const e = new ZmajEngine(host.value, {
    onHud: (s) => (hud.value = s),
    onEnd: (o) => {
      rezultat.value = Math.round(o * 100)
      progress.addPoints('zmaj', rezultat.value)
      trenutno.value = null
      state.value = 'konec'
      sound.end(zvezdice.value >= 2)
      if (zvezdice.value >= 2) konfeti.value++
    },
    onPickup,
    onQuestion,
  })
  try {
    slabiDnevi.value = await fetch(`${import.meta.env.BASE_URL}assets/terrain/slabi_dnevi.json`)
      .then((r) => r.json())
      .catch(() => [])
    izberiSlabDan()
    await e.load((p) => (nalozeno.value = Math.round(p * 100)))
    e.setConditions(conditions.value)
    engine.value = e
    if (q('debug')) (window as unknown as { __zmaj: ZmajEngine }).__zmaj = e // za teste
    state.value = 'start'
  } catch (err) {
    napaka.value = 'Igre ni bilo mogoče naložiti (WebGL ali datoteke).'
    console.error(err)
  }
})
onBeforeUnmount(() => {
  engine.value?.dispose()
  window.clearTimeout(toastTimer)
})

function zamenjaj(naDanasnji: boolean) {
  naDanes.value = naDanasnji
  if (!naDanasnji) izberiSlabDan()
  engine.value?.setConditions(conditions.value)
}

function preklopiZvok() {
  sound.unlock()
  zvok.value = !zvok.value
  sound.setEnabled(zvok.value)
}

function play() {
  sound.unlock()
  sound.pop()
  vprasanja.value = sestaviVprasanja({
    pm25: conditions.value.pm25,
    datum: zgodovina.value ? izbran.value!.datum : undefined,
    inverzija: conditions.value.inverzija,
    visinaMesanjaM: zgodovina.value ? izbran.value!.visina_mesanja_m : undefined,
  })
  pravilni.value = 0
  postavljena.value = 0
  naucil.value = new Set()
  toast.value = null
  trenutno.value = null
  popups.value = []
  engine.value?.setConditions(conditions.value)
  engine.value?.start()
  hud.value = prazenHud()
  state.value = 'igra'
}
</script>

<template>
  <div class="game">
    <div ref="host" class="canvas-host" />
    <Confetti v-if="konfeti" :key="konfeti" />

    <button class="sound-btn" :aria-label="zvok ? 'Izklopi zvok' : 'Vklopi zvok'" @click="preklopiZvok">
      <GameIcon :name="zvok ? 'zvok' : 'tiho'" :size="26" />
    </button>

    <!-- HUD med igro -->
    <template v-if="state === 'igra'">
      <div class="hud top-left">
        <div class="timer" :class="{ low: hud.casDo < 10 }">
          <GameIcon name="ura" :size="30" />
          <span>{{ Math.ceil(hud.casDo) }}</span>
        </div>
        <div class="sky">
          <div class="sky-label">Čisto nebo</div>
          <div class="sky-bar">
            <div class="sky-fill" :style="{ width: `${hud.ocisceno * 100}%` }" />
            <span class="sky-pct">{{ Math.round(hud.ocisceno * 100) }} %</span>
          </div>
          <div class="popups">
            <span v-for="p in popups" :key="p.id" class="popup" :class="p.good ? 'good' : 'bad'">{{ p.text }}</span>
          </div>
        </div>
      </div>
      <div class="hud top-right">
        <span v-if="zgodovina" class="chip">{{ datumSl(izbran!.datum) }}</span>
        <span class="chip strong" :style="{ background: level.color }">{{ Math.round(conditions.pm25) }} µg/m³</span>
        <span class="chip q">
          <GameIcon name="vprasaj" :size="20" /> {{ pravilni }}/{{ VPRASANJA.kdaj.length }}
        </span>
      </div>

      <!-- sunek vetra -->
      <div v-if="hud.veter > 0" class="boost-edge" aria-hidden="true" />
      <div v-if="hud.veter > 0" :key="boostKey" class="boost-banner">Sunek vetra!</div>
      <div v-if="hud.veter > 0" class="boost-bar">
        <GameIcon name="veter" :size="24" />
        <div class="bar"><div :style="{ width: `${(hud.veter / VETER.trajanje) * 100}%` }" /></div>
      </div>

      <Transition name="pop">
        <div v-if="toast" :key="toast.besedilo" class="toast" :class="toast.vrsta">
          <GameIcon :name="toast.vrsta === 'dez' ? 'oblak' : toast.vrsta === 'dim' ? 'dimnik' : 'veter'" :size="44" />
          <div>
            <strong>{{ toast.naslov }} <em>{{ toast.tocke }}</em></strong>
            <span>{{ toast.besedilo }}</span>
          </div>
        </div>
      </Transition>

      <div v-if="hud.rob && !trenutno" class="warn">Obračam nazaj nad Ljubljano!</div>
      <div class="hint">Miška usmerja · <strong>drži levi gumb</strong> za pihanje</div>

      <!-- vprašanje -->
      <div v-if="trenutno" class="overlay quiz-wrap">
        <div class="quiz" :class="{ solved: odgovor != null && odgovor === trenutno.pravilen, missed: odgovor != null && odgovor !== trenutno.pravilen }">
          <div class="quiz-head">
            <AirBuddy :mood="odgovor != null && odgovor !== trenutno.pravilen ? 0.6 : 0" color="#7cc8ff" :size="110" />
            <div class="bubble">
              <span class="qnum">Vprašanje {{ postavljena + 1 }} od {{ VPRASANJA.kdaj.length }}</span>
              <p>{{ trenutno.vprasanje }}</p>
            </div>
          </div>
          <div class="answers">
            <button
              v-for="(m, i) in trenutno.moznosti"
              :key="m"
              class="answer"
              :class="[
                ODGOVOR_BARVE[i],
                { correct: odgovor != null && i === trenutno.pravilen, wrong: odgovor === i && i !== trenutno.pravilen, dim: odgovor != null && i !== trenutno.pravilen && odgovor !== i },
              ]"
              :style="{ animationDelay: `${i * 0.08}s` }"
              :disabled="odgovor != null"
              @click="odgovori(i)"
            >
              <span class="letter">{{ ODGOVOR_CRKE[i] }}</span>
              <span>{{ m }}</span>
            </button>
          </div>
          <div v-if="odgovor != null" class="result">
            <div class="stamp" :class="odgovor === trenutno.pravilen ? 'ok' : 'no'">
              {{ odgovor === trenutno.pravilen ? 'Super!' : 'Skoraj!' }}
              <small v-if="odgovor === trenutno.pravilen">+{{ VPRASANJA.bonusCas }} s in sunek vetra</small>
            </div>
            <p class="explain">{{ trenutno.razlaga }}</p>
            <button class="big-btn green" @click="naprej">Leti naprej</button>
          </div>
        </div>
      </div>
    </template>

    <!-- Nalaganje -->
    <div v-if="state === 'nalagam'" class="overlay">
      <p v-if="napaka" class="card">{{ napaka }}</p>
      <div v-else class="loading">
        <AirBuddy :mood="0" color="#7cc8ff" :size="140" />
        <div class="load-bar"><div :style="{ width: `${nalozeno}%` }" /></div>
        <p>Nalagam Ljubljano …</p>
      </div>
    </div>

    <!-- Začetek -->
    <div v-else-if="state === 'start'" class="overlay">
      <div class="card menu">
        <RouterLink to="/igre" class="back">Nazaj na igre</RouterLink>
        <span class="kicker">Igra · 3D Ljubljana</span>
        <h1 class="title">Zmajček <span>čisti nebo</span></h1>

        <p v-if="zgodovina" class="intro">
          Danes je zrak čist! Zato letiš nad <strong>resničnim smogom</strong> iz preteklosti.
        </p>

        <div class="tiles">
          <div class="tile t-blue">
            <span class="label">Dan</span>
            <strong>{{ kartica.datum }}</strong>
          </div>
          <div class="tile t-red" :style="{ '--lvl': level.color }">
            <span class="label">Smog</span>
            <strong class="lvl">{{ kartica.pm }}</strong>
            <span class="sub">µg/m³ · {{ level.label.toLowerCase() }}</span>
          </div>
          <div class="tile t-yellow">
            <span class="label">Preveč</span>
            <strong>{{ kartica.krat }}</strong>
            <span class="sub">{{ kartica.pm > 15 ? 'več kot je zdravo' : 'zrak je zdrav' }}</span>
          </div>
          <div class="tile t-purple">
            <span class="label">Pokrovka</span>
            <strong>{{ kartica.inverzija ? 'Da' : 'Ne' }}</strong>
            <span v-if="kartica.plast" class="sub">smog ujet pod {{ kartica.plast }} m</span>
          </div>
        </div>

        <details class="why">
          <summary>Kaj je pokrovka (inverzija)?</summary>
          <p>
            Pozimi se hladen zrak ujame na dnu kotline, nad njim pa leži toplejši zrak kot pokrovka na loncu.
            Dim iz peči in avtomobilov ne more ven.
            <template v-if="kartica.plast">Ta dan je bil ujet v plasti, nižji od Nebotičnika (70 m)!</template>
          </p>
        </details>

        <div v-if="zgodovina" class="row">
          <button class="small-btn" @click="zamenjaj(false)">Drug dan</button>
          <button class="small-btn" @click="zamenjaj(true)">Današnji zrak</button>
        </div>
        <button v-else-if="lepDan" class="small-btn" @click="zamenjaj(false)">Raje dan s smogom</button>
        <p v-if="povozeno" class="demo">Stanje je nastavljeno v naslovu strani (?pm=…).</p>
        <p v-else-if="!pravi" class="demo">Demo podatki: zaledje ali ARSO trenutno ni dosegljiv.</p>

        <div class="legend">
          <div><GameIcon name="smog" :size="40" /><span><strong>Smog</strong> odpihni z levim gumbom</span></div>
          <div><GameIcon name="oblak" :size="40" /><span><strong>Oblaček</strong> prinese dež: +{{ Math.round(DEZ.bonus * 100) }} %</span></div>
          <div><GameIcon name="obroc" :size="40" /><span><strong>Obroč vetra</strong>: hitrost!</span></div>
          <div><GameIcon name="dimnik" :size="40" /><span><strong>Dimnik</strong>: pazi, −{{ Math.round(DIM.kazen * 100) }} %</span></div>
          <div><GameIcon name="vprasaj" :size="40" /><span><strong>Vprašaj</strong>: odgovori, +{{ VPRASANJA.bonusCas }} s</span></div>
        </div>

        <button class="big-btn green pulse" @click="play">Poleti!</button>
        <p class="credits">Teren: Copernicus DEM, Sentinel-2 (EOX) · Stavbe: GURS · Smog in meritve: ARSO · Radiosondaža: NOAA IGRA2</p>
      </div>
    </div>

    <!-- Konec -->
    <div v-else-if="state === 'konec'" class="overlay">
      <div class="card menu end">
        <div class="stars">
          <GameIcon v-for="i in 3" :key="i" name="zvezda" :size="72" class="star" :class="{ on: i <= zvezdice }" :style="{ animationDelay: `${0.2 + i * 0.25}s` }" />
        </div>
        <h1 class="title small">{{ sporocilo }}</h1>
        <div class="score">
          <div><strong>{{ rezultat }} %</strong><span>čistega neba</span></div>
          <div><strong>{{ pravilni }}/{{ postavljena }}</strong><span>pravilnih odgovorov</span></div>
          <div><strong>{{ progress.najboljse.zmaj ?? 0 }} %</strong><span>tvoj rekord</span></div>
        </div>
        <div v-if="naucil.size" class="learned">
          <h3>Kaj si se naučil</h3>
          <ul>
            <li v-for="t in naucil" :key="t">{{ t }}</li>
          </ul>
        </div>
        <p class="tip">
          V resnici smog odpihne <strong>veter</strong> ali spere <strong>dež</strong>. Pomagamo tudi mi: manj kurjenja z drvmi in več avtobusa ali kolesa.
        </p>
        <div class="row">
          <button class="big-btn green" @click="play">Še enkrat</button>
          <RouterLink to="/igre" class="big-btn blue">Druge igre</RouterLink>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.game {
  --k-yellow: #ffc22e;
  --k-blue: #3fa9f5;
  --k-pink: #ff6fa5;
  --k-green: #3ccf6e;
  --k-purple: #9b6bff;
  --k-ink: #1d3557;
  position: fixed;
  top: 64px;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 15;
  background: var(--bg); /* svetla shema strani; med nalaganjem kremno, ne temno */
  overflow: hidden;
  user-select: none;
  -webkit-user-select: none;
  font-family: var(--font-head);
}
.canvas-host {
  position: absolute;
  inset: 0;
  cursor: crosshair;
}

/* --- gumbi --- */
.big-btn,
.small-btn {
  border: 0;
  font-family: var(--font-head);
  font-weight: 800;
  color: #fff;
  cursor: pointer;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.1s;
}
.big-btn {
  min-height: 60px;
  padding: 10px 36px;
  border-radius: 999px;
  font-size: 1.6rem;
  letter-spacing: 0.02em;
  text-shadow: 0 2px 0 rgba(0, 0, 0, 0.15);
}
.big-btn:active,
.small-btn:active {
  transform: translateY(4px);
}
.big-btn.green {
  background: var(--k-green);
  box-shadow: 0 6px 0 #26a052;
}
.big-btn.blue {
  background: var(--k-blue);
  box-shadow: 0 6px 0 #2479bd;
}
.big-btn.pulse {
  animation: pulse 1.2s ease-in-out infinite;
}
.small-btn {
  min-height: 42px;
  padding: 6px 18px;
  border-radius: 999px;
  font-size: 1rem;
  background: var(--k-purple);
  box-shadow: 0 4px 0 #7146d6;
}
.sound-btn {
  position: absolute;
  bottom: 14px;
  right: 14px;
  z-index: 30;
  width: 52px;
  height: 52px;
  border-radius: 50%;
  border: 3px solid #fff;
  background: var(--k-blue);
  color: #fff;
  display: grid;
  place-items: center;
  box-shadow: 0 4px 0 #2479bd;
  cursor: pointer;
}

/* --- HUD --- */
.hud {
  position: absolute;
  z-index: 2;
  display: flex;
  gap: 10px;
  pointer-events: none;
}
.top-left {
  top: 12px;
  left: 12px;
  align-items: flex-start;
}
.top-right {
  top: 12px;
  right: 12px;
  flex-wrap: wrap;
  justify-content: flex-end;
  max-width: 45%;
}
.timer {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 16px 4px 8px;
  border-radius: 999px;
  background: #fff;
  border: 4px solid var(--k-blue);
  color: var(--k-blue);
  font-size: 1.8rem;
  font-weight: 800;
  line-height: 1;
  transform-origin: left center; /* utripanje ne gre čez rob zaslona */
}
.timer span {
  color: var(--k-ink);
  min-width: 2ch;
}
.timer.low {
  border-color: #e5484d;
  color: #e5484d;
  animation: blink 0.5s ease-in-out infinite alternate;
}
.timer.low span {
  color: #e5484d;
}
.sky {
  position: relative;
  padding: 6px 12px 10px;
  border-radius: 20px;
  background: #fff;
  border: 4px solid var(--k-green);
  min-width: 220px;
}
.sky-label {
  font-size: 0.85rem;
  font-weight: 800;
  color: var(--k-ink);
}
.sky-bar {
  position: relative;
  height: 22px;
  border-radius: 999px;
  background: #e6edf3;
  overflow: hidden;
}
.sky-fill {
  height: 100%;
  border-radius: 999px;
  background: repeating-linear-gradient(-45deg, #4cd964 0 12px, #3ccf6e 12px 24px);
  transition: width 0.2s ease-out;
}
.sky-pct {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  font-weight: 800;
  color: var(--k-ink);
}
.popups {
  position: absolute;
  left: 100%;
  top: 0;
  margin-left: 8px;
}
.popup {
  position: absolute;
  white-space: nowrap;
  font-size: 1.8rem;
  font-weight: 800;
  -webkit-text-stroke: 1.5px #fff;
  animation: floatUp 1.4s ease-out forwards;
}
.popup.good {
  color: var(--k-green);
}
.popup.bad {
  color: #e5484d;
}
.chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.92);
  color: var(--k-ink);
  font-weight: 800;
  font-size: 0.9rem;
}
.chip.strong {
  color: #fff;
}

/* --- sunek vetra --- */
.boost-edge {
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  background: radial-gradient(ellipse at center, transparent 55%, rgba(160, 230, 255, 0.45) 100%);
  animation: edge 0.4s ease-in-out infinite alternate;
}
.boost-banner {
  position: absolute;
  top: 44%;
  left: 50%;
  z-index: 3;
  font-size: clamp(2.4rem, 8vw, 4.6rem);
  font-weight: 800;
  color: #fff;
  -webkit-text-stroke: 3px var(--k-blue);
  text-shadow: 0 6px 0 rgba(36, 121, 189, 0.5);
  white-space: nowrap;
  pointer-events: none;
  animation: banner 1.3s ease-out forwards;
}
.boost-bar {
  position: absolute;
  bottom: 70px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.9);
  pointer-events: none;
}
.boost-bar .bar {
  width: 160px;
  height: 12px;
  border-radius: 999px;
  background: #d8eefb;
  overflow: hidden;
}
.boost-bar .bar div {
  height: 100%;
  background: var(--k-blue);
  transition: width 0.1s linear;
}

/* --- sporočila --- */
.toast {
  position: absolute;
  top: 16%;
  left: 50%;
  transform: translateX(-50%);
  z-index: 3;
  display: flex;
  align-items: center;
  gap: 12px;
  max-width: min(560px, 92%);
  padding: 12px 20px 12px 14px;
  border-radius: 24px;
  background: #fff;
  border: 4px solid var(--k-blue);
  color: var(--k-ink);
  box-shadow: 0 6px 0 rgba(0, 0, 0, 0.15);
  pointer-events: none;
  font-family: var(--font-body);
}
.toast strong {
  display: block;
  font-family: var(--font-head);
  font-size: 1.5rem;
  line-height: 1.1;
}
.toast em {
  font-style: normal;
  color: var(--k-green);
}
.toast.dim {
  border-color: #e5484d;
}
.toast.dim em {
  color: #e5484d;
}
.toast.veter em {
  color: var(--k-blue);
}
.pop-enter-active {
  animation: popIn 0.4s cubic-bezier(0.2, 1.6, 0.4, 1);
}
.pop-leave-active {
  transition: opacity 0.25s;
}
.pop-leave-to {
  opacity: 0;
}
.warn {
  position: absolute;
  top: 34%;
  left: 50%;
  transform: translateX(-50%);
  z-index: 2;
  padding: 10px 20px;
  border-radius: 999px;
  background: #e5484d;
  color: #fff;
  font-weight: 800;
  font-size: 1.2rem;
  pointer-events: none;
}
.hint {
  position: absolute;
  bottom: 18px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 2;
  padding: 8px 18px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.9);
  color: var(--k-ink);
  font-size: 0.95rem;
  white-space: nowrap;
  pointer-events: none;
}

/* --- prekrivni zasloni --- */
.overlay {
  position: absolute;
  inset: 0;
  z-index: 5;
  display: grid;
  place-items: center;
  padding: 12px;
  background: linear-gradient(180deg, rgba(248, 245, 238, 0.25), rgba(248, 245, 238, 0.7));
  color: var(--k-ink);
  text-align: center;
  overflow-y: auto;
}
.card {
  width: min(680px, 100%);
  max-height: calc(100% - 8px);
  overflow-y: auto;
  padding: 22px 24px 18px;
  border-radius: 32px;
  background: #fff;
  border: 6px solid #fff;
  box-shadow: 0 10px 0 rgba(0, 0, 0, 0.18), inset 0 0 0 4px #e3f2ff;
  animation: popIn 0.45s cubic-bezier(0.2, 1.6, 0.4, 1);
}
.back {
  display: inline-block;
  color: var(--brand);
  font-weight: 800;
  text-decoration: none;
  margin-bottom: 4px;
}
.kicker {
  display: block;
  margin-bottom: 4px;
  text-transform: uppercase;
  letter-spacing: 0.2em;
  font-size: 0.75rem;
  font-weight: 800;
  color: color-mix(in srgb, var(--mint) 70%, var(--ink));
}
.title {
  margin: 0 0 8px;
  font-size: clamp(2.2rem, 6vw, 3.2rem);
  line-height: 1;
  color: var(--ink);
}
.title span {
  color: color-mix(in srgb, var(--mint) 80%, var(--ink));
}
.title.small {
  font-size: clamp(1.8rem, 5vw, 2.6rem);
}
.intro {
  font-family: var(--font-body);
  font-size: 1.1rem;
  margin: 4px 0 10px;
}
.tiles {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  margin: 10px 0;
}
.tile {
  display: grid;
  gap: 2px;
  align-content: start;
  padding: 10px 8px;
  border-radius: 20px;
  color: #fff;
  box-shadow: 0 5px 0 rgba(0, 0, 0, 0.15);
}
.tile .label {
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  opacity: 0.9;
}
.tile strong {
  font-size: 1.5rem;
  line-height: 1.05;
}
.tile .sub {
  font-family: var(--font-body);
  font-weight: 700;
  font-size: 0.82rem;
}
.t-blue {
  background: var(--k-blue);
}
.t-red {
  background: #ff7a59;
}
.t-red .lvl {
  font-size: 2.2rem;
}
.t-yellow {
  background: var(--k-yellow);
  color: #6b4800;
}
.t-purple {
  background: var(--k-purple);
}
.why {
  margin: 6px 0 10px;
  font-family: var(--font-body);
  text-align: left;
  background: #f1f8ff;
  border-radius: 16px;
  padding: 8px 14px;
}
.why summary {
  cursor: pointer;
  font-family: var(--font-head);
  font-weight: 800;
  color: var(--k-blue);
}
.why p {
  margin: 6px 0 2px;
}
.row {
  display: flex;
  gap: 12px;
  justify-content: center;
  flex-wrap: wrap;
  margin: 8px 0;
}
.demo {
  font-family: var(--font-body);
  font-size: 0.85rem;
  color: #a15c00;
}
.legend {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
  gap: 8px;
  margin: 12px 0 18px;
  text-align: left;
}
.legend div {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 10px;
  border-radius: 16px;
  background: #f6f9fc;
  font-family: var(--font-body);
  font-size: 0.95rem;
}
.legend strong {
  font-family: var(--font-head);
}
.credits {
  margin: 12px 0 0;
  font-family: var(--font-body);
  font-size: 0.7rem;
  color: #8193a5;
}

/* --- vprašanje --- */
.quiz-wrap {
  z-index: 6;
  background: rgba(248, 245, 238, 0.6);
  backdrop-filter: blur(3px);
}
.quiz {
  width: min(620px, 100%);
  max-height: calc(100% - 8px);
  overflow-y: auto;
  padding: 18px;
  border-radius: 32px;
  background: linear-gradient(180deg, #e8f5ff, #ffffff 40%);
  border: 6px solid #fff;
  box-shadow: 0 10px 0 rgba(0, 0, 0, 0.2);
  animation: popIn 0.45s cubic-bezier(0.2, 1.6, 0.4, 1);
}
.quiz.missed {
  animation: wobble 0.4s ease;
}
.quiz-head {
  display: flex;
  align-items: center;
  gap: 8px;
  text-align: left;
}
.quiz-head :deep(svg) {
  flex: none;
}
.bubble {
  position: relative;
  flex: 1;
  padding: 12px 16px;
  border-radius: 22px;
  background: #fff;
  border: 3px solid #bfe3ff;
}
.bubble::before {
  content: '';
  position: absolute;
  left: -12px;
  top: 40%;
  border: 8px solid transparent;
  border-right: 12px solid #bfe3ff;
}
.qnum {
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--k-purple);
  font-weight: 800;
}
.bubble p {
  margin: 4px 0 0;
  font-size: clamp(1.15rem, 3.2vw, 1.45rem);
  line-height: 1.25;
  color: var(--k-ink);
}
.answers {
  display: grid;
  gap: 10px;
  margin: 14px 0 6px;
}
.answer {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 60px;
  padding: 8px 14px;
  border: 0;
  border-radius: 22px;
  color: #fff;
  font-family: var(--font-head);
  font-size: 1.25rem;
  font-weight: 800;
  text-align: left;
  cursor: pointer;
  animation: slideIn 0.35s cubic-bezier(0.2, 1.4, 0.4, 1) backwards;
  transition: transform 0.1s, opacity 0.2s, filter 0.2s;
}
.answer:hover:not(:disabled) {
  transform: translateY(-3px) scale(1.02);
}
.answer:active:not(:disabled) {
  transform: translateY(3px);
}
.letter {
  flex: none;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: rgba(255, 255, 255, 0.95);
  font-size: 1.3rem;
}
.answer.yellow {
  background: var(--k-yellow);
  box-shadow: 0 6px 0 #d99a00;
  color: #5c3d00;
}
.answer.yellow .letter {
  color: #d99a00;
}
.answer.blue {
  background: var(--k-blue);
  box-shadow: 0 6px 0 #2479bd;
}
.answer.blue .letter {
  color: #2479bd;
}
.answer.pink {
  background: var(--k-pink);
  box-shadow: 0 6px 0 #d94783;
}
.answer.pink .letter {
  color: #d94783;
}
.answer.correct {
  background: var(--k-green);
  box-shadow: 0 6px 0 #26a052, 0 0 0 5px #b8f5cd;
  color: #fff;
  animation: bounce 0.5s ease;
}
.answer.correct .letter {
  color: #26a052;
}
.answer.wrong {
  background: #b9c3cc;
  box-shadow: 0 6px 0 #8d99a4;
  color: #fff;
  animation: shake 0.35s ease;
}
.answer.dim {
  opacity: 0.45;
}
.answer:disabled {
  cursor: default;
}
.result {
  margin-top: 8px;
}
.stamp {
  display: inline-grid;
  font-size: 2.4rem;
  font-weight: 800;
  line-height: 1;
  animation: stamp 0.45s cubic-bezier(0.2, 1.8, 0.4, 1);
}
.stamp.ok {
  color: var(--k-green);
  -webkit-text-stroke: 1.5px #1f8a45;
}
.stamp.no {
  color: var(--k-pink);
  -webkit-text-stroke: 1.5px #c23a72;
}
.stamp small {
  font-size: 1rem;
  -webkit-text-stroke: 0;
  color: var(--k-ink);
}
.explain {
  margin: 8px 0 14px;
  font-family: var(--font-body);
  font-size: 1.05rem;
  background: #fff8e1;
  border-radius: 16px;
  padding: 10px 14px;
}

/* --- nalaganje --- */
.loading {
  display: grid;
  justify-items: center;
  gap: 10px;
  color: var(--ink);
  font-size: 1.3rem;
}
.load-bar {
  width: 240px;
  height: 18px;
  border-radius: 999px;
  background: var(--bg-soft);
  border: 3px solid var(--line);
  overflow: hidden;
}
.load-bar div {
  height: 100%;
  background: var(--k-yellow);
  transition: width 0.2s;
}

/* --- konec --- */
.stars {
  display: flex;
  justify-content: center;
  gap: 6px;
  margin-bottom: 4px;
}
.star {
  color: #e3e8ee;
}
.star.on {
  color: var(--k-yellow);
  animation: starIn 0.5s cubic-bezier(0.2, 1.8, 0.4, 1) backwards;
}
.stars .star:nth-child(2) {
  transform: translateY(-14px) scale(1.15);
}
.score {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  margin: 10px 0;
}
.score div {
  display: grid;
  padding: 10px 6px;
  border-radius: 20px;
  background: #f1f8ff;
}
.score strong {
  font-size: 1.9rem;
  color: var(--k-blue);
}
.score span {
  font-family: var(--font-body);
  font-weight: 700;
  font-size: 0.85rem;
}
.learned {
  text-align: left;
  background: #f4fff7;
  border: 3px dashed #b6ecc8;
  border-radius: 20px;
  padding: 10px 16px;
  font-family: var(--font-body);
}
.learned h3 {
  margin: 0 0 6px;
  font-family: var(--font-head);
  color: #22914b;
}
.learned ul {
  margin: 0;
  padding-left: 18px;
  display: grid;
  gap: 6px;
}
.tip {
  font-family: var(--font-body);
  margin: 12px 0;
}

/* --- animacije --- */
@keyframes pulse {
  50% {
    transform: scale(1.06);
  }
}
@keyframes blink {
  from {
    transform: scale(1);
    background: #fff;
  }
  to {
    transform: scale(1.08);
    background: #ffe3e3;
  }
}
@keyframes popIn {
  from {
    transform: scale(0.6);
    opacity: 0;
  }
}
@keyframes slideIn {
  from {
    transform: translateY(20px) scale(0.9);
    opacity: 0;
  }
}
@keyframes bounce {
  40% {
    transform: scale(1.06);
  }
}
@keyframes shake {
  25% {
    transform: translateX(-8px);
  }
  75% {
    transform: translateX(8px);
  }
}
@keyframes wobble {
  30% {
    transform: rotate(-1.5deg);
  }
  70% {
    transform: rotate(1.5deg);
  }
}
@keyframes stamp {
  from {
    transform: scale(2.2) rotate(-10deg);
    opacity: 0;
  }
}
@keyframes starIn {
  from {
    transform: scale(0) rotate(-90deg);
  }
}
@keyframes floatUp {
  from {
    transform: translateY(0) scale(0.6);
    opacity: 0;
  }
  20% {
    transform: translateY(-6px) scale(1.15);
    opacity: 1;
  }
  to {
    transform: translateY(-50px) scale(1);
    opacity: 0;
  }
}
@keyframes banner {
  0% {
    transform: translate(-50%, 0) scale(0.3) rotate(-8deg);
    opacity: 0;
  }
  25% {
    transform: translate(-50%, 0) scale(1.15) rotate(-4deg);
    opacity: 1;
  }
  70% {
    transform: translate(-50%, 0) scale(1) rotate(-4deg);
    opacity: 1;
  }
  100% {
    transform: translate(-50%, -30px) scale(1) rotate(-4deg);
    opacity: 0;
  }
}
@keyframes edge {
  to {
    opacity: 0.6;
  }
}

@media (max-width: 720px) {
  .game {
    bottom: 64px;
  }
  .tiles {
    grid-template-columns: repeat(2, 1fr);
  }
  .sky {
    min-width: 150px;
  }
  .top-left {
    flex-direction: column;
  }
  .hint {
    font-size: 0.8rem;
  }
  .quiz-head :deep(svg) {
    width: 70px;
    height: 56px;
  }
  .score strong {
    font-size: 1.4rem;
  }
}
</style>
