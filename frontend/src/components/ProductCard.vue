<script setup lang="ts">
import type { Product } from '@/types/business'

defineProps<{
  product: Product
  /** 选品页：是否显示「纳入本单方案」勾选 */
  schemePickable?: boolean
  schemePicked?: boolean
}>()

defineEmits<{
  add: [productId: string]
  'toggle-scheme-pick': [productId: string]
}>()
</script>

<template>
  <article class="product-card card" :class="{ 'product-card--pickable': schemePickable }">
    <label v-if="schemePickable" class="pick-row">
      <input
        type="checkbox"
        class="pick-cb"
        :checked="schemePicked"
        @change="$emit('toggle-scheme-pick', product.id)"
      />
      <span>纳入本单方案</span>
    </label>
    <div class="row">
      <span class="pill">{{ product.stockText }}</span>
      <strong>¥{{ product.price }}/{{ product.unit }}</strong>
    </div>
    <h3>{{ product.name }}</h3>
    <p>{{ product.spec }}</p>
    <p class="reason">{{ product.reason }}</p>
    <button class="primary-btn full-btn" type="button" @click="$emit('add', product.id)">加入购物车</button>
  </article>
</template>

<style scoped>
.product-card {
  padding: 14px;
}

.product-card--pickable {
  padding-top: 12px;
}

.pick-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
  font-size: 13px;
  font-weight: 800;
  color: var(--primary);
}

.pick-cb {
  width: 18px;
  height: 18px;
}

h3 {
  margin: 12px 0 6px;
  font-size: 17px;
}

p {
  margin: 0;
  color: var(--muted);
  font-size: 13px;
}

.reason {
  margin: 10px 0 14px;
  color: #334155;
}
</style>
