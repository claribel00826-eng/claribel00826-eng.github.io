import { createRouter, createWebHistory } from 'vue-router'

import { useAppStore } from '@/stores/appStore'
import { pickCustomerIdFromQuery } from '@/utils/wechatDeepLink'
import { saveCustomerCheckpoint } from '@/utils/customerCheckpoint'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/home' },
    {
      path: '/login',
      name: 'login',
      component: () => import('@/pages/LoginPage.vue'),
    },
    {
      path: '/home',
      name: 'home',
      component: () => import('@/pages/HomePage.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/follow-ups',
      name: 'follow-ups',
      component: () => import('@/pages/FollowUpListPage.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/customers',
      name: 'customers',
      component: () => import('@/pages/CustomerPickerPage.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/development',
      name: 'development',
      component: () => import('@/pages/CustomerDevelopmentPage.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/follow-write',
      name: 'follow-write',
      component: () => import('@/pages/FollowWritePage.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/follow-customer/:id',
      name: 'follow-customer-detail',
      component: () => import('@/pages/CustomerFollowDetailPage.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/quick-scheme',
      name: 'quick-scheme',
      component: () => import('@/pages/QuickSchemePage.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/proposal-history',
      name: 'proposal-history',
      component: () => import('@/pages/ProposalHistoryPage.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/proposal-pdf/:id',
      name: 'proposal-pdf',
      component: () => import('@/pages/ProposalPdfPage.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/recommend',
      name: 'recommend',
      redirect: () => ({ path: '/quick-scheme', query: { step: 'recommend' } }),
    },
    {
      path: '/cart',
      name: 'cart',
      redirect: () => ({ path: '/quick-scheme', query: { step: 'cart' } }),
    },
    {
      path: '/proposal',
      name: 'proposal',
      redirect: () => ({ path: '/quick-scheme', query: { step: 'proposal' } }),
    },
    {
      path: '/proposal-entry',
      name: 'proposal-entry',
      redirect: () => ({ path: '/quick-scheme', query: { step: 'proposal' } }),
    },
    {
      path: '/quote-history',
      name: 'quote-history',
      component: () => import('@/pages/QuoteHistoryPage.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/quote-pdf/:id',
      name: 'quote-pdf',
      component: () => import('@/pages/QuotePdfPage.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/quote',
      name: 'quote',
      component: () => import('@/pages/QuotePage.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/delivery',
      name: 'delivery',
      component: () => import('@/pages/DeliveryReviewPage.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/order-create',
      name: 'order-create',
      component: () => import('@/pages/OrderCreatePage.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/adjust',
      name: 'adjust',
      component: () => import('@/pages/AdjustProposalPage.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/rush-order',
      name: 'rush-order',
      component: () => import('@/pages/RushOrderPage.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/copy-order',
      name: 'copy-order',
      component: () => import('@/pages/CopyOrderPage.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/order-change',
      name: 'order-change',
      component: () => import('@/pages/OrderChangePage.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/orders',
      name: 'orders',
      component: () => import('@/pages/OrderProgressListPage.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/orders/:id',
      name: 'order-detail',
      component: () => import('@/pages/OrderProgressDetailPage.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/service',
      name: 'service',
      component: () => import('@/pages/CustomerServicePage.vue'),
      meta: { requiresAuth: true },
    },
  ],
})

router.beforeEach((to) => {
  const store = useAppStore()

  if (to.meta.requiresAuth && !store.isLoggedIn) {
    return { path: '/login', query: { ...to.query } }
  }

  /** 服务号模板消息深链：带 customer_id 时选中客户并进入客户开拓（P05） */
  const customerId = pickCustomerIdFromQuery(to.query)
  if (customerId && store.isLoggedIn && to.name !== 'login') {
    const hit = store.customers.some((c) => c.id === customerId)
    if (hit) {
      store.setCustomer(customerId)
      if (to.name !== 'development') {
        return { name: 'development', replace: true, query: {} }
      }
      if (Object.keys(to.query).length > 0) {
        return { name: 'development', replace: true, query: {} }
      }
    }
  }

  return true
})

const CHECKPOINT_ROUTE_SKIP = new Set([
  'home',
  'login',
  'follow-ups',
  'customers',
  'development',
])

router.afterEach((to) => {
  if (!to.meta.requiresAuth) return
  const name = to.name != null ? String(to.name) : ''
  if (CHECKPOINT_ROUTE_SKIP.has(name)) return
  const store = useAppStore()
  const cid = store.currentCustomerId
  if (!cid) return
  saveCustomerCheckpoint(cid, to.fullPath)
})

export default router
