<script setup lang="ts">
// Zavihek »Moj zrak«: osebni pregled za uporabnikovo lokacijo.
// - lokacija iz brskalnika (ostane samo na napravi, v profilu), sicer center Ljubljane
// - stanje zdaj na najbližji postaji ARSO in odgovor: ali naj grem ven, ali naj prezračim
// - graf za naslednjih 24 ur z najboljšo uro za ven in za zračenje ter primerjavo z običajnim dnem
// - iz ARSOhack: nadmorska višina (relief) in ali si ob inverziji pod meglo, občutljive lokacije v bližini,
//   kakšen je običajno ta mesec (10 let meritev)
import { computed, onMounted, ref, shallowRef } from 'vue'
import { useAirData } from '@/composables/useAirData'
import { useProfile } from '@/composables/useProfile'
import { LEVELS, levelFor } from '@/lib/airQuality'
import { typical } from '@/lib/klima'
import { razdalja, wgs84ToD96 } from '@/lib/geo'
import z from '@/data/zgodovina.json'

const { now, forecast, scene, refresh, origin } = useAirData()
const { profile, sensitivity } = useProfile()

const CENTER = { lat: 46.0511, lon: 14.5051 }
// postaje ARSO (iz backend/data/arso_lj_postaje.geojson), če zaledje ne vrne koordinat
const POSTAJE = [
  { id: 'E403', ime: 'Bežigrad', lat: 46.0655, lon: 14.5127 },
  { id: 'E405', ime: 'Celovška', lat: 46.0636, lon: 14.4914 },
  { id: 'E404', ime: 'Vič', lat: 46.0425, lon: 14.4874 },
]

// --- lokacija ---
const status = ref<'idle' | 'iscem' | 'napaka'>('idle')
const napaka = ref('')
const loc = computed(() => profile.lokacija ?? { ime: 'Center Ljubljane', ...CENTER })
const mojaLokacija = computed(() => !!profile.lokacija)
const odCentra = computed(() => razdalja(loc.value.lat, loc.value.lon, CENTER.lat, CENTER.lon))
const izvenLj = computed(() => odCentra.value > 25000)

function uporabiLokacijo() {
  if (!('geolocation' in navigator)) {
    status.value = 'napaka'
    napaka.value = 'Tvoj brskalnik ne podpira iskanja lokacije.'
    return
  }
  status.value = 'iscem'
  navigator.geolocation.getCurrentPosition(
    (p) => {
      profile.lokacija = { ime: 'Moja lokacija', lat: p.coords.latitude, lon: p.coords.longitude }
      status.value = 'idle'
      refresh(profile.lokacija, true)
    },
    (e) => {
      status.value = 'napaka'
      napaka.value =
        e.code === e.PERMISSION_DENIED
          ? 'Dostop do lokacije ni dovoljen. Dovoli ga v nastavitvah brskalnika ali uporabi center Ljubljane.'
          : 'Lokacije ni bilo mogoče najti. Poskusi znova.'
    },
    { enableHighAccuracy: false, timeout: 12000, maximumAge: 10 * 60_000 },
  )
}
function pozabiLokacijo() {
  profile.lokacija = null
  refresh(undefined, true)
}

