<script setup lang="ts">
import { computed, onActivated, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import AppHeader from '@/components/AppHeader.vue'
import CustomerBar from '@/components/CustomerBar.vue'
import ProductSpecEditModal from '@/components/ProductSpecEditModal.vue'
import { useAppStore } from '@/stores/appStore'
import type { Product } from '@/types/business'
import { composeSpecSummary, parsePartsFromSummary } from '@/utils/productSpecParts'

type Step = 'recommend' | 'cart' | 'proposal'

const route = useRoute()
const router = useRouter()
const store = useAppStore()

/** 顶栏仅为「选品 / 方案」；购物车通过选品页入口进入，路由仍可使用 step=cart */
const tabSteps: readonly { id: Exclude<Step, 'cart'>; label: string }[] = [
  { id: 'recommend', label: '选品' },
  { id: 'proposal', label: '方案' },
] as const

function parseStep(v: unknown): Step {
  if (v === 'cart' || v === 'proposal' || v === 'recommend') return v
  return 'recommend'
}

const active = computed(() => parseStep(route.query.step))

const tabHighlight = computed<'recommend' | 'proposal'>(() =>
  active.value === 'proposal' ? 'proposal' : 'recommend',
)

function goStep(s: Step) {
  router.replace({ path: '/quick-scheme', query: { step: s } })
}

function goTab(step: Exclude<Step, 'cart'>) {
  goStep(step)
}

const isNewCustomer = computed(() => store.currentCustomer.type === 'public-new')

/** 选品区展示文案：优先最新跟进正文，否则主数据需求摘要（新客户编辑亦写入此 ref） */
const customerNeedOverview = ref('')

function latestFollowContentForCustomer(customerId: string): string {
  const rows = store.followUpsForCustomer(customerId)
  const top = rows[0]
  const t = top?.content?.trim()
  return t || ''
}

function pickNeedOverviewText(): string {
  const cid = store.currentCustomerId
  return latestFollowContentForCustomer(cid) || store.currentCustomer.needSummary || ''
}

function mockRegenerateSummaryFromNeed(raw: string): string {
  const t = raw.trim().replace(/\s+/g, ' ')
  if (!t) return ''
  return t.length > 160 ? `${t.slice(0, 157)}…` : t
}

/** Mock：根据摘要/需求文案匹配推荐 SKU（上线后替换为检索/对话引擎） */
function mockRecommendProductsByText(products: Product[], combinedNeedle: string): Product[] {
  const s = combinedNeedle.trim().toLowerCase()
  if (!s) return []
  const rules: { keys: string[]; id: string }[] = [
    { keys: ['支架', '定制', '图纸', '连接', '安装', '设备', '工装', '自动化'], id: 'p-003' },
    { keys: ['螺栓', '六角', '紧固', '螺丝', 'm6', '12.9', '高强度'], id: 'p-001' },
    { keys: ['垫圈', '防松', '配套'], id: 'p-002' },
  ]
  const matched = new Set<string>()
  for (const r of rules) {
    if (r.keys.some((k) => s.includes(k.toLowerCase()))) matched.add(r.id)
  }
  if (matched.size > 0) return products.filter((p) => matched.has(p.id))
  return [...products]
}

const recommendedProducts = ref<Product[]>([])
const deckIndex = ref(0)
const needEditorExpanded = ref(false)
const needDraftRaw = ref('')

/** 当前推荐 SKU 在销售侧的规格配置（落购物车 / 生成方案时使用） */
const pickConfig = ref<Record<string, { spec: string; qty: number }>>({})
/** 与 pickConfig 并行的分栏值，供改配弹窗编辑 */
const pickSpecParts = ref<Record<string, Record<string, string>>>({})

type SpecModalTarget =
  | { kind: 'pick'; productId: string }
  | { kind: 'cart'; cartLineId: string; productId: string }

const specModalOpen = ref(false)
const specModalProduct = ref<Product | null>(null)
const specModalParts = ref<Record<string, string>>({})
const specModalQty = ref(1)
const specModalTarget = ref<SpecModalTarget | null>(null)
let swipePointerId: number | null = null
let swipeStartX = 0
const swipeDragging = ref(false)
const swipeDragX = ref(0)
const SWIPE_THRESHOLD_PX = 56

function syncNeedStateFromCustomer() {
  customerNeedOverview.value = pickNeedOverviewText()
  deckIndex.value = 0
  needEditorExpanded.value = false
  needDraftRaw.value = ''
  if (isNewCustomer.value) refreshRecommendedForNewCustomer()
  else refreshRecommendedForReturningCustomer()
}

function refreshRecommendedForNewCustomer() {
  const list = mockRecommendProductsByText(store.products, customerNeedOverview.value)
  recommendedProducts.value = list.map((p) => ({ ...p }))
  const n = list.length
  if (n === 0) {
    deckIndex.value = 0
    return
  }
  deckIndex.value = Math.min(Math.max(0, deckIndex.value), n - 1)
}

/** 老客户：从历史订单聚合 SKU（无则降级为摘要关键词推荐） */
function refreshRecommendedForReturningCustomer() {
  const cid = store.currentCustomerId
  const seen = new Set<string>()
  const orderedIds: string[] = []

  const pushPid = (productId: string) => {
    if (seen.has(productId)) return
    seen.add(productId)
    orderedIds.push(productId)
  }

  const ordersSorted = [...store.orders]
    .filter((o) => o.customerId === cid && (o.lines?.length ?? 0) > 0)
    .sort((a, b) => (b.date > a.date ? 1 : b.date > a.date ? -1 : 0))

  for (const o of ordersSorted) {
    for (const line of o.lines ?? []) pushPid(line.productId)
  }

  const propsSorted = store.proposals
    .filter((p) => p.customerId === cid)
    .slice()
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))

  for (const p of propsSorted) {
    for (const line of p.lines) pushPid(line.productId)
  }

  let list =
    orderedIds.length > 0
      ? orderedIds
          .map((id) => store.products.find((x) => x.id === id))
          .filter((x): x is Product => Boolean(x))
          .map((p) => ({
            ...p,
            reason: '根据最近历史订单及历史方案带出',
          }))
      : []

  if (list.length === 0) {
    list = mockRecommendProductsByText(store.products, customerNeedOverview.value || '设备配套').map((p) => ({
      ...p,
      reason: '未读到订单行快照，暂按摘要/关键词备选推荐',
    }))
  }

  recommendedProducts.value = list
  deckIndex.value = list.length ? Math.min(deckIndex.value, list.length - 1) : 0
}

