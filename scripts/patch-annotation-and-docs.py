#!/usr/bin/env python3
"""Patch annotation-spec-data.js (v1.3 + v1.4), scope files, and functional description docs."""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]

PATCH_FROM = "'card-delivery-source':"
PATCH_UNTIL = "'card-capacity':"

NEW_MIDDLE = r"""
  'card-delivery-source': {
    name: '交期评审 · 选择来源',
    module: '05',
    content: [
      '【标题】交期评审 · 选择来源',
      '【分组·已有单据】按方案 / 按报价单 / 按订单（互斥）',
      '【按方案】副文案：共 N 个已保存方案；无方案置灰',
      '【按报价单】副文案：共 N 份历史报价单；无单置灰',
      '【按订单】副文案：共 N 笔未排程订单；无未排程置灰',
      '【分组·从头评估】自选商品（主色）：直选品、规格与数量评审交期',
      '【直达】仅 1 条方案/报价单/未排程订单时，点对应项直接进入评审表单'
    ],
    query: [
      '方案：当前客户已保存方案',
      '报价单：当前客户全部报价单',
      '未排程订单：非待提交、非已完成'
    ],
    interaction: [
      '按方案 → 选方案或表单',
      '按报价单 → 选报价单或表单（气泡「按报价单」）',
      '按订单 → 选订单或表单（气泡「按订单」）',
      '自选商品 → 需求引导或选品 → 评审表单'
    ]
  },
  'card-delivery-scheme-pick': {
    name: '交期评审 · 选方案',
    module: '05',
    content: [
      '【场景】按方案且本客户已保存方案 ≥2',
      '【字段】方案名称、方案编号、品项摘要',
      '【说明】与历史方案列表样式一致，交期路径独立'
    ],
    query: ['当前客户已保存方案，按保存时间倒序'],
    interaction: ['点选一行 → 载入方案明细 → 评审表单']
  },
  'card-delivery-quote-pick': {
    name: '交期评审 · 选报价单',
    module: '05',
    content: [
      '【场景】按报价单且本客户报价单 ≥2',
      '【字段】报价单号、金额合计、报价单模板名称'
    ],
    query: ['当前客户全部报价单，按生成时间倒序'],
    interaction: ['点选一行 → 载入报价行 → 评审表单']
  },
  'card-delivery-order-pick': {
    name: '交期评审 · 选订单',
    module: '05',
    content: [
      '【场景】按订单且本客户未排程订单 ≥2',
      '【字段】订单号、下单日期 · 金额、品项摘要',
      '【说明】列表不展示订单状态徽章'
    ],
    query: ['未排程订单，按下单日期倒序'],
    interaction: ['点选一行 → 只读订单行明细 → 评审表单']
  },
  'card-delivery-demand': {
    name: '交期评审 · 需求引导',
    module: '05',
    content: [
      '【路径】自选商品 · 交期评审',
      '【内容】采购需求输入框；老客户展示「跳过，按最近订单推荐」',
      '【规则】同方案/报价直选需求引导：新客户须填需求；老客户可跳过'
    ],
    query: ['是否老客户决定是否展示跳过'],
    interaction: [
      '确认需求 → 交期自选·选品卡',
      '跳过 → 按最近订单推荐进选品卡',
      '对话完整需求句可跳过本卡直达选品'
    ]
  },
  'sheet-delivery': {
    name: '交期评审 · 表单',
    module: '05',
    content: [
      '【标题】交期评审',
      '【只读·来源摘要】报价单号+金额 / 订单号+日期·金额 / 品项摘要',
      '【只读·要求交期】来自订单时默认带入订单要求交期',
      '【只读·项数】明细行数摘要',
      '【期望交期】日期，须用户确认或修改',
      '【明细表】序号、品名、规格、数量、工艺版本（每行下拉）',
      '【是否生成采购计划】单选是/否；默认后台带入，可改',
      '【不含】开始时间、结束时间（在结果卡展示）'
    ],
    query: [
      '明细来自报价行 / 订单行 / 自选汇总',
      '工艺版本候选项：主数据按货品规格',
      '采购计划默认值：后台带入'
    ],
    interaction: [
      '未选期望交期 → 请选择期望交期',
      '任一行未选工艺版本 → 请为每项选择工艺版本',
      '提交评审 → 会话已确认 → 结果卡'
    ]
  },
  'card-delivery': {
    name: '交期评审 · 结果卡',
    module: '05',
    content: [
      '【标题】交期评审 · + 结论徽章（按期 / 无法按时交付）',
      '【结论区】按期与无法按时均有对称结论文案区（绿/橙）',
      '【原因区·仅无法按时】浅黄底、分条可读说明（非程序原始数据）',
      '【不含】评审单号行',
      '【参数摘要·只读】开始/结束时间并排；期望交期；工艺版本分行；采购计划',
      '【不含】查看订单进度入口（本版已移除）'
    ],
    query: [
      '开始/结束时间、评审结论、阻塞原因：后台返回',
      '期望交期、工艺版本、采购计划：表单提交值回显'
    ],
    interaction: [
      '按期 + 报价/自选：生成订单 → 下单确认',
      '无法按时：主按钮调整方案 → 回显评审表单（气泡「调整交期评审方案」）',
      '无法按时次按钮：仍要生成订单（报价/自选路径）',
      '本版不提供查看订单进度按钮'
    ]
  },
  'card-copy-demand': {
    name: '复制订单 · 需求筛选',
    module: '05',
    content: [
      '【出现】复制订单技能入口（老客户）',
      '【展示】描述要复制的订单特征；老客户可跳过',
      '【跳过文案】跳过，展示最近订单（展示全部历史订单列表）',
      '【关联】话术含唯一订单号可跳过本卡与选单直达明细确认'
    ],
    query: ['仅老客户；新客户 toast 并引导方案/报价'],
    interaction: [
      '确认需求 → 选择历史单（按需求筛品项）',
      '跳过 → 展示全部历史订单',
      '对话发送需求句可等同确认'
    ]
  },
  'card-progress-demand': {
    name: '订单进度 · 需求筛选',
    module: '05',
    content: [
      '【出现】订单进度技能入口',
      '【展示】描述要查询的订单特征；老客户可跳过',
      '【跳过文案】跳过，展示最近订单',
      '【关联】话术含唯一订单号可跳过本卡与选单直达进度详情'
    ],
    query: ['本客户历史订单'],
    interaction: [
      '确认需求 → 选择订单（按需求筛品项）',
      '跳过 → 展示全部历史订单',
      '选单卡内可修改需求回到本卡'
    ]
  },
  'card-order-pick': {
    name: '订单选单 / 交期自选·选品',
    module: '05',
    content: [
      '【复用宿主】同一标注标识，按场景区分：',
      '1. 交期自选：标题「交期评审 · 自选商品」；推荐区+筛选；主按钮确认选品',
      '2. 复制订单：选择历史单；序号、订单号、日期·金额、品项（无状态徽章）',
      '3. 订单变更：选择历史单；同复制样式',
      '4. 订单进度：选择订单；同复制样式',
      '【共用】检索框、分页加载更多、语音「第 N 条」点选'
    ],
    query: [
      '复制/变更/进度：本客户历史订单，下单日期倒序',
      '复制/进度：可按需求文本筛品项摘要',
      '交期自选：推荐规则同方案选品'
    ],
    interaction: [
      '复制：点选 → 明细确认；无历史仅对话提示',
      '变更：点选 → 确认变更；已完成 toast 不可变更',
      '进度：点选 → 进度详情',
      '交期自选：确认选品 → 评审表单'
    ]
  },
  'card-order-copy': {
    name: '复制订单 · 明细确认',
    module: '05',
    content: [
      '【标题】复制订单 · 明细确认',
      '【来源】订单号、下单日期（无状态徽章）、客户名',
      '【明细】手风琴：收起序号/品名/小计/删除按钮；展开改规格/数量/单价等',
      '【合计】随编辑实时更新',
      '【操作】删除行、重选订单、确认复制 → 下单确认'
    ],
    query: ['来源订单明细写入待确认订单；来源记为复制订单'],
    interaction: [
      '点行展开/收起编辑（同时仅一行）',
      '点击删除按钮移除该行明细（至少保留一条）',
      '确认复制 → 下单确认 → 提交后未审核'
    ]
  },
  'card-change-confirm': {
    name: '订单变更 · 确认变更',
    module: '05',
    content: [
      '【标题】订单变更 · 确认变更',
      '【展示】订单号、日期·金额、品项摘要、客户名',
      '【说明】确认后提交变更；已审核订单回退销售审核',
      '【不含】变更原因下拉与备注表单（本版简化为确认卡）'
    ],
    query: ['绑定当前变更订单'],
    interaction: [
      '重选订单 → 变更选单卡',
      '确认变更 → 变更已提交卡'
    ]
  },
  'card-change-success': {
    name: '订单变更 · 变更已提交',
    module: '05',
    content: [
      '【标题】变更已提交',
      '【只读】订单号、受理说明（已审核时提示回退销售审核）'
    ],
    query: [],
    interaction: ['提交后停留对话页，无强制跳转']
  },
  'card-order-progress-detail': {
    name: '订单进度 · 详情',
    module: '05',
    content: [
      '【标题】订单号 + 状态徽章',
      '【订单信息】客户、下单日期、发货日期、业务员',
      '【生产进度概览】总货品数，各生产状态数量统计（待排程、已排程、待发料、已发料、已生产）',
      '【货品明细】序号、货品名称、规格、数量、工单生产状态徽章',
      '【操作】重选订单 → 进度选单卡'
    ],
    query: ['订单主档 + 明细行；生产状态来自各货品的工单生产状态'],
    interaction: [
      '入口：技能订单进度 / 话术查进度',
      '只读详情，无本卡内提交'
    ]
  },
"""

