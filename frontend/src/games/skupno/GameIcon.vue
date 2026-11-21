<script setup lang="ts">
// Preproste ikone za igro (SVG), da ne potrebujemo emojijev ali slik.
defineProps<{
  name: 'oblak' | 'obroc' | 'dimnik' | 'vprasaj' | 'zvezda' | 'ura' | 'zvok' | 'tiho' | 'smog' | 'veter' | 'zmaj' | 'pokrovka'
  size?: number
}>()
</script>

<template>
  <svg :width="size ?? 28" :height="size ?? 28" viewBox="0 0 32 32" aria-hidden="true" class="gi">
    <template v-if="name === 'oblak'">
      <path d="M9 24c-4 0-6-3-5-6 1-2 3-3 5-3 0-4 4-7 8-6 2 1 4 3 4 5 3-1 6 1 6 4 1 3-1 6-4 6z" fill="#e9f5ff" stroke="#3a7bd5" stroke-width="2" />
      <circle cx="13" cy="18" r="1.3" fill="#1d2b3a" /><circle cx="19" cy="18" r="1.3" fill="#1d2b3a" />
      <path d="M14 21q2 1.6 4 0" stroke="#1d2b3a" stroke-width="1.4" fill="none" stroke-linecap="round" />
      <path d="M16 26l-1.5 3a1.6 1.6 0 1 0 3 0z" fill="#4aa3ff" />
    </template>
    <template v-else-if="name === 'obroc' || name === 'veter'">
      <circle cx="16" cy="16" r="11" fill="none" stroke="#7fdcff" stroke-width="4" />
      <path d="M9 14h11a3 3 0 1 0-3-3M8 19h14a3 3 0 1 1-3 3" stroke="#ffffff" stroke-width="2.4" fill="none" stroke-linecap="round" />
    </template>
    <template v-else-if="name === 'dimnik'">
      <rect x="11" y="12" width="10" height="18" rx="1.5" fill="#d9d9d9" stroke="#555" stroke-width="1.5" />
      <rect x="11" y="14" width="10" height="4" fill="#e5484d" />
      <circle cx="18" cy="8" r="3.5" fill="#8a8178" /><circle cx="23" cy="5" r="3" fill="#a39a90" />
    </template>
    <template v-else-if="name === 'vprasaj'">
      <circle cx="16" cy="16" r="13" fill="#ffc22e" stroke="#e08a00" stroke-width="2" />
      <path d="M12.5 12.5a3.6 3.6 0 1 1 5.2 3.2c-1.2.6-1.7 1.4-1.7 2.8" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" />
      <circle cx="16" cy="23" r="1.8" fill="#fff" />
    </template>
    <template v-else-if="name === 'zvezda'">
      <path d="M16 2.5l4.1 8.4 9.2 1.3-6.7 6.5 1.6 9.2L16 23.6l-8.2 4.3 1.6-9.2-6.7-6.5 9.2-1.3z" fill="currentColor" stroke="#b37400" stroke-width="1.5" stroke-linejoin="round" />
    </template>
    <template v-else-if="name === 'ura'">
      <circle cx="16" cy="17" r="12" fill="#fff" stroke="currentColor" stroke-width="3" />
      <path d="M16 10v7l5 3" stroke="currentColor" stroke-width="3" fill="none" stroke-linecap="round" />
      <rect x="13" y="1.5" width="6" height="4" rx="1.5" fill="currentColor" />
    </template>
    <template v-else-if="name === 'zmaj'">
      <path d="M9 9l-2-5 5 3M23 9l2-5-5 3" fill="#ff9f43" />
      <circle cx="16" cy="16" r="10" fill="#2ec4a0" />
      <ellipse cx="16" cy="21" rx="6" ry="4" fill="#bff3e4" />
      <circle cx="12" cy="14" r="2.2" fill="#fff" /><circle cx="20" cy="14" r="2.2" fill="#fff" />
      <circle cx="12.4" cy="14.4" r="1.1" fill="#1d2b3a" /><circle cx="20.4" cy="14.4" r="1.1" fill="#1d2b3a" />
      <path d="M13 22q3 2 6 0" stroke="#1d2b3a" stroke-width="1.4" fill="none" stroke-linecap="round" />
      <path d="M27 18c2 0 3 1 4 2M27 21c2 .5 3 1.5 3.5 3" stroke="#9fe3ff" stroke-width="2" fill="none" stroke-linecap="round" />
    </template>
    <template v-else-if="name === 'pokrovka'">
      <rect x="2" y="4" width="28" height="12" rx="2" fill="#ffd9a8" />
      <rect x="2" y="16" width="28" height="12" rx="2" fill="#a9cdf5" />
      <path d="M2 28l8-14 6 8 5-5 9 11z" fill="#5e9150" />
      <path d="M2 16h28" stroke="#fff" stroke-width="2.4" stroke-dasharray="4 3" />
      <circle cx="24" cy="21" r="2.5" fill="#8f877c" /><circle cx="20" cy="20" r="2" fill="#a39a90" />
    </template>
    <template v-else-if="name === 'smog'">
      <circle cx="11" cy="18" r="7" fill="#cfc8bd" /><circle cx="20" cy="15" r="8" fill="#bdb5a9" /><circle cx="24" cy="21" r="5" fill="#cfc8bd" />
    </template>
    <template v-else-if="name === 'zvok' || name === 'tiho'">
      <path d="M5 12h5l7-6v20l-7-6H5z" fill="currentColor" />
      <template v-if="name === 'zvok'">
        <path d="M21 11a7 7 0 0 1 0 10M24.5 7.5a12 12 0 0 1 0 17" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" />
      </template>
      <path v-else d="M21 11l8 10M29 11l-8 10" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" />
    </template>
  </svg>
</template>

<style scoped>
.gi {
  flex: none;
  display: inline-block;
  vertical-align: middle;
}
</style>
