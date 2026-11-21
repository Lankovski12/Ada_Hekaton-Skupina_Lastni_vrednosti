<script setup lang="ts">
// Poglavje »10 let meritev«: zgodovinski podatki ARSO (paket ARSOhack).
// Številke izračuna backend/scripts/blog_statistika.py → src/data/zgodovina.json.
// Ob drsenju se graf na levi spremeni; vsak korak pokaže eno ugotovitev.
import { computed, ref } from 'vue'
import ScrollStory from '@/components/ScrollStory.vue'
import { levelFor } from '@/lib/airQuality'
import z from '@/data/zgodovina.json'

interface Bar {
  label: string
  value: number
  color?: string // privzeto: barva poglavja
  hi?: boolean // poudarjen stolpec s številko
}
interface Step {
  kicker: string
  title: string
  text: string
  color: string
  unit: string
  kind: 'bars' | 'calendar' | 'big'
  bars?: Bar[]
}

const fmt = (n: number) => n.toLocaleString('sl-SI', { maximumFractionDigits: 1 })
const pm25Color = (v: number) => levelFor(v).color

const leta = z.leta
const prvo = leta[0]!
const zadnje = leta[leta.length - 1]!
const padec = Math.round((1 - zadnje.pm10 / prvo.pm10) * 100)
const najvecDni = leta.reduce((a, b) => (b.dniNad50 > a.dniNad50 ? b : a))

const meseci = z.meseci
const maxMesec = meseci.reduce((a, b) => (b.pm25 > a.pm25 ? b : a))
const minMesec = meseci.reduce((a, b) => (b.pm25 < a.pm25 ? b : a))

const ure = z.zimaUre
const maxUra = ure.reduce((a, b) => (b.pm25 > a.pm25 ? b : a))
const minUra = ure.reduce((a, b) => (b.pm25 < a.pm25 ? b : a))

const inv = z.inverzija
const postaje = z.postaje
const datum = new Date(z.rekord.datum)
const novoLeto = z.rekord.datum.endsWith('-01-01')

