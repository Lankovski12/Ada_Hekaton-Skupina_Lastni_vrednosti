<script setup lang="ts">
// Ljubljanska kotlina z meglo (2.5D SVG).
// Kasneje jo zamenjamo s TresJS 3D sceno iz public/assets/terrain/heightmap.png –
// podatki (/api/scene) ostanejo enaki: višina megle in PM2.5 po urah.
import { computed, onBeforeUnmount, ref } from 'vue'
import type { SceneResponse } from '@/lib/types'
import { levelFor } from '@/lib/airQuality'

const props = defineProps<{ scene: SceneResponse }>()

const idx = ref(0)
const playing = ref(false)
let timer: number | undefined

const hour = computed(() => props.scene.ure[idx.value]!)
const clock = computed(() => new Date(hour.value.cas_utc).getHours())
const level = computed(() => levelFor(hour.value.pm25))

// nadmorska višina → y v SVG (dno kotline ~290 m, vrhovi ~1000 m)
const altToY = (alt: number) => 340 - (alt - 280) * 0.36
const fogY = computed(() => altToY(hour.value.visina_megle_m))
// ob inverziji gosta, ujeta plast; sicer se delci razredčijo v višino
const fogOpacity = computed(() =>
  hour.value.inverzija ? Math.min(0.85, 0.3 + hour.value.pm25 / 70) : Math.min(0.35, 0.08 + hour.value.pm25 / 150),
)

// dan/noč
const daylight = computed(() => {
  const h = clock.value
  return Math.max(0, Math.sin(((h - 6) / 13) * Math.PI))
})
const sun = computed(() => {
  const t = (clock.value - 6) / 13 // 0 vzhod, 1 zahod
  const x = 80 + t * 640
  const y = 260 - Math.sin(t * Math.PI) * 200
  return { x, y, visible: t >= 0 && t <= 1 }
})

function toggle() {
  playing.value = !playing.value
  if (playing.value) {
    timer = window.setInterval(() => {
      idx.value = (idx.value + 1) % props.scene.ure.length
    }, 700)
  } else {
    window.clearInterval(timer)
  }
}
onBeforeUnmount(() => window.clearInterval(timer))

// preprosta silhueta mesta
const buildings = Array.from({ length: 34 }, (_, i) => {
  const x = 150 + i * 15 + ((i * 7) % 5)
  const hgt = 12 + ((i * 37) % 30)
  return { x, w: 11, h: hgt }
})
const chimneys = [3, 9, 15, 22, 28].map((i) => buildings[i]!)
</script>

<template>
  <div class="kotlina">
    <svg viewBox="0 0 800 360" preserveAspectRatio="xMidYMax slice" role="img" :aria-label="`Kotlina ob ${clock}h, ${level.label}`">
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" :stop-color="`color-mix(in srgb, var(--sky-top) ${20 + daylight * 80}%, #0b1630)`" />
          <stop offset="1" :stop-color="`color-mix(in srgb, var(--sky-bottom) ${20 + daylight * 80}%, #1c2a4a)`" />
        </linearGradient>
        <linearGradient id="fog" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" :stop-color="level.color" stop-opacity="0" />
          <stop offset="0.25" :stop-color="level.color" :stop-opacity="fogOpacity * 0.6" />
          <stop offset="1" :stop-color="level.color" :stop-opacity="fogOpacity" />
        </linearGradient>
        <filter id="blur"><feGaussianBlur stdDeviation="6" /></filter>
      </defs>

      <rect width="800" height="360" fill="url(#sky)" />
      <g v-if="daylight < 0.2" class="stars" fill="#fff">
        <circle v-for="i in 30" :key="i" :cx="(i * 137) % 800" :cy="(i * 53) % 150" r="1.2" :opacity="0.4 + (i % 3) * 0.2" />
      </g>
      <circle v-if="sun.visible" :cx="sun.x" :cy="sun.y" r="22" fill="#ffd54a" class="sun" />
      <circle v-else cx="660" cy="70" r="16" fill="#f3f0d8" />

      <!-- gore -->
      <path d="M0 200 L90 110 L170 170 L260 90 L360 160 L450 120 L560 175 L650 95 L740 150 L800 120 L800 360 L0 360Z" fill="var(--mountain-far)" />
      <path d="M0 250 L70 190 L150 230 L230 180 L300 240 L520 245 L600 190 L690 225 L800 185 L800 360 L0 360Z" fill="var(--mountain-mid)" />

      <!-- mesto na dnu kotline -->
      <g fill="var(--city)">
        <rect x="0" y="330" width="800" height="30" />
        <rect v-for="(b, i) in buildings" :key="i" :x="b.x" :y="330 - b.h" :width="b.w" :height="b.h" rx="1" />
        <!-- Ljubljanski grad -->
        <path d="M380 300 l0 -22 l8 0 l0 -10 l6 0 l0 10 l14 0 l0 22z" />
      </g>
      <!-- dim iz dimnikov -->
      <g v-if="hour.inverzija" class="smoke" fill="#9a8f86">
        <circle v-for="(c, i) in chimneys" :key="i" :cx="c.x + 5" :cy="330 - c.h - 6" r="5" :style="{ animationDelay: `${i * 0.4}s` }" />
      </g>

      <!-- megla / onesnažena plast -->
      <rect class="fog" x="-20" :y="fogY - 20" width="840" :height="400 - fogY" fill="url(#fog)" filter="url(#blur)" />

      <path d="M0 300 L60 270 L120 300 L0 360Z M800 290 L730 260 L660 300 L800 360Z" fill="var(--mountain-near)" />
    </svg>

    <div class="hud">
      <span class="pill">{{ String(clock).padStart(2, '0') }}:00</span>
      <span class="pill" v-if="hour.inverzija">🌫️ inverzija – zrak je ujet</span>
      <span class="pill" v-else>🌬️ zrak se meša</span>
      <span class="pill" :style="{ background: level.color, color: '#fff' }">{{ hour.pm25 }} µg/m³</span>
    </div>

    <div class="controls">
      <button class="btn" @click="toggle" :aria-pressed="playing">{{ playing ? '⏸ Ustavi' : '▶ Predvajaj dan' }}</button>
      <input v-model.number="idx" type="range" min="0" :max="scene.ure.length - 1" aria-label="Ura" />
    </div>
  </div>
</template>

<style scoped>
.kotlina {
  position: relative;
  border-radius: var(--radius);
  overflow: hidden;
  border: 1px solid var(--line);
  box-shadow: var(--shadow);
  background: var(--card);
}
svg {
  display: block;
  width: 100%;
  height: clamp(240px, 45vw, 420px);
}
.fog {
  transition: y 0.7s ease, height 0.7s ease;
}
.sun {
  transition: cx 0.7s ease, cy 0.7s ease;
}
.smoke circle {
  animation: puff 2.4s ease-out infinite;
  transform-box: fill-box;
  transform-origin: center;
}
@keyframes puff {
  from {
    transform: translateY(0) scale(0.6);
    opacity: 0.7;
  }
  to {
    transform: translateY(-30px) scale(2.2);
    opacity: 0;
  }
}
.hud {
  position: absolute;
  top: 12px;
  left: 12px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.hud .pill {
  background: color-mix(in srgb, var(--card) 85%, transparent);
  color: var(--ink);
}
.controls {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 14px 16px;
}
.controls .btn {
  flex: none;
}
</style>
