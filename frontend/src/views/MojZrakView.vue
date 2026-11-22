<script setup lang="ts">
// Zavihek »Moj zrak«: osebni pregled za izbrano lokacijo.
// - lokacija iz brskalnika ali poljubna lokacija iz iskalnika (šole in vrtci lokalno, naslovi prek
//   OpenStreetMap / Photon); ostane samo na napravi, sicer center Ljubljane
// - stanje zdaj na najbližji postaji ARSO in odgovori: ali lahko grem ven, ali lahko športam, ali naj prezračim
// - graf za naslednjih 24 ur z najboljšo uro za ven in za zračenje ter primerjavo z običajnim dnem
// - načrt za danes: kdaj je pametno iti ven, kdaj zračiti in kdaj ostati notri
// - iz ARSOhack: nadmorska višina (relief) in ali si ob inverziji pod meglo, kakšen je običajno ta mesec
// Pri vsaki številki piše, ali je meritev, napoved modela ali ocena iz starih meritev.
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { useAirData } from '@/composables/useAirData'
import { useProfile } from '@/composables/useProfile'
import { LEVELS, levelFor } from '@/lib/airQuality'
import { typical } from '@/lib/klima'
import { d96ToWgs84, razdalja, wgs84ToD96 } from '@/lib/geo'
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
      'Brskalnik da lokacijo samo varni strani (naslov z https:// ali localhost). Odprite stran prek takega naslova. Do takrat je prikazan center Ljubljane.'
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
      ? 'Dostop do lokacije je zavrnjen. Kliknite ikono levo od naslova strani v brskalniku, pri »Lokacija« izberite »Dovoli« in nato »Poišči znova«.'
      : err?.code === 3
        ? 'Iskanje lokacije je trajalo predolgo. Preverite povezavo in poskusite znova.'
        : 'Brskalnik ne ve, kje ste. Preverite, da so lokacijske storitve vklopljene v sistemu za ta brskalnik (Windows: Nastavitve → Zasebnost → Lokacija; macOS: Sistemske nastavitve → Zasebnost → Lokacijske storitve) in poskusite znova.'
}
// --- poljubna lokacija: iskalnik s samodejnim dopolnjevanjem ---
// Predlogi: šole in vrtci (lokalno, assets/map/sole.json) in naslovi, ulice, kraji iz OpenStreetMap
// (Photon, narejen za iskanje med tipkanjem). Vpisano besedilo gre na photon.komoot.io, lokacija ostane na napravi.
interface Predlog {
  id: string
  ime: string
  opis: string
  lat: number
  lon: number
}
const izbiram = ref(false)
const iskanje = ref('')
const odprt = ref(false)
const iscemSplet = ref(false)
const iskalnik = ref<HTMLInputElement | null>(null)
const sole = shallowRef<Predlog[]>([])
const spletni = shallowRef<Predlog[]>([])
const norm = (t: string) =>
  t
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

async function naloziSole() {
  if (sole.value.length) return
  try {
    const base = `${import.meta.env.BASE_URL}assets/map/`
    const [s, t] = await Promise.all([fetch(base + 'sole.json').then((r) => r.json()), teren.value ?? fetch(base + 'teren.json').then((r) => r.json())])
    const [e0, n0] = t.izhodisce as [number, number]
    sole.value = (s.sole as { id: number; ime: string; kat: string; naslov: string | null; cs: string | null; x: number; y: number }[]).map((x) => {
      const g = d96ToWgs84(e0 + x.x, n0 + x.y)
      return {
        id: `sola-${x.id}`,
        ime: x.ime,
        opis: [x.kat === 'vrtec' ? 'vrtec' : 'šola', x.naslov, x.cs].filter(Boolean).join(' · '),
        lat: g.lat,
        lon: g.lon,
      }
    })
  } catch {
    /* brez seznama šol – ostanejo predlogi iz OpenStreetMap */
  }
}
const lokalni = computed(() => {
  const q = norm(iskanje.value.trim())
  if (q.length < 2) return []
  const besede = q.split(/\s+/)
  return sole.value
    .filter((s) => besede.every((b) => norm(`${s.ime} ${s.opis}`).includes(b)))
    .sort((a, b) => (norm(a.ime).includes(q) ? 0 : 1) - (norm(b.ime).includes(q) ? 0 : 1) || a.ime.length - b.ime.length)
    .slice(0, 4)
})
const predlogi = computed(() => [...lokalni.value, ...spletni.value].slice(0, 8))

