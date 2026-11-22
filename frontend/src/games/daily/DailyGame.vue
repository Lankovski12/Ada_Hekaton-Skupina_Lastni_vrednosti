<script setup lang="ts">
// Dnevna igra: ugani jutrišnji zrak. Odgovor shranimo lokalno, rezultat pride jutri iz /api/daily-game.
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useAirData } from '@/composables/useAirData'
import { useProgressStore } from '@/stores/progress'

const { daily } = useAirData()
const progress = useProgressStore()

const KEY = 'zrak-daily-odgovori'
function loadAnswers(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}')
  } catch {
    return {}
  }
}
const answers = ref<Record<string, string>>(loadAnswers())
const today = computed(() => daily.value?.datum ?? '')
const myAnswer = computed(() => answers.value[today.value])

function choose(o: string) {
  if (myAnswer.value) return
  answers.value = { ...answers.value, [today.value]: o }
  try {
    localStorage.setItem(KEY, JSON.stringify(answers.value))
  } catch {
    /* ignoriraj */
  }
  progress.addPoints('daily', 1)
}
</script>

<template>
  <section class="container page">
    <RouterLink to="/otroci" class="back">← Igre</RouterLink>
    <div class="card game" v-if="daily">
      <span class="pill">{{ daily.datum }}</span>
      <h1>🔮 {{ daily.vprasanje }}</h1>
      <div class="opts">
        <button
          v-for="o in daily.moznosti"
          :key="o"
          class="opt"
          :class="{ chosen: myAnswer === o, dim: myAnswer && myAnswer !== o }"
          @click="choose(o)"
        >
          {{ o }}
        </button>
      </div>
      <p v-if="myAnswer" class="done">Shranjeno! Vrni se jutri in poglej, ali si uganil. ⭐ +1</p>

      <div v-if="daily.vceraj" class="yesterday">
        <h3>Včeraj</h3>
        <p>{{ daily.vceraj.vprasanje }} → <strong>{{ daily.vceraj.pravilen_odgovor }}</strong></p>
      </div>
    </div>
  </section>
</template>

<style scoped>
.page {
  padding-top: 20px;
  max-width: 760px;
}
.back {
  display: inline-block;
  margin-bottom: 10px;
  font-weight: 700;
  text-decoration: none;
}
h1 {
  font-size: clamp(1.6rem, 4vw, 2.4rem);
  margin-top: 12px;
}
.opts {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 12px;
  margin: 20px 0;
}
.opt {
  min-height: 72px;
  border-radius: var(--radius);
  border: 3px solid var(--line);
  background: var(--bg);
  color: var(--ink);
  font-family: var(--font-head);
  font-size: 1.4rem;
  font-weight: 800;
  transition: transform 0.15s, border-color 0.15s;
}
.opt:hover {
  transform: translateY(-3px);
  border-color: var(--brand);
}
.opt.chosen {
  background: var(--brand);
  border-color: var(--brand);
  color: #fff;
  transform: scale(1.04);
}
.opt.dim {
  opacity: 0.45;
}
.done {
  font-weight: 700;
  color: var(--aq-1);
}
.yesterday {
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px dashed var(--line);
}
.yesterday p {
  color: var(--ink-soft);
}
</style>
