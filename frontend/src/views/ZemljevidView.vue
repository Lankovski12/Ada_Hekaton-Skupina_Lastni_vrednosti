<script setup lang="ts">
// Zavihek »Zemljevid«: starš ali otrok poišče svojo šolo ali vrtec, zemljevid prileti tja,
// kartica pa pokaže, kaj o okolici povedo podatki (model GRAL, relief in radiosondaža, meritve ARSO).
// Izbrana šola ostane shranjena samo na tej napravi.
import { computed, defineAsyncComponent, onMounted, ref, shallowRef } from 'vue'
import SolaKartica, { type Sola, type SoleMeta } from '@/components/SolaKartica.vue'

// 3D zemljevid (three.js) se naloži šele, ko odpreš ta zavihek
const Zemljevid3D = defineAsyncComponent(() => import('@/scenes/Zemljevid3D.vue'))

const KEY = 'zrak-sola'
const sole = shallowRef<Sola[]>([])
const meta = shallowRef<SoleMeta | null>(null)
const postaje = shallowRef<{ id: string; ime: string; x: number; y: number }[]>([])
const izbrana = ref<Sola | null>(null)
const iskanje = ref('')
const odprt = ref(false)
const napaka = ref(false)

onMounted(async () => {
  try {
    const base = `${import.meta.env.BASE_URL}assets/map/`
    const [s, t] = await Promise.all([fetch(base + 'sole.json').then((r) => r.json()), fetch(base + 'teren.json').then((r) => r.json())])
    meta.value = s
    sole.value = s.sole
    postaje.value = t.postaje
    let shranjena: number | null = null
    try {
      shranjena = JSON.parse(localStorage.getItem(KEY) ?? 'null')
    } catch {
      /* ni shranjene */
    }
    const najdena = sole.value.find((x) => x.id === shranjena)
    if (najdena) izberi(najdena)
  } catch {
    napaka.value = true
  }
})

// iskanje brez šumnikov in velikih črk (»sola trnovo« najde »Osnovna šola Trnovo«)
const norm = (t: string) =>
  t
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
const zadetki = computed(() => {
  const q = norm(iskanje.value.trim())
  if (q.length < 2) return []
  const besede = q.split(/\s+/)
  // najprej šole, ki imajo vse besede v imenu, med njimi tiste s krajšim imenom (»OŠ Trnovo« pred »Francoska šola«)
  const tocke = (s: Sola) => {
    const ime = norm(s.ime)
    return (besede.every((b) => ime.includes(b)) ? 0 : 1000) + (ime.includes(q) ? 0 : 100) + ime.length / 100
  }
  return sole.value
    .filter((s) => {
      const t = norm(`${s.ime} ${s.naslov ?? ''} ${s.cs ?? ''}`)
      return besede.every((b) => t.includes(b))
    })
    .sort((a, b) => tocke(a) - tocke(b))
    .slice(0, 8)
})

function izberi(s: Sola) {
  izbrana.value = s
  iskanje.value = s.ime
  odprt.value = false
  try {
    localStorage.setItem(KEY, JSON.stringify(s.id))
  } catch {
    /* brez shranjevanja */
  }
}
function pocisti() {
  izbrana.value = null
  iskanje.value = ''
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* ni pomembno */
  }
}
function potrdi() {
  const z = zadetki.value[0]
  if (z) izberi(z)
}
</script>

