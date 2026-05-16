<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import AppHeader from '@/components/AppHeader.vue'
import CustomerBar from '@/components/CustomerBar.vue'
import { useAppStore } from '@/stores/appStore'

const router = useRouter()
const store = useAppStore()
const done = ref(false)

/** 未做交期且未在报价环节点过「跳过」时，须先确认风险 */
const riskModalOpen = ref(false)
const riskAcknowledged = ref(false)

watch(
  () => store.deliveryReviewStatus,
  (s) => {
    if (s === 'none' && !riskAcknowledged.value) {
      riskModalOpen.value = true
    }
  },
  { immediate: true },
)

const acknowledgeRisk = () => {
  riskAcknowledged.value = true
  riskModalOpen.value = false
}

const cancelRisk = () => {
  riskModalOpen.value = false
}

const submitOrder = () => {
  if (store.deliveryReviewStatus === 'none' && !riskAcknowledged.value) {
    riskModalOpen.value = true
    return
  }
  done.value = true
}
</script>

<template>
  <main class="app-shell">
    <AppHeader title="生成订单" />
    <section class="page">
      <CustomerBar />
      <p v-if="store.deliveryReviewStatus === 'skipped_confirmed'" class="banner">
        您已在报价环节确认<strong>跳过交期评审</strong>；提交订单前请再次核对行项目与金额。
      </p>
      <section class="order-card card">
        <span class="pill">{{ store.quote.quoteNo }}</span>
        <h2>{{ done ? '订单已生成' : '确认生成订单' }}</h2>
        <strong>报价金额：¥{{ store.quote.totalAmount }}</strong>
      </section>
      <section class="list">
        <article v-for="item in store.cart" :key="item.id" class="line-card card">
          <span>{{ item.name }}</span>
          <strong>{{ item.quantity }}{{ item.unit }}</strong>
        </article>
      </section>
      <button v-if="!done" class="primary-btn full-btn action" type="button" @click="submitOrder">
        确认下单
      </button>
      <button v-else class="primary-btn full-btn action" type="button" @click="router.push('/orders')">
        查看订单进度
      </button>
    </section>

    <Teleport to="body">
      <div v-if="riskModalOpen" class="h5-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="risk-modal-title">
        <div class="h5-modal-backdrop" tabindex="-1" @click="cancelRisk" />
        <div class="h5-modal-panel card" role="document" @click.stop>
          <h3 id="risk-modal-title">未完成交期评审</h3>
          <p>
            当前报价尚未经过交期评审。直接下单可能存在交付与齐套风险，请确认已与客户及内部对齐后再继续。
          </p>
          <div class="h5-modal-actions">
            <button class="ghost-btn" type="button" @click="cancelRisk">取消</button>
            <button class="primary-btn" type="button" @click="acknowledgeRisk">已知悉风险，继续</button>
          </div>
        </div>
      </div>
    </Teleport>
  </main>
</template>

<style scoped>
.banner {
  margin: 0 0 12px;
  padding: 10px 12px;
  font-size: 13px;
  line-height: 1.5;
  color: #92400e;
  background: #fffbeb;
  border: 1px solid #fcd34d;
  border-radius: 8px;
}

.order-card,
.line-card {
  padding: 14px;
}

h2 {
  margin: 12px 0 8px;
}

.line-card {
  display: flex;
  justify-content: space-between;
}

.action {
  margin-top: 14px;
}

</style>
