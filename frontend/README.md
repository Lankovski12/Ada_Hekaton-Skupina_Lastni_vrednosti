# frontend – Vue 3 + TypeScript + Vite + Pinia

```bash
npm install
npm run dev            # http://localhost:5173, /api gre na http://localhost:8000
```

Brez zaledja aplikacija uporablja demo podatke (`src/api/mock.ts`). Za vse skupaj glej `docker compose up` v korenu.

## Kje je kaj

```
src/
  api/          client.ts (fetch + predpomnilnik), mock.ts (demo podatki)
  components/   AppNav, AirBuddy (maskota), VirZnacka (meritev/model/ocena), SolaKartica
  composables/  useAirData.ts (en vir podatkov), useProfile.ts (astma in lokacija, samo na napravi)
  games/        vsaka igra v svoji mapi: zmaj/, daily/, pokrovka/ (skupno/ za zvoke in ikone)
  lib/          types.ts (= odgovori API), airQuality.ts (razredi, barve)
  scenes/       PljucaPike.vue (pljuča na domači strani), Kotlina.vue, Zemljevid3D.vue
  stores/       progress.ts (rekord v Zmajčku, lokalno)
  views/        Home, Otroci (igre), Zemljevid, Grafi (podatki), MojZrak
public/assets/
  models/       3D modeli .glb (low-poly)
  terrain/      teren, smog in stavbe za Zmajčka (iz backend/scripts/build_game_assets.py)
  map/          3D zemljevid in šole (backend/scripts/zemljevid_3d.py, zemljevid_dnevi.py, zemljevid_sole.py)
```

## Igra Zmajček (3D, three.js)

```
src/games/zmaj/
  ZmajGame.vue        meniji, kartica dneva, HUD, sporočila, vprašanja, povzetek
  config.ts           VSE nastavitve igre (čas, hitrost, pihanje, smog, dež, veter, dimniki, vprašanja)
  vprasanja.ts        vprašanja in kratka dejstva (iz podatkov ARSO in priporočil WHO)
  engine/Game.ts      zanka, kamera, vnos (miška, presledek)
  engine/terrain.ts   teren iz public/assets/terrain (višine, mesto, izpusti)
  engine/world.ts     teren (satelitska slika ali barve), 3D stavbe iz katastra GURS
  engine/smog.ts      mreža gostote smoga, kepe smoga, pihanje, vračanje, točke
  engine/dragon.ts    model, mahanje kril (shader), let
  engine/breath.ts    delci pihanja
  engine/pickups.ts   Oblaček Kapljica (dež), obroči vetra, dimniki, zlati vprašaj
  engine/sound.ts     zvoki in glasba, ustvarjeni v brskalniku (Web Audio, brez datotek)
  engine/speedlines.ts črte hitrosti ob sunku vetra
  ui/                 ikone (SVG) in konfeti
```

Teren pripravi `backend/scripts/build_game_assets.py` (enkrat; rezultat je v gitu).
Lepši teren: `python backend/scripts/download_satelit.py` prenese satelitsko sliko (Sentinel-2 cloudless)
v `public/assets/terrain/satelit.jpg`; igra jo uporabi sama, sicer ostanejo barve iz podatkov.
Za teste: `/igre/zmaj?debug=1` izpostavi igro kot `window.__zmaj`.
Če je danes zrak čist (PM2.5 < 30), igra vzame resničen slab dan iz zgodovine ARSO (`public/assets/terrain/slabi_dnevi.json`).
Za predstavitev lahko stanje zraka nastaviš v naslovu: `/igre/zmaj?pm=70&megla=1&vrh=500`.

## Igra Vremenski vedeževalec

Vsak dan eno vprašanje o **včerajšnjem** zraku, odgovor takoj. Sedem vrst nalog (kroži po dnevih):
zemljevid, drsnik, ura, pobarvaj dan, razvrsti, pokrovka, detektiv.

```
src/games/daily/
  DailyGame.vue       glava (niz dni), naloga, rezultat, odštevanje, vaja
  dan.ts              nalaganje dneva: /api/vceraj ali arhiv (public/assets/daily/arhiv.json)
  vrste.ts            katere naloge so možne za dan in katera je na vrsti
  napredek.ts         odgovori in niz dni (samo na napravi)
  naloge/*.vue        sedem nalog; vsaka pošlje 'konec' z 0–3 zvezdicami in razlago
src/games/skupno/     zvoki, ikone in konfeti (skupni obema igrama)
```

Arhiv pripravi `backend/scripts/build_daily_archive.py`, obris Slovenije je iz Natural Earth.
Za predstavitev: `/igre/daily?vrsta=zemljevid&datum=2026-11-20`.

## Igra Naredi pokrovko

Z dvema drsnikoma (temperatura v Ljubljani in na Pasji ravni) otrok ujame včerajšnjo pokrovko. Prej (neobvezno)
zgodba v petih korakih razloži, kako nastane inverzija. Tri stopnje: dolina dana, obe temperaturi, brez cilja z namigi.

```
src/games/pokrovka/
  PokrovkaGame.vue    meni, zgodba, tri stopnje, povzetek
  Zgodba.vue          razlaga inverzije (dan, noč, pokrovka, ujet dim, kako se odpre) z dvema vprašanjema
  Scena.vue           prerez kotline: ozadje obarvano po temperaturi, dim se ustavi pod pokrovko
  fizika.ts           višina pokrovke iz dveh temperatur (enako kot backend/app/pokrovka.py)
  podatki.ts          /api/pokrovka (včeraj, model) ali arhiv meritev ARSO (public/assets/pokrovka/arhiv.json)
```

Pravilo za višino pokrovke je preverjeno na 1.127 zimskih dneh: korelacija z radiosondažo ARSO 0,82.
Arhiv pripravi `backend/scripts/build_pokrovka_archive.py`. Za predstavitev: `/igre/pokrovka?datum=2024-01-12`.

## Nova igra

1. Ustvari `src/games/<ime>/<Ime>Game.vue` (+ `logic.ts`).
2. Dodaj pot v `src/router/index.ts`.
3. Dodaj ploščico v `src/views/OtrociView.vue`.

Pravila: pointer events (dotik + miška), veliki gumbi, podatke beri samo prek `useAirData()`.
