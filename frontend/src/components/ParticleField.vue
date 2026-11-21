<script setup lang="ts">
// Lebdeči »prašni delci«. Več PM2.5 = več delcev. Prst/miška jih odpihne.
import { onBeforeUnmount, onMounted, ref } from 'vue'

const props = withDefaults(defineProps<{ pm25: number; tint?: string }>(), { tint: '#6b5b4b' })

const canvas = ref<HTMLCanvasElement | null>(null)
interface P {
  x: number
  y: number
  vx: number
  vy: number
  r: number
  a: number
}
let parts: P[] = []
let raf = 0
let w = 0
let h = 0
const pointer = { x: -9999, y: -9999 }

function targetCount() {
  return Math.min(500, Math.round(props.pm25 * 5))
}

function spawn(): P {
  return {
    x: Math.random() * w,
    y: Math.random() * h,
    vx: (Math.random() - 0.5) * 0.3,
    vy: (Math.random() - 0.5) * 0.3,
    r: 1 + Math.random() * 3,
    a: 0.25 + Math.random() * 0.5,
  }
}

function resize() {
  const c = canvas.value
  if (!c) return
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  w = c.clientWidth
  h = c.clientHeight
  c.width = w * dpr
  c.height = h * dpr
  c.getContext('2d')?.setTransform(dpr, 0, 0, dpr, 0, 0)
}

function frame() {
  const c = canvas.value
  const ctx = c?.getContext('2d')
  if (!c || !ctx) return
  const want = targetCount()
  while (parts.length < want) parts.push(spawn())
  if (parts.length > want) parts.length = want

  ctx.clearRect(0, 0, w, h)
  ctx.fillStyle = props.tint
  for (const p of parts) {
    const dx = p.x - pointer.x
    const dy = p.y - pointer.y
    const d2 = dx * dx + dy * dy
    if (d2 < 120 * 120) {
      const f = (1 - Math.sqrt(d2) / 120) * 0.9
      p.vx += (dx / Math.sqrt(d2 + 1)) * f
      p.vy += (dy / Math.sqrt(d2 + 1)) * f
    }
    p.vx = p.vx * 0.96 + (Math.random() - 0.5) * 0.05
    p.vy = p.vy * 0.96 + (Math.random() - 0.5) * 0.05 + 0.004
    p.x += p.vx
    p.y += p.vy
    if (p.x < -10) p.x = w + 10
    if (p.x > w + 10) p.x = -10
    if (p.y < -10) p.y = h + 10
    if (p.y > h + 10) p.y = -10
    ctx.globalAlpha = p.a
    ctx.beginPath()
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1
  raf = requestAnimationFrame(frame)
}

function onMove(e: PointerEvent) {
  const r = canvas.value?.getBoundingClientRect()
  if (!r) return
  pointer.x = e.clientX - r.left
  pointer.y = e.clientY - r.top
}
function onLeave() {
  pointer.x = pointer.y = -9999
}

onMounted(() => {
  resize()
  window.addEventListener('resize', resize)
  window.addEventListener('pointermove', onMove)
  raf = requestAnimationFrame(frame)
})
onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  window.removeEventListener('resize', resize)
  window.removeEventListener('pointermove', onMove)
})
defineExpose({ reset: onLeave })
</script>

<template>
  <canvas ref="canvas" class="particles" aria-hidden="true" />
</template>

<style scoped>
.particles {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}
</style>
