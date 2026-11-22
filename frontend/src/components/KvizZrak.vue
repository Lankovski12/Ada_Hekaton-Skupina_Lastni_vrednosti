<script setup lang="ts">
// Kviz o zraku: kartice z vprašanji iz 10 let meritev ARSO (paket ARSOhack).
// Vprašanja so zastavljena drugače kot dejstva na strani Podatki, da preverijo, kaj si si zapomnil.
// Klikni odgovor – kartica se obrne in pokaže pravilen odgovor z animiranim grafom.
// Listaš s puščicami, potegom levo/desno ali tipkami ← →. Na koncu: rezultat in sporočilo.
// Številke izračuna backend/scripts/blog_statistika.py → src/data/zgodovina.json.
import VirZnacka from '@/components/VirZnacka.vue'
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'

const emit = defineEmits<{ zapri: [] }>()
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
const novoLeto = z.rekord.datum.endsWith('-01-01')
const datumTxt = (d: Date) => d.toLocaleDateString('sl-SI', { day: 'numeric', month: 'long', year: 'numeric' })

const MESEC_POLNO = (kratko: string) => POLNO[kratko] ?? kratko
const dobriDni = who.izmed - who.dni
const kratNadMejo = z.rekord.pm10 / 50
const zjutraj = (h: number) => h >= 5 && h <= 11
const popoldne = (h: number) => h >= 12 && h <= 17

