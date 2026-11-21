<script setup lang="ts">
// Kartice dejstev: kup kartic z zanimivostmi iz 10 let meritev ARSO (paket ARSOhack).
// Vsaka kartica se začne z vprašanjem (ugani!), nato se obrne in pokaže odgovor z animiranim grafom,
// veliko številko in enim stavkom; daljša razlaga je pod »Zakaj?«. Kartice listaš s puščicami,
// potegom levo/desno ali tipkami ← →. Odkrite kartice se zbirajo (shranjeno na napravi);
// ko zbereš vse, dobiš značko »Strokovnjak za zrak«.
// Številke izračuna backend/scripts/blog_statistika.py → src/data/zgodovina.json.
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { levelFor } from '@/lib/airQuality'
import z from '@/data/zgodovina.json'

interface Bar {
  label: string
  value: number
  color?: string
  hi?: boolean
}
interface Kartica {
  id: string
  ikona: string
  kicker: string
  vprasanje: string
  nacin: 'izbira' | 'stolpec' // izbira med odgovori ali tapni stolpec v grafu
  moznosti?: string[]
  pravilno: number // indeks pravilne možnosti (ali stolpca)
  stevilka: string // velika številka na hrbtni strani
  stavek: string // en kratek stavek pod številko
  zakaj: string // daljša razlaga (pokaže se na zahtevo)
  color: string
  unit: string // napis nad grafom
  kind: 'bars' | 'calendar' | 'big'
  bars?: Bar[]
}

const fmt = (n: number) => n.toLocaleString('sl-SI', { maximumFractionDigits: 1 })
const pm25Color = (v: number) => levelFor(v).color

// --- izračuni iz podatkov ---
const leta = z.leta
const prvo = leta[0]!
const zadnje = leta[leta.length - 1]!
const padec = Math.round((1 - zadnje.pm10 / prvo.pm10) * 100)
const najvecDni = leta.reduce((a, b) => (b.dniNad50 > a.dniNad50 ? b : a))
const meseci = z.meseci
const iMax = meseci.reduce((im, m, i, a) => (m.pm25 > a[im]!.pm25 ? i : im), 0)
const iMin = meseci.reduce((im, m, i, a) => (m.pm25 < a[im]!.pm25 ? i : im), 0)
const POLNO: Record<string, string> = {
  jan: 'januar', feb: 'februar', mar: 'marec', apr: 'april', maj: 'maj', jun: 'junij',
  jul: 'julij', avg: 'avgust', sep: 'september', okt: 'oktober', nov: 'november', dec: 'december',
}
const ure = z.zimaUre
const maxUra = ure.reduce((a, b) => (b.pm25 > a.pm25 ? b : a))
const minUra = ure.reduce((a, b) => (b.pm25 < a.pm25 ? b : a))
const inv = z.inverzija
const invX = inv.z / inv.brez
const who = z.who
const postaje = z.postaje.seznam
const razponPostaj = Math.max(...postaje.map((p) => p.pm25)) - Math.min(...postaje.map((p) => p.pm25))
const rekordDatum = new Date(z.rekord.datum)
const rekordLeto = rekordDatum.getFullYear()
const novoLeto = z.rekord.datum.endsWith('-01-01')
const datumTxt = (d: Date) => d.toLocaleDateString('sl-SI', { day: 'numeric', month: 'long', year: 'numeric' })

// številski odgovori: pravilna vrednost in dve napačni, urejeno od najmanjše
function stevilske(prava: number, krat: number[]): { moznosti: string[]; pravilno: number } {
  const vse = [prava, ...krat.map((k) => Math.round(prava * k))].sort((a, b) => a - b)
  return { moznosti: vse.map((v) => `${v} dni`), pravilno: vse.indexOf(prava) }
}
const dniOdg = stevilske(zadnje.dniNad50, [2.6, 4.8])

