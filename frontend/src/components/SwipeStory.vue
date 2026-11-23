<script setup lang="ts">
// Zgodba za telefon (»stories«): en korak = en zaslon. Zgoraj oder (graf, kotlina), spodaj naslov in besedilo.
// Naprej: poteg v levo, tap na desni del odra ali puščica ›. Nazaj: poteg v desno, tap na levi del odra ali ‹.
// Ima iste reže kot ScrollStory (stage, naslov, step), zato jo zgodbe uporabijo namesto nje na telefonu.
// Ko listaš čez zadnji (prvi) korak, sporoči »konec« (»zacetek«) – stran nato pokaže naslednje (prejšnje) poglavje.
import { onBeforeUnmount, onMounted, ref } from 'vue'

const props = withDefaults(
  defineProps<{
    count: number // število korakov v tem poglavju
    color?: string // barva poudarkov (--lvl)
    pred?: number // koliko korakov je v prejšnjih poglavjih (za črtice napredka)
    skupaj?: number // vseh korakov v celi zgodbi
    zacniNaKoncu?: boolean // ob vrnitvi s poglavja naprej začni na zadnjem koraku
  }>(),
  { color: '#5aa2ff', pred: 0, skupaj: 0, zacniNaKoncu: false },
)
const emit = defineEmits<{ konec: []; zacetek: [] }>()
const active = defineModel<number>('active', { default: 0 })
const smer = ref<'naprej' | 'nazaj'>('naprej')

function naprej() {
  smer.value = 'naprej'
  if (active.value < props.count - 1) active.value++
  else emit('konec')
}
function nazaj() {
  smer.value = 'nazaj'
  if (active.value > 0) active.value--
  else emit('zacetek')
}

// tap na oder: levi tretjini nazaj, drugje naprej
function tapOder(e: MouseEvent) {
  const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
  if (e.clientX - r.left < r.width / 3) nazaj()
  else naprej()
}

// poteg s prstom (ne, kadar se začne na drsniku)
let zacetek: { x: number; y: number } | null = null
function onStart(e: TouchEvent) {
  const t = e.touches[0]
  const el = e.target as HTMLElement
  zacetek = t && !el.closest('input[type="range"]') ? { x: t.clientX, y: t.clientY } : null
}
function onEnd(e: TouchEvent) {
  const t = e.changedTouches[0]
  if (!zacetek || !t) return
  const dx = t.clientX - zacetek.x
  const dy = t.clientY - zacetek.y
  zacetek = null
  if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.3) {
    if (dx < 0) naprej()
    else nazaj()
  }
}
const onTipka = (e: KeyboardEvent) => {
  if (e.key === 'ArrowRight') naprej()
  if (e.key === 'ArrowLeft') nazaj()
}
onMounted(() => {
  if (props.zacniNaKoncu) {
    smer.value = 'nazaj'
    active.value = props.count - 1
  }
  window.addEventListener('keydown', onTipka)
})
onBeforeUnmount(() => window.removeEventListener('keydown', onTipka))

const skupajKorakov = () => props.skupaj || props.count
const trenutni = () => props.pred + active.value
</script>

<template>
  <section class="swipe" :style="{ '--lvl': props.color }" @touchstart.passive="onStart" @touchend="onEnd">
    <!-- črtice napredka čez celo zgodbo -->
    <div class="napredek" aria-hidden="true">
      <span v-for="k in skupajKorakov()" :key="k" :class="{ done: k - 1 < trenutni(), now: k - 1 === trenutni() }" />
    </div>

    <div class="oder" @click="tapOder">
      <slot name="stage" :active="active" />
    </div>

    <div class="besedilo">
      <Transition :name="smer" mode="out-in">
        <div :key="active" class="korak">
          <span v-if="$slots.naslov" class="naslov"><slot name="naslov" :i="active" /></span>
          <slot name="step" :i="active" :active="active" />
        </div>
      </Transition>
      <div class="puscice">
        <button class="puscica" aria-label="Nazaj" :disabled="trenutni() === 0" @click="nazaj">‹</button>
        <span class="stevec">{{ trenutni() + 1 }} / {{ skupajKorakov() }}</span>
        <button class="puscica" aria-label="Naprej" :disabled="trenutni() >= skupajKorakov() - 1" @click="naprej">›</button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.swipe {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  touch-action: pan-y; /* vodoravni poteg obdelamo sami */
}
.napredek {
  display: flex;
  gap: 3px;
  padding: 10px 14px 6px;
}
.napredek span {
  flex: 1;
  height: 3px;
  border-radius: 2px;
  background: var(--line);
  transition: background 0.3s;
}
.napredek span.done {
  background: var(--scene-ink, var(--ink));
}
.napredek span.now {
  background: var(--lvl);
}
.oder {
  position: relative;
  flex: 0 0 auto;
  height: 46%;
  margin: 4px 12px 0;
  border-radius: var(--radius);
  overflow: hidden;
  background: var(--panel);
  border: 1px solid var(--panel-line);
  box-shadow: var(--panel-shadow);
  cursor: pointer;
}
/* vsebina odra iz zgodb (kotlina, grafi) je narejena za cel zaslon – tu jo prilagodimo okvirju */
.oder :deep(.readout) {
  top: 10px;
  left: 12px;
  bottom: auto;
}
.oder :deep(.readout .num) {
  font-size: 2.2rem;
}
.oder :deep(.panel-stage) {
  padding: 0;
  align-items: stretch;
  background: none;
}
.oder :deep(.panel) {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  height: 100%;
  padding: 12px 12px 8px;
  border: 0;
  border-radius: 0;
  box-shadow: none;
  background: none;
  --chart-h: 110px;
}
.oder :deep(.panel figcaption) {
  margin-bottom: 4px;
  font-size: 0.78rem;
}
.oder :deep(.panel .source) {
  margin: 4px 0 0 !important;
  font-size: 0.68rem !important;
}
.besedilo {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 12px 18px 8px;
}
.korak {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}
.naslov {
  display: block;
  margin-bottom: 4px;
  text-transform: uppercase;
  letter-spacing: 0.16em;
  font-size: 0.72rem;
  font-weight: 800;
  color: color-mix(in srgb, var(--lvl) 70%, var(--ink));
}
.korak :deep(h2) {
  margin: 0 0 6px;
  font-size: 1.55rem;
  line-height: 1.1;
}
.korak :deep(p) {
  margin: 0 0 8px;
  font-size: 0.98rem;
  line-height: 1.45;
}
.puscice {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 6px;
}
.puscica {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: 1px solid var(--line);
  background: var(--card);
  color: var(--ink);
  font-size: 1.6rem;
  line-height: 1;
  cursor: pointer;
}
.puscica:disabled {
  opacity: 0.35;
}
.stevec {
  font-size: 0.8rem;
  font-weight: 800;
  color: var(--ink-soft);
}
/* prehod med koraki: v smeri listanja */
.naprej-enter-active,
.naprej-leave-active,
.nazaj-enter-active,
.nazaj-leave-active {
  transition:
    opacity 0.18s ease,
    transform 0.18s ease;
}
.naprej-enter-from,
.nazaj-leave-to {
  opacity: 0;
  transform: translateX(24px);
}
.naprej-leave-to,
.nazaj-enter-from {
  opacity: 0;
  transform: translateX(-24px);
}
</style>
