<script setup lang="ts">
// Prva igra: tapkaj oblačke dima, preden jih je preveč. Hitrost je odvisna od pravega PM2.5.
import { computed, onBeforeUnmount, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useAirData } from '@/composables/useAirData'
import { useProgressStore } from '@/stores/progress'
import { typicalPm25 } from '@/lib/klima'
import { LEVELS, makeSmoke, spawnRate, type Smoke } from './logic'

const { currentPm25 } = useAirData()
const progress = useProgressStore()

const state = ref<'start' | 'play' | 'konec'>('start')
const levelIdx = ref(0)
const smokes = ref<Smoke[]>([])
const score = ref(0)
const timeLeft = ref(0)
const pops = ref<{ id: number; x: number; y: number }[]>([])
let raf = 0
let last = 0
let acc = 0

const level = computed(() => LEVELS[levelIdx.value]!)
const danger = computed(() => smokes.value.length / level.value.maxNaZaslonu)
const pm = computed(() => currentPm25.value ?? typicalPm25())

function start(i = 0) {
  levelIdx.value = i
  smokes.value = []
  score.value = 0
  timeLeft.value = level.value.trajanje
  state.value = 'play'
  last = performance.now()
  acc = 0
  raf = requestAnimationFrame(tick)
}

function tick(t: number) {
  const dt = (t - last) / 1000
  last = t
  timeLeft.value = Math.max(0, timeLeft.value - dt)
  acc += dt * spawnRate(pm.value, levelIdx.value)
  while (acc >= 1) {
    smokes.value.push(makeSmoke(t))
    acc -= 1
  }
  if (smokes.value.length > level.value.maxNaZaslonu || timeLeft.value <= 0) return end()
  raf = requestAnimationFrame(tick)
}

function end() {
  cancelAnimationFrame(raf)
  state.value = 'konec'
  progress.addPoints('zmaj', score.value)
}

function pop(s: Smoke) {
  smokes.value = smokes.value.filter((x) => x.id !== s.id)
  score.value++
  const p = { id: s.id, x: s.x, y: s.y }
  pops.value.push(p)
  setTimeout(() => (pops.value = pops.value.filter((x) => x.id !== p.id)), 500)
}

onBeforeUnmount(() => cancelAnimationFrame(raf))
</script>

<template>
  <section class="container page">
    <RouterLink to="/igre" class="back">← Igre</RouterLink>
    <div class="arena" :style="{ '--danger': danger }">
      <div class="hud" v-if="state === 'play'">
        <span class="pill">⭐ {{ score }}</span>
        <span class="pill">⏱ {{ Math.ceil(timeLeft) }} s</span>
        <span class="pill">{{ level.ime }}</span>
      </div>

      <button
        v-for="s in smokes"
        :key="s.id"
        class="smoke"
        :style="{ left: `${s.x}%`, top: `${s.y}%`, width: `${s.size}px`, height: `${s.size}px` }"
        aria-label="Oblaček dima"
        @pointerdown.prevent="pop(s)"
      />
      <span v-for="p in pops" :key="`p${p.id}`" class="pop" :style="{ left: `${p.x}%`, top: `${p.y}%` }">+1</span>

      <div class="dragon" :class="{ cough: danger > 0.7 }" aria-hidden="true">🐲</div>

      <div v-if="state !== 'play'" class="overlay">
        <template v-if="state === 'start'">
          <h1>Zmajček čisti nebo</h1>
          <p>Zdaj je v Ljubljani <strong>{{ pm }} µg/m³</strong> delcev – bolj kot je umazano, hitreje prihaja dim. Tapkaj oblačke!</p>
          <div class="levels">
            <button v-for="(l, i) in LEVELS" :key="l.ime" class="btn" @click="start(i)">{{ i + 1 }}. {{ l.ime }}</button>
          </div>
        </template>
        <template v-else>
          <h1>{{ timeLeft <= 0 ? 'Bravo! 🎉' : 'Khe khe! 😮‍💨' }}</h1>
          <p>Pobral si <strong>{{ score }}</strong> oblačkov dima.</p>
          <p class="tip">💡 Ali si vedel? Ko je zrak slab, je pametno, da se igraš v hiši in zračiš le na kratko.</p>
          <button class="btn" @click="start(levelIdx)">Še enkrat</button>
        </template>
      </div>
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
.arena {
  position: relative;
  height: min(70vh, 560px);
  border-radius: var(--radius);
  overflow: hidden;
  background: linear-gradient(
    180deg,
    color-mix(in srgb, #8fd3ff calc((1 - var(--danger)) * 100%), #8a7f78),
    color-mix(in srgb, #e7f6ff calc((1 - var(--danger)) * 100%), #b9aea6)
  );
  border: 1px solid var(--line);
  box-shadow: var(--shadow);
  touch-action: none;
  user-select: none;
}
.hud {
  position: absolute;
  top: 12px;
  left: 12px;
  display: flex;
  gap: 8px;
  z-index: 3;
}
.hud .pill {
  background: rgba(255, 255, 255, 0.85);
  color: #17324d;
  font-size: 1rem;
}
.smoke {
  position: absolute;
  transform: translate(-50%, -50%);
  border: 0;
  padding: 0;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 35%, #b8aca3, #6e6259);
  box-shadow: 14px 6px 0 -6px #85796f, -14px 8px 0 -8px #85796f;
  animation: appear 0.35s ease-out, drift 3s ease-in-out infinite alternate;
  cursor: pointer;
}
.pop {
  position: absolute;
  transform: translate(-50%, -50%);
  font-family: var(--font-head);
  font-size: 1.6rem;
  font-weight: 800;
  color: #fff;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  pointer-events: none;
  animation: rise 0.5s ease-out forwards;
}
.dragon {
  position: absolute;
  bottom: 8px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 5rem;
  animation: bob 2s ease-in-out infinite;
}
.dragon.cough {
  animation: shake 0.3s linear infinite;
}
.overlay {
  position: absolute;
  inset: 0;
  z-index: 5;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 24px;
  background: color-mix(in srgb, var(--card) 88%, transparent);
  backdrop-filter: blur(4px);
}
.overlay p {
  max-width: 460px;
  color: var(--ink-soft);
}
.levels {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: center;
}
.tip {
  background: var(--bg-soft);
  padding: 10px 14px;
  border-radius: var(--radius-sm);
}
@keyframes appear {
  from {
    transform: translate(-50%, -50%) scale(0);
  }
}
@keyframes drift {
  to {
    margin-left: 12px;
    margin-top: -8px;
  }
}
@keyframes rise {
  to {
    margin-top: -40px;
    opacity: 0;
  }
}
@keyframes bob {
  50% {
    transform: translateX(-50%) translateY(-8px);
  }
}
@keyframes shake {
  25% {
    transform: translateX(calc(-50% - 4px));
  }
  75% {
    transform: translateX(calc(-50% + 4px));
  }
}
</style>
