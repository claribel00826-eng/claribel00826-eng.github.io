<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import AppHeader from '@/components/AppHeader.vue'
import CustomerBar from '@/components/CustomerBar.vue'
import { mockDeliveryPrediction } from '@/services/deliveryPredictionMock'
import { useAppStore } from '@/stores/appStore'
import type { DeliveryPrediction } from '@/types/business'

const router = useRouter()
const store = useAppStore()

const selectedQuoteId = ref('')
const expectedDate = ref('2026-06-20')
const predicting = ref(false)
const prediction = ref<DeliveryPrediction | null>(null)

const quotes = computed(() => store.quotesCurrentCustomer)

function proposalName(proposalId: string) {
  return store.proposals.find((p) => p.id === proposalId)?.name || proposalId
}

function syncQuoteSelection() {
  const list = quotes.value
  if (!list.length) {
    selectedQuoteId.value = ''
    prediction.value = null
    return
  }
  const preferred =
    list.find((q) => q.id === store.quote.id)?.id ||
    list.find((q) => q.proposalId === store.proposal.id)?.id ||
    list[0].id
  selectedQuoteId.value = preferred
  store.setActiveQuote(preferred)
}

watch(quotes, syncQuoteSelection, { immediate: true })

watch(selectedQuoteId, (id) => {
  if (id) store.setActiveQuote(id)
  prediction.value = null
})

watch(
  () => store.currentCustomerId,
  () => {
    prediction.value = null
  },
)

watch(expectedDate, () => {
  prediction.value = null
})

async function runPrediction() {
  if (!selectedQuoteId.value) return
  predicting.value = true
  prediction.value = null
  try {
    const q = store.quotes.find((x) => x.id === selectedQuoteId.value)
    if (!q) return
    prediction.value = await mockDeliveryPrediction(expectedDate.value, q)
  } finally {
    predicting.value = false
  }
}

const goOrderCreate = () => {
  if (!prediction.value?.pass) return
  store.completeDeliveryReview()
  router.push('/order-create')
}
</script>

<template>
  <main class="app-shell">
    <AppHeader title="交期评审" />
    <section class="page">
      <CustomerBar />
      <p class="hint muted">
        <strong>① 选择客户</strong>：在上方客户条切换当前客户（或进入客户选择器）。
      </p>

      <section class="card block">
        <h2 class="block-title">② 选择报价单</h2>
        <p v-if="!quotes.length" class="empty-text">
          当前客户暂无报价单，请先到<strong>产品报价</strong>保存报价后再评审。
        </p>
        <ul v-else class="quote-list">
          <li v-for="q in quotes" :key="q.id">
            <label class="quote-row">
              <input v-model="selectedQuoteId" type="radio" name="delivery-quote" :value="q.id" />
              <div class="quote-row__body">
                <strong>{{ q.quoteNo }}</strong>
                <span class="muted small">{{ proposalName(q.proposalId) }}</span>
                <span class="amount">¥{{ q.totalAmount }}</span>
              </div>
            </label>
          </li>
        </ul>
      </section>

      <section class="card block">
        <h2 class="block-title">③ 输入期望交期</h2>
        <div class="form-field">
          <label for="expected-date">期望交付日期</label>
          <input id="expected-date" v-model="expectedDate" type="date" />
        </div>
      </section>

      <button
        class="primary-btn full-btn"
        type="button"
        :disabled="!selectedQuoteId || predicting"
        @click="runPrediction"
      >
        {{ predicting ? '生成预测中…' : '④ 生成预测' }}
      </button>

      <template v-if="prediction">
        <div class="section-title">
          <h2>⑤ 预测结果</h2>
          <span class="pill" :class="prediction.pass ? 'pill--ok' : 'pill--warn'">
            {{ prediction.pass ? '评审通过' : '评审未通过' }}
          </span>
        </div>

        <section class="card summary-grid">
          <div class="cell">
            <span class="label">是否预计按期交付</span>
            <strong :class="prediction.onTime ? 'ok' : 'bad'">{{
              prediction.onTime ? '是' : '否'
            }}</strong>
          </div>
          <div class="cell">
            <span class="label">是否齐套</span>
            <strong :class="prediction.kitComplete ? 'ok' : 'bad'">{{
              prediction.kitComplete ? '是' : '否'
            }}</strong>
          </div>
        </section>

        <section class="card narrative-card">
          <h3 class="sub-title">延期 / 卡点（结构化）</h3>
          <p class="body-text">{{ prediction.bottleneck }}</p>
          <h3 class="sub-title">交付说明（话术归纳）</h3>
          <p class="body-text muted-note">
            以下段落由<strong>大模型</strong>基于引擎要点归纳，便于对内复述；最终以计划与物料确认为准。
          </p>
          <p class="body-text narrative">{{ prediction.narrative }}</p>
        </section>

        <div class="actions">
          <button class="ghost-btn" type="button" @click="router.push('/adjust')">调整方案</button>
          <button class="ghost-btn" type="button" @click="router.push('/rush-order')">申请插单</button>
          <button
            class="primary-btn"
            type="button"
            :disabled="!prediction.pass"
            @click="goOrderCreate"
          >
            生成订单
          </button>
        </div>
        <p v-if="!prediction.pass" class="footer-hint muted">
          评审未通过时请先调整交期、方案或走插单流程后重新生成预测。
        </p>
      </template>
    </section>
  </main>
