// Niz zaporednih dni, ko se je otrok vrnil k igri – samo na napravi (localStorage).
// Niz se šteje, dokler igraš vsak dan; če dan izpustiš, se začne znova pri 1.

interface Niz {
  niz: number
  zadnjiDan: string | null // lokalni datum YYYY-MM-DD
}

const danes = () => new Date().toLocaleDateString('sv-SE')
const vceraj = () => new Date(Date.now() - 86_400_000).toLocaleDateString('sv-SE')

function preberi(kljuc: string): Niz {
  try {
    return { niz: 0, zadnjiDan: null, ...JSON.parse(localStorage.getItem(`zrak-niz-${kljuc}`) ?? '{}') }
  } catch {
    return { niz: 0, zadnjiDan: null }
  }
}

/** Zabeleži, da je bila igra danes odigrana. */
export function zabeleziDan(kljuc: string) {
  const n = preberi(kljuc)
  const d = danes()
  if (n.zadnjiDan === d) return
  const nov: Niz = { niz: n.zadnjiDan === vceraj() ? n.niz + 1 : 1, zadnjiDan: d }
  try {
    localStorage.setItem(`zrak-niz-${kljuc}`, JSON.stringify(nov))
  } catch {
    /* brez shranjevanja */
  }
}

/** Trenutni niz: velja, če je bila igra odigrana danes ali včeraj, sicer 0. */
export function trenutniNiz(niz: number, zadnjiDan: string | null): number {
  return zadnjiDan === danes() || zadnjiDan === vceraj() ? niz : 0
}

export function nizIgre(kljuc: string): number {
  const n = preberi(kljuc)
  return trenutniNiz(n.niz, n.zadnjiDan)
}

/** »1 dan«, »2 dneva«, »3 dnevi«, »5 dni« zapored */
export function dniZapored(n: number): string {
  const m = n % 100
  const beseda = m === 1 ? 'dan' : m === 2 ? 'dneva' : m === 3 || m === 4 ? 'dnevi' : 'dni'
  return `${n} ${beseda} zapored`
}
