<script setup lang="ts">
// Izobraževanje: pripravljene ure za učitelje in predavatelje (dve za otroke, ena za odrasle in starejše).
// Izbrana ura je v naslovu (?ura=pokrovka), da jo lahko delimo in natisnemo.
import { computed } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { URE } from '@/izobrazevanje/ure'

const route = useRoute()
const router = useRouter()
const izbrana = computed(() => URE.find((u) => u.id === route.query.ura) ?? null)

function odpri(id: string) {
  router.push({ query: { ura: id } })
  window.scrollTo({ top: 0, behavior: 'smooth' })
}
function nazaj() {
  router.push({ query: {} })
}
function natisni() {
  window.print()
}
</script>

<template>
  <div class="story izobr">
    <!-- pregled -->
    <section v-if="!izbrana" class="container page">
      <span class="kicker">Za učitelje in predavatelje</span>
      <h1>Izobraževanje</h1>
      <p class="lead">
        Pripravljene ure o zraku v Ljubljani. Vsaka je posvečena eni stvari, ima poskus ali dejavnost in izdelek na koncu.
        Številke so iz pravih meritev ARSO, zato jih lahko uporabite pri vsaki uri znova.
      </p>
      <div class="grid">
        <article v-for="u in URE" :key="u.id" class="ura" :style="{ '--c': u.barva }">
          <div class="chips">
            <span class="chip strong">{{ u.zaKoga }}</span>
            <span class="chip">{{ u.trajanje }}</span>
          </div>
          <h2>{{ u.naslov }}</h2>
          <p class="starost">{{ u.starost }}</p>
          <p>{{ u.kratko }}</p>
          <p class="izd"><strong>Izdelek:</strong> {{ u.izdelki.map((i) => i.ime.split(':')[0]).join(' ali ') }}</p>
          <button class="btn odpri" @click="odpri(u.id)">Odpri načrt ure</button>
        </article>
      </div>
    </section>

    <!-- načrt ure -->
    <section v-else class="container page ura-detail" :style="{ '--c': izbrana.barva }">
      <div class="top no-print">
        <button class="btn ghost" @click="nazaj">Vse ure</button>
        <button class="btn" @click="natisni">Natisni načrt</button>
      </div>
      <span class="kicker">{{ izbrana.zaKoga }} · {{ izbrana.starost }} · {{ izbrana.trajanje }}</span>
      <h1>{{ izbrana.naslov }}</h1>
      <p class="lead">{{ izbrana.kratko }}</p>

      <div class="two">
        <div class="card">
          <h3>Cilji</h3>
          <ul>
            <li v-for="c in izbrana.cilji" :key="c">{{ c }}</li>
          </ul>
        </div>
        <div class="card">
          <h3>Potrebujete</h3>
          <ul>
            <li v-for="c in izbrana.potrebujete" :key="c">{{ c }}</li>
          </ul>
        </div>
      </div>

      <div class="card">
        <h3>Potek ure</h3>
        <ol class="timeline">
          <li v-for="k in izbrana.potek" :key="k.cas + k.naslov">
            <span class="cas">{{ k.cas }}</span>
            <div>
              <strong>{{ k.naslov }}</strong>
              <p>{{ k.opis }}</p>
            </div>
          </li>
        </ol>
      </div>

      <div v-if="izbrana.poskus" class="card poskus">
        <h3>Poskus: {{ izbrana.poskus.naslov }}</h3>
        <ol>
          <li v-for="k in izbrana.poskus.koraki" :key="k">{{ k }}</li>
        </ol>
        <p class="kaj"><strong>Kaj vidimo?</strong> {{ izbrana.poskus.kajVidimo }}</p>
      </div>

      <div class="card">
        <h3>Naloga – izdelek</h3>
        <div class="izdelki">
          <div v-for="i in izbrana.izdelki" :key="i.ime" class="izdelek">
            <h4>{{ i.ime }}</h4>
            <p>{{ i.opis }}</p>
            <ul class="check">
              <li v-for="m in i.merila" :key="m">{{ m }}</li>
            </ul>
          </div>
        </div>
      </div>

      <div class="two">
        <div class="card">
          <h3>Za pogovor</h3>
          <ul>
            <li v-for="r in izbrana.razprava" :key="r">{{ r }}</li>
          </ul>
        </div>
        <div class="card no-print-links">
          <h3>V tej aplikaciji</h3>
          <ul class="links">
            <li v-for="a in izbrana.vAplikaciji" :key="a.to">
              <RouterLink :to="a.to">{{ a.ime }}</RouterLink>
              <span> – {{ a.zakaj }}</span>
            </li>
          </ul>
        </div>
      </div>

      <div class="card dejstva">
        <h3>Dejstva za uro</h3>
        <ul>
          <li v-for="d in izbrana.dejstva" :key="d.besedilo">
            {{ d.besedilo }} <small>Vir: {{ d.vir }}</small>
          </li>
        </ul>
      </div>
    </section>
  </div>
