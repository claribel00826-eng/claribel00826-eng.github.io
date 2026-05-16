<script setup lang="ts">
import { useRouter } from 'vue-router'

import AppHeader from '@/components/AppHeader.vue'
import CustomerBar from '@/components/CustomerBar.vue'

const router = useRouter()
</script>

<template>
  <main class="app-shell">
    <AppHeader title="调整方案" />
    <section class="page">
      <CustomerBar />
      <section class="card adjust-card">
        <h2>调整方案</h2>
      </section>
      <div class="actions actions--3">
        <button class="ghost-btn" type="button" @click="router.push('/proposal-history')">历史方案</button>
        <button class="ghost-btn" type="button" @click="router.push('/quick-scheme?step=recommend')">重新选品</button>
        <button class="primary-btn full-span" type="button" @click="router.push('/quick-scheme?step=proposal')">
          调整当前购物车并保存
        </button>
      </div>
    </section>
  </main>
</template>

<style scoped>
.adjust-card {
  padding: 18px;
}

h2 {
  margin: 0;
}

.actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-top: 14px;
}

.actions--3 .full-span {
  grid-column: 1 / -1;
}
</style>
