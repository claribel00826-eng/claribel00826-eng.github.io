<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useAppStore } from '@/stores/appStore'
import { pickCustomerIdFromQuery } from '@/utils/wechatDeepLink'

const STORAGE_KEY = 'customer-service-h5-fab-pos'

const route = useRoute()
const router = useRouter()
const store = useAppStore()

/** 工作台首页悬浮入口：类 AssistiveTouch，可拖拽（位置落盘本地） */
const visible = computed(() => route.name !== 'home')

const fabRef = ref<HTMLElement | null>(null)
/** null 时使用 CSS 默认 right/bottom；有值则用 left+bottom（px，相对初始包含块 viewport） */
const fabPos = ref<{ left: number; bottom: number } | null>(null)
const dragging = ref(false)

const tapThresholdPx = 14
let originPointer = { x: 0, y: 0 }
let originFab = { left: 0, bottom: 0 }
let activePointerId: number | null = null
/** pointer 轻点已触发 goHome 后，在短时间内忽略冗余的 synthesize click */
let skipClickAfterPointerTapUntil = 0

function fabSizePx(): number {
  return typeof window !== 'undefined' && window.innerWidth <= 360 ? 54 : 58
}

function safeBottomInset(): number {
  if (typeof window === 'undefined') return 0
  const v = getComputedStyle(document.documentElement).getPropertyValue('env(safe-area-inset-bottom)')
  const n = parseFloat(v.replace('px', '').trim())
  return Number.isFinite(n) ? n : 0
}

function clampPos(left: number, bottom: number) {
  const w = typeof window !== 'undefined' ? window.innerWidth : 430
  const h = typeof window !== 'undefined' ? window.innerHeight : 800
  const sz = fabSizePx()
  const inset = safeBottomInset()
  const pad = 8
  /** 留出底部全局输入条，避免把球拖进场内完全不可操作区 */
  const minBottomFromDock = 72 + inset
  const minBottom = inset + pad
  const bottomClampedMin = Math.max(minBottom, minBottomFromDock)
  const maxBottom = h - sz - pad
  const maxLeft = w - sz - pad

  return {
    left: Math.min(maxLeft, Math.max(pad, left)),
    bottom: Math.min(maxBottom, Math.max(bottomClampedMin, bottom)),
  }
}

const fabInlineStyle = computed(() => {
  if (!fabPos.value) return {}
  const p = fabPos.value
  return {
    left: `${p.left}px`,
    bottom: `${p.bottom}px`,
    right: 'auto',
    top: 'auto',
  } as Record<string, string>
})

function persistPos(p: { left: number; bottom: number }) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p))
  } catch {
    /* ignore */
  }
}

function loadPersisted(): { left: number; bottom: number } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const o = JSON.parse(raw) as unknown
    if (
      typeof o === 'object' &&
      o !== null &&
      typeof (o as { left: unknown }).left === 'number' &&
      typeof (o as { bottom: unknown }).bottom === 'number'
    ) {
      return clampPos((o as { left: number; bottom: number }).left, (o as { bottom: number }).bottom)
    }
  } catch {
    /* ignore */
  }
  return null
}

/** 尚无自定义坐标时，用当前渲染位置转成 left/bottom，便于拖拽连续 */
function ensureFabPosFromDOM() {
  const el = fabRef.value
  if (!el || fabPos.value) return
  const rect = el.getBoundingClientRect()
  fabPos.value = clampPos(rect.left, window.innerHeight - rect.bottom)
}

const goHome = () => {
  if (!store.isLoggedIn) store.login()
  const customerId = pickCustomerIdFromQuery(route.query)
  if (customerId && store.customers.some((c) => c.id === customerId)) {
    store.setCustomer(customerId)
    router.replace({ name: 'development' })
    return
  }
  router.replace({ path: '/home', query: {} })
}

function onResize() {
  if (!fabPos.value) return
  fabPos.value = clampPos(fabPos.value.left, fabPos.value.bottom)
  persistPos(fabPos.value)
}

onMounted(() => {
  fabPos.value = loadPersisted()
  window.addEventListener('resize', onResize, { passive: true })
})

onUnmounted(() => {
  window.removeEventListener('resize', onResize)
})

function tearDownPointers(el: HTMLElement, pid?: number | null) {
  el.removeEventListener('pointermove', onPointerMove)
  el.removeEventListener('pointerup', onPointerEnd)
  el.removeEventListener('pointercancel', onPointerEnd)
  if (pid != null) {
    try {
      if (el.hasPointerCapture(pid)) el.releasePointerCapture(pid)
    } catch {
      /* ignore */
    }
  }
}

function onPointerMove(e: PointerEvent) {
  if (activePointerId !== e.pointerId || !fabPos.value) return
  fabPos.value = clampPos(
    originFab.left + (e.clientX - originPointer.x),
    originFab.bottom - (e.clientY - originPointer.y),
  )
}

function onPointerEnd(e: PointerEvent) {
  const el = fabRef.value
  if (!el || activePointerId !== e.pointerId) return
  tearDownPointers(el, e.pointerId)

  dragging.value = false

  const d = Math.hypot(e.clientX - originPointer.x, e.clientY - originPointer.y)
  if (d < tapThresholdPx) {
    skipClickAfterPointerTapUntil = performance.now() + 450
    goHome()
  } else if (fabPos.value) persistPos(fabPos.value)

  activePointerId = null
}

function onFabClick() {
  if (performance.now() < skipClickAfterPointerTapUntil) return
  goHome()
}