interface PhotonFeature {
  geometry: { coordinates: [number, number] }
  properties: Record<string, string | undefined>
}
let zamik = 0
let abort: AbortController | null = null
watch(iskanje, (q) => {
  window.clearTimeout(zamik)
  abort?.abort()
  if (q.trim().length < 3) {
    spletni.value = []
    iscemSplet.value = false
    return
  }
  iscemSplet.value = true
  zamik = window.setTimeout(async () => {
    abort = new AbortController()
    try {
      const url = new URL('https://photon.komoot.io/api/')
      url.search = new URLSearchParams({ q: q.trim(), limit: '6', lat: '46.05', lon: '14.51', bbox: '14.2,45.9,14.85,46.25' }).toString()
      const res = await fetch(url, { signal: abort.signal })
      const data = (await res.json()) as { features: PhotonFeature[] }
      spletni.value = data.features.map((f, i) => {
        const p = f.properties
        const ulica = [p.street, p.housenumber].filter(Boolean).join(' ')
        const ime = p.name || ulica || p.city || 'Lokacija'
        return {
          id: `osm-${p.osm_id ?? i}`,
          ime,
          opis: [ulica !== ime ? ulica : '', p.district, p.city !== ime ? p.city : ''].filter(Boolean).join(' · '),
          lat: f.geometry.coordinates[1],
          lon: f.geometry.coordinates[0],
        }
      })
    } catch {
      /* brez povezave ali prekinjeno – ostanejo lokalni predlogi */
    } finally {
      iscemSplet.value = false
    }
  }, 300)
})
onBeforeUnmount(() => {
  window.clearTimeout(zamik)
  abort?.abort()
  window.removeEventListener('scroll', skrijNamig, true)
})

