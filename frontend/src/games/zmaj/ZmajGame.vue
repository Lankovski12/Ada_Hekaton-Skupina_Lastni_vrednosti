<script setup lang="ts">
// 3D igra: zmajček leti nad Ljubljano s smogom (danes ali resničen slab dan) in ga odpihuje.
// Vsa 3D logika je v ./engine, tukaj so meniji, HUD, sporočila in vprašanja.
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { useAirData } from '@/composables/useAirData'
import { useProgressStore } from '@/stores/progress'
import { levelFor } from '@/lib/airQuality'
import { GAME, LEP_DAN_PM25, VETER, VPRASANJA, vrhZaIgro } from './config'
import { type Conditions, type HudState, type PickupKind, ZmajEngine } from './engine/Game'
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

// Današnje stanje iz API-ja (ali demo, če zaledje ne teče).
// Za predstavitev lahko stanje povoziš v naslovu: /igre/zmaj?pm=70&megla=1&vrh=500
const route = useRoute()
const q = (k: string) => (typeof route.query[k] === 'string' ? (route.query[k] as string) : undefined)
const danes = computed<Conditions>(() => {
  const h = scene.value?.ure[0]
  const pm = q('pm') ? Number(q('pm')) : (currentPm25.value ?? h?.pm25 ?? 20)
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
const levelDanes = computed(() => levelFor(danes.value.pm25))
const pravi = computed(() => origin.value === 'api' && (now.value?.postaje.some((p) => p.vir === 'meritev') ?? false))

// --- kartica dneva ---
const WHO = 15
const kartica = computed(() => {
  const pm = Math.round(conditions.value.pm25)
  return {
    datum: zgodovina.value ? datumSl(izbran!.value!.datum) : 'Danes',
    pm,
    krat: pm > WHO ? `${(pm / WHO).toFixed(1).replace('.', ',')}-krat` : 'pod mejo',
    inverzija: conditions.value.inverzija,
    plast: zgodovina.value ? izbran.value!.visina_mesanja_m : null,
    megla: conditions.value.megla,
  }
})

// --- sporočila med igro (dež, veter, dim) ---
const toast = ref<{ naslov: string; besedilo: string; vrsta: string } | null>(null)
let toastTimer: number | undefined
const naucil = ref(new Set<string>()) // kaj je otrok srečal – pokažemo na koncu

function onPickup(kind: Exclude<PickupKind, 'vprasanje'>) {
  const d = DEJSTVA[kind]
  toast.value = { ...d, vrsta: kind }
  naucil.value.add(d.besedilo)
  window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => (toast.value = null), 4000)
}

// --- vprašanja ---
const vprasanja = ref<Vprasanje[]>([])
const trenutno = ref<Vprasanje | null>(null)
const odgovor = ref<number | null>(null)
const pravilni = ref(0)
const postavljena = ref(0)

function onQuestion() {
  trenutno.value = vprasanja.value[postavljena.value % vprasanja.value.length] ?? null
  odgovor.value = null
  if (!trenutno.value) engine.value?.answer(false)
}
function odgovori(i: number) {
  if (odgovor.value != null || !trenutno.value) return
  odgovor.value = i
  if (i === trenutno.value.pravilen) pravilni.value++
}
function naprej() {
  const v = trenutno.value
  if (!v) return
  naucil.value.add(v.razlaga)
  postavljena.value++
  engine.value?.answer(odgovor.value === v.pravilen)
  trenutno.value = null
}

onMounted(async () => {
  if (!host.value) return
  const e = new ZmajEngine(host.value, {
    onHud: (s) => (hud.value = s),
    onEnd: (o) => {
      rezultat.value = Math.round(o * 100)
      progress.addPoints('zmaj', rezultat.value)
      trenutno.value = null
      state.value = 'konec'
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

function play() {
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
  engine.value?.setConditions(conditions.value)
  engine.value?.start()
  hud.value = prazenHud()
  state.value = 'igra'
}

const sporocilo = computed(() => {
  const r = rezultat.value
  if (r >= 55) return 'Ljubljana diha s polnimi pljuči. Bravo!'
  if (r >= 30) return 'Super! Nebo nad mestom je veliko bolj čisto.'
  return 'Smog je trdovraten, poskusi leteti nižje in pihati dlje.'
})
</script>

<template>
  <div class="game">
    <div ref="host" class="canvas-host" />

    <!-- HUD med igro -->
    <template v-if="state === 'igra'">
      <div class="hud top-left">
        <div class="timer" :class="{ low: hud.casDo < 10 }">{{ Math.ceil(hud.casDo) }} s</div>
        <div class="meter">
          <span>Čisto nebo</span>
          <div class="bar"><div class="fill" :style="{ width: `${hud.ocisceno * 100}%` }" /></div>
          <strong>{{ Math.round(hud.ocisceno * 100) }} %</strong>
        </div>
        <div v-if="hud.veter > 0" class="meter boost">
          <span>Sunek vetra</span>
          <div class="bar"><div class="fill wind" :style="{ width: `${(hud.veter / VETER.trajanje) * 100}%` }" /></div>
          <strong>{{ Math.ceil(hud.veter) }} s</strong>
        </div>
      </div>
      <div class="hud top-right">
        <span v-if="zgodovina" class="chip">{{ datumSl(izbran!.datum) }}</span>
        <span class="chip" :style="{ background: level.color }">{{ Math.round(conditions.pm25) }} µg/m³</span>
        <span v-if="conditions.megla" class="chip">megla</span>
        <span v-if="conditions.inverzija" class="chip">inverzija</span>
        <span class="chip">vprašanja {{ pravilni }}/{{ VPRASANJA.kdaj.length }}</span>
      </div>

      <Transition name="toast">
        <div v-if="toast" :key="toast.besedilo" class="toast" :class="toast.vrsta">
          <strong>{{ toast.naslov }}</strong>
          <span>{{ toast.besedilo }}</span>
        </div>
      </Transition>

      <div v-if="hud.rob && !trenutno" class="warn">Obračam nazaj nad Ljubljano …</div>
      <div class="hint">Miška usmerja · <strong>drži levi gumb</strong> (ali presledek) za pihanje</div>

      <!-- vprašanje: igra stoji, dokler ne odgovoriš -->
      <div v-if="trenutno" class="overlay question">
        <div class="panel">
          <p class="kicker">Vprašanje {{ postavljena + 1 }} / {{ VPRASANJA.kdaj.length }}</p>
          <h2>{{ trenutno.vprasanje }}</h2>
          <div class="answers">
            <button
              v-for="(m, i) in trenutno.moznosti"
              :key="m"
              class="answer"
              :class="{
                correct: odgovor != null && i === trenutno.pravilen,
                wrong: odgovor === i && i !== trenutno.pravilen,
              }"
              :disabled="odgovor != null"
              @click="odgovori(i)"
            >
              {{ m }}
            </button>
          </div>
          <template v-if="odgovor != null">
            <p class="feedback" :class="odgovor === trenutno.pravilen ? 'ok' : 'no'">
              {{ odgovor === trenutno.pravilen ? `Pravilno! +${VPRASANJA.bonusCas} s in sunek vetra.` : 'Ne čisto.' }}
            </p>
            <p class="explain">{{ trenutno.razlaga }}</p>
            <button class="btn big" @click="naprej">Leti naprej</button>
          </template>
        </div>
      </div>
    </template>

    <!-- Nalaganje -->
    <div v-if="state === 'nalagam'" class="overlay">
      <p v-if="napaka">{{ napaka }}</p>
      <template v-else>
        <div class="spinner" aria-hidden="true" />
        <p>Nalagam Ljubljano … {{ nalozeno }} %</p>
      </template>
    </div>

    <!-- Začetek -->
    <div v-else-if="state === 'start'" class="overlay">
      <div class="panel wide">
        <RouterLink to="/otroci" class="back">Nazaj na igre</RouterLink>
        <h1>Zmajček čisti nebo</h1>

        <p v-if="zgodovina" class="today">
          Danes je zrak v Ljubljani čist ({{ Math.round(danes.pm25) }} µg/m³), zato letiš nad
          <strong>resničnim slabim dnem</strong> iz meritev ARSO.
        </p>

        <div class="card-day" :style="{ '--lvl': level.color }">
          <div class="tile">
            <span class="label">Dan</span>
            <strong>{{ kartica.datum }}</strong>
          </div>
          <div class="tile">
            <span class="label">Drobni delci PM2.5</span>
            <strong class="lvl">{{ kartica.pm }} µg/m³</strong>
            <span class="sub">{{ level.label }}</span>
          </div>
          <div class="tile">
            <span class="label">Priporočilo WHO: 15</span>
            <strong>{{ kartica.krat }}</strong>
            <span class="sub">{{ kartica.pm > 15 ? 'več, kot je zdravo' : 'zrak je zdrav' }}</span>
          </div>
          <div class="tile">
            <span class="label">Inverzija</span>
            <strong>{{ kartica.inverzija ? 'Da' : 'Ne' }}</strong>
            <span v-if="kartica.plast" class="sub">zrak se je mešal le do ~{{ kartica.plast }} m</span>
            <span v-else-if="kartica.megla" class="sub">in megla</span>
          </div>
        </div>

        <div v-if="zgodovina" class="row small">
          <button class="btn ghost" @click="zamenjaj(false)">Drug slab dan</button>
          <button class="btn ghost" @click="zamenjaj(true)">Igraj z današnjim zrakom</button>
        </div>
        <button v-else-if="lepDan" class="btn ghost" @click="zamenjaj(false)">Raje slab dan iz zgodovine</button>
        <p v-if="povozeno" class="demo">Stanje je nastavljeno ročno v naslovu strani (?pm=…).</p>
        <p v-else-if="!pravi" class="demo">Demo podatki: zaledje ali ARSO trenutno ni dosegljiv.</p>

        <ul class="legend">
          <li><i class="dot smog" /><span>Sive kepe so smog. Zleti vanj in <strong>drži levi gumb</strong>, da ga odpihneš.</span></li>
          <li><i class="dot rain" /><span><strong>Oblaček Kapljica</strong>: zleti skozenj in začne deževati.</span></li>
          <li><i class="dot wind" /><span><strong>Obroč vetra</strong>: zleti skozi in za {{ VETER.trajanje }} s pospešiš.</span></li>
          <li><i class="dot smoke" /><span><strong>Dimnik</strong>: njegov dim doda smog, izogni se mu.</span></li>
          <li><i class="dot gold" /><span><strong>Zlati vprašaj</strong>: ujemi ga in odgovori, pravilno = +{{ VPRASANJA.bonusCas }} s.</span></li>
        </ul>
        <button class="btn big" @click="play">Poleti</button>
        <p class="credits">Teren: Copernicus DEM · Smog: ARSO inventar izpustov · Meritve: ARSO · Radiosondaža: NOAA IGRA2</p>
      </div>
    </div>

    <!-- Konec -->
    <div v-else-if="state === 'konec'" class="overlay">
      <div class="panel wide">
        <h1>{{ rezultat }} % čistega neba</h1>
        <p>{{ sporocilo }} Pravilni odgovori: {{ pravilni }} od {{ postavljena }}.</p>
        <div v-if="naucil.size" class="learned">
          <h3>Kaj si se naučil</h3>
          <ul>
            <li v-for="t in naucil" :key="t">{{ t }}</li>
          </ul>
        </div>
        <p class="tip">
          V resnici smog iz kotline odpihne <strong>veter</strong> ali spere <strong>dež</strong>, ko se inverzija prekine.
          Mi lahko pomagamo tako, da manj kurimo z drvmi in se pozimi več vozimo z avtobusom ali kolesom.
        </p>
        <div class="row">
          <button class="btn big" @click="play">Še enkrat</button>
          <RouterLink to="/otroci" class="btn ghost">Nazaj na igre</RouterLink>
        </div>
        <p class="credits">Rekord: {{ progress.najboljse.zmaj ?? 0 }} %</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.game {
  position: fixed;
  top: 64px;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 15;
  background: #0b1520;
  overflow: hidden;
  user-select: none;
  -webkit-user-select: none;
}
.canvas-host {
  position: absolute;
  inset: 0;
  cursor: crosshair;
}
.hud {
  position: absolute;
  z-index: 2;
  display: flex;
  gap: 8px;
  pointer-events: none;
}
.top-left {
  top: 14px;
  left: 14px;
  flex-direction: column;
}
.top-right {
  top: 14px;
  right: 14px;
  flex-wrap: wrap;
  justify-content: flex-end;
  max-width: 50%;
}
.timer {
  font-family: var(--font-head);
  font-size: 1.8rem;
  font-weight: 800;
  color: #fff;
  text-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
}
.timer.low {
  color: #ffb4b4;
  animation: pulse 0.6s ease-in-out infinite alternate;
}
.meter {
  display: grid;
  grid-template-columns: auto 160px auto;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 999px;
  background: rgba(10, 20, 30, 0.55);
  color: #fff;
  font-weight: 700;
  font-size: 0.9rem;
}
.bar {
  height: 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.2);
  overflow: hidden;
}
.fill {
  height: 100%;
  background: linear-gradient(90deg, #8ccf3f, #2bb673);
  transition: width 0.15s linear;
}
.chip {
  padding: 6px 12px;
  border-radius: 999px;
  background: rgba(10, 20, 30, 0.55);
  color: #fff;
  font-weight: 800;
  font-size: 0.85rem;
}
.warn {
  position: absolute;
  top: 30%;
  left: 50%;
  transform: translateX(-50%);
  z-index: 2;
  padding: 10px 18px;
  border-radius: 999px;
  background: rgba(229, 72, 77, 0.85);
  color: #fff;
  font-weight: 800;
  pointer-events: none;
}
.warn.soft {
  background: rgba(10, 20, 30, 0.6);
}
.hint {
  position: absolute;
  bottom: 16px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 2;
  padding: 8px 16px;
  border-radius: 999px;
  background: rgba(10, 20, 30, 0.55);
  color: #fff;
  font-size: 0.9rem;
  white-space: nowrap;
  pointer-events: none;
}
.overlay {
  position: absolute;
  inset: 0;
  z-index: 5;
  display: grid;
  place-items: center;
  padding: 16px;
  background: linear-gradient(180deg, rgba(8, 16, 26, 0.35), rgba(8, 16, 26, 0.75));
  color: #fff;
  text-align: center;
}
.panel {
  max-width: 560px;
  padding: 28px;
  border-radius: var(--radius);
  background: rgba(12, 24, 36, 0.78);
  border: 1px solid rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(8px);
}
.panel h1 {
  font-size: clamp(2rem, 6vw, 3rem);
}
.back {
  display: inline-block;
  margin-bottom: 8px;
  color: #9fd0ff;
  font-weight: 700;
  text-decoration: none;
}
.today {
  font-size: 1.05rem;
  margin: 6px 0;
}
.note {
  font-size: 0.85rem;
  color: #a9bdcf;
}
.row.small .btn {
  padding: 10px 16px;
  min-height: 40px;
  font-size: 0.9rem;
}
.demo {
  color: #ffd27a;
  font-size: 0.9rem;
}
.how {
  text-align: left;
  list-style: none;
  padding: 0;
  margin: 16px 0 20px;
  display: grid;
  gap: 8px;
  color: #d6e4f0;
}
.btn.big {
  font-size: 1.2rem;
  padding: 16px 30px;
}
.btn.ghost {
  color: #fff;
  border-color: rgba(255, 255, 255, 0.3);
}
.row {
  display: flex;
  gap: 12px;
  justify-content: center;
  flex-wrap: wrap;
}
.tip {
  background: rgba(255, 255, 255, 0.08);
  padding: 12px 14px;
  border-radius: var(--radius-sm);
  color: #d6e4f0;
  text-align: left;
}
.credits {
  margin-top: 14px;
  font-size: 0.75rem;
  color: #8ea6bb;
}
@keyframes pulse {
  to {
    transform: scale(1.15);
  }
}
@media (max-width: 720px) {
  .game {
    bottom: 64px;
  }
  .meter {
    grid-template-columns: auto 90px auto;
  }
  .hint {
    font-size: 0.75rem;
    white-space: normal;
    width: 90%;
    text-align: center;
  }
}

/* --- novo: sporočila, vprašanja, kartica dneva, legenda --- */
.boost {
  margin-top: 2px;
}
.fill.wind {
  background: linear-gradient(90deg, #9fe3ff, #4fb4ff);
}
.toast {
  position: absolute;
  top: 18%;
  left: 50%;
  transform: translateX(-50%);
  z-index: 3;
  display: grid;
  gap: 2px;
  max-width: min(520px, 90%);
  padding: 12px 20px;
  border-radius: var(--radius);
  background: rgba(12, 24, 36, 0.82);
  border-left: 5px solid #9fe3ff;
  color: #fff;
  text-align: left;
  pointer-events: none;
}
.toast strong {
  font-family: var(--font-head);
  font-size: 1.3rem;
}
.toast.dez {
  border-left-color: #5aa8e6;
}
.toast.dim {
  border-left-color: #9b4b36;
}
.toast-enter-active,
.toast-leave-active {
  transition: opacity 0.3s, transform 0.3s;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translate(-50%, -10px);
}
.overlay.question {
  z-index: 6;
  background: rgba(8, 16, 26, 0.55);
}
.overlay.question .panel {
  max-width: 560px;
  max-height: calc(100% - 16px);
  overflow-y: auto;
}
.kicker {
  margin: 0 0 6px;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  font-size: 0.75rem;
  font-weight: 800;
  color: #ffc84a;
}
.question h2 {
  font-size: clamp(1.2rem, 3.5vw, 1.6rem);
  line-height: 1.3;
}
.answers {
  display: grid;
  gap: 10px;
  margin: 16px 0 8px;
}
.answer {
  min-height: 56px;
  padding: 12px 16px;
  border-radius: var(--radius-sm);
  border: 2px solid rgba(255, 255, 255, 0.2);
  background: rgba(255, 255, 255, 0.06);
  color: #fff;
  font-size: 1.05rem;
  font-weight: 700;
  text-align: left;
  transition: background 0.15s, border-color 0.15s;
}
.answer:hover:not(:disabled) {
  border-color: #ffc84a;
  background: rgba(255, 200, 74, 0.12);
}
.answer.correct {
  border-color: #2bb673;
  background: rgba(43, 182, 115, 0.25);
}
.answer.wrong {
  border-color: #e5484d;
  background: rgba(229, 72, 77, 0.22);
}
.feedback {
  font-weight: 800;
  font-size: 1.1rem;
  margin: 10px 0 4px;
}
.feedback.ok {
  color: #6fe0a3;
}
.feedback.no {
  color: #ffb0a8;
}
.explain {
  color: #d6e4f0;
  text-align: left;
}
.panel.wide {
  max-width: 680px;
  max-height: calc(100% - 16px);
  overflow-y: auto;
}
.card-day {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  margin: 14px 0;
}
.card-day .tile {
  display: grid;
  gap: 2px;
  align-content: start;
  padding: 10px;
  border-radius: var(--radius-sm);
  background: rgba(255, 255, 255, 0.07);
  text-align: left;
}
.card-day .label {
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #9fb3c8;
}
.card-day strong {
  font-family: var(--font-head);
  font-size: 1.25rem;
}
.card-day .lvl {
  color: var(--lvl);
}
.card-day .sub {
  font-size: 0.8rem;
  color: #c4d3e2;
}
.legend {
  list-style: none;
  padding: 0;
  margin: 14px 0 18px;
  display: grid;
  gap: 8px;
  text-align: left;
  color: #d6e4f0;
}
.legend li {
  display: flex;
  align-items: center;
  gap: 10px;
}
.dot {
  flex: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
}
.dot.smog {
  background: #d2cdc4;
}
.dot.rain {
  background: #e6f3ff;
  box-shadow: inset 0 -5px 0 #5aa8e6;
}
.dot.wind {
  background: transparent;
  border: 3px solid #c6f1ff;
}
.dot.smoke {
  border-radius: 3px;
  background: #9b4b36;
}
.dot.gold {
  background: #ffb21e;
}
.learned {
  text-align: left;
  background: rgba(255, 255, 255, 0.06);
  border-radius: var(--radius-sm);
  padding: 12px 16px;
}
.learned h3 {
  margin: 0 0 6px;
  font-size: 1.1rem;
}
.learned ul {
  margin: 0;
  padding-left: 18px;
  display: grid;
  gap: 6px;
  color: #d6e4f0;
}
.spinner {
  width: 44px;
  height: 44px;
  margin: 0 auto 10px;
  border-radius: 50%;
  border: 4px solid rgba(255, 255, 255, 0.2);
  border-top-color: #fff;
  animation: spin 0.9s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
@media (max-width: 720px) {
  .card-day {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
