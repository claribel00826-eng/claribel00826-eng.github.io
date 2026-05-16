<script setup lang="ts">
import { useRouter } from 'vue-router'

import AppHeader from '@/components/AppHeader.vue'
import { useAppStore } from '@/stores/appStore'

const router = useRouter()
const store = useAppStore()

const copy = () => {
  store.addToCart('p-001')
  router.push('/quick-scheme?step=cart')
}
</script>

<template>
  <main class="app-shell">
    <AppHeader title="订单复制" />
    <section class="page list">
      <article v-for="order in store.orders" :key="order.id" class="order-card card">
        <div class="row">
          <span class="pill">{{ order.status }}</span>
          <strong>{{ order.orderNo }}</strong>
        </div>
        <h3>{{ order.customerName }}</h3>
        <p>{{ order.date }} · ¥{{ order.amount }}</p>
        <button class="primary-btn full-btn" type="button" @click="copy">复制到购物车</button>
      </article>
    </section>
  </main>
</template>

<style scoped>
.order-card {
  padding: 14px;
}

h3 {
  margin: 12px 0 6px;
}

p {
  color: var(--muted);
}
</style>