NEW_TAIL = r"""
  'card-capacity': {
    name: '产能分析',
    module: '06',
    content: [
      '【标题】产能分析',
      '【块A】首行：N条线自今日起已排至日期（最晚产线：名称）；次行：平均负荷率',
      '【Tab】甘特图 | 订单详情（详情 Tab 可带订单号徽章）',
      '【甘特Tab】一行一产线；小时粒度（无切换）；首屏 1 天可横滑；非工作灰带、当前时刻线、占用块',
      '【提示】点击占用块查看订单详情；点「甘特图」继续浏览',
      '【范围】全厂产线总览，不要求顶栏选客户'
    ],
    query: [
      '不要求顶栏选客户；全厂产线总览',
      '甘特与订单占用详情：已有排程能力直返',
      '排产至日期、平均负荷率：今日～排产至日期，全产线工作实际小时÷可工作小时'
    ],
    interaction: [
      '点占用块 → 自动切「订单详情」Tab',
      '点「甘特图」Tab 回甘特，横滑位置保留',
      '未选块点详情 Tab → 轻提示',
      '禁止拖拽改排'
    ]
  },
  'card-capacity-block-detail': {
    name: '产能分析 · 订单详情 Tab',
    module: '06',
    content: [
      '【摘要】当前查看：订单号 · 产线',
      '【字段】订单号/客户/下单/交货/产品/工艺/数量/计划起止/产线/工序/模具/时长(分钟)'
    ],
    query: ['订单占用详情随所点占用块一并返回'],
    interaction: [
      '点占用块自动切入本 Tab',
      '点「甘特图」Tab 返回；刚查看块高亮约 2s'
    ]
  },
  'card-biz-analysis': {
    name: '业务分析',
    module: '06',
    content: [
      '【标题】业务分析',
      '【摘要】统计时间范围 · 参与汇总单据笔数',
      '【Tab】业务员排行（默认）| 客户排行',
      '【结论】一句话经营判断（见 card-biz-analysis-insight）',
      '【段选】订单量 | 总数量 | 总金额（默认总金额；仅影响排行）',
      '【列表】Top 10，只读',
      '【提示】切换 Tab 查看客户排行；点指标切换列表排序'
    ],
    query: [
      '不要求顶栏先选客户；统计全部客户（企业）全量汇总',
      '顶栏当前客户不参与过滤',
      '默认时间：本年 1/1～今日',
      '排行与合计：已有统计能力直返；两 Tab 各自记忆段选'
    ],
    interaction: [
      '切 Tab → 更新一句话结论 + 排行；段选各 Tab 独立记忆',
      '切指标 → 仅列表重排，结论不变',
      '点排行行 → 本版无下钻'
    ]
  },
  'card-biz-analysis-insight': {
    name: '业务分析 · 一句话结论',
    module: '06',
    content: [
      '【位置】Tab 下、段选上；一句经营判断',
      '【行为】随 Tab 换句，不随段选变化'
    ],
    query: [
      '【口径】仅总金额；全部排行（非 Top 10）；占比=金额÷全量合计×100% 四舍五入取整',
      '【业务员 Tab·按序命中即停】',
      '① 前三合计占比≥55% → {第1名}成交居首，前三业务员贡献了 {占比} 业绩，团队出单高度集中在头部。',
      '② 否则第1名≥35% → {第1名}一人贡献了 {占比} 业绩，头部效应明显，需关注梯队建设。',
      '③ 其余 → {第1名}成交金额最高，出单分布较均衡，多数业务员均有贡献。',
      '【客户 Tab·按序命中即停】',
      '① 前五合计≥50% → 前五大客户贡献了 {占比} 销售额，对大客户依赖明显，需防范客户集中风险。',
      '② 否则第1名≥20% → {第1名}是最大客户，占总额 {占比}，整体客户结构尚可，但仍需持续拓客。',
      '③ 其余 → 客户贡献较分散，未出现单一客户过度依赖，经营结构相对健康。',
      '【异常】无数据→暂无足够数据…；后台已返成品句→优先采用'
    ],
    interaction: [
      '切 Tab 整句替换',
      '切指标不触发结论重算（展示规则始终按总金额）'
    ]
  },
  'card-inventory': {
    name: '库存查询',
    module: '06',
    content: [
      '【标题】库存查询',
      '【摘要·加粗】合计：货品：N  规格：M  可用为0：K',
      '【列表】两行结构：品名行（品名+编码）；规格行（颜色|大小|可用|现存量）',
      '【不含】口径说明行、仅看可用为0筛选',
      '【范围】全仓全部货品规格合计，不按顶栏客户过滤'
    ],
    query: [
      '不要求顶栏选客户',
      '演示读本地规格库存快照',
      '可用为0行可用数橙色警示'
    ],
    interaction: [
      '欢迎区/技能条/话术直接进入',
      '只读列表，无行下钻'
    ]
  },
  'card-payment': {
    name: '回款分析',
    module: '06',
    content: [
      '【标题】回款分析',
      '【摘要·加粗】客户总数：86  应有 64  逾期 12（演示固定口径）',
      '【指标·2×2】应收余额、逾期（金额+最长逾期天数）、本月已回款、最近回款日',
      '【范围】全部客户汇总，不要求顶栏选客户'
    ],
    query: [
      '不要求顶栏选客户',
      '演示读本地回款分析聚合',
      '逾期金额大于零时橙色警示'
    ],
    interaction: [
      '欢迎区/技能条/话术直接进入',
      '只读指标，无下钻'
    ]
  },
"""

