<script setup lang="ts">
// TODO: igra spomina / iskanja parov (kaj onesnažuje ↔ kaj pomaga).
// Logiko daj v ./logic.ts, kartice v ./cards.ts, podatke beri prek useAirData().
import { RouterLink } from 'vue-router'
</script>

<template>
  <section class="container page">
    <RouterLink to="/otroci" class="back">← Igre</RouterLink>
    <div class="card">
      <h1>🧩 Poišči par</h1>
      <p>Ta igra še nastaja. Kmalu boš lahko iskal(a) pare: kaj umaže zrak in kaj mu pomaga.</p>
    </div>
  </section>
</template>

<style scoped>
.page {
  padding-top: 20px;
}
.back {
  display: inline-block;
  margin-bottom: 10px;
  font-weight: 700;
  text-decoration: none;
}
</style>
