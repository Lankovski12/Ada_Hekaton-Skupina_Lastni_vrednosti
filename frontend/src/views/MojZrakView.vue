<script setup lang="ts">
// Zavihek »Moj zrak«: osebni pregled za uporabnikovo lokacijo.
// - lokacija iz brskalnika (ostane samo na napravi, v profilu), sicer center Ljubljane
// - stanje zdaj na najbližji postaji ARSO in odgovor: ali naj grem ven, ali naj prezračim
// - graf za naslednjih 24 ur z najboljšo uro za ven in za zračenje ter primerjavo z običajnim dnem
// - načrt za danes: kdaj je pametno iti ven, kdaj zračiti in kdaj ostati notri
// - iz ARSOhack: nadmorska višina (relief) in ali si ob inverziji pod meglo, kakšen je običajno ta mesec
// Pri vsaki številki piše, ali je meritev, napoved modela ali ocena iz starih meritev.
import { computed, onMounted, ref, shallowRef } from 'vue'
import { useAirData } from '@/composables/useAirData'
import { useProfile } from '@/composables/useProfile'
import { LEVELS, levelFor } from '@/lib/airQuality'
import { typical } from '@/lib/klima'
import { razdalja, wgs84ToD96 } from '@/lib/geo'
import z from '@/data/zgodovina.json'
import VirZnacka from '@/components/VirZnacka.vue'

const { now, forecast, scene, refresh } = useAirData()
const { profile, sensitivity } = useProfile()

const CENTER = { lat: 46.0511, lon: 14.5051 }
// postaje ARSO (iz backend/data/arso_lj_postaje.geojson), če zaledje ne vrne koordinat
const POSTAJE = [
  { id: 'E403', ime: 'Bežigrad', lat: 46.0655, lon: 14.5127 },
  { id: 'E405', ime: 'Celovška', lat: 46.0636, lon: 14.4914 },
  { id: 'E404', ime: 'Vič', lat: 46.0425, lon: 14.4874 },
]

// --- lokacija ---
// Ob odprtju strani brskalnik sam vpraša za dovoljenje (okence brskalnika). Najprej hitro iskanje
// (wifi/omrežje), če ne uspe, še natančno (GPS). Lokacija se shrani samo na napravi.
const status = ref<'idle' | 'iscem' | 'napaka'>('idle')
const napaka = ref('')
const loc = computed(() => profile.lokacija ?? { ime: 'Center Ljubljane', ...CENTER })
const mojaLokacija = computed(() => !!profile.lokacija)
const odCentra = computed(() => razdalja(loc.value.lat, loc.value.lon, CENTER.lat, CENTER.lon))
const izvenLj = computed(() => odCentra.value > 25000)

function poisci(natancno: boolean): Promise<GeolocationPosition> {
  return new Promise((ok, ne) =>
    navigator.geolocation.getCurrentPosition(ok, ne, {
      enableHighAccuracy: natancno,
      timeout: natancno ? 25000 : 10000,
      maximumAge: natancno ? 0 : 5 * 60_000,
    }),
  )
}
async function uporabiLokacijo() {
  if (!('geolocation' in navigator)) {
    status.value = 'napaka'
    napaka.value = 'Ta brskalnik ne podpira iskanja lokacije. Prikazan je center Ljubljane.'
    return
  }
  if (!window.isSecureContext) {
    status.value = 'napaka'
    napaka.value =
      'Brskalnik da lokacijo samo varni strani (naslov z https:// ali localhost). Odpri stran prek takega naslova. Do takrat je prikazan center Ljubljane.'
    return
  }
  status.value = 'iscem'
  let p: GeolocationPosition | null = null
  let err: GeolocationPositionError | null = null
  try {
    p = await poisci(false)
  } catch (e) {
    err = e as GeolocationPositionError
    if (err.code !== err.PERMISSION_DENIED) {
      try {
        p = await poisci(true) // drugi poskus: natančno iskanje
        err = null
      } catch (e2) {
        err = e2 as GeolocationPositionError
      }
    }
  }
  if (p) {
    profile.lokacija = { ime: 'Moja lokacija', lat: p.coords.latitude, lon: p.coords.longitude }
    status.value = 'idle'
    refresh(profile.lokacija, true)
    return
  }
  status.value = 'napaka'
  napaka.value =
    err?.code === 1
      ? 'Dostop do lokacije je zavrnjen. Klikni ikono levo od naslova strani v brskalniku, pri »Lokacija« izberi »Dovoli« in nato »Poišči znova«.'
      : err?.code === 3
        ? 'Iskanje lokacije je trajalo predolgo. Preveri povezavo in poskusi znova.'
        : 'Brskalnik ne ve, kje si. Preveri, da so lokacijske storitve vklopljene v sistemu za ta brskalnik (Windows: Nastavitve → Zasebnost → Lokacija; macOS: Sistemske nastavitve → Zasebnost → Lokacijske storitve) in poskusi znova.'
}
function pozabiLokacijo() {
  profile.lokacija = null
  status.value = 'idle'
  refresh(undefined, true)
}

