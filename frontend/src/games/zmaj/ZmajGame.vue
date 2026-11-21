<script setup lang="ts">
// 3D igra: zmajček leti nad Ljubljano z današnjim smogom in ga odpihuje.
// Vsa 3D logika je v ./engine, tukaj so samo meniji in HUD.
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { useAirData } from '@/composables/useAirData'
import { useProgressStore } from '@/stores/progress'
import { levelFor } from '@/lib/airQuality'
import { GAME, LEP_DAN_PM25, vrhZaIgro } from './config'
import { type Conditions, type HudState, ZmajEngine } from './engine/Game'

const { currentPm25, scene, now, origin } = useAirData()
const progress = useProgressStore()

const host = ref<HTMLDivElement | null>(null)
const engine = shallowRef<ZmajEngine | null>(null)
const state = ref<'nalagam' | 'start' | 'igra' | 'konec'>('nalagam')
const napaka = ref('')
const nalozeno = ref(0)
const hud = ref<HudState>({ casDo: GAME.trajanje, ocisceno: 0, piha: false, rob: false, vMegli: false })
const rezultat = ref(0)

// Današnje stanje iz API-ja (ali demo, če zaledje ne teče).
// Za predstavitev lahko stanje povoziš v naslovu: /igre/zmaj?pm=70&megla=1&vrh=380
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

onMounted(async () => {
  if (!host.value) return
  const e = new ZmajEngine(host.value, {
    onHud: (s) => (hud.value = s),
    onEnd: (o) => {
      rezultat.value = Math.round(o * 100)
      progress.addPoints('zmaj', rezultat.value)
      state.value = 'konec'
    },
  })
  try {
    slabiDnevi.value = await fetch(`${import.meta.env.BASE_URL}assets/terrain/slabi_dnevi.json`)
      .then((r) => r.json())
      .catch(() => [])
    izberiSlabDan()
    await e.load((p) => (nalozeno.value = Math.round(p * 100)))
    e.setConditions(conditions.value)
    engine.value = e
    state.value = 'start'
  } catch (err) {
    napaka.value = 'Igre ni bilo mogoče naložiti (WebGL ali datoteke).'
    console.error(err)
  }
})
onBeforeUnmount(() => engine.value?.dispose())

function zamenjaj(naDanasnji: boolean) {
  naDanes.value = naDanasnji
  if (!naDanasnji) izberiSlabDan()
  engine.value?.setConditions(conditions.value)
}

function play() {
  engine.value?.setConditions(conditions.value)
  engine.value?.start()
  hud.value = { casDo: GAME.trajanje, ocisceno: 0, piha: false, rob: false, vMegli: false }
  state.value = 'igra'
}

const sporocilo = computed(() => {
  const r = rezultat.value
  if (r >= 55) return 'Wow! Ljubljana diha s polnimi pljuči. 🎉'
  if (r >= 30) return 'Super! Nebo nad mestom je veliko bolj čisto.'
  return 'Smog je trdovraten – poskusi leteti nižje in pihati dlje.'
})
</script>