const kartice: Kartica[] = [
  {
    id: 'trend',
    ikona: '📉',
    kicker: `${leta.length} let meritev`,
    vprasanje: `Je zrak v Ljubljani danes boljši ali slabši kot leta ${prvo.leto}?`,
    nacin: 'izbira',
    moznosti: ['Boljši', 'Približno enak', 'Slabši'],
    pravilno: padec > 5 ? 0 : padec < -5 ? 2 : 1,
    stevilka: `−${padec} %`,
    stavek: `Toliko manj delcev PM10 je v zraku kot leta ${prvo.leto}.`,
    zakaj: `Povprečje delcev PM10 na Bežigradu je padlo s ${fmt(prvo.pm10)} µg/m³ (${prvo.leto}) na ${fmt(zadnje.pm10)} µg/m³ (${zadnje.leto}). K temu so pripomogle čistejše peči, priključki na daljinsko ogrevanje in plin ter novejši avtomobili.`,
    color: 'var(--aq-2)',
    unit: 'PM10 na Bežigradu · letno povprečje (µg/m³)',
    kind: 'bars',
    bars: leta.map((l, i) => ({ label: `'${String(l.leto).slice(2)}`, value: l.pm10, hi: i === 0 || i === leta.length - 1 })),
  },
  {
    id: 'dni',
    ikona: '📅',
    kicker: 'Dnevi nad mejo',
    vprasanje: `Koliko dni je bil leta ${zadnje.leto} zrak nad dnevno mejo EU?`,
    nacin: 'izbira',
    ...dniOdg,
    stevilka: `${zadnje.dniNad50} dni`,
    stavek: `Leta ${najvecDni.leto} jih je bilo še ${najvecDni.dniNad50}.`,
    zakaj: `Dnevna meja EU za delce PM10 je 50 µg/m³. Leta ${najvecDni.leto} je bil zrak nad njo kar ${najvecDni.dniNad50} dni, leta ${zadnje.leto} le še ${zadnje.dniNad50}. Največ takih dni je pozimi.`,
    color: 'var(--aq-4)',
    unit: 'Dni s PM10 nad 50 µg/m³ · Bežigrad',
    kind: 'bars',
    bars: leta.map((l) => ({ label: `'${String(l.leto).slice(2)}`, value: l.dniNad50, hi: l === najvecDni || l === zadnje })),
  },
  {
    id: 'meseci',
    ikona: '❄️',
    kicker: 'Po mesecih',
    vprasanje: 'Kateri mesec je zrak najslabši? Tapni stolpec.',
    nacin: 'stolpec',
    pravilno: iMax,
    stevilka: `${fmt(meseci[iMax]!.pm25 / meseci[iMin]!.pm25)}×`,
    stavek: `Toliko več delcev je ${POLNO[meseci[iMax]!.mesec]}a kot ${POLNO[meseci[iMin]!.mesec]}a.`,
    zakaj: `Najslabši mesec je ${POLNO[meseci[iMax]!.mesec]} s povprečno ${fmt(meseci[iMax]!.pm25)} µg/m³ PM2.5, najboljši ${POLNO[meseci[iMin]!.mesec]} s ${fmt(meseci[iMin]!.pm25)}. Pozimi kurimo, mrzel zrak pa se pogosto ujame v kotlini.`,
    color: 'var(--aq-5)',
    unit: `PM2.5 na Bežigradu · povprečje po mesecih ${z.pm25Od}–${z.zadnjeLeto} (µg/m³)`,
    kind: 'bars',
    bars: meseci.map((m, i) => ({ label: m.mesec, value: m.pm25, color: pm25Color(m.pm25), hi: i === iMax || i === iMin })),
  },
  {
    id: 'ure',
    ikona: '🌙',
    kicker: 'Zimski dan',
    vprasanje: 'Kdaj čez zimski dan je zrak najslabši?',
    nacin: 'izbira',
    moznosti: ['Zjutraj', 'Popoldne', 'Zvečer in ponoči'],
    pravilno: maxUra.ura >= 5 && maxUra.ura <= 11 ? 0 : maxUra.ura >= 12 && maxUra.ura <= 17 ? 1 : 2,
    stevilka: `${maxUra.ura}:00`,
    stavek: `Najslabša ura. Najčistejši je zrak okoli ${minUra.ura}. ure – takrat prezrači.`,
    zakaj: `Pozimi je zrak najslabši pozno zvečer (okoli ${maxUra.ura}. ure, ${fmt(maxUra.pm25)} µg/m³), ko ljudje kurijo, zrak pa se ohladi in umiri. Popoldne ga sonce premeša, zato je okoli ${minUra.ura}. ure najčistejši.`,
    color: 'var(--aq-4)',
    unit: 'PM2.5 na Bežigradu · povprečje po urah, november–februar (µg/m³)',
    kind: 'bars',
    bars: ure.map((u) => ({ label: u.ura % 6 === 0 ? `${u.ura}h` : '', value: u.pm25, color: pm25Color(u.pm25), hi: u === maxUra || u === minUra })),
  },
  {
    id: 'inverzija',
    ikona: '🌫️',
    kicker: 'Inverzija',
    vprasanje: 'Koliko več delcev je pozimi v zraku, ko je v kotlini inverzija?',
    nacin: 'izbira',
    moznosti: ['Približno enako', 'Približno 2-krat več', '10-krat več'],
    pravilno: invX < 1.3 ? 0 : invX < 4 ? 1 : 2,
    stevilka: `${fmt(invX)}×`,
    stavek: `Toliko več delcev, ko je hladen zrak ujet pod »pokrovko«.`,
    zakaj: `Ko je na Pasji ravni (1019 m) topleje kot v mestu, je pozimi v zraku povprečno ${fmt(inv.z)} µg/m³ PM2.5, brez inverzije ${fmt(inv.brez)}. Inverzija je kar v ${inv.delezUr} % zimskih ur.`,
    color: 'var(--aq-5)',
    unit: 'PM2.5 na Bežigradu pozimi (µg/m³)',
    kind: 'bars',
    bars: [
      { label: 'brez inverzije', value: inv.brez, color: pm25Color(inv.brez), hi: true },
      { label: 'z inverzijo', value: inv.z, color: pm25Color(inv.z), hi: true },
    ],
  },
  {
    id: 'who',
    ikona: '🩺',
    kicker: 'Smernica WHO',
    vprasanje: `Koliko dni leta ${who.leto} je bil zrak slabši od priporočila Svetovne zdravstvene organizacije?`,
    nacin: 'izbira',
    moznosti: ['Približno en teden', 'Približno tri mesece', 'Več kot pol leta'],
    pravilno: who.dni < 20 ? 0 : who.dni < 180 ? 1 : 2,
    stevilka: `${who.dni} dni`,
    stavek: `To je skoraj vsak ${Math.round(who.izmed / who.dni)}. dan.`,
    zakaj: `WHO priporoča, naj dnevno povprečje PM2.5 ne preseže 15 µg/m³. Leta ${who.leto} je bilo nad to mejo ${who.dni} dni od ${who.izmed}. Vsak kvadratek je en dan, obarvani so dnevi nad mejo – večina jih je pozimi.`,
    color: 'var(--aq-3)',
    unit: `Vsi dnevi leta ${who.leto} · Bežigrad`,
    kind: 'calendar',
  },
  {
    id: 'postaje',
    ikona: '🏙️',
    kicker: 'Po mestu',
    vprasanje: 'Kje v Ljubljani je zrak v povprečju najslabši?',
    nacin: 'izbira',
    moznosti: [...postaje.map((p) => p.ime), 'Povsod podobno'],
    pravilno: razponPostaj < 1.5 ? postaje.length : 0,
    stevilka: `${fmt(Math.min(...postaje.map((p) => p.pm25)))}–${fmt(Math.max(...postaje.map((p) => p.pm25)))}`,
    stavek: 'µg/m³ PM2.5 na vseh treh postajah – razlike so majhne.',
    zakaj: `${postaje.map((p) => `${p.ime} ${fmt(p.pm25)}`).join(', ')} µg/m³ PM2.5 (${z.postaje.od}–${z.postaje.do}). Delci se razlezejo po vsej kotlini, zato šteje, kaj počnemo v celem mestu, ne le ob prometnih cestah.`,
    color: 'var(--aq-3)',
    unit: `PM2.5 · povprečje ${z.postaje.od}–${z.postaje.do} (µg/m³)`,
    kind: 'bars',
    bars: postaje.map((p) => ({ label: p.ime, value: p.pm25, color: pm25Color(p.pm25), hi: true })),
  },
  {
    id: 'rekord',
    ikona: '🎆',
    kicker: 'Rekord',
    vprasanje: `Kateri dan je bil najslabši v ${leta.length} letih meritev?`,
    nacin: 'izbira',
    moznosti: [datumTxt(rekordDatum), `15. julij ${rekordLeto + 2}`, `3. marec ${rekordLeto + 4}`],
    pravilno: 0,
    stevilka: `${fmt(z.rekord.pm10)}`,
    stavek: `µg/m³ PM10 – skoraj ${Math.round(z.rekord.pm10 / 50)}-krat nad dnevno mejo.`,
    zakaj: `Najslabši dan v vseh meritvah je bil ${datumTxt(rekordDatum)}.${novoLeto ? ' Prvi dan leta, takoj po noči z ognjemeti v mrzlem, mirnem zraku.' : ''}`,
    color: 'var(--aq-6)',
    unit: 'PM10 · dnevno povprečje',
    kind: 'big',
  },
]