</template>

<style scoped>
.page {
  --lvl: var(--lilac);
  padding-top: 40px;
  padding-bottom: 20px;
}
.page h1 {
  font-size: clamp(2rem, 5vw, 3.2rem);
}
.lead {
  max-width: 760px;
  margin-bottom: 24px !important;
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 18px;
}
.ura {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 22px;
  border-radius: var(--radius);
  background: var(--panel);
  border: 2px solid color-mix(in srgb, var(--c) 50%, transparent);
  box-shadow:
    0 6px 0 color-mix(in srgb, var(--c) 30%, transparent),
    0 22px 40px -24px rgba(31, 45, 77, 0.4);
}
.ura h2 {
  margin: 4px 0 0;
  font-size: 1.7rem;
}
.ura p {
  font-size: 1rem;
}
.starost {
  color: var(--scene-muted) !important;
  font-weight: 700;
  font-size: 0.9rem !important;
}
.izd {
  margin-top: auto !important;
  padding-top: 6px;
}
.chips {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.chip {
  padding: 3px 10px;
  border-radius: 999px;
  background: var(--bg-soft);
  font-size: 0.8rem;
  font-weight: 800;
  color: var(--scene-text);
}
.chip.strong {
  background: color-mix(in srgb, var(--c) 25%, transparent);
  color: color-mix(in srgb, var(--c) 60%, var(--scene-ink));
}
.odpri {
  --btn: var(--c);
  align-self: flex-start;
  margin-top: 6px;
  color: #10192e;
}

/* načrt ure */
.ura-detail {
  --lvl: var(--c);
  max-width: 980px;
}
.top {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 18px;
}
.card {
  background: var(--panel);
  border: 1px solid var(--panel-line);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  padding: 20px 22px;
  margin-bottom: 18px;
}
.card h3 {
  font-size: 1.35rem;
  color: color-mix(in srgb, var(--c) 55%, var(--scene-ink));
}
.card ul,
.card ol {
  margin: 0;
  padding-left: 20px;
  display: grid;
  gap: 6px;
  color: var(--scene-text);
}
.two {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 18px;
}
.timeline {
  list-style: none;
  padding: 0 !important;
  gap: 14px !important;
}
.timeline li {
  display: grid;
  grid-template-columns: 150px 1fr;
  gap: 14px;
  align-items: start;
}
.cas {
  padding: 4px 10px;
  border-radius: 12px;
  background: color-mix(in srgb, var(--c) 20%, transparent);
  font-weight: 800;
  font-size: 0.85rem;
  text-align: center;
  color: var(--scene-ink);
}
.timeline p {
  font-size: 1rem;
  margin-top: 2px;
}
.poskus {
  border: 2px dashed color-mix(in srgb, var(--c) 55%, transparent);
}
.kaj {
  margin-top: 12px !important;
  padding: 12px 14px;
  border-radius: 14px;
  background: color-mix(in srgb, var(--c) 12%, transparent);
  font-size: 1rem;
}
.izdelki {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 14px;
}
.izdelek {
  padding: 14px 16px;
  border-radius: 18px;
  background: var(--bg-soft);
}
.izdelek h4 {
  margin: 0 0 6px;
  font-family: var(--font-head);
  font-size: 1.15rem;
}
.izdelek p {
  font-size: 0.98rem;
  margin-bottom: 8px;
}
.check {
  list-style: none;
  padding-left: 0 !important;
}
.check li {
  position: relative;
  padding-left: 26px;
  font-size: 0.95rem;
}
.check li::before {
  content: '';
  position: absolute;
  left: 2px;
  top: 3px;
  width: 14px;
  height: 14px;
  border-radius: 4px;
  border: 2px solid color-mix(in srgb, var(--c) 70%, var(--scene-ink));
}
.links a {
  font-weight: 800;
}
.dejstva small {
  display: block;
  color: var(--scene-muted);
}
@media (max-width: 720px) {
  .two {
    grid-template-columns: 1fr;
  }
  .timeline li {
    grid-template-columns: 1fr;
    gap: 4px;
  }
  .cas {
    justify-self: start;
  }
}
</style>

<style>
/* tisk: samo načrt ure, brez navigacije, noge in gumbov */
@media print {
  header.top,
  nav.mobile,
  footer,
  .no-print,
  .lise {
    display: none !important;
  }
  .izobr .card,
  .izobr .ura {
    box-shadow: none !important;
    break-inside: avoid;
  }
  body {
    background: #fff !important;
  }
}
</style>