SCOPE_IDS_05_06 = [
    "card-delivery-scheme-pick",
    "card-copy-demand",
    "card-progress-demand",
    "card-change-confirm",
    "card-inventory",
    "card-payment",
]
SCOPE_REMOVE = ["sheet-change", "card-order-progress-list"]


def patch_annotation(path: Path):
    text = path.read_text(encoding="utf-8")
    start = text.find(PATCH_FROM)
    if start == -1:
        raise SystemExit(f"start marker not found in {path}")
    cap = text.find(PATCH_UNTIL, start)
    if cap != -1:
        rest_from_capacity = text[cap:]
        end = rest_from_capacity.rfind("};")
        capacity_and_biz = rest_from_capacity[:end]
        capacity_and_biz = capacity_and_biz.replace(
            "'须已选当前客户',",
            "'不要求顶栏选客户；全厂产线总览',",
        )
        # strip old capacity through biz-insight; NEW_TAIL includes full 06 section
        cap_start = capacity_and_biz.find("'card-capacity':")
        if cap_start != -1:
            capacity_and_biz = capacity_and_biz[:cap_start]
        new_text = text[:start] + NEW_MIDDLE + NEW_TAIL + "\n};\n"
    else:
        # v1.3 等无经营分析段：从 delivery-source 替换到文件末尾
        end = text.rfind("};")
        new_text = text[:start] + NEW_MIDDLE + NEW_TAIL + "\n};\n"
    path.write_text(new_text, encoding="utf-8")
    print(f"patched {path}")


