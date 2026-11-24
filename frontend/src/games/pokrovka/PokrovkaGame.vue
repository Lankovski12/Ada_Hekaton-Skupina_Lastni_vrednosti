<script setup lang="ts">
// Igra »Naredi pokrovko«: z dvema drsnikoma (temperatura v dolini in na hribu) zadeni včerajšnjo pokrovko.
// Tri stopnje: 1) dolina je dana, 2) obe temperaturi, 3) brez cilja, samo namigi. Prej (neobvezno) zgodba o inverziji.
import VirZnacka from '@/components/VirZnacka.vue'
import { computed, onMounted, reactive, ref } from 'vue'
import { zabelezi } from '@/analytics/posthog'
import { RouterLink, useRoute } from 'vue-router'
import AirBuddy from '@/components/AirBuddy.vue'
import Confetti from '../skupno/Confetti.vue'
import GameIcon from '../skupno/GameIcon.vue'
import { sound } from '../skupno/sound'
import { NAJVEC, visinaPokrovke, zvezdiceZa } from './fizika'
import { dniZapored, nizIgre, zabeleziDan } from '../skupno/niz'
import { datumSl, nakljucnoJutro, naloziArhiv, naloziVceraj, type Jutro } from './podatki'
import Scena from './Scena.vue'
import Zgodba from './Zgodba.vue'

const KEY = 'zrak-pokrovka'
const shranjeno = reactive<{ zvezdice: number; zgodbaVidena: boolean }>(
  (() => {
    try {
      return { zvezdice: 0, zgodbaVidena: false, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }
    } catch {
      return { zvezdice: 0, zgodbaVidena: false }
    }
  })(),
)
function shrani() {
  try {
    localStorage.setItem(KEY, JSON.stringify(shranjeno))
  } catch {
    /* ignoriraj */
  }
}

const stanje = ref<'nalagam' | 'meni' | 'zgodba' | 'igra' | 'konec'>('nalagam')
const jutro = ref<Jutro | null>(null)
const izArhiva = ref(false)
const vaja = ref(false)
const stopnja = ref(1)
const tD = ref(5)
const tH = ref(0)
const preverjeno = ref(false)
const zvezdiceStopnje = ref<number[]>([])
const konfeti = ref(0)
const niz = ref(nizIgre('pokrovka')) // koliko dni zapored se otrok vrača k igri
const zvok = ref(sound.enabled)

const pravaPokrovka = computed(() => (jutro.value ? visinaPokrovke(jutro.value.t_dolina, jutro.value.t_hrib) : 0))
const moja = computed(() => visinaPokrovke(tD.value, tH.value))
const zadnje = computed(() => zvezdiceStopnje.value[stopnja.value - 1] ?? 0)
const skupaj = computed(() => zvezdiceStopnje.value.reduce((a, b) => a + b, 0))

const route = useRoute()
onMounted(async () => {
  const qd = typeof route.query.datum === 'string' ? route.query.datum : undefined
  if (qd) {
    jutro.value = (await naloziArhiv()).find((d) => d.datum === qd) ?? null
    vaja.value = true
  }
  if (!jutro.value) {
    const r = await naloziVceraj()
    jutro.value = r.jutro
    izArhiva.value = r.izArhiva
  }
  stanje.value = 'meni'
})

function zacniStopnjo(n: number) {
  stopnja.value = n
  preverjeno.value = false
  if (n === 1) {
    tD.value = jutro.value!.t_dolina
    tH.value = Math.round(jutro.value!.t_dolina - 3)
  } else {
    tD.value = 5
    tH.value = 0
  }
}

function igraj() {
  sound.unlock()
  sound.pop()
  zvezdiceStopnje.value = []
  zacniStopnjo(1)
  stanje.value = 'igra'
}

function zgodba() {
  sound.unlock()
  stanje.value = 'zgodba'
}
function konecZgodbe() {
  shranjeno.zgodbaVidena = true
  shrani()
  igraj()
}

