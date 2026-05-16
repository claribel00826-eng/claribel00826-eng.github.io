/** 首页「最近客户」恢复进度：localStorage Mock，上线后对齐全局状态/服务端 */
const STORAGE_KEY = 'h5_customer_checkpoints'

export type StoredCheckpoint = { fullPath: string; at: number }

function parseStore(): Record<string, StoredCheckpoint> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const data = JSON.parse(raw) as Record<string, StoredCheckpoint>
    return data && typeof data === 'object' ? data : {}
  } catch {
    return {}
  }
}

export function saveCustomerCheckpoint(customerId: string, fullPath: string): void {
  if (!customerId || !fullPath) return
  const data = parseStore()
  data[customerId] = { fullPath, at: Date.now() }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    /* quota / privacy mode */
  }
}

export function getCustomerCheckpoint(customerId: string): string | null {
  const data = parseStore()
  return data[customerId]?.fullPath ?? null
}

/** 有打点记录的客户 id，按最近活动时间倒序 */
export function getCheckpointOrderedCustomerIds(validIds: readonly string[]): string[] {
  const set = new Set(validIds)
  const data = parseStore()
  return Object.entries(data)
    .filter(([id]) => set.has(id))
    .sort((a, b) => b[1].at - a[1].at)
    .map(([id]) => id)
}

/** 卡片副文案：根据 fullPath 生成简短说明 */
export function checkpointSubtitle(fullPath: string): string {
  if (!fullPath) return ''
  try {
    const u = new URL(fullPath, 'http://checkpoint.local')
    const path = u.pathname
    const step = u.searchParams.get('step')

    if (path.includes('/quick-scheme')) {
      if (step === 'cart') return '上次离开：购物车'
      if (step === 'proposal') return '上次离开：方案保存'
      return '上次离开：选品'
    }
    if (path.includes('/proposal-pdf')) return '上次离开：方案预览'
    if (path.includes('/quote-pdf')) return '上次离开：报价预览'
    if (path.includes('/proposal-history')) return '上次离开：方案历史'
    if (path.includes('/follow-write')) return '上次离开：写跟进'
    if (path.includes('/follow-customer')) return '上次离开：客户详情'
    if (path.includes('/development')) return '上次离开：客户开拓'
    if (path.includes('/follow-ups')) return '上次离开：待跟进列表'
    if (path.includes('/quote')) return '上次离开：产品报价'
    if (path.includes('/delivery')) return '上次离开：交期评审'
    if (path.includes('/order-create')) return '上次离开：生成订单'
    if (path.includes('/adjust')) return '上次离开：调整方案'
    if (path.includes('/rush-order')) return '上次离开：插单申请'
    if (path.includes('/copy-order')) return '上次离开：订单复制'
    if (path.includes('/order-change')) return '上次离开：订单变更'
    if (path.includes('/service')) return '上次离开：客户服务'
    if (/^\/orders\/.+/.test(path)) return '上次离开：订单详情'
    if (path === '/orders' || path.endsWith('/orders')) return '上次离开：订单进度'
    return '上次离开的页面'
  } catch {
    return '点此继续跟进'
  }
}

/** 首页「最近客户」副文案：展示最近访问业务页，不用于新老客户等分类 */
export function formatRecentVisitLabel(fullPath: string | null | undefined): string {
  if (!fullPath) return '最近访问：方案速配（选品）'
  const raw = checkpointSubtitle(fullPath)
  if (!raw) return '最近访问：方案速配（选品）'
  return raw.replace(/^上次离开：/, '最近访问：')
}
