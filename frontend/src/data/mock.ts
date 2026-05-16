import type {
  Customer,
  DeliveryIssue,
  FollowUpRecord,
  Order,
  Product,
  Proposal,
  Quote,
  QuoteLineSnapshot,
  ServiceResult,
  UserProfile,
} from '@/types/business'

function quoteSnapshotsFromProposal(lines: Proposal['lines']): QuoteLineSnapshot[] {
  return lines.map((line) => ({
    productId: line.productId,
    name: line.name,
    spec: line.spec,
    quantity: line.quantity,
    unit: line.unit,
    quotedUnitPrice: line.price,
    minPrice: Math.round(line.price * 94) / 100,
    latestPrice: line.price,
  }))
}

export const mockUser: UserProfile = {
  id: 'u-001',
  name: '张伟',
  roleName: '销售顾问',
}

export const mockFollowUpRecords: FollowUpRecord[] = [
  {
    id: 'fu-001',
    customerId: 'c-001',
    contactPerson: '李经理',
    contactMethod: '13800010001',
    shipAddress: '上海市浦东新区张江高科园区某路 88 号仓库',
    content: '电话沟通备货周期，客户希望五一前收到货，已记录需求待方案确认。',
    reminderDate: '2026-05-20',
    followStatus: '跟进中',
    createdAt: '2026-05-08T14:30:00.000Z',
    operatorName: '张伟',
  },
  {
    id: 'fu-002',
    customerId: 'c-001',
    contactPerson: '李经理',
    contactMethod: '微信：li-mgr-east',
    shipAddress: '同上',
    content: '发送上轮报价纪要，约好本周内确认型号清单。',
    reminderDate: '',
    followStatus: '跟进中',
    createdAt: '2026-05-12T09:15:00.000Z',
    operatorName: '张伟',
  },
  {
    id: 'fu-003',
    customerId: 'c-003',
    contactPerson: '王工',
    contactMethod: '13900030003',
    shipAddress: '',
    content: '首次接洽，约了线下看样机时间。',
    reminderDate: '2026-05-18',
    followStatus: '跟进中',
    createdAt: '2026-05-11T16:40:00.000Z',
    operatorName: '张伟',
  },
]

export const mockCustomers: Customer[] = [
  {
    id: 'c-001',
    code: 'CUST-2023-0108',
    name: '华东精密制造有限公司',
    nature: '企业客户 · 一般纳税人',
    category: '装备制造 · 终端',
    settlementCustomer: '华东精密制造有限公司',
    level: 'A 级',
    contact: '李经理',
    phone: '13800010001',
    type: 'old-timeout',
    tag: '超时未下单老客户',
    lastOrderText: '距上次下单 62 天',
    needSummary: '常购 M6 紧固件与定制支架，近期需确认补货计划。',
  },
  {
    id: 'c-002',
    code: 'CUST-2022-0442',
    name: '越海装备股份',
    nature: '企业客户 · 一般纳税人',
    category: '装备制造 · 终端',
    settlementCustomer: '越海装备股份',
    level: 'B 级',
    contact: '王主管',
    phone: '13800010002',
    type: 'old-timeout',
    tag: '超时未下单老客户',
    lastOrderText: '距上次下单 49 天',
    needSummary: '历史采购高强度螺栓，可能进入季度备货窗口。',
  },
  {
    id: 'c-003',
    code: 'CUST-2026-0003',
    name: '铭科自动化',
    nature: '企业客户 · 小规模',
    category: '自动化 · 公海',
    settlementCustomer: '铭科自动化',
    level: '待评级',
    contact: '陈工',
    phone: '13800010003',
    type: 'public-new',
    tag: '公海新客户',
    lastOrderText: '暂无下单记录',
    needSummary: '咨询设备连接件，需先确认型号与预算。',
  },
  {
    id: 'c-004',
    code: 'CUST-2021-0089',
    name: '北辰机电',
    nature: '企业客户 · 一般纳税人',
    category: '机电 · 直销',
    settlementCustomer: '北辰机电（上海）',
    level: 'A 级',
    contact: '赵总',
    phone: '13800010004',
    type: 'mine',
    tag: '我的客户',
    lastOrderText: '距上次下单 18 天',
    needSummary: '已确认复购意向，可直接进入方案报价。',
  },
]

