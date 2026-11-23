<script setup lang="ts">
// Zavihek »Podatki«: zakaj je zrak pozimi slab (kotlina) in kaj kaže 10 let meritev ARSO, na koncu kviz.
// Napoved za naslednje ure je samo na strani »Moj zrak«, da se ne ponavlja.
// Na telefonu (do 720 px) je vse ena zgodba za listanje (poteg ali tap): uvod → kotlina → 10 let meritev → kviz.
import KotlinaStory from '@/components/stories/KotlinaStory.vue'
import ZgodovinaStory from '@/components/stories/ZgodovinaStory.vue'
import SwipeStory from '@/components/SwipeStory.vue'
import { computed, defineAsyncComponent, onBeforeUnmount, onMounted, reactive, ref, watch, watchEffect } from 'vue'

// kviz se odpre v oknu na koncu strani (naloži se šele, ko ga odpreš)
const KvizZrak = defineAsyncComponent(() => import('@/components/KvizZrak.vue'))
const kviz = ref(false)

// --- telefon: zgodba za listanje ---
const mq = typeof window !== 'undefined' ? window.matchMedia('(max-width: 720px)') : null
const telefon = ref(mq?.matches ?? false)
const onMq = () => (telefon.value = mq?.matches ?? false)
// višina spodnje navigacije, da zgodba konča tik nad njo
const navH = ref(64)
function izmeriNav() {
  navH.value = (document.querySelector('nav.mobile') as HTMLElement | null)?.offsetHeight || 64
}
onMounted(() => {
  mq?.addEventListener('change', onMq)
  izmeriNav()
  window.addEventListener('resize', izmeriNav)
})
onBeforeUnmount(() => {
  mq?.removeEventListener('change', onMq)
  window.removeEventListener('resize', izmeriNav)
  document.body.style.overflow = ''
})
// strani zadaj se ne drsi: med kvizom in na telefonu (tam se lista vodoravno)
watchEffect(() => {
  document.body.style.overflow = kviz.value || telefon.value ? 'hidden' : ''
  // noga strani bi sicer ležala čez zgodbo in lovila dotike (glej spodnji <style>)
  document.body.classList.toggle('grafi-listanje', telefon.value)
})
onBeforeUnmount(() => document.body.classList.remove('grafi-listanje'))

// poglavja v istem vrstnem redu kot na računalniku; število korakov sporočita zgodbi sami
const POGLAVJA = ['uvod', 'kotlina', 'zgodovina', 'kviz'] as const
const stevila = reactive<Record<(typeof POGLAVJA)[number], number>>({ uvod: 1, kotlina: 4, zgodovina: 8, kviz: 1 })
const poglavje = ref(0)
const naKoncu = ref(false) // ob vrnitvi v prejšnje poglavje začni na njegovem zadnjem koraku
const skupaj = computed(() => POGLAVJA.reduce((s, p) => s + stevila[p], 0))
const pred = computed(() => POGLAVJA.slice(0, poglavje.value).reduce((s, p) => s + stevila[p], 0))
function naslednje() {
  if (poglavje.value < POGLAVJA.length - 1) {
    naKoncu.value = false
    poglavje.value++
  }
}
function prejsnje() {
  if (poglavje.value > 0) {
    naKoncu.value = true
    poglavje.value--
  }
}
watch(telefon, () => (poglavje.value = 0))
</script>