async function odpriIskanje() {
  izbiram.value = !izbiram.value
  if (!izbiram.value) return
  naloziSole()
  await new Promise((ok) => requestAnimationFrame(ok))
  iskalnik.value?.focus()
}
function izberiLokacijo(p: Predlog) {
  profile.lokacija = { ime: p.ime, lat: p.lat, lon: p.lon }
  status.value = 'idle'
  izbiram.value = false
  odprt.value = false
  iskanje.value = ''
  refresh(profile.lokacija, true)
}
function potrdi() {
  const p = predlogi.value[0]
  if (p) izberiLokacijo(p)
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
  window.addEventListener('scroll', skrijNamig, { passive: true, capture: true }) // okence z zanimivostjo ne sme obviseti
  if (profile.lokacija) refresh(profile.lokacija, true)
  // vprašaj za lokacijo takoj ob odprtju (razen če je lokacija že izbrana ali jo je uporabnik zavrnil)
  let zavrnjeno = false
  try {
    zavrnjeno = (await navigator.permissions?.query({ name: 'geolocation' }))?.state === 'denied'
  } catch {
    /* Permissions API ni na voljo – vseeno poskusimo */
  }
  if (profile.lokacija) {
    /* lokacija je že izbrana – ne sprašuj znova */
  } else if (zavrnjeno) {
    status.value = 'napaka'
    napaka.value =
      'Dostop do lokacije je v tem brskalniku zavrnjen. Kliknite ikono levo od naslova strani, pri »Lokacija« izberite »Dovoli« in nato »Poišči znova«.'
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
// nasvet za starše – isto besedilo kot na domači strani (lib/airQuality.ts)
const NASVET: Record<string, string> = Object.fromEntries(LEVELS.map((l) => [l.key, l.parents]))
// od kod je številka zgoraj
const virZdaj = computed(() => {
  const t = now.value?.cas_utc ? new Date(now.value.cas_utc).toLocaleTimeString('sl-SI', { hour: '2-digit', minute: '2-digit' }) : ''
  if (postaja.value && !postaja.value.ocena)
    return { vrsta: 'meritev' as const, text: `Meritev ARSO${t ? ` ob ${t}` : ''}, postaja ${postaja.value.ime} (${km(postaja.value.d)} od vas)` }
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
const hh = (h: number) => `${String(h).padStart(2, '0')}:00`

const ven = computed(() => {
  const s = stopnja.value
  if (s <= 1) return { ok: 'da', naslov: 'Da', text: 'Primerno za sprehod, igrišče in igro zunaj.' }
  if (s === 2) return { ok: 'mogoce', naslov: 'Da, a ne predolgo', text: 'Sprehod in mirnejša igra sta v redu.' }
  return {
    ok: 'ne',
    naslov: 'Raje ostanite notri',
    text: najVen.value ? `Ven le, kadar je nujno. Boljši zrak bo okoli ${hh(najVen.value.h)} (${Math.round(najVen.value.pm)} µg/m³).` : 'Ven le, kadar je nujno.',
  }
})
// pri športu dihamo hitreje in globlje, zato so meje strožje kot za sprehod
const sport = computed(() => {
  const s = stopnja.value
  const kdaj = najVen.value ? ` Najboljša ura: ${hh(najVen.value.h)}.` : ''
  if (s <= 1) return { ok: 'da', naslov: 'Da', text: 'Tek, nogomet in kolo – brez skrbi.' }
  if (s === 2) return { ok: 'mogoce', naslov: 'Le lažji šport', text: `Pri teku in napornem športu vdihnemo več delcev.${kdaj}` }
  return { ok: 'ne', naslov: 'Ne zunaj', text: `Šport prestavite v telovadnico ali na čistejšo uro.${kdaj}` }
})
const zracenje = computed(() => {
  const n = najZrac.value
  if (stopnja.value <= 1 || (n && pmZdaj.value <= n.pm * 1.15))
    return { ok: 'da', naslov: 'Da, prezračite zdaj', text: 'Okna odprite na široko za 5–10 minut, nato jih zaprite.' }
  return {
    ok: stopnja.value >= 3 ? 'ne' : 'mogoce',
    naslov: 'Počakajte z zračenjem',
    text: n ? `Zrak bo najčistejši okoli ${hh(n.h)} (${Math.round(n.pm)} µg/m³). Takrat okna odprite na široko za 5–10 minut.` : 'Počakajte na čistejšo uro.',
  }
})

// tri odločitve v eni kartici
const odlocitve = computed(() => [
  { id: 'ven', vprasanje: 'Lahko grem ven?', ...ven.value },
  { id: 'sport', vprasanje: 'Lahko športam zunaj?', ...sport.value },
  { id: 'zrac', vprasanje: 'Naj prezračim?', ...zracenje.value },
])

// --- graf 24 ur ---
const izbrana = ref<number | null>(null)
// okence z zanimivostjo: kje je in za katero uro (pokaže se samo ob prehodu z miško / dotiku)
const namig = ref<{ i: number; x: number; y: number } | null>(null)
const namigUra = computed(() => (namig.value ? ure.value[namig.value.i] ?? null : null))
function pokaziNamig(i: number, e: Event) {
  const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
  izbrana.value = i
  namig.value = { i, x: r.left + r.width / 2, y: r.top }
}
function skrijNamig() {
  izbrana.value = null
  namig.value = null
}
const namigSlog = computed(() => {
  const n = namig.value
  if (!n) return {}
  const w = Math.min(280, window.innerWidth - 24)
  const left = Math.max(12, Math.min(window.innerWidth - w - 12, n.x - w / 2))
  return { left: `${left}px`, top: `${n.y - 10}px`, width: `${w}px`, '--puscica': `${n.x - left}px` }
})
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

// --- zanimivost za vsak razred kakovosti zraka (pokaže se ob prehodu z miško čez uro na grafu) ---
const maj = z.meseci[4]!.pm25
const jan = z.meseci[0]!.pm25
const rekord = new Date(z.rekord.datum).toLocaleDateString('sl-SI', { day: 'numeric', month: 'long', year: 'numeric' })
const ZANIMIVOST: Record<string, string> = {
  odlicno: `Pod smernico WHO (15 µg/m³ na dan). Tak zrak je najpogostejši poleti in po dežju: maja je na Bežigradu povprečno le ${fmt(maj)} µg/m³.`,
  dobro: `Okoli smernice WHO (15 µg/m³ na dan). Za primerjavo: januarja je na Bežigradu povprečno ${fmt(jan)} µg/m³, maja ${fmt(maj)} µg/m³.`,
  zmerno: 'Nad smernico WHO. Delci PM2.5 so tako majhni, da iz pljuč preidejo v kri in z njo po vsem telesu.',
  slabo: `Tak zrak je pogost ob zimskih večerih z inverzijo (povprečno ${fmt(z.primeri.inverzijaVecer)} µg/m³). Pri otrocih z astmo lahko sproži kašelj, piskanje in težko dihanje.`,
  zeloSlabo: 'Kdor tak zrak diha veliko dni na leto, ima pogosteje okužbe dihal. Pri otrocih je povezan s počasnejšo rastjo pljuč.',
  izjemnoSlabo: `Ob takem zraku več ljudi poišče zdravniško pomoč zaradi težav z dihanjem in srcem. Najslabši dan v 10 letih meritev je bil ${rekord} (PM10 ${fmt(z.rekord.pm10)} µg/m³).`,
}
</script>

<template>
  <section class="container page" :style="{ '--lvl': lvl.color }">
    <!-- glava z lokacijo -->
    <header class="glava">
      <h1>Moj zrak</h1>
      <div class="lokacija">
        <span class="chip">
          <svg class="pin" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s7-6.4 7-11.5a7 7 0 0 0-14 0C5 14.6 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.4" /></svg>
          {{ status === 'iscem' ? 'Iščem vašo lokacijo …' : loc.ime }}
          <small v-if="mojaLokacija">· {{ km(odCentra) }} od centra</small>
        </span>
        <button class="btn" :disabled="status === 'iscem'" @click="uporabiLokacijo">
          {{ status === 'iscem' ? 'Iščem …' : 'Uporabi mojo lokacijo' }}
        </button>
        <button class="btn ghost" :aria-expanded="izbiram" @click="odpriIskanje">
          {{ izbiram ? 'Zapri' : 'Izberi lokacijo' }}
        </button>
        <div v-if="izbiram" class="iskalnik" :class="{ odprt: odprt && iskanje.trim().length >= 2 }">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" /></svg>
          <input
            ref="iskalnik"
            v-model="iskanje"
            type="search"
            placeholder="Naslov, ulica, kraj, šola ali vrtec"
            aria-label="Poišči lokacijo"
            autocomplete="off"
            @input="odprt = true"
            @focus="odprt = true"
            @keydown.enter.prevent="potrdi"
            @keydown.esc="izbiram = false"
          />
          <ul v-if="odprt && predlogi.length" class="zadetki" role="listbox">
            <li v-for="z in predlogi" :key="z.id" role="option">
              <button @mousedown.prevent="izberiLokacijo(z)" @click="izberiLokacijo(z)">
                <strong>{{ z.ime }}</strong>
                <small v-if="z.opis">{{ z.opis }}</small>
              </button>
            </li>
          </ul>
          <p v-else-if="odprt && iskanje.trim().length >= 2" class="nic">
            {{ iscemSplet ? 'Iščem …' : 'Ne najdem. Poskusite z ulico ali delom imena.' }}
          </p>
        </div>
      </div>
    </header>
    <p v-if="status === 'napaka'" class="opozorilo">{{ napaka }}</p>
    <p v-if="izvenLj" class="opozorilo">
      Izbrana lokacija je zunaj ljubljanske kotline. Prikazani so podatki za Ljubljano, ki so najbližji.
    </p>

    <!-- stanje zdaj in odločitve v eni kartici -->
    <article class="card zdaj">
      <div class="stanje">
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
          <span>Otrok ima astmo ali občutljiva pljuča – strožje meje</span>
        </label>
      </div>
      <ul class="odlocitve">
        <li v-for="o in odlocitve" :key="o.id" :class="o.ok">
          <span class="mali">{{ o.vprasanje }}</span>
          <strong>{{ o.naslov }}</strong>
          <p>{{ o.text }}</p>
        </li>
      </ul>
    </article>

    <!-- graf 24 ur -->
    <article class="card graf">
      <h2>Napoved za naslednjih 24 ur <VirZnacka :vrsta="jeNapoved ? 'model' : 'ocena'" /></h2>
      <p class="povzetek">
        <template v-if="primerjava">Zrak bo {{ primerjava }}.</template>
        <template v-else>Napoved trenutno ni na voljo, zato graf kaže, kakšen je zrak ob teh urah običajno.</template>
        Višji stolpec pomeni več delcev PM2.5, barva pa, ali je zrak dober, zmeren ali slab.
      </p>

      <p class="sivo namig-hint">Pokažite na stolpec za zanimivost o takem zraku.</p>

      <div class="g">
        <!-- os y -->
        <div class="g-os" aria-hidden="true">
          <span v-for="v in os.crte" :key="v" :style="{ bottom: `${pct(v)}%` }">{{ v }}</span>
          <em>µg/m³</em>
        </div>
        <div class="g-plos" @pointerleave="skrijNamig">
          <!-- mreža -->
          <span v-for="v in os.crte" :key="v" class="mreza" :style="{ bottom: `${pct(v)}%` }" aria-hidden="true" />
          <!-- stolpci -->
          <button
            v-for="(u, i) in ure"
            :key="u.cas"
            class="st"
            :class="{ izbran: izbrana === i, novdan: i > 0 && u.h === 0 }"
            :aria-label="`${hh(u.h)}: ${Math.round(u.pm)} µg/m³, ${u.lvl.label}`"
            @pointerenter="pokaziNamig(i, $event)"
            @pointerdown="pokaziNamig(i, $event)"
            @focus="pokaziNamig(i, $event)"
            @blur="skrijNamig"
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
        <!-- os x: vsaka oznaka je na sredini svojega stolpca -->
        <div class="g-ure" aria-hidden="true">
          <span v-for="u in ure" :key="u.cas">
            <b v-if="u.h % 3 === 0">{{ u.h }}h</b>
            <small v-if="u.h === 0 && new Date(u.cas).getDate() !== prviDan">jutri</small>
          </span>
        </div>
      </div>

      <div class="legenda">
        <span><i class="lg-st" /> {{ jeNapoved ? 'napoved' : 'običajna vrednost' }} za vsako uro (barva = kakovost zraka)</span>
        <span v-if="jeNapoved"><i class="lg-crta" /> običajno ob tej uri v tem mesecu</span>
        <span v-if="profile.astma">upoštevane so strožje meje za občutljive</span>
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
        <h3>Vaša lokacija je {{ visina.m }} m nad morjem</h3>
        <p>
          To je <strong>{{ visina.nadDnom > 0 ? `${visina.nadDnom} m nad` : 'na' }} dnom kotline</strong>.
          <template v-if="megla?.inv && megla.pod">Zdaj je inverzija in hladen, onesnažen zrak sega do približno {{ megla.vrh }} m – <strong>ste pod to plastjo</strong>.</template>
          <template v-else-if="megla?.inv">Zdaj je inverzija, a plast hladnega zraka (do približno {{ megla.vrh }} m) je pod tabo.</template>
          <template v-else>Zdaj ni inverzije, zrak se meša.</template>
          <template v-if="visina.nadDnom < 60"> Pozimi ob inverziji je vaše območje med prvimi, kjer se ujame megla.</template>
        </p>
        <p class="izvor"><VirZnacka vrsta="ocena" /> višina iz reliefa Copernicus DEM (paket ARSOhack); plast megle: <VirZnacka :vrsta="scene?.vir === 'klima' ? 'ocena' : 'model'" /> {{ scene?.vir === 'klima' ? 'iz povprečja preteklih let' : 'vremenski model Open-Meteo' }}</p>
      </article>


      <article class="card info">
        <h3>{{ MESECI[new Date().getMonth()]![0]!.toUpperCase() + MESECI[new Date().getMonth()]!.slice(1) }} je običajno {{ fmt(mesec.pm) }} µg/m³</h3>
        <p>
          Po 10 letih meritev je to {{ mesec.vrstni }}. najslabši mesec v letu.
          <template v-if="mesec.vrstni <= 4">Pozimi kurimo in zrak se pogosto ujame v kotlini – zato je toliko bolj pomembno, kdaj greste z otrokom ven in kdaj zračite.</template>
          <template v-else>To je eden boljših mesecev – dobra priložnost za čas na prostem.</template>
        </p>
        <p class="izvor"><VirZnacka vrsta="meritev" /> povprečje meritev ARSO na Bežigradu {{ z.pm25Od }}–{{ z.zadnjeLeto }}</p>
      </article>
    </div>
    <!-- zanimivost ob prehodu z miško čez uro -->
    <Teleport to="body">
      <div v-if="namig && namigUra" class="ura-namig" :style="namigSlog" role="tooltip">
        <span class="nv">
          <strong>{{ hh(namigUra.h) }}</strong> · {{ Math.round(namigUra.pm) }} µg/m³
          <span class="lvl" :style="{ background: namigUra.lvl.color }">{{ namigUra.lvl.label }}</span>
        </span>
        <span v-if="jeNapoved" class="ob">običajno ob tej uri {{ Math.round(namigUra.obicajno) }} µg/m³</span>
        <p>{{ ZANIMIVOST[namigUra.lvl.key] }}</p>
      </div>
    </Teleport>
  </section>
</template>

<style scoped>
.page {
  padding-top: 28px;
}
.glava {
  display: block;
}
h1 {
  font-size: clamp(2rem, 5vw, 3rem);
  margin: 4px 0 0;
}
/* gumba v vrsti pod naslovom */
.lokacija {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-top: 12px;
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
.glava {
  margin-bottom: 18px;
}
/* iskalnik lokacije (isti videz kot iskanje šol na Zemljevidu): v svoji vrstici pod gumboma */
.iskalnik {
  position: relative;
  flex: 1 1 100%;
  max-width: 560px;
}
.iskalnik > svg {
  position: absolute;
  left: 12px;
  top: 50%;
  width: 18px;
  height: 18px;
  transform: translateY(-50%);
  fill: none;
  stroke: var(--ink-soft);
  stroke-width: 2;
  stroke-linecap: round;
  pointer-events: none;
}
.iskalnik input {
  width: 100%;
  padding: 10px 14px 10px 38px;
  border-radius: 999px;
  border: 2px solid var(--line);
  background: var(--card);
  color: var(--ink);
  font: inherit;
  font-weight: 700;
}
.iskalnik input:focus {
  outline: none;
  border-color: var(--brand);
}
.zadetki {
  position: absolute;
  z-index: 30;
  top: calc(100% + 6px);
  left: 0;
  right: 0;
  margin: 0;
  padding: 6px;
  list-style: none;
  border-radius: 16px;
  background: var(--card);
  border: 1px solid var(--line);
  box-shadow: 0 18px 40px -18px rgba(31, 45, 77, 0.45);
}
.zadetki button {
  display: grid;
  width: 100%;
  padding: 8px 10px;
  border: 0;
  border-radius: 10px;
  background: none;
  color: var(--ink);
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.zadetki button:hover {
  background: var(--bg-soft);
}
.zadetki small {
  color: var(--ink-soft);
}
.iskalnik .nic {
  position: absolute;
  top: calc(100% + 6px);
  left: 14px;
  margin: 0;
  font-size: 0.85rem;
  color: var(--ink-soft);
}
.mali {
  display: block;
  color: var(--ink-soft);
  font-size: 0.85rem;
  font-weight: 700;
}

/* zgoraj: stanje zdaj (levo) in tri odločitve (desno) v eni kartici */
.zdaj {
  display: grid;
  grid-template-columns: minmax(240px, 1fr) 1.6fr;
  gap: 28px;
  margin-bottom: 18px;
  border: 2px solid color-mix(in srgb, var(--lvl) 55%, var(--line));
}
.odlocitve {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 10px;
  align-content: center;
}
.odlocitve li {
  --o: var(--aq-1);
  display: grid;
  grid-template-columns: 170px 1fr;
  grid-template-rows: auto auto;
  column-gap: 14px;
  align-items: baseline;
  padding: 10px 14px;
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--o) 9%, var(--card));
}
.odlocitve li.mogoce {
  --o: var(--aq-3);
}
.odlocitve li.ne {
  --o: var(--aq-5);
}
.odlocitve .mali {
  grid-column: 1;
}
.odlocitve strong {
  grid-column: 1;
  font-family: var(--font-head);
  font-size: 1.3rem;
  line-height: 1.2;
  color: color-mix(in srgb, var(--o) 65%, var(--ink));
}
.odlocitve p {
  grid-column: 2;
  grid-row: 1 / span 2;
  align-self: center;
  margin: 0;
  font-weight: 600;
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

/* od kod je podatek */
.izvor {
  margin: 10px 0 0;
  font-size: 0.8rem;
  color: var(--ink-soft);
}

/* ure pod stolpci: oznaka na sredini svojega stolpca (lahko sega čez rob) */
.g-ure span {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--ink-soft);
  white-space: nowrap;
}
.g-ure b {
  font-weight: 700;
}
.namig-hint {
  margin: 8px 0 0;
  font-size: 0.85rem;
}
/* okence z zanimivostjo ob prehodu z miško */
.ura-namig {
  position: fixed;
  z-index: 1000;
  transform: translateY(-100%);
  padding: 12px 14px;
  border-radius: 14px;
  background: var(--card);
  color: var(--ink);
  border: 1px solid var(--line);
  box-shadow: 0 18px 40px -16px rgba(31, 45, 77, 0.45);
  font-size: 0.88rem;
  line-height: 1.45;
  pointer-events: none;
}
.ura-namig::after {
  content: '';
  position: absolute;
  left: var(--puscica);
  bottom: -6px;
  width: 10px;
  height: 10px;
  background: inherit;
  border-right: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
  transform: translateX(-50%) rotate(45deg);
}
.ura-namig .nv {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}
.ura-namig .lvl {
  padding: 1px 9px;
  border-radius: 999px;
  color: #fff;
  font-weight: 800;
  font-size: 0.78rem;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.25);
}
.ura-namig .ob {
  display: block;
  font-size: 0.78rem;
  color: var(--ink-soft);
}
.ura-namig p {
  margin: 6px 0 0;
  color: var(--ink-soft);
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
  border-left: 1px solid transparent; /* enako kot .g-plos, da so oznake točno pod stolpci */
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

@media (max-width: 1100px) {
  .odlocitve li {
    grid-template-columns: 1fr;
  }
  .odlocitve p {
    grid-column: 1;
    grid-row: auto;
    margin-top: 2px;
  }
}
@media (max-width: 900px) {
  .zdaj,
  .spodaj {
    grid-template-columns: 1fr;
  }
  /* telefon: lokacija v svoji vrstici, gumba drug ob drugem */
  .lokacija .chip {
    flex-basis: 100%;
  }
  .lokacija .btn {
    flex: 1;
    padding-left: 10px;
    padding-right: 10px;
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

}
</style>
