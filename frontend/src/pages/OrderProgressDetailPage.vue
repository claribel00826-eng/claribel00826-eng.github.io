<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import AppHeader from '@/components/AppHeader.vue'
import { useAppStore } from '@/stores/appStore'

const route = useRoute()
const store = useAppStore()
const order = computed(() => store.orders.find((item) => item.id === route.params.id) || store.orders[0])
</script>

<template>
  <main class="app-shell">
    <AppHeader title="订单详情" />
    <section class="page">
      <section class="card detail-card">
        <span class="pill">{{ order.status }}</span>
        <h2>{{ order.orderNo }}</h2>
        <p>{{ order.customerName }} · {{ order.date }}</p>
      </section>
      <div class="section-title">
        <h2>进度节点</h2>
      </div>
      <section class="timeline card">
        <div v-for="step in order.progress" :key="step.title" class="step">
          <span :class="['dot', step.status]" />
          <div>
            <strong>{{ step.title }}</strong>
            <p>{{ step.status }}</p>
          </div>
        </div>
      </section>
    </section>
  </main>
</template>

<style scoped>
.detail-card {
  padding: 16px;
}

h2 {
  margin: 12px 0 6px;
}

p {
  margin: 0;
  color: var(--muted);
}

.timeline {
  padding: 16px;
}

.step {
  display: grid;
  grid-template-columns: 18px 1fr;
  gap: 12px;
  padding: 10px 0;
}

.dot {
  width: 12px;
  height: 12px;
  margin-top: 4px;
  border-radius: 50%;
  background: var(--line);
}

.已完成 {
  background: var(--success);
}

.进行中 {
  background: var(--primary);
}
</style>