function preveri() {
  preverjeno.value = true
  const z = zvezdiceZa(moja.value, pravaPokrovka.value)
  zvezdiceStopnje.value[stopnja.value - 1] = z
  if (z >= 2) sound.correct()
  else sound.wrong()
  if (z === 3) konfeti.value++
}

function naslednja() {
  if (stopnja.value < 3) {
    sound.pop()
    zacniStopnjo(stopnja.value + 1)
  } else {
    zabelezi('inversion_game_completed', {
      total_stars: skupaj.value,
      played_practice: vaja.value,
    })
    zabeleziDan('pokrovka')
    niz.value = nizIgre('pokrovka')
    sound.end(skupaj.value >= 6)
    if (skupaj.value >= 6) konfeti.value++
    stanje.value = 'konec'
  }
}

async function novDan() {
  vaja.value = true
  jutro.value = await nakljucnoJutro(jutro.value?.datum)
  igraj()
}

function preklopiZvok() {
  sound.unlock()
  zvok.value = !zvok.value
  sound.setEnabled(zvok.value)
}

const fmt = (t: number) => `${t > 0 ? '+' : ''}${String(Math.round(t * 10) / 10).replace('.', ',')} °C`
const opisVisine = (m: number) =>
  m >= NAJVEC - 10 ? 'pokrovke ni bilo' : m < 70 ? `${m} m – nižje od Nebotičnika (70 m)!` : `${m} m`

const NALOGE = [
  'Temperatura v Ljubljani je že nastavljena. Premikaj drsnik za hrib, da se pokrovka ujame z zlato črto.',
  'Zdaj nastavi obe temperaturi, da se pokrovka ujame z zlato črto.',
  'Tokrat cilja ne vidiš. Preberi namige in nastavi temperaturi, kot sta bili včeraj zjutraj.',
]

const namigi = computed(() => {
  const j = jutro.value!
  const out: string[] = [`V Ljubljani je bilo ob 7h ${fmt(j.t_dolina)}.`]
  out.push(j.t_hrib > j.t_dolina ? 'Na hribu je bilo topleje kot v dolini.' : 'Na hribu je bilo hladneje kot v dolini.')
  if (j.vlaga != null) out.push(j.vlaga >= 95 ? `V dolini je bila zjutraj megla (vlaga ${Math.round(j.vlaga)} %).` : `V dolini zjutraj ni bilo megle (vlaga ${Math.round(j.vlaga)} %).`)
  if (j.pm25 != null)
    out.push(`Smoga je bilo čez dan ${Math.round(j.pm25)} µg/m³ – ${j.pm25 > 35 ? 'veliko' : j.pm25 > 15 ? 'srednje' : 'malo'}.`)
  return out
})

const razlaga = computed(() => {
  const j = jutro.value!
  const d = Math.round((j.t_hrib - j.t_dolina) * 10) / 10
  let s = `Ob 7h je bilo v Ljubljani ${fmt(j.t_dolina)}, na Pasji ravni (1019 m) ${fmt(j.t_hrib)}. `
  s +=
    d > 0
      ? `Na hribu je bilo za ${String(d).replace('.', ',')} °C topleje – prava pokrovka! Zrak se je mešal le do ${opisVisine(pravaPokrovka.value)}`
      : `Na hribu je bilo hladneje kot v dolini, zato je bila pokrovka visoko: ${opisVisine(pravaPokrovka.value)}`
  s += '.'
  if (stopnja.value === 2) s += ' Isto višino dobiš z različnimi temperaturami – šteje razlika med hribom in dolino.'
  return s
})
const sporocila = ['Ojej, tokrat ne!', 'Blizu!', 'Dobro!', 'Natančno!']
</script>

