<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import AppHeader from '@/components/AppHeader.vue'
import { useAppStore } from '@/stores/appStore'
import { elementToPdfBlob } from '@/utils/elementToPdfBlob'

const route = useRoute()
const router = useRouter()
const store = useAppStore()

const captureRef = ref<HTMLElement | null>(null)
const previewUrl = ref('')
const generating = ref(true)
const errorText = ref('')

const proposalId = computed(() => String(route.params.id || ''))

const proposal = computed(() => store.proposals.find((p) => p.id === proposalId.value))

const customerName = computed(() => {
  const c = store.customers.find((x) => x.id === proposal.value?.customerId)
  return c?.name || '—'
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
  if (!el || !proposal.value) {
    generating.value = false
    errorText.value = '未找到该方案'
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
  const p = proposal.value
  const el = captureRef.value
  if (!p || !previewUrl.value) return
  const a = document.createElement('a')
  const safeName = `${p.name}`.replace(/[/\\?%*:|"<>]/g, '-').slice(0, 80)
  a.href = previewUrl.value
  a.download = `${safeName}-${p.id}.pdf`
  a.click()
}

/** 从历史进入报价前，锁定当前所选方案上下文 */
function goQuote() {
  const id = proposalId.value
  if (!id) return
  store.setActiveProposal(id)
  router.push({ name: 'quote', query: { proposal: id } })
}

function revise() {
  const id = proposalId.value
  if (!id) return
  store.startProposalRevision(id)
  router.push({ path: '/quick-scheme', query: { step: 'cart' } })
}

onMounted(() => {
  void buildPreview()
})

watch(proposalId, () => {
  void buildPreview()
})

onBeforeUnmount(() => {
  revokeUrl()
})
</script>

<template>
  <main class="app-shell proposal-pdf-shell">
    <AppHeader :title="proposal?.name || '方案预览'" compact />

    <div class="proposal-pdf-flow">
      <p v-if="generating" class="hint">正在生成预览…</p>
      <p v-else-if="errorText" class="err">{{ errorText }}</p>

      <div v-if="previewUrl && !generating && !errorText" class="frame-wrap card">
        <iframe class="pdf-frame" title="方案预览" :src="previewUrl" />
      </div>
    </div>

    <footer class="action-bar action-bar--fixed card" aria-label="方案操作">
      <button type="button" class="ghost-btn action-bar__btn" :disabled="!previewUrl" @click="exportPdf">
        导出
      </button>
      <button type="button" class="ghost-btn action-bar__btn" @click="revise">变更</button>
      <button type="button" class="primary-btn action-bar__btn" @click="goQuote">报价</button>
    </footer>

    <!-- 截图源：固定在视区外仍参与布局以防高度为 0 -->
    <div class="capture-host" aria-hidden="true">
      <div v-if="proposal" ref="captureRef" class="capture-root">
        <h1 class="cap-title">销售方案</h1>
        <p class="cap-line"><strong>方案名称：</strong>{{ proposal.name }}</p>
        <p class="cap-line"><strong>客户：</strong>{{ customerName }}</p>
        <p class="cap-line"><strong>保存时间：</strong>{{ proposal.createdAt.replace('T', ' ').slice(0, 19) }}</p>
        <p v-if="proposal.remark" class="cap-line"><strong>备注：</strong>{{ proposal.remark }}</p>
        <table class="cap-table">
          <thead>
            <tr>
              <th>产品</th>
              <th>规格</th>
              <th>数量</th>
              <th>单价</th>
              <th>小计</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, idx) in proposal.lines" :key="idx">
              <td>{{ row.name }}</td>
              <td>{{ row.spec }}</td>
              <td>{{ row.quantity }}{{ row.unit }}</td>
              <td>¥{{ row.price }}</td>
              <td>¥{{ row.price * row.quantity }}</td>
            </tr>
          </tbody>
        </table>
        <p class="cap-total"><strong>含税前合计：</strong>¥{{ proposal.totalAmount }}</p>
      </div>
    </div>
  </main>
</template>

<style scoped>
.proposal-pdf-shell {
  /* 与底部固定操作栏等高，避免预览被挡 */
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  padding-bottom: calc(68px + env(safe-area-inset-bottom, 0px));
  box-sizing: border-box;
}

.proposal-pdf-flow {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  width: min(430px, 100vw);
  margin: 0 auto;
}

.action-bar {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  align-items: stretch;
  gap: 8px;
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
  width: 794px;
  padding: 0;
  pointer-events: none;
  opacity: 0.02;
}

.capture-root {
  width: 794px;
  padding: 40px 48px;
  background: #fff;
  color: #111;
  font-size: 14px;
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
  font-size: 13px;
}

.cap-table th,
.cap-table td {
  border: 1px solid #ddd;
  padding: 8px 6px;
  text-align: left;
}

.cap-table th {
  background: #f3f4f6;
}

.cap-total {
  margin-top: 16px;
  font-size: 15px;
}
</style>