def patch_scope(path: Path, version: str, label: str, docs_extra: list | None):
    text = path.read_text(encoding="utf-8")
    text = re.sub(r"version: '[^']+'", f"version: '{version}'", text)
    text = re.sub(r"label: '[^']+'", f"label: '{label}'", text)
    if docs_extra:
        for doc in docs_extra:
            if doc["id"] not in text:
                text = text.replace(
                    "    { id: '05', title: '交期与订单运营' }\n  ],",
                    "    { id: '05', title: '交期与订单运营' },\n"
                    "    { id: '06', title: '经营分析' }\n  ],",
                )
    # ids list: remove obsolete, add new
    for rid in SCOPE_REMOVE:
        text = re.sub(r"\n    '" + rid + "',?", "", text)
    m = re.search(r"ids: \[([\s\S]*?)\n  \]", text)
    if not m:
        raise SystemExit(f"ids block not found in {path}")
    ids_block = m.group(1)
    for nid in SCOPE_IDS_05_06:
        if f"'{nid}'" not in ids_block:
            ids_block = ids_block.rstrip() + f"\n    '{nid}',"
    text = text[:m.start(1)] + ids_block + text[m.end(1):]
    path.write_text(text, encoding="utf-8")
    print(f"patched scope {path}")


def patch_delivery_func_desc(path: Path):
    text = path.read_text(encoding="utf-8")
    old = "| 操作 | 按期+报价/自选：生成订单；按期+订单：查看订单进度；无法按时：调整方案；无法按时次按钮：查看进度或仍要生成订单 |"
    new = "| 操作 | 按期+报价/自选：生成订单；无法按时：调整方案（回显评审表单）；无法按时次按钮：仍要生成订单（报价/自选）；**本版无查看订单进度** |"
    if old in text:
        text = text.replace(old, new)
    text = text.replace(
        "| 交期评审 · 结果 | 徽章、结论、原因、参数摘要 | 后台评审结果 | 生成订单 / 查看进度 / 调整方案 |",
        "| 交期评审 · 结果 | 徽章、对称结论、可读原因、参数摘要 | 后台评审结果 | 生成订单 / 调整方案回显表单 |",
    )
    path.write_text(text, encoding="utf-8")
    print(f"patched func desc {path}")