// --- odgovori (shranjeni na napravi) ---
const KEY = 'zrak-dejstva'
function nalozi(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}')
  } catch {
    return {}
  }
}
const odgovori = reactive<Record<string, number>>(nalozi())
watch(odgovori, (o) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(o))
  } catch {
    /* ni pomembno */
  }
})
const stOdkritih = computed(() => kartice.filter((k) => odgovori[k.id] != null).length)
const vseOdkrite = computed(() => stOdkritih.value === kartice.length)

// --- listanje ---
const ZADNJA = kartice.length // zadnja »kartica« je zbirka
const prvaNeodkrita = kartice.findIndex((k) => odgovori[k.id] == null)
const idx = ref(prvaNeodkrita < 0 ? ZADNJA : prvaNeodkrita) // začni pri prvi neodkriti (ali pri zbirki)
const k = computed(() => kartice[idx.value])
const smer = ref(1)
const zakajOdprto = ref(false)
function pojdi(i: number) {
  if (i < 0 || i > ZADNJA || i === idx.value) return
  smer.value = i > idx.value ? 1 : -1
  idx.value = i
  zakajOdprto.value = false
}
const razkrito = computed(() => !!k.value && odgovori[k.value.id] != null)
const izbrano = computed(() => (k.value ? odgovori[k.value.id] : undefined))
const prav = computed(() => izbrano.value === k.value?.pravilno)

