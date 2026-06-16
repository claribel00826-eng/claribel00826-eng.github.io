import fs from 'fs';
import path from 'path';

const root = path.resolve(import.meta.dirname, '..');
const skillsPath = path.join(root, 'v1.3.0/js/skills.js');
const v14SkillsPath = path.join(root, 'v1.4.0/js/skills.js');
let s = fs.readFileSync(skillsPath, 'utf8');
const v14 = fs.readFileSync(v14SkillsPath, 'utf8');

function extractBlock(src, startMarker, endMarker) {
  const start = src.indexOf(startMarker);
  const end = src.indexOf(endMarker, start);
  if (start < 0 || end < 0) throw new Error('Block not found: ' + startMarker);
  return src.slice(start, end);
}

// Replace runCapacity..runPayment block (keep renderInsightCard before it)
const blockStart = '  function runCapacity() {';
const blockEnd = '  function run(skillId) {';
const iStart = s.indexOf(blockStart);
const iEnd = s.indexOf(blockEnd, iStart);
if (iStart < 0 || iEnd < 0) throw new Error('runCapacity block not found');

const capacityBiz = extractBlock(v14, '  var CAPACITY_HOUR_WIDTH = 18;', '  function runCapacity() {');
const bizBlock = extractBlock(v14, '  var BIZ_METRICS = [', '  function runBizAnalysis() {');

const inventoryBlock = `
  function formatInventoryQty(n, unit) {
    return (Number(n) || 0).toLocaleString('zh-CN') + ' ' + (unit || '件');
  }

  function inventorySnapshotSummary(allRows) {
    const productIds = new Set(allRows.map(function (r) { return r.productId; }));
    const zeroAvail = allRows.filter(function (r) { return r.available <= 0; }).length;
    return {
      totalProducts: productIds.size,
      totalSku: allRows.length,
      zeroAvail: zeroAvail
    };
  }

  function renderInventoryResultCard(allRows) {
    const summary = inventorySnapshotSummary(allRows);
    const groups = [];
    allRows.forEach(function (row) {
      let g = groups.find(function (x) { return x.productId === row.productId; });
      if (!g) {
        g = { productId: row.productId, productName: row.productName, inventoryCode: row.inventoryCode, salesUnit: row.salesUnit, rows: [] };
        groups.push(g);
      }
      g.rows.push(row);
    });
    const listItems = groups.map(function (g) {
      const skuLines = g.rows.map(function (row) {
        const low = row.available <= 0;
        const availCls = low ? ' sc-inventory-list__avail--warn' : '';
        return (
          '<div class="sc-inventory-list__sku">' +
          '<span class="sc-inventory-list__spec">' + App.escapeHtml(row.skuLabel || '默认') + '</span>' +
          '<span class="sc-inventory-list__avail' + availCls + '">可用 ' + formatInventoryQty(row.available, row.salesUnit) + '</span>' +
          '</div>'
        );
      }).join('');
      return (
        '<div class="sc-inventory-list__item">' +
        '<div class="sc-inventory-list__line1">' +
        '<strong>' + App.escapeHtml(g.productName) + '</strong>' +
        '<span class="sc-inventory-list__code">' + App.escapeHtml(g.inventoryCode || '—') + '</span>' +
        '</div>' +
        '<div class="sc-inventory-list__line2">' + skuLines + '</div>' +
        '</div>'
      );
    }).join('');
    const emptyHint = !allRows.length ? '<p class="sc-card__meta">暂无库存数据。</p>' : '';
    return (
      '<div class="sc-card sc-card--compact sc-card--inventory" data-spec-id="card-inventory">' +
      '<div class="sc-card__head sc-card__head--compact">库存查询</div>' +
      '<div class="sc-biz-overview sc-inventory__overview">' +
      '<p class="sc-biz-overview__line sc-card-summary-line"><strong>合计：货品：' +
      summary.totalProducts + '  规格：' + summary.totalSku + '  可用为0：' + summary.zeroAvail +
      '</strong></p></div>' +
      (listItems ? '<div class="sc-inventory-list">' + listItems + '</div>' : emptyHint) +
      '</div>'
    );
  }

  function runInventory(opts) {
    opts = opts || {};
    const rows = DemoData.buildInventorySnapshotRows ? DemoData.buildInventorySnapshotRows() : [];
    if (!rows.length) {
      App.toast('暂无库存数据');
      return;
    }
    const utterance = opts.utterance || '';
    if (opts.simulateUserMsg && utterance) {
      simulateUserUtteranceUnlessDuplicate(utterance);
    }
    App.pushAiHtml(
      '<p class="sc-reply-lead">为您查询 <strong>全部货品</strong> 规格库存（全仓合计）：</p>' +
        renderInventoryResultCard(rows)
    );
    rescanAnnotationPins();
  }

`;

