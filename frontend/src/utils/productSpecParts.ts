import type { Product, ProductSpecField } from '@/types/business'

export function defaultSpecParts(fields: ProductSpecField[] | undefined): Record<string, string> {
  const out: Record<string, string> = {}
  if (!fields?.length) return out
  for (const f of fields) out[f.key] = f.defaultValue ?? ''
  return out
}

/** 从购物车/推荐里一行规格摘要拆分回表单（按「标签：值 · …」） */
export function parsePartsFromSummary(spec: string, fields: ProductSpecField[]): Record<string, string> {
  if (!fields?.length) return { summary: spec.trim() }
  const parts = defaultSpecParts(fields)
  const t = spec.trim()
  if (!t) return parts
  const chunks = t.split(/\s*·\s*/)
  for (const ch of chunks) {
    const m = ch.match(/^(.+?)[:：]\s*(.+)$/)
    if (!m) continue
    const label = m[1].trim()
    const val = m[2].trim()
    const field = fields.find((x) => x.label === label)
    if (field) parts[field.key] = val
  }
  return parts
}

export function composeSpecSummary(product: Product, parts: Record<string, string>): string {
  const fields = product.specFields
  if (!fields?.length) return (parts.summary ?? product.spec ?? '').trim()
  return fields
    .map((f) => {
      const v = (parts[f.key] ?? '').trim()
      return v ? `${f.label}：${v}` : ''
    })
    .filter(Boolean)
    .join(' · ')
}
