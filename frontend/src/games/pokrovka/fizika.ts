// Višina pokrovke iz dveh temperatur – isto pravilo kot backend/app/pokrovka.py.
// Zrak iz doline se dviga in ohlaja za 9,8 °C/km. Ustavi se, ko je okolica za 1 °C toplejša od njega.
// Preverjeno na 1.127 zimskih dneh: korelacija z radiosondažo ARSO 0,82 (scripts/build_pokrovka_archive.py).

export const HRIB_M = 720 // Pasja ravan (1019 m) je 720 m nad dnom kotline (299 m)
export const NAJVEC = 1500
const SUHI = 0.0098
const NAD_HRIBOM = -0.0065

export function temperatura(z: number, tDolina: number, tHrib: number): number {
  if (z <= HRIB_M) return tDolina + ((tHrib - tDolina) * z) / HRIB_M
  return tHrib + NAD_HRIBOM * (z - HRIB_M)
}

export function visinaPokrovke(tDolina: number, tHrib: number): number {
  for (let z = 5; z < NAJVEC; z += 5) {
    if (temperatura(z, tDolina, tHrib) + SUHI * z >= tDolina + 1) return z
  }
  return NAJVEC
}

/** Zvezdice za bližino (razmerje višin). */
export function zvezdiceZa(ugib: number, cilj: number): number {
  const r = Math.abs(Math.log(Math.max(5, ugib) / Math.max(5, cilj)))
  return r <= Math.log(1.2) ? 3 : r <= Math.log(1.6) ? 2 : r <= Math.log(2.5) ? 1 : 0
}
