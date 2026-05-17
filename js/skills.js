window.Skills = (function () {
  let App;

  function init(app) {
    App = app;
    if (!App.state.ctx) App.state.ctx = {};
  }

  function ctx() {
    if (!App.state.ctx) App.state.ctx = {};
    return App.state.ctx;
  }

  function utteranceFor(id) {
    return (DemoData.skillUtterances && DemoData.skillUtterances[id]) || id;
  }

  function enterSkill(skillId) {
    if (App.switchActiveSkill) App.switchActiveSkill(skillId, { skipSkillAnnounce: true });
  }

  function requireCustomer(pendingSkillId) {
    const c = App.getCustomer(App.state.selectedFollowUpId || App.state.customerId);
    if (c) return c;
    const skillId = pendingSkillId || App.state.activeSkill;
    if (App.promptForCustomerSelection && skillId) {
      App.promptForCustomerSelection(skillId, { skipUserMsg: true, delayMs: 0 });
    }
    return null;
  }

  function ordersForCustomer(cid) {
    return DemoData.orders.filter((o) => {
      const c = App.getCustomer(o.customerId);
      return o.customerId === cid && c && c.enterpriseId === App.state.enterpriseId;
    });
  }

  function productById(id) {
    return DemoData.products.find((p) => p.id === id);
  }

  function fmtMoney(n) {
    return '¥' + n.toLocaleString('zh-CN');
  }

  function openPdf(title) {
    const modal = App.$('#pdf-modal');
    if (modal) {
      const t = modal.querySelector('.sc-pdf__bar span:nth-child(2)');
      if (t) t.textContent = title || '预览';
      modal.classList.remove('sc-hidden');
    }
  }

  function renderProductPickCard() {
    const sel = ctx().plan.selected || {};
    const rows = DemoData.products
      .map((p) => {
        const on = sel[p.id];
        return (
          '<button type="button" class="sc-follow-row sc-follow-row--select' +
          (on ? ' is-selected' : '') +
          '" data-action="plan-toggle" data-pid="' +
          p.id +
          '"><span class="sc-follow-row__name">' +
          App.escapeHtml(p.name) +
          '</span><span class="sc-follow-row__meta">' +
          App.escapeHtml(p.spec) +
          ' · ' +
          fmtMoney(p.unitPrice) +
          '</span></button>'
        );
      })
      .join('');
    return (
      '<div class="sc-card sc-card--compact"><div class="sc-card__head sc-card__head--compact">选择产品</div>' +
      '<div class="sc-follow-list">' +
      rows +
      '</div><div class="sc-card__actions-inline">' +
      '<button type="button" class="sc-btn sc-btn--ghost-primary" data-action="plan-to-cart">确认选品</button></div></div>'
    );
  }

  function renderPlanCartCardFixed() {
    const plan = ctx().plan;
    const items = Object.keys(plan.selected || {})
      .filter((id) => plan.selected[id])
      .map((pid) => ({ p: productById(pid), qty: plan.qty[pid] || 1 }));
    const rows = items
      .map(
        (it) =>
          '<div class="sc-follow-row"><span class="sc-follow-row__name">' +
          App.escapeHtml(it.p.name) +
          '</span><label class="sc-qty-inline">数量 <input type="number" min="1" value="' +
          it.qty +
          '" data-action="plan-qty" data-pid="' +
          it.p.id +
          '" class="sc-qty-input"/></label></div>'
      )
      .join('');
    return (
      '<div class="sc-card sc-card--compact"><div class="sc-card__head sc-card__head--compact">方案购物车</div>' +
      '<div class="sc-follow-list">' +
      rows +
      '</div><div class="sc-card__actions-inline">' +
      '<button type="button" class="sc-btn sc-btn--ghost-primary" data-action="plan-confirm">生成方案</button></div></div>'
    );
  }

  function startPlan(customer) {
    const c = customer || requireCustomer();
    if (!c) return;
    App.state.customerId = c.id;
    App.saveState();
    App.refreshHeader();
    ctx().plan = { customerId: c.id, selected: {}, qty: {} };
    App.pushAiHtml(
      '<p class="sc-reply-lead">为 <strong>' +
        App.escapeHtml(c.name) +
        '</strong> 配方案，请选择产品（可多选）：</p>' +
        renderProductPickCard()
    );
  }

  function confirmPlan() {
    document.querySelectorAll('[data-action="plan-qty"]').forEach((inp) => {
      const id = inp.getAttribute('data-pid');
      ctx().plan.qty[id] = parseInt(inp.value, 10) || 1;
    });
    const plan = ctx().plan;
    const c = App.getCustomer(plan.customerId);
    const lines = Object.keys(plan.selected)
      .filter((id) => plan.selected[id])
      .map((pid) => {
        const p = productById(pid);
        const qty = plan.qty[pid] || 1;
        return { name: p.name, qty, sub: p.unitPrice * qty };
      });
    const total = lines.reduce((s, l) => s + l.sub, 0);
    const schemeId = 'PL' + Date.now().toString().slice(-8);
    ctx().scheme = { id: schemeId, customerId: c.id, lines, total };
    const lineHtml = lines
      .map(
        (l) =>
          '<p class="sc-card__meta">' +
          App.escapeHtml(l.name) +
          ' ×' +
          l.qty +
          ' · ' +
          fmtMoney(l.sub) +
          '</p>'
      )
      .join('');
    App.pushAiHtml(
      '<div class="sc-card" data-spec-id="card-scheme"><div class="sc-card__head sc-card__head--compact">方案 ' +
        schemeId +
        '</div><div class="sc-card__row sc-card__row--compact"><p class="sc-card__meta">客户：' +
        App.escapeHtml(c.name) +
        '</p>' +
        lineHtml +
        '<p class="sc-card__meta"><strong>合计 ' +
        fmtMoney(total) +
        '</strong></p><div class="sc-card__actions-inline">' +
        '<button type="button" class="sc-btn sc-btn--ghost" data-action="open-pdf" data-pdf="方案">预览 PDF</button>' +
        '<button type="button" class="sc-btn sc-btn--ghost-primary" data-action="skill-quote">报价</button>' +
        '<button type="button" class="sc-btn sc-btn--ghost" data-action="skill-delivery">查交期</button>' +
        '</div></div></div>'
    );
  }

  function runQuote() {
    const c = requireCustomer();
    if (!c) return;
    if (!ctx().scheme || ctx().scheme.customerId !== c.id) {
      App.pushAiHtml('当前客户还没有方案，请先完成 <strong>方案速配</strong>。');
      return;
    }
    App.$('#quote-scheme-hint').textContent =
      '方案 ' + ctx().scheme.id + ' · 合计 ' + fmtMoney(ctx().scheme.total);
    App.$('#quote-discount').value = '0';
    App.$('#overlay-quote').classList.remove('sc-hidden');
  }

  function submitQuote() {
    const discount = parseFloat(App.$('#quote-discount').value) || 0;
    const scheme = ctx().scheme;
    const c = App.getCustomer(scheme.customerId);
    const total = Math.round(scheme.total * (1 - discount / 100));
    const quoteId = 'QT' + Date.now().toString().slice(-8);
    ctx().quote = { id: quoteId, schemeId: scheme.id, customerId: c.id, total, discount };
    App.closeOverlays();
    App.pushAiHtml(
      '<div class="sc-card" data-spec-id="card-quote"><div class="sc-card__head sc-card__head--compact">报价单 ' +
        quoteId +
        '</div><div class="sc-card__row sc-card__row--compact"><p class="sc-card__meta">客户：' +
        App.escapeHtml(c.name) +
        '</p><p class="sc-card__meta">基于方案 ' +
        scheme.id +
        (discount ? '，优惠 ' + discount + '%' : '') +
        '</p><p class="sc-card__meta"><strong>报价金额 ' +
        fmtMoney(total) +
        '</strong></p><div class="sc-card__actions-inline">' +
        '<button type="button" class="sc-btn sc-btn--ghost" data-action="open-pdf" data-pdf="报价">看 PDF</button>' +
        '<button type="button" class="sc-btn sc-btn--ghost" data-action="skill-delivery">查交期</button>' +
        '<button type="button" class="sc-btn sc-btn--ghost-primary" data-action="skill-order">下单</button>' +
        '</div></div></div>'
    );
  }

  function runDelivery() {
    const c = requireCustomer();
    if (!c) return;
    if (!ctx().quote || ctx().quote.customerId !== c.id) {
      App.pushAiHtml('请先完成 <strong>报价</strong> 后再查交期。');
      return;
    }
    App.$('#delivery-hint').textContent =
      '报价单 ' + ctx().quote.id + ' · ' + fmtMoney(ctx().quote.total);
    App.$('#delivery-date').value = '';
    App.$('#overlay-delivery').classList.remove('sc-hidden');
  }

  function submitDelivery() {
    const date = App.$('#delivery-date').value;
    if (!date) {
      App.toast('请选择期望交期');
      return;
    }
    const quote = ctx().quote;
    const ok = new Date(date) >= new Date('2026-06-01');
    const status = ok ? '按期' : '不齐套';
    const detail = ok
      ? '预计 ' + date.replace(/-/g, '/') + ' 可整单交付'
      : '部分物料缺货，建议延后至 2026-06-15 或调整方案';
    ctx().delivery = { quoteId: quote.id, expectedDate: date, status, detail, confirmed: true };
    App.closeOverlays();
    const badge = ok ? 'sc-badge--new' : 'sc-badge--old';
    App.pushAiHtml(
      '<div class="sc-card" data-spec-id="card-delivery"><div class="sc-card__head sc-card__head--compact">交期评审 · <span class="sc-badge ' +
        badge +
        '">' +
        status +
        '</span></div><div class="sc-card__row sc-card__row--compact"><p class="sc-card__meta">' +
        App.escapeHtml(detail) +
        '</p><div class="sc-card__actions-inline">' +
        '<button type="button" class="sc-btn sc-btn--ghost-primary" data-action="skill-order">下单</button>' +
        '<button type="button" class="sc-btn sc-btn--ghost" data-action="skill-plan">调整方案</button>' +
        '</div></div></div>'
    );
  }

  function showOrderConfirm() {
    const q = ctx().quote;
    const c = App.getCustomer(q.customerId);
    const del = ctx().delivery;
    App.$('#order-confirm-body').innerHTML =
      '<p><strong>' +
      App.escapeHtml(c.name) +
      '</strong></p><p class="sc-card__meta">报价 ' +
      q.id +
      ' · ' +
      fmtMoney(q.total) +
      '</p>' +
      (del ? '<p class="sc-card__meta">交期：' + App.escapeHtml(del.detail) + '</p>' : '');
    App.$('#overlay-order').classList.remove('sc-hidden');
  }

  function runOrder() {
    const c = requireCustomer();
    if (!c) return;
    if (!ctx().quote || ctx().quote.customerId !== c.id) {
      App.pushAiHtml('请先完成报价。');
      return;
    }
    if (!ctx().delivery || !ctx().delivery.confirmed) {
      App.pushAiHtml(
        '<div class="sc-card"><p class="sc-card__meta">尚未确认交期，是否继续下单？</p>' +
          '<div class="sc-card__actions-inline">' +
          '<button type="button" class="sc-btn sc-btn--ghost-primary" data-action="order-force">继续下单</button>' +
          '<button type="button" class="sc-btn sc-btn--ghost" data-action="skill-delivery">先查交期</button>' +
          '</div></div>'
      );
      return;
    }
    showOrderConfirm();
  }

  function submitOrder() {
    const q = ctx().quote;
    const c = App.getCustomer(q.customerId);
    const orderNo = 'SO' + Date.now().toString().slice(-10);
    DemoData.orders.unshift({
      id: 'o' + Date.now(),
      customerId: c.id,
      no: orderNo,
      status: '待排产',
      statusDetail: '订单已创建，等待排产',
      amount: fmtMoney(q.total),
      date: new Date().toISOString().slice(0, 10),
      items: '来自报价 ' + q.id
    });
    App.closeOverlays();
    App.pushAiHtml(
      '<div class="sc-card"><div class="sc-card__head sc-card__head--compact">订单提交成功</div>' +
        '<div class="sc-card__row sc-card__row--compact"><p class="sc-card__meta">订单号：<strong>' +
        orderNo +
        '</strong></p><p class="sc-card__meta">客户：' +
        App.escapeHtml(c.name) +
        '</p><p class="sc-card__meta">金额：' +
        fmtMoney(q.total) +
        '</p></div></div></div>'
    );
  }

  function renderOrderPickCard(list, action) {
    const rows = list
      .map(
        (o) =>
          '<button type="button" class="sc-follow-row sc-follow-row--select" data-action="' +
          action +
          '" data-oid="' +
          o.id +
          '"><span class="sc-follow-row__name">' +
          o.no +
          '</span><span class="sc-follow-row__meta">' +
          o.date +
          ' · ' +
          o.amount +
          ' · ' +
          o.status +
          '</span></button>'
      )
      .join('');
    return '<div class="sc-card sc-card--compact"><div class="sc-follow-list">' + rows + '</div></div>';
  }

  function renderOrderListCard(list) {
    const rows = list
      .map((o) => {
        return (
          '<div class="sc-follow-row"><div class="sc-follow-row__top"><span class="sc-follow-row__name">' +
          o.no +
          '</span><span class="sc-badge sc-badge--new">' +
          o.status +
          '</span></div><p class="sc-card__meta">' +
          App.escapeHtml(o.statusDetail) +
          '</p><p class="sc-card__meta">' +
          App.escapeHtml(o.items) +
          ' · ' +
          o.date +
          '</p><button type="button" class="sc-link-btn" data-action="progress-detail" data-oid="' +
          o.id +
          '">查看详情</button></div>'
        );
      })
      .join('');
    return '<div class="sc-card sc-card--compact"><div class="sc-follow-list">' + rows + '</div></div>';
  }

  function runCopy() {
    const c = requireCustomer();
    if (!c) return;
    const list = ordersForCustomer(c.id);
    if (!list.length) {
      App.pushAiHtml('该客户暂无历史订单可复制。');
      return;
    }
    App.pushAiHtml('<p class="sc-reply-lead">选择要复制的订单：</p>' + renderOrderPickCard(list, 'copy-pick'));
  }

  function runChange() {
    const c = requireCustomer();
    if (!c) return;
    const list = ordersForCustomer(c.id);
    if (!list.length) {
      App.pushAiHtml('该客户暂无订单可变更。');
      return;
    }
    App.pushAiHtml('<p class="sc-reply-lead">选择要变更的订单：</p>' + renderOrderPickCard(list, 'change-pick'));
  }

  function runProgress() {
    const c = requireCustomer();
    if (!c) return;
    const list = ordersForCustomer(c.id);
    if (!list.length) {
      App.pushAiHtml('该客户暂无订单。');
      return;
    }
    App.pushAiHtml('<p class="sc-reply-lead">订单进度如下：</p>' + renderOrderListCard(list));
  }

  function copyOrderToPlan(oid) {
    const o = DemoData.orders.find((x) => x.id === oid);
    ctx().plan = { customerId: o.customerId, selected: { p1: true, p2: true }, qty: { p1: 10, p2: 2 } };
    App.pushAiHtml(
      '<p class="sc-reply-lead">已按订单 <strong>' +
        o.no +
        '</strong> 生成方案购物车：</p>' +
        renderPlanCartCardFixed()
    );
  }

  function openChangeSheet(oid) {
    ctx().changeOrderId = oid;
    const o = DemoData.orders.find((x) => x.id === oid);
    App.$('#change-title').textContent = '变更订单 — ' + o.no;
    App.$('#change-reason').value = DemoData.changeReasons[0];
    App.$('#change-remark').value = '';
    App.$('#overlay-change').classList.remove('sc-hidden');
  }

  function submitChange() {
    const o = DemoData.orders.find((x) => x.id === ctx().changeOrderId);
    const reason = App.$('#change-reason').value;
    const remark = App.$('#change-remark').value.trim();
    if (!remark) {
      App.toast('请填写变更备注');
      return;
    }
    App.closeOverlays();
    App.pushAiHtml(
      '变更申请已提交（订单 ' +
        o.no +
        '）。<br><span class="sc-card__meta">原因：' +
        App.escapeHtml(reason) +
        '；备注：' +
        App.escapeHtml(remark) +
        '</span>'
    );
  }

  function runService() {
    const c = requireCustomer();
    if (!c) return;
    App.$('#service-customer').textContent = c.name;
    App.$('#service-desc').value = '';
    App.$('#overlay-service').classList.remove('sc-hidden');
  }

  function renderInsightCard(title, rows, specId) {
    const body = rows
      .map(
        (r) =>
          '<div class="sc-detail-item"><span class="sc-detail-label">' +
          App.escapeHtml(r.label) +
          '</span><span class="sc-detail-value">' +
          App.escapeHtml(r.value) +
          '</span></div>'
      )
      .join('');
    const specAttr = specId ? ' data-spec-id="' + specId + '"' : '';
    return (
      '<div class="sc-card sc-card--detail"' +
      specAttr +
      '><div class="sc-card__head sc-card__head--compact">' +
      App.escapeHtml(title) +
      '</div><div class="sc-detail-grid">' +
      body +
      '</div></div>'
    );
  }

  function runCapacity() {
    const c = requireCustomer();
    if (!c) return;
    App.pushAiHtml(
      '<p class="sc-reply-lead">为 <strong>' +
        App.escapeHtml(c.name) +
        '</strong> 汇总近 30 日产能：</p>' +
        renderInsightCard('产能分析', [
          { label: '产线负荷', value: '82%（3 条线满负荷）' },
          { label: '可承诺日产能', value: '轴承组件 120 件/日' },
          { label: '瓶颈工序', value: '热处理 · 平均等待 1.5 天' },
          { label: '建议', value: '交期 ≤14 天订单可优先排产' }
        ], 'card-insight-capacity')
    );
  }

  function runInventory() {
    const c = requireCustomer();
    if (!c) return;
    App.pushAiHtml(
      '<p class="sc-reply-lead">为 <strong>' +
        App.escapeHtml(c.name) +
        '</strong> 查询在库与在途：</p>' +
        renderInsightCard('库存查询', [
          { label: '轴承组件 A 型', value: '现货 860 件 · 在途 200 件' },
          { label: '传动齿轮箱 M3', value: '现货 42 台 · 安全库存 30 台' },
          { label: '伺服电机 750W', value: '现货 18 台 · 预计 5 月 22 日到货' },
          { label: '齐套率', value: '当前方案 SKU 齐套率 94%' }
        ], 'card-insight-inventory')
    );
  }

  function runBizAnalysis() {
    const c = requireCustomer();
    if (!c) return;
    App.pushAiHtml(
      '<p class="sc-reply-lead">为 <strong>' +
        App.escapeHtml(c.name) +
        '</strong> 生成业务分析：</p>' +
        renderInsightCard('业务分析', [
          { label: '近 12 月销售额', value: c.lastOrderAmount === '—' ? '暂无成交' : '累计 ¥318 万' },
          { label: '同比', value: '+12.4%' },
          { label: '订单频次', value: '月均 2.1 单' },
          { label: '主力品类', value: '轴承组件、齿轮箱' },
          { label: '客户等级', value: (c.level || '—') + ' 级' }
        ], 'card-insight-biz')
    );
  }

  function runPayment() {
    const c = requireCustomer();
    if (!c) return;
    App.pushAiHtml(
      '<p class="sc-reply-lead">为 <strong>' +
        App.escapeHtml(c.name) +
        '</strong> 汇总回款情况：</p>' +
        renderInsightCard('回款分析', [
          { label: '应收余额', value: '¥186,400' },
          { label: '逾期', value: '¥42,000（逾期 18 天）' },
          { label: '本月已回款', value: '¥96,400' },
          { label: '最近回款日', value: '2026-05-12' },
          { label: '信用建议', value: '逾期部分建议跟进对账后再下新单' }
        ], 'card-insight-payment')
    );
  }

  function submitService() {
    const desc = App.$('#service-desc').value.trim();
    if (!desc) {
      App.toast('请描述问题');
      return;
    }
    const c = requireCustomer();
    App.closeOverlays();
    const ticket = 'TK' + Date.now().toString().slice(-8);
    App.pushAiHtml(
      '<div class="sc-card"><div class="sc-card__head sc-card__head--compact">客服工单 ' +
        ticket +
        '</div><div class="sc-card__row sc-card__row--compact"><p class="sc-card__meta">客户：' +
        App.escapeHtml(c.name) +
        '</p><p class="sc-card__meta"><strong>AI 摘要：</strong>' +
        App.escapeHtml(desc.slice(0, 60)) +
        '（售后咨询，优先级中）</p><p class="sc-card__meta">客服将在 2 小时内联系。</p></div></div>'
    );
  }

  function run(skillId) {
    switch (skillId) {
      case 'followup':
        App.requestFollowUpListByClick();
        break;
      case 'plan':
        startPlan();
        break;
      case 'quote':
        runQuote();
        break;
      case 'delivery':
        runDelivery();
        break;
      case 'order':
        runOrder();
        break;
      case 'copy':
        runCopy();
        break;
      case 'change':
        runChange();
        break;
      case 'progress':
        runProgress();
        break;
      case 'service':
        runService();
        break;
      case 'capacity':
        runCapacity();
        break;
      case 'inventory':
        runInventory();
        break;
      case 'biz-analysis':
        runBizAnalysis();
        break;
      case 'payment':
        runPayment();
        break;
      default:
        App.toast('未知能力');
    }
  }

  function tryIntent(t) {
    if (/方案|配个方案|做方案/.test(t)) {
      enterSkill('plan');
      startPlan();
      return true;
    }
    if (/报价/.test(t)) {
      enterSkill('quote');
      runQuote();
      return true;
    }
    if (/交期|什么时候交/.test(t)) {
      enterSkill('delivery');
      runDelivery();
      return true;
    }
    if (/下单|生成订单/.test(t)) {
      enterSkill('order');
      runOrder();
      return true;
    }
    if (/复制|老订单/.test(t)) {
      enterSkill('copy');
      runCopy();
      return true;
    }
    if (/变更.*订单|改订单/.test(t)) {
      enterSkill('change');
      runChange();
      return true;
    }
    if (/进度|订单到哪|查订单/.test(t)) {
      enterSkill('progress');
      runProgress();
      return true;
    }
    if (/投诉|售后|客服/.test(t)) {
      enterSkill('service');
      runService();
      return true;
    }
    if (/产能/.test(t)) {
      enterSkill('capacity');
      runCapacity();
      return true;
    }
    if (/库存/.test(t)) {
      enterSkill('inventory');
      runInventory();
      return true;
    }
    if (/业务分析|经营分析/.test(t)) {
      enterSkill('biz-analysis');
      runBizAnalysis();
      return true;
    }
    if (/回款|应收/.test(t)) {
      enterSkill('payment');
      runPayment();
      return true;
    }
    return false;
  }

  function handleAction(action, btn) {
    const pid = btn.getAttribute('data-pid');
    const oid = btn.getAttribute('data-oid');

    if (action === 'plan-toggle' && pid) {
      ctx().plan.selected[pid] = !ctx().plan.selected[pid];
      if (ctx().plan.selected[pid]) ctx().plan.qty[pid] = ctx().plan.qty[pid] || 1;
      const card = btn.closest('.sc-card');
      if (card) {
        card.outerHTML = renderProductPickCard();
      }
      return true;
    }
    if (action === 'plan-to-cart') {
      const n = Object.keys(ctx().plan.selected).filter((k) => ctx().plan.selected[k]).length;
      if (!n) {
        App.toast('请至少选择一种产品');
        return true;
      }
      App.pushAiHtml(renderPlanCartCardFixed());
      return true;
    }
    if (action === 'plan-confirm') {
      confirmPlan();
      return true;
    }
    if (action === 'open-pdf') {
      openPdf(btn.getAttribute('data-pdf'));
      return true;
    }
    if (action === 'skill-quote') {
      enterSkill('quote');
      runQuote();
      return true;
    }
    if (action === 'skill-delivery') {
      enterSkill('delivery');
      runDelivery();
      return true;
    }
    if (action === 'skill-order') {
      enterSkill('order');
      runOrder();
      return true;
    }
    if (action === 'skill-plan') {
      enterSkill('plan');
      startPlan();
      return true;
    }
    if (action === 'order-force') {
      showOrderConfirm();
      return true;
    }
    if (action === 'copy-pick' && oid) {
      copyOrderToPlan(oid);
      return true;
    }
    if (action === 'change-pick' && oid) {
      openChangeSheet(oid);
      return true;
    }
    if (action === 'progress-detail' && oid) {
      const o = DemoData.orders.find((x) => x.id === oid);
      App.pushAiHtml(
        '<div class="sc-card"><div class="sc-card__head sc-card__head--compact">订单 ' +
          o.no +
          '</div><div class="sc-card__row sc-card__row--compact"><p class="sc-card__meta">状态：' +
          o.status +
          '</p><p class="sc-card__meta">' +
          App.escapeHtml(o.statusDetail) +
          '</p><p class="sc-card__meta">' +
          App.escapeHtml(o.items) +
          '</p></div></div>'
      );
      return true;
    }
    return false;
  }

  return { init, run, tryIntent, handleAction, utteranceFor, startPlan, submitQuote, submitDelivery, submitOrder, submitChange, submitService };
})();
