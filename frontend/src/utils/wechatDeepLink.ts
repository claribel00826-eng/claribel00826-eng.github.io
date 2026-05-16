import type { LocationQuery } from 'vue-router'

/** 解析服务号模板深链中的客户 ID（query: customer_id） */
export function pickCustomerIdFromQuery(query: LocationQuery): string | null {
  const raw = query.customer_id
  if (typeof raw === 'string' && raw.trim()) return raw.trim()
  if (Array.isArray(raw) && typeof raw[0] === 'string' && raw[0].trim()) return raw[0].trim()
  return null
}