<template>
  <div class="pokr" @pointerdown.once="sound.unlock()">
    <Confetti v-if="konfeti" :key="konfeti" />
    <div class="wrap">
      <RouterLink to="/igre" class="back">Nazaj na igre</RouterLink>
      <header class="head">
        <div>
          <span class="kicker">Igra · inverzija</span>
          <h1>Naredi pokrovko</h1>
        </div>
        <span class="chip">{{ dniZapored(niz) }}</span>
        <button class="sound" :aria-label="zvok ? 'Izklopi zvok' : 'Vklopi zvok'" @click="preklopiZvok">
          <GameIcon :name="zvok ? 'zvok' : 'tiho'" :size="22" />
        </button>
      </header>

      <div v-if="stanje === 'nalagam'" class="card center">Nalagam …</div>

      <!-- meni -->
      <div v-else-if="stanje === 'meni'" class="card center">
        <Scena :t-dolina="-4" :t-hrib="4" :poudari-pokrovko="true" />
        <div class="bubble">
          <AirBuddy :mood="0.3" color="#9b6bff" :size="84" />
          <p>
            Nad Ljubljano se pozimi pogosto naredi <strong>pokrovka</strong>, ki ujame smog.
            Ugani, kakšna je bila <strong>{{ datumSl(jutro!.datum) }}</strong> zjutraj!
          </p>
        </div>
        <p v-if="izArhiva" class="note">Za včeraj še ni podatkov, zato igraš z dnevom iz arhiva meritev ARSO.</p>
        <div class="row">
          <button class="k-btn purple" @click="zgodba">Kaj je pokrovka?</button>
          <button class="k-btn green" :class="{ pulse: shranjeno.zgodbaVidena }" @click="shranjeno.zgodbaVidena ? igraj() : zgodba()">
            {{ shranjeno.zgodbaVidena ? 'Igraj' : 'Začni' }}
          </button>
        </div>
      </div>

      <!-- zgodba -->
      <div v-else-if="stanje === 'zgodba'" class="card">
        <Zgodba @konec="konecZgodbe" />
      </div>

      <!-- igra -->
      <div v-else-if="stanje === 'igra'" class="card">
        <div class="level">
          <span v-for="n in 3" :key="n" class="lv" :class="{ on: n === stopnja, done: n < stopnja }">Stopnja {{ n }}</span>
        </div>
        <p class="task">{{ NALOGE[stopnja - 1] }}</p>
        <ul v-if="stopnja === 3 && !preverjeno" class="hints">
          <li v-for="h in namigi" :key="h">{{ h }}</li>
        </ul>

        <Scena
          :t-dolina="tD"
          :t-hrib="tH"
          :cilj="stopnja < 3 ? pravaPokrovka : null"
          :resnica="preverjeno ? pravaPokrovka : null"
        />

        <div class="sliders">
          <label class="sl" :class="{ locked: stopnja === 1 }">
            <span class="lbl">Hrib (Pasja ravan, 1019 m)</span>
            <input v-model.number="tH" type="range" min="-12" max="15" step="0.5" :disabled="preverjeno" />
            <strong>{{ fmt(tH) }}</strong>
          </label>
          <label class="sl" :class="{ locked: stopnja === 1 }">
            <span class="lbl">Dolina (Ljubljana){{ stopnja === 1 ? ' – že nastavljeno' : '' }}</span>
            <input v-model.number="tD" type="range" min="-12" max="15" step="0.5" :disabled="preverjeno || stopnja === 1" />
            <strong>{{ fmt(tD) }}</strong>
          </label>
        </div>
        <p class="mine">Tvoja pokrovka: <strong>{{ moja >= NAJVEC - 10 ? 'ni je' : `${moja} m` }}</strong></p>

        <button v-if="!preverjeno" class="k-btn green" @click="preveri">Preveri</button>
        <Transition name="pop">
          <div v-if="preverjeno" class="result">
            <div class="stars">
              <GameIcon v-for="n in 3" :key="n" name="zvezda" :size="56" class="s" :class="{ on: n <= zadnje }" :style="{ animationDelay: `${n * 0.15}s` }" />
            </div>
            <h2>{{ sporocila[zadnje] }}</h2>
            <div class="bubble">
              <AirBuddy :mood="0" color="#7cc8ff" :size="70" />
              <p>{{ razlaga }}</p>
            </div>
            <button class="k-btn green" @click="naslednja">{{ stopnja < 3 ? 'Naslednja stopnja' : 'Konec' }}</button>
          </div>
        </Transition>
      </div>

      <!-- konec -->
      <div v-else-if="stanje === 'konec'" class="card center">
        <div class="stars big">
          <GameIcon v-for="n in 3" :key="n" name="zvezda" :size="72" class="s" :class="{ on: n <= Math.round(skupaj / 3) }" :style="{ animationDelay: `${n * 0.2}s` }" />
        </div>
        <h2>{{ skupaj >= 7 ? 'Odlično opravljeno!' : skupaj >= 4 ? 'Dobro opravljeno!' : 'Bravo, da si poskusil!' }}</h2>
        <div class="bubble">
          <AirBuddy :mood="0" color="#9b6bff" :size="80" />
          <p>
            Zdaj veš, kako nastane pokrovka: ko je na hribu topleje kot v dolini, zrak obstane in smog ostane ujet.
            Večja kot je razlika, nižje je pokrovka.
          </p>
        </div>
        <div class="row">
          <button class="k-btn purple" @click="novDan">Drug dan</button>
          <button class="k-btn ghost" @click="zgodba">Ponovi zgodbo</button>
        </div>
      </div>

      <p class="credits">
        <VirZnacka :vrsta="vaja || izArhiva ? 'meritev' : 'model'" /> Temperature:
        {{ vaja || izArhiva ? 'arhiv meritev ARSO' : `${jutro?.vir}, včeraj ob 7h` }} ·
        <VirZnacka vrsta="ocena" /> Pokrovka: poenostavljen izračun, preverjen z radiosondažo ARSO
      </p>
    </div>
  </div>
