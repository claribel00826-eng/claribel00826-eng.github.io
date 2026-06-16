#!/usr/bin/env node
/**
 * Merge post-conversation features into v1.3.0/js/skills.js using _patches/*.new.txt
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SKILLS = path.join(ROOT, 'v1.3.0/js/skills.js');
const PATCH = (name) => path.join(ROOT, '_patches', name);

function readPatch(name) {
  const p = PATCH(name);
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null;
}

function findFunctionEnd(src, startIdx) {
  let depth = 0;
  let started = false;
  for (let i = startIdx; i < src.length; i++) {
    const ch = src[i];
    if (ch === '{') {
      depth++;
      started = true;
    } else if (ch === '}') {
      depth--;
      if (started && depth === 0) return i + 1;
    }
  }
  return -1;
}

function replaceFunction(src, fnName, newBody) {
  const re = new RegExp(`\\n  function ${fnName}\\s*\\(`);
  const m = re.exec(src);
  if (!m) return { src, ok: false };
  const start = m.index + 1;
  const end = findFunctionEnd(src, start);
  if (end < 0) return { src, ok: false };
  return { src: src.slice(0, start) + newBody.trim() + '\n' + src.slice(end), ok: true };
}

function insertBeforeFunction(src, beforeFn, block) {
  const re = new RegExp(`\\n  function ${beforeFn}\\s*\\(`);
  const m = re.exec(src);
  if (!m) return { src, ok: false };
  if (block.trim() && src.includes(block.trim().slice(0, 40))) return { src, ok: true, skipped: true };
  return { src: src.slice(0, m.index + 1) + block + src.slice(m.index + 1), ok: true };
}

function removeFunction(src, fnName) {
  const re = new RegExp(`\\n  function ${fnName}\\s*\\(`);
  const m = re.exec(src);
  if (!m) return { src, ok: false };
  const start = m.index + 1;
  const end = findFunctionEnd(src, start);
  if (end < 0) return { src, ok: false };
  return { src: src.slice(0, start) + src.slice(end), ok: true };
}

function replaceBetween(src, startMarker, endMarker, replacement) {
  const a = src.indexOf(startMarker);
  const b = src.indexOf(endMarker, a + startMarker.length);
  if (a < 0 || b < 0) return { src, ok: false };
  return { src: src.slice(0, a) + replacement + src.slice(b), ok: true };
}

let src = fs.readFileSync(SKILLS, 'utf8');
const log = [];

function apply(name, fn) {
  const r = fn(src);
  if (r.ok) {
    src = r.src;
    log.push(r.skipped ? `SKIP(dup) ${name}` : `OK ${name}`);
  } else log.push(`FAIL ${name}`);
}

// --- Delivery source ---
apply('delivery source block', (s) => {
  const patch = readPatch('../_patch_delivery_source.js.txt');
  if (!patch) return { src: s, ok: false };
  const start = s.indexOf('  function renderDeliverySourceCard(c)');
  const endFn = s.indexOf('  function renderDeliveryQuotePickCard(list)');
  if (start < 0 || endFn < 0) return { src: s, ok: false };
  return { src: s.slice(0, start) + patch.trim() + '\n\n' + s.slice(endFn), ok: true };
});

apply('renderDeliveryOrderPickCard', (s) => {
  let body = readPatch('renderDeliveryOrderPickCard.new.txt');
  if (!body) return { src: s, ok: false };
  body = body.replace(/\s*\+\s*orderStatusBadgeHtml\(o\.status\)\s*\+/g, ' +');
  return replaceFunction(s, 'renderDeliveryOrderPickCard', body);
});

apply('renderDeliverySchemePickCard insert', (s) => {
  const block = readPatch('renderDeliveryQuotePickCard.new.txt');
  if (!block || s.includes('function renderDeliverySchemePickCard')) return { src: s, ok: !!s.includes('function renderDeliverySchemePickCard') };
  const anchor = '  function renderDeliveryQuotePickCard(list)';
  const idx = s.indexOf(anchor);
  if (idx < 0) return { src: s, ok: false };
  return { src: s.slice(0, idx) + block.trim() + '\n\n' + s.slice(idx), ok: true };
});

apply('deliveryOpenFormForOrder+Scheme', (s) =>
  replaceFunction(s, 'deliveryOpenFormForOrder', readPatch('deliveryOpenFormForOrder.new.txt'))
);

apply('openDeliveryForm+adjust', (s) =>
  replaceFunction(s, 'openDeliveryForm', readPatch('openDeliveryForm.new.txt'))
);

apply('delivery lines helpers', (s) => {
  const block = readPatch('renderDeliveryLinesProcessSection.new.txt');
  if (!block) return { src: s, ok: false };
  const anchor = '  function renderDeliveryLinesProcessSection(lines)';
  if (s.includes('function deliveryDefaultExpectedDate')) {
    return replaceFunction(s, 'renderDeliveryLinesProcessSection', block.split('function renderDeliveryLinesProcessSection')[1] ? block : block);
  }
  const idx = s.indexOf(anchor);
  if (idx < 0) return insertBeforeFunction(s, 'renderDeliveryLinesProcessSection', block);
  const helpers = block.split('  function renderDeliveryLinesProcessSection')[0];
  return { src: s.slice(0, idx) + helpers + s.slice(idx), ok: true };
});

apply('renderDeliveryFormCard', (s) => {
  const body = `  function renderDeliveryFormCard() {
    const meta = ctx().deliveryPending || {};
    const lines = ensureDeliveryPendingLines(meta);
    const wantProc =
      meta.generateProcurementPlan != null ? !!meta.generateProcurementPlan : true;
    const procOpts = (DemoData.procurementPlanOptions || [
      { value: 'yes', label: '是' },
      { value: 'no', label: '否' }
    ])
      .map(function (o) {
        const checked = (o.value === 'yes' && wantProc) || (o.value === 'no' && !wantProc);
        return (
          '<label class="sc-radio-pill"><input type="radio" name="delivery-procurement" value="' +
          App.escapeHtml(o.value) +
          '"' +
          (checked ? ' checked' : '') +
          ' /> ' +
          App.escapeHtml(o.label) +
          '</label>'
        );
      })
      .join('');
    const expectedDefault = deliveryDefaultExpectedDate(meta);
    return (
      '<div class="sc-card sc-card--compact sc-card--inline-form" data-spec-id="sheet-delivery" data-spec-pin-root>' +
      '<div class="sc-card__head sc-card__head--compact">交期评审</div>' +
      renderDeliveryFormSourceBlock(meta, lines) +
      '<label class="sc-field-label">期望交期<span class="sc-field-required">*</span></label>' +
      '<input class="sc-input sc-input--field" data-field="delivery-expected-date" type="date" value="' +
      App.escapeHtml(expectedDefault) +
      '" placeholder="请选择" />' +
      renderDeliveryLinesProcessSection(lines) +
      '<label class="sc-field-label">是否生成采购计划</label>' +
      '<div class="sc-radio-group sc-radio-group--inline">' +
      procOpts +
      '</div>' +
      '<div class="sc-card__actions-inline"><button type="button" class="sc-btn sc-btn--primary" data-action="delivery-submit">提交评审</button></div>' +
      '</div>'
    );
  }`;
  return replaceFunction(s, 'renderDeliveryFormCard', body);
});

apply('deliverySummaryLabel scheme', (s) => {
  const old = `  function deliverySummaryLabel(meta) {
    if (!meta) return '';
    if (meta.sourceType === 'quote' && meta.quoteId) {
      return '报价单 ' + meta.quoteId + (meta.total != null ? ' · ' + fmtMoney(meta.total) : '');
    }
    if (meta.sourceType === 'order' && meta.orderNo) {
      return '订单 ' + meta.orderNo + ' · ' + App.escapeHtml(meta.orderStatus || '');
    }`;
  const neu = `  function deliverySummaryLabel(meta) {
    if (!meta) return '';
    if (meta.sourceType === 'scheme' && meta.schemeId) {
      return '方案 ' + (meta.schemeName || meta.schemeId);
    }
    if (meta.sourceType === 'quote' && meta.quoteId) {
      return '报价单 ' + meta.quoteId + (meta.total != null ? ' · ' + fmtMoney(meta.total) : '');
    }
    if (meta.sourceType === 'order' && meta.orderNo) {
      return '订单 ' + meta.orderNo + (meta.requiredDeliveryDate ? ' · 要求交期 ' + String(meta.requiredDeliveryDate).replace(/-/g, '/') : '');
    }`;
  if (!s.includes(old)) return { src: s, ok: false };
  return { src: s.replace(old, neu), ok: true };
});

apply('deliveryOpenFormForOrder requiredDate', (s) => {
  const old = `      orderStatus: o.status,
      lines: (o.lines || []).length ? o.lines : null,
      productIds: o.productIds`;
  const neu = `      orderStatus: o.status,
      requiredDeliveryDate: o.requiredDeliveryDate || o.shipDate || null,
      lines: (o.lines || []).length ? o.lines : null,
      productIds: o.productIds`;
  if (!s.includes(old)) return { src: s, ok: false };
  return { src: s.replace(old, neu), ok: true };
});

apply('formatDeliveryBlocker block', (s) => {
  const block = readPatch('../_patch_blocker.js.txt');
  if (!block) return { src: s, ok: false };
  const start = s.indexOf('  function formatDeliveryBlockerLine');
  const end = s.indexOf('  function submitDelivery()');
  if (start < 0 || end < 0) return { src: s, ok: false };
  let fixed = block.replace(
    /sameOrder && orderNo[\s\S]*?'<\/p>'\s*:\s*'';/,
    "false ? '' : '';"
  );
  return { src: s.slice(0, start) + fixed.trim() + '\n\n' + s.slice(end), ok: true };
});

apply('renderDeliveryResultCard', (s) => {
  const body = `  function renderDeliveryResultCard(delivery) {
    const d = delivery || ctx().delivery || {};
    const ok = d.onTime != null ? !!d.onTime : d.status === '按期';
    const badge = ok ? 'sc-badge--new' : 'sc-badge--old';
    const src = d.sourceType || 'quote';
    const byOrder = src === 'order';
    const oidAttr = d.orderId ? ' data-oid="' + App.escapeHtml(d.orderId) + '"' : '';
    const procLabel = d.generateProcurementPlan ? '是' : '否';
    const fmtDate = function (v) {
      return App.escapeHtml((v || '').replace(/-/g, '/'));
    };
    const verdictHtml =
      '<p class="sc-delivery-result__verdict ' +
      (ok ? 'sc-delivery-result__verdict--ok' : 'sc-delivery-result__verdict--warn') +
      '"><strong>' +
      App.escapeHtml(d.verdict || (ok ? '可以按时交付' : '无法按时交付')) +
      '</strong></p>' +
      (d.detail ? '<p class="sc-card__meta">' + App.escapeHtml(d.detail) + '</p>' : '');
    let primaryBtn = '';
    let adjustBtn = '';
    if (ok) {
      primaryBtn = byOrder
        ? ''
        : '<button type="button" class="sc-btn sc-btn--primary" data-action="delivery-to-order">生成订单</button>';
    } else {
      primaryBtn =
        '<button type="button" class="sc-btn sc-btn--primary" data-action="delivery-adjust">调整方案</button>';
      adjustBtn =
        '<button type="button" class="sc-btn sc-btn--ghost" data-action="delivery-to-order">仍要生成订单</button>';
    }
    return (
      '<div class="sc-card" data-spec-id="card-delivery">' +
      '<div class="sc-card__head sc-card__head--compact">交期评审 · <span class="sc-badge ' +
      badge +
      '">' +
      App.escapeHtml(d.status || '') +
      '</span></div>' +
      '<div class="sc-card__row sc-card__row--compact">' +
      verdictHtml +
      renderDeliveryBlockersHtml(ok ? [] : d.blockers, d.lines) +
      renderDeliveryResultSummaryHtml(d, procLabel, fmtDate) +
      '<div class="sc-card__actions-inline sc-card__actions-inline--wrap">' +
      primaryBtn +
      adjustBtn +
      '</div></div></div>'
    );
  }`;
  return replaceFunction(s, 'renderDeliveryResultCard', body);
});

apply('submitDelivery blockers lines', (s) => {
  const old = '      renderDeliveryBlockersHtml(ok ? [] : d.blockers)';
  const neu = '      renderDeliveryBlockersHtml(ok ? [] : review.blockers, reviewLines)';
  if (!s.includes(old)) return { src: s, ok: false };
  return { src: s.replace(old, neu), ok: true };
});

// --- Copy / change / progress pick infrastructure ---
apply('copy pick block', (s) => {
  const block = readPatch('renderOrderPickCard.new.txt');
  if (!block) return { src: s, ok: false };
  let out = s;
  if (!out.includes('COPY_ORDER_LIST_PAGE_SIZE')) {
    out = out.replace(
      '  const PLAN_MORE_PAGE_SIZE = 5;',
      '  const PLAN_MORE_PAGE_SIZE = 5;\n  const COPY_ORDER_LIST_PAGE_SIZE = 10;'
    );
  }
  if (out.includes('function ensureCopyPickState')) {
    const idx = out.indexOf('  function renderOrderPickCard(list, action)');
    const end = findFunctionEnd(out, idx);
    const newPick = block.slice(block.indexOf('  function renderOrderPickCard'));
    return { src: out.slice(0, idx) + newPick.trim() + out.slice(end), ok: true };
  }
  return insertBeforeFunction(out, 'renderOrderPickCard', block);
});

apply('progress pick from renderCopyDemand', (s) => {
  const block = readPatch('renderCopyDemandPromptCard.new.txt');
  if (!block || s.includes('function ensureProgressPickState')) return { src: s, ok: s.includes('function ensureProgressPickState') };
  const idx = s.indexOf('  function renderCopyDemandPromptCard(c)');
  if (idx < 0) return insertBeforeFunction(s, 'renderCopyDemandPromptCard', block);
  const helpers = block.split('  function renderCopyDemandPromptCard')[0];
  return { src: s.slice(0, idx) + helpers + s.slice(idx), ok: true };
});

apply('demand helpers copy/progress', (s) => {
  let out = s;
  let ok = false;
  const pairs = [
    [
      `    if (specId === 'card-delivery-demand') {
      const d = ctx().orderDraft;
      return d && d.demandText ? String(d.demandText).trim() : '';
    }
    const plan = ctx().plan;`,
      `    if (specId === 'card-delivery-demand') {
      const d = ctx().orderDraft;
      return d && d.demandText ? String(d.demandText).trim() : '';
    }
    if (specId === 'card-copy-demand') {
      const st = ctx().copyPick;
      return st && st.demandText ? String(st.demandText).trim() : '';
    }
    if (specId === 'card-progress-demand') {
      const st = ctx().progressPick;
      return st && st.demandText ? String(st.demandText).trim() : '';
    }
    const plan = ctx().plan;`
    ],
    [
      `    if (specId === 'card-delivery-demand') return 'delivery-demand-submit';
    return 'plan-demand-submit';`,
      `    if (specId === 'card-delivery-demand') return 'delivery-demand-submit';
    if (specId === 'card-copy-demand') return 'copy-demand-submit';
    if (specId === 'card-progress-demand') return 'progress-demand-submit';
    return 'plan-demand-submit';`
    ],
    [
      `    if (specId === 'card-delivery-demand') return 'delivery-skip-demand';
    return 'plan-skip-demand';`,
      `    if (specId === 'card-delivery-demand') return 'delivery-skip-demand';
    if (specId === 'card-copy-demand') return 'copy-skip-demand';
    if (specId === 'card-progress-demand') return 'progress-skip-demand';
    return 'plan-skip-demand';`
    ]
  ];
  for (const [a, b] of pairs) {
    if (out.includes(a)) {
      out = out.replace(a, b);
      ok = true;
    }
  }
  return { src: out, ok };
});

apply('skip text copy vs plan', (s) => {
  const old = `        skipAction +
        '\">跳过，按最近订单推荐</button></div>'`;
  if (!s.includes(old)) return { src: s, ok: false };
  const neu = `        skipAction +
        '\">' +
        (specId === 'card-copy-demand'
          ? '跳过，展示全部历史订单'
          : specId === 'card-progress-demand'
            ? '跳过，展示全部历史订单'
            : '跳过，按最近订单推荐') +
        '</button></div>'`;
  return { src: s.replace(old, neu), ok: true };
});

apply('runCopy', (s) => replaceFunction(s, 'runCopy', readPatch('runCopy.new.txt')));
apply('runProgress', (s) => replaceFunction(s, 'runProgress', readPatch('runProgress.new.txt')));
apply('openChangeSheet block', (s) => {
  const block = readPatch('../_patch_change.js.txt');
  if (!block) return { src: s, ok: false };
  const start = s.indexOf('  function openChangeSheet(');
  const end = s.indexOf('  function runService()');
  if (start < 0 || end < 0) return { src: s, ok: false };
  return { src: s.slice(0, start) + block.trim() + '\n\n' + s.slice(end), ok: true };
});

apply('pushOrderProgressDetail block', (s) => {
  const block = readPatch('../_patch_progress.js.txt');
  if (!block) return { src: s, ok: false };
  const start = s.indexOf('  function pushOrderProgressDetail(');
  const end = s.indexOf('  function handleDeliveryToOrder()');
  if (start < 0 || end < 0) return { src: s, ok: false };
  return { src: s.slice(0, start) + block.trim() + '\n\n' + s.slice(end), ok: true };
});

apply('remove renderOrderListCard usage', (s) => ({ src: s, ok: true }));

apply('remove service', (s) => {
  let out = s;
  out = removeFunction(out, 'runService').src;
  out = removeFunction(out, 'submitService').src;
  out = out.replace(/\n      case 'service':\n        runService\(\);\n        break;/, '');
  out = out.replace(/\n    submitService,/, '');
  out = out.replace(/\n    if \(action === 'service-submit'\) \{[\s\S]*?\}\n/, '\n');
  out = out.replace(/\n    if \(\/投诉\|售后\|客服\/\.test\(t\)\) \{[\s\S]*?return true;\n    \}/, '');
  return { src: out, ok: true };
});

// --- Business analysis: capacity/inventory/payment from v1.4 + patches ---
apply('runCapacity v1.4', (s) => {
  const v14 = fs.readFileSync(path.join(ROOT, 'v1.4.0/js/skills.js'), 'utf8');
  const m = v14.match(/\n  var CAPACITY_HOUR_WIDTH[\s\S]*?\n  function runCapacity\(\) \{[\s\S]*?\n  \}\n\n  function runInventory/);
  if (!m) return { src: s, ok: false };
  let block = m[0].replace(/\n  function runInventory[\s\S]*$/, '');
  block = block.replace(
    /function runCapacity\(\) \{[\s\S]*?App\.pushAiHtml\([\s\S]*?renderCapacityCard\(data\)\s*\);[\s\S]*?\n  \}/,
    `function runCapacity(opts) {
    opts = opts || {};
    const data = DemoData.capacitySchedule;
    if (!data) {
      App.toast('暂无排程数据');
      return;
    }
    if (opts.simulateUserMsg !== false) simulateUserUtterance(opts.utterance || '产能分析');
    App.pushAiHtml(
      '<p class="sc-reply-lead">为您汇总 <strong>全厂产线</strong> 产能排程：</p>' +
        renderCapacityCard(data)
    );
    rescanAnnotationPins();
  }`
  );
  const start = s.indexOf('  function runCapacity()');
  const end = s.indexOf('  function runInventory()');
  if (start < 0 || end < 0) return { src: s, ok: false };
  return { src: s.slice(0, start) + block.trim() + '\n\n' + s.slice(end), ok: true };
});

apply('capacity helpers in handleAction', (s) => {
  if (s.includes("action === 'capacity-tab'")) return { src: s, ok: true };
  const insert = `
    if (action === 'capacity-tab') {
      switchCapacityTab(btn.closest('[data-spec-id="card-capacity"]'), btn.getAttribute('data-tab'));
      return true;
    }
    if (action === 'capacity-open-block') {
      openCapacityBlockDetail(btn.closest('[data-spec-id="card-capacity"]'), btn.getAttribute('data-occ-id'));
      return true;
    }
    if (action === 'biz-tab') {
      switchBizTab(btn.closest('[data-spec-id="card-biz-analysis"]'), btn.getAttribute('data-tab'));
      return true;
    }
    if (action === 'biz-metric') {
      switchBizMetric(btn.closest('[data-spec-id="card-biz-analysis"]'), btn.getAttribute('data-metric'));
      return true;
    }`;
  const anchor = "    if (action === 'delivery-submit')";
  if (!s.includes(anchor)) return { src: s, ok: false };
  return { src: s.replace(anchor, insert + '\n' + anchor), ok: true };
});

apply('runInventory patch', (s) => replaceFunction(s, 'runInventory', readPatch('runInventory.new.txt') || readPatch('../_patch_inventory.js.txt')));
apply('runPayment patch', (s) => {
  let body = readPatch('runPayment.new.txt');
  if (!body) {
    body = readPatch('../_extract.txt');
    const m = body && body.match(/function formatPaymentMoney[\s\S]*?function runPayment[\s\S]*?\n  \}/);
    body = m ? m[0] : null;
  }
  if (!body) return { src: s, ok: false };
  const start = s.indexOf('  function runPayment()');
  const end = s.indexOf('  function run(skillId)');
  if (start < 0) return replaceFunction(s, 'runPayment', body);
  return { src: s.slice(0, start) + body.trim() + '\n\n' + s.slice(end), ok: true };
});

apply('runBizAnalysis v1.4', (s) => {
  const v14 = fs.readFileSync(path.join(ROOT, 'v1.4.0/js/skills.js'), 'utf8');
  const m = v14.match(/\n  var BIZ_METRICS[\s\S]*?\n  function runBizAnalysis\(\) \{[\s\S]*?\n  \}\n\n  function runPayment/);
  if (!m) return { src: s, ok: false };
  const block = m[0].replace(/\n  function runPayment[\s\S]*$/, '');
  const start = s.indexOf('  function runBizAnalysis()');
  const end = s.indexOf('  function runPayment()');
  if (start < 0 || end < 0) return { src: s, ok: false };
  return { src: s.slice(0, start) + block.trim() + '\n\n' + s.slice(end), ok: true };
});

// --- handleAction delivery/copy/change/progress ---
apply('handleAction delivery', (s) => {
  let out = s;
  const reps = [
    [
      `    if (action === 'delivery-source-quote') {
      beginDeliveryFromQuote(btn.getAttribute('data-quote-id'));
      return true;
    }
    if (action === 'delivery-source-order') {
      beginDeliveryFromOrder(btn.getAttribute('data-oid'));
      return true;
    }`,
      `    if (action === 'delivery-source-scheme') {
      simulateUserUtterance('按方案评估交期');
      beginDeliveryFromScheme(btn.getAttribute('data-scheme-id'));
      return true;
    }
    if (action === 'delivery-scheme-pick') {
      const sid = btn.getAttribute('data-scheme-id');
      const sch = sid ? schemeForActiveCustomer(sid) : null;
      if (sch) deliveryOpenFormForScheme(sch);
      return true;
    }
    if (action === 'delivery-source-quote') {
      simulateUserUtterance('按报价单评估交期');
      beginDeliveryFromQuote(btn.getAttribute('data-quote-id'));
      return true;
    }
    if (action === 'delivery-source-order') {
      simulateUserUtterance('按订单评估交期');
      beginDeliveryFromOrder(btn.getAttribute('data-oid'));
      return true;
    }`
    ],
    [
      `    if (action === 'skill-plan') {
      simulateUserUtterance(utteranceFor('plan'));
      enterSkill('plan');
      showPlanSkillEntry();
      return true;
    }`,
      `    if (action === 'delivery-adjust') {
      simulateUserUtterance('调整交期评审方案');
      adjustDeliveryFromResult();
      return true;
    }
    if (action === 'skill-plan') {
      simulateUserUtterance(utteranceFor('plan'));
      enterSkill('plan');
      showPlanSkillEntry();
      return true;
    }`
    ],
    [
      `    if (action === 'change-pick' && oid) {
      openChangeSheet(oid);
      return true;
    }`,
      `    if (action === 'change-pick' && oid) {
      openChangeSheet(oid, { simulateUserMsg: true });
      return true;
    }
    if (action === 'change-confirm-submit') {
      simulateUserUtterance('确认变更');
      submitChange({ fromConfirm: true });
      return true;
    }
    if (action === 'change-repick-order') {
      simulateUserUtterance('重选订单');
      changeRepickOrder();
      return true;
    }
    if (action === 'copy-pick' && oid) {
      copyOrderToConfirm(oid, { simulateUserMsg: true });
      return true;
    }
    if (action === 'copy-demand-submit') {
      const card = btn.closest('[data-spec-id="card-copy-demand"]');
      submitCopyDemand(readDemandTextFromCardEl(card) || getLatestUserChatText(), { simulateUserMsg: true });
      return true;
    }
    if (action === 'copy-skip-demand') {
      skipCopyDemandToPick({ simulateUserMsg: true });
      return true;
    }
    if (action === 'progress-demand-submit') {
      const card = btn.closest('[data-spec-id="card-progress-demand"]');
      submitProgressDemand(readDemandTextFromCardEl(card) || getLatestUserChatText(), { simulateUserMsg: true });
      return true;
    }
    if (action === 'progress-skip-demand') {
      skipProgressDemandToPick({ simulateUserMsg: true });
      return true;
    }
    if (action === 'progress-pick' && oid) {
      const o = DemoData.orders.find(function (x) { return x.id === oid; });
      if (o) pushOrderProgressDetail(o, { simulateUserMsg: true });
      return true;
    }
    if (action === 'progress-repick-order') {
      simulateUserUtterance('重选订单');
      progressRepickOrder();
      return true;
    }
    if (action === 'copy-order-query-apply') {
      applyCopyOrderQuery({ simulateUserMsg: true });
      return true;
    }
    if (action === 'copy-order-load-more') {
      copyOrderLoadMore();
      return true;
    }`
    ],
    [
      `    if (action === 'change-submit') {
      submitChange();
      return true;
    }`,
      `    if (action === 'change-submit') {
      submitChange();
      return true;
    }`
    ],
    [
      `    if (action === 'delivery-to-progress') {
      handleDeliveryToProgress(btn.getAttribute('data-oid'));
      return true;
    }`,
      `    if (action === 'delivery-to-progress') {
      handleDeliveryToProgress(btn.getAttribute('data-oid'));
      return true;
    }`
    ]
  ];
  let ok = false;
  for (const [a, b] of reps) {
    if (out.includes(a)) {
      out = out.replace(a, b);
      ok = true;
    }
  }
  return { src: out, ok };
});

apply('delivery submit simulate', (s) => {
  const old = `    if (action === 'delivery-submit') {
      submitDelivery();
      return true;
    }`;
  const neu = `    if (action === 'delivery-submit') {
      simulateUserUtterance('提交评审');
      submitDelivery();
      return true;
    }`;
  if (!s.includes(old)) return { src: s, ok: false };
  return { src: s.replace(old, neu), ok: true };
});

apply('remove delivery-to-progress buttons in result', (s) => ({ src: s, ok: true }));

apply('runChange insert', (s) => {
  if (s.includes('function pushChangeOrderPickCard')) return { src: s, ok: true };
  const body = readPatch('runCopy.new.txt');
  if (!body || !body.includes('function runChange')) return { src: s, ok: false };
  const runChange = body.match(/function runChange[\s\S]*?\n  \}/);
  if (!runChange) return { src: s, ok: false };
  return replaceFunction(s, 'runChange', runChange[0]);
});

apply('evaluateDeliveryReview no orderNo in blockers', (s) => {
  const old = `        blockers.push({
          orderNo: orderNo,
          inventoryCode: deliveryBlockerInventoryCode(line, idx),
          reasons: buildDeliveryProcessLineReasons(idx === 0 ? 3 : 2)
        });`;
  const neu = `        blockers.push({
          inventoryCode: deliveryBlockerInventoryCode(line, idx),
          reasons: buildDeliveryProcessLineReasons(idx === 0 ? 3 : 2)
        });`;
  if (!s.includes(old)) return { src: s, ok: false };
  return { src: s.replace(old, neu), ok: true };
});

apply('renderDeliveryBlockersHtml call in submit', (s) => {
  const old = 'renderDeliveryBlockersHtml(ok ? [] : d.blockers)';
  const neu = 'renderDeliveryBlockersHtml(ok ? [] : review.blockers, reviewLines)';
  if (!s.includes(old)) return { src: s, ok: s.includes(neu) };
  return { src: s.replace(old, neu), ok: true };
});

fs.writeFileSync(SKILLS, src, 'utf8');
console.log(log.join('\n'));
