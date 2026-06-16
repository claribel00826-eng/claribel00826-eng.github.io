import fs from 'fs';
import path from 'path';

const root = path.resolve(import.meta.dirname, '..');
const cssPath = path.join(root, 'v1.3.0/css/main.css');
const v14 = fs.readFileSync(path.join(root, 'v1.4.0/css/main.css'), 'utf8');
const start = v14.indexOf('/* --- 产能分析');
const block = v14.slice(start);
const extra = `
/* --- 交期来源分组 --- */
.sc-card--delivery-source .sc-plan-entry__group-label {
  margin: 8px 12px 4px;
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-muted);
}
.sc-card--historical-order-pick .sc-copy-order-pick-list {
  max-height: 360px;
  overflow-y: auto;
}
/* --- 进度详情宽表 --- */
.sc-progress-detail__table-wrap {
  overflow-x: auto;
  margin: 0 8px 10px;
}
.sc-progress-detail__table {
  min-width: 720px;
}
.sc-progress-detail__summary {
  margin: 0 8px 10px;
}
.sc-progress-detail__timeline-title {
  margin: 12px 8px 6px;
  font-size: 13px;
  font-weight: 600;
}
/* --- 库存列表 --- */
.sc-inventory-list {
  margin: 0 8px 10px;
  max-height: 360px;
  overflow-y: auto;
}
.sc-inventory-list__item {
  padding: 10px 8px;
  border-bottom: 1px solid #f0f0f0;
}
.sc-inventory-list__line1 {
  display: flex;
  align-items: baseline;
  gap: 8px;
  font-size: 14px;
}
.sc-inventory-list__code {
  font-size: 11px;
  color: var(--color-text-muted);
}
.sc-inventory-list__line2 {
  margin-top: 4px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.sc-inventory-list__sku {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: var(--color-text-muted);
}
.sc-inventory-list__avail--warn {
  color: #ea580c;
  font-weight: 600;
}
/* --- 回款指标 --- */
.sc-payment-metrics {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin: 0 8px 10px;
}
.sc-payment-metrics__item {
  padding: 10px;
  background: #fafafa;
  border-radius: 8px;
  border: 1px solid #f0f0f0;
}
.sc-payment-metrics__label {
  display: block;
  font-size: 11px;
  color: var(--color-text-muted);
  margin-bottom: 4px;
}
.sc-payment-metrics__value {
  font-size: 15px;
  font-weight: 600;
}
.sc-payment-metrics__value--warn { color: #ea580c; }
.sc-payment-metrics__value--pos { color: #16a34a; }
.sc-payment-metrics__sub {
  display: block;
  font-size: 10px;
  color: var(--color-text-muted);
  margin-top: 2px;
}
.sc-payment-hint {
  margin: 0 12px 8px;
  font-size: 11px;
  color: var(--color-text-muted);
}
`;
let cur = fs.readFileSync(cssPath, 'utf8');
if (!cur.includes('sc-card--capacity')) {
  fs.writeFileSync(cssPath, cur.trimEnd() + '\n\n' + block + '\n' + extra + '\n');
  console.log('css appended');
} else {
  console.log('css already has capacity');
}