</template>

<style>
.pokr .k-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 56px;
  margin-top: 14px;
  padding: 8px 30px;
  border: 0;
  border-radius: 999px;
  font-family: var(--font-head);
  font-size: 1.3rem;
  font-weight: 800;
  color: #fff;
  cursor: pointer;
  transition: transform 0.1s, opacity 0.2s;
}
.pokr .k-btn:active:not(:disabled) {
  transform: translateY(4px);
}
.pokr .k-btn:disabled {
  opacity: 0.4;
  cursor: default;
}
.pokr .k-btn.green {
  background: #3ccf6e;
  box-shadow: 0 6px 0 #26a052;
}
.pokr .k-btn.purple {
  background: #9b6bff;
  box-shadow: 0 6px 0 #7146d6;
}
.pokr .k-btn.ghost {
  background: #fff;
  color: #2479bd;
  box-shadow: 0 6px 0 #c9dff1, inset 0 0 0 3px #bfe3ff;
}
.pokr .k-btn.pulse {
  animation: pulse 1.2s ease-in-out infinite;
}
@keyframes pulse {
  50% {
    transform: scale(1.06);
  }
}
</style>

<style scoped>
.pokr {
  position: relative;
  min-height: calc(100svh - 64px);
  padding: 16px 0 40px;
  overflow: hidden;
}
.wrap {
  width: min(860px, 100%);
  margin: 0 auto;
  padding: 0 16px;
}
.back {
  display: inline-block;
  margin-bottom: 4px;
  color: var(--brand);
  font-family: var(--font-head);
  font-weight: 800;
  text-decoration: none;
}
.head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}
.kicker {
  display: block;
  margin-bottom: 4px;
  text-transform: uppercase;
  letter-spacing: 0.2em;
  font-size: 0.75rem;
  font-weight: 800;
  color: color-mix(in srgb, var(--accent) 70%, var(--ink));
}
.head h1 {
  margin: 0;
  font-size: clamp(2rem, 5vw, 3rem);
  line-height: 1;
  color: var(--ink);
}
.chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 12px;
  border-radius: 999px;
  background: #fff;
  color: #1d3557;
  font-family: var(--font-head);
  font-weight: 800;
}
.chip :deep(svg) {
  color: #ffc22e;
}
.sound {
  margin-left: auto;
  width: 46px;
  height: 46px;
  border-radius: 50%;
  border: 3px solid #fff;
  background: #3fa9f5;
  color: #fff;
  display: grid;
  place-items: center;
  box-shadow: 0 4px 0 #2479bd;
  cursor: pointer;
}
.card {
  padding: 16px;
  border-radius: var(--radius);
  background: var(--panel);
  border: 1px solid var(--panel-line);
  box-shadow: var(--shadow);
  margin-bottom: 16px;
}
.center {
  text-align: center;
}
.bubble {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 12px;
  padding: 12px 16px;
  border-radius: 24px;
  background: #fff8e1;
  text-align: left;
}
.bubble :deep(svg) {
  flex: none;
}
.bubble p {
  margin: 0;
  font-size: 1.05rem;
  color: #1d3557;
}
.note {
  font-size: 0.9rem;
  color: #a15c00;
}
.row {
  display: flex;
  justify-content: center;
  gap: 12px;
  flex-wrap: wrap;
}
.level {
  display: flex;
  gap: 8px;
  justify-content: center;
  margin-bottom: 8px;
}
.lv {
  padding: 4px 12px;
  border-radius: 999px;
  background: #eef3f8;
  color: #8193a5;
  font-family: var(--font-head);
  font-weight: 800;
  font-size: 0.9rem;
}
.lv.on {
  background: #ff8a3d;
  color: #fff;
}
.lv.done {
  background: #3ccf6e;
  color: #fff;
}
.task {
  margin: 0 0 10px;
  text-align: center;
  font-family: var(--font-head);
  font-size: clamp(1.1rem, 3vw, 1.35rem);
  color: #1d3557;
}
.hints {
  margin: 0 0 10px;
  padding: 10px 14px 10px 30px;
  border-radius: 18px;
  background: #f1f8ff;
  color: #1d3557;
  display: grid;
  gap: 4px;
}
.sliders {
  display: grid;
  gap: 10px;
  margin-top: 12px;
}
.sl {
  display: grid;
  grid-template-columns: minmax(150px, 220px) 1fr 80px;
  align-items: center;
  gap: 10px;
  font-family: var(--font-head);
  color: #1d3557;
}
.sl strong {
  font-size: 1.3rem;
  text-align: right;
}
.sl input {
  -webkit-appearance: none;
  appearance: none;
  height: 22px;
  border-radius: 999px;
  background: linear-gradient(90deg, #4682e6, #d6ecff 44%, #ffaa50);
}
.sl input::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: #fff;
  border: 6px solid #1d3557;
  cursor: grab;
}
.sl input::-moz-range-thumb {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: #fff;
  border: 6px solid #1d3557;
}
.sl.locked input {
  opacity: 0.85;
}
.sl.locked:last-child input::-webkit-slider-thumb {
  border-color: #9aa7b4;
}
.mine {
  margin: 10px 0 0;
  text-align: center;
  font-size: 1.15rem;
}
.mine strong {
  font-family: var(--font-head);
  font-size: 1.5rem;
  color: #ff8a3d;
}
.result {
  text-align: center;
}
.result h2,
.center h2 {
  margin: 4px 0;
  font-size: 1.8rem;
  color: #1d3557;
}
.stars {
  display: flex;
  justify-content: center;
  gap: 4px;
}
.s {
  color: #e3e8ee;
}
.s.on {
  color: #ffc22e;
  animation: starIn 0.5s cubic-bezier(0.2, 1.8, 0.4, 1) backwards;
}
.stars .s:nth-child(2) {
  transform: translateY(-10px) scale(1.12);
}
.credits {
  font-size: 0.75rem;
  color: #6b7f93;
  text-align: center;
}
.pop-enter-active {
  animation: popIn 0.45s cubic-bezier(0.2, 1.6, 0.4, 1);
}
@keyframes popIn {
  from {
    transform: scale(0.7);
    opacity: 0;
  }
}
@keyframes starIn {
  from {
    transform: scale(0) rotate(-90deg);
  }
}
@media (max-width: 600px) {
  .sl {
    grid-template-columns: 1fr 70px;
  }
  .sl .lbl {
    grid-column: 1 / -1;
  }
}
</style>
