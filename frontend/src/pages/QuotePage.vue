<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import AppHeader from '@/components/AppHeader.vue'
import CustomerBar from '@/components/CustomerBar.vue'
import { useAppStore } from '@/stores/appStore'
import type { Quote } from '@/types/business'

type Step = 'pick' | 'inquiry'

interface InquiryRow {
  productId: string
  name: string
  spec: string
  quantity: number
  unit: string
  /** 系统参照：最低售价（Mock：按方案行单价折算，上线对齐报价引擎） */
  minPrice: number
  /** 系统参照：最新售价 / 列表价（Mock：沿用方案保存单价） */
  latestPrice: number
  /** 用户填报：本次报价单价 */
  quotedUnitPrice: number
}

const router = useRouter()
const route = useRoute()
const store = useAppStore()

const step = ref<Step>('pick')
const selectedProposalId = ref('')

const inquiryRows = ref<InquiryRow[]>([])

const proposals = computed(() => store.proposalsCurrentCustomer)

/** 从报价 PDF「修改报价单」回带时，与 route.query.quote 对齐，用于覆盖保存 */
const editingQuoteId = computed(() => (typeof route.query.quote === 'string' ? route.query.quote : ''))

const inquirySubtotal = computed(() =>
  inquiryRows.value.reduce((s, row) => s + row.quantity * row.quotedUnitPrice, 0),
)

const total = computed(() => Math.max(0, inquirySubtotal.value))

function lineRowTotal(row: InquiryRow) {
  return Math.max(0, row.quantity * row.quotedUnitPrice)
}

function syncDefaultSelection(prefId?: string) {
  const list = proposals.value
  if (!list.length) {
    selectedProposalId.value = ''
    return
  }
  let id = prefId && list.some((p) => p.id === prefId) ? prefId : ''
  if (!id && list.some((p) => p.id === store.proposal.id)) id = store.proposal.id
  if (!id) id = list[0].id
  selectedProposalId.value = id
  store.setActiveProposal(id)
}

function buildInquiryRows() {
  const p = store.proposal
  inquiryRows.value = p.lines.map((line) => ({
    productId: line.productId,
    name: line.name,
    spec: line.spec,
    quantity: line.quantity,
    unit: line.unit,
    minPrice: Math.round(line.price * 94) / 100,
    latestPrice: line.price,
    quotedUnitPrice: line.price,
  }))
}

function buildInquiryRowsFromQuote(q: Quote) {
  const lines = q.lines ?? []
  inquiryRows.value = lines.map((line) => ({
    productId: line.productId,
    name: line.name,
    spec: line.spec,
    quantity: line.quantity,
    unit: line.unit,
    minPrice: line.minPrice ?? Math.round(line.quotedUnitPrice * 94) / 100,
    latestPrice: line.latestPrice ?? line.quotedUnitPrice,
    quotedUnitPrice: line.quotedUnitPrice,
  }))
}

function goPick() {
  step.value = 'pick'
  router.replace({ name: 'quote' })
}

function selectProposal(id: string) {
  selectedProposalId.value = id
  store.setActiveProposal(id)
}

function goInquiry() {
  if (!selectedProposalId.value) return
  store.setActiveProposal(selectedProposalId.value)
  buildInquiryRows()
  step.value = 'inquiry'
}

function generateQuoteSheet() {
  if (!inquiryRows.value.length) return
  const payload = {
    totalAmount: total.value,
    inquirySubtotal: inquirySubtotal.value,
    lines: inquiryRows.value.map((row) => ({
      productId: row.productId,
      name: row.name,
      spec: row.spec,
      quantity: row.quantity,
      unit: row.unit,
      quotedUnitPrice: row.quotedUnitPrice,
      minPrice: row.minPrice,
      latestPrice: row.latestPrice,
    })),
  }
  const qid = editingQuoteId.value
  if (qid && store.quotes.some((q) => q.id === qid)) {
    store.updateQuote(qid, payload)
  } else {
    store.saveQuote(payload)
  }
  router.push({ name: 'quote-pdf', params: { id: store.quote.id } })
}