const kartice: Kartica[] = [
  {
    id: 'pm10-2016',
    kicker: 'Pred desetimi leti',
    vprasanje: `Koliko delcev PM10 je bilo povprečno v zraku na Bežigradu leta ${prvo.leto}?`,
    nacin: 'izbira',
    moznosti: [`${fmt(Math.round(prvo.pm10 * 0.45))} µg/m³`, `${fmt(Math.round(prvo.pm10 * 0.7))} µg/m³`, `${fmt(Math.round(prvo.pm10))} µg/m³`],
    pravilno: 2,
    stevilka: `${fmt(prvo.pm10)} µg/m³`,
    stavek: `Leta ${zadnje.leto} le še ${fmt(zadnje.pm10)} – za ${padec} % manj.`,
    zakaj: `Zrak se je v desetih letih opazno izboljšal: čistejše peči, več priključkov na daljinsko ogrevanje in plin ter novejši avtomobili.`,
    color: 'var(--aq-2)',
    unit: 'PM10 na Bežigradu · letno povprečje (µg/m³)',
    kind: 'bars',
    bars: leta.map((l, i) => ({ label: `'${String(l.leto).slice(2)}`, value: l.pm10, hi: i === 0 || i === leta.length - 1 })),
  },
  {
    id: 'najvec-dni',
    kicker: 'Najslabše leto',
    vprasanje: 'V katerem letu je bilo največ dni s preveč delci v zraku? Tapni stolpec.',
    nacin: 'stolpec',
    pravilno: leta.indexOf(najvecDni),
    stevilka: `${najvecDni.dniNad50} dni`,
    stavek: `Leta ${najvecDni.leto} je bil zrak toliko dni nad dnevno mejo EU (50 µg/m³ PM10).`,
    zakaj: `Leta ${zadnje.leto} je bilo takih dni le še ${zadnje.dniNad50}. Največ jih je pozimi, ko kurimo in se mrzel zrak ujame v kotlini.`,
    color: 'var(--aq-4)',
    unit: 'Dni s PM10 nad 50 µg/m³ · Bežigrad',
    kind: 'bars',
    bars: leta.map((l) => ({ label: `'${String(l.leto).slice(2)}`, value: l.dniNad50, hi: l === najvecDni || l === zadnje })),
  },
  {
    id: 'najcistejsi-mesec',
    kicker: 'Najčistejši mesec',
    vprasanje: 'Kateri mesec je zrak v Ljubljani v povprečju najčistejši?',
    nacin: 'izbira',
    moznosti: [MESEC_POLNO(meseci[iMin]!.mesec), MESEC_POLNO(meseci[iMax]!.mesec), 'oktober'],
    pravilno: 0,
    stevilka: MESEC_POLNO(meseci[iMin]!.mesec),
    stavek: `Povprečno le ${fmt(meseci[iMin]!.pm25)} µg/m³ PM2.5 – ${fmt(meseci[iMax]!.pm25 / meseci[iMin]!.pm25)}-krat manj kot ${MESEC_POLNO(meseci[iMax]!.mesec)}.`,
    zakaj: 'Spomladi in poleti ne kurimo, sonce in veter pa zrak premešata, zato se delci ne nabirajo pri tleh.',
    color: 'var(--aq-1)',
    unit: `PM2.5 na Bežigradu · povprečje po mesecih ${z.pm25Od}–${z.zadnjeLeto} (µg/m³)`,
    kind: 'bars',
    bars: meseci.map((m, i) => ({ label: m.mesec, value: m.pm25, color: pm25Color(m.pm25), hi: i === iMax || i === iMin })),
  },
  {
    id: 'zracenje',
    kicker: 'Zračenje pozimi',
    vprasanje: 'Kdaj je pozimi najbolje prezračiti stanovanje?',
    nacin: 'izbira',
    moznosti: ['Zgodaj zjutraj', 'Popoldne', 'Pozno zvečer'],
    pravilno: zjutraj(minUra.ura) ? 0 : popoldne(minUra.ura) ? 1 : 2,
    stevilka: `okoli ${minUra.ura}:00`,
    stavek: `Takrat je zrak pozimi najčistejši (${fmt(minUra.pm25)} µg/m³). Najslabši je okoli ${maxUra.ura}. ure.`,
    zakaj: 'Popoldne sonce zrak ogreje in premeša, zvečer pa se ohladi, umiri in ujame dim iz dimnikov. Okna odpri na široko za 5–10 minut.',
    color: 'var(--brand)',
    unit: 'PM2.5 na Bežigradu · povprečje po urah, november–februar (µg/m³)',
    kind: 'bars',
    bars: ure.map((u) => ({ label: u.ura % 6 === 0 ? `${u.ura}h` : '', value: u.pm25, color: pm25Color(u.pm25), hi: u === maxUra || u === minUra })),
  },
  {
    id: 'inverzija-delez',
    kicker: 'Inverzija',
    vprasanje: 'Kolikšen del zimskih ur je hladen zrak ujet na dnu kotline (inverzija)?',
    nacin: 'izbira',
    moznosti: [`okoli ${inv.delezUr} %`, `okoli ${inv.delezUr * 2 + 5} %`, `okoli ${inv.delezUr * 3 + 10} %`],
    pravilno: 0,
    stevilka: `${inv.delezUr} %`,
    stavek: `Skoraj vsaka ${Math.round(100 / inv.delezUr)}. zimska ura – takrat je delcev ${fmt(invX)}-krat več.`,
    zakaj: `Ob inverziji je na Pasji ravni (1019 m) topleje kot v mestu. Pozimi je takrat v zraku povprečno ${fmt(inv.z)} µg/m³ PM2.5, sicer ${fmt(inv.brez)}.`,
    color: 'var(--aq-5)',
    unit: 'PM2.5 na Bežigradu pozimi (µg/m³)',
    kind: 'bars',
    bars: [
      { label: 'brez inverzije', value: inv.brez, color: pm25Color(inv.brez), hi: true },
      { label: 'z inverzijo', value: inv.z, color: pm25Color(inv.z), hi: true },
    ],
  },
  {
    id: 'cisti-dnevi',
    kicker: 'Čisti dnevi',
    vprasanje: `Koliko dni leta ${who.leto} je bil zrak dovolj čist po priporočilu Svetovne zdravstvene organizacije?`,
    nacin: 'izbira',
    moznosti: ['Približno 3 mesece', 'Približno 9 mesecev', 'Skoraj vse leto'],
    pravilno: dobriDni < 120 ? 0 : dobriDni < 330 ? 1 : 2,
    stevilka: `${dobriDni} dni`,
    stavek: `Ostalih ${who.dni} dni je bil zrak nad priporočeno mejo (15 µg/m³ PM2.5).`,
    zakaj: 'Na koledarju so obarvani dnevi nad mejo. Skoraj vsi so v hladnem delu leta.',
    color: 'var(--aq-3)',
    unit: `Vsi dnevi leta ${who.leto} · Bežigrad`,
    kind: 'calendar',
  },
  {
    id: 'razlika-postaj',
    kicker: 'Po mestu',
    vprasanje: 'Kako velika je razlika med najbolj in najmanj onesnaženo merilno postajo v Ljubljani?',
    nacin: 'izbira',
    moznosti: ['Manj kot 1 µg/m³', 'Približno 5 µg/m³', 'Več kot 10 µg/m³'],
    pravilno: razponPostaj < 2.5 ? 0 : razponPostaj < 8 ? 1 : 2,
    stevilka: `${fmt(razponPostaj)} µg/m³`,
    stavek: 'Zrak je po vsem mestu skoraj enak – tudi ob prometni Celovški.',
    zakaj: `${postaje.map((p) => `${p.ime} ${fmt(p.pm25)}`).join(', ')} µg/m³ PM2.5 (${z.postaje.od}–${z.postaje.do}). Delci se razlezejo po vsej kotlini, zato šteje, kaj počnemo v celem mestu.`,
    color: 'var(--aq-3)',
    unit: `PM2.5 · povprečje ${z.postaje.od}–${z.postaje.do} (µg/m³)`,
    kind: 'bars',
    bars: postaje.map((p) => ({ label: p.ime, value: p.pm25, color: pm25Color(p.pm25), hi: true })),
  },
  {
    id: 'rekord-krat',
    kicker: 'Rekord',
    vprasanje: 'Kolikokrat je bila na najslabši dan v desetih letih presežena dnevna meja EU (50 µg/m³ PM10)?',
    nacin: 'izbira',
    moznosti: ['Komaj presežena', 'Približno 1,5-krat', `Skoraj ${Math.round(kratNadMejo)}-krat`],
    pravilno: 2,
    stevilka: `${fmt(z.rekord.pm10)}`,
    stavek: `µg/m³ PM10 dne ${datumTxt(rekordDatum)} – ${fmt(kratNadMejo)}-krat nad mejo.`,
    zakaj: `${novoLeto ? 'Prvi dan leta, takoj po noči z ognjemeti v mrzlem, mirnem zraku. ' : ''}Tak dan je redek, a pokaže, kako hitro se zrak v kotlini lahko poslabša.`,
    color: 'var(--aq-6)',
    unit: 'PM10 · dnevno povprečje',
    kind: 'big',
  },
]

