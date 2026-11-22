<script setup lang="ts">
import { RouterLink } from 'vue-router'

// na domači strani (celozaslonska pljuča) zgornje vrstice ne prikažemo
defineProps<{ brezGlave?: boolean }>()

const links = [
  { to: '/', label: 'Domov' },
  { to: '/igre', label: 'Igre' },
  { to: '/zemljevid', label: 'Zemljevid' },
  { to: '/grafi', label: 'Podatki' },
  { to: '/moj-zrak', label: 'Moj zrak' },
]
</script>

<template>
  <header v-if="!brezGlave" class="top">
    <div class="container bar">
      <RouterLink to="/" class="logo">
        <span>Zrak, ki ga dihamo</span>
      </RouterLink>
      <nav class="desktop">
        <RouterLink v-for="l in links" :key="l.to" :to="l.to">{{ l.label }}</RouterLink>
      </nav>
    </div>
  </header>

  <!-- Spodnja navigacija na ozkem zaslonu (telefon v brskalniku) -->
  <nav class="mobile" aria-label="Glavna navigacija">
    <RouterLink v-for="l in links" :key="l.to" :to="l.to">
      <span>{{ l.label }}</span>
    </RouterLink>
  </nav>
</template>

<style scoped>
.top {
  position: sticky;
  top: 0;
  z-index: 20;
  backdrop-filter: blur(12px);
  background: color-mix(in srgb, var(--bg) 82%, transparent);
  border-bottom: 1px solid var(--line);
}
.bar {
  display: flex;
  align-items: center;
  gap: 16px;
  height: 64px;
}
.logo {
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: var(--font-head);
  font-weight: 800;
  font-size: 1.2rem;
  color: var(--ink);
  text-decoration: none;
  white-space: nowrap;
}
.desktop {
  display: flex;
  gap: 4px;
  margin-left: auto;
}
.desktop a {
  padding: 8px 14px;
  border-radius: 999px;
  color: var(--ink-soft);
  font-weight: 800;
  text-decoration: none;
  transition:
    background 0.2s,
    transform 0.2s;
}
.desktop a:hover {
  background: var(--bg-soft);
  transform: translateY(-1px);
}
.desktop a.router-link-active:not([href='/']),
.desktop a.router-link-exact-active {
  background: var(--ink);
  color: var(--bg);
}
.mobile {
  display: none;
}

@media (max-width: 720px) {
  .desktop {
    display: none;
  }
  .logo span:last-child {
    font-size: 1.05rem;
  }
  .mobile {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 30;
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    background: var(--card);
    border-top: 1px solid var(--line);
    padding: 6px 4px calc(6px + env(safe-area-inset-bottom));
  }
  .mobile a {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: 10px 0;
    font-size: 0.8rem;
    font-weight: 700;
    color: var(--ink-soft);
    text-decoration: none;
    border-radius: 12px;
  }
  .mobile a.router-link-exact-active {
    color: var(--brand);
    background: var(--bg-soft);
  }
}
</style>