// --- relief (ARSOhack, pripravljen za zemljevid) ---
interface Teren {
  izhodisce: [number, number]
  celica: number
  stolpci: number
  vrstice: number
  zahod: number
  sever: number
  dno: number
}
const teren = shallowRef<Teren | null>(null)
const visine = shallowRef<Uint16Array | null>(null)
onMounted(async () => {
  if (profile.lokacija) refresh(profile.lokacija, true)
  // vprašaj za lokacijo takoj ob odprtju (razen če jo je uporabnik že zavrnil)
  let zavrnjeno = false
  try {
    zavrnjeno = (await navigator.permissions?.query({ name: 'geolocation' }))?.state === 'denied'
  } catch {
    /* Permissions API ni na voljo – vseeno poskusimo */
  }
  if (zavrnjeno) {
    status.value = 'napaka'
    napaka.value =
      'Dostop do lokacije je v tem brskalniku zavrnjen. Klikni ikono levo od naslova strani, pri »Lokacija« izberi »Dovoli« in nato »Poišči znova«.'
  } else {
    uporabiLokacijo()
  }
  try {
    const base = `${import.meta.env.BASE_URL}assets/map/`
    const [t, b] = await Promise.all([
      fetch(base + 'teren.json').then((r) => r.json()),
      fetch(base + 'teren.bin').then((r) => r.arrayBuffer()),
    ])
    teren.value = t
    visine.value = new Uint16Array(b)
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
// nasvet za odrasle (namesto otroških besedil)
const NASVET: Record<string, string> = {
  odlicno: 'Zrak je čist. Primeren za vse dejavnosti na prostem, tudi za šport.',
  dobro: 'Zrak je dober. Brez skrbi pojdi ven, tudi na tek ali kolo.',
  zmerno: 'Za večino ljudi je v redu. Občutljivi naj skrajšajo daljši napor na prostem.',
  slabo: 'Omeji daljši in napornejši čas zunaj. Občutljivi naj raje ostanejo notri.',
  zeloSlabo: 'Ostani notri in zapri okna. Ven le, kadar je nujno.',
  izjemnoSlabo: 'Zrak je zelo onesnažen. Ostani notri, okna naj bodo zaprta.',
}
// od kod je številka zgoraj
const virZdaj = computed(() => {
  const t = now.value?.cas_utc ? new Date(now.value.cas_utc).toLocaleTimeString('sl-SI', { hour: '2-digit', minute: '2-digit' }) : ''
  if (postaja.value && !postaja.value.ocena)
    return { vrsta: 'meritev' as const, text: `Meritev ARSO${t ? ` ob ${t}` : ''}, postaja ${postaja.value.ime} (${km(postaja.value.d)} od tebe)` }
  return { vrsta: 'ocena' as const, text: `povprečje starih meritev ARSO (Bežigrad ${z.pm25Od}–${z.zadnjeLeto}) za ta mesec in uro – žive meritve trenutno niso na voljo` }
})

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
  if (s <= 1) return { ok: 'da', naslov: 'Da, zrak je dober', text: 'Primerno za sprehod, šport in kolesarjenje.' }
  if (s === 2)
    return { ok: 'mogoce', naslov: 'Lahko, a brez napora', text: `Krajši sprehod je v redu. Za tek ali daljši napor počakaj${najVen.value ? ` do ${hh(najVen.value.h)}` : ' na čistejšo uro'}.` }
  return {
    ok: 'ne',
    naslov: 'Raje počakaj',
    text: najVen.value ? `Ven le, kadar je nujno. Boljši zrak bo okoli ${hh(najVen.value.h)} (${Math.round(najVen.value.pm)} µg/m³).` : 'Ven le, kadar je nujno.',
  }
})
const zracenje = computed(() => {
  const n = najZrac.value
  if (stopnja.value <= 1 || (n && pmZdaj.value <= n.pm * 1.15))
    return { ok: 'da', naslov: 'Da, prezrači zdaj', text: 'Okna odpri na široko za 5–10 minut, nato jih zapri.' }
  return {
    ok: stopnja.value >= 3 ? 'ne' : 'mogoce',
    naslov: 'Počakaj z zračenjem',
    text: n ? `Zrak bo najčistejši okoli ${hh(n.h)} (${Math.round(n.pm)} µg/m³). Takrat okna odpri na široko za 5–10 minut.` : 'Počakaj na čistejšo uro.',
  }
})

// --- načrt za danes: časovna okna ---
function okno(sredina: (typeof ure.value)[number] | null, prag: number, od: number, doUre: number, najvec: number) {
  if (!sredina) return null
  const u = ure.value
  let a = u.findIndex((x) => x.cas === sredina.cas)
  let b = a
  const ok = (x: (typeof u)[number] | undefined) => !!x && x.h >= od && x.h <= doUre && x.pm <= sredina.pm * prag
  while (b - a + 1 < najvec && (ok(u[a - 1]) || ok(u[b + 1]))) {
    if (ok(u[a - 1]) && (!ok(u[b + 1]) || u[a - 1]!.pm <= u[b + 1]!.pm)) a--
    else b++
  }
  return { od: u[a]!.h, do: (u[b]!.h + 1) % 24, pm: Math.round(sredina.pm), i0: a, i1: b }
}
const oknoVen = computed(() => okno(najVen.value, 1.2, 7, 21, 4))
const oknoZrac = computed(() => okno(najZrac.value, 1.1, 6, 22, 2))
const kategorija = (l: { key: string }) => {
  const s = LEVELS.findIndex((x) => x.key === l.key)
  return s <= 1 ? 'dobro' : s === 2 ? 'zmerno' : 'slabo'
}

// --- graf 24 ur ---
const izbrana = ref<number | null>(null)
const izbranaUra = computed(() => (izbrana.value == null ? null : ure.value[izbrana.value] ?? null))
const jeNapoved = computed(() => forecast.value?.model !== 'klima') // sicer so stolpci že »običajne« vrednosti
// os y: lepi koraki po 5 ali 10 µg/m³
const os = computed(() => {
  const vrh = Math.max(20, ...ure.value.map((u) => Math.max(u.pm, jeNapoved.value ? u.obicajno : 0)))
  const korak = vrh > 40 ? 10 : 5
  const max = Math.ceil((vrh * 1.12) / korak) * korak
  const crte: number[] = []
  for (let v = 0; v <= max; v += korak) crte.push(v)
  return { max, crte }
})
const pct = (v: number) => (v / os.value.max) * 100
const iMin = computed(() => ure.value.reduce((m, u, i, a) => (u.pm < a[m]!.pm ? i : m), 0))
const iMax = computed(() => ure.value.reduce((m, u, i, a) => (u.pm > a[m]!.pm ? i : m), 0))
// črta »običajno« (SVG, raztegne se na širino grafa)
const crtaObicajno = computed(() => {
  const n = ure.value.length
  return ure.value.map((u, i) => `${((i + 0.5) / n) * 100},${100 - pct(u.obicajno)}`).join(' ')
})
// en stavek povzetka: boljši ali slabši od običajnega
const primerjava = computed(() => {
  const u = ure.value
  if (!u.length || !jeNapoved.value) return null
  const napoved = u.reduce((a, b) => a + b.pm, 0) / u.length
  const obicajno = u.reduce((a, b) => a + b.obicajno, 0) / u.length
  const r = napoved / obicajno - 1
  if (Math.abs(r) < 0.1) return 'približno tak kot običajno v tem času'
  return `${r < 0 ? 'boljši' : 'slabši'} kot običajno v tem času (za okoli ${Math.round(Math.abs(r) * 100)} %)`
})
const prviDan = computed(() => new Date(ure.value[0]?.cas ?? Date.now()).getDate())

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
          <svg class="pin" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s7-6.4 7-11.5a7 7 0 0 0-14 0C5 14.6 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.4" /></svg>
          {{ status === 'iscem' ? 'Iščem tvojo lokacijo …' : loc.ime }}
          <small v-if="mojaLokacija">· {{ km(odCentra) }} od centra</small>
        </span>
        <button class="btn" :disabled="status === 'iscem'" @click="uporabiLokacijo">
          {{ status === 'iscem' ? 'Iščem …' : mojaLokacija ? 'Osveži lokacijo' : status === 'napaka' ? 'Poišči znova' : 'Uporabi mojo lokacijo' }}
        </button>
        <button v-if="mojaLokacija" class="btn ghost" @click="pozabiLokacijo">Pozabi lokacijo</button>
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
        <p class="kids">{{ NASVET[lvl.key] }}</p>
        <p class="izvor"><VirZnacka :vrsta="virZdaj.vrsta" /> {{ virZdaj.text }}</p>
        <label class="obcutljiv">
          <input v-model="profile.astma" type="checkbox" />
          <span>Sem občutljiv/a (astma, bolezni srca ali pljuč) – strožje meje</span>
        </label>
      </article>

      <article class="card odlocitev" :class="ven.ok">
        <span class="mali">Ali naj grem ven?</span>
        <h2>{{ ven.naslov }}</h2>
        <p>{{ ven.text }}</p>
      </article>

      <article class="card odlocitev" :class="zracenje.ok">
        <span class="mali">Ali naj prezračim?</span>
        <h2>{{ zracenje.naslov }}</h2>
        <p>{{ zracenje.text }}</p>
      </article>
    </div>

    <!-- načrt za danes -->
    <article class="card nacrt">
      <h2>Načrt za naslednjih 24 ur <VirZnacka :vrsta="jeNapoved ? 'model' : 'ocena'" /></h2>
      <div class="pas-dneva" aria-hidden="true">
        <span
          v-for="u in ure"
          :key="u.cas"
          class="seg"
          :class="kategorija(u.lvl)"
          :title="`${hh(u.h)}: ${Math.round(u.pm)} µg/m³`"
        />
      </div>
      <div class="pas-ure" aria-hidden="true">
        <span v-for="(u, i) in ure" :key="u.cas">{{ i % 3 === 0 ? `${u.h}h` : '' }}</span>
      </div>
      <ul class="okna">
        <li v-if="oknoVen" class="ven">
          <span class="cas">{{ hh(oknoVen.od) }}–{{ hh(oknoVen.do) }}</span>
          <span><strong>Najboljši čas za ven.</strong> Primerno za sprehod, šport in opravke zunaj.</span>
        </li>
        <li v-if="oknoZrac" class="zrac">
          <span class="cas">{{ hh(oknoZrac.od) }}–{{ hh(oknoZrac.do) }}</span>
          <span><strong>Prezrači stanovanje.</strong> Okna na široko za 5–10 minut, nato jih zapri.</span>
        </li>
        <li v-if="najslabse" class="notri">
          <span class="cas">{{ hh(najslabse.od) }}–{{ hh(najslabse.do) }}</span>
          <span><strong>Okna zaprta, raje ostani notri.</strong> Najslabši zrak v naslednjih 24 urah (okoli {{ najslabse.pm }} µg/m³).</span>
        </li>
      </ul>
      <p class="legenda-pas">
        <span class="seg dobro" /> dober zrak <span class="seg zmerno" /> zmerno <span class="seg slabo" /> slab zrak
        <template v-if="profile.astma"> · upoštevane so strožje meje za občutljive</template>
      </p>
    </article>

    <!-- graf 24 ur -->
    <article class="card graf">
      <h2>Koliko delcev bo v zraku v naslednjih 24 urah?</h2>
      <p class="povzetek">
        <template v-if="primerjava">Zrak bo {{ primerjava }}.</template>
        <template v-else>Napoved trenutno ni na voljo, zato graf kaže, kakšen je zrak ob teh urah običajno.</template>
        Višji stolpec pomeni več delcev PM2.5, barva pa, ali je zrak dober, zmeren ali slab.
      </p>

      <div class="podrobno" aria-live="polite">
        <template v-if="izbranaUra">
          Ob <strong>{{ hh(izbranaUra.h) }}</strong>: {{ Math.round(izbranaUra.pm) }} µg/m³ –
          <span class="lvl" :style="{ background: izbranaUra.lvl.color }">{{ izbranaUra.lvl.label }}</span>
          <span v-if="jeNapoved" class="sivo"> · običajno ob tej uri {{ Math.round(izbranaUra.obicajno) }} µg/m³</span>
        </template>
        <span v-else class="sivo">Pokaži ali tapni stolpec, da vidiš posamezno uro.</span>
      </div>

      <div class="g">
        <!-- os y -->
        <div class="g-os" aria-hidden="true">
          <span v-for="v in os.crte" :key="v" :style="{ bottom: `${pct(v)}%` }">{{ v }}</span>
          <em>µg/m³</em>
        </div>
        <div class="g-plos" @pointerleave="izbrana = null">
          <!-- mreža -->
          <span v-for="v in os.crte" :key="v" class="mreza" :style="{ bottom: `${pct(v)}%` }" aria-hidden="true" />
          <!-- stolpci -->
          <button
            v-for="(u, i) in ure"
            :key="u.cas"
            class="st"
            :class="{ izbran: izbrana === i, novdan: i > 0 && u.h === 0 }"
            :aria-label="`${hh(u.h)}: ${Math.round(u.pm)} µg/m³, ${u.lvl.label}`"
            @pointerenter="izbrana = i"
            @focus="izbrana = i"
            @click="izbrana = i"
          >
            <span class="bar" :style="{ height: `${pct(u.pm)}%`, background: u.lvl.color, '--d': `${i * 25}ms` }">
              <span v-if="i === iMin" class="oznaka min" :class="{ levo: i < 2, desno: i > ure.length - 3 }">najčistejše<br /><b>{{ Math.round(u.pm) }}</b></span>
              <span v-else-if="i === iMax" class="oznaka max" :class="{ levo: i < 2, desno: i > ure.length - 3 }">najslabše<br /><b>{{ Math.round(u.pm) }}</b></span>
            </span>
          </button>
          <!-- črta »običajno« -->
          <svg v-if="jeNapoved" class="crta" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <polyline :points="crtaObicajno" />
          </svg>
          <span v-if="jeNapoved" class="crta-napis" :style="{ bottom: `${pct(ure[ure.length - 1]?.obicajno ?? 0)}%` }">običajno</span>
        </div>
        <!-- os x -->
        <div class="g-ure" aria-hidden="true">
          <span v-for="(u, i) in ure" :key="u.cas">
            <template v-if="i === 0 || u.h % 3 === 0">{{ u.h }}h</template>
            <small v-if="u.h === 0 && new Date(u.cas).getDate() !== prviDan">jutri</small>
          </span>
        </div>
      </div>

      <div class="legenda">
        <span><i class="lg-st" /> {{ jeNapoved ? 'napoved' : 'običajna vrednost' }} za vsako uro (barva = kakovost zraka)</span>
        <span v-if="jeNapoved"><i class="lg-crta" /> običajno ob tej uri v tem mesecu</span>
      </div>
      <p class="vir">
        <template v-if="jeNapoved">
          <VirZnacka vrsta="model" /> Stolpci so napoved modela CAMS (evropski program Copernicus, prek Open-Meteo) za Ljubljano – izračun, ne meritev.
          ARSO je izmeril, da je CAMS pozimi 2025/26 na Bežigradu delce precenil za okoli 70 %, zato je napoved bolj zanesljiva za
          potek dneva (kdaj bo bolje in kdaj slabše) kot za točno število.
          <br /><VirZnacka vrsta="meritev" /> Črtkana črta je povprečje meritev ARSO na Bežigradu {{ z.pm25Od }}–{{ z.zadnjeLeto }} za isti mesec in uro.
        </template>
        <template v-else>
          <VirZnacka vrsta="ocena" /> Napoved trenutno ni na voljo. Stolpci zato kažejo povprečje meritev ARSO na Bežigradu
          {{ z.pm25Od }}–{{ z.zadnjeLeto }} za isti mesec in uro – to ni napoved za danes.
        </template>
      </p>
    </article>

    <!-- lokacija: višina, megla, bližina -->
    <div class="spodaj">
      <article v-if="visina" class="card info">
        <h3>Tvoja lokacija je {{ visina.m }} m nad morjem</h3>
        <p>
          To je <strong>{{ visina.nadDnom > 0 ? `${visina.nadDnom} m nad` : 'na' }} dnom kotline</strong>.
          <template v-if="megla?.inv && megla.pod">Zdaj je inverzija in hladen, onesnažen zrak sega do približno {{ megla.vrh }} m – <strong>si pod to plastjo</strong>.</template>
          <template v-else-if="megla?.inv">Zdaj je inverzija, a plast hladnega zraka (do približno {{ megla.vrh }} m) je pod tabo.</template>
          <template v-else>Zdaj ni inverzije, zrak se meša.</template>
          <template v-if="visina.nadDnom < 60"> Pozimi ob inverziji je tvoje območje med prvimi, kjer se ujame megla.</template>
        </p>
        <p class="izvor"><VirZnacka vrsta="ocena" /> višina iz reliefa Copernicus DEM (paket ARSOhack); plast megle: <VirZnacka :vrsta="scene?.vir === 'klima' ? 'ocena' : 'model'" /> {{ scene?.vir === 'klima' ? 'iz povprečja preteklih let' : 'vremenski model Open-Meteo' }}</p>
      </article>


      <article class="card info">
        <h3>{{ MESECI[new Date().getMonth()]![0]!.toUpperCase() + MESECI[new Date().getMonth()]!.slice(1) }} je običajno {{ fmt(mesec.pm) }} µg/m³</h3>
        <p>
          Po 10 letih meritev je to {{ mesec.vrstni }}. najslabši mesec v letu.
          <template v-if="mesec.vrstni <= 4">Pozimi kurimo in zrak se pogosto ujame v kotlini – zato je toliko bolj pomembno, kdaj greš ven in kdaj zračiš.</template>
          <template v-else>To je eden boljših mesecev – dobra priložnost za čas na prostem.</template>
        </p>
        <p class="izvor"><VirZnacka vrsta="meritev" /> povprečje meritev ARSO na Bežigradu {{ z.pm25Od }}–{{ z.zadnjeLeto }}</p>
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
.pin {
  width: 18px;
  height: 18px;
  vertical-align: -4px;
  margin-right: 2px;
  fill: none;
  stroke: var(--coral);
  stroke-width: 2.2;
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
.odlocitev h2 {
  font-size: 1.7rem;
  margin: 6px 0;
  color: color-mix(in srgb, var(--o) 65%, var(--ink));
}
.odlocitev p {
  margin: 0;
  font-weight: 600;
}

/* od kod je podatek */
.izvor {
  margin: 10px 0 0;
  font-size: 0.8rem;
  color: var(--ink-soft);
}
/* načrt za danes */
.nacrt {
  margin-bottom: 18px;
}
.nacrt h2 {
  font-size: 1.5rem;
  margin: 0 0 12px;
}
.pas-dneva {
  display: flex;
  gap: 2px;
  height: 22px;
}
.seg {
  flex: 1;
  border-radius: 4px;
}
.seg.dobro {
  background: var(--aq-1);
}
.seg.zmerno {
  background: var(--aq-3);
}
.seg.slabo {
  background: var(--aq-5);
}
.pas-ure {
  display: flex;
  gap: 2px;
  margin-top: 4px;
}
.pas-ure span {
  flex: 1;
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--ink-soft);
  white-space: nowrap;
}
.okna {
  list-style: none;
  margin: 16px 0 0;
  padding: 0;
  display: grid;
  gap: 10px;
}
.okna li {
  --o: var(--aq-1);
  display: flex;
  align-items: baseline;
  gap: 14px;
  padding: 10px 14px;
  border-radius: var(--radius-sm);
  border-left: 5px solid var(--o);
  background: color-mix(in srgb, var(--o) 9%, var(--card));
}
.okna li.zrac {
  --o: var(--brand);
}
.okna li.notri {
  --o: var(--aq-5);
}
.okna .cas {
  flex: none;
  min-width: 118px;
  font-family: var(--font-head);
  font-size: 1.25rem;
  color: color-mix(in srgb, var(--o) 70%, var(--ink));
}
.legenda-pas {
  margin: 12px 0 0;
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--ink-soft);
}
.legenda-pas .seg {
  display: inline-block;
  width: 14px;
  height: 10px;
  margin: 0 4px 0 8px;
}
.legenda-pas .seg:first-child {
  margin-left: 0;
}

