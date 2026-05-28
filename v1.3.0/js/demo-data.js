window.DemoData = {
  agentName: '销售助手 · Pro',
  demoAccount: { user: 'demo', pass: '123456' },
  /** 演示业务员（报价生成订单时写入；老客户待跟进分管人） */
  salesperson: '王业务',
  demoSalesUser: '王业务',
  /** 订单状态：报价后自动生成（正式系统需技术新增） */
  orderStatusPendingSubmit: '待提交',
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
      settlementMethod: '月结 30 天',
      settlementCurrency: 'CNY（人民币）',
      level: 'A',
      lastOrderAt: '2026-05-10',
      lastOrderAmount: '¥128,600',
      contactName: '王经理',
      contactPhone: '138****8821',
      contactAddress: '江苏省苏州市工业园区星湖街 328 号',
      shipAddress: '江苏省苏州市工业园区星湖街 328 号',
      address: '江苏省苏州市工业园区',
      reminderDate: null,
      updatedAt: '2026-05-16T09:20:00',
      accountManager: '王业务',
      salesReminderDays: 7
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
      updatedAt: '2026-05-15T14:00:00',
      accountManager: '王业务',
      salesReminderDays: 4
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
      reminderDate: null,
      updatedAt: '2026-05-14T11:30:00',
      demandHint: '伺服电机 自动化产线 密封件',
      accountManager: null,
      latestFollowStatus: 'pending'
    },
    {
      id: 'c5',
      enterpriseId: 'ent-east',
      code: 'C-HZ-20250512',
      name: '杭州智联装备有限公司',
      customerType: 'new',
      nature: '装备制造业 · 有限公司',
      category: '终端客户',
      partnerType: 'customer',
      settlementCustomer: '杭州智联装备有限公司',
      level: 'B',
      lastOrderAt: '—',
      lastOrderAmount: '—',
      contactName: '赵工',
      contactPhone: '135****7710',
      contactAddress: '浙江省杭州市余杭区未来科技城',
      shipAddress: '浙江省杭州市余杭区',
      address: '浙江省杭州市',
      reminderDate: null,
      updatedAt: '2026-05-17T10:00:00',
      demandHint: '直线导轨 PLC 触摸屏 自动化',
      accountManager: null,
      latestFollowStatus: 'pending'
    },
    {
      id: 'c6',
      enterpriseId: 'ent-east',
      code: 'C-NJ-20250508',
      name: '南京博远机电科技',
      customerType: 'new',
      nature: '制造业 · 有限公司',
      category: '经销商',
      partnerType: 'both',
      settlementCustomer: '南京博远机电科技',
      level: 'C',
      lastOrderAt: '—',
      lastOrderAmount: '—',
      contactName: '孙经理',
      contactPhone: '133****5521',
      contactAddress: '江苏省南京市江宁区将军大道',
      shipAddress: '江苏省南京市江宁区',
      address: '江苏省南京市',
      reminderDate: '2026-05-18',
      updatedAt: '2026-05-16T08:30:00',
      demandHint: '液压泵站 气缸 电磁阀',
      accountManager: null,
      latestFollowStatus: 'pending'
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
      settlementMethod: '月结 60 天',
      settlementCurrency: 'CNY（人民币）',
      level: 'B',
      lastOrderAt: '2026-05-08',
      lastOrderAmount: '¥62,400',
      contactName: '周经理',
      contactPhone: '136****2288',
      contactAddress: '广东省广州市番禺区大石街道工业大道 66 号',
      shipAddress: '广东省广州市番禺区大石街道',
      address: '广东省广州市番禺区',
      reminderDate: null,
      updatedAt: '2026-05-13T16:45:00',
      demandHint: '齿轮箱 减速 工业密封 制造产线',
      accountManager: null,
      latestFollowStatus: 'pending'
    },
    {
      id: 'c7',
      enterpriseId: 'ent-south',
      code: 'C-FS-20240388',
      name: '佛山鑫科传动设备',
      customerType: 'old',
      nature: '制造业 · 民营企业',
      category: '终端客户',
      partnerType: 'customer',
      settlementCustomer: '佛山鑫科传动设备',
      level: 'A',
      lastOrderAt: '2026-04-28',
      lastOrderAmount: '¥54,800',
      contactName: '梁总',
      contactPhone: '134****8890',
      contactAddress: '广东省佛山市顺德区北滘镇',
      shipAddress: '广东省佛山市顺德区',
      address: '广东省佛山市',
      reminderDate: null,
      updatedAt: '2026-05-12T15:20:00',
      accountManager: '王业务',
      salesReminderDays: 14
    }
  ],
  products: [
    {
      id: 'p1',
      name: '精密轴承组件 A 型',
      spec: 'Φ120mm 合金钢',
      productType: '机械传动',
      inventoryDesc: '合金钢精密轴承 120mm 机械传动 制造业',
      inventoryCode: 'INV-CHC-A120',
      salesUnit: '套',
      unitPrice: 1280,
      latestPrice: 1320,
      minPrice: 1150,
      defaultTaxRate: 13,
      skus: [
        { id: 'p1-s1', label: '标准型 Φ120', processVersion: 'V2024.1' },
        { id: 'p1-s2', label: '加强型 Φ120', processVersion: 'V2024.2' }
      ]
    },
    {
      id: 'p2',
      name: '传动齿轮箱 M3',
      spec: '三级减速 1:30',
      productType: '工业传动',
      inventoryDesc: '三级减速齿轮箱 工业传动 产线',
      inventoryCode: 'INV-GBX-M3',
      salesUnit: '台',
      unitPrice: 3680,
      latestPrice: 3680,
      minPrice: 3250,
      skus: [
        { id: 'p2-s1', label: '卧式 M3' },
        { id: 'p2-s2', label: '立式 M3' }
      ],
      customItems: ['减速比1:30', '产线主传动']
    },
    {
      id: 'p3',
      name: '伺服电机 750W',
      spec: '220V 额定扭矩 2.4N·m',
      productType: '自动化',
      inventoryDesc: '伺服电机 750W 自动化产线 220V',
      inventoryCode: 'INV-SRV-750',
      salesUnit: '台',
      unitPrice: 2150,
      latestPrice: 2180,
      minPrice: 1920,
      defaultTaxRate: 13,
      skus: [
        { id: 'p3-s1', label: '法兰安装', processVersion: 'V2025-A' },
        { id: 'p3-s2', label: '底座安装', processVersion: 'V2025-A' }
      ],
      customItems: ['750W伺服', '自动化产线标配']
    },
    {
      id: 'p4',
      name: '工业密封件套装',
      spec: '耐温 200℃ 20 件/套',
      productType: '气动',
      inventoryDesc: '密封件套装 耐温200 工业密封',
      inventoryCode: 'INV-SEL-200',
      salesUnit: '套',
      unitPrice: 560,
      latestPrice: 560,
      minPrice: 498,
      skus: [{ id: 'p4-s1', label: '标准 20 件/套' }]
    },
    {
      id: 'p5',
      name: 'PLC 控制模块',
      spec: '32 点 IO',
      productType: '电控',
      inventoryDesc: 'PLC 控制 自动化 产线电控',
      inventoryCode: 'INV-PLC-32',
      salesUnit: '块',
      unitPrice: 4200,
      latestPrice: 4200,
      minPrice: 3720,
      skus: [{ id: 'p5-s1', label: '32 点标准' }]
    },
    {
      id: 'p6',
      name: '直线导轨副',
      spec: '行程 800mm',
      productType: '自动化',
      inventoryDesc: '直线导轨 精密机械 自动化',
      inventoryCode: 'INV-RAIL-800',
      salesUnit: '套',
      unitPrice: 1890,
      latestPrice: 1950,
      minPrice: 1720,
      skus: [{ id: 'p6-s1', label: '800mm 标准' }]
    },
    {
      id: 'p7',
      name: '液压泵站 H 系列',
      spec: '7.5MPa 油箱 80L',
      productType: '工业传动',
      inventoryDesc: '液压泵站 工业传动 产线',
      inventoryCode: 'INV-HYD-H75',
      salesUnit: '台',
      unitPrice: 12800,
      latestPrice: 13200,
      minPrice: 11800,
      skus: [{ id: 'p7-s1', label: '标准型 H75' }]
    },
    {
      id: 'p8',
      name: '变频器 15kW',
      spec: '三相 380V',
      productType: '自动化',
      inventoryDesc: '变频器 电控 自动化产线',
      inventoryCode: 'INV-VFD-15',
      salesUnit: '台',
      unitPrice: 2860,
      latestPrice: 2900,
      minPrice: 2550,
      skus: [{ id: 'p8-s1', label: '15kW 标准' }]
    },
    {
      id: 'p9',
      name: '工业触摸屏 10寸',
      spec: '电容屏 以太网',
      productType: '电控',
      inventoryDesc: '触摸屏 HMI 自动化 电控',
      inventoryCode: 'INV-HMI-10',
      salesUnit: '台',
      unitPrice: 1680,
      latestPrice: 1720,
      minPrice: 1500,
      skus: [{ id: 'p9-s1', label: '10 寸标准' }]
    },
    {
      id: 'p10',
      name: '联轴器弹性套',
      spec: '孔径 24/28',
      productType: '配件',
      inventoryDesc: '联轴器 机械传动 配件',
      inventoryCode: 'INV-CPL-2428',
      salesUnit: '只',
      unitPrice: 186,
      latestPrice: 198,
      minPrice: 165,
      skus: [{ id: 'p10-s1', label: '24/28 标准' }]
    },
    {
      id: 'p11',
      name: '深沟球轴承 6205',
      spec: 'P5 级',
      productType: '机械传动',
      inventoryDesc: '轴承 6205 机械传动',
      inventoryCode: 'INV-BRG-6205',
      salesUnit: '只',
      unitPrice: 42,
      latestPrice: 45,
      minPrice: 38,
      skus: [{ id: 'p11-s1', label: 'P5' }]
    },
    {
      id: 'p12',
      name: '同步齿形带',
      spec: 'HTD 5M-15m',
      productType: '自动化',
      inventoryDesc: '同步带 传动 自动化',
      inventoryCode: 'INV-BELT-5M',
      salesUnit: '条',
      unitPrice: 320,
      latestPrice: 330,
      minPrice: 288,
      skus: [{ id: 'p12-s1', label: '5M-15m' }]
    },
    {
      id: 'p13',
      name: '气缸 SC63×200',
      spec: '双作用',
      productType: '气动',
      inventoryDesc: '气缸 气动 自动化产线',
      inventoryCode: 'INV-CYL-SC63',
      salesUnit: '只',
      unitPrice: 268,
      latestPrice: 275,
      minPrice: 240,
      skus: [{ id: 'p13-s1', label: 'SC63×200' }]
    },
    {
      id: 'p14',
      name: '电磁阀组 5 联',
      spec: '24VDC',
      productType: '气动',
      inventoryDesc: '电磁阀 气动 电控',
      inventoryCode: 'INV-SV-5',
      salesUnit: '组',
      unitPrice: 890,
      latestPrice: 920,
      minPrice: 810,
      skus: [{ id: 'p14-s1', label: '5 联 24V' }]
    },
    {
      id: 'p15',
      name: '冷却液集中过滤站',
      spec: '流量 120L/min',
      productType: '机加工',
      inventoryDesc: '过滤站 冷却 机加工 产线',
      inventoryCode: 'INV-FIL-120',
      salesUnit: '台',
      unitPrice: 28600,
      latestPrice: 29000,
      minPrice: 26500,
      skus: [{ id: 'p15-s1', label: '120L/min' }]
    },
    {
      id: 'p16',
      name: '刀库 BT40-21T',
      spec: '圆盘式',
      productType: '配件',
      inventoryDesc: '刀库 BT40 数控机床 配件',
      inventoryCode: 'INV-ATC-BT40',
      salesUnit: '套',
      unitPrice: 45800,
      latestPrice: 46200,
      minPrice: 42000,
      skus: [{ id: 'p16-s1', label: 'BT40-21T' }]
    }
  ],
  quoteTemplates: [
    { id: 'qt-standard', name: '标准销售报价单', desc: '含税合计、行明细、客户信息' },
    { id: 'qt-export', name: '出口报价单（USD）', desc: '外币列示，演示用' },
    { id: 'qt-simple', name: '简版报价单', desc: '仅合计与主要行项目' }
  ],
  planTemplates: [
    { id: 'tpl-tech', name: '标准技术方案', desc: '规格、数量（不含价格）' },
    { id: 'tpl-bid', name: '投标方案简版', desc: '一页纸摘要，适合对外投标' },
    { id: 'tpl-delivery', name: '完整交付方案', desc: '含验收节点与交付说明' }
  ],
  /** v1.3.0 订单类型（列表/进度统一枚举） */
  orderStatuses: ['未审核', '销售审核', '已审核', '已完成', '异常'],
  orderStatusMeta: {
    未审核: { badgeClass: 'sc-badge--muted', hint: '待内勤受理' },
    销售审核: { badgeClass: 'sc-badge--primary', hint: '销售主管审核中' },
    已审核: { badgeClass: 'sc-badge--new', hint: '审核通过，可排产履约' },
    已完成: { badgeClass: 'sc-badge--done', hint: '订单已关闭' },
    异常: { badgeClass: 'sc-badge--old', hint: '需处理异常后继续' }
  },
  /** 交期评审·按订单：未排程订单（非待提交、非已完成；已标记 scheduled:true 的排除） */
  isOrderUnscheduled: function (order) {
    if (!order || !order.status) return false;
    if (order.status === this.orderStatusPendingSubmit) return false;
    if (order.status === '已完成') return false;
    if (order.scheduled === true) return false;
    return true;
  },
  /** @deprecated 交期评审已改为按货品行配置，候选项见 processVersionOptions(product, skuId) */
  deliveryProcessVersions: ['标准版', 'V2024.1', 'V2024.2', 'V2025-A'],
  /** 交期评审演示 · 产线名称（不齐套时展示） */
  deliveryReviewLines: ['机加工一线', '装配二线', '仓储发运线'],
  /** 交期评审 · 是否生成采购计划 */
  procurementPlanOptions: [
    { value: 'yes', label: '是', generate: true },
    { value: 'no', label: '否', generate: false }
  ],
  orders: [
    {
      id: 'o1',
      customerId: 'c1',
      no: 'SO20260510001',
      status: '销售审核',
      statusDetail: '销售主管待审，预计今日 18:00 前',
      amount: '¥128,600',
      date: '2026-05-10',
      items: '轴承组件×20、齿轮箱×2',
      productIds: ['p1', 'p1', 'p2'],
      timeline: [
        { label: '未审核', at: '2026-05-10 09:12', done: true },
        { label: '销售审核', at: '2026-05-10 10:05', done: false, current: true },
        { label: '已审核', at: '', done: false },
        { label: '已完成', at: '', done: false }
      ]
    },
    {
      id: 'o2',
      customerId: 'c1',
      no: 'SO20260402018',
      status: '已完成',
      statusDetail: '整单已出库签收',
      amount: '¥96,400',
      date: '2026-04-02',
      items: '伺服电机×10、密封件×5',
      productIds: ['p3', 'p3', 'p4'],
      timeline: [
        { label: '未审核', at: '2026-04-02 08:30', done: true },
        { label: '销售审核', at: '2026-04-02 11:00', done: true },
        { label: '已审核', at: '2026-04-03 09:00', done: true },
        { label: '已完成', at: '2026-04-18 16:20', done: true, current: true }
      ]
    },
    {
      id: 'o3',
      customerId: 'c2',
      no: 'SO20260514003',
      status: '未审核',
      statusDetail: '刚提交，等待内勤接单',
      amount: '¥86,200',
      date: '2026-05-14',
      items: '齿轮箱×4、密封件×8',
      productIds: ['p2', 'p4', 'p4'],
      timeline: [
        { label: '未审核', at: '2026-05-14 14:22', done: false, current: true },
        { label: '销售审核', at: '', done: false },
        { label: '已审核', at: '', done: false },
        { label: '已完成', at: '', done: false }
      ]
    },
    {
      id: 'o4',
      customerId: 'c1',
      no: 'SO20260508007',
      status: '异常',
      statusDetail: '交期评审不齐套，客户要求提前发货',
      amount: '¥42,300',
      date: '2026-05-08',
      items: '密封件×12',
      productIds: ['p4', 'p4'],
      timeline: [
        { label: '未审核', at: '2026-05-08 10:00', done: true },
        { label: '销售审核', at: '2026-05-08 15:30', done: true },
        { label: '已审核', at: '2026-05-09 09:00', done: true },
        { label: '异常', at: '2026-05-12 11:40', done: false, current: true, error: true }
      ]
    },
    {
      id: 'o5',
      customerId: 'c2',
      no: 'SO20260501002',
      status: '已审核',
      statusDetail: '审核通过，等待排产',
      amount: '¥156,000',
      date: '2026-05-01',
      items: '轴承组件×30',
      productIds: ['p1', 'p1', 'p1'],
      timeline: [
        { label: '未审核', at: '2026-05-01 09:00', done: true },
        { label: '销售审核', at: '2026-05-01 14:00', done: true },
        { label: '已审核', at: '2026-05-02 10:30', done: true, current: true },
        { label: '已完成', at: '', done: false }
      ]
    }
  ],
  recentCustomers: [
    { customerId: 'c1', skillId: 'quote', label: '10 分钟前' },
    { customerId: 'c3', skillId: 'plan', label: '昨天' },
    { customerId: 'c5', skillId: 'followup', label: '3 天前' }
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
  /** 选客户引导卡 · 可粘贴的一句话示例（与解析逻辑一致） */
  skillCustomerExampleUtterances: {
    plan: '给深圳创源配伺服电机和传动齿轮箱各2台',
    quote: '给深圳创源按方案报价',
    order: '给华东精密下单，配伺服电机10台单价2100'
  },
  /** 选客户引导卡：仅一句话直达类技能展示补充说明（缺客户时） */
  skillCustomerOneLineHints: {
    plan:
      '可一句话生成方案（话术含选品、规格与数量）。示例：给深圳创源配伺服电机和传动齿轮箱各2台',
    quote:
      '可一句话生成报价单（话术含按方案或选品、规格、数量、本单单价）。示例：给深圳创源按方案报价',
    'scheme-quote': '须先选客户；系统校验该客户是否已有方案，有则列出方案供选择',
    order:
      '可一句话生成订单（话术含按报价单或直选品名、数量与单价）。示例：给华东精密下单，配伺服电机10台单价2100'
  },
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
  welcomeAi: '你好，我是销售助手。可点功能格或底部技能栏开始。',
  welcomeHelp:
    '支持：待跟进、方案速配、报价、交期、下单、复制/变更/进度、产能/库存/业务/回款分析、客服工单等。',
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
    '配个方案',
    '客户需要伺服电机和传动齿轮箱各2台',
    '给深圳创源报伺服电机10台打九折',
    '选品 伺服电机',
    '加购',
    '生成方案',
    '给华东精密机械有限公司写跟进',
    '切换客户',
    '帮助'
  ],
  /** 逐项报价抽屉内语音演示话术（循环播放） */
  quoteVoiceSamples: [
    '第一项报价 3680',
    '齿轮箱 数量 2',
    '伺服电机 报价 4200',
    '选择模板',
    '确认下单',
    '本单报价 3500'
  ],
  planTemplateVoiceSamples: ['第1个', '选第二个', '标准技术方案', '保存方案'],
  quoteTemplateVoiceSamples: ['第1个', '选第二个', '标准报价单', '生成报价单'],
  /** 新客户方案 · 需求经底部输入区提交；可与 voiceSamples 共用演示话术 */
  planDemandVoiceSamples: [
    '伺服电机和传动齿轮箱各2台，用于自动化产线',
    '需要直线导轨和PLC触摸屏做设备改造',
    '液压泵站、气缸和电磁阀',
    '修改需求 伺服电机和传动齿轮箱各2台'
  ],
  followStatusOptions: [
    { value: 'ongoing', label: '跟进中' },
    { value: 'done', label: '跟进完成' }
  ],
  changeReasons: ['交期调整', '数量变更', '规格变更', '客户取消部分', '其他'],

  /** 提醒日期：未设置每日推送；已设置则 today >= reminderDate */
  isDueForFollowUpPush(customer, todayYmd, getReminderDate) {
    if (!customer) return false;
    const rd = getReminderDate ? getReminderDate(customer) : customer.reminderDate || '';
    if (!rd) return true;
    return rd <= (todayYmd || '');
  },

  daysSinceOrder(lastOrderAt, todayYmd) {
    if (!lastOrderAt || lastOrderAt === '—') return 999;
    const a = new Date(String(lastOrderAt).slice(0, 10));
    const b = new Date(todayYmd);
    if (isNaN(a.getTime()) || isNaN(b.getTime())) return 0;
    return Math.floor((b - a) / 86400000);
  },

  /** 本企业下是否曾有订单（演示订单库） */
  customerHasOrders(customerId) {
    return DemoData.orders.some((o) => o.customerId === customerId);
  },

  /**
   * 老客户（业务定义）：有过订单，且责任人=当前业务员
   * @param {object} customer
   * @param {string} [currentUser] 默认演示业务员
   */
  isOldCustomer(customer, currentUser) {
    if (!customer) return false;
    const user = currentUser || DemoData.demoSalesUser;
    const mgr =
      customer.accountManager != null && String(customer.accountManager).trim() !== ''
        ? customer.accountManager
        : null;
    if (!mgr || mgr !== user) return false;
    return DemoData.customerHasOrders(customer.id);
  },

  /**
   * 新客户（业务定义）：跟进状态=待跟进，且无责任人
   */
  isNewCustomer(customer) {
    if (!customer) return false;
    if (customer.accountManager != null && String(customer.accountManager).trim() !== '') {
      return false;
    }
    return (customer.latestFollowStatus || 'pending') === 'pending';
  },

  /**
   * 选客户抽屉可见范围：当前业务员的老客户 ∪ 本企业公海新客户
   * @param {Array} customers 通常为当前企业客户子集
   * @param {string} [currentUser]
   */
  customersVisibleToSalesUser(customers, currentUser) {
    const user = currentUser || DemoData.demoSalesUser;
    return (customers || []).filter(function (c) {
      return DemoData.isOldCustomer(c, user) || DemoData.isNewCustomer(c);
    });
  },

  /** 方案选品等：老客户规则优先，否则新客户，否则回退档案 customerType */
  planCustomerKind(customer, currentUser) {
    if (DemoData.isOldCustomer(customer, currentUser)) return 'old';
    if (DemoData.isNewCustomer(customer)) return 'new';
    return customer.customerType === 'new' ? 'new' : 'old';
  },

  /** 老客户待跟进：分管=当前用户 且 超销售提醒天数未下单 */
  isOldCustomerFollowUp(customer, currentUser, todayYmd, getReminderDate) {
    if (!customer || !DemoData.isOldCustomer(customer, currentUser)) return false;
    if (!DemoData.isDueForFollowUpPush(customer, todayYmd, getReminderDate)) return false;
    const mgr =
      customer.accountManager != null && customer.accountManager !== ''
        ? customer.accountManager
        : DemoData.demoSalesUser;
    if (mgr !== currentUser) return false;
    const days = customer.salesReminderDays != null ? customer.salesReminderDays : 30;
    return DemoData.daysSinceOrder(customer.lastOrderAt, todayYmd) > days;
  },

  /** 新客户待跟进：无责任人 且 状态=待跟进（与 isNewCustomer 一致，另校验提醒日） */
  isNewCustomerFollowUp(customer, todayYmd, getReminderDate) {
    if (!customer || !DemoData.isNewCustomer(customer)) return false;
    if (!DemoData.isDueForFollowUpPush(customer, todayYmd, getReminderDate)) return false;
    return true;
  },

  /** 今日待跟进 = 老客户 ∪ 新客户（每家仅一类） */
  getTodayFollowUpCustomers(customers, currentUser, todayYmd, getReminderDate) {
    const list = [];
    const seen = new Set();
    (customers || []).forEach((c) => {
      if (DemoData.isOldCustomerFollowUp(c, currentUser, todayYmd, getReminderDate) && !seen.has(c.id)) {
        seen.add(c.id);
        list.push(c);
      }
    });
    (customers || []).forEach((c) => {
      if (DemoData.isNewCustomerFollowUp(c, todayYmd, getReminderDate) && !seen.has(c.id)) {
        seen.add(c.id);
        list.push(c);
      }
    });
    return list;
  },

  /** 新客户方案选品：推荐区匹配阈值（第二步：需求关键词 × 存货描述） */
  PLAN_RECOMMEND_SCORE_NEW: 0.8,
  /** 老客户/新客户：需求与产品任一字段模糊命中即入推荐（0 表示由 planMatchScoreForProduct 判定） */
  PLAN_MATCH_MIN_SCORE: 0.01,
  /** 新客户「更多产品」：第二步弱匹配下限 */
  PLAN_MORE_MIN_SCORE_NEW: 0.2,

  /** 产品可检索字段：名称 + 描述 + 规格（含 SKU 标签）+ 自定义项 */
  productMatchTexts(product) {
    if (!product) return [];
    const parts = [
      product.name,
      product.spec,
      product.inventoryDesc,
      product.inventoryCode
    ];
    (product.skus || []).forEach(function (s) {
      if (s && s.label) parts.push(s.label);
    });
    const custom = product.customItems;
    if (Array.isArray(custom)) {
      custom.forEach(function (x) {
        if (typeof x === 'string') parts.push(x);
        else if (x && (x.label || x.value)) parts.push(x.label || x.value);
      });
    }
    return parts.filter(Boolean);
  },

  productMatchBlob(product) {
    return DemoData.productMatchTexts(product).join(' ');
  },

  /** 老客户：最近订单倒序去重，最多 limit 个产品 */
  oldCustomerHistoryProducts(customer, limit) {
    limit = limit == null ? 10 : limit;
    const all = DemoData.products;
    const orders = DemoData.orders
      .filter(function (o) {
        return o.customerId === customer.id;
      })
      .sort(function (a, b) {
        return (b.date || '').localeCompare(a.date || '');
      });
    const seen = new Set();
    const rows = [];
    orders.forEach(function (o) {
      (o.productIds || []).forEach(function (pid) {
        if (seen.has(pid) || rows.length >= limit) return;
        seen.add(pid);
        const p = all.find(function (x) {
          return x.id === pid;
        });
        if (p) rows.push({ product: p, score: null, tag: '历史订单' });
      });
    });
    return rows;
  },

  /**
   * 第一步：客户档案「客户性质」与产品「产品类型」可售范围（演示主数据）
   * 客户字段 customers[].category；产品字段 products[].productType
   */
  categoryProductTypes: {
    终端客户: ['机械传动', '自动化', '工业传动', '气动', '电控'],
    经销商: ['机械传动', '配件', '自动化', '气动', '电控'],
    战略客户: ['机械传动', '工业传动', '自动化', '机加工', '配件']
  },

  /** 第一步：产品类型是否与客户性质匹配 */
  productMatchesCustomerCategory(product, customer) {
    if (!product || !customer) return false;
    const allowed = DemoData.categoryProductTypes[customer.category];
    if (!allowed || !allowed.length) return true;
    return allowed.indexOf(product.productType) >= 0;
  },

  /** 新客户选品候选池：产品全库（按需求模糊匹配，不按客户性质×产品类型过滤） */
  newCustomerProductPool(/* customer */) {
    return DemoData.products;
  },

  /**
   * 从需求句拆出关键词（支持「伺服电机和传动齿轮箱各2台」等多品句式）
   */
  demandTokens(demandText) {
    let t = String(demandText || '').trim();
    if (!t) return [];
    t = t
      .replace(/各\s*\d+\s*(?:台|套|个|件|只|条)?/gi, ' ')
      .replace(/\d+\s*(?:台|套|个|件|只|条)/gi, ' ')
      .replace(/用于[\u4e00-\u9fa5a-zA-Z0-9]+/g, ' ');
    const parts = t
      .split(/[\s,，、]+|(?:和|与|及|以及|还有|再加|加上)/)
      .map((s) => s.trim())
      .filter((s) => s.length >= 2 && !/^(配|要|需要|各|给)$/.test(s));
    const seen = new Set();
    return parts.filter((p) => {
      const k = p.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  },

  demandTokenHitsProduct(token, product) {
    if (!product) return false;
    const k = DemoData.normalizeSearchText(token);
    if (!k || k.length < 2) return false;
    return DemoData.productMatchTexts(product).some(function (text) {
      return DemoData.normalizeSearchText(text).indexOf(k) >= 0;
    });
  },

  /** 需求与产品：拆词命中率（命中词数 ÷ 拆词总数） */
  planMatchScoreForProduct(demandText, product) {
    if (!product || !demandText) return 0;
    const t = String(demandText).trim();
    if (!t) return 0;
    let tokens = DemoData.demandTokens(t);
    if (!tokens.length) tokens = [t];
    let hit = 0;
    tokens.forEach(function (tok) {
      if (DemoData.demandTokenHitsProduct(tok, product)) hit++;
    });
    return hit / tokens.length;
  },

  /** @deprecated 使用 demandTokenHitsProduct(token, product) */
  matchInventoryScore(demandText, inventoryDesc, productName) {
    const p = { name: productName, inventoryDesc: inventoryDesc, spec: '' };
    return DemoData.planMatchScoreForProduct(demandText, p);
  },

  /**
   * 方案选品 · 推荐区（最多 10 条）
   * - 新客户：须先有需求描述，再按需求模糊匹配（无需求不推荐）
   * - 老客户：默认最近订单 Top10；有需求时优先需求匹配，其次补足历史订单
   */
  recommendProducts(customer, filterText, currentUser, demandText) {
    let rows = [];
    const kind = DemoData.planCustomerKind(customer, currentUser);
    const demand =
      demandText != null && String(demandText).trim() ? String(demandText).trim() : '';
    const minScore = DemoData.PLAN_MATCH_MIN_SCORE;

    if (kind === 'old') {
      const historyRows = DemoData.oldCustomerHistoryProducts(customer, 10);
      if (!demand) {
        rows = historyRows;
      } else {
        const seen = new Set();
        DemoData.products
          .map(function (p) {
            return {
              product: p,
              score: DemoData.planMatchScoreForProduct(demand, p),
              tag: '需求匹配'
            };
          })
          .filter(function (r) {
            return r.score >= minScore;
          })
          .sort(function (a, b) {
            return b.score - a.score;
          })
          .forEach(function (r) {
            if (rows.length >= 10 || seen.has(r.product.id)) return;
            seen.add(r.product.id);
            rows.push(r);
          });
        historyRows.forEach(function (r) {
          if (rows.length >= 10 || seen.has(r.product.id)) return;
          seen.add(r.product.id);
          rows.push(r);
        });
      }
    } else {
      if (!demand) {
        rows = [];
      } else {
        const pool = DemoData.newCustomerProductPool(customer);
        rows = pool
          .map(function (p) {
            return {
              product: p,
              score: DemoData.planMatchScoreForProduct(demand, p),
              tag: '需求匹配'
            };
          })
          .filter(function (r) {
            return r.score >= minScore;
          })
          .sort(function (a, b) {
            return b.score - a.score;
          })
          .slice(0, 10);
      }
    }

    if (filterText && filterText.trim()) {
      const f = filterText.trim().toLowerCase();
      rows = rows.filter(function (r) {
        return DemoData.productPassesPlanFilter(r.product, f);
      });
    }

    return rows;
  },

  productPassesPlanFilter(product, filterText) {
    const f = (filterText || '').trim().toLowerCase();
    if (!f) return true;
    return DemoData.productMatchTexts(product).some(function (text) {
      return String(text).toLowerCase().indexOf(f) >= 0;
    });
  },

  /**
   * 方案选品 · 更多产品（排除推荐区已展示品项）
   * - 老客户：全库余量；筛选词匹配；按品名排序
   * - 新客户：产品全库、排除推荐区已展示；按匹配分降序（含弱匹配）
   */
  planMoreProducts(customer, recIds, filterText, currentUser, demandText) {
    const exclude = recIds instanceof Set ? recIds : new Set(recIds || []);
    const f = (filterText || '').trim();
    const kind = customer ? DemoData.planCustomerKind(customer, currentUser) : 'new';

    if (customer && kind === 'new') {
      const demand =
        demandText != null && String(demandText).trim() ? String(demandText).trim() : '';
      if (!demand) return [];
      return DemoData.newCustomerProductPool(customer)
        .filter((p) => !exclude.has(p.id))
        .map((p) => ({
          product: p,
          score: DemoData.planMatchScoreForProduct(demand, p)
        }))
        .filter((r) => (f ? DemoData.productPassesPlanFilter(r.product, f) : true))
        .sort(
          (a, b) =>
            b.score - a.score ||
            a.product.name.localeCompare(b.product.name, 'zh-CN')
        )
        .map((r) => r.product);
    }

    return DemoData.products
      .filter((p) => !exclude.has(p.id) && DemoData.productPassesPlanFilter(p, f))
      .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
  },

  /** 品名/描述关键词是否出现在需求句中 */
  productMentionedInText(product, text) {
    const t = (text || '').toLowerCase();
    if (!t) return false;
    const keys = [product.name];
    (product.name.match(/[\u4e00-\u9fa5a-zA-Z0-9]{2,}/g) || []).forEach((k) => keys.push(k));
    return keys.some((k) => k.length >= 2 && t.indexOf(k.toLowerCase()) >= 0);
  },

  /** 从需求句解析某产品数量（支持「各 N 台」「品名…10台」） */
  parseProductQtyFromText(text, product) {
    const t = text || '';
    const eachM = t.match(/各\s*(\d+)\s*(?:台|套|个|件|只|条)?/);
    const eachQty = eachM ? parseInt(eachM[1], 10) : null;
    const parts = [product.name].concat(product.name.match(/[\u4e00-\u9fa5a-zA-Z0-9]{2,}/g) || []);
    for (let i = 0; i < parts.length; i++) {
      const key = parts[i];
      if (!key || key.length < 2) continue;
      const esc = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re1 = new RegExp(esc + '[^\\d]{0,16}(\\d+)\\s*(?:台|套|个|件|只|条)?', 'i');
      const m1 = t.match(re1);
      if (m1) return parseInt(m1[1], 10) || 1;
      const re2 = new RegExp('(\\d+)\\s*(?:台|套|个|件|只|条)?[^\\d]{0,12}' + esc, 'i');
      const m2 = t.match(re2);
      if (m2) return parseInt(m2[1], 10) || 1;
    }
    if (eachQty != null && DemoData.productMentionedInText(product, t)) return eachQty;
    return 1;
  },

  /** 搜索归一化：小写、去空白与常见分隔符，便于模糊比对 */
  normalizeSearchText(s) {
    return String(s || '')
      .toLowerCase()
      .replace(/\s+/g, '')
      .replace(/[（）()·\-—_,，。.、／/]/g, '');
  },

  /** 客户抽屉可检索字段 */
  customerSearchFields(c) {
    if (!c) return [];
    return [c.name, c.code, c.settlementCustomer, c.category].filter(Boolean);
  },

  /**
   * 模糊得分：连续子串优先；否则 query 字符按序出现在 target 中（IDE 式子序列）
   * @returns {number} 无匹配 -1
   */
  searchTextScore(query, target) {
    const q = DemoData.normalizeSearchText(query);
    const t = DemoData.normalizeSearchText(target);
    if (!q) return 0;
    if (!t) return -1;
    const idx = t.indexOf(q);
    if (idx >= 0) return 2000 - idx - (t.length - q.length) * 0.2;
    if (q.length < 2) return -1;
    let qi = 0;
    let gaps = 0;
    let last = -1;
    for (let ti = 0; ti < t.length && qi < q.length; ti++) {
      if (t[ti] === q[qi]) {
        if (last >= 0) gaps += ti - last - 1;
        last = ti;
        qi++;
      }
    }
    if (qi < q.length) return -1;
    return 800 - gaps * 4 - (t.length - q.length);
  },

  customerMatchesQuery(c, query) {
    const q = (query || '').trim();
    if (!q) return true;
    return DemoData.customerSearchFields(c).some((f) => DemoData.searchTextScore(q, f) >= 0);
  },

  customerSearchScore(c, query) {
    const q = (query || '').trim();
    if (!q) return 0;
    let best = -1;
    DemoData.customerSearchFields(c).forEach((f) => {
      const s = DemoData.searchTextScore(q, f);
      if (s > best) best = s;
    });
    return best;
  },

  /** 模糊匹配全部命中客户（得分≥0），按匹配分降序 */
  findCustomersByQuery(query, customers) {
    const q = (query || '').trim();
    if (!q || !customers || !customers.length) return [];
    const hits = [];
    customers.forEach(function (c) {
      const s = DemoData.customerSearchScore(c, q);
      if (s >= 0) hits.push({ customer: c, score: s });
    });
    hits.sort(function (a, b) {
      return b.score - a.score;
    });
    return hits.map(function (h) {
      return h.customer;
    });
  },

  /** 在当前企业客户列表中按模糊查询取最佳一条（话术/语音解析共用） */
  findCustomerByQuery(query, customers) {
    const hits = DemoData.findCustomersByQuery(query, customers);
    return hits.length ? hits[0] : null;
  },

  /**
   * 话术选客：唯一命中直接切换；多家命中待用户从抽屉确认
   * @returns {{ status: 'unique', customer, demandText } | { status: 'ambiguous', query, matches, demandText } | { status: 'none' }}
   */
  resolveCustomerUtterance(text, customers) {
    const t = (text || '').trim();
    if (!t || !customers || !customers.length) return { status: 'none' };
    const demandText = t;
    const sorted = customers
      .slice()
      .sort(function (a, b) {
        return (b.name || '').length - (a.name || '').length;
      });
    let i;
    for (i = 0; i < sorted.length; i++) {
      const c = sorted[i];
      if (c.name && t.indexOf(c.name) >= 0) {
        return { status: 'unique', customer: c, demandText: demandText };
      }
    }
    const patterns = [
      /给\s*([^，,。.；;！!？?\n]+?)(?:配|做方案|方案速配)/,
      /给\s*([^，,。.；;！!？?\n]+?)(?:(?:按)?方案)?(?:报价|报(?:个)?价)/,
      /给\s*([^，,。.；;！!？?\n]+?)(?:下(?:单)?|下单)/
    ];
    for (i = 0; i < patterns.length; i++) {
      const m = t.match(patterns[i]);
      if (!m || !m[1]) continue;
      const part = m[1].trim();
      const exact = sorted.find(function (c) {
        return c.name === part;
      });
      if (exact) return { status: 'unique', customer: exact, demandText: demandText };
      const hits = DemoData.findCustomersByQuery(part, customers);
      if (hits.length === 1) {
        return { status: 'unique', customer: hits[0], demandText: demandText };
      }
      if (hits.length > 1) {
        return {
          status: 'ambiguous',
          query: part,
          matches: hits,
          demandText: demandText
        };
      }
    }
    const hitsAll = DemoData.findCustomersByQuery(t, customers);
    if (hitsAll.length === 1) {
      return { status: 'unique', customer: hitsAll[0], demandText: demandText };
    }
    if (hitsAll.length > 1) {
      return { status: 'ambiguous', query: t, matches: hitsAll, demandText: demandText };
    }
    return { status: 'none' };
  },

  /**
   * 从整句解析客户 + 保留原需求（选客户引导后粘贴示例用）
   * @param {string} text
   * @param {Array} customers 可见客户列表（与选客户抽屉一致）
   */
  tryParseCustomerDemandUtterance(text, customers) {
    const r = DemoData.resolveCustomerUtterance(text, customers);
    if (r.status === 'unique') {
      return { customer: r.customer, demandText: r.demandText };
    }
    if (r.status === 'ambiguous') {
      return {
        ambiguous: true,
        query: r.query,
        matches: r.matches,
        demandText: r.demandText
      };
    }
    return null;
  },

  /** 从需求句解析行单价（「伺服电机 报价 4200」「…10台单价2100」「下单…配…单价2100」） */
  parseLinePriceFromText(text, product) {
    const t = text || '';
    if (DemoData.productMentionedInText(product, t)) {
      const labeled = t.match(/(?:单价|价格|报价|填价)\s*(\d+(?:\.\d+)?)/);
      if (labeled) return parseFloat(labeled[1]);
    }
    const parts = [product.name].concat(product.name.match(/[\u4e00-\u9fa5a-zA-Z0-9]{2,}/g) || []);
    for (let i = 0; i < parts.length; i++) {
      const key = parts[i];
      if (!key || key.length < 2) continue;
      const esc = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(
        esc + '[^\\d]{0,20}(?:报价|单价|价格|填价)?\\s*(\\d+(?:\\.\\d+)?)',
        'i'
      );
      const m = t.match(re);
      if (m) return parseFloat(m[1]);
    }
    return null;
  },

  /** 折扣：九折 / 95折 / 折扣15 → 乘数 */
  parseDiscountRate(text) {
    const t = text || '';
    const cn = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
    const zm = t.match(/(?:打)?\s*([一二三四五六七八九十\d]{1,3})\s*折/);
    if (zm) {
      let n = cn[zm[1]] != null ? cn[zm[1]] : parseInt(zm[1], 10);
      if (!isNaN(n) && n > 0 && n <= 10) return n / 10;
      if (!isNaN(n) && n > 10 && n <= 100) return n / 100;
    }
    const dm = t.match(/折扣\s*(\d+(?:\.\d+)?)\s*(?:%|％)?/);
    if (dm) {
      const d = parseFloat(dm[1]);
      if (d >= 0 && d <= 30) return 1 - d / 100;
    }
    return 1;
  },

  /**
   * 一句话需求 → 产品列表（含建议数量）；无强匹配时回退 recommendProducts。
   */
  matchProductsFromDemandText(customer, demandText) {
    const t = (demandText || '').trim();
    if (!t) return [];
    if (customer && DemoData.isNewCustomer(customer) && !t) return [];
    const pool =
      customer && DemoData.isNewCustomer(customer)
        ? DemoData.newCustomerProductPool(customer)
        : DemoData.products;
    let rows = pool
      .map((p) => ({
        product: p,
        score: DemoData.planMatchScoreForProduct(t, p),
        qty: DemoData.parseProductQtyFromText(t, p)
      }))
      .filter((r) => r.score >= DemoData.PLAN_MATCH_MIN_SCORE)
      .sort((a, b) => b.score - a.score);

    if (!rows.length && customer) {
      rows = DemoData.recommendProducts(customer, t, undefined, t)
        .slice(0, 4)
        .map((r) => ({
          product: r.product,
          score: r.score != null ? r.score : 0.65,
          qty: DemoData.parseProductQtyFromText(t, r.product) || 1
        }));
    }
    return rows.slice(0, 6);
  },

  defaultSkuId(product) {
    return product.skus && product.skus[0] ? product.skus[0].id : product.id + '-s1';
  },

  skuLabel(product, skuId) {
    const sk = (product.skus || []).find((s) => s.id === skuId);
    return sk ? sk.label : '默认';
  },

  settlementMethodOptions: ['月结 30 天', '月结 60 天', '预付 100%', '货到付款'],
  settlementCurrencyOptions: ['CNY（人民币）', 'USD（美元）', 'EUR（欧元）'],

  /** 下单确认页 · 表头默认值（结算信息取自客户主档，发货日默认 +14 天） */
  defaultOrderHeader(customer) {
    const c = customer || {};
    const ship = new Date();
    ship.setDate(ship.getDate() + 14);
    return {
      settlementCustomer: c.settlementCustomer || c.name || '',
      settlementMethod: c.settlementMethod || DemoData.settlementMethodOptions[0],
      settlementCurrency: c.settlementCurrency || DemoData.settlementCurrencyOptions[0],
      shipDate: ship.toISOString().slice(0, 10)
    };
  },

  /** 逐项报价 · 工艺版本候选项（当前 SKU 各版本 + 产品默认） */
  processVersionOptions(product, skuId) {
    if (!product) return ['标准版'];
    const set = new Set();
    (product.skus || []).forEach(function (s) {
      if (s.processVersion) set.add(s.processVersion);
    });
    if (product.defaultProcessVersion) set.add(product.defaultProcessVersion);
    const cur = DemoData.lineCommercialFields(product, skuId).processVersion;
    if (cur) set.add(cur);
    set.add('标准版');
    return Array.from(set);
  },

  /** 明细行 · 工艺版本与税率（演示取自 SKU / 产品主档） */
  lineCommercialFields(product, skuId) {
    if (!product) return { processVersion: '—', taxRate: 13 };
    const sk = (product.skus || []).find(function (s) {
      return s.id === skuId;
    });
    return {
      processVersion: (sk && sk.processVersion) || product.defaultProcessVersion || '标准版',
      taxRate: product.defaultTaxRate != null ? product.defaultTaxRate : 13
    };
  },

  /** 报价参考价：最新售价、最低售价（演示；正式对接价目表） */
  priceHints(product, skuId) {
    if (!product) return { latestPrice: 0, minPrice: 0 };
    const sk = (product.skus || []).find((s) => s.id === skuId);
    const base = product.unitPrice || 0;
    const latest = (sk && sk.latestPrice != null) ? sk.latestPrice : (product.latestPrice != null ? product.latestPrice : base);
    const min = (sk && sk.minPrice != null) ? sk.minPrice : (product.minPrice != null ? product.minPrice : Math.round(latest * 0.88));
    return { latestPrice: latest, minPrice: min };
  },

  /** 由选品上下文生成订单行（报价后待提交订单用） */
  buildOrderLines(selection) {
    const ids = Object.keys(selection.selected || {}).filter((k) => selection.selected[k]);
    return ids.map((pid) => {
      const p = DemoData.products.find((x) => x.id === pid);
      if (!p) return null;
      const skuId = selection.sku[pid] || DemoData.defaultSkuId(p);
      const qty = selection.qty[pid] || 1;
      return {
        productId: pid,
        inventoryCode: p.inventoryCode || pid.toUpperCase(),
        inventoryName: p.name,
        inventorySpec: p.spec,
        skuLabel: DemoData.skuLabel(p, skuId),
        salesUnit: p.salesUnit || '件',
        qty,
        unitPrice: p.unitPrice,
        sub: p.unitPrice * qty
      };
    }).filter(Boolean);
  }
};
