<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import AppHeader from '@/components/AppHeader.vue'
import CustomerBar from '@/components/CustomerBar.vue'
import { useAppStore } from '@/stores/appStore'

const router = useRouter()
const route = useRoute()
const store = useAppStore()
const reason = ref('客户项目节点提前，需要申请优先评审。')
const submitted = ref(false)

watch(
  () => store.voiceFillTick,
  () => {
    if (store.voiceFillTargetRoute !== 'rush-order' || route.name !== 'rush-order') return
    const t = store.voiceFillText.trim()
    if (!t) return
    reason.value = reason.value ? `${reason.value}\n${t}` : t
  },
)
</script>

<template>
  <main class="app-shell">
    <AppHeader title="插单申请" />
    <section class="page">
      <CustomerBar />
      <div class="form-field">
        <label>插单理由</label>
        <textarea v-model="reason" placeholder="填写插单理由" />
      </div>
      <button class="primary-btn full-btn" type="button" :disabled="submitted" @click="submitted = true">
        提交插单申请
      </button>
      <section v-if="submitted" class="card result-card">
        <strong>插单申请已提交</strong>
        <p>后续审批状态由原系统返回。</p>
        <button class="primary-btn full-btn" type="button" @click="router.push('/delivery')">前往交期评审</button>
      </section>
    </section>
  </main>
</template>

<style scoped>
.result-card {
  padding: 16px;
}

.result-card p {
  color: var(--muted);
}
</style>
