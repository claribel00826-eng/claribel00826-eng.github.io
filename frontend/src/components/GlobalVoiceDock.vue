<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import VoiceComposer from '@/components/VoiceComposer.vue'
import { recognizeIntent } from '@/services/intentService'
import { useAppStore } from '@/stores/appStore'

const route = useRoute()
const router = useRouter()
const store = useAppStore()

const routeName = computed(() => (route.name == null ? '' : String(route.name)))

/** 不展示底部全局语音输入的页面（保留意图弹层 Teleport） */
const VOICE_BAR_HIDDEN_ROUTES = new Set([
  'quick-scheme',
  'proposal-pdf',
  'proposal-history',
  'quote-pdf',
  'quote-history',
  'quote',
  'follow-write',
  'follow-ups',
  'follow-customer-detail',
  'development',
])

const showVoiceBar = computed(() => !VOICE_BAR_HIDDEN_ROUTES.has(routeName.value))

const fillable = computed(() => ['service', 'rush-order', 'order-change'].includes(routeName.value))

const fillLabel = computed(() => {
  switch (routeName.value) {
    case 'service':
      return '填入问题'
    case 'rush-order':
      return '填入理由'
    case 'order-change':
      return '填入备注'
    default:
      return '填入当前页'
  }
})

const intent = computed(() => store.lastIntent)
const slots = computed(() => intent.value?.slots)

const sheetTitle = computed(() => {
  const m = slots.value?.mode
  if (m === 'both') return '识别结果'
  if (m === 'customer_only') return '识别结果 · 仅客户'
  if (m === 'function_only') return '识别结果 · 仅功能'
  return '识别结果 · 未完全识别'
})

const modeHint = computed(() => {
  const m = slots.value?.mode
  if (m === 'both') return '已在语句中识别到客户与要去的能力，可一键切换工作客户并跳转。'
  if (m === 'customer_only') return '已识别客户称呼，但未识别具体业务（如报价、选品、交期）。可切换客户后再从宫格进入能力。'
  if (m === 'function_only') return '已识别业务能力；语句中未指名客户，将沿用当前工作客户。'
  return '未识别到主数据客户名或业务能力关键词，请换种说法或通过宫格操作。'
})

const customerLine = computed(() => {
  if (!slots.value?.hasCustomer) return '未识别'
  return slots.value.customerName || '未识别'
})

const functionLine = computed(() => {
  if (!slots.value?.hasFunction) return '未识别'
  if (slots.value.functionLabel) return slots.value.functionLabel
  return intent.value?.intentLabel || '未识别'
})

const confidencePct = computed(() =>
  intent.value ? Math.round(Math.min(1, Math.max(0, intent.value.confidence)) * 100) : 0,
)

const customerRefs = computed(() => store.customers.map((c) => ({ id: c.id, name: c.name })))

const onSubmit = async (text: string) => {
  store.lastUtterance = text
  store.intentLoading = true
  try {
    const result = await recognizeIntent(text, route.name, customerRefs.value)
    store.setLastIntent(result)
  } finally {
    store.intentLoading = false
  }
}

const closePanel = () => {
  store.clearLastIntent()
}

const pushAfterClose = (path: string) => {
  store.clearLastIntent()
  void router.push(path)
}

/** 仅功能或未同时带客户：不切换客户 */
const goSuggestPlain = () => {
  const path = intent.value?.suggestedPath
  if (!path) return
  pushAfterClose(path)
}

/** 语句中识别到客户且需要一并切换（客户 + 可跳转路径） */
const goWithCustomer = () => {
  const li = intent.value
  const path = li?.suggestedPath
  if (!li || !path) return
  if (li.slots.customerId) store.setCustomer(li.slots.customerId)
  pushAfterClose(path)
}

/** 仅识别到客户：切换工作客户 */
const goSwitchCustomerOnly = (thenPath: string) => {
  const id = intent.value?.slots?.customerId
  if (!id) return
  store.setCustomer(id)
  pushAfterClose(thenPath)
}

const applyFill = () => {
  if (!fillable.value || !store.lastUtterance) return
  store.publishVoiceFill(routeName.value, store.lastUtterance)
}
</script>