/** 最近一次订单中的规格 / 数量，用于老客户推荐卡默认填入 */
function defaultPickFromLatestOrders(customerId: string) {
  const spec: Record<string, string> = {}
  const qty: Record<string, number> = {}
  const sorted = [...store.orders]
    .filter((o) => o.customerId === customerId && (o.lines?.length ?? 0) > 0)
    .sort((a, b) => (b.date > a.date ? 1 : b.date > a.date ? -1 : 0))
  for (const o of sorted) {
    for (const line of o.lines ?? []) {
      if (spec[line.productId] !== undefined) continue
      spec[line.productId] = line.spec
      qty[line.productId] = Math.max(1, line.quantity)
    }
  }
  return { spec, qty }
}

/** 推荐列表变更时合并每 SKU 的配置（老客户缺省从历史订单最近一次行带入） */
function rebuildPickConfigFromRecommended() {
  const defaults = !isNewCustomer.value
    ? defaultPickFromLatestOrders(store.currentCustomerId)
    : { spec: {}, qty: {} }
  const prev = pickConfig.value
  const prevParts = pickSpecParts.value
  const next: Record<string, { spec: string; qty: number }> = {}
  const nextParts: Record<string, Record<string, string>> = {}

  for (const p of recommendedProducts.value) {
    const fields = p.specFields ?? []
    const kept = prev[p.id]
    if (kept) {
      next[p.id] = { spec: kept.spec, qty: Math.max(1, kept.qty) }
      nextParts[p.id] =
        prevParts[p.id] && Object.keys(prevParts[p.id]).length > 0
          ? { ...prevParts[p.id] }
          : parsePartsFromSummary(kept.spec, fields)
      continue
    }
    const dSpec = defaults.spec[p.id]
    const dQty = defaults.qty[p.id]
    const specStr = dSpec !== undefined && String(dSpec).trim() ? String(dSpec) : p.spec
    next[p.id] = {
      spec: specStr,
      qty: dQty !== undefined ? Math.max(1, dQty) : 1,
    }
    nextParts[p.id] = parsePartsFromSummary(specStr, fields)
  }
  pickConfig.value = next
  pickSpecParts.value = nextParts
}

function adjustPickQty(productId: string, delta: number) {
  const row = pickConfig.value[productId]
  if (!row) return
  row.qty = Math.max(1, row.qty + delta)
}

function openPickSpecModal(productId: string) {
  const product = store.products.find((x) => x.id === productId) ?? null
  if (!product) return
  specModalTarget.value = { kind: 'pick', productId }
  specModalProduct.value = product
  const curSpec = pickConfig.value[productId]?.spec ?? product.spec
  specModalParts.value = {
    ...(pickSpecParts.value[productId] ?? parsePartsFromSummary(curSpec, product.specFields ?? [])),
  }
  specModalQty.value = pickConfig.value[productId]?.qty ?? 1
  specModalOpen.value = true
}

function openCartSpecModal(lineId: string) {
  const item = store.cart.find((c) => c.id === lineId)
  if (!item) return
  const product = store.products.find((x) => x.id === item.productId) ?? null
  if (!product) return
  specModalTarget.value = { kind: 'cart', cartLineId: lineId, productId: item.productId }
  specModalProduct.value = product
  specModalParts.value = { ...parsePartsFromSummary(item.spec, product.specFields ?? []) }
  specModalQty.value = item.quantity
  specModalOpen.value = true
}