const steps: Step[] = [
  {
    kicker: `${leta.length} let meritev ARSO`,
    title: 'Zrak je vse boljši',
    text: `Povprečje delcev PM10 na Bežigradu je padlo s ${fmt(prvo.pm10)} µg/m³ (${prvo.leto}) na ${fmt(zadnje.pm10)} µg/m³ (${zadnje.leto}). To je ${padec} % manj kot pred desetimi leti.`,
    color: 'var(--aq-2)',
    unit: 'PM10 na Bežigradu · letno povprečje (µg/m³)',
    kind: 'bars',
    bars: leta.map((l, i) => ({ label: `'${String(l.leto).slice(2)}`, value: l.pm10, hi: i === 0 || i === leta.length - 1 })),
  },
  {
    kicker: 'Dnevi nad mejo',
    title: `Z ${najvecDni.dniNad50} na ${zadnje.dniNad50} dni`,
    text: `Toliko dni na leto je bil zrak nad dnevno mejo EU (50 µg/m³ PM10). Leta ${najvecDni.leto} kar ${najvecDni.dniNad50} dni, leta ${zadnje.leto} le še ${zadnje.dniNad50}.`,
    color: 'var(--aq-4)',
    unit: 'Dni s PM10 nad 50 µg/m³ · Bežigrad',
    kind: 'bars',
    bars: leta.map((l) => ({ label: `'${String(l.leto).slice(2)}`, value: l.dniNad50, hi: l === najvecDni || l === zadnje })),
  },
  {
    kicker: 'Po mesecih',
    title: `Pozimi ${fmt(maxMesec.pm25 / minMesec.pm25)}× več delcev`,
    text: `Ko je zrak najslabši (${maxMesec.mesec}), je v njem povprečno ${fmt(maxMesec.pm25)} µg/m³ PM2.5, ko je najboljši (${minMesec.mesec}), le ${fmt(minMesec.pm25)}. Pozimi kurimo, mrzel zrak pa se pogosto ujame v kotlini.`,
    color: 'var(--aq-5)',
    unit: `PM2.5 na Bežigradu · povprečje po mesecih 2021–${z.zadnjeLeto} (µg/m³)`,
    kind: 'bars',
    bars: meseci.map((m) => ({ label: m.mesec, value: m.pm25, color: pm25Color(m.pm25), hi: m === maxMesec || m === minMesec })),
  },
  {
    kicker: 'Zimski dan',
    title: 'Najslabše je zvečer',
    text: `Pozimi je zrak najslabši pozno zvečer (okoli ${maxUra.ura}. ure, ${fmt(maxUra.pm25)} µg/m³), najboljši pa popoldne (okoli ${minUra.ura}. ure). Zato je stanovanje najbolje prezračiti sredi dneva.`,
    color: 'var(--aq-4)',
    unit: 'PM2.5 na Bežigradu · povprečje po urah, november–februar (µg/m³)',
    kind: 'bars',
    bars: ure.map((u) => ({ label: u.ura % 6 === 0 ? `${u.ura}h` : '', value: u.pm25, color: pm25Color(u.pm25), hi: u === maxUra || u === minUra })),
  },
  {
    kicker: 'Inverzija v številkah',
    title: `${fmt(inv.z / inv.brez)}× več delcev`,
    text: `Ko je na Pasji ravni (1019 m) topleje kot v mestu, je pozimi v zraku povprečno ${fmt(inv.z)} µg/m³ PM2.5. Brez inverzije ${fmt(inv.brez)}. Inverzija je kar v ${inv.delezUr} % zimskih ur.`,
    color: 'var(--aq-5)',
    unit: 'PM2.5 na Bežigradu pozimi (µg/m³)',
    kind: 'bars',
    bars: [
      { label: 'brez inverzije', value: inv.brez, color: pm25Color(inv.brez), hi: true },
      { label: 'z inverzijo', value: inv.z, color: pm25Color(inv.z), hi: true },
    ],
  },
  {
    kicker: 'Smernica WHO',
    title: `${z.who.dni} dni nad mejo`,
    text: `Leta ${z.who.leto} je bilo dnevno povprečje PM2.5 nad 15 µg/m³ kar ${z.who.dni} dni od ${z.who.izmed}. Vsak kvadratek je en dan, obarvani so dnevi nad mejo.`,
    color: 'var(--aq-3)',
    unit: `Vsi dnevi leta ${z.who.leto} · Bežigrad`,
    kind: 'calendar',
  },
  {
    kicker: 'Po mestu',
    title: 'Povsod podobno',
    text: `${postaje.seznam.map((p) => `${p.ime} ${fmt(p.pm25)}`).join(', ')} µg/m³ PM2.5 (${postaje.od}–${postaje.do}). Delci se razlezejo po vsej kotlini, zato šteje, kaj počnemo v celem mestu.`,
    color: 'var(--aq-3)',
    unit: `PM2.5 · povprečje ${postaje.od}–${postaje.do} (µg/m³)`,
    kind: 'bars',
    bars: postaje.seznam.map((p) => ({ label: p.ime, value: p.pm25, color: pm25Color(p.pm25), hi: true })),
  },
  {
    kicker: `Rekord ${leta.length} let`,
    title: datum.toLocaleDateString('sl-SI', { day: 'numeric', month: 'long', year: 'numeric' }),
    text: `Najslabši dan v vseh meritvah: povprečje PM10 ${fmt(z.rekord.pm10)} µg/m³, skoraj ${Math.round(z.rekord.pm10 / 50)}× nad dnevno mejo.${novoLeto ? ' Prvi dan leta, takoj po noči z ognjemeti.' : ''}`,
    color: 'var(--aq-6)',
    unit: 'PM10 · dnevno povprečje',
    kind: 'big',
  },
]

const active = ref(0)
const step = computed(() => steps[active.value]!)
const max = computed(() => Math.max(...(step.value.bars ?? []).map((b) => b.value)) * 1.08)

// koledar: stolpec = teden, vrstica = dan v tednu (pon–ned)
const zamik = (new Date(z.who.prviDan).getDay() + 6) % 7
const dnevi = z.who.dnevno as (number | null)[]
const dayColor = (v: number | null) => (v == null ? 'transparent' : v > 15 ? levelFor(v).color : 'rgba(255,255,255,0.12)')
</script>