function odgovori_(i: number) {
  if (!k.value || razkrito.value) return
  odgovori[k.value.id] = i
}
function znova() {
  for (const kk of kartice) delete odgovori[kk.id]
  pojdi(0)
}

// --- poteg levo/desno ---
const dx = ref(0)
let startX = 0
let vlecem = false
function onDown(e: PointerEvent) {
  if ((e.target as HTMLElement).closest('button')) return // gumbi naj delujejo normalno
  vlecem = true
  startX = e.clientX
}
function onMove(e: PointerEvent) {
  if (vlecem) dx.value = e.clientX - startX
}
function onUp() {
  if (!vlecem) return
  vlecem = false
  if (dx.value < -70) pojdi(idx.value + 1)
  else if (dx.value > 70) pojdi(idx.value - 1)
  dx.value = 0
}
function onKey(e: KeyboardEvent) {
  const t = e.target as HTMLElement
  if (t.closest('input, textarea')) return
  if (e.key === 'ArrowRight') pojdi(idx.value + 1)
  if (e.key === 'ArrowLeft') pojdi(idx.value - 1)
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

// --- graf ---
const max = computed(() => Math.max(...(k.value?.bars ?? []).map((b) => b.value)) * 1.08)
const zamik = (new Date(who.prviDan).getDay() + 6) % 7
const dnevi = who.dnevno as (number | null)[]
const dayColor = (v: number | null) => (v == null ? 'transparent' : v > 15 ? levelFor(v).color : 'var(--cal-empty)')

// rekord: številka se prešteje navzgor
const stetje = ref(0)
let raf = 0
watch(
  () => [idx.value, razkrito.value] as const,
  () => {
    cancelAnimationFrame(raf)
    if (k.value?.kind !== 'big' || !razkrito.value) return
    const t0 = performance.now()
    const cilj = z.rekord.pm10
    const korak = (t: number) => {
      const p = Math.min(1, (t - t0) / 1400)
      stetje.value = cilj * (1 - (1 - p) ** 3)
      if (p < 1) raf = requestAnimationFrame(korak)
    }
    raf = requestAnimationFrame(korak)
  },
  { immediate: true },
)
onBeforeUnmount(() => cancelAnimationFrame(raf))
</script>

<template>
  <section class="dejstva" aria-label="Kartice dejstev">
    <header class="glava">
      <p><strong>Ugani, obrni in zberi vseh {{ kartice.length }} kartic.</strong> Listaj s puščicami ali potegni kartico levo in desno.</p>
      <div class="zbirka" role="tablist" aria-label="Zbirka kartic">
        <button
          v-for="(kk, i) in kartice"
          :key="kk.id"
          class="mini"
          :class="{ odkrita: odgovori[kk.id] != null, zdaj: i === idx }"
          :style="{ '--c': kk.color }"
          role="tab"
          :aria-selected="i === idx"
          :aria-label="`Kartica ${i + 1}: ${kk.kicker}${odgovori[kk.id] != null ? ' (odkrita)' : ''}`"
          @click="pojdi(i)"
        >
          <span aria-hidden="true">{{ odgovori[kk.id] != null ? kk.ikona : '?' }}</span>
        </button>
        <span class="stevec"><strong>{{ stOdkritih }}</strong>/{{ kartice.length }} odkritih</span>
      </div>
    </header>

    <div class="miza" @pointerdown="onDown" @pointermove="onMove" @pointerup="onUp" @pointercancel="onUp" @pointerleave="onUp">
      <!-- kartice zadaj (samo za videz kupa) -->
      <div v-if="idx < ZADNJA - 1" class="zadaj z2" aria-hidden="true" />
      <div v-if="idx < ZADNJA" class="zadaj z1" aria-hidden="true" />

      <Transition :name="smer > 0 ? 'naprej' : 'nazaj'" mode="out-in">
        <!-- zbirka / značka -->
        <article v-if="!k" key="zbirka" class="kartica konec" :style="{ transform: `translateX(${dx}px) rotate(${dx / 25}deg)` }">
          <template v-if="vseOdkrite">
            <div class="znacka" aria-hidden="true">🏅</div>
            <h3>Strokovnjak za zrak!</h3>
            <p>Zbral si vseh {{ kartice.length }} kartic. Zdaj veš o ljubljanskem zraku več kot večina odraslih.</p>
          </template>
          <template v-else>
            <div class="znacka siva" aria-hidden="true">🏅</div>
            <h3>Še {{ kartice.length - stOdkritih }} do značke</h3>
            <p>Odkrij vse kartice in postani »Strokovnjak za zrak«.</p>
          </template>
          <div class="mreza">
            <button
              v-for="(kk, i) in kartice"
              :key="kk.id"
              class="celica"
              :class="{ odkrita: odgovori[kk.id] != null }"
              :style="{ '--c': kk.color }"
              @click="pojdi(i)"
            >
              <span class="ik" aria-hidden="true">{{ odgovori[kk.id] != null ? kk.ikona : '?' }}</span>
              <span class="ime">{{ kk.kicker }}</span>
              <strong v-if="odgovori[kk.id] != null">{{ kk.stevilka }}</strong>
            </button>
          </div>
          <button v-if="stOdkritih" class="btn ghost znova" @click="znova">Začni znova</button>
        </article>

        <!-- kartica -->
        <article
          v-else
          :key="k.id"
          class="kartica"
          :style="{ '--c': k.color, transform: `translateX(${dx}px) rotate(${dx / 25}deg)` }"
        >
          <div class="vrh">
            <span class="ikona" aria-hidden="true">{{ k.ikona }}</span>
            <span class="kicker">{{ k.kicker }}</span>
            <span class="stran">{{ idx + 1 }} / {{ kartice.length }}</span>
          </div>

          <Transition name="obrni" mode="out-in">
            <!-- sprednja stran: ugani -->
            <div v-if="!razkrito" key="spredaj" class="stran-kartice">
              <h3 class="vprasanje">{{ k.vprasanje }}</h3>
              <div v-if="k.nacin === 'izbira'" class="moznosti">
                <button v-for="(m, i) in k.moznosti" :key="m" class="moznost" @click="odgovori_(i)">{{ m }}</button>
              </div>
              <figure v-else class="graf ugibaj">
                <div class="bars">
                  <button v-for="(b, i) in k.bars" :key="i" class="col" :aria-label="`Izberi ${b.label}`" @click="odgovori_(i)">
                    <span class="bar siv" />
                    <span class="lab">{{ b.label }}</span>
                  </button>
                </div>
              </figure>
              <p class="namig">Klikni svoj odgovor – kartica se obrne.</p>
            </div>

            <!-- hrbtna stran: odgovor -->
            <div v-else key="zadaj" class="stran-kartice odgovor">
              <p class="ocena" :class="{ prav }">
                {{ prav ? 'Bravo, uganil si!' : `Skoraj! Pravilno: ${k.nacin === 'stolpec' ? k.bars![k.pravilno]!.label : k.moznosti![k.pravilno]}` }}
              </p>
              <div class="izid">
                <div class="besedilo">
                  <strong class="stevilka">{{ k.kind === 'big' ? fmt(Math.round(stetje * 10) / 10) : k.stevilka }}</strong>
                  <p class="stavek">{{ k.stavek }}</p>
                  <button class="zakaj-gumb" :aria-expanded="zakajOdprto" @click="zakajOdprto = !zakajOdprto">
                    {{ zakajOdprto ? 'Skrij' : 'Zakaj?' }}
                  </button>
                  <Transition name="zakaj">
                    <p v-if="zakajOdprto" class="zakaj">{{ k.zakaj }}</p>
                  </Transition>
                </div>
                <figure class="graf">
                  <figcaption>{{ k.unit }}</figcaption>
                  <div v-if="k.kind === 'bars'" class="bars rastejo" :class="{ few: (k.bars?.length ?? 0) <= 3 }">
                    <div v-for="(b, i) in k.bars" :key="i" class="col">
                      <div
                        class="bar"
                        :class="{ hi: b.hi, izbran: k.nacin === 'stolpec' && i === izbrano }"
                        :style="{ '--h': `${(b.value / max) * 100}%`, '--c': b.color ?? k.color, '--d': `${i * 45}ms` }"
                      >
                        <span v-if="b.hi" class="val">{{ fmt(b.value) }}</span>
                      </div>
                      <span class="lab">{{ b.label }}</span>
                    </div>
                  </div>
                  <div v-else-if="k.kind === 'calendar'" class="cal">
                    <span v-for="i in zamik" :key="`x${i}`" />
                    <span v-for="(v, i) in dnevi" :key="i" :style="{ background: dayColor(v), '--d': `${i * 4}ms` }" :title="v == null ? '' : `${v} µg/m³`" />
                  </div>
                  <div v-else class="big">
                    <span class="unit">dnevna meja EU: 50 µg/m³</span>
                    <div class="primerjava">
                      <span class="meja" />
                      <span class="rekord" :style="{ '--w': `${Math.min(100, (stetje / z.rekord.pm10) * 100)}%` }" />
                    </div>
                  </div>
                  <p class="vir">Vir: {{ z.vir }}</p>
                </figure>
              </div>
            </div>
          </Transition>
        </article>
      </Transition>

      <button class="puscica levo" aria-label="Prejšnja kartica" :disabled="idx === 0" @click="pojdi(idx - 1)">‹</button>
      <button class="puscica desno" aria-label="Naslednja kartica" :disabled="idx === ZADNJA" @click="pojdi(idx + 1)">›</button>
    </div>

    <div v-if="razkrito && idx < ZADNJA" class="naprej">
      <button class="btn" :style="{ '--btn': k?.color }" @click="pojdi(idx + 1)">
        {{ idx === ZADNJA - 1 ? 'Poglej zbirko' : 'Naslednja kartica' }} →
      </button>
    </div>
  </section>
</template>

<style scoped>
.dejstva {
  max-width: 1100px;
  margin: 0 auto;
  padding: 8px 16px 40px;
}
.glava {
  text-align: center;
  margin-bottom: 18px;
}
.glava h2 {
  font-size: clamp(1.9rem, 4.5vw, 2.8rem);
  margin-bottom: 4px;
}
.glava p {
  margin: 0 auto 14px;
  max-width: 560px;
  color: var(--scene-text);
}
.zbirka {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
  gap: 8px;
}
.mini {
  width: 38px;
  height: 48px;
  border-radius: 9px;
  border: 2px dashed color-mix(in srgb, var(--scene-ink) 22%, transparent);
  background: color-mix(in srgb, var(--scene-ink) 4%, transparent);
  color: var(--scene-muted);
  font-weight: 800;
  font-size: 1.05rem;
  display: grid;
  place-items: center;
  padding: 0;
  transition:
    transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1),
    background 0.3s;
}
.mini.odkrita {
  border: 2px solid var(--c);
  background: color-mix(in srgb, var(--c) 22%, var(--card));
}
.mini.zdaj {
  transform: translateY(-5px);
  box-shadow: 0 6px 0 -2px color-mix(in srgb, var(--scene-ink) 25%, transparent);
}
.mini:hover {
  transform: translateY(-3px) rotate(-4deg);
}
.stevec {
  margin-left: 8px;
  font-weight: 800;
  color: var(--scene-text);
}
.stevec strong {
  font-family: var(--font-head);
  font-size: 1.4rem;
  color: var(--scene-ink);
}