function onSpecModalSave(payload: { parts: Record<string, string>; quantity: number }) {
  const product = specModalProduct.value
  const target = specModalTarget.value
  if (!product || !target) return

  const specLine = composeSpecSummary(product, payload.parts)
  const qty = Math.max(1, payload.quantity)

  if (target.kind === 'pick') {
    pickSpecParts.value = { ...pickSpecParts.value, [target.productId]: { ...payload.parts } }
    const row = pickConfig.value[target.productId]
    if (row) {
      row.spec = specLine
      row.qty = qty
    }
    return
  }

  store.upsertCartLine(target.productId, specLine, qty)
}
function addRecommendedProductToCart(productId: string) {
  const row = pickConfig.value[productId]
  if (!row) return
  store.upsertCartLine(productId, row.spec, row.qty)
}

/** 新客户：需求变更后刷新推荐列表 */
function refreshRecommendedFromOverview() {
  refreshRecommendedForNewCustomer()
}

function openNeedEditor() {
  needEditorExpanded.value = true
  needDraftRaw.value = ''
}

function cancelNeedEditor() {
  needDraftRaw.value = ''
  needEditorExpanded.value = false
}

function saveNeedFromEditor() {
  const raw = needDraftRaw.value.trim()
  if (!raw) return
  customerNeedOverview.value = mockRegenerateSummaryFromNeed(raw)
  refreshRecommendedFromOverview()
  deckIndex.value = 0
  needDraftRaw.value = ''
  needEditorExpanded.value = false
}

const deckCount = computed(() => recommendedProducts.value.length)

/** 选品卡片正文：无跟进且无摘要时占位 */
const needShowBody = computed(() => {
  const t = customerNeedOverview.value.trim()
  return t || '暂无跟进记录'
})

const trackTransform = computed(() => {
  const n = deckCount.value
  if (!n) return 'translateX(0)'
  const drag = swipeDragX.value
  return `translateX(calc(-100% * ${deckIndex.value} / ${n} + ${drag}px))`
})

const trackTransition = computed(() =>
  swipeDragging.value ? 'none' : 'transform 0.22s ease-out',
)

function goDeck(delta: number) {
  const n = deckCount.value
  if (!n) return
  deckIndex.value = Math.max(0, Math.min(n - 1, deckIndex.value + delta))
}

function onSwipePointerDown(e: PointerEvent) {
  if (deckCount.value <= 1) return
  swipeDragging.value = true
  swipeStartX = e.clientX
  swipePointerId = e.pointerId
  swipeDragX.value = 0
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
}

function onSwipePointerMove(e: PointerEvent) {
  if (!swipeDragging.value || e.pointerId !== swipePointerId) return
  swipeDragX.value = e.clientX - swipeStartX
}

function endSwipe(e: PointerEvent) {
  if (e.pointerId !== swipePointerId) return
  const dx = swipeDragX.value
  if (dx < -SWIPE_THRESHOLD_PX) goDeck(1)
  else if (dx > SWIPE_THRESHOLD_PX) goDeck(-1)
  swipeDragging.value = false
  swipeDragX.value = 0
  swipePointerId = null
  try {
    ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
  } catch {
    /* ignore */
  }
}

function onSwipePointerUp(e: PointerEvent) {
  if (!swipeDragging.value) return
  endSwipe(e)
}

function onSwipePointerCancel(e: PointerEvent) {
  if (!swipeDragging.value) return
  swipeDragging.value = false
  swipeDragX.value = 0
  swipePointerId = null
}

/** 选品：纳入本方案的 SKU（productId） */
const schemePickIds = ref(new Set<string>())
function toggleSchemePick(productId: string) {
  const next = new Set(schemePickIds.value)
  if (next.has(productId)) next.delete(productId)
  else next.add(productId)
  schemePickIds.value = next
}

watch(
  () => store.currentCustomerId,
  () => {
    syncNeedStateFromCustomer()
    schemePickIds.value = new Set()
    deckIndex.value = 0
    needEditorExpanded.value = false
    needDraftRaw.value = ''
  },
)

watch(
  () =>
    store
      .followUpsForCustomer(store.currentCustomerId)
      .map((r) => r.id)
      .join(','),
  () => {
    if (needEditorExpanded.value) return
    customerNeedOverview.value = pickNeedOverviewText()
    if (isNewCustomer.value) refreshRecommendedForNewCustomer()
    else refreshRecommendedForReturningCustomer()
    deckIndex.value = 0
  },
)

watch(
  () =>
    `${recommendedProducts.value.map((p) => p.id).join(',')}|${store.currentCustomerId}|${String(isNewCustomer.value)}`,
  () => {
    const allow = new Set(recommendedProducts.value.map((p) => p.id))
    schemePickIds.value = new Set([...schemePickIds.value].filter((id) => allow.has(id)))
    rebuildPickConfigFromRecommended()
  },
)

const canGenerateScheme = computed(() => schemePickIds.value.size > 0 || store.cart.length > 0)

