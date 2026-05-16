<script setup lang="ts">
import { onUnmounted, ref } from 'vue'

import { useAppStore } from '@/stores/appStore'

const props = withDefaults(
  defineProps<{
    /** 文字模式输入框占位 */
    textPlaceholder?: string
    /** 文字模式右侧按钮文案（微信为「发送」） */
    sendLabel?: string
    disabled?: boolean
    /** 松手后模拟转写出的文本（Mock） */
    voiceTranscriptMock?: string
  }>(),
  {
    textPlaceholder: '输入消息',
    sendLabel: '发送',
    disabled: false,
    voiceTranscriptMock: '（语音转写结果）',
  },
)

const emit = defineEmits<{
  submit: [value: string]
}>()

const store = useAppStore()
const text = ref('')

const MIN_HOLD_MS = 400
const CANCEL_SLIDE_PX = 72

const isPressing = ref(false)
const isCancelled = ref(false)
const pressStartMs = ref(0)
const pressStartY = ref(0)
const tip = ref('')
let tipTimer: ReturnType<typeof setTimeout> | null = null
let activePointerId: number | null = null

const showTip = (msg: string) => {
  tip.value = msg
  if (tipTimer) clearTimeout(tipTimer)
  tipTimer = setTimeout(() => {
    tip.value = ''
    tipTimer = null
  }, 1600)
}

const clearTipTimer = () => {
  if (tipTimer) {
    clearTimeout(tipTimer)
    tipTimer = null
  }
}

const switchToText = () => {
  if (props.disabled) return
  if (store.voiceMode) store.toggleVoiceMode()
}

const switchToVoice = () => {
  if (props.disabled) return
  if (!store.voiceMode) store.toggleVoiceMode()
}

const submitText = () => {
  if (props.disabled) return
  const v = text.value.trim()
  if (!v) {
    showTip('不能发送空白消息')
    return
  }
  emit('submit', v)
  text.value = ''
}

const cleanupHoldListeners = (el: HTMLElement) => {
  el.removeEventListener('pointermove', onHoldPointerMove)
  el.removeEventListener('pointerup', onHoldPointerEnd)
  el.removeEventListener('pointercancel', onHoldPointerEnd)
}

const onHoldPointerMove = (e: PointerEvent) => {
  if (!isPressing.value || activePointerId !== e.pointerId) return
  if (pressStartY.value - e.clientY >= CANCEL_SLIDE_PX) {
    isCancelled.value = true
  }
}

const onHoldPointerEnd = (e: PointerEvent) => {
  if (activePointerId !== e.pointerId) return
  const el = e.currentTarget as HTMLElement
  cleanupHoldListeners(el)
  try {
    if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId)
  } catch {
    /* ignore */
  }
  activePointerId = null

  if (!isPressing.value) return
  isPressing.value = false

  const duration = Date.now() - pressStartMs.value

  if (isCancelled.value) {
    showTip('已取消发送')
    return
  }
  if (duration < MIN_HOLD_MS) {
    showTip('说话时间太短')
    return
  }
  emit('submit', props.voiceTranscriptMock)
}

const onHoldPointerDown = (e: PointerEvent) => {
  if (props.disabled) return
  if (e.button !== 0) return
  const el = e.currentTarget as HTMLElement
  isCancelled.value = false
  isPressing.value = true
  pressStartMs.value = Date.now()
  pressStartY.value = e.clientY
  activePointerId = e.pointerId
  try {
    el.setPointerCapture(e.pointerId)
  } catch {
    /* ignore */
  }
  el.addEventListener('pointermove', onHoldPointerMove)
  el.addEventListener('pointerup', onHoldPointerEnd)
  el.addEventListener('pointercancel', onHoldPointerEnd)
}

onUnmounted(() => {
  clearTipTimer()
})
</script>

<template>
  <footer
    class="voice-composer"
    :class="{
      'voice-composer--text': !store.voiceMode,
      'voice-composer--pressing': isPressing,
      'voice-composer--will-cancel': isPressing && isCancelled,
    }"
  >
    <!-- 仿微信：全屏录音态提示 -->
    <Teleport to="body">
      <div v-if="isPressing" class="wx-record-mask" aria-live="polite">
        <div class="wx-record-panel" :class="{ danger: isCancelled }">
          <div class="wx-record-wave" aria-hidden="true">
            <span /><span /><span /><span /><span />
          </div>
          <p class="wx-record-title">{{ isCancelled ? '松开手指，取消发送' : '松手发送，上移取消' }}</p>
        </div>
      </div>
    </Teleport>

    <p v-if="tip && !isPressing" class="wx-toast" role="status">{{ tip }}</p>

    <!-- 语音模式：左「键盘」| 中「按住说话」 -->
    <template v-if="store.voiceMode">
      <button
        type="button"
        class="wx-side wx-side--keyboard"
        :disabled="disabled"
        aria-label="切换到文字输入"
        @click="switchToText"
      >
        键盘
      </button>
      <button
        type="button"
        class="wx-hold-talk"
        :disabled="disabled"
        :class="{ active: isPressing && !isCancelled, cancel: isPressing && isCancelled }"
        aria-label="按住说话"
        @pointerdown="onHoldPointerDown"
      >
        {{ isPressing ? (isCancelled ? '松开 取消' : '松开 发送') : '按住 说话' }}
      </button>
    </template>

    <!-- 文字模式：左「语音」| 输入框 | 右「发送」 -->
    <template v-else>
      <button
        type="button"
        class="wx-side wx-side--mic"
        :disabled="disabled"
        aria-label="切换到语音输入"
        @click="switchToVoice"
      >
        语音
      </button>
      <input
        v-model="text"
        class="wx-text-input"
        type="text"
        enterkeyhint="send"
        :disabled="disabled"
        :placeholder="textPlaceholder"
        @keyup.enter="submitText"
      />
      <button
        type="button"
        class="wx-send"
        :disabled="disabled"
        @click="submitText"
      >
        {{ sendLabel }}
      </button>
    </template>
  </footer>
