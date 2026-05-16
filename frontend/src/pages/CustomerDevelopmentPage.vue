<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'

import AppHeader from '@/components/AppHeader.vue'
import CustomerCard from '@/components/CustomerCard.vue'
import { useAppStore } from '@/stores/appStore'

const router = useRouter()
const store = useAppStore()

const followCounts = computed(() => {
  const m: Record<string, number> = {}
  for (const f of store.followUpRecords) {
    m[f.customerId] = (m[f.customerId] ?? 0) + 1
  }
  return m
})

const select = (id: string) => {
  store.setCustomer(id)
  router.push(`/follow-customer/${id}`)
}
</script>

<template>
  <main class="app-shell app-shell--fit dev-shell">
    <AppHeader title="客户开拓" />
    <section class="page">
      <section class="list">
        <CustomerCard
          v-for="customer in store.followCustomers"
          :key="customer.id"
          :customer="customer"
          :follow-up-count="followCounts[customer.id] ?? 0"
          action-text="查看详情"
          @select="select(customer.id)"
        />
      </section>
    </section>
  </main>
</template>

<style scoped>
.dev-shell {
  padding-bottom: calc(12px + env(safe-area-inset-bottom, 0px));
}

.page {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 8px 12px 0;
}

.list {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: grid;
  gap: 8px;
  align-content: start;
}
</style>