/** 优先生效推荐勾选；未勾选时则带整个购物车候选进入方案 */
function goGenerateScheme() {
  if (schemePickIds.value.size > 0) {
    const ids = [...schemePickIds.value]
    for (const pid of ids) {
      const row = pickConfig.value[pid]
      if (row) store.upsertCartLine(pid, row.spec, row.qty)
    }
    store.setPendingProposalFromProductIds(ids)
    goStep('proposal')
    return
  }
  if (store.cart.length > 0) {
    store.setPendingProposalCartLineIds(null)
    goStep('proposal')
  }
}

/** 购物车：勾选将纳入「方案」页的候选行（默认可全选后去方案页再二次勾选） */
const cartIncludeIds = ref(new Set<string>())

watch(
  () => `${active.value}|${store.cart.map((c) => c.id).join(',')}`,
  () => {
    if (active.value !== 'cart') return
    cartIncludeIds.value = new Set(store.cart.map((c) => c.id))
  },
  { immediate: true },
)

function toggleCartLine(lineId: string) {
  const next = new Set(cartIncludeIds.value)
  if (next.has(lineId)) next.delete(lineId)
  else next.add(lineId)
  cartIncludeIds.value = next
}

const cartChosenTotal = computed(() =>
  store.cart
    .filter((item) => cartIncludeIds.value.has(item.id))
    .reduce((s, item) => s + item.price * item.quantity, 0),
)

function goProposalFromCart() {
  const ids = [...cartIncludeIds.value].filter((id) => store.cart.some((c) => c.id === id))
  if (!ids.length) return
  if (ids.length === store.cart.length) store.setPendingProposalCartLineIds(null)
  else store.setPendingProposalCartLineIds(ids)
  goStep('proposal')
}

/** 方案步骤：最终决定写入 PDF / 出库的行 */
const proposalLinePick = ref(new Set<string>())

/** 方案 Tab 仅展示从选品勾选或购物车「带所选」进入本屏的行；pending 为空表示整单购物车 */
const proposalPanelLines = computed(() => {
  const cart = store.cart
  const pend = store.pendingProposalLineIds
  if (!pend?.length) return cart
  const allow = new Set(pend)
  return cart.filter((c) => allow.has(c.id))
})

watch(
  [
    active,
    () => store.cart.map((c) => c.id).join(','),
    () => (store.pendingProposalLineIds ?? []).join(','),
  ],
  () => {
    if (active.value !== 'proposal') return
    const pend = store.pendingProposalLineIds
    const fallback = store.cart.map((c) => c.id)
    const ids = pend?.length ? pend.filter((id) => fallback.includes(id)) : fallback
    proposalLinePick.value = new Set(ids)
  },
  { immediate: true },
)

function toggleProposalLine(lineId: string) {
  const next = new Set(proposalLinePick.value)
  if (next.has(lineId)) next.delete(lineId)
  else next.add(lineId)
  proposalLinePick.value = next
}

const proposalChosenCount = computed(
  () => proposalPanelLines.value.filter((c) => proposalLinePick.value.has(c.id)).length,
)

const autoProposalName = computed(() => {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const rev = store.revisingFromProposalId ? '-变更' : ''
  return `方案-${store.currentCustomer.name}-${y}${m}${day}${rev}`
})

function trySaveProposalFromPick(): boolean {
  const allow = new Set(proposalPanelLines.value.map((c) => c.id))
  const ids = [...proposalLinePick.value].filter((id) => allow.has(id))
  if (!ids.length) return false
  store.saveProposal({ name: autoProposalName.value, remark: '' }, ids)
  return true
}

function saveProposalAndPreview() {
  if (!trySaveProposalFromPick()) return
  router.push({ name: 'proposal-pdf', params: { id: store.proposal.id } })
}

function saveProposalAndQuote() {
  if (!trySaveProposalFromPick()) return
  store.setActiveProposal(store.proposal.id)
  router.push({ name: 'quote', query: { proposal: store.proposal.id } })
}

onMounted(() => {
  const q = route.query.step
  if (q == null || q === '') {
    router.replace({ path: '/quick-scheme', query: { step: 'recommend' }, replace: true })
  }
  syncNeedStateFromCustomer()
})

onActivated(() => {
  if (!needEditorExpanded.value) syncNeedStateFromCustomer()
})
</script>