<template>
  <!-- en korenski element, da prehod med stranmi (App.vue) deluje -->
  <div class="grafi-koren">
  <!-- telefon: ena zgodba za listanje -->
  <div v-if="telefon" class="story grafi listanje" :style="{ '--nav-h': `${navH}px` }">
    <SwipeStory
      v-if="POGLAVJA[poglavje] === 'uvod'"
      :key="`uvod-${naKoncu}`"
      :count="1"
      :pred="pred"
      :skupaj="skupaj"
      color="#5aa2ff"
      @konec="naslednje"
    >
      <template #stage>
        <div class="oder-uvod">
          <span class="kicker">Podatki · zgodbe iz naših meritev</span>
          <h1>Kaj nam povedo meritve?</h1>
        </div>
      </template>
      <template #step>
        <p>Zakaj je pozimi v kotlini megla in kaj kaže deset let meritev ARSO.</p>
        <p class="namig">Potegni v levo ali tapni › za naprej.</p>
      </template>
    </SwipeStory>

    <KotlinaStory
      v-else-if="POGLAVJA[poglavje] === 'kotlina'"
      :key="`kotlina-${naKoncu}`"
      nacin="swipe"
      :pred="pred"
      :skupaj="skupaj"
      :zacni-na-koncu="naKoncu"
      @stevilo="(n) => (stevila.kotlina = n)"
      @konec="naslednje"
      @zacetek="prejsnje"
    />

    <ZgodovinaStory
      v-else-if="POGLAVJA[poglavje] === 'zgodovina'"
      :key="`zgodovina-${naKoncu}`"
      nacin="swipe"
      :pred="pred"
      :skupaj="skupaj"
      :zacni-na-koncu="naKoncu"
      @stevilo="(n) => (stevila.zgodovina = n)"
      @konec="naslednje"
      @zacetek="prejsnje"
    />

    <SwipeStory v-else :count="1" :pred="pred" :skupaj="skupaj" color="#2bb673" @zacetek="prejsnje">
      <template #stage>
        <div class="oder-uvod">
          <span class="kicker">Zdaj pa ti</span>
          <h1>Ali veš, kakšen zrak dihaš?</h1>
        </div>
      </template>
      <template #step>
        <p>Osem kratkih vprašanj o zraku v Ljubljani. Po vsakem odgovoru se kartica obrne in pokaže, kako je v resnici.</p>
        <button class="btn go" @click="kviz = true">Reši kviz <span aria-hidden="true">→</span></button>
      </template>
    </SwipeStory>
  </div>

  <div v-else class="story grafi">
    <!-- uvod -->
    <header class="intro">
      <span class="kicker">Podatki · zgodbe iz naših meritev</span>
      <h1>Kaj nam povedo meritve?</h1>
      <p>
        Drsi navzdol in poglej, kdaj in zakaj je zrak v Ljubljani slab.
      </p>
      <span class="scroll-hint" aria-hidden="true">↓</span>
    </header>

    <KotlinaStory />
    <ZgodovinaStory />

    <!-- konec strani: kviz v oknu -->
    <section class="vabilo">
      <span class="kicker">Zdaj pa ti</span>
      <h2>Ali veš kakšen zrak dihaš?</h2>
      <p>Osem kratkih vprašanj o zraku v Ljubljani. Po vsakem odgovoru se kartica obrne in pokaže, kako je v resnici.</p>
      <button class="btn go" @click="kviz = true">Reši kviz <span aria-hidden="true">→</span></button>
    </section>
    <div class="story-end" aria-hidden="true" />
  </div>

  <!-- okno s kvizom (računalnik in telefon) -->
  <Teleport to="body">
    <Transition name="okno">
      <div v-if="kviz" class="ozadje" role="dialog" aria-modal="true" aria-label="Kviz o zraku" @click.self="kviz = false">
        <div class="okno">
          <button class="zapri" aria-label="Zapri kviz" @click="kviz = false">×</button>
          <KvizZrak @zapri="kviz = false" />
        </div>
      </div>
    </Transition>
  </Teleport>
  </div>
</template>

<style scoped>
/* telefon: zgodba za listanje zapolni prostor med glavo in spodnjo navigacijo */
.listanje {
  position: fixed;
  top: 64px;
  left: 0;
  right: 0;
  bottom: var(--nav-h, 64px);
  z-index: 5;
  overflow: hidden;
}
.oder-uvod {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 20px;
  background: radial-gradient(ellipse at 70% 30%, color-mix(in srgb, var(--lvl) 22%, transparent), transparent 70%);
}
.oder-uvod h1 {
  margin: 6px 0 0;
  font-size: 2.1rem;
  line-height: 1.05;
}
.listanje .namig {
  color: var(--ink-soft);
  font-size: 0.88rem;
  font-weight: 700;
}
.listanje .go {
  --btn: var(--aq-1);
  margin-top: 6px;
  color: #10192e;
}
.intro {
  --lvl: #5aa2ff;
  min-height: calc(100svh - 64px);
  display: flex;
  flex-direction: column;
  justify-content: center;
  max-width: 1100px;
  margin: 0 auto;
  padding: 40px max(24px, 5vw);
  background: radial-gradient(ellipse at 80% 40%, rgba(90, 162, 255, 0.14), transparent 60%);
}
.intro p {
  max-width: 560px;
}
.vabilo {
  --lvl: var(--aq-1);
  min-height: 70svh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 80px 24px;
  background: radial-gradient(ellipse at 50% 60%, color-mix(in srgb, var(--lvl) 16%, transparent), transparent 65%);
}
.vabilo p {
  max-width: 520px;
}
.vabilo .go {
  --btn: var(--lvl);
  margin-top: 28px;
  font-size: 1.25rem;
  padding: 18px 34px;
  min-height: 60px;
  color: #10192e;
  animation: bob 2.6s ease-in-out infinite;
}
@keyframes bob {
  50% {
    transform: translateY(-4px) rotate(-1.5deg);
  }
}

/* okno s kvizom */
.ozadje {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 24px 12px;
  overflow-y: auto;
  background: rgba(16, 25, 46, 0.55);
  backdrop-filter: blur(4px);
}
.okno {
  position: relative;
  width: min(1000px, 100%);
  margin: auto 0;
  border-radius: 32px;
  background: var(--bg);
  box-shadow: 0 30px 80px -20px rgba(0, 0, 0, 0.5);
  padding: 18px 0 8px;
}
.zapri {
  position: absolute;
  top: 12px;
  right: 14px;
  z-index: 3;
  width: 42px;
  height: 42px;
  border-radius: 50%;
  border: 2px solid var(--line);
  background: var(--card);
  color: var(--ink);
  font-size: 1.6rem;
  line-height: 1;
}
.okno-enter-active,
.okno-leave-active {
  transition: opacity 0.25s;
}
.okno-enter-active .okno,
.okno-leave-active .okno {
  transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.okno-enter-from,
.okno-leave-to {
  opacity: 0;
}
.okno-enter-from .okno,
.okno-leave-to .okno {
  transform: translateY(30px) scale(0.96);
}
</style>

<style>
/* telefon, Podatki kot zgodba za listanje: noge strani ni (sicer leži čez zgodbo) */
@media (max-width: 720px) {
  body.grafi-listanje footer {
    display: none;
  }
}
</style>
