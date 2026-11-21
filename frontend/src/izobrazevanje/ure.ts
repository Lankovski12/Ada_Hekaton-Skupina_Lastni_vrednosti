// Pripravljene ure za učitelje in predavatelje. Vsaka je posvečena eni stvari in ima izdelek na koncu.
// Številke so iz paketa ARSOhack (meritve ARSO) ali iz priporočil WHO in EU; vir je naveden pri vsakem dejstvu.

export interface Korak {
  cas: string // npr. '0–5 min'
  naslov: string
  opis: string
}

export interface Izdelek {
  ime: string
  opis: string
  merila: string[] // po čem vemo, da je izdelek dober
}

export interface Ura {
  id: string
  zaKoga: string
  starost: string
  trajanje: string
  barva: string // CSS barva iz main.css
  naslov: string
  kratko: string
  cilji: string[]
  potrebujete: string[]
  potek: Korak[]
  poskus?: { naslov: string; koraki: string[]; kajVidimo: string }
  izdelki: Izdelek[]
  vAplikaciji: { to: string; ime: string; zakaj: string }[]
  razprava: string[]
  dejstva: { besedilo: string; vir: string }[]
}

export const URE: Ura[] = [
  {
    id: 'pokrovka',
    zaKoga: 'Za otroke',
    starost: '3.–5. razred (8–11 let)',
    trajanje: '45 minut',
    barva: 'var(--accent)',
    naslov: 'Pokrovka v kozarcu',
    kratko: 'S toplo in hladno vodo pokažemo, zakaj se smog pozimi ujame nad Ljubljano. Otroci naredijo svojo »pokrovko«.',
    cilji: [
      'Učenec razloži, da je topel zrak lažji in se dviga, hladen pa je težji in se uleže na dno.',
      'Učenec opiše inverzijo kot »pokrovko«: topel zrak nad hladnim, ki ne pusti dimu ven.',
      'Učenec pove, kaj pokrovko odpre (veter, sprememba vremena) in kaj lahko naredimo ljudje (manj dima).',
    ],
    potrebujete: [
      'dva enaka prozorna kozarca ali vazi in večjo prozorno posodo',
      'toplo in hladno vodo (iz pipe, ne vrelo)',
      'jedilno barvo: rdečo in modro',
      'žlico, kapalko ali slamico',
      'računalnik ali tablico za igro Naredi pokrovko (v tej aplikaciji)',
    ],
    potek: [
      { cas: '0–5 min', naslov: 'Uganka', opis: 'Vprašajte: »Zakaj je pozimi v Ljubljani zjutraj megla in smog, na Šmarni gori pa sonce?« Zberite ugibanja na tabli.' },
      { cas: '5–20 min', naslov: 'Poskus: pokrovka v kozarcu', opis: 'Izvedite poskus (spodaj). Otroci napovedo, kaj se bo zgodilo, preden vlijete barvo.' },
      { cas: '20–30 min', naslov: 'Od kozarca do kotline', opis: 'Skupaj odprite igro Naredi pokrovko in poglejte zgodbo o inverziji. Pokažite, da je modra (hladna) plast spodaj kot v kozarcu.' },
      { cas: '30–40 min', naslov: 'Igra v parih', opis: 'Pari rešijo prvi dve stopnji igre. Kdo najde pravo temperaturo na hribu?' },
      { cas: '40–45 min', naslov: 'Kdo odpre pokrovko?', opis: 'Pogovor: kaj odnese smog (veter, dež) in kaj lahko naredimo mi (manj kurjenja odpadkov, manj vožnje z avtom). Napoved naloge.' },
    ],
    poskus: {
      naslov: 'Pokrovka v kozarcu',
      koraki: [
        'V večjo posodo nalijte hladno vodo in jo obarvajte modro. To je hladen zrak na dnu kotline.',
        'Toplo vodo obarvajte rdeče. Počasi jo vlivajte prek hrbta žlice na vrh modre vode. To je topel zrak nad kotlino.',
        'Počakajte minuto: rdeča ostane zgoraj, modra spodaj – nastala je »pokrovka«.',
        'S kapalko spustite kapljico temne barve (ali črnila) na dno. To je dim iz dimnikov. Opazujte, ali se dvigne skozi rdečo plast.',
        'Za primerjavo: v drug kozarec najprej nalijte toplo, nato hladno vodo. Barvi se hitro pomešata – brez pokrovke se dim razredči.',
      ],
      kajVidimo:
        'Topla voda je lažja in ostane na vrhu, hladna je težja in ostane na dnu. Barva na dnu ostane ujeta v hladni plasti. Enako se zgodi s smogom ob inverziji: v najslabših zimskih dneh je ves dim mesta ujet v plasti, ki je visoka le približno toliko kot Nebotičnik (70 m).',
    },
    izdelki: [
      {
        ime: 'Igrica v Scratchu: Odpihni pokrovko',
        opis:
          'Iz dimnika se dvigajo oblački dima (kloni), ki se ustavijo pri vodoravni črti (pokrovki). Ko igralec pritisne presledek, zapiha veter: pokrovka se dvigne in dim odplava. Za starejše: števec, koliko dima je še ujetega.',
        merila: ['dim se dviga in se ustavi pod pokrovko', 'veter (tipka) odpre pokrovko', 'na začetku igre je kratko navodilo, kaj je pokrovka'],
      },
      {
        ime: 'Plakat: Kdo odpre pokrovko?',
        opis: 'Plakat v dveh delih: levo kotlina s pokrovko in ujetim dimom, desno ista kotlina, ko pride veter. Spodaj trije nasveti, kaj lahko naredimo mi.',
        merila: ['vidi se, da je hladen zrak spodaj in topel zgoraj', 'narisan je dim, ki je ujet', 'vsaj en nasvet za manj dima'],
      },
    ],
    vAplikaciji: [
      { to: '/igre/pokrovka', ime: 'Naredi pokrovko', zakaj: 'zgodba o inverziji in igra z dvema temperaturama' },
      { to: '/igre/zmaj', ime: 'Zmajček čisti nebo', zakaj: 'nagrada na koncu ure: odpihni smog nad 3D Ljubljano' },
    ],
    razprava: [
      'Zakaj je na hribu včasih topleje kot v dolini, čeprav je višje?',
      'Zakaj je smog najhujši zvečer in ponoči?',
      'Kaj bi se zgodilo, če bi vsi v ulici en večer kurili manj?',
    ],
    dejstva: [
      { besedilo: 'Pozimi je na Bežigradu največ delcev med 22. in 1. uro, najmanj okoli 16. ure.', vir: 'meritve ARSO 2021–2026 (ARSOhack)' },
      { besedilo: 'Na najslabših zimskih dneh se je zrak zjutraj mešal le do 50–90 m nad tlemi.', vir: 'radiosondaža Ljubljana, NOAA IGRA2 (ARSOhack)' },
    ],
  },
  {
    id: 'delec',
    zaKoga: 'Za otroke',
    starost: '6.–9. razred (11–15 let)',
    trajanje: '2 × 45 minut',
    barva: 'var(--mint)',
    naslov: 'Kako velik je delec?',
    kratko: 'Delca PM2.5 ne vidimo. Izmerimo ga v primerjavi z lasom, ujamemo večje delce na lovilec in narišemo pot delca od dimnika do pljuč.',
    cilji: [
      'Učenec primerja velikost delca PM2.5 z lasom in zrnom peska ter razloži, zakaj ga ne vidimo.',
      'Učenec razloži, zakaj so prav najmanjši delci najbolj nevarni (pridejo globoko v pljuča).',
      'Učenec prebere pravo meritev in jo primerja s priporočilom WHO.',
    ],
    potrebujete: [
      'bele kartončke ali papirnate krožnike, vazelin ali lepilni trak (lepljiva stran navzven)',
      'povečevalno steklo ali mikroskop, če ga imate',
      'en las (prostovoljec), milimetrski papir',
      'računalnik za igro Vremenski vedeževalec in za Canvo (ali barvice in papir)',
    ],
    potek: [
      { cas: '1. ura · 0–10 min', naslov: 'Česa ne vidimo?', opis: 'Učenci naštejejo, kaj je v zraku (prah, cvetni prah, dim, delci). Kaj od tega vidimo?' },
      { cas: '1. ura · 10–25 min', naslov: 'Lovilci delcev', opis: 'Kartončke z vazelinom postavite na okensko polico zunaj, na hodnik in v učilnico. Pustite jih do druge ure (ali nekaj dni).' },
      { cas: '1. ura · 25–45 min', naslov: 'Velikost v merilu', opis: 'Če bi bil delec PM2.5 velik kot pika (1 mm), bi bil las širok 2–3 cm, zrno peska pa skoraj 4 cm. Učenci narišejo vse tri v istem merilu.' },
      { cas: '2. ura · 0–15 min', naslov: 'Kaj smo ujeli?', opis: 'Lovilce pogledajo s povečevalnim steklom. Ujeli smo večje delce (prah, cvetni prah). PM2.5 je premajhen, da bi ga videli – zato je zahrbten.' },
      { cas: '2. ura · 15–25 min', naslov: 'Prava meritev', opis: 'V paru rešijo Vremenskega vedeževalca (drsnik ali zemljevid). Koliko je bilo včeraj in kolikokrat več od priporočila WHO?' },
      { cas: '2. ura · 25–45 min', naslov: 'Izdelek', opis: 'Skupine naredijo infografiko »Pot delca od dimnika do pljuč«.' },
    ],
    poskus: {
      naslov: 'Lovilec delcev',
      koraki: [
        'Na bel kartonček nanesite tanko plast vazelina (ali prilepite lepilni trak z lepljivo stranjo navzven).',
        'Kartončke označite z mestom (zunaj, hodnik, učilnica) in časom.',
        'Pustite jih vsaj nekaj ur, bolje nekaj dni, nato jih pokrijte s prozorno folijo.',
        'Primerjajte s povečevalnim steklom: kje je več delcev? Kakšne oblike so?',
      ],
      kajVidimo:
        'Na lovilcu vidimo prah, cvetni prah in saje – večje delce. Delcev PM2.5 ne vidimo niti s povečevalnim steklom; za to potrebujemo merilne postaje ARSO. Pogovorite se: zakaj je to, česar ne vidimo, lahko bolj nevarno?',
    },
    izdelki: [
      {
        ime: 'Infografika v Canvi: Pot delca od dimnika do pljuč',
        opis:
          'Od leve proti desni: dimnik ali izpuh → zrak v kotlini (pokrovka) → nos → sapnik → pljučni mešički. Pri vsakem koraku ena kratka poved in ena številka iz meritev.',
        merila: ['velikost PM2.5 je primerjana z lasom', 'vsaj ena prava številka (npr. včerajšnja meritev)', 'na koncu nasvet, kako se zaščitimo ali zmanjšamo dim'],
      },
      {
        ime: 'Plakat v merilu',
        opis: 'Na velikem listu narišite las, zrno peska, cvetni prah, PM10 in PM2.5 v istem merilu (PM2.5 = 1 mm). Dodajte, kam v telo pride kateri delec.',
        merila: ['merilo je pravilno (las 20–30-krat večji od PM2.5)', 'jasno je, kateri delci pridejo najgloblje'],
      },
    ],
    vAplikaciji: [
      { to: '/igre/daily', ime: 'Vremenski vedeževalec', zakaj: 'prava včerajšnja meritev za drsnik, zemljevid ali uro' },
      { to: '/zemljevid', ime: 'Zemljevid', zakaj: 'kje so šole in vrtci v kotlini' },
    ],
    razprava: [
      'Zakaj delcev PM2.5 ne vidimo, pa jih vseeno merimo?',
      'Zakaj so otroci bolj občutljivi kot odrasli? (dihajo hitreje, pljuča se še razvijajo)',
      'Ali je zrak v učilnici čistejši kot zunaj? Kako bi to preverili?',
    ],
    dejstva: [
      { besedilo: 'PM2.5 so delci, manjši od 2,5 tisočinke milimetra – približno 20- do 30-krat tanjši od lasu.', vir: 'definicija PM2.5; las 50–70 µm' },
      { besedilo: 'Priporočilo WHO: dnevno povprečje PM2.5 največ 15 µg/m³, letno povprečje največ 5 µg/m³.', vir: 'WHO, smernice za kakovost zraka 2021' },
      { besedilo: 'Letno povprečje PM2.5 na Bežigradu je bilo leta 2025 12,3 µg/m³ – zmanjšuje se, a je še več kot dvakrat nad letnim priporočilom WHO.', vir: 'meritve ARSO (ARSOhack)' },
    ],
  },
  {
    id: 'kurjenje',
    zaKoga: 'Za odrasle in starejše',
    starost: 'odrasli, upokojenci, starši',
    trajanje: '60 minut',
    barva: 'var(--coral)',
    naslov: 'Toplo doma, čist zrak zunaj',
    kratko: 'Kako drobni delci vplivajo na pljuča in srce in kako kuriti z drvmi, da je manj dima. Za predavanje v knjižnici, domu za starejše ali na roditeljskem sestanku.',
    cilji: [
      'Udeleženec razume, da drobni delci pridejo globoko v pljuča in vplivajo tudi na srce in ožilje.',
      'Udeleženec ve, da so pozimi glavni vir delcev v Ljubljani male peči in kamini.',
      'Udeleženec pozna vsaj tri ukrepe za manj dima pri kurjenju in ve, kdaj prezračiti.',
    ],
    potrebujete: [
      'projektor za prikaz te aplikacije (Domov, Zemljevid, Moj zrak)',
      'natisnjen kontrolni seznam (spodaj) za vsakega udeleženca',
      'po želji: polno in suho poleno za primerjavo',
    ],
    potek: [
      { cas: '0–10 min', naslov: 'Kaj vdihnemo?', opis: 'Pokažite domačo stran (pljuča, ki dihajo današnji zrak) in Zemljevid: koliko vrtcev, šol in domov za starejše leži na dnu kotline.' },
      { cas: '10–25 min', naslov: 'Delci in telo', opis: 'Kam pridejo delci: večji ostanejo v nosu in grlu, najmanjši (PM2.5) pridejo do pljučnih mešičkov in delno v kri. Kdo je najbolj občutljiv.' },
      { cas: '25–40 min', naslov: 'Od kod pozimi?', opis: 'V Mestni občini Ljubljana male kurilne naprave po oceni ARSO izpustijo okoli 127 ton delcev PM10 na leto. Zakaj je največ smoga zvečer.' },
      { cas: '40–55 min', naslov: 'Kako kuriti bolje', opis: 'Skupaj preglejte kontrolni seznam. Kdo že kuri tako? Kaj je najlažje spremeniti?' },
      { cas: '55–60 min', naslov: 'Kdaj zračiti in iti ven', opis: 'Pokažite stran Moj zrak: kdaj je zrak najboljši za sprehod in zračenje.' },
    ],
    izdelki: [
      {
        ime: 'Domači kontrolni seznam',
        opis: 'Vsak udeleženec odkljuka, kar že dela, in obkroži eno stvar, ki jo bo spremenil to zimo.',
        merila: [
          'Kurim samo suha drva (sušena vsaj eno do dve leti, vlaga pod 20 %).',
          'Ogenj prižgem od zgoraj: velika polena spodaj, drobna in podžig na vrhu.',
          'Ne zapiram dovoda zraka, da bi drva tlela čez noč – tlenje naredi največ dima.',
          'Nikoli ne kurim odpadkov, plastike, barvanega ali impregniranega lesa.',
          'Dimnik in peč redno očisti dimnikar.',
          'Razmišljam o zamenjavi stare peči (Eko sklad ima spodbude – preverim pogoje).',
          'Zračim na kratko in na široko, ko je zrak najboljši (pozimi navadno popoldne).',
        ],
      },
    ],
    vAplikaciji: [
      { to: '/', ime: 'Domov', zakaj: 'pljuča, ki dihajo današnji zrak' },
      { to: '/zemljevid', ime: 'Zemljevid', zakaj: 'vrtci, šole in domovi za starejše pod meglo' },
      { to: '/moj-zrak', ime: 'Moj zrak', zakaj: 'kdaj iti ven in kdaj prezračiti' },
    ],
    razprava: [
      'Kdo v vaši okolici kuri z drvmi? Kako bi mu predali nasvete, ne da bi ga užalili?',
      'Kaj bi pomagalo, da bi več ljudi zamenjalo staro peč?',
      'Kako zaščitimo vnuke in sebe na dneve, ko je smog najhujši?',
    ],
    dejstva: [
      { besedilo: 'Drobni delci pridejo globoko v pljuča, delno tudi v kri. Povezani so z boleznimi srca in ožilja, možgansko kapjo, pljučnimi boleznimi in poslabšanjem astme.', vir: 'WHO, Ambient air pollution' },
      { besedilo: 'Najbolj občutljivi so otroci, starejši, nosečnice ter ljudje z boleznimi srca in pljuč.', vir: 'WHO' },
      { besedilo: 'Male kurilne naprave v Mestni občini Ljubljana izpustijo okoli 127 ton PM10 na leto.', vir: 'ARSO, inventar emisij (ARSOhack)' },
      { besedilo: 'Nova evropska direktiva od leta 2030 dovoljuje največ 18 dni na leto z dnevnim povprečjem PM2.5 nad 25 µg/m³.', vir: 'EU direktiva o kakovosti zunanjega zraka (ARSOhack)' },
    ],
  },
]
