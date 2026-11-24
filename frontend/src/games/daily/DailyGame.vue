<script setup lang="ts">
// Vremenski vedeževalec: vsak dan eno vprašanje o včerajšnjem zraku (7 vrst nalog), odgovor takoj.
// Podatki: /api/vceraj (meritve ARSO) ali, če jih še ni, dan iz arhiva. Vaja: naključni dnevi iz arhiva.
import VirZnacka from '@/components/VirZnacka.vue'
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, type Component } from 'vue'
import { zabelezi } from '@/analytics/posthog'
import { RouterLink, useRoute } from 'vue-router'
import AirBuddy from '@/components/AirBuddy.vue'
import Confetti from '../skupno/Confetti.vue'
import GameIcon from '../skupno/GameIcon.vue'
import { sound } from '../skupno/sound'
import { datumSl, nakljucenDan, naloziArhiv, naloziVceraj, type Dan } from './dan'
import { napredek, zabeleziDnevno } from './napredek'
import { dniZapored, trenutniNiz } from '../skupno/niz'
import { mozna, VRSTE, vrstaZaDan, type Rezultat, type Vrsta } from './vrste'
import Barvanje from './naloge/Barvanje.vue'
import Detektiv from './naloge/Detektiv.vue'
import Drsnik from './naloge/Drsnik.vue'
import Pokrovka from './naloge/Pokrovka.vue'
import Razvrsti from './naloge/Razvrsti.vue'
import Ura from './naloge/Ura.vue'
import Zemljevid from './naloge/Zemljevid.vue'

const NALOGE: Record<Vrsta, Component> = {
  zemljevid: Zemljevid,
  drsnik: Drsnik,
  ura: Ura,
  barvanje: Barvanje,
  razvrsti: Razvrsti,
  pokrovka: Pokrovka,
  detektiv: Detektiv,
}

const stanje = ref<'nalagam' | 'naloga' | 'napaka'>('nalagam')
const nacin = ref<'dnevno' | 'vaja'>('dnevno')
const dan = shallowRef<Dan | null>(null)
const izArhiva = ref(false)
const vrsta = ref<Vrsta>('drsnik')
const kljuc = ref(0) // za ponovni zagon naloge
const rezultat = ref<Rezultat | null>(null)
const konfeti = ref(0)
const zvok = ref(sound.enabled)
const dnevniDan = shallowRef<Dan | null>(null)

const vrstaIme = computed(() => VRSTE.find((v) => v.id === vrsta.value)?.ime ?? '')
const zeOdgovorjeno = computed(() => (dnevniDan.value ? napredek.odgovori[dnevniDan.value.datum] : undefined))

// za predstavitev in teste: /igre/daily?vrsta=zemljevid&datum=2026-11-20 (vaja z izbrano nalogo in dnem)
const route = useRoute()
const q = (k: string) => (typeof route.query[k] === 'string' ? (route.query[k] as string) : undefined)

onMounted(async () => {
  try {
    const qv = q('vrsta') as Vrsta | undefined
    if (qv && VRSTE.some((v) => v.id === qv)) {
      const a = await naloziArhiv()
      const d = a.find((x) => x.datum === q('datum')) ?? [...a].reverse().find((x) => mozna(qv, x)) ?? a[a.length - 1]!
      nacin.value = 'vaja'
      dan.value = d
      vrsta.value = mozna(qv, d) ? qv : vrstaZaDan(d)
      stanje.value = 'naloga'
      return
    }
    const r = await naloziVceraj()
    dnevniDan.value = r.dan
    izArhiva.value = r.izArhiva
    if (napredek.odgovori[r.dan.datum] != null) {
      // danes že odgovorjeno – pokažemo povzetek in ponudimo vajo
      dan.value = r.dan
      vrsta.value = vrstaZaDan(r.dan)
      rezultat.value = { zvezdice: napredek.odgovori[r.dan.datum]!, razlaga: '' }
    } else {
      dan.value = r.dan
      vrsta.value = vrstaZaDan(r.dan)
    }
    stanje.value = 'naloga'
  } catch (e) {
    console.error(e)
    stanje.value = 'napaka'
  }
})

function konec(r: Rezultat) {
  rezultat.value = r
  zabelezi('daily_challenge_completed', {
    challenge_mode: nacin.value,
    challenge_type: vrsta.value,
    stars: r.zvezdice,
  })
  if (r.zvezdice >= 2) sound.correct()
  else sound.wrong()
  if (r.zvezdice === 3) konfeti.value++
  if (nacin.value === 'dnevno' && dan.value) zabeleziDnevno(dan.value.datum, r.zvezdice)
  else napredek.zvezdiceVaja += r.zvezdice
}

