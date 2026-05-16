<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import AppHeader from '@/components/AppHeader.vue'
import { useAppStore } from '@/stores/appStore'

const route = useRoute()
const store = useAppStore()
const orderId = ref(store.orders[0]?.id || '')
const reason = ref('客户需求变更')
const note = ref('')
const submitted = ref(false)

watch(
  () => store.voiceFillTick,
  () => {
    if (store.voiceFillTargetRoute !== 'order-change' || route.name !== 'order-change') return
    const t = store.voiceFillText.trim()
    if (!t) return
    note.value = note.value ? `${note.value}\n${t}` : t
  },
)
</script>

<template>
  <main class="app-shell">
    <AppHeader title="订单变更" />
    <section class="page">
      <div class="form-field">
        <label>选择订单</label>
        <select v-model="orderId">
          <option v-for="order in store.orders" :key="order.id" :value="order.id">
            {{ order.orderNo }} · {{ order.customerName }}
          </option>
        </select>
      </div>
      <div class="form-field">
        <label>异常原因</label>
        <select v-model="reason">
          <option>客户需求变更</option>
          <option>产品型号调整</option>
          <option>交付日期调整</option>
        </select>
      </div>
      <div class="form-field">
        <label>备注说明</label>
        <textarea v-model="note" placeholder="补充说明（可选）" />
      </div>
      <button class="primary-btn full-btn" type="button" :disabled="submitted" @click="submitted = true">
        提交变更
      </button>
      <section v-if="submitted" class="card result-card">
        <strong>已提交订单变更</strong>
        <p>{{ reason }}{{ note ? `，备注：${note}` : '' }}，后续由原订单流程处理。</p>
      </section>
    </section>
  </main>
</template>

<style scoped>
.result-card {
  padding: 16px;
  margin-top: 14px;
}

.result-card p {
  color: var(--muted);
  line-height: 1.6;
}
</style>
