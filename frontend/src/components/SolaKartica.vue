<script setup lang="ts">
// Kartica »Tvoja šola ali vrtec«: kaj pove o okolici izbrane šole vsak vir podatkov posebej.
// - lega v kotlini in kolikokrat je bila pozimi pod plastjo hladnega zraka (relief + radiosondaža: ocena)
// - prispevek dima iz malih kurišč v okolici (model ARSO GRAL, leto 2021)
// - promet osebnih vozil, samo v primerjavi z drugimi šolami (model ARSO GRAL; lestvica ni zanesljiva)
// - najbližja merilna postaja ARSO in njena zadnja meritev
// - najčistejša ura v šolskem času ta mesec (povprečje meritev ARSO)
// Podatke pripravi backend/scripts/zemljevid_sole.py → public/assets/map/sole.json.
import { computed } from 'vue'
import VirZnacka from '@/components/VirZnacka.vue'
import { useAirData } from '@/composables/useAirData'
import { levelFor } from '@/lib/airQuality'
import { klimaLabel, typical } from '@/lib/klima'

export interface Sola {
  id: number
  ime: string
  kat: 'sola' | 'vrtec'
  naslov: string | null
  x: number
  y: number
  nadDnom: number
  cs: string | null
  podMeglo: number | null
  kurisca?: { januar: number; vecer: number; urNad25: number; rang: number; polmer: number }
  promet?: { relativno: number; rang: number }
}
export interface SoleMeta {
  vir: string
  polmer_m: number
  zimskihJuter: number
  kurisca: { januarMediana: number; januarMax: number }
}

const props = defineProps<{
  sola: Sola
  meta: SoleMeta
  postaje: { id: string; ime: string; x: number; y: number }[]
}>()

const { now } = useAirData()

const pct = (v: number) => `${Math.round(v * 100)} %`
const fmt = (n: number) => n.toLocaleString('sl-SI', { maximumFractionDigits: 1 })
const km = (m: number) => (m < 1000 ? `${Math.round(m / 10) * 10} m` : `${fmt(m / 1000)} km`)
const hh = (h: number) => `${String(h).padStart(2, '0')}:00`

const kdo = computed(() => (props.sola.kat === 'vrtec' ? 'vrtec' : 'šola'))
const kogaNaziv = computed(() => (props.sola.kat === 'vrtec' ? 'vrtcev' : 'šol'))

// najbližja postaja ARSO in njena zadnja meritev
const postaja = computed(() => {
  const s = props.sola
  const naj = props.postaje
    .map((p) => ({ ...p, d: Math.hypot(p.x - s.x, p.y - s.y) }))
    .sort((a, b) => a.d - b.d)[0]
  if (!naj) return null
  const m = now.value?.postaje.find((p) => p.vir === 'meritev' && (p.id === naj.id || p.ime.includes(naj.ime)))
  return { ime: naj.ime, d: naj.d, pm: m?.pm25 != null ? Math.round(m.pm25) : null }
})

// najčistejša ura med 8. in 16. uro v tem mesecu (povprečje meritev ARSO na Bežigradu)
const solskaUra = computed(() => {
  let best = { h: 8, pm: Infinity }
  let worst = { h: 8, pm: -Infinity }
  for (let h = 8; h <= 16; h++) {
    const d = new Date()
    d.setHours(h, 0, 0, 0)
    const pm = typical(d, 'pm25')
    if (pm < best.pm) best = { h, pm }
    if (pm > worst.pm) worst = { h, pm }
  }
  return { best, worst }
})

// razred izpostavljenosti med vsemi šolami in vrtci
const razred = (r: number) => (r >= 0.8 ? 'zelo visoka' : r >= 0.6 ? 'nadpovprečna' : r >= 0.4 ? 'povprečna' : r >= 0.2 ? 'podpovprečna' : 'nizka')
const barva = (r: number) => (r >= 0.8 ? 'var(--aq-5)' : r >= 0.6 ? 'var(--aq-4)' : r >= 0.4 ? 'var(--aq-3)' : 'var(--aq-1)')

