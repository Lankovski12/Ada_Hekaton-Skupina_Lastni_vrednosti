<script setup lang="ts">
// Domača stran = zgodba, ki naredi nevidno vidno (navdih: »Seeing the Invisible«, WHO + Google Arts & Culture).
// Skulptura ostane pripeta, besedilo drsi čez njo; vsak korak skulpturi pove, kakšen zrak naj pokaže.
// Na koncu gumb na zavihek Blogi (tam se zgodba nadaljuje: kotlina, 10 let meritev, napoved).
import { computed, ref } from 'vue'
import DataSculpture from '@/scenes/DataSculpture.vue'
import ScrollStory from '@/components/ScrollStory.vue'
import StoryNext from '@/components/StoryNext.vue'
import { useAirData } from '@/composables/useAirData'
import { useProfile } from '@/composables/useProfile'
import { levelFor } from '@/lib/airQuality'
import { klimaLabel, typicalPm25 } from '@/lib/klima'
import z from '@/data/zgodovina.json'

const { currentPm25, origin, now } = useAirData()
const { sensitivity } = useProfile()

const live = computed(() => currentPm25.value ?? typicalPm25())

/* ---------- 1. poglavje: oblak delcev ---------- */
const myPm = ref(30) // zadnji korak: »ustvari svoj zrak«

interface Step {
  kicker: string
  title: string
  text: string
  pm: () => number
  interactive?: boolean
}
const steps: Step[] = [
  {
    kicker: 'Nevidno postane vidno',
    title: 'Zrak, ki ga dihamo',
    text: 'Drobnih delcev PM2.5 z očmi ne vidiš. Tukaj jih lahko. Vsaka pika je delček zraka nad Ljubljano. Povleci, da ga zavrtiš.',
    pm: () => live.value,
  },
  {
    kicker: 'Ljubljana, ta trenutek',
    title: '',
    text: 'Toliko mikrogramov drobnih delcev je v vsakem kubičnem metru zraka. Bolj ko je oblak nemiren in bodičast, slabši je zrak.',
    pm: () => live.value,
  },
  {
    kicker: 'Kako majhno je to?',
    title: '~30× tanjše od lasu',
    text: 'Delec PM2.5 je velik največ 2,5 mikrometra. Tako je majhen, da ga vdihneš globoko v pljuča. Otroci dihajo hitreje kot odrasli, zato vdihnejo več.',
    pm: () => live.value,
  },
  {
    kicker: 'Smernica WHO',
    title: '15 µg/m³ na dan',
    text: 'Svetovna zdravstvena organizacija priporoča, naj dnevno povprečje ne preseže 15 µg/m³. Tako izgleda zrak tik pod to mejo.',
    pm: () => 15,
  },
  {
    kicker: 'Zimski večer z inverzijo',
    title: `${Math.round(z.primeri.inverzijaVecer)} µg/m³`,
    text: `Hladen zrak obleži na dnu kotline kot pod pokrovko. Dim iz dimnikov in izpuhov ne more ven – oblak postane nemiren in temen. Toliko je povprečno izmerila postaja ARSO na Bežigradu ob zimskih večerih z inverzijo (${z.pm25Od}–${z.zadnjeLeto}).`,
    pm: () => z.primeri.inverzijaVecer,
  },
  {
    kicker: 'Poletno jutro po dežju',
    title: `${Math.round(z.primeri.poletjeDez)} µg/m³`,
    text: `Dež spere delce, veter jih odnese. Oblak se umiri in diha počasi. Povprečje meritev ARSO poleti zjutraj, ko je pred tem padlo vsaj 1 mm dežja.`,
    pm: () => z.primeri.poletjeDez,
  },
  {
    kicker: 'Zdaj ti',
    title: 'Ustvari svoj zrak',
    text: 'Povleci drsnik in poglej, kako se oblak spreminja.',
    pm: () => myPm.value,
    interactive: true,
  },
]

const active = ref(0)
const pm = computed(() => steps[active.value]!.pm())
const level = computed(() => levelFor(pm.value, sensitivity.value))
const isMeasured = computed(() => now.value?.postaje.some((p) => p.vir === 'meritev') ?? false)
const stationTime = computed(() => {
  const t = now.value?.cas_utc
  return t ? new Date(t).toLocaleTimeString('sl-SI', { hour: '2-digit', minute: '2-digit' }) : ''
})
</script>

<template>
  <!-- en korenski element, da animacija prehoda med stranmi (App.vue) deluje -->
  <div class="story home">
    <!-- 1. POGLAVJE: oblak delcev -->
    <ScrollStory v-model:active="active" :count="steps.length" :color="level.color" plain-first>
      <template #stage>
        <DataSculpture :pm25="pm" :color="level.hex" />
        <div class="readout" aria-live="polite">
          <span class="num">{{ Math.round(pm) }}</span>
          <span class="unit">µg/m³ PM2.5</span>
          <span class="lvl">{{ level.label }}</span>
        </div>
      </template>
      <template #step="{ i }">
        <span class="kicker">{{ steps[i]!.kicker }}</span>
        <h1 v-if="i === 0">{{ steps[i]!.title }}</h1>
        <h2 v-else-if="i === 1" class="big">
          {{ live }} <small>µg/m³</small>
        </h2>
        <h2 v-else>{{ steps[i]!.title }}</h2>
        <p>{{ steps[i]!.text }}</p>
        <p v-if="i === 1" class="src">
          {{
            isMeasured
              ? `Meritev ARSO ob ${stationTime}${origin === 'predpomnilnik' ? ' (shranjena, ni povezave)' : ''}`
              : `Meritve še niso prispele – to je običajna vrednost ob tej uri (${klimaLabel})`
          }}
        </p>
        <label v-if="steps[i]!.interactive" class="slider">
          <input v-model.number="myPm" type="range" min="0" max="100" aria-label="PM2.5" />
          <span>{{ myPm }} µg/m³ · {{ levelFor(myPm).kids }}</span>
        </label>
        <span v-if="i === 0" class="scroll-hint" aria-hidden="true">↓ drsi</span>
      </template>
    </ScrollStory>

    <StoryNext
      to="/starsi"
      label="Blogi"
      kicker="Kaj pa pozimi?"
      title="Zakaj je zrak v Ljubljani včasih tako slab?"
      text="Poglej, kako se v kotlini ujame megla, kaj kaže deset let meritev ARSO in kdaj bo zrak najboljši v naslednjih dveh dneh."
      :color="level.color"
    />
    <div class="story-end" aria-hidden="true" />
  </div>
</template>