export const mockProducts: Product[] = [
  {
    id: 'p-001',
    name: '高强度内六角螺栓',
    spec: 'M6 x 30 / 12.9 级',
    unit: '盒',
    price: 128,
    stockText: '常规供货',
    reason: '匹配客户历史采购型号',
    specFields: [
      { key: 'thread', label: '螺纹规格', placeholder: '如 M6、M8', defaultValue: 'M6' },
      { key: 'length', label: '螺杆长度(mm)', placeholder: '标称长度', defaultValue: '30' },
      { key: 'grade', label: '性能等级', placeholder: '如 12.9、10.9', defaultValue: '12.9' },
      { key: 'surface', label: '表面处理', placeholder: '发黑 / 镀锌 / 本色', defaultValue: '发黑' },
      { key: 'proof', label: '材质证明/批次', placeholder: '质保书要求', defaultValue: '按国标抽检' },
      { key: 'brand', label: '品牌或替代说明', placeholder: '指定品牌或互换说明', defaultValue: '' },
      { key: 'remark', label: '备注', placeholder: '其他约定', defaultValue: '' },
    ],
  },
  {
    id: 'p-002',
    name: '防松垫圈套装',
    spec: 'M6-M10 混合装',
    unit: '套',
    price: 86,
    stockText: '常规供货',
    reason: '常与紧固件配套采购',
    specFields: [
      { key: 'range', label: '适配螺纹范围', placeholder: '如 M6-M10', defaultValue: 'M6-M10' },
      { key: 'kit', label: '套装内容', placeholder: '规格清单', defaultValue: '弹垫+平垫混合' },
      { key: 'coating', label: '镀层/防腐', placeholder: '达克罗 / 镀锌', defaultValue: '镀锌' },
      { key: 'perSet', label: '每套数量', placeholder: '套内件数', defaultValue: '各规格若干' },
      { key: 'standard', label: '执行标准', placeholder: '国标/行标', defaultValue: 'GB/T 组合件' },
      { key: 'pack', label: '包装方式', placeholder: '盒装/袋装', defaultValue: '盒装' },
      { key: 'remark', label: '备注', placeholder: '其他约定', defaultValue: '' },
    ],
  },
  {
    id: 'p-003',
    name: '定制安装支架',
    spec: '按图纸加工',
    unit: '件',
    price: 320,
    stockText: '需确认图纸',
    reason: '满足新客户设备连接场景',
    specFields: [
      { key: 'drawing', label: '图纸号/版次', placeholder: 'DWG-XXX Rev', defaultValue: '待客户提供' },
      { key: 'material', label: '材质', placeholder: 'Q235 / SUS304 等', defaultValue: 'Q235B' },
      { key: 'thickness', label: '板厚(mm)', placeholder: '标称厚度', defaultValue: '4' },
      { key: 'hole', label: '孔位/攻牙', placeholder: '孔径、螺纹规格', defaultValue: '按图' },
      { key: 'finish', label: '表面处理', placeholder: '喷塑/镀锌/钝化', defaultValue: '喷塑 RAL7035' },
      { key: 'tol', label: '公差/形位', placeholder: '未注公差要求', defaultValue: '按 IT12' },
      { key: 'weld', label: '焊接/去毛刺', placeholder: '工艺要求', defaultValue: '满焊、去毛刺' },
      { key: 'delivery', label: '交期要求', placeholder: '期望交货', defaultValue: '图纸确认后 15 工作日' },
      { key: 'remark', label: '备注', placeholder: '其他约定', defaultValue: '' },
    ],
  },
]

export const mockProposal: Proposal = {
  id: 's-001',
  customerId: 'c-001',
  name: '五月补货方案',
  remark: '基于客户历史采购与本次沟通需求整理。',
  itemCount: 2,
  totalAmount: 2140,
  createdAt: '2026-05-10T08:00:00.000Z',
  lines: [
    {
      productId: 'p-001',
      name: '高强度内六角螺栓',
      spec: 'M6 x 30 / 12.9 级',
      quantity: 10,
      unit: '盒',
      price: 128,
    },
    {
      productId: 'p-002',
      name: '防松垫圈套装',
      spec: 'M6-M10 混合装',
      quantity: 10,
      unit: '套',
      price: 86,
    },
  ],
}

