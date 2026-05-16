<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import AppHeader from '@/components/AppHeader.vue'
import CustomerBar from '@/components/CustomerBar.vue'
import { useAppStore } from '@/stores/appStore'

const router = useRouter()
const route = useRoute()
const store = useAppStore()

const FOLLOW_STATUSES = ['跟进中', '跟进结束'] as const

const contactPerson = ref('')
const contactMethod = ref('')
const shipAddress = ref('')
const followBody = ref('')
const reminderDate = ref('')
const followStatus = ref<string>('跟进中')
const tip = ref('')

const returnListPath = computed(() => {
  const r = route.query.returnTo
  if (typeof r === 'string') {
    try {
      const decoded = decodeURIComponent(r)
      if (decoded.startsWith('/')) return decoded
    } catch {
      /* ignore */
    }
  }
  return '/development'
})

function syncDefaultsFromCustomer() {
  const c = store.currentCustomer
  contactPerson.value = c.contact || ''
  contactMethod.value = c.phone || ''
}

/** 从 returnTo 解析列表来源，供客户详情「返回列表」使用 */
function detailListQuery(): Record<string, string> {
  const r = route.query.returnTo
  if (typeof r !== 'string') return { from: 'development' }
  try {
    const decoded = decodeURIComponent(r)
    const q = decoded.includes('?') ? decoded.slice(decoded.indexOf('?')) : ''
    const from = new URLSearchParams(q).get('from')
    if (from === 'follow-ups' || from === 'development') return { from }
  } catch {
    /* ignore */
  }
  return { from: 'development' }
}

function saveEntry() {
  if (!followBody.value.trim()) {
    tip.value = '请填写跟进信息'
    return
  }
  store.addFollowUp({
    contactPerson: contactPerson.value,
    contactMethod: contactMethod.value,
    shipAddress: shipAddress.value,
    content: followBody.value,
    reminderDate: reminderDate.value,
    followStatus: followStatus.value,
  })
  followBody.value = ''
  shipAddress.value = ''
  reminderDate.value = ''
  followStatus.value = '跟进中'
  syncDefaultsFromCustomer()
  tip.value = ''
  router.push({
    path: `/follow-customer/${store.currentCustomer.id}`,
    query: detailListQuery(),
  })
}

watch(
  () => store.currentCustomerId,
  () => {
    syncDefaultsFromCustomer()
    tip.value = ''
  },
  { immediate: true },
)
</script>

<template>
  <main class="app-shell app-shell--fit follow-write-shell">
    <AppHeader title="写跟进" />
    <section class="page">
      <CustomerBar />

      <div class="form-shell card">
        <h2 class="form-title">新增跟进</h2>
        <div class="form-grid">
          <div class="form-field">
            <label for="contactPerson">联系人</label>
            <input id="contactPerson" v-model="contactPerson" type="text" placeholder="对接人" />
          </div>
          <div class="form-field">
            <label for="contactMethod">联系方式</label>
            <input id="contactMethod" v-model="contactMethod" type="text" placeholder="电话/微信" />
          </div>
          <div class="form-field full">
            <label for="shipAddress">发货地址</label>
            <input id="shipAddress" v-model="shipAddress" type="text" placeholder="选填" />
          </div>
          <div class="form-field full">
            <label for="followBody">跟进信息</label>
            <textarea id="followBody" v-model="followBody" placeholder="沟通要点（必填）" rows="3" />
          </div>
          <div class="form-field">
            <label for="reminderDate">提醒日期</label>
            <input id="reminderDate" v-model="reminderDate" type="date" />
          </div>
          <div class="form-field">
            <label for="followStatus">跟进状态</label>
            <select id="followStatus" v-model="followStatus">
              <option v-for="s in FOLLOW_STATUSES" :key="s" :value="s">{{ s }}</option>
            </select>
          </div>
        </div>
        <button class="primary-btn full-btn" type="button" @click="saveEntry">保存</button>
        <p v-if="tip" class="tip">{{ tip }}</p>
      </div>

      <div class="foot-actions">
        <button class="ghost-btn" type="button" @click="router.push(returnListPath)">返回</button>
        <button class="primary-btn" type="button" @click="router.push('/quick-scheme?step=recommend')">
          方案速配
        </button>
      </div>
    </section>
  </main>
</template>

<style scoped>
.follow-write-shell {
  padding-bottom: calc(12px + env(safe-area-inset-bottom, 0px));
}

.page {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px 12px 0;
}

.form-shell {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 10px 12px;
  overflow: hidden;
}

.form-title {
  margin: 0 0 8px;
  font-size: 15px;
  font-weight: 900;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px 10px;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  align-content: start;
}

.form-grid .full {
  grid-column: 1 / -1;
}

.form-field {
  margin: 0;
  display: grid;
  gap: 2px;
}

.form-field label {
  font-size: 11px;
  font-weight: 800;
  color: var(--muted);
}

.form-field input,
.form-field textarea,
.form-field select {
  width: 100%;
  box-sizing: border-box;
  padding: 8px 10px;
  border-radius: 10px;
  border: 1px solid var(--line, #dce5f0);
  font-size: 13px;
  min-height: 40px;
}

.form-field textarea {
  min-height: 0;
  resize: none;
}

.form-field select {
  background: #fff;
}

.full-btn {
  margin-top: 10px;
  width: 100%;
}

.tip {
  margin: 6px 0 0;
  font-size: 12px;
  color: var(--primary);
}

.foot-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  flex-shrink: 0;
  padding-bottom: 4px;
}
</style>
