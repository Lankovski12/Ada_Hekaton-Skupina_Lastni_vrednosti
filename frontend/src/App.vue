<script setup lang="ts">
import { onMounted } from 'vue'
import { RouterView } from 'vue-router'
import AppNav from '@/components/AppNav.vue'
import { useAirData } from '@/composables/useAirData'
import { useProfile } from '@/composables/useProfile'

const { refresh } = useAirData()
const { profile } = useProfile()

onMounted(() => refresh(profile.lokacija ?? undefined))
</script>

<template>
  <AppNav />
  <main>
    <RouterView v-slot="{ Component }">
      <Transition name="fade" mode="out-in">
        <component :is="Component" />
      </Transition>
    </RouterView>
  </main>
  <footer class="container footer">
    Za otroke in starše v Ljubljani · Podatki: ARSO, Sensor.Community, Open-Meteo · Ada hekaton 2026 · Skupina Lastne vrednosti
  </footer>
</template>

<style scoped>
main {
  min-height: 70vh;
  padding-bottom: 96px; /* prostor za spodnjo navigacijo na telefonu */
}
.footer {
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
