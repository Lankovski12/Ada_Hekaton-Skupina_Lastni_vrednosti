<script setup lang="ts">
// Naloga 4: pobarvaj ure, ko je bil zrak slab. Na koncu vidiš, koliko ur si zadel.
import { computed, ref } from 'vue'
import type { Dan } from '../dan'
import type { Rezultat } from '../vrste'

const props = defineProps<{ dan: Dan }>()
const emit = defineEmits<{ konec: [Rezultat] }>()

const vals = computed(() => props.dan.ure)
// meja: 25 µg/m³; če je bil cel dan pod njo, vzamemo 15 (priporočilo WHO), da je naloga zanimiva
const meja = computed(() => (Math.max(...vals.value.map((v) => v ?? 0)) < 25 ? 15 : 25))
const slabo = ref<boolean[]>(Array(24).fill(false))
const odgovorjeno = ref(false)
const zadetki = ref(0)

function preklopi(i: number) {
  if (odgovorjeno.value || vals.value[i] == null) return
  slabo.value[i] = !slabo.value[i]
}

function potrdi() {
  odgovorjeno.value = true
  let n = 0
  let ok = 0
  vals.value.forEach((v, i) => {
    if (v == null) return
    n++
    if (v > meja.value === slabo.value[i]) ok++
  })
  zadetki.value = ok
  const delez = ok / Math.max(1, n)
  const slabih = vals.value.filter((v) => v != null && v > meja.value).length
  emit('konec', {
    zvezdice: delez >= 0.9 ? 3 : delez >= 0.75 ? 2 : delez >= 0.55 ? 1 : 0,
    razlaga:
      `Zadel si ${ok} od ${n} ur. Včeraj je bil zrak nad mejo ${meja.value} µg/m³ ${slabih} ${slabih === 1 ? 'uro' : slabih < 5 && slabih > 1 ? 'ure' : 'ur'}. ` +
      (slabih > 12 ? 'Več kot pol dneva – takrat je bolje, da se igraš v hiši.' : 'Ko veš, kdaj je zrak boljši, lahko takrat greš ven.'),
  })
}
</script>

<template>
  <div class="naloga">
    <p class="vprasanje">
      Pobarvaj <strong class="red">rdeče</strong> ure, ko je bilo včeraj v Ljubljani več kot <strong>{{ meja }} µg/m³</strong> delcev.
      Tapni ploščico.
    </p>
    <div class="grid">
      <button
        v-for="(v, i) in vals"
        :key="i"
        class="tile"
        :class="{
          bad: slabo[i],
          none: v == null,
          hit: odgovorjeno && v != null && v > meja === slabo[i],
          miss: odgovorjeno && v != null && v > meja !== slabo[i],
        }"
        :disabled="odgovorjeno || v == null"
        @click="preklopi(i)"
      >
        <span class="hr">{{ i }}h</span>
        <span v-if="odgovorjeno && v != null" class="val">{{ Math.round(v) }}</span>
        <span v-if="odgovorjeno && v != null" class="truth" :class="v > meja ? 'r' : 'g'" />
      </button>
    </div>
    <p v-if="odgovorjeno" class="score">Zadetki: <strong>{{ zadetki }}</strong></p>
    <button v-if="!odgovorjeno" class="k-btn green" @click="potrdi">Potrdi</button>
  </div>
</template>

<style scoped>
.red {
  color: #e5484d;
}
.grid {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 8px;
}
.tile {
  position: relative;
  aspect-ratio: 1;
  border: 0;
  border-radius: 16px;
  background: #3ccf6e;
  box-shadow: 0 5px 0 #26a052;
  color: #fff;
  font-family: var(--font-head);
  font-weight: 800;
  cursor: pointer;
  display: grid;
  place-items: center;
  transition: transform 0.1s, background 0.15s;
}
.tile:active:not(:disabled) {
  transform: translateY(3px);
}
.tile.bad {
  background: #e5484d;
  box-shadow: 0 5px 0 #b8323a;
}
.tile.none {
  background: #d5dde5;
  box-shadow: 0 5px 0 #b2bdc8;
}
.tile.miss {
  outline: 4px dashed #1d3557;
  outline-offset: -4px;
}
.hr {
  font-size: 1.05rem;
}
.val {
  position: absolute;
  bottom: 4px;
  font-size: 0.75rem;
  opacity: 0.9;
}
.truth {
  position: absolute;
  top: 5px;
  right: 5px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid #fff;
}
.truth.r {
  background: #8e1b20;
}
.truth.g {
  background: #0f6b33;
}
.score {
  font-size: 1.2rem;
}
@media (max-width: 520px) {
  .grid {
    grid-template-columns: repeat(6, 1fr);
    gap: 6px;
  }
}
</style>
