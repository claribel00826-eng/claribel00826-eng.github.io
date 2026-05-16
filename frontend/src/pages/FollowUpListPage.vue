<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'

import AppHeader from '@/components/AppHeader.vue'
import CustomerCard from '@/components/CustomerCard.vue'
import { useAppStore } from '@/stores/appStore'
import type { CustomerType } from '@/types/business'

const router = useRouter()
const store = useAppStore()
const active = ref<'all' | CustomerType>('all')

const tabs = [
  { key: 'all', label: '全部' },
  { key: 'old-timeout', label: '老客户超时' },
  { key: 'public-new', label: '公海新客户' },
] as const

const customers = computed(() =>
  active.value === 'all'
    ? store.followCustomers
    : store.followCustomers.filter((item) => item.type === active.value),
)

const followCounts = computed(() => {
  const m: Record<string, number> = {}
  for (const f of store.followUpRecords) {
    m[f.customerId] = (m[f.customerId] ?? 0) + 1
  }
  return m
})

const select = (id: string) => {
  store.setCustomer(id)
  router.push({ path: `/follow-customer/${id}`, query: { from: 'follow-ups' } })
}
</script>

<template>
  <main class="app-shell app-shell--fit follow-list-shell">
    <AppHeader title="待跟进客户" />
    <section class="page">
      <div class="tabs">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          :class="{ active: active === tab.key }"
          type="button"
          @click="active = tab.key"
        >
          {{ tab.label }}
        </button>
      </div>
      <section class="list">
        <CustomerCard
          v-for="customer in customers"
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
.follow-list-shell {
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
  overflow-x: hidden;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  display: grid;
  gap: 8px;
  align-content: start;
}

.tabs {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-bottom: 14px;
}

.tabs button {
  border: 0;
  border-radius: 999px;
  color: var(--muted);
  background: #fff;
  font-weight: 800;
}

.tabs .active {
  color: #fff;
  background: var(--primary);
}
</style>