<template>
  <ScrollStory v-model:active="active" :count="steps.length" :color="step.color">
    <template #stage>
      <div class="panel-stage">
        <figure class="panel chart">
          <figcaption>{{ step.unit }}</figcaption>

          <div v-if="step.kind === 'bars'" class="bars" :class="{ few: (step.bars?.length ?? 0) <= 3 }">
            <div v-for="(b, i) in step.bars" :key="i" class="col">
              <div class="bar" :class="{ hi: b.hi }" :style="{ '--h': `${(b.value / max) * 100}%`, '--c': b.color ?? step.color }">
                <span v-if="b.hi" class="val">{{ fmt(b.value) }}</span>
              </div>
              <span class="lab">{{ b.label }}</span>
            </div>
          </div>

          <div v-else-if="step.kind === 'calendar'" class="cal" :style="{ '--off': zamik }">
            <span v-for="i in zamik" :key="`x${i}`" />
            <span v-for="(v, i) in dnevi" :key="i" :style="{ background: dayColor(v) }" :title="v == null ? '' : `${v} µg/m³`" />
          </div>

          <div v-else class="big">
            <span class="num">{{ fmt(z.rekord.pm10) }}</span>
            <span class="unit">µg/m³ PM10</span>
            <span class="lim">dnevna meja EU: 50</span>
          </div>

          <p class="source">Vir: {{ z.vir }}</p>
        </figure>
      </div>
    </template>
    <template #step="{ i }">
      <span class="kicker">{{ steps[i]!.kicker }}</span>
      <h2>{{ steps[i]!.title }}</h2>
      <p>{{ steps[i]!.text }}</p>
    </template>
  </ScrollStory>
</template>

<style scoped>
.chart {
  margin: 0;
  --chart-h: clamp(200px, 40vh, 340px);
}
figcaption {
  color: #9fb3c8;
  font-weight: 700;
  font-size: 0.9rem;
  margin-bottom: 18px;
}
.bars {
  display: flex;
  align-items: flex-end;
  gap: 4px;
  padding-top: 26px; /* prostor za številke nad stolpci */
  height: calc(var(--chart-h) + 50px);
}
.bars.few {
  gap: 24px;
  padding: 0 10%;
}
.col {
  flex: 1;
  min-width: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  align-items: stretch;
}
.bar {
  position: relative;
  height: var(--h);
  min-height: 4px;
  max-height: var(--chart-h);
  border-radius: 6px 6px 2px 2px;
  background: var(--c);
  opacity: 0.45;
  transition:
    height 0.7s cubic-bezier(0.3, 0.8, 0.3, 1),
    background 0.6s,
    opacity 0.4s;
}
.bar.hi {
  opacity: 1;
}
.val {
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  padding-bottom: 4px;
  font-family: var(--font-head);
  font-size: 1.1rem;
  white-space: nowrap;
  color: #eaf2fb;
}
.lab {
  height: 24px;
  padding-top: 6px;
  text-align: center;
  font-size: 0.75rem;
  color: #9fb3c8;
  white-space: nowrap;
  overflow: visible;
}
.cal {
  display: grid;
  grid-template-rows: repeat(7, 1fr);
  grid-auto-flow: column;
  gap: 3px;
  height: var(--chart-h);
}
.cal span {
  border-radius: 3px;
  transition: background 0.4s;
}
.big {
  height: calc(var(--chart-h) + 50px);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
}
.big .num {
  font-family: var(--font-head);
  font-size: clamp(4rem, 14vw, 9rem);
  line-height: 1;
  color: var(--lvl);
}
.big .unit {
  font-weight: 800;
  color: #c4d3e2;
}
.big .lim {
  color: #8197ad;
  font-size: 0.9rem;
}
.source {
  margin-top: 16px !important;
  font-size: 0.75rem !important;
  color: #8197ad !important;
}
@media (max-width: 720px) {
  .chart {
    --chart-h: 150px;
  }
  .bars {
    gap: 2px;
  }
  .val {
    font-size: 0.85rem;
  }
  .lab {
    font-size: 0.65rem;
  }
  .cal {
    gap: 2px;
  }
}
</style>
