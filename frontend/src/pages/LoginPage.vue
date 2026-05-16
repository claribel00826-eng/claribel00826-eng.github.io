<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'

import { useAppStore } from '@/stores/appStore'
import { pickCustomerIdFromQuery } from '@/utils/wechatDeepLink'

const store = useAppStore()
const router = useRouter()
const route = useRoute()

const login = () => {
  store.login()
  const customerId = pickCustomerIdFromQuery(route.query)
  if (customerId && store.customers.some((c) => c.id === customerId)) {
    store.setCustomer(customerId)
    router.replace({ name: 'development' })
    return
  }
  router.replace({ path: '/home', query: {} })
}
</script>

<template>
  <main class="app-shell login-page">
    <section class="login-card card">
      <h1>智能销售助手</h1>
      <p>使用企业账号登录后使用工作台功能。</p>
      <button class="primary-btn full-btn" type="button" @click="login">授权登录</button>
    </section>
  </main>
</template>

<style scoped>
.login-page {
  display: grid;
  place-items: center;
  padding: 24px;
}

.login-card {
  width: 100%;
  max-width: 400px;
  padding: 24px;
}

h1 {
  margin: 0 0 10px;
  font-size: 28px;
}

p {
  margin: 0 0 24px;
  color: var(--muted);
  line-height: 1.7;
}
</style>
