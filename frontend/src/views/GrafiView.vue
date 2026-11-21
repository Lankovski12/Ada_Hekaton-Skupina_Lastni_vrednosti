<script setup lang="ts">
// Zavihek »Podatki« (grafi): drseče zgodbe iz naših podatkov – kotlina, 10 let meritev ARSO in napoved.
// Kasneje jih bomo spreminjali in delali bolj interaktivne.
import KotlinaStory from '@/components/stories/KotlinaStory.vue'
import ZgodovinaStory from '@/components/stories/ZgodovinaStory.vue'
import NapovedStory from '@/components/stories/NapovedStory.vue'
import StoryNext from '@/components/StoryNext.vue'
</script>

<template>
  <div class="story grafi">
    <!-- uvod -->
    <header class="intro">
      <span class="kicker">Podatki · zgodbe iz naših meritev</span>
      <h1>Kaj nam povedo meritve?</h1>
      <p>
        Megla v kotlini, deset let meritev ARSO in napoved za naslednja dva dni. Drsi navzdol in poglej, kdaj in zakaj
        je zrak v Ljubljani slab.
      </p>
      <span class="scroll-hint" aria-hidden="true">↓ drsi</span>
    </header>

    <KotlinaStory />
    <ZgodovinaStory />
    <NapovedStory />

    <StoryNext
      to="/igre"
      label="Igre"
      kicker="Zdaj pa ti"
      title="Preizkusi, kaj že veš"
      text="Igre uporabljajo prave podatke o zraku v Ljubljani. Pomagaj zmajčku očistiti nebo in ugani jutrišnji zrak."
      color="var(--aq-1)"
    />
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
</style>
