<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import AppHeader from '@/components/AppHeader.vue'
import { useAppStore } from '@/stores/appStore'
import type { FollowUpRecord } from '@/types/business'

const route = useRoute()
const router = useRouter()
const store = useAppStore()

const customerId = computed(() => String(route.params.id || ''))

const customer = computed(() => store.customers.find((c) => c.id === customerId.value))

const followList = computed(() =>
  customer.value ? store.followUpsForCustomer(customer.value.id) : [],
)

const detailOpen = ref(false)
const detailRow = ref<FollowUpRecord | null>(null)

watch(
  customer,
  (c) => {
    if (c) store.setCustomer(c.id)
  },
  { immediate: true },
)

function formatDt(iso: string) {
  try {
    const d = new Date(iso)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    const hh = String(d.getHours()).padStart(2, '0')
    const mm = String(d.getMinutes()).padStart(2, '0')
    return `${y}-${m}-${day} ${hh}:${mm}`
  } catch {
    return iso.slice(0, 16).replace('T', ' ')
  }
}

function dash(s: string) {
  const t = s?.trim()
  return t ? t : '—'
}

function previewOneLine(content: string, max = 40) {
  const t = content.replace(/\s+/g, ' ').trim()
  if (!t) return '—'
  return t.length > max ? `${t.slice(0, max - 1)}…` : t
}

const listReturnPath = computed(() => {
  const from = route.query.from
  if (from === 'follow-ups') return '/follow-ups'
  return '/development'
})

function goWrite() {
  router.push({
    name: 'follow-write',
    query: { returnTo: encodeURIComponent(route.fullPath) },
  })
}

function backToList() {
  router.push(listReturnPath.value)
}

function openDetail(row: FollowUpRecord) {
  detailRow.value = row
  detailOpen.value = true
}

function closeDetail() {
  detailOpen.value = false
  detailRow.value = null
}
</script>

<template>
  <main class="app-shell app-shell--fit detail-shell">
    <template v-if="customer">
      <AppHeader title="客户详情" />
      <section class="page">
        <button class="ghost-btn back" type="button" @click="backToList">返回列表</button>

        <section class="card panel panel--master">
          <h2 class="section-h">主数据</h2>
          <dl class="master-dl">
            <div><dt>客户名称</dt><dd>{{ dash(customer.name) }}</dd></div>
            <div><dt>客户编码</dt><dd>{{ dash(customer.code) }}</dd></div>
            <div class="full"><dt>客户性质</dt><dd>{{ dash(customer.nature) }}</dd></div>
            <div class="full"><dt>所属类别</dt><dd>{{ dash(customer.category) }}</dd></div>
            <div class="full"><dt>结算客户</dt><dd>{{ dash(customer.settlementCustomer) }}</dd></div>
            <div><dt>客户等级</dt><dd>{{ dash(customer.level) }}</dd></div>
            <div><dt>联系人</dt><dd>{{ dash(customer.contact) }}</dd></div>
            <div><dt>联系电话</dt><dd>{{ dash(customer.phone) }}</dd></div>
            <div class="full"><dt>客户标签</dt><dd>{{ dash(customer.tag) }}</dd></div>
            <div class="full"><dt>最近下单</dt><dd>{{ dash(customer.lastOrderText) }}</dd></div>
            <div class="full"><dt>需求摘要</dt><dd class="master-dd-wrap">{{ dash(customer.needSummary) }}</dd></div>
          </dl>
        </section>

        <section class="card panel panel--follow flex-fill">
          <div class="section-head">
            <h2 class="section-h">跟进</h2>
            <span class="badge">{{ followList.length }} 条</span>
          </div>
          <p v-if="followList.length === 0" class="empty">暂无跟进</p>
          <ul v-else class="follow-compact">
            <li v-for="row in followList" :key="row.id" class="follow-row">
              <div class="follow-row__left">
                <div class="follow-row__top">
                  <span class="t">{{ formatDt(row.createdAt) }}</span>
                  <span class="s">{{ row.followStatus }}</span>
                </div>
                <p class="follow-row__preview">{{ previewOneLine(row.content) }}</p>
              </div>
              <button type="button" class="linkish" @click="openDetail(row)">详情</button>
            </li>
          </ul>
        </section>

        <div class="footer-actions">
          <button class="ghost-btn" type="button" @click="goWrite">写跟进</button>
          <button class="primary-btn" type="button" @click="router.push('/quick-scheme?step=recommend')">
            方案速配
          </button>
        </div>
      </section>
    </template>

    <template v-else>
      <AppHeader title="客户详情" />
      <section class="page">
        <p class="card panel miss">未找到该客户，请返回列表重试。</p>
        <button class="primary-btn full-btn" type="button" @click="router.push('/follow-ups')">
          返回待跟进
        </button>
      </section>
    </template>

    <Teleport to="body">
      <div
        v-if="detailOpen && detailRow"
        class="h5-modal-overlay"
        role="dialog"
        aria-modal="true"
        aria-labelledby="follow-dlg-title"
      >
        <div class="h5-modal-backdrop" tabindex="-1" @click="closeDetail" />
        <div class="h5-modal-panel card follow-detail-panel" role="document" @click.stop>
          <h3 id="follow-dlg-title">跟进详情</h3>
          <p class="dlg-meta">{{ formatDt(detailRow.createdAt) }} · {{ detailRow.operatorName }}</p>
          <dl class="dlg-fields">
            <div><dt>联系人</dt><dd>{{ dash(detailRow.contactPerson) }}</dd></div>
            <div><dt>联系方式</dt><dd>{{ dash(detailRow.contactMethod) }}</dd></div>
            <div class="full"><dt>发货地址</dt><dd>{{ dash(detailRow.shipAddress) }}</dd></div>
            <div><dt>提醒日期</dt><dd>{{ dash(detailRow.reminderDate) }}</dd></div>
            <div><dt>跟进状态</dt><dd>{{ dash(detailRow.followStatus) }}</dd></div>
            <div class="full"><dt>跟进信息</dt><dd class="pre">{{ detailRow.content }}</dd></div>
          </dl>
          <div class="h5-modal-actions">
            <button class="primary-btn" type="button" @click="closeDetail">关闭</button>
          </div>
        </div>
      </div>
    </Teleport>
  </main>
