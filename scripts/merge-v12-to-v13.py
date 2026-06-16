#!/usr/bin/env python3
"""Merge v1.2.0 free-attr changes into v1.3.0 while preserving delivery review module."""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read_lines(path):
    return path.read_text(encoding="utf-8").splitlines(keepends=True)


def merge_skills():
    v12_lines = read_lines(ROOT / "v1.2.0/js/skills.js")
    v13_lines = read_lines(ROOT / "v1.3.0/js/skills.js")

    head = v12_lines[:1015]
    delivery_block = v13_lines[1025:1547]
    tail = v12_lines[1016:]
    merged = "".join(head + delivery_block + tail)

    if "deliveryDemand:" not in merged:
        dd = "".join(v13_lines[172:192])
        merged = merged.replace("    planEntryChoice:", dd + "    planEntryChoice:", 1)

    v13_delivery_funcs = "".join(v13_lines[6164:6563])
    rd_start = merged.find("  function runDelivery() {")
    ed_start = merged.find("  function ensureOrderDraft(customer) {", rd_start)
    if rd_start != -1 and ed_start != -1:
        merged = merged[:rd_start] + v13_delivery_funcs + merged[ed_start:]

    if "function deliveryOrdersForCustomer" not in merged:
        dof = "".join(v13_lines[2549:2554])
        merged = merged.replace("  function productById(id) {", dof + "  function productById(id) {", 1)

    if "function pushDeliveryLinesPickCard" not in merged:
        push_func = "".join(v13_lines[2922:2939])
        merged = merged.replace(
            "  function applyPickQuery(scope, opts) {",
            push_func + "  function applyPickQuery(scope, opts) {",
            1,
        )
        old_apply = "    if (inp) inp.value = text;\n    cfg.refresh();"
        new_apply = (
            "    if (inp) inp.value = text;\n"
            "    if (changed && ctx().deliveryLinesMode && scope === 'order') {\n"
            "      pushDeliveryLinesPickCard(text, { simulateUserMsg: opts.simulateUserMsg });\n"
            "      return true;\n"
            "    }\n"
            "    cfg.refresh();"
        )
        merged = merged.replace(old_apply, new_apply, 1)

    if "function submitDeliveryDemand" not in merged:
        delivery_demand_funcs = "".join(v13_lines[3164:3272])
        merged = merged.replace(
            "  /** 跳过需求录入，按最近订单进选品 */\n  function skipQuoteDemandToPick(opts) {",
            delivery_demand_funcs + "  /** 跳过需求录入，按最近订单进选品 */\n  function skipQuoteDemandToPick(opts) {",
            1,
        )

    hq_start = merged.find("  function handleQuoteDemandEditUtterance(text, opts) {")
    mq_start = merged.find("  function maybeQuoteDemandBeforePick(c, opts) {", hq_start)
    if hq_start != -1 and mq_start != -1:
        merged = (
            merged[:hq_start]
            + "".join(v13_lines[3317:3361])
            + merged[mq_start:]
        )

    old_demand = """  function demandDraftTextForSpec(specId) {
    if (specId === 'card-quote-demand') {
      const d = ctx().quoteDraft;
      return d && d.demandText ? String(d.demandText).trim() : '';
    }
    const plan = ctx().plan;
    return plan && plan.demandText ? String(plan.demandText).trim() : '';
  }

  function readDemandTextFromCardEl(cardEl) {"""

    new_demand = """  function demandDraftTextForSpec(specId) {
    if (specId === 'card-quote-demand') {
      const d = ctx().quoteDraft;
      return d && d.demandText ? String(d.demandText).trim() : '';
    }
    if (specId === 'card-delivery-demand') {
      const d = ctx().orderDraft;
      return d && d.demandText ? String(d.demandText).trim() : '';
    }
    const plan = ctx().plan;
    return plan && plan.demandText ? String(plan.demandText).trim() : '';
  }

  function readDemandTextFromCardEl(cardEl) {"""

    merged = merged.replace(old_demand, new_demand, 1)

    old_input = """  function renderDemandInputBlock(specId, opts) {
    opts = opts || {};
    const submitAction =
      specId === 'card-quote-demand' ? 'quote-demand-submit' : 'plan-demand-submit';"""

    new_input = """  function demandSubmitActionForSpec(specId) {
    if (specId === 'card-quote-demand') return 'quote-demand-submit';
    if (specId === 'card-delivery-demand') return 'delivery-demand-submit';
    return 'plan-demand-submit';
  }

  function demandSkipActionForSpec(specId) {
    if (specId === 'card-quote-demand') return 'quote-skip-demand';
    if (specId === 'card-delivery-demand') return 'delivery-skip-demand';
    return 'plan-skip-demand';
  }

  function renderDemandInputBlock(specId, opts) {
    opts = opts || {};
    const submitAction = demandSubmitActionForSpec(specId);"""

    merged = merged.replace(old_input, new_input, 1)

    merged = merged.replace(
        "    const skipAction = specId === 'card-quote-demand' ? 'quote-skip-demand' : 'plan-skip-demand';",
        "    const skipAction = demandSkipActionForSpec(specId);",
        1,
    )

    if "function renderDeliveryDemandPromptCard" not in merged:
        merged = merged.replace(
            "  function renderQuoteDemandPromptCard(c, opts) {\n    opts = opts || {};\n    opts.specId = 'card-quote-demand';\n    return renderDemandPromptCard(c, opts);\n  }\n\n  function submitPlanDemand(text, opts) {",
            "  function renderQuoteDemandPromptCard(c, opts) {\n    opts = opts || {};\n    opts.specId = 'card-quote-demand';\n    return renderDemandPromptCard(c, opts);\n  }\n\n  function renderDeliveryDemandPromptCard(c, opts) {\n    opts = opts || {};\n    opts.specId = 'card-delivery-demand';\n    return renderDemandPromptCard(c, opts);\n  }\n\n  function submitPlanDemand(text, opts) {",
            1,
        )

    pick_card = """  function renderOrderProductPickCard(opts) {
    opts = opts || {};
    const deliveryLines = !!opts.deliveryLines || !!ctx().deliveryLinesMode;
    const d = ctx().orderDraft;
    const c = App.getCustomer(d.customerId);
    const demandMatch = orderDemandForMatch();
    const recs = DemoData.recommendProducts(c, pickQueryValue(d), undefined, demandMatch);
    const recIds = new Set(recs.map((r) => r.product.id));
    const recRows = recs.map((r) => orderPickRow(r.product, recommendRecTagHtml(r))).join('');
    const moreSection = renderPickMoreSection(d, recIds, demandMatch, orderPickRow);
    const isOld = DemoData.isOldCustomer(c, DemoData.demoSalesUser);
    const hasDemand = !!(demandMatch && demandMatch.trim());
    const addDemandBtn =
      isOld && !hasDemand
        ? '<button type="button" class="sc-btn sc-btn--ghost" data-action="quote-add-demand">录入用户需求</button>'
        : '';
    const headTitle = deliveryLines ? '交期评审 · 自选商品' : '订单选品';
    const nextAction = deliveryLines ? 'delivery-lines-confirm' : 'order-to-quote-setup';
    const nextLabel = deliveryLines ? '下一步：确认选品' : '下一步：逐项报价';
    const schemeRow = deliveryLines
      ? ''
      : '<label class="sc-plan-save-scheme"><input type="checkbox" id="order-save-scheme"' +
        (d.saveAsScheme ? ' checked' : '') +
        '/> 保存为方案</label>';
    return (
      '<div class="sc-card sc-card--compact" data-spec-id="card-order-pick"><div class="sc-card__head sc-card__head--compact">' +
      headTitle +
      '</div>' +
      recommendLeadHtml(c, demandMatch) +
      renderPickQueryRow('order') +
      '<div class="sc-follow-list sc-plan-pick-list">' +
      (recRows || pickCardEmptyHint(c)) +
      moreSection +
      '</div>' +
      schemeRow +
      '<div class="sc-card__actions-inline">' +
      addDemandBtn +
      '<button type="button" class="sc-btn sc-btn--ghost-primary" data-action="' +
      nextAction +
      '">' +
      nextLabel +
      '</button></div></div>'
    );
  }"""

    merged = re.sub(
        r"  function renderOrderProductPickCard\(\) \{.*?  function renderOrderProductCartCard\(\) \{",
        pick_card + "\n\n  function renderOrderProductCartCard() {",
        merged,
        count=1,
        flags=re.DOTALL,
    )

    cart_delivery = (
        "    const deliveryLines = !!ctx().deliveryLinesMode;\n"
        "    const headTitle = deliveryLines ? '交期明细' : '订单购物车';\n"
        "    const nextAction = deliveryLines ? 'delivery-lines-confirm' : 'order-to-quote-setup';\n"
        "    const nextLabel = deliveryLines ? '确认，评估交期' : '下一步：逐项报价';\n"
        "    const schemeRow = deliveryLines\n"
        "      ? ''\n"
        "      : '<label class=\"sc-plan-save-scheme\"><input type=\"checkbox\" id=\"order-save-scheme\"' + (d.saveAsScheme ? ' checked' : '') + '/> 保存为方案</label>';\n"
        "    return (\n"
        "      '<div class=\"sc-card sc-card--compact\" data-spec-id=\"card-order-cart\"><div class=\"sc-card__head sc-card__head--compact\">' +\n"
        "      headTitle +\n"
        "      '</div><div class=\"sc-follow-list\">' +\n"
        "      rows +\n"
        "      '</div>' +\n"
        "      schemeRow +\n"
        "      '<div class=\"sc-card__actions-inline\"><button type=\"button\" class=\"sc-btn sc-btn--ghost\" data-action=\"order-back-pick\">返回</button><button type=\"button\" class=\"sc-btn sc-btn--ghost-primary\" data-action=\"' +\n"
        "      nextAction +\n"
        "      '\">' +\n"
        "      nextLabel +\n"
        "      '</button></div></div>'\n"
        "    );"
    )
    merged = re.sub(
        r"    return '<div class=\"sc-card sc-card--compact\" data-spec-id=\"card-order-cart\"><div class=\"sc-card__head sc-card__head--compact\">订单购物车</div><div class=\"sc-follow-list\">' \+ rows \+ '</div>' \+\n      '<label class=\"sc-plan-save-scheme\"><input type=\"checkbox\" id=\"order-save-scheme\"' \+ \(d\.saveAsScheme \? ' checked' : ''\) \+ '/> 保存为方案</label>' \+\n      '<div class=\"sc-card__actions-inline\"><button type=\"button\" class=\"sc-btn sc-btn--ghost\" data-action=\"order-back-pick\">返回</button><button type=\"button\" class=\"sc-btn sc-btn--ghost-primary\" data-action=\"order-to-quote-setup\">下一步：逐项报价</button></div></div>';",
        cart_delivery,
        merged,
        count=1,
    )

    order_draft_nl = """    const orderDraft = ctx().orderDraft;
    if (orderDraft && orderDraft.customerId && !pending) {
      if (ctx().deliveryLinesMode && isActiveFlowCard('card-order-pick') && isNaturalDemandText(text)) {
        return applyPickQuery('order', { text: text, simulateUserMsg: false });
      }"""

    if "deliveryLinesMode && isActiveFlowCard('card-order-pick')" not in merged:
        merged = merged.replace(
            "    const orderDraft = ctx().orderDraft;\n    if (orderDraft && orderDraft.customerId && !pending) {",
            order_draft_nl,
            1,
        )

    merged = merged.replace(
        "      if (/逐项报价|下一步|确认选品|生成订单/.test(text)) {\n        orderToQuoteSetupFromDraft();\n        return true;\n      }",
        "      if (/逐项报价|下一步|确认选品|生成订单|评估交期/.test(text)) {\n        if (ctx().deliveryLinesMode) {\n          confirmDeliveryLines({ simulateUserMsg: false });\n          return true;\n        }\n        orderToQuoteSetupFromDraft();\n        return true;\n      }",
        1,
    )

    awaiting_block = """    if (ctx().deliveryLinesMode && ctx().orderDraft && ctx().orderDraft.awaitingDemand) {
      enterSkill('delivery');
      const text = (t || '').trim();
      if (!text) return true;
      if (isPlanDemandSkipPhrase(text)) return skipDeliveryDemandToPick();
      if (handleQuoteDemandEditUtterance(text, { simulateUserMsg: false })) return true;
      return submitDeliveryDemand(text, {
        revise: !!(ctx().orderDraft.demandText && ctx().orderDraft.demandText.trim()),
        forcePickCard: true
      });
    }
"""

    if "ctx().deliveryLinesMode && ctx().orderDraft && ctx().orderDraft.awaitingDemand" not in merged:
        merged = merged.replace(
            "    if (ctx().quoteDraft && ctx().quoteDraft.awaitingDemand) {",
            awaiting_block + "    if (ctx().quoteDraft && ctx().quoteDraft.awaitingDemand) {",
            1,
        )

    delivery_handlers = """
    if (action === 'delivery-to-order') {
      handleDeliveryToOrder();
      return true;
    }
    if (action === 'delivery-to-progress') {
      handleDeliveryToProgress(btn.getAttribute('data-oid'));
      return true;
    }"""

    if "action === 'delivery-to-order'" not in merged:
        merged = merged.replace(
            "    if (action === 'delivery-submit') {\n      submitDelivery();\n      return true;\n    }",
            "    if (action === 'delivery-submit') {\n      submitDelivery();\n      return true;\n    }" + delivery_handlers,
            1,
        )

    create_handlers = """
    if (action === 'delivery-create-new') {
      setDeliverySkillAtEntry(false);
      const c = activeCustomer() || requireCustomer('delivery');
      if (!c) return true;
      App.pushAiHtml(renderDeliverySourceCard(c));
      rescanAnnotationPins();
      return true;
    }
    if (action === 'delivery-source-quote') {
      beginDeliveryFromQuote(btn.getAttribute('data-quote-id') || undefined);
      return true;
    }
    if (action === 'delivery-source-order') {
      beginDeliveryFromOrder(btn.getAttribute('data-oid') || undefined);
      return true;
    }
    if (action === 'delivery-source-lines') {
      beginDeliveryLines();
      return true;
    }
    if (action === 'delivery-quote-pick') {
      const qid = btn.getAttribute('data-quote-id');
      const q = quotesForCustomer((activeCustomer() || {}).id).find(function (x) {
        return x.id === qid;
      });
      if (q) {
        persistQuote(q);
        openDeliveryForm({
          sourceType: 'quote',
          quoteId: q.id,
          total: q.total,
          lines: q.lines || []
        });
      }
      return true;
    }
    if (action === 'delivery-order-pick') {
      const oid = btn.getAttribute('data-oid');
      const o = DemoData.orders.find(function (x) {
        return x.id === oid;
      });
      deliveryOpenFormForOrder(o);
      return true;
    }
    if (action === 'delivery-lines-confirm') {
      confirmDeliveryLines({ simulateUserMsg: true });
      return true;
    }
    if (action === 'delivery-lines-to-cart') {
      confirmDeliveryLines({ simulateUserMsg: true });
      return true;
    }"""

    if "action === 'delivery-create-new'" not in merged:
        merged = merged.replace(
            "    if (action === 'order-from-quote') {",
            create_handlers + "\n    if (action === 'order-from-quote') {",
            1,
        )

    skip_delivery = """    if (action === 'delivery-skip-demand') {
      skipDeliveryDemandToPick({ simulateUserMsg: true });
      return true;
    }
"""
    if "action === 'delivery-skip-demand'" not in merged:
        merged = merged.replace(
            "    if (action === 'quote-skip-demand') {",
            "    if (action === 'quote-skip-demand') {\n      skipQuoteDemandToPick({ simulateUserMsg: true });\n      return true;\n    }\n" + skip_delivery,
            1,
        )

    delivery_demand_submit = """    if (action === 'delivery-demand-submit') {
      const card = btn.closest('[data-spec-id="card-delivery-demand"]');
      const fromInput = readDemandTextFromCardEl(card);
      const hadDemand = !!(ctx().orderDraft && ctx().orderDraft.demandText && ctx().orderDraft.demandText.trim());
      const fromBubble = getLatestUserChatText();
      const text = fromInput || fromBubble;
      if (!text) {
        App.toast('请在输入框或对话中描述采购需求');
        return true;
      }
      submitDeliveryDemand(text, {
        simulateUserMsg: !!fromInput,
        revise: hadDemand,
        forcePickCard: true
      });
      return true;
    }
"""
    if "action === 'delivery-demand-submit'" not in merged:
        merged = merged.replace(
            "    if (action === 'quote-demand-submit') {",
            delivery_demand_submit + "    if (action === 'quote-demand-submit') {",
            1,
        )

    quote_edit_patch = """    if (action === 'quote-edit-demand' || action === 'quote-add-demand') {
      if (ctx().deliveryLinesMode) {
        openDeliveryDemandEdit({
          edit: action === 'quote-edit-demand',
          simulateUserMsg: true
        });
        return true;
      }"""

    if "deliveryLinesMode) {\n        openDeliveryDemandEdit" not in merged:
        merged = re.sub(
            r"    if \(action === 'quote-edit-demand' \|\| action === 'quote-add-demand'\) \{\n      const inp = document\.getElementById\('quote-pick-query-input'\);",
            quote_edit_patch + "\n      const inp = document.getElementById('quote-pick-query-input');",
            merged,
            count=1,
        )

    order_cart_patch = """    if (action === 'order-to-cart' || action === 'order-to-quote-setup') {
      if (ctx().deliveryLinesMode) {
        confirmDeliveryLines({ simulateUserMsg: true });
      } else {"""

    if "order-to-cart' || action === 'order-to-quote-setup'" not in merged:
        merged = re.sub(
            r"    if \(action === 'order-to-cart' \|\| action === 'order-to-quote-setup'\) \{\n      orderToQuoteSetupFromDraft",
            order_cart_patch + "\n        orderToQuoteSetupFromDraft",
            merged,
            count=1,
        )
        merged = merged.replace(
            "        orderToQuoteSetupFromDraft({ simulateUserMsg: true });\n      return true;\n    }",
            "        orderToQuoteSetupFromDraft({ simulateUserMsg: true });\n      }\n      return true;\n    }",
            1,
        )

    (ROOT / "v1.3.0/js/skills.js").write_text(merged, encoding="utf-8")
    print(f"skills.js merged: {len(merged.splitlines())} lines")