/* --- miza s kupom kartic --- */
.miza {
  position: relative;
  max-width: 880px;
  margin: 0 auto;
  padding: 0 56px;
  touch-action: pan-y;
  user-select: none;
}
.zadaj {
  position: absolute;
  inset: 14px 70px -10px;
  border-radius: 28px;
  background: var(--card);
  border: 1px solid var(--panel-line);
  box-shadow: var(--shadow);
}
.zadaj.z1 {
  transform: rotate(2.2deg) translateY(8px);
}
.zadaj.z2 {
  transform: rotate(-2.6deg) translateY(16px);
  opacity: 0.7;
}
.kartica {
  position: relative;
  min-height: 420px;
  padding: 20px 26px 24px;
  border-radius: 28px;
  background: var(--card);
  border: 2px solid color-mix(in srgb, var(--c, var(--accent)) 45%, var(--panel-line));
  box-shadow:
    0 8px 0 -2px color-mix(in srgb, var(--c, var(--accent)) 30%, transparent),
    0 30px 50px -30px rgba(31, 45, 77, 0.45);
  cursor: grab;
}
.kartica:active {
  cursor: grabbing;
}
.vrh {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
}
.ikona {
  font-size: 1.6rem;
}
.vrh .kicker {
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.16em;
  font-size: 0.78rem;
  color: color-mix(in srgb, var(--c) 75%, var(--scene-ink));
}
.stran {
  margin-left: auto;
  font-weight: 800;
  font-size: 0.85rem;
  color: var(--scene-muted);
}

