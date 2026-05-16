import type { DeliveryPrediction, Quote } from '@/types/business'

function daysBetween(from: Date, to: Date) {
  const ms = to.getTime() - from.getTime()
  return Math.floor(ms / 86400000)
}

/**
 * Mock：结构化结论模拟 APS/库存引擎；话术模板模拟大模型归纳（上线分别对接引擎 API + DeepSeek）。
 */
export async function mockDeliveryPrediction(
  expectedDateStr: string,
  quote: Quote,
): Promise<DeliveryPrediction> {
  await new Promise((r) => setTimeout(r, 650))

  const expected = new Date(expectedDateStr + 'T12:00:00')
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const leadDays = daysBetween(today, expected)
  const heavyCustom = quote.proposalId === 's-001' && quote.totalAmount >= 2000

  let onTime = true
  let kitComplete = true
  let bottleneck = ''

  if (leadDays < 12) {
    onTime = false
    bottleneck = '产能排程紧张：当前车间满载，期望交期低于常规滚动排产窗口约 5～8 个工作日。'
  }
  if (heavyCustom && leadDays < 25) {
    kitComplete = false
    if (!bottleneck) bottleneck = '定制支架图纸冻结较晚，板材采购与外协喷涂节拍尚有一对一缺口。'
    else bottleneck += ' 齐套侧：定制件 BOM 尚有「图纸确认→钢板下料」未闭环。'
  }

  const pass = onTime && kitComplete

  const narrative = pass
    ? `综合当前所选报价「${quote.quoteNo}」与客户期望交付日 ${expectedDateStr}：系统测算生产节拍与物料可用窗口对齐，预计在承诺日前具备出库条件；齐套检查未发现阻断项，可按正常工单下发执行。请以计划员最终排程确认为准。`
    : `针对报价「${quote.quoteNo}」与期望交期 ${expectedDateStr}：${onTime ? '' : '交付日上存在前置工序积压风险；'}${kitComplete ? '' : '物料齐套上仍有缺口需补齐；'}${bottleneck || '建议与销售、计划联席复核后再对客户承诺。'}以上为系统自动归纳要点，不作为单独放行依据。`

  return {
    onTime,
    kitComplete,
    bottleneck: bottleneck || (pass ? '未识别显著卡点。' : '存在交付或齐套风险，详见说明。'),
    narrative,
    pass,
  }
}
