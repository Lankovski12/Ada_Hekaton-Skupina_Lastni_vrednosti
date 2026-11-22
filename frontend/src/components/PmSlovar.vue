<script setup lang="ts">
// Razlaga izrazov PM2.5 in PM10 po vsej strani: ko z miško greš čez izraz (na telefonu: tapneš),
// se pokaže okence z razlago. Besedil na straneh ne spreminjamo – izraze poiščemo v besedilu,
// jih označimo s CSS Custom Highlight API (pikčasta podčrtava) in hover zaznamo po položaju miške.
// Tako deluje tudi za besedila, ki so sestavljena v kodi (zgodbe, kviz, igre).
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

type Izraz = 'pm25' | 'pm10'
const VZOREC = /PM\s?2[.,]5|PM\s?10(?!\d)/g
const IMA = /PM\s?2[.,]5|PM\s?10(?!\d)/ // brez /g, da test() nima stanja

const RAZLAGA: Record<Izraz, { naslov: string; vrstice: string[] }> = {
  pm25: {
    naslov: 'PM2.5 – drobni delci',
    vrstice: [
      'Delci, manjši od 2,5 mikrometra – približno 30× tanjši od lasu.',
      'Vdihnemo jih globoko v pljuča, zato so najbolj škodljivi. Otroci dihajo hitreje in jih vdihnejo več.',
      'V Ljubljani pozimi nastajajo predvsem pri kurjenju drv in v prometu.',
      'Smernica WHO: dnevno povprečje do 15 µg/m³.',
    ],
  },
  pm10: {
    naslov: 'PM10 – delci',
    vrstice: [
      'Delci, manjši od 10 mikrometrov: prah, cvetni prah, delci s cest in iz dimnikov.',
      'Večina se ustavi v nosu in grlu; najmanjši med njimi (PM2.5) gredo globlje v pljuča.',
      'Smernica WHO: dnevno povprečje do 45 µg/m³. Dnevna meja EU: 50 µg/m³.',
    ],
  },
}

interface Zadetek {
  range: Range
  izraz: Izraz
}
let zadetki: Zadetek[] = []
const podpira = typeof CSS !== 'undefined' && 'highlights' in CSS

const aktiven = ref<{ izraz: Izraz; x: number; y: number; spodaj: boolean } | null>(null)
const okno = ref<HTMLDivElement | null>(null)
const vsebina = computed(() => (aktiven.value ? RAZLAGA[aktiven.value.izraz] : null))

// --- iskanje izrazov v besedilu strani ---
function preskoci(el: Element | null): boolean {
  return !el || !!el.closest('script, style, textarea, input, select, [data-pm-slovar]')
}
function poisci() {
  const najdeni: Zadetek[] = []
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) =>
      IMA.test(n.nodeValue ?? '') && !preskoci(n.parentElement) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT,
  })
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const besedilo = n.nodeValue ?? ''
    VZOREC.lastIndex = 0
    for (let m = VZOREC.exec(besedilo); m; m = VZOREC.exec(besedilo)) {
      const range = document.createRange()
      range.setStart(n, m.index)
      range.setEnd(n, m.index + m[0].length)
      najdeni.push({ range, izraz: m[0].includes('10') ? 'pm10' : 'pm25' })
    }
  }
  VZOREC.lastIndex = 0
  zadetki = najdeni
  if (podpira) CSS.highlights.set('pm-izraz', new Highlight(...najdeni.map((z) => z.range)))
}

let caka = 0
function poisciKasneje() {
  window.clearTimeout(caka)
  caka = window.setTimeout(poisci, 200)
}

// --- kateri izraz je pod miško / prstom ---
function zadetekNa(x: number, y: number): { z: Zadetek; r: DOMRect } | null {
  for (const z of zadetki) {
    for (const r of z.range.getClientRects()) {
      if (x >= r.left - 2 && x <= r.right + 2 && y >= r.top - 2 && y <= r.bottom + 2) return { z, r }
    }
  }
  return null
}

function pokazi(z: Zadetek, r: DOMRect) {
  const spodaj = r.top < 190 // premalo prostora nad izrazom
  aktiven.value = { izraz: z.izraz, x: r.left + r.width / 2, y: spodaj ? r.bottom + 8 : r.top - 8, spodaj }
}
function skrij() {
  aktiven.value = null
  document.documentElement.style.removeProperty('cursor')
}