def merge_demo_data():
    v12 = (ROOT / "v1.2.0/js/demo-data.js").read_text(encoding="utf-8")
    v13 = (ROOT / "v1.3.0/js/demo-data.js").read_text(encoding="utf-8")

    merged = v12

    v13_block = """  /** v1.3.0 订单类型（列表/进度统一枚举） */
  orderStatuses: ['未审核', '销售审核', '已审核', '已完成', '异常'],
  orderStatusMeta: {
    未审核: { badgeClass: 'sc-badge--muted', hint: '待内勤受理' },
    销售审核: { badgeClass: 'sc-badge--primary', hint: '销售主管审核中' },
    已审核: { badgeClass: 'sc-badge--new', hint: '审核通过，可排产履约' },
    已完成: { badgeClass: 'sc-badge--done', hint: '订单已关闭' },
    异常: { badgeClass: 'sc-badge--old', hint: '需处理异常后继续' }
  },
  /** 交期评审·按订单：未排程订单（非待提交、非已完成；已标记 scheduled:true 的排除） */
  isOrderUnscheduled: function (order) {
    if (!order || !order.status) return false;
    if (order.status === this.orderStatusPendingSubmit) return false;
    if (order.status === '已完成') return false;
    if (order.scheduled === true) return false;
    return true;
  },
  /** @deprecated 交期评审已改为按货品行配置，候选项见 processVersionOptions(product, skuId) */
  deliveryProcessVersions: ['标准版', 'V2024.1', 'V2024.2', 'V2025-A'],
  /** 交期评审演示 · 产线名称（历史演示字段，保留兼容） */
  deliveryReviewLines: ['机加工一线', '装配二线', '仓储发运线'],
  /** 交期评审 · 是否生成采购计划 */
  procurementPlanOptions: [
    { value: 'yes', label: '是', generate: true },
    { value: 'no', label: '否', generate: false }
  ],
"""

    if "orderStatuses:" not in merged:
        merged = merged.replace("  orders: [", v13_block + "  orders: [", 1)

    orders_match = re.search(r"  orders: \[.*?\n  \],\n  recentCustomers:", v13, re.DOTALL)
    if orders_match:
        merged = re.sub(
            r"  orders: \[.*?\n  \],\n  recentCustomers:",
            orders_match.group(0),
            merged,
            count=1,
            flags=re.DOTALL,
        )

    (ROOT / "v1.3.0/js/demo-data.js").write_text(merged, encoding="utf-8")
    print("demo-data.js merged")


