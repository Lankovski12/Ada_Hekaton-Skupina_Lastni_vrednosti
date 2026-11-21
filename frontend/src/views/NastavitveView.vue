<script setup lang="ts">
import { useProfile } from '@/composables/useProfile'

const { profile } = useProfile()

const interesi = ['nogomet', 'kolesarjenje', 'sprehodi', 'igrišče', 'tek']

function toggleInteres(i: string) {
  const idx = profile.interesi.indexOf(i)
  if (idx >= 0) profile.interesi.splice(idx, 1)
  else profile.interesi.push(i)
}
</script>

<template>
  <section class="container page">
    <h1>Profil</h1>
    <p class="sub">Vse nastavitve ostanejo samo na tej napravi. Strežnik ne ve, kdo si.</p>

    <div class="card form">
      <label class="field">
        <span>Ime (neobvezno)</span>
        <input v-model="profile.ime" type="text" placeholder="npr. Maja" />
      </label>

      <label class="switch">
        <input v-model="profile.astma" type="checkbox" />
        <span class="track" aria-hidden="true"><span class="knob" /></span>
        <span>
          <strong>Astma ali občutljiva pljuča</strong><br />
          <small>Opozorila dobiš prej (strožje meje).</small>
        </span>
      </label>

      <label class="switch">
        <input v-model="profile.obvestila" type="checkbox" />
        <span class="track" aria-hidden="true"><span class="knob" /></span>
        <span>
          <strong>Obvestila</strong><br />
          <small>Na telefonu prek Capacitor Local Notifications (pride kasneje).</small>
        </span>
      </label>

      <label class="switch">
        <input
          type="checkbox"
          :checked="profile.tema === 'temna'"
          @change="profile.tema = ($event.target as HTMLInputElement).checked ? 'temna' : 'svetla'"
        />
        <span class="track" aria-hidden="true"><span class="knob" /></span>
        <span>
          <strong>Temna tema</strong><br />
          <small>Za večerno branje. Privzeta je svetla.</small>
        </span>
      </label>

      <div class="field">
        <span>Kaj rad počneš zunaj?</span>
        <div class="chips">
          <button
            v-for="i in interesi"
            :key="i"
            type="button"
            class="chip"
            :class="{ on: profile.interesi.includes(i) }"
            @click="toggleInteres(i)"
          >
            {{ i }}
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.page {
  padding-top: 32px;
  max-width: 720px;
}
h1 {
  font-size: clamp(2rem, 5vw, 3rem);
}
.sub {
  color: var(--ink-soft);
}
.form {
  display: grid;
  gap: 22px;
}
.field {
  display: grid;
  gap: 6px;
  font-weight: 700;
}
input[type='text'] {
  font: inherit;
  padding: 12px 14px;
  border-radius: var(--radius-sm);
  border: 2px solid var(--line);
  background: var(--bg);
  color: var(--ink);
}
.switch {
  display: flex;
  align-items: center;
  gap: 14px;
  cursor: pointer;
}
.switch small {
  color: var(--ink-soft);
}
.switch input {
  position: absolute;
  opacity: 0;
}
.track {
  flex: none;
  width: 56px;
  height: 32px;
  border-radius: 999px;
  background: var(--line);
  position: relative;
  transition: background 0.2s;
}
.knob {
  position: absolute;
  top: 4px;
  left: 4px;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #fff;
  transition: transform 0.2s;
}
.switch input:checked + .track {
  background: var(--aq-1);
}
.switch input:checked + .track .knob {
  transform: translateX(24px);
}
.switch input:focus-visible + .track {
  outline: 3px solid var(--brand);
}
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.chip {
  border: 2px solid var(--line);
  background: var(--bg);
  color: var(--ink);
  border-radius: 999px;
  padding: 10px 16px;
  font-weight: 700;
}
.chip.on {
  background: var(--brand);
  border-color: var(--brand);
  color: #fff;
}
</style>
