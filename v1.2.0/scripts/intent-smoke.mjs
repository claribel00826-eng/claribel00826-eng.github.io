/**
 * 意图/语音能力静态校验 + DemoData 可测逻辑（无需浏览器）
 * 运行：node scripts/intent-smoke.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import vm from 'vm';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

function loadDemoData() {
  const code = fs.readFileSync(path.join(root, 'js/demo-data.js'), 'utf8');
  const ctx = { window: {} };
  vm.runInContext(code + '\n;globalThis.DemoData = window.DemoData;', vm.createContext(ctx));
  return ctx.window.DemoData;
}

function loadSlotGuideKeys() {
  const code = fs.readFileSync(path.join(root, 'js/skills.js'), 'utf8');
  const m = code.match(/const SLOT_GUIDES = \{([\s\S]*?)\n  \};/);
  if (!m) return [];
  const keys = [];
  const re = /^\s{4}(\w+):\s*\{/gm;
  let hit;
  while ((hit = re.exec(m[1]))) keys.push(hit[1]);
  return keys;
}

function loadSkillsExports() {
  const code = fs.readFileSync(path.join(root, 'js/skills.js'), 'utf8');
  const checks = [
    ['tryPlanTemplateUtterance', /function tryPlanTemplateUtterance/],
    ['tryQuoteTemplateUtterance', /function tryQuoteTemplateUtterance/],
    ['tryPlanCartUtterance', /function tryPlanCartUtterance/],
    ['tryQuoteSourceUtterance', /function tryQuoteSourceUtterance/],
    ['tryOrderSourceUtterance', /function tryOrderSourceUtterance/],
    ['tryActivePickListUtterance', /function tryActivePickListUtterance/],
    ['tryViewSchemeHistory', /function tryViewSchemeHistory/],
    ['tryViewQuoteHistory', /function tryViewQuoteHistory/],
    ['history-view-scheme', /history-view-scheme/],
    ['history-view-quote', /history-view-quote/],
    ['parsePickListIndex', /function parsePickListIndex/],
    ['guideMissingSlot 【待填写】', /【待填写】/],
  ];
  return checks.map(([name, re]) => ({ name, ok: re.test(code) }));
}

const EXPECTED_SLOT_KEYS = [
  'customer',
  'intentNeedFeature',
  'planDemand',
  'planPickProducts',
  'planCartEmpty',
  'planTemplate',
  'quoteSource',
  'quoteNoScheme',
  'quoteSchemePick',
  'quotePickProducts',
  'quoteLinePrice',
  'quoteTemplate',
  'orderSource',
  'orderNoQuotes',
  'orderQuotePick',
  'orderPickProducts',
  'orderLinePrice',
  'orderDetail',
  'productMatchFail'
];

function parsePickListIndex(text) {
  const t = (text || '').trim().replace(/\s+/g, '');
  if (!t) return null;
  const digitMap = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5 };
  function parseToken(tok) {
    if (/^\d+$/.test(tok)) return parseInt(tok, 10);
    if (tok === '十') return 10;
    return digitMap[tok] || null;
  }
  let m =
    t.match(/^第?([一二三四五六七八九十\d]{1,3})[个项条行]?$/) ||
    t.match(/^选(?:第)?([一二三四五六七八九十\d]{1,3})[个项条行]?$/) ||
    t.match(/^([1-9]\d*)$/);
  if (!m) return null;
  const n = parseToken(m[1]);
  return n >= 1 ? n : null;
}

let passed = 0;
let failed = 0;

function ok(label) {
  passed++;
  console.log('  ✓ ' + label);
}

function fail(label, detail) {
  failed++;
  console.log('  ✗ ' + label + (detail ? ' — ' + detail : ''));
}

console.log('\n=== 1. SLOT_GUIDES 键与意图钉缺槽一致 ===\n');
const keys = loadSlotGuideKeys();
EXPECTED_SLOT_KEYS.forEach((k) => {
  if (keys.includes(k)) ok('SLOT_GUIDES.' + k);
  else fail('缺少 SLOT_GUIDES.' + k);
});

console.log('\n=== 2. skills.js 关键实现存在 ===\n');
loadSkillsExports().forEach(({ name, ok: isOk }) => {
  if (isOk) ok(name);
  else fail(name);
});

console.log('\n=== 3. DemoData 客户模糊搜索 ===\n');
const DemoData = loadDemoData();
const customers = DemoData.customers.filter((c) => c.enterpriseId === 'ent-east');
const hit1 = DemoData.findCustomerByQuery('精机', customers);
if (hit1 && hit1.name.includes('精密')) ok('「精机」→ ' + hit1.name);
else fail('「精机」模糊匹配');

const hit2 = DemoData.findCustomerByQuery('创源', customers);
if (hit2 && hit2.id === 'c3') ok('「创源」→ ' + hit2.name);
else fail('「创源」模糊匹配');

console.log('\n=== 4. 序号解析（方案/报价单/模板语音） ===\n');
[
  ['第2条', 2],
  ['选第二个', 2],
  ['2', 2],
  ['第1个', 1]
].forEach(([text, want]) => {
  const n = parsePickListIndex(text);
  if (n === want) ok(text + ' → ' + n);
  else fail(text, 'got ' + n);
});

console.log('\n=== 5. 标注 HTML 结构 ===\n');
const spec = fs.readFileSync(path.join(root, 'js/annotation-spec-data.js'), 'utf8');
if (spec.includes('方案速配') && spec.includes('2. 缺槽引导') && !spec.includes('<th>必填</th>'))
  ok('意图钉：分功能缺槽表、无「必填」列');
else fail('意图钉结构');

if (spec.includes('方案预览卡') && spec.includes('预览方案')) ok('方案预览缺槽字段文案');
else fail('方案预览缺槽字段');

const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
if (
  !html.includes('plan-template-voice-bar') &&
  !html.includes('quote-template-voice-bar') &&
  !html.includes('quote-setup-voice-bar')
)
  ok('index.html 抽屉无底部输入条');
else fail('index.html 仍含抽屉语音条');

console.log('\n=== 结果 ===');
console.log('通过 ' + passed + '，失败 ' + failed + '\n');
process.exit(failed > 0 ? 1 : 0);