def patch_biz_func_desc(path: Path):
    text = path.read_text(encoding="utf-8")
    replacements = [
        (
            "| 1. 选客户 | **前置条件**：顶栏当前客户已选定；未选则走与其它技能一致的选客户引导 |",
            "| 1. 触发 | **不要求**顶栏选客户；直接汇总 **全厂产线** |",
        ),
        (
            "  A[入口：欢迎区 / 技能条 / 话术] --> B{顶栏已选客户?}\n  B -->|否| C[引导选客户]\n  B -->|是| D[调用后台产能分析]",
            "  A[入口：欢迎区 / 技能条 / 话术] --> D[调用后台产能分析]",
        ),
        (
            "| **做什么** | 在已选客户前提下，展示 **负荷描述**（排产至日期 + 平均负荷率）+ **产线占用甘特图**（只读） |",
            "| **做什么** | 展示 **全厂产线** **负荷描述**（排产至日期 + 平均负荷率）+ **产线占用甘特图**（只读）；**不要求选客户** |",
        ),
        (
            "| 客户必选 | 产能分析须已选客户（企业）；**库存查询、业务分析不要求**先选 |",
            "| 客户必选 | **库存、回款、产能、业务分析均不要求**顶栏先选客户 |",
        ),
        (
            "## 1.2 库存查询\n\n本版功能描述不展开。",
            "## 1.2 库存查询\n\n### 1.2.1 功能定位\n\n| 项 | 说明 |\n|----|------|\n| **用户** | 外勤销售（快速看全仓哪些规格有货、哪些断货） |\n| **做什么** | 对话内展示 **全仓合计** 规格库存表：品名 + 颜色/大小 + 可用/现存量 |\n| **不做什么** | 不要求选客户；不做仓库筛选、行下钻、仅看可用为0开关 |\n| **完成标准** | 结果卡展示合计摘要与两行列表 |\n\n### 1.2.2 结果卡 · `card-inventory`\n\n| 区域 | 说明 |\n|------|------|\n| 摘要 | **合计：货品：N  规格：M  可用为0：K**（加粗） |\n| 列表 | 每项两行：品名+编码；子行颜色|大小|可用|现存量 |\n| 警示 | 可用≤0 时可用数橙色 |\n| 不含 | 口径说明行、低库存筛选控件 |\n\n### 1.2.3 入口与交互\n\n欢迎区 / 技能条 / 话术「查库存」等 → 直接推送结果卡，只读。",
        ),
        (
            "## 1.4 回款分析\n\n本版功能描述不展开。",
            "## 1.4 回款分析\n\n### 1.4.1 功能定位\n\n| 项 | 说明 |\n|----|------|\n| **用户** | 管理者/销售主管（看应收与回款节奏） |\n| **做什么** | 全部客户维度四项指标 + 客户总数/有应收/逾期客户数摘要 |\n| **不做什么** | 不要求选客户；不做客户下钻 |\n\n### 1.4.2 结果卡 · `card-payment`\n\n| 区域 | 说明 |\n|------|------|\n| 摘要 | **客户总数：86  应有 64  逾期 12**（演示口径，加粗） |\n| 指标 | 2×2：应收余额、逾期（金额+最长天数）、本月已回款、最近回款日 |\n| 提示 | 底部一行数据来源说明（演示保留） |\n\n### 1.4.3 入口与交互\n\n欢迎区 / 技能条 / 话术 → 直接推送结果卡，只读。",
        ),
    ]
    for old, new in replacements:
        text = text.replace(old, new)
    # dedupe appendix B duplicate rows
    text = re.sub(
        r"(\| `card-inventory`.*\n)(\| `card-payment`.*\n)+",
        r"\1| `card-payment` | 回款分析 · 四项指标 | §1.4 |\n",
        text,
    )
    path.write_text(text, encoding="utf-8")
    print(f"patched biz func desc {path}")


