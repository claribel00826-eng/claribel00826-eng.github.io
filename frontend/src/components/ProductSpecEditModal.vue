<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import type { Product } from '@/types/business'

const props = defineProps<{
  open: boolean
  product: Product | null
  /** 表单初始值（外部已按字段 key 合并好） */
  parts: Record<string, string>
  quantity: number
}>()

const emit = defineEmits<{
  'update:open': [v: boolean]
  save: [payload: { parts: Record<string, string>; quantity: number }]
}>()

const localParts = ref<Record<string, string>>({})
const localQty = ref(1)

watch(
  () => props.open,
  (v) => {
    if (!v) return
    localQty.value = Math.max(1, props.quantity)
    localParts.value = { ...props.parts }
  },
)

watch(
  () => props.parts,
  (p) => {
    if (!props.open) return
    localParts.value = { ...p }
  },
  { deep: true },
)

const fields = computed(() => props.product?.specFields ?? [])

const hasStructured = computed(() => fields.value.length > 0)

function close() {
  emit('update:open', false)
}

function save() {
  emit('save', { parts: { ...localParts.value }, quantity: localQty.value })
  emit('update:open', false)
}

function setPart(key: string, v: string) {
  localParts.value = { ...localParts.value, [key]: v }
}

const summaryKey = 'summary'
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open && product"
      class="h5-modal-overlay spec-edit-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="spec-edit-title"
    >
      <div class="h5-modal-backdrop" tabindex="-1" @click="close" />
      <div class="h5-modal-panel spec-edit-panel card" role="document" @click.stop>
        <header class="spec-edit-head">
          <h2 id="spec-edit-title">编辑规格 · {{ product.name }}</h2>
          <button type="button" class="close-btn" @click="close">关闭</button>
        </header>

        <div v-if="hasStructured" class="spec-edit-fields">
          <div v-for="f in fields" :key="f.key" class="form-field">
            <label>{{ f.label }}</label>
            <input
              type="text"
              :value="localParts[f.key] ?? ''"
              :placeholder="f.placeholder || '选填'"
              @input="setPart(f.key, ($event.target as HTMLInputElement).value)"
            />
          </div>
        </div>
        <div v-else class="form-field">
          <label>规格摘要</label>
          <textarea
            rows="5"
            :value="localParts[summaryKey] ?? ''"
            placeholder="单行或多行规格说明"
            class="spec-edit-textarea"
            @input="setPart(summaryKey, ($event.target as HTMLTextAreaElement).value)"
          />
        </div>

        <div class="form-field spec-edit-qty">
          <label>数量</label>
          <div class="quantity-row">
            <button type="button" class="ghost-btn" @click="localQty = Math.max(1, localQty - 1)">−</button>
            <strong>{{ localQty }}</strong>
            <button type="button" class="ghost-btn" @click="localQty += 1">+</button>
          </div>
        </div>

        <div class="spec-edit-actions">
          <button type="button" class="ghost-btn full-btn" @click="close">取消</button>
          <button type="button" class="primary-btn full-btn" @click="save">应用到本单</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.spec-edit-overlay {
  z-index: 200;
}

.spec-edit-panel {
  max-height: min(88vh, 640px);
  display: flex;
  flex-direction: column;
  padding: 16px;
  overflow: hidden;
}

.spec-edit-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.spec-edit-head h2 {
  margin: 0;
  flex: 1;
  font-size: 18px;
  font-weight: 800;
  line-height: 1.35;
}

.close-btn {
  min-height: 36px;
  padding: 0 12px;
  border: 0;
  border-radius: 10px;
  background: #f1f5f9;
  font-weight: 800;
  flex-shrink: 0;
}

.spec-edit-fields {
  margin-top: 12px;
  overflow-y: auto;
  flex: 1;
  padding-right: 4px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.form-field label {
  display: block;
  margin-bottom: 4px;
  font-size: 12px;
  font-weight: 800;
  color: var(--ink, #0f172a);
}

.form-field input {
  width: 100%;
  box-sizing: border-box;
  min-height: 42px;
  padding: 0 10px;
  border-radius: 10px;
  border: 1px solid #e2e8f0;
  font-size: 14px;
}

.spec-edit-textarea {
  width: 100%;
  box-sizing: border-box;
  padding: 10px;
  border-radius: 10px;
  border: 1px solid #e2e8f0;
  font-size: 14px;
  resize: vertical;
  min-height: 120px;
}

.spec-edit-qty {
  margin-top: 12px;
}

.quantity-row {
  display: flex;
  align-items: center;
  gap: 16px;
}

.quantity-row strong {
  min-width: 28px;
  text-align: center;
  font-size: 17px;
}

.spec-edit-actions {
  margin-top: 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.full-btn {
  width: 100%;
}
</style>