<template>
  <div class="game">
    <div ref="host" class="canvas-host" />

    <!-- HUD med igro -->
    <template v-if="state === 'igra'">
      <div class="hud top-left">
        <div class="timer" :class="{ low: hud.casDo < 10 }">⏱ {{ Math.ceil(hud.casDo) }} s</div>
        <div class="meter">
          <span>Čisto nebo</span>
          <div class="bar"><div class="fill" :style="{ width: `${hud.ocisceno * 100}%` }" /></div>
          <strong>{{ Math.round(hud.ocisceno * 100) }} %</strong>
        </div>
      </div>
      <div class="hud top-right">
        <span v-if="zgodovina" class="chip">📅 {{ datumSl(izbran!.datum) }}</span>
        <span class="chip" :style="{ background: level.color }">{{ Math.round(conditions.pm25) }} µg/m³</span>
        <span v-if="conditions.megla" class="chip">🌫️ megla</span>
        <span v-if="conditions.inverzija" class="chip">⤵ inverzija</span>
      </div>
      <div v-if="hud.rob" class="warn">Obračam nazaj nad Ljubljano …</div>
      <div v-else-if="hud.vMegli && !hud.piha" class="warn soft">Si v smogu – pihaj! 💨</div>
      <div class="hint">🖱️ Miška usmerja · <strong>drži levi gumb</strong> (ali presledek) za pihanje</div>
    </template>

    <!-- Nalaganje -->
    <div v-if="state === 'nalagam'" class="overlay">
      <p v-if="napaka">{{ napaka }}</p>
      <template v-else>
        <div class="spinner" aria-hidden="true">🐉</div>
        <p>Nalagam Ljubljano … {{ nalozeno }} %</p>
      </template>
    </div>

    <!-- Začetek -->
    <div v-else-if="state === 'start'" class="overlay">
      <div class="panel">
        <RouterLink to="/otroci" class="back">← Igre</RouterLink>
        <h1>Zmajček čisti nebo</h1>
        <template v-if="zgodovina">
          <p class="today">
            Danes je zrak v Ljubljani čist:
            <strong :style="{ color: levelDanes.color }">{{ Math.round(danes.pm25) }} µg/m³</strong> 🎉
          </p>
          <p class="today">
            Zato letiš nad resničnim slabim dnem:
            <strong :style="{ color: level.color }">{{ datumSl(izbran!.datum) }} – {{ Math.round(izbran!.pm25) }} µg/m³ PM2.5</strong>,
            z inverzijo.
          </p>
          <p class="note">
            Takrat je bil smog ujet v plasti, debeli le ~{{ izbran!.visina_mesanja_m }} m (radiosondaža ARSO). V igri je plast debelejša, da jo zmajček lahko preleti.
          </p>
          <div class="row small">
            <button class="btn ghost" @click="zamenjaj(false)">🎲 Drug slab dan</button>
            <button class="btn ghost" @click="zamenjaj(true)">☀️ Igraj z današnjim zrakom</button>
          </div>
        </template>
        <template v-else>
          <p class="today">
            Danes nad Ljubljano:
            <strong :style="{ color: level.color }">{{ Math.round(conditions.pm25) }} µg/m³ PM2.5 ({{ level.label.toLowerCase() }})</strong>
            <span v-if="conditions.inverzija"> · inverzija</span>
            <span v-if="conditions.megla"> · megla</span>
          </p>
          <button v-if="lepDan" class="btn ghost" @click="zamenjaj(false)">🌫️ Raje slab dan iz zgodovine</button>
        </template>
        <p v-if="povozeno" class="demo">Stanje je nastavljeno ročno v naslovu strani (?pm=…).</p>
        <p v-else-if="!pravi" class="demo">Demo podatki – zaledje ali ARSO trenutno ni dosegljiv.</p>
        <ul class="how">
          <li>🐉 Zmajček sam leti naprej, <strong>z miško ga usmerjaš</strong> levo, desno, gor in dol.</li>
          <li>💨 <strong>Drži levi gumb</strong> (ali presledek) in odpihni smog nad mestom.</li>
          <li>🌫️ Sive kepe nad mestom so smog. Zleti nizko vanj – ko pihaš, izginejo.</li>
          <li>⏱ Imaš {{ GAME.trajanje }} sekund. Smog se vrača – več ko ga je, hitreje.</li>
        </ul>
        <button class="btn big" @click="play">Poleti! 🚀</button>
        <p class="credits">Teren: Copernicus DEM · Smog: ARSO inventar izpustov · Meritve: ARSO</p>
      </div>
    </div>

    <!-- Konec -->
    <div v-else-if="state === 'konec'" class="overlay">
      <div class="panel">
        <h1>{{ rezultat }} % čistega neba</h1>
        <p>{{ sporocilo }}</p>
        <p class="tip">
          💡 V resnici smog iz kotline odpihne <strong>veter</strong> ali spere <strong>dež</strong>, ko se inverzija prekine.
          Mi lahko pomagamo tako, da manj kurimo z lesom in se pozimi več vozimo z avtobusom ali kolesom.
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
.spinner {
  font-size: 3rem;
  animation: pulse 0.8s ease-in-out infinite alternate;
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
</style>