/* graf */
.graf h2 {
  font-size: 1.5rem;
  margin: 0 0 6px;
}
.povzetek {
  margin: 0;
  color: var(--ink-soft);
}
.podrobno {
  min-height: 1.8em;
  margin: 12px 0 10px;
  font-weight: 600;
}
.podrobno .lvl {
  display: inline-block;
  padding: 1px 10px;
  border-radius: 999px;
  color: #fff;
  font-weight: 800;
  font-size: 0.85rem;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.25);
}
.sivo {
  color: var(--ink-soft);
  font-weight: 600;
}
.g {
  display: grid;
  grid-template-columns: 34px 1fr;
  grid-template-rows: 240px auto;
  margin-top: 26px; /* prostor za enoto nad osjo */
}
.g-os {
  position: relative;
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--ink-soft);
}
.g-os span {
  position: absolute;
  right: 6px;
  transform: translateY(50%);
}
.g-os em {
  position: absolute;
  top: -26px;
  left: 0;
  font-style: normal;
  white-space: nowrap;
}
.g-plos {
  position: relative;
  display: flex;
  align-items: flex-end;
  gap: 3px;
  border-left: 1px solid var(--line);
}
.mreza {
  position: absolute;
  left: 0;
  right: 0;
  border-top: 1px solid var(--line);
  pointer-events: none;
}
.st {
  position: relative;
  flex: 1;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  padding: 0;
  border: 0;
  background: none;
  cursor: pointer;
  z-index: 1;
}
.st.novdan::before {
  content: '';
  position: absolute;
  left: -2px;
  top: 0;
  bottom: 0;
  border-left: 1px dashed var(--ink-soft);
  opacity: 0.5;
}
.bar {
  position: relative;
  display: block;
  min-height: 3px;
  border-radius: 6px 6px 2px 2px;
  opacity: 0.85;
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
  outline: 2px solid var(--ink);
  outline-offset: 1px;
}
.oznaka {
  position: absolute;
  bottom: calc(100% + 4px);
  left: 50%;
  transform: translateX(-50%);
  font-size: 0.66rem;
  font-weight: 800;
  line-height: 1.15;
  text-align: center;
  white-space: nowrap;
  color: var(--ink-soft);
}
.oznaka.levo {
  left: 0;
  transform: none;
  text-align: left;
}
.oznaka.desno {
  left: auto;
  right: 0;
  transform: none;
  text-align: right;
}
.oznaka b {
  font-family: var(--font-head);
  font-size: 1rem;
  color: var(--ink);
}
.crta {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
  pointer-events: none;
  z-index: 2;
}
.crta polyline {
  fill: none;
  stroke: var(--ink);
  stroke-width: 2;
  stroke-dasharray: 6 5;
  opacity: 0.55;
  vector-effect: non-scaling-stroke;
}
.crta-napis {
  position: absolute;
  right: 0;
  transform: translateY(-4px);
  font-size: 0.72rem;
  font-weight: 800;
  color: var(--ink-soft);
  background: var(--card);
  padding: 0 4px;
  border-radius: 4px;
  z-index: 3;
  pointer-events: none;
}
.g-ure {
  grid-column: 2;
  display: flex;
  gap: 3px;
  padding-top: 6px;
}
.g-ure span {
  flex: 1;
  min-width: 0;
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--ink-soft);
  white-space: nowrap;
  overflow: visible;
}
.g-ure small {
  display: block;
  font-weight: 800;
  color: var(--ink);
}
.legenda {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 22px;
  margin-top: 14px;
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--ink-soft);
}
.lg-st {
  display: inline-block;
  width: 26px;
  height: 12px;
  margin-right: 6px;
  vertical-align: -1px;
  border-radius: 3px;
  background: linear-gradient(90deg, var(--aq-1) 33%, var(--aq-3) 33% 66%, var(--aq-5) 66%);
}
.lg-crta {
  display: inline-block;
  width: 26px;
  margin-right: 6px;
  vertical-align: 3px;
  border-top: 2px dashed var(--ink);
  opacity: 0.6;
}
.vir {
  margin: 10px 0 0;
  font-size: 0.8rem;
  color: var(--ink-soft);
}
.vir strong {
  color: var(--ink);
}

/* spodaj */
.spodaj {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 18px;
  margin-top: 18px;
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
  .g {
    grid-template-rows: 190px auto;
  }
  .g-plos,
  .g-ure {
    gap: 1px;
  }
  .g-ure span {
    font-size: 0.6rem;
  }
  .oznaka {
    font-size: 0.55rem;
  }
  .crta-napis {
    display: none; /* na ozkem zaslonu črto razloži legenda */
  }
  .oznaka.levo {
  left: 0;
  transform: none;
  text-align: left;
}
.oznaka.desno {
  left: auto;
  right: 0;
  transform: none;
  text-align: right;
}
.oznaka b {
    font-size: 0.8rem;
  }
  .okna li {
    flex-direction: column;
    gap: 2px;
  }

}
</style>
