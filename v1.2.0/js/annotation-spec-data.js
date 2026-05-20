/** 本版标注数据：文档 02、03（面板文案均为中文，不含英文） */
window.AnnotationSpecData = {
  'chat-messages': {
    name: '对话框 · 消息区',
    module: '03',
    content: [
      '可滚动对话区，承载用户气泡、助手业务卡片、系统提示',
      '上一版的首页欢迎、待跟进摘要等规则不在本版标注范围内'
    ],
    query: [],
    interaction: [
      '用户每发一条新消息后，上一步助手消息内的操作按钮失效；首屏三块内容合为一条助手消息（详见「对话流 · 历史按钮失效」）'
    ]
  },
  'chat-llm': {
    name: '意图 · 槽位路由',
    module: '05',
    content: [
      '填充数据 = 仅表单字段名（与文档 04 一致）',
      '无表单填「—」；不写功能、报价来源、单号、卡片名',
      '主链路：方案/报价/下单；写跟进见下表「其它」'
    ],
    query: [
      '产品、产品规格分列；数量、本单报价、方案模板等见 04',
      '方案/报价/下单一句话 → 预填产品、产品规格、产品数量等',
      '写跟进归属 v1.1.0 能力，本版意图表仍列全（与代码一致）'
    ],
    interaction: [
      '按「已读到」匹配行；只预填该行所列表单字段',
      '示例见文档 05 §四'
    ],
    extraHtml:
      '<p class="sc-spec-panel__sub">仅<strong>表单字段</strong>。源稿 05。</p>' +
      '<p class="sc-spec-panel__label">方案速配</p>' +
      '<div class="sc-spec-table-wrap"><table class="sc-spec-table sc-spec-table--route">' +
      '<thead><tr><th>已读到</th><th>跳转</th><th>填充数据</th></tr></thead><tbody>' +
      '<tr><td>功能意图</td><td>选客户引导</td><td>—</td></tr>' +
      '<tr><td>+客户</td><td>选品卡</td><td>客户</td></tr>' +
      '<tr><td>+客户+需求描述</td><td>方案卡</td><td>产品、产品规格、产品数量、方案模板</td></tr>' +
      '</tbody></table></div>' +
      '<p class="sc-spec-panel__label">产品报价</p>' +
      '<div class="sc-spec-table-wrap"><table class="sc-spec-table sc-spec-table--route">' +
      '<thead><tr><th>已读到</th><th>跳转</th><th>填充数据</th></tr></thead><tbody>' +
      '<tr><td>功能意图</td><td>选客户引导</td><td>—</td></tr>' +
      '<tr><td>+客户</td><td>报价来源卡</td><td>客户</td></tr>' +
      '<tr><td>+按方案/直选一句话</td><td>报价单卡</td><td>产品、产品规格、产品数量、本单报价、报价单模板</td></tr>' +
      '</tbody></table></div>' +
      '<p class="sc-spec-panel__label">确认下单</p>' +
      '<div class="sc-spec-table-wrap"><table class="sc-spec-table sc-spec-table--route">' +
      '<thead><tr><th>已读到</th><th>跳转</th><th>填充数据</th></tr></thead><tbody>' +
      '<tr><td>功能意图</td><td>选客户引导</td><td>—</td></tr>' +
      '<tr><td>+客户</td><td>下单来源卡</td><td>客户</td></tr>' +
      '<tr><td>+按方案/直选一句话</td><td>订单确认</td><td>产品、产品规格、产品数量、本单报价</td></tr>' +
      '</tbody></table></div>' +
      '<p class="sc-spec-panel__label">写跟进 / 待跟进 / 切换客户</p>' +
      '<div class="sc-spec-table-wrap"><table class="sc-spec-table sc-spec-table--route">' +
      '<thead><tr><th>已读到</th><th>跳转</th><th>填充数据</th></tr></thead><tbody>' +
      '<tr><td>今日待跟进</td><td>待跟进列表</td><td>—</td></tr>' +
      '<tr><td>切换客户+选客户</td><td>选客户抽屉</td><td>客户</td></tr>' +
      '<tr><td>写跟进+客户</td><td>写跟进抽屉</td><td>联系人、联系方式、发货地址</td></tr>' +
      '<tr><td>写跟进+句中内容</td><td>写跟进抽屉</td><td>跟进信息、跟进状态</td></tr>' +
      '</tbody></table></div>' +
      '<p class="sc-spec-panel__sub">详细路由见文档 05；写跟进全流程字段见 v1.1.0 文档 00 §五。</p>'
  },
  'data-rules-chat-flow': {
    name: '对话流 · 历史按钮失效',
    module: '03',
    content: [
      '用户每发送一条新消息，流程步序号加一，上一步助手卡片内按钮全部失效',
      '与是否切换功能无关；同一功能连续发两条消息也会失效上一条卡片按钮',
      '首屏欢迎、待跟进摘要、最近访问合并为一条助手消息，共用同一步序号'
    ],
    query: [
      '流程步序号仅保存在当前会话，不写入数据库',
      '从数据库恢复的历史助手消息，其按钮一律视为已失效',
      '仅作用于卡片上的可点击按钮与选品行按钮'
    ],
    interaction: [
      '点击已失效按钮时轻提示：「已有新消息，请使用最新对话中的操作」',
      '失效按钮呈半透明且不可点；仅最新一步助手卡片可操作'
    ]
  },
  'card-plan-pick': {
    name: '方案选品卡',
    module: '02',
    content: [
      '【推荐区】按客户类型分路查询（见下表）；筛选词同时作用于推荐区与更多产品',
      '【更多产品】推荐区之外的关联存货；首屏 5 条，列表内下滑每页再加载 5 条',
      '支持筛选品名、规格、存货描述；每行可改规格；列表不展示单价',
      '可说「选品」「加购」「生成方案」；一句话须含选品、规格与数量（示例含客户名）'
    ],
    query: [
      '关联键：客户类型（老客户/新客户）决定推荐区数据源；新客户另用客户档案 demandHint 与存货 inventoryDesc 做文本匹配',
      '匹配算法：将需求文本按空格/标点切词（≥2 字），统计命中存货描述字段的词数占比，得 0～1 分',
      '推荐区·老客户：本客户历史订单 productIds，订单日期倒序，去重后最多 10 条；不计存货描述分',
      '推荐区·新客户：仅对存货描述字段计分（品名不参与推荐区排序），分 >0.8 取 Top10，标签展示匹配百分比',
      '更多产品·老客户：全库品项 − 推荐区已展示；须通过筛选词（品名/规格/存货描述，空则不过滤）；按品名升序',
      '更多产品·新客户：全库 − 推荐区；存货描述匹配分 ∈ (0.2, 0.8]；或有筛选词且三字段任一包含；按匹配分降序',
      '分页：ctx.plan.moreVisible 默认 5；筛选或语音「筛选」后重置为 5；哨兵进入视口 +5 直至全部加载',
      '已勾选产品、规格、数量保存在方案流程上下文中'
    ],
    interaction: [
      '点选行勾选或取消产品；可改规格与筛选',
      '「加入购物车」须至少选一项；进入购物车卡',
      '滚动至列表底部自动加载下一页产品'
    ]
  },
  'card-plan-cart': {
    name: '方案购物车',
    module: '02',
    content: ['展示已选品名、规格、数量', '确认后进入方案模板选择'],
    query: ['读取方案流程上下文中已选明细'],
    interaction: ['可改数量与规格；返回选品；「生成方案」打开模板抽屉']
  },
  'sheet-plan-template': {
    name: '方案模板抽屉',
    module: '02',
    content: ['单选一种方案模板', '方案正文不含价格'],
    query: ['模板列表来自演示主数据'],
    interaction: ['必选模板后保存，关闭抽屉并展示方案卡']
  },
  'card-scheme': {
    name: '方案卡',
    module: '02',
    content: [
      '展示方案编号、客户、模板名、行明细（品名·规格·数量，无价格）',
      '可来自分步保存，也可由一句话生成（话术含选品、规格与数量）'
    ],
    query: ['当前客户的方案明细保存在会话状态中'],
    interaction: [
      '可预览方案文件；「去报价」进入报价流程',
      '按钮受「新消息后上一步失效」规则约束'
    ]
  },
  'card-quote-source': {
    name: '报价来源卡',
    module: '02',
    content: ['按已有方案报价，或直接选品后报价', '均须逐项填写本单价格'],
    query: ['须已有本客户方案才可走「按方案报价」'],
    interaction: ['按方案：载入方案行进入逐项报价；直选：进入报价选品']
  },
  'card-quote-pick': {
    name: '报价选品卡',
    module: '02',
    content: ['推荐与筛选规则同方案选品', '下一步进入逐项报价'],
    query: ['报价选品上下文与推荐产品列表'],
    interaction: ['勾选产品、改规格后进入报价确认或逐项报价抽屉']
  },
  'card-quote-cart': {
    name: '报价选品确认',
    module: '02',
    content: [
      '每行：规格、数量、最新价与最低价参考、本单报价输入',
      '展示报价合计；直选时可勾选「保存为方案」'
    ],
    query: ['待提交的报价行明细与单价'],
    interaction: ['填完单价后进入报价单模板选择']
  },
  'sheet-quote-setup': {
    name: '逐项报价抽屉',
    module: '02',
    content: [
      '按方案、直选或下单直选载入各行：规格、数量、售价参考、本单报价',
      '低于最低价时行高亮提示',
      '若为下单流程，标题为「逐项报价（下单）」，主按钮为「生成订单」',
      '底部提供语音与键盘输入，识别结果不写进对话区'
    ],
    query: ['区分普通报价与下单填价两种模式'],
    interaction: [
      '语音或文字可改单价、数量、规格',
      '报价模式：下一步选模板 → 报价单卡',
      '下单模式：下一步进入下单确认抽屉'
    ]
  },
  'quote-setup-voice': {
    name: '逐项报价 · 语音输入',
    module: '02',
    content: ['固定在逐项报价弹窗最底部', '按住说话或切换键盘输入'],
    query: ['演示用语音话术循环播放'],
    interaction: ['仅更新表单字段，以轻提示反馈，不新增用户气泡']
  },
  'sheet-quote-template': {
    name: '报价单模板抽屉',
    module: '02',
    content: ['单选一种报价单版式'],
    query: ['模板列表来自演示主数据'],
    interaction: ['确认后生成报价单卡；可从报价单卡进入下单']
  },
  'card-quote': {
    name: '报价单卡',
    module: '02',
    content: [
      '展示报价单号、客户、模板名、含税合计金额',
      '不自动创建订单；可来自分步报价或一句话生成（话术含客户、按方案或选品、规格、数量、单价或折扣）'
    ],
    query: ['当前客户报价单保存在会话状态中'],
    interaction: [
      '可预览报价文件；「生成订单」进入下单确认',
      '按钮受流程步失效规则约束'
    ]
  },
  'card-order-source': {
    name: '下单来源卡',
    module: '02',
    content: ['可按已有报价单直接确认；直接选品须先逐项报价'],
    query: ['须本客户已有报价单才可点「按报价单」'],
    interaction: ['按报价单进入下单确认；直选进入订单选品']
  },
  'card-order-pick': {
    name: '订单选品卡',
    module: '02',
    content: ['推荐、筛选、规格、数量同报价直选', '可勾选保存为方案'],
    query: ['订单选品上下文'],
    interaction: ['「下一步：逐项报价」后进入下单确认']
  },
  'card-order-cart': {
    name: '订单购物车卡',
    module: '02',
    content: ['遗留中间步骤', '引导用户走逐项报价再下单'],
    query: ['订单选品上下文'],
    interaction: ['进入逐项报价抽屉']
  },
  'sheet-order': {
    name: '下单确认抽屉',
    module: '02',
    content: [
      '展示客户、来源摘要（报价单号与金额，或直选行数与合计）',
      '若有交期信息则一并展示（本版主链路不强制交期）'
    ],
    query: ['待提交订单明细与金额'],
    interaction: ['确认后写入演示订单数据，状态为待排产，并展示成功卡']
  },
  'card-order-success': {
    name: '订单成功卡',
    module: '02',
    content: ['展示订单号、客户、金额'],
    query: ['订单写入演示订单库'],
    interaction: ['只读展示']
  }
};
