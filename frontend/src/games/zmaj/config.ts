// Nastavitve igre »Zmajček čisti nebo« na enem mestu – tu jih spreminjata.

export const GAME = {
  trajanje: 90, // sekund
  hitrost: 250, // m/s (zmaj leti sam naprej)
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

/** Oblaček Kapljica: ko zletiš skozenj, na tistem območju nekaj sekund dežuje. */
export const DEZ = {
  oblackov: 3, // koliko jih je hkrati na nebu
  trajanje: 6, // s dežja
  polmer: 1100, // m – območje dežja
  moc: 0.13, // delež smoga na sekundo, ki ga dež spere na območju (v 6 s ~ polovica, ne vse)
  bonus: 0.08, // + 8 % čistega neba (najbližji smog nad mestom, razdeljeno čez čas dežja)
  ponovno: 8, // s, preden se oblaček pojavi drugje
}

/** Sunek vetra: obroč, skozi katerega zletiš, za nekaj sekund pospeši zmaja in razširi piš. */
export const VETER = {
  obrocev: 4,
  trajanje: 5, // s
  hitrost: 1.6, // krat hitreje
  pih: 1.5, // krat širši piš
}

/** Dimnik: če letiš skozi dim, se smog okoli zgosti. */
export const DIM = {
  dimnikov: 5,
  polmer: 700, // m
  kolicina: 0.35, // koliko smoga doda okoli dimnika
  kazen: 0.05, // - 5 % čistega neba
  visina: 130, // m – višina modela dimnika (v igri še povečano z vex), da je od daleč viden
}

/** Vprašanja: lebdeči krogi z vprašajem. Pravilen odgovor = več časa in sunek vetra. */
export const VPRASANJA = {
  kdaj: [12, 40, 68], // sekunde igre, ko se pojavi vprašanje
  zivi: 14, // s, preden izgine, če ga ne ujameš
  bonusCas: 5, // s za pravilen odgovor
}

/** 3D stavbe iz katastra GURS (pripravi backend/scripts/build_game_assets.py). */
export const STAVBE = {
  vklopljene: true,
  najvec: 45000, // na računalniku (od centra navzven)
  najvecTelefon: 12000,
  visinaKrat: 0.75, // višina stavb glede na teren (1 = enako povečano kot hribi)
}

export const SVET = {
  vex: 2.4, // navpična povečava terena, da se hribi lepše vidijo
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
