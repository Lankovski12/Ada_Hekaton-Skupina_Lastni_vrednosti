<script setup lang="ts">
// Pikselne ikone iger (16 × 16), narisane kot mreža znakov: vsak znak je ena barva iz palete, '.' je prazno.
import { computed } from 'vue'

const props = withDefaults(defineProps<{ name: 'zmaj' | 'krogla' | 'pokrovka'; size?: number }>(), { size: 48 })

const PALETA: Record<string, string> = {
  K: '#1d3557', // obroba
  G: '#3ccf6e', // zelena
  D: '#26a052', // temno zelena
  L: '#b8f0c8', // svetlo zelena (trebuh)
  W: '#ffffff',
  Y: '#ffc93c', // rumena
  O: '#f29d1f', // oranžna
  R: '#ff8fa3', // rožnata
  S: '#d5dde5', // dim
  T: '#9aa5b1', // temnejši dim
  P: '#9b6bff', // vijolična
  Q: '#c4a8ff', // svetlo vijolična
  B: '#a86b3c', // rjava
  N: '#7a4a26', // temno rjava
  M: '#c9d3de', // kovina
  H: '#e5484d', // rdeča streha
  A: '#7cc8ff', // nebo
}

const SLIKE: Record<string, string[]> = {
  // zmajček, ki piha meglo
  zmaj: [
    '................',
    '..Y....Y........',
    '..YK..KY........',
    '.KGGKKGGK.......',
    'KGGGGGGGGKK.....',
    'KGGGGGWWGGGK....',
    'KGGGGGWKGGGGK...',
    'KGRGGGGGGGGGGK..',
    'KGGGGGGGGGGKGK.S',
    '.KGGGLLLLLGGK.SS',
    '.KGGGKKKKKKK.SS.',
    '.KGGGGK......S..',
    'KDGGGGDK........',
    'KDGKKGDK........',
    'KKK..KKK........',
    '................',
  ],
  // kristalna krogla vedeževalca z oblačkom v njej
  krogla: [
    '................',
    '.....KKKKKK.....',
    '...KKPPPPPPKK...',
    '..KPPWWPPPPPPK..',
    '..KPWWPPPPPPPK..',
    '.KPPWPPPPPPPPPK.',
    '.KPPPPPPPWWPPPK.',
    '.KPPPPPWWWWWPPK.',
    '.KPPPPWWWWWWWPK.',
    '..KPPPPPPPPPPK..',
    '..KQPPPPPPPPPK..',
    '...KKPPPPPPKK...',
    '....KBBBBBBK....',
    '...KBBYYBBBBK...',
    '..KNNNNNNNNNNK..',
    '..KKKKKKKKKKKK..',
  ],
  // pokrovka nad dolino z mestom in dimom pod njo
  pokrovka: [
    '.......KK.......',
    '......KYYK......',
    '....KKKKKKKK....',
    '..KKMMMMMMMMKK..',
    '.KMMWWMMMMMMMMK.',
    'KMMMMMMMMMMMMMMK',
    'KKKKKKKKKKKKKKKK',
    '................',
    '..T...S...T..S..',
    '.S..T...S...T...',
    'G.....KK.....GGG',
    'GG...KHHK...GGGG',
    'GGG.KHHHHK.GGGGG',
    'GGGG.KWWK.GGGGGG',
    'GGGGGKWWKGGGGGGG',
    'DDDDDDDDDDDDDDDD',
  ],
}

const piksli = computed(() => {
  const out: { x: number; y: number; c: string }[] = []
  ;(SLIKE[props.name] ?? []).forEach((vrstica, y) =>
    [...vrstica].slice(0, 16).forEach((znak, x) => {
      const c = PALETA[znak]
      if (c) out.push({ x, y, c })
    }),
  )
  return out
})
</script>

<template>
  <svg :width="size" :height="size" viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true" class="pixel">
    <rect v-for="(p, i) in piksli" :key="i" :x="p.x" :y="p.y" width="1" height="1" :fill="p.c" />
  </svg>
</template>

<style scoped>
.pixel {
  display: block;
  image-rendering: pixelated;
}
</style>
