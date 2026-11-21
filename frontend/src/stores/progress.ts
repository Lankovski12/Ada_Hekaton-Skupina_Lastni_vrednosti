// Točke in napredek v igrah – shranjeno lokalno na napravi.
import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

const KEY = 'zrak-napredek'

function load(): { tocke: number; najboljse: Record<string, number> } {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    /* ignoriraj */
  }
  return { tocke: 0, najboljse: {} }
}

export const useProgressStore = defineStore('progress', () => {
  const initial = load()
  const tocke = ref(initial.tocke)
  const najboljse = ref<Record<string, number>>(initial.najboljse)

  function addPoints(game: string, points: number) {
    tocke.value += points
    najboljse.value[game] = Math.max(najboljse.value[game] ?? 0, points)
  }

  watch([tocke, najboljse], () => {
    try {
      localStorage.setItem(KEY, JSON.stringify({ tocke: tocke.value, najboljse: najboljse.value }))
    } catch {
      /* ignoriraj */
    }
  }, { deep: true })

  return { tocke, najboljse, addPoints }
})
