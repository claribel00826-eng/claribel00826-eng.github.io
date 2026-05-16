<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'

import AppHeader from '@/components/AppHeader.vue'
import type { Customer } from '@/types/business'
import { useAppStore } from '@/stores/appStore'
import {
  formatRecentVisitLabel,
  getCheckpointOrderedCustomerIds,
  getCustomerCheckpoint,
} from '@/utils/customerCheckpoint'

const router = useRouter()
const store = useAppStore()

const modules = [
  { title: '方案速配', path: '/quick-scheme' },
  { title: '产品报价', path: '/quote' },
  { title: '交期评审', path: '/delivery' },
  { title: '生成订单', path: '/order-create' },
  { title: '订单复制', path: '/copy-order' },
  { title: '订单变更', path: '/order-change' },
  { title: '订单进度', path: '/orders' },
  { title: '客户服务', path: '/service' },
]

const recentCustomers = computed((): Customer[] => {
  const all = store.customers
  const ids = all.map((c) => c.id)
  const preferred = getCheckpointOrderedCustomerIds(ids)
  const seen = new Set<string>()
  const ordered: Customer[] = []
  for (const id of preferred) {
    const c = all.find((x) => x.id === id)
    if (c) {
      ordered.push(c)
      seen.add(id)
    }
    if (ordered.length >= 6) break
  }
  for (const c of all) {
    if (seen.has(c.id)) continue
    ordered.push(c)
    if (ordered.length >= 6) break
  }
  return ordered.slice(0, 6)
})

function resumeCustomer(c: Customer) {
  store.setCustomer(c.id)
  const cp = getCustomerCheckpoint(c.id)
  router.push(cp || '/quick-scheme?step=recommend')
}

function recentVisitLine(c: Customer) {
  return `${c.contact} · ${formatRecentVisitLabel(getCustomerCheckpoint(c.id))}`
}
</script>

<template>
  <main class="app-shell">
    <AppHeader title="智能销售助手" />
    <section class="page home-page">
      <button class="follow-strip card" type="button" @click="router.push('/follow-ups')">
        <span>待跟进客户</span>
        <strong>{{ store.followCustomers.length }} 位</strong>
      </button>

      <section class="function-grid">
        <button
          v-for="item in modules"
          :key="item.title"
          class="module-btn card"
          type="button"
          @click="router.push(item.path)"
        >
          {{ item.title }}
        </button>
      </section>

      <div class="section-title">
        <h2>最近客户</h2>
      </div>
      <section class="recent-list">
        <button
          v-for="customer in recentCustomers"
          :key="customer.id"
          class="recent-card card"
          type="button"
          @click="resumeCustomer(customer)"
        >
          <strong>{{ customer.name }}</strong>
          <span class="primary-line">{{ recentVisitLine(customer) }}</span>
        </button>
      </section>
    </section>
  </main>
</template>

<style scoped>
.home-page {
  padding-top: 6px;
}

.follow-strip {
  width: 100%;
  min-height: 56px;
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 2px 10px;
  align-items: center;
  border: 0;
  padding: 10px 14px;
  text-align: left;
}

.follow-strip span {
  font-weight: 800;
}

.follow-strip strong {
  color: var(--primary);
  font-size: 18px;
}

.function-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  margin-top: 12px;
}

.module-btn {
  min-height: 68px;
  border: 0;
  padding: 8px 6px;
  color: #23344d;
  font-size: 13px;
  font-weight: 900;
  line-height: 1.25;
}

.recent-list {
  display: grid;
  gap: 10px;
}

.recent-card {
  border: 0;
  padding: 12px;
  text-align: left;
}

.recent-card strong,
.recent-card span {
  display: block;
}

.primary-line {
  margin-top: 6px;
  color: var(--muted);
  font-size: 13px;
}

</style>
