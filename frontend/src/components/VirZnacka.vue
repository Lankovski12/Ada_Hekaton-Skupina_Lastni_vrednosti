<script setup lang="ts">
// Oznaka ob vsaki številki: ali je izmerjena (meritev), izračunana z modelom (model) ali ocenjena (ocena).
// Tako starš vedno ve, koliko številki lahko zaupa. Ob prehodu z miško se pokaže kratka razlaga.
import { computed } from 'vue'

const props = defineProps<{ vrsta: 'meritev' | 'model' | 'ocena' }>()

const RAZLAGA = {
  meritev: 'Meritev: izmerjeno z merilnikom ARSO (ali povprečje takih meritev).',
  model: 'Model: izračun računalniškega modela (napoved ali simulacija), ne meritev.',
  ocena: 'Ocena: izpeljano iz drugih podatkov (npr. povprečja preteklih let ali reliefa), ne meritev ob tej uri.',
}
const razlaga = computed(() => RAZLAGA[props.vrsta])
</script>

<template>
  <span class="vir-znacka" :class="vrsta" :title="razlaga" :aria-label="razlaga">{{ vrsta }}</span>
</template>

<style scoped>
.vir-znacka {
  display: inline-block;
  margin-right: 4px;
  padding: 1px 8px;
  border-radius: 999px;
  font-family: var(--font-body, inherit);
  font-size: 0.66rem;
  font-weight: 800;
  line-height: 1.5;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  vertical-align: 1px;
  white-space: nowrap;
  color: var(--ink);
  cursor: help;
}
.meritev {
  background: color-mix(in srgb, var(--aq-1) 24%, transparent);
}
.model {
  background: color-mix(in srgb, var(--brand) 22%, transparent);
}
.ocena {
  background: color-mix(in srgb, var(--accent) 32%, transparent);
}
</style>
