<script setup lang="ts">
import { computed, onMounted, watchEffect } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import AppNav from '@/components/AppNav.vue'
import OzadjeLise from '@/components/OzadjeLise.vue'
import { useAirData } from '@/composables/useAirData'
import { useProfile } from '@/composables/useProfile'

const { refresh } = useAirData()
const { profile } = useProfile()

onMounted(() => refresh(profile.lokacija ?? undefined))

// tema: svetla je privzeta, temno vklopiš na strani z nastavitvami (/nastavitve)
watchEffect(() => {
  document.documentElement.dataset.theme = profile.tema === 'temna' ? 'dark' : 'light'
})

// domača stran je celozaslonska: brez zgornje navigacije in noge (spodnja navigacija na telefonu ostane)
const route = useRoute()
const domov = computed(() => route.name === 'domov')
</script>

<template>
  <OzadjeLise />
  <AppNav :brez-glave="domov" />
  <main :class="{ domov }">
    <RouterView v-slot="{ Component }">
      <Transition name="fade" mode="out-in">
        <component :is="Component" />
      </Transition>
    </RouterView>
  </main>
  <footer v-if="!domov" class="container footer">
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
