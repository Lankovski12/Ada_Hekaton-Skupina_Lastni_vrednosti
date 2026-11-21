// Nastavitve igre »Zmajček čisti nebo« na enem mestu – tu jih spreminjata.

export const GAME = {
  trajanje: 90, // sekund
  hitrost: 190, // m/s (zmaj leti sam naprej)
  zavijanje: 1.25, // rad/s pri miški ob robu zaslona
  vzpon: 0.55, // največji nagib gor/dol (rad)
  minNadTerenom: 20, // m – zmaj lahko zleti nizko v smog
  strop: 1300, // m n. v.
  rob: 900, // m od roba karte, kjer zmaja obrne nazaj
}

export const PIH = {
  doseg: 1900, // m
  kot: 0.7, // polovica stožca (rad)
  sirina: 350, // m – širina piša tik pred gobcem
  moc: 3, // koliko smoga na sekundo odpiha v središču stožca
}

export const SVET = {
  vex: 1.8, // navpična povečava terena, da se hribi lepše vidijo
  h0: 250, // m n. v., ki je y = 0
  dnoKotline: 290, // m n. v.
}

/** Kako hitro se smog vrača: več PM2.5 = hitreje (delež na sekundo). */
export function regeneracija(pm25: number): number {
  return 0.003 + Math.min(pm25, 120) * 0.00012 // pri 70 µg/m³ se očiščen del vrne v ~1,5 min
}

/** Pod to vrednostjo PM2.5 je danes premalo smoga za igro – igra vzame resničen slab dan iz zgodovine ARSO. */
export const LEP_DAN_PM25 = 30

/** Vrh plasti v igri (m n. v.): dovolj debela, da zmaj leti skozi, a hribi gledajo ven. */
export function vrhZaIgro(vrhM: number): number {
  return Math.min(650, Math.max(440, vrhM))
}

/** Kako gost je smog danes (0–1) glede na PM2.5. */
export function gostotaDanes(pm25: number): number {
  return Math.min(1, Math.max(0.12, pm25 / 45))
}