// položaj okenca: ne sme čez rob zaslona
const slog = computed(() => {
  const a = aktiven.value
  if (!a) return {}
  const sirina = Math.min(300, window.innerWidth - 24)
  const left = Math.max(12, Math.min(window.innerWidth - sirina - 12, a.x - sirina / 2))
  return {
    left: `${left}px`,
    width: `${sirina}px`,
    top: `${a.y}px`,
    transform: a.spodaj ? 'none' : 'translateY(-100%)',
    '--puscica': `${Math.max(14, Math.min(sirina - 14, a.x - left))}px`,
  }
})

let raf = 0
let zadnji: PointerEvent | null = null
function onMove(e: PointerEvent) {
  if (e.pointerType === 'touch') return
  zadnji = e
  if (raf) return
  raf = requestAnimationFrame(() => {
    raf = 0
    if (!zadnji) return
    const hit = zadetekNa(zadnji.clientX, zadnji.clientY)
    if (hit) {
      pokazi(hit.z, hit.r)
      document.documentElement.style.cursor = 'help'
    } else if (aktiven.value) skrij()
  })
}
// telefon: tap na izraz odpre okence, tap drugam ga zapre
function onDown(e: PointerEvent) {
  if (e.pointerType !== 'touch') return
  const hit = zadetekNa(e.clientX, e.clientY)
  if (hit) pokazi(hit.z, hit.r)
  else if (aktiven.value && !okno.value?.contains(e.target as Node)) skrij()
}

let mo: MutationObserver | undefined
onMounted(() => {
  poisci()
  mo = new MutationObserver((zapisi) => {
    // spremembe v samem okencu ne štejejo
    if (zapisi.every((z) => okno.value?.contains(z.target))) return
    poisciKasneje()
  })
  mo.observe(document.body, { childList: true, subtree: true, characterData: true })
  document.addEventListener('pointermove', onMove, { passive: true })
  document.addEventListener('pointerdown', onDown, { passive: true })
  window.addEventListener('scroll', skrij, { passive: true, capture: true })
  window.addEventListener('resize', skrij)
})
onBeforeUnmount(() => {
  mo?.disconnect()
  window.clearTimeout(caka)
  cancelAnimationFrame(raf)
  document.removeEventListener('pointermove', onMove)
  document.removeEventListener('pointerdown', onDown)
  window.removeEventListener('scroll', skrij, { capture: true })
  window.removeEventListener('resize', skrij)
  if (podpira) CSS.highlights.delete('pm-izraz')
})
</script>

<template>
  <Teleport to="body">
    <Transition name="pm">
      <div
        v-if="aktiven && vsebina"
        ref="okno"
        data-pm-slovar
        class="pm-okno"
        :class="{ spodaj: aktiven.spodaj }"
        :style="slog"
        role="tooltip"
      >
        <strong>{{ vsebina.naslov }}</strong>
        <p v-for="(v, i) in vsebina.vrstice" :key="i">{{ v }}</p>
      </div>
    </Transition>
  </Teleport>
</template>

<style>
/* oznaka izraza v besedilu (brez spreminjanja besedila) */
::highlight(pm-izraz) {
  text-decoration: underline dotted;
  text-decoration-color: color-mix(in srgb, currentColor 70%, transparent);
  background-color: color-mix(in srgb, #5aa2ff 14%, transparent);
}
</style>

<style scoped>
.pm-okno {
  position: fixed;
  z-index: 1000;
  padding: 12px 14px;
  border-radius: 14px;
  background: var(--card, #fff);
  color: var(--ink, #1f2d4d);
  border: 1px solid var(--line, rgba(31, 45, 77, 0.12));
  box-shadow: 0 18px 40px -16px rgba(31, 45, 77, 0.45);
  font-size: 0.88rem;
  line-height: 1.45;
  pointer-events: auto;
}
.pm-okno strong {
  display: block;
  margin-bottom: 4px;
  font-family: var(--font-head);
  font-size: 1rem;
}
.pm-okno p {
  margin: 0 0 4px;
  color: var(--ink-soft, #4a5a78);
}
.pm-okno p:last-child {
  margin: 0;
  font-weight: 700;
  color: var(--ink, #1f2d4d);
}
/* puščica proti izrazu */
.pm-okno::after {
  content: '';
  position: absolute;
  left: var(--puscica);
  bottom: -6px;
  width: 10px;
  height: 10px;
  background: inherit;
  border-right: 1px solid var(--line, rgba(31, 45, 77, 0.12));
  border-bottom: 1px solid var(--line, rgba(31, 45, 77, 0.12));
  transform: translateX(-50%) rotate(45deg);
}
.pm-okno.spodaj::after {
  bottom: auto;
  top: -6px;
  transform: translateX(-50%) rotate(225deg);
}
.pm-enter-active,
.pm-leave-active {
  transition: opacity 0.15s;
}
.pm-enter-from,
.pm-leave-to {
  opacity: 0;
}
</style>
