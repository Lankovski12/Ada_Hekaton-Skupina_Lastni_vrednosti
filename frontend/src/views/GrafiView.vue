<script setup lang="ts">
// Zavihek »Podatki« (grafi): drseče zgodbe iz naših podatkov – kotlina, 10 let meritev ARSO in napoved.
// Kasneje jih bomo spreminjali in delali bolj interaktivne.
import KotlinaStory from '@/components/stories/KotlinaStory.vue'
import ZgodovinaStory from '@/components/stories/ZgodovinaStory.vue'
import NapovedStory from '@/components/stories/NapovedStory.vue'
import { defineAsyncComponent, onBeforeUnmount, ref, watch } from 'vue'

// kviz se odpre v oknu na koncu strani (naloži se šele, ko ga odpreš)
const KvizZrak = defineAsyncComponent(() => import('@/components/KvizZrak.vue'))
const kviz = ref(false)
watch(kviz, (v) => {
  document.body.style.overflow = v ? 'hidden' : '' // strani zadaj se med kvizom ne drsi
})
onBeforeUnmount(() => (document.body.style.overflow = ''))
</script>

<template>
  <div class="story grafi">
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
    <NapovedStory />

    <!-- konec strani: kviz v oknu -->
    <section class="vabilo">
      <span class="kicker">Zdaj pa ti</span>
      <h2>Koliko si si zapomnil?</h2>
      <p>Osem kratkih vprašanj o zraku v Ljubljani. Po vsakem odgovoru se kartica obrne in pokaže, kako je v resnici.</p>
      <button class="btn go" @click="kviz = true">Reši kviz <span aria-hidden="true">→</span></button>
    </section>

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
    <div class="story-end" aria-hidden="true" />
  </div>
</template>

<style scoped>
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
