<script setup lang="ts">
// Naloga 5: razvrsti štiri kraje od najbolj do najmanj onesnaženega (tapni po vrsti).
import { computed, ref } from 'vue'
import { levelFor } from '@/lib/airQuality'
import { kraj, type Dan, type Postaja } from '../dan'
import type { Rezultat } from '../vrste'

const props = defineProps<{ dan: Dan }>()
const emit = defineEmits<{ konec: [Rezultat] }>()

// po en kraj; izberemo štiri z razpršenimi vrednostmi (najvišja, najnižja in dve vmes)
const izbor = computed<Postaja[]>(() => {
  const poKraju = new Map<string, Postaja>()
  for (const p of props.dan.postaje) {
    const k = kraj(p.ime)
    if (!poKraju.has(k) || p.pm25 > poKraju.get(k)!.pm25) poKraju.set(k, p)
  }
  const s = [...poKraju.values()].sort((a, b) => b.pm25 - a.pm25)
  const idx = [0, Math.round((s.length - 1) / 3), Math.round((2 * (s.length - 1)) / 3), s.length - 1]
  const four = [...new Set(idx)].map((i) => s[i]!)
  return four.sort(() => Math.random() - 0.5)
})
const pravilno = computed(() => [...izbor.value].sort((a, b) => b.pm25 - a.pm25))
const vrstni = ref<string[]>([]) // id-ji po otrokovem vrstnem redu
const odgovorjeno = ref(false)
const maxPm = computed(() => Math.max(...izbor.value.map((p) => p.pm25)))

function tapni(p: Postaja) {
  if (odgovorjeno.value) return
  const i = vrstni.value.indexOf(p.id)
  if (i >= 0) vrstni.value.splice(i)
  else vrstni.value.push(p.id)
}

function potrdi() {
  odgovorjeno.value = true
  const prav = vrstni.value.filter((id, i) => pravilno.value[i]?.id === id).length
  const zvezdice = prav === izbor.value.length ? 3 : prav >= 2 ? 2 : prav === 1 ? 1 : 0
  const [a, , , z] = pravilno.value
  emit('konec', {
    zvezdice,
    razlaga: `Na pravem mestu imaš ${prav} od ${izbor.value.length}. Najbolj umazan zrak je bil v kraju ${kraj(a!.ime)} (${Math.round(a!.pm25)} µg/m³), najčistejši v kraju ${kraj((z ?? a)!.ime)} (${Math.round((z ?? a)!.pm25)} µg/m³).`,
  })
}
</script>

<template>
  <div class="naloga">
    <p class="vprasanje">Razvrsti kraje od <strong>najbolj</strong> do <strong>najmanj</strong> onesnaženega včeraj. Tapni jih po vrsti.</p>
    <div class="cards">
      <button v-for="p in izbor" :key="p.id" class="place" :class="{ picked: vrstni.includes(p.id) }" :disabled="odgovorjeno" @click="tapni(p)">
        <span class="num">{{ vrstni.includes(p.id) ? vrstni.indexOf(p.id) + 1 : '' }}</span>
        <span class="name">{{ kraj(p.ime) }}</span>
        <span v-if="odgovorjeno" class="bar"><i :style="{ width: `${(p.pm25 / maxPm) * 100}%`, background: levelFor(p.pm25).hex }" /></span>
        <span v-if="odgovorjeno" class="v">
          {{ Math.round(p.pm25) }} µg/m³ ·
          <b :class="pravilno.indexOf(p) === vrstni.indexOf(p.id) ? 'ok' : 'no'">pravo mesto: {{ pravilno.indexOf(p) + 1 }}</b>
        </span>
      </button>
    </div>
    <button v-if="!odgovorjeno" class="k-btn green" :disabled="vrstni.length < izbor.length" @click="potrdi">Potrdi</button>
  </div>
</template>

<style scoped>
.cards {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}
.place {
  position: relative;
  display: grid;
  gap: 6px;
  justify-items: center;
  padding: 18px 10px 14px;
  border: 0;
  border-radius: 22px;
  background: #3fa9f5;
  box-shadow: 0 6px 0 #2479bd;
  color: #fff;
  font-family: var(--font-head);
  cursor: pointer;
  transition: transform 0.1s, background 0.2s;
}
.place:active:not(:disabled) {
  transform: translateY(4px);
}
.place.picked {
  background: #9b6bff;
  box-shadow: 0 6px 0 #7146d6;
}
.place:disabled {
  cursor: default;
}
.num {
  position: absolute;
  top: -12px;
  left: -8px;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: #ffc22e;
  color: #5c3d00;
  font-size: 1.4rem;
  font-weight: 800;
  box-shadow: 0 3px 0 #d99a00;
}
.num:empty {
  display: none;
}
.name {
  font-size: 1.4rem;
  font-weight: 800;
}
.bar {
  width: 100%;
  height: 12px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.35);
  overflow: hidden;
}
.bar i {
  display: block;
  height: 100%;
  border-radius: 999px;
  animation: grow 0.7s ease-out;
}
.v {
  font-family: var(--font-body);
  font-weight: 700;
  font-size: 0.85rem;
}
.v .ok {
  color: #c8ffd9;
}
.v .no {
  color: #ffe0a0;
}
@keyframes grow {
  from {
    width: 0;
  }
}
</style>