// --- relief in občutljive lokacije (ARSOhack, pripravljeno za zemljevid) ---
interface Teren {
  izhodisce: [number, number]
  celica: number
  stolpci: number
  vrstice: number
  zahod: number
  sever: number
  dno: number
}
interface Lok {
  ime: string | null
  kat: string
  x: number
  y: number
}
const teren = shallowRef<Teren | null>(null)
const visine = shallowRef<Uint16Array | null>(null)
const lokacije = shallowRef<Lok[]>([])
onMounted(async () => {
  if (profile.lokacija) refresh(profile.lokacija, true)
  try {
    const base = `${import.meta.env.BASE_URL}assets/map/`
    const [t, b, l] = await Promise.all([
      fetch(base + 'teren.json').then((r) => r.json()),
      fetch(base + 'teren.bin').then((r) => r.arrayBuffer()),
      fetch(base + 'lokacije.json').then((r) => r.json()),
    ])
    teren.value = t
    visine.value = new Uint16Array(b)
    lokacije.value = l
  } catch {
    /* brez reliefa – kartica o višini se ne pokaže */
  }
})
const tocka = computed(() => {
  const t = teren.value
  if (!t) return null
  const { e, n } = wgs84ToD96(loc.value.lat, loc.value.lon)
  return { x: e - t.izhodisce[0], y: n - t.izhodisce[1] }
})
const visina = computed(() => {
  const t = teren.value, Z = visine.value, p = tocka.value
  if (!t || !Z || !p) return null
  const c = Math.round((p.x - t.zahod) / t.celica)
  const r = Math.round((t.sever - p.y) / t.celica)
  if (c < 0 || r < 0 || c >= t.stolpci || r >= t.vrstice) return null
  const m = Z[r * t.stolpci + c]! / 10
  return { m: Math.round(m), nadDnom: Math.round(m - t.dno) }
})
// sklanjatev po številu: 1, 2, 3–4, 5 in več
const KAT: Record<string, { oblike: [string, string, string, string]; ikona: string }> = {
  vrtec: { oblike: ['vrtec', 'vrtca', 'vrtci', 'vrtcev'], ikona: '🧸' },
  sola: { oblike: ['šola', 'šoli', 'šole', 'šol'], ikona: '🏫' },
  bolnisnica: { oblike: ['bolnišnica', 'bolnišnici', 'bolnišnice', 'bolnišnic'], ikona: '🏥' },
  zdravstveni_dom: { oblike: ['zdravstveni dom', 'zdravstvena doma', 'zdravstveni domovi', 'zdravstvenih domov'], ikona: '🩺' },
  dom_za_starejse: { oblike: ['dom za starejše', 'doma za starejše', 'domovi za starejše', 'domov za starejše'], ikona: '🏡' },
}
function sklanjaj(n: number, kat: string) {
  const o = KAT[kat]?.oblike
  if (!o) return kat
  const r = n % 100
  return o[r === 1 ? 0 : r === 2 ? 1 : r === 3 || r === 4 ? 2 : 3]
}
const RADIJ = 1000
const blizu = computed(() => {
  const p = tocka.value
  if (!p) return null
  const v = lokacije.value
    .map((l) => ({ ...l, d: Math.hypot(l.x - p.x, l.y - p.y) }))
    .filter((l) => l.d <= RADIJ)
    .sort((a, b) => a.d - b.d)
  const st: Record<string, number> = {}
  for (const l of v) st[l.kat] = (st[l.kat] ?? 0) + 1
  return { vse: v.length, st, najblizja: v.find((l) => l.ime) ?? v[0] }
})

// --- zrak zdaj ---
const postaja = computed(() => {
  const merjene = (now.value?.postaje ?? []).filter((s) => s.vir !== 'ocena' && s.pm25 != null)
  const z = merjene.map((s) => {
    const k = POSTAJE.find((p) => p.id === s.id || s.ime.includes(p.ime))
    const lat = s.lat || k?.lat || CENTER.lat
    const lon = s.lon || k?.lon || CENTER.lon
    return { ime: k?.ime ?? s.ime.replace('LJ ', ''), pm: s.pm25!, d: razdalja(loc.value.lat, loc.value.lon, lat, lon), ocena: false }
  })
  if (z.length) return z.sort((a, b) => a.d - b.d)[0]!
  const o = now.value?.postaje.find((s) => s.vir === 'ocena')
  return o?.pm25 != null ? { ime: 'Ljubljana', pm: o.pm25, d: 0, ocena: true } : null
})
const pmZdaj = computed(() => Math.round(postaja.value?.pm ?? forecast.value?.ure[0]?.pm25 ?? typical(new Date(), 'pm25')))
const lvl = computed(() => levelFor(pmZdaj.value, sensitivity.value))
const stopnja = computed(() => LEVELS.findIndex((l) => l.key === lvl.value.key))

// --- naslednjih 24 ur ---
const ura = (iso: string) => new Date(iso).getHours()
const ure = computed(() =>
  (forecast.value?.ure ?? []).slice(0, 24).map((u) => ({
    cas: u.cas_utc,
    h: ura(u.cas_utc),
    pm: u.pm25,
    obicajno: typical(new Date(u.cas_utc), 'pm25'),
    lvl: levelFor(u.pm25, sensitivity.value),
  })),
)
function najmanj(od: number, doUre: number) {
  const k = ure.value.filter((u) => u.h >= od && u.h <= doUre)
  return (k.length ? k : ure.value).reduce<(typeof ure.value)[number] | null>((a, b) => (!a || b.pm < a.pm ? b : a), null)
}
const najVen = computed(() => najmanj(7, 20)) // podnevi
const najZrac = computed(() => najmanj(6, 22)) // ko smo budni
const najslabse = computed(() => {
  const u = ure.value
  let best = -1, max = -Infinity
  for (let i = 0; i + 3 <= u.length; i++) {
    const avg = (u[i]!.pm + u[i + 1]!.pm + u[i + 2]!.pm) / 3
    if (avg > max) (max = avg), (best = i)
  }
  return best < 0 ? null : { od: u[best]!.h, do: (u[best]!.h + 3) % 24, i: best, pm: Math.round(max) }
})
const hh = (h: number) => `${String(h).padStart(2, '0')}:00`

