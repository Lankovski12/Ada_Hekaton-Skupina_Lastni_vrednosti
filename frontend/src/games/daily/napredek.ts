// Napredek v Vremenskem vedeževalcu – samo na napravi (localStorage).
import { reactive, watch } from 'vue'

interface Napredek {
  odgovori: Record<string, number> // datum vprašanja -> zvezdice (samo dnevna vprašanja, ne vaja)
  niz: number // zaporedni dnevi
  zadnjiDan: string | null // lokalni datum, ko je bil igralec zadnjič tu
  zvezdiceVaja: number
}

const KEY = 'zrak-vedezevalec'

function load(): Napredek {
  const def: Napredek = { odgovori: {}, niz: 0, zadnjiDan: null, zvezdiceVaja: 0 }
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? { ...def, ...JSON.parse(raw) } : def
  } catch {
    return def
  }
}

export const napredek = reactive<Napredek>(load())

watch(
  napredek,
  (n) => {
    try {
      localStorage.setItem(KEY, JSON.stringify(n))
    } catch {
      /* ignoriraj */
    }
  },
  { deep: true },
)

const danes = () => new Date().toLocaleDateString('sv-SE') // YYYY-MM-DD lokalno

/** Zabeleži dnevni odgovor in posodobi niz zaporednih dni. */
export function zabeleziDnevno(datumVprasanja: string, zvezdice: number) {
  if (napredek.odgovori[datumVprasanja] != null) return
  napredek.odgovori[datumVprasanja] = zvezdice
  const d = danes()
  const vceraj = new Date(Date.now() - 86_400_000).toLocaleDateString('sv-SE')
  napredek.niz = napredek.zadnjiDan === vceraj ? napredek.niz + 1 : napredek.zadnjiDan === d ? napredek.niz : 1
  napredek.zadnjiDan = d
}

export function skupajZvezdic(): number {
  return Object.values(napredek.odgovori).reduce((a, b) => a + b, 0) + napredek.zvezdiceVaja
}
