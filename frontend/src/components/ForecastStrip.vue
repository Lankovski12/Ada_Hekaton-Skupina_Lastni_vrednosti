<script setup lang="ts">
// 48-urna napoved kot stolpci. Tapni stolpec za podrobnosti; zvezdica = najboljša ura za ven.
import { computed } from 'vue'
import type { ForecastResponse } from '@/lib/types'
import { formatDayHour, levelFor } from '@/lib/airQuality'

const props = defineProps<{ forecast: ForecastResponse; sensitivity?: number }>()

// izbrana ura; starš jo lahko nastavlja z v-model:selected
const selected = defineModel<number>('selected', { default: 0 })
const max = computed(() => Math.max(30, ...props.forecast.ure.map((u) => u.pm25)))
const sel = computed(() => props.forecast.ure[selected.value])
const selLevel = computed(() => levelFor(sel.value?.pm25 ?? 0, props.sensitivity))
const bestIdx = computed(() => props.forecast.ure.findIndex((u) => u.cas_utc === props.forecast.najboljsa_ura))
</script>

<template>
  <div class="strip">
    <div class="detail" v-if="sel">
      <div>
        <div class="when">{{ formatDayHour(sel.cas_utc) }}h</div>
        <div class="val">
          <strong>{{ sel.pm25 }}</strong> µg/m³ PM2.5
        </div>
      </div>
      <span class="badge" :style="{ background: selLevel.color }">{{ selLevel.label }}</span>
    </div>
    <div class="bars" role="listbox" aria-label="Napoved po urah">
      <button
        v-for="(u, i) in forecast.ure"
        :key="u.cas_utc"
        class="bar"
        :class="{ active: i === selected, best: i === bestIdx, newday: new Date(u.cas_utc).getHours() === 0 }"
        :style="{ '--h': `${(u.pm25 / max) * 100}%`, '--c': levelFor(u.pm25, sensitivity).color }"
        :aria-label="`${formatDayHour(u.cas_utc)}: ${u.pm25} µg/m³`"
        @pointerenter="selected = i"
        @pointerdown="selected = i"
      >
        <span v-if="i === bestIdx" class="star" aria-hidden="true">⭐</span>
      </button>
    </div>
    <div class="axis">
      <span>zdaj</span>
      <span>+24 h</span>
      <span>+48 h</span>
    </div>
  </div>
</template>

<style scoped>
.detail {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}
.when {
  color: var(--ink-soft);
  font-weight: 700;
  text-transform: capitalize;
}
.val strong {
  font-family: var(--font-head);
  font-size: 2rem;
}
.badge {
  color: #fff;
  font-weight: 800;
  padding: 6px 14px;
  border-radius: 999px;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.25);
}
.bars {
  display: flex;
  align-items: flex-end;
  gap: 2px;
  height: var(--bars-h, 160px);
  padding-top: 24px;
}
.bar {
  position: relative;
  flex: 1;
  height: var(--h);
  min-height: 6px;
  border: 0;
  padding: 0;
  border-radius: 6px 6px 2px 2px;
  background: var(--c);
  opacity: 0.55;
  transition: opacity 0.15s, transform 0.15s;
  touch-action: none;
}
.bar.active {
  opacity: 1;
  transform: scaleY(1.04);
  transform-origin: bottom;
}
.bar.newday::before {
  content: '';
  position: absolute;
  left: -2px;
  bottom: 0;
  height: calc(var(--bars-h, 160px) - 10px);
  border-left: 1px dashed var(--line);
}
.star {
  position: absolute;
  top: -24px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 0.9rem;
}
.axis {
  display: flex;
  justify-content: space-between;
  color: var(--ink-soft);
  font-size: 0.8rem;
  margin-top: 6px;
}
</style>