</template>

<style scoped>
.voice-composer {
  position: relative;
  z-index: 1;
  display: grid;
  align-items: center;
  gap: 8px;
  width: 100%;
  margin: 0;
  padding: 8px 10px calc(8px + env(safe-area-inset-bottom));
  touch-action: manipulation;
}

/* 语音：两列；文字：三列 */
.voice-composer:not(.voice-composer--text) {
  grid-template-columns: 52px 1fr;
}

.voice-composer--text {
  grid-template-columns: 52px 1fr 58px;
}

.wx-side {
  min-height: 44px;
  min-width: 44px;
  padding: 0 6px;
  border: 0;
  border-radius: 8px;
  background: #f2f2f2;
  color: #191919;
  font-size: 13px;
  font-weight: 700;
  line-height: 1.15;
}

.wx-side:disabled {
  opacity: 0.45;
}

.wx-hold-talk {
  min-height: 44px;
  border: 0;
  border-radius: 8px;
  background: #ffffff;
  color: #191919;
  font-size: 17px;
  font-weight: 600;
  letter-spacing: 0.02em;
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
  box-shadow: inset 0 0 0 1px #d8d8d8;
}

.wx-hold-talk:disabled {
  opacity: 0.45;
}

.wx-hold-talk.active {
  background: #e8e8e8;
  box-shadow: inset 0 0 0 1px #c6c6c6;
}

.wx-hold-talk.cancel {
  background: #fde8e8;
  color: #b42318;
  box-shadow: inset 0 0 0 1px #f5c0c0;
}

.wx-text-input {
  min-width: 0;
  min-height: 44px;
  padding: 0 12px;
  border: 0;
  border-radius: 8px;
  background: #f2f2f2;
  color: #191919;
  font-size: 16px;
  outline: none;
}

.wx-text-input:disabled {
  opacity: 0.5;
}

/* 微信绿：发送 */
.wx-send {
  min-height: 44px;
  padding: 0 8px;
  border: 0;
  border-radius: 8px;
  background: #07c160;
  color: #fff;
  font-size: 15px;
  font-weight: 700;
}

.wx-send:disabled {
  opacity: 0.45;
}

.wx-toast {
  position: absolute;
  left: 50%;
  bottom: 100%;
  transform: translateX(-50%);
  margin: 0 0 8px;
  padding: 10px 16px;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.78);
  color: #fff;
  font-size: 14px;
  white-space: nowrap;
  pointer-events: none;
  z-index: 5;
}
</style>

<style>
/* Teleport 到 body，不用 scoped 以便遮罩全屏 */
.wx-record-mask {
  position: fixed;
  inset: 0;
  z-index: 9998;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  align-items: center;
  padding-bottom: 28vh;
  background: rgba(0, 0, 0, 0.45);
  pointer-events: none;
}

.wx-record-panel {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 20px 28px 18px;
  border-radius: 16px;
  background: rgba(60, 60, 60, 0.92);
  color: #fff;
}

.wx-record-panel.danger {
  background: rgba(120, 30, 30, 0.92);
}

.wx-record-wave {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  height: 40px;
}

.wx-record-wave span {
  width: 4px;
  height: 12px;
  border-radius: 2px;
  background: #9ef0b5;
  animation: wx-wave 0.9s ease-in-out infinite;
}

.wx-record-wave span:nth-child(2) {
  animation-delay: 0.1s;
}
.wx-record-wave span:nth-child(3) {
  animation-delay: 0.2s;
}
.wx-record-wave span:nth-child(4) {
  animation-delay: 0.3s;
}
.wx-record-wave span:nth-child(5) {
  animation-delay: 0.4s;
}

.wx-record-panel.danger .wx-record-wave span {
  background: #fecaca;
}

@keyframes wx-wave {
  0%,
  100% {
    transform: scaleY(0.55);
    opacity: 0.7;
  }
  50% {
    transform: scaleY(1.65);
    opacity: 1;
  }
}

.wx-record-title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 0.02em;
}
</style>