const paymentBlock = `
  function formatPaymentMoney(n) {
    var num = Number(n) || 0;
    if (num >= 10000) {
      var wan = num / 10000;
      return (
        '¥' +
        (wan >= 100 ? wan.toFixed(0) : wan.toFixed(1).replace(/\\.0$/, '')) +
        ' 万'
      );
    }
    return fmtMoney(num);
  }

  function formatPaymentDate(s) {
    if (!s) return '—';
    return String(s).replace(/-/g, '/');
  }

  function renderPaymentResultCard(data) {
    var overdueCls =
      data.overdueAmount > 0 ? ' sc-payment-metrics__value--warn' : '';
    var overdueText =
      formatPaymentMoney(data.overdueAmount) +
      '（最长逾期 ' +
      (data.overdueMaxDays || 0) +
      ' 天）';
    return (
      '<div class="sc-card sc-card--compact sc-card--payment" data-spec-id="card-payment">' +
      '<div class="sc-card__head sc-card__head--compact">回款分析</div>' +
      '<div class="sc-biz-overview sc-payment__overview">' +
      '<p class="sc-biz-overview__line sc-card-summary-line"><strong>客户总数：' +
      (data.customerTotal || 0) +
      '  应有 ' +
      (data.customerWithReceivable || 0) +
      '  逾期 ' +
      (data.overdueCustomerCount || 0) +
      '</strong></p></div>' +
      '<div class="sc-payment-metrics">' +
      '<div class="sc-payment-metrics__item">' +
      '<span class="sc-payment-metrics__label">应收余额</span>' +
      '<span class="sc-payment-metrics__value">' +
      formatPaymentMoney(data.receivableBalance) +
      '</span></div>' +
      '<div class="sc-payment-metrics__item">' +
      '<span class="sc-payment-metrics__label">逾期</span>' +
      '<span class="sc-payment-metrics__value' +
      overdueCls +
      '">' +
      App.escapeHtml(overdueText) +
      '</span></div>' +
      '<div class="sc-payment-metrics__item">' +
      '<span class="sc-payment-metrics__label">本月已回款</span>' +
      '<span class="sc-payment-metrics__value sc-payment-metrics__value--pos">' +
      formatPaymentMoney(data.monthCollected) +
      '</span>' +
      '<span class="sc-payment-metrics__sub">' +
      App.escapeHtml(data.monthLabel || '自然月') +
      '</span></div>' +
      '<div class="sc-payment-metrics__item">' +
      '<span class="sc-payment-metrics__label">最近回款日</span>' +
      '<span class="sc-payment-metrics__value">' +
      formatPaymentDate(data.lastPaymentDate) +
      '</span></div>' +
      '</div>' +
      '<p class="sc-payment-hint">应收余额来自账龄与往来对账；本月已回款来自收款单与银行流水。</p>' +
      '</div>'
    );
  }

  function runPayment(opts) {
    opts = opts || {};
    var data = DemoData.paymentAnalysis;
    if (!data) {
      App.toast('暂无回款数据');
      return;
    }
    var utterance = opts.utterance || '';
    if (opts.simulateUserMsg && utterance) {
      simulateUserUtteranceUnlessDuplicate(utterance);
    }
    App.pushAiHtml(
      '<p class="sc-reply-lead">为您汇总 <strong>全部客户</strong> 回款与应收：</p>' +
        renderPaymentResultCard(data)
    );
    rescanAnnotationPins();
  }

`;

const runCapacityOverride = `
  function runCapacity(opts) {
    opts = opts || {};
    const utterance = opts.utterance || '';
    if (opts.simulateUserMsg && utterance) {
      simulateUserUtteranceUnlessDuplicate(utterance);
    }
    const data = DemoData.capacitySchedule;
    if (!data) {
      App.toast('暂无排程数据');
      return;
    }
    App.pushAiHtml(
      '<p class="sc-reply-lead">为您汇总 <strong>全厂产线</strong> 产能排程：</p>' +
        renderCapacityCard(data)
    );
    rescanAnnotationPins();
  }

  function runBizAnalysis(opts) {
    opts = opts || {};
    var data = DemoData.bizAnalysis;
    if (!data) {
      App.toast('暂无业务分析数据');
      return;
    }
    var utterance = opts.utterance || '';
    if (opts.simulateUserMsg && utterance) {
      simulateUserUtteranceUnlessDuplicate(utterance);
    }
    App.pushAiHtml(
      '<p class="sc-reply-lead">为您汇总 <strong>全部客户</strong> 业务排行：</p>' +
        renderBizAnalysisCard(data)
    );
    rescanAnnotationPins();
  }

`;