/* sprednja stran */
.vprasanje {
  font-size: clamp(1.4rem, 3vw, 2rem);
  max-width: 640px;
  margin: 8px 0 18px;
}
.moznosti {
  display: grid;
  gap: 10px;
  max-width: 520px;
}
.moznost {
  text-align: left;
  padding: 14px 18px;
  border-radius: 16px;
  border: 2px solid color-mix(in srgb, var(--c) 40%, var(--panel-line));
  background: color-mix(in srgb, var(--c) 7%, var(--card));
  color: var(--scene-ink);
  font-weight: 800;
  font-size: 1.05rem;
  box-shadow: 0 4px 0 color-mix(in srgb, var(--c) 30%, transparent);
  transition:
    transform 0.15s,
    box-shadow 0.15s,
    background 0.2s;
}
.moznost:hover {
  transform: translateY(-2px);
  background: color-mix(in srgb, var(--c) 16%, var(--card));
}
.moznost:active {
  transform: translateY(3px);
  box-shadow: 0 1px 0 color-mix(in srgb, var(--c) 30%, transparent);
}
.namig {
  margin-top: 16px;
  color: var(--scene-muted);
  font-size: 0.9rem;
  font-weight: 700;
}

/* hrbtna stran */
.ocena {
  display: inline-block;
  margin: 0 0 14px;
  padding: 4px 14px;
  border-radius: 999px;
  font-weight: 800;
  font-size: 0.9rem;
  background: color-mix(in srgb, var(--aq-3) 22%, transparent);
  color: color-mix(in srgb, var(--aq-4) 70%, var(--scene-ink));
}
.ocena.prav {
  background: color-mix(in srgb, var(--aq-1) 20%, transparent);
  color: color-mix(in srgb, var(--aq-1) 70%, var(--scene-ink));
}
.izid {
  display: grid;
  grid-template-columns: minmax(200px, 0.8fr) 1.4fr;
  gap: 26px;
  align-items: start;
}
.stevilka {
  display: block;
  font-family: var(--font-head);
  font-size: clamp(3rem, 8vw, 5rem);
  line-height: 1;
  color: color-mix(in srgb, var(--c) 82%, var(--scene-ink));
  animation: poskok 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
}
@keyframes poskok {
  from {
    transform: scale(0.6);
    opacity: 0;
  }
}
.stavek {
  margin: 8px 0 12px;
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--scene-ink);
}
.zakaj-gumb {
  padding: 4px 14px;
  border-radius: 999px;
  border: 2px solid var(--line);
  background: transparent;
  color: var(--scene-text);
  font-weight: 800;
  font-size: 0.9rem;
}
.zakaj-gumb:hover {
  border-color: var(--c);
}
.zakaj {
  margin-top: 10px;
  color: var(--scene-text);
  font-size: 0.98rem;
}

