import type { IntentRecognitionResult, IntentSlots } from '@/types/intent'

type NavRule = {
  pattern: RegExp
  intentId: string
  intentLabel: string
  path: string
}

const NAV_RULES: NavRule[] = [
  { pattern: /首页|回到首页|主\s*页/, intentId: 'nav.home', intentLabel: '导航：首页', path: '/home' },
  { pattern: /待跟进|跟进列表|跟\s*进/, intentId: 'nav.followups', intentLabel: '导航：待跟进客户', path: '/follow-ups' },
  { pattern: /客户开拓|公海|老客户/, intentId: 'nav.dev', intentLabel: '导航：客户开拓', path: '/development' },
  {
    pattern: /方案历史|历史方案|以前的方案|方案\s*PDF/,
    intentId: 'nav.proposal-history',
    intentLabel: '导航：方案历史',
    path: '/proposal-history',
  },
  {
    pattern: /方案速配/,
    intentId: 'nav.quick-scheme',
    intentLabel: '导航：方案速配',
    path: '/quick-scheme',
  },
  {
    pattern: /购物车|加购/,
    intentId: 'nav.quick-scheme-cart',
    intentLabel: '导航：方案速配（购物车）',
    path: '/quick-scheme?step=cart',
  },
  {
    pattern: /生成方案|做方案|保存方案/,
    intentId: 'nav.quick-scheme-proposal',
    intentLabel: '导航：方案速配（保存方案）',
    path: '/quick-scheme?step=proposal',
  },
  {
    pattern: /产品推荐|推荐产品|选\s*品/,
    intentId: 'nav.quick-scheme-reco',
    intentLabel: '导航：方案速配（选品）',
    path: '/quick-scheme?step=recommend',
  },
  { pattern: /报价|出\s*价/, intentId: 'nav.quote', intentLabel: '导航：产品报价', path: '/quote' },
  { pattern: /交期|评审/, intentId: 'nav.delivery', intentLabel: '导航：交期评审', path: '/delivery' },
  { pattern: /下单|生成订单|创\s*建\s*订\s*单/, intentId: 'nav.order', intentLabel: '导航：生成订单', path: '/order-create' },
  { pattern: /订单进度|查订单|订单列表/, intentId: 'nav.orders', intentLabel: '导航：订单进度', path: '/orders' },
  { pattern: /复制订单|再来一单/, intentId: 'nav.copy', intentLabel: '导航：订单复制', path: '/copy-order' },
  { pattern: /订单变更|改订单|异常订单/, intentId: 'nav.change', intentLabel: '导航：订单变更', path: '/order-change' },
  { pattern: /插单|加急/, intentId: 'nav.rush', intentLabel: '导航：插单申请', path: '/rush-order' },
  { pattern: /客服|工单|投诉|售后/, intentId: 'nav.service', intentLabel: '导航：客户服务', path: '/service' },
  { pattern: /换客户|选客户|客户选择/, intentId: 'nav.customers', intentLabel: '导航：选择客户', path: '/customers' },
  { pattern: /登录|授\s*权/, intentId: 'nav.login', intentLabel: '导航：登录', path: '/login' },
]

export type IntentCustomerRef = { id: string; name: string }

function clip(text: string, max = 72): string {
  const t = text.replace(/\s+/g, ' ').trim()
  return t.length <= max ? t : `${t.slice(0, max)}…`
}

function stripCompanySuffix(name: string): string {
  return name.replace(/有限公司|股份有限公司|股份$/g, '').trim()
}

/** 从语句中匹配当前可见客户（长名称优先，其次去后缀简称） */
function extractCustomerFromText(
  text: string,
  customers: readonly IntentCustomerRef[],
): IntentCustomerRef | null {
  if (!text.trim() || !customers.length) return null
  const sorted = [...customers].sort((a, b) => b.name.length - a.name.length)
  for (const c of sorted) {
    if (text.includes(c.name)) return c
  }
  const sortedShort = [...customers].sort(
    (a, b) => stripCompanySuffix(b.name).length - stripCompanySuffix(a.name).length,
  )
  for (const c of sortedShort) {
    const s = stripCompanySuffix(c.name)
    if (s.length >= 2 && text.includes(s)) return c
  }
  return null
}

