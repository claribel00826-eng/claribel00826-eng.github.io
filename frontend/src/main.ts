import { createPinia } from 'pinia'
import { createApp } from 'vue'

import App from './App.vue'
import router from './router'
import { ensureFileHashHome, escapeFilePreviewFrame } from './utils/staticFileEnv'
import './styles/main.css'

/** 静态 HTML 导出包：无后端时预置登录态，避免全部落在登录页 */
if (import.meta.env.VITE_STATIC_EXPORT === 'true') {
  try {
    localStorage.setItem('token', 'mock-token-static-export')
  } catch {
    /* private mode */
  }
}

const blockedInPreviewFrame =
  import.meta.env.VITE_STATIC_EXPORT === 'true' && escapeFilePreviewFrame()

if (import.meta.env.VITE_STATIC_EXPORT === 'true' && !blockedInPreviewFrame) {
  ensureFileHashHome()
}

const app = createApp(App)

app.use(createPinia())
app.use(router)

if (!blockedInPreviewFrame) {
  app.mount('#app')
}
