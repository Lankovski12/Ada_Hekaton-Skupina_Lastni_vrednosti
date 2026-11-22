<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import AppNav from '@/components/AppNav.vue'
import OzadjeLise from '@/components/OzadjeLise.vue'
import PmSlovar from '@/components/PmSlovar.vue'
import { useAirData } from '@/composables/useAirData'
import { useProfile } from '@/composables/useProfile'

const { refresh } = useAirData()
const { profile } = useProfile()

onMounted(() => refresh(profile.lokacija ?? undefined))

// stran uporablja svetlo temo
document.documentElement.dataset.theme = 'light'

// domača stran je celozaslonska: brez zgornje navigacije in noge (spodnja navigacija na telefonu ostane)
const route = useRoute()
const domov = computed(() => route.name === 'domov')
// celozaslonski strani (3D igra, izbira iger z Oblačkom): brez noge, ki bi se sicer izrisala čez
const brezNoge = computed(() => domov.value || route.name === 'igra-zmaj' || route.name === 'igre')
</script>

<template>
  <OzadjeLise />
  <!-- razlaga PM2.5 / PM10 ob prehodu z miško po vsej strani -->
  <PmSlovar />
  <AppNav :brez-glave="domov" />
  <main :class="{ domov }">
    <RouterView v-slot="{ Component }">
      <Transition name="fade" mode="out-in">
        <component :is="Component" />
      </Transition>
    </RouterView>
  </main>
  <footer v-if="!brezNoge" class="container footer">
    Podatki: ARSO (živo in ARSOhack), Open-Meteo, CAMS, © OpenStreetMap · Ada hekaton 2026 · Skupina Lastne vrednosti
  </footer>
</template>

<style scoped>
main {
  position: relative;
  z-index: 1;
  min-height: 70vh;
  padding-bottom: 96px; /* prostor za spodnjo navigacijo na telefonu */
}
main.domov {
  padding-bottom: 0;
}
.footer {
  position: relative;
  z-index: 1;
  padding-top: 24px;
  padding-bottom: 110px;
  color: var(--ink-soft);
  font-size: 0.85rem;
  text-align: center;
}
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(6px);
}
</style>
