import fs from 'fs';

const p = 'D:/工作文件/vibecoding/claribel00826-eng.github.io/v1.2.0/js/annotation-spec-data.js';
let s = fs.readFileSync(p, 'utf8');
const start = s.indexOf("  'sheet-order': {");
const end = s.indexOf("  'card-order-success':", start);
const block = `  'sheet-order': {
    name: '确认下单卡',
    module: '1.4.7',
    content: [
      '【一、展示与口径】',
      '【·概览】',
      '1. 对话内 cards「确认下单」，表头 + 明细行均可编辑关键字段',
      '2. 订单摘要 | 客户（名称、编码）、订单来源',
      '3. 交期 | 本会话已评审时展示结论、期望交期、计划区间（只读）',
      '4. 订单信息 | 结算客户、结算方式、结算货币、发货日期；「更多表头信息」可展开',
      '5. 明细 | 每行默认展开：浅灰信息区（可用量/现存量、规格、单位）；工艺版本、数量、单价、税率、要货时间可改',
      '6. 合计 | 订单总金额',
      '【三、交互】',
      '1. 「确认下单」→ 写入订单库（状态**待排产**）→ **订单成功卡**',
    ],
    query: [],
    interaction: []
  },
`;
s = s.slice(0, start) + block + s.slice(end);
fs.writeFileSync(p, s);
