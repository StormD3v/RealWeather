import './assets/main.css'
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'

const app = createApp(App)

if (import.meta.env.MODE !== 'development') {
    app.config.devtools = false
}

app.use(createPinia())
app.mount('#app')
