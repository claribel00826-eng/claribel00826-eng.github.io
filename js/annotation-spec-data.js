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
      '【渠道标签】服务号消息',
      '【标题】今日待跟进提醒',
      '【正文】您有 {N} 家企业待跟进，请及时跟进。（N 为待跟进企业数量，页面加载时动态填入）',
      '【主按钮】查看待跟进列表',
      '展示位置：微信会话气泡内（不在 H5 消息流中重复展示）'
    ],
    query: [
      '模板字段映射：标题、正文、按钮文案来自服务号模板配置',
      'N：今日待跟进查询 → 待跟进企业数量（与摘要卡、列表卡一致）',
      '深链：tpl=followup，打开对话页并展示左侧微信区'
    ],
    interaction: [
      '【推送时机】每工作日 09:00 自动推送（正式环境按企业配置）',
      '【微信侧】用户在微信服务号会话中看到模板消息（样式由微信模板定义）',
      '【演示】GitHub Pages 默认展示左侧微信区；本地需 ?tpl=followup；可用 ?tpl=off 关闭',
      '【点击「查看待跟进列表」】进入对话页 → 写入/刷新首屏 → 模拟发送「今日待跟进」→ 约 300ms 后回复待跟进列表卡',
      '【等价操作】待跟进摘要卡点列表、技能条「待跟进」、话术含「今日待跟进」'
    ]
  },
  'chat-header': {
    name: '顶栏',
    module: '2.1',
    content: ['标题：「销售助手 · Pro」（仅智能体名，不含企业切换）'],
    query: [],
    interaction: []
  },
  'chat-current-customer': {
    name: '当前客户条',
    module: '2.2',
    content: [
      '未选显示「请选择客户」；已选显示企业全称（可截断）',
      '已选时展示：客户性质 + 新/老客户徽标'
    ],
    query: [
      '来往单位主数据',
      '新/老客户徽标判定规则见待跟进摘要卡展开后的「新客户/老客户待跟进查询」'
    ],
    interaction: [
      '点击客户条 → 切换客户弹窗（Tab：客户/供应商/供应商/客户，支持名称/编码搜索）',
      '选中 → 对话框系统提示 → 刷新条栏；不打开企业详情卡'
    ]
  },
  'btn-clear-customer-chat': {
    name: '清空记录按钮',
    module: '2.2',
    content: ['文案「清空记录」；位于当前客户条右侧'],
    query: [],
    interaction: [
      '二次确认 → 清空消息区全部内容（欢迎区、待跟进摘要、最近访问、用户气泡、业务卡片、系统提示）',
      '同步清空当前企业在 localStorage 的会话缓存；不自动重新插入首屏（次日首次进入再发每日首屏）'
    ]
  },
  'chat-messages': {
    name: '对话框 · 消息区（整体）',
    module: '2.3',
    content: ['承载欢迎区、待跟进摘要、最近访问、用户气泡、业务卡片、系统提示（不含微信模板消息卡）'],
    query: [],
    interaction: [
      '纵向滚动；新消息滚到底部',
      '【每日首次进入】每个自然日、每个企业第一次打开对话页：在消息区发送欢迎区 + 待跟进摘要 + 最近访问（有历史则插入顶部，无历史则作为首屏）',
      '【刷新页面】同日再次进入：从本地恢复完整消息流（含当日已发的每日首屏）；单企业最多 200 条',
      '【无历史且非每日首次】写入首屏三块（与每日首屏内容相同）',
      '【重新登录】清空会话与每日首屏标记，重新写入首屏',
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
    content: ['语音按住说话 / 键盘输入；发送后进入意图分配'],
    query: [],
    interaction: ['语音松开转文字并发送；键盘模式输入后发送']
  },
  'chat-llm': {
    name: '大模型 · 意图分配',
    module: '5.1',
    content: ['输入：文字、语音转文字、技能条点击'],
    query: [
      '大模型输出客户、功能、产品三槽位',
      '规则引擎校验必填项及业务前置条件'
    ],
    interaction: [
      '槽位含义、跳转与话术关键词见下表',
      '技能条：功能槽=技能名；客户槽=当前客户条'
    ],
    extraHtml:
      '<p class="sc-spec-panel__label">三槽位（5.1.1）</p>' +
      '<div class="sc-spec-table-wrap"><table class="sc-spec-table">' +
      '<thead><tr><th>槽位</th><th>含义</th><th>必填</th><th>补全来源</th></tr></thead><tbody>' +
      '<tr><td>客户</td><td>往来单位</td><td>视功能</td><td>当前客户条、待跟进选行、话术实体、切换客户弹窗</td></tr>' +
      '<tr><td>功能</td><td>业务意图</td><td>否</td><td>话术、技能条、模型分类</td></tr>' +
      '<tr><td>产品</td><td>商品</td><td>否</td><td>话术、选品卡、方案上下文、复制订单</td></tr>' +
      '</tbody></table></div>' +
      '<p class="sc-spec-panel__label">槽位组合 → 跳转与带入（5.1.3）</p>' +
      '<div class="sc-spec-table-wrap"><table class="sc-spec-table sc-spec-table--route">' +
      '<thead><tr><th>客户</th><th>功能</th><th>产品</th><th>跳转</th><th>带入</th></tr></thead><tbody>' +
      '<tr><td>—</td><td>待跟进</td><td>—</td><td>待跟进列表卡</td><td>今日待跟进企业列表、待跟进企业数量</td></tr>' +
      '<tr><td>—</td><td>切换客户</td><td>—</td><td>切换客户弹窗</td><td>筛选列表</td></tr>' +
      '<tr><td>—</td><td>帮助</td><td>—</td><td>文本</td><td>能力说明副文案</td></tr>' +
      '<tr><td>—</td><td>兜底</td><td>—</td><td>文本</td><td>兜底引导文案</td></tr>' +
      '<tr><td>有</td><td>写跟进</td><td>—</td><td>写跟进抽屉</td><td>联系人、电话、地址、客户标识</td></tr>' +
      '<tr><td>无</td><td>写跟进</td><td>—</td><td>文本提示</td><td>请先从待跟进选择企业</td></tr>' +
      '<tr><td>有</td><td>方案速配</td><td>无/有</td><td>选品卡/购物车</td><td>客户标识、商品及数量</td></tr>' +
      '<tr><td>无</td><td>方案速配</td><td>—</td><td>文本提示</td><td>请先选择客户</td></tr>' +
      '<tr><td>有</td><td>报价</td><td>—</td><td>报价抽屉或提示</td><td>须已有方案且客户一致</td></tr>' +
      '<tr><td>有</td><td>交期</td><td>—</td><td>交期抽屉或提示</td><td>须已有报价</td></tr>' +
      '<tr><td>有</td><td>下单</td><td>—</td><td>订单确认或提示</td><td>须已有报价；交期按产品要求</td></tr>' +
      '<tr><td>有</td><td>复制/变更/进度/客服</td><td>—</td><td>见文档 03</td><td>该客户订单或工单数据</td></tr>' +
      '<tr><td>无</td><td>上述业务</td><td>—</td><td>文本提示</td><td>请先选择客户</td></tr>' +
      '</tbody></table></div>' +
      '<p class="sc-spec-panel__label">话术关键词映射（交互 · 5.1.4）</p>' +
      '<div class="sc-spec-table-wrap"><table class="sc-spec-table">' +
      '<thead><tr><th>序</th><th>功能</th><th>关键词</th></tr></thead><tbody>' +
      '<tr><td>1</td><td>待跟进列表</td><td>待跟进、跟进哪些、今天要跟</td></tr>' +
      '<tr><td>2</td><td>写跟进</td><td>写跟进、记录跟进</td></tr>' +
      '<tr><td>3</td><td>切换客户</td><td>切换客户、换客户、选择客户、选客户</td></tr>' +
      '<tr><td>4</td><td>其他技能</td><td>见文档 03</td></tr>' +
      '<tr><td>5</td><td>帮助</td><td>帮助、能做什么</td></tr>' +
      '<tr><td>6</td><td>兜底</td><td>未命中</td></tr>' +
      '</tbody></table></div>'
  },
  'chat-welcome': {
    name: '欢迎区',
    module: '3.1',
    content: [
      '主文案：你好，我是销售助手。可点下方待跟进…',
      '副文案：支持待跟进、方案速配、报价…'
    ],
    query: ['静态文案'],
    interaction: ['首屏第一条智能助手内容；无点击']
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
      '联系人*、联系方式*、发货地址、跟进信息*、跟进时间*、跟进状态（跟进中/完成）',
      '表单「跟进状态」用于本次提交；新客户判定中的「待跟进」指历史最新一条跟进记录'
    ],
    query: ['提交跟进接口：关联客户标识、企业、跟进人及表单字段（联系人、跟进内容、跟进时间、跟进状态等）'],
    interaction: [
      '有当前客户时打开，默认带入联系人信息',
      '无当前客户时提示先从待跟进选择',
      '提交成功 → 关闭 → 用户消息 + 智能助手确认气泡',
      '× 或遮罩关闭'
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
  'data-rules-followup': {
    name: '新客户 / 老客户待跟进查询',
    module: '6',
    content: [],
    query: [
      '【老客户待跟进】须同时满足：① 分管人员 = 当前登录用户；② 超时未下单：当前日期 − 订单最近有效日期 > 主数据「销售提醒天数」（基准日期以企业主数据配置为准；无订单日期是否视为超时由企业主数据约定）',
      '【新客户待跟进】须同时满足：① 分管人员为空，或主数据为公海/无负责人；② 跟进记录按时间取最新一条，其「跟进状态」=「待跟进」（与写跟进表单「跟进中/完成」不同；无跟进记录不归入）',
      '【合并】今日待跟进企业列表 = 老客户待跟进 ∪ 新客户待跟进；待跟进企业数量 = 列表企业数；每家仅属一类',
      '【排序】最近更新时间倒序（往来单位或跟进记录的最后更新时间，以接口字段为准）；同时间可按单位名称升序',
      '【条数】一次返回列表全量；摘要卡数量与列表卡行数一致，首屏不截断（若企业配置单次上限，列表分页由接口约定）',
      '【拉数时机】首屏初始化、展开待跟进列表、切换企业、写跟进提交成功后（提交后是否刷新由接口约定）',
      '【失败】轻提示；数量可保留上次结果或显示「—」'
    ],
    interaction: []
  }
};