<template>
  <div v-if="showVoiceBar" class="global-dock" aria-label="全局语音与意图识别">
    <VoiceComposer
      text-placeholder="输入消息"
      send-label="发送"
      :disabled="store.intentLoading"
      @submit="onSubmit"
    />
  </div>
  <Teleport to="body">
    <Transition name="intent-modal">
      <div
        v-if="intent && slots"
        class="h5-modal-overlay intent-modal-overlay"
        role="dialog"
        aria-modal="true"
        aria-labelledby="intent-modal-title"
      >
        <div class="h5-modal-backdrop" tabindex="-1" @click="closePanel" />
        <aside class="h5-modal-panel intent-modal-panel card" role="document" @click.stop>
          <div class="sheet-handle" aria-hidden="true" />

          <header class="intent-sheet-head">
            <div class="head-top">
              <h2 id="intent-modal-title">{{ sheetTitle }}</h2>
              <span class="conf-chip" aria-label="置信度">{{ confidencePct }}%</span>
            </div>
            <p class="mode-hint">{{ modeHint }}</p>
          </header>

          <div class="intent-slot-grid">
            <div class="slot-card" :data-on="slots.hasCustomer">
              <span class="slot-label">客户</span>
              <p class="slot-value">{{ customerLine }}</p>
            </div>
            <div class="slot-card" :data-on="slots.hasFunction">
              <span class="slot-label">功能</span>
              <p class="slot-value">{{ functionLine }}</p>
            </div>
          </div>

          <blockquote class="utterance-block">
            <span class="uq-label">原话</span>
            <p class="uq-text">{{ intent.summary }}</p>
          </blockquote>

          <p class="intent-sub">{{ intent.intentLabel }}</p>

          <div class="intent-actions">
            <!-- 客户 + 功能 + 可跳转 -->
            <template v-if="slots.mode === 'both' && intent.suggestedPath">
              <button class="intent-primary full" type="button" @click="goWithCustomer">
                切换客户并前往
              </button>
            </template>

            <!-- 仅功能 + 可跳转 -->
            <template v-else-if="slots.mode === 'function_only' && intent.suggestedPath">
              <button class="intent-primary full" type="button" @click="goSuggestPlain">前往页面</button>
            </template>

            <!-- 客户 + 功能但无路径（如询价） -->
            <template v-else-if="slots.mode === 'both' && !intent.suggestedPath && slots.customerId">
              <button class="intent-primary full" type="button" @click="goSwitchCustomerOnly('/home')">
                切换到该客户
              </button>
            </template>

            <!-- 仅客户 -->
            <template v-else-if="slots.mode === 'customer_only' && slots.customerId">
              <button class="intent-primary full" type="button" @click="goSwitchCustomerOnly('/home')">
                切换到该客户
              </button>
              <button class="intent-secondary full" type="button" @click="goSwitchCustomerOnly('/quick-scheme?step=recommend')">
                切换并打开方案速配
              </button>
              <button class="intent-ghost full" type="button" @click="pushAfterClose('/customers')">去选择客户</button>
            </template>

            <!-- 未识别 -->
            <template v-else>
              <button class="intent-primary full" type="button" @click="closePanel">知道了</button>
            </template>

            <button
              v-if="fillable"
              class="intent-secondary full"
              type="button"
              @click="applyFill"
            >
              {{ fillLabel }}
            </button>

            <button class="intent-close-ghost full" type="button" @click="closePanel">关闭</button>
          </div>
        </aside>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.global-dock {
  position: fixed;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 30;
  width: min(430px, 100vw);
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  background: rgba(255, 255, 255, 0.02);
}

.global-dock :deep(.voice-composer) {
  border-top: 1px solid var(--line);
  backdrop-filter: blur(18px);
  background: rgba(255, 255, 255, 0.96);
}

.intent-modal-overlay {
  z-index: 190;
  align-items: flex-end;
  justify-content: center;
  padding-top: max(12px, env(safe-area-inset-top, 0px));
  padding-bottom: max(8px, env(safe-area-inset-bottom, 0px));
}

