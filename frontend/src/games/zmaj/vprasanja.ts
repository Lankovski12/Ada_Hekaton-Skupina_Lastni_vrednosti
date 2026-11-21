// Vprašanja in kratka dejstva v igri. Vsa dejstva so iz podatkov ARSO (ARSOhack) ali priporočil WHO.

export interface Vprasanje {
  vprasanje: string
  moznosti: string[]
  pravilen: number // indeks v moznosti
  razlaga: string
}

export interface DanZaVprasanja {
  pm25: number
  datum?: string // če igramo zgodovinski dan
  inverzija: boolean
  visinaMesanjaM?: number
}

/** Sporočila, ko zmaj ujame oblaček, veter ali leti skozi dim. */
export const DEJSTVA = {
  dez: {
    naslov: 'Dež!',
    besedilo: 'Dež spere delce iz zraka. Zato je po dežju zrak čistejši.',
  },
  veter: {
    naslov: 'Sunek vetra!',
    besedilo: 'Veter premeša zrak in razbije inverzijo. Smog odnese iz kotline.',
  },
  dim: {
    naslov: 'Dim iz dimnika!',
    besedilo: 'Dim iz dimnikov doda smog. Pozimi veliko delcev v Ljubljani prispevajo peči na drva v hišah.',
  },
} as const

const WHO = 15 // µg/m³, smernica WHO (2021) za dnevno povprečje PM2.5

function premesaj<T>(a: T[]): T[] {
  const b = [...a]
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[b[i], b[j]] = [b[j]!, b[i]!]
  }
  return b
}

/** Vprašanje z odgovori v naključnem vrstnem redu (prvi v seznamu je pravilen). */
function v(vprasanje: string, pravilen: string, napacni: string[], razlaga: string): Vprasanje {
  const moznosti = premesaj([pravilen, ...napacni])
  return { vprasanje, moznosti, pravilen: moznosti.indexOf(pravilen), razlaga }
}

/** Tri vprašanja za eno igro: prvo je vedno o dnevu, ki ga igraš. */
export function sestaviVprasanja(dan: DanZaVprasanja): Vprasanje[] {
  const pm = Math.round(dan.pm25)
  const krat = Math.max(1, Math.round(pm / WHO))
  const kdaj = dan.datum ? 'Ta dan je bilo' : 'Danes je'

  const oDnevu: Vprasanje =
    pm > WHO
      ? v(
          `${kdaj} v zraku ${pm} µg/m³ drobnih delcev. Svetovna zdravstvena organizacija priporoča največ ${WHO}. Kolikokrat preveč je to?`,
          `Približno ${krat}-krat`,
          [`Približno ${krat + 3}-krat`, krat > 2 ? 'Približno 2-krat' : 'Približno 10-krat'],
          `${pm} deljeno s ${WHO} je približno ${krat}. Toliko več delcev je bilo v zraku, kot je še zdravo.`,
        )
      : v(
          `${kdaj} v zraku ${pm} µg/m³ drobnih delcev. Je to pod priporočilom Svetovne zdravstvene organizacije (${WHO})?`,
          'Da, zrak je čist',
          ['Ne, je veliko preveč', 'Tega se ne da izmeriti'],
          `${pm} je manj kot ${WHO}, zato je zrak ta dan zdrav za igro zunaj.`,
        )

  const ostala: Vprasanje[] = [
    v(
      'Kaj iz kotline najhitreje odstrani smog?',
      'Veter in dež',
      ['Mraz in brezvetrje', 'Sonce opoldne'],
      'Veter smog odpihne, dež ga spere. Mraz in brezvetrje pa ga ujameta v kotlini.',
    ),
    v(
      'Kaj je temperaturna inverzija?',
      'Topel zrak nad hladnim, kot pokrovka',
      ['Veter, ki piha navzgor', 'Megla, ki pride z morja'],
      'Ponoči se hladen zrak ujame na dnu kotline, nad njim je toplejši. Ta pokrovka ne pusti smogu ven.',
    ),
    v(
      'Kako veliki so delci PM2.5?',
      'Približno 30-krat tanjši od lasu',
      ['Kot zrno peska', 'Kot dežna kaplja'],
      'Merijo največ 2,5 tisočinke milimetra, zato jih vdihnemo globoko v pljuča.',
    ),
    v(
      'Kdaj je pozimi v Ljubljani v zraku največ delcev?',
      'Zvečer in ponoči',
      ['Opoldne', 'Popoldne ob soncu'],
      'Meritve na Bežigradu kažejo, da je pozimi največ delcev med 22. uro in 1. uro, najmanj okoli 16. ure.',
    ),
    v(
      'Zunaj je zrak slab. Kaj je pametno?',
      'Igra v hiši in kratko zračenje',
      ['Tek zunaj čim dlje', 'Okna na široko odprta ves dan'],
      'Ko je zrak slab, se igraj notri in zrači na kratko, ko je zrak najboljši (pozimi navadno popoldne).',
    ),
    v(
      'Od kod pozimi v Ljubljani prihaja veliko delcev?',
      'Iz kurjenja, posebej z drvmi',
      ['Iz morja', 'Iz gozdov'],
      'Majhne peči in kamini na drva spustijo veliko delcev. Pomagajo sodobne peči, daljinsko ogrevanje in toplotne črpalke.',
    ),
  ]
  if (dan.datum && dan.inverzija)
    ostala.push(
      v(
        'Zakaj je ta dan smog ostal nad Ljubljano?',
        'Bila je inverzija, brez vetra',
        ['Bilo je zelo vroče', 'Ves dan je deževalo'],
        dan.visinaMesanjaM
          ? `Radiosondaža ARSO je pokazala, da se je zrak mešal le do ~${dan.visinaMesanjaM} m nad tlemi. Smog ni mogel ven.`
          : 'Pod inverzijo se zrak ne meša, zato smog ostane ujet v kotlini.',
      ),
    )
  return [oDnevu, ...premesaj(ostala).slice(0, 2)]
}
