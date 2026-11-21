<script setup lang="ts">
// Oblaček – maskota. Oči sledijo prstu/miški, usta in barva se spreminjajo s kakovostjo zraka.
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

const props = withDefaults(defineProps<{ mood?: number; color?: string; size?: number }>(), {
  mood: 0,
  color: 'var(--aq-1)',
  size: 220,
})

const root = ref<SVGSVGElement | null>(null)
const look = ref({ x: 0, y: 0 })
const bounce = ref(false)

function onPointer(e: PointerEvent) {
  const el = root.value
  if (!el) return
  const r = el.getBoundingClientRect()
  const dx = e.clientX - (r.left + r.width / 2)
  const dy = e.clientY - (r.top + r.height / 2)
  const len = Math.hypot(dx, dy) || 1
  const k = Math.min(1, len / 300)
  look.value = { x: (dx / len) * 6 * k, y: (dy / len) * 5 * k }
}

onMounted(() => window.addEventListener('pointermove', onPointer))
onBeforeUnmount(() => window.removeEventListener('pointermove', onPointer))

// usta: od nasmeha (mood 0) do namrščenosti (mood 1)
const mouth = computed(() => {
  const curve = 18 - props.mood * 34
  return `M 88 128 Q 110 ${128 + curve} 132 128`
})
const cheeks = computed(() => (props.mood < 0.5 ? 0.6 : 0))
const sweat = computed(() => props.mood > 0.6)

function poke() {
  bounce.value = false
  requestAnimationFrame(() => (bounce.value = true))
}
</script>

<template>
  <svg
    ref="root"
    class="buddy"
    :class="{ bounce, sad: mood > 0.6 }"
    :width="size"
    :height="size * 0.8"
    viewBox="0 0 220 176"
    role="img"
    aria-label="Oblaček, maskota kakovosti zraka"
    @pointerdown="poke"
    @animationend="bounce = false"
  >
    <g class="body">
      <path
        d="M52 150 C 18 150 10 108 40 96 C 34 58 78 40 100 62 C 116 26 176 34 172 82 C 206 84 210 150 168 150 Z"
        :fill="color"
        stroke="rgba(0,0,0,.12)"
        stroke-width="3"
      />
      <!-- oči -->
      <g :transform="`translate(${look.x} ${look.y})`">
        <circle cx="86" cy="100" r="11" fill="#fff" />
        <circle cx="134" cy="100" r="11" fill="#fff" />
        <circle :cx="86 + look.x * 0.4" :cy="100 + look.y * 0.4" r="5.5" fill="#17324d" />
        <circle :cx="134 + look.x * 0.4" :cy="100 + look.y * 0.4" r="5.5" fill="#17324d" />
      </g>
      <circle cx="70" cy="122" r="8" fill="#ff8fa3" :opacity="cheeks" />
      <circle cx="150" cy="122" r="8" fill="#ff8fa3" :opacity="cheeks" />
      <path :d="mouth" stroke="#17324d" stroke-width="5" fill="none" stroke-linecap="round" />
      <path v-if="sweat" class="drop" d="M170 70 q 6 10 0 14 q -6 -4 0 -14z" fill="#7cc4ff" />
    </g>
  </svg>
</template>

<style scoped>
.buddy {
  cursor: pointer;
  user-select: none;
  touch-action: manipulation;
  filter: drop-shadow(0 12px 18px rgba(0, 0, 0, 0.15));
}
.body {
  transform-origin: 110px 150px;
  animation: float 4s ease-in-out infinite;
}
.body path:first-child {
  transition: fill 0.6s ease;
}
.sad .body {
  animation: float 4s ease-in-out infinite, cough 2.6s ease-in-out infinite;
}
.bounce .body {
  animation: squish 0.45s ease;
}
.drop {
  animation: drip 1.6s ease-in infinite;
}
@keyframes float {
  50% {
    transform: translateY(-6px);
  }
}
@keyframes squish {
  30% {
    transform: scale(1.12, 0.88);
  }
  60% {
    transform: scale(0.94, 1.08);
  }
}
@keyframes cough {
  0%, 80%, 100% {
    transform: rotate(0);
  }
  85% {
    transform: rotate(-3deg) translateY(2px);
  }
  90% {
    transform: rotate(3deg);
  }
}
@keyframes drip {
  from {
    transform: translateY(0);
    opacity: 1;
  }
  to {
    transform: translateY(16px);
    opacity: 0;
  }
}
</style>
