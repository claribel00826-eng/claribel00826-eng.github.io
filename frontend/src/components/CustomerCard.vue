<script setup lang="ts">
import type { Customer } from '@/types/business'

defineProps<{
  customer: Customer
  actionText?: string
  /** 该客户已有跟进条数，用于客户开拓/待跟进列表提示 */
  followUpCount?: number
}>()

defineEmits<{
  select: [customer: Customer]
}>()
</script>

<template>
  <article class="customer-card card">
    <div class="row">
      <span class="pill">{{ customer.tag }}</span>
      <span class="muted">{{ customer.lastOrderText }}</span>
    </div>
    <h3>{{ customer.name }}</h3>
    <p class="code-line">编码 {{ customer.code }}</p>
    <p>{{ customer.contact }} · {{ customer.phone }}</p>
    <p class="summary">{{ customer.needSummary }}</p>
    <p v-if="followUpCount != null && followUpCount > 0" class="follow-meta">已有 {{ followUpCount }} 条跟进记录</p>
    <button class="primary-btn full-btn" type="button" @click="$emit('select', customer)">
      {{ actionText || '进入处理' }}
    </button>
  </article>
</template>

<style scoped>
.customer-card {
  padding: 14px;
}

h3 {
  margin: 12px 0 4px;
  font-size: 17px;
}

.code-line {
  margin: 0 0 8px;
  font-size: 12px;
  font-weight: 800;
  color: var(--muted);
}

p {
  margin: 0;
  color: var(--muted);
  font-size: 13px;
  line-height: 1.5;
}

.summary {
  margin: 10px 0 14px;
  color: #334155;
}

.follow-meta {
  margin: -8px 0 12px;
  font-size: 12px;
  color: var(--primary);
  font-weight: 700;
}
</style>
