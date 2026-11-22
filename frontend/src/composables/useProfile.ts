// Profil ostane SAMO na napravi (localStorage).
// Strežnik nikoli ne izve, kdo ima astmo – pragove izračunamo tukaj.
import { computed, reactive, watch } from 'vue'

export interface Profile {
  astma: boolean
  lokacija: { ime: string; lat: number; lon: number } | null
}

const KEY = 'zrak-profil'

function load(): Profile {
  const def: Profile = { astma: false, lokacija: null }
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? { ...def, ...JSON.parse(raw) } : def
  } catch {
    return def
  }
}

const profile = reactive<Profile>(load())

watch(
  profile,
  (p) => {
    try {
      localStorage.setItem(KEY, JSON.stringify(p))
    } catch {
      /* ignoriraj */
    }
  },
  { deep: true },
)

export function useProfile() {
  /** Astmatiki dobijo strožje meje (opozorilo prej). */
  const sensitivity = computed(() => (profile.astma ? 0.7 : 1))
  return { profile, sensitivity }
}
