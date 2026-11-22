<script setup lang="ts">
// Konfeti: barvni koščki padajo čez cel zaslon in med padanjem izginejo.
// Po koncu animacije se komponenta sama skrije, zato na strani ne ostanejo koščki. Ponovno sproži z drugim :key.
import { onBeforeUnmount, ref } from 'vue'

const COLORS = ['#ffc22e', '#ff6fa5', '#4fc3f7', '#4cd964', '#a66bff', '#ff8a3d']
const pieces = Array.from({ length: 70 }, (_, i) => ({
  left: Math.random() * 100,
  delay: Math.random() * 0.4,
  dur: 1.6 + Math.random() * 1.2,
  rot: Math.random() * 360,
  color: COLORS[i % COLORS.length],
  w: 6 + Math.random() * 8,
  round: Math.random() < 0.3,
}))

const visible = ref(true)
const timer = window.setTimeout(() => (visible.value = false), 3400) // najdaljša animacija: 0,4 s + 2,8 s
onBeforeUnmount(() => window.clearTimeout(timer))
</script>

<template>
  <div v-if="visible" class="confetti" aria-hidden="true">
    <i
      v-for="(p, i) in pieces"
      :key="i"
      :style="{
        left: `${p.left}%`,
        width: `${p.w}px`,
        height: `${p.round ? p.w : p.w * 0.45}px`,
        background: p.color,
        borderRadius: p.round ? '50%' : '2px',
        animationDelay: `${p.delay}s`,
        animationDuration: `${p.dur}s`,
        '--rot': `${p.rot}deg`,
      }"
    />
  </div>
</template>

<style scoped>
.confetti {
  position: fixed; /* čez viden zaslon, ne čez celo (dolgo) stran */
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  z-index: 100;
}
i {
  position: absolute;
  top: -20px;
  animation: fall linear forwards;
}
@keyframes fall {
  0% {
    transform: translateY(0) rotate(0);
    opacity: 1;
  }
  75% {
    opacity: 1;
  }
  100% {
    transform: translateY(105vh) rotate(calc(var(--rot) + 720deg));
    opacity: 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  .confetti {
    display: none;
  }
}
</style>