/** 方案历史（含当前 mock 默认方案） */
export const mockProposals: Proposal[] = [
  mockProposal,
  {
    id: 's-000',
    customerId: 'c-001',
    name: '四月常备方案',
    remark: '',
    itemCount: 1,
    totalAmount: 1280,
    createdAt: '2026-04-18T10:30:00.000Z',
    lines: [
      {
        productId: 'p-001',
        name: '高强度内六角螺栓',
        spec: 'M6 x 30 / 12.9 级',
        quantity: 10,
        unit: '盒',
        price: 128,
      },
    ],
  },
]

export const mockQuote: Quote = {
  id: 'q-001',
  proposalId: 's-001',
  quoteNo: 'BJ20260514001',
  totalAmount: 2140,
  validUntil: '2026-05-21',
  createdAt: '2026-05-14T10:00:00.000Z',
  inquirySubtotal: 2140,
  lines: quoteSnapshotsFromProposal(mockProposal.lines),
}

/** 同一客户下多笔报价单（交期评审须选报价上下文） */
export const mockQuotes: Quote[] = [
  mockQuote,
  {
    id: 'q-000',
    proposalId: 's-000',
    quoteNo: 'BJ20260418002',
    totalAmount: 1280,
    validUntil: '2026-04-25',
    createdAt: '2026-04-18T10:30:00.000Z',
    inquirySubtotal: 1280,
    lines: quoteSnapshotsFromProposal(
      mockProposals.find((p) => p.id === 's-000')?.lines ?? [],
    ),
  },
]

export const mockDeliveryIssues: DeliveryIssue[] = [
  {
    id: 'd-001',
    title: '定制支架需确认图纸',
    detail: '未确认图纸前仅可保存方案，不建议直接下单。',
    level: '需处理',
  },
  {
    id: 'd-002',
    title: '期望交期早于常规周期',
    detail: '可提交插单申请，由后端流程评审。',
    level: '提示',
  },
]

export const mockOrders: Order[] = [
  {
    id: 'o-001',
    orderNo: 'DD20260514001',
    customerId: 'c-001',
    customerName: '华东精密制造有限公司',
    status: '生产中',
    amount: 2140,
    date: '2026-05-14',
    lines: [
      {
        productId: 'p-001',
        name: '高强度内六角螺栓',
        spec: 'M6 x 30 / 12.9 级',
        quantity: 10,
        unit: '盒',
        price: 128,
      },
      {
        productId: 'p-002',
        name: '防松垫圈套装',
        spec: 'M6-M10 混合装',
        quantity: 8,
        unit: '套',
        price: 86,
      },
    ],
    progress: [
      { title: '订单确认', status: '已完成' },
      { title: '物料准备', status: '已完成' },
      { title: '生产加工', status: '进行中' },
      { title: '发货出库', status: '未开始' },
    ],
  },
  {
    id: 'o-002',
    orderNo: 'DD20260512003',
    customerId: 'c-004',
    customerName: '北辰机电',
    status: '已发货',
    amount: 3680,
    date: '2026-05-12',
    lines: [
      {
        productId: 'p-001',
        name: '高强度内六角螺栓',
        spec: 'M6 x 35 / 12.9 级',
        quantity: 20,
        unit: '盒',
        price: 128,
      },
      {
        productId: 'p-003',
        name: '定制安装支架',
        spec: '按图纸加工 · 阳极氧化',
        quantity: 4,
        unit: '件',
        price: 320,
      },
    ],
    progress: [
      { title: '订单确认', status: '已完成' },
      { title: '物料准备', status: '已完成' },
      { title: '生产加工', status: '已完成' },
      { title: '发货出库', status: '已完成' },
    ],
  },
  {
    id: 'o-003',
    orderNo: 'DD20260320088',
    customerId: 'c-002',
    customerName: '越海装备股份',
    status: '已发货',
    amount: 860,
    date: '2026-03-20',
    lines: [
      {
        productId: 'p-001',
        name: '高强度内六角螺栓',
        spec: 'M8 x 40 / 12.9 级',
        quantity: 5,
        unit: '盒',
        price: 128,
      },
    ],
    progress: [
      { title: '订单确认', status: '已完成' },
      { title: '物料准备', status: '已完成' },
      { title: '生产加工', status: '已完成' },
      { title: '发货出库', status: '已完成' },
    ],
  },
]

export const mockServiceResult: ServiceResult = {
  intent: '售后问题咨询',
  summary: '客户反馈已收货产品数量与订单明细不一致，需要核对发货记录。',
  solution: '建议创建服务工单，并关联原订单与客户描述，交由客服流程处理。',
}
