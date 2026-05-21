/** 本版标注数据（面板文案均为中文）。文档：02 方案报价下单 / 03 对话流 / 04 数据填槽 / 05 意图路由 */
/** 业务说明写 content：先写识别/处置逻辑，少罗列枚举；清单表仅保留缺槽与步骤；query、interaction 留空 */

/** 客户类型（老客户/新客户）仅标注于 card-plan-pick、card-plan-demand，不再使用 AnnotationSpecGlobal */

window.AnnotationSpecData = {
  'chat-messages': {
    name: '对话框 · 消息区',
    module: '03',
    content: [
      '【消息区】可滚动区：用户气泡、助手业务卡、系统提示；上一版欢迎/待跟进等不在本版范围',
      '【操作】每弹出新助手页，上一页按钮失效；首屏三块同条消息互不失效（详见「对话流 · 历史页面失效」）'
    ],
    query: [],
    interaction: []
  },
  'chat-llm': {
    name: '意图 · 分步槽位',
    module: '05',
    content: [
      '【解析顺序】先定功能意图 → 再抽业务字段并入会话 → 对照当前步槽位是否齐备 → 定下一步类型',
      '【判定顺序】若句意指向另一功能 → 跨功能；否则在活跃卡上解析并填写本步字段',
      '【功能意图】识别用户要办的主能力；若本句或来源卡已点明走法，则记入该能力下的子路径（报价/下单的来源分支），未点明则只记主能力、分支待后续补全',
      '【已读槽位】从本句抽出业务字段（客户、品名、数量、方案名、报价单号等），并与会话已有值合并；本句写明的覆盖旧值；字段定义见《数据填槽需求》',
      '【当前步骤】根据当前技能与对话区最新助手页，判断用户处于哪一步、对应哪张业务卡或抽屉',
      '【下一步】看本步槽位是否已齐、以及「按名称/编号查方案或报价单」是一条还是多条，决定本句处理完后的系统动作（见下表，非用户要填的字段）'

    ],
    query: [],
    interaction: [],
    extraHtml:
      '<p class="sc-spec-panel__label">下一步（推进 / 缺槽引导 / 消歧 / 能力说明 / 跨功能）</p>' +
      '<div class="sc-spec-table-wrap"><table class="sc-spec-table sc-spec-table--route">' +
      '<thead><tr><th>类型</th><th>逻辑</th></tr></thead><tbody>' +
      '<tr><td><strong>推进</strong></td><td>当前步该填的已齐，可进入下一步界面；</td></tr>' +
      '<tr><td><strong>消歧</strong></td><td>方案或报价单命中多条，须先让用户在列表中选一条（可语音报序号）</td></tr>' +
      '<tr><td><strong>缺槽引导</strong></td><td>本步所需槽位未齐，或提到的客户/品名/方案/报价单对不上库里的记录，气泡【待填写】并打开对应界面</td></tr>' +
      '<tr><td><strong>跨功能</strong></td><td>用户改做另一能力，且手头数据已够目标能力起步，先问是否带入</td></tr>' +
      '<tr><td><strong>能力说明</strong></td><td>听不懂或点在已过期页面，只说明能做什么或提示用最新页</td></tr>' +
      '</tbody></table></div>' +
      '<p class="sc-spec-panel__label sc-spec-feature">全流程</p>' +
      '<p class="sc-spec-panel__label sc-spec-feature__section">2. 缺槽引导</p>' +
      '<div class="sc-spec-table-wrap"><table class="sc-spec-table sc-spec-table--route sc-spec-table--slot">' +
      '<thead><tr><th>界面</th><th>缺槽字段</th><th>引导话术</th><th>定位界面</th><th>语音/输入示例</th></tr></thead><tbody>' +
      '<tr><td>选客户</td><td>客户</td><td>须先确定客户</td><td>选客户引导卡 → 选客户抽屉（模糊搜名称/编码）</td><td>给某某公司；</td></tr>' +
      '<tr><td>对话页</td><td>功能意图</td><td>请说明要做的事情，例如配个方案/报价/下单？</td><td>底部技能条</td><td>配个方案 / 报价 / 下单</td></tr>' +
      '</tbody></table></div>' +
      '<p class="sc-spec-panel__label sc-spec-feature">方案速配</p>' +
      '<p class="sc-spec-panel__label sc-spec-feature__section">1. 步骤摘要</p>' +
      '<div class="sc-spec-table-wrap"><table class="sc-spec-table sc-spec-table--route">' +
      '<thead><tr><th>步</th><th>界面</th><th>本步可读槽位</th></tr></thead><tbody>' +
      '<tr><td>S1</td><td>选客户</td><td>客户</td></tr>' +
      '<tr><td>S2</td><td>需求描述卡</td><td>需求描述（仅新客户）</td></tr>' +
      '<tr><td>S3</td><td>选品卡</td><td>勾选、规格、筛选词（数量在加购前可预填）</td></tr>' +
      '<tr><td>S4</td><td>购物车卡</td><td>购买数量、规格（加购后在此调整）</td></tr>' +
      '<tr><td>S5</td><td>方案模板弹窗</td><td>方案模板</td></tr>' +
      '<tr><td>S6</td><td>方案卡</td><td>—</td></tr>' +
      '</tbody></table></div>' +
      '<p class="sc-spec-panel__label sc-spec-feature__section">2. 缺槽引导</p>' +
      '<div class="sc-spec-table-wrap"><table class="sc-spec-table sc-spec-table--route sc-spec-table--slot">' +
      '<thead><tr><th>界面</th><th>缺槽字段</th><th>引导话术</th><th>定位界面</th><th>语音/输入示例</th></tr></thead><tbody>' +
      '<tr><td>需求描述卡</td><td>需求描述</td><td>请描述采购需求</td><td>需求描述卡（语音仅底部输入区）</td><td>伺服电机和齿轮箱各2台</td></tr>' +
      '<tr><td>选品卡</td><td>选品勾选（加购前）</td><td>请先在选品卡勾选至少一种产品</td><td>方案选品卡</td><td>选品 伺服电机；筛选 xxx</td></tr>' +
      '<tr><td>购物车卡</td><td>购买数量、规格（加购后在此调整）</td><td>购物车为空须回选品加购；已有行则在本卡改购买数量与规格</td><td>空→方案选品卡；有行→方案购物车卡</td><td>加购；改数量</td></tr>' +
      '<tr><td>方案模板弹窗</td><td>方案模板</td><td>请选择方案模板（方案不含价格）</td><td>选择方案模板弹窗</td><td>第 N 个、模板名称、保存方案</td></tr>' +
      '</tbody></table></div>' +
      '<p class="sc-spec-panel__label sc-spec-feature">产品报价</p>' +
      '<p class="sc-spec-panel__label sc-spec-feature__section">1. 步骤摘要</p>' +
      '<div class="sc-spec-table-wrap"><table class="sc-spec-table sc-spec-table--route">' +
      '<thead><tr><th>步</th><th>界面</th><th>路径/槽位</th></tr></thead><tbody>' +
      '<tr><td>S1</td><td>选客户</td><td>客户（同全流程）</td></tr>' +
      '<tr><td>S2</td><td>报价来源</td><td>报价来源（按方案/直选）</td></tr>' +
      '<tr><td>S3a</td><td>选择方案</td><td>方案名称、方案编号（消歧）</td></tr>' +
      '<tr><td>S3b</td><td>报价选品</td><td>产品、规格、数量</td></tr>' +
      '<tr><td>S4～S6</td><td>逐项报价→模板→报价单卡</td><td>本单报价、报价单模板</td></tr>' +
      '</tbody></table></div>' +
      '<p class="sc-spec-panel__sub">口令+方案属性：唯一→S4；多个→S3a 仅匹配项</p>' +
      '<p class="sc-spec-panel__label sc-spec-feature__section">2. 缺槽引导</p>' +
      '<div class="sc-spec-table-wrap"><table class="sc-spec-table sc-spec-table--route sc-spec-table--slot">' +
      '<thead><tr><th>界面</th><th>缺槽字段</th><th>引导话术</th><th>定位界面</th><th>语音/输入示例</th></tr></thead><tbody>' +
      '<tr><td>报价来源卡</td><td>报价来源</td><td>请选择报价方式</td><td>报价来源卡</td><td>按方案报价 / 直接选品报价</td></tr>' +
      '<tr><td>报价来源卡</td><td>当前客户方案</td><td>暂无方案，请先方案速配或直选；按方案时「请先为{客户}完成方案速配…」</td><td>报价来源卡</td><td>—</td></tr>' +
      '<tr><td>选择方案卡</td><td>方案名称</td><td>请选择要报价的方案；未匹配「未找到与描述匹配的方案」</td><td>选择方案卡</td><td>标准技术方案 / PL编号；「第2条」「选第二条」</td></tr>' +
      '<tr><td>报价选品卡</td><td>已选产品</td><td>请至少选择一种产品</td><td>报价选品卡</td><td>选品 关键词</td></tr>' +
      '<tr><td>逐项报价抽屉</td><td>本单报价</td><td>请为每项填写本单报价；明细为空/未确认等同义提示</td><td>逐项报价抽屉（报价模式）</td><td>伺服电机改4200；未命中「未找到对应行」</td></tr>' +
      '<tr><td>报价单模板弹窗</td><td>报价单模板</td><td>请选择报价单模板</td><td>选择报价单模板弹窗</td><td>—</td></tr>' +
      '</tbody></table></div>' +
      '<p class="sc-spec-panel__label sc-spec-feature">确认下单</p>' +
      '<p class="sc-spec-panel__label sc-spec-feature__section">1. 步骤摘要</p>' +
      '<div class="sc-spec-table-wrap"><table class="sc-spec-table sc-spec-table--route">' +
      '<thead><tr><th>步</th><th>界面</th><th>路径/槽位</th></tr></thead><tbody>' +
      '<tr><td>S1</td><td>选客户</td><td>客户（同全流程）</td></tr>' +
      '<tr><td>S2</td><td>下单来源</td><td>下单来源（按报价单/直选）</td></tr>' +
      '<tr><td>S3a</td><td>选择报价单</td><td>报价单编号、报价单模板</td></tr>' +
      '<tr><td>S3b～S5</td><td>选品→逐项报价→订单确认</td><td>本单报价、订单明细</td></tr>' +
      '</tbody></table></div>' +
      '<p class="sc-spec-panel__sub">无按方案下单。口令+报价单属性：唯一→S5</p>' +
      '<p class="sc-spec-panel__label sc-spec-feature__section">2. 缺槽引导</p>' +
      '<div class="sc-spec-table-wrap"><table class="sc-spec-table sc-spec-table--route sc-spec-table--slot">' +
      '<thead><tr><th>界面</th><th>缺槽字段</th><th>引导话术</th><th>定位界面</th><th>语音/输入示例</th></tr></thead><tbody>' +
      '<tr><td>下单来源卡</td><td>下单来源</td><td>请选择下单来源</td><td>下单来源卡</td><td>按报价单下单 / 直接选品</td></tr>' +
      '<tr><td>下单来源卡</td><td>当前客户报价单</td><td>请先完成报价或使用直接选品</td><td>下单来源卡</td><td>—</td></tr>' +
      '<tr><td>选择报价单卡</td><td>报价单</td><td>请选择要下单的报价单；未匹配「未找到与描述匹配的报价单」</td><td>选择报价单卡</td><td>QT编号 / 模板名；「第1条」</td></tr>' +
      '<tr><td>订单选品卡</td><td>已选产品</td><td>请至少选择一种产品</td><td>订单选品卡</td><td>选品 关键词</td></tr>' +
      '<tr><td>逐项报价抽屉</td><td>本单报价</td><td>请为订单明细填写本单报价</td><td>逐项报价抽屉（下单模式）</td><td>同报价逐项改价</td></tr>' +
      '<tr><td>订单确认弹窗</td><td>订单明细</td><td>请先选择订单来源与明细；订单明细为空</td><td>下单来源卡</td><td>—</td></tr>' +
      '</tbody></table></div>' +
      '<p class="sc-spec-panel__label sc-spec-feature">随当前流程</p>' +
      '<p class="sc-spec-panel__label sc-spec-feature__section">2. 缺槽引导</p>' +
      '<div class="sc-spec-table-wrap"><table class="sc-spec-table sc-spec-table--route sc-spec-table--slot">' +
      '<thead><tr><th>界面</th><th>缺槽字段</th><th>引导话术</th><th>定位界面</th><th>语音/输入示例</th></tr></thead><tbody>' +
      '<tr><td>选品卡</td><td>产品匹配</td><td>未能匹配产品，请补充品名或走选品</td><td>方案/报价/订单选品卡（随流程）</td><td>选品 关键词</td></tr>' +
      '</tbody></table></div>' +
      '<p class="sc-spec-panel__sub">活跃卡语音：选品卡→筛选/选品；选择方案·报价单卡→第 N 条或名称编号；方案模板弹窗→第 N 个/名称/保存；逐项报价→行级改价/数量（与各功能缺槽表语音列一致）</p>'
  },
  'data-rules-chat-flow': {
    name: '对话流 · 历史页面失效',
    module: '03',
    content: [
      '【失效规则】每插入新助手页，上一页序号内按钮全部失效；仅发文字未弹新页时当前页仍可用',
      '【首屏】欢迎/待跟进/最近访问同条消息内互不失效；下一张助手页后整条首屏失效',
      '【同页补充】筛选提示、已选品提示等同页序号，不触发失效',
      '【操作】点失效按钮轻提示；失效按钮半透明不可点，仅最新页可操作'
    ],
    query: [],
    interaction: []
  },
  'card-plan-demand': {
    name: '方案 · 需求描述卡',
    module: '02',
    content: [
      '【场景】须已选客户；仅新客户（待跟进无责任人，定义见选品卡）；老客户跳过本卡进选品',
      '【输入】卡片多行 +「确认需求」；<strong>不设</strong>卡片内语音；需求句用底部按住说话/键盘，走「+需求描述」',
      '【操作】点「确认需求」进选品；或用底部发需求句（与卡片二选一）',
      '【确认后】需求文本参与选品推荐匹配（性质×产品类型 → 需求×存货描述>80%）'
    ],
    query: [],
    interaction: []
  },
  'card-plan-pick': {
    name: '方案选品卡',
    module: '02',
    content: [
      '【客户类型】仅本模块；先老客户再新客户否则回退性质；按顶栏客户决定推荐区/更多区取数',
      '【老客户】有过订单且责任人=当前业务员（演示王业务）',
      '【新客户】待跟进且无责任人',
      '【推荐区·老客户】历史订单产品；下单日新→旧去重≤10；标签「历史订单」',
      '【推荐区·新客户】①性质×产品类型②需求文本×存货描述>80%（需求卡或底部输入，非仅档案 demandHint）；标签「匹配 xx%」',
      '【筛选】品名/规格/存货描述；同步过滤推荐区与更多产品；每行可改规格',
      '【更多产品】全库去掉推荐区已展示；首屏5条、触底再加载5条；有筛选词仅显示命中项',
      '【方案流程上下文】选品/规格/数量写会话；换客户或重置清空；新助手页不清空',
      '【操作】勾选并改规格/筛选；点「加入购物车」将勾选行写入购物车；不在此步做最终采购数量确认'
    ],
    query: [],
    interaction: []
  },
  'card-plan-cart': {
    name: '方案购物车',
    module: '02',
    content: [
      '【场景】加购后的确认页；行数据来自选品卡勾选结果',
      '【操作】主要改<strong>购买数量</strong>与规格；可返回选品补勾；「生成方案」打开模板抽屉'
    ],
    query: [],
    interaction: []
  },
  'sheet-plan-template': {
    name: '方案模板抽屉',
    module: '02',
    content: [
      '【模板】单选一种方案模板；列表带序号 1、2、3…；方案正文不含价格',
      '【操作】点选或底部语音/键盘：说「第 N 个」、模板名称选行；说「保存方案」等同确认按钮；未选模板时轻提示'
    ],
    query: [],
    interaction: []
  },
  'plan-template-voice': {
    name: '方案模板 · 抽屉语音条',
    module: '02',
    content: [
      '【场景】模板抽屉打开时专用；识别结果不进主对话流',
      '【操作】按住说话或键盘发送；走与主输入相同的意图解析，优先匹配本抽屉序号/名称/保存'
    ],
    query: [],
    interaction: []
  },
  'modal-pdf': {
    name: '方案 / 报价单 PDF 预览',
    module: '02',
    content: [
      '【入口】方案卡预览 / 报价单卡看 PDF；全屏顶栏返回；HTML 模拟排版非下载',
      '【方案页】技术方案：编号、日期、客户、模板；序/品名/规格/数量/单位；页脚合计为行数量和，无单价金额',
      '【报价单页】销售报价单：单号、日期、客户、版式；含单价金额；页脚含税合计；数据读当前会话对象与对应卡片一致'
    ],
    query: [],
    interaction: []
  },
  'card-scheme': {
    name: '方案卡',
    module: '02',
    content: [
      '【展示】编号、客户、模板、行明细（品名/规格/数量，无价格）；分步保存或一句话生成，明细在会话状态',
      '【操作】「预览 PDF」见 PDF 预览层；「去报价」进报价流程；按钮受历史页面失效约束'
    ],
    query: [],
    interaction: []
  },
  'card-scheme-pick': {
    name: '选择方案卡',
    module: '02',
    content: [
      '【场景】多方案时须先选一行（意图钉·消歧）；单方案直进逐项报价见报价来源卡',
      '【列表】序号 1、2、3… + 模板名 / 编号 / 品项摘要；新→旧',
      '【操作】点选或语音「第2条」、方案名/编号 → 逐项报价或一句话报价单'
    ],
    query: [],
    interaction: []
  },
  'card-quote-source': {
    name: '报价来源卡',
    module: '02',
    content: [
      '【场景】进入产品报价后须选来源；按方案或直选品，均须逐项填本单价',
      '【规则】仅 1 个方案可直按方案进逐项报价；多个方案须先「选择方案卡」',
      '【操作】按方案：多方案先选名称，单方案载入方案行进逐项报价；直选：进报价选品'
    ],
    query: [],
    interaction: []
  },
  'card-quote-pick': {
    name: '报价选品卡',
    module: '02',
    content: [
      '【选品】规则同方案选品卡',
      '【操作】勾选、改规格 → 报价确认或逐项报价'
    ],
    query: [],
    interaction: []
  },
  'card-quote-cart': {
    name: '报价选品确认',
    module: '02',
    content: [
      '【行明细】规格/数量/最新价与最低价参考/本单报价；展示合计；直选可勾选「保存为方案」',
      '【操作】填完单价后选报价单模板'
    ],
    query: [],
    interaction: []
  },
  'sheet-quote-setup': {
    name: '逐项报价抽屉',
    module: '02',
    content: [
      '【模式】报价→选模板→报价单卡；下单→主按钮「生成订单」→下单确认',
      '【表单】规格/数量/售价参考/本单报价；低于最低价行高亮',
      '【语音/操作】底部输入；「第 N 项改价」、品名改价、改数量/规格；仅更新表单+轻提示，不写对话区'
    ],
    query: [],
    interaction: []
  },
  'quote-setup-voice': {
    name: '逐项报价 · 语音输入',
    module: '02',
    content: ['与「逐项报价抽屉」同条语音规则，不单独维护'],
    query: [],
    interaction: []
  },
  'sheet-quote-template': {
    name: '报价单模板抽屉',
    module: '02',
    content: [
      '【模板】单选一种报价单版式；列表来自演示主数据',
      '【操作】确认后生成报价单卡；可从报价单卡进入下单'
    ],
    query: [],
    interaction: []
  },
  'card-quote-select': {
    name: '选择报价单卡',
    module: '02',
    content: [
      '【场景】多报价单时须先选一行（意图钉·消歧）；单张直进见下单来源卡',
      '【列表】序号 1、2、3… + 单号 / 模板 / 合计；新→旧',
      '【操作】点选或语音「第1条」、单号/模板名 → 下单确认抽屉'
    ],
    query: [],
    interaction: []
  },
  'card-quote': {
    name: '报价单卡',
    module: '02',
    content: [
      '【展示】单号、客户；按方案生成时含方案模板名与报价单版式；分步或一句话生成，明细在会话；不自动建订单',
      '【操作】「看 PDF」打开预览层；「生成订单」进下单确认（多报价单先选卡）；按钮受历史页面失效约束'
    ],
    query: [],
    interaction: []
  },
  'card-order-source': {
    name: '下单来源卡',
    module: '02',
    content: [
      '【场景】进入确认下单后须选来源',
      '【规则】按报价单：单张可直进确认；多张先「选择报价单卡」。直选品：须先逐项报价再确认',
      '【操作】按报价单进下单确认抽屉；直选进订单选品卡'
    ],
    query: [],
    interaction: []
  },
  'card-order-pick': {
    name: '订单选品卡',
    module: '02',
    content: [
      '【选品】同报价直选；可勾选保存为方案',
      '【操作】逐项报价 → 下单确认'
    ],
    query: [],
    interaction: []
  },
  'card-order-cart': {
    name: '订单购物车卡',
    module: '02',
    content: [
      '【场景】遗留中间页，不单独完成下单',
      '【操作】引导进入逐项报价抽屉，填价后再走下单确认'
    ],
    query: [],
    interaction: []
  },
  'sheet-order': {
    name: '下单确认抽屉',
    module: '02',
    content: [
      '【确认页】客户、来源摘要（报价单号与金额或直选行数合计）；有交期则展示（本版不强制）',
      '【操作】确认后写入演示订单（待排产）并展示订单成功卡'
    ],
    query: [],
    interaction: []
  },
  'card-order-success': {
    name: '订单成功卡',
    module: '02',
    content: ['【展示】订单号、客户、状态、明细（品名/存货规格/选配规格/数量单位）、合计；行来自确认页待提交数据，只读'],
    query: [],
    interaction: []
  }
};
