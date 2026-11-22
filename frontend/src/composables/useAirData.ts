// En vir podatkov o zraku za vse: prikaze za starše, 3D sceno in igre.
import { computed, ref } from 'vue'
import { getJson, type DataOrigin } from '@/api/client'
import { mockForecast, mockNow, mockScene } from '@/api/mock'
import type { ForecastResponse, NowResponse, SceneResponse } from '@/lib/types'

// Stanje je deljeno med vsemi komponentami (modul se naloži enkrat).
const now = ref<NowResponse | null>(null)
const forecast = ref<ForecastResponse | null>(null)
const scene = ref<SceneResponse | null>(null)
const origin = ref<DataOrigin>('arhiv ARSO')
const loading = ref(false)
let loadedAt = 0

// Privzeta lokacija: center Ljubljane
const DEFAULT = { lat: 46.0511, lon: 14.5051 }

export function useAirData() {
  async function refresh(loc = DEFAULT, force = false) {
    if (!force && Date.now() - loadedAt < 5 * 60_000 && now.value) return
    loading.value = true
    const q = `lat=${loc.lat}&lon=${loc.lon}`
    const [n, f, s] = await Promise.all([
      getJson(`/api/now?${q}`, mockNow),
      getJson(`/api/forecast?${q}&h=48`, () => mockForecast(48)),
      getJson('/api/scene', mockScene),
    ])
    now.value = n.data
    forecast.value = f.data
    scene.value = s.data
    origin.value = n.origin
    loadedAt = Date.now()
    loading.value = false
  }

  /** Povprečje najbližjih postaj – ena številka za otroke. */
  const currentPm25 = computed(() => {
    const vals = (now.value?.postaje ?? []).map((p) => p.pm25).filter((v): v is number => v != null)
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null
  })

  return { now, forecast, scene, origin, loading, currentPm25, refresh }
}