/* graf */
.graf {
  margin: 0;
  --chart-h: 190px;
}
.graf figcaption {
  color: var(--scene-muted);
  font-weight: 700;
  font-size: 0.82rem;
  margin-bottom: 10px;
}
.bars {
  display: flex;
  align-items: flex-end;
  gap: 4px;
  padding-top: 24px;
  height: calc(var(--chart-h) + 48px);
}
.bars.few {
  gap: 24px;
  padding-left: 8%;
  padding-right: 8%;
}
.col {
  flex: 1;
  min-width: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  align-items: stretch;
  padding: 0;
  border: 0;
  background: none;
}
.bar {
  position: relative;
  height: var(--h);
  min-height: 4px;
  max-height: var(--chart-h);
  border-radius: 6px 6px 2px 2px;
  background: var(--c);
  opacity: 0.45;
}
.bar.hi {
  opacity: 1;
}
.bar.izbran {
  outline: 3px solid var(--scene-ink);
  outline-offset: 2px;
}
/* razkritje: stolpci zrastejo eden za drugim */
.rastejo .bar {
  animation: rast 0.7s cubic-bezier(0.3, 0.8, 0.3, 1) both;
  animation-delay: var(--d);
  transform-origin: bottom;
}
@keyframes rast {
  from {
    transform: scaleY(0);
  }
}
.rastejo .val {
  animation: pojavi 0.4s ease both;
  animation-delay: calc(var(--d) + 0.5s);
}
@keyframes pojavi {
  from {
    opacity: 0;
    transform: translate(-50%, 6px);
  }
}
.val {
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  padding-bottom: 3px;
  font-family: var(--font-head);
  font-size: 1rem;
  white-space: nowrap;
  color: var(--scene-ink);
}
.lab {
  height: 24px;
  padding-top: 6px;
  text-align: center;
  font-size: 0.72rem;
  color: var(--scene-muted);
  white-space: nowrap;
}
/* ugibanje: sivi stolpci, ki se dajo klikniti */
.ugibaj {
  --chart-h: 170px;
  max-width: 640px;
}
.ugibaj .col {
  cursor: pointer;
}
.bar.siv {
  display: block;
  height: 55%; /* vsi enako visoki, da ne izdajo odgovora */
  background: color-mix(in srgb, var(--scene-ink) 14%, transparent);
  opacity: 1;
  transition:
    background 0.2s,
    transform 0.2s;
}
.ugibaj .col:hover .bar.siv {
  background: color-mix(in srgb, var(--c) 60%, transparent);
  transform: translateY(-4px);
}
.cal {
  display: grid;
  grid-template-rows: repeat(7, 1fr);
  grid-auto-flow: column;
  gap: 2px;
  height: var(--chart-h);
}
/* koledar se obarva dan za dnem */
.cal span {
  border-radius: 2px;
  animation: dan 0.3s ease both;
  animation-delay: var(--d, 0ms);
}
@keyframes dan {
  from {
    opacity: 0;
    transform: scale(0.3);
  }
}
.big {
  height: calc(var(--chart-h) + 48px);
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 10px;
}
.big .unit {
  font-weight: 700;
  color: var(--scene-muted);
}
.primerjava {
  position: relative;
  height: 46px;
  border-radius: 12px;
  background: color-mix(in srgb, var(--scene-ink) 6%, transparent);
  overflow: hidden;
}
.primerjava .meja {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: calc(50 / 137.4 * 100%);
  border-right: 3px dashed var(--scene-ink);
  background: color-mix(in srgb, var(--aq-1) 30%, transparent);
}
.primerjava .rekord {
  position: absolute;
  top: 10px;
  bottom: 10px;
  left: 0;
  width: var(--w);
  border-radius: 0 8px 8px 0;
  background: var(--aq-6);
}
.vir {
  margin: 10px 0 0;
  font-size: 0.72rem;
  color: var(--scene-muted);
}

