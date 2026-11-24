import './assets/main.css'
import './assets/story.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import { initAnalytics } from './analytics/posthog'

const app = createApp(App)

app.use(createPinia())
app.use(router)

app.mount('#app')

// anonimna statistika obiska (PostHog, brez piškotkov); brez ključa se ne zažene
void initAnalytics()
