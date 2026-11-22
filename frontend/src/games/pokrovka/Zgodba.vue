<script setup lang="ts">
// Razlaga inverzije za otroke: pet korakov, v vsakem se prizor kotline spremeni, Oblaček pripoveduje.
import { computed, ref } from 'vue'
import AirBuddy from '@/components/AirBuddy.vue'
import Scena from './Scena.vue'

const emit = defineEmits<{ konec: [] }>()

interface Korak {
  naslov: string
  besedilo: string
  tDolina: number
  tHrib: number
  noc?: boolean
  veter?: boolean
  hladniTok?: boolean
  poudari?: boolean
  vprasanje?: { besedilo: string; moznosti: string[]; pravilen: number; razlaga: string }
}

const KORAKI: Korak[] = [
  {
    naslov: 'Podnevi: zrak se dviga kot balon',
    besedilo:
      'Sonce ogreje tla, tla ogrejejo zrak. Topel zrak je lažji in se dviga kot balon na vroč zrak. Dim iz dimnika odnese visoko, kjer se razredči.',
    tDolina: 8,
    tHrib: 2,
  },
  {
    naslov: 'Ponoči: hladen zrak zdrsne v dolino',
    besedilo:
      'Ponoči se tla ohladijo. Hladen zrak je težji, zato polzi po pobočjih navzdol in se nabere na dnu kotline – kot voda v skledi.',
    tDolina: 0,
    tHrib: 1,
    noc: true,
    hladniTok: true,
    vprasanje: {
      besedilo: 'Kam gre hladen, težek zrak?',
      moznosti: ['Navzdol, na dno kotline', 'Navzgor, na vrh hriba'],
      pravilen: 0,
      razlaga: 'Tako je! Hladen zrak je težji in se uleže na dno, kot voda.',
    },
  },
  {
    naslov: 'Zjutraj: pokrovka je pripravljena',
    besedilo:
      'Zdaj je v dolini mrzlo, na hribu pa topleje. Poglej barve: spodaj modro, zgoraj oranžno. Topel zrak leži na mrzlem kot pokrovka na loncu. Temu rečemo inverzija.',
    tDolina: -4,
    tHrib: 4,
    poudari: true,
  },
  {
    naslov: 'Dim ostane ujet',
    besedilo:
      'Dim iz dimnikov in avtomobilov se dvigne le do pokrovke, naprej ne more. Ostane pri tleh, kjer dihamo. Če pokrovka zdrži več dni, je smoga vsak dan več.',
    tDolina: -5,
    tHrib: 5,
    poudari: true,
    vprasanje: {
      besedilo: 'Kdaj je pokrovka nižja in smog bolj gost?',
      moznosti: ['Ko je na hribu veliko topleje kot v dolini', 'Ko je v dolini topleje kot na hribu'],
      pravilen: 0,
      razlaga: 'Odlično! Večja kot je razlika (hrib topel, dolina mrzla), nižje je pokrovka.',
    },
  },
  {
    naslov: 'Kako se pokrovka odpre',
    besedilo:
      'Pokrovko odpre veter ali sprememba vremena, ki prinese drugačen zrak. Včasih jo razbije tudi sonce, ko dovolj ogreje tla. Takrat se dim spet dvigne in razredči.',
    tDolina: 5,
    tHrib: -1,
    veter: true,
  },
]

const i = ref(0)
const k = computed(() => KORAKI[i.value]!)
const odgovor = ref<number | null>(null)

function naprej() {
  odgovor.value = null
  if (i.value < KORAKI.length - 1) i.value++
  else emit('konec')
}
function nazaj() {
  odgovor.value = null
  if (i.value > 0) i.value--
}
</script>

<template>
  <div class="zgodba">
    <div class="dots">
      <span v-for="(_, n) in KORAKI" :key="n" :class="{ on: n === i, done: n < i }" />
    </div>
    <Scena
      :t-dolina="k.tDolina"
      :t-hrib="k.tHrib"
      :noc="k.noc"
      :veter="k.veter"
      :hladni-tok="k.hladniTok"
      :poudari-pokrovko="k.poudari"
    />
    <div class="bubble">
      <AirBuddy :mood="0" color="#7cc8ff" :size="84" />
      <div>
        <h3>{{ k.naslov }}</h3>
        <p>{{ k.besedilo }}</p>
      </div>
    </div>
    <div v-if="k.vprasanje" class="quiz">
      <p class="q">{{ k.vprasanje.besedilo }}</p>
      <div class="opts">
        <button
          v-for="(m, n) in k.vprasanje.moznosti"
          :key="m"
          class="opt"
          :class="{ ok: odgovor != null && n === k.vprasanje.pravilen, no: odgovor === n && n !== k.vprasanje.pravilen }"
          :disabled="odgovor != null"
          @click="odgovor = n"
        >
          {{ m }}
        </button>
      </div>
      <p v-if="odgovor != null" class="fb">
        {{ odgovor === k.vprasanje.pravilen ? k.vprasanje.razlaga : 'Skoraj! ' + k.vprasanje.razlaga.replace(/^[^!]*! /, '') }}
      </p>
    </div>
    <div class="nav">
      <button class="k-btn ghost" :disabled="i === 0" @click="nazaj">Nazaj</button>
      <button class="k-btn green" :disabled="!!k.vprasanje && odgovor == null" @click="naprej">
        {{ i < KORAKI.length - 1 ? 'Naprej' : 'Zdaj pa ti!' }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.dots {
  display: flex;
  justify-content: center;
  gap: 8px;
  margin-bottom: 10px;
}
.dots span {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #d5e4f2;
  transition: transform 0.2s, background 0.2s;
}
.dots span.done {
  background: #9b6bff;
}
.dots span.on {
  background: #3ccf6e;
  transform: scale(1.4);
}
.bubble {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 12px;
  padding: 12px 16px;
  border-radius: 24px;
  background: #fff8e1;
  text-align: left;
}
.bubble :deep(svg) {
  flex: none;
}
.bubble h3 {
  margin: 0 0 4px;
  font-family: var(--font-head);
  font-size: 1.35rem;
  color: #1d3557;
}
.bubble p {
  margin: 0;
  font-size: 1.05rem;
  color: #1d3557;
}
.quiz {
  margin-top: 12px;
  padding: 12px;
  border-radius: 22px;
  background: #f1f8ff;
}
.q {
  margin: 0 0 8px;
  font-family: var(--font-head);
  font-size: 1.2rem;
  color: #1d3557;
}
.opts {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.opt {
  min-height: 56px;
  padding: 8px 12px;
  border: 0;
  border-radius: 18px;
  background: #3fa9f5;
  box-shadow: 0 5px 0 #2479bd;
  color: #fff;
  font-family: var(--font-head);
  font-size: 1.05rem;
  font-weight: 800;
  cursor: pointer;
}
.opt.ok {
  background: #3ccf6e;
  box-shadow: 0 5px 0 #26a052;
}
.opt.no {
  background: #b9c3cc;
  box-shadow: 0 5px 0 #8d99a4;
}
.fb {
  margin: 10px 0 0;
  font-weight: 700;
  color: #1d3557;
}
.nav {
  display: flex;
  justify-content: space-between;
  gap: 10px;
}
@media (max-width: 560px) {
  .opts {
    grid-template-columns: 1fr;
  }
}
</style>
