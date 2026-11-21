# frontend – Vue 3 + TypeScript + Vite + Pinia

```bash
npm install
cp .env.example .env   # nastavi VITE_API_URL
npm run dev            # http://localhost:5173
```

Brez zaledja aplikacija uporablja demo podatke (`src/api/mock.ts`).

## Kje je kaj

```
src/
  api/          client.ts (fetch + predpomnilnik), mock.ts (demo podatki)
  components/   AppNav, AirBuddy (maskota), ParticleField (delci), ForecastStrip
  composables/  useAirData.ts (en vir podatkov), useProfile.ts (astma, lokalno)
  games/        vsaka igra v svoji mapi: zmaj/, daily/, ujemanje/
  lib/          types.ts (= odgovori API), airQuality.ts (razredi, barve)
  scenes/       Kotlina.vue (kotlina z meglo; kasneje TresJS 3D)
  stores/       progress.ts (točke v igrah, lokalno)
  views/        Home, Otroci, Starsi, Nastavitve
public/assets/
  models/       3D modeli .glb (low-poly)
  terrain/      heightmap.png, teren.json (iz backend/scripts/dem_to_heightmap.py)
```

## Nova igra

1. Ustvari `src/games/<ime>/<Ime>Game.vue` (+ `logic.ts`).
2. Dodaj pot v `src/router/index.ts`.
3. Dodaj ploščico v `src/views/OtrociView.vue`.

Pravila: pointer events (dotik + miška), veliki gumbi, podatke beri samo prek `useAirData()`.

## Telefon (Capacitor) – ko bo čas

```bash
npm i @capacitor/core @capacitor/android @capacitor/local-notifications @capacitor/preferences
npm i -D @capacitor/cli
npx cap init "Zrak" si.hekaton.zrak --web-dir dist
npm run build && npx cap add android && npx cap sync android
```

## 3D (TresJS) – ko bo čas

```bash
npm i three @tresjs/core @tresjs/cientos
```