function matchNav(text: string): NavRule | null {
  for (const rule of NAV_RULES) {
    if (rule.pattern.test(text)) return rule
  }
  return null
}

function navFunctionLabel(rule: NavRule): string {
  return rule.intentLabel.replace(/^导航：/, '').trim() || rule.intentLabel
}

function buildSlots(
  cust: IntentCustomerRef | null,
  hasFunction: boolean,
  functionPath: string | undefined,
  functionLabel: string | undefined,
): IntentSlots {
  const hasCustomer = Boolean(cust)
  let mode: IntentSlots['mode']
  if (hasCustomer && hasFunction) mode = 'both'
  else if (hasCustomer && !hasFunction) mode = 'customer_only'
  else if (!hasCustomer && hasFunction) mode = 'function_only'
  else mode = 'neither'
  return {
    mode,
    hasCustomer,
    hasFunction,
    customerId: cust?.id,
    customerName: cust?.name,
    functionPath: functionPath || undefined,
    functionLabel: functionLabel || undefined,
  }
}

/**
 * 意图识别（Mock）：规则 + 客户名匹配，模拟服务端「槽位：客户 + 功能」结构。
 * 上线后替换为调用后端接口，保持返回字段（尤其 `slots`）一致。
 */
export async function recognizeIntent(
  rawText: string,
  routeName: string | symbol | null | undefined,
  customers: readonly IntentCustomerRef[],
): Promise<IntentRecognitionResult> {
  await new Promise((r) => setTimeout(r, 280))
  const text = rawText.trim()
  const route = routeName == null ? '' : String(routeName)
  const cust = extractCustomerFromText(text, customers)

  const nav = matchNav(text)
  if (nav) {
    const fnLabel = navFunctionLabel(nav)
    return {
      kind: 'navigate',
      intentId: nav.intentId,
      intentLabel: nav.intentLabel,
      summary: clip(text),
      confidence: cust ? 0.9 : 0.86,
      suggestedPath: nav.path,
      slots: buildSlots(cust, true, nav.path, fnLabel),
    }
  }

  if (/跟进|电话|拜访|沟通/.test(text)) {
    const path = route === 'follow-write' ? undefined : '/follow-write'
    return {
      kind: 'follow',
      intentId: 'follow.note',
      intentLabel: '跟进：记录沟通要点',
      summary: clip(text),
      confidence: 0.78,
      suggestedPath: path,
      slots: buildSlots(cust, true, path, '写跟进'),
    }
  }

  if (/少发|多发|错发|破损|质量|不一致|对不上/.test(text)) {
    const path = route === 'service' ? undefined : '/service'
    return {
      kind: 'service',
      intentId: 'service.after_sales',
      intentLabel: '服务：售后/履约问题',
      summary: clip(text),
      confidence: 0.81,
      suggestedPath: path,
      slots: buildSlots(cust, true, path, '客户服务 / 售后'),
    }
  }

  if (/多少钱|价格|交期|库存|能\s*不\s*能\s*做/.test(text)) {
    return {
      kind: 'inquiry',
      intentId: 'inquiry.biz_fact',
      intentLabel: '问询：价格/交期/库存（需走既有引擎）',
      summary: clip(text),
      confidence: 0.62,
      slots: buildSlots(cust, true, undefined, '价格 / 交期 / 库存问询'),
    }
  }

  if (cust) {
    return {
      kind: 'unknown',
      intentId: 'unknown.need_function',
      intentLabel: '已识别客户，请补充业务说法（如：报价、选品、交期）',
      summary: clip(text),
      confidence: 0.52,
      slots: buildSlots(cust, false, undefined, undefined),
    }
  }

  return {
    kind: 'unknown',
    intentId: 'unknown.general',
    intentLabel: '未在输入中识别到客户与具体功能',
    summary: clip(text || '[空输入]'),
    confidence: 0.42,
    slots: buildSlots(null, false, undefined, undefined),
  }
}
