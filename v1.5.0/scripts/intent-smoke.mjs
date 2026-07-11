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

if (spec.includes('购买数量、规格（加购后在此调整）')) ok('购物车缺槽字段文案');
else fail('购物车缺槽字段');

const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
if (html.includes('plan-template-voice-bar') && html.includes('quote-template-voice-bar'))
  ok('index.html 双模板语音条');
else fail('index.html 模板语音条');

function loadIntentMatch() {
  const ctx = { window: {} };
  const context = vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(root, 'js/intent-qa.generated.js'), 'utf8'), context);
  vm.runInContext(fs.readFileSync(path.join(root, 'js/intent-match.js'), 'utf8'), context);
  return ctx.window.IntentMatch;
}

function namesOf(match, text) {
  return match.matchMainFunctions(text).map((x) => x.name).sort();
}

console.log('\n=== 6. QA 主功能匹配（方案 C · Excel 词典） ===\n');
const IntentMatch = loadIntentMatch();
const IntentQa = (() => {
  const ctx = { window: {} };
  vm.runInContext(fs.readFileSync(path.join(root, 'js/intent-qa.generated.js'), 'utf8'), vm.createContext(ctx));
  return ctx.window.IntentQa;
})();

if (IntentQa && IntentQa.pairs && IntentQa.pairs.length > 0) {
  ok('intent-qa.generated.js 已加载 · pairs=' + IntentQa.pairs.length);
} else {
  fail('intent-qa.generated.js 无 pairs');
}

let pairMiss = 0;
IntentQa.pairs.forEach(({ q, a }) => {
  const got = namesOf(IntentMatch, q);
  if (!got.includes(a)) {
    pairMiss++;
    if (pairMiss <= 5) fail('Q→A 行：「' + q + '」应含 ' + a, 'got ' + got.join(','));
  }
});
if (pairMiss === 0) ok('全部 ' + IntentQa.pairs.length + ' 行 Q 自匹配含对应 A');
else if (pairMiss > 5) fail('另有 ' + (pairMiss - 5) + ' 行 Q 自匹配失败');

(IntentQa.multiQ || []).forEach(({ q, a: want }) => {
  const got = namesOf(IntentMatch, q);
  const wantSorted = [...want].sort();
  const same =
    got.length === wantSorted.length && got.every((x, i) => x === wantSorted[i]);
  if (same) ok('多 A：「' + q + '」→ ' + wantSorted.join(' + '));
  else fail('多 A：「' + q + '」', 'want ' + wantSorted.join(',') + ' got ' + got.join(','));
});

[
  ['加购', []],
  ['第2条', []],
  ['筛选 伺服', []],
  ['确认需求', []],
  ['下一步：逐项报价', []],
  ['保存这个方案', []],
  ['伺服电机 报价 4200', []]
].forEach(([text, want]) => {
  const got = namesOf(IntentMatch, text);
  const same =
    got.length === want.length && got.every((x, i) => x === [...want].sort()[i]);
  if (same) ok('流程内不误召回：「' + text + '」');
  else fail('流程内误召回：「' + text + '」', 'got ' + got.join(','));
});

[
  ['配个方案', ['方案速配']],
  ['给华东精密报价', ['产品报价']],
  ['切换客户到华东精密', ['切换客户']],
  ['还能接单吗', ['产能分析', '交期评审']],
  ['配个方案并报价', ['方案速配', '产品报价']]
].forEach(([text, want]) => {
  const got = namesOf(IntentMatch, text);
  const wantSorted = [...want].sort();
  const okAll = wantSorted.every((a) => got.includes(a));
  const sameSize = got.length === wantSorted.length;
  if (okAll && sameSize) ok('召回：「' + text + '」=' + wantSorted.join(' + '));
  else fail('召回：「' + text + '」', 'want ' + wantSorted.join(',') + ' got ' + got.join(','));
});

console.log('\n=== 结果 ===');
console.log('通过 ' + passed + '，失败 ' + failed + '\n');
process.exit(failed > 0 ? 1 : 0);
