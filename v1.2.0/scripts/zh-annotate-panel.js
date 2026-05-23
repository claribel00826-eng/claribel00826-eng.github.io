/**
 * 将 annotation-spec-data.js 中 content / extraHtml 的面板文案改为中文（不改编码键名行）
 */
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '../js/annotation-spec-data.js');
let text = fs.readFileSync(file, 'utf8');

const header = `/** 本版标注数据（面板文案均为中文）。编写规范：.output/标注编写规范.md */
/** content 结构：【定位】→【查询】→【校验】→【数据处理】→【操作】（业务语言，禁止英文单词与代码标识） */
/**   意图路由与分步缺槽仅在意图钉；输入通道见《用户输入与意图填槽需求》 */
/** 客户类型判定涉及：选客户抽屉、方案选品卡、待补充需求卡 */

`;

text = text.replace(/^\/\*\*[\s\S]*?\*\/\n\nwindow/s, header + 'window');

/** 仅替换引号字符串内的片段（含 extraHtml 拼接行） */
function replaceInStrings(src, pairs) {
  let out = '';
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (ch === "'" || ch === '`') {
      const q = ch;
      let j = i + 1;
      let body = '';
      while (j < src.length) {
        if (src[j] === '\\') {
          body += src[j] + (src[j + 1] || '');
          j += 2;
          continue;
        }
        if (src[j] === q) {
          for (const [from, to] of pairs) {
            if (typeof from === 'string') {
              body = body.split(from).join(to);
            } else {
              body = body.replace(from, to);
            }
          }
          out += q + body + q;
          i = j + 1;
          break;
        }
        body += src[j];
        j++;
      }
      if (j >= src.length) {
        out += q + body;
        break;
      }
      continue;
    }
    out += ch;
    i++;
  }
  return out;
}

