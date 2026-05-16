<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import AppHeader from '@/components/AppHeader.vue'
import { useAppStore } from '@/stores/appStore'
import { elementToPdfBlob } from '@/utils/elementToPdfBlob'
import type { ProposalLine, QuoteLineSnapshot } from '@/types/business'

const route = useRoute()
const router = useRouter()
const store = useAppStore()

const captureRef = ref<HTMLElement | null>(null)
const previewUrl = ref('')
const generating = ref(true)
const errorText = ref('')
const skipModalOpen = ref(false)

const quoteId = computed(() => String(route.params.id || ''))

const quote = computed(() => store.quotes.find((q) => q.id === quoteId.value))

const proposal = computed(() => store.proposals.find((p) => p.id === quote.value?.proposalId))

const customerName = computed(() => {
  const c = store.customers.find((x) => x.id === proposal.value?.customerId)
  return c?.name || '—'
})

/** PDF 行：优先报价快照，旧数据回落方案行 */
const pdfLines = computed(() => {
  const q = quote.value
  const p = proposal.value
  if (!q || !p) return []
  const snaps = q.lines
  if (snaps?.length) {
    return snaps.map((row: QuoteLineSnapshot) => ({
      name: row.name,
      spec: row.spec,
      quantity: row.quantity,
      unit: row.unit,
      minPrice: row.minPrice ?? row.latestPrice ?? row.quotedUnitPrice,
      latestPrice: row.latestPrice ?? row.quotedUnitPrice,
      unitPrice: row.quotedUnitPrice,
      lineTotal: row.quantity * row.quotedUnitPrice,
    }))
  }
  return p.lines.map((row: ProposalLine) => ({
    name: row.name,
    spec: row.spec,
    quantity: row.quantity,
    unit: row.unit,
    minPrice: row.price,
    latestPrice: row.price,
    unitPrice: row.price,
    lineTotal: row.price * row.quantity,
  }))
})

function revokeUrl() {
  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value)
    previewUrl.value = ''
  }
}

async function buildPreview() {
  errorText.value = ''
  generating.value = true
  revokeUrl()
  await nextTick()
  const el = captureRef.value
  if (!el || !quote.value || !proposal.value) {
    generating.value = false
    errorText.value = '未找到该报价单'
    return
  }
  try {
    const blob = await elementToPdfBlob(el)
    previewUrl.value = URL.createObjectURL(blob)
  } catch {
    errorText.value = 'PDF 生成失败，请重试'
  } finally {
    generating.value = false
  }
}