// nasveti glede na to, kaj je v okolici izstopa (konkretno ravnanje, ne očitki)
const nasveti = computed(() => {
  const s = props.sola
  const out: string[] = []
  const ura = solskaUra.value.best.h
  if (s.kurisca && s.kurisca.rang >= 0.6)
    out.push(
      `V okolici je več dima iz peči kot pri večini ${kogaNaziv.value}. Pozimi prezračite igralnice in učilnice okoli ${hh(ura)}, ko je zrak običajno najčistejši; zvečer, ko se dim nabere, pa imejte doma okna zaprta.`,
    )
  if (s.promet && s.promet.rang >= 0.6)
    out.push(
      'Blizu so prometne ceste. Za pot peš ali s kolesom izberite stranske ulice in pred vrati ne puščajte avtomobila v prostem teku – otroci so ravno v višini izpuhov.',
    )
  if (s.podMeglo != null && s.podMeglo >= 0.3)
    out.push(
      `Ob inverziji je ${kdo.value} pod plastjo hladnega zraka. Na dneve, ko domača stran pokaže slab zrak, naj bo telovadba raje v notranjosti, sprehod pa ob ${hh(ura)}.`,
    )
  if (!out.length)
    out.push(
      `Okolica je med boljšimi v mestu. Vseeno ob slabih zimskih dneh izberite krajšo igro zunaj, najbolje okoli ${hh(ura)}.`,
    )
  return out
})
</script>

<template>
  <article class="sola-kartica">
    <header>
      <span class="kicker">Tvoj{{ sola.kat === 'vrtec' ? ' vrtec' : 'a šola' }}</span>
      <h2>{{ sola.ime }}</h2>
      <p class="kje">
        <template v-if="sola.naslov">{{ sola.naslov }} · </template>
        <template v-if="sola.cs">Četrtna skupnost {{ sola.cs }}</template>
        <template v-else>zunaj Mestne občine Ljubljana</template>
      </p>
    </header>

    <div class="mreza">
      <!-- dim iz peči -->
      <section class="tile">
        <h3>Dim iz peči v okolici</h3>
        <template v-if="sola.kurisca">
          <p class="stevilka">
            <strong>{{ fmt(sola.kurisca.januar) }}</strong> µg/m³
            <span class="razred" :style="{ background: barva(sola.kurisca.rang) }">{{ razred(sola.kurisca.rang) }}</span>
          </p>
          <p>
            Toliko delcev PM10 januarja v povprečju prispevajo samo mala kurišča v okolici (polmer {{ sola.kurisca.polmer }} m).
            Mediana vseh šol in vrtcev je {{ fmt(meta.kurisca.januarMediana) }}. Več dima kot tukaj ima le
            {{ pct(1 - sola.kurisca.rang) }} {{ kogaNaziv }} in vrtcev.
          </p>
          <p>Ur na leto, ko samo dim iz peči preseže 25 µg/m³: <strong>{{ sola.kurisca.urNad25 }}</strong>.</p>
          <p class="vir"><VirZnacka vrsta="model" /> ARSO GRAL, leto 2021; samo kurišča, brez prometa in ozadja.</p>
        </template>
        <p v-else class="sivo">Ta {{ kdo }} je zunaj območja modela ARSO GRAL (vzhodni del MOL in okolica), zato podatka ni.</p>
      </section>

      <!-- promet -->
      <section class="tile">
        <h3>Promet v okolici</h3>
        <template v-if="sola.promet">
          <p class="stevilka">
            <strong>{{ fmt(sola.promet.relativno) }}×</strong> povprečja
            <span class="razred" :style="{ background: barva(sola.promet.rang) }">{{ razred(sola.promet.rang) }}</span>
          </p>
          <p>Delci iz izpuhov osebnih avtomobilov v primerjavi s povprečno šolo ali vrtcem v mestu.</p>
          <p class="vir"><VirZnacka vrsta="model" /> ARSO GRAL; uporabna je samo primerjava med šolami, absolutne vrednosti modela za promet niso zanesljive.</p>
        </template>
        <p v-else class="sivo">Zunaj območja modela, podatka ni.</p>
      </section>

      <!-- lega v kotlini -->
      <section class="tile">
        <h3>Pod pokrovko?</h3>
        <p class="stevilka">
          <strong>{{ sola.podMeglo != null ? pct(sola.podMeglo) : '–' }}</strong> zimskih juter
        </p>
        <p>
          {{ kdo === 'vrtec' ? 'Vrtec' : 'Šola' }} je {{ sola.nadDnom > 0 ? `${sola.nadDnom} m nad` : 'na' }} dnom kotline. Toliko
          zimskih juter (november–februar, {{ meta.zimskihJuter }} juter od 2016) je bil{{ kdo === 'vrtec' ? '' : 'a' }} pod plastjo
          hladnega zraka, v kateri se ujame dim.
        </p>
        <p class="vir"><VirZnacka vrsta="ocena" /> višina plasti iz jutranje radiosondaže ARSO/NOAA, lega iz reliefa (Copernicus DEM).</p>
      </section>

      <!-- najbližja postaja -->
      <section class="tile">
        <h3>Najbližja merilna postaja</h3>
        <template v-if="postaja">
          <p class="stevilka">
            <strong>{{ postaja.pm ?? '–' }}</strong> µg/m³ PM2.5
            <span v-if="postaja.pm != null" class="razred" :style="{ background: levelFor(postaja.pm).color }">{{ levelFor(postaja.pm).label }}</span>
          </p>
          <p>
            {{ postaja.ime }}, {{ km(postaja.d) }} stran.
            <template v-if="postaja.pm == null">Zadnja meritev trenutno ni na voljo.</template>
            Postaja pove, kakšen je zrak v širši okolici, ne točno na šolskem dvorišču.
          </p>
          <p class="vir"><VirZnacka vrsta="meritev" /> ARSO, zadnja ura.</p>
        </template>
      </section>

      <!-- šolska ura -->
      <section class="tile">
        <h3>Najboljši čas za igro zunaj</h3>
        <p class="stevilka"><strong>{{ hh(solskaUra.best.h) }}</strong></p>
        <p>
          Ta mesec je med 8. in 16. uro zrak običajno najčistejši ob {{ hh(solskaUra.best.h) }} (okoli
          {{ Math.round(solskaUra.best.pm) }} µg/m³), najslabši ob {{ hh(solskaUra.worst.h) }} (okoli {{ Math.round(solskaUra.worst.pm) }}).
        </p>
        <p class="vir"><VirZnacka vrsta="meritev" /> povprečje meritev {{ klimaLabel }} za ta mesec.</p>
      </section>

      <!-- nasveti -->
      <section class="tile nasveti">
        <h3>Kaj lahko naredite</h3>
        <ul>
          <li v-for="(n, i) in nasveti" :key="i">{{ n }}</li>
        </ul>
      </section>
    </div>
  </article>