/* zbirka / značka */
.konec {
  text-align: center;
}
.znacka {
  font-size: 4rem;
  line-height: 1;
  margin: 8px 0 6px;
  animation: poskok 0.7s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.znacka.siva {
  filter: grayscale(1);
  opacity: 0.4;
  animation: none;
}
.konec h3 {
  font-size: clamp(1.6rem, 3.6vw, 2.2rem);
  margin-bottom: 4px;
}
.konec p {
  color: var(--scene-text);
  margin: 0 auto 18px;
  max-width: 480px;
}
.mreza {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  text-align: left;
}
.celica {
  display: grid;
  gap: 2px;
  padding: 12px;
  border-radius: 16px;
  border: 2px dashed color-mix(in srgb, var(--scene-ink) 20%, transparent);
  background: transparent;
  color: var(--scene-muted);
  transition: transform 0.2s;
}
.celica.odkrita {
  border: 2px solid var(--c);
  background: color-mix(in srgb, var(--c) 12%, var(--card));
  color: var(--scene-ink);
}
.celica:hover {
  transform: translateY(-3px);
}
.celica .ik {
  font-size: 1.4rem;
}
.celica .ime {
  font-weight: 800;
  font-size: 0.85rem;
}
.celica strong {
  font-family: var(--font-head);
  font-size: 1.3rem;
  color: color-mix(in srgb, var(--c) 80%, var(--scene-ink));
}
.znova {
  margin-top: 18px;
}

/* puščice */
.puscica {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 46px;
  height: 46px;
  border-radius: 50%;
  border: 2px solid var(--line);
  background: var(--card);
  color: var(--scene-ink);
  font-size: 1.6rem;
  font-weight: 800;
  line-height: 1;
  box-shadow: var(--shadow);
  z-index: 2;
}
.puscica.levo {
  left: 0;
}
.puscica.desno {
  right: 0;
}
.puscica:disabled {
  opacity: 0.3;
}
.naprej {
  display: flex;
  justify-content: center;
  margin-top: 26px;
}

/* prehodi: kartica odleti levo/desno, nova pride z druge strani; obračanje okrog navpične osi */
.naprej-enter-active,
.naprej-leave-active,
.nazaj-enter-active,
.nazaj-leave-active {
  transition:
    transform 0.32s cubic-bezier(0.3, 0.8, 0.3, 1),
    opacity 0.32s;
}
.naprej-leave-to,
.nazaj-enter-from {
  transform: translateX(-60px) rotate(-6deg) !important;
  opacity: 0;
}
.naprej-enter-from,
.nazaj-leave-to {
  transform: translateX(60px) rotate(6deg) !important;
  opacity: 0;
}
.obrni-enter-active,
.obrni-leave-active {
  transition:
    transform 0.25s ease,
    opacity 0.25s ease;
}
.obrni-leave-to {
  transform: perspective(900px) rotateY(80deg);
  opacity: 0;
}
.obrni-enter-from {
  transform: perspective(900px) rotateY(-80deg);
  opacity: 0;
}
.zakaj-enter-active,
.zakaj-leave-active {
  transition:
    opacity 0.25s,
    transform 0.25s;
}
.zakaj-enter-from,
.zakaj-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

@media (max-width: 760px) {
  .miza {
    padding: 0;
    margin-bottom: 72px; /* prostor za puščici pod kartico */
  }
  .zadaj {
    inset: 12px 14px -10px;
  }
  .kartica {
    min-height: 0;
    padding: 18px 16px 20px;
  }
  .izid {
    grid-template-columns: 1fr;
    gap: 14px;
  }
  .puscica {
    top: auto;
    bottom: -64px;
    transform: none;
  }
  .puscica.levo {
    left: calc(50% - 120px);
  }
  .puscica.desno {
    right: calc(50% - 120px);
  }
  .naprej {
    margin-top: 8px;
  }
  .graf {
    --chart-h: 160px;
  }
  .lab {
    font-size: 0.6rem;
  }
  .mreza {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
