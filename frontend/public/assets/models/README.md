# 3D modeli

| Datoteka | Kaj | Vir / licenca |
|---|---|---|
| `zmaj.glb` | zmajček za igro (stisnjen: tekstura 1024 px WebP, ~20.000 trikotnikov) | TODO: vpiši avtorja in licenco modela |

Model nima okostja – krila mahajo s shaderjem v `src/games/zmaj/engine/dragon.ts`.
Stiskanje novega modela:

```bash
npx @gltf-transform/cli resize vhod.glb a.glb --width 1024 --height 1024
npx @gltf-transform/cli webp a.glb b.glb
npx @gltf-transform/cli simplify b.glb zmaj.glb --ratio 0.5 --error 0.001
```
