<script setup lang="ts">
// Konec drseče zgodbe: kratko besedilo in velik gumb na naslednji zavihek.
import { RouterLink } from 'vue-router'

withDefaults(
  defineProps<{
    to: string
    label: string // napis na gumbu, npr. »Blogi«
    kicker?: string
    title: string
    text?: string
    color?: string
  }>(),
  { color: '#5aa2ff' },
)
</script>

<template>
  <section class="next" :style="{ '--lvl': color }">
    <span v-if="kicker" class="kicker">{{ kicker }}</span>
    <h2>{{ title }}</h2>
    <p v-if="text">{{ text }}</p>
    <RouterLink :to="to" class="btn go">{{ label }} <span aria-hidden="true">→</span></RouterLink>
  </section>
</template>

<style scoped>
.next {
  min-height: 70svh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 80px 24px;
  background: radial-gradient(ellipse at 50% 60%, color-mix(in srgb, var(--lvl) 16%, transparent), transparent 65%);
}
.next p {
  max-width: 520px;
}
.go {
  margin-top: 28px;
  font-size: 1.25rem;
  padding: 18px 34px;
  min-height: 60px;
  --btn: var(--lvl);
  color: #10192e;
  animation: bob 2.6s ease-in-out infinite;
}
@keyframes bob {
  50% {
    transform: translateY(-4px) rotate(-1.5deg);
  }
}
</style>
