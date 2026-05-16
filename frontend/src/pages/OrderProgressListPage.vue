<script setup lang="ts">
import { useRouter } from 'vue-router'

import AppHeader from '@/components/AppHeader.vue'
import { useAppStore } from '@/stores/appStore'

const router = useRouter()
const store = useAppStore()
</script>

<template>
  <main class="app-shell">
    <AppHeader title="订单进度" />
    <section class="page list">
      <article v-for="order in store.orders" :key="order.id" class="order-card card">
        <div class="row">
          <span class="pill">{{ order.status }}</span>
          <span class="muted">{{ order.date }}</span>
        </div>
        <h3>{{ order.orderNo }}</h3>
        <p>{{ order.customerName }} · ¥{{ order.amount }}</p>
        <button class="primary-btn full-btn" type="button" @click="router.push(`/orders/${order.id}`)">
          查看详情
        </button>
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
  margin: 0 0 14px;
  color: var(--muted);
}
</style>