const pairs = [
  ['`activeCustomerId`', '当前客户标识'],
  ['`sheet-customer`', '选客户抽屉'],
  ['`DemoData.customers`', '演示客户库'],
  ['`DemoData`', '演示数据'],
  ['`data-action`', '卡片操作按钮'],
  ['`#messages`', '对话消息容器'],
  ['`.sc-msg`', '单条消息块'],
  ['`schemesForCustomer(当前客户)`', '按当前客户查询方案列表'],
  ['`schemesForCustomer`', '按客户查方案列表'],
  ['`quotesForCustomer`', '按客户查报价单列表'],
  ['`seedDemoHistoryIfEmpty`', '演示补种历史样例'],
  ['`setActivePickList(scheme, list, view)`', '写入方案列表状态（查看模式）'],
  ['`setActivePickList(scheme, list, quote)`', '写入方案列表状态（报价模式）'],
  ['`setActivePickList(quote, list, order)`', '写入报价单列表状态（下单模式）'],
  ['`setActivePickList(quote, list, view)`', '写入报价单列表状态（查看模式）'],
  ['`card-scheme-pick`', '选择方案卡'],
  ['`card-quote-select`', '选择报价单卡'],
  ['`card-quote-pick`', '选品报价卡'],
  ['`resetPlanDraftForCreate`', '清空并初始化方案新建草稿'],
  ['`awaitingDemand=true`', '标记待补充需求'],
  ['`awaitingDemand=false`', '取消待补充需求标记'],
  ['`planSkillAtEntry=true`', '标记仍在方案入口分支'],
  ['`quoteSkillAtEntry`', '报价入口分支标记'],
  ['`pushQuoteHistoryView`', '插入历史报价单列表'],
  ['`quoteDirectStart`', '直选报价起步'],
  ['`quoteFromScheme`', '按已选方案进入报价'],
  ['`pushSchemePickForQuote`', '插入选择方案卡'],
  ['`persistScheme`', '保存方案到库'],
  ['`publishQuoteFromSchemeDemand`', '按待命口令生成报价'],
  ['`pendingSchemeQuoteDemand`', '一句话报价待命状态'],
  ['`clearActivePickList`', '清除列表选择状态'],
  ['`activeSchemeId`', '当前选中方案标识'],
  ['`quote.lines`', '报价明细行'],
  ['`applyOrderFromQuote`', '按报价单载入下单'],
  ['`matchSchemesByAttributes`', '按方案属性匹配'],
  ['`parseSchemeViewAttributes`', '解析查看方案话术属性'],
  ['`matchQuotesByAttributes`', '按报价单属性匹配'],
  ['`runOrderByQuoteEntry`', '按报价单入口处理下单'],
  ['`orderDirectStart`', '直选下单起步'],
  ['`persistQuote`', '保存报价单'],
  ['`quoteId`', '报价单标识'],
  ['`pushNextAiCard`', '插入下一张助手业务卡'],
  ['`enterSkill`', '进入功能流程'],
  ['`clearSkillContext`', '清空流程上下文'],
  ['`templateId`', '模板标识'],
  ['`templateName`', '模板名称'],
  ['`scheme.id`', '方案标识'],
  ['`customerId`', '客户标识'],
  ['`activeCustomer.id`', '当前客户标识'],
  ['`ctx.schemes`', '会话方案库'],
  ['`ctx.plan`', '方案流程草稿'],
  ['`ctx.quote`', '报价流程草稿'],
  ['`ctx.quote.selected`', '报价草稿已选品'],
  ['`scheme.lines`', '方案明细行'],
  ['`order.lines`', '订单明细行'],
  ['`quote.lines[].quotePrice`', '报价行单价'],
  ['plan/quote/order', '方案/报价/下单流程'],
  ['plan/quote', '方案/报价流程'],
  [' plan ', ' 方案流程 '],
  [' quote ', ' 报价流程 '],
  [' order ', ' 下单流程 '],
  ['plan.demandText', '方案草稿需求正文'],
  ['plan.selected', '方案已选品'],
  ['plan.lines', '方案预览明细'],
  ['plan.selected', '方案已勾选品项'],
  ['quote.selected', '报价已选品'],
  ['quote.sku', '报价规格'],
  ['quote.lines', '报价明细'],
  ['activePickList', '当前列表选择状态'],
  ['activePickList.mode', '列表模式（查看/报价/下单）'],
  ['activePickList.ids', '列表序号对应记录标识'],
  ['activePickList.ids[N-1]', '列表第 N 条对应标识'],
  ['type=scheme', '类型=方案'],
  ['mode=quote|view', '模式=报价或查看'],
  ['mode=view', '模式=查看'],
  ['mode=quote', '模式=报价'],
  ['quoteSchemePick', '选择要报价的方案'],
  ['orderQuotePick', '选择要下单的报价单'],
  ['tryIntent', '意图识别'],
  ['reverse()', '倒序'],
  ['reverse()，', '倒序，'],
  ['toast', '轻提示'],
  ['disabled', '置灰不可点'],
  [' Tab ', ' 标签页 '],
  ['Tab 顺序', '标签页顺序'],
  ['Tab 首位', '标签页首位'],
  ['Tab：', '标签页：'],
  ['往来类型 Tab', '往来类型标签页'],
  ['SKU ', '规格选项 '],
  [' SKU', ' 规格选项'],
  ['HTML ', '网页版式 '],
  [' HTML', ' 网页版式'],
  ['channel C', '点击推进通道'],
  ['通道 C', '点击推进通道'],
  ['xxx', '某名称'],
  ['PL…', '方案编号…'],
  ['PL编号', '方案编号'],
  ['PL 编号', '方案编号'],
  ['QT…', '报价单号…'],
  ['QT编号', '报价单号'],
  [' QT', ' 报价单号'],
  ['length=1', '仅一条'],
  ['pool.length', '候选条数'],
  ['≥2 字', '至少 2 字'],
  ['忽略大小写', '不区分大小写'],
  ['quote-pick-scheme', '点选方案行'],
  ['history-view-scheme', '查看历史方案'],
  ['history-view-quote', '查看历史报价单'],
  ['.output/', '《'],
  ['用户输入与意图填槽需求.md', '用户输入与意图填槽需求》'],
  ['用户输入与意图填槽需求.md §2.5', '用户输入与意图填槽需求》§2.5'],
  ['见 sheet-customer', '见选客户抽屉'],
  ['（见 sheet-customer）', '（见选客户抽屉）'],
  ['sheet-customer）；', '选客户抽屉）；'],
  ['S4～S6', '第4～6步'],
  ['S3b～S5', '第3b～5步'],
  ['S3a', '第3a步'],
  ['S3b', '第3b步'],
  ['→S4', '→第4步'],
  ['→S3a', '→第3a步'],
  ['→S5', '→第5步'],
  ['唯一→S4', '唯一→第4步'],
  ['唯一→S5', '唯一→第5步'],
  ['仅匹配项', '仅匹配项'],
  ['主数据集：`schemesForCustomer(activeCustomer.id)`', '主数据集：按当前客户查方案列表'],
  ['`schemesForCustomer(activeCustomer.id)`', '按当前客户查方案列表'],
  ['`quotesForCustomer(activeCustomer.id)`', '按当前客户查报价单列表'],
  ['`schemesForCustomer(当前客户).length`', '当前客户方案数量'],
  ['`quotesForCustomer.length`', '当前客户报价单数量'],
  ['`quotes`', '报价单库'],
  ['`scheme`', '方案记录'],
  ['`scheme.templateName`', '方案模板名'],
  ['`templateName`', '模板名称'],
  ['`id`', '编号'],
  ['`id`，', '编号，'],
  ['`filter`', '筛选词'],
  ['`sku`', '规格'],
  ['`qty`', '数量'],
  ['`selected`', '已选品'],
  ['`demandText`', '需求正文'],
  ['`awaitingDemand`', '待补充需求标记'],
  ['`activeSchemeId`', '当前方案标识'],
  ['`quoteFromScheme`', '按方案进入报价'],
  ['`quoteDirectStart`', '直选报价'],
  ['`orderDirectStart`', '直选下单'],
  ['`pushSchemePickForQuote`', '出选择方案卡'],
  ['`card-scheme-pick`', '选择方案卡'],
  ['`card-quote-select`', '选择报价单卡'],
  ['`card-quote-pick`', '选品报价卡'],
  ['`card-order-pick`', '订单选品卡'],
  ['enterSkill(quote)', '进入产品报价流程'],
  ['enterSkill(order)', '进入确认下单流程'],
  ['`enterSkill(quote)`', '进入产品报价流程'],
  ['`enterSkill(order)`', '进入确认下单流程'],
  ['`clearSkillContext` 类清空后从目标功能 S1 开始', '清空流程上下文后从目标功能第1步开始'],
  ['从目标功能 S1 开始', '从目标功能第1步开始'],
  ['详见 .output/用户输入与意图填槽需求.md', '详见《用户输入与意图填槽需求》'],
  ['见 .output/用户输入与意图填槽需求.md', '见《用户输入与意图填槽需求》'],
  ['见 .output 文档', '见《用户输入与意图填槽需求》'],
  ['主流程见 card-quote-pick 下单模式', '主流程见选品报价卡（下单模式）'],
  ['意图钉 quoteSchemePick', '意图钉·选择方案缺槽'],
  ['意图钉 orderQuotePick', '意图钉·选择报价单缺槽'],
  ['属性解析与 tryIntent 顺序见', '属性解析与意图识别顺序见'],
  ['Σ(', '合计（'],
  ['N-1', '第N条'],
];

