<script setup lang="ts">
// Konfeti: barvni koščki padajo z vrha. Ponovno sproži z drugim :key.
const COLORS = ['#ffc22e', '#ff6fa5', '#4fc3f7', '#4cd964', '#a66bff', '#ff8a3d']
const pieces = Array.from({ length: 70 }, (_, i) => ({
  left: Math.random() * 100,
  delay: Math.random() * 0.4,
  dur: 1.6 + Math.random() * 1.4,
  rot: Math.random() * 360,
  color: COLORS[i % COLORS.length],
  w: 6 + Math.random() * 8,
  round: Math.random() < 0.3,
}))
</script>

<template>
  <div class="confetti" aria-hidden="true">
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
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  z-index: 20;
}
i {
  position: absolute;
  top: -20px;
  animation: fall linear forwards;
}
@keyframes fall {
  to {
    transform: translateY(110vh) rotate(calc(var(--rot) + 720deg));
    opacity: 0.6;
  }
}
</style>
