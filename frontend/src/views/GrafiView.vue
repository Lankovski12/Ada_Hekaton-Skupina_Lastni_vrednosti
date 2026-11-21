<script setup lang="ts">
// Zavihek »Podatki«: kartice dejstev iz 10 let meritev ARSO (ugani, obrni, zberi),
// nato drseči zgodbi o megli v kotlini in napovedi za 48 ur.
import DejstvaKartice from '@/components/DejstvaKartice.vue'
import KotlinaStory from '@/components/stories/KotlinaStory.vue'
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
        Drsi navzdol in poglej, kdaj in zakaj je zrak v Ljubljani slab.
      </p>
    </header>

    <DejstvaKartice />
    <KotlinaStory />
    <NapovedStory />

    <StoryNext
      to="/igre"
      label="Igre"
      kicker="Zdaj pa ti"
      title="Preizkusi, kaj že veš"
      text="Igre uporabljajo prave podatke o zraku v Ljubljani. Pomagaj zmajčku očistiti nebo preizkusi svoje znanje."
      color="var(--aq-1)"
    />
    <div class="story-end" aria-hidden="true" />
  </div>
</template>

<style scoped>
.intro {
  --lvl: #5aa2ff;
  /* kratek uvod, da se kartice dejstev vidijo takoj */
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  max-width: 1100px;
  margin: 0 auto;
  padding: 28px max(24px, 5vw) 4px;
  background: radial-gradient(ellipse at 80% 40%, rgba(90, 162, 255, 0.14), transparent 60%);
}
.intro h1 {
  font-size: clamp(2rem, 5vw, 3.2rem);
}
.intro p {
  max-width: 560px;
  margin-bottom: 10px;
}
</style>