const ven = computed(() => {
  const s = stopnja.value
  if (s <= 1) return { ok: 'da', naslov: 'Da, pojdi ven!', text: 'Zrak je čist. Super čas za igro, sprehod ali kolo.' }
  if (s === 2) return { ok: 'mogoce', naslov: 'Lahko, a mirneje', text: `Za sprehod je v redu, napornejši tek pa raje ob ${najVen.value ? hh(najVen.value.h) : 'čistejši uri'}.` }
  return { ok: 'ne', naslov: 'Raje ne zdaj', text: najVen.value ? `Najboljši čas za ven bo ob ${hh(najVen.value.h)} (${Math.round(najVen.value.pm)} µg/m³).` : 'Ostani notri in počakaj na boljši zrak.' }
})
const zracenje = computed(() => {
  const n = najZrac.value
  if (stopnja.value <= 1 || (n && pmZdaj.value <= n.pm * 1.15))
    return { ok: 'da', naslov: 'Da, prezrači zdaj', text: 'Odpri okna na široko za 5–10 minut, nato jih zapri.' }
  return {
    ok: stopnja.value >= 3 ? 'ne' : 'mogoce',
    naslov: 'Počakaj z zračenjem',
    text: n ? `Najbolje ob ${hh(n.h)}, ko bo v zraku le ${Math.round(n.pm)} µg/m³. Takrat na široko za 5–10 minut.` : 'Počakaj na čistejšo uro.',
  }
})

// graf
const izbrana = ref<number | null>(null)
const maxPm = computed(() => Math.max(25, ...ure.value.map((u) => Math.max(u.pm, u.obicajno))) * 1.1)
const izbranaUra = computed(() => (izbrana.value == null ? null : ure.value[izbrana.value] ?? null))

// --- inverzija in megla zdaj ---
const megla = computed(() => {
  const u = scene.value?.ure[0]
  const v = visina.value
  if (!u) return null
  const pod = v ? v.m < u.visina_megle_m : null
  return { inv: u.inverzija, vrh: Math.round(u.visina_megle_m), pod }
})

// --- ta mesec (10 let meritev) ---
const mesec = computed(() => {
  const m = new Date().getMonth()
  const vrstni = [...z.meseci].sort((a, b) => b.pm25 - a.pm25).findIndex((x) => x.mesec === z.meseci[m]!.mesec) + 1
  return { pm: z.meseci[m]!.pm25, vrstni }
})
const MESECI = ['januar', 'februar', 'marec', 'april', 'maj', 'junij', 'julij', 'avgust', 'september', 'oktober', 'november', 'december']
const fmt = (n: number) => n.toLocaleString('sl-SI', { maximumFractionDigits: 1 })
const km = (m: number) => (m < 1000 ? `${Math.round(m / 10) * 10} m` : `${fmt(m / 1000)} km`)
</script>