function applyRouteProposal() {
  const qid = typeof route.query.quote === 'string' ? route.query.quote : ''
  if (qid) {
    const q = store.quotes.find((x) => x.id === qid)
    if (q) {
      const prop = store.proposals.find((p) => p.id === q.proposalId)
      if (prop) store.setCustomer(prop.customerId)
      store.setActiveQuote(q.id)
      store.setActiveProposal(q.proposalId)
      selectedProposalId.value = q.proposalId
      if (q.lines?.length) buildInquiryRowsFromQuote(q)
      else {
        syncDefaultSelection(q.proposalId)
        buildInquiryRows()
      }
      step.value = 'inquiry'
      return
    }
  }

  const pid = typeof route.query.proposal === 'string' ? route.query.proposal : ''
  syncDefaultSelection(pid || undefined)
  if (pid && proposals.value.some((p) => p.id === pid)) {
    step.value = 'inquiry'
    buildInquiryRows()
  } else {
    step.value = 'pick'
  }
}

onMounted(() => {
  applyRouteProposal()
})

watch(
  () => `${String(route.query.proposal || '')}|${String(route.query.quote || '')}`,
  () => {
    applyRouteProposal()
  },
)

watch(
  () => store.currentCustomerId,
  () => {
    inquiryRows.value = []
    syncDefaultSelection()
    step.value = 'pick'
  },
)

watch(
  proposals,
  () => {
    if (!proposals.value.length) {
      selectedProposalId.value = ''
      step.value = 'pick'
      inquiryRows.value = []
      return
    }
    if (!proposals.value.some((p) => p.id === selectedProposalId.value)) {
      syncDefaultSelection()
      if (step.value !== 'pick') {
        step.value = 'pick'
        inquiryRows.value = []
      }
    }
  },
  { deep: true },
)
</script>

