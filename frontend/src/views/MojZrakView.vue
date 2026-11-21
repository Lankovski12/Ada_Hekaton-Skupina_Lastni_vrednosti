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
    return { vrsta: 'meritev', text: `Meritev ARSO${t ? ` ob ${t}` : ''}, postaja ${postaja.value.ime} (${km(postaja.value.d)} od tebe)` }
  return { vrsta: 'ocena', text: `povprečje starih meritev ARSO (Bežigrad ${z.pm25Od}–${z.zadnjeLeto}) za ta mesec in uro – žive meritve trenutno niso na voljo` }
})
const virNapoved = computed(() =>
  forecast.value?.model === 'klima'
    ? { vrsta: 'ocena', text: `ocena iz povprečja starih meritev ARSO (${z.pm25Od}–${z.zadnjeLeto}) – napoved trenutno ni na voljo` }
    : { vrsta: 'napoved', text: 'napoved modela CAMS (Copernicus, prek Open-Meteo) za Ljubljano – izračun, ne meritev' },
)

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
        <p class="izvor"><span class="vrsta" :class="virZdaj.vrsta">{{ virZdaj.vrsta }}</span> {{ virZdaj.text }}</p>
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
      <h2>Načrt za naslednjih 24 ur</h2>
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
      <div class="graf-glava">
        <div>
          <h2>Naslednjih 24 ur</h2>
          <p class="mali">Pokaži ali tapni stolpec za podrobnosti.</p>
        </div>
        <ul class="legenda">
          <li><span class="tag ven">ven</span> najboljša ura za ven</li>
          <li><span class="tag zrac">zrači</span> najboljša ura za zračenje</li>
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
            <span v-if="najVen && u.cas === najVen.cas" class="tag ven">ven</span>
            <span v-if="najZrac && u.cas === najZrac.cas" class="tag zrac">zrači</span>
          </span>
          <span class="bar" :style="{ height: `${(u.pm / maxPm) * 100}%`, background: u.lvl.color, '--d': `${i * 25}ms` }" />
          <span class="obicajno" :style="{ bottom: `${(u.obicajno / maxPm) * 100}%` }" />
          <span class="ura">{{ u.h % 3 === 0 ? `${u.h}h` : '' }}</span>
        </button>
      </div>
      <dl class="viri">
        <div>
          <dt><span class="vzorec stolpec" /> Stolpci</dt>
          <dd><span class="vrsta" :class="virNapoved.vrsta">{{ virNapoved.vrsta }}</span> {{ virNapoved.text }}</dd>
        </div>
        <div>
          <dt><span class="vzorec pikica" /> Pikice</dt>
          <dd><span class="vrsta stari">stari podatki</span> povprečje meritev ARSO na Bežigradu {{ z.pm25Od }}–{{ z.zadnjeLeto }} za isti mesec in uro (paket ARSOhack) – kakšen je zrak ob tej uri običajno</dd>
        </div>
        <div>
          <dt>Zgoraj</dt>
          <dd><span class="vrsta" :class="virZdaj.vrsta">{{ virZdaj.vrsta }}</span> {{ virZdaj.text }}</dd>
        </div>
      </dl>
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
        <p class="izvor"><span class="vrsta stari">relief</span> Copernicus DEM (paket ARSOhack); megla: {{ scene?.vir === 'klima' ? 'ocena iz starih meritev' : 'vremenski podatki Open-Meteo' }}</p>
      </article>


      <article class="card info">
        <h3>{{ MESECI[new Date().getMonth()]![0]!.toUpperCase() + MESECI[new Date().getMonth()]!.slice(1) }} je običajno {{ fmt(mesec.pm) }} µg/m³</h3>
        <p>
          Po 10 letih meritev je to {{ mesec.vrstni }}. najslabši mesec v letu.
          <template v-if="mesec.vrstni <= 4">Pozimi kurimo in zrak se pogosto ujame v kotlini – zato je toliko bolj pomembno, kdaj greš ven in kdaj zračiš.</template>
          <template v-else>To je eden boljših mesecev – dobra priložnost za čas na prostem.</template>
        </p>
        <p class="izvor"><span class="vrsta stari">stari podatki</span> povprečje meritev ARSO na Bežigradu {{ z.pm25Od }}–{{ z.zadnjeLeto }}</p>
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
.vrsta {
  display: inline-block;
  margin-right: 4px;
  padding: 1px 8px;
  border-radius: 999px;
  font-size: 0.68rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  vertical-align: 1px;
  background: var(--bg-soft);
  color: var(--ink);
}
.vrsta.meritev {
  background: color-mix(in srgb, var(--aq-1) 22%, transparent);
}
.vrsta.napoved {
  background: color-mix(in srgb, var(--brand) 20%, transparent);
}
.vrsta.ocena,
.vrsta.stari {
  background: color-mix(in srgb, var(--accent) 30%, transparent);
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

/* oznake v grafu */
.tag {
  display: inline-block;
  padding: 1px 6px;
  border-radius: 6px;
  font-size: 0.62rem;
  font-weight: 800;
  line-height: 1.3;
  color: #fff;
  white-space: nowrap;
}
.tag.ven {
  background: var(--aq-1);
}
.tag.zrac {
  background: var(--brand);
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
  top: -10px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  z-index: 1;
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
.viri {
  display: grid;
  gap: 6px;
  margin: 14px 0 0;
  padding-top: 12px;
  border-top: 1px solid var(--line);
  font-size: 0.8rem;
}
.viri div {
  display: grid;
  grid-template-columns: 92px 1fr;
  gap: 8px;
}
.viri dt {
  font-weight: 800;
}
.viri dd {
  margin: 0;
  color: var(--ink-soft);
}
.vzorec {
  display: inline-block;
  vertical-align: 0;
  margin-right: 4px;
}
.vzorec.stolpec {
  width: 9px;
  height: 12px;
  border-radius: 2px 2px 0 0;
  background: var(--aq-2);
}
.vzorec.pikica {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--ink);
  opacity: 0.45;
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
  .tag {
    font-size: 0.55rem;
    padding: 1px 3px;
  }
  .zgoraj,
  .spodaj {
    grid-template-columns: 1fr;
  }
  .stolpci {
    height: 180px;
    gap: 2px;
  }
  .okna li {
    flex-direction: column;
    gap: 2px;
  }
  .viri div {
    grid-template-columns: 1fr;
    gap: 0;
  }
}
</style>