<template>
  <main class="app-shell app-shell--fit quick-scheme-shell">
    <AppHeader title="方案速配" toolbar>
      <template #trailing>
        <button class="toolbar-link" type="button" @click="router.push('/proposal-history')">历史方案</button>
      </template>
    </AppHeader>

    <nav class="scheme-tabs card" aria-label="方案速配步骤">
      <button
        v-for="tab in tabSteps"
        :key="tab.id"
        type="button"
        class="scheme-tab"
        :class="{ 'scheme-tab--on': tabHighlight === tab.id }"
        :aria-current="tabHighlight === tab.id ? 'step' : undefined"
        @click="goTab(tab.id)"
      >
        {{ tab.label }}
      </button>
    </nav>

    <section class="page page-quick-scheme">
      <CustomerBar />

      <!-- 选品 -->
      <section v-show="active === 'recommend'" class="panel panel--pick">
        <section class="need-summary card">
          <strong class="need-summary__title">最新跟进记录</strong>
          <p class="need-summary__body">{{ needShowBody }}</p>
          <template v-if="isNewCustomer">
            <div v-if="!needEditorExpanded" class="need-inline-foot">
              <button type="button" class="need-open-editor" @click="openNeedEditor">
                <span class="need-open-editor__main">录入 / 更正需求要点</span>
              </button>
            </div>

            <div v-else class="need-editor">
              <textarea v-model="needDraftRaw" rows="3" class="need-editor-area" placeholder="客户需求…" />
              <div class="need-editor-bar">
                <button class="ghost-btn need-editor-cancel" type="button" @click="cancelNeedEditor">取消</button>
                <button
                  class="primary-btn need-editor-save"
                  type="button"
                  :disabled="!needDraftRaw.trim()"
                  @click="saveNeedFromEditor"
                >
                  保存并刷新推荐
                </button>
              </div>
            </div>
          </template>
        </section>

        <div class="deck-head">
          <div class="deck-head__left">
            <h2 class="deck-head__title">推荐商品</h2>
            <span v-if="deckCount" class="muted deck-counter">{{ deckIndex + 1 }}/{{ deckCount }}</span>
          </div>
          <button type="button" class="ghost-btn deck-cart-entry" @click="goStep('cart')">
            购物车<span v-if="store.cart.length" class="deck-cart-badge">{{ store.cart.length }}</span>
          </button>
        </div>
        <section v-if="!deckCount" class="empty-tip card deck-empty">
          <template v-if="isNewCustomer">暂无匹配推荐</template>
          <template v-else>暂无推荐</template>
        </section>

        <div
          v-else
          class="swipe-stage card"
          @pointerdown="onSwipePointerDown"
          @pointermove="onSwipePointerMove"
          @pointerup="onSwipePointerUp"
          @pointercancel="onSwipePointerCancel"
        >
          <div
            class="swipe-track"
            :style="{
              width: `${deckCount * 100}%`,
              transform: trackTransform,
              transition: trackTransition,
            }"
          >
            <article
              v-for="p in recommendedProducts"
              :key="p.id"
              class="swipe-card"
              :style="{ flex: `0 0 calc(100% / ${deckCount})` }"
            >
              <div class="swipe-card__inner card">
                <div class="swipe-card__topbar" @pointerdown.stop>
                  <label class="swipe-card__pick">
                    <input type="checkbox" :checked="schemePickIds.has(p.id)" @change="toggleSchemePick(p.id)" />
                    <span>纳入本单</span>
                  </label>
                  <button
                    type="button"
                    class="swipe-card__tocart-icon"
                    aria-label="加入购物车"
                    @pointerdown.stop
                    @click="addRecommendedProductToCart(p.id)"
                  >
                    <svg class="tocart-svg" viewBox="0 0 24 24" aria-hidden="true">
                      <path
                        fill="currentColor"
                        d="M7 18c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03L21.7 4H5.21l-.94-2H1zm16 16c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"
                      />
                    </svg>
                  </button>
                </div>
                <div class="swipe-card__meta">
                  <strong class="swipe-card__price">¥{{ p.price }}/{{ p.unit }}</strong>
                </div>
                <h3 class="swipe-card__name">{{ p.name }}</h3>
                <p class="swipe-card__spec-preview">{{ pickConfig[p.id]?.spec ?? p.spec }}</p>
                <button
                  type="button"
                  class="ghost-btn swipe-card__edit-spec"
                  @pointerdown.stop
                  @click="openPickSpecModal(p.id)"
                >
                  改配…
                </button>
                <div class="swipe-card__qty-row row" @pointerdown.stop>
                  <span class="muted tiny">数量</span>
                  <div class="quantity">
                    <button type="button" @click="adjustPickQty(p.id, -1)">-</button>
                    <strong>{{ pickConfig[p.id]?.qty ?? 1 }}</strong>
                    <button type="button" @click="adjustPickQty(p.id, 1)">+</button>
                  </div>
                </div>
              </div>
            </article>
          </div>
          <div v-if="deckCount > 1" class="deck-nav" @pointerdown.stop>
            <button class="ghost-btn deck-nav-btn" type="button" :disabled="deckIndex <= 0" @click="goDeck(-1)">
              ‹ 上一张
            </button>
            <div class="deck-dots" aria-hidden="true">
              <span
                v-for="i in deckCount"
                :key="i"
                class="deck-dot"
                :class="{ 'deck-dot--on': i - 1 === deckIndex }"
              />
            </div>
            <button
              class="ghost-btn deck-nav-btn"
              type="button"
              :disabled="deckIndex >= deckCount - 1"
              @click="goDeck(1)"
            >
              下一张 ›
            </button>
          </div>
        </div>

        <div class="footer-actions footer-actions-single">
          <button
            class="primary-btn full-btn generate-scheme-btn"
            type="button"
            :disabled="!canGenerateScheme"
            @click="goGenerateScheme"
          >
            生成方案
          </button>
        </div>
      </section>

      <!-- 购物车（非 Tab，由选品页「购物车」进入；外链仍可 step=cart） -->
      <section v-show="active === 'cart'" class="panel">
        <div class="section-title section-title--cart-top">
          <h2>购物车</h2>
          <button class="ghost-btn" type="button" @click="goStep('recommend')">返回选品</button>
        </div>
        <section class="list">
          <article v-for="item in store.cart" :key="item.id" class="cart-card card">
            <label class="cart-check">
              <input
                type="checkbox"
                :checked="cartIncludeIds.has(item.id)"
                @change="toggleCartLine(item.id)"
              />
              <span>带入方案候选</span>
            </label>
            <div class="row cart-title-row">
              <h3>{{ item.name }}</h3>
              <div class="cart-title-actions">
                <button type="button" class="text-btn" @click="openCartSpecModal(item.id)">改配</button>
                <button type="button" class="text-btn" @click="store.removeCartItem(item.id)">删除</button>
              </div>
            </div>
            <p>{{ item.spec }}</p>
            <div class="row">
              <span>¥{{ item.price }}/{{ item.unit }}</span>
              <div class="quantity">
                <button type="button" @click="store.updateCartQuantity(item.id, item.quantity - 1)">-</button>
                <strong>{{ item.quantity }}</strong>
                <button type="button" @click="store.updateCartQuantity(item.id, item.quantity + 1)">+</button>
              </div>
            </div>
          </article>
        </section>
        <section class="summary card">
          <div>
            <span>候选勾选小计</span>
          </div>
          <strong>¥{{ cartChosenTotal }}</strong>
        </section>
        <section class="summary card secondary-sum">
          <span>购物车全量合计</span>
          <strong>¥{{ store.cartTotal }}</strong>
        </section>
        <div class="footer-actions footer-actions-single">
          <button
            class="primary-btn full-btn generate-scheme-btn"
            type="button"
            :disabled="cartIncludeIds.size === 0 || store.cart.length === 0"
            @click="goProposalFromCart"
          >
            生成方案
          </button>
        </div>
      </section>

      <!-- 方案 -->
      <section v-show="active === 'proposal'" class="panel">
        <div class="section-title">
          <h2>本单方案明细</h2>
        </div>
        <section v-if="proposalPanelLines.length === 0" class="empty-tip card">
          <template v-if="store.cart.length === 0">购物车暂无商品，请先选品</template>
          <template v-else>暂无可带入方案的商品行，请返回选品或购物车重新选择。</template>
        </section>
        <section v-else class="list">
          <article v-for="item in proposalPanelLines" :key="item.id" class="line-card card">
            <div class="line-row-flex">
              <label class="line-check">
                <input
                  type="checkbox"
                  :checked="proposalLinePick.has(item.id)"
                  @change="toggleProposalLine(item.id)"
                />
                <div class="line-body">
                  <strong>{{ item.name }}</strong>
                  <span>{{ item.spec }} · {{ item.quantity }}{{ item.unit }} · ¥{{ item.price * item.quantity }}</span>
                </div>
              </label>
              <button type="button" class="text-btn line-edit-spec" @click="openCartSpecModal(item.id)">
                改配
              </button>
            </div>
          </article>
        </section>
        <div class="proposal-actions">
          <button
            class="primary-btn full-btn save-btn"
            type="button"
            :disabled="proposalChosenCount === 0"
            @click="saveProposalAndPreview"
          >
            保存方案并预览
          </button>
          <button
            class="ghost-btn full-btn save-btn save-btn--secondary"
            type="button"
            :disabled="proposalChosenCount === 0"
            @click="saveProposalAndQuote"
          >
            保存方案并生成报价
          </button>
        </div>
      </section>
    </section>
    <ProductSpecEditModal
      :open="specModalOpen"
      :product="specModalProduct"
      :parts="specModalParts"
      :quantity="specModalQty"
      @update:open="specModalOpen = $event"
      @save="onSpecModalSave"
    />
  </main>
