export type CustomerType = 'old-timeout' | 'public-new' | 'mine'

export type OrderStatus = '待确认' | '生产中' | '已发货' | '异常'

/** 与当前报价关联的交期评审进度（Mock 状态机，对齐 PRD：报价必经，交期可选） */
export type DeliveryReviewFlowStatus = 'none' | 'skipped_confirmed' | 'completed'

export interface UserProfile {
  id: string
  name: string
  roleName: string
}

export interface Customer {
  id: string
  /** 客户编码（主数据） */
  code: string
  name: string
  /** 性质：如企业类型、直销/渠道等，与 SaaS 主数据对齐 */
  nature: string
  /** 所属类别 */
  category: string
  /** 结算客户（往来结算主体名称） */
  settlementCustomer: string
  /** 客户等级 */
  level: string
  contact: string
  phone: string
  type: CustomerType
  tag: string
  lastOrderText: string
  needSummary: string
}

/** 客户跟进记录（多版本留痕）；上线对齐后端分页 */
export interface FollowUpRecord {
  id: string
  customerId: string
  /** 联系人 */
  contactPerson: string
  /** 联系方式（电话/微信等） */
  contactMethod: string
  /** 发货地址 */
  shipAddress: string
  /** 跟进信息（沟通纪要正文） */
  content: string
  /** 提醒日期 yyyy-MM-dd；未填可为空串 */
  reminderDate: string
  /** 跟进状态：写跟进页仅「跟进中」「跟进结束」；列表/详情展示与主数据字典对齐 */
  followStatus: string
  createdAt: string
  operatorName: string
}

/** 写跟进保存入参（由 store 补全 id / customerId / createdAt / operatorName） */
export interface FollowUpEntry {
  contactPerson: string
  contactMethod: string
  shipAddress: string
  content: string
  reminderDate: string
  /** 跟进状态：仅「跟进中」「跟进结束」 */
  followStatus: string
}

/** 选品改配弹窗用：分字段维护规格（保存时拼成一行 spec） */
export interface ProductSpecField {
  key: string
  label: string
  placeholder?: string
  /** Mock 默认；上线可由主数据模板下发 */
  defaultValue?: string
}

export interface Product {
  id: string
  name: string
  spec: string
  unit: string
  price: number
  stockText: string
  reason: string
  /** 有定义时在弹窗中分栏编辑；无则仅单行摘要 */
  specFields?: ProductSpecField[]
}

export interface CartItem {
  id: string
  productId: string
  name: string
  spec: string
  quantity: number
  unit: string
  price: number
}

/** 方案行快照：用于生成 PDF、历史展示与「变更」时回填购物车 */
export interface ProposalLine {
  productId: string
  name: string
  spec: string
  quantity: number
  unit: string
  price: number
}

export interface Proposal {
  id: string
  customerId: string
  name: string
  remark: string
  itemCount: number
  totalAmount: number
  /** ISO 时间，保存时写入 */
  createdAt: string
  /** 行项目快照 */
  lines: ProposalLine[]
  /** 若由历史方案「变更」生成，记录原方案 id */
  revisedFrom?: string
}

/** 报价单行快照：写入报价单并用于 PDF / 交期上下文 */
export interface QuoteLineSnapshot {
  productId: string
  name: string
  spec: string
  quantity: number
  unit: string
  /** 本次对客户报价单价 */
  quotedUnitPrice: number
  /** 询价参照（可选，PDF 展示） */
  minPrice?: number
  latestPrice?: number
}

export interface Quote {
  id: string
  proposalId: string
  quoteNo: string
  totalAmount: number
  validUntil: string
  /** 保存时间（Mock / 上线对齐后端） */
  createdAt?: string
  /** 询价行合计（与 totalAmount 一致；H5 不提供折扣/附加费） */
  inquirySubtotal?: number
  /** 报价明细；旧数据可无，PDF 回落方案行 */
  lines?: QuoteLineSnapshot[]
}

/** saveQuote 入参（不含系统自动生成的 id/quoteNo/validUntil） */
export interface SaveQuotePayload {
  totalAmount: number
  inquirySubtotal: number
  lines: QuoteLineSnapshot[]
}

/** 交期预测结果：结构化字段由引擎计算，话术层可接入大模型归纳（Mock 为静态模板） */
export interface DeliveryPrediction {
  /** 是否预计可按期交付（引擎） */
  onTime: boolean
  /** 是否齐套（引擎） */
  kitComplete: boolean
  /** 延期/风险卡点摘要（可与 narrative 同源，供列表展示） */
  bottleneck: string
  /** 面向销售宣读的大模型归纳话术（不得单独作为审批唯一依据） */
  narrative: string
  /** 是否允许进入「生成订单」（业务规则：一般要求 onTime ∧ kitComplete） */
  pass: boolean
}

export interface DeliveryIssue {
  id: string
  title: string
  detail: string
  level: '提示' | '需处理'
}

export interface Order {
  id: string
  orderNo: string
  /** 对齐主数据 customer id，供「按历史订单推荐」使用 */
  customerId: string
  customerName: string
  status: OrderStatus
  amount: number
  date: string
  /** 订单行快照（Mock）；上线后对齐全量订单明细接口 */
  lines?: ProposalLine[]
  progress: Array<{
    title: string
    status: '已完成' | '进行中' | '未开始'
  }>
}

export interface ServiceResult {
  intent: string
  summary: string
  solution: string
}