// extraHtml 步骤代号
const stepPairs = [
  ["<tr><td>S1</td>", "<tr><td>第1步</td>"],
  ["<tr><td>S1.5</td>", "<tr><td>第1.5步</td>"],
  ["<tr><td>S2</td>", "<tr><td>第2步</td>"],
  ["<tr><td>S3</td>", "<tr><td>第3步</td>"],
  ["<tr><td>S4</td>", "<tr><td>第4步</td>"],
  ["<tr><td>S5</td>", "<tr><td>第5步</td>"],
  ["<tr><td>S6</td>", "<tr><td>第6步</td>"],
  ["<tr><td>S3a</td>", "<tr><td>第3a步</td>"],
  ["<tr><td>S3b</td>", "<tr><td>第3b步</td>"],
  ["<tr><td>S4～S6</td>", "<tr><td>第4～6步</td>"],
  ["<tr><td>S3b～S5</td>", "<tr><td>第3b～5步</td>"],
  ['见 sheet-customer', '见选客户抽屉'],
  ['筛选 xxx', '筛选某关键词'],
  ['预览方案 PL 编号', '预览方案（报方案编号）'],
  ['PL编号；', '方案编号；'],
  ['QT编号 /', '报价单号 /'],
  ['不自动</strong>开 PDF', '不自动</strong>开版式预览'],
  ['点卡内「预览 PDF」', '点卡内「预览 PDF」'], // UI 保留
];

let body = text.slice(header.length);
body = replaceInStrings(body, pairs);
for (const [a, b] of stepPairs) {
  body = body.split(a).join(b);
}

fs.writeFileSync(file, header + body, 'utf8');
console.log('done:', file);