</template>

<style scoped>
.page {
  padding-bottom: 28px;
}

.hint {
  font-size: 13px;
  line-height: 1.5;
  margin-bottom: 12px;
}

.block {
  padding: 14px;
  margin-bottom: 12px;
}

.block-title {
  margin: 0 0 10px;
  font-size: 15px;
}

.empty-text {
  margin: 0;
  font-size: 13px;
  color: var(--muted);
}

.quote-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.quote-row {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  padding: 10px 0;
  border-bottom: 1px solid var(--border, #eee);
  cursor: pointer;
}

.quote-row:last-child {
  border-bottom: none;
}

.quote-row__body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.small {
  font-size: 12px;
}

.amount {
  font-weight: 700;
  color: var(--primary);
}

.form-field {
  margin-top: 4px;
}

.form-field label {
  display: block;
  margin-bottom: 6px;
  font-size: 13px;
}

.form-field input[type='date'] {
  width: 100%;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid var(--border, #ccc);
}

.full-btn {
  width: 100%;
  margin-bottom: 16px;
}

.section-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin: 8px 0 10px;
}

.section-title h2 {
  margin: 0;
  font-size: 16px;
}

.pill {
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  background: var(--pill-bg, rgba(0, 0, 0, 0.06));
}

.pill--ok {
  background: rgba(34, 197, 94, 0.15);
  color: #15803d;
}

.pill--warn {
  background: rgba(245, 158, 11, 0.2);
  color: #b45309;
}

.summary-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  padding: 14px;
  margin-bottom: 10px;
}

.cell .label {
  display: block;
  font-size: 12px;
  color: var(--muted);
  margin-bottom: 6px;
}

.cell strong {
  font-size: 18px;
}

.ok {
  color: #15803d;
}

.bad {
  color: #b45309;
}

.narrative-card {
  padding: 14px;
  margin-bottom: 12px;
}

.sub-title {
  margin: 14px 0 8px;
  font-size: 14px;
}

.sub-title:first-child {
  margin-top: 0;
}

.body-text {
  margin: 0;
  line-height: 1.65;
  font-size: 14px;
}

.muted-note {
  font-size: 12px;
  color: var(--muted);
}

.narrative {
  white-space: pre-wrap;
}

.actions {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 8px;
  margin-top: 14px;
}

.footer-hint {
  margin-top: 10px;
  font-size: 12px;
  text-align: center;
}
</style>