// --- odgovori (vsak kviz se začne na novo) ---
const odgovori = reactive<Record<string, number>>({})
const stOdgovorjenih = computed(() => kartice.filter((k) => odgovori[k.id] != null).length)
const stPravilnih = computed(() => kartice.filter((k) => odgovori[k.id] === k.pravilno).length)
const konec = computed(() => stOdgovorjenih.value === kartice.length)

// --- listanje ---
const ZADNJA = kartice.length // zadnja »kartica« je rezultat
const idx = ref(0)
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
  if (e.key === 'Escape') emit('zapri')
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
  <section class="dejstva" aria-label="Kviz o zraku">
    <header class="glava">
      <h2>Kviz: Ali veš kakšen zrak dihaš?</h2>
      <p>{{ kartice.length }} vprašanj iz naših meritev. Klikni odgovor, kartica se obrne. Listaj s puščicami ali potegni kartico.</p>
      <div class="zbirka" role="tablist" aria-label="Vprašanja">
        <button
          v-for="(kk, i) in kartice"
          :key="kk.id"
          class="mini"
          :class="{ odkrita: odgovori[kk.id] != null, prav: odgovori[kk.id] === kk.pravilno, narobe: odgovori[kk.id] != null && odgovori[kk.id] !== kk.pravilno, zdaj: i === idx }"
          :style="{ '--c': kk.color }"
          role="tab"
          :aria-selected="i === idx"
          :aria-label="`Vprašanje ${i + 1}${odgovori[kk.id] == null ? '' : odgovori[kk.id] === kk.pravilno ? ' (pravilno)' : ' (napačno)'}`"
          @click="pojdi(i)"
        >
          <span aria-hidden="true">{{ i + 1 }}</span>
        </button>
        <span class="stevec">Pravilno: <strong>{{ stPravilnih }}</strong>/{{ stOdgovorjenih }}</span>
      </div>
    </header>

    <div class="miza" @pointerdown="onDown" @pointermove="onMove" @pointerup="onUp" @pointercancel="onUp" @pointerleave="onUp">
      <!-- kartice zadaj (samo za videz kupa) -->
      <div v-if="idx < ZADNJA - 1" class="zadaj z2" aria-hidden="true" />
      <div v-if="idx < ZADNJA" class="zadaj z1" aria-hidden="true" />

      <Transition :name="smer > 0 ? 'naprej' : 'nazaj'" mode="out-in">
        <!-- konec kviza -->
        <article v-if="!k" key="konec" class="kartica konec" :style="{ transform: `translateX(${dx}px) rotate(${dx / 25}deg)` }">
          <template v-if="konec">
            <p class="rezultat"><strong>{{ stPravilnih }}</strong> / {{ kartice.length }}</p>
            <h3>{{ stPravilnih === kartice.length ? 'Odlično, vse pravilno!' : stPravilnih >= kartice.length / 2 ? 'Bravo, dobro ti gre!' : 'Lep začetek!' }}</h3>
            <p class="sporocilo">
              Dobro je, da se o kakovosti zraka ozaveščamo. Onesnažen zrak vpliva na zdravje vseh nas – najbolj
              na otroke, starejše in bolnike. Ko veš, kdaj in zakaj je zrak slab, lahko bolje zaščitiš sebe in
              svoje bližnje, hkrati pa s svojimi odločitvami pomagaš, da bo zrak v Ljubljani še čistejši.
            </p>
            <p class="poziv">Deli, kar si izvedel – čist zrak je skupna stvar.</p>
          </template>
          <template v-else>
            <h3>Še {{ kartice.length - stOdgovorjenih }} {{ kartice.length - stOdgovorjenih === 1 ? 'vprašanje' : 'vprašanj' }}</h3>
            <p class="sporocilo">Odgovori na vsa vprašanja in poglej svoj rezultat.</p>
            <div class="mreza">
              <button
                v-for="(kk, i) in kartice"
                :key="kk.id"
                class="celica"
                :class="{ odkrita: odgovori[kk.id] != null }"
                :style="{ '--c': kk.color }"
                @click="pojdi(i)"
              >
                <span class="ik">{{ i + 1 }}</span>
                <span class="ime">{{ kk.kicker }}</span>
              </button>
            </div>
          </template>
          <div class="gumbi">
            <button v-if="stOdgovorjenih" class="btn ghost" @click="znova">Ponovi kviz</button>
            <button class="btn" @click="emit('zapri')">Zapri</button>
          </div>
        </article>

        <!-- kartica -->
        <article
          v-else
          :key="k.id"
          class="kartica"
          :style="{ '--c': k.color, transform: `translateX(${dx}px) rotate(${dx / 25}deg)` }"
        >
          <div class="vrh">
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
                {{ prav ? 'Pravilno!' : `Ne čisto. Pravilen odgovor: ${k.nacin === 'stolpec' ? k.bars![k.pravilno]!.label.replace("'", '20') : k.moznosti![k.pravilno]}` }}
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
                  <p class="vir"><VirZnacka vrsta="meritev" /> {{ z.vir }}</p>
                </figure>
              </div>
            </div>
          </Transition>
        </article>
      </Transition>

      <button class="puscica levo" aria-label="Prejšnje vprašanje" :disabled="idx === 0" @click="pojdi(idx - 1)">‹</button>
      <button class="puscica desno" aria-label="Naslednje vprašanje" :disabled="idx === ZADNJA" @click="pojdi(idx + 1)">›</button>
    </div>

    <div v-if="razkrito && idx < ZADNJA" class="naprej">
      <button class="btn" :style="{ '--btn': k?.color }" @click="pojdi(idx + 1)">
        {{ idx === ZADNJA - 1 ? 'Poglej rezultat' : 'Naslednje vprašanje' }} →
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
.glava h2 {
  font-size: clamp(1.7rem, 4vw, 2.4rem);
  margin: 0 0 4px;
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
.mini.prav {
  border: 2px solid var(--aq-1);
  background: color-mix(in srgb, var(--aq-1) 25%, var(--card));
  color: var(--ink);
}
.mini.narobe {
  border: 2px solid var(--aq-5);
  background: color-mix(in srgb, var(--aq-5) 18%, var(--card));
  color: var(--ink);
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
.rezultat {
  margin: 4px auto 0 !important;
  font-family: var(--font-head);
  font-size: 1.6rem;
  color: var(--scene-muted) !important;
}
.rezultat strong {
  font-size: 4.2rem;
  line-height: 1;
  color: var(--aq-1);
  animation: poskok 0.7s cubic-bezier(0.34, 1.56, 0.64, 1);
  display: inline-block;
}
.sporocilo {
  font-size: 1.05rem;
  line-height: 1.6;
}
.poziv {
  font-weight: 800;
  color: var(--scene-ink) !important;
}
.gumbi {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 8px;
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
