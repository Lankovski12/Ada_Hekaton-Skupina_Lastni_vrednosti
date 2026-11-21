<script setup lang="ts">
// Naloga 3: tapni uro, ko je bilo včeraj v Ljubljani največ delcev. Nato se odkrije pravi potek dneva.
import { computed, ref } from 'vue'
import { levelFor } from '@/lib/airQuality'
import type { Dan } from '../dan'
import type { Rezultat } from '../vrste'

const props = defineProps<{ dan: Dan }>()
const emit = defineEmits<{ konec: [Rezultat] }>()

const izbrana = ref<number | null>(null)
const odgovorjeno = ref(false)
const vals = computed(() => props.dan.ure)
const max = computed(() => Math.max(...vals.value.map((v) => v ?? 0), 1))
const naj = computed(() => vals.value.reduce<number>((best, v, i) => ((v ?? -1) > (vals.value[best] ?? -1) ? i : best), 0))

function potrdi() {
  if (izbrana.value == null) return
  odgovorjeno.value = true
  const d = Math.abs(izbrana.value - naj.value)
  const zvezdice = d <= 1 ? 3 : d <= 2 ? 2 : d <= 4 ? 1 : 0
  emit('konec', {
    zvezdice,
    razlaga:
      `Največ delcev je bilo ob ${naj.value}. uri: ${Math.round(vals.value[naj.value] ?? 0)} µg/m³. Ti si izbral ${izbrana.value}. uro. ` +
      'Pozimi je zrak navadno najslabši zvečer in ponoči, ko ljudje kurijo in se zrak ohladi, najboljši pa popoldne.',
  })
}
</script>

<template>
  <div class="naloga">
    <p class="vprasanje">Ob kateri <strong>uri</strong> je bilo včeraj v Ljubljani največ smoga? Tapni stolpec.</p>
    <div class="chart" role="listbox" aria-label="Ure dneva">
      <button
        v-for="(v, i) in vals"
        :key="i"
        class="col"
        :class="{ on: izbrana === i, best: odgovorjeno && i === naj, none: v == null }"
        :disabled="odgovorjeno"
        :aria-label="`${i}. ura`"
        @click="izbrana = i"
      >
        <span
          class="bar"
          :style="{
            height: odgovorjeno ? `${Math.max(4, ((v ?? 0) / max) * 100)}%` : '55%',
            background: odgovorjeno ? (v == null ? '#d5dde5' : levelFor(v).hex) : izbrana === i ? '#ffc22e' : '#bfe3ff',
            transitionDelay: `${i * 0.03}s`,
          }"
        />
        <span class="h">{{ i }}</span>
      </button>
    </div>
    <div class="dayline"><span>noč</span><span>jutro</span><span>opoldne</span><span>popoldne</span><span>večer</span></div>
    <p v-if="izbrana != null && !odgovorjeno" class="izbira">Izbral si <strong>{{ izbrana }}. uro</strong></p>
    <button v-if="!odgovorjeno" class="k-btn green" :disabled="izbrana == null" @click="potrdi">Potrdi</button>
  </div>
</template>

<style scoped>
.chart {
  display: grid;
  grid-template-columns: repeat(24, 1fr);
  gap: 3px;
  height: 220px;
  padding: 10px 8px 0;
  border-radius: 20px;
  background: linear-gradient(180deg, #e8f5ff, #fff);
}
.col {
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  align-items: stretch;
  gap: 4px;
  min-width: 0;
  padding: 0;
  border: 0;
  background: none;
  cursor: pointer;
}
.col:disabled {
  cursor: default;
}
.bar {
  display: block;
  border-radius: 8px 8px 3px 3px;
  transition: height 0.6s cubic-bezier(0.2, 1.4, 0.4, 1), background 0.3s;
}
.col.on .bar {
  box-shadow: 0 0 0 3px #e08a00;
}
.col.best .bar {
  box-shadow: 0 0 0 3px #e5484d;
  animation: glow 0.5s ease-in-out infinite alternate;
}
.h {
  font-size: 0.7rem;
  font-weight: 800;
  color: #5b6b7b;
  text-align: center;
}
.dayline {
  display: flex;
  justify-content: space-between;
  padding: 4px 8px 0;
  font-size: 0.8rem;
  font-weight: 700;
  color: #8193a5;
}
.izbira {
  margin: 8px 0 0;
}
@keyframes glow {
  to {
    filter: brightness(1.2);
  }
}
@media (max-width: 520px) {
  .h {
    font-size: 0.55rem;
  }
}
</style>