def merge_app():
    v12 = (ROOT / "v1.2.0/js/app.js").read_text(encoding="utf-8")
    v13 = (ROOT / "v1.3.0/js/app.js").read_text(encoding="utf-8")

    pick_block = (
        "      const pickFreeAttr = e.target.closest('[data-action=\"pick-free-attr\"]');\n"
        "      if (pickFreeAttr && window.Skills && Skills.onPickFreeAttrChange) Skills.onPickFreeAttrChange(pickFreeAttr);\n"
    )

    if "pick-free-attr" not in v13:
        v13 = v13.replace(
            "const quoteLineProcess = e.target.closest('[data-action=\"quote-line-process\"]');",
            pick_block.strip() + "\n      const quoteLineProcess = e.target.closest('[data-action=\"quote-line-process\"]');",
            1,
        )
        v13 = v13.replace(
            "e.target.closest('[data-action=\"quote-line-tax\"]') ||",
            "e.target.closest('[data-action=\"quote-line-tax\"]') ||\n        e.target.closest('[data-action=\"pick-free-attr\"]') ||",
            1,
        )

    (ROOT / "v1.3.0/js/app.js").write_text(v13, encoding="utf-8")
    print("app.js merged")


def merge_css():
    v12_lines = read_lines(ROOT / "v1.2.0/css/main.css")
    v13_css = (ROOT / "v1.3.0/css/main.css").read_text(encoding="utf-8")

    extra = ""
    if ".sc-pick-free-attrs" not in v13_css:
        extra += "".join(v12_lines[2053:2081])
    if ".sc-order-line-cards" not in v13_css:
        extra += "".join(v12_lines[2520:2642])

    if extra:
        v13_css = v13_css.rstrip() + "\n\n/* v1.2.0 自由项与下单确认子卡片 */\n" + extra
        (ROOT / "v1.3.0/css/main.css").write_text(v13_css, encoding="utf-8")
        print("main.css merged")
    else:
        print("main.css: no new blocks needed")


def merge_index():
    html = (ROOT / "v1.3.0/index.html").read_text(encoding="utf-8")
    html = re.sub(r"demo-data\.js\?v=[^\"]+", "demo-data.js?v=20260610d", html)
    html = re.sub(r"skills\.js\?v=[^\"]+", "skills.js?v=20260610d", html)
    html = re.sub(r"app\.js\?v=[^\"]+", "app.js?v=20260610d", html)
    html = re.sub(r"css/main\.css\?v=[^\"]+", "css/main.css?v=20260610d", html)
    (ROOT / "v1.3.0/index.html").write_text(html, encoding="utf-8")
    print("index.html updated")


if __name__ == "__main__":
    merge_skills()
    merge_demo_data()
    merge_app()
    merge_css()
    merge_index()