<template>
  <section class="container page" :style="{ '--lvl': lvl.color }">
    <!-- glava z lokacijo -->
    <header class="glava">
      <div>
        <span class="kicker">Moj zrak</span>
        <h1>Kakšen zrak diham jaz?</h1>
      </div>
      <div class="lokacija">
        <span class="chip">
          📍 {{ loc.ime }}
          <small v-if="mojaLokacija">· {{ km(odCentra) }} od centra</small>
        </span>
        <button v-if="!mojaLokacija" class="btn" :disabled="status === 'iscem'" @click="uporabiLokacijo">
          {{ status === 'iscem' ? 'Iščem …' : 'Uporabi mojo lokacijo' }}
        </button>
        <button v-else class="btn ghost" @click="pozabiLokacijo">Pozabi lokacijo</button>
      </div>
    </header>
    <p v-if="status === 'napaka'" class="opozorilo">{{ napaka }}</p>
    <p v-if="izvenLj" class="opozorilo">
      Tvoja lokacija je zunaj ljubljanske kotline. Prikazani so podatki za Ljubljano, ki so najbližji.
    </p>
    <p class="zasebnost">Lokacija ostane samo na tvoji napravi – strežnik je ne shrani.</p>

    <!-- stanje zdaj + odločitve -->
    <div class="zgoraj">
      <article class="card zdaj">
        <span class="mali">{{ postaja?.ocena ? 'Običajno ob tej uri' : 'Zdaj' }} · {{ postaja ? (postaja.ocena ? 'Ljubljana' : `postaja ${postaja.ime}`) : 'Ljubljana' }}<template v-if="postaja && !postaja.ocena"> ({{ km(postaja.d) }})</template></span>
        <div class="vrednost">
          <strong>{{ pmZdaj }}</strong>
          <span>µg/m³<br />PM2.5</span>
        </div>
        <span class="znacka" :style="{ background: lvl.color }">{{ lvl.label }}</span>
        <p class="kids">{{ lvl.kids }}</p>
        <label class="obcutljiv">
          <input v-model="profile.astma" type="checkbox" />
          <span>Sem občutljiv/a (astma, bolezni srca ali pljuč) – strožje meje</span>
        </label>
      </article>

      <article class="card odlocitev" :class="ven.ok">
        <span class="ikona" aria-hidden="true">🚶</span>
        <span class="mali">Ali naj grem ven?</span>
        <h2>{{ ven.naslov }}</h2>
        <p>{{ ven.text }}</p>
      </article>

      <article class="card odlocitev" :class="zracenje.ok">
        <span class="ikona" aria-hidden="true">🪟</span>
        <span class="mali">Ali naj prezračim?</span>
        <h2>{{ zracenje.naslov }}</h2>
        <p>{{ zracenje.text }}</p>
      </article>
    </div>

    <!-- graf 24 ur -->
    <article class="card graf">
      <div class="graf-glava">
        <div>
          <h2>Naslednjih 24 ur</h2>
          <p class="mali">Pokaži ali tapni stolpec. Pikice kažejo, kakšen je zrak ob tej uri običajno (10 let meritev ARSO).</p>
        </div>
        <ul class="legenda">
          <li><span class="l ven">🚶</span> najboljše za ven</li>
          <li><span class="l zrac">🪟</span> najboljše za zračenje</li>
          <li><span class="l slabo" /> raje ostani notri</li>
        </ul>
      </div>
      <div class="podrobno">
        <template v-if="izbranaUra">
          <strong>{{ hh(izbranaUra.h) }}</strong> · {{ Math.round(izbranaUra.pm) }} µg/m³ ·
          <span :style="{ color: izbranaUra.lvl.color }">{{ izbranaUra.lvl.label }}</span>
          <small> (običajno {{ Math.round(izbranaUra.obicajno) }})</small>
        </template>
        <template v-else-if="najslabse">
          Najslabše bo med <strong>{{ hh(najslabse.od) }} in {{ hh(najslabse.do) }}</strong> (okoli {{ najslabse.pm }} µg/m³).
        </template>
      </div>
      <div class="stolpci" @pointerleave="izbrana = null">
        <div
          v-if="najslabse"
          class="pas"
          :style="{ left: `${(najslabse.i / ure.length) * 100}%`, width: `${(3 / ure.length) * 100}%` }"
          aria-hidden="true"
        />
        <button
          v-for="(u, i) in ure"
          :key="u.cas"
          class="st"
          :class="{ izbran: izbrana === i }"
          :aria-label="`${hh(u.h)}: ${Math.round(u.pm)} µg/m³`"
          @pointerenter="izbrana = i"
          @focus="izbrana = i"
          @click="izbrana = i"
        >
          <span class="oznake">
            <span v-if="najVen && u.cas === najVen.cas">🚶</span>
            <span v-if="najZrac && u.cas === najZrac.cas">🪟</span>
          </span>
          <span class="bar" :style="{ height: `${(u.pm / maxPm) * 100}%`, background: u.lvl.color, '--d': `${i * 25}ms` }" />
          <span class="obicajno" :style="{ bottom: `${(u.obicajno / maxPm) * 100}%` }" />
          <span class="ura">{{ u.h % 3 === 0 ? `${u.h}h` : '' }}</span>
        </button>
      </div>
      <p class="vir">
        Napoved: {{ forecast?.model === 'klima' ? 'običajne vrednosti iz meritev ARSO (napoved ni na voljo)' : 'CAMS (Open-Meteo) za Ljubljano' }} ·
        meritve: {{ origin === 'api' ? 'ARSO v živo' : 'arhiv ARSO' }}
      </p>
    </article>

    <!-- lokacija: višina, megla, bližina -->
    <div class="spodaj">
      <article v-if="visina" class="card info">
        <span class="ikona" aria-hidden="true">⛰️</span>
        <h3>Tvoja lokacija je {{ visina.m }} m nad morjem</h3>
        <p>
          To je <strong>{{ visina.nadDnom > 0 ? `${visina.nadDnom} m nad` : 'na' }} dnom kotline</strong>.
          <template v-if="megla?.inv && megla.pod">Zdaj je inverzija in hladen, onesnažen zrak sega do približno {{ megla.vrh }} m – <strong>si pod to plastjo</strong>.</template>
          <template v-else-if="megla?.inv">Zdaj je inverzija, a plast hladnega zraka (do približno {{ megla.vrh }} m) je pod tabo.</template>
          <template v-else>Zdaj ni inverzije, zrak se meša.</template>
          <template v-if="visina.nadDnom < 60"> Pozimi ob inverziji je tvoje območje med prvimi, kjer se ujame megla.</template>
        </p>
      </article>

      <article v-if="blizu" class="card info">
        <span class="ikona" aria-hidden="true">🏫</span>
        <h3>V krogu {{ km(RADIJ) }}</h3>
        <p v-if="blizu.vse">
          <template v-for="(n, kat, i) in blizu.st" :key="kat">{{ i ? ', ' : '' }}{{ KAT[kat]?.ikona }} {{ n }} {{ sklanjaj(n, kat) }}</template>.
          <template v-if="blizu.najblizja?.ime"> Najbližje: {{ blizu.najblizja.ime }} ({{ km(blizu.najblizja.d) }}).</template>
          Tam so otroci, starejši in bolniki – ljudje, ki jim slab zrak najbolj škodi.
        </p>
        <p v-else>V bližini ni vrtcev, šol ali bolnišnic iz zbirke OpenStreetMap.</p>
      </article>

      <article class="card info">
        <span class="ikona" aria-hidden="true">📅</span>
        <h3>{{ MESECI[new Date().getMonth()]![0]!.toUpperCase() + MESECI[new Date().getMonth()]!.slice(1) }} je običajno {{ fmt(mesec.pm) }} µg/m³</h3>
        <p>
          Po 10 letih meritev je to {{ mesec.vrstni }}. najslabši mesec v letu.
          <template v-if="mesec.vrstni <= 4">Pozimi kurimo in zrak se pogosto ujame v kotlini – zato je toliko bolj pomembno, kdaj greš ven in kdaj zračiš.</template>
          <template v-else>To je eden boljših mesecev – izkoristi ga za igro zunaj.</template>
        </p>
      </article>
    </div>
  </section>