function onPointerDown(e: PointerEvent) {
  if (!visible.value) return
  if (e.pointerType === 'mouse' && e.button !== 0) return

  const el = fabRef.value
  if (!el) return

  ensureFabPosFromDOM()
  if (!fabPos.value) return

  e.preventDefault()
  activePointerId = e.pointerId
  dragging.value = true
  originPointer = { x: e.clientX, y: e.clientY }
  originFab = { ...fabPos.value }

  try {
    el.setPointerCapture(e.pointerId)
  } catch {
    /* ignore */
  }

  el.addEventListener('pointermove', onPointerMove, { passive: false })
  el.addEventListener('pointerup', onPointerEnd)
  el.addEventListener('pointercancel', onPointerEnd)
}
</script>

<template>
  <button
    v-show="visible"
    ref="fabRef"
    type="button"
    class="fab-home"
    :class="{ 'fab-home--dragging': dragging }"
    :style="fabInlineStyle"
    aria-label="回到首页工作台（可拖动位置）"
    @pointerdown="onPointerDown"
    @click.prevent="onFabClick"
  >
    <span class="fab-home__glow" aria-hidden="true" />
    <svg class="fab-home__icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        fill="currentColor"
        fill-opacity="0.88"
        d="M4.35 11.42 12 5.06l7.65 6.36a.65.65 0 0 1-.83.99l-.48-.41V17.9c0 1-.81 1.82-1.82 1.82H14.9V14.9a1.76 1.76 0 0 0-1.76-1.76h-2.28c-.97 0-1.76.79-1.76 1.76v4.82H6.67c-1 0-1.82-.81-1.82-1.82v-6.53l-.48.41a.65.65 0 1 1-.83-.99Zm7.43-8.54a.73.73 0 0 1 .44 0l8.73 7.26a.93.93 0 0 1-1.03 1.54l-.9-.74V17.9A3.41 3.41 0 0 1 15.73 21H8.27a3.41 3.41 0 0 1-3.41-3.41v-7.96l-.9.74a.93.93 0 0 1-.99-1.57l8.73-7.26Z"
      />
    </svg>
  </button>
</template>

<style scoped>
.fab-home {
  position: fixed;
  z-index: 45;
  /* 与 .app-shell（max 430px 居中）右缘对齐，而非贴齐整屏右缘 */
  right: calc(
    12px + max(0px, (100vw - min(430px, 100vw)) / 2) + env(safe-area-inset-right, 0px)
  );
  bottom: calc(88px + env(safe-area-inset-bottom, 0px));
  width: 58px;
  height: 58px;
  margin: 0;
  padding: 0;
  border: none;
  border-radius: 50%;
  cursor: grab;
  -webkit-tap-highlight-color: transparent;
  touch-action: none;
  color: rgba(55, 60, 70, 0.92);

  background: rgba(253, 253, 255, 0.72);
  backdrop-filter: blur(22px) saturate(1.55);
  -webkit-backdrop-filter: blur(22px) saturate(1.55);

  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.92) inset,
    0 0 0 0.65px rgba(255, 255, 255, 0.55),
    0 2px 4px rgba(15, 23, 42, 0.08),
    0 12px 28px rgba(15, 23, 42, 0.16),
    0 26px 50px rgba(15, 23, 42, 0.12);

  transition:
    transform 0.22s cubic-bezier(0.34, 1.2, 0.64, 1),
    box-shadow 0.22s ease,
    opacity 0.15s ease;
}

.fab-home--dragging {
  cursor: grabbing;
  transition:
    opacity 0.15s ease,
    box-shadow 0.22s ease;
  transform: scale(1.04);
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.85) inset,
    0 0 0 0.65px rgba(255, 255, 255, 0.5),
    0 4px 14px rgba(15, 23, 42, 0.12),
    0 18px 40px rgba(15, 23, 42, 0.2),
    0 32px 60px rgba(15, 23, 42, 0.14);
  opacity: 0.96;
}

@media (prefers-reduced-motion: reduce) {
  .fab-home {
    transition: none;
  }

  .fab-home--dragging {
    transform: none;
  }
}

.fab-home:focus-visible {
  outline: 3px solid rgba(31, 94, 255, 0.45);
  outline-offset: 3px;
}

.fab-home:active:not(.fab-home--dragging) {
  transform: scale(0.93);
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.75) inset,
    0 0 0 0.65px rgba(255, 255, 255, 0.5),
    0 8px 20px rgba(15, 23, 42, 0.14);
}

.fab-home__glow {
  position: absolute;
  inset: 4px;
  border-radius: inherit;
  background: radial-gradient(
    120% 90% at 30% 18%,
    rgba(255, 255, 255, 0.74) 0%,
    rgba(255, 255, 255, 0) 58%
  );
  opacity: 0.85;
  pointer-events: none;
}

.fab-home__icon {
  position: relative;
  width: 26px;
  height: 26px;
  display: block;
  margin: 0 auto;
  filter: drop-shadow(0 0.5px 0 rgba(255, 255, 255, 0.45));
}

@media (max-width: 360px) {
  .fab-home {
    width: 54px;
    height: 54px;
    right: calc(
      10px + max(0px, (100vw - min(430px, 100vw)) / 2) + env(safe-area-inset-right, 0px)
    );
    bottom: calc(84px + env(safe-area-inset-bottom, 0px));
  }

  .fab-home__icon {
    width: 24px;
    height: 24px;
  }
}
</style>