<template>
  <main class="app-shell app-shell--fit quote-shell">
    <AppHeader title="产品报价" toolbar>
      <template #trailing>
        <button class="toolbar-link" type="button" @click="router.push('/quote-history')">
          历史报价
        </button>
      </template>
    </AppHeader>
    <section class="page quote-page">
      <CustomerBar />

      <nav class="quote-flow card" aria-label="报价步骤">
        <span class="quote-flow__i" :class="{ 'quote-flow__i--on': step === 'pick' }">① 选方案</span>
        <span class="quote-flow__sep">→</span>
        <span class="quote-flow__i" :class="{ 'quote-flow__i--on': step === 'inquiry' }">② 询价</span>
        <span class="quote-flow__sep">→</span>
        <span class="quote-flow__i quote-flow__i--muted">③ 生成报价单</span>
      </nav>

      <!-- ① 方案列表 -->
      <div v-show="step === 'pick'" class="quote-step">
        <header class="step-head">
          <h2 class="step-title">选择方案</h2>
          <p class="muted step-desc">当前客户已保存方案，点选后进入询价</p>
        </header>

        <p v-if="!proposals.length" class="hint card empty-card">
          暂无方案，请先到<strong>方案速配</strong>保存后再报价。
        </p>

        <ul v-else class="proposal-pick-list">
          <li v-for="p in proposals" :key="p.id">
            <button
              type="button"
              class="proposal-card card"
              :class="{ 'proposal-card--selected': p.id === selectedProposalId }"
              @click="selectProposal(p.id)"
            >
              <div class="proposal-card__top">
                <strong>{{ p.name }}</strong>
                <span class="pill">{{ p.itemCount }} 项</span>
              </div>
              <p class="muted proposal-card__meta">
                {{ p.createdAt.replace('T', ' ').slice(0, 16) }} · ¥{{ p.totalAmount }}
              </p>
            </button>
          </li>
        </ul>

        <button
          class="primary-btn full-btn"
          type="button"
          :disabled="!selectedProposalId"
          @click="goInquiry"
        >
          进入询价
        </button>
      </div>

      <!-- ② 询价 -->
      <div v-show="step === 'inquiry'" class="quote-step quote-step--inquiry">
        <header class="step-head">
          <h2 class="step-title">询价</h2>
          <p class="muted step-desc">方案「{{ store.proposal.name }}」· 填本次单价</p>
        </header>

        <button type="button" class="ghost-btn back-btn" @click="goPick">← 换方案</button>

        <div class="inquiry-table-wrap card">
          <table class="inquiry-table">
            <thead>
              <tr>
                <th>货品</th>
                <th>数</th>
                <th>最低</th>
                <th>最新</th>
                <th>报价</th>
                <th>小计</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, idx) in inquiryRows" :key="idx">
                <td class="td-name">
                  <span>{{ row.name }}</span>
                  <small class="muted">{{ row.spec }}</small>
                </td>
                <td>{{ row.quantity }}{{ row.unit }}</td>
                <td>¥{{ row.minPrice }}</td>
                <td>¥{{ row.latestPrice }}</td>
                <td>
                  <input
                    v-model.number="row.quotedUnitPrice"
                    class="price-input"
                    type="number"
                    min="0"
                    step="0.01"
                  />
                </td>
                <td>¥{{ lineRowTotal(row).toFixed(2) }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="inquiry-foot">
          <p class="subtotal-line">小计 <strong>¥{{ inquirySubtotal.toFixed(2) }}</strong> · 合计 <strong>¥{{ total.toFixed(2) }}</strong></p>
          <button
            class="primary-btn full-btn"
            type="button"
            :disabled="!inquiryRows.length"
            @click="generateQuoteSheet"
          >
            {{ editingQuoteId ? '保存并更新预览' : '生成报价单' }}
          </button>
        </div>
      </div>
    </section>
  </main>
</template>

<style scoped>
.quote-shell {
  padding-bottom: calc(12px + env(safe-area-inset-bottom, 0px));
}

.quote-page {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px 12px 0;
}

.quote-flow {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 4px 8px;
  padding: 8px 10px;
  margin: 0;
  font-size: 12px;
  font-weight: 800;
  flex-shrink: 0;
}

.quote-flow__i--on {
  color: var(--primary);
}

.quote-flow__i--muted {
  color: var(--muted);
  font-weight: 700;
}

.quote-flow__sep {
  color: var(--muted);
  font-weight: 700;
}

.quote-step {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.quote-step--inquiry .inquiry-table-wrap {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.inquiry-foot {
  flex-shrink: 0;
  padding-top: 6px;
}

.toolbar-link {
  min-height: 36px;
  padding: 0 10px;
  border: 0;
  border-radius: 10px;
  background: #eff6ff;
  color: var(--primary);
  font-weight: 900;
  font-size: 12px;
  white-space: nowrap;
}

.step-head {
  margin-bottom: 8px;
  flex-shrink: 0;
}

.step-title {
  margin: 0 0 4px;
  font-size: 1.05rem;
}

.step-desc {
  margin: 0;
  font-size: 12px;
  line-height: 1.35;
}

.muted {
  color: var(--muted);
}

.empty-card {
  padding: 12px;
  margin-bottom: 8px;
  flex-shrink: 0;
}

.proposal-pick-list {
  list-style: none;
  margin: 0 0 10px;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.proposal-card {
  width: 100%;
  text-align: left;
  padding: 10px 12px;
  border: 2px solid transparent;
  cursor: pointer;
  background: var(--card-bg, #fff);
  flex-shrink: 0;
}

.proposal-card--selected {
  border-color: var(--primary);
}

.proposal-card__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.proposal-card__meta {
  margin: 6px 0 0;
  font-size: 11px;
}

.pill {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--pill-bg, rgba(0, 0, 0, 0.06));
  font-size: 11px;
}

.back-btn {
  margin-bottom: 8px;
  align-self: flex-start;
  flex-shrink: 0;
}

.inquiry-table-wrap {
  padding: 6px;
  margin-bottom: 0;
}

.inquiry-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 11px;
}

.inquiry-table th,
.inquiry-table td {
  padding: 6px 4px;
  border-bottom: 1px solid var(--border, #e8e8e8);
  vertical-align: top;
}

.inquiry-table th {
  text-align: left;
  white-space: nowrap;
  color: var(--muted);
  font-weight: 600;
}

.td-name {
  min-width: 72px;
}

.td-name small {
  display: block;
  margin-top: 2px;
}

.price-input {
  width: 72px;
  padding: 4px 6px;
  border-radius: 8px;
  border: 1px solid var(--border, #ccc);
  font-size: 12px;
}

.subtotal-line {
  margin: 0 0 8px;
  font-size: 13px;
}

.full-btn {
  width: 100%;
}
</style>
