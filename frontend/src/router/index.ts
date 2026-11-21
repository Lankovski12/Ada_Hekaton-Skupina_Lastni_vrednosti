import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '@/views/HomeView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  scrollBehavior: () => ({ top: 0 }),
  routes: [
    { path: '/', name: 'domov', component: HomeView },
    { path: '/otroci', name: 'otroci', component: () => import('@/views/OtrociView.vue') },
    { path: '/starsi', name: 'starsi', component: () => import('@/views/StarsiView.vue') },
    { path: '/nastavitve', name: 'nastavitve', component: () => import('@/views/NastavitveView.vue') },
    // Igre – vsaka je svoja komponenta v src/games/<ime>/
    { path: '/igre/zmaj', name: 'igra-zmaj', component: () => import('@/games/zmaj/ZmajGame.vue') },
    { path: '/igre/ujemanje', name: 'igra-ujemanje', component: () => import('@/games/ujemanje/UjemanjeGame.vue') },
    { path: '/igre/daily', name: 'igra-daily', component: () => import('@/games/daily/DailyGame.vue') },
  ],
})

export default router