def write_v13_biz_func_desc():
    src = ROOT / "v1.4.0/功能描述-经营分析-v1.4.0.md"
    dst = ROOT / "v1.3.0/功能描述-经营分析-v1.3.0.md"
    text = src.read_text(encoding="utf-8")
    text = text.replace("v1.4.0", "v1.3.0").replace("v1.4.0/", "v1.3.0/")
    text = text.replace(
        "> **对应实现**：`.output/v1.4.0/` · 标注详见 `annotation-docs/06-经营分析.md`（规划）",
        "> **对应实现**：`v1.3.0/` · 标注详见 [annotation-docs/06-经营分析.md](./annotation-docs/06-经营分析.md)",
    )
    text = text.replace(
        "本版本目录下标注配置文件",
        "v1.3.0/js/annotation-spec-scope.js",
    )
    dst.write_text(text, encoding="utf-8")
    print(f"written {dst}")


def patch_annotation_doc_05(path: Path, version: str):
    text = path.read_text(encoding="utf-8")
    text = text.replace("v1.4.0", version)
    text = text.replace(
        "| 交期评审 · 结果 | 徽章、结论、原因、参数摘要 | 后台评审结果 | 生成订单 / 查看进度 / 调整方案 |",
        "| 交期评审 · 结果 | 对称结论、可读原因、参数摘要 | 后台评审结果 | 生成订单 / 调整方案回显表单 |",
    )
    path.write_text(text, encoding="utf-8")
    print(f"patched annotation doc {path}")