</template>

<style scoped>
.sola-kartica {
  margin: 0 0 18px;
  padding: 20px 22px;
  border-radius: var(--radius);
  background: var(--panel);
  border: 2px solid color-mix(in srgb, #e5484d 45%, var(--panel-line));
  box-shadow: var(--panel-shadow);
}
.kicker {
  color: #c2393e;
}
h2 {
  margin: 2px 0 2px;
  font-size: clamp(1.5rem, 3.4vw, 2.1rem);
}
.kje {
  margin: 0 0 14px;
  color: var(--ink-soft);
  font-weight: 700;
}
.mreza {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
}
.tile {
  padding: 14px 16px;
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--card) 80%, transparent);
  border: 1px solid var(--line);
}
.tile h3 {
  margin: 0 0 4px;
  font-size: 1.05rem;
}
.tile p {
  margin: 0 0 6px;
  font-size: 0.9rem;
  color: var(--scene-text);
}
.stevilka {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 8px;
  color: var(--ink-soft) !important;
  font-weight: 700;
}
.stevilka strong {
  font-family: var(--font-head);
  font-size: 1.9rem;
  color: var(--ink);
}
.razred {
  padding: 1px 10px;
  border-radius: 999px;
  color: #fff;
  font-size: 0.75rem;
  font-weight: 800;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.25);
}
.vir {
  margin-top: 8px !important;
  font-size: 0.78rem !important;
  color: var(--ink-soft) !important;
}
.sivo {
  color: var(--ink-soft) !important;
}
.nasveti ul {
  margin: 0;
  padding-left: 18px;
}
.nasveti li {
  margin-bottom: 6px;
  font-size: 0.9rem;
}
@media (max-width: 980px) {
  .mreza {
    grid-template-columns: 1fr 1fr;
  }
}
@media (max-width: 620px) {
  .mreza {
    grid-template-columns: 1fr;
  }
}
</style>
