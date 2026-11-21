<script setup lang="ts">
// Drseča zgodba (»scrollytelling«): ozadje (stage) ostane pripeto, kartice z besedilom drsijo čez.
// Ko kartica pride na sredino zaslona, se `active` nastavi na njen indeks – stran nato spremeni sceno.
// Uporablja jo domača stran za vsa poglavja, da imajo enak izgled.
import { onBeforeUnmount, onMounted, ref } from 'vue'

const props = withDefaults(
  defineProps<{
    count: number // število kartic
    color?: string // barva poudarkov (--lvl)
    plainFirst?: boolean // prva kartica brez ozadja (naslovna)
  }>(),
  { color: '#5aa2ff', plainFirst: false },
)
const active = defineModel<number>('active', { default: 0 })

const stepEls = ref<HTMLElement[]>([])
let io: IntersectionObserver | undefined
onMounted(() => {
  io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) if (e.isIntersecting) active.value = Number((e.target as HTMLElement).dataset.i)
    },
    { rootMargin: '-45% 0px -45% 0px' },
  )
  stepEls.value.forEach((el) => io!.observe(el))
})
onBeforeUnmount(() => io?.disconnect())
</script>

<template>
  <section class="scrolly" :style="{ '--lvl': props.color }">
    <div class="stage">
      <slot name="stage" :active="active" />
      <ol class="dots" aria-hidden="true">
        <li v-for="i in count" :key="i" :class="{ on: i - 1 === active }" />
      </ol>
    </div>

    <div class="steps">
      <article v-for="i in count" :key="i" ref="stepEls" :data-i="i - 1" class="step">
        <div class="step-card" :class="{ plain: plainFirst && i === 1 }">
          <slot name="step" :i="i - 1" :active="active" />
        </div>
      </article>
    </div>
  </section>
</template>

<style scoped>
.scrolly {
  position: relative;
}
.stage {
  position: sticky;
  top: 64px;
  height: calc(100svh - 64px);
  overflow: hidden;
}
.dots {
  position: absolute;
  right: 18px;
  top: 50%;
  transform: translateY(-50%);
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 10px;
  z-index: 2;
}
.dots li {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--dot-off);
  transition: transform 0.3s, background 0.3s;
}
.dots li.on {
  background: var(--lvl);
  transform: scale(1.6);
}
.steps {
  position: relative;
  margin-top: calc(-100svh + 64px);
  pointer-events: none; /* da lahko sceno uporabljaš skozi besedilo */
}
.step {
  min-height: 100svh;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: 0 max(56px, 6vw) 0 24px;
}
.step-card {
  pointer-events: auto;
  max-width: 420px;
  padding: 24px 26px;
  border-radius: var(--radius);
  background: var(--panel);
  border: 1px solid var(--panel-line);
  box-shadow: var(--panel-shadow);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}
.step-card.plain {
  background: transparent;
  border: 0;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  max-width: 520px;
}

@media (max-width: 720px) {
  .step {
    justify-content: center;
    align-items: flex-end;
    padding: 0 16px 140px;
  }
  .step-card.plain {
    background: var(--panel);
  }
  .dots {
    right: 10px;
  }
}
</style>
