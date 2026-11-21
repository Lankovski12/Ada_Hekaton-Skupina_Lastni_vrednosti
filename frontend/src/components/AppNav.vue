<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { useProgressStore } from '@/stores/progress'

const progress = useProgressStore()

const links = [
  { to: '/', label: 'Domov', icon: '🏠' },
  { to: '/otroci', label: 'Otroci', icon: '🎮' },
  { to: '/starsi', label: 'Starši', icon: '📈' },
  { to: '/nastavitve', label: 'Profil', icon: '⚙️' },
]
</script>

<template>
  <header class="top">
    <div class="container bar">
      <RouterLink to="/" class="logo">
        <span class="logo-dot" aria-hidden="true">☁️</span>
        <span>Zrak, ki ga dihamo</span>
      </RouterLink>
      <nav class="desktop">
        <RouterLink v-for="l in links" :key="l.to" :to="l.to">{{ l.label }}</RouterLink>
      </nav>
      <span class="points" title="Tvoje točke iz iger">⭐ {{ progress.tocke }}</span>
    </div>
  </header>

  <!-- Spodnja navigacija za telefon (Capacitor) -->
  <nav class="mobile" aria-label="Glavna navigacija">
    <RouterLink v-for="l in links" :key="l.to" :to="l.to">
      <span class="ico" aria-hidden="true">{{ l.icon }}</span>
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
  background: color-mix(in srgb, var(--bg) 80%, transparent);
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
.logo-dot {
  font-size: 1.5rem;
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
  font-weight: 700;
  text-decoration: none;
}
.desktop a.router-link-exact-active {
  background: var(--bg-soft);
  color: var(--ink);
}
.points {
  font-weight: 800;
  background: var(--bg-soft);
  border-radius: 999px;
  padding: 6px 12px;
  white-space: nowrap;
}
.mobile {
  display: none;
}

@media (max-width: 720px) {
  .desktop {
    display: none;
  }
  .points {
    margin-left: auto;
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
    grid-template-columns: repeat(4, 1fr);
    background: var(--card);
    border-top: 1px solid var(--line);
    padding: 6px 4px calc(6px + env(safe-area-inset-bottom));
  }
  .mobile a {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: 6px 0;
    font-size: 0.75rem;
    font-weight: 700;
    color: var(--ink-soft);
    text-decoration: none;
    border-radius: 12px;
  }
  .mobile a.router-link-exact-active {
    color: var(--brand);
    background: var(--bg-soft);
  }
  .ico {
    font-size: 1.4rem;
  }
}
</style>