// Remove old inventoryProductsForCustomer through runPayment
s = s.slice(0, iStart) + capacityBiz + bizBlock + runCapacityOverride + inventoryBlock + paymentBlock + s.slice(iEnd);

// Remove service form and submitService if present
s = s.replace(/\n\n  function renderServiceFormCard[\s\S]*?function renderInsightCard/, '\n\n  function renderInsightCard');
s = s.replace(/\n  function submitService\(\) \{[\s\S]*?\n  \}\n/, '\n');

// Remove service from run switch
s = s.replace(/\n      case 'service':\n        runService\(\);\n        break;\n/, '\n');

// Remove service from tryIntent
s = s.replace(/\n    if \(\/投诉\|售后\|客服\/\.test\(t\)\) \{\n      enterSkill\('service'\);\n      runService\(\);\n      return true;\n    \}\n/, '\n');

// Remove service-submit handler
s = s.replace(/\n    if \(action === 'service-submit'\) \{\n      submitService\(\);\n      return true;\n    \}\n/, '\n');

// deliverySummaryLabel scheme branch
s = s.replace(
  /function deliverySummaryLabel\(meta\) \{\n    if \(!meta\) return '';\n    if \(meta\.sourceType === 'quote'/,
  `function deliverySummaryLabel(meta) {
    if (!meta) return '';
    if (meta.sourceType === 'scheme' && meta.schemeId) {
      return '方案 ' + (meta.schemeName || meta.schemeId);
    }
    if (meta.sourceType === 'quote'`
);

// beginDeliveryFromScheme
if (!s.includes('function beginDeliveryFromScheme')) {
  s = s.replace(
    '  function deliveryOpenFormForScheme(scheme) {',
    `  function beginDeliveryFromScheme(schemeId) {
    setDeliverySkillAtEntry(false);
    const c = requireCustomer('delivery');
    if (!c) return;
    enterSkill('delivery');
    const list = schemesForCustomer(c.id);
    if (!list.length) {
      App.pushAiHtml('<p class="sc-reply-lead">当前客户暂无方案，请先 <strong>方案速配</strong> 或改用其他来源。</p>');
      App.pushAiHtml(renderDeliverySourceCard(c));
      rescanAnnotationPins();
      return;
    }
    if (schemeId) {
      const hit = list.find(function (x) { return x.id === schemeId; });
      if (hit) {
        simulateUserUtterance('按方案 ' + (hit.templateName || hit.id));
        deliveryOpenFormForScheme(hit);
        return;
      }
    }
    if (list.length === 1) {
      simulateUserUtterance('按方案 ' + (list[0].templateName || list[0].id));
      deliveryOpenFormForScheme(list[0]);
      return;
    }
    App.pushAiHtml(
      '<p class="sc-reply-lead">本客户有 <strong>' +
        list.length +
        '</strong> 个方案，<strong>按方案评估须先选择</strong>：</p>' +
        renderDeliverySchemePickCard(list)
    );
    rescanAnnotationPins();
  }

  function deliveryOpenFormForScheme(scheme) {`
  );
}

// renderHistoricalOrderPickCard progress mode
s = s.replace(
  /function renderHistoricalOrderPickCard\(c, list, opts\) \{[\s\S]*?\n  \}\n\n  function pushCopyOrderPickCard/,
  fs.readFileSync(path.join(root, 'scripts/_renderHistoricalOrderPickCard.js'), 'utf8') +
    '\n\n  function pushCopyOrderPickCard'
);

// renderOrderCopyCard - remove badge, add repick
s = s.replace(
  /App\.escapeHtml\(o\.no\) \+\n          '<\/strong> ' \+\n          orderStatusBadgeHtml\(o\.status\) \+\n          ' · ' \+/,
  "App.escapeHtml(o.no) +\n          '</strong> · ' +"
);
s = s.replace(
  /'<div class="sc-card__actions-inline"><button type="button" class="sc-btn sc-btn--primary" data-action="copy-order-confirm">确认下单<\/button><\/div>' \+/,
  "'<div class=\"sc-card__actions-inline\">' +\n      '<button type=\"button\" class=\"sc-btn sc-btn--ghost\" data-action=\"copy-repick-order\">重选订单</button>' +\n      '<button type=\"button\" class=\"sc-btn sc-btn--primary\" data-action=\"copy-order-confirm\">确认复制</button></div>' +"
);

// handleAction inserts before return false
const handleInserts = `
    if (action === 'delivery-source-scheme') {
      simulateUserUtterance('按方案');
      beginDeliveryFromScheme(btn.getAttribute('data-scheme-id') || undefined);
      return true;
    }
    if (action === 'delivery-scheme-pick') {
      const sid = btn.getAttribute('data-scheme-id');
      const sch = schemesForCustomer((activeCustomer() || {}).id).find(function (x) {
        return x.id === sid;
      });
      if (sch) {
        simulateUserUtterance('按方案 ' + (sch.templateName || sch.id));
        deliveryOpenFormForScheme(sch);
      }
      return true;
    }
    if (action === 'delivery-adjust') {
      simulateUserUtterance('调整交期评审方案');
      adjustDeliveryFromResult();
      return true;
    }
    if (action === 'copy-demand-submit') {
      const card = btn.closest('[data-spec-id="card-copy-demand"]');
      const fromInput = readDemandTextFromCardEl(card);
      const text = fromInput || getLatestUserChatText();
      submitCopyDemand(text, { simulateUserMsg: !!fromInput });
      return true;
    }
    if (action === 'copy-skip-demand') {
      simulateUserUtterance('跳过，展示全部历史订单');
      skipCopyDemandToPick({ simulateUserMsg: false });
      return true;
    }
    if (action === 'progress-demand-submit') {
      const card = btn.closest('[data-spec-id="card-progress-demand"]');
      const fromInput = readDemandTextFromCardEl(card);
      const text = fromInput || getLatestUserChatText();
      submitProgressDemand(text, { simulateUserMsg: !!fromInput });
      return true;
    }
    if (action === 'progress-skip-demand') {
      simulateUserUtterance('跳过，展示全部历史订单');
      skipProgressDemandToPick({ simulateUserMsg: false });
      return true;
    }
    if (action === 'copy-order-query-apply') {
      simulateUserUtterance('筛选历史订单');
      applyCopyOrderQuery({ simulateUserMsg: false });
      return true;
    }
    if (action === 'copy-order-load-more') {
      copyOrderLoadMore();
      return true;
    }
    if (action === 'copy-edit-demand') {
      openCopyDemandEdit({ simulateUserMsg: true });
      return true;
    }
    if (action === 'copy-repick-order') {
      simulateUserUtterance('重选订单');
      pushCopyOrderPickCard(activeCustomer());
      return true;
    }
    if (action === 'progress-pick' && oid) {
      const o = DemoData.orders.find(function (x) { return x.id === oid; });
      if (o) {
        simulateUserUtterance('查订单 ' + o.no);
        pushOrderProgressDetail(o);
      }
      return true;
    }
    if (action === 'progress-repick-order') {
      simulateUserUtterance('重选订单');
      progressRepickOrder();
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
`;

if (!s.includes("action === 'delivery-adjust'")) {
  s = s.replace(/\n    return false;\n  \}\n\n  \/\*\* tryIntent/, handleInserts + '\n    return false;\n  }\n\n  /** tryIntent');
}

// delivery-source-order simulateUserUtterance
s = s.replace(
  /if \(action === 'delivery-source-order'\) \{\n      beginDeliveryFromOrder/,
  "if (action === 'delivery-source-order') {\n      simulateUserUtterance('按订单');\n      beginDeliveryFromOrder"
);

// delivery-order-pick simulateUserUtterance
s = s.replace(
  /if \(action === 'delivery-order-pick'\) \{\n      const oid = btn\.getAttribute\('data-oid'\);\n      const o = DemoData\.orders\.find\(function \(x\) \{\n        return x\.id === oid;\n      \}\);\n      deliveryOpenFormForOrder\(o\);/,
  `if (action === 'delivery-order-pick') {
      const oid = btn.getAttribute('data-oid');
      const o = DemoData.orders.find(function (x) {
        return x.id === oid;
      });
      if (o) simulateUserUtterance('按订单 ' + o.no);
      deliveryOpenFormForOrder(o);`
);

// progress load more helper - extend copyOrderLoadMore for progress
if (!s.includes('progress-order-load-more')) {
  s = s.replace(
    '  function copyOrderLoadMore() {',
    `  function progressOrderLoadMore() {
    const c = activeCustomer();
    if (!c) return;
    const state = ensureProgressPickState();
    state.visibleCount += COPY_ORDER_LIST_PAGE_SIZE;
    const list = filterOrdersForCopyPick(c, state);
    syncProgressPickActiveList(list, state.visibleCount);
    const card = document.querySelector('[data-spec-id="card-order-pick"][data-progress-pick="1"]');
    if (card) {
      card.outerHTML = renderHistoricalOrderPickCard(c, list, { mode: 'progress' });
      rescanAnnotationPins();
    }
  }

  function copyOrderLoadMore() {`
  );
}

fs.writeFileSync(skillsPath, s);
console.log('skills.js updated');