function exportPdf() {
  const q = quote.value
  if (!q || !previewUrl.value) return
  const a = document.createElement('a')
  const safe = `${q.quoteNo}`.replace(/[/\\?%*:|"<>]/g, '-').slice(0, 80)
  a.href = previewUrl.value
  a.download = `${safe}.pdf`
  a.click()
}

function goDelivery() {
  router.push({ name: 'delivery' })
}

function openDirectOrderModal() {
  skipModalOpen.value = true
}

function cancelSkip() {
  skipModalOpen.value = false
}

function confirmDirectOrder() {
  store.confirmSkipDeliveryReview()
  skipModalOpen.value = false
  router.push({ name: 'order-create' })
}

function goEditQuote() {
  const q = quote.value
  const p = proposal.value
  if (!q || !p) return
  store.setCustomer(p.customerId)
  store.setActiveProposal(p.id)
  store.setActiveQuote(q.id)
  router.push({ name: 'quote', query: { proposal: p.id, quote: q.id } })
}

watch(
  () => {
    const id = quoteId.value
    const q = id ? store.quotes.find((x) => x.id === id) : undefined
    return `${id}|${q?.createdAt ?? ''}|${q?.totalAmount ?? ''}`
  },
  () => {
    const id = quoteId.value
    if (id) store.setActiveQuote(id)
    void buildPreview()
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  revokeUrl()
})
</script>

<template>
  <main class="app-shell quote-pdf-shell">
    <AppHeader :title="quote?.quoteNo || '报价预览'" compact />

    <div class="quote-pdf-flow">
      <p v-if="generating" class="hint">正在生成报价单 PDF…</p>
      <p v-else-if="errorText" class="err">{{ errorText }}</p>

      <div v-if="previewUrl && !generating && !errorText" class="frame-wrap card">
        <iframe class="pdf-frame" title="报价预览" :src="previewUrl" />
      </div>
    </div>

    <footer class="action-bar action-bar--fixed card" aria-label="报价单操作">
      <button
        type="button"
        class="ghost-btn action-bar__btn"
        :disabled="!quote || !proposal"
        @click="goEditQuote"
      >
        修改报价单
      </button>
      <button type="button" class="ghost-btn action-bar__btn" :disabled="!previewUrl" @click="exportPdf">
        导出
      </button>
      <button type="button" class="ghost-btn action-bar__btn" @click="goDelivery">交期评审</button>
      <button type="button" class="primary-btn action-bar__btn" @click="openDirectOrderModal">
        直接下单
      </button>
    </footer>

    <div class="capture-host" aria-hidden="true">
      <div v-if="quote && proposal" ref="captureRef" class="capture-root">
        <h1 class="cap-title">销售报价单</h1>
        <p class="cap-line"><strong>报价单号：</strong>{{ quote.quoteNo }}</p>
        <p class="cap-line"><strong>关联方案：</strong>{{ proposal.name }}</p>
        <p class="cap-line"><strong>客户：</strong>{{ customerName }}</p>
        <p class="cap-line">
          <strong>生成时间：</strong>{{ quote.createdAt?.replace('T', ' ').slice(0, 19) || '—' }}
        </p>
        <p class="cap-line"><strong>有效期至：</strong>{{ quote.validUntil }}</p>
        <table class="cap-table">
          <thead>
            <tr>
              <th>产品</th>
              <th>规格</th>
              <th>数量</th>
              <th>最低售价</th>
              <th>最新售价</th>
              <th>本次单价</th>
              <th>小计</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, idx) in pdfLines" :key="idx">
              <td>{{ row.name }}</td>
              <td>{{ row.spec }}</td>
              <td>{{ row.quantity }}{{ row.unit }}</td>
              <td>¥{{ row.minPrice }}</td>
              <td>¥{{ row.latestPrice }}</td>
              <td>¥{{ row.unitPrice }}</td>
              <td>¥{{ row.lineTotal }}</td>
            </tr>
          </tbody>
        </table>
        <p v-if="quote.inquirySubtotal != null" class="cap-line">
          <strong>询价小计：</strong>¥{{ quote.inquirySubtotal }}
        </p>
        <p class="cap-total"><strong>报价合计：</strong>¥{{ quote.totalAmount }}</p>
      </div>
    </div>

    <Teleport to="body">
      <div
        v-if="skipModalOpen"
        class="h5-modal-overlay"
        role="dialog"
        aria-modal="true"
        aria-labelledby="quote-skip-modal-title"
      >
        <div class="h5-modal-backdrop" tabindex="-1" @click="cancelSkip" />
        <div class="h5-modal-panel card" role="document" @click.stop>
          <h3 id="quote-skip-modal-title">直接生成订单</h3>
          <p>未经过交期评审即下单可能存在交付与齐套风险，请确认已与客户及内部对齐。</p>
          <div class="h5-modal-actions">
            <button class="ghost-btn" type="button" @click="cancelSkip">取消</button>
            <button class="primary-btn" type="button" @click="confirmDirectOrder">确认并去下单</button>
          </div>
        </div>
      </div>
    </Teleport>
  </main>
</template>

<style scoped>
.quote-pdf-shell {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  padding-bottom: calc(104px + env(safe-area-inset-bottom, 0px));
  box-sizing: border-box;
}

.quote-pdf-flow {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  width: min(430px, 100vw);
  margin: 0 auto;
}

.action-bar {
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: auto auto;
  gap: 8px 10px;
  padding: 10px 12px;
  box-sizing: border-box;
}

.action-bar--fixed {
  position: fixed;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: min(430px, 100vw);
  margin: 0;
  z-index: 40;
  padding-bottom: calc(10px + env(safe-area-inset-bottom, 0px));
  border-radius: 0;
  border-left: none;
  border-right: none;
  border-bottom: none;
  box-shadow: 0 -6px 20px rgba(23, 32, 51, 0.08);
  background: rgba(255, 255, 255, 0.97);
  backdrop-filter: blur(12px);
}

.action-bar__btn {
  min-height: 44px;
  padding: 0 8px;
  font-size: 13px;
  font-weight: 800;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.hint,
.err {
  flex-shrink: 0;
  text-align: center;
  padding: 8px 12px;
  margin: 0 auto;
  max-width: min(430px, 100vw);
  font-size: 12px;
  line-height: 1.45;
}
.err {
  color: var(--danger);
}

.frame-wrap {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  margin: 10px auto 12px;
  width: 100%;
  padding: 0;
  overflow: hidden;
}

.pdf-frame {
  flex: 1;
  width: 100%;
  min-height: 120px;
  border: 0;
  background: #525659;
}

.capture-host {
  position: fixed;
  left: -10000px;
  top: 0;
  width: 900px;
  padding: 0;
  pointer-events: none;
  opacity: 0.02;
}

.capture-root {
  width: 900px;
  padding: 40px 48px;
  background: #fff;
  color: #111;
  font-size: 13px;
  line-height: 1.5;
  font-family: 'PingFang SC', 'Microsoft YaHei', system-ui, sans-serif;
}

.cap-title {
  margin: 0 0 20px;
  font-size: 22px;
  text-align: center;
}

.cap-line {
  margin: 8px 0;
}

.cap-table {
  width: 100%;
  margin-top: 20px;
  border-collapse: collapse;
  font-size: 12px;
}

.cap-table th,
.cap-table td {
  border: 1px solid #ddd;
  padding: 6px 4px;
  text-align: left;
}

.cap-table th {
  background: #f3f4f6;
}

.cap-total {
  margin-top: 16px;
  font-size: 15px;
}

.h5-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}

.h5-modal-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
}

.h5-modal-panel {
  position: relative;
  z-index: 1;
  max-width: 360px;
  width: 100%;
  padding: 18px;
}

.h5-modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 16px;
}
</style>
