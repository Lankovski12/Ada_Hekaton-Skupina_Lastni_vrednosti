import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '@/views/HomeView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  scrollBehavior: () => ({ top: 0 }),
  routes: [
    { path: '/', name: 'domov', component: HomeView },
    { path: '/igre', name: 'igre', component: () => import('@/views/OtrociView.vue') },
    { path: '/zemljevid', name: 'zemljevid', component: () => import('@/views/ZemljevidView.vue') },
    { path: '/grafi', name: 'grafi', component: () => import('@/views/GrafiView.vue') },
    { path: '/moj-zrak', name: 'moj-zrak', component: () => import('@/views/MojZrakView.vue') },
    // stari naslovi (nekdanja zavihka Naloge in Blogi)
    { path: '/otroci', redirect: '/igre' },
    { path: '/starsi', redirect: '/grafi' },
    // Igre – vsaka je svoja komponenta v src/games/<ime>/
    { path: '/igre/zmaj', name: 'igra-zmaj', component: () => import('@/games/zmaj/ZmajGame.vue') },
    { path: '/igre/ujemanje', redirect: '/igre' },
    { path: '/igre/daily', name: 'igra-daily', component: () => import('@/games/daily/DailyGame.vue') },
    { path: '/igre/pokrovka', name: 'igra-pokrovka', component: () => import('@/games/pokrovka/PokrovkaGame.vue') },
  ],
})

// Po novi gradnji (npr. docker compose up --build) ima stara odprta stran še stara imena datotek.
// Če se stran ne naloži, enkrat osvežimo celo aplikacijo, da dobi novo različico.
router.onError((err, to) => {
  const stale = /dynamically imported module|Importing a module script failed|Failed to fetch/i.test(String(err?.message))
  if (!stale) return
  try {
    if (sessionStorage.getItem('reloaded-for') === to.fullPath) return // že poskusili – ne osvežuj v nedogled
    sessionStorage.setItem('reloaded-for', to.fullPath)
  } catch {
    /* sessionStorage ni na voljo – vseeno osvežimo enkrat */
  }
  window.location.assign(to.fullPath)
})
router.afterEach((to) => {
  try {
    sessionStorage.removeItem('reloaded-for')
  } catch {
    /* ni pomembno */
  }
  prestejObisk(to.path)
})

// Štetje obiskov z GoatCounter (index.html). Stran je ena aplikacija in ob prehodu med zavihki ne naloži
// nove strani, zato vsak prehod preštejemo sami. Samo pot (brez ?datum=… ipd.), brez piškotkov.
// Na localhost GoatCounter sam ne šteje. Če ga blokira oglasni filter, se ne zgodi nič.
type GoatCounter = { count?: (o: { path: string }) => void }
function prestejObisk(path: string) {
  const gc = (window as unknown as { goatcounter?: GoatCounter }).goatcounter
  if (gc?.count) {
    gc.count({ path })
    return
  }
  // skripta se nalaga asinhrono: ob prvem obisku počakamo, da se naloži
  document.querySelector('script[data-goatcounter]')?.addEventListener('load', () => prestejObisk(path), { once: true })
}

export default router