</template>

<style scoped>
.detail-shell {
  padding-bottom: calc(12px + env(safe-area-inset-bottom, 0px));
}

.page {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px 12px 0;
}

.back {
  align-self: flex-start;
  margin: 0;
  font-weight: 800;
  font-size: 13px;
  min-height: 36px;
  padding: 0 10px;
}

.panel {
  padding: 10px 12px;
  flex-shrink: 0;
}

.panel--follow {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.flex-fill {
  flex: 1;
  min-height: 0;
}

.section-h {
  margin: 0 0 6px;
  font-size: 15px;
}

.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
  flex-shrink: 0;
}

.section-head .section-h {
  margin: 0;
}

.badge {
  font-size: 11px;
  font-weight: 800;
  color: var(--primary);
  background: #eff6ff;
  padding: 2px 8px;
  border-radius: 999px;
}

.master-dl {
  margin: 0;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px 10px;
  font-size: 13px;
}

.master-dl .full {
  grid-column: 1 / -1;
}

.master-dl dt {
  margin: 0;
  font-size: 11px;
  color: var(--muted);
  font-weight: 800;
}

.master-dl dd {
  margin: 2px 0 0;
  line-height: 1.45;
  color: #0f172a;
  font-weight: 600;
}

.master-dd-wrap {
  white-space: pre-wrap;
  font-weight: 500;
}

.empty {
  margin: 0;
  font-size: 13px;
  color: var(--muted);
}

.follow-compact {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.follow-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
  padding: 8px 0;
  border-bottom: 1px solid var(--line, #e8e8e8);
  font-size: 12px;
}

.follow-row:last-child {
  border-bottom: none;
}

.follow-row__left {
  min-width: 0;
  flex: 1;
}

.follow-row__top {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 2px;
}

.follow-row__top .t {
  color: var(--muted);
  font-weight: 700;
}

.follow-row__top .s {
  font-weight: 800;
  color: var(--primary);
}

.follow-row__preview {
  margin: 0;
  color: #334155;
  line-height: 1.35;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.linkish {
  flex-shrink: 0;
  border: 0;
  background: none;
  color: var(--primary);
  font-weight: 900;
  font-size: 13px;
  cursor: pointer;
  padding: 4px 0;
  min-height: auto;
}

.footer-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  flex-shrink: 0;
  padding-bottom: 4px;
}

.miss {
  padding: 16px;
  margin-bottom: 12px;
}

.full-btn {
  width: 100%;
}

.follow-detail-panel {
  max-height: min(88dvh, 560px);
}

.dlg-meta {
  margin: 0 0 10px;
  font-size: 12px;
  color: var(--muted);
}

.dlg-fields {
  margin: 0;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px 10px;
  font-size: 13px;
}

.dlg-fields .full {
  grid-column: 1 / -1;
}

.dlg-fields dt {
  margin: 0;
  font-size: 11px;
  color: var(--muted);
  font-weight: 800;
}

.dlg-fields dd {
  margin: 2px 0 0;
  line-height: 1.4;
}

.dlg-fields dd.pre {
  white-space: pre-wrap;
  margin-top: 4px;
}
</style>