</template>

<style scoped>
.page {
  padding-top: 28px;
}
.glava {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 14px;
}
.kicker {
  display: block;
  text-transform: uppercase;
  letter-spacing: 0.2em;
  font-size: 0.75rem;
  font-weight: 800;
  color: color-mix(in srgb, var(--lvl) 75%, var(--ink));
}
h1 {
  font-size: clamp(2rem, 5vw, 3rem);
  margin: 4px 0 0;
}
.lokacija {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}
.chip {
  padding: 8px 14px;
  border-radius: 999px;
  background: var(--card);
  border: 1px solid var(--line);
  font-weight: 800;
}
.chip small {
  color: var(--ink-soft);
  font-weight: 700;
}
.opozorilo {
  margin: 12px 0 0;
  padding: 10px 14px;
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--aq-3) 20%, var(--card));
  font-weight: 700;
}
.zasebnost {
  margin: 8px 0 18px;
  color: var(--ink-soft);
  font-size: 0.85rem;
}
.mali {
  display: block;
  color: var(--ink-soft);
  font-size: 0.85rem;
  font-weight: 700;
}

/* zgoraj: stanje in odločitvi */
.zgoraj {
  display: grid;
  grid-template-columns: 1.1fr 1fr 1fr;
  gap: 18px;
  margin-bottom: 18px;
}
.zdaj {
  border: 2px solid color-mix(in srgb, var(--lvl) 55%, var(--line));
}
.vrednost {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 6px 0;
}
.vrednost strong {
  font-family: var(--font-head);
  font-size: clamp(3.4rem, 8vw, 4.6rem);
  line-height: 1;
  color: color-mix(in srgb, var(--lvl) 80%, var(--ink));
}
.vrednost span {
  color: var(--ink-soft);
  font-weight: 800;
  line-height: 1.2;
}
.znacka {
  display: inline-block;
  padding: 4px 14px;
  border-radius: 999px;
  color: #fff;
  font-weight: 800;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.25);
}
.kids {
  margin: 10px 0 12px;
  font-weight: 700;
}
.obcutljiv {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  font-size: 0.85rem;
  color: var(--ink-soft);
  cursor: pointer;
}
.obcutljiv input {
  margin-top: 3px;
  accent-color: var(--brand);
}
.odlocitev {
  --o: var(--aq-1);
  position: relative;
  border: 2px solid color-mix(in srgb, var(--o) 55%, var(--line));
  background: linear-gradient(160deg, color-mix(in srgb, var(--o) 14%, var(--card)), var(--card) 60%);
}
.odlocitev.mogoce {
  --o: var(--aq-3);
}
.odlocitev.ne {
  --o: var(--aq-5);
}
.odlocitev .ikona {
  position: absolute;
  top: 14px;
  right: 16px;
  font-size: 1.7rem;
}
.odlocitev h2 {
  font-size: 1.7rem;
  margin: 6px 44px 6px 0; /* prostor za ikono desno zgoraj */
  color: color-mix(in srgb, var(--o) 65%, var(--ink));
}
.odlocitev p {
  margin: 0;
  font-weight: 600;
}

