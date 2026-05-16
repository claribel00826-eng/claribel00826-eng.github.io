<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'

import AppHeader from '@/components/AppHeader.vue'
import CustomerBar from '@/components/CustomerBar.vue'
import type { Proposal } from '@/types/business'
import { useAppStore } from '@/stores/appStore'

const store = useAppStore()
const router = useRouter()

const list = computed(() => store.proposalsCurrentCustomer)

function formatTime(iso: string) {
  try {
    const d = new Date(iso)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  } catch {
    return iso
  }
}

function openPdf(p: Proposal) {
  router.push({ name: 'proposal-pdf', params: { id: p.id } })
}

function revise(p: Proposal) {
  store.startProposalRevision(p.id)
  router.push({ path: '/quick-scheme', query: { step: 'cart' } })
}
</script>

<template>
  <main class="app-shell proposal-history-shell">
    <AppHeader title="方案历史" />
    <section class="page">
      <CustomerBar />
      <p v-if="list.length === 0" class="empty card">当前客户暂无已保存方案。</p>
      <ul v-else class="list">
        <li v-for="p in list" :key="p.id" class="card row">
          <div class="meta">
            <strong>{{ p.name }}</strong>
            <span class="sub">{{ formatTime(p.createdAt) }} · {{ p.itemCount }} 项 · ¥{{ p.totalAmount }}</span>
          </div>
          <div class="btns">
            <button class="ghost-btn" type="button" @click="openPdf(p)">预览 / 导出</button>
            <button class="primary-btn" type="button" @click="revise(p)">变更</button>
          </div>
        </li>
      </ul>
    </section>
  </main>
</template>

<style scoped>
.proposal-history-shell {
  /* 无底部全局输入条时收紧留白，与方案速配一致 */
  padding-bottom: calc(20px + env(safe-area-inset-bottom));
}

.page {
  padding-bottom: 24px;
}

.empty {
  padding: 20px;
  color: var(--muted);
  text-align: center;
}

.list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 10px;
}

.row {
  display: grid;
  gap: 12px;
  padding: 14px;
}

.meta {
  display: grid;
  gap: 6px;
}

.meta strong {
  font-size: 15px;
  font-weight: 800;
}

.sub {
  font-size: 13px;
  color: var(--muted);
}

.btns {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.btns :deep(button) {
  width: 100%;
  box-sizing: border-box;
  min-height: 44px;
  padding: 0 12px;
  font-size: 14px;
  font-weight: 800;
}
</style>
