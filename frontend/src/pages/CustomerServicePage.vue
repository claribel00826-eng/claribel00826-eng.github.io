<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import AppHeader from '@/components/AppHeader.vue'
import CustomerBar from '@/components/CustomerBar.vue'
import { useAppStore } from '@/stores/appStore'

const route = useRoute()
const store = useAppStore()
const question = ref('客户反馈收货数量与订单明细不一致，请协助核对。')
const analyzed = ref(false)
const ticketCreated = ref(false)

watch(
  () => store.voiceFillTick,
  () => {
    if (store.voiceFillTargetRoute !== 'service' || route.name !== 'service') return
    const t = store.voiceFillText.trim()
    if (!t) return
    question.value = question.value ? `${question.value}\n${t}` : t
  },
)
</script>

<template>
  <main class="app-shell">
    <AppHeader title="客户服务" />
    <section class="page">
      <CustomerBar />
      <div class="form-field">
        <label>客户问题</label>
        <textarea v-model="question" placeholder="描述客户问题" />
      </div>
      <button class="primary-btn full-btn" type="button" @click="analyzed = true">识别并生成摘要</button>
      <section v-if="analyzed" class="service-card card">
        <span class="pill">{{ store.serviceResult.intent }}</span>
        <h2>问题摘要</h2>
        <p>{{ store.serviceResult.summary }}</p>
        <h2>处理建议</h2>
        <p>{{ store.serviceResult.solution }}</p>
        <button class="primary-btn full-btn" type="button" @click="ticketCreated = true">发起服务工单</button>
      </section>
      <section v-if="ticketCreated" class="ticket card">
        <strong>服务工单已创建</strong>
      </section>
    </section>
  </main>
</template>

<style scoped>
.service-card,
.ticket {
  padding: 16px;
  margin-top: 14px;
}

h2 {
  margin: 14px 0 8px;
  font-size: 17px;
}

p {
  color: var(--muted);
  line-height: 1.7;
}
</style>
