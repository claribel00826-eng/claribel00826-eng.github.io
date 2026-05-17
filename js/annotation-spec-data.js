/** 与 annotation-docs/01-首页与待跟进.md 一一对应 */
window.AnnotationSpecData = {
  'chat-bubble-user': {
    name: '用户消息气泡',
    module: '2.3',
    content: ['右对齐用户话术气泡'],
    query: [],
    interaction: ['展示用户发送的文字（含模拟发送）']
  },
  'card-template-followup': {
    name: '模板消息卡（待跟进）',
    module: '3.4',
    content: [
      '【标题】今日待跟进提醒',
      '【正文】您有 {N} 家企业待跟进，请及时跟进。（N 为待跟进企业数量，页面加载时动态填入）',
      '展示位置：微信会话气泡内（不在 H5 消息流中重复展示）'
    ],
    query: [
      '模板字段映射：标题、正文、按钮文案来自服务号模板配置',
      'N：今日待跟进查询 → 待跟进企业数量（与摘要卡、列表卡一致）'
    ],
    interaction: [
      '【推送时机】每工作日 09:00 自动推送（正式环境按企业配置）；推送名单受客户「提醒日期」过滤（见 data-rules-followup）',
      '【微信侧】用户在微信服务号会话中看到模板消息（样式由微信模板定义）',
      '【点击「查看待跟进列表」】进入对话页 → 写入/刷新首屏 → 模拟发送「今日待跟进」→ 约 300ms 后回复待跟进列表卡'
    ]
  },
  'chat-header': {
    name: '顶栏',
    module: '2.1',
    content: ['标题：「销售助手 · Pro」（仅智能体名，不含企业切换）'],
    query: [],
    interaction: []
  },
  'chat-context-bar': {
    name: '顶栏状态区',
    module: '2.2',
    content: ['固定展示：当前功能、当前客户（只读）'],
    query: ['当前功能来自 activeSkill；当前客户来自 customerId'],
    interaction: [
      '只读展示当前功能与客户；不在此条点击选客户',
      '选客户通过对话引导卡或待跟进/最近访问完成'
    ]
  },
  'chat-current-skill': {
    name: '当前功能',
    module: '2.2',
    content: ['展示底部 Skill 或欢迎区功能格激活的能力名称；未激活显示「—」'],
    query: [],
    interaction: []
  },
  'chat-current-customer': {
    name: '当前客户',
    module: '2.2',
    content: [
      '未选显示「未选择」；已选显示客户全称（可截断）',
      '已选时展示：客户性质 + 新/老客户徽标',
      '顶栏只读，不可点击切换'
    ],
    query: [
      '来往单位主数据',
      '新/老客户徽标判定规则见待跟进摘要卡展开后的「新客户/老客户待跟进查询」'
    ],
    interaction: [
      '只读；待跟进/最近访问选企业后更新',
      '选客户走对话引导卡，不点顶栏'
    ]
  },
  'card-customer-prompt': {
    name: '选客户引导卡',
    module: '2.3',
    content: [
      '说明需先确定客户；提示可直接说出客户名称或点按钮',
      '内嵌主按钮「选择客户」'
    ],
    query: [],
    interaction: [
      '可说客户名匹配，或点「选择客户」开列表（不自动弹窗）',
      '成功后切换客户并继续原功能'
    ]
  },
  'btn-clear-customer-chat': {
    name: '清空记录按钮',
    module: '2.2',
    content: ['文案「清空记录」；位于顶栏右侧'],
    query: [],
    interaction: [
      '未选择客户时按钮 disabled，不可点击',
      '已选客户：二次确认 → 清空消息区全部内容（欢迎区、待跟进摘要、最近访问、用户气泡、业务卡片、系统提示）',
      '同步清空当前企业在 localStorage 的会话缓存；不自动重新插入首屏（次日首次进入再发每日首屏）'
    ]
  },
  'chat-messages': {
    name: '对话框 · 消息区（整体）',
    module: '2.3',
    content: [
      '整块可滚动对话区（.sc-chat-dialog），内含 #messages 消息列表',
      '承载欢迎区、待跟进摘要、最近访问、用户气泡、业务卡片、系统提示（不含左侧微信模板消息）',
      '子模块（欢迎区、各业务卡片等）另有独立「标注」钉；本钉说明消息区整体规则'
    ],
    query: [],
    interaction: [
      '纵向滚动；新消息滚到底部',
      '【每日首次进入】每个自然日、每个用户第一次打开对话页：在消息区发送欢迎区 + 待跟进摘要 + 最近访问（有历史则向上滚动可查看）',
      '【刷新页面】同日再次进入：从服务器恢复完整消息流（含当日已发的每日首屏）；单用户单企业最多 200 条',
      '【无历史且非每日首次】写入首屏三块（与每日首屏内容相同）',
      '【每条新消息后】自动保存当前企业会话'
    ]
  },
  'chat-skill-bar': {
    name: '技能横滑条',
    module: '2.3',
    content: ['底部技能入口'],
    query: [],
    interaction: ['横滑切换技能；选中后触发对应功能槽']
  },
  'chat-input-bar': {
    name: '输入区',
    module: '2.3',
    content: [
      '语音按住说话 / 键盘输入；发送后进入意图分配',
      '写跟进支持语音：如「写跟进」「给××写跟进」'
    ],
    query: [],
    interaction: ['语音：松开后转文字再路由；键盘：发送后路由']
  },
  'chat-llm': {
    name: '意图分配与填槽',
    module: '5.1',
    content: [
      '用户输入 → 意图识别填全局槽 → 按功能路由跳转',
      '写跟进：全局槽齐备后开抽屉，再填表单槽并提交'
    ],
    query: [],
    interaction: [
      '① 意图阶段：填全局槽（功能 / 客户 / 产品）',
      '② 写跟进：开抽屉后填表单槽（联系人等），校验见槽位总表',
      '功能命中与缺槽处理见「功能路由」表'
    ],
    extraHtml:
      '<p class="sc-spec-panel__sub">本期槽位分两层：<strong>全局·意图</strong>（所有输入都要认功能）与 <strong>写跟进·表单</strong>（仅写跟进抽屉）。统一见下表。</p>' +
      '<p class="sc-spec-panel__label">槽位总表</p>' +
      '<div class="sc-spec-table-wrap"><table class="sc-spec-table sc-spec-table--slots">' +
      '<thead><tr><th>层级</th><th>槽位</th><th>必填</th><th>适用</th><th>来源 / 默认</th><th>未填 / 缺槽</th></tr></thead><tbody>' +
      '<tr class="sc-spec-table__layer-global"><td>全局·意图</td><td>功能</td><td>是</td><td>全部输入</td><td>话术、语音、欢迎功能格、底部技能条</td><td>未命中 → 兜底</td></tr>' +
      '<tr class="sc-spec-table__layer-global"><td>全局·意图</td><td>客户</td><td>条件</td><td>写跟进等需客户功能</td><td>顶栏、列表点选、话里名称、引导卡补选</td><td>无客户 → 引导补选，不开抽屉</td></tr>' +
      '<tr class="sc-spec-table__layer-global"><td>全局·意图</td><td>产品</td><td>否</td><td>本期预留</td><td>—</td><td>—</td></tr>' +
      '<tr class="sc-spec-table__layer-form"><td>写跟进·表单</td><td>联系人</td><td>是</td><td>写跟进</td><td>客户主数据 contactName</td><td>toast：请填写联系人和联系方式</td></tr>' +
      '<tr class="sc-spec-table__layer-form"><td>写跟进·表单</td><td>联系方式</td><td>是</td><td>写跟进</td><td>客户主数据 contactPhone</td><td>同上</td></tr>' +
      '<tr class="sc-spec-table__layer-form"><td>写跟进·表单</td><td>发货地址</td><td>否</td><td>写跟进</td><td>客户主数据 shipAddress</td><td>—</td></tr>' +
      '<tr class="sc-spec-table__layer-form"><td>写跟进·表单</td><td>跟进信息</td><td>是</td><td>写跟进</td><td>默认空；语音/话术可预填（「写跟进」后正文或逗号后内容）</td><td>toast：请填写跟进信息</td></tr>' +
      '<tr class="sc-spec-table__layer-form"><td>写跟进·表单</td><td>跟进时间</td><td>是</td><td>写跟进</td><td>默认当前时间</td><td>toast：请选择跟进时间</td></tr>' +
      '<tr class="sc-spec-table__layer-form"><td>写跟进·表单</td><td>跟进状态</td><td>是</td><td>写跟进</td><td>默认「跟进中」；话术含完成类词 →「跟进完成」</td><td>—</td></tr>' +
      '<tr class="sc-spec-table__layer-form"><td>写跟进·表单</td><td>提醒日期</td><td>否</td><td>写跟进</td><td>客户已存提醒日期或空；空=每日推送</td><td>—</td></tr>' +
      '</tbody></table></div>' +
      '<p class="sc-spec-panel__sub">表单「跟进中/完成」≠ 待跟进列表里的「待跟进」判定。</p>' +
      '<p class="sc-spec-panel__label">功能路由</p>' +
      '<div class="sc-spec-table-wrap"><table class="sc-spec-table sc-spec-table--route">' +
      '<thead><tr><th>功能</th><th>全局·客户</th><th>填槽阶段</th><th>跳转</th></tr></thead><tbody>' +
      '<tr><td>待跟进</td><td>不要求</td><td>仅全局·功能</td><td>待跟进列表卡</td></tr>' +
      '<tr><td>写跟进</td><td>必填</td><td>全局 → 表单槽</td><td>写跟进抽屉</td></tr>' +
      '<tr><td>切换客户</td><td>不要求</td><td>仅全局·功能</td><td>选客户引导 / 列表</td></tr>' +
      '<tr><td>帮助</td><td>不要求</td><td>仅全局·功能</td><td>说明文案</td></tr>' +
      '<tr><td>兜底</td><td>不要求</td><td>意图未命中</td><td>引导文案</td></tr>' +
      '</tbody></table></div>' +
      '<p class="sc-spec-panel__label">话术示例</p>' +
      '<div class="sc-spec-table-wrap"><table class="sc-spec-table">' +
      '<thead><tr><th>功能</th><th>示例</th></tr></thead><tbody>' +
      '<tr><td>待跟进</td><td>今日待跟进</td></tr>' +
      '<tr><td>写跟进</td><td>写跟进；给华东精密机械写跟进，已拜访确认需求</td></tr>' +
      '<tr><td>切换客户</td><td>切换客户</td></tr>' +
      '<tr><td>帮助</td><td>帮助</td></tr>' +
      '</tbody></table></div>'
  },
  'chat-welcome': {
    name: '欢迎区',
    module: '3.1',
    content: [
      '主文案：问候 + 引导使用下方功能格或底部技能栏',
      '功能格见 chat-welcome-features'
    ],
    query: ['静态文案；功能项来自 welcomeFeatures 配置'],
    interaction: ['首屏第一条智能助手气泡；功能点击见 chat-welcome-features']
  },
  'chat-welcome-features': {
    name: '欢迎区 · 功能格',
    module: '3.1',
    content: [
      '6 列 × 2 行共 12 个功能按钮',
      '第一行（原 8 能力，均四字）：今日待跟、方案速配、产品报价、交期评审、确认下单、复制订单、订单变更、订单进度',
      '第二行（分析四字）：产能分析、库存查询、业务分析、回款分析'
    ],
    query: ['配置项 DemoData.welcomeFeatures（id + 短标签）'],
    interaction: [
      '点击 = 发对应话术并进入该功能（同底部技能条）',
      '首屏展示，写入会话可刷新后仍点'
    ]
  },
  'card-followup-summary': {
    name: '待跟进摘要卡',
    module: '3.2',
    content: [
      '标题「今日待跟进」；展示待跟进企业数量（如「3 家企业」）；引导「点击查看列表」'
    ],
    query: [
      '今日待跟进查询接口；与欢迎初始化同批拉取',
      '切换企业后按新企业重算'
    ],
    interaction: [
      '点击摘要 → 用户消息「今日待跟进」→ 约 300ms 后回复待跟进列表卡',
      '数量为 0 时显示「0 家企业」，可点击，列表为空'
    ],
    dataRules: true
  },
  'card-followup-list': {
    name: '待跟进列表卡',
    module: '4.1',
    content: [
      '标题「今日待跟进 · X 家」（X 为待跟进企业数量）；行：企业名称 + 新/老客户徽标；无页签'
    ],
    query: ['与待跟进摘要卡共用同一接口数据'],
    interaction: [
      '话术/技能/意图「待跟进」时追加列表卡（可多次）',
      '点击行 → 切换当前客户 → 详情卡 + 下一步引导卡'
    ],
    dataRules: true
  },
  'chat-recent': {
    name: '最近访问',
    module: '3.3',
    content: [
      '标题「最近访问」；每项展示客户名称 + 访问的功能名称 + 访问时间标签',
      '当前企业下最多 3 条'
    ],
    query: ['最近访问记录接口；含客户标识、功能标识、访问时间；当前企业下按时间倒序取前三'],
    interaction: [
      '点击某项 → 切换当前客户 → 底部对应 Skill 高亮',
      '模拟发送功能话术 → 系统提示（变更时）→ 执行该功能',
      '功能为「待跟进」时：约 300ms 后回复企业详情卡 + 下一步引导卡（与待跟进列表选行一致，不出列表卡）'
    ]
  },
  'card-customer-detail': {
    name: '企业详情卡',
    module: '4.2',
    content: [
      '标题「企业详情」+ 新/老客户徽标',
      '字段：编码、名称、性质、客户性质、结算客户、客户等级、联系人地址'
    ],
    query: ['按客户标识取主数据/详情接口'],
    interaction: ['从列表或最近访问选企业后追加；只读']
  },
  'card-next-step': {
    name: '下一步引导卡',
    module: '4.3',
    content: ['标题「接下来您想做什么？」；按钮：写跟进 | 做方案 | 稍后再说'],
    query: [],
    interaction: [
      '写跟进 → 写跟进抽屉；做方案 → 方案速配；稍后再说 → 固定回复'
    ]
  },
  'sheet-followup': {
    name: '写跟进抽屉',
    module: '4.4',
    content: [
      '表单字段：联系人*、联系方式*、发货地址、跟进信息*、跟进时间*、跟进状态、提醒日期（选填）',
      '提醒日期：未设置则每个工作日推送待跟进；已设置则自该日期起纳入推送',
      '槽位定义见底部「意图」标注 · 槽位总表（写跟进·表单 层级）'
    ],
    query: [
      '提交：客户 id、企业、跟进人 + 表单各字段（含提醒日期）',
      '提醒日期写入客户主数据，用于待跟进推送筛选',
      '联系人/电话/地址：往来单位主数据；跟进内容为本次录入'
    ],
    interaction: [
      '前置：意图阶段已填全局槽（功能=写跟进、客户已定）',
      '开抽屉：主数据带入联系人等；语音/话术可预填跟进信息与状态',
      '提交校验：联系人+联系方式、跟进信息、跟进时间必填',
      '提醒日期选填：提交后写入客户；影响后续待跟进推送节奏',
      '成功 → 关闭抽屉 + 确认气泡'
    ]
  },
  'sheet-customer': {
    name: '切换客户弹窗',
    module: '2.2',
    content: [
      'Tab：客户 | 供应商 | 供应商/客户（切换筛选列表）',
      '名称/编码搜索；列表选往来单位'
    ],
    query: ['来往单位主数据；按往来单位类型 Tab 与关键字筛选'],
    interaction: ['选中 → 系统提示 → 刷新当前客户条；不自动出详情卡']
  },
  'sheet-enterprise': {
    name: '切换企业抽屉',
    module: '2.1',
    content: ['企业列表选择'],
    query: ['企业列表，按权限过滤'],
    interaction: ['选中 → 系统提示切换企业；必要时清空当前客户']
  },
  'sheet-delivery': {
    name: '交期评审抽屉',
    module: '03',
    content: ['交期评审表单（演示）'],
    query: ['须已有报价（业务前置）'],
    interaction: ['见文档 03 · 技能「交期」']
  },
  'sheet-order': {
    name: '下单确认抽屉',
    module: '03',
    content: ['订单确认（演示）'],
    query: ['须已有报价'],
    interaction: ['见文档 03 · 技能「下单」']
  },
  'sheet-change': {
    name: '订单变更抽屉',
    module: '03',
    content: ['变更申请（演示）'],
    query: ['该客户订单数据'],
    interaction: ['见文档 03']
  },
  'sheet-service': {
    name: '客户服务抽屉',
    module: '03',
    content: ['客服工单（演示）'],
    query: ['该客户工单'],
    interaction: ['见文档 03']
  },
  'sheet-quote': {
    name: '报价抽屉',
    module: '03',
    content: ['报价单编辑（演示）'],
    query: ['须已有方案且客户一致'],
    interaction: ['见文档 03 · 技能「报价」']
  },
  'modal-pdf': {
    name: 'PDF 预览层',
    module: '03',
    content: ['全屏 PDF 预览演示'],
    query: [],
    interaction: ['返回按钮关闭']
  },
  'card-scheme': {
    name: '方案选品卡',
    module: '03',
    content: ['方案速配结果卡片'],
    query: ['商品与数量'],
    interaction: ['见文档 03 · 技能「方案速配」']
  },
  'card-quote': {
    name: '报价单卡',
    module: '03',
    content: ['报价单摘要'],
    query: [],
    interaction: ['见文档 03']
  },
  'card-delivery': {
    name: '交期评审卡',
    module: '03',
    content: ['交期评审状态'],
    query: [],
    interaction: ['见文档 03']
  },
  'card-insight-capacity': {
    name: '产能分析卡',
    module: '2.3',
    content: ['产线负荷、可承诺日产能、瓶颈工序、建议'],
    query: ['演示数据；正式环境对接产能/ MES'],
    interaction: ['欢迎区「产能分析」或话术触发；须已选客户']
  },
  'card-insight-inventory': {
    name: '库存查询卡',
    module: '2.3',
    content: ['SKU 现货/在途、齐套率'],
    query: ['演示数据；正式环境对接库存'],
    interaction: ['欢迎区「库存查询」或话术触发；须已选客户']
  },
  'card-insight-biz': {
    name: '业务分析卡',
    module: '2.3',
    content: ['销售额、同比、订单频次、主力品类、客户等级'],
    query: ['演示数据；正式环境对接经营分析'],
    interaction: ['欢迎区「业务分析」或话术触发；须已选客户']
  },
  'card-insight-payment': {
    name: '回款分析卡',
    module: '2.3',
    content: ['应收、逾期、本月回款、最近回款日、信用建议'],
    query: ['演示数据；正式环境对接应收'],
    interaction: ['欢迎区「回款分析」或话术触发；须已选客户']
  },
  'data-rules-followup': {
    name: '新客户 / 老客户待跟进查询',
    module: '6',
    content: [],
    query: [
      '【老客户待跟进】须同时满足：① 分管人员 = 当前登录用户；② 超时未下单：当前日期 − 订单最近有效日期 > 往来单位「销售提醒天数」（基准日期以企业主数据配置为准；无订单日期是否视为超时由企业主数据约定）',
      '【新客户待跟进】须同时满足：① 分管人员为空；② 当前客户跟进状态=待跟进',
      '【筛选条件】客户未设置提醒日期 → 每个工作日 09:00 纳入待跟进推送；已设置提醒日期 → 仅当当前日期 ≥ 提醒日期时纳入推送（此前不推送）',
      '【合并】今日待跟进企业列表 = 老客户待跟进 ∪ 新客户待跟进；待跟进企业数量 = 列表企业数；每家仅属一类',
      '【排序】最近更新时间倒序（往来单位或跟进记录的最后更新时间，以接口字段为准）；同时间可按单位名称升序',
      '【条数】一次返回列表全量；摘要卡数量与列表卡行数一致，首屏不截断（若企业配置单次上限，列表分页由接口约定）',
    ],
    interaction: []
  }
};