<template>
  <div class="story zemljevid">
    <section class="container mapsec">
      <span class="kicker">Zemljevid</span>
      <h1>Kakšen zrak diha vaš otrok?</h1>
      <p class="lead">
        Poišči svojo šolo ali vrtec. Pokažemo, koliko dima iz peči in prometa je v okolici, kako pogosto je pozimi pod
        plastjo hladnega zraka in kdaj je čas za igro zunaj. Ob vsaki številki piše, ali je izmerjena, izračunana z
        modelom ali ocenjena.
      </p>

      <div class="iskalnik" :class="{ odprt: odprt && zadetki.length }">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" /></svg>
        <input
          v-model="iskanje"
          type="search"
          placeholder="Ime šole ali vrtca, ulica ali četrtna skupnost"
          aria-label="Poišči šolo ali vrtec"
          autocomplete="off"
          :disabled="napaka"
          @input="odprt = true"
          @focus="odprt = true"
          @keydown.enter.prevent="potrdi"
          @keydown.esc="odprt = false"
        />
        <button v-if="izbrana" class="pocisti" aria-label="Počisti izbiro" @click="pocisti">×</button>
        <ul v-if="odprt && zadetki.length" class="zadetki" role="listbox">
          <li v-for="s in zadetki" :key="s.id" role="option">
            <button @mousedown.prevent="izberi(s)" @click="izberi(s)">
              <strong>{{ s.ime }}</strong>
              <small>{{ s.kat === 'vrtec' ? 'vrtec' : 'šola' }}<template v-if="s.naslov"> · {{ s.naslov }}</template><template v-if="s.cs"> · {{ s.cs }}</template></small>
            </button>
          </li>
        </ul>
        <p v-if="odprt && iskanje.trim().length >= 2 && !zadetki.length && !izbrana" class="nic">
          Ne najdem. Poskusi z delom imena (npr. »Trnovo«) ali z ulico.
        </p>
      </div>
      <p v-if="napaka" class="nic">Seznama šol ni bilo mogoče naložiti.</p>

      <SolaKartica v-if="izbrana && meta" :sola="izbrana" :meta="meta" :postaje="postaje" />

      <Zemljevid3D :izbrana="izbrana ? { ime: izbrana.ime, x: izbrana.x, y: izbrana.y } : null" />
      <p v-if="meta" class="credit">Šole in vrtci: {{ meta.vir }}.</p>
    </section>

    <div class="story-end" aria-hidden="true" />
  </div>
</template>

<style scoped>
.mapsec {
  --lvl: #e5484d;
  padding-top: 40px;
  padding-bottom: 20px;
}
.mapsec h1 {
  font-size: clamp(2rem, 5vw, 3.2rem);
}
.mapsec .lead {
  max-width: 720px;
  margin-bottom: 18px;
}
.iskalnik {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  max-width: 640px;
  margin-bottom: 18px;
  padding: 4px 8px 4px 16px;
  border-radius: 999px;
  background: var(--panel);
  border: 2px solid color-mix(in srgb, #e5484d 45%, var(--panel-line));
  box-shadow: var(--panel-shadow);
  z-index: 5;
}
.iskalnik.odprt {
  border-radius: 24px 24px 0 0;
}
.iskalnik svg {
  width: 22px;
  height: 22px;
  flex: none;
  fill: none;
  stroke: var(--ink-soft);
  stroke-width: 2.2;
  stroke-linecap: round;
}
.iskalnik input {
  flex: 1;
  min-width: 0;
  min-height: 46px;
  border: 0;
  background: transparent;
  color: var(--ink);
  font: inherit;
  font-weight: 700;
  font-size: 1.05rem;
  outline: none;
}
.iskalnik input::-webkit-search-cancel-button {
  display: none;
}
.pocisti {
  width: 36px;
  height: 36px;
  border: 0;
  border-radius: 50%;
  background: var(--bg-soft);
  color: var(--ink);
  font-size: 1.3rem;
  font-weight: 800;
  cursor: pointer;
}
.zadetki {
  position: absolute;
  top: 100%;
  left: -2px;
  right: -2px;
  margin: 0;
  padding: 6px;
  list-style: none;
  background: var(--card);
  border: 2px solid color-mix(in srgb, #e5484d 45%, var(--panel-line));
  border-top: 1px solid var(--line);
  border-radius: 0 0 20px 20px;
  box-shadow: var(--panel-shadow);
}
.zadetki button {
  display: grid;
  width: 100%;
  padding: 8px 12px;
  border: 0;
  border-radius: 12px;
  background: transparent;
  color: var(--ink);
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.zadetki button:hover,
.zadetki button:focus-visible {
  background: var(--bg-soft);
}
.zadetki small {
  color: var(--ink-soft);
}
.nic {
  margin: 0 0 14px;
  color: var(--ink-soft);
  font-weight: 700;
}
.credit {
  margin-top: 8px;
  color: var(--ink-soft);
  font-size: 0.8rem;
}
</style>
