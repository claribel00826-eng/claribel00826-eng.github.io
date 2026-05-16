<script setup lang="ts">
import { useRouter } from 'vue-router'

import { useAppStore } from '@/stores/appStore'

const store = useAppStore()
const router = useRouter()
</script>

<template>
  <section class="customer-bar card">
    <div>
      <h2>{{ store.currentCustomer.name }}</h2>
      <p>{{ store.currentCustomer.contact }} · {{ store.currentCustomer.phone }}</p>
    </div>
    <button class="ghost-btn" type="button" @click="router.push('/customers')">换客户</button>
  </section>
</template>

<style scoped>
.customer-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px;
  margin-bottom: 14px;
}

h2 {
  margin: 0 0 4px;
  font-size: 18px;
  font-weight: 800;
}

p {
  margin: 0;
  color: var(--muted);
  font-size: 13px;
}

button {
  flex: 0 0 auto;
}
</style>