async function vaja() {
  sound.unlock()
  sound.pop()
  nacin.value = 'vaja'
  const d = await nakljucenDan(dan.value?.datum)
  dan.value = d
  vrsta.value = vrstaZaDan(d, true)
  rezultat.value = null
  kljuc.value++
}

function preklopiZvok() {
  sound.unlock()
  zvok.value = !zvok.value
  sound.setEnabled(zvok.value)
}

// odštevanje do novega vprašanja (lokalna polnoč)
const doJutri = ref('')
function tick() {
  const now = new Date()
  const mid = new Date(now)
  mid.setHours(24, 0, 0, 0)
  const s = Math.max(0, Math.floor((mid.getTime() - now.getTime()) / 1000))
  const pad = (n: number) => String(n).padStart(2, '0')
  doJutri.value = `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`
}
tick()
const timer = window.setInterval(tick, 1000)
onBeforeUnmount(() => window.clearInterval(timer))

const sporocila = ['Ojej, tokrat ne!', 'Blizu!', 'Dobro!', 'Odlično, pravi vedeževalec!']
</script>

<template>
  <div class="vedez" @pointerdown.once="sound.unlock()">
    <Confetti v-if="konfeti" :key="konfeti" />
    <div class="wrap">
      <RouterLink to="/igre" class="back">Nazaj na igre</RouterLink>

      <header class="head">
        <AirBuddy :mood="rezultat && rezultat.zvezdice < 2 ? 0.6 : 0" color="#9b6bff" :size="96" />
        <div>
          <span class="kicker">Igra · vsak dan novo vprašanje</span>
          <h1>Vremenski vedeževalec</h1>
          <div class="chips">
            <span class="chip fire">{{ dniZapored(trenutniNiz(napredek.niz, napredek.zadnjiDan)) }}</span>
            <span class="chip">{{ nacin === 'vaja' ? 'Vaja' : 'Vprašanje dneva' }} · {{ vrstaIme }}</span>
          </div>
        </div>
        <button class="sound" :aria-label="zvok ? 'Izklopi zvok' : 'Vklopi zvok'" @click="preklopiZvok">
          <GameIcon :name="zvok ? 'zvok' : 'tiho'" :size="22" />
        </button>
      </header>

      <div v-if="stanje === 'nalagam'" class="card center">Nalagam včerajšnji dan …</div>
      <div v-else-if="stanje === 'napaka'" class="card center">Podatkov ni bilo mogoče naložiti.</div>

      <template v-else-if="dan">
        <p class="about">
          Vprašanje o dnevu: <strong>{{ datumSl(dan.datum) }}</strong>
          <span class="src"><VirZnacka vrsta="meritev" /> {{ dan.vir }}</span>
        </p>
        <p v-if="nacin === 'dnevno' && izArhiva" class="note">Za včeraj še ni dovolj meritev, zato je vprašanje o dnevu iz arhiva.</p>

        <!-- danes že odgovorjeno -->
        <div v-if="nacin === 'dnevno' && zeOdgovorjeno != null && !rezultat?.razlaga" class="card center done">
          <h2>Današnje vprašanje si že rešil!</h2>
          <div class="stars">
            <GameIcon v-for="i in 3" :key="i" name="zvezda" :size="56" class="s" :class="{ on: i <= zeOdgovorjeno }" />
          </div>
          <p>Novo vprašanje čez <strong class="count">{{ doJutri }}</strong></p>
          <button class="k-btn purple" @click="vaja">Vaja s preteklimi dnevi</button>
        </div>

        <template v-else>
          <div class="card">
            <component :is="NALOGE[vrsta]" :key="`${dan.datum}-${vrsta}-${kljuc}`" :dan="dan" @konec="konec" />
          </div>

          <Transition name="pop">
            <div v-if="rezultat?.razlaga" class="card result">
              <div class="stars">
                <GameIcon v-for="i in 3" :key="i" name="zvezda" :size="64" class="s" :class="{ on: i <= rezultat.zvezdice }" :style="{ animationDelay: `${i * 0.18}s` }" />
              </div>
              <h2>{{ sporocila[rezultat.zvezdice] }}</h2>
              <div class="bubble">
                <AirBuddy :mood="0" color="#7cc8ff" :size="70" />
                <p>{{ rezultat.razlaga }}</p>
              </div>
              <div class="row">
                <button class="k-btn purple" @click="vaja">{{ nacin === 'vaja' ? 'Dodatna vaja' : 'Vaja s preteklimi dnevi' }}</button>
              </div>
              <p v-if="nacin === 'dnevno'" class="next">Novo vprašanje dneva čez <strong class="count">{{ doJutri }}</strong></p>
            </div>
          </Transition>
        </template>
      </template>

      <p class="credits">Meritve: ARSO, EEA · Vreme in višina mejne plasti: Open-Meteo / ERA5 (model) · Zemljevid: Natural Earth</p>
    </div>
  </div>