def patch_annotation_doc_06_capacity(path: Path):
    text = path.read_text(encoding="utf-8")
    text = text.replace(
        "- **不要求**顶栏选客户；全厂产线总览",
        "- **不要求**顶栏选客户；**全厂产线**总览（与实现一致）",
    )
    if "不要求" not in text.split("产能")[1][:200]:
        text = text.replace(
            "### 2.2 查询逻辑\n\n- **不要求**顶栏选客户；全厂产线总览",
            "### 2.2 查询逻辑\n\n- **不要求**顶栏选客户；全厂产线总览",
        )
    path.write_text(text, encoding="utf-8")


def main():
    for ver in ("v1.3.0", "v1.4.0"):
        patch_annotation(ROOT / ver / "js/annotation-spec-data.js")

    patch_scope(
        ROOT / "v1.3.0/js/annotation-spec-scope.js",
        "v1.3.0",
        "1.3.0 版",
        [{"id": "06", "title": "经营分析"}],
    )
    patch_scope(
        ROOT / "v1.4.0/js/annotation-spec-scope.js",
        "v1.4.0",
        "1.4.0 版",
        None,
    )
    # add capacity/biz/inventory/payment to v1.3 scope if missing
    s13 = (ROOT / "v1.3.0/js/annotation-spec-scope.js").read_text(encoding="utf-8")
    for nid in [
        "card-capacity",
        "card-capacity-block-detail",
        "card-biz-analysis",
        "card-biz-analysis-insight",
    ]:
        if f"'{nid}'" not in s13:
            s13 = s13.replace(
                "    'card-order-progress-detail'\n  ]",
                "    'card-order-progress-detail',\n"
                "    'card-capacity',\n"
                "    'card-capacity-block-detail',\n"
                "    'card-biz-analysis',\n"
                "    'card-biz-analysis-insight'\n  ]",
            )
    (ROOT / "v1.3.0/js/annotation-spec-scope.js").write_text(s13, encoding="utf-8")

    patch_delivery_func_desc(ROOT / "v1.4.0/功能描述-交期与订单运营-v1.4.0.md")
    patch_biz_func_desc(ROOT / "v1.4.0/功能描述-经营分析-v1.4.0.md")
    write_v13_biz_func_desc()

    v13_delivery = ROOT / "v1.3.0/功能描述-交期与订单运营-v1.3.0.md"
    text = v13_delivery.read_text(encoding="utf-8")
    if "本版无查看订单进度" not in text:
        text += "\n\n## 8. v1.3.0 与 v1.4.0 对齐说明\n\n交期结果卡 **已移除查看订单进度**；调整方案回显评审表单。其余 §3～§6 见 v1.4.0 文档。\n"
    v13_delivery.write_text(text, encoding="utf-8")

    patch_annotation_doc_05(ROOT / "v1.3.0/annotation-docs/05-交期与订单运营.md", "v1.3.0")
    patch_annotation_doc_05(ROOT / "v1.4.0/annotation-docs/05-交期与订单运营.md", "v1.4.0")

    for ver in ("v1.3.0", "v1.4.0"):
        idx = ROOT / ver / "index.html"
        t = idx.read_text(encoding="utf-8")
        t = re.sub(
            r"annotation-spec-data\.js\?v=[^\"]+",
            "annotation-spec-data.js?v=20260615c",
            t,
        )
        t = re.sub(
            r"annotation-spec-scope\.js\?v=[^\"]+",
            "annotation-spec-scope.js?v=20260615c",
            t,
        )
        idx.write_text(t, encoding="utf-8")

    print("done")


if __name__ == "__main__":
    main()
