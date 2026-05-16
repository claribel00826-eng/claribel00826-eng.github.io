/** 全局语音/文字输入经意图识别后的结构化结果（对接后端前为 Mock） */
export type IntentKind = 'navigate' | 'inquiry' | 'service' | 'follow' | 'unknown'

/** 输入中是否同时出现「客户指称」与「业务能力」 */
export type IntentSlotMode = 'both' | 'customer_only' | 'function_only' | 'neither'

export interface IntentSlots {
  mode: IntentSlotMode
  hasCustomer: boolean
  hasFunction: boolean
  /** 从语句中匹配到的客户（Mock：主数据名称/简称） */
  customerId?: string
  customerName?: string
  /** 功能侧短标题（用于弹层展示） */
  functionLabel?: string
  /** 建议跳转路径（有则出现「前往」类按钮） */
  functionPath?: string
}

export interface IntentRecognitionResult {
  kind: IntentKind
  intentId: string
  intentLabel: string
  summary: string
  confidence: number
  /** 可选：建议跳转路径 */
  suggestedPath?: string
  /** 客户/功能槽位，用于区分弹层提示与按钮组合 */
  slots: IntentSlots
}