</template>

<style>
/* skupni gumbi in besedila za naloge (podkomponente) */
.vedez .naloga {
  text-align: center;
}
.vedez .vprasanje {
  margin: 0 0 14px;
  font-family: var(--font-head);
  font-size: clamp(1.15rem, 3.2vw, 1.5rem);
  line-height: 1.25;
  color: #1d3557;
}
.vedez .k-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 56px;
  margin-top: 14px;
  padding: 8px 30px;
  border: 0;
  border-radius: 999px;
  font-family: var(--font-head);
  font-size: 1.35rem;
  font-weight: 800;
  color: #fff;
  cursor: pointer;
  transition: transform 0.1s, opacity 0.2s;
}
.vedez .k-btn:active:not(:disabled) {
  transform: translateY(4px);
}
.vedez .k-btn:disabled {
  opacity: 0.45;
  cursor: default;
}
.vedez .k-btn.green {
  background: #3ccf6e;
  box-shadow: 0 6px 0 #26a052;
}
.vedez .k-btn.purple {
  background: #9b6bff;
  box-shadow: 0 6px 0 #7146d6;
}
.vedez .k-btn.yellow {
  background: #ffc22e;
  box-shadow: 0 6px 0 #d99a00;
  color: #5c3d00;
}
.vedez .k-btn.pink {
  background: #ff6fa5;
  box-shadow: 0 6px 0 #d94783;
}
</style>

<style scoped>
.vedez {
  position: relative;
  min-height: calc(100svh - 64px);
  padding: 16px 0 40px;
  overflow: hidden;
}
.wrap {
  width: min(760px, 100%);
  margin: 0 auto;
  padding: 0 16px;
}
.back {
  display: inline-block;
  margin-bottom: 6px;
  color: var(--brand);
  font-family: var(--font-head);
  font-weight: 800;
  text-decoration: none;
}
.head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.kicker {
  display: block;
  margin-bottom: 4px;
  text-transform: uppercase;
  letter-spacing: 0.2em;
  font-size: 0.75rem;
  font-weight: 800;
  color: color-mix(in srgb, var(--lilac) 78%, var(--ink));
}
.head h1 {
  margin: 0 0 6px;
  font-size: clamp(1.8rem, 5vw, 3rem);
  line-height: 1;
  color: var(--ink);
}
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 12px;
  border-radius: 999px;
  background: #fff;
  font-family: var(--font-head);
  font-weight: 700;
  color: #1d3557;
  box-shadow: 0 3px 0 rgba(0, 0, 0, 0.08);
}
.chip.fire b {
  color: #ff7a59;
}
.chip.star {
  color: #e0a100;
}
.chip.star b {
  color: #1d3557;
}
.sound {
  margin-left: auto;
  flex: none;
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
.about {
  margin: 6px 0;
  font-family: var(--font-body);
  color: #1d3557;
}
.src {
  margin-left: 6px;
  padding: 2px 10px;
  border-radius: 999px;
  background: #fff;
  font-size: 0.8rem;
  font-weight: 700;
  color: #5b6b7b;
}
.note {
  margin: 0 0 8px;
  font-size: 0.9rem;
  color: #a15c00;
}
.card {
  position: relative;
  padding: 18px;
  border-radius: var(--radius);
  background: var(--panel);
  border: 1px solid var(--panel-line);
  box-shadow: var(--shadow);
  margin-bottom: 18px;
}
.card.center {
  text-align: center;
  font-family: var(--font-head);
  font-size: 1.2rem;
}
.done h2,
.result h2 {
  margin: 4px 0 8px;
  font-size: 1.8rem;
  color: #1d3557;
}
.result {
  text-align: center;
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
.bubble {
  display: flex;
  align-items: center;
  gap: 8px;
  text-align: left;
  padding: 10px 14px;
  border-radius: 22px;
  background: #fff8e1;
}
.bubble :deep(svg) {
  flex: none;
}
.bubble p {
  margin: 0;
  font-size: 1.05rem;
  color: #1d3557;
}
.row {
  display: flex;
  justify-content: center;
  gap: 10px;
  flex-wrap: wrap;
}
.next {
  margin: 12px 0 0;
  font-family: var(--font-body);
}
.count {
  font-family: var(--font-head);
  font-size: 1.3rem;
  color: #9b6bff;
  font-variant-numeric: tabular-nums;
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
</style>
