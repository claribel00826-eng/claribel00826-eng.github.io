<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'

import AppHeader from '@/components/AppHeader.vue'
import CustomerBar from '@/components/CustomerBar.vue'
import type { Quote } from '@/types/business'
import { useAppStore } from '@/stores/appStore'

const store = useAppStore()
const router = useRouter()

const list = computed(() => store.quotesCurrentCustomer)

function formatTime(iso?: string) {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  } catch {
    return iso
  }
}

function proposalTitle(proposalId: string) {
  return store.proposals.find((p) => p.id === proposalId)?.name || proposalId
}

function openPdf(q: Quote) {
  router.push({ name: 'quote-pdf', params: { id: q.id } })
}

/** 基于原方案重新走询价报价 */
function requote(q: Quote) {
  store.setActiveProposal(q.proposalId)
  router.push({ name: 'quote', query: { proposal: q.proposalId } })
}
</script>

<template>
  <main class="app-shell quote-history-shell">
    <AppHeader title="历史报价" />
    <section class="page">
      <CustomerBar />
      <p v-if="list.length === 0" class="empty card">当前客户暂无已保存报价单。</p>
      <ul v-else class="list">
        <li v-for="q in list" :key="q.id" class="card row">
          <div class="meta">
            <strong>{{ q.quoteNo }}</strong>
            <span class="sub"
              >{{ formatTime(q.createdAt) }} · {{ proposalTitle(q.proposalId) }} · ¥{{
                q.totalAmount
              }}</span
            >
          </div>
          <div class="btns">
            <button class="ghost-btn" type="button" @click="openPdf(q)">预览 / 导出</button>
            <button class="primary-btn" type="button" @click="requote(q)">重新报价</button>
          </div>
        </li>
      </ul>
    </section>
  </main>
</template>

<style scoped>
.quote-history-shell {
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