.intent-modal-panel {
  width: 100%;
  max-width: min(430px, 100vw);
  max-height: min(78vh, 560px);
  margin: 0;
  padding: 10px 18px 20px;
  border-radius: 20px 20px 14px 14px;
  border: 1px solid rgba(226, 232, 240, 0.95);
  background: linear-gradient(180deg, #f8fafc 0%, #fff 48px);
  box-shadow:
    0 -8px 40px rgba(15, 23, 42, 0.12),
    0 20px 50px rgba(15, 23, 42, 0.2);
}

.sheet-handle {
  width: 40px;
  height: 4px;
  margin: 4px auto 12px;
  border-radius: 999px;
  background: #e2e8f0;
}

.intent-sheet-head {
  margin-bottom: 14px;
}

.head-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.intent-sheet-head h2 {
  margin: 0;
  flex: 1;
  min-width: 0;
  font-size: 18px;
  font-weight: 800;
  line-height: 1.3;
  color: var(--ink);
}

.conf-chip {
  flex-shrink: 0;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 800;
  color: var(--primary);
  background: rgba(31, 94, 255, 0.1);
}

.mode-hint {
  margin: 8px 0 0;
  font-size: 13px;
  line-height: 1.5;
  color: var(--muted);
}

.intent-slot-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.slot-card {
  padding: 10px 12px;
  border-radius: 14px;
  background: #f1f5f9;
  border: 1px solid transparent;
  transition:
    border-color 0.15s ease,
    background 0.15s ease;
}

.slot-card[data-on='true'] {
  background: #fff;
  border-color: rgba(31, 94, 255, 0.28);
  box-shadow: 0 1px 0 rgba(31, 94, 255, 0.06);
}

.slot-label {
  display: block;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.04em;
  color: #94a3b8;
  text-transform: uppercase;
}

.slot-value {
  margin: 6px 0 0;
  font-size: 14px;
  font-weight: 700;
  line-height: 1.35;
  color: #0f172a;
  word-break: break-word;
}

.utterance-block {
  margin: 14px 0 0;
  padding: 10px 12px;
  border-radius: 12px;
  border-left: 3px solid var(--primary);
  background: #f8fafc;
}

.utterance-block .uq-label {
  display: block;
  font-size: 11px;
  font-weight: 800;
  color: #64748b;
  margin-bottom: 4px;
}

.utterance-block .uq-text {
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
  color: #334155;
}

.intent-sub {
  margin: 10px 0 0;
  font-size: 12px;
  line-height: 1.45;
  color: #64748b;
}

.intent-actions {
  margin-top: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.intent-actions .full {
  width: 100%;
}

.intent-primary {
  min-height: 46px;
  border: 0;
  border-radius: 14px;
  padding: 0 16px;
  font-size: 15px;
  font-weight: 800;
  color: #fff;
  cursor: pointer;
  background: linear-gradient(135deg, var(--primary), var(--primary-dark));
  box-shadow: 0 8px 20px rgba(31, 94, 255, 0.28);
}

.intent-secondary {
  min-height: 44px;
  border: 1px solid #cbd5e1;
  border-radius: 14px;
  padding: 0 16px;
  font-size: 14px;
  font-weight: 800;
  color: #0f172a;
  cursor: pointer;
  background: #fff;
}

.intent-ghost {
  min-height: 44px;
  border: 0;
  border-radius: 14px;
  padding: 0 16px;
  font-size: 14px;
  font-weight: 800;
  color: var(--primary);
  cursor: pointer;
  background: transparent;
}

.intent-close-ghost {
  min-height: 40px;
  border: 0;
  border-radius: 12px;
  padding: 0 12px;
  font-size: 13px;
  font-weight: 700;
  color: #64748b;
  cursor: pointer;
  background: transparent;
}

.intent-modal-enter-active,
.intent-modal-leave-active {
  transition: opacity 0.2s ease;
}

.intent-modal-enter-active .h5-modal-panel,
.intent-modal-leave-active .h5-modal-panel {
  transition:
    transform 0.24s cubic-bezier(0.32, 0.72, 0, 1),
    opacity 0.2s ease;
}

.intent-modal-enter-from,
.intent-modal-leave-to {
  opacity: 0;
}

.intent-modal-enter-from .h5-modal-panel,
.intent-modal-leave-to .h5-modal-panel {
  transform: translateY(18px);
  opacity: 0.92;
}
</style>