/* graf */
.graf-glava {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 10px;
}
.graf h2 {
  font-size: 1.5rem;
  margin: 0;
}
.legenda {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 4px 14px;
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--ink-soft);
}
.legenda .l.slabo {
  display: inline-block;
  width: 14px;
  height: 14px;
  vertical-align: -2px;
  border-radius: 4px;
  background: color-mix(in srgb, var(--aq-5) 18%, transparent);
  border: 1px dashed var(--aq-5);
}
.podrobno {
  min-height: 1.6em;
  margin: 12px 0 6px;
  font-weight: 600;
}
.podrobno small {
  color: var(--ink-soft);
}
.stolpci {
  position: relative;
  display: flex;
  align-items: flex-end;
  gap: 3px;
  height: 220px;
  padding-top: 30px;
}
.pas {
  position: absolute;
  top: 0;
  bottom: 22px;
  border-radius: 10px;
  background: color-mix(in srgb, var(--aq-5) 12%, transparent);
  border: 1px dashed color-mix(in srgb, var(--aq-5) 60%, transparent);
  pointer-events: none;
}
.st {
  position: relative;
  flex: 1;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  padding: 0 0 22px;
  border: 0;
  background: none;
  cursor: pointer;
}
.bar {
  display: block;
  min-height: 4px;
  border-radius: 6px 6px 2px 2px;
  opacity: 0.8;
  transform-origin: bottom;
  animation: rast 0.6s cubic-bezier(0.3, 0.8, 0.3, 1) both;
  animation-delay: var(--d);
  transition: opacity 0.15s;
}
@keyframes rast {
  from {
    transform: scaleY(0);
  }
}
.st.izbran .bar,
.st:hover .bar {
  opacity: 1;
}
.obicajno {
  position: absolute;
  left: 50%;
  width: 6px;
  height: 6px;
  margin: 0 0 19px -3px;
  border-radius: 50%;
  background: var(--ink);
  opacity: 0.45;
  pointer-events: none;
}
.oznake {
  position: absolute;
  top: -4px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  font-size: 1.1rem;
  line-height: 1.1;
}
.ura {
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--ink-soft);
  white-space: nowrap;
}
.vir {
  margin: 10px 0 0;
  font-size: 0.75rem;
  color: var(--ink-soft);
}

/* spodaj */
.spodaj {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 18px;
  margin-top: 18px;
}
.info .ikona {
  font-size: 1.8rem;
}
.info h3 {
  font-size: 1.25rem;
  margin: 6px 0;
}
.info p {
  margin: 0;
  color: var(--ink-soft);
}
.info strong {
  color: var(--ink);
}

@media (max-width: 900px) {
  .zgoraj,
  .spodaj {
    grid-template-columns: 1fr;
  }
  .stolpci {
    height: 180px;
    gap: 2px;
  }
  .oznake {
    font-size: 0.9rem;
  }
}
</style>
