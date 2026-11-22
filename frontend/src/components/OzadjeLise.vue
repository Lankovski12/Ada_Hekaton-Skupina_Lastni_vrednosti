<script setup lang="ts">
// Igrivo ozadje: nekaj mehkih barvnih lis, ki počasi plavajo (kot oblaki ali delci v zraku).
// Ležijo za vsebino in ne lovijo klikov.
</script>

<template>
  <div class="lise" aria-hidden="true">
    <span class="l a" />
    <span class="l b" />
    <span class="l c" />
    <span class="l d" />
  </div>
</template>

<style scoped>
.lise {
  position: fixed;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  pointer-events: none;
}
.l {
  position: absolute;
  border-radius: 46% 54% 58% 42% / 52% 44% 56% 48%;
  filter: blur(40px);
  opacity: 0.55;
  animation: plavaj 26s ease-in-out infinite alternate;
}
.a {
  width: 42vmax;
  height: 38vmax;
  left: -12vmax;
  top: -10vmax;
  background: color-mix(in srgb, var(--accent) 55%, transparent);
}
.b {
  width: 36vmax;
  height: 34vmax;
  right: -10vmax;
  top: 18vh;
  background: color-mix(in srgb, var(--brand) 32%, transparent);
  animation-duration: 31s;
  animation-delay: -8s;
}
.c {
  width: 30vmax;
  height: 30vmax;
  left: 20vw;
  bottom: -14vmax;
  background: color-mix(in srgb, var(--mint) 38%, transparent);
  animation-duration: 35s;
  animation-delay: -15s;
}
.d {
  width: 22vmax;
  height: 20vmax;
  right: 18vw;
  bottom: 8vh;
  background: color-mix(in srgb, var(--coral) 28%, transparent);
  animation-duration: 29s;
  animation-delay: -4s;
}
@keyframes plavaj {
  50% {
    transform: translate(4vmax, 3vmax) rotate(25deg) scale(1.08);
  }
  100% {
    transform: translate(-3vmax, 5vmax) rotate(-15deg) scale(0.95);
  }
}
:root[data-theme='dark'] .l {
  opacity: 0.18;
}
</style>
