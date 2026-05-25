window.DemoData = {
  agentName: '销售助手 · Pro',
  demoAccount: { user: 'demo', pass: '123456' },
  enterprises: [
    { id: 'ent-east', name: '用友精工华东事业部' },
    { id: 'ent-south', name: '用友华南经销中心' }
  ],
  customers: [
    {
      id: 'c1',
      enterpriseId: 'ent-east',
      code: 'C-HD-20240018',
      name: '华东精密机械有限公司',
      customerType: 'old',
      nature: '制造业 · 民营企业',
      category: '终端客户',
      partnerType: 'customer',
      settlementCustomer: '华东精密机械有限公司',
      level: 'A',
      lastOrderAt: '2026-05-10',
      lastOrderAmount: '¥128,600',
      contactName: '王经理',
      contactPhone: '138****8821',
      contactAddress: '江苏省苏州市工业园区星湖街 328 号',
      shipAddress: '江苏省苏州市工业园区星湖街 328 号',
      address: '江苏省苏州市工业园区',
      reminderDate: null,
      updatedAt: '2026-05-16T09:20:00'
    },
    {
      id: 'c2',
      enterpriseId: 'ent-east',
      code: 'C-SZ-20240302',
      name: '苏州恒力配件厂',
      customerType: 'old',
      nature: '制造业 · 个体工商户',
      category: '经销商',
      partnerType: 'supplier',
      settlementCustomer: '苏州恒力配件厂',
      level: 'A',
      lastOrderAt: '2026-05-14',
      lastOrderAmount: '¥86,200',
      contactName: '李总',
      contactPhone: '139****6612',
      contactAddress: '江苏省苏州市吴中区甪直镇工业园 A 栋',
      shipAddress: '江苏省苏州市吴中区甪直镇工业园',
      address: '江苏省苏州市吴中区',
      reminderDate: null,
      updatedAt: '2026-05-15T14:00:00'
    },
    {
      id: 'c3',
      enterpriseId: 'ent-east',
      code: 'C-SZ-20250501',
      name: '深圳创源科技',
      customerType: 'new',
      nature: '科技服务 · 有限公司',
      category: '终端客户',
      partnerType: 'both',
      settlementCustomer: '深圳创源科技',
      level: 'B',
      lastOrderAt: '—',
      lastOrderAmount: '—',
      contactName: '陈经理',
      contactPhone: '137****9033',
      contactAddress: '广东省深圳市南山区科技园南路 18 号',
      shipAddress: '广东省深圳市南山区科技园南路',
      address: '广东省深圳市南山区',
      reminderDate: '2026-05-20',
      updatedAt: '2026-05-14T11:30:00'
    },
    {
      id: 'c4',
      enterpriseId: 'ent-south',
      code: 'C-GZ-20240156',
      name: '广州瑞联制造',
      customerType: 'new',
      nature: '制造业 · 有限公司',
      category: '战略客户',
      partnerType: 'supplier',
      settlementCustomer: '广州瑞联制造（总部结算）',
      level: 'B',
      lastOrderAt: '2026-05-08',
      lastOrderAmount: '¥62,400',
      contactName: '周经理',
      contactPhone: '136****2288',
      contactAddress: '广东省广州市番禺区大石街道工业大道 66 号',
      shipAddress: '广东省广州市番禺区大石街道',
      address: '广东省广州市番禺区',
      reminderDate: '2026-05-16',
      updatedAt: '2026-05-13T16:45:00'
    }
  ],
  products: [
    { id: 'p1', name: '精密轴承组件 A 型', spec: 'Φ120mm 合金钢', unitPrice: 1280 },
    { id: 'p2', name: '传动齿轮箱 M3', spec: '三级减速 1:30', unitPrice: 3680 },
    { id: 'p3', name: '伺服电机 750W', spec: '220V 额定扭矩 2.4N·m', unitPrice: 2150 },
    { id: 'p4', name: '工业密封件套装', spec: '耐温 200℃ 20 件/套', unitPrice: 560 }
  ],
  orders: [
    {
      id: 'o1',
      customerId: 'c1',
      no: 'SO20260510001',
      status: '生产中',
      statusDetail: '机加工已完成，待装配',
      amount: '¥128,600',
      date: '2026-05-10',
      items: '轴承组件×20、齿轮箱×2'
    },
    {
      id: 'o2',
      customerId: 'c1',
      no: 'SO20260402018',
      status: '已发货',
      statusDetail: '物流单号 SF1234567890',
      amount: '¥96,400',
      date: '2026-04-02',
      items: '伺服电机×10、密封件×5'
    },
    {
      id: 'o3',
      customerId: 'c2',
      no: 'SO20260514003',
      status: '待排产',
      statusDetail: '物料齐套，等待产线',
      amount: '¥86,200',
      date: '2026-05-14',
      items: '齿轮箱×4、密封件×8'
    }
  ],
  recentCustomers: [
    { customerId: 'c1', skillId: 'quote', label: '10 分钟前' },
    { customerId: 'c2', skillId: 'plan', label: '昨天' },
    { customerId: 'c3', skillId: 'followup', label: '3 天前' }
  ],
  skills: [
    { id: 'followup', name: '今日待跟', enabled: true, needsCustomer: false },
    { id: 'plan', name: '方案速配', enabled: true, needsCustomer: true },
    { id: 'quote', name: '产品报价', enabled: true, needsCustomer: true },
    { id: 'delivery', name: '交期评审', enabled: true, needsCustomer: true },
    { id: 'order', name: '确认下单', enabled: true, needsCustomer: true },
    { id: 'copy', name: '复制订单', enabled: true, needsCustomer: true },
    { id: 'change', name: '订单变更', enabled: true, needsCustomer: true },
    { id: 'progress', name: '订单进度', enabled: true, needsCustomer: true },
    { id: 'capacity', name: '产能分析', enabled: true, needsCustomer: true },
    { id: 'inventory', name: '库存查询', enabled: true, needsCustomer: true },
    { id: 'biz-analysis', name: '业务分析', enabled: true, needsCustomer: true },
    { id: 'payment', name: '回款分析', enabled: true, needsCustomer: true },
    { id: 'service', name: '客服工单', enabled: true, needsCustomer: true }
  ],
  /** 欢迎区功能网格：6×2；文案统一四字 */
  welcomeFeatures: [
    { id: 'followup', label: '今日待跟' },
    { id: 'plan', label: '方案速配' },
    { id: 'quote', label: '产品报价' },
    { id: 'delivery', label: '交期评审' },
    { id: 'order', label: '确认下单' },
    { id: 'copy', label: '复制订单' },
    { id: 'change', label: '订单变更' },
    { id: 'progress', label: '订单进度' },
    { id: 'capacity', label: '产能分析' },
    { id: 'inventory', label: '库存查询' },
    { id: 'biz-analysis', label: '业务分析' },
    { id: 'payment', label: '回款分析' }
  ],
  skillUtterances: {
    followup: '今日待跟进',
    plan: '配个方案',
    quote: '报价',
    delivery: '查交期',
    order: '生成订单',
    copy: '复制上次订单',
    change: '变更订单',
    progress: '查订单进度',
    capacity: '产能分析',
    inventory: '库存查询',
    'biz-analysis': '业务分析',
    payment: '回款分析',
    service: '客户投诉',
    'write-follow': '写跟进',
    'switch-customer': '切换客户',
    help: '帮助'
  },
  welcomeAi: '你好，我是销售助手。点下方功能可直达对应能力，也可使用底部技能栏或语音输入。',
  welcomeHelp:
    '支持：待跟进、方案、报价、交期、下单、复制/变更/进度，以及产能分析、库存查询、业务分析、回款分析；底部技能条另有客服等能力。未选客户时，部分功能会提示先选择客户。',
  templateFollowup: {
    channel: '服务号消息',
    title: '今日待跟进提醒',
    bodyPrefix: '您有',
    bodySuffix: '家企业待跟进，请及时跟进。',
    button: '查看待跟进列表'
  },
  voiceSamples: [
    '今日待跟进',
    '写跟进',
    '给华东精密机械有限公司写跟进',
    '给苏州恒力配件厂记录跟进，今天上午电话沟通了交期，客户希望下周报价',
    '切换客户',
    '帮助'
  ],
  followStatusOptions: [
    { value: 'ongoing', label: '跟进中' },
    { value: 'done', label: '跟进完成' }
  ],
  changeReasons: ['交期调整', '数量变更', '规格变更', '客户取消部分', '其他']
};
