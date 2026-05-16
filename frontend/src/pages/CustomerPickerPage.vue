<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'

import AppHeader from '@/components/AppHeader.vue'
import CustomerCard from '@/components/CustomerCard.vue'
import { useAppStore } from '@/stores/appStore'

const router = useRouter()
const store = useAppStore()
const keyword = ref('')

const filtered = computed(() =>
  store.customers.filter((item) => item.name.includes(keyword.value) || item.contact.includes(keyword.value)),
)

const select = (id: string) => {
  store.setCustomer(id)
  router.back()
}
</script>

<template>
  <main class="app-shell">
    <AppHeader title="选择客户" />
    <section class="page">
      <div class="form-field">
        <label>搜索客户</label>
        <input v-model="keyword" placeholder="输入客户名称或联系人" />
      </div>
      <section class="list">
        <CustomerCard
          v-for="customer in filtered"
          :key="customer.id"
          :customer="customer"
          action-text="选定客户"
          @select="select(customer.id)"
        />
      </section>
    </section>
  </main>
</template>