</template>

<style scoped>
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

.quick-scheme-shell {
  /* 方案速配不展示全局语音条，仅保留少量底部与安全区留白 */
  padding-bottom: calc(12px + env(safe-area-inset-bottom, 0px));
}

.page-quick-scheme {
  padding: 8px 12px 0;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.scheme-tabs {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0;
  margin: 0 auto;
  margin-top: 8px;
  width: min(430px, 100vw);
  padding: 0;
  overflow: hidden;
}

.scheme-tab {
  min-height: 42px;
  margin: 0;
  padding: 8px 4px;
  border: 0;
  border-radius: 0;
  background: transparent;
  font-size: 14px;
  font-weight: 800;
  color: var(--muted);
}

.scheme-tab--on {
  color: var(--primary);
  box-shadow: inset 0 -2px 0 var(--primary);
  background: #edf3ff;
}

.panel {
  margin-top: 2px;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.panel--pick .need-summary {
  padding: 8px 10px;
}

.panel--pick .need-summary__title {
  margin-bottom: 4px;
}

.panel--pick .need-summary__body {
  margin: 0 0 6px;
  font-size: 12px;
  line-height: 1.4;
}

.panel--pick .need-inline-foot {
  padding-top: 6px;
}

.panel--pick .need-open-editor {
  padding: 6px 8px;
  gap: 2px;
}

.panel--pick .need-open-editor__main {
  font-size: 12px;
}

.need-summary {
  padding: 10px 12px;
}

.need-summary__title {
  display: block;
  margin-bottom: 6px;
  font-size: 12px;
  font-weight: 900;
  color: var(--ink);
}

.need-summary__body {
  margin: 0 0 8px;
  font-size: 13px;
  line-height: 1.45;
  color: #334155;
  white-space: pre-wrap;
}

.need-inline-foot {
  margin-top: 2px;
  padding-top: 8px;
  border-top: 1px dashed rgba(220, 229, 240, 0.95);
}

.need-open-editor {
  width: 100%;
  margin: 0;
  padding: 8px 10px;
  border: 0;
  border-radius: 12px;
  background: rgba(237, 243, 255, 0.65);
  text-align: start;
  cursor: pointer;
  display: grid;
  gap: 4px;
}

.need-open-editor__main {
  font-size: 13px;
  font-weight: 900;
  color: var(--primary);
}

.need-editor {
  margin-top: 2px;
  padding-top: 8px;
  border-top: 1px dashed rgba(220, 229, 240, 0.95);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.need-editor-area {
  width: 100%;
}

.need-editor-bar {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.need-editor-cancel,
.need-editor-save {
  min-height: 42px;
  border-radius: 12px;
  font-size: 13px;
}

.panel--pick .deck-head {
  margin-top: 6px;
}

.deck-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-height: 36px;
}

.deck-head__left {
  display: flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
}

.deck-head__title {
  margin: 0;
  font-size: 18px;
  font-weight: 900;
}

.deck-cart-entry {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 38px;
  padding: 0 12px;
  font-size: 12px;
  font-weight: 900;
}

.deck-cart-badge {
  box-sizing: border-box;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  border-radius: 999px;
  background: var(--primary);
  color: #fff;
  font-size: 11px;
  font-weight: 900;
  line-height: 20px;
  text-align: center;
}

.section-title--cart-top {
  margin-top: 0;
  margin-bottom: 10px;
}

.deck-counter {
  flex-shrink: 0;
  font-size: 12px;
  font-weight: 800;
}

.deck-empty {
  margin-top: 6px;
  padding: 12px;
  font-size: 13px;
}

.panel--pick .swipe-stage {
  margin-top: 4px;
  padding: 6px;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.swipe-stage {
  margin-top: 6px;
  touch-action: pan-x;
  user-select: none;
  padding: 8px;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.swipe-track {
  display: flex;
  flex-direction: row;
  will-change: transform;
}

.swipe-card {
  box-sizing: border-box;
  padding: 0 8px;
}

.swipe-card__inner {
  gap: 8px;
  padding: 12px 12px 14px;
  height: 100%;
  min-height: 220px;
  max-height: min(42dvh, 280px);
  display: flex;
  flex-direction: column;
  border-radius: 14px;
  border: 1px solid #e8eef6;
  background: linear-gradient(180deg, #fbfcfe 0%, #fff 28%);
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.9) inset,
    0 4px 18px rgba(15, 23, 42, 0.06);
}

.swipe-card__topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding-bottom: 10px;
  margin-bottom: 2px;
  border-bottom: 1px solid #f1f5f9;
}

.swipe-card__topbar .swipe-card__pick {
  margin-bottom: 0;
  flex: 1;
  min-width: 0;
  padding: 6px 10px;
  border-radius: 10px;
  background: rgba(239, 246, 255, 0.85);
  border: 1px solid rgba(191, 219, 254, 0.55);
}

.swipe-card__tocart-icon {
  flex-shrink: 0;
  width: 44px;
  height: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 12px;
  padding: 0;
  min-height: 44px;
  min-width: 44px;
  cursor: pointer;
  color: #fff;
  background: linear-gradient(135deg, var(--primary), var(--primary-dark));
  box-shadow: 0 4px 12px rgba(31, 94, 255, 0.28);
  touch-action: manipulation;
}

.swipe-card__tocart-icon:active {
  transform: scale(0.96);
}

.tocart-svg {
  width: 21px;
  height: 21px;
  display: block;
}

.swipe-card__pick {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 0;
  font-size: 12px;
  font-weight: 800;
  color: var(--primary);
}

.swipe-card__pick input {
  width: 18px;
  height: 18px;
  accent-color: var(--primary);
}

.swipe-card__meta {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 10px;
  margin-bottom: 2px;
}

.swipe-card__price {
  display: inline-block;
  padding: 4px 11px;
  border-radius: 999px;
  font-size: 14px;
  font-weight: 900;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.02em;
  color: #fff;
  background: linear-gradient(135deg, var(--primary), var(--primary-dark));
  box-shadow: 0 2px 8px rgba(31, 94, 255, 0.22);
}

.panel--pick .deck-empty {
  margin-top: 4px;
  padding: 8px 10px;
  font-size: 12px;
}

.swipe-card__name {
  margin: 0;
  font-size: 15px;
  font-weight: 800;
  line-height: 1.35;
  color: var(--ink, #0f172a);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.swipe-card__spec-label {
  margin: 0 0 2px;
  font-size: 10px;
  line-height: 1.35;
}

.swipe-card__spec-preview {
  margin: 0;
  padding: 8px 10px;
  border-radius: 10px;
  font-size: 12px;
  line-height: 1.45;
  color: #334155;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.swipe-card__edit-spec {
  align-self: flex-start;
  margin-top: 2px;
  margin-bottom: 0;
  padding: 6px 14px;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 800;
  min-height: 36px;
  border: 1px solid #dbeafe;
  color: var(--primary);
  background: #fff;
}

.swipe-card__qty-row {
  margin-top: auto;
  margin-bottom: 0;
  padding-top: 10px;
  border-top: 1px solid #f1f5f9;
  align-items: center;
  justify-content: space-between;
}

.swipe-card__inner .quantity {
  grid-template-columns: 44px 40px 44px;
  gap: 2px;
}

.swipe-card__inner .quantity button {
  min-height: 40px;
  font-size: 17px;
  line-height: 1;
  border-radius: 10px;
  background: #f1f5f9;
  color: #0f172a;
}

.swipe-card__inner .quantity strong {
  font-size: 15px;
  font-weight: 900;
  font-variant-numeric: tabular-nums;
  color: var(--ink, #0f172a);
}

.swipe-card__qty-row .muted.tiny {
  margin: 0;
  font-weight: 800;
}

.swipe-card__spec {
  margin: 0;
  font-size: 12px;
  color: var(--muted);
  line-height: 1.4;
}

.deck-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  margin-top: 4px;
  padding-top: 4px;
  border-top: 1px solid rgba(220, 229, 240, 0.9);
}

.deck-nav-btn {
  min-height: 36px;
  padding: 0 8px;
  font-size: 12px;
}

.deck-nav-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.deck-dots {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  flex: 1;
}

.deck-dot {
  width: 7px;
  height: 7px;
  border-radius: 999px;
  background: #cbd5e1;
}

.deck-dot--on {
  background: var(--primary);
  transform: scale(1.15);
}


.muted.tiny {
  font-size: 12px;
  margin: 0 0 10px;
}

.swipe-card__inner .muted.tiny.swipe-card__spec-label {
  margin: 0 0 2px;
  font-size: 10px;
}

.section-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 18px 0 10px;
}

.section-title h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 800;
}

.footer-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 14px;
}

.panel--pick .footer-actions {
  margin-top: 8px;
  gap: 8px;
}

.footer-actions-single {
  margin-top: 8px;
}

.panel--pick .footer-actions-single {
  margin-top: 6px;
}

.generate-scheme-btn {
  min-height: 46px;
  font-weight: 900;
}

.panel--pick .generate-scheme-btn {
  min-height: 44px;
}

.footer-row2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.cart-card {
  padding: 14px;
}

.cart-check {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
  font-size: 13px;
  font-weight: 800;
  color: var(--primary);
}

.cart-check input {
  width: 18px;
  height: 18px;
}

.cart-card h3 {
  margin: 0;
  font-size: 16px;
}

.cart-card > p {
  margin: 8px 0 12px;
  color: var(--muted);
}

.line-check {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  cursor: pointer;
  flex: 1;
  min-width: 0;
}

.line-check input {
  margin-top: 4px;
  width: 18px;
  height: 18px;
}

.line-row-flex {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.line-body {
  display: grid;
  gap: 6px;
  flex: 1;
  min-width: 0;
}

.line-edit-spec {
  color: var(--primary);
  flex-shrink: 0;
  margin-top: 2px;
}

.cart-title-row {
  align-items: flex-start;
}

.cart-title-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.cart-title-actions .text-btn:first-of-type {
  color: var(--primary);
}

.cart-title-actions .text-btn:last-of-type {
  color: var(--danger);
}

.text-btn {
  min-height: 36px;
  border: 0;
  background: transparent;
  font-weight: 800;
}

.quantity {
  display: inline-grid;
  grid-template-columns: 40px 42px 40px;
  align-items: center;
  text-align: center;
}

.quantity button {
  border: 0;
  border-radius: 12px;
  background: #edf3ff;
  color: var(--primary);
  font-weight: 900;
}

.summary.secondary-sum {
  margin-top: 8px;
  opacity: 0.92;
}

.summary {
  display: flex;
  justify-content: space-between;
  margin-top: 14px;
  padding: 16px;
}

.summary strong {
  color: var(--primary);
  font-size: 20px;
}

.proposal-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 14px;
}

.proposal-actions .save-btn {
  margin-top: 0;
}

.save-btn--secondary {
  box-shadow: inset 0 0 0 1px #cbd5e1;
}

.line-card {
  padding: 14px;
}

.line-body span {
  color: var(--muted);
}

.save-btn {
  margin-top: 14px;
}

.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.muted {
  color: var(--muted);
  font-size: 14px;
}

.empty-tip {
  padding: 16px;
  text-align: center;
  font-size: 14px;
  color: var(--muted);
}
</style>
