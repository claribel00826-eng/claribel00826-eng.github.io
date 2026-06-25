window.Skills = (function () {
  let App;
  const PLAN_MORE_PAGE_SIZE = 5;
  const COPY_ORDER_LIST_PAGE_SIZE = 10;
  let pickMoreObserver = null;

  function init(app) {
    App = app;
    if (!App.state.ctx) App.state.ctx = {};
  }

  function ctx() {
    if (!App.state.ctx) App.state.ctx = {};
    return App.state.ctx;
  }

  function isActiveFlowCard(specId) {
    return App.isLatestFlowCardActive && App.isLatestFlowCardActive(specId);
  }


  /** 当前消息卡片内的补充说明，不触发「新消息卡片」失效 */
  function pushAiMeta(html) {
    App.pushAiHtml(html, { samePage: true });
  }

  /** 点击推进流程时模拟用户发话（语音/键盘已发过则勿再调） */
  function simulateUserUtterance(text) {
    const t = (text || '').trim();
    if (!t || !App.pushUserMsg) return;
    App.pushUserMsg(t);
  }

  function simulateUserUtteranceUnlessDuplicate(text) {
    simulateUserUtterance(text);
  }

  function formatProductNamesLabel(ids, maxShow) {
    maxShow = maxShow == null ? 3 : maxShow;
    const names = (ids || [])
      .map(function (id) {
        const p = productById(id);
        return p && p.name ? p.name : '';
      })
      .filter(Boolean);
    if (!names.length) return '';
    if (names.length === 1) return names[0];
    if (names.length <= maxShow) return names.join('、');
    return names.slice(0, maxShow).join('、') + '等' + names.length + '种商品';
  }

  function utterancePlanPreviewFromIds(ids) {
    const label = formatProductNamesLabel(ids);
    return label ? label + '，预览方案' : '预览方案';
  }

  function utterancePlanPreview() {
    syncPlanFilterFromDom();
    return utterancePlanPreviewFromIds(planSelectedIds());
  }

  function utteranceQuotePickToSetup() {
    syncPickQueryFromDom('quote');
    const label = formatProductNamesLabel(quoteSelectedIds());
    return label ? label + '，逐项报价' : '下一步：逐项报价';
  }

  function utteranceOrderPickToSetup() {
    syncPickQueryFromDom('order');
    const label = formatProductNamesLabel(orderSelectedIds());
    return label ? label + '，逐项报价' : '下一步：逐项报价';
  }

  function pushNextAiCard(html, utterance) {
    if (utterance) simulateUserUtterance(utterance);
    App.pushAiHtml(html);
  }

  function focusSpecHost(specId) {
    if (!specId) return;
    setTimeout(function () {
      const nodes = document.querySelectorAll('[data-spec-id="' + specId + '"]');
      const el = nodes.length ? nodes[nodes.length - 1] : null;
      if (el && el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 320);
  }

  /**
   * 缺槽引导：话术 + 打开对应表单/卡片（便于语音或手动填写）
   * 与 annotation-docs/05、chat-llm 一致：自当前步起扫描本步及后续各步，在首缺槽步骤打开界面
   */
  function guideMissingSlot(key, opts) {
    opts = opts || {};
    const g = SLOT_GUIDES[key];
    if (!g) {
      if (opts.message) App.toast(opts.message);
      return;
    }
    const msg = opts.message != null ? opts.message : g.message;
    const hint = opts.hint != null ? opts.hint : g.hint;
    if (opts.leadHtml) {
      App.pushAiHtml(opts.leadHtml);
    } else if (g.leadHtml) {
      App.pushAiHtml(g.leadHtml);
    } else if (g.pushLead !== false && msg) {
      let lead =
        '<p class="sc-reply-lead"><strong>【待填写】</strong> ' + App.escapeHtml(msg) + '</p>';
      if (hint) lead += '<p class="sc-card__meta">' + App.escapeHtml(hint) + '</p>';
      App.pushAiHtml(lead);
    }
    const toastMsg =
      g.toast === true ? msg : typeof g.toast === 'string' ? g.toast : g.pushLead === false ? msg : null;
    if (toastMsg && !opts.skipToast) App.toast(toastMsg);
    if (g.ensureCard) g.ensureCard(opts);
    if (g.openSheet) g.openSheet(opts);
    focusSpecHost(g.focusSpecId || g.specId);
    if (g.after) g.after(opts);
    if (window.Annotation && Annotation.scanHosts) window.Annotation.scanHosts();
  }

  const SLOT_GUIDES = {
    customer: {
      message: '须先确定客户',
      hint: '点「选择客户」打开列表，或话术前加「给某某公司」',
      ensureCard: function (opts) {
        const sid = opts.skillId || App.state.activeSkill || 'quote';
        if (App.promptForCustomerSelection) {
          App.promptForCustomerSelection(sid, { skipUserMsg: true, delayMs: 0 });
        }
      },
      specId: 'card-customer-prompt',
      pushLead: false
    },
    intentNeedFeature: {
      message: '请说明要做的事情，例如配个方案、报价或下单？',
      hint: '可点底部技能条，或直接说「配个方案」「报价」「下单」',
      specId: 'chat-skill-bar'
    },
    planDemand: {
      message: '请描述采购需求',
      hint: '例：伺服电机和传动齿轮箱各 2 台',
      specId: 'card-plan-demand',
      ensureCard: function () {
        enterSkill('plan');
        const c = activeCustomer();
        if (!c) return;
        if (!document.querySelector('[data-spec-id="card-plan-demand"]')) {
          ensurePlan(c);
          const plan = ctx().plan;
          if (plan) plan.awaitingDemand = true;
          const isOld = DemoData.isOldCustomer(c, DemoData.demoSalesUser);
          App.pushAiHtml(
            renderDemandPromptCard(c, {
              specId: 'card-plan-demand',
              allowSkip: isOld
            })
          );
        }
      }
    },
    quoteDemand: {
      message: '请描述采购需求',
      hint: '例：伺服电机和传动齿轮箱各 2 台',
      specId: 'card-quote-demand',
      ensureCard: function () {
        enterSkill('quote');
        const c = activeCustomer();
        if (!c) return;
        if (!document.querySelector('[data-spec-id="card-quote-demand"]')) {
          ensureQuoteDraft(c);
          const d = ctx().quoteDraft;
          if (d) d.awaitingDemand = true;
          const isOld = DemoData.isOldCustomer(c, DemoData.demoSalesUser);
          App.pushAiHtml(renderDemandPromptCard(c, { specId: 'card-quote-demand', allowSkip: isOld }));
        }
      }
    },
    deliveryDemand: {
      message: '请描述采购需求',
      hint: '例：伺服电机和传动齿轮箱各 2 台',
      specId: 'card-delivery-demand',
      ensureCard: function () {
        enterSkill('delivery');
        const c = activeCustomer();
        if (!c) return;
        ctx().deliveryLinesMode = true;
        if (!document.querySelector('[data-spec-id="card-delivery-demand"]')) {
          ensureOrderDraft(c);
          const d = ctx().orderDraft;
          if (d) d.awaitingDemand = true;
          const isOld = DemoData.isOldCustomer(c, DemoData.demoSalesUser);
          App.pushAiHtml(
            renderDemandPromptCard(c, { specId: 'card-delivery-demand', allowSkip: isOld })
          );
        }
      }
    },
    planEntryChoice: {
      message: '请先选择「查看历史数据」或「创建新方案」',
      hint: '可说「查看历史数据」「创建新方案」，或点入口卡按钮',
      toast: '请先选择查看历史或创建新方案',
      specId: 'card-plan-entry',
      ensureCard: function () {
        enterSkill('plan');
        const c = activeCustomer();
        if (!c) return;
        if (!document.querySelector('[data-spec-id="card-plan-entry"]')) {
          setPlanSkillAtEntry(true);
          App.pushAiHtml(renderPlanSkillEntryCard(c));
        }
      }
    },
    quoteEntryChoice: {
      message: '请先选择「查看历史报价单」或「新建报价」',
      hint: '可说「查看历史报价单」「报价」「新建报价」，或点入口卡按钮',
      toast: '请先选择查看历史或新建报价',
      specId: 'card-quote-entry',
      ensureCard: function () {
        enterSkill('quote');
        const c = activeCustomer();
        if (!c) return;
        if (!document.querySelector('[data-spec-id="card-quote-entry"]')) {
          setQuoteSkillAtEntry(true);
          App.pushAiHtml(renderQuoteSkillEntryCard(c));
        }
      }
    },
    orderEntryChoice: {
      message: '请先选择「查看历史订单」或「确认下单」',
      hint: '可说「查看历史订单」「确认下单」，或点入口卡按钮',
      toast: '请先选择查看历史或确认下单',
      specId: 'card-order-entry',
      ensureCard: function () {
        enterSkill('order');
        const c = activeCustomer();
        if (!c) return;
        if (!document.querySelector('[data-spec-id="card-order-entry"]')) {
          setOrderSkillAtEntry(true);
          App.pushAiHtml(renderOrderSkillEntryCard(c));
        }
      }
    },
    planPickProducts: {
      message: '请先在选品卡勾选至少一种产品',
      hint: '勾选后点「预览方案」；或说「选品 伺服电机」再「预览方案」',
      toast: '请至少选择一种产品',
      specId: 'card-plan-pick',
      ensureCard: function () {
        enterSkill('plan');
        const c = activeCustomer();
        if (!c) return;
        if (!document.querySelector('[data-spec-id="card-plan-pick"]')) {
          ensurePlan(c);
          App.pushAiHtml(renderProductPickCard());
          schedulePlanPickLazyBind();
        }
      }
    },
    planCartEmpty: {
      message: '尚未预览方案，请先在选品卡勾选产品',
      hint: '在选品卡勾选后点「预览方案」，或说「预览方案」',
      toast: '请先勾选产品并预览方案',
      specId: 'card-plan-pick',
      ensureCard: function () {
        guideMissingSlot('planPickProducts', { skipToast: true });
      }
    },
    planTemplate: {
      message: '请选择方案模板',
      hint: '在卡片中点选或说「第1个」、模板名称；说「保存方案」确认',
      toast: '请选择方案模板',
      specId: 'sheet-plan-template',
      ensureCard: function () {
        if (!isActiveFlowCard('sheet-plan-template')) openPlanTemplateSheet();
      },
      focusSpecId: 'sheet-plan-template'
    },
    quoteSource: {
      message: '请选择报价来源：按方案报价或直接选品',
      specId: 'card-quote-source',
      ensureCard: function () {
        enterSkill('quote');
        const c = activeCustomer();
        if (!c) return;
        if (document.querySelector('[data-spec-id="card-quote-pick"]')) return;
        if (document.querySelector('[data-spec-id="card-quote-source"]')) return;
        if (!schemesForCustomer(c.id).length) {
          quoteDirectStart();
          return;
        }
        App.pushAiHtml(
          '<p class="sc-reply-lead">请选择报价方式。</p>' + renderQuoteSourceCard()
        );
      }
    },
    quoteNoScheme: {
      message: '暂无本客户方案，请从选品报价卡选品后逐项报价',
      hint: '可说「选品 关键词」或勾选产品',
      specId: 'card-quote-pick',
      ensureCard: function () {
        const c = activeCustomer();
        if (!c) return;
        enterSkill('quote');
        if (!document.querySelector('[data-spec-id="card-quote-pick"]')) {
          quoteDirectStart();
        }
      }
    },
    quoteSchemePick: {
      message: '请选择要报价的方案',
      hint: '在下列方案中点选一行（方案名称），或说出方案名称/编号',
      specId: 'card-scheme-pick',
      ensureCard: function () {
        enterSkill('quote');
        const c = activeCustomer();
        if (!c) return;
        if (!document.querySelector('[data-spec-id="card-scheme-pick"]')) {
          const pool = schemesForCustomer(c.id);
          if (pool.length) pushSchemePickForQuote(c, null, pool);
        }
      }
    },
    quotePickProducts: {
      message: '请至少选择一种产品',
      hint: '在选品报价卡勾选产品，或补充品名后重试',
      toast: '请至少选择一种产品',
      specId: 'card-quote-pick',
      ensureCard: function () {
        enterSkill('quote');
        const c = activeCustomer();
        if (!c) return;
        if (!document.querySelector('[data-spec-id="card-quote-pick"]')) {
          quoteDirectStart();
        }
      }
    },
    quoteLinePrice: {
      message: '请为每项产品填写本单报价',
      hint: '在逐项报价卡片中填写单价，或说「伺服电机改4200」',
      toast: '请为每项产品填写本单报价',
      specId: 'sheet-quote-setup',
      ensureCard: function () {
        if (!isQuoteSetupOpen()) openQuoteSetupSheet();
      },
      focusSpecId: 'sheet-quote-setup'
    },
    quoteTemplate: {
      message: '请选择报价单模板',
      toast: '请选择报价单模板',
      specId: 'sheet-quote-template',
      ensureCard: function () {
        if (!isQuoteTemplateOpen()) openQuoteTemplateSheet();
      },
      focusSpecId: 'sheet-quote-template'
    },
    orderSource: {
      message: '请选择下单来源：按报价单或直接选品',
      specId: 'card-order-source',
      ensureCard: function () {
        enterSkill('order');
        const c = activeCustomer();
        if (!c) return;
        if (document.querySelector('[data-spec-id="card-quote-pick"]')) return;
        if (document.querySelector('[data-spec-id="card-order-source"]')) return;
        beginOrderCreate();
      }
    },
    orderNoQuotes: {
      message: '暂无本客户报价单，请从选品报价卡选品后逐项报价',
      hint: '可说「选品 关键词」或勾选产品',
      toast: '暂无报价单，已进入选品报价',
      specId: 'card-quote-pick',
      ensureCard: function () {
        const c = activeCustomer();
        if (!c) return;
        enterSkill('order');
        if (!document.querySelector('[data-spec-id="card-quote-pick"]')) {
          orderDirectStart();
        }
      }
    },
    orderQuotePick: {
      message: '请选择要下单的报价单',
      hint: '点选下列一行，或说出报价单编号/模板名',
      specId: 'card-quote-select',
      ensureCard: function () {
        enterSkill('order');
        const c = activeCustomer();
        if (!c) return;
        if (!document.querySelector('[data-spec-id="card-quote-select"]')) {
          const pool = quotesForCustomer(c.id);
          if (pool.length) pushQuotePickForOrder(c, null, pool);
        }
      }
    },
    orderPickProducts: {
      message: '请至少选择一种产品',
      specId: 'card-quote-pick',
      ensureCard: function () {
        enterSkill('order');
        const c = activeCustomer();
        if (!c) return;
        if (!document.querySelector('[data-spec-id="card-quote-pick"]')) {
          orderDirectStart();
        }
      }
    },
    orderLinePrice: {
      message: '请为订单明细填写本单报价',
      hint: '在逐项报价卡片填写，语音改价需对准当前表行',
      specId: 'sheet-quote-setup',
      ensureCard: function () {
        if (!isQuoteSetupOpen()) openQuoteSetupSheet();
      },
      focusSpecId: 'sheet-quote-setup'
    },
    orderDetail: {
      message: '请先选择订单来源与明细',
      specId: 'card-order-source',
      ensureCard: function () {
        guideMissingSlot('orderSource', { skipToast: true });
      }
    },
    productMatchFail: {
      message: '未能匹配到产品，请补充品名或走选品',
      hint: '将打开选品卡，可手动勾选或说「选品 关键词」',
      ensureCard: function (opts) {
        if (opts && opts.skill === 'order') guideMissingSlot('orderPickProducts', { skipToast: true });
        else guideMissingSlot('planPickProducts', { skipToast: true });
      }
    }
  };

  function utteranceFor(id) {
    return (DemoData.skillUtterances && DemoData.skillUtterances[id]) || id;
  }

  function enterSkill(skillId) {
    if (App.switchActiveSkill) App.switchActiveSkill(skillId, { skipSkillAnnounce: true });
  }

  function requireCustomer(pendingSkillId) {
    const c = activeCustomer();
    if (c) return c;
    guideMissingSlot('customer', { skillId: pendingSkillId || App.state.activeSkill });
    return null;
  }

  function activeCustomer() {
    return App.getCustomer(App.state.selectedFollowUpId || App.state.customerId);
  }

  function ensureSchemesStore() {
    if (!Array.isArray(ctx().schemes)) {
      ctx().schemes = [];
      if (ctx().scheme && ctx().scheme.id) ctx().schemes.push(ctx().scheme);
    }
  }

  function schemesForCustomer(cid) {
    ensureSchemesStore();
    return ctx().schemes.filter((s) => s.customerId === cid);
  }

  function persistScheme(scheme) {
    ensureSchemesStore();
    const idx = ctx().schemes.findIndex((s) => s.id === scheme.id);
    if (idx >= 0) ctx().schemes[idx] = scheme;
    else ctx().schemes.push(scheme);
    ctx().scheme = scheme;
    ctx().activeSchemeId = scheme.id;
    App.saveState();
    return scheme;
  }

  function schemePickSummary(s) {
    const lines = s.lines || [];
    if (!lines.length) return '无明细';
    const preview = lines
      .slice(0, 2)
      .map((l) => (l.name || '品项') + '×' + (l.qty || 1))
      .join('、');
    return lines.length > 2 ? preview + ' 等' + lines.length + '项' : preview;
  }

  function setActivePickList(type, list, mode) {
    const display = (list || []).slice().reverse();
    ctx().activePickList = {
      type: type,
      mode: mode || (type === 'quote' ? 'order' : 'quote'),
      ids: display.map(function (item) {
        return item.id;
      })
    };
  }

  function clearActivePickList() {
    delete ctx().activePickList;
  }

  function parsePickListIndex(text) {
    const t = (text || '').trim().replace(/\s+/g, '');
    if (!t) return null;
    const digitMap = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
    function parseToken(tok) {
      if (/^\d+$/.test(tok)) return parseInt(tok, 10);
      if (tok === '十') return 10;
      if (tok.length === 2 && tok[0] === '十' && digitMap[tok[1]]) return 10 + digitMap[tok[1]];
      if (tok.length === 2 && tok[1] === '十' && digitMap[tok[0]]) return digitMap[tok[0]] * 10;
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

  function latestPickListCardSpecId(type, pick) {
    if (type === 'scheme') return 'card-scheme-pick';
    if (type === 'order') {
      if (pick && (pick.mode === 'copy' || pick.mode === 'change' || pick.mode === 'progress')) {
        return 'card-order-pick';
      }
      return 'card-order-select';
    }
    return 'card-quote-select';
  }

  function applySchemePickById(sid, opts) {
    opts = opts || {};
    const demand = ctx().pendingSchemeQuoteDemand;
    delete ctx().pendingSchemeQuoteDemand;
    const scheme = schemeForActiveCustomer(sid);
    if (!scheme) {
      App.toast('未找到所选方案');
      return false;
    }
    if (opts.simulateUserMsg) {
      simulateUserUtterance(
        '选择方案 ' + (scheme.templateName || scheme.id)
      );
    }
    clearActivePickList();
    persistScheme(scheme);
    if (demand) {
      enterSkill('quote');
      publishQuoteFromSchemeDemand(scheme, demand);
    } else {
      quoteFromScheme(sid);
    }
    return true;
  }

  function applyQuotePickById(qid, opts) {
    opts = opts || {};
    const quote = quoteForActiveCustomer(qid);
    if (!quote) {
      App.toast('未找到所选报价单');
      return false;
    }
    if (opts.simulateUserMsg) {
      simulateUserUtterance('按报价单 ' + quote.id + ' 下单');
    }
    clearActivePickList();
    const rowNote = ctx()._lastPickRowIndex ? '（第 ' + ctx()._lastPickRowIndex + ' 条）' : '';
    delete ctx()._lastPickRowIndex;
    enterSkill('order');
    App.pushAiHtml(
      '<p class="sc-reply-lead">已按报价单 <strong>' +
        App.escapeHtml(quote.id) +
        '</strong>' +
        rowNote +
        ' 打开下单确认。</p>'
    );
    applyOrderFromQuote(quote);
    return true;
  }

  /** 选择方案/报价单卡展示时：语音「第 N 条」或名称/编号点选 */
  function tryActivePickListUtterance(text) {
    const pick = ctx().activePickList;
    if (!pick || !pick.ids || !pick.ids.length) return false;
    const specId = latestPickListCardSpecId(pick.type, pick);
    if (!document.querySelector('[data-spec-id="' + specId + '"]')) return false;

    const t = (text || '').trim();
    const rowIdx = parsePickListIndex(t);
    if (rowIdx != null) {
      const id = pick.ids[rowIdx - 1];
      if (!id) {
        App.toast('没有第 ' + rowIdx + ' 条，当前共 ' + pick.ids.length + ' 条可选');
        return true;
      }
      ctx()._lastPickRowIndex = rowIdx;
      if (pick.mode === 'view') {
        if (pick.type === 'scheme') {
          return viewSchemeById(id, { announceRow: rowIdx });
        }
        if (pick.type === 'order') {
          return viewOrderById(id, { announceRow: rowIdx });
        }
        return viewQuoteById(id, { announceRow: rowIdx });
      }
      if (pick.type === 'scheme') {
        App.pushAiHtml(
          '<p class="sc-card__meta">已选第 <strong>' +
            rowIdx +
            '</strong> 条方案，进入逐项报价。</p>'
        );
        return applySchemePickById(id);
      }
      if (pick.type === 'order') {
        if (pick.mode === 'copy') {
          return copyOrderToConfirm(id, { simulateUserMsg: true });
        }
        if (pick.mode === 'change') {
          openChangeSheet(id, { simulateUserMsg: true });
          return true;
        }
        if (pick.mode === 'progress') {
          const o = DemoData.orders.find(function (x) {
            return x.id === id;
          });
          if (o) pushOrderProgressDetail(o);
          return true;
        }
        if (pick.mode === 'view') {
          return viewOrderById(id, { announceRow: rowIdx });
        }
      }
      return applyQuotePickById(id);
    }

    const k = t.toLowerCase();
    if (k.length >= 2) {
    const c = activeCustomer();
      if (c && pick.type === 'scheme') {
        const hit = pick.ids
          .map(function (id) {
            return schemesForCustomer(c.id).find(function (s) {
              return s.id === id;
            });
          })
          .filter(Boolean)
          .find(function (s) {
            return (
              (s.templateName || '').toLowerCase().indexOf(k) >= 0 ||
              s.id.toLowerCase().indexOf(k) >= 0
            );
          });
        if (hit) {
          if (pick.mode === 'view') return viewSchemeById(hit.id);
          App.pushAiHtml(
            '<p class="sc-card__meta">已选方案「' + App.escapeHtml(hit.templateName || hit.id) + '」。</p>'
          );
          return applySchemePickById(hit.id);
        }
      }
      if (c && pick.type === 'quote') {
        const hit = pick.ids
          .map(function (id) {
            return quotesForCustomer(c.id).find(function (q) {
              return q.id === id;
            });
          })
          .filter(Boolean)
          .find(function (q) {
            return (
              q.id.toLowerCase().indexOf(k) >= 0 ||
              (q.templateName || '').toLowerCase().indexOf(k) >= 0
            );
          });
        if (hit) {
          if (pick.mode === 'view') return viewQuoteById(hit.id);
          App.pushAiHtml(
            '<p class="sc-card__meta">已选报价单「' + App.escapeHtml(hit.id) + '」。</p>'
          );
          return applyQuotePickById(hit.id);
        }
      }
      if (c && pick.type === 'order') {
        const hit = pick.ids
          .map(function (id) {
            return ordersForCustomer(c.id).find(function (o) {
              return o.id === id;
            });
          })
          .filter(Boolean)
          .find(function (o) {
            return (
              (o.no || '').toLowerCase().indexOf(k) >= 0 ||
              (o.status || '').toLowerCase().indexOf(k) >= 0
            );
          });
        if (hit) {
          return viewOrderById(hit.id);
        }
      }
    }
    return false;
  }

  function isViewSchemeHistoryPhrase(t) {
    const text = (t || '').trim();
    if (!text) return false;
    if (/配个方案|做方案|方案速配|按方案\s*报价|去报价|生成方案|保存方案|创建新方案|新建方案/.test(text))
      return false;
    if (/(?:查看|看看|列出|有哪些|历史|打开|预览|显示).*(?:历史数据|方案)/.test(text)) return true;
    if (/查看历史数据|历史数据/.test(text)) return true;
    if (/(?:方案).*(?:列表|记录|历史|pdf|PDF)/i.test(text)) return true;
    if (/^预览\s*方案/.test(text)) return true;
    return false;
  }

  function isPlanSkillAtEntry() {
    return !!ctx().planSkillAtEntry;
  }

  function setPlanSkillAtEntry(on) {
    if (on) ctx().planSkillAtEntry = true;
    else if (ctx().planSkillAtEntry) delete ctx().planSkillAtEntry;
  }

  function isPlanCreateEntryPhrase(t) {
    const text = (t || '').trim();
    if (!text) return false;
    if (isViewSchemeHistoryPhrase(text)) return false;
    if (/创建新方案|新建方案|新方案|重新配方案|开始做方案|开始配方案/.test(text)) return true;
    if (/配个方案|做方案|方案速配/.test(text)) return true;
    return false;
  }

  function isPlanViewHistoryEntryPhrase(t) {
    return isViewSchemeHistoryPhrase(t);
  }

  function planEntryCustomerBadge(c) {
    if (!c || !DemoData.isNewCustomer) return '';
    if (DemoData.isNewCustomer(c)) {
      return '<span class="sc-badge sc-badge--new">新客户</span>';
    }
    if (DemoData.isOldCustomer && DemoData.isOldCustomer(c, DemoData.salesperson)) {
      return '<span class="sc-badge sc-badge--a">老客户</span>';
    }
    return '';
  }

  function renderPlanSkillEntryCard(c) {
    seedDemoHistoryIfEmpty(c);
    const count = schemesForCustomer(c.id).length;
    const historySub =
      count > 0 ? '共 ' + count + ' 个已保存方案' : '暂无已保存方案';
    const historyRow =
      count > 0
        ? '<button type="button" class="sc-plan-entry__option" data-action="plan-view-history">' +
          '<span class="sc-plan-entry__option-text"><span class="sc-plan-entry__option-title">查看历史方案</span>' +
          '<span class="sc-plan-entry__option-desc">' +
          App.escapeHtml(historySub) +
          '</span></span>' +
          '<span class="sc-plan-entry__chevron" aria-hidden="true">›</span></button>'
        : '<div class="sc-plan-entry__option sc-plan-entry__option--disabled" aria-disabled="true">' +
          '<span class="sc-plan-entry__option-text"><span class="sc-plan-entry__option-title">查看历史方案</span>' +
          '<span class="sc-plan-entry__option-desc">' +
          App.escapeHtml(historySub) +
          '</span></span></div>';
    return (
      '<div class="sc-card sc-card--plan-entry" data-spec-id="card-plan-entry">' +
      '<div class="sc-plan-entry__head">' +
      '<p class="sc-plan-entry__kicker">方案速配</p>' +
      '<div class="sc-plan-entry__customer-row">' +
      '<span class="sc-plan-entry__customer">' +
      App.escapeHtml(c.name) +
      '</span>' +
      planEntryCustomerBadge(c) +
      '</div></div>' +
      '<div class="sc-plan-entry__actions" role="group" aria-label="方案速配操作">' +
      historyRow +
      '<button type="button" class="sc-plan-entry__option sc-plan-entry__option--primary" data-action="plan-create-new">' +
      '<span class="sc-plan-entry__option-text"><span class="sc-plan-entry__option-title">创建新方案</span>' +
      '<span class="sc-plan-entry__option-desc">选品、预览并保存方案</span></span>' +
      '<span class="sc-plan-entry__chevron" aria-hidden="true">›</span></button>' +
      '</div></div>'
    );
  }

  function showPlanSkillEntry(opts) {
    opts = opts || {};
    const c = ensurePlan(opts.customer) || activeCustomer();
    if (!c) {
      requireCustomer('plan');
      return;
    }
    ensurePlan(c);
    setPlanSkillAtEntry(true);
    enterSkill('plan');
    const html =
      opts.leadHtml != null && !opts.onlyCard
        ? opts.leadHtml + renderPlanSkillEntryCard(c)
        : renderPlanSkillEntryCard(c);
    App.pushAiHtml(html);
    rescanAnnotationPins();
  }

  function openPlanHistoryFromEntry(opts) {
    opts = opts || {};
    setPlanSkillAtEntry(false);
    const c = activeCustomer() || requireCustomer('plan');
    if (!c) return;
    enterSkill('plan');
    seedDemoHistoryIfEmpty(c);
    const pool = schemesForCustomer(c.id);
    if (!pool.length) {
      App.pushAiHtml(renderPlanSkillEntryCard(c));
      setPlanSkillAtEntry(true);
      rescanAnnotationPins();
      return;
    }
    pushSchemeHistoryView(
      c,
      pool,
      opts.leadHtml || '<p class="sc-reply-lead">查看历史方案：</p>'
    );
    rescanAnnotationPins();
  }

  function resetPlanDraftForCreate(c) {
    ctx().plan = {
      customerId: c.id,
      filter: '',
      demandText: '',
      awaitingDemand: false,
      selected: {},
      sku: {},
      qty: {},
      templateId: null,
      moreVisible: PLAN_MORE_PAGE_SIZE
    };
  }

  function tryPlanEntryIntent(t) {
    if (!isPlanSkillAtEntry()) return false;
    const text = (t || '').trim();
    if (!text) return true;
    if (isPlanViewHistoryEntryPhrase(text)) {
      openPlanHistoryFromEntry();
      return true;
    }
    if (isPlanCreateEntryPhrase(text)) {
      beginPlanCreate();
      return true;
    }
    if (/^选品|^预览|^生成方案|^保存方案|^筛选|^过滤/.test(text)) {
      guideMissingSlot('planEntryChoice');
      return true;
    }
    guideMissingSlot('planEntryChoice');
    return true;
  }

  function isQuoteSkillAtEntry() {
    return !!ctx().quoteSkillAtEntry;
  }

  function setQuoteSkillAtEntry(on) {
    if (on) ctx().quoteSkillAtEntry = true;
    else if (ctx().quoteSkillAtEntry) delete ctx().quoteSkillAtEntry;
  }

  function isQuoteCreateEntryPhrase(t) {
    const text = (t || '').trim();
    if (!text) return false;
    if (isViewQuoteHistoryPhrase(text)) return false;
    if (isSchemeQuoteEntryPhrase(text)) return false;
    if (/创建新报价|新建报价|新报价|开始报价/.test(text)) return true;
    return isQuoteEntryPhrase(text);
  }

  function isQuoteViewHistoryEntryPhrase(t) {
    const text = (t || '').trim();
    if (isViewQuoteHistoryPhrase(text)) return true;
    if (isQuoteSkillAtEntry() && /查看历史数据/.test(text)) return true;
    return false;
  }

  function renderQuoteSkillEntryCard(c) {
    seedDemoHistoryIfEmpty(c);
    const count = quotesForCustomer(c.id).length;
    const historySub =
      count > 0 ? '共 ' + count + ' 份历史报价单' : '暂无历史报价单';
    const historyRow =
      count > 0
        ? '<button type="button" class="sc-plan-entry__option" data-action="quote-view-history">' +
          '<span class="sc-plan-entry__option-text"><span class="sc-plan-entry__option-title">查看历史报价单</span>' +
          '<span class="sc-plan-entry__option-desc">' +
          App.escapeHtml(historySub) +
          '</span></span>' +
          '<span class="sc-plan-entry__chevron" aria-hidden="true">›</span></button>'
        : '<div class="sc-plan-entry__option sc-plan-entry__option--disabled" aria-disabled="true">' +
          '<span class="sc-plan-entry__option-text"><span class="sc-plan-entry__option-title">查看历史报价单</span>' +
          '<span class="sc-plan-entry__option-desc">' +
          App.escapeHtml(historySub) +
          '</span></span></div>';
    return (
      '<div class="sc-card sc-card--plan-entry" data-spec-id="card-quote-entry">' +
      '<div class="sc-plan-entry__head">' +
      '<p class="sc-plan-entry__kicker">产品报价</p>' +
      '<div class="sc-plan-entry__customer-row">' +
      '<span class="sc-plan-entry__customer">' +
      App.escapeHtml(c.name) +
      '</span>' +
      planEntryCustomerBadge(c) +
      '</div></div>' +
      '<div class="sc-plan-entry__actions" role="group" aria-label="产品报价操作">' +
      historyRow +
      '<button type="button" class="sc-plan-entry__option sc-plan-entry__option--primary" data-action="quote-create-new">' +
      '<span class="sc-plan-entry__option-text"><span class="sc-plan-entry__option-title">新建报价</span>' +
      '<span class="sc-plan-entry__option-desc">按方案或直选品，逐项填价出报价单</span></span>' +
      '<span class="sc-plan-entry__chevron" aria-hidden="true">›</span></button>' +
      '</div></div>'
    );
  }

  function showQuoteSkillEntry(opts) {
    opts = opts || {};
    const c = activeCustomer() || requireCustomer('quote');
    if (!c) return;
    setQuoteSkillAtEntry(true);
    enterSkill('quote');
    const html =
      opts.leadHtml != null && !opts.onlyCard
        ? opts.leadHtml + renderQuoteSkillEntryCard(c)
        : renderQuoteSkillEntryCard(c);
    App.pushAiHtml(html);
    rescanAnnotationPins();
  }

  function openQuoteHistoryFromEntry(opts) {
    opts = opts || {};
    setQuoteSkillAtEntry(false);
    const c = activeCustomer() || requireCustomer('quote');
    if (!c) return;
    enterSkill('quote');
    seedDemoHistoryIfEmpty(c);
    const pool = quotesForCustomer(c.id);
    if (!pool.length) {
      App.pushAiHtml(renderQuoteSkillEntryCard(c));
      setQuoteSkillAtEntry(true);
      rescanAnnotationPins();
      return;
    }
    pushQuoteHistoryView(
      c,
      pool,
      opts.leadHtml ||
        '<p class="sc-reply-lead">为 <strong>' +
          App.escapeHtml(c.name) +
          '</strong> 查看历史报价单：</p>'
    );
    rescanAnnotationPins();
  }

  function tryQuoteEntryIntent(t) {
    if (!isQuoteSkillAtEntry()) return false;
    const text = (t || '').trim();
    if (!text) return true;
    if (isQuoteViewHistoryEntryPhrase(text)) {
      openQuoteHistoryFromEntry();
      return true;
    }
    if (isQuoteCreateEntryPhrase(text)) {
      beginQuoteCreate();
      return true;
    }
    if (/^选品|^按方案|^直接选品|^逐项|^生成报价单|^筛选|^过滤/.test(text)) {
      guideMissingSlot('quoteEntryChoice');
      return true;
    }
    guideMissingSlot('quoteEntryChoice');
    return true;
  }

  function isOrderSkillAtEntry() {
    return !!ctx().orderSkillAtEntry;
  }

  function setOrderSkillAtEntry(on) {
    if (on) ctx().orderSkillAtEntry = true;
    else if (ctx().orderSkillAtEntry) delete ctx().orderSkillAtEntry;
  }

  function isViewOrderHistoryPhrase(t) {
    const text = (t || '').trim();
    if (!text) return false;
    if (/确认下单|按报价单|直接选品|生成订单|给.+下单|复制订单|变更.*订单/.test(text)) return false;
    if (/进度|订单到哪|查订单/.test(text)) return false;
    if (/(?:查看|看看|列出|有哪些|历史|打开|显示).*(?:订单)/.test(text)) return true;
    if (/(?:订单).*(?:列表|记录|历史)/i.test(text)) return true;
    return false;
  }

  function isOrderCreateEntryPhrase(t) {
    const text = (t || '').trim();
    if (!text) return false;
    if (isViewOrderHistoryPhrase(text)) return false;
    if (/确认下单|开始下单|^下单$|生成订单/.test(text)) return true;
    return false;
  }

  function isOrderViewHistoryEntryPhrase(t) {
    const text = (t || '').trim();
    if (isViewOrderHistoryPhrase(text)) return true;
    if (isOrderSkillAtEntry() && /查看历史数据/.test(text)) return true;
    return false;
  }

  function renderOrderSkillEntryCard(c) {
    const count = ordersForCustomer(c.id).length;
    const historySub = count > 0 ? '共 ' + count + ' 笔历史订单' : '暂无历史订单';
    const historyRow =
      count > 0
        ? '<button type="button" class="sc-plan-entry__option" data-action="order-view-history">' +
          '<span class="sc-plan-entry__option-text"><span class="sc-plan-entry__option-title">查看历史订单</span>' +
          '<span class="sc-plan-entry__option-desc">' +
          App.escapeHtml(historySub) +
          '</span></span>' +
          '<span class="sc-plan-entry__chevron" aria-hidden="true">›</span></button>'
        : '<div class="sc-plan-entry__option sc-plan-entry__option--disabled" aria-disabled="true">' +
          '<span class="sc-plan-entry__option-text"><span class="sc-plan-entry__option-title">查看历史订单</span>' +
          '<span class="sc-plan-entry__option-desc">' +
          App.escapeHtml(historySub) +
          '</span></span></div>';
    return (
      '<div class="sc-card sc-card--plan-entry" data-spec-id="card-order-entry">' +
      '<div class="sc-plan-entry__head">' +
      '<p class="sc-plan-entry__kicker">确认下单</p>' +
      '<div class="sc-plan-entry__customer-row">' +
      '<span class="sc-plan-entry__customer">' +
      App.escapeHtml(c.name) +
      '</span>' +
      planEntryCustomerBadge(c) +
      '</div></div>' +
      '<div class="sc-plan-entry__actions" role="group" aria-label="确认下单操作">' +
      historyRow +
      '<button type="button" class="sc-plan-entry__option sc-plan-entry__option--primary" data-action="order-create-new">' +
      '<span class="sc-plan-entry__option-text"><span class="sc-plan-entry__option-title">确认下单</span>' +
      '<span class="sc-plan-entry__option-desc">按报价单或直选品，确认明细后提交</span></span>' +
      '<span class="sc-plan-entry__chevron" aria-hidden="true">›</span></button>' +
      '</div></div>'
    );
  }

  /* ---------- v1.3.0 交期评审 ---------- */
  function isDeliverySkillAtEntry() {
    return !!ctx().deliverySkillAtEntry;
  }

  function setDeliverySkillAtEntry(on) {
    if (on) ctx().deliverySkillAtEntry = true;
    else if (ctx().deliverySkillAtEntry) delete ctx().deliverySkillAtEntry;
  }

  function orderStatusBadgeClass(status) {
    const meta = (DemoData.orderStatusMeta || {})[status];
    return (meta && meta.badgeClass) || 'sc-badge--new';
  }

  function orderStatusBadgeHtml(status) {
    return (
      '<span class="sc-badge ' +
      orderStatusBadgeClass(status) +
      '">' +
      App.escapeHtml(status || '—') +
      '</span>'
    );
  }

  function deliveryReviewOrderNo(meta) {
    meta = meta || {};
    if (meta.orderNo) return String(meta.orderNo).replace(/^SO/i, 'XSD');
    if (meta.quoteId) return String(meta.quoteId).replace(/^QT/i, 'XSD');
    const d = new Date();
    const ymd =
      d.getFullYear() +
      String(d.getMonth() + 1).padStart(2, '0') +
      String(d.getDate()).padStart(2, '0');
    return 'XSD' + ymd + '028';
  }

  function deliveryBlockerInventoryCode(line, idx) {
    if (!line) return '000000000002AS-0001';
    const raw = line.inventoryCode || line.skuId || '';
    if (/^0+\d/.test(raw)) return raw;
    const suffix = String((idx != null ? idx : 0) + 1).padStart(4, '0');
    return '000000000002AS-' + suffix;
  }

  function buildDeliveryProcessLineReasons(count) {
    const n = Math.max(1, count || 3);
    const reasons = [];
    for (let i = 1; i <= n; i++) {
      reasons.push('第【' + i + '】道工序产线集没有可用产线');
    }
    return reasons;
  }

  function defaultDeliveryPlanDates() {
    const start = new Date();
    start.setDate(start.getDate() + 7);
    const end = new Date(start);
    end.setDate(end.getDate() + 14);
    const fmt = function (d) {
      return d.toISOString().slice(0, 10);
    };
    return { start: fmt(start), end: fmt(end) };
  }

  function ensureDeliveryPendingLines(meta) {
    if (!meta) return [];
    if (meta.reverseSchedule == null) meta.reverseSchedule = false;
    if (!meta.lines || !meta.lines.length) {
      meta.lines = enrichOrderLines(deliveryLinesForReview(meta));
    } else {
      meta.lines = enrichOrderLines(meta.lines);
    }
    meta.lines.forEach(function (line) {
      ensureDeliveryLineReviewDefaults(line, meta);
    });
    return meta.lines;
  }

  function ensureDeliveryLineReviewDefaults(line, meta) {
    const pr = productById(line.productId);
    if (!line.expectedDate) {
      line.expectedDate = (meta && meta.expectedDate) || deliveryDefaultExpectedDate(meta) || '';
    }
    if (pr && (!line.customAttrs || !line.customAttrs.length)) {
      line.customAttrs = DemoData.resolveLineCustomAttrs(pr, line.skuId, line.customAttrs);
    }
    if (pr && (!line.processVersion || !String(line.processVersion).trim())) {
      const options = DemoData.processVersionOptions(pr, line.skuId);
      line.processVersion = options[0] || '标准版';
    }
    if (line.qty == null || line.qty < 1) line.qty = 1;
  }

  function deliveryLineFreeAttrsText(line, pr) {
    pr = pr || productById(line.productId);
    if (!pr) return line.skuLabel || '—';
    const attrs =
      line.customAttrs && line.customAttrs.length
        ? line.customAttrs
        : DemoData.resolveLineCustomAttrs(pr, line.skuId, line.customAttrs);
    return DemoData.skuLabelFromAttrs(pr, attrs);
  }

  function renderDeliveryReverseScheduleField(name, value, extra) {
    extra = extra || '';
    const want = !!value;
    return (
      '<div class="sc-radio-group sc-radio-group--inline"' +
      extra +
      '>' +
      [
        { value: 'no', label: '否' },
        { value: 'yes', label: '是' }
      ]
        .map(function (o) {
          const checked = (o.value === 'yes' && want) || (o.value === 'no' && !want);
          return (
            '<label class="sc-radio-pill"><input type="radio" name="' +
            App.escapeHtml(name) +
            '" value="' +
            o.value +
            '"' +
            (checked ? ' checked' : '') +
            ' /> ' +
            App.escapeHtml(o.label) +
            '</label>'
          );
        })
        .join('') +
      '</div>'
    );
  }

  function renderDeliveryLineExpectedDateField(line, idx) {
    const val = line.expectedDate || '';
    return (
      '<input class="sc-input sc-input--field sc-delivery-line__date" data-field="delivery-line-expected-date" data-idx="' +
      idx +
      '" type="date" value="' +
      App.escapeHtml(val) +
      '" placeholder="请选择" />'
    );
  }

  function renderDeliveryLineProcessVersionField(pr, line, idx) {
    const options = DemoData.processVersionOptions(pr, line.skuId);
    const cur = line.processVersion || options[0] || '标准版';
    const opts = options
      .map(function (v) {
        return (
          '<option value="' +
          App.escapeHtml(v) +
          '"' +
          (v === cur ? ' selected' : '') +
          '>' +
          App.escapeHtml(v) +
          '</option>'
        );
      })
      .join('');
    return (
      '<select class="sc-input sc-input--field sc-delivery-line__process" data-action="delivery-line-process" data-idx="' +
      idx +
      '">' +
      opts +
      '</select>'
    );
  }

  function deliveryLineQtyText(line) {
    const qty = line && line.qty != null ? line.qty : 1;
    const unit = (line && line.salesUnit) || '件';
    return qty + unit;
  }

  function deliveryDefaultExpectedDate(meta) {
    if (meta && meta.expectedDate) return meta.expectedDate;
    if (meta && meta.requiredDeliveryDate) return meta.requiredDeliveryDate;
    return '';
  }

  function renderDeliveryFormSourceBlock(meta, lines) {
    const primary = deliverySummaryLabel(meta);
    const secondaryParts = [];
    if (meta && meta.sourceType === 'order' && meta.requiredDeliveryDate) {
      secondaryParts.push(
        '要求交期 ' + String(meta.requiredDeliveryDate).replace(/-/g, '/')
      );
    }
    let html = '<p class="sc-card__meta">' + App.escapeHtml(primary) + '</p>';
    if (secondaryParts.length) {
      html +=
        '<p class="sc-card__meta sc-delivery-form__meta-sub">' +
        App.escapeHtml(secondaryParts.join(' · ')) +
        '</p>';
    }
    return html;
  }

  function renderDeliveryLineQtyField(line, idx) {
    const qty = line.qty != null ? line.qty : 1;
    const unit = (line && line.salesUnit) || '件';
    return (
      '<div class="sc-delivery-line-card__qty-row">' +
      '<label class="sc-field-label">数量</label>' +
      '<div class="sc-delivery-line-card__qty-inline">' +
      '<input class="sc-input sc-input--field sc-delivery-line__qty" data-field="delivery-line-qty" data-idx="' +
      idx +
      '" type="number" min="1" step="1" value="' +
      App.escapeHtml(String(qty)) +
      '" />' +
      '<span class="sc-delivery-line-card__unit">' +
      App.escapeHtml(unit) +
      '</span></div></div>'
    );
  }

  function renderDeliveryLineReviewCard(line, idx, pr) {
    pr = pr || productById(line.productId);
    if (!pr) return '';
    return (
      '<div class="sc-delivery-line-card">' +
      '<p class="sc-delivery-line-card__name">' +
      App.escapeHtml(line.inventoryName || '—') +
      '</p>' +
      '<p class="sc-delivery-line-card__attrs">' +
      App.escapeHtml(deliveryLineFreeAttrsText(line, pr)) +
      '</p>' +
      renderDeliveryLineQtyField(line, idx) +
      '<div class="sc-delivery-line-card__process-row">' +
      '<label class="sc-field-label">工艺版本</label>' +
      renderDeliveryLineProcessVersionField(pr, line, idx) +
      '</div>' +
      '<div class="sc-delivery-line-card__date-row">' +
      '<label class="sc-field-label">期望交期<span class="sc-field-required">*</span></label>' +
      renderDeliveryLineExpectedDateField(line, idx) +
      '</div></div>'
    );
  }

  function renderDeliveryLinesProcessSection(lines, meta) {
    if (!lines || !lines.length) return '';
    const cards = lines
      .map(function (line, idx) {
        return renderDeliveryLineReviewCard(line, idx, productById(line.productId));
      })
      .join('');
    return (
      '<label class="sc-field-label">货品明细</label>' +
      '<div class="sc-delivery-line-cards">' +
      cards +
      '</div>'
    );
  }

  function syncDeliveryPendingLinesFromDom(el) {
    const meta = ctx().deliveryPending;
    if (!meta || !meta.lines) return;
    const reverseFormEl =
      el && el.querySelector('input[name="delivery-reverse-schedule"]:checked');
    if (reverseFormEl) {
      meta.reverseSchedule = reverseFormEl.value === 'yes';
    }
    meta.lines.forEach(function (line, idx) {
      const dateInp =
        (el &&
          el.querySelector('[data-field="delivery-line-expected-date"][data-idx="' + idx + '"]')) ||
        document.querySelector(
          '[data-spec-id="sheet-delivery"] [data-field="delivery-line-expected-date"][data-idx="' + idx + '"]'
        );
      if (dateInp) line.expectedDate = dateInp.value;
      const qtyInp =
        (el &&
          el.querySelector('[data-field="delivery-line-qty"][data-idx="' + idx + '"]')) ||
        document.querySelector(
          '[data-spec-id="sheet-delivery"] [data-field="delivery-line-qty"][data-idx="' + idx + '"]'
        );
      if (qtyInp) line.qty = Math.max(1, parseInt(qtyInp.value, 10) || 1);
      const processInp =
        (el &&
          el.querySelector('[data-action="delivery-line-process"][data-idx="' + idx + '"]')) ||
        document.querySelector(
          '[data-spec-id="sheet-delivery"] [data-action="delivery-line-process"][data-idx="' + idx + '"]'
        );
      if (processInp) line.processVersion = processInp.value;
    });
  }

  function syncDeliveryPendingProcessFromDom(el) {
    syncDeliveryPendingLinesFromDom(el);
  }

  function formatDeliveryLinesProcessSummary(lines) {
    if (!lines || !lines.length) return '—';
    return lines
      .map(function (l, i) {
        return i + 1 + '. ' + (l.inventoryName || '—') + ' ' + (l.processVersion || '—');
      })
      .join('；');
  }

  function renderDeliverySkillEntryCard(c) {
    return (
      '<div class="sc-card sc-card--plan-entry" data-spec-id="card-delivery-entry">' +
      '<div class="sc-plan-entry__head">' +
      '<p class="sc-plan-entry__kicker">交期评审</p>' +
      '<div class="sc-plan-entry__customer-row">' +
      '<span class="sc-plan-entry__customer">' +
      App.escapeHtml(c.name) +
      '</span>' +
      planEntryCustomerBadge(c) +
      '</div></div>' +
      '<div class="sc-plan-entry__actions" role="group" aria-label="交期评审操作">' +
      '<button type="button" class="sc-plan-entry__option sc-plan-entry__option--primary" data-action="delivery-create-new">' +
      '<span class="sc-plan-entry__option-text"><span class="sc-plan-entry__option-title">评估交期</span>' +
      '<span class="sc-plan-entry__option-desc">按报价单、按订单或自选商品</span></span>' +
      '<span class="sc-plan-entry__chevron" aria-hidden="true">›</span></button>' +
      '</div></div>'
    );
  }

  function showDeliverySkillEntry(opts) {
    opts = opts || {};
    const c = activeCustomer() || requireCustomer('delivery');
    if (!c) return;
    setDeliverySkillAtEntry(true);
    enterSkill('delivery');
    const html =
      opts.leadHtml != null && !opts.onlyCard
        ? opts.leadHtml + renderDeliverySkillEntryCard(c)
        : renderDeliverySkillEntryCard(c);
    App.pushAiHtml(html);
    rescanAnnotationPins();
  }

function renderDeliverySourceOption(opts) {
    const title = opts.title;
    const desc = opts.desc;
    const action = opts.action;
    const extra = opts.extra || '';
    const disabled = !!opts.disabled;
    const primary = !!opts.primary;
    const inner =
      '<span class="sc-plan-entry__option-text"><span class="sc-plan-entry__option-title">' +
      App.escapeHtml(title) +
      '</span><span class="sc-plan-entry__option-desc">' +
      App.escapeHtml(desc) +
      '</span></span>' +
      (disabled ? '' : '<span class="sc-plan-entry__chevron" aria-hidden="true">›</span>');
    const cls =
      'sc-plan-entry__option' +
      (primary ? ' sc-plan-entry__option--primary' : '') +
      (disabled ? ' sc-plan-entry__option--disabled' : '');
    if (disabled) {
      return '<div class="' + cls + '" aria-disabled="true">' + inner + '</div>';
    }
    return (
      '<button type="button" class="' +
      cls +
      '" data-action="' +
      action +
      '"' +
      extra +
      '>' +
      inner +
      '</button>'
    );
  }

  function renderDeliverySourceCard(c) {
    const schemesList = c ? schemesForCustomer(c.id) : [];
    const schemesCount = schemesList.length;
    const quotesList = c ? quotesForCustomer(c.id) : [];
    const quotesCount = quotesList.length;
    const ordersList = c ? deliveryOrdersForCustomer(c.id) : [];
    const ordersCount = ordersList.length;
    const schemesSub =
      schemesCount > 0 ? '共 ' + schemesCount + ' 个已保存方案' : '暂无已保存方案';
    const quotesSub = quotesCount > 0 ? '共 ' + quotesCount + ' 份历史报价单' : '暂无历史报价单';
    const ordersSub =
      ordersCount > 0 ? '共 ' + ordersCount + ' 笔未排程订单' : '暂无未排程订单';
    const schemeBtnExtra =
      schemesCount === 1 ? ' data-scheme-id="' + App.escapeHtml(schemesList[0].id) + '"' : '';
    const quoteBtnExtra =
      quotesCount === 1 ? ' data-quote-id="' + App.escapeHtml(quotesList[0].id) + '"' : '';
    const orderBtnExtra =
      ordersCount === 1 ? ' data-oid="' + App.escapeHtml(ordersList[0].id) + '"' : '';

    return (
      '<div class="sc-card sc-card--compact sc-card--delivery-source" data-spec-id="card-delivery-source">' +
      '<div class="sc-card__head sc-card__head--compact">交期评审 · 选择来源</div>' +
      '<p class="sc-plan-entry__group-label">已有单据</p>' +
      '<div class="sc-plan-entry__actions sc-plan-entry__actions--compact" role="group" aria-label="已有单据来源">' +
      renderDeliverySourceOption({
        title: '按方案',
        desc: schemesSub,
        action: 'delivery-source-scheme',
        extra: schemeBtnExtra,
        disabled: schemesCount === 0
      }) +
      renderDeliverySourceOption({
        title: '按报价单',
        desc: quotesSub,
        action: 'delivery-source-quote',
        extra: quoteBtnExtra,
        disabled: quotesCount === 0
      }) +
      renderDeliverySourceOption({
        title: '按订单',
        desc: ordersSub,
        action: 'delivery-source-order',
        extra: orderBtnExtra,
        disabled: ordersCount === 0
      }) +
      '</div>' +
      '<p class="sc-plan-entry__group-label">从头评估</p>' +
      '<div class="sc-plan-entry__actions sc-plan-entry__actions--compact" role="group" aria-label="自选商品">' +
      renderDeliverySourceOption({
        title: '自选商品',
        desc: '直选品、规格与数量评审交期',
        action: 'delivery-source-lines',
        primary: true
      }) +
      '</div></div>'
    );
  }

  function renderDeliverySchemePickCard(list) {
    const rows = list
      .slice()
      .reverse()
      .map(function (s) {
        return (
          '<button type="button" class="sc-follow-row sc-follow-row--select" data-action="delivery-scheme-pick" data-scheme-id="' +
          App.escapeHtml(s.id) +
          '"><span class="sc-follow-row__name">' +
          App.escapeHtml(s.templateName || '未命名方案') +
          '</span><span class="sc-follow-row__meta">' +
          App.escapeHtml(s.id) +
          ' · ' +
          App.escapeHtml(schemePickSummary(s)) +
          '</span></button>'
        );
      })
      .join('');
    return (
      '<div class="sc-card sc-card--compact" data-spec-id="card-delivery-scheme-pick"><div class="sc-card__head sc-card__head--compact">选择方案</div><div class="sc-follow-list">' +
      rows +
      '</div></div>'
    );
  }

  function renderDeliveryQuotePickCard(list) {
    const rows = list
      .map(function (q) {
        return (
          '<button type="button" class="sc-follow-row sc-follow-row--select" data-action="delivery-quote-pick" data-quote-id="' +
          App.escapeHtml(q.id) +
          '"><span class="sc-follow-row__name">' +
          App.escapeHtml(q.id) +
          '</span><span class="sc-follow-row__meta">' +
          fmtMoney(q.total) +
          ' · ' +
          App.escapeHtml(q.templateName || '') +
          '</span></button>'
        );
      })
      .join('');
    return (
      '<div class="sc-card sc-card--compact" data-spec-id="card-delivery-quote-pick"><div class="sc-card__head sc-card__head--compact">选择报价单</div><div class="sc-follow-list">' +
      rows +
      '</div></div>'
    );
  }

function renderDeliveryOrderPickCard(list) {
    const rows = list
      .map(function (o) {
        return (
          '<button type="button" class="sc-follow-row sc-follow-row--select" data-action="delivery-order-pick" data-oid="' +
          App.escapeHtml(o.id) +
          '"><span class="sc-follow-row__stack">' +
          '<span class="sc-follow-row__name">' +
          App.escapeHtml(o.no) +
          '</span><span class="sc-follow-row__meta">' +
          App.escapeHtml(o.date || '—') +
          ' · ' +
          App.escapeHtml(o.amount || '—') +
          '</span><span class="sc-follow-row__meta">' +
          App.escapeHtml(o.items || '—') +
          '</span></span>' +
          '</button>'
        );
      })
      .join('');
    return (
      '<div class="sc-card sc-card--compact" data-spec-id="card-delivery-order-pick"><div class="sc-card__head sc-card__head--compact">选择订单</div><div class="sc-follow-list">' +
      rows +
      '</div></div>'
    );
  }

  function openDeliveryForm(meta) {
    meta = meta || {};
    const prev = ctx().deliveryPending || {};
    if (!meta.expectedDate && prev.expectedDate) {
      meta.expectedDate = prev.expectedDate;
    }
    if (meta.reverseSchedule == null && prev.reverseSchedule != null) {
      meta.reverseSchedule = prev.reverseSchedule;
    }
    ensureDeliveryPendingLines(meta);
    ctx().deliveryPending = meta;
    App.pushAiHtml(renderDeliveryFormCard());
    rescanAnnotationPins();
  }

  function buildDeliveryPendingFromResult(d) {
    d = d || ctx().delivery;
    if (!d || !d.lines || !d.lines.length) return null;
    const c = activeCustomer();
    const meta = {
      sourceType: d.sourceType || 'quote',
      schemeId: d.schemeId || null,
      quoteId: d.quoteId || null,
      orderId: d.orderId || null,
      lines: d.lines.map(function (l) {
        return Object.assign({}, l);
      }),
      expectedDate: d.expectedDate || '',
      reverseSchedule: d.reverseSchedule != null ? !!d.reverseSchedule : false
    };
    if (meta.schemeId) {
      const sch =
        (c &&
          schemesForCustomer(c.id).find(function (x) {
            return x.id === meta.schemeId;
          })) ||
        (ctx().scheme && ctx().scheme.id === meta.schemeId ? ctx().scheme : null) ||
        (DemoData.schemes || []).find(function (x) {
          return x.id === meta.schemeId;
        });
      if (sch) meta.schemeName = sch.templateName || '';
    }
    if (meta.quoteId) {
      const q =
        (c &&
          quotesForCustomer(c.id).find(function (x) {
            return x.id === meta.quoteId;
          })) ||
        (DemoData.quotes || []).find(function (x) {
          return x.id === meta.quoteId;
        });
      if (q) meta.total = q.total;
    }
    if (meta.orderId) {
      const o = DemoData.orders.find(function (x) {
        return x.id === meta.orderId;
      });
      if (o) {
        meta.orderNo = o.no;
        meta.requiredDeliveryDate = o.requiredDeliveryDate || null;
      }
    }
    return meta;
  }

  function openDeliveryLinesPick(meta, opts) {
    opts = opts || {};
    meta = meta || {};
    const lines = (meta.lines || []).map(function (l) {
      return Object.assign({}, l);
    });
    if (!lines.length) {
      App.toast('评审数据缺失');
      return;
    }
    const c = requireCustomer('delivery');
    if (!c) return;
    enterSkill('delivery');
    setDeliverySkillAtEntry(false);
    ctx().deliveryLinesMode = true;
    ctx().quotePickForOrder = false;
    ctx().deliveryPending = {
      sourceType: 'lines',
      lines: lines,
      expectedDate: meta.expectedDate || '',
      reverseSchedule: meta.reverseSchedule != null ? !!meta.reverseSchedule : false
    };
    seedOrderDraftFromDeliveryLines(lines);
    const lead =
      opts.leadHtml != null
        ? opts.leadHtml
        : '<p class="sc-reply-lead">请重新选择要评估的货品。</p>';
    pushNextAiCard(
      lead + renderOrderProductPickCardForDelivery(),
      opts.utterance === false ? null : opts.utterance != null ? opts.utterance : '调整方案'
    );
    scheduleOrderPickLazyBind();
    rescanAnnotationPins();
  }

  function adjustDeliveryFromResult(opts) {
    opts = opts || {};
    const d = ctx().delivery;
    if (!d || !d.confirmed) {
      App.toast('暂无交期评审结果可调整');
      return;
    }
    const meta = buildDeliveryPendingFromResult(d);
    if (!meta) {
      App.toast('评审数据缺失');
      return;
    }
    openDeliveryLinesPick(meta, {
      utterance: opts.utterance === false ? null : '调整方案'
    });
  }


  function deliverySummaryLabel(meta) {
    if (!meta) return '';
    if (meta.sourceType === 'quote' && meta.quoteId) {
      return '报价单 ' + meta.quoteId + (meta.total != null ? ' · ' + fmtMoney(meta.total) : '');
    }
    if (meta.sourceType === 'order' && meta.orderNo) {
      return '订单 ' + meta.orderNo + ' · ' + App.escapeHtml(meta.orderStatus || '');
    }
    if (meta.sourceType === 'lines' && meta.lines) {
      return meta.lines.length + ' 项 · ' + meta.lines.map(function (l) {
        return l.inventoryName;
      }).join('、');
    }
    return '';
  }

  function syncDeliveryLineDatesFromForm(formDate, formCard) {
    formCard = formCard || getActiveFormCard('sheet-delivery');
    if (!formCard) return;
    const meta = ctx().deliveryPending;
    if (!meta) return;
    const date = formDate != null ? String(formDate).trim() : '';
    meta.expectedDate = date;
    if (!meta.lines) return;
    meta.lines.forEach(function (line, idx) {
      line.expectedDate = date;
      const inp = formCard.querySelector(
        '[data-field="delivery-line-expected-date"][data-idx="' + idx + '"]'
      );
      if (inp) inp.value = date;
    });
  }

  function onDeliveryFormExpectedDateChange(inp) {
    if (!inp || !inp.closest('[data-spec-id="sheet-delivery"]')) return;
    syncDeliveryLineDatesFromForm(inp.value, inp.closest('[data-spec-id="sheet-delivery"]'));
  }

  function syncDeliveryFormPendingFromDom(el) {
    const meta = ctx().deliveryPending || {};
    const expectedInp = el && el.querySelector('[data-field="delivery-expected-date"]');
    if (expectedInp && expectedInp.value) meta.expectedDate = expectedInp.value;
    syncDeliveryPendingLinesFromDom(el);
    ctx().deliveryPending = meta;
    return meta;
  }

  function seedOrderDraftFromDeliveryLines(lines) {
    const c = activeCustomer() || requireCustomer('delivery');
    if (!c) return;
    ensureOrderDraft(c);
    const d = ctx().orderDraft;
    d.selected = {};
    d.sku = {};
    d.qty = {};
    (lines || []).forEach(function (line) {
      const pid = line.productId;
      if (!pid) return;
      d.selected[pid] = true;
      d.qty[pid] = line.qty != null ? line.qty : 1;
      const pr = productById(pid);
      d.sku[pid] = line.skuId || (pr ? DemoData.defaultSkuId(pr) : '');
    });
  }

  function repickDeliveryLines(opts) {
    opts = opts || {};
    const el = getActiveFormCard('sheet-delivery');
    const meta = syncDeliveryFormPendingFromDom(el);
    if (meta.sourceType !== 'lines') {
      App.toast('当前来源不支持调整方案');
      return;
    }
    openDeliveryLinesPick(meta, {
      utterance: opts.simulateUserMsg === false ? null : '调整方案'
    });
  }

function renderDeliveryFormCard() {
    const meta = ctx().deliveryPending || {};
    const lines = ensureDeliveryPendingLines(meta);
    const expectedDefault = deliveryDefaultExpectedDate(meta);
    const reverseDefault = meta.reverseSchedule != null ? !!meta.reverseSchedule : false;
    const repickBtn =
      meta.sourceType === 'lines'
        ? '<button type="button" class="sc-btn sc-btn--ghost" data-action="delivery-repick-lines">调整方案</button>'
        : '';
    return (
      '<div class="sc-card sc-card--compact sc-card--inline-form" data-spec-id="sheet-delivery" data-spec-pin-root>' +
      '<div class="sc-card__head sc-card__head--compact">交期评审 · 表单</div>' +
      renderDeliveryFormSourceBlock(meta, lines) +
      '<label class="sc-field-label">期望交期<span class="sc-field-required">*</span></label>' +
      '<input class="sc-input sc-input--field" data-field="delivery-expected-date" type="date" value="' +
      App.escapeHtml(expectedDefault) +
      '" placeholder="请选择" />' +
      '<label class="sc-field-label">是否倒排</label>' +
      renderDeliveryReverseScheduleField('delivery-reverse-schedule', reverseDefault) +
      renderDeliveryLinesProcessSection(lines, meta) +
      '<div class="sc-card__actions-inline sc-card__actions-inline--delivery-form">' +
      repickBtn +
      '<button type="button" class="sc-btn sc-btn--primary" data-action="delivery-submit">提交评审</button></div>' +
      '</div>'
    );
  }

  function renderDeliveryLinePickCard(sourceLabel, lines) {
    if (!lines || !lines.length) return '';
    var selected = ctx().deliveryLineSelection || lines.map(function () { return true; });
    var selectedCount = selected.filter(Boolean).length;
    var allSelected = selectedCount === lines.length;

    var rows = lines.map(function (line, idx) {
      var isChecked = selected[idx];
      return (
        '<div class="sc-copy-line-pick__row' + (isChecked ? ' sc-copy-line-pick__row--selected' : '') + '" data-idx="' + idx + '">' +
        '<label class="sc-copy-line-pick__checkbox">' +
        '<input type="checkbox" data-action="delivery-line-pick-item" data-idx="' + idx + '"' + (isChecked ? ' checked' : '') + '>' +
        '<span class="sc-copy-line-pick__checkmark"></span>' +
        '</label>' +
        '<span class="sc-copy-line-pick__idx">' + (idx + 1) + '</span>' +
        '<div class="sc-copy-line-pick__info">' +
        '<span class="sc-copy-line-pick__name">' + App.escapeHtml(line.inventoryName || '—') + '</span>' +
        '<span class="sc-copy-line-pick__spec">' + App.escapeHtml(line.skuLabel || '—') + ' · ' + (line.qty || 0) + App.escapeHtml(line.salesUnit || '件') + '</span>' +
        '</div>' +
        '</div>'
      );
    }).join('');

    return (
      '<div class="sc-card sc-card--compact sc-card--inline-form sc-card--copy-line-pick" data-spec-id="card-delivery-line-pick">' +
      '<div class="sc-card__head sc-card__head--compact">交期评审 · 勾选货品</div>' +
      '<p class="sc-card__meta">来源 ' + App.escapeHtml(sourceLabel) + '</p>' +
      '<div class="sc-copy-line-pick__header">' +
      '<label class="sc-copy-line-pick__header-check">' +
      '<input type="checkbox" data-action="delivery-line-pick-all" ' + (allSelected ? ' checked' : '') + '>' +
      '<span class="sc-copy-line-pick__checkmark"></span>' +
      '<span class="sc-copy-line-pick__header-text">全选（共 ' + lines.length + ' 项）</span>' +
      '</label>' +
      '</div>' +
      '<div class="sc-copy-line-pick__list">' + rows + '</div>' +
      '<div class="sc-copy-line-pick__summary">' +
      '<span>已选择：<strong>' + selectedCount + ' / ' + lines.length + '</strong> 项</span>' +
      '</div>' +
      '<div class="sc-card__actions-inline">' +
      '<button type="button" class="sc-btn sc-btn--ghost" data-action="delivery-line-pick-repick">重选来源</button>' +
      '<button type="button" class="sc-btn sc-btn--primary" data-action="delivery-line-pick-confirm">确认选择</button>' +
      '</div>' +
      '</div>'
    );
  }

  function pushDeliveryLinePickCard(sourceLabel, lines, proceedFn) {
    if (!lines || !lines.length) {
      App.toast('暂无可用货品');
      return;
    }
    ctx().deliveryLinePickLines = lines;
    ctx().deliveryLineSelection = lines.map(function () { return true; });
    ctx().deliveryLinePickSourceLabel = sourceLabel;
    ctx().deliveryLinePickProceed = proceedFn;
    App.pushAiHtml(
      '<p class="sc-reply-lead">请勾选要评估的货品（可多选），确认后进入评审表单：</p>' +
        renderDeliveryLinePickCard(sourceLabel, lines)
    );
    rescanAnnotationPins();
  }

  function proceedFromDeliveryLinePickToForm() {
    var lines = ctx().deliveryLinePickLines;
    var selected = ctx().deliveryLineSelection || lines.map(function () { return true; });
    var filteredLines = lines.filter(function (_, idx) {
      return selected[idx];
    });
    if (!filteredLines.length) {
      App.toast('请至少选择一条货品');
      return;
    }
    var proceed = ctx().deliveryLinePickProceed;
    if (typeof proceed === 'function') {
      proceed(filteredLines);
    }
  }


  function beginDeliveryFromQuote(quoteId) {
    setDeliverySkillAtEntry(false);
    const c = requireCustomer('delivery');
    if (!c) return;
    enterSkill('delivery');
    const list = quotesForCustomer(c.id);
    if (!list.length) {
      App.pushAiHtml('<p class="sc-reply-lead">当前客户暂无报价单，请先 <strong>产品报价</strong> 或改用自选商品评估交期。</p>');
      App.pushAiHtml(renderDeliverySourceCard(c));
      rescanAnnotationPins();
      return;
    }
    let qid = quoteId || null;
    if (!qid && ctx().quote && ctx().quote.customerId === c.id) {
      qid = ctx().quote.id;
    }
    if (!qid && list.length > 1) {
      App.pushAiHtml(
        '<p class="sc-reply-lead">本客户有 <strong>' +
          list.length +
          '</strong> 份报价单，<strong>按报价单评估须先选择</strong>：</p>' +
          renderDeliveryQuotePickCard(list)
      );
      rescanAnnotationPins();
      return;
    }
    const quote = quoteForActiveCustomer(qid || list[0].id);
    if (!quote) {
      App.toast('未找到所选报价单');
      return;
    }
    persistQuote(quote);
    var lines = quote.lines || [];
    if (!lines.length) {
      App.toast('报价单无可用明细');
      return;
    }
    var sourceLabel = '报价单 ' + App.escapeHtml(quote.id);
    pushDeliveryLinePickCard(sourceLabel, lines, function (filteredLines) {
      openDeliveryForm({
        sourceType: 'quote',
        quoteId: quote.id,
        total: quote.total,
        lines: filteredLines
      });
    });
  }

  function beginDeliveryFromOrder(orderId) {
    setDeliverySkillAtEntry(false);
    const c = requireCustomer('delivery');
    if (!c) return;
    enterSkill('delivery');
    const list = deliveryOrdersForCustomer(c.id);
    if (!list.length) {
      App.pushAiHtml('该客户暂无未排程订单，请改用报价单或自选商品。');
      return;
    }
    if (orderId) {
      const hit = list.find(function (o) {
        return o.id === orderId;
      });
      if (hit) {
        deliveryOpenFormForOrder(hit);
        return;
      }
    }
    if (list.length === 1) {
      deliveryOpenFormForOrder(list[0]);
      return;
    }
    App.pushAiHtml(
      '<p class="sc-reply-lead">本客户有 <strong>' +
        list.length +
        '</strong> 笔未排程订单，<strong>按订单评估须先选择</strong>：</p>' +
        renderDeliveryOrderPickCard(list)
    );
    rescanAnnotationPins();
  }

function deliveryOpenFormForOrder(o) {
    if (!o) return;
    var lines = (o.lines || []).length ? o.lines.slice() : linesFromHistoricalOrder(o);
    if (!lines.length) {
      App.toast('该订单无可用明细');
      return;
    }
    var sourceLabel = '订单 ' + App.escapeHtml(o.no);
    var orderId = o.id;
    var orderNo = o.no;
    var orderStatus = o.status;
    var requiredDeliveryDate = o.requiredDeliveryDate || o.shipDate || null;
    var productIds = o.productIds;
    pushDeliveryLinePickCard(sourceLabel, lines, function (filteredLines) {
      openDeliveryForm({
        sourceType: 'order',
        orderId: orderId,
        orderNo: orderNo,
        orderStatus: orderStatus,
        requiredDeliveryDate: requiredDeliveryDate,
        lines: filteredLines,
        productIds: productIds
      });
    });
  }

  function beginDeliveryFromScheme(schemeId) {
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

  function deliveryOpenFormForScheme(scheme) {
    if (!scheme) return;
    persistScheme(scheme);
    var lines = linesFromScheme(scheme);
    if (!lines.length) {
      App.toast('方案明细为空');
      return;
    }
    var sourceLabel = '方案 ' + App.escapeHtml(scheme.templateName || scheme.id);
    var schemeId = scheme.id;
    var schemeName = scheme.templateName || '';
    pushDeliveryLinePickCard(sourceLabel, lines, function (filteredLines) {
      openDeliveryForm({
        sourceType: 'scheme',
        schemeId: schemeId,
        schemeName: schemeName,
        lines: filteredLines
      });
    });
  }

  function beginDeliveryLines() {
    setDeliverySkillAtEntry(false);
    const c = requireCustomer('delivery');
    if (!c) return;
    enterSkill('delivery');
    ctx().deliveryLinesMode = true;
    ctx().quotePickForOrder = false;
    ensureOrderDraft(c);
    if (
      maybeDeliveryDemandBeforePick(c, {
        leadHtml: '<p class="sc-reply-lead">自选商品评估交期：请先描述采购需求。</p>'
      })
    ) {
      return;
    }
    App.pushAiHtml(
      '<p class="sc-reply-lead">自选商品评估交期：请在选品卡中勾选产品。</p>' +
        renderOrderProductPickCardForDelivery()
    );
    scheduleOrderPickLazyBind();
    rescanAnnotationPins();
  }

  function renderOrderProductPickCardForDelivery() {
    return renderOrderProductPickCard({ deliveryLines: true });
  }

  function orderToCartForDelivery(opts) {
    confirmDeliveryLines(opts);
  }

  function deliveryLinesFromOrderDraft() {
    syncOrderQtyFromDom();
    const d = ctx().orderDraft;
    if (!d) return [];
    return orderSelectedIds()
      .map(function (pid) {
        const pr = productById(pid);
        if (!pr) return null;
        return makeQuoteLine(pr, {
          skuId: d.sku[pid] || DemoData.defaultSkuId(pr),
          qty: d.qty[pid] || 1
        });
      })
      .filter(Boolean);
  }

  function confirmDeliveryLines(opts) {
    opts = opts || {};
    syncPickQueryFromDom('order');
    if (!orderSelectedIds().length) {
      App.toast('请至少选择一种产品');
      return;
    }
    const lines = deliveryLinesFromOrderDraft();
    if (!lines.length) {
      App.toast('请先选择商品');
      return;
    }
    ctx().deliveryLinesMode = false;
    if (opts.simulateUserMsg) simulateUserUtterance('下一步：确认选品');
    const prevPending = ctx().deliveryPending || {};
    openDeliveryForm({
      sourceType: 'lines',
      lines: lines,
      expectedDate: prevPending.expectedDate || '',
      reverseSchedule:
        prevPending.reverseSchedule != null ? !!prevPending.reverseSchedule : false
    });
  }

  function showOrderSkillEntry(opts) {
    opts = opts || {};
    const c = activeCustomer() || requireCustomer('order');
    if (!c) return;
    setOrderSkillAtEntry(true);
    enterSkill('order');
    const html =
      opts.leadHtml != null && !opts.onlyCard
        ? opts.leadHtml + renderOrderSkillEntryCard(c)
        : renderOrderSkillEntryCard(c);
    App.pushAiHtml(html);
    rescanAnnotationPins();
  }

  function openOrderHistoryFromEntry(opts) {
    opts = opts || {};
    setOrderSkillAtEntry(false);
    const c = activeCustomer() || requireCustomer('order');
    if (!c) return;
    enterSkill('order');
    const pool = ordersForCustomer(c.id);
    if (!pool.length) {
      App.pushAiHtml(renderOrderSkillEntryCard(c));
      setOrderSkillAtEntry(true);
      rescanAnnotationPins();
      return;
    }
    pushOrderHistoryView(
      c,
      pool,
      opts.leadHtml ||
        '<p class="sc-reply-lead">为 <strong>' +
          App.escapeHtml(c.name) +
          '</strong> 查看历史订单：</p>'
    );
    rescanAnnotationPins();
  }

  function tryOrderEntryIntent(t) {
    if (!isOrderSkillAtEntry()) return false;
    const text = (t || '').trim();
    if (!text) return true;
    if (isOrderViewHistoryEntryPhrase(text)) {
      openOrderHistoryFromEntry();
      return true;
    }
    if (isOrderCreateEntryPhrase(text)) {
      beginOrderCreate();
      return true;
    }
    if (/^选品|^按报价单|^直接选品|^逐项|^确认下单|^筛选|^过滤/.test(text)) {
      guideMissingSlot('orderEntryChoice');
      return true;
    }
    guideMissingSlot('orderEntryChoice');
    return true;
  }

  function tryViewOrderHistory(t) {
    if (!isViewOrderHistoryPhrase(t)) return false;
    setOrderSkillAtEntry(false);
    const c = activeCustomer() || requireCustomer('order');
    if (!c) return true;
    enterSkill('order');
    const pool = ordersForCustomer(c.id);
    if (!pool.length) {
      App.pushAiHtml(
        '<p class="sc-reply-lead">客户 <strong>' +
          App.escapeHtml(c.name) +
          '</strong> 暂无历史订单。</p>'
      );
      if (window.Annotation && Annotation.scanHosts) window.Annotation.scanHosts();
      return true;
    }
    if (pool.length === 1) {
      return viewOrderById(pool[0].id);
    }
    pushOrderHistoryView(c, pool);
    if (window.Annotation && Annotation.scanHosts) window.Annotation.scanHosts();
    return true;
  }

  function isViewQuoteHistoryPhrase(t) {
    const text = (t || '').trim();
    if (!text) return false;
    if (/下单|按报价单|生成订单|给.+报价|直接选品报价|逐项报价|生成报价单|创建新报价|新建报价|产品报价|报个价/.test(text))
      return false;
    if (/(?:查看|看看|列出|有哪些|历史|打开|预览|显示).*(?:报价单|报价)/.test(text)) return true;
    if (/(?:报价单).*(?:列表|记录|历史|pdf|PDF)/i.test(text)) return true;
    if (/^预览\s*报价/.test(text)) return true;
    return false;
  }

  function parseSchemeViewAttributes(text) {
    let t = (text || '').trim();
    t = t
      .replace(/^(?:查看|看看|列出|打开|预览|显示)\s*/gi, '')
      .replace(/(?:历史方案|方案历史|方案列表|所有方案|以前的方案|已保存的方案|方案记录)/g, '')
      .replace(/(?:的)?\s*方案\s*(?:pdf|PDF)?\s*$/gi, '')
      .trim();
    return parseSchemeQuoteAttributes(t);
  }

  function parseQuoteViewAttributes(text) {
    let t = (text || '').trim();
    t = t
      .replace(/^(?:查看|看看|列出|打开|预览|显示)\s*/gi, '')
      .replace(/(?:历史报价单|报价单历史|报价单列表|所有报价单|以前的报价单|已保存的报价单|报价记录)/g, '')
      .replace(/(?:的)?\s*报价单?\s*(?:pdf|PDF)?\s*$/gi, '')
      .trim();
    return parseOrderByQuoteAttributes(t);
  }

  /** 演示：客户尚无历史记录时写入 2 条方案 + 1 条报价单，便于「查看历史」验收 */
  function seedDemoHistoryIfEmpty(c) {
    ensureSchemesStore();
    ensureQuotesStore();
    if (schemesForCustomer(c.id).length && quotesForCustomer(c.id).length) return;

    const tpl0 = DemoData.planTemplates[0];
    const tpl1 = DemoData.planTemplates[1] || tpl0;
    const p1 = DemoData.products[0];
    const p2 = DemoData.products[1] || p1;
    const now = Date.now();
    const sku1 = DemoData.defaultSkuId(p1);
    const sku2 = DemoData.defaultSkuId(p2);

    if (!schemesForCustomer(c.id).length) {
      const seedLines1 = [
        {
          productId: p2.id,
          name: p2.name,
          skuId: sku2,
          skuLabel: DemoData.skuLabel(p2, sku2),
          qty: 2,
          sub: 0
        }
      ];
      persistScheme({
        id: 'PL' + (now - 86400000).toString().slice(-8),
        customerId: c.id,
        templateId: tpl1.id,
        templateName: buildSchemeDisplayName(c, seedLines1),
        layoutTemplateName: tpl1.name,
        lines: seedLines1,
        total: 0,
        createdAt: '2026-05-12 10:00'
      });
      const seedLines0 = [
        {
          productId: p1.id,
          name: p1.name,
          skuId: sku1,
          skuLabel: DemoData.skuLabel(p1, sku1),
          qty: 4,
          sub: 0
        }
      ];
      persistScheme({
        id: 'PL' + now.toString().slice(-8),
        customerId: c.id,
        templateId: tpl0.id,
        templateName: buildSchemeDisplayName(c, seedLines0),
        layoutTemplateName: tpl0.name,
        lines: seedLines0,
        total: 0,
        createdAt: '2026-05-18 15:30'
      });
    }

    if (!quotesForCustomer(c.id).length) {
      const sch = schemesForCustomer(c.id)[0];
      const qtTpl = DemoData.quoteTemplates[0];
      const unit = 32000;
      const lines = (sch.lines || []).map(function (l) {
        const qty = l.qty || 1;
        return {
          inventoryName: l.name,
          name: l.name,
          skuLabel: l.skuLabel,
          qty: qty,
          quotePrice: unit,
          sub: unit * qty
        };
      });
      const total = lines.reduce(function (s, l) {
        return s + (l.sub || 0);
      }, 0);
      persistQuote({
        id: 'QT' + (now - 43200000).toString().slice(-8),
        templateId: qtTpl.id,
        templateName: qtTpl.name,
        schemeId: sch ? sch.id : null,
        customerId: c.id,
        total: total,
        lines: lines,
        createdAt: '2026-05-16 11:00'
      });
    }
  }

  function schemeHistoryRowTitle(s) {
    const name = (s && s.templateName) || '未命名方案';
    const c = s && s.customerId ? App.getCustomer(s.customerId) : null;
    const cname = c && c.name ? String(c.name).trim() : '';
    if (cname && name.indexOf(cname) === 0) {
      const rest = name.slice(cname.length).trim();
      return rest || name;
    }
    return name;
  }

  function renderSchemeCardHtml(scheme, c, tpl, opts) {
    opts = opts || {};
    const lineHtml = (scheme.lines || [])
      .map(
        (l) =>
          '<p class="sc-card__meta">' +
          App.escapeHtml(l.name) +
          ' · ' +
          App.escapeHtml(l.skuLabel) +
          ' ×' +
          l.qty +
          '</p>'
      )
      .join('');
    const customerLine = opts.hideCustomer
      ? ''
      : '<p class="sc-card__meta">客户：' + App.escapeHtml(c.name) + '</p>';
    const displayName = opts.hideCustomer
      ? schemeHistoryRowTitle(scheme)
      : scheme.templateName || '—';
    return (
      '<div class="sc-card" data-spec-id="card-scheme"><div class="sc-card__head sc-card__head--compact">方案 ' +
      App.escapeHtml(scheme.id) +
      '</div><div class="sc-card__row sc-card__row--compact">' +
      customerLine +
      '<p class="sc-card__meta">方案名称：' +
      App.escapeHtml(displayName) +
      '</p><p class="sc-card__meta">版式模板：' +
      App.escapeHtml(
        (tpl && tpl.name) || scheme.layoutTemplateName || '—'
      ) +
      '（方案正文不含价格）</p>' +
      lineHtml +
      '<div class="sc-card__actions-inline">' +
      '<button type="button" class="sc-btn sc-btn--ghost" data-action="open-pdf" data-pdf="方案">预览 PDF</button>' +
      '<button type="button" class="sc-btn sc-btn--ghost-primary" data-action="quote-from-scheme" data-scheme-id="' +
      App.escapeHtml(scheme.id) +
      '">去报价</button>' +
      '</div></div></div>'
    );
  }

  /** 历史方案列表点选：仅出方案卡；PDF 由卡上「预览 PDF」按钮打开 */
  function viewSchemeById(sid, opts) {
    opts = opts || {};
    const scheme = schemeForActiveCustomer(sid);
    if (!scheme) {
      App.toast('未找到该方案');
      return false;
    }
    clearActivePickList();
    const c = App.getCustomer(scheme.customerId) || activeCustomer();
    persistScheme(scheme);
    const tpl = DemoData.planTemplates.find(function (x) {
      return x.id === scheme.templateId;
    });
    const utterLabel = scheme.templateName || scheme.id;
    const userLine = opts.announceRow
      ? '第 ' + opts.announceRow + ' 条'
      : '查看方案 ' + utterLabel;
    pushNextAiCard(renderSchemeCardHtml(scheme, c, tpl, { hideCustomer: true }), userLine);
    if (window.Annotation && Annotation.scanHosts) window.Annotation.scanHosts();
    return true;
  }

  function renderQuoteCardHtml(quote, c, tpl) {
    let schemeNameLine = '';
    if (quote.sourceType === 'scheme' && quote.schemeId) {
      const sch = schemesForCustomer(c.id).find((s) => s.id === quote.schemeId);
      if (sch && sch.templateName) {
        schemeNameLine =
          '<p class="sc-card__meta">方案名称：' + App.escapeHtml(sch.templateName) + '</p>';
      }
    }
    return (
      '<div class="sc-card" data-spec-id="card-quote"><div class="sc-card__head sc-card__head--compact">报价单 ' +
      App.escapeHtml(quote.id) +
      '</div><div class="sc-card__row sc-card__row--compact"><p class="sc-card__meta">客户：' +
      App.escapeHtml(c.name) +
      '</p>' +
      schemeNameLine +
      '<p class="sc-card__meta">报价单模板：' +
      App.escapeHtml((tpl && tpl.name) || quote.templateName || '—') +
      '</p><p class="sc-card__meta"><strong>报价金额 ' +
      fmtMoney(quote.total) +
      '</strong></p><div class="sc-card__actions-inline"><button type="button" class="sc-btn sc-btn--ghost" data-action="open-pdf" data-pdf="报价">看 PDF</button><button type="button" class="sc-btn sc-btn--ghost-primary" data-action="order-from-quote" data-quote-id="' +
      App.escapeHtml(quote.id) +
      '">生成订单</button></div></div></div>'
    );
  }

  /** 历史报价单列表点选：仅出报价单卡；PDF 由卡上「看 PDF」打开 */
  function viewQuoteById(qid, opts) {
    opts = opts || {};
    const quote = quoteForActiveCustomer(qid);
    if (!quote) {
      App.toast('未找到该报价单');
      return false;
    }
    clearActivePickList();
    const c = App.getCustomer(quote.customerId) || activeCustomer();
    persistQuote(quote);
    const tpl = DemoData.quoteTemplates.find(function (x) {
      return x.id === quote.templateId;
    });
    const userLine = opts.announceRow
      ? '第 ' + opts.announceRow + ' 条'
      : '查看报价单 ' + quote.id;
    pushNextAiCard(renderQuoteCardHtml(quote, c, tpl), userLine);
    if (window.Annotation && Annotation.scanHosts) window.Annotation.scanHosts();
    return true;
  }

  function pushSchemeHistoryView(c, list, leadHtml) {
    setActivePickList('scheme', list, 'view');
    App.pushAiHtml(
      (leadHtml ||
        '<p class="sc-reply-lead">本客户共有 <strong>' +
          list.length +
          '</strong> 个已保存方案，点选一行或语音「第 N 条」查看<strong>方案卡</strong>：</p>') +
        renderSchemePickCard(list, {
          title: '历史方案',
          pickAction: 'history-view-scheme',
          footnote: '最近保存的排在最前；点选后展示方案卡，需 PDF 时点卡内「预览 PDF」'
        })
    );
  }

  function pushQuoteHistoryView(c, list, leadHtml) {
    setActivePickList('quote', list, 'view');
    App.pushAiHtml(
      (leadHtml ||
        '<p class="sc-reply-lead">本客户共有 <strong>' +
          list.length +
          '</strong> 份报价单，点选一行或语音「第 N 条」查看<strong>报价单卡</strong>：</p>') +
        renderQuoteSelectCard(list, {
          title: '历史报价单',
          pickAction: 'history-view-quote',
          footnote: '最近生成的排在最前；点选后展示报价单卡，需 PDF 时点卡内「看 PDF」'
        })
    );
  }

  function orderPickSummary(o) {
    return (o.date || '—') + ' · ' + (o.amount || '—') + ' · ' + (o.status || '—');
  }

  function renderOrderSelectCard(list, opts) {
    opts = opts || {};
    const title = opts.title || '选择订单';
    const pickAction = opts.pickAction || 'history-view-order';
    const footnote = opts.footnote
      ? '<p class="sc-card__meta">' + App.escapeHtml(opts.footnote) + '</p>'
      : '';
    const rows = (list || [])
      .map(function (o, i) {
        const n = i + 1;
        return (
          '<button type="button" class="sc-follow-row sc-follow-row--select" data-action="' +
          pickAction +
          '" data-oid="' +
          App.escapeHtml(o.id) +
          '" data-pick-index="' +
          n +
          '"><span class="sc-follow-row__name">' +
          n +
          '. 订单 ' +
          App.escapeHtml(o.no) +
          '</span><span class="sc-follow-row__meta">' +
          App.escapeHtml(orderPickSummary(o)) +
          '</span></button>'
        );
      })
      .join('');
    return (
      '<div class="sc-card sc-card--compact" data-spec-id="card-order-select">' +
      '<div class="sc-card__head sc-card__head--compact">' +
      App.escapeHtml(title) +
      '</div>' +
      '<div class="sc-follow-list">' +
      rows +
      '</div>' +
      footnote +
      '</div>'
    );
  }

  function renderOrderCardHtml(order, c) {
    return (
      '<div class="sc-card" data-spec-id="card-order"><div class="sc-card__head sc-card__head--compact">订单 ' +
      App.escapeHtml(order.no) +
      '</div><div class="sc-card__row sc-card__row--compact"><p class="sc-card__meta">客户：' +
      App.escapeHtml(c ? c.name : '—') +
      '</p><p class="sc-card__meta">状态：' +
      App.escapeHtml(order.status || '—') +
      '</p><p class="sc-card__meta">' +
      App.escapeHtml(order.statusDetail || '') +
      '</p><p class="sc-card__meta">' +
      App.escapeHtml(order.items || '') +
      ' · ' +
      App.escapeHtml(order.date || '') +
      '</p><p class="sc-card__meta"><strong>金额 ' +
      App.escapeHtml(order.amount || '—') +
      '</strong></p></div></div>'
    );
  }

  function viewOrderById(oid, opts) {
    opts = opts || {};
    const order = DemoData.orders.find(function (x) {
      return x.id === oid;
    });
    if (!order) {
      App.toast('未找到该订单');
      return false;
    }
    clearActivePickList();
    const c = App.getCustomer(order.customerId) || activeCustomer();
    const userLine = opts.announceRow
      ? '第 ' + opts.announceRow + ' 条'
      : '查看订单 ' + order.no;
    pushNextAiCard(renderOrderCardHtml(order, c), userLine);
    if (window.Annotation && Annotation.scanHosts) window.Annotation.scanHosts();
    return true;
  }

  function pushOrderHistoryView(c, list, leadHtml) {
    setActivePickList('order', list, 'view');
    App.pushAiHtml(
      (leadHtml ||
        '<p class="sc-reply-lead">本客户共有 <strong>' +
          list.length +
          '</strong> 笔订单，点选一行或语音「第 N 条」查看<strong>订单卡</strong>：</p>') +
        renderOrderSelectCard(list, {
          title: '历史订单',
          pickAction: 'history-view-order',
          footnote: '最近下单的排在最前；点选后展示订单详情'
        })
    );
  }

  function tryViewSchemeHistory(t) {
    if (!isViewSchemeHistoryPhrase(t)) return false;
    setPlanSkillAtEntry(false);
    const c = activeCustomer() || requireCustomer();
    if (!c) return true;
    enterSkill('plan');
    seedDemoHistoryIfEmpty(c);
    const pool = schemesForCustomer(c.id);
    if (!pool.length) {
      App.pushAiHtml(
        '<p class="sc-reply-lead">客户 <strong>' +
          App.escapeHtml(c.name) +
          '</strong> 暂无已保存方案，请先完成<strong>方案速配</strong>并保存方案后再查看。</p>'
      );
      if (window.Annotation && Annotation.scanHosts) window.Annotation.scanHosts();
      return true;
    }
    const attrs = parseSchemeViewAttributes(t);
    const hasAttr = schemeQuoteHasAttributeCriteria(attrs);
    const matched = hasAttr ? matchSchemesByAttributes(c, attrs, pool) : pool;

    if (matched.length === 1) {
      return viewSchemeById(matched[0].id);
    }
    if (matched.length > 1) {
      pushSchemeHistoryView(
        c,
        matched,
        hasAttr
          ? '<p class="sc-reply-lead">按 <strong>' +
              App.escapeHtml(describeSchemeQuoteCriteria(attrs)) +
              '</strong> 匹配到 <strong>' +
              matched.length +
              '</strong> 个方案，请选择要查看的一条：</p>'
          : undefined
      );
      if (window.Annotation && Annotation.scanHosts) window.Annotation.scanHosts();
      return true;
    }
    if (hasAttr && matched.length === 0) {
      App.pushAiHtml(
        '<p class="sc-reply-lead"><strong>【待填写】</strong> 未找到与描述匹配的方案，请从下列 <strong>' +
          pool.length +
          '</strong> 个历史方案中选择：</p>'
      );
      pushSchemeHistoryView(c, pool);
      if (window.Annotation && Annotation.scanHosts) window.Annotation.scanHosts();
      return true;
    }
    if (pool.length === 1) {
      return viewSchemeById(pool[0].id);
    }
    pushSchemeHistoryView(c, pool);
    if (window.Annotation && Annotation.scanHosts) window.Annotation.scanHosts();
    return true;
  }

  function tryViewQuoteHistory(t) {
    if (!isViewQuoteHistoryPhrase(t)) return false;
    setQuoteSkillAtEntry(false);
    const c = activeCustomer() || requireCustomer();
    if (!c) return true;
    enterSkill('quote');
    seedDemoHistoryIfEmpty(c);
    const pool = quotesForCustomer(c.id);
    if (!pool.length) {
      App.pushAiHtml(
        '<p class="sc-reply-lead">客户 <strong>' +
          App.escapeHtml(c.name) +
          '</strong> 暂无报价单，请先完成<strong>产品报价</strong>生成报价单后再查看。</p>'
      );
      if (window.Annotation && Annotation.scanHosts) window.Annotation.scanHosts();
      return true;
    }
    const attrs = parseQuoteViewAttributes(t);
    const hasAttr = orderByQuoteHasAttributeCriteria(attrs);
    const matched = hasAttr ? matchQuotesByAttributes(c, attrs, pool) : pool;

    if (matched.length === 1) {
      return viewQuoteById(matched[0].id);
    }
    if (matched.length > 1) {
      pushQuoteHistoryView(
        c,
        matched,
        hasAttr
          ? '<p class="sc-reply-lead">按 <strong>' +
              App.escapeHtml(describeOrderByQuoteCriteria(attrs)) +
              '</strong> 匹配到 <strong>' +
              matched.length +
              '</strong> 份报价单，请选择要查看的一份：</p>'
          : undefined
      );
      if (window.Annotation && Annotation.scanHosts) window.Annotation.scanHosts();
      return true;
    }
    if (hasAttr && matched.length === 0) {
      App.pushAiHtml(
        '<p class="sc-reply-lead"><strong>【待填写】</strong> 未找到与描述匹配的报价单，请从下列 <strong>' +
          pool.length +
          '</strong> 份历史报价单中选择：</p>'
      );
      pushQuoteHistoryView(c, pool);
      if (window.Annotation && Annotation.scanHosts) window.Annotation.scanHosts();
      return true;
    }
    if (pool.length === 1) {
      return viewQuoteById(pool[0].id);
    }
    pushQuoteHistoryView(c, pool);
    if (window.Annotation && Annotation.scanHosts) window.Annotation.scanHosts();
    return true;
  }

  function renderSchemePickCard(list, opts) {
    opts = opts || {};
    const title = opts.title || '选择方案';
    const pickAction = opts.pickAction || 'quote-pick-scheme';
    const footnote = opts.footnote
      ? '<p class="sc-card__meta">' + App.escapeHtml(opts.footnote) + '</p>'
      : '';
    const hideCustomerInList = opts.pickAction === 'history-view-scheme';
    const rows = list
      .slice()
      .reverse()
      .map(
        function (s, i) {
          const n = i + 1;
          const rowTitle = hideCustomerInList
            ? schemeHistoryRowTitle(s)
            : s.templateName || '未命名方案';
          return (
            '<button type="button" class="sc-follow-row sc-follow-row--select" data-action="' +
            pickAction +
            '" data-scheme-id="' +
            App.escapeHtml(s.id) +
            '" data-pick-index="' +
            n +
            '"><span class="sc-follow-row__name">' +
            n +
            '. ' +
            App.escapeHtml(rowTitle) +
            '</span><span class="sc-follow-row__meta">方案 ' +
            App.escapeHtml(s.id) +
            ' · ' +
            App.escapeHtml(schemePickSummary(s)) +
            '</span></button>'
          );
        }
      )
      .join('');
    return (
      '<div class="sc-card sc-card--compact" data-spec-id="card-scheme-pick">' +
      '<div class="sc-card__head sc-card__head--compact">' +
      App.escapeHtml(title) +
      '</div>' +
      '<div class="sc-follow-list">' +
      rows +
      '</div>' +
      footnote +
      '</div>'
    );
  }

  function schemeForActiveCustomer(preferredId) {
    const c = activeCustomer();
    if (!c) return null;
    const list = schemesForCustomer(c.id);
    if (!list.length) return null;
    if (preferredId) {
      const hit = list.find((s) => s.id === preferredId);
      if (hit) return hit;
    }
    if (ctx().activeSchemeId) {
      const hit = list.find((s) => s.id === ctx().activeSchemeId);
      if (hit) return hit;
    }
    return list[list.length - 1];
  }

  function pushSchemePickForQuote(c, leadHtml, schemeList) {
    const list =
      schemeList && schemeList.length ? schemeList : schemesForCustomer(c.id);
    setActivePickList('scheme', list, 'quote');
    enterSkill('quote');
    App.pushAiHtml(
      (leadHtml ||
        '<p class="sc-reply-lead">本客户有 <strong>' +
          list.length +
          '</strong> 个方案，<strong>按方案报价须先选择方案</strong>（点选下方一行，展示方案名称）：</p>') +
        renderSchemePickCard(list)
    );
  }

  /** 从口令/话术中解析方案检索属性（表单字段：方案编号、方案名称） */
  function parseSchemeQuoteAttributes(text) {
    const t = (text || '').trim();
    const attrs = { schemeId: null, templateName: null, keyword: '' };
    let m = t.match(/(?:方案编号|方案号)\s*[：:]\s*(PL[\w-]+)/i);
    if (!m) m = t.match(/\b(PL\d{6,})\b/i);
    if (m) attrs.schemeId = m[1].toUpperCase();
    m = t.match(/方案名称\s*[：:]\s*([^\s，,。.；;]+)/);
    if (m) attrs.templateName = m[1].trim();
    let tail = t.replace(/^按方案\s*报价\s*/i, '').replace(/(后|吧|啊|呀)\s*$/i, '').trim();
    if (!attrs.schemeId && !attrs.templateName && tail.length >= 2 && !/^给.+/.test(tail)) {
      attrs.keyword = tail;
    }
    return attrs;
  }

  function schemeQuoteHasAttributeCriteria(attrs) {
    return !!(
      attrs &&
      (attrs.schemeId || attrs.templateName || (attrs.keyword && attrs.keyword.length >= 2))
    );
  }

  function matchSchemesByAttributes(customer, attrs, pool) {
    let list = (pool || schemesForCustomer(customer.id)).slice();
    if (!attrs) return list;
    if (attrs.schemeId) {
      list = list.filter((s) => s.id.toUpperCase() === attrs.schemeId.toUpperCase());
    }
    if (attrs.templateName) {
      const n = attrs.templateName.toLowerCase();
      list = list.filter((s) => (s.templateName || '').toLowerCase().indexOf(n) >= 0);
    }
    if (attrs.keyword) {
      const k = attrs.keyword.toLowerCase();
      list = list.filter(
        (s) =>
          (s.templateName || '').toLowerCase().indexOf(k) >= 0 ||
          s.id.toLowerCase().indexOf(k) >= 0 ||
          schemePickSummary(s).toLowerCase().indexOf(k) >= 0
      );
    }
    return list;
  }

  function describeSchemeQuoteCriteria(attrs) {
    const parts = [];
    if (attrs.schemeId) parts.push('方案编号 ' + attrs.schemeId);
    if (attrs.templateName) parts.push('方案名称「' + attrs.templateName + '」');
    if (attrs.keyword) parts.push('关键词「' + attrs.keyword + '」');
    return parts.join('、') || '（未指定属性）';
  }

  /** 从口令/话术中解析报价单检索属性（表单字段：报价单编号、报价单模板） */
  function parseOrderByQuoteAttributes(text) {
    const t = (text || '').trim();
    const attrs = { quoteId: null, templateName: null, keyword: '' };
    let m = t.match(/(?:报价单编号|报价单号)\s*[：:]\s*((?:QT)[\w-]+)/i);
    if (!m) m = t.match(/\b(QT\d{6,})\b/i);
    if (m) attrs.quoteId = m[1].toUpperCase();
    m = t.match(/报价单模板\s*[：:]\s*([^\s，,。.；;]+)/);
    if (m) attrs.templateName = m[1].trim();
    let tail = t
      .replace(/^(?:给[^，,。.]{2,24}\s+)?/i, '')
      .replace(/^按报价单\s*/i, '')
      .replace(/^(?:下单|生成订单|确认下单)\s*/i, '')
      .replace(/(后|吧|啊|呀)\s*$/i, '')
      .trim();
    if (!attrs.quoteId && !attrs.templateName && tail.length >= 2) attrs.keyword = tail;
    return attrs;
  }

  function orderByQuoteHasAttributeCriteria(attrs) {
    return !!(
      attrs &&
      (attrs.quoteId || attrs.templateName || (attrs.keyword && attrs.keyword.length >= 2))
    );
  }

  function matchQuotesByAttributes(customer, attrs, pool) {
    let list = (pool || quotesForCustomer(customer.id)).slice();
    if (!attrs) return list;
    if (attrs.quoteId) {
      list = list.filter((q) => q.id.toUpperCase() === attrs.quoteId.toUpperCase());
    }
    if (attrs.templateName) {
      const n = attrs.templateName.toLowerCase();
      list = list.filter((q) => (q.templateName || '').toLowerCase().indexOf(n) >= 0);
    }
    if (attrs.keyword) {
      const k = attrs.keyword.toLowerCase();
      list = list.filter(
        (q) =>
          q.id.toLowerCase().indexOf(k) >= 0 ||
          (q.templateName || '').toLowerCase().indexOf(k) >= 0
      );
    }
    return list;
  }

  function describeOrderByQuoteCriteria(attrs) {
    const parts = [];
    if (attrs.quoteId) parts.push('报价单编号 ' + attrs.quoteId);
    if (attrs.templateName) parts.push('报价单模板「' + attrs.templateName + '」');
    if (attrs.keyword) parts.push('关键词「' + attrs.keyword + '」');
    return parts.join('、') || '（未指定属性）';
  }

  function ensureQuotesStore() {
    if (!Array.isArray(ctx().quotes)) {
      ctx().quotes = [];
      if (ctx().quote && ctx().quote.id) ctx().quotes.push(ctx().quote);
    }
  }

  function quotesForCustomer(cid) {
    ensureQuotesStore();
    return ctx().quotes.filter((q) => q.customerId === cid);
  }

  function persistQuote(quote) {
    ensureQuotesStore();
    const idx = ctx().quotes.findIndex((q) => q.id === quote.id);
    if (idx >= 0) ctx().quotes[idx] = quote;
    else ctx().quotes.push(quote);
    ctx().quote = quote;
    ctx().activeQuoteId = quote.id;
    App.saveState();
    return quote;
  }

  function quotePickSummary(q) {
    const n = (q.lines || []).length;
    return fmtMoney(q.total != null ? q.total : 0) + (n ? ' · ' + n + ' 项' : '');
  }

  function renderQuoteSelectCard(list, opts) {
    opts = opts || {};
    const title = opts.title || '选择报价单';
    const pickAction = opts.pickAction || 'order-pick-quote';
    const footnote = opts.footnote
      ? '<p class="sc-card__meta">' + App.escapeHtml(opts.footnote) + '</p>'
      : '';
    const rows = list
      .slice()
      .reverse()
      .map(function (q, i) {
        const n = i + 1;
        return (
          '<button type="button" class="sc-follow-row sc-follow-row--select" data-action="' +
          pickAction +
          '" data-quote-id="' +
          App.escapeHtml(q.id) +
          '" data-pick-index="' +
          n +
          '"><span class="sc-follow-row__name">' +
          n +
          '. 报价单 ' +
          App.escapeHtml(q.id) +
          '</span><span class="sc-follow-row__meta">' +
          App.escapeHtml(q.templateName || '—') +
          ' · ' +
          App.escapeHtml(quotePickSummary(q)) +
          '</span></button>'
        );
      })
      .join('');
    return (
      '<div class="sc-card sc-card--compact" data-spec-id="card-quote-select">' +
      '<div class="sc-card__head sc-card__head--compact">' +
      App.escapeHtml(title) +
      '</div>' +
      '<div class="sc-follow-list">' +
      rows +
      '</div>' +
      footnote +
      '</div>'
    );
  }

  function quoteForActiveCustomer(preferredId) {
    const c = activeCustomer();
    if (!c) return null;
    const list = quotesForCustomer(c.id);
    if (!list.length) return null;
    if (preferredId) {
      const hit = list.find((q) => q.id === preferredId);
      if (hit) return hit;
    }
    if (ctx().activeQuoteId) {
      const hit = list.find((q) => q.id === ctx().activeQuoteId);
      if (hit) return hit;
    }
    return list[list.length - 1];
  }

  function pushQuotePickForOrder(c, leadHtml, quoteList) {
    const list =
      quoteList && quoteList.length ? quoteList : quotesForCustomer(c.id);
    setActivePickList('quote', list, 'order');
    enterSkill('order');
    App.pushAiHtml(
      (leadHtml ||
        '<p class="sc-reply-lead">本客户有 <strong>' +
          list.length +
          '</strong> 个报价单，<strong>按方案/按报价单下单须先选择</strong>（点选下方一行）：</p>') +
        renderQuoteSelectCard(list)
    );
  }

  /** 按报价单属性检索：唯一 → 订单确认；多个 → 选择报价单卡（仅列匹配项） */
  function resolveOrderByQuoteUtterance(c, text) {
    const pool = quotesForCustomer(c.id);
    if (!pool.length) {
      enterSkill('order');
      App.pushAiHtml(
        '<p class="sc-reply-lead">当前客户 <strong>' +
          App.escapeHtml(c.name) +
          '</strong> 暂无报价单，已进入选品报价。</p>'
      );
      orderDirectStart();
      return true;
    }
    const attrs = parseOrderByQuoteAttributes(text);
    const hasAttr = orderByQuoteHasAttributeCriteria(attrs);
    const matched = hasAttr ? matchQuotesByAttributes(c, attrs, pool) : pool;

    if (matched.length === 1) {
      const quote = quoteForActiveCustomer(matched[0].id);
      if (!quote) return false;
      enterSkill('order');
      App.pushAiHtml(
        (hasAttr
          ? '<p class="sc-reply-lead">已按 <strong>' +
            App.escapeHtml(describeOrderByQuoteCriteria(attrs)) +
            '</strong> 匹配到唯一报价单 <strong>' +
            App.escapeHtml(quote.id) +
            '</strong>（' +
            App.escapeHtml(quote.templateName || '—') +
            '），打开下单确认。</p>'
          : '<p class="sc-reply-lead">已按报价单 <strong>' +
            App.escapeHtml(quote.id) +
            '</strong> 打开下单确认。</p>')
      );
      applyOrderFromQuote(quote);
      return true;
    }
    if (matched.length > 1) {
      pushQuotePickForOrder(
        c,
        '<p class="sc-reply-lead">按 <strong>' +
          App.escapeHtml(describeOrderByQuoteCriteria(attrs)) +
          '</strong> 匹配到 <strong>' +
          matched.length +
          '</strong> 份报价单，请<strong>确认要下单的报价单</strong>：</p>',
        matched
      );
      return true;
    }
    if (hasAttr && matched.length === 0) {
      guideMissingSlot('orderQuotePick', {
        leadHtml:
          '<p class="sc-reply-lead"><strong>【待填写】</strong> 未找到与描述匹配的报价单，请从下列选择。</p>',
        skipToast: false,
        message: '未找到与描述匹配的报价单'
      });
      pushQuotePickForOrder(
        c,
        '<p class="sc-reply-lead">未匹配到符合条件的报价单，请从下列 <strong>' +
          pool.length +
          '</strong> 份中选择：</p>',
        pool
      );
      return true;
    }
    if (pool.length > 1) {
      pushQuotePickForOrder(c);
      return true;
    }
    const quote = quoteForActiveCustomer(pool[0].id);
    if (!quote) return false;
    enterSkill('order');
    App.pushAiHtml(
      '<p class="sc-reply-lead">已按报价单 <strong>' +
        App.escapeHtml(quote.id) +
        '</strong> 打开下单确认。</p>'
    );
    applyOrderFromQuote(quote);
    return true;
  }

  /** 按方案报价前无方案时：用推荐品静默生成当前客户方案 */
  function ensureSchemeFromRecommendations(c, opts) {
    opts = opts || {};
    const existing = schemeForActiveCustomer();
    if (existing) return existing;
    const recs = DemoData.recommendProducts(c, '').slice(0, 3);
    if (!recs.length) return null;
    ensurePlan(c);
    const plan = ctx().plan;
    recs.forEach((row) => {
      const pid = row.product.id;
      plan.selected[pid] = true;
      plan.qty[pid] = plan.qty[pid] || 1;
      plan.sku[pid] = DemoData.defaultSkuId(row.product);
    });
    const tpl = DemoData.planTemplates[0];
    if (!tpl) return null;
    const lines = planSelectedIds().map((pid) => {
      const p = productById(pid);
      const qty = plan.qty[pid] || 1;
      const skuId = plan.sku[pid] || DemoData.defaultSkuId(p);
      return {
        productId: pid,
        name: p.name,
        skuId: skuId,
        skuLabel: DemoData.skuLabel(p, skuId),
        qty: qty,
        sub: p.unitPrice * qty
      };
    });
    if (!lines.length) return null;
    const total = lines.reduce((s, l) => s + l.sub, 0);
    const scheme = persistScheme({
      id: 'PL' + Date.now().toString().slice(-8),
      customerId: c.id,
      templateId: tpl.id,
      templateName: buildSchemeDisplayName(c, lines),
      layoutTemplateName: tpl.name,
      lines: lines,
      total: total,
      createdAt: new Date().toISOString().slice(0, 16).replace('T', ' ')
    });
    if (!opts.silent) {
      App.closeOverlays();
      pushSchemeCard(scheme, c, tpl);
    }
    return scheme;
  }

  function pushSchemeCard(scheme, c, tpl) {
    App.pushAiHtml(renderSchemeCardHtml(scheme, c, tpl));
  }

  function ordersForCustomer(cid) {
    return DemoData.orders
      .filter((o) => {
        const c = App.getCustomer(o.customerId);
        return o.customerId === cid && c && c.enterpriseId === App.state.enterpriseId;
      })
      .slice()
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }

  function deliveryOrdersForCustomer(cid) {
    return ordersForCustomer(cid).filter(function (o) {
      return DemoData.isOrderUnscheduled(o);
    });
  }

  function productById(id) {
    return DemoData.products.find((p) => p.id === id);
  }

  function fmtMoney(n) {
    return '¥' + n.toLocaleString('zh-CN');
  }

  function pdfKindIsQuote(kind) {
    const k = (kind || '').trim();
    return k === '报价' || k === 'quote' || k === '报价单';
  }

  /** 方案 / 报价单 PDF 预览正文（演示 HTML，非真实 PDF 文件） */
  function renderPdfDocument(kind) {
    const isQuote = pdfKindIsQuote(kind);
    const c = activeCustomer();
    const today = new Date().toISOString().slice(0, 10);

    if (isQuote) {
      const q = ctx().quote;
      if (!q || !q.lines || !q.lines.length) {
        return '<p class="sc-pdf-empty">请先生成报价单后再预览。</p>';
      }
      const cust = App.getCustomer(q.customerId) || c;
      const rows = q.lines
        .map(
          (l, i) =>
            '<tr><td>' +
            (i + 1) +
            '</td><td>' +
            App.escapeHtml(l.inventoryName || l.name || '—') +
            '</td><td>' +
            App.escapeHtml(l.skuLabel || l.inventorySpec || '—') +
            '</td><td class="sc-pdf-doc__num">' +
            (l.qty || 0) +
            '</td><td>' +
            App.escapeHtml(l.salesUnit || '—') +
            '</td><td class="sc-pdf-doc__num">' +
            fmtMoney(l.quotePrice != null ? l.quotePrice : l.unitPrice || 0) +
            '</td><td class="sc-pdf-doc__num">' +
            fmtMoney(l.sub != null ? l.sub : (l.quotePrice || 0) * (l.qty || 1)) +
            '</td></tr>'
        )
        .join('');
      const total = q.total != null ? q.total : q.lines.reduce((s, l) => s + (l.sub || 0), 0);
      return (
        '<article class="sc-pdf-doc" data-pdf-type="quote">' +
        '<header class="sc-pdf-doc__head"><h1 class="sc-pdf-doc__title">销售报价单</h1>' +
        '<p class="sc-pdf-doc__meta">单号：' +
        App.escapeHtml(q.id) +
        ' · 日期：' +
        today +
        '</p><p class="sc-pdf-doc__meta">客户：' +
        App.escapeHtml(cust ? cust.name : '—') +
        '</p><p class="sc-pdf-doc__meta">版式：' +
        App.escapeHtml(q.templateName || '—') +
        '</p></header>' +
        '<table class="sc-pdf-doc__table"><thead><tr><th>序</th><th>品名</th><th>规格</th><th>数量</th><th>单位</th><th>单价</th><th>金额</th></tr></thead><tbody>' +
        rows +
        '</tbody></table>' +
        '<footer class="sc-pdf-doc__foot"><p class="sc-pdf-doc__total">含税合计 <strong>' +
        fmtMoney(total) +
        '</strong></p></footer></article>'
      );
    }

    const s = ctx().scheme;
    if (!s || !s.lines || !s.lines.length) {
      return '<p class="sc-pdf-empty">请先生成方案后再预览。</p>';
    }
    const cust = App.getCustomer(s.customerId) || c;
    const rows = s.lines
      .map(
        (l, i) =>
          '<tr><td>' +
          (i + 1) +
          '</td><td>' +
          App.escapeHtml(l.name || '—') +
          '</td><td>' +
          App.escapeHtml(l.skuLabel || '—') +
          '</td><td class="sc-pdf-doc__num">' +
          (l.qty || 0) +
          '</td><td>套</td></tr>'
      )
      .join('');
    const qtySum = s.lines.reduce((n, l) => n + (l.qty || 0), 0);
    return (
      '<article class="sc-pdf-doc" data-pdf-type="scheme">' +
      '<header class="sc-pdf-doc__head"><h1 class="sc-pdf-doc__title">技术方案</h1>' +
      '<p class="sc-pdf-doc__meta">编号：' +
      App.escapeHtml(s.id) +
      ' · 日期：' +
      today +
      '</p><p class="sc-pdf-doc__meta">客户：' +
      App.escapeHtml(cust ? cust.name : '—') +
      '</p><p class="sc-pdf-doc__meta">模板：' +
      App.escapeHtml(s.templateName || '—') +
      '（正文不含单价与金额）</p></header>' +
      '<table class="sc-pdf-doc__table"><thead><tr><th>序</th><th>品名</th><th>规格</th><th>数量</th><th>单位</th></tr></thead><tbody>' +
      rows +
      '</tbody></table>' +
      '<footer class="sc-pdf-doc__foot"><p class="sc-pdf-doc__note">合计数量 ' +
      qtySum +
      ' 件（套），本方案不展示价格</p></footer></article>'
    );
  }

  function pdfExportMeta(isQuote) {
    const today = new Date().toISOString().slice(0, 10);
    if (isQuote) {
      const q = ctx().quote;
      const cust = q ? App.getCustomer(q.customerId) : null;
      const total =
        q && q.total != null ? q.total : q && q.lines ? q.lines.reduce((s, l) => s + (l.sub || 0), 0) : 0;
      return {
        title: '销售报价单 ' + (q && q.id ? q.id : ''),
        subtitle:
          '客户：' +
          (cust ? cust.name : '—') +
          ' · 日期 ' +
          today +
          (q && q.templateName ? ' · ' + q.templateName : ''),
        total: fmtMoney(total),
        filename: '报价单-' + (q && q.id ? q.id : 'draft') + '.pdf'
      };
    }
    const s = ctx().scheme;
    const cust = s ? App.getCustomer(s.customerId) : null;
    return {
      title: '技术方案 ' + (s && s.id ? s.id : ''),
      subtitle:
        '客户：' +
        (cust ? cust.name : '—') +
        ' · 日期 ' +
        today +
        (s && s.templateName ? ' · ' + s.templateName : ''),
      total: null,
      filename: '技术方案-' + (s && s.id ? s.id : 'draft') + '.pdf'
    };
  }

  async function downloadPdfDocument() {
    const doc = window.PdfExport && PdfExport.getDocEl();
    if (!doc) {
      App.toast('请先生成文档后再下载');
      return;
    }
    const modal = App.$('#pdf-modal');
    const isQuote = modal && modal.dataset.pdfKind === 'quote';
    const meta = pdfExportMeta(isQuote);
    App.toast('正在生成文件…');
    try {
      const r = await PdfExport.download(doc, meta.filename);
      App.toast(r.format === 'pdf' ? '已下载 PDF' : '已下载 HTML（可浏览器打印为 PDF）');
    } catch (e) {
      App.toast('下载失败，请重试');
    }
  }

  async function forwardPdfDocument() {
    const doc = window.PdfExport && PdfExport.getDocEl();
    if (!doc) {
      App.toast('请先生成文档后再转发');
      return;
    }
    const modal = App.$('#pdf-modal');
    const isQuote = modal && modal.dataset.pdfKind === 'quote';
    const meta = pdfExportMeta(isQuote);
    App.toast('正在准备分享…');
    try {
      const r = await PdfExport.forward(doc, meta, meta.filename);
      if (r.mode === 'share-file') App.toast('已唤起分享（含 PDF 附件）');
      else if (r.mode === 'share-text') App.toast('已唤起分享');
      else if (r.mode === 'clipboard') App.toast('已复制摘要，可粘贴到微信/邮件');
      else if (r.mode === 'cancel') return;
    } catch (e) {
      App.toast('当前环境不支持分享，请使用下载后自行发送');
    }
  }

  function openPdf(title, kind) {
    const modal = App.$('#pdf-modal');
    if (!modal) return;
    if (App.closeOverlays) App.closeOverlays();
    const k = kind || title || '';
    const isQuote = pdfKindIsQuote(k);
    modal.dataset.pdfKind = isQuote ? 'quote' : 'scheme';
    const t = modal.querySelector('#pdf-bar-title');
    const body = modal.querySelector('.sc-pdf__body');
    if (t) t.textContent = isQuote ? '报价单预览' : '方案预览';
    if (body) body.innerHTML = renderPdfDocument(k);
    modal.classList.remove('sc-hidden');
    document.body.classList.add('sc-pdf-open');
    const dl = App.$('#pdf-download');
    const fw = App.$('#pdf-forward');
    const hasDoc = !!body && body.querySelector('.sc-pdf-doc');
    if (dl) dl.disabled = !hasDoc;
    if (fw) fw.disabled = !hasDoc;
    if (window.Annotation && Annotation.scanHosts) window.Annotation.scanHosts();
  }

  function ensurePlan(customer) {
    const c = customer || requireCustomer();
    if (!c) return null;
    App.state.customerId = c.id;
    App.saveState();
    App.refreshHeader();
    if (!ctx().plan || ctx().plan.customerId !== c.id) {
      ctx().plan = {
        customerId: c.id,
        filter: '',
        demandText: '',
        awaitingDemand: false,
        selected: {},
        sku: {},
        qty: {},
        templateId: null,
        moreVisible: PLAN_MORE_PAGE_SIZE
      };
    }
    if (ctx().plan.moreVisible == null) ctx().plan.moreVisible = PLAN_MORE_PAGE_SIZE;
    if (ctx().plan.demandText == null) ctx().plan.demandText = '';
    if (ctx().plan.awaitingDemand == null) ctx().plan.awaitingDemand = false;
    return c;
  }

  function resetPlanMoreVisible(plan) {
    resetPickMoreVisible(plan);
  }

  function getLastPlanPickCard() {
    const cards = document.querySelectorAll('[data-spec-id="card-plan-pick"]');
    return cards.length ? cards[cards.length - 1] : null;
  }

  function planDemandForMatch() {
    const plan = ctx().plan;
    return plan && plan.demandText ? plan.demandText : '';
  }

  function resetPlanPickSelections(plan) {
    if (!plan) return;
    plan.selected = {};
    plan.sku = {};
    plan.qty = {};
    plan.filter = '';
    resetPlanMoreVisible(plan);
  }

  function renderDemandSummaryHtml(c, demandText, editAction) {
    if (!(demandText && demandText.trim())) return '';
    const isNew = c && DemoData.isNewCustomer(c);
    const editLabel = isNew ? '修改需求' : '调整需求';
    return (
      '<div class="sc-plan-demand-summary">' +
      '<p class="sc-card__meta">当前需求：<strong>' +
      App.escapeHtml(demandText.trim()) +
      '</strong></p>' +
      '<button type="button" class="sc-btn sc-btn--ghost" data-action="' +
      editAction +
      '">' +
      editLabel +
      '</button></div>'
    );
  }

  function renderPlanDemandSummaryHtml(c) {
    const plan = ctx().plan;
    return plan ? renderDemandSummaryHtml(c, plan.demandText, 'plan-edit-demand') : '';
  }

  function renderQuoteDemandSummaryHtml(c) {
    const d = ctx().quoteDraft;
    return d ? renderDemandSummaryHtml(c, d.demandText, 'quote-edit-demand') : '';
  }

  function pickQueryCfg(scope) {
    if (scope === 'plan') {
      return {
        inputId: 'plan-pick-query-input',
        applyAction: 'plan-pick-query-apply',
        getDraft: function () {
          return ctx().plan;
        },
        refresh: refreshLastPlanPickCard,
        resetSelections: resetPlanPickSelections
      };
    }
    if (scope === 'quote') {
      return {
        inputId: 'quote-pick-query-input',
        applyAction: 'quote-pick-query-apply',
        getDraft: function () {
          return ctx().quoteDraft;
        },
        refresh: refreshLastQuotePickCard,
        resetSelections: resetQuotePickSelections
      };
    }
    return {
      inputId: 'order-pick-query-input',
      applyAction: 'order-pick-query-apply',
      getDraft: function () {
        return ctx().orderDraft;
      },
      refresh: refreshLastOrderPickCard,
      resetSelections: resetOrderPickSelections
    };
  }

  function resetOrderPickSelections(draft) {
    if (!draft) return;
    draft.selected = {};
    draft.sku = {};
    draft.qty = {};
    draft.filter = '';
    resetPickMoreVisible(draft);
  }

  function pickQueryValue(draft) {
    if (!draft) return '';
    const d = String(draft.demandText || '').trim();
    if (d) return d;
    return String(draft.filter || '').trim();
  }

  function syncPickQueryToDraft(draft, text) {
    if (!draft) return;
    const t = String(text || '').trim();
    draft.demandText = t;
    draft.filter = t;
  }

  function syncPickQueryFromDom(scope) {
    const cfg = pickQueryCfg(scope);
    const inp = document.getElementById(cfg.inputId);
    const draft = cfg.getDraft();
    if (inp && draft) syncPickQueryToDraft(draft, inp.value);
  }

  function renderPickQueryRow(scope) {
    const cfg = pickQueryCfg(scope);
    const draft = cfg.getDraft();
    const val = pickQueryValue(draft);
    return (
      '<div class="sc-plan-query-row">' +
      '<input type="search" class="sc-input sc-input--field" id="' +
      cfg.inputId +
      '" placeholder="描述需求或筛选品名/规格" value="' +
      App.escapeHtml(val) +
      '"/>' +
      '<button type="button" class="sc-btn sc-btn--ghost" data-action="' +
      cfg.applyAction +
      '">应用</button></div>'
    );
  }

  function validatePickQueryText(text) {
    const t = (text || '').trim();
    if (!t) return { ok: false, reason: 'empty' };
    if (isPlainSkillPhrase(t) && !/需要|电机|轴承|齿轮|伺服|导轨|PLC|产线|自动化|各\s*\d+|\d+\s*台/.test(t)) {
      return { ok: false, reason: 'skill' };
    }
    return { ok: true, text: t };
  }

  /** 交期自选商品：需求/筛选变更后推送新选品卡（旧卡按钮失效） */
  function pushDeliveryLinesPickCard(text, opts) {
    opts = opts || {};
    const d = ctx().orderDraft;
    if (!d || !d.customerId) return;
    const label = String(text || '').trim();
    const lead =
      '<p class="sc-reply-lead">' +
      (label
        ? '已应用「' + App.escapeHtml(label) + '」：请在新选品卡中勾选产品。'
        : '已清空需求/筛选，请在新选品卡中选品。') +
      '</p>' +
      renderOrderProductPickCardForDelivery();
    pushNextAiCard(lead, opts.simulateUserMsg ? label : null);
    scheduleOrderPickLazyBind();
    rescanAnnotationPins();
  }

  function applyPickQuery(scope, opts) {
    opts = opts || {};
    const cfg = pickQueryCfg(scope);
    const draft = cfg.getDraft();
    if (!draft || !draft.customerId) return false;
    const inp = document.getElementById(cfg.inputId);
    const text =
      opts.text != null ? String(opts.text).trim() : inp ? inp.value.trim() : pickQueryValue(draft);
    const c = App.getCustomer(draft.customerId);
    if (c && DemoData.isNewCustomer(c) && !text) {
      App.toast('新客户须先描述采购需求');
      return true;
    }
    if (text) {
      const v = validatePickQueryText(text);
      if (!v.ok) {
        if (v.reason === 'skill') {
          App.toast('请用一句话描述需要什么产品，例如：伺服电机和齿轮箱各2台');
        } else {
          App.toast('请输入需求或筛选关键词');
        }
        return true;
      }
    }
    const prev = pickQueryValue(draft);
    const changed = text !== prev;
    syncPickQueryToDraft(draft, text);
    if (changed && cfg.resetSelections) cfg.resetSelections(draft);
    resetPickMoreVisible(draft);
    if (inp) inp.value = text;
    if (changed && ctx().deliveryLinesMode && scope === 'order') {
      pushDeliveryLinesPickCard(text, { simulateUserMsg: opts.simulateUserMsg });
      return true;
    }
    cfg.refresh();
    if (opts.pushMeta !== false && changed) {
      const meta = text
        ? '<p class="sc-card__meta">已应用「' +
          App.escapeHtml(text) +
          '」：同步更新需求匹配与列表筛选。</p>'
        : '<p class="sc-card__meta">已清空需求/筛选。</p>';
      pushAiMeta(meta);
    }
    return true;
  }

  /** 从「修改需求 xxx」话术拆出正文；仅口令返回 ''；非修改话术返回 null */
  function parseDemandEditUtterance(text) {
    const t = (text || '').trim();
    if (!/^(?:修改需求|改需求|重新描述需求|变更需求|补充需求|调整需求)/.test(t)) return null;
    const m = t.match(
      /^(?:修改需求|改需求|重新描述需求|变更需求|补充需求|调整需求)\s*[：:,，]?\s*(.+)$/
    );
    if (m && m[1]) return m[1].trim();
    return '';
  }

  function parsePlanDemandEditUtterance(text) {
    return parseDemandEditUtterance(text);
  }

  function isPlanDemandSkipPhrase(text) {
    const t = (text || '').trim();
    return /^(?:跳过|先跳过|暂不填写|不填需求|不用填|跳过需求)(?:吧|了)?\s*$/i.test(t);
  }

  /** 老客户创建新方案：跳过需求录入，按最近订单进选品 */
  function skipPlanDemandToPick(opts) {
    opts = opts || {};
    const plan = ctx().plan;
    if (!plan || !plan.customerId) return false;
    const c = App.getCustomer(plan.customerId);
    if (!c) return false;
    if (!DemoData.isOldCustomer(c, DemoData.demoSalesUser)) {
      App.toast('新客户须先描述采购需求');
      return true;
    }
    plan.awaitingDemand = false;
    const lead =
      '<p class="sc-reply-lead">已跳过需求录入，为 <strong>' +
      App.escapeHtml(c.name) +
      '</strong> 按最近订单推荐选品。</p>' +
      renderProductPickCard();
    if (opts.simulateUserMsg) {
      pushNextAiCard(lead, '跳过');
    } else {
      App.pushAiHtml(lead);
    }
    schedulePlanPickLazyBind();
    if (window.Annotation && Annotation.scanHosts) window.Annotation.scanHosts();
    return true;
  }

  /** 修改/补充需求（选品卡内）；非创建首步 */
  function openPlanDemandEdit(opts) {
    opts = opts || {};
    const c = activeCustomer() || (opts.customerId && App.getCustomer(opts.customerId));
    if (!c) return;
    ensurePlan(c);
    const plan = ctx().plan;
    const isNew = DemoData.isNewCustomer(c);
    plan.awaitingDemand = isNew;
    enterSkill('plan');
    pushNextAiCard(
      renderPlanDemandPromptCard(c, { edit: !!opts.edit, optional: !isNew }),
      opts.simulateUserMsg ? (isNew ? '修改需求' : '补充需求') : null
    );
    if (window.Annotation && Annotation.scanHosts) window.Annotation.scanHosts();
  }

  function handlePlanDemandEditUtterance(text, opts) {
    opts = opts || {};
    const plan = ctx().plan;
    if (!plan || !plan.customerId) return false;
    const c = App.getCustomer(plan.customerId);
    if (!c) return false;
    const body = parsePlanDemandEditUtterance(text);
    if (body === null) return false;
    if (body.length >= 2) {
      if (isActiveFlowCard('card-plan-pick')) {
        return applyPickQuery('plan', { text: body, simulateUserMsg: false });
      }
      return submitPlanDemand(body, {
        revise: true,
        simulateUserMsg: false,
        forcePickCard: true
      });
    }
    openPlanDemandEdit({ simulateUserMsg: opts.simulateUserMsg });
    return true;
  }

  function quoteDemandForMatch() {
    const d = ctx().quoteDraft;
    return d && d.demandText ? d.demandText : '';
  }

  function resetQuotePickSelections(draft) {
    if (!draft) return;
    draft.selected = {};
    draft.sku = {};
    draft.qty = {};
    draft.filter = '';
    resetPickMoreVisible(draft);
  }

  function resetPickMoreVisible(draft) {
    if (draft) draft.moreVisible = PLAN_MORE_PAGE_SIZE;
  }

  function initialQuoteDemandText(c) {
    const plan = ctx().plan;
    if (plan && plan.customerId === c.id && plan.demandText && plan.demandText.trim()) {
      return plan.demandText.trim();
    }
    return '';
  }

  function initialOrderDemandText(c) {
    const q = ctx().quoteDraft;
    if (q && q.customerId === c.id && q.demandText && q.demandText.trim()) {
      return q.demandText.trim();
    }
    const plan = ctx().plan;
    if (plan && plan.customerId === c.id && plan.demandText && plan.demandText.trim()) {
      return plan.demandText.trim();
    }
    return '';
  }

  function resetQuoteDraftForCreate(c) {
    ctx().quoteDraft = {
      customerId: c.id,
      filter: '',
      demandText: initialQuoteDemandText(c),
      awaitingDemand: false,
      selected: {},
      sku: {},
      qty: {},
      quotePrice: {},
      saveAsScheme: false,
      moreVisible: PLAN_MORE_PAGE_SIZE
    };
  }

  function submitQuoteDemand(text, opts) {
    opts = opts || {};
    const draft = ctx().quoteDraft;
    if (!draft || !draft.customerId) return false;
    const t = (text || '').trim();
    if (!t) {
      App.toast('请在输入框或对话中描述采购需求');
      return true;
    }
    if (isPlainSkillPhrase(t) && !/需要|电机|轴承|齿轮|伺服|导轨|PLC|产线|自动化|各\s*\d+|\d+\s*台/.test(t)) {
      App.toast('请用一句话描述需要什么产品，例如：伺服电机和齿轮箱各2台');
      return true;
    }
    const c = App.getCustomer(draft.customerId);
    const hadDemand = !!(draft.demandText && draft.demandText.trim());
    const revise = !!(opts.revise || hadDemand);
    draft.demandText = t;
    draft.awaitingDemand = false;
    if (revise) resetQuotePickSelections(draft);
    draft.filter = t;
    const lead =
      '<p class="sc-reply-lead">' +
      (revise ? '已更新需求，为 ' : '已记录需求，为 ') +
      '<strong>' +
      App.escapeHtml(c.name) +
      '</strong> ' +
      (revise ? '重新匹配推荐商品' : '匹配推荐商品') +
      '，请在选品报价卡中勾选产品。</p>' +
      renderQuotePickCard();
    if (opts.forcePickCard || revise || opts.simulateUserMsg) {
      pushNextAiCard(lead, opts.simulateUserMsg ? t : revise && !opts.simulateUserMsg ? t : null);
    } else {
      App.pushAiHtml(lead);
    }
    scheduleQuotePickLazyBind();
    if (window.Annotation && Annotation.scanHosts) window.Annotation.scanHosts();
    return true;
  }

  function submitDeliveryDemand(text, opts) {
    opts = opts || {};
    const draft = ctx().orderDraft;
    if (!draft || !draft.customerId) return false;
    const t = (text || '').trim();
    if (!t) {
      App.toast('请在输入框或对话中描述采购需求');
      return true;
    }
    if (isPlainSkillPhrase(t) && !/需要|电机|轴承|齿轮|伺服|导轨|PLC|产线|自动化|各\s*\d+|\d+\s*台/.test(t)) {
      App.toast('请用一句话描述需要什么产品，例如：伺服电机和齿轮箱各2台');
      return true;
    }
    const c = App.getCustomer(draft.customerId);
    const hadDemand = !!(draft.demandText && draft.demandText.trim());
    const revise = !!(opts.revise || hadDemand);
    draft.demandText = t;
    draft.awaitingDemand = false;
    if (revise) resetOrderPickSelections(draft);
    draft.filter = t;
    const lead =
      '<p class="sc-reply-lead">' +
      (revise ? '已更新需求，为 ' : '已记录需求，为 ') +
      '<strong>' +
      App.escapeHtml(c.name) +
      '</strong> ' +
      (revise ? '重新匹配推荐商品' : '匹配推荐商品') +
      '，请在选品卡中勾选产品。</p>' +
      renderOrderProductPickCardForDelivery();
    if (opts.forcePickCard || revise || opts.simulateUserMsg) {
      pushNextAiCard(lead, opts.simulateUserMsg ? t : revise && !opts.simulateUserMsg ? t : null);
    } else {
      App.pushAiHtml(lead);
    }
    scheduleOrderPickLazyBind();
    rescanAnnotationPins();
    return true;
  }

  /** 老客户交期自选：跳过需求录入，按最近订单进选品 */
  function skipDeliveryDemandToPick(opts) {
    opts = opts || {};
    const draft = ctx().orderDraft;
    if (!draft || !draft.customerId) return false;
    const c = App.getCustomer(draft.customerId);
    if (!c) return false;
    if (!DemoData.isOldCustomer(c, DemoData.demoSalesUser)) {
      App.toast('新客户须先描述采购需求');
      return true;
    }
    draft.awaitingDemand = false;
    const lead =
      '<p class="sc-reply-lead">已跳过需求录入，为 <strong>' +
      App.escapeHtml(c.name) +
      '</strong> 按最近订单推荐选品。</p>' +
      renderOrderProductPickCardForDelivery();
    if (opts.simulateUserMsg) {
      pushNextAiCard(lead, '跳过');
    } else {
      App.pushAiHtml(lead);
    }
    scheduleOrderPickLazyBind();
    rescanAnnotationPins();
    return true;
  }

  /** 交期自选商品：新客户须先录入需求；已录入则返回 false，由调用方出选品卡 */
  function maybeDeliveryDemandBeforePick(c, opts) {
    opts = opts || {};
    const draft = ensureOrderDraft(c);
    if (!draft) return false;
    if (draft.demandText && draft.demandText.trim()) {
      draft.awaitingDemand = false;
      return false;
    }
    const lastUser = getLatestUserChatText();
    if (
      lastUser &&
      isNaturalDemandText(lastUser) &&
      !isPlainSkillPhrase(lastUser) &&
      !isPlanDemandSkipPhrase(lastUser)
    ) {
      if (submitDeliveryDemand(lastUser, { revise: false })) return true;
    }
    draft.awaitingDemand = true;
    if (opts.leadHtml) App.pushAiHtml(opts.leadHtml);
    const isOld = DemoData.isOldCustomer(c, DemoData.demoSalesUser);
    App.pushAiHtml(renderDeliveryDemandPromptCard(c, { allowSkip: isOld }));
    rescanAnnotationPins();
    return true;
  }

  function openDeliveryDemandEdit(opts) {
    opts = opts || {};
    const c = activeCustomer() || (opts.customerId && App.getCustomer(opts.customerId));
    if (!c) return;
    ensureOrderDraft(c);
    const draft = ctx().orderDraft;
    const isNew = DemoData.isNewCustomer(c);
    draft.awaitingDemand = isNew;
    enterSkill('delivery');
    ctx().deliveryLinesMode = true;
    pushNextAiCard(
      renderDeliveryDemandPromptCard(c, { edit: !!opts.edit, optional: !isNew }),
      opts.simulateUserMsg ? (isNew ? '修改需求' : '补充需求') : null
    );
    rescanAnnotationPins();
  }

  /** 跳过需求录入，按最近订单进选品 */
  function skipQuoteDemandToPick(opts) {
    opts = opts || {};
    const draft = ctx().quoteDraft;
    if (!draft || !draft.customerId) return false;
    const c = App.getCustomer(draft.customerId);
    if (!c) return false;
    if (!DemoData.isOldCustomer(c, DemoData.demoSalesUser)) {
      App.toast('新客户须先描述采购需求');
      return true;
    }
    draft.awaitingDemand = false;
    const lead =
      '<p class="sc-reply-lead">已跳过需求录入，为 <strong>' +
      App.escapeHtml(c.name) +
      '</strong> 按最近订单推荐选品。</p>' +
      renderQuotePickCard();
    if (opts.simulateUserMsg) {
      pushNextAiCard(lead, '跳过');
    } else {
      App.pushAiHtml(lead);
    }
    scheduleQuotePickLazyBind();
    if (window.Annotation && Annotation.scanHosts) window.Annotation.scanHosts();
    return true;
  }

  /** 修改/补充需求（选品报价卡内） */
  function openQuoteDemandEdit(opts) {
    opts = opts || {};
    const c = activeCustomer() || (opts.customerId && App.getCustomer(opts.customerId));
    if (!c) return;
    ensureQuoteDraft(c);
    const draft = ctx().quoteDraft;
    const isNew = DemoData.isNewCustomer(c);
    draft.awaitingDemand = isNew;
    enterSkill('quote');
    pushNextAiCard(
      renderQuoteDemandPromptCard(c, { edit: !!opts.edit, optional: !isNew }),
      opts.simulateUserMsg ? (isNew ? '修改需求' : '补充需求') : null
    );
    if (window.Annotation && Annotation.scanHosts) window.Annotation.scanHosts();
  }

  function handleQuoteDemandEditUtterance(text, opts) {
    opts = opts || {};
    const draft = ctx().quoteDraft;
    if (!draft || !draft.customerId) return false;
    const c = App.getCustomer(draft.customerId);
    if (!c) return false;
    const body = parseDemandEditUtterance(text);
    if (body === null) return false;
    if (body.length >= 2) {
      if (isActiveFlowCard('card-order-pick') || (ctx().deliveryLinesMode && isActiveFlowCard('card-delivery-demand'))) {
        if (ctx().deliveryLinesMode) {
          if (isActiveFlowCard('card-delivery-demand')) {
            return submitDeliveryDemand(body, {
              revise: true,
              simulateUserMsg: opts.simulateUserMsg,
              forcePickCard: true
            });
          }
          return applyPickQuery('order', { text: body, simulateUserMsg: opts.simulateUserMsg });
        }
        return applyPickQuery('order', { text: body, simulateUserMsg: false });
      }
      if (isActiveFlowCard('card-quote-pick')) {
        return applyPickQuery('quote', { text: body, simulateUserMsg: false });
      }
      return submitQuoteDemand(body, {
        revise: true,
        simulateUserMsg: false,
        forcePickCard: true
      });
    }
    if (ctx().deliveryLinesMode) {
      openDeliveryDemandEdit({ simulateUserMsg: opts.simulateUserMsg, edit: body.length >= 2 });
    } else {
      openQuoteDemandEdit({ simulateUserMsg: opts.simulateUserMsg });
    }
    return true;
  }

  /**
   * 新客户直选报价/下单选品前须录入需求；已录入则返回 false，由调用方出选品卡。
   * @returns {boolean} true 表示已展示需求卡或已提交需求，不再继续
   */
  function maybeQuoteDemandBeforePick(c, opts) {
    opts = opts || {};
    const draft = ensureQuoteDraft(c);
    if (!draft) return false;
    if (draft.demandText && draft.demandText.trim()) {
      draft.awaitingDemand = false;
      return false;
    }
    const lastUser = getLatestUserChatText();
    if (
      lastUser &&
      isNaturalDemandText(lastUser) &&
      !isPlainSkillPhrase(lastUser) &&
      !isPlanDemandSkipPhrase(lastUser)
    ) {
      if (submitQuoteDemand(lastUser, { revise: false })) return true;
    }
    draft.awaitingDemand = true;
    if (opts.leadHtml) App.pushAiHtml(opts.leadHtml);
    const isOld = DemoData.isOldCustomer(c, DemoData.demoSalesUser);
    App.pushAiHtml(renderQuoteDemandPromptCard(c, { allowSkip: isOld }));
    rescanAnnotationPins();
    return true;
  }

  function pickMoreProductList(draft, recIds, demandText) {
    const c = App.getCustomer(draft.customerId);
    return DemoData.planMoreProducts(c, recIds, pickQueryValue(draft), undefined, demandText);
  }

  function renderPickMoreSection(draft, recIds, demandText, renderRowFn) {
    const all = pickMoreProductList(draft, recIds, demandText);
    if (!all.length) return '';
    if (draft.moreVisible == null) draft.moreVisible = PLAN_MORE_PAGE_SIZE;
    const visible = Math.min(draft.moreVisible, all.length);
    const moreBadge = '<span class="sc-plan-rec-badge sc-plan-rec-badge--more">全部</span>';
    const rows = all
      .slice(0, visible)
      .map((p) => renderRowFn(p, moreBadge))
      .join('');
    const hasMore = visible < all.length;
    const footer = hasMore
      ? '<p class="sc-plan-more-status" data-plan-more-status>已显示 ' +
        visible +
        ' / ' +
        all.length +
        '，继续下滑加载（每页 ' +
        PLAN_MORE_PAGE_SIZE +
        ' 条）</p><div class="sc-plan-more-sentinel" data-plan-more-sentinel aria-hidden="true"></div>'
      : '<p class="sc-plan-more-status sc-plan-more-status--done" data-plan-more-status>已加载全部 ' +
        all.length +
        ' 条</p>';
    return (
      '<p class="sc-plan-section-label">更多产品</p><div class="sc-plan-more-list" data-plan-more-list>' +
      rows +
      '</div>' +
      footer
    );
  }

  function renderPlanMoreSection(plan, recIds) {
    return renderPickMoreSection(plan, recIds, planDemandForMatch(), planPickRow);
  }

  function updatePickMoreFooter(card, total, visible) {
    const status = card.querySelector('[data-plan-more-status]');
    const sentinel = card.querySelector('[data-plan-more-sentinel]');
    if (visible >= total) {
      if (status) {
        status.className = 'sc-plan-more-status sc-plan-more-status--done';
        status.textContent = '已加载全部 ' + total + ' 条';
      }
      if (sentinel) {
        if (pickMoreObserver) pickMoreObserver.unobserve(sentinel);
        sentinel.remove();
      }
    } else if (status) {
      status.textContent =
        '已显示 ' + visible + ' / ' + total + '，继续下滑加载（每页 ' + PLAN_MORE_PAGE_SIZE + ' 条）';
    }
  }

  function pickCardScopeConfig(scope) {
    if (scope === 'plan') {
      return {
        specId: 'card-plan-pick',
        getDraft: function () {
          return ctx().plan;
        },
        getDemand: planDemandForMatch,
        renderRow: planPickRow
      };
    }
    if (scope === 'quote') {
      return {
        specId: 'card-quote-pick',
        getDraft: function () {
          return ctx().quoteDraft;
        },
        getDemand: quoteDemandForMatch,
        renderRow: quotePickRow
      };
    }
    return {
      specId: 'card-order-pick',
      getDraft: function () {
        return ctx().orderDraft;
      },
      getDemand: orderDemandForMatch,
      renderRow: orderPickRow
    };
  }

  function appendMorePickProducts(card, scope) {
    const cfg = pickCardScopeConfig(scope);
    const draft = cfg.getDraft();
    if (!draft || !card) return false;
    const c = App.getCustomer(draft.customerId);
    if (!c) return false;
    const demand = cfg.getDemand();
    const recs = DemoData.recommendProducts(c, draft.filter, undefined, demand);
    const recIds = new Set(recs.map((r) => r.product.id));
    const all = pickMoreProductList(draft, recIds, demand);
    const prev = draft.moreVisible != null ? draft.moreVisible : PLAN_MORE_PAGE_SIZE;
    if (prev >= all.length) return false;
    const next = Math.min(prev + PLAN_MORE_PAGE_SIZE, all.length);
    const listEl = card.querySelector('[data-plan-more-list]');
    if (!listEl) return false;
    const moreBadge = '<span class="sc-plan-rec-badge sc-plan-rec-badge--more">全部</span>';
    const chunk = all
      .slice(prev, next)
      .map((p) => cfg.renderRow(p, moreBadge))
      .join('');
    listEl.insertAdjacentHTML('beforeend', chunk);
    draft.moreVisible = next;
    updatePickMoreFooter(card, all.length, next);
    return true;
  }

  function appendMorePlanProducts(card) {
    return appendMorePickProducts(card, 'plan');
  }

  function getLastPickCard(specId) {
    const cards = document.querySelectorAll('[data-spec-id="' + specId + '"]');
    return cards.length ? cards[cards.length - 1] : null;
  }

  function bindPickLazyLoad(card, scope) {
    if (pickMoreObserver) {
      pickMoreObserver.disconnect();
      pickMoreObserver = null;
    }
    if (!card) return;
    const scrollRoot = card.querySelector('.sc-plan-pick-list');
    const sentinel = card.querySelector('[data-plan-more-sentinel]');
    if (!scrollRoot || !sentinel) return;
    pickMoreObserver = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) appendMorePickProducts(card, scope);
      },
      { root: scrollRoot, rootMargin: '56px 0px', threshold: 0 }
    );
    pickMoreObserver.observe(sentinel);
  }

  function bindPlanPickLazyLoad(card) {
    bindPickLazyLoad(card, 'plan');
  }

  function schedulePickLazyBind(scope) {
    const cfg = pickCardScopeConfig(scope);
    setTimeout(function () {
      bindPickLazyLoad(getLastPickCard(cfg.specId), scope);
    }, 0);
  }

  function schedulePlanPickLazyBind() {
    schedulePickLazyBind('plan');
  }

  function scheduleQuotePickLazyBind() {
    schedulePickLazyBind('quote');
  }

  function scheduleOrderPickLazyBind() {
    schedulePickLazyBind('order');
  }

  function syncPlanFilterFromDom() {
    syncPickQueryFromDom('plan');
  }

  function syncPlanQtyFromDom() {
    document.querySelectorAll('[data-action="plan-qty"]').forEach((inp) => {
      const id = inp.getAttribute('data-pid');
      if (id) ctx().plan.qty[id] = parseInt(inp.value, 10) || 1;
    });
  }

  function syncPlanSkuFromDom() {
    document.querySelectorAll('[data-action="plan-sku"]').forEach((sel) => {
      const id = sel.getAttribute('data-pid');
      if (id && ctx().plan) ctx().plan.sku[id] = sel.value;
    });
  }

  function planSelectedIds() {
    return Object.keys(ctx().plan.selected || {}).filter((k) => ctx().plan.selected[k]);
  }

  function ensurePlanSku(pid, product) {
    const plan = ctx().plan;
    if (!plan.sku) plan.sku = {};
    ensurePickCustomAttrs(plan, pid, product);
  }

  function renderSkuSelect(product, pid) {
    ensurePlanSku(pid, product);
    const cur = ctx().plan.sku[pid];
    const opts = (product.skus || [])
      .map(
        (s) =>
          '<option value="' +
          s.id +
          '"' +
          (s.id === cur ? ' selected' : '') +
          '>' +
          App.escapeHtml(s.label) +
          '</option>'
      )
      .join('');
    return (
      '<label class="sc-plan-sku-label">规格 <select class="sc-plan-sku-select" data-action="plan-sku" data-pid="' +
      pid +
      '" onclick="event.stopPropagation()">' +
      opts +
      '</select></label>'
    );
  }

  function renderPlanQtyInput(pid) {
    const plan = ctx().plan;
    if (!plan.qty) plan.qty = {};
    const qty = plan.qty[pid] || 1;
    return (
      '<label class="sc-plan-qty-label sc-qty-inline">数量 <input type="number" min="1" step="1" value="' +
      qty +
      '" data-action="plan-qty" data-pid="' +
      pid +
      '" class="sc-qty-input" onclick="event.stopPropagation()"/></label>'
    );
  }

  function renderQuoteQtyInput(pid) {
    const d = ctx().quoteDraft;
    if (!d) return '';
    if (!d.qty) d.qty = {};
    const qty = d.qty[pid] || 1;
    return (
      '<label class="sc-plan-qty-label sc-qty-inline">数量 <input type="number" min="1" step="1" value="' +
      qty +
      '" data-action="quote-qty" data-pid="' +
      pid +
      '" class="sc-qty-input" onclick="event.stopPropagation()"/></label>'
    );
  }

  function renderOrderQtyInput(pid) {
    const d = ctx().orderDraft;
    if (!d) return '';
    if (!d.qty) d.qty = {};
    const qty = d.qty[pid] || 1;
    return (
      '<label class="sc-plan-qty-label sc-qty-inline">数量 <input type="number" min="1" step="1" value="' +
      qty +
      '" data-action="order-qty" data-pid="' +
      pid +
      '" class="sc-qty-input" onclick="event.stopPropagation()"/></label>'
    );
  }

  function pickRowTagsHtml(tagHtml) {
    return tagHtml ? '<span class="sc-follow-row__meta">' + tagHtml + '</span>' : '';
  }

  /** 方案选品行：品名 + 规格/数量同一行；规格下拉始终可改 */
  function planPickRow(product, tagHtml) {
    const plan = ctx().plan;
    const pid = product.id;
    ensurePlanSku(pid, product);
    if (!plan.qty) plan.qty = {};
    if (!plan.qty[pid]) plan.qty[pid] = 1;
    const on = plan.selected && plan.selected[pid];
    return (
      '<div class="sc-plan-pick-row' +
      (on ? ' is-selected' : '') +
      '"><button type="button" class="sc-follow-row sc-follow-row--select' +
      (on ? ' is-selected' : '') +
      '" data-action="plan-toggle" data-pid="' +
      pid +
      '"><span class="sc-follow-row__name">' +
      App.escapeHtml(product.name) +
      '</span>' +
      pickRowTagsHtml(tagHtml) +
      '</button><div class="sc-plan-sku-row sc-plan-sku-row--inline sc-plan-sku-row--free">' +
      renderPickSpecBlock(product, pid, 'plan') +
      renderPlanQtyInput(pid) +
      '</div></div>'
    );
  }

  function ensureQuoteSku(pid, product) {
    const d = ctx().quoteDraft;
    if (!d) return;
    if (!d.sku) d.sku = {};
    ensurePickCustomAttrs(d, pid, product);
  }

  /** 报价/下单选品行：规格 + 数量同一行；规格下拉始终可改 */
  function quotePickRow(product, tagHtml) {
    const d = ctx().quoteDraft;
    const pid = product.id;
    ensureQuoteSku(pid, product);
    if (!d.qty) d.qty = {};
    if (!d.qty[pid]) d.qty[pid] = 1;
    const on = d.selected && d.selected[pid];
    return (
      '<div class="sc-plan-pick-row' +
      (on ? ' is-selected' : '') +
      '"><button type="button" class="sc-follow-row sc-follow-row--select' +
      (on ? ' is-selected' : '') +
      '" data-action="quote-toggle" data-pid="' +
      pid +
      '"><span class="sc-follow-row__name">' +
      App.escapeHtml(product.name) +
      '</span>' +
      pickRowTagsHtml(tagHtml) +
      '</button><div class="sc-plan-sku-row sc-plan-sku-row--inline sc-plan-sku-row--free">' +
      renderPickSpecBlock(product, pid, 'quote') +
      '</div></div>'
    );
  }

  function ensureOrderSku(pid, product) {
    const d = ctx().orderDraft;
    if (!d) return;
    if (!d.sku) d.sku = {};
    ensurePickCustomAttrs(d, pid, product);
  }

  function orderDemandForMatch() {
    const d = ctx().orderDraft;
    if (!d) return '';
    if (d.demandText && d.demandText.trim()) return d.demandText.trim();
    const q = ctx().quoteDraft;
    if (q && q.customerId === d.customerId && q.demandText && q.demandText.trim()) {
      return q.demandText.trim();
    }
    const plan = ctx().plan;
    if (plan && plan.customerId === d.customerId && plan.demandText && plan.demandText.trim()) {
      return plan.demandText.trim();
    }
    return '';
  }

  /** 订单选品行：规格 + 数量同一行 */
  function orderPickRow(product, tagHtml) {
    const d = ctx().orderDraft;
    const pid = product.id;
    ensureOrderSku(pid, product);
    if (!d.qty) d.qty = {};
    if (!d.qty[pid]) d.qty[pid] = 1;
    const on = d.selected && d.selected[pid];
    return (
      '<div class="sc-plan-pick-row' +
      (on ? ' is-selected' : '') +
      '"><button type="button" class="sc-follow-row sc-follow-row--select' +
      (on ? ' is-selected' : '') +
      '" data-action="order-toggle" data-pid="' +
      pid +
      '"><span class="sc-follow-row__name">' +
      App.escapeHtml(product.name) +
      '</span>' +
      pickRowTagsHtml(tagHtml) +
      '</button><div class="sc-plan-sku-row sc-plan-sku-row--inline sc-plan-sku-row--free">' +
      renderPickSpecBlock(product, pid, 'order') +
      '</div></div>'
    );
  }

  function recommendRecTagHtml(r) {
    return r.score != null
      ? '<span class="sc-plan-rec-badge">匹配 ' + Math.round(r.score * 100) + '%</span>'
      : '<span class="sc-plan-rec-badge sc-plan-rec-badge--order">' + r.tag + '</span>';
  }

  function pickCardEmptyHint(c) {
    return DemoData.isNewCustomer(c)
      ? '<p class="sc-card__meta">暂无匹配推荐，请调整上方需求/筛选关键词。</p>'
      : '<p class="sc-card__meta">暂无推荐，请调整需求/筛选或查看下方全部产品。</p>';
  }

  function recommendLeadHtml(c, demandText) {
    const demand = (demandText || '').trim();
    if (DemoData.isNewCustomer(c) && !demand) {
      return '<p class="sc-card__meta sc-plan-rec-hint sc-plan-rec-hint--warn">请先在上一步发送采购需求，再展示推荐商品</p>';
    }
    return '<p class="sc-card__meta sc-plan-rec-hint"></p>';
  }

  /** 从对话区最近一条用户消息气泡取文案（无表单输入时用） */
  function getLatestUserChatText() {
    const msgs = document.querySelectorAll('#messages .sc-msg--user .sc-bubble--user');
    if (!msgs.length) return '';
    return (msgs[msgs.length - 1].textContent || '').trim();
  }

  /** 需求提示卡：创建新方案时新老客户均先录入；老客户可跳过 */
  function demandDraftTextForSpec(specId) {
    if (specId === 'card-quote-demand') {
      const d = ctx().quoteDraft;
      return d && d.demandText ? String(d.demandText).trim() : '';
    }
    if (specId === 'card-delivery-demand') {
      const d = ctx().orderDraft;
      return d && d.demandText ? String(d.demandText).trim() : '';
    }
    if (specId === 'card-copy-demand') {
      const s = ctx().copyPick;
      return s && s.demandText ? String(s.demandText).trim() : '';
    }
    if (specId === 'card-progress-demand') {
      const s = ctx().progressPick;
      return s && s.demandText ? String(s.demandText).trim() : '';
    }
    const plan = ctx().plan;
    return plan && plan.demandText ? String(plan.demandText).trim() : '';
  }

  function readDemandTextFromCardEl(cardEl) {
    if (!cardEl) return '';
    const ta = cardEl.querySelector('[data-field="demand-text"]');
    return ta ? String(ta.value || '').trim() : '';
  }

  function demandSubmitActionForSpec(specId) {
    if (specId === 'card-quote-demand') return 'quote-demand-submit';
    if (specId === 'card-delivery-demand') return 'delivery-demand-submit';
    if (specId === 'card-copy-demand') return 'copy-demand-submit';
    if (specId === 'card-progress-demand') return 'progress-demand-submit';
    return 'plan-demand-submit';
  }

  function demandSkipActionForSpec(specId) {
    if (specId === 'card-quote-demand') return 'quote-skip-demand';
    if (specId === 'card-delivery-demand') return 'delivery-skip-demand';
    if (specId === 'card-copy-demand') return 'copy-skip-demand';
    if (specId === 'card-progress-demand') return 'progress-skip-demand';
    return 'plan-skip-demand';
  }

  function demandPlaceholderForSpec(specId) {
    if (specId === 'card-copy-demand') return '例：SO2024-0315 / 传动齿轮箱 / 红色';
    return '例：伺服电机和传动齿轮箱各 2 台';
  }

  function demandVoiceHintForSpec(specId) {
    if (specId === 'card-copy-demand' || specId === 'card-progress-demand') {
      return '也可在底部输入区发送筛选条件（与点确认二选一）';
    }
    return '也可在底部输入区发送需求（与点确认二选一）';
  }

  function demandConfirmLabelForSpec(specId, opts) {
    opts = opts || {};
    if (opts.isEdit) {
      return opts.optional ? '确认调整' : '确认修改';
    }
    if (specId === 'card-copy-demand') return '确认筛选';
    return '确认需求';
  }

  function renderDemandInputBlock(specId, opts) {
    opts = opts || {};
    const submitAction = demandSubmitActionForSpec(specId);
    const confirmLabel = demandConfirmLabelForSpec(specId, opts);
    const initial = App.escapeHtml(demandDraftTextForSpec(specId));
    return (
      '<textarea class="sc-textarea sc-plan-demand-input" data-field="demand-text" rows="3" placeholder="' +
      App.escapeHtml(demandPlaceholderForSpec(specId)) +
      '">' +
      initial +
      '</textarea>' +
      '<div class="sc-card__actions-inline">' +
      '<button type="button" class="sc-btn sc-btn--primary" data-action="' +
      submitAction +
      '">' +
      confirmLabel +
      '</button></div>' +
      '<p class="sc-plan-voice-hint">' +
      demandVoiceHintForSpec(specId) +
      '</p>'
    );
  }

  function renderDemandPromptCard(c, opts) {
    opts = opts || {};
    const specId = opts.specId || 'card-plan-demand';
    const isEdit = !!opts.edit;
    const optional = !!opts.optional;
    const allowSkip = !!opts.allowSkip && !isEdit;
    if (isEdit) {
      let editHead = opts.headTitle;
      let editMeta = opts.promptMeta;
      if (!editHead) {
        if (specId === 'card-copy-demand') editHead = '修改筛选条件';
        else if (specId === 'card-progress-demand') editHead = '修改查询筛选需求';
        else editHead = optional ? '调整采购需求' : '修改采购需求';
      }
      if (!editMeta) {
        if (specId === 'card-copy-demand') {
          editMeta = '修改后将按订单编号、货品名称或自由项重新筛选历史订单。';
        } else if (specId === 'card-progress-demand') {
          editMeta = '修改后将重新筛选历史订单列表。';
        } else {
          editMeta = '发送后重新匹配推荐区，已勾选产品将清空。';
        }
      }
      return (
        '<div class="sc-card sc-card--compact" data-spec-id="' +
        specId +
        '">' +
        '<div class="sc-card__head sc-card__head--compact">' +
        editHead +
        '</div>' +
        '<p class="sc-card__meta">' +
        editMeta +
        '</p>' +
        renderDemandInputBlock(specId, { isEdit: true, optional: optional }) +
        '</div>'
      );
    }
    const skipAction = demandSkipActionForSpec(specId);
    const skipLabel =
      opts.skipLabel ||
      (specId === 'card-copy-demand' || specId === 'card-progress-demand'
        ? '跳过，展示全部历史订单'
        : '跳过，按最近订单推荐');
    const skipActions = allowSkip
      ? '<div class="sc-card__actions-inline">' +
        '<button type="button" class="sc-btn sc-btn--ghost" data-action="' +
        skipAction +
        '">' +
        skipLabel +
        '</button></div>'
      : '';
    const headTitle =
      opts.headTitle ||
      (allowSkip ? '请描述采购需求（可跳过）' : '请描述您的采购需求');
    const promptMeta =
      opts.promptMeta ||
      (allowSkip
        ? '填写后点「确认需求」；也可跳过，直接按最近订单产品推荐（最多十条）。'
        : '须先描述需求，再展示推荐商品。');
    return (
      '<div class="sc-card sc-card--compact" data-spec-id="' +
      specId +
      '">' +
      '<div class="sc-card__head sc-card__head--compact">' +
      headTitle +
      '</div>' +
      '<p class="sc-card__meta">' +
      promptMeta +
      '</p>' +
      renderDemandInputBlock(specId, { isEdit: false }) +
      skipActions +
      '</div>'
    );
  }

  function renderPlanDemandPromptCard(c, opts) {
    opts = opts || {};
    opts.specId = 'card-plan-demand';
    return renderDemandPromptCard(c, opts);
  }

  function renderQuoteDemandPromptCard(c, opts) {
    opts = opts || {};
    opts.specId = 'card-quote-demand';
    return renderDemandPromptCard(c, opts);
  }

  function renderDeliveryDemandPromptCard(c, opts) {
    opts = opts || {};
    opts.specId = 'card-delivery-demand';
    return renderDemandPromptCard(c, opts);
  }

  function submitPlanDemand(text, opts) {
    opts = opts || {};
    const plan = ctx().plan;
    if (!plan || !plan.customerId) return false;
    const t = (text || '').trim();
    if (!t) {
      App.toast('请在输入框或对话中描述采购需求');
      return true;
    }
    if (isPlainSkillPhrase(t) && !/需要|电机|轴承|齿轮|伺服|导轨|PLC|产线|自动化|各\s*\d+|\d+\s*台/.test(t)) {
      App.toast('请用一句话描述需要什么产品，例如：伺服电机和齿轮箱各2台');
      return true;
    }
    const c = App.getCustomer(plan.customerId);
    const hadDemand = !!(plan.demandText && plan.demandText.trim());
    const revise = !!(opts.revise || hadDemand);
    plan.demandText = t;
    plan.awaitingDemand = false;
    if (revise) resetPlanPickSelections(plan);
    plan.filter = t;
    const lead =
      '<p class="sc-reply-lead">' +
      (revise ? '已更新需求，为 ' : '已记录需求，为 ') +
      '<strong>' +
      App.escapeHtml(c.name) +
      '</strong> ' +
      (revise ? '重新匹配推荐商品' : '匹配推荐商品') +
      '，请在选品卡中勾选产品。</p>' +
      renderProductPickCard();
    if (opts.forcePickCard || revise || opts.simulateUserMsg) {
      pushNextAiCard(lead, opts.simulateUserMsg ? t : revise && !opts.simulateUserMsg ? t : null);
    } else {
      App.pushAiHtml(lead);
    }
    schedulePlanPickLazyBind();
    if (window.Annotation && Annotation.scanHosts) window.Annotation.scanHosts();
    return true;
  }

  function renderProductPickCard() {
    const plan = ctx().plan;
    const c = App.getCustomer(plan.customerId);
    const recs = DemoData.recommendProducts(c, pickQueryValue(plan), undefined, planDemandForMatch());
    const recIds = new Set(recs.map((r) => r.product.id));
    const recRows = recs
      .map((r) => {
        const meta =
          r.score != null
            ? '<span class="sc-plan-rec-badge">匹配 ' + Math.round(r.score * 100) + '%</span>'
            : '<span class="sc-plan-rec-badge sc-plan-rec-badge--order">' + r.tag + '</span>';
        return planPickRow(r.product, meta);
      })
      .join('');

    const moreSection = renderPlanMoreSection(plan, recIds);
    const isOld = DemoData.isOldCustomer(c, DemoData.demoSalesUser);
    const demandMatch = planDemandForMatch();
    const hasDemand = !!(demandMatch && demandMatch.trim());
    const addDemandBtn =
      isOld && !hasDemand
        ? '<button type="button" class="sc-btn sc-btn--ghost" data-action="plan-add-demand">录入用户需求</button>'
        : '';
    const emptyHint = pickCardEmptyHint(c);

    return (
      '<div class="sc-card sc-card--compact" data-spec-id="card-plan-pick"><div class="sc-card__head sc-card__head--compact">选品 · 改规格</div>' +
      recommendLeadHtml(c, planDemandForMatch()) +
      renderPickQueryRow('plan') +
      '<div class="sc-follow-list sc-plan-pick-list">' +
      (recRows || emptyHint) +
      moreSection +
      '</div><div class="sc-card__actions-inline">' +
      addDemandBtn +
      '<button type="button" class="sc-btn sc-btn--ghost-primary" data-action="plan-preview">预览方案</button></div></div>'
    );
  }

  function renderPlanCartCardFixed() {
    syncPlanQtyFromDom();
    const plan = ctx().plan;
    const items = planSelectedIds().map((pid) => ({ p: productById(pid), qty: plan.qty[pid] || 1 }));
    const rows = items
      .map((it) => {
        const pid = it.p.id;
        return (
          '<div class="sc-plan-cart-row"><span class="sc-follow-row__name">' +
          App.escapeHtml(it.p.name) +
          '</span>' +
          renderSkuSelect(it.p, pid) +
          '<label class="sc-qty-inline">数量 <input type="number" min="1" value="' +
          it.qty +
          '" data-action="plan-qty" data-pid="' +
          pid +
          '" class="sc-qty-input"/></label></div>'
        );
      })
      .join('');
    return (
      '<div class="sc-card sc-card--compact" data-spec-id="card-plan-preview"><div class="sc-card__head sc-card__head--compact">方案预览 · 改规格</div>' +
      '<div class="sc-follow-list">' +
      rows +
      '</div><div class="sc-card__actions-inline">' +
      '<button type="button" class="sc-btn sc-btn--ghost" data-action="plan-back-pick">返回选品</button>' +
      '<button type="button" class="sc-btn sc-btn--ghost-primary" data-action="plan-confirm">生成方案</button></div></div>'
    );
  }

  function beginPlanCreate(customer, opts) {
    opts = opts || {};
    const c = ensurePlan(customer);
    if (!c) return;
    setPlanSkillAtEntry(false);
    resetPlanDraftForCreate(c);
    const plan = ctx().plan;
    if (ctx().plan) ctx().plan.filter = '';
    enterSkill('plan');
    const hasDemand = !!(plan.demandText && plan.demandText.trim());
    if (!hasDemand) {
      const lastUser = getLatestUserChatText();
      if (
        lastUser &&
        isNaturalDemandText(lastUser) &&
        !isPlainSkillPhrase(lastUser) &&
        !isPlanDemandSkipPhrase(lastUser)
      ) {
        if (submitPlanDemand(lastUser, { revise: false })) {
          if (window.Annotation && Annotation.scanHosts) window.Annotation.scanHosts();
          return;
        }
      }
      plan.awaitingDemand = true;
      const isOld = DemoData.isOldCustomer(c, DemoData.demoSalesUser);
      App.pushAiHtml(
        '<p class="sc-reply-lead">为 <strong>' +
          App.escapeHtml(c.name) +
          '</strong> 创建新方案，请先描述采购需求。</p>' +
          renderPlanDemandPromptCard(c, { allowSkip: isOld })
      );
      if (window.Annotation && Annotation.scanHosts) window.Annotation.scanHosts();
      return;
    }
    plan.awaitingDemand = false;
    App.pushAiHtml(
      '<p class="sc-reply-lead">为 <strong>' + App.escapeHtml(c.name) + '</strong> 配方案。</p>' +
        renderProductPickCard()
    );
    schedulePlanPickLazyBind();
    rescanAnnotationPins();
  }

  /** 待跟进「做方案」等直达创建流程；技能条/欢迎区用 showPlanSkillEntry */
  function startPlan(customer) {
    beginPlanCreate(customer);
  }

  function isPlanTemplateOpen() {
    return isActiveFlowCard('sheet-plan-template');
  }

  function renderPlanTemplateListHtml() {
    return DemoData.planTemplates
      .map(function (t, i) {
        const n = i + 1;
        return (
          '<label class="sc-plan-tpl-option" data-pick-index="' +
          n +
          '"><input type="radio" name="plan-template" value="' +
          App.escapeHtml(t.id) +
            '"' +
            (ctx().plan.templateId === t.id ? ' checked' : '') +
            '/><span class="sc-plan-tpl-option__name">' +
          n +
          '. ' +
            App.escapeHtml(t.name) +
            '</span><span class="sc-plan-tpl-option__desc">' +
            App.escapeHtml(t.desc) +
            '</span></label>'
        );
      })
        .join('');
    }

  function selectPlanTemplateById(templateId) {
    const radio = document.querySelector(
      'input[name="plan-template"][value="' + CSS.escape(templateId) + '"]'
    );
    if (!radio) return false;
    radio.checked = true;
    ctx().plan.templateId = templateId;
    return true;
  }

  /** 方案模板抽屉打开时：语音/文字选序号或名称，可说「保存方案」提交 */
  function tryPlanTemplateUtterance(text) {
    if (!isPlanTemplateOpen()) return false;
    const t = (text || '').trim();
    if (!t) return false;
    const templates = DemoData.planTemplates || [];

    if (/保存|确认|生成方案/.test(t)) {
      submitPlanTemplate({ simulateUserMsg: false });
      return true;
    }

    const rowIdx = parsePickListIndex(t);
    if (rowIdx != null) {
      const tpl = templates[rowIdx - 1];
      if (!tpl) {
        App.toast('没有第 ' + rowIdx + ' 个模板，共 ' + templates.length + ' 项');
        return true;
      }
      selectPlanTemplateById(tpl.id);
      App.toast('已选第 ' + rowIdx + ' 项：' + tpl.name);
      return true;
    }

    const k = t.replace(/\s+/g, '').toLowerCase();
    if (k.length >= 2) {
      const hit = templates.find(function (tpl) {
        return (
          tpl.name.replace(/\s+/g, '').toLowerCase().indexOf(k) >= 0 ||
          tpl.id.toLowerCase().indexOf(k) >= 0
        );
      });
      if (hit) {
        selectPlanTemplateById(hit.id);
        App.toast('已选模板：' + hit.name);
        return true;
      }
    }

    App.toast('可说「第1个」、模板名称，或「保存方案」');
    return true;
  }

  function renderPlanTemplateCard() {
    return (
      '<div class="sc-card sc-card--compact sc-card--inline-form" data-spec-id="sheet-plan-template" data-spec-pin-root>' +
      '<div class="sc-card__head sc-card__head--compact">选择方案模板</div>' +
      '<div class="sc-plan-tpl-list">' +
      renderPlanTemplateListHtml() +
      '</div>' +
      '<div class="sc-card__actions-inline"><button type="button" class="sc-btn sc-btn--primary" data-action="plan-template-submit">保存方案</button></div>' +
      '</div>'
    );
  }

  function refreshLastPlanTemplateCard() {
    const cards = document.querySelectorAll('[data-spec-id="sheet-plan-template"]');
    const card = cards[cards.length - 1];
    if (card) card.outerHTML = renderPlanTemplateCard();
    rescanAnnotationPins();
  }

  function openPlanTemplateSheet() {
    syncPlanQtyFromDom();
    syncPlanSkuFromDom();
    if (!planSelectedIds().length) {
      App.toast('请先预览方案并确认选品');
      return;
    }
    const templates = DemoData.planTemplates || [];
    if (templates.length === 1) {
      confirmPlan(templates[0].id);
      return;
    }
    pushNextAiCard(renderPlanTemplateCard());
    rescanAnnotationPins();
  }

  /** 方案名称：客户名 + 产品（品名）+ 日期（yyyyMMdd），三部分直接拼接 */
  function buildSchemeDisplayName(customer, lines) {
    const cname = customer && customer.name ? String(customer.name).trim() : '客户';
    const names = (lines || [])
      .map(function (l) {
        return (l.name || l.inventoryName || '').trim();
      })
      .filter(Boolean);
    var productPart = '方案';
    if (names.length === 1) productPart = names[0];
    else if (names.length >= 2) productPart = names[0] + '等';
    const d = new Date();
    const datePart =
      '' +
      d.getFullYear() +
      String(d.getMonth() + 1).padStart(2, '0') +
      String(d.getDate()).padStart(2, '0');
    return cname + productPart + datePart;
  }

  function confirmPlan(templateId) {
    syncPlanQtyFromDom();
    syncPlanSkuFromDom();
    const tpl = DemoData.planTemplates.find((t) => t.id === templateId);
    if (!tpl) {
      App.toast('请选择方案模板');
      return;
    }
    const plan = ctx().plan;
    plan.templateId = templateId;
    const c = App.getCustomer(plan.customerId);
    const lines = planSelectedIds().map((pid) => {
      const p = productById(pid);
      const qty = plan.qty[pid] || 1;
      const skuId = plan.sku[pid] || DemoData.defaultSkuId(p);
      return {
        productId: pid,
        name: p.name,
        skuId,
        skuLabel: DemoData.skuLabel(p, skuId),
        qty,
        sub: p.unitPrice * qty
      };
    });
    const total = lines.reduce((s, l) => s + l.sub, 0);
    const schemeId = 'PL' + Date.now().toString().slice(-8);
    persistScheme({
      id: schemeId,
      customerId: c.id,
      templateId: tpl.id,
      templateName: buildSchemeDisplayName(c, lines),
      layoutTemplateName: tpl.name,
      lines,
      total,
      createdAt: new Date().toISOString().slice(0, 16).replace('T', ' ')
    });
    App.closeOverlays();
    const scheme = schemeForActiveCustomer(schemeId);
    pushSchemeCard(scheme, c, tpl);
  }

  function getActiveFormCard(specId) {
    const cards = document.querySelectorAll('[data-spec-id="' + specId + '"]');
    return cards.length ? cards[cards.length - 1] : null;
  }

  function submitPlanTemplate(opts) {
    opts = opts || {};
    const card = getActiveFormCard('sheet-plan-template');
    const picked = card
      ? card.querySelector('input[name="plan-template"]:checked')
      : document.querySelector('input[name="plan-template"]:checked');
    if (!picked) {
      App.toast('请选择方案模板');
      return;
    }
    if (opts.simulateUserMsg !== false) simulateUserUtterance('保存方案');
    confirmPlan(picked.value);
  }

  function findProductByKeyword(keyword) {
    if (!keyword) return null;
    const k = keyword.trim().toLowerCase();
    return (
      DemoData.products.find(
        (p) =>
          p.name.toLowerCase().indexOf(k) >= 0 ||
          p.spec.toLowerCase().indexOf(k) >= 0 ||
          (p.inventoryDesc && p.inventoryDesc.toLowerCase().indexOf(k) >= 0)
      ) || null
    );
  }

  function isPlainSkillPhrase(text) {
    const t = (text || '').trim();
    if (!t) return true;
    if (
      /^(配个方案|做方案|生成方案|保存方案|加购|去报价|报价|确认下单|生成订单|今日待跟进|帮助|切换客户|待跟进)$/.test(
        t
      )
    ) {
      return true;
    }
    if (/^(选品|筛选|过滤|逐项报价|下一步)\b/.test(t)) return true;
    return false;
  }

  function isOrderDemandText(text) {
    const t = (text || '').trim();
    return /下单|生成订单|确认下单/.test(t);
  }

  /** 进入报价流程的短口令（走分步：来源卡 / 逐项报价），不一句话直出报价单 */
  function isQuoteEntryPhrase(text) {
    const t = (text || '').trim();
    return /^(去报价|报价|产品报价|报个价|报一下价|出报价|按方案报价)(后|吧|啊|呀)?\s*$/.test(t);
  }

  /** 按方案报价入口（非长句）；避免被「方案」正则误判为方案速配 */
  function isSchemeQuoteEntryPhrase(text) {
    const t = (text || '').trim();
    if (!/^按方案\s*报价/.test(t)) return false;
    if (/给.+按方案\s*报价/.test(t)) return false;
    if (isNaturalDemandText(t)) return false;
    return true;
  }

  /** 当前客户是否已有本企业下保存的方案 */
  function customerHasSchemes(customer) {
    return customer && schemesForCustomer(customer.id).length > 0;
  }

  function renderNoSchemeForQuoteCard(c) {
    return (
      '<div class="sc-card sc-card--compact" data-spec-id="card-quote-source">' +
      '<div class="sc-card__head sc-card__head--compact">按方案报价</div>' +
      '<p class="sc-card__meta">当前客户 <strong>' +
      App.escapeHtml(c.name) +
      '</strong> 尚无已保存方案，请先完成 <strong>方案速配</strong> 再按方案报价。</p>' +
      '<div class="sc-card__actions-inline">' +
      '<button type="button" class="sc-btn sc-btn--ghost-primary" data-action="skill-plan">去配方案</button>' +
      '<button type="button" class="sc-btn sc-btn--ghost-primary" data-action="quote-direct-start">直接选品报价</button>' +
      '</div></div>'
    );
  }

  /** 口令「按方案报价」[+ 方案名称/方案编号]：检索方案 → 唯一则报价选品确认，多个则选择方案卡 */
  function runSchemeQuoteEntry(utterance) {
    const t = (utterance || '按方案报价').trim();
    enterSkill('quote');
    const c = activeCustomer();
    if (!c) {
      ctx().pendingSchemeQuoteUtterance = t;
      if (App.promptForCustomerSelection) {
        App.promptForCustomerSelection('scheme-quote', { skipUserMsg: false, delayMs: 0 });
      } else {
        requireCustomer('quote');
      }
      return true;
    }
    const pool = schemesForCustomer(c.id);
    if (!pool.length) {
      App.pushAiHtml(
        '<p class="sc-reply-lead">当前客户 <strong>' +
          App.escapeHtml(c.name) +
          '</strong> 暂无已保存方案，已进入选品报价。</p>'
      );
      quoteDirectStart();
      if (window.Annotation && Annotation.scanHosts) window.Annotation.scanHosts();
      return true;
    }
    if (pool.length === 1 && !schemeQuoteHasAttributeCriteria(parseSchemeQuoteAttributes(t))) {
      quoteFromScheme(pool[0].id);
      if (window.Annotation && Annotation.scanHosts) window.Annotation.scanHosts();
      return true;
    }
    const attrs = parseSchemeQuoteAttributes(t);
    const hasAttr = schemeQuoteHasAttributeCriteria(attrs);
    const matched = hasAttr ? matchSchemesByAttributes(c, attrs, pool) : pool;

    if (hasAttr && matched.length === 1) {
      App.pushAiHtml(
        '<p class="sc-reply-lead">已按 <strong>' +
          App.escapeHtml(describeSchemeQuoteCriteria(attrs)) +
          '</strong> 匹配到唯一方案「' +
          App.escapeHtml(matched[0].templateName || matched[0].id) +
          '」，进入报价选品确认。</p>'
      );
      quoteFromScheme(matched[0].id);
      if (window.Annotation && Annotation.scanHosts) window.Annotation.scanHosts();
      return true;
    }
    if (matched.length > 1) {
      pushSchemePickForQuote(
        c,
        hasAttr
          ? '<p class="sc-reply-lead">按 <strong>' +
              App.escapeHtml(describeSchemeQuoteCriteria(attrs)) +
              '</strong> 匹配到 <strong>' +
              matched.length +
              '</strong> 个方案，请<strong>确认要报价的方案</strong>（方案名称见下行）：</p>'
          : '<p class="sc-reply-lead">已校验：当前客户 <strong>' +
              App.escapeHtml(c.name) +
              '</strong> 共有 <strong>' +
              matched.length +
              '</strong> 个方案，请<strong>选择要报价的方案</strong>（方案名称见下行）：</p>',
        matched
      );
      if (window.Annotation && Annotation.scanHosts) window.Annotation.scanHosts();
      return true;
    }
    if (hasAttr && matched.length === 0) {
      guideMissingSlot('quoteSchemePick', {
        leadHtml:
          '<p class="sc-reply-lead"><strong>【待填写】</strong> 未找到与描述匹配的方案，请从下列选择。</p>',
        message: '未找到与描述匹配的方案'
      });
      pushSchemePickForQuote(
        c,
        '<p class="sc-reply-lead">未匹配到符合条件的方案，请从下列 <strong>' +
          pool.length +
          '</strong> 个方案中选择（方案名称见下行）：</p>',
        pool
      );
      if (window.Annotation && Annotation.scanHosts) window.Annotation.scanHosts();
      return true;
    }
    pushSchemePickForQuote(
      c,
      '<p class="sc-reply-lead">已校验：当前客户 <strong>' +
        App.escapeHtml(c.name) +
        '</strong> 共有 <strong>' +
        pool.length +
        '</strong> 个方案，请<strong>选择要报价的方案</strong>（方案名称见下行）：</p>',
      pool
    );
    if (window.Annotation && Annotation.scanHosts) window.Annotation.scanHosts();
    return true;
  }

  /** 口令「按报价单下单」[+ 报价单编号/报价单模板]；不含直选品名/台数/单价的长句 */
  function isOrderByQuoteEntryPhrase(text) {
    const t = (text || '').trim();
    if (!/按报价单|用报价单|根据报价单|这份报价|按这份报价/.test(t)) return false;
    if (!/下单|生成订单|确认下单/.test(t)) return false;
    if (/\d+\s*台|每台|单价|折扣|打折|几折/.test(t) && !/\bQT\d{6,}\b/i.test(t)) return false;
    return true;
  }

  function runOrderByQuoteEntry(utterance) {
    const t = (utterance || '按报价单下单').trim();
    enterSkill('order');
    let c = activeCustomer();
    if (DemoData.resolveCustomerUtterance) {
      const res = DemoData.resolveCustomerUtterance(t, customersInPickerScope());
      if (res.status === 'ambiguous') {
        ctx().pendingOrderByQuoteUtterance = t;
        if (App.openCustomerSheet) App.openCustomerSheet(res.query);
        if (App.promptForCustomerSelection) {
          App.promptForCustomerSelection('order-by-quote', { skipUserMsg: true, delayMs: 0 });
        }
        App.pushAiHtml(
          '<p class="sc-card__meta">「' +
            App.escapeHtml(res.query) +
            '」匹配到多家客户，请在列表中确认。</p>'
        );
        return true;
      }
      if (res.status === 'unique') {
        c = res.customer;
        App.state.customerId = c.id;
        App.state.selectedFollowUpId = c.id;
        App.saveState();
        App.refreshHeader();
      }
    }
    if (!c) {
      ctx().pendingOrderByQuoteUtterance = t;
      if (App.promptForCustomerSelection) {
        App.promptForCustomerSelection('order-by-quote', { skipUserMsg: false, delayMs: 0 });
      } else {
        requireCustomer('order');
      }
      return true;
    }
    return resolveOrderByQuoteUtterance(c, t);
  }

  function isQuoteDemandText(text) {
    const t = (text || '').trim();
    if (isOrderDemandText(t) || isQuoteEntryPhrase(t)) return false;
    return /报价|报个价|报一下价|出报价|单价|折扣|打折|几折|含税|按方案/.test(t);
  }

  /** 已有方案时，是否允许一句话直接生成报价单卡（须含折扣/单价等，或较长描述） */
  function isOneShotSchemeQuote(text) {
    const t = (text || '').trim();
    if (isQuoteEntryPhrase(t)) return false;
    if (!/按方案|方案报价|当前方案|用这个方案/.test(t)) {
      return /单价|折扣|打折|几折|含税|\d+/.test(t) && t.length > 6;
    }
    return /单价|折扣|打折|几折|含税|\d+|给.+报价/.test(t);
  }

  /** 一句话描述需求（非纯技能口令）；不含「配个方案」类入口话术（避免「个」字误触） */
  function isNaturalDemandText(text) {
    const t = (text || '').trim();
    if (!t || t.length < 5 || isPlainSkillPhrase(t)) return false;
    if (/^(方案|报价|下单|待跟进|写跟进)\s*$/.test(t)) return false;
    if (isQuoteDemandText(t)) return true;
    if (/配(?:个)?方案|做方案|方案速配/.test(t) && !/\d+\s*[台套件个只]|[各每]\s*\d|伺服|电机|轴承|齿轮|密封|PLC|导轨|产线|自动化/.test(t)) {
      return false;
    }
    if (
      /需要|想要|来一套|各\s*\d+\s*个?|\d+\s*个|\d+\s*台|\d+\s*套|数量|电机|轴承|齿轮|密封|产线|自动化|PLC|导轨/.test(
        t
      )
    ) {
      return true;
    }
    return t.length >= 12 && !/^(配个|做方案|报价|选品)\s*/.test(t);
  }

  function applyDemandMatchesToPlan(matches) {
    const plan = ctx().plan;
    matches.forEach((row) => {
      const pid = row.product.id;
      plan.selected[pid] = true;
      plan.qty[pid] = row.qty || 1;
      plan.sku[pid] = DemoData.defaultSkuId(row.product);
    });
  }

  function tryGenerateSchemeFromDemand(text) {
    const t = (text || '').trim();
    if (!t || isOrderDemandText(t) || isQuoteDemandText(t) || !isNaturalDemandText(t)) return false;
    if (isActiveFlowCard('card-plan-pick')) return false;
    const c = ensurePlan();
    if (!c) return false;

    if (ctx().plan) {
      ctx().plan.demandText = t;
      ctx().plan.awaitingDemand = false;
    }
    const matches = DemoData.matchProductsFromDemandText(c, t);
    if (!matches.length) {
      guideMissingSlot('productMatchFail');
      return true;
    }

    applyDemandMatchesToPlan(matches);
    const tpl = DemoData.planTemplates[0];
    const names = matches.map((r) => r.product.name).join('、');
    App.pushAiHtml(
      '<p class="sc-reply-lead">已根据描述自动匹配 <strong>' +
        matches.length +
        '</strong> 项（' +
        App.escapeHtml(names) +
        '），使用模板「' +
        App.escapeHtml(tpl.name) +
        '」生成方案。</p>'
    );
    enterSkill('plan');
    confirmPlan(tpl.id);
    return true;
  }

  function applyDiscountToQuoteLines(lines, text) {
    const rate = DemoData.parseDiscountRate(text);
    if (rate >= 1 || rate <= 0) return rate;
    lines.forEach((l) => {
      l.quotePrice = Math.round((l.quotePrice || 0) * rate * 100) / 100;
      l._quotePriceTouched = true;
      l.sub = l.quotePrice * (l.qty || 1);
      l.unitPrice = l.quotePrice;
    });
    return rate;
  }

  function publishQuoteCard(pending, templateId) {
    const tpl =
      DemoData.quoteTemplates.find((x) => x.id === templateId) || DemoData.quoteTemplates[0];
    const c = App.getCustomer(pending.customerId);
    if (!c || !pending.lines.length) return;
    const total = pending.lines.reduce((s, l) => s + l.sub, 0);
    let schemeId = pending.schemeId;
    if (pending.saveAsScheme && pending.sourceType === 'direct') schemeId = saveSchemeFromPending(pending);
    const quote = persistQuote({
      id: 'QT' + Date.now().toString().slice(-8),
      templateId: tpl.id,
      templateName: tpl.name,
      schemeId: schemeId,
      customerId: c.id,
      total: total,
      lines: pending.lines,
      createdAt: new Date().toISOString().slice(0, 16).replace('T', ' ')
    });
    const pendingOrder = ensurePendingSubmitOrderForQuote(quote, c);
    quote.pendingOrderId = pendingOrder.id;
    quote.pendingOrderNo = pendingOrder.no;
    ctx().quotePending = null;
    App.closeOverlays();
    pushQuoteCard(quote, c, tpl);
  }

  function pushQuoteCard(quote, c, tpl) {
    App.pushAiHtml(renderQuoteCardHtml(quote, c, tpl));
  }

  function tryGenerateQuoteFromDemand(text) {
    const t = (text || '').trim();
    if (!t || isOrderDemandText(t)) return false;
    const c = activeCustomer() || requireCustomer();
    if (!c) return false;

    const explicitScheme = /按方案|方案报价|当前方案|用这个方案/.test(t);
    let scheme = schemeForActiveCustomer();
    let schemeBootstrapped = false;
    if (explicitScheme && !scheme) {
      scheme = ensureSchemeFromRecommendations(c, { silent: true });
      schemeBootstrapped = !!scheme;
    }
    const productMatches = DemoData.matchProductsFromDemandText(c, t);
    const strongProductQuote =
      isQuoteDemandText(t) && productMatches.some((r) => r.score >= 0.5);
    const schemeQuote =
      scheme && isOneShotSchemeQuote(t) && (explicitScheme || isQuoteDemandText(t)) && !strongProductQuote;

    if (schemeQuote) {
      const list = schemesForCustomer(c.id);
      if (!list.length && !scheme) return false;
      const attrs = parseSchemeQuoteAttributes(t);
      const hasAttr = schemeQuoteHasAttributeCriteria(attrs);
      const pool = list.length ? list : scheme ? [scheme] : [];
      const matched = hasAttr ? matchSchemesByAttributes(c, attrs, pool) : pool;
      if (matched.length > 1) {
        ctx().pendingSchemeQuoteDemand = t;
        pushSchemePickForQuote(
          c,
          hasAttr
            ? '<p class="sc-reply-lead">按 <strong>' +
                App.escapeHtml(describeSchemeQuoteCriteria(attrs)) +
                '</strong> 匹配到 <strong>' +
                matched.length +
                '</strong> 个方案，<strong>请先选择方案</strong>（确认方案名称后再生成报价单）：</p>'
            : '<p class="sc-reply-lead">话术含按方案报价，本客户有 <strong>' +
                matched.length +
                '</strong> 个方案，<strong>请先选择方案</strong>（确认方案名称后再生成报价单）：</p>',
          matched
        );
        return true;
      }
      if (hasAttr && matched.length === 0) {
        guideMissingSlot('quoteSchemePick', {
          message: '未找到与描述匹配的方案',
          skipToast: false
        });
        if (pool.length) {
          ctx().pendingSchemeQuoteDemand = t;
          pushSchemePickForQuote(
            c,
            '<p class="sc-reply-lead">未匹配到符合条件的方案，请从下列选择后再生成报价单：</p>',
            pool
          );
          return true;
        }
        return false;
      }
      const picked = matched[0] || scheme || list[0];
      if (!picked) return false;
      let lines = linesFromScheme(picked);
      if (!lines.length) return false;
      const rate = applyDiscountToQuoteLines(lines, t);
      enterSkill('quote');
      App.pushAiHtml(
        '<p class="sc-reply-lead">已按方案 <strong>' +
          App.escapeHtml(picked.id) +
          '</strong> 生成报价单' +
          (schemeBootstrapped ? '（已按客户推荐品生成方案）' : '') +
          (rate < 1 ? '（已应用折扣）' : '') +
          '。</p>'
      );
      publishQuoteCard(
        {
          customerId: c.id,
          sourceType: 'scheme',
          schemeId: picked.id,
          lines: lines,
          saveAsScheme: false
        },
        'qt-standard'
      );
      return true;
    }

    if (!isQuoteDemandText(t)) return false;

    const matches = productMatches;
    if (!matches.length) {
      if (isQuoteDemandText(t)) {
        guideMissingSlot('productMatchFail', { skill: 'quote' });
        enterSkill('quote');
        if (
          !document.querySelector('[data-spec-id="card-quote-source"]') &&
          !document.querySelector('[data-spec-id="card-quote-entry"]')
        ) {
          showQuoteSkillEntry();
        }
        return true;
      }
      return false;
    }

    const lines = matches
      .map((row) => {
        const pr = row.product;
        const skuId = DemoData.defaultSkuId(pr);
        const parsed = DemoData.parseLinePriceFromText(t, pr);
        const hints = DemoData.priceHints(pr, skuId);
        const quotePrice = parsed != null ? parsed : hints.latestPrice;
        return makeQuoteLine(pr, { skuId: skuId, qty: row.qty || 1, quotePrice: quotePrice });
      })
      .filter(Boolean);

    const rate = applyDiscountToQuoteLines(lines, t);
    enterSkill('quote');
    const names = matches.map((r) => r.product.name).join('、');
    App.pushAiHtml(
      '<p class="sc-reply-lead">已根据描述为 <strong>' +
        App.escapeHtml(c.name) +
        '</strong> 匹配 ' +
        App.escapeHtml(names) +
        ' 并生成报价单' +
        (rate < 1 ? '（已应用折扣）' : '') +
        '。</p>'
    );
    publishQuoteCard(
      {
        customerId: c.id,
        sourceType: 'direct',
        schemeId: scheme ? scheme.id : null,
        lines: lines,
        saveAsScheme: false
      },
      'qt-standard'
    );
    return true;
  }

  /** 一句话下单：按报价单或直选配品填价 */
  function tryGenerateOrderFromDemand(text) {
    const t = (text || '').trim();
    if (!t || !isOrderDemandText(t)) return false;
    let c = null;
    if (DemoData.resolveCustomerUtterance) {
      const res = DemoData.resolveCustomerUtterance(t, customersInPickerScope());
      if (res.status === 'ambiguous') {
        if (App.openCustomerSheet) App.openCustomerSheet(res.query);
      App.pushAiHtml(
          '<p class="sc-card__meta">「' +
            App.escapeHtml(res.query) +
            '」匹配到多家客户，请在列表中确认。</p>'
        );
      return true;
      }
      if (res.status === 'unique') {
        c = res.customer;
        const cur = activeCustomer();
        if (!cur || cur.id !== c.id) {
          App.state.customerId = c.id;
          App.state.selectedFollowUpId = c.id;
          App.saveState();
          App.refreshHeader();
        }
      }
    }
    if (!c) c = activeCustomer() || requireCustomer('order');
    if (!c) return false;

    if (/按报价单|用报价单|根据报价单|这份报价|按这份报价/.test(t)) {
      return resolveOrderByQuoteUtterance(c, t);
    }

    const matches = DemoData.matchProductsFromDemandText(c, t);
    if (!matches.length) return false;

    const lines = matches
      .map((row) => {
        const pr = row.product;
        const skuId = DemoData.defaultSkuId(pr);
        const parsed = DemoData.parseLinePriceFromText(t, pr);
        const hints = DemoData.priceHints(pr, skuId);
        const quotePrice = parsed != null ? parsed : hints.latestPrice;
        return makeQuoteLine(pr, { skuId: skuId, qty: row.qty || 1, quotePrice: quotePrice });
      })
      .filter(Boolean);

    if (!lines.length) return false;

    const total = lines.reduce((s, l) => s + l.sub, 0);
    const names = matches.map((r) => r.product.name).join('、');
    enterSkill('order');
    App.pushAiHtml(
      '<p class="sc-reply-lead">已根据描述为 <strong>' +
        App.escapeHtml(c.name) +
        '</strong> 匹配 ' +
        App.escapeHtml(names) +
        '，请确认下单。</p>'
    );
    setOrderPending(lines, { customerId: c.id, sourceType: 'direct', total: total });
    showOrderConfirm();
    return true;
  }

  function planSelectProduct(pid, selectOn) {
    const p = productById(pid);
    if (!p) return;
    ctx().plan.selected[pid] = selectOn !== false;
    if (ctx().plan.selected[pid]) {
      ctx().plan.qty[pid] = ctx().plan.qty[pid] || 1;
      ctx().plan.sku[pid] = ctx().plan.sku[pid] || DemoData.defaultSkuId(p);
    }
  }

  function rescanAnnotationPins() {
    if (window.Annotation && Annotation.rescanSpecPins) window.Annotation.rescanSpecPins();
    else if (window.Annotation && Annotation.scanHosts) window.Annotation.scanHosts();
  }

  function refreshLastPlanPickCard() {
    syncPlanQtyFromDom();
    syncPlanSkuFromDom();
    const card = getLastPlanPickCard();
    if (!card) return;
    card.outerHTML = renderProductPickCard();
    schedulePlanPickLazyBind();
    rescanAnnotationPins();
  }

  function refreshLastPlanCartCard() {
    const cards = document.querySelectorAll('[data-spec-id="card-plan-preview"]');
    const card = cards[cards.length - 1];
    if (card) card.outerHTML = renderPlanCartCardFixed();
    rescanAnnotationPins();
  }

  function isPlanCartCardVisible() {
    return !!document.querySelector('[data-spec-id="card-plan-preview"]');
  }

  function findPlanCartLineIndex(keywordOrIndex) {
    const ids = planSelectedIds();
    const raw = String(keywordOrIndex || '').trim();
    const numM = raw.match(/^(\d+)$/);
    if (numM) {
      const i = parseInt(numM[1], 10) - 1;
      return i >= 0 && i < ids.length ? i : -1;
    }
    const k = raw.toLowerCase();
    if (!k) return -1;
    return ids.findIndex((pid) => {
      const p = productById(pid);
      return (
        p &&
        ((p.name && p.name.toLowerCase().indexOf(k) >= 0) ||
          (p.spec && p.spec.toLowerCase().indexOf(k) >= 0))
      );
    });
  }

  function applyPlanCartPatch(lineIndex, patch) {
    const plan = ctx().plan;
    const ids = planSelectedIds();
    const pid = ids[lineIndex];
    if (!plan || !pid) return false;
    const pr = productById(pid);
    if (patch.qty != null) plan.qty[pid] = patch.qty;
    if (patch.skuKeyword && pr) {
      const kw = String(patch.skuKeyword).toLowerCase();
      const sk = (pr.skus || []).find(
        (s) => s.label.toLowerCase().indexOf(kw) >= 0 || s.id === patch.skuKeyword
      );
      if (!sk) return false;
      plan.sku[pid] = sk.id;
    }
    refreshLastPlanCartCard();
    return true;
  }

  /** 方案预览卡：语音改购买数量、规格 */
  function tryPlanCartUtterance(text) {
    if (!isPlanCartCardVisible()) return false;
    const plan = ctx().plan;
    if (!plan || !plan.customerId || !planSelectedIds().length) return false;
    const t = (text || '').trim();
    if (!t) return false;

    if (/数量/.test(t)) {
      let idx = -1;
      let qty = 1;
      const m1 = t.match(/第\s*(\d+)\s*[项个条]?\s*数量\s*(\d+)/);
      const m2 = t.match(/(.+?)\s+数量\s*(\d+)/);
      const m3 = t.match(/^数量\s*(\d+)$/);
      if (m1) {
        idx = parseInt(m1[1], 10) - 1;
        qty = parseInt(m1[2], 10) || 1;
      } else if (m2) {
        idx = findPlanCartLineIndex(m2[1]);
        qty = parseInt(m2[2], 10) || 1;
      } else if (m3) {
        idx = planSelectedIds().length === 1 ? 0 : findPlanCartLineIndex('');
        qty = parseInt(m3[1], 10) || 1;
        if (planSelectedIds().length > 1) idx = -1;
      }
      if (idx >= 0 && applyPlanCartPatch(idx, { qty: qty })) {
        pushAiMeta('<p class="sc-card__meta">已更新购买数量为 <strong>' + qty + '</strong>。</p>');
        return true;
      }
      App.toast(planSelectedIds().length > 1 ? '未找到对应行' : '请先预览方案');
      return true;
    }

    const skuM = t.match(/第\s*(\d+)\s*[项个条]?\s*规格\s*(.+)/) || t.match(/(.+?)\s+规格\s*(.+)/);
    if (skuM) {
      const idx = /第\s*\d+/.test(t) ? parseInt(skuM[1], 10) - 1 : findPlanCartLineIndex(skuM[1]);
      const kw = skuM[2].trim();
      if (idx >= 0 && applyPlanCartPatch(idx, { skuKeyword: kw })) {
        pushAiMeta('<p class="sc-card__meta">已更新规格为「' + App.escapeHtml(kw) + '」。</p>');
        return true;
      }
      App.toast('未匹配到该规格选项');
      return true;
    }

    if (/^(?:生成|保存)方案/.test(t)) {
      if (!planSelectedIds().length) {
        guideMissingSlot('planCartEmpty');
        return true;
      }
      guideMissingSlot('planTemplate', { skipToast: true });
      return true;
    }

    return false;
  }

  function tryQuoteSourceUtterance(text) {
    if (!document.querySelector('[data-spec-id="card-quote-source"]')) return false;
    const t = (text || '').trim();
    if (!t) return false;
    const c = activeCustomer();
    if (!c) return false;
    if (/按方案\s*报价|方案报价/.test(t)) {
      const pool = schemesForCustomer(c.id);
      if (!pool.length) {
        guideMissingSlot('quoteNoScheme');
        return true;
      }
      enterSkill('quote');
      quoteFromScheme(null);
      return true;
    }
    if (/直接选品|直选/.test(t)) {
      enterSkill('quote');
      quoteDirectStart();
      return true;
    }
    return false;
  }

  function tryOrderSourceUtterance(text) {
    if (!document.querySelector('[data-spec-id="card-order-source"]')) return false;
    const t = (text || '').trim();
    if (!t) return false;
    const c = activeCustomer();
    if (!c) return false;
    if (/按报价单|用报价单/.test(t)) {
      const pool = quotesForCustomer(c.id);
      if (!pool.length) {
        enterSkill('order');
        orderDirectStart();
        return true;
      }
      if (pool.length === 1) {
        orderFromQuote(pool[0].id);
        return true;
      }
      pushQuotePickForOrder(c);
      return true;
    }
    if (/直接选品|直选/.test(t)) {
      enterSkill('order');
      orderDirectStart();
      return true;
    }
    return false;
  }

  function isQuoteTemplateOpen() {
    return isActiveFlowCard('sheet-quote-template');
  }

  function selectQuoteTemplateById(templateId) {
    const radio = document.querySelector(
      'input[name="quote-template"][value="' + CSS.escape(templateId) + '"]'
    );
    if (!radio) return false;
    radio.checked = true;
    return true;
  }

  function tryQuoteTemplateUtterance(text) {
    if (!isQuoteTemplateOpen()) return false;
    const t = (text || '').trim();
    if (!t) return false;
    const templates = DemoData.quoteTemplates || [];

    if (/生成报价单|保存|确认/.test(t)) {
      submitQuoteTemplate({ simulateUserMsg: false });
      return true;
    }

    const rowIdx = parsePickListIndex(t);
    if (rowIdx != null) {
      const tpl = templates[rowIdx - 1];
      if (!tpl) {
        App.toast('没有第 ' + rowIdx + ' 个模板，共 ' + templates.length + ' 项');
        return true;
      }
      selectQuoteTemplateById(tpl.id);
      submitQuoteTemplate({ simulateUserMsg: false });
      return true;
    }

    const k = t.replace(/\s+/g, '').toLowerCase();
    if (k.length >= 2) {
      const hit = templates.find(function (tpl) {
        return (
          tpl.name.replace(/\s+/g, '').toLowerCase().indexOf(k) >= 0 ||
          tpl.id.toLowerCase().indexOf(k) >= 0
        );
      });
      if (hit) {
        selectQuoteTemplateById(hit.id);
        submitQuoteTemplate({ simulateUserMsg: false });
        return true;
      }
    }

    App.toast('可说「第1个」、模板名称（选中并生成报价单），或单独说「生成报价单」');
    return true;
  }

  function tryPlanCommand(t) {
    if (isPlanSkillAtEntry()) return tryPlanEntryIntent(t);
    const plan = ctx().plan;
    if (!plan || !plan.customerId) return false;
    if (plan.awaitingDemand) return false;
    const text = (t || '').trim();
    if (!text) return false;

    if (isPlanCartCardVisible() && tryPlanCartUtterance(text)) return true;

    if (/^(?:修改需求|改需求|重新描述需求|变更需求|补充需求|调整需求)/.test(text)) {
      return handlePlanDemandEditUtterance(text, { simulateUserMsg: false });
    }

    if (isActiveFlowCard('card-plan-pick') && isNaturalDemandText(text)) {
      return applyPickQuery('plan', { text: text, simulateUserMsg: false });
    }

    if (/^筛选|^过滤/.test(text)) {
      const m = text.match(/(?:筛选|过滤)\s*(.+)/);
      return applyPickQuery('plan', { text: m && m[1] ? m[1].trim() : '', simulateUserMsg: false });
    }

    if (/选品|选择产品|选中/.test(text)) {
      const m = text.match(/选品\s*(.+)/) || text.match(/选择(?:产品)?\s*(.+)/);
      if (m && m[1]) {
        const p = findProductByKeyword(m[1]);
        if (!p) {
          pushAiMeta('<p class="sc-card__meta">未找到与「' + App.escapeHtml(m[1].trim()) + '」匹配的产品，请换关键词或点选列表。</p>');
          return true;
        }
        planSelectProduct(p.id, true);
        refreshLastPlanPickCard();
        pushAiMeta('<p class="sc-card__meta">已选品：<strong>' + App.escapeHtml(p.name) + '</strong>，可调整规格后说「预览方案」。</p>');
        return true;
      }
      refreshLastPlanPickCard();
      pushAiMeta('<p class="sc-card__meta">请在选品卡中点选产品，或说「选品 伺服电机」。</p>');
      return true;
    }

    if (/预览方案|加购|加入购物车|确认选品/.test(text)) {
      if (!planSelectedIds().length) {
        guideMissingSlot('planPickProducts');
        return true;
      }
      syncPlanFilterFromDom();
      pushNextAiCard(renderPlanCartCardFixed());
      pushAiMeta('<p class="sc-card__meta">已进入方案预览，可修改规格与数量后说「生成方案」。</p>');
      return true;
    }

    if (/生成方案|保存方案/.test(text)) {
      if (!planSelectedIds().length) {
        guideMissingSlot('planCartEmpty');
        return true;
      }
      guideMissingSlot('planTemplate');
      return true;
    }

    return false;
  }

  function isQuoteSetupOpen() {
    return isActiveFlowCard('sheet-quote-setup');
  }

  function findQuoteLineIndex(keywordOrIndex) {
    const pending = ctx().quotePending;
    if (!pending || !pending.lines.length) return -1;
    const raw = String(keywordOrIndex || '').trim();
    const numM = raw.match(/^(\d+)$/);
    if (numM) {
      const i = parseInt(numM[1], 10) - 1;
      return i >= 0 && i < pending.lines.length ? i : -1;
    }
    const k = raw.toLowerCase();
    if (!k) return -1;
    return pending.lines.findIndex(
      (l) =>
        (l.inventoryName && l.inventoryName.toLowerCase().indexOf(k) >= 0) ||
        (l.inventoryCode && l.inventoryCode.toLowerCase().indexOf(k) >= 0)
    );
  }

  function applyQuoteLinePatch(lineIndex, patch) {
    const pending = ctx().quotePending;
    if (!pending || lineIndex < 0 || !pending.lines[lineIndex]) return false;
    const line = pending.lines[lineIndex];
    const pr = productById(line.productId);
    if (patch.price != null) {
      line.quotePrice = patch.price;
      line._quotePriceTouched = true;
    }
    if (patch.qty != null) line.qty = patch.qty;
    if (patch.skuKeyword && pr) {
      const sk = (pr.skus || []).find(
        (s) =>
          s.label.toLowerCase().indexOf(String(patch.skuKeyword).toLowerCase()) >= 0 ||
          s.id === patch.skuKeyword
      );
      if (!sk) return false;
      line.skuId = sk.id;
      line.skuLabel = sk.label;
      const hints = DemoData.priceHints(pr, line.skuId);
      line.latestPrice = hints.latestPrice;
      line.minPrice = hints.minPrice;
      if (!line._quotePriceTouched) line.quotePrice = hints.latestPrice;
    }
    line.sub = (line.quotePrice || 0) * (line.qty || 1);
    line.unitPrice = line.quotePrice;
    recalcQuotePendingTotal();
    if (isQuoteSetupOpen()) refreshQuoteSetupLines();
    else if (document.querySelector('[data-spec-id="card-quote-cart"]')) refreshLastQuoteConfirmCard();
    return true;
  }

  /** 逐项报价抽屉：用户话术已在主对话气泡展示；助手反馈用同页 meta，避免多余整页消息 */
  function quoteIntentReply(html, toastShort) {
    if (html) pushAiMeta(html);
    else if (toastShort) App.toast(toastShort);
  }

  function tryQuoteCommand(t) {
    if (isQuoteSkillAtEntry()) return tryQuoteEntryIntent(t);
    const text = (t || '').trim();
    if (!text) return false;
    const draft = ctx().quoteDraft;
    const pending = ctx().quotePending;

    if (draft && draft.awaitingDemand) return false;

    if (draft && draft.customerId && !pending) {
      if (/^(?:修改需求|改需求|重新描述需求|变更需求|补充需求|调整需求)/.test(text)) {
        return handleQuoteDemandEditUtterance(text, { simulateUserMsg: false });
      }
      if (/^筛选|^过滤/.test(text)) {
        const m = text.match(/(?:筛选|过滤)\s*(.+)/);
        return applyPickQuery('quote', { text: m && m[1] ? m[1].trim() : '', simulateUserMsg: false });
      }
      if (/选品|选择产品|选中/.test(text)) {
        const m = text.match(/选品\s*(.+)/) || text.match(/选择(?:产品)?\s*(.+)/);
        if (m && m[1]) {
          const p = findProductByKeyword(m[1]);
          if (!p) {
            pushAiMeta('<p class="sc-card__meta">未找到与「' + App.escapeHtml(m[1].trim()) + '」匹配的产品。</p>');
            return true;
          }
          quoteSelectProduct(p.id, true);
          refreshLastQuotePickCard();
          pushAiMeta('<p class="sc-card__meta">已选品：<strong>' + App.escapeHtml(p.name) + '</strong>。</p>');
          return true;
        }
        refreshLastQuotePickCard();
        pushAiMeta('<p class="sc-card__meta">请点选列表或说「选品 伺服电机」。</p>');
        return true;
      }
      if (/加购|逐项报价|下一步|确认选品/.test(text)) {
        quoteToCartFromDraft();
        return true;
      }
    }

    const orderDraft = ctx().orderDraft;
    if (orderDraft && orderDraft.customerId && !pending) {
      if (ctx().deliveryLinesMode && isActiveFlowCard('card-order-pick') && isNaturalDemandText(text)) {
        return applyPickQuery('order', { text: text, simulateUserMsg: false });
      }
      if (/^(?:修改需求|改需求|重新描述需求|变更需求|补充需求|调整需求)/.test(text)) {
        return handleQuoteDemandEditUtterance(text, { simulateUserMsg: false });
      }
      if (/^筛选|^过滤/.test(text)) {
        const m = text.match(/(?:筛选|过滤)\s*(.+)/);
        return applyPickQuery('order', { text: m && m[1] ? m[1].trim() : '', simulateUserMsg: false });
      }
      if (/选品|选择产品|选中/.test(text)) {
        const m = text.match(/选品\s*(.+)/) || text.match(/选择(?:产品)?\s*(.+)/);
        if (m && m[1]) {
          const p = findProductByKeyword(m[1]);
          if (!p) {
            pushAiMeta('<p class="sc-card__meta">未找到与「' + App.escapeHtml(m[1].trim()) + '」匹配的产品。</p>');
            return true;
          }
          orderSelectProduct(p.id, true);
          refreshLastOrderPickCard();
          pushAiMeta('<p class="sc-card__meta">已选品：<strong>' + App.escapeHtml(p.name) + '</strong>。</p>');
          return true;
        }
        refreshLastOrderPickCard();
        pushAiMeta('<p class="sc-card__meta">请点选列表或说「选品 伺服电机」。</p>');
        return true;
      }
      if (/逐项报价|下一步|确认选品|生成订单|评估交期/.test(text)) {
        if (ctx().deliveryLinesMode) {
          confirmDeliveryLines({ simulateUserMsg: false });
          return true;
        }
        orderToQuoteSetupFromDraft();
        return true;
      }
    }

    if (!pending || !pending.lines.length) return false;

    if (pending.forOrder && /确认下单|生成订单|下一步/.test(text)) {
      quoteSetupNext({ simulateUserMsg: false });
      return true;
    }
    if (!pending.forOrder && /模板|生成报价单|下一步|选择模板/.test(text)) {
      quoteSetupNext({ simulateUserMsg: false });
      return true;
    }

    const priceM =
      text.match(/第\s*(\d+)\s*[项个条]?\s*(?:报价|填价|价格)\s*([\d.]+)/) ||
      text.match(/第\s*(\d+)\s*[项个条]?\s*([\d.]+)\s*元?/);
    if (priceM) {
      const idx = parseInt(priceM[1], 10) - 1;
      const price = parseFloat(priceM[2]);
      if (applyQuoteLinePatch(idx, { price: price })) {
        quoteIntentReply(
          '<p class="sc-card__meta">第 ' + priceM[1] + ' 项本单报价已设为 <strong>' + fmtMoney(price) + '</strong>。</p>',
          '第 ' + priceM[1] + ' 项已填价'
        );
        return true;
      }
      App.toast('未找到对应行');
      return true;
    }

    const namePriceM = text.match(/^(.+?)\s+(?:报价|填价|价格)\s*([\d.]+)/);
    if (namePriceM) {
      const idx = findQuoteLineIndex(namePriceM[1]);
      const price = parseFloat(namePriceM[2]);
      if (idx >= 0 && applyQuoteLinePatch(idx, { price: price })) {
        quoteIntentReply(
          '<p class="sc-card__meta"><strong>' + App.escapeHtml(pending.lines[idx].inventoryName) + '</strong> 本单报价 ' + fmtMoney(price) + '。</p>',
          '本单报价已更新'
        );
        return true;
      }
      App.toast('未找到对应产品行');
      return true;
    }

    const simplePriceM = text.match(/^(?:报价|填价|本单报价)\s*([\d.]+)/);
    if (simplePriceM && pending.lines.length === 1) {
      const price = parseFloat(simplePriceM[1]);
      if (applyQuoteLinePatch(0, { price: price })) {
        quoteIntentReply(
          '<p class="sc-card__meta">本单报价已设为 <strong>' + fmtMoney(price) + '</strong>。</p>',
          '本单报价已更新'
        );
        return true;
      }
    }

    const qtyM = text.match(/第\s*(\d+)\s*[项个条]?\s*数量\s*(\d+)/) || text.match(/(.+?)\s+数量\s*(\d+)/);
    if (qtyM) {
      const idx = /第\s*\d+/.test(text) ? parseInt(qtyM[1], 10) - 1 : findQuoteLineIndex(qtyM[1]);
      const qty = parseInt(qtyM[2], 10) || 1;
      if (idx >= 0 && applyQuoteLinePatch(idx, { qty: qty })) {
        quoteIntentReply('<p class="sc-card__meta">已更新数量为 ' + qty + '。</p>', '数量已更新');
        return true;
      }
      return true;
    }

    const skuM = text.match(/第\s*(\d+)\s*[项个条]?\s*规格\s*(.+)/) || text.match(/(.+?)\s+规格\s*(.+)/);
    if (skuM) {
      const idx = /第\s*\d+/.test(text) ? parseInt(skuM[1], 10) - 1 : findQuoteLineIndex(skuM[1]);
      const kw = skuM[2].trim();
      if (idx >= 0 && applyQuoteLinePatch(idx, { skuKeyword: kw })) {
        quoteIntentReply('<p class="sc-card__meta">已更新规格为「' + App.escapeHtml(kw) + '」。</p>', '规格已更新');
        return true;
      }
      App.toast('未匹配到该规格选项');
      return true;
    }

    return false;
  }

  function ensureQuoteDraft(customer) {
    const c = customer || requireCustomer();
    if (!c) return null;
    if (!ctx().quoteDraft || ctx().quoteDraft.customerId !== c.id) {
      ctx().quoteDraft = {
        customerId: c.id,
        filter: '',
        demandText: initialQuoteDemandText(c),
        awaitingDemand: false,
        selected: {},
        sku: {},
        qty: {},
        quotePrice: {},
        saveAsScheme: false
      };
    }
    if (ctx().quoteDraft.demandText == null) ctx().quoteDraft.demandText = '';
    if (ctx().quoteDraft.awaitingDemand == null) ctx().quoteDraft.awaitingDemand = false;
    if (ctx().quoteDraft.moreVisible == null) ctx().quoteDraft.moreVisible = PLAN_MORE_PAGE_SIZE;
    if (!ctx().quoteDraft.quotePrice) ctx().quoteDraft.quotePrice = {};
    return c;
  }

  function quoteSelectedIds() {
    const d = ctx().quoteDraft;
    return d ? Object.keys(d.selected || {}).filter((k) => d.selected[k]) : [];
  }

  function syncQuoteQtyFromDom() {
    document.querySelectorAll('[data-action="quote-qty"]').forEach((inp) => {
      const id = inp.getAttribute('data-pid');
      if (id && ctx().quoteDraft) ctx().quoteDraft.qty[id] = parseInt(inp.value, 10) || 1;
    });
  }

  function quoteSelectProduct(pid, on) {
    const pr = productById(pid);
    if (!pr) return;
    const d = ctx().quoteDraft;
    d.selected[pid] = on !== false;
    if (d.selected[pid]) {
      d.qty[pid] = d.qty[pid] || 1;
      d.sku[pid] = d.sku[pid] || DemoData.defaultSkuId(pr);
    }
  }

  function renderQuoteSkuSelect(product, pid) {
    const cur = ctx().quoteDraft.sku[pid] || DemoData.defaultSkuId(product);
    const opts = (product.skus || [])
      .map((s) => '<option value="' + s.id + '"' + (s.id === cur ? ' selected' : '') + '>' + App.escapeHtml(s.label) + '</option>')
      .join('');
    return '<label class="sc-plan-sku-label">规格 <select class="sc-plan-sku-select" data-action="quote-sku" data-pid="' + pid + '" onclick="event.stopPropagation()">' + opts + '</select></label>';
  }

  function makeQuoteLine(product, opts) {
    if (!product) return null;
    const skuId = (opts && opts.skuId) || DemoData.defaultSkuId(product);
    const qty = (opts && opts.qty) || 1;
    const hints = DemoData.priceHints(product, skuId);
    const quotePrice = opts && opts.quotePrice != null ? opts.quotePrice : hints.latestPrice;
    const commercial = DemoData.lineCommercialFields(product, skuId);
    return {
      productId: product.id,
      skuId: skuId,
      inventoryCode: product.inventoryCode || product.id.toUpperCase(),
      inventoryName: product.name,
      inventorySpec: product.spec,
      skuLabel: DemoData.skuLabel(product, skuId),
      salesUnit: product.salesUnit || '件',
      qty: qty,
      latestPrice: hints.latestPrice,
      minPrice: hints.minPrice,
      quotePrice: quotePrice,
      unitPrice: quotePrice,
      sub: quotePrice * qty,
      processVersion:
        opts && opts.processVersion != null ? opts.processVersion : commercial.processVersion,
      taxRate: opts && opts.taxRate != null ? opts.taxRate : commercial.taxRate
    };
  }

  function linesFromScheme(scheme) {
    return (scheme.lines || [])
      .map((l) => {
        const pr = productById(l.productId) || DemoData.products.find((x) => x.name === l.name);
        if (!pr) return null;
        const skuId = l.skuId || DemoData.defaultSkuId(pr);
        return makeQuoteLine(pr, { skuId: skuId, qty: l.qty || 1 });
      })
      .filter(Boolean);
  }

  function linesFromQuoteDraft(draft) {
    return quoteSelectedIds()
      .map((pid) => {
        const pr = productById(pid);
        if (!pr) return null;
        const opts = {
          skuId: draft.sku[pid] || DemoData.defaultSkuId(pr),
          qty: draft.qty[pid] || 1
        };
        if (draft.quotePrice && draft.quotePrice[pid] != null) opts.quotePrice = draft.quotePrice[pid];
        return makeQuoteLine(pr, opts);
      })
      .filter(Boolean);
  }

  function recalcQuotePendingTotal() {
    const p = ctx().quotePending;
    if (!p) return;
    p.lines.forEach((l) => {
      l.sub = (l.quotePrice || 0) * (l.qty || 1);
      l.unitPrice = l.quotePrice;
    });
    p.total = p.lines.reduce((s, l) => s + l.sub, 0);
    updateQuoteSetupTotal();
  }

  function updateQuoteSetupTotal() {
    const p = ctx().quotePending;
    const el =
      document.querySelector('[data-spec-id="sheet-quote-setup"] [data-quote-setup-total]') ||
      App.$('#quote-setup-total');
    if (el && p) el.textContent = fmtMoney(p.total);
  }

  function renderQuoteLineProcessVersionField(pr, line, pid, idx) {
    const options = DemoData.processVersionOptions(pr, line.skuId);
    const cur = line.processVersion || options[0] || '标准版';
    const opts = options
      .map(function (v) {
        return (
          '<option value="' +
          App.escapeHtml(v) +
          '"' +
          (v === cur ? ' selected' : '') +
          '>' +
          App.escapeHtml(v) +
          '</option>'
        );
      })
      .join('');
    return (
      '<label class="sc-quote-line__field">工艺版本 <select class="sc-input sc-input--field sc-quote-line__select" data-action="quote-line-process" data-pid="' +
      pid +
      '" data-idx="' +
      idx +
      '">' +
      opts +
      '</select></label>'
    );
  }

  function renderQuoteLineTaxRateField(line, pid, idx) {
    const rate = line.taxRate != null ? line.taxRate : 13;
    return (
      '<label class="sc-quote-line__field">税率<input type="number" min="0" max="100" step="0.01" value="' +
      rate +
      '" data-action="quote-line-tax" data-pid="' +
      pid +
      '" data-idx="' +
      idx +
      '" class="sc-input sc-input--field sc-quote-line__tax"/></label>'
    );
  }

  function applyQuoteLineCommercialDefaults(line, pr, opts) {
    opts = opts || {};
    if (!line || !pr) return;
    const fields = DemoData.lineCommercialFields(pr, line.skuId);
    if (!opts.keepProcess && !line._processVersionTouched) line.processVersion = fields.processVersion;
    if (!opts.keepTax && !line._taxRateTouched) line.taxRate = fields.taxRate;
    if (!opts.keepCustom && !line._customAttrsTouched) {
      line.customAttrs = DemoData.resolveLineCustomAttrs(pr, line.skuId);
    }
  }

  function validateQuoteLineCommercial(pending) {
    if (!pending || !pending.lines.length) return { ok: false, reason: 'empty' };
    const noProcess = pending.lines.find(function (l) {
      return !l.processVersion || !String(l.processVersion).trim();
    });
    if (noProcess) return { ok: false, reason: 'process' };
    const badTax = pending.lines.find(function (l) {
      return l.taxRate == null || isNaN(l.taxRate) || l.taxRate < 0;
    });
    if (badTax) return { ok: false, reason: 'tax' };
    return { ok: true };
  }

  function renderQuoteLineSkuSelectByPid(product, line, pid) {
    const cur = line.skuId || DemoData.defaultSkuId(product);
    const opts = (product.skus || [])
      .map((s) => '<option value="' + s.id + '"' + (s.id === cur ? ' selected' : '') + '>' + App.escapeHtml(s.label) + '</option>')
      .join('');
    return (
      '<label class="sc-plan-sku-label">规格 <select class="sc-plan-sku-select" data-action="quote-line-sku" data-pid="' +
      pid +
      '">' +
      opts +
      '</select></label>'
    );
  }

  function renderQuoteLineConfigRow(line, idx) {
    const pr = productById(line.productId);
    if (!pr) return '';
    const pid = line.productId;
    const belowMin = line.quotePrice < line.minPrice;
    return (
      '<div class="sc-quote-line' +
      (belowMin ? ' sc-quote-line--warn' : '') +
      '" data-quote-pid="' +
      pid +
      '"><p class="sc-quote-line__title">' +
      (idx + 1) +
      '. ' +
      App.escapeHtml(line.inventoryName) +
      '</p><div class="sc-quote-line__fields">' +
      '<div class="sc-quote-line__row-inline sc-quote-line__row-inline--spec">' +
      '<div class="sc-pick-spec-block sc-pick-spec-block--quote-line">' +
      renderPickFreeAttrRows(pr, pid, 'quote-line', { line: line, idx: idx }) +
      '</div>' +
      '</div>' +
      '<div class="sc-quote-price-hints"><span>最新售价 <strong data-quote-latest="' +
      pid +
      '">' +
      fmtMoney(line.latestPrice) +
      '</strong></span><span>最低售价 <strong data-quote-min="' +
      pid +
      '">' +
      fmtMoney(line.minPrice) +
      '</strong></span></div>' +
      '<div class="sc-quote-line__row-inline sc-quote-line__row-inline--price">' +
      renderQuoteLineQtyField(line, pid, idx) +
      renderQuoteLineTaxRateField(line, pid, idx) +
      '<label class="sc-quote-line__field sc-quote-price-input">本单报价<input type="number" min="0" step="0.01" value="' +
      line.quotePrice +
      '" data-action="quote-line-price" data-pid="' +
      pid +
      '" data-idx="' +
      idx +
      '" class="sc-input sc-input--field"/></label>' +
      '</div>' +
      '<p class="sc-quote-line__sub">行小计 <strong data-quote-sub="' +
      pid +
      '">' +
      fmtMoney(line.sub) +
      '</strong></p></div></div>'
    );
  }

  function renderQuoteSetupCard() {
    const p = ctx().quotePending;
    if (!p || !p.lines.length) return '';
    recalcQuotePendingTotal();
    const forOrder = !!p.forOrder;
    const title = forOrder ? '逐项报价（下单）' : '逐项报价';
    const totalLabel = forOrder ? '订单金额' : '报价合计';
    const nextLabel = forOrder ? '生成订单' : '下一步：选择模板';
    const rows = p.lines.map(function (l, i) { return renderQuoteLineConfigRow(l, i); }).join('');
    const saveScheme =
      p.sourceType === 'direct' && !forOrder
        ? '<label class="sc-plan-save-scheme"><input type="checkbox" data-action="quote-save-scheme"' +
          (p.saveAsScheme ? ' checked' : '') +
          '/> 保存为方案</label>'
        : '';
    return (
      '<div class="sc-card sc-card--compact sc-card--inline-form" data-spec-id="sheet-quote-setup" data-spec-pin-root>' +
      '<div class="sc-card__head sc-card__head--compact">' + title + '</div>' +
      '<div class="sc-quote-setup-lines sc-quote-setup-lines--card">' + rows + '</div>' +
      '<p class="sc-quote-setup-total"><span>' + totalLabel + '</span>：<strong data-quote-setup-total>' +
      fmtMoney(p.total) + '</strong></p>' + saveScheme +
      '<div class="sc-card__actions-inline"><button type="button" class="sc-btn sc-btn--primary" data-action="quote-setup-next">' +
      nextLabel + '</button></div></div>'
    );
  }

  function refreshLastQuoteSetupCard() {
    const cards = document.querySelectorAll('[data-spec-id="sheet-quote-setup"]');
    const card = cards[cards.length - 1];
    if (card) card.outerHTML = renderQuoteSetupCard();
    rescanAnnotationPins();
  }

  function refreshQuoteSetupLines() {
    refreshLastQuoteSetupCard();
  }

  function syncQuotePendingFromDom() {
    const pending = ctx().quotePending;
    if (!pending) return;
    pending.lines.forEach((line, idx) => {
      const pid = line.productId;
      const qtyInp =
        document.querySelector('[data-action="quote-line-qty"][data-pid="' + pid + '"]') ||
        document.querySelector('[data-action="quote-line-qty"][data-idx="' + idx + '"]');
      const priceInp =
        document.querySelector('[data-action="quote-line-price"][data-pid="' + pid + '"]') ||
        document.querySelector('[data-action="quote-line-price"][data-idx="' + idx + '"]');
      if (qtyInp) line.qty = parseInt(qtyInp.value, 10) || 1;
      if (priceInp) {
        const v = parseFloat(priceInp.value);
        if (!isNaN(v)) {
          line.quotePrice = v;
          if (priceInp.value !== '') line._quotePriceTouched = true;
        }
      }
      syncLineCustomAttrsFromDom(line, idx);
      const pr = productById(line.productId);
      if (pr && line.customAttrs) {
        const map = {};
        line.customAttrs.forEach(function (a) {
          if (a && a.key) map[a.key] = a.value;
        });
        line.skuId = DemoData.resolveSkuFromAttrValues(pr, map);
        line.skuLabel = DemoData.skuLabelFromAttrs(pr, line.customAttrs);
        const hints = DemoData.priceHints(pr, line.skuId);
        line.latestPrice = hints.latestPrice;
        line.minPrice = hints.minPrice;
        applyQuoteLineCommercialDefaults(line, pr, { keepCustom: true });
      }
      const processSel =
        document.querySelector('[data-action="quote-line-process"][data-pid="' + pid + '"]') ||
        document.querySelector('[data-action="quote-line-process"][data-idx="' + idx + '"]');
      const taxInp =
        document.querySelector('[data-action="quote-line-tax"][data-pid="' + pid + '"]') ||
        document.querySelector('[data-action="quote-line-tax"][data-idx="' + idx + '"]');
      if (processSel) {
        line.processVersion = processSel.value;
        line._processVersionTouched = true;
      }
      if (taxInp && taxInp.value !== '') {
        const t = parseFloat(taxInp.value);
        if (!isNaN(t)) {
          line.taxRate = t;
          line._taxRateTouched = true;
        }
      }
      line.sub = (line.quotePrice || 0) * line.qty;
      line.unitPrice = line.quotePrice;
      const subEl = document.querySelector('[data-quote-sub="' + pid + '"]');
      if (subEl) subEl.textContent = fmtMoney(line.sub);
      const latestEl = document.querySelector('[data-quote-latest="' + pid + '"]');
      const minEl = document.querySelector('[data-quote-min="' + pid + '"]');
      if (latestEl) latestEl.textContent = fmtMoney(line.latestPrice);
      if (minEl) minEl.textContent = fmtMoney(line.minPrice);
      const row = document.querySelector('[data-quote-pid="' + pid + '"]');
      if (row) row.classList.toggle('sc-quote-line--warn', line.quotePrice < line.minPrice);
    });
    recalcQuotePendingTotal();
    updateQuoteSetupTotal();
    updateQuoteCartTotalInCard();
  }

  function onQuoteLineSkuChange(sel) {
    const pending = ctx().quotePending;
    if (!pending) return;
    const pid = sel.getAttribute('data-pid');
    const line = pid ? pending.lines.find((l) => l.productId === pid) : pending.lines[parseInt(sel.getAttribute('data-idx'), 10)];
    if (!line) return;
    const pr = productById(line.productId);
    line.skuId = sel.value;
    line.skuLabel = DemoData.skuLabel(pr, line.skuId);
    const hints = DemoData.priceHints(pr, line.skuId);
    line.latestPrice = hints.latestPrice;
    line.minPrice = hints.minPrice;
    if (!line._quotePriceTouched) line.quotePrice = hints.latestPrice;
    applyQuoteLineCommercialDefaults(line, pr);
    line.sub = line.quotePrice * line.qty;
    line.unitPrice = line.quotePrice;
    if (isQuoteSetupOpen()) refreshQuoteSetupLines();
    else if (document.querySelector('[data-spec-id="card-quote-cart"]')) refreshLastQuoteConfirmCard();
  }

  function updateQuoteCartTotalInCard() {
    const p = ctx().quotePending;
    const el = document.querySelector('[data-spec-id="card-quote-cart"] [data-quote-cart-total]');
    if (el && p) el.textContent = fmtMoney(p.total);
  }

  function refreshLastQuoteConfirmCard() {
    const cards = document.querySelectorAll('[data-spec-id="card-quote-cart"]');
    const card = cards[cards.length - 1];
    if (card) card.outerHTML = renderQuoteLinesConfirmCard();
    rescanAnnotationPins();
  }

  function renderQuoteLinesConfirmCard() {
    const p = ctx().quotePending;
    if (!p || !p.lines.length) return '';
    recalcQuotePendingTotal();
    const rows = p.lines.map((l, i) => renderQuoteLineConfigRow(l, i)).join('');
  const saveScheme =
      p.sourceType === 'direct'
        ? '<label class="sc-plan-save-scheme"><input type="checkbox" id="quote-save-scheme"' +
          (p.saveAsScheme ? ' checked' : '') +
          '/> 保存为方案</label>'
        : '';
    const backBtn =
      p.sourceType === 'direct'
        ? '<button type="button" class="sc-btn sc-btn--ghost" data-action="quote-back-pick">返回选品</button>'
        : '';
    return (
      '<div class="sc-card sc-card--compact" data-spec-id="card-quote-cart"><div class="sc-card__head sc-card__head--compact">报价选品确认</div>' +
      '<div class="sc-quote-setup-lines sc-quote-setup-lines--card">' +
      rows +
      '</div>' +
      '<p class="sc-quote-setup-total">报价合计：<strong data-quote-cart-total>' +
      fmtMoney(p.total) +
      '</strong></p>' +
      saveScheme +
      '<div class="sc-card__actions-inline">' +
      backBtn +
      '<button type="button" class="sc-btn sc-btn--ghost-primary" data-action="quote-to-setup">下一步：选择模板</button></div></div>'
    );
  }

  function quoteToCartFromDraft(opts) {
    opts = opts || {};
    syncPickQueryFromDom('quote');
    if (!quoteSelectedIds().length) {
      App.toast('请至少选择一种产品');
      return;
    }
    if (opts.simulateUserMsg) simulateUserUtterance(utteranceQuotePickToSetup());
    syncQuoteQtyFromDom();
    const lines = linesFromQuoteDraft(ctx().quoteDraft);
    setQuotePending(lines, {
      customerId: ctx().quoteDraft.customerId,
      sourceType: 'direct',
      saveAsScheme: !!ctx().quoteDraft.saveAsScheme
    });
    openQuoteSetupSheet();
  }

  function renderQuoteSourceCard() {
    const c = activeCustomer();
    const list = c ? schemesForCustomer(c.id) : [];
    let meta = '';
    let schemeBtnExtra = '';
    if (list.length === 1) {
      schemeBtnExtra = ' data-scheme-id="' + App.escapeHtml(list[0].id) + '"';
      meta =
        '<p class="sc-card__meta">本客户有 <strong>1</strong> 个方案，点「按方案报价」将直接载入该方案明细。</p>';
    } else if (list.length > 1) {
      meta =
        '<p class="sc-card__meta">本客户共有 <strong>' +
        list.length +
        '</strong> 个方案，按方案报价时须先选择方案。</p>';
    }
    return (
      '<div class="sc-card sc-card--compact" data-spec-id="card-quote-source"><div class="sc-card__head sc-card__head--compact">产品报价 · 选择来源</div>' +
      '<div class="sc-card__actions-inline">' +
      '<button type="button" class="sc-btn sc-btn--ghost-primary" data-action="quote-from-scheme"' +
      schemeBtnExtra +
      '>按方案报价</button>' +
      '<button type="button" class="sc-btn sc-btn--ghost-primary" data-action="quote-direct-start">直接选品报价</button></div>' +
      meta +
      '</div>'
    );
  }

  function renderQuotePickCard() {
    const d = ctx().quoteDraft;
    const forOrder = !!ctx().quotePickForOrder;
    const c = App.getCustomer(d.customerId);
    const demandMatch = quoteDemandForMatch();
    const recs = DemoData.recommendProducts(c, pickQueryValue(d), undefined, demandMatch);
    const recIds = new Set(recs.map((r) => r.product.id));
    const recRows = recs.map((r) => quotePickRow(r.product, recommendRecTagHtml(r))).join('');
    const moreSection = renderPickMoreSection(d, recIds, demandMatch, quotePickRow);
    const isOld = DemoData.isOldCustomer(c, DemoData.demoSalesUser);
    const hasDemand = !!(demandMatch && demandMatch.trim());
    const addDemandBtn =
      isOld && !hasDemand
        ? '<button type="button" class="sc-btn sc-btn--ghost" data-action="quote-add-demand">录入用户需求</button>'
        : '';
    const nextAction = forOrder ? 'quote-pick-to-order-setup' : 'quote-to-cart';
    const headTitle = forOrder ? '订单选品' : '选品报价';
    return (
      '<div class="sc-card sc-card--compact" data-spec-id="card-quote-pick"' +
      (forOrder ? ' data-order-via-quote-pick="1"' : '') +
      '><div class="sc-card__head sc-card__head--compact">' +
      headTitle +
      '</div>' +
      recommendLeadHtml(c, demandMatch) +
      renderPickQueryRow('quote') +
      '<div class="sc-follow-list sc-plan-pick-list">' +
      (recRows || pickCardEmptyHint(c)) +
      moreSection +
      '</div><div class="sc-card__actions-inline">' +
      addDemandBtn +
      '<button type="button" class="sc-btn sc-btn--ghost-primary" data-action="' +
      nextAction +
      '">下一步：逐项报价</button></div></div>'
    );
  }

  function refreshLastQuotePickCard() {
    const cards = document.querySelectorAll('[data-spec-id="card-quote-pick"]');
    const card = cards[cards.length - 1];
    if (card) card.outerHTML = renderQuotePickCard();
    scheduleQuotePickLazyBind();
    rescanAnnotationPins();
  }

  function renderQuoteCartCard() {
    return renderQuoteLinesConfirmCard();
  }

  function setQuotePending(lines, meta) {
    const enriched = (lines || []).map(function (line) {
      const pr = productById(line.productId);
      if (pr) applyQuoteLineCommercialDefaults(line, pr);
      return line;
    });
    ctx().quotePending = {
      customerId: meta.customerId,
      sourceType: meta.sourceType,
      schemeId: meta.schemeId || null,
      lines: enriched,
      total: enriched.reduce((s, l) => s + l.sub, 0),
      saveAsScheme: !!meta.saveAsScheme,
      forOrder: !!meta.forOrder
    };
  }

  function refreshQuoteSetupChrome() {
    const p = ctx().quotePending;
    const forOrder = p && p.forOrder;
    const title = App.$('#quote-setup-title');
    const desc = App.$('#quote-setup-desc');
    const totalLabel = App.$('#quote-setup-total-label');
    const nextBtn = App.$('#quote-setup-next');
    const hint = App.$('#quote-setup-voice-hint');
    const schemeRow = App.$('#quote-save-scheme-row');
    if (title) title.textContent = forOrder ? '逐项报价（下单）' : '逐项报价';
    if (desc) {
      desc.textContent = '';
      desc.classList.add('sc-hidden');
    }
    if (totalLabel) totalLabel.textContent = forOrder ? '订单金额' : '报价合计';
    if (nextBtn) nextBtn.textContent = forOrder ? '生成订单' : '下一步：选择模板';
    if (hint) {
      hint.textContent = '';
      hint.classList.add('sc-hidden');
    }
    if (schemeRow) schemeRow.classList.toggle('sc-hidden', !p || p.sourceType !== 'direct' || forOrder);
  }

  function openQuoteSetupSheet() {
    const p = ctx().quotePending;
    if (!p || !p.lines.length) {
      App.toast(p && p.forOrder ? '请先选择订单产品' : '请先选择报价明细');
      return;
    }
    pushNextAiCard(renderQuoteSetupCard());
    rescanAnnotationPins();
  }

  function renderQuoteTemplateListHtml() {
    return (DemoData.quoteTemplates || [])
      .map(function (t, i) {
        const n = i + 1;
        return (
          '<label class="sc-plan-tpl-option" data-pick-index="' +
          n +
          '"><input type="radio" name="quote-template" value="' +
          App.escapeHtml(t.id) +
          '"/><span class="sc-plan-tpl-option__name">' +
          n +
          '. ' +
          App.escapeHtml(t.name) +
          '</span><span class="sc-plan-tpl-option__desc">' +
          App.escapeHtml(t.desc) +
          '</span></label>'
        );
      })
      .join('');
  }

  function renderQuoteTemplateCard() {
    return (
      '<div class="sc-card sc-card--compact sc-card--inline-form" data-spec-id="sheet-quote-template" data-spec-pin-root>' +
      '<div class="sc-card__head sc-card__head--compact">选择报价单模板</div>' +
      '<div class="sc-plan-tpl-list">' +
      renderQuoteTemplateListHtml() +
      '</div>' +
      '<div class="sc-card__actions-inline"><button type="button" class="sc-btn sc-btn--primary" data-action="quote-template-submit">生成报价单</button></div>' +
      '</div>'
    );
  }

  function openQuoteTemplateSheet() {
    pushNextAiCard(renderQuoteTemplateCard());
    rescanAnnotationPins();
  }

  function saveSchemeFromPending(pending) {
    const c = App.getCustomer(pending.customerId);
    const mappedLines = pending.lines.map((l) => ({
        productId: l.productId,
        name: l.inventoryName,
        skuId: l.skuId,
        skuLabel: l.skuLabel,
        qty: l.qty
      }));
    const scheme = persistScheme({
      id: 'PL' + Date.now().toString().slice(-8),
      customerId: c.id,
      templateName: buildSchemeDisplayName(c, mappedLines),
      layoutTemplateName: '由报价保存',
      lines: mappedLines,
      total: 0,
      createdAt: new Date().toISOString().slice(0, 16).replace('T', ' ')
    });
    return scheme.id;
  }

  /** 新建报价：无方案则直进选品报价卡，否则出报价来源卡 */
  function beginQuoteCreate(opts) {
    opts = opts || {};
    setQuoteSkillAtEntry(false);
    const c = requireCustomer('quote');
    if (!c) return;
    enterSkill('quote');
    ctx().quotePickForOrder = false;
    delete ctx().quotePending;
    resetQuoteDraftForCreate(c);
    if (!schemesForCustomer(c.id).length) {
      quoteDirectStart({ leadHtml: opts.leadHtml });
      return;
    }
    if (opts.leadHtml) App.pushAiHtml(opts.leadHtml);
    App.pushAiHtml(renderQuoteSourceCard());
    rescanAnnotationPins();
  }

  function pushQuoteEntry(leadHtml) {
    beginQuoteCreate({ leadHtml: leadHtml != null ? leadHtml : null });
  }

  function runQuote() {
    showQuoteSkillEntry();
  }

  function publishQuoteFromSchemeDemand(scheme, demandText) {
    const c = App.getCustomer(scheme.customerId);
    if (!c) return;
    let lines = linesFromScheme(scheme);
    if (!lines.length) {
      App.toast('方案明细为空');
      return;
    }
    const rate = applyDiscountToQuoteLines(lines, demandText || '');
    App.pushAiHtml(
      '<p class="sc-reply-lead">已按方案 <strong>' +
        App.escapeHtml(scheme.id) +
        '</strong> 生成报价单' +
        (rate < 1 ? '（已应用折扣）' : '') +
        '。</p>'
    );
    publishQuoteCard(
      {
        customerId: c.id,
        sourceType: 'scheme',
        schemeId: scheme.id,
        lines: lines,
        saveAsScheme: false
      },
      'qt-standard'
    );
  }

  function quoteFromScheme(schemeId) {
    const c = requireCustomer();
    if (!c) return;
    const list = schemesForCustomer(c.id);
    if (!list.length) {
      quoteDirectStart();
      return;
    }
    const sid = schemeId || null;
    if (!sid && list.length > 1) {
      pushSchemePickForQuote(
        c,
        '<p class="sc-reply-lead">请<strong>选择要报价的方案</strong>（展示方案名称）：</p>'
      );
      return;
    }
    const scheme = schemeForActiveCustomer(sid || list[0].id);
    if (!scheme) {
      App.toast('未找到所选方案');
      return;
    }
    persistScheme(scheme);
    enterSkill('quote');
    const lines = linesFromScheme(scheme);
    if (!lines.length) {
      App.toast('方案明细为空');
      return;
    }
    setQuotePending(lines, { customerId: c.id, sourceType: 'scheme', schemeId: scheme.id });
    App.pushAiHtml(renderQuoteLinesConfirmCard());
    rescanAnnotationPins();
  }

  function quoteDirectStart(opts) {
    opts = opts || {};
    const c = ensureQuoteDraft();
    if (!c) return;
    enterSkill('quote');
    ctx().quotePickForOrder = !!opts.forOrder;
    if (maybeQuoteDemandBeforePick(c, { leadHtml: opts.leadHtml })) return;
    if (opts.simulateUserMsg) {
      simulateUserUtterance(opts.forOrder ? '直接选品下单' : '直接选品报价');
    }
    App.pushAiHtml(renderQuotePickCard());
    scheduleQuotePickLazyBind();
    rescanAnnotationPins();
  }

  /** 下单直选：无报价单时进入选品报价卡（下单模式） */
  function quotePickToOrderSetup(opts) {
    opts = opts || {};
    if (!ensureQuoteDraft()) return;
    syncPickQueryFromDom('quote');
    if (!quoteSelectedIds().length) {
      guideMissingSlot('orderPickProducts');
      return;
    }
    if (opts.simulateUserMsg) simulateUserUtterance(utteranceOrderPickToSetup());
    enterSkill('order');
    ctx().quotePickForOrder = true;
    const lines = linesFromQuoteDraft(ctx().quoteDraft);
    setQuotePending(lines, {
      customerId: ctx().quoteDraft.customerId,
      sourceType: 'direct',
      saveAsScheme: false,
      forOrder: true
    });
    openQuoteSetupSheet();
  }

  function quoteToSetupFromDraft(opts) {
    opts = opts || {};
    if (opts.simulateUserMsg) simulateUserUtterance('生成报价单');
    syncQuotePendingFromDom();
    const pending = ctx().quotePending;
    if (!pending || !pending.lines.length) {
      App.toast('请先确认报价明细');
      return;
    }
    const saveCb = document.getElementById('quote-save-scheme');
    if (saveCb && pending.sourceType === 'direct') pending.saveAsScheme = saveCb.checked;
    const bad = pending.lines.find((l) => !l.quotePrice || l.quotePrice <= 0);
    if (bad) {
      guideMissingSlot('quoteLinePrice');
      return;
    }
    const commercial = validateQuoteLineCommercial(pending);
    if (!commercial.ok) {
      if (commercial.reason === 'process') {
        App.toast('请为每项选择工艺版本');
        return;
      }
      if (commercial.reason === 'tax') {
        App.toast('请为每项填写税率');
        return;
      }
    }
    pending.totalAfterDiscount = pending.total;
    openQuoteTemplateSheet();
  }

  function quoteSetupNext(opts) {
    opts = opts || {};
    syncQuotePendingFromDom();
    const pending = ctx().quotePending;
    if (!pending) return;
    if (opts.simulateUserMsg !== false) {
      simulateUserUtterance(
        pending.forOrder ? '确认下单' : '下一步：选择模板'
      );
    }
    const bad = pending.lines.find((l) => !l.quotePrice || l.quotePrice <= 0);
    if (bad) {
      App.toast('请为每项产品填写本单报价');
      return;
    }
    const commercial = validateQuoteLineCommercial(pending);
    if (!commercial.ok) {
      if (commercial.reason === 'process') {
        App.toast('请为每项选择工艺版本');
        return;
      }
      if (commercial.reason === 'tax') {
        App.toast('请为每项填写税率');
        return;
      }
    }
    const saveSheet = getActiveFormCard('sheet-quote-setup');
    const saveCb = saveSheet && saveSheet.querySelector('[data-action="quote-save-scheme"]');
    if (pending.sourceType === 'direct' && saveCb) pending.saveAsScheme = saveCb.checked;
    pending.totalAfterDiscount = pending.total;

    if (pending.forOrder) {
      if (pending.saveAsScheme && pending.sourceType === 'direct') saveSchemeFromPending(pending);
      setOrderPending(pending.lines, {
        customerId: pending.customerId,
        sourceType: 'direct',
        quoteId: null,
        total: pending.total,
        saveAsScheme: false
      });
      ctx().quotePending = null;
      ctx().orderDraft = null;
      showOrderConfirm();
      return;
    }

    openQuoteTemplateSheet();
  }

  function submitQuote(opts) {
    opts = opts || {};
    const card = getActiveFormCard('sheet-quote-template');
    const picked = card
      ? card.querySelector('input[name="quote-template"]:checked')
      : document.querySelector('input[name="quote-template"]:checked');
    if (!picked) {
      App.toast('请选择报价单模板');
      return;
    }
    if (opts.simulateUserMsg !== false) simulateUserUtterance('生成报价单');
    syncQuotePendingFromDom();
    const pending = ctx().quotePending;
    if (!pending || !pending.lines.length) {
      App.toast('报价明细为空');
      return;
    }
    const commercial = validateQuoteLineCommercial(pending);
    if (!commercial.ok) {
      if (commercial.reason === 'process') {
        App.toast('请为每项选择工艺版本');
        return;
      }
      if (commercial.reason === 'tax') {
        App.toast('请为每项填写税率');
        return;
      }
    }
    publishQuoteCard(pending, picked.value);
  }

  function submitQuoteTemplate(opts) {
    submitQuote(opts);
  }

  function runDelivery() {
    const c = activeCustomer() || requireCustomer('delivery');
    if (!c) return;
    setDeliverySkillAtEntry(false);
    enterSkill('delivery');
    App.pushAiHtml(renderDeliverySourceCard(c));
    rescanAnnotationPins();
  }

  function deliveryLinesForReview(meta) {
    if (!meta) return [];
    if (meta.lines && meta.lines.length) return meta.lines;
    if (meta.sourceType === 'quote' && meta.quoteId) {
      const q =
        (ctx().quote && ctx().quote.id === meta.quoteId ? ctx().quote : null) ||
        (DemoData.quotes || []).find(function (x) {
          return x.id === meta.quoteId;
        });
      return (q && q.lines) || [];
    }
    if (meta.sourceType === 'order' && meta.orderId) {
      const o = DemoData.orders.find(function (x) {
        return x.id === meta.orderId;
      });
      if (o && o.lines && o.lines.length) return o.lines;
      if (o && o.productIds) {
        return o.productIds
          .map(function (pid) {
            const pr = productById(pid);
            if (!pr) return null;
            return makeQuoteLine(pr, { qty: 1 });
          })
          .filter(Boolean);
      }
    }
    return [];
  }

  function evaluateDeliveryLineReview(line, planDates, meta) {
    const expectedDate = line.expectedDate || '';
    const reverseSchedule = meta && meta.reverseSchedule != null ? !!meta.reverseSchedule : false;
    const compareDate = reverseSchedule ? planDates.start : planDates.end;
    const fmt = function (d) {
      return (d || '').replace(/-/g, '/');
    };
    
    // 判断异常类型 - 只有明确标记为异常时才认为有问题
    const hasMaterialIssue = line.materialStatus === 'shortage' || line.materialReady === false;
    const hasCapacityIssue = line.capacityStatus === 'overload' || line.capacityReady === false;
    const onTime = expectedDate && new Date(expectedDate) >= new Date(compareDate);
    
    // 生成详情说明文案
    let detail = '';
    if (onTime) {
      // status = 按期：直接显示评估通过
      detail = '【评估通过】起止时间满足客户交期，物料充足、产能空闲，可锁定排程按期投产。';
    } else {
      // status = 交期异常：根据异常原因展示
      if (hasMaterialIssue && !hasCapacityIssue) {
        // 仅物料异常
        detail = '【物料异常】部分核心物料缺货，预计实际结束时间时间为' + fmt(planDates.end) + '，建议调整方案';
      } else if (!hasMaterialIssue && hasCapacityIssue) {
        // 仅产能异常
        detail = '【产能异常】产线当前时段超负荷，预计实际结束时间为' + fmt(planDates.end) + '，建议调整方案';
      } else if (hasMaterialIssue && hasCapacityIssue) {
        // 双重异常
        detail = '【物料异常】【产能异常】：存在物料缺货，且产线当前超负荷，预计实际结束时间' + fmt(planDates.end) + '超出客户要求交期，建议调整方案';
      } else {
        // 无明确异常标记（兜底）
        detail = '【物料异常】部分核心物料缺货，预计实际结束时间时间为' + fmt(planDates.end) + '，建议调整方案';
      }
    }
    
    return {
      inventoryName: line.inventoryName || '—',
      freeAttrsText: deliveryLineFreeAttrsText(line),
      qtyText: deliveryLineQtyText(line),
      processVersion: line.processVersion || '标准版',
      expectedDate: expectedDate,
      onTime: onTime,
      status: onTime ? '按期' : '交期异常',
      detail: detail
    };
  }

  function evaluateDeliveryReview(input) {
    input = input || {};
    const lines = input.lines || [];
    const meta = input.meta || {};
    const planDates = {
      start: input.planStartDate || '',
      end: input.planEndDate || ''
    };
    const lineResults = lines.map(function (line) {
      return evaluateDeliveryLineReview(line, planDates, meta);
    });
    const onTime = lineResults.length ? lineResults.every(function (r) {
      return r.onTime;
    }) : false;
    const fmt = function (d) {
      return (d || '').replace(/-/g, '/');
    };
    let detail = '';
    if (onTime) {
      detail = '全部货品可按期望交期交付';
    } else {
      const firstLate = lineResults.find(function (r) {
        return !r.onTime;
      });
      detail =
        (firstLate && firstLate.detail) ||
        '部分物料缺货，建议延后至 ' + fmt(planDates.end) + ' 或调整方案';
    }

    return {
      onTime: onTime,
      status: onTime ? '按期' : '交期异常',
      verdict: onTime ? '可以按时交付' : '无法按时交付',
      detail: detail,
      lineResults: lineResults
    };
  }

  function renderDeliveryResultLinesHtml(lineResults) {
    lineResults = lineResults || [];
    if (!lineResults.length) return '';
    
    // 状态标签样式化处理
    const formatDetail = function(detail) {
      if (!detail) return '';
      // 替换状态标签为带样式的span
      let formatted = detail
        .replace(/【评估通过】/g, '<span class="sc-delivery-result__status-tag sc-delivery-result__status-tag--ok">评估通过</span>')
        .replace(/【物料异常】/g, '<span class="sc-delivery-result__status-tag sc-delivery-result__status-tag--material">物料异常</span>')
        .replace(/【产能异常】/g, '<span class="sc-delivery-result__status-tag sc-delivery-result__status-tag--capacity">产能异常</span>');
      return formatted;
    };
    
    const rows = lineResults
      .map(function (r) {
        const badge = r.onTime ? 'sc-badge--new' : 'sc-badge--old';
        const status = r.status || (r.onTime ? '按期' : '交期异常');
        const fmt = function (v) {
          return App.escapeHtml((v || '').replace(/-/g, '/'));
        };
        
        // 判断详情区域样式
        let detailClass = 'sc-delivery-result__line-detail';
        if (r.detail && r.detail.includes('评估通过')) {
          detailClass += ' sc-delivery-result__line-detail--success';
        } else if (r.detail && (r.detail.includes('物料异常') || r.detail.includes('产能异常'))) {
          detailClass += ' sc-delivery-result__line-detail--warning';
        }
        
        return (
          '<div class="sc-delivery-result__line">' +
          '<div class="sc-delivery-result__line-head">' +
          '<strong>' +
          App.escapeHtml(r.inventoryName || '—') +
          '</strong>' +
          '<span class="sc-badge ' +
          badge +
          '">' +
          App.escapeHtml(status) +
          '</span></div>' +
          '<p class="sc-card__meta sc-delivery-result__line-meta">' +
          App.escapeHtml(r.freeAttrsText || '—') +
          '</p>' +
          '<p class="sc-card__meta sc-delivery-result__line-qty">' +
          '数量 ' +
          App.escapeHtml(r.qtyText || '—') +
          '</p>' +
          '<p class="sc-card__meta sc-delivery-result__line-process">' +
          '工艺版本 ' +
          App.escapeHtml(r.processVersion || '标准版') +
          '</p>' +
          '<p class="sc-card__meta sc-delivery-result__line-date">' +
          '期望交期 ' +
          fmt(r.expectedDate) +
          '</p>' +
          '<div class="' + detailClass + '">' +
          formatDetail(r.detail || '') +
          '</div></div>'
        );
      })
      .join('');
    return '<div class="sc-delivery-result__lines">' + rows + '</div>';
  }

function renderDeliveryResultCard(delivery) {
    const d = delivery || ctx().delivery || {};
    const src = d.sourceType || 'quote';
    const byOrder = src === 'order';
    const lineResults = d.lineResults || [];
    const bodyHtml = renderDeliveryResultLinesHtml(lineResults);

    let primaryBtn = '';
    let secondaryBtn = '';
    if (!byOrder) {
      primaryBtn =
        '<button type="button" class="sc-btn sc-btn--ghost-primary" data-action="delivery-to-order">下单</button>';
    }
    secondaryBtn =
      '<button type="button" class="sc-btn sc-btn--ghost" data-action="delivery-adjust">调整方案</button>';

    return (
      '<div class="sc-card sc-card--delivery-result" data-spec-id="card-delivery">' +
      '<div class="sc-card__head sc-card__head--compact">交期评审</div>' +
      '<div class="sc-card__row sc-card__row--compact sc-card__row--delivery-result">' +
      bodyHtml +
      '<div class="sc-card__actions-inline sc-card__actions-inline--delivery-result">' +
      primaryBtn +
      secondaryBtn +
      '</div></div></div>'
    );
  }

  function submitDelivery() {
    const el = getActiveFormCard('sheet-delivery');
    const meta = ctx().deliveryPending || {};
    const expectedInp = el && el.querySelector('[data-field="delivery-expected-date"]');
    const formExpectedDate = expectedInp ? expectedInp.value : '';
    const reverseFormEl =
      el && el.querySelector('input[name="delivery-reverse-schedule"]:checked');
    if (reverseFormEl) {
      meta.reverseSchedule = reverseFormEl.value === 'yes';
    }
    const planDates = defaultDeliveryPlanDates();
    const planStartDate = planDates.start;
    const planEndDate = planDates.end;
    syncDeliveryPendingLinesFromDom(el);
    const reviewLines = enrichOrderLines(meta.lines || deliveryLinesForReview(meta));
    reviewLines.forEach(function (line) {
      if (!line.expectedDate) line.expectedDate = formExpectedDate;
      ensureDeliveryLineReviewDefaults(line, meta);
    });
    meta.lines = reviewLines;
    const missingProcess = reviewLines.find(function (l) {
      return !l.processVersion || !String(l.processVersion).trim();
    });
    if (missingProcess) {
      App.toast('评审数据异常，请重试');
      return;
    }
    const missingDate = reviewLines.find(function (l) {
      return !l.expectedDate;
    });
    if (!formExpectedDate && missingDate) {
      App.toast('请选择期望交期');
      return;
    }
    if (missingDate) {
      App.toast('请为每项选择期望交期');
      return;
    }
    meta.expectedDate = formExpectedDate || reviewLines[0].expectedDate || '';
    const review = evaluateDeliveryReview({
      planStartDate: planStartDate,
      planEndDate: planEndDate,
      lines: reviewLines,
      meta: meta
    });
    ctx().delivery = {
      sourceType: meta.sourceType || 'quote',
      schemeId: meta.schemeId || null,
      quoteId: meta.quoteId || null,
      orderId: meta.orderId || null,
      lines: reviewLines,
      expectedDate: meta.expectedDate,
      reverseSchedule: meta.reverseSchedule != null ? !!meta.reverseSchedule : false,
      planStartDate: planStartDate,
      planEndDate: planEndDate,
      onTime: review.onTime,
      status: review.status,
      verdict: review.verdict,
      detail: review.detail,
      lineResults: review.lineResults,
      summary: deliverySummaryLabel(meta),
      confirmed: true
    };
    ctx().deliveryPending = null;
    ctx().deliveryLinesMode = false;
    App.closeOverlays();
    App.pushAiHtml(renderDeliveryResultCard(ctx().delivery));
    rescanAnnotationPins();
  }


  function renderOrderTimelineHtml(order) {
    const nodes = (order && order.timeline) || [];
    if (!nodes.length) {
      return '<p class="sc-card__meta">暂无进度节点</p>';
    }
    const items = nodes
      .map(function (n) {
        const cls = ['sc-timeline__item'];
        if (n.done) cls.push('sc-timeline__item--done');
        if (n.current) cls.push('sc-timeline__item--current');
        if (n.error) cls.push('sc-timeline__item--error');
        return (
          '<li class="' +
          cls.join(' ') +
          '"><span class="sc-timeline__dot"></span><div class="sc-timeline__body"><strong>' +
          App.escapeHtml(n.label) +
          '</strong>' +
          (n.at ? '<span class="sc-timeline__at">' + App.escapeHtml(n.at) + '</span>' : '') +
          '</div></li>'
        );
      })
      .join('');
    return '<ol class="sc-timeline">' + items + '</ol>';
  }

function orderProgressSalesperson(o) {
    if (o && o.salesperson) return o.salesperson;
    return DemoData.demoSalesUser || DemoData.salesperson || '—';
  }

  function orderProgressWorkStatus(o) {
    return (o && o.workOrderStatus) || '未排程';
  }

  function orderProgressShipDate(o) {
    if (!o) return '—';
    return o.shipDate || o.requiredDeliveryDate || o.date || '—';
  }

  function orderProgressDetailLines(o) {
    const base =
      o && o.lines && o.lines.length ? o.lines.slice() : linesFromHistoricalOrder(o);
    return base.map(function (line, idx) {
      const status = line.productionStatus || '待排程';
      const workProcesses = generateWorkProcessesForLine(status, line.qty || 1);
      return {
        idx: idx + 1,
        inventoryName: line.inventoryName || '—',
        inventorySpec: line.inventorySpec || line.skuLabel || formatOrderLineSpec(line) || '—',
        qty: line.qty || 1,
        salesUnit: line.salesUnit || '件',
        productionStatus: status,
        workProcesses: workProcesses
      };
    });
  }

  function generateWorkProcessesForLine(status, qty) {
    const processes = [
      { name: 'CNC工序', key: 'cnc' },
      { name: '组装工序', key: 'assemble' },
      { name: '质检工序', key: 'qc' },
      { name: '包装工序', key: 'pack' }
    ];
    const progressMap = {
      '待排程': { cnc: 0, assemble: 0, qc: 0, pack: 0 },
      '已排程': { cnc: 30, assemble: 0, qc: 0, pack: 0 },
      '待发料': { cnc: 50, assemble: 0, qc: 0, pack: 0 },
      '已发料': { cnc: 100, assemble: 60, qc: 0, pack: 0 },
      '已生产': { cnc: 100, assemble: 100, qc: 100, pack: 80 }
    };
    const progress = progressMap[status] || { cnc: 0, assemble: 0, qc: 0, pack: 0 };
    return processes.map(function (p) {
      const rate = progress[p.key] || 0;
      const dispatched = Math.round(qty * (rate / 100) * 1.2);
      const reported = Math.round(qty * (rate / 100));
      return {
        name: p.name,
        key: p.key,
        totalQty: qty,
        dispatchedQty: Math.min(dispatched, qty),
        reportedQty: Math.min(reported, qty),
        rate: rate
      };
    });
  }

  function renderOrderProgressStatusBadge(status) {
    const statusClass = {
      '待排程': 'sc-badge--default',
      '已排程': 'sc-badge--primary',
      '待发料': 'sc-badge--warning',
      '已发料': 'sc-badge--info',
      '已生产': 'sc-badge--success'
    }[status] || 'sc-badge--default';
    return '<span class="sc-badge ' + statusClass + '">' + App.escapeHtml(status) + '</span>';
  }

  function renderWorkProcessFlow(workProcesses) {
    if (!workProcesses || !workProcesses.length) {
      return '';
    }
    const nodes = workProcesses.map(function (process, idx) {
      const rate = process.rate || 0;
      return (
        '<div class="sc-progress-workflow__node">' +
        '<div class="sc-progress-workflow__node-header">' +
        App.escapeHtml(process.name) +
        '</div>' +
        '<div class="sc-progress-workflow__node-body">' +
        '<div class="sc-progress-workflow__item">生产总量: ' + process.totalQty + '</div>' +
        '<div class="sc-progress-workflow__item">已派工: ' + process.dispatchedQty + '</div>' +
        '<div class="sc-progress-workflow__item">已汇报: ' + process.reportedQty + '</div>' +
        '<div class="sc-progress-workflow__item">完成率: ' + rate + '%</div>' +
        '</div>' +
        '<div class="sc-progress-workflow__progress" style="width:' + rate + '%"></div>' +
        '</div>' +
        (idx < workProcesses.length - 1 ? '<div class="sc-progress-workflow__arrow">→</div>' : '')
      );
    }).join('');
    return (
      '<div class="sc-progress-workflow-wrapper">' +
      '<div class="sc-progress-workflow">' +
      '<div class="sc-progress-workflow__start">' +
      '<div class="sc-progress-workflow__start-label">开始</div>' +
      '</div>' +
      '<div class="sc-progress-workflow__arrow">→</div>' +
      '<div class="sc-progress-workflow__nodes">' +
      nodes +
      '</div>' +
      '</div>' +
      '</div>'
    );
  }

  function toggleProgressWorkflow(idx) {
    const workflow = document.getElementById('workflow-' + idx);
    const toggleBtn = document.querySelector('[data-action="progress-workflow-toggle"][data-item-idx="' + idx + '"]');
    if (workflow && toggleBtn) {
      const icon = toggleBtn.querySelector('.sc-progress-detail__toggle-icon');
      if (workflow.classList.contains('sc-progress-detail__item-workflow--expanded')) {
        workflow.classList.remove('sc-progress-detail__item-workflow--expanded');
        if (icon) icon.textContent = '▶';
      } else {
        workflow.classList.add('sc-progress-detail__item-workflow--expanded');
        if (icon) icon.textContent = '▼';
      }
    }
  }

  function renderOrderProgressStatusSummary(lines) {
    const statusCounts = {
      '待排程': 0,
      '已排程': 0,
      '待发料': 0,
      '已发料': 0,
      '已生产': 0
    };
    lines.forEach(function (line) {
      const status = line.productionStatus || '待排程';
      if (statusCounts[status] != null) {
        statusCounts[status]++;
      }
    });
    const total = lines.length;
    const statusItems = ['待排程', '已排程', '待发料', '已发料', '已生产']
      .map(function (status) {
        const count = statusCounts[status];
        const isActive = count > 0;
        return (
          '<div class="sc-progress-detail__summary-item' + (isActive ? ' sc-progress-detail__summary-item--active' : '') + '">' +
          '<span class="sc-progress-detail__summary-label">' + App.escapeHtml(status) + '</span>' +
          '<span class="sc-progress-detail__summary-count">' + count + '</span>' +
          '</div>'
        );
      })
      .join('');
    return (
      '<div class="sc-progress-detail__summary">' +
      '<p class="sc-progress-detail__summary-title">生产进度概览</p>' +
      '<p class="sc-progress-detail__summary-total">总货品数：' + total + ' 项</p>' +
      '<div class="sc-progress-detail__summary-stats">' +
      statusItems +
      '</div>' +
      '</div>'
    );
  }

  function renderOrderProgressItemList(lines) {
    if (!lines.length) {
      return '<p class="sc-card__meta sc-progress-detail__items-empty">暂无货品</p>';
    }
    const rows = lines
      .map(function (row) {
        const flowContent = renderWorkProcessFlow(row.workProcesses);
        return (
          '<li class="sc-progress-detail__item">' +
          '<div class="sc-progress-detail__item-row">' +
          '<span class="sc-progress-detail__item-idx">' + row.idx + '</span>' +
          '<div class="sc-progress-detail__item-info">' +
          '<span class="sc-progress-detail__item-name">' +
          App.escapeHtml(row.inventoryName) +
          '</span>' +
          '<span class="sc-progress-detail__item-spec">' +
          App.escapeHtml(row.inventorySpec) +
          '</span>' +
          '</div>' +
          '<span class="sc-progress-detail__item-qty">' +
          row.qty + App.escapeHtml(row.salesUnit) +
          '</span>' +
          '<span class="sc-progress-detail__item-status">' +
          renderOrderProgressStatusBadge(row.productionStatus) +
          '</span>' +
          '<button type="button" class="sc-progress-detail__item-toggle" data-action="progress-workflow-toggle" data-item-idx="' + row.idx + '">' +
          '<span class="sc-progress-detail__toggle-icon">▶</span>' +
          '</button>' +
          '</div>' +
          '<div class="sc-progress-detail__item-workflow" id="workflow-' + row.idx + '">' +
          flowContent +
          '</div>' +
          '</li>'
        );
      })
      .join('');
    return (
      '<div class="sc-progress-detail__items">' +
      '<p class="sc-progress-detail__items-title">货品生产状态（' +
      lines.length +
      ' 项）</p>' +
      '<ul class="sc-progress-detail__item-list">' +
      rows +
      '</ul></div>'
    );
  }

  function renderOrderProgressDetailCard(o) {
    if (!o) return '';
    const lines = orderProgressDetailLines(o);
    return (
      '<div class="sc-card sc-card--compact sc-card--progress-detail" data-spec-id="card-order-progress-detail" data-oid="' +
      App.escapeHtml(o.id) +
      '">' +
      '<div class="sc-card__head sc-card__head--compact">订单进度 · ' +
      App.escapeHtml(o.no) +
      ' ' +
      orderStatusBadgeHtml(o.status) +
      '</div>' +
      renderOrderProgressStatusSummary(lines) +
      renderOrderProgressItemList(lines) +
      '<div class="sc-card__actions-inline">' +
      '<button type="button" class="sc-btn sc-btn--ghost" data-action="progress-repick-order">重选订单</button></div>' +
      '</div>'
    );
  }

  function openOrderProgressDetail(oid, opts) {
    opts = opts || {};
    const o = DemoData.orders.find(function (x) {
      return x.id === oid;
    });
    if (!o) {
      App.toast('未找到订单');
      return;
    }
    enterSkill('progress');
    ctx().progressPickMode = false;
    clearActivePickList();
    if (opts.simulateUserMsg) {
      simulateUserUtterance('查看订单 ' + o.no + ' 进度');
    }
    App.pushAiHtml(
      '<p class="sc-reply-lead">订单 <strong>' +
        App.escapeHtml(o.no) +
        '</strong> 进度详情如下：</p>' +
        renderOrderProgressDetailCard(o)
    );
    rescanAnnotationPins();
  }

  function pushOrderProgressDetail(o) {
    if (!o) return;
    openOrderProgressDetail(o.id, { simulateUserMsg: true });
  }

  function handleDeliveryToOrder() {
    const d = ctx().delivery;
    if (!d || !d.confirmed) {
      App.toast('交期评审数据缺失，请重新提交评审');
      return;
    }
    enterSkill('order');
    const linesFromDelivery = d.lines && d.lines.length ? enrichOrderLines(d.lines) : null;
    if (d.sourceType === 'quote' && d.quoteId) {
      const q =
        (ctx().quote && ctx().quote.id === d.quoteId ? ctx().quote : null) ||
        (DemoData.quotes || []).find(function (x) {
          return x.id === d.quoteId;
        });
      if (q) {
        const lines = linesFromDelivery || enrichOrderLines(q.lines || []);
        setOrderPending(lines, {
          customerId: q.customerId,
          sourceType: 'quote',
          quoteId: q.id,
          total: lines.reduce(function (s, l) {
            return s + (l.sub || 0);
          }, q.total)
        });
        showOrderConfirm();
        return;
      }
    }
    if (d.sourceType === 'lines' && linesFromDelivery && linesFromDelivery.length) {
      setOrderPending(linesFromDelivery, {
        customerId: (activeCustomer() || {}).id,
        sourceType: 'direct',
        quoteId: null,
        total: linesFromDelivery.reduce(function (s, l) {
          return s + (l.sub || 0);
        }, 0)
      });
      showOrderConfirm();
      return;
    }
    if (d.sourceType === 'order' && d.orderId) {
      const o = DemoData.orders.find(function (x) {
        return x.id === d.orderId;
      });
      if (o) {
        const lines =
          linesFromDelivery ||
          enrichOrderLines(
            (o.lines && o.lines.length ? o.lines : null) ||
              (o.productIds || [])
                .map(function (pid) {
                  const pr = productById(pid);
                  if (!pr) return null;
                  return makeQuoteLine(pr, { qty: 1 });
                })
                .filter(Boolean)
          );
        if (lines.length) {
          setOrderPending(lines, {
            customerId: o.customerId,
            sourceType: 'direct',
            quoteId: o.quoteId || null,
            total:
              parseFloat(String(o.amount || '0').replace(/[^\d.]/g, '')) ||
              lines.reduce(function (s, l) {
                return s + (l.sub || 0);
              }, 0)
          });
          showOrderConfirm();
          return;
        }
      }
    }
    showOrderSkillEntry();
  }

  function handleDeliveryToProgress(oid) {
    const d = ctx().delivery;
    const c = activeCustomer();
    const targetOid =
      oid || (d && d.orderId) || (c && ordersForCustomer(c.id)[0] && ordersForCustomer(c.id)[0].id);
    enterSkill('progress');
    if (targetOid) {
      const o = DemoData.orders.find(function (x) {
        return x.id === targetOid;
      });
      if (o) {
        pushOrderProgressDetail(o);
        return;
      }
    }
    runProgress();
  }

  function ensureOrderDraft(customer) {
    const c = customer || requireCustomer();
    if (!c) return null;
    if (!ctx().orderDraft || ctx().orderDraft.customerId !== c.id) {
      ctx().orderDraft = {
        customerId: c.id,
        filter: '',
        demandText: initialOrderDemandText(c),
        awaitingDemand: false,
        selected: {},
        sku: {},
        qty: {},
        saveAsScheme: false,
        moreVisible: PLAN_MORE_PAGE_SIZE
      };
    }
    if (ctx().orderDraft.moreVisible == null) ctx().orderDraft.moreVisible = PLAN_MORE_PAGE_SIZE;
    if (ctx().orderDraft.demandText == null) ctx().orderDraft.demandText = '';
    if (ctx().orderDraft.awaitingDemand == null) ctx().orderDraft.awaitingDemand = false;
    return c;
  }

  function orderSelectedIds() {
    const d = ctx().orderDraft;
    return d ? Object.keys(d.selected || {}).filter((k) => d.selected[k]) : [];
  }

  function syncOrderQtyFromDom() {
    document.querySelectorAll('[data-action="order-qty"]').forEach((inp) => {
      const id = inp.getAttribute('data-pid');
      if (id && ctx().orderDraft) ctx().orderDraft.qty[id] = parseInt(inp.value, 10) || 1;
    });
  }

  function orderSelectProduct(pid, on) {
    const pr = productById(pid);
    if (!pr) return;
    const d = ctx().orderDraft;
    d.selected[pid] = on !== false;
    if (d.selected[pid]) {
      d.qty[pid] = d.qty[pid] || 1;
      d.sku[pid] = d.sku[pid] || DemoData.defaultSkuId(pr);
    }
  }

  function renderOrderSkuSelect(product, pid) {
    const cur = ctx().orderDraft.sku[pid] || DemoData.defaultSkuId(product);
    const opts = (product.skus || [])
      .map((s) => '<option value="' + s.id + '"' + (s.id === cur ? ' selected' : '') + '>' + App.escapeHtml(s.label) + '</option>')
      .join('');
    return '<label class="sc-plan-sku-label">规格 <select class="sc-plan-sku-select" data-action="order-sku" data-pid="' + pid + '" onclick="event.stopPropagation()">' + opts + '</select></label>';
  }

  function linesFromOrderDraft(draft) {
    return orderSelectedIds()
      .map((pid) => {
        const pr = productById(pid);
        if (!pr) return null;
        return makeQuoteLine(pr, {
          skuId: draft.sku[pid] || DemoData.defaultSkuId(pr),
          qty: draft.qty[pid] || 1
        });
      })
      .filter(Boolean);
  }

  function orderToQuoteSetupFromDraft(opts) {
    opts = opts || {};
    syncPickQueryFromDom('order');
    if (!orderSelectedIds().length) {
      App.toast('请至少选择一种产品');
      return;
    }
    if (opts.simulateUserMsg) simulateUserUtterance(utteranceOrderPickToSetup());
    syncOrderQtyFromDom();
    const saveCb = document.getElementById('order-save-scheme');
    if (saveCb) ctx().orderDraft.saveAsScheme = saveCb.checked;
    enterSkill('order');
    const lines = linesFromOrderDraft(ctx().orderDraft);
    setQuotePending(lines, {
      customerId: ctx().orderDraft.customerId,
      sourceType: 'direct',
      saveAsScheme: !!ctx().orderDraft.saveAsScheme,
      forOrder: true
    });
    openQuoteSetupSheet();
  }

  /** @deprecated 命名保留，行为同 orderToQuoteSetupFromDraft */
  function orderToCartFromDraft() {
    orderToQuoteSetupFromDraft();
  }

  function renderOrderSourceCard() {
    const c = activeCustomer();
    const list = c ? quotesForCustomer(c.id) : [];
    let meta = '';
    let quoteBtnExtra = '';
    if (list.length === 1) {
      quoteBtnExtra = ' data-quote-id="' + App.escapeHtml(list[0].id) + '"';
      meta =
        '<p class="sc-card__meta">本客户有 <strong>1</strong> 份报价单，点「按报价单」将直接载入该报价明细。</p>';
    } else if (list.length > 1) {
      meta =
        '<p class="sc-card__meta">本客户共有 <strong>' +
        list.length +
        '</strong> 份报价单，按报价单下单时须先选择。</p>';
    }
    return (
      '<div class="sc-card sc-card--compact" data-spec-id="card-order-source"><div class="sc-card__head sc-card__head--compact">确认下单 · 选择来源</div>' +
      '<div class="sc-card__actions-inline">' +
      '<button type="button" class="sc-btn sc-btn--ghost-primary" data-action="order-from-quote"' +
      quoteBtnExtra +
      '>按报价单</button>' +
      '<button type="button" class="sc-btn sc-btn--ghost-primary" data-action="order-direct-start">直接选品</button></div>' +
      meta +
      '</div>'
    );
  }

  function renderOrderProductPickCard(opts) {
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
  }

  function renderOrderProductCartCard() {
    syncOrderQtyFromDom();
    const d = ctx().orderDraft;
    const rows = orderSelectedIds().map((pid) => {
      const pr = productById(pid);
      return '<div class="sc-plan-cart-row"><span class="sc-follow-row__name">' + App.escapeHtml(pr.name) + '</span>' + renderOrderSkuSelect(pr, pid) +
        '<label class="sc-qty-inline">数量 <input type="number" min="1" value="' + (d.qty[pid] || 1) + '" data-action="order-qty" data-pid="' + pid + '" class="sc-qty-input"/></label></div>';
    }).join('');
    const deliveryLines = !!ctx().deliveryLinesMode;
    const headTitle = deliveryLines ? '交期明细' : '订单购物车';
    const nextAction = deliveryLines ? 'delivery-lines-confirm' : 'order-to-quote-setup';
    const nextLabel = deliveryLines ? '确认，评估交期' : '下一步：逐项报价';
    const schemeRow = deliveryLines
      ? ''
      : '<label class="sc-plan-save-scheme"><input type="checkbox" id="order-save-scheme"' +
        (d.saveAsScheme ? ' checked' : '') +
        '/> 保存为方案</label>';
    return (
      '<div class="sc-card sc-card--compact" data-spec-id="card-order-cart"><div class="sc-card__head sc-card__head--compact">' +
      headTitle +
      '</div><div class="sc-follow-list">' +
      rows +
      '</div>' +
      schemeRow +
      '<div class="sc-card__actions-inline"><button type="button" class="sc-btn sc-btn--ghost" data-action="order-back-pick">返回</button><button type="button" class="sc-btn sc-btn--ghost-primary" data-action="' +
      nextAction +
      '">' +
      nextLabel +
      '</button></div></div>'
    );
  }

  function enrichOrderLines(lines) {
    return (lines || []).map(function (line) {
      const pr = productById(line.productId);
      if (!pr) return line;
      const defaults = DemoData.lineCommercialFields(pr, line.skuId);
      return Object.assign({}, defaults, line, {
        processVersion:
          line.processVersion != null && String(line.processVersion).trim()
            ? line.processVersion
            : defaults.processVersion,
        taxRate: line.taxRate != null && !isNaN(line.taxRate) ? line.taxRate : defaults.taxRate
      });
    });
  }

  function setOrderPending(lines, meta) {
    meta = meta || {};
    const enriched = enrichOrderLines(lines);
    const c = App.getCustomer(meta.customerId);
    const header = DemoData.defaultOrderHeader(c);
    ctx().orderPending = Object.assign(
      {
        customerId: meta.customerId,
        sourceType: meta.sourceType,
        quoteId: meta.quoteId || null,
        copiedOrderId: meta.copiedOrderId || null,
        lines: enriched,
        total: meta.total != null ? meta.total : enriched.reduce((s, l) => s + (l.sub || 0), 0),
        saveAsScheme: !!meta.saveAsScheme
      },
      header
    );
  }

  function buildOrderSubmitPayload(pending, c) {
    if (!pending || !c) return null;
    return {
      docType: '销售订单',
      businessType: '客户下单',
      customerId: c.id,
      customerName: c.name,
      settlementCustomer: pending.settlementCustomer || c.settlementCustomer || c.name,
      settlementMethod: pending.settlementMethod,
      settlementCurrency: pending.settlementCurrency,
      shipDate: pending.shipDate,
      sourceType: pending.sourceType,
      quoteId: pending.quoteId || null,
      deliveryReview: ctx().delivery && ctx().delivery.confirmed ? ctx().delivery : null,
      lines: (pending.lines || []).map(function (l) {
        return {
          inventoryCode: l.inventoryCode,
          inventoryName: l.inventoryName,
          inventorySpec: l.inventorySpec,
          skuLabel: l.skuLabel,
          processVersion: l.processVersion,
          taxRate: l.taxRate,
          qty: l.qty,
          salesUnit: l.salesUnit,
          unitPrice: l.quotePrice != null ? l.quotePrice : l.unitPrice,
          sub: l.sub
        };
      }),
      total: pending.total
    };
  }

  function syncOrderConfirmFromDom() {
    const pending = ctx().orderPending;
    const el = document.querySelector('[data-spec-id="sheet-order"]');
    if (!pending || !el) return;
    const method = el.querySelector('[data-field="settlement-method"]');
    const currency = el.querySelector('[data-field="settlement-currency"]');
    const ship = el.querySelector('[data-field="ship-date"]');
    if (method) pending.settlementMethod = method.value;
    if (currency) pending.settlementCurrency = currency.value;
    if (ship) pending.shipDate = ship.value;
  }

  function renderOrderSettlementFieldSelect(field, value, options) {
    const opts = (options || [])
      .map(function (o) {
        return (
          '<option value="' +
          App.escapeHtml(o) +
          '"' +
          (o === value ? ' selected' : '') +
          '>' +
          App.escapeHtml(o) +
          '</option>'
        );
      })
      .join('');
    return (
      '<select class="sc-input sc-input--field sc-order-confirm__select" data-field="' +
      field +
      '">' +
      opts +
      '</select>'
    );
  }

  function findPendingSubmitOrderByQuoteId(quoteId) {
    if (!quoteId) return null;
    return (
      DemoData.orders.find(function (o) {
        return o.quoteId === quoteId && o.status === DemoData.orderStatusPendingSubmit;
      }) || null
    );
  }

  function orderSnapshotFromPending(pending, c) {
    return {
      customerId: c.id,
      customerName: c.name,
      amount: fmtMoney(pending.total),
      items: pending.lines.map((l) => l.inventoryName + '×' + l.qty).join('、'),
      productIds: pending.lines.map((l) => l.productId).filter(Boolean),
      quoteId: pending.quoteId || null,
      lines: pending.lines.map((l) => ({
        inventoryCode: l.inventoryCode,
        inventoryName: l.inventoryName,
        inventorySpec: l.inventorySpec,
        salesUnit: l.salesUnit,
        qty: l.qty,
        skuLabel: l.skuLabel,
        processVersion: l.processVersion,
        taxRate: l.taxRate,
        quotePrice: l.quotePrice,
        unitPrice: l.unitPrice,
        sub: l.sub
      }))
    };
  }

  function createOrderFromPending(pending, c, opts) {
    opts = opts || {};
    const status = opts.status || '未审核';
    const isPendingSubmit = status === DemoData.orderStatusPendingSubmit;
    const orderNo = 'SO' + Date.now().toString().slice(-10);
    const snap = orderSnapshotFromPending(pending, c);
    const order = {
      id: 'o' + Date.now(),
      no: orderNo,
      status: status,
      statusDetail: isPendingSubmit
        ? '报价已生成，待确认下单'
        : '订单已提交，待内勤审核',
      date: new Date().toISOString().slice(0, 10),
      salesperson: DemoData.salesperson,
      timeline: isPendingSubmit
        ? []
        : [
            {
              label: '未审核',
              at: new Date().toISOString().slice(0, 16).replace('T', ' '),
              done: false,
              current: true
            },
            { label: '销售审核', at: '', done: false },
            { label: '已审核', at: '', done: false },
            { label: '已完成', at: '', done: false }
          ],
      ...snap
    };
    DemoData.orders.unshift(order);
    return order;
  }

  /** 生成报价单时同步创建待提交订单（同一报价单仅保留一条待提交） */
  function ensurePendingSubmitOrderForQuote(quote, c) {
    const idx = DemoData.orders.findIndex(function (o) {
      return o.quoteId === quote.id && o.status === DemoData.orderStatusPendingSubmit;
    });
    if (idx >= 0) DemoData.orders.splice(idx, 1);
    const pending = {
      customerId: c.id,
      sourceType: 'quote',
      quoteId: quote.id,
      lines: quote.lines || [],
      total: quote.total
    };
    return createOrderFromPending(pending, c, { status: DemoData.orderStatusPendingSubmit });
  }

  function submitPendingOrder(existing, pending, c) {
    const snap = orderSnapshotFromPending(pending, c);
    existing.status = '未审核';
    existing.statusDetail = '订单已提交，待内勤审核';
    existing.timeline = [
      { label: '未审核', at: new Date().toISOString().slice(0, 16).replace('T', ' '), done: false, current: true },
      { label: '销售审核', at: '', done: false },
      { label: '已审核', at: '', done: false },
      { label: '已完成', at: '', done: false }
    ];
    Object.assign(existing, snap);
    return existing;
  }

  function formatOrderLineSpec(line) {
    const parts = [];
    if (line.inventorySpec) parts.push(line.inventorySpec);
    if (line.skuLabel && line.skuLabel !== line.inventorySpec) parts.push(line.skuLabel);
    return parts.length ? parts.join(' · ') : '—';
  }

  function orderSourceLabel(pending) {
    if (!pending) return '—';
    if (pending.sourceType === 'quote' && pending.quoteId) {
      return '按报价单 · ' + pending.quoteId;
    }
    if (pending.sourceType === 'copy') {
      const oid = pending.copiedOrderId;
      const o =
        oid &&
        DemoData.orders.find(function (x) {
          return x.id === oid;
        });
      return '复制订单 · ' + (o ? o.no : oid || '—');
    }
    if (pending.sourceType === 'direct') return '直选下单';
    if (pending.sourceType === 'scheme') return '按方案';
    return '—';
  }

  function recalcOrderPendingTotal() {
    const pending = ctx().orderPending;
    if (!pending || !pending.lines) return;
    pending.lines.forEach(function (l) {
      l.sub = (l.quotePrice != null ? l.quotePrice : l.unitPrice || 0) * (l.qty || 1);
      l.unitPrice = l.quotePrice != null ? l.quotePrice : l.unitPrice;
    });
    pending.total = pending.lines.reduce(function (s, l) {
      return s + (l.sub || 0);
    }, 0);
    const root = getActiveFormCard('card-order-copy');
    const el = root && root.querySelector('[data-order-copy-total]');
    if (el) el.textContent = fmtMoney(pending.total);
  }

  function syncOrderCopyLinesFromDom(rootOrBtn) {
    const pending = ctx().orderPending;
    let root = rootOrBtn;
    if (root && root.closest) {
      root = rootOrBtn.closest('[data-spec-id="card-order-copy"]');
    }
    if (!root) root = getActiveFormCard('card-order-copy');
    if (!pending || !root) return;
    pending.lines.forEach(function (line, idx) {
      const pid = line.productId;
      const qtyInp = root.querySelector('[data-action="copy-line-qty"][data-idx="' + idx + '"]');
      const priceInp = root.querySelector('[data-action="copy-line-price"][data-idx="' + idx + '"]');
      const skuSel = root.querySelector('[data-action="copy-line-sku"][data-idx="' + idx + '"]');
      const processSel = root.querySelector('[data-action="copy-line-process"][data-idx="' + idx + '"]');
      const taxInp = root.querySelector('[data-action="copy-line-tax"][data-idx="' + idx + '"]');
      if (qtyInp) line.qty = parseInt(qtyInp.value, 10) || 1;
      if (priceInp) {
        const v = parseFloat(priceInp.value);
        if (!isNaN(v)) {
          line.quotePrice = v;
          if (priceInp.value !== '') line._quotePriceTouched = true;
        }
      }
      if (skuSel) {
        line.skuId = skuSel.value;
        const pr = productById(line.productId);
        line.skuLabel = DemoData.skuLabel(pr, line.skuId);
        line.inventorySpec = line.skuLabel;
        const hints = DemoData.priceHints(pr, line.skuId);
        line.latestPrice = hints.latestPrice;
        line.minPrice = hints.minPrice;
        applyQuoteLineCommercialDefaults(line, pr);
      }
      if (processSel) {
        line.processVersion = processSel.value;
        line._processVersionTouched = true;
      }
      if (taxInp && taxInp.value !== '') {
        const t = parseFloat(taxInp.value);
        if (!isNaN(t)) {
          line.taxRate = t;
          line._taxRateTouched = true;
        }
      }
      line.sub = (line.quotePrice != null ? line.quotePrice : line.unitPrice || 0) * line.qty;
      line.unitPrice = line.quotePrice != null ? line.quotePrice : line.unitPrice;
      const subEl = root.querySelector('[data-copy-sub="' + idx + '"]');
      if (subEl) subEl.textContent = fmtMoney(line.sub);
      const latestEl = root.querySelector('[data-copy-latest="' + idx + '"]');
      const minEl = root.querySelector('[data-copy-min="' + idx + '"]');
      if (latestEl) latestEl.textContent = fmtMoney(line.latestPrice);
      if (minEl) minEl.textContent = fmtMoney(line.minPrice);
      const row = root.querySelector('[data-copy-line-idx="' + idx + '"]');
      if (row) {
        row.classList.toggle('sc-order-copy-line--warn', line.quotePrice < line.minPrice);
        const meta = row.querySelector('.sc-order-copy-line__meta');
        if (meta) {
          meta.textContent =
            (line.qty || 0) + ' · ' + fmtMoney(line.sub) + ' · ' + formatOrderLineSpec(line);
        }
      }
    });
    recalcOrderPendingTotal();
  }

  function onCopyLineSkuChange(sel) {
    const pending = ctx().orderPending;
    if (!pending) return;
    const idx = parseInt(sel.getAttribute('data-idx'), 10);
    const line = pending.lines[idx];
    if (!line) return;
    const pr = productById(line.productId);
    line.skuId = sel.value;
    line.skuLabel = DemoData.skuLabel(pr, line.skuId);
    line.inventorySpec = line.skuLabel;
    const hints = DemoData.priceHints(pr, line.skuId);
    line.latestPrice = hints.latestPrice;
    line.minPrice = hints.minPrice;
    if (!line._quotePriceTouched) line.quotePrice = hints.latestPrice;
    applyQuoteLineCommercialDefaults(line, pr);
    line.sub = line.quotePrice * line.qty;
    line.unitPrice = line.quotePrice;
    if (isActiveFlowCard('card-order-copy')) refreshLastOrderCopyCard();
  }

  function refreshLastOrderCopyCard() {
    const cards = document.querySelectorAll('[data-spec-id="card-order-copy"]');
    const card = cards[cards.length - 1];
    if (!card) return;
    const oid = card.getAttribute('data-copied-oid');
    const o =
      oid &&
      DemoData.orders.find(function (x) {
        return x.id === oid;
      });
    if (o) card.outerHTML = renderOrderCopyCard(o);
    rescanAnnotationPins();
  }

  function renderCopyLineProcessField(pr, line, idx) {
    const options = DemoData.processVersionOptions(pr, line.skuId);
    const cur = line.processVersion || options[0] || '标准版';
    const opts = options
      .map(function (v) {
        return (
          '<option value="' +
          App.escapeHtml(v) +
          '"' +
          (v === cur ? ' selected' : '') +
          '>' +
          App.escapeHtml(v) +
          '</option>'
        );
      })
      .join('');
    return (
      '<label class="sc-quote-line__field">工艺版本 <select class="sc-input sc-input--field sc-quote-line__select" data-action="copy-line-process" data-idx="' +
      idx +
      '">' +
      opts +
      '</select></label>'
    );
  }

  function renderOrderCopyLineFields(line, idx, pr) {
    const pid = line.productId;
    const cur = line.skuId || DemoData.defaultSkuId(pr);
    const skuOpts = (pr.skus || [])
      .map(function (s) {
        return (
          '<option value="' +
          s.id +
          '"' +
          (s.id === cur ? ' selected' : '') +
          '>' +
          App.escapeHtml(s.label) +
          '</option>'
        );
      })
      .join('');
    const rate = line.taxRate != null ? line.taxRate : 13;
    const belowMin = line.quotePrice < line.minPrice;
    return (
      '<div class="sc-quote-line__fields">' +
      '<div class="sc-quote-line__row-inline sc-quote-line__row-inline--spec">' +
      '<label class="sc-plan-sku-label">规格 <select class="sc-plan-sku-select" data-action="copy-line-sku" data-pid="' +
      pid +
      '" data-idx="' +
      idx +
      '">' +
      skuOpts +
      '</select></label>' +
      '<label class="sc-qty-inline">数量 <input type="number" min="1" value="' +
      (line.qty || 1) +
      '" data-action="copy-line-qty" data-idx="' +
      idx +
      '" class="sc-qty-input sc-input sc-input--field"/></label>' +
      '</div>' +
      renderCopyLineProcessField(pr, line, idx) +
      '<div class="sc-quote-price-hints"><span>最新售价 <strong data-copy-latest="' +
      idx +
      '">' +
      fmtMoney(line.latestPrice) +
      '</strong></span><span>最低售价 <strong data-copy-min="' +
      idx +
      '">' +
      fmtMoney(line.minPrice) +
      '</strong></span></div>' +
      '<div class="sc-quote-line__row-inline sc-quote-line__row-inline--price">' +
      '<label class="sc-quote-line__field">税率<input type="number" min="0" max="100" step="0.01" value="' +
      rate +
      '" data-action="copy-line-tax" data-idx="' +
      idx +
      '" class="sc-input sc-input--field sc-quote-line__tax"/></label>' +
      '<label class="sc-quote-price-input">单价（元）<input type="number" min="0" step="0.01" value="' +
      (line.quotePrice != null ? line.quotePrice : line.unitPrice || 0) +
      '" data-action="copy-line-price" data-idx="' +
      idx +
      '" class="sc-input sc-input--field"/></label>' +
      '</div>' +
      '<p class="sc-quote-line__sub">行小计 <strong data-copy-sub="' +
      idx +
      '">' +
      fmtMoney(line.sub) +
      '</strong></p></div>'
    );
  }

  function renderOrderCopyLineBlock(line, idx, isOpen) {
    const pr = productById(line.productId);
    if (!pr) return '';
    const belowMin = line.quotePrice < line.minPrice;
    return (
      '<div class="sc-order-copy-line' +
      (isOpen ? ' sc-order-copy-line--open' : '') +
      (belowMin ? ' sc-order-copy-line--warn' : '') +
      '" data-copy-line-idx="' +
      idx +
      '">' +
      '<button type="button" class="sc-order-copy-line__head" data-action="copy-line-toggle" data-idx="' +
      idx +
      '">' +
      '<span class="sc-order-copy-line__idx">' +
      (idx + 1) +
      '</span>' +
      '<span class="sc-order-copy-line__name">' +
      App.escapeHtml(line.inventoryName || '—') +
      '</span>' +
      '<span class="sc-order-copy-line__meta">' +
      (line.qty || 0) +
      ' · ' +
      fmtMoney(line.sub) +
      ' · ' +
      App.escapeHtml(formatOrderLineSpec(line)) +
      '</span>' +
      '<span class="sc-order-copy-line__chevron" aria-hidden="true">›</span></button>' +
      (isOpen ? '<div class="sc-order-copy-line__body">' + renderOrderCopyLineFields(line, idx, pr) + '</div>' : '') +
      '</div>'
    );
  }

  function renderOrderCopyCard(sourceOrder) {
    const pending = ctx().orderPending;
    if (!pending || !pending.lines.length) return '';
    recalcOrderPendingTotal();
    const expanded =
      ctx().orderCopyExpandedIdx != null ? ctx().orderCopyExpandedIdx : 0;
    const c = App.getCustomer(pending.customerId);
    const o = sourceOrder || null;
    const lineBlocks = pending.lines
      .map(function (line, idx) {
        return renderOrderCopyLineBlock(line, idx, expanded === idx);
      })
      .join('');
    return (
      '<div class="sc-card sc-card--compact sc-card--inline-form sc-card--order-copy" data-spec-id="card-order-copy"' +
      (o ? ' data-copied-oid="' + App.escapeHtml(o.id) + '"' : '') +
      '>' +
      '<div class="sc-card__head sc-card__head--compact">复制订单 · 明细确认</div>' +
      (o
        ? '<p class="sc-card__meta">来源订单 <strong>' +
          App.escapeHtml(o.no) +
          '</strong> ' +
          orderStatusBadgeHtml(o.status) +
          ' · ' +
          App.escapeHtml(o.date || '') +
          '</p>'
        : '') +
      '<p class="sc-card__meta">客户：<strong>' +
      App.escapeHtml(c ? c.name : '—') +
      '</strong></p>' +
      '<p class="sc-card__meta sc-order-copy__hint">点击明细行展开，可修改规格、数量与单价</p>' +
      '<div class="sc-order-copy-lines">' +
      lineBlocks +
      '</div>' +
      '<p class="sc-order-copy__total">合计金额 <strong data-order-copy-total>' +
      fmtMoney(pending.total) +
      '</strong></p>' +
      '<div class="sc-card__actions-inline">' +
      '<button type="button" class="sc-btn sc-btn--ghost" data-action="copy-repick-order">重选订单</button>' +
      '<button type="button" class="sc-btn sc-btn--primary" data-action="copy-order-confirm">确认复制</button></div>' +
      '</div>'
    );
  }

  function renderCopyOrderLinePickCard(o, lines) {
    if (!o || !lines || !lines.length) return '';
    const c = App.getCustomer(o.customerId);
    const selected = ctx().copyLineSelection || lines.map(function () { return true; });
    const selectedCount = selected.filter(Boolean).length;
    const selectedTotal = lines.reduce(function (sum, line, idx) {
      if (!selected[idx]) return sum;
      return sum + (line.sub || 0);
    }, 0);
    const allSelected = selectedCount === lines.length;

    const rows = lines.map(function (line, idx) {
      const isChecked = selected[idx];
      const price = line.quotePrice != null ? line.quotePrice : line.unitPrice || 0;
      return (
        '<div class="sc-copy-line-pick__row' + (isChecked ? ' sc-copy-line-pick__row--selected' : '') + '" data-idx="' + idx + '">' +
        '<label class="sc-copy-line-pick__checkbox">' +
        '<input type="checkbox" data-action="copy-line-pick-item" data-idx="' + idx + '"' + (isChecked ? ' checked' : '') + '>' +
        '<span class="sc-copy-line-pick__checkmark"></span>' +
        '</label>' +
        '<span class="sc-copy-line-pick__idx">' + (idx + 1) + '</span>' +
        '<div class="sc-copy-line-pick__info">' +
        '<span class="sc-copy-line-pick__name">' + App.escapeHtml(line.inventoryName || '—') + '</span>' +
        '<span class="sc-copy-line-pick__spec">' + App.escapeHtml(line.skuLabel || '—') + ' · ' + (line.qty || 0) + App.escapeHtml(line.salesUnit || '件') + '</span>' +
        '</div>' +
        '<span class="sc-copy-line-pick__price">' + fmtMoney(price) + '</span>' +
        '</div>'
      );
    }).join('');

    return (
      '<div class="sc-card sc-card--compact sc-card--inline-form sc-card--copy-line-pick" data-spec-id="card-order-copy-line-pick" data-oid="' +
      App.escapeHtml(o.id) + '">' +
      '<div class="sc-card__head sc-card__head--compact">复制订单 · 勾选货品</div>' +
      '<div class="sc-copy-line-pick__header">' +
      '<label class="sc-copy-line-pick__header-check">' +
      '<input type="checkbox" data-action="copy-line-pick-all" ' + (allSelected ? ' checked' : '') + '>' +
      '<span class="sc-copy-line-pick__checkmark"></span>' +
      '<span class="sc-copy-line-pick__header-text">全选（共 ' + lines.length + ' 项）</span>' +
      '</label>' +
      '</div>' +
      '<div class="sc-copy-line-pick__list">' + rows + '</div>' +
      '<div class="sc-copy-line-pick__summary">' +
      '<span>已选择：<strong>' + selectedCount + ' / ' + lines.length + '</strong> 项</span>' +
      '<span>预计金额：<strong>' + fmtMoney(selectedTotal) + '</strong></span>' +
      '</div>' +
      '<div class="sc-card__actions-inline">' +
      '<button type="button" class="sc-btn sc-btn--ghost" data-action="copy-line-pick-repick">重选订单</button>' +
      '<button type="button" class="sc-btn sc-btn--primary" data-action="copy-line-pick-confirm">确认选择</button>' +
      '</div>' +
      '</div>'
    );
  }

  function renderOrderConfirmBody(pending, c) {
    if (!pending || !pending.lines || !pending.lines.length) return '';
    const del = ctx().delivery;
    const lineCards = pending.lines
      .map(function (line, i) {
        return renderOrderConfirmLineCard(line, i);
      })
      .join('');
    const customerMeta =
      c && c.code
        ? '<span class="sc-order-confirm__code">' + App.escapeHtml(c.code) + '</span>'
        : '';
    const deliveryBlock =
      del && del.confirmed
        ? '<div class="sc-order-confirm__section">' +
          '<h3 class="sc-order-confirm__section-title">交期评审</h3>' +
          '<dl class="sc-order-confirm__summary">' +
          '<div class="sc-order-confirm__row"><dt>结论</dt><dd>' +
          App.escapeHtml(del.verdict || del.status || '') +
          ' · ' +
          App.escapeHtml(del.detail || '') +
          '</dd></div>' +
          '<div class="sc-order-confirm__row"><dt>期望交期</dt><dd>' +
          App.escapeHtml((del.expectedDate || '').replace(/-/g, '/')) +
          '</dd></div>' +
          '<div class="sc-order-confirm__row"><dt>计划区间</dt><dd>' +
          App.escapeHtml((del.planStartDate || '').replace(/-/g, '/')) +
          '～' +
          App.escapeHtml((del.planEndDate || '').replace(/-/g, '/')) +
          '</dd></div>' +
          '</dl></div>'
        : '';
    return (
      '<div class="sc-order-confirm">' +
      '<section class="sc-order-confirm__section">' +
      '<h3 class="sc-order-confirm__section-title">订单摘要</h3>' +
      '<dl class="sc-order-confirm__summary">' +
      '<div class="sc-order-confirm__row"><dt>客户</dt><dd><strong>' +
      App.escapeHtml(c ? c.name : '—') +
      '</strong>' +
      customerMeta +
      '</dd></div>' +
      '<div class="sc-order-confirm__row"><dt>订单来源</dt><dd>' +
      App.escapeHtml(orderSourceLabel(pending)) +
      '</dd></div>' +
      '</dl></section>' +
      deliveryBlock +
      '<section class="sc-order-confirm__section">' +
      '<h3 class="sc-order-confirm__section-title">订单信息</h3>' +
      '<dl class="sc-order-confirm__summary">' +
      '<div class="sc-order-confirm__row"><dt>结算客户</dt><dd><strong>' +
      App.escapeHtml(pending.settlementCustomer || (c && c.settlementCustomer) || (c && c.name) || '—') +
      '</strong></dd></div>' +
      '<div class="sc-order-confirm__row sc-order-confirm__row--field"><dt>结算方式</dt><dd>' +
      renderOrderSettlementFieldSelect('settlement-method', pending.settlementMethod, DemoData.settlementMethodOptions) +
      '</dd></div>' +
      '<div class="sc-order-confirm__row sc-order-confirm__row--field"><dt>结算货币</dt><dd>' +
      renderOrderSettlementFieldSelect('settlement-currency', pending.settlementCurrency, DemoData.settlementCurrencyOptions) +
      '</dd></div>' +
      '<div class="sc-order-confirm__row sc-order-confirm__row--field"><dt>发货日期</dt><dd><input type="date" class="sc-input sc-input--field" data-field="ship-date" value="' +
      App.escapeHtml(pending.shipDate || '') +
      '" /></dd></div>' +
      '</dl>' +
      renderOrderConfirmHeaderMore(pending) +
      '</section>' +
      '<section class="sc-order-confirm__section">' +
      '<h3 class="sc-order-confirm__section-title">订单明细（' +
      pending.lines.length +
      ' 项）</h3>' +
      '<div class="sc-order-confirm-lines">' +
      lineCards +
      '</div>' +
      '<div class="sc-order-confirm__total-row">合计金额 <strong data-order-confirm-total>' +
      fmtMoney(pending.total) +
      '</strong></div>' +
      '</section></div>'
    );
  }

  function renderOrderSuccessCard(order, customerName, total) {
    const lineHtml = (order.lines || [])
      .map(function (line) {
        const unit = line.salesUnit || '件';
        return (
          '<p class="sc-card__meta sc-order-success-line"><strong>' +
          App.escapeHtml(line.inventoryName || '—') +
          '</strong> · ' +
          App.escapeHtml(formatOrderLineSpec(line)) +
          ' · ' +
          line.qty +
          ' ' +
          App.escapeHtml(unit) +
          '</p>'
        );
      })
      .join('');
    return (
      '<div class="sc-card" data-spec-id="card-order-success"><div class="sc-card__head sc-card__head--compact">订单提交成功</div><div class="sc-card__row sc-card__row--compact">' +
      '<p class="sc-card__meta">订单号：<strong>' +
      App.escapeHtml(order.no) +
      '</strong></p><p class="sc-card__meta">客户：' +
      App.escapeHtml(customerName) +
      '</p><p class="sc-card__meta">状态：' +
      App.escapeHtml(order.status) +
      '</p>' +
      (lineHtml ? '<p class="sc-card__meta sc-order-success-lines-title">订单明细</p>' + lineHtml : '') +
      '<p class="sc-card__meta">金额：<strong>' +
      fmtMoney(total) +
      '</strong></p></div></div>'
    );
  }

  function refreshLastOrderPickCard() {
    const cards = document.querySelectorAll('[data-spec-id="card-order-pick"]');
    const card = cards[cards.length - 1];
    if (card) card.outerHTML = renderOrderProductPickCard();
    rescanAnnotationPins();
  }

  function showOrderConfirm() {
    const pending = ctx().orderPending;
    if (!pending || !pending.lines.length) {
      App.toast('订单明细为空');
      return;
    }
    pushNextAiCard(renderOrderConfirmCard());
    rescanAnnotationPins();
  }

  function renderOrderConfirmCard() {
    const pending = ctx().orderPending;
    if (!pending || !pending.lines.length) return '';
    const c = App.getCustomer(pending.customerId);
    return (
      '<div class="sc-card sc-card--compact sc-card--inline-form sc-card--order" data-spec-id="sheet-order">' +
      '<div class="sc-card__head sc-card__head--compact">确认下单</div>' +
      '<div class="sc-order-confirm-body">' +
      renderOrderConfirmBody(pending, c) +
      '</div>' +
      '<div class="sc-card__actions-inline"><button type="button" class="sc-btn sc-btn--primary" data-action="order-submit">确认下单</button></div>' +
      '</div>'
    );
  }

  /** 新建下单：无报价单则直进选品报价卡（下单模式），否则出下单来源卡 */
  function beginOrderCreate(opts) {
    opts = opts || {};
    setOrderSkillAtEntry(false);
    const c = requireCustomer('order');
    if (!c) return;
    enterSkill('order');
    ctx().quotePickForOrder = true;
    if (!quotesForCustomer(c.id).length) {
      if (opts.leadHtml) App.pushAiHtml(opts.leadHtml);
      orderDirectStart({ leadHtml: null });
      return;
    }
    if (opts.leadHtml) App.pushAiHtml(opts.leadHtml);
    App.pushAiHtml(renderOrderSourceCard());
    rescanAnnotationPins();
  }

  /** 进入确认下单：展示入口卡 */
  function pushOrderEntry(leadHtml) {
    showOrderSkillEntry({ leadHtml: leadHtml != null ? leadHtml : null });
  }

  function runOrder() {
    if (
      ctx().orderPending &&
      ctx().orderPending.sourceType === 'copy' &&
      isActiveFlowCard('card-order-copy')
    ) {
      App.toast('请先在复制明细卡上点「确认复制」');
      return;
    }
    showOrderSkillEntry();
  }

  function applyOrderFromQuote(quote) {
    persistQuote(quote);
    setOrderPending(quote.lines || [], {
      customerId: quote.customerId,
      sourceType: 'quote',
      quoteId: quote.id,
      total: quote.total
    });
    showOrderConfirm();
  }

  function orderFromQuote(quoteId) {
    const c = requireCustomer();
    if (!c) return;
    const list = quotesForCustomer(c.id);
    if (!list.length) {
    enterSkill('order');
    App.pushAiHtml(
        '<p class="sc-reply-lead">当前客户 <strong>' +
          App.escapeHtml(c.name) +
          '</strong> 暂无报价单，已进入选品报价。</p>'
      );
      orderDirectStart();
      return;
    }
    const qid = quoteId || null;
    if (!qid && list.length > 1) {
      pushQuotePickForOrder(
        c,
        '<p class="sc-reply-lead">本客户有 <strong>' +
          list.length +
          '</strong> 个报价单，<strong>按报价单下单须先选择</strong>：</p>'
      );
      return;
    }
    const quote = quoteForActiveCustomer(qid || list[0].id);
    if (!quote) {
      App.toast('未找到所选报价单');
      return;
    }
    enterSkill('order');
    applyOrderFromQuote(quote);
  }

  function orderDirectStart(opts) {
    opts = opts || {};
    const c = ensureQuoteDraft();
    if (!c) return;
    enterSkill('order');
    ctx().quotePickForOrder = true;
    if (maybeQuoteDemandBeforePick(c, { leadHtml: opts.leadHtml })) return;
    if (opts.simulateUserMsg) simulateUserUtterance('直接选品下单');
    App.pushAiHtml(renderQuotePickCard());
    rescanAnnotationPins();
  }

  function orderToConfirmFromDraft(opts) {
    orderToQuoteSetupFromDraft(opts);
  }

  function submitOrder() {
    const pending = ctx().orderPending;
    if (!pending || !pending.lines.length) { App.toast('无订单明细'); return; }
    syncOrderConfirmFromDom();
    const c = App.getCustomer(pending.customerId);
    if (!c) {
      App.toast('客户信息缺失');
      return;
    }
    if (!pending.shipDate) {
      App.toast('请选择发货日期');
      return;
    }
    const apiPayload = buildOrderSubmitPayload(pending, c);
    if (typeof console !== 'undefined' && console.info) console.info('[演示] 销售订单提交报文', apiPayload);
    if (pending.saveAsScheme && pending.sourceType === 'direct') saveSchemeFromPending(pending);
    const existing = findPendingSubmitOrderByQuoteId(pending.quoteId);
    const order = existing
      ? submitPendingOrder(existing, pending, c)
      : createOrderFromPending(pending, c);
    if (order && apiPayload) order.apiPayload = apiPayload;
    App.closeOverlays();
    ctx().orderPending = null;
    App.pushAiHtml(renderOrderSuccessCard(order, c.name, pending.total));
  }

  function ensureCopyPickState() {
    if (!ctx().copyPick) {
      ctx().copyPick = {
        demandText: '',
        filter: '',
        visibleCount: COPY_ORDER_LIST_PAGE_SIZE
      };
    }
    return ctx().copyPick;
  }

  function resetCopyPickState() {
    ctx().copyPick = {
      demandText: '',
      filter: '',
      visibleCount: COPY_ORDER_LIST_PAGE_SIZE
    };
  }

  function ensureOrderListPickState(mode) {
    if (!ctx().orderListPick || ctx().orderListPick.mode !== mode) {
      ctx().orderListPick = {
        mode: mode,
        demandText: '',
        filter: '',
        visibleCount: COPY_ORDER_LIST_PAGE_SIZE
      };
    }
    return ctx().orderListPick;
  }

  function resetOrderListPickState(mode) {
    ctx().orderListPick = {
      mode: mode,
      demandText: '',
      filter: '',
      visibleCount: COPY_ORDER_LIST_PAGE_SIZE
    };
  }

  function orderMatchesCopyDemand(o, demandText) {
    if (!demandText) return true;
    const items = (o.items || '').toLowerCase();
    const parts = String(demandText)
      .trim()
      .split(/[、,，\s]+/)
      .filter(Boolean);
    if (!parts.length) return true;
    return parts.some(function (p) {
      const k = p.toLowerCase();
      return k.length >= 1 && items.indexOf(k) >= 0;
    });
  }

  function orderMatchesCopyFilter(o, filter) {
    if (!filter) return true;
    const k = filter.toLowerCase();
    if ((o.no || '').toLowerCase().indexOf(k) >= 0) return true;
    if ((o.items || '').toLowerCase().indexOf(k) >= 0) return true;
    return false;
  }

  function filterOrdersForCopyPick(c, state) {
    const pool = ordersForCustomer(c.id);
    return pool.filter(function (o) {
      return orderMatchesCopyDemand(o, state.demandText) && orderMatchesCopyFilter(o, state.filter);
    });
  }

  function syncCopyPickActiveList(list, visibleCount) {
    const visible = list.slice(0, visibleCount);
    ctx().activePickList = {
      type: 'order',
      mode: 'copy',
      ids: visible.map(function (o) {
        return o.id;
      })
    };
  }

  function syncChangePickActiveList(list, visibleCount) {
    const visible = list.slice(0, visibleCount);
    ctx().activePickList = {
      type: 'order',
      mode: 'change',
      ids: visible.map(function (o) {
        return o.id;
      })
    };
  }

  function renderCopyOrderQueryRow(val) {
    return (
      '<div class="sc-plan-query-row">' +
      '<input type="search" class="sc-input sc-input--field" id="copy-order-query-input" placeholder="订单编号 / 货品名称 / 自由项" value="' +
      App.escapeHtml(val || '') +
      '"/>' +
      '<button type="button" class="sc-btn sc-btn--ghost" data-action="copy-order-query-apply">筛选</button></div>'
    );
  }

  function renderHistoricalOrderPickCard(c, list, opts) {
    opts = opts || {};
    const mode = opts.mode || 'copy';
    const state =
      mode === 'copy'
        ? ensureCopyPickState()
        : mode === 'progress'
          ? ensureProgressPickState()
          : ensureOrderListPickState('change');
    const action =
      mode === 'change'
        ? 'change-pick'
        : mode === 'progress'
          ? 'progress-pick'
          : 'copy-pick';
    const head =
      opts.headTitle ||
      (mode === 'change'
        ? '订单变更 · 选择历史单'
        : mode === 'progress'
          ? '订单进度 · 选择订单'
          : '复制订单 · 选择历史单');
    const visible = list.slice(0, state.visibleCount);
    const hasMore = list.length > visible.length;
    const totalPool = ordersForCustomer(c.id).length;
    const stats =
      list.length !== totalPool
        ? '匹配 <strong>' + list.length + '</strong> 笔（共 ' + totalPool + ' 笔）'
        : '共 <strong>' + list.length + '</strong> 笔历史订单';
    const demandHint =
      mode === 'copy' && state.demandText
        ? '<p class="sc-card__meta">筛选条件：' +
          App.escapeHtml(state.demandText) +
          ' <button type="button" class="sc-link-btn" data-action="copy-edit-demand">修改</button></p>'
        : mode === 'progress' && state.demandText
          ? '<p class="sc-card__meta">需求：' +
            App.escapeHtml(state.demandText) +
            ' <button type="button" class="sc-link-btn" data-action="progress-edit-demand">修改</button></p>'
          : '';
    const rows = visible
      .map(function (o, i) {
        const n = i + 1;
        return (
          '<button type="button" class="sc-follow-row sc-follow-row--select" data-action="' +
          action +
          '" data-oid="' +
          App.escapeHtml(o.id) +
          '" data-pick-index="' +
          n +
          '"><span class="sc-follow-row__stack">' +
          '<span class="sc-follow-row__name">' +
          n +
          '. ' +
          App.escapeHtml(o.no) +
          '</span><span class="sc-follow-row__meta">' +
          App.escapeHtml(o.date || '—') +
          ' · ' +
          App.escapeHtml(o.amount || '—') +
          '</span><span class="sc-follow-row__meta">' +
          App.escapeHtml(o.items || '—') +
          '</span></span></button>'
        );
      })
      .join('');
    const emptyHint =
      list.length === 0
        ? '<p class="sc-card__meta">无匹配订单，请调整筛选条件或修改输入。</p>'
        : '';
    const loadMoreAction =
      mode === 'progress' ? 'progress-order-load-more' : 'copy-order-load-more';
    const moreBtn = hasMore
      ? '<button type="button" class="sc-btn sc-btn--ghost" data-action="' +
        loadMoreAction +
        '">加载更多（已显示 ' +
        visible.length +
        ' / ' +
        list.length +
        '）</button>'
      : '';
    const dataAttr =
      mode === 'copy'
        ? ' data-copy-pick="1"'
        : mode === 'progress'
          ? ' data-progress-pick="1"'
          : ' data-change-pick="1"';
    return (
      '<div class="sc-card sc-card--compact sc-card--historical-order-pick" data-spec-id="card-order-pick"' +
      dataAttr +
      '><div class="sc-card__head sc-card__head--compact">' +
      head +
      '</div><p class="sc-card__meta">' +
      stats +
      '</p>' +
      demandHint +
      renderCopyOrderQueryRow(state.filter) +
      '<div class="sc-follow-list sc-copy-order-pick-list">' +
      rows +
      emptyHint +
      '</div>' +
      (moreBtn ? '<div class="sc-card__actions-inline">' + moreBtn + '</div>' : '') +
      '</div>'
    );
  }

  function pushCopyOrderPickCard(c, opts) {
    opts = opts || {};
    enterSkill('copy');
    ctx().copyPickMode = true;
    delete ctx().changePickMode;
    const state = ensureCopyPickState();
    const list = filterOrdersForCopyPick(c, state);
    syncCopyPickActiveList(list, state.visibleCount);
    const lead =
      opts.leadHtml ||
      '<p class="sc-reply-lead">请选择要<strong>复制</strong>的历史订单（点选一行）：</p>';
    App.pushAiHtml(lead + renderHistoricalOrderPickCard(c, list, { mode: 'copy' }));
    rescanAnnotationPins();
  }

  function pushChangeOrderPickCard(c, opts) {
    opts = opts || {};
    enterSkill('change');
    ctx().changePickMode = true;
    delete ctx().copyPickMode;
    const state = ensureOrderListPickState('change');
    const list = filterOrdersForCopyPick(c, state);
    syncChangePickActiveList(list, state.visibleCount);
    const lead =
      opts.leadHtml || '<p class="sc-reply-lead">选择要<strong>变更</strong>的订单：</p>';
    App.pushAiHtml(lead + renderHistoricalOrderPickCard(c, list, { mode: 'change' }));
    rescanAnnotationPins();
  }

  function ensureProgressPickState() {
    if (!ctx().progressPick) {
      ctx().progressPick = {
        demandText: '',
        filter: '',
        visibleCount: COPY_ORDER_LIST_PAGE_SIZE
      };
    }
    return ctx().progressPick;
  }

  function resetProgressPickState() {
    ctx().progressPick = {
      demandText: '',
      filter: '',
      visibleCount: COPY_ORDER_LIST_PAGE_SIZE
    };
  }

  function syncProgressPickActiveList(list, visibleCount) {
    const visible = list.slice(0, visibleCount);
    ctx().activePickList = {
      type: 'order',
      mode: 'progress',
      ids: visible.map(function (o) {
        return o.id;
      })
    };
  }

  function pushProgressOrderPickCard(c, opts) {
    opts = opts || {};
    enterSkill('progress');
    ctx().progressPickMode = true;
    delete ctx().copyPickMode;
    delete ctx().changePickMode;
    const state = ensureProgressPickState();
    const list = filterOrdersForCopyPick(c, state);
    syncProgressPickActiveList(list, state.visibleCount);
    const lead =
      opts.leadHtml ||
      '<p class="sc-reply-lead">请选择要<strong>查询进度</strong>的订单（点选一行）：</p>';
    App.pushAiHtml(lead + renderHistoricalOrderPickCard(c, list, { mode: 'progress' }));
    rescanAnnotationPins();
  }

  function renderProgressDemandPromptCard(c) {
    return renderDemandPromptCard(c, {
      specId: 'card-progress-demand',
      allowSkip: true,
      headTitle: '请描述要查询的订单特征（可跳过）',
      promptMeta: '填写后用于筛选历史订单；跳过则按最近下单展示全部订单。',
      skipLabel: '跳过，展示最近订单'
    });
  }

  function maybeProgressDemandBeforePick(c, opts) {
    opts = opts || {};
    const lastUser = getLatestUserChatText();
    if (
      lastUser &&
      isNaturalDemandText(lastUser) &&
      !isPlainSkillPhrase(lastUser) &&
      !isPlanDemandSkipPhrase(lastUser)
    ) {
      if (submitProgressDemand(lastUser, { simulateUserMsg: false })) return true;
    }
    if (opts.leadHtml) App.pushAiHtml(opts.leadHtml);
    App.pushAiHtml(renderProgressDemandPromptCard(c));
    rescanAnnotationPins();
    return true;
  }

  function submitProgressDemand(text, opts) {
    opts = opts || {};
    const c = activeCustomer();
    if (!c) return false;
    const t = String(text || '').trim();
    if (!t) {
      App.toast('请描述要查询的订单特征，或点跳过');
      return true;
    }
    const state = ensureProgressPickState();
    state.demandText = t;
    state.filter = '';
    state.visibleCount = COPY_ORDER_LIST_PAGE_SIZE;
    if (opts.simulateUserMsg) simulateUserUtterance(t);
    pushProgressOrderPickCard(c, {
      leadHtml:
        '<p class="sc-reply-lead">已记录需求，请从匹配的历史订单中选择一笔：</p>'
    });
    return true;
  }

  function skipProgressDemandToPick(opts) {
    opts = opts || {};
    const c = activeCustomer();
    if (!c) return false;
    const state = ensureProgressPickState();
    state.demandText = '';
    state.filter = '';
    state.visibleCount = COPY_ORDER_LIST_PAGE_SIZE;
    pushProgressOrderPickCard(c, {
      leadHtml:
        '<p class="sc-reply-lead">已跳过需求，按<strong>最近下单</strong>展示历史订单：</p>'
    });
    if (opts.simulateUserMsg) simulateUserUtterance('跳过');
    return true;
  }

  function openProgressDemandEdit(opts) {
    opts = opts || {};
    const c = activeCustomer();
    if (!c) return;
    enterSkill('progress');
    ctx().progressPickMode = true;
    pushNextAiCard(
      renderDemandPromptCard(c, {
        specId: 'card-progress-demand',
        edit: true,
        optional: true,
        headTitle: '修改查询筛选需求',
        promptMeta: '修改后将重新筛选历史订单列表。'
      }),
      opts.simulateUserMsg ? '修改需求' : null
    );
    rescanAnnotationPins();
  }

  function progressRepickOrder() {
    const c = activeCustomer();
    if (!c) return;
    pushProgressOrderPickCard(c);
  }

  function tryResolveProgressOrderFromUtterance(text, c) {
    if (!text || !c) return null;
    const list = ordersForCustomer(c.id);
    const t = text.trim();
    const m =
      t.match(/(?:进度|查订单|订单到哪|查看订单)\s*(.+)/i) ||
      t.match(/^(SO[\w-]+)/i);
    const needle = m ? String(m[1] || m[0]).trim() : '';
    if (!needle || needle.length < 3) return null;
    const hits = list.filter(function (o) {
      return (o.no || '').toLowerCase().indexOf(needle.toLowerCase()) >= 0;
    });
    if (hits.length === 1) return hits[0];
    return null;
  }

  function renderCopyDemandPromptCard(c) {
    return renderDemandPromptCard(c, {
      specId: 'card-copy-demand',
      allowSkip: true,
      headTitle: '复制订单 · 需求筛选',
      promptMeta:
        '按订单编号、货品名称或自由项筛选；填写后点「确认筛选」，跳过则展示全部历史订单。',
      skipLabel: '跳过，展示全部历史订单'
    });
  }

  function maybeCopyDemandBeforePick(c, opts) {
    opts = opts || {};
    const lastUser = getLatestUserChatText();
    if (
      lastUser &&
      isNaturalDemandText(lastUser) &&
      !isPlainSkillPhrase(lastUser) &&
      !isPlanDemandSkipPhrase(lastUser)
    ) {
      if (submitCopyDemand(lastUser, { simulateUserMsg: false })) return true;
    }
    if (opts.leadHtml) App.pushAiHtml(opts.leadHtml);
    App.pushAiHtml(renderCopyDemandPromptCard(c));
    rescanAnnotationPins();
    return true;
  }

  function submitCopyDemand(text, opts) {
    opts = opts || {};
    const c = activeCustomer();
    if (!c) return false;
    const t = String(text || '').trim();
    if (!t) {
      App.toast('请按订单编号、货品名称或自由项输入筛选条件，或点跳过');
      return true;
    }
    const state = ensureCopyPickState();
    state.demandText = t;
    state.filter = '';
    state.visibleCount = COPY_ORDER_LIST_PAGE_SIZE;
    if (opts.simulateUserMsg) simulateUserUtterance(t);
    pushCopyOrderPickCard(c, {
      leadHtml:
        '<p class="sc-reply-lead">已记录筛选条件，请从匹配的历史订单中选择一笔：</p>'
    });
    return true;
  }

  function skipCopyDemandToPick(opts) {
    opts = opts || {};
    const c = activeCustomer();
    if (!c) return false;
    const state = ensureCopyPickState();
    state.demandText = '';
    state.filter = '';
    state.visibleCount = COPY_ORDER_LIST_PAGE_SIZE;
    pushCopyOrderPickCard(c, {
      leadHtml:
        '<p class="sc-reply-lead">已跳过筛选，按<strong>最近下单</strong>展示全部历史订单：</p>'
    });
    if (opts.simulateUserMsg) simulateUserUtterance('跳过');
    return true;
  }

  function openCopyDemandEdit(opts) {
    opts = opts || {};
    const c = activeCustomer();
    if (!c) return;
    enterSkill('copy');
    ctx().copyPickMode = true;
    pushNextAiCard(
      renderDemandPromptCard(c, {
        specId: 'card-copy-demand',
        edit: true,
        optional: true,
        headTitle: '修改筛选条件',
        promptMeta: '修改后将按订单编号、货品名称或自由项重新筛选历史订单。'
      }),
      opts.simulateUserMsg ? '修改筛选条件' : null
    );
    rescanAnnotationPins();
  }

  function applyCopyOrderQuery(opts) {
    opts = opts || {};
    const inp = document.getElementById('copy-order-query-input');
    const text =
      opts.text != null ? String(opts.text).trim() : inp ? inp.value.trim() : '';
    const c = activeCustomer();
    if (!c) return true;
    const isProgress = !!ctx().progressPickMode;
    const isChange = !!ctx().changePickMode;
    const state = isProgress
      ? ensureProgressPickState()
      : isChange
        ? ensureOrderListPickState('change')
        : ensureCopyPickState();
    state.filter = text;
    state.visibleCount = COPY_ORDER_LIST_PAGE_SIZE;
    const list = filterOrdersForCopyPick(c, state);
    const mode = isProgress ? 'progress' : isChange ? 'change' : 'copy';
    if (isProgress) {
      syncProgressPickActiveList(list, state.visibleCount);
    } else if (isChange) {
      syncChangePickActiveList(list, state.visibleCount);
    } else {
      syncCopyPickActiveList(list, state.visibleCount);
    }
    const meta = text
      ? '<p class="sc-reply-lead">已筛选「' + App.escapeHtml(text) + '」，请在新列表中点选订单。</p>'
      : '<p class="sc-reply-lead">已清空筛选，请点选订单。</p>';
    pushNextAiCard(meta + renderHistoricalOrderPickCard(c, list, { mode: mode }), opts.simulateUserMsg ? text : null);
    rescanAnnotationPins();
    return true;
  }

  function progressOrderLoadMore() {
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

  function copyOrderLoadMore() {
    const c = activeCustomer();
    if (!c) return;
    const isChange = !!ctx().changePickMode;
    const state = isChange ? ensureOrderListPickState('change') : ensureCopyPickState();
    state.visibleCount += COPY_ORDER_LIST_PAGE_SIZE;
    const list = filterOrdersForCopyPick(c, state);
    if (isChange) {
      syncChangePickActiveList(list, state.visibleCount);
    } else {
      syncCopyPickActiveList(list, state.visibleCount);
    }
    const sel = isChange
      ? '[data-spec-id="card-order-pick"][data-change-pick="1"]'
      : '[data-spec-id="card-order-pick"][data-copy-pick="1"]';
    const card = document.querySelector(sel);
    if (card) {
      card.outerHTML = renderHistoricalOrderPickCard(c, list, {
        mode: isChange ? 'change' : 'copy'
      });
      rescanAnnotationPins();
    }
  }

  function tryResolveCopyOrderFromUtterance(text, c) {
    if (!text || !c) return null;
    const list = ordersForCustomer(c.id);
    const t = text.trim();
    const m =
      t.match(/(?:复制|老订单|复制订单)\s*(.+)/i) || t.match(/^(SO[\w-]+)/i);
    const needle = m ? String(m[1] || m[0]).trim() : '';
    if (!needle || needle.length < 3) return null;
    const hits = list.filter(function (o) {
      return (o.no || '').toLowerCase().indexOf(needle.toLowerCase()) >= 0;
    });
    if (hits.length === 1) return hits[0];
    return null;
  }

  function renderOrderPickCard(list, action) {
    const c = activeCustomer();
    if (c && (action === 'copy-pick' || action === 'change-pick')) {
      const mode = action === 'change-pick' ? 'change' : 'copy';
      if (mode === 'copy') resetCopyPickState();
      else resetOrderListPickState('change');
      const state =
        mode === 'copy' ? ensureCopyPickState() : ensureOrderListPickState('change');
      const filtered = filterOrdersForCopyPick(c, state);
      if (mode === 'copy') syncCopyPickActiveList(filtered, state.visibleCount);
      else syncChangePickActiveList(filtered, state.visibleCount);
      return renderHistoricalOrderPickCard(c, filtered, { mode: mode });
    }
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

  function runCopy() {
    const c = requireCustomer();
    if (!c) return;
    if (!DemoData.isOldCustomer(c, DemoData.demoSalesUser)) {
      App.pushAiHtml(
        '<p class="sc-reply-lead">新客户暂无历史订单可复制，请先通过<strong>方案速配</strong>或<strong>产品报价</strong>完成首单。</p>'
      );
      App.toast('暂无历史订单可复制');
      return;
    }
    const list = ordersForCustomer(c.id);
    if (!list.length) {
      App.pushAiHtml('该客户暂无历史订单可复制。');
      return;
    }
    const lastUser = getLatestUserChatText();
    const hit = tryResolveCopyOrderFromUtterance(lastUser, c);
    if (hit) {
      enterSkill('copy');
      copyOrderToConfirm(hit.id, { simulateUserMsg: false });
      return;
    }
    resetCopyPickState();
    maybeCopyDemandBeforePick(c);
  }

  function runChange() {
    const c = requireCustomer();
    if (!c) return;
    if (!DemoData.isOldCustomer(c, DemoData.demoSalesUser)) {
      App.pushAiHtml('新客户暂无订单可变更。');
      App.toast('暂无订单可变更');
      return;
    }
    const list = ordersForCustomer(c.id);
    if (!list.length) {
      App.pushAiHtml('该客户暂无订单可变更。');
      return;
    }
    resetOrderListPickState('change');
    pushChangeOrderPickCard(c);
  }

  function runProgress() {
    const c = requireCustomer();
    if (!c) return;
    const list = ordersForCustomer(c.id);
    if (!list.length) {
      App.pushAiHtml('该客户暂无订单。');
      return;
    }
    const lastUser = getLatestUserChatText();
    const hit = tryResolveProgressOrderFromUtterance(lastUser, c);
    if (hit) {
      enterSkill('progress');
      openOrderProgressDetail(hit.id, { simulateUserMsg: false });
      return;
    }
    resetProgressPickState();
    maybeProgressDemandBeforePick(c);
  }


  function linesFromHistoricalOrder(o) {
    if (!o) return [];
    if (o.lines && o.lines.length) return o.lines.slice();
    const qtyMap = {};
    (o.productIds || []).forEach(function (pid) {
      qtyMap[pid] = (qtyMap[pid] || 0) + 1;
    });
    return Object.keys(qtyMap)
      .map(function (pid) {
        const pr = productById(pid);
        if (!pr) return null;
        return makeQuoteLine(pr, { qty: qtyMap[pid] });
      })
      .filter(Boolean);
  }

  function pushCopyOrderLinePickCard(oid, opts) {
    opts = opts || {};
    const o = DemoData.orders.find(function (x) {
      return x.id === oid;
    });
    if (!o) {
      App.toast('未找到订单');
      return;
    }
    enterSkill('copy');
    setOrderSkillAtEntry(false);
    const lines = linesFromHistoricalOrder(o);
    if (!lines.length) {
      App.toast('该订单无可用明细');
      return;
    }
    ctx().copyLinePickLines = lines;
    ctx().copyLineSelection = lines.map(function () { return true; });
    ctx().copyLinePickSourceOrderId = oid;

    lines.forEach(function (line) {
      const pr = productById(line.productId);
      if (!pr) return;
      const hints = DemoData.priceHints(pr, line.skuId);
      if (line.quotePrice == null) line.quotePrice = hints.latestPrice;
      if (line.sub == null) line.sub = (line.quotePrice || 0) * (line.qty || 1);
    });
    if (opts.simulateUserMsg) {
      simulateUserUtterance('复制订单 ' + o.no);
    }
    App.pushAiHtml(
      '<p class="sc-reply-lead">请勾选要复制的货品（可多选），确认后进入明细修改：</p>' +
        renderCopyOrderLinePickCard(o, lines)
    );
    rescanAnnotationPins();
  }

  function proceedFromLinePickToConfirm(o, opts) {
    opts = opts || {};
    const lines = ctx().copyLinePickLines;
    const selected = ctx().copyLineSelection || lines.map(function () { return true; });
    const filteredLines = lines.filter(function (_, idx) {
      return selected[idx];
    });
    if (!filteredLines.length) {
      App.toast('请至少选择一条货品');
      return false;
    }
    const total = filteredLines.reduce(function (s, l) {
      return s + (l.sub || 0);
    }, 0);
    setOrderPending(filteredLines, {
      customerId: o.customerId,
      sourceType: 'copy',
      copiedOrderId: o.id,
      quoteId: o.quoteId || null,
      total: total
    });
    ctx().orderPending.lines.forEach(function (line) {
      const pr = productById(line.productId);
      if (!pr) return;
      const hints = DemoData.priceHints(pr, line.skuId);
      if (line.latestPrice == null) line.latestPrice = hints.latestPrice;
      if (line.minPrice == null) line.minPrice = hints.minPrice;
      if (line.quotePrice == null) line.quotePrice = hints.latestPrice;
      if (line.sub == null) line.sub = (line.quotePrice || 0) * (line.qty || 1);
    });
    ctx().orderCopyExpandedIdx = 0;
    App.pushAiHtml(
      '<p class="sc-reply-lead">已按订单 <strong>' +
        App.escapeHtml(o.no) +
        '</strong> 带入 ' +
        filteredLines.length + ' 条明细，请核对并修改后确认下单：</p>' +
        renderOrderCopyCard(o)
    );
    rescanAnnotationPins();
    return true;
  }

  function copyOrderToConfirm(oid, opts) {
    opts = opts || {};
    const o = DemoData.orders.find(function (x) {
      return x.id === oid;
    });
    if (!o) {
      App.toast('未找到订单');
      return;
    }
    pushCopyOrderLinePickCard(oid, opts);
  }

function openChangeSheet(oid, opts) {
    opts = opts || {};
    const o = DemoData.orders.find(function (x) {
      return x.id === oid;
    });
    if (!o) {
      App.toast('未找到订单');
      return;
    }
    if (o.status === '已完成') {
      App.toast('已完成订单不可变更');
      return;
    }
    enterSkill('change');
    ctx().changeOrderId = oid;
    ctx().changePickMode = false;
    clearActivePickList();
    if (opts.simulateUserMsg) {
      simulateUserUtterance('变更订单 ' + o.no);
    }
    App.pushAiHtml(
      '<p class="sc-reply-lead">已选择订单 <strong>' +
        App.escapeHtml(o.no) +
        '</strong>，请确认是否发起变更：</p>' +
        renderChangeConfirmCard(oid)
    );
    rescanAnnotationPins();
  }

  function renderChangeConfirmCard(oid) {
    const o = DemoData.orders.find(function (x) {
      return x.id === oid;
    });
    const c = o ? App.getCustomer(o.customerId) : null;
    return (
      '<div class="sc-card sc-card--compact sc-card--inline-form" data-spec-id="card-change-confirm" data-change-oid="' +
      App.escapeHtml(oid) +
      '">' +
      '<div class="sc-card__head sc-card__head--compact">订单变更 · 确认变更</div>' +
      (o
        ? '<p class="sc-card__meta">订单 <strong>' +
          App.escapeHtml(o.no) +
          '</strong> · ' +
          App.escapeHtml(o.date || '—') +
          ' · ' +
          App.escapeHtml(o.amount || '—') +
          '</p><p class="sc-card__meta">' +
          App.escapeHtml(o.items || '—') +
          '</p>'
        : '') +
      '<p class="sc-card__meta">客户：<strong>' +
      App.escapeHtml(c ? c.name : '—') +
      '</strong></p>' +
      '<p class="sc-card__meta">确认后将提交变更申请；已审核订单将回退至销售审核。</p>' +
      '<div class="sc-card__actions-inline">' +
      '<button type="button" class="sc-btn sc-btn--ghost" data-action="change-repick-order">重选订单</button>' +
      '<button type="button" class="sc-btn sc-btn--primary" data-action="change-confirm-submit">确认变更</button></div>' +
      '</div>'
    );
  }

  function changeRepickOrder() {
    const c = activeCustomer();
    if (!c) return;
    ctx().changeOrderId = null;
    pushChangeOrderPickCard(c);
  }

  function getLatestChangeConfirmCard() {
    const cards = document.querySelectorAll('[data-spec-id="card-change-confirm"]');
    return cards.length ? cards[cards.length - 1] : null;
  }

  function submitChange(opts) {
    opts = opts || {};
    const confirmCard = getLatestChangeConfirmCard();
    const formCard = getActiveFormCard('sheet-change');
    const card = confirmCard || formCard;
    const oid =
      (card && card.getAttribute('data-change-oid')) || ctx().changeOrderId;
    const o = DemoData.orders.find(function (x) {
      return x.id === oid;
    });
    if (!o) {
      App.toast('未找到订单');
      return;
    }
    const fromConfirm = !!confirmCard && !formCard;
    const reasonEl = card && card.querySelector('[data-field="change-reason"]');
    const remarkField = card && card.querySelector('[data-field="change-remark"]');
    const reason =
      reasonEl && reasonEl.value
        ? reasonEl.value
        : (DemoData.changeReasons && DemoData.changeReasons[0]) || '客户要求变更';
    const remark =
      remarkField && remarkField.value.trim()
        ? remarkField.value.trim()
        : fromConfirm || opts.fromConfirm
          ? '用户确认变更'
          : '';
    if (!fromConfirm && !opts.fromConfirm && !remark) {
      App.toast('请填写变更备注');
      return;
    }
    if (o.status === '已审核') {
      o.status = '销售审核';
      o.statusDetail = '变更申请已受理，重新进入销售审核';
    } else {
      o.statusDetail = (o.statusDetail || '') + '；变更申请已受理';
    }
    ctx().changeOrderId = null;
    App.closeOverlays();
    App.pushAiHtml(renderChangeSuccessCard(o, { fromConfirm: fromConfirm || opts.fromConfirm }));
    rescanAnnotationPins();
  }

  function renderChangeSuccessCard(o, opts) {
    opts = opts || {};
    if (opts.fromConfirm) {
      return (
        '<div class="sc-card" data-spec-id="card-change-success"><div class="sc-card__head sc-card__head--compact">变更已提交</div>' +
        '<div class="sc-card__row sc-card__row--compact"><p class="sc-card__meta">订单 <strong>' +
        App.escapeHtml(o ? o.no : '—') +
        '</strong></p><p class="sc-card__meta">变更申请已受理' +
        (o && o.status === '销售审核' ? '，订单已回退至销售审核' : '') +
        '。</p></div></div>'
      );
    }
    const reason = opts.reason || '';
    const remark = opts.remark || '';
    return (
      '<div class="sc-card" data-spec-id="card-change-success"><div class="sc-card__head sc-card__head--compact">变更已提交</div>' +
      '<div class="sc-card__row sc-card__row--compact"><p class="sc-card__meta">订单 <strong>' +
      App.escapeHtml(o ? o.no : '—') +
      '</strong></p><p class="sc-card__meta">原因：' +
      App.escapeHtml(reason) +
      '；备注：' +
      App.escapeHtml(remark) +
      '</p></div></div>'
    );
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

  var CAPACITY_HOUR_WIDTH = 18;
  var CAPACITY_ROW_HEIGHT = 34;
  var CAPACITY_WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

  function parseCapacityTs(value) {
    if (!value) return NaN;
    return new Date(String(value).replace(' ', 'T')).getTime();
  }

  function capacityHoursBetween(startAt, endAt) {
    return (parseCapacityTs(endAt) - parseCapacityTs(startAt)) / 3600000;
  }

  function capacityOffsetHours(rangeStart, at) {
    return (parseCapacityTs(at) - parseCapacityTs(rangeStart)) / 3600000;
  }

  function formatCapacityDayFromRange(rangeStart, dayIndex) {
    var d = new Date(parseCapacityTs(rangeStart));
    d.setDate(d.getDate() + dayIndex);
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return y + '/' + m + '/' + day + '（' + CAPACITY_WEEKDAYS[d.getDay()] + '）';
  }

  function capacityLoadRateClass(rate) {
    if (rate >= 90) return ' sc-capacity-summary__rate--high';
    if (rate < 60) return ' sc-capacity-summary__rate--low';
    return '';
  }

  function renderCapacitySummary(data) {
    var lines = data.summaryLines || [];
    var rate = data.averageLoadRate;
    var html = '<div class="sc-capacity-summary">';
    lines.forEach(function (line, idx) {
      if (idx === 1 && rate != null && String(line).indexOf(String(rate)) >= 0) {
        html +=
          '<p class="sc-capacity-summary__line">平均负荷率 <strong class="sc-capacity-summary__rate' +
          capacityLoadRateClass(rate) +
          '">' +
          App.escapeHtml(String(rate)) +
          '%</strong></p>';
      } else if (idx === 0) {
        html += '<p class="sc-capacity-summary__line sc-capacity-summary__line--lead">' + App.escapeHtml(line) + '</p>';
      } else {
        html += '<p class="sc-capacity-summary__meta">' + App.escapeHtml(line) + '</p>';
      }
    });
    if (!lines.length) {
      html +=
        '<p class="sc-capacity-summary__line sc-capacity-summary__line--lead">当前排产已占用至 ' +
        App.escapeHtml(data.scheduledUntil || '—') +
        '</p>';
      if (rate != null) {
        html +=
          '<p class="sc-capacity-summary__line">平均负荷率 <strong class="sc-capacity-summary__rate' +
          capacityLoadRateClass(rate) +
          '">' +
          App.escapeHtml(String(rate)) +
          '%</strong></p>';
      }
    }
    html += '</div>';
    return html;
  }

  function renderCapacityTimelineHeader(data, totalWidth, dayWidth) {
    var rangeStart = data.rangeStart;
    var rangeEnd = data.rangeEnd;
    var totalHours = capacityHoursBetween(rangeStart, rangeEnd);
    var days = Math.ceil(totalHours / 24);
    var dateRow = '';
    var hourRow = '';
    var i;
    for (i = 0; i < days; i++) {
      dateRow +=
        '<div class="sc-capacity-gantt__date" style="width:' +
        dayWidth +
        'px">' +
        App.escapeHtml(formatCapacityDayFromRange(rangeStart, i)) +
        '</div>';
      var h;
      for (h = 1; h <= 23; h++) {
        hourRow +=
          '<span class="sc-capacity-gantt__hour" style="width:' +
          CAPACITY_HOUR_WIDTH +
          'px">' +
          String(h).padStart(2, '0') +
          '</span>';
      }
      hourRow += '<span class="sc-capacity-gantt__hour" style="width:' + CAPACITY_HOUR_WIDTH + 'px">00</span>';
    }
    return (
      '<div class="sc-capacity-gantt__timeline" style="width:' +
      totalWidth +
      'px">' +
      '<div class="sc-capacity-gantt__date-row">' +
      dateRow +
      '</div><div class="sc-capacity-gantt__hour-row">' +
      hourRow +
      '</div></div>'
    );
  }

  function renderCapacityNonWorkingSlots(data, totalWidth, gridHeight) {
    return (data.nonWorkingSlots || [])
      .map(function (slot) {
        var left = capacityOffsetHours(data.rangeStart, slot.startAt) * CAPACITY_HOUR_WIDTH;
        var width = capacityHoursBetween(slot.startAt, slot.endAt) * CAPACITY_HOUR_WIDTH;
        return (
          '<div class="sc-capacity-gantt__nw" style="left:' +
          left +
          'px;width:' +
          width +
          'px;height:' +
          gridHeight +
          'px"></div>'
        );
      })
      .join('');
  }

  function renderCapacityNowLine(data, gridHeight) {
    if (!data.currentTime) return '';
    var left = capacityOffsetHours(data.rangeStart, data.currentTime) * CAPACITY_HOUR_WIDTH;
    return (
      '<div class="sc-capacity-gantt__now" style="left:' +
      left +
      'px;height:' +
      gridHeight +
      'px" aria-hidden="true"></div>'
    );
  }

  function renderCapacityBlock(occ, rangeStart) {
    var left = capacityOffsetHours(rangeStart, occ.startAt) * CAPACITY_HOUR_WIDTH;
    var width = Math.max(capacityHoursBetween(occ.startAt, occ.endAt) * CAPACITY_HOUR_WIDTH, 4);
    var status = occ.status || 'scheduled';
    var label = occ.detail && occ.detail.orderNo ? occ.detail.orderNo.slice(-6) : '';
    var badges = '';
    if (occ.locked) badges += '<span class="sc-capacity-block__lock" aria-hidden="true">🔒</span>';
    if (status === 'pre') badges += '<span class="sc-capacity-block__pre">预</span>';
    return (
      '<div class="sc-capacity-block sc-capacity-block--' +
      App.escapeHtml(status) +
      '" style="left:' +
      left +
      'px;width:' +
      width +
      'px" title="' +
      App.escapeHtml((occ.detail && occ.detail.orderNo) || '') +
      '">' +
      badges +
      (width >= 36 ? '<span class="sc-capacity-block__label">' + App.escapeHtml(label) + '</span>' : '') +
      '</div>'
    );
  }

  function renderCapacityGantt(data) {
    var rangeStart = data.rangeStart;
    var rangeEnd = data.rangeEnd;
    var totalHours = capacityHoursBetween(rangeStart, rangeEnd);
    var totalWidth = totalHours * CAPACITY_HOUR_WIDTH;
    var dayWidth = 24 * CAPACITY_HOUR_WIDTH;
    var occByLine = {};
    (data.occupancies || []).forEach(function (occ) {
      if (!occByLine[occ.lineId]) occByLine[occ.lineId] = [];
      occByLine[occ.lineId].push(occ);
    });

    var leftLabels = '<div class="sc-capacity-gantt__corner">产线</div>';
    var gridRows = '';
    var rowCount = 0;
    (data.categories || []).forEach(function (cat) {
      leftLabels +=
        '<div class="sc-capacity-gantt__cat-label">' + App.escapeHtml(cat.name) + '</div>';
      gridRows += '<div class="sc-capacity-gantt__cat-spacer"></div>';
      (cat.lines || []).forEach(function (line) {
        rowCount += 1;
        leftLabels +=
          '<div class="sc-capacity-gantt__line-label" title="' +
          App.escapeHtml(line.name) +
          '">' +
          App.escapeHtml(line.name) +
          '</div>';
        var blocks = (occByLine[line.id] || [])
          .map(function (occ) {
            return renderCapacityBlock(occ, rangeStart);
          })
          .join('');
        gridRows +=
          '<div class="sc-capacity-gantt__row" style="height:' +
          CAPACITY_ROW_HEIGHT +
          'px">' +
          blocks +
          '</div>';
      });
    });

    var gridHeight = rowCount * CAPACITY_ROW_HEIGHT + (data.categories || []).length * 22;
    var timeline = renderCapacityTimelineHeader(data, totalWidth, dayWidth);
    var nw = renderCapacityNonWorkingSlots(data, totalWidth, gridHeight);
    var nowLine = renderCapacityNowLine(data, gridHeight);

    return (
      '<div class="sc-capacity-gantt">' +
      '<div class="sc-capacity-gantt__left">' +
      leftLabels +
      '</div>' +
      '<div class="sc-capacity-gantt__scroll" data-capacity-scroll>' +
      '<div class="sc-capacity-gantt__canvas" style="width:' +
      totalWidth +
      'px">' +
      timeline +
      '<div class="sc-capacity-gantt__grid" style="height:' +
      gridHeight +
      'px">' +
      nw +
      '<div class="sc-capacity-gantt__rows">' +
      gridRows +
      '</div>' +
      nowLine +
      '</div></div></div></div>'
    );
  }

  function renderCapacityCard(data) {
    return (
      '<div class="sc-card sc-card--capacity" data-spec-id="card-capacity">' +
      '<div class="sc-card__head sc-card__head--compact">产能分析</div>' +
      renderCapacitySummary(data) +
      renderCapacityGantt(data) +
      '</div>'
    );
  }

  var BIZ_METRICS = [
    { id: 'orderCount', label: '订单量' },
    { id: 'quantity', label: '总数量' },
    { id: 'amount', label: '总金额' }
  ];
  var BIZ_DEFAULT_METRIC = 'amount';

  var BIZ_DEFAULT_TAB = 'salesperson';

  function formatBizMetricValue(metric, value) {
    var n = Number(value) || 0;
    if (metric === 'orderCount') return n + ' 单';
    if (metric === 'quantity') return n.toLocaleString('zh-CN') + ' 件';
    if (metric === 'amount') {
      if (n >= 10000) {
        var wan = n / 10000;
        return '¥' + (wan >= 100 ? wan.toFixed(0) : wan.toFixed(1).replace(/\.0$/, '')) + ' 万';
      }
      return '¥' + n.toLocaleString('zh-CN');
    }
    return String(n);
  }

  function bizRankItems(data, tab) {
    return tab === 'salesperson' ? data.salespersons || [] : data.customers || [];
  }

  function sortedBizRank(items, metric) {
    return items
      .slice()
      .sort(function (a, b) {
        return (b[metric] || 0) - (a[metric] || 0);
      })
      .slice(0, 10);
  }

  function renderBizRankListHtml(items, metric) {
    var sorted = sortedBizRank(items, metric);
    if (!sorted.length) {
      return '<p class="sc-biz-rank__empty">暂无排行数据</p>';
    }
    var html = '<ol class="sc-biz-rank__list">';
    sorted.forEach(function (item, i) {
      html +=
        '<li class="sc-biz-rank__item">' +
        '<span class="sc-biz-rank__idx">' +
        (i + 1) +
        '</span>' +
        '<span class="sc-biz-rank__name" title="' +
        App.escapeHtml(item.name) +
        '">' +
        App.escapeHtml(item.name) +
        '</span>' +
        '<span class="sc-biz-rank__value">' +
        formatBizMetricValue(metric, item[metric]) +
        '</span>' +
        '</li>';
    });
    html += '</ol>';
    return html;
  }

  function computeBizInsight(data, tab) {
    if (data.insights && data.insights[tab]) {
      return data.insights[tab];
    }
    var items = bizRankItems(data, tab);
    var totalAmount = (data.totals && data.totals.amount) || 0;
    if (!items.length || !totalAmount) {
      return '暂无足够数据，无法给出经营结论。';
    }
    var byAmount = items
      .slice()
      .sort(function (a, b) {
        return (b.amount || 0) - (a.amount || 0);
      });
    var top1 = byAmount[0];
    var top1Share = Math.round(((top1.amount || 0) / totalAmount) * 100);
    var top3Share = Math.round(
      (byAmount.slice(0, 3).reduce(function (s, x) {
        return s + (x.amount || 0);
      }, 0) /
        totalAmount) *
        100
    );

    if (tab === 'salesperson') {
      if (top3Share >= 55) {
        return (
          top1.name +
          ' 成交居首，前三业务员贡献了 ' +
          top3Share +
          '% 业绩，团队出单高度集中在头部。'
        );
      }
      if (top1Share >= 35) {
        return (
          top1.name +
          ' 一人贡献了 ' +
          top1Share +
          '% 业绩，头部效应明显，需关注梯队建设。'
        );
      }
      return (
        top1.name +
        ' 成交金额最高，出单分布较均衡，多数业务员均有贡献。'
      );
    }

    var top5Share = Math.round(
      (byAmount.slice(0, 5).reduce(function (s, x) {
        return s + (x.amount || 0);
      }, 0) /
        totalAmount) *
        100
    );
    var top1Short = top1.name.length > 8 ? top1.name.slice(0, 8) + '…' : top1.name;
    if (top5Share >= 50) {
      return (
        '前五大客户贡献了 ' +
        top5Share +
        '% 销售额，对大客户依赖明显，需防范客户集中风险。'
      );
    }
    if (top1Share >= 20) {
      return (
        top1Short +
        ' 是最大客户，占总额 ' +
        top1Share +
        '%，整体客户结构尚可，但仍需持续拓客。'
      );
    }
    return '客户贡献较分散，未出现单一客户过度依赖，经营结构相对健康。';
  }

  function renderBizOverviewHtml(data, tab) {
    var text = computeBizInsight(data, tab);
    return (
      '<div class="sc-biz-overview" data-biz-overview data-spec-id="card-biz-analysis-insight">' +
      '<p class="sc-biz-overview__line">' +
      App.escapeHtml(text) +
      '</p></div>'
    );
  }

  function getBizCardMetric(card) {
    var tab = card.dataset.bizTab || BIZ_DEFAULT_TAB;
    var key = tab === 'salesperson' ? 'bizMetricSalesperson' : 'bizMetricCustomer';
    return card.dataset[key] || BIZ_DEFAULT_METRIC;
  }

  function setBizCardMetric(card, metric) {
    var tab = card.dataset.bizTab || BIZ_DEFAULT_TAB;
    var key = tab === 'salesperson' ? 'bizMetricSalesperson' : 'bizMetricCustomer';
    card.dataset[key] = metric;
  }

  function refreshBizAnalysisCard(card) {
    if (!card) return;
    var data = DemoData.bizAnalysis;
    if (!data) return;
    var tab = card.dataset.bizTab || BIZ_DEFAULT_TAB;
    var metric = getBizCardMetric(card);
    var rankEl = card.querySelector('[data-biz-rank]');
    if (rankEl) {
      rankEl.innerHTML = renderBizRankListHtml(bizRankItems(data, tab), metric);
    }
    card.querySelectorAll('[data-action="biz-metric"]').forEach(function (btn) {
      var active = btn.getAttribute('data-metric') === metric;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
    });
  }

  function refreshBizInsight(card) {
    if (!card) return;
    var data = DemoData.bizAnalysis;
    if (!data) return;
    var tab = card.dataset.bizTab || BIZ_DEFAULT_TAB;
    var overviewEl = card.querySelector('[data-biz-overview-wrap]');
    if (overviewEl) {
      overviewEl.innerHTML = renderBizOverviewHtml(data, tab);
    }
  }

  function switchBizTab(card, tab) {
    if (!card || !tab) return;
    card.dataset.bizTab = tab;
    card.querySelectorAll('[data-action="biz-tab"]').forEach(function (btn) {
      var active = btn.getAttribute('data-tab') === tab;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    refreshBizInsight(card);
    refreshBizAnalysisCard(card);
  }

  function switchBizMetric(card, metric) {
    if (!card || !metric) return;
    setBizCardMetric(card, metric);
    refreshBizAnalysisCard(card);
  }

  function renderBizAnalysisCard(data) {
    var metric = BIZ_DEFAULT_METRIC;
    var defaultTab = BIZ_DEFAULT_TAB;
    return (
      '<div class="sc-card sc-card--biz" data-spec-id="card-biz-analysis" data-biz-tab="' +
      defaultTab +
      '" data-biz-metric-customer="' +
      BIZ_DEFAULT_METRIC +
      '" data-biz-metric-salesperson="' +
      BIZ_DEFAULT_METRIC +
      '">' +
      '<div class="sc-card__head sc-card__head--compact">业务分析</div>' +
      '<p class="sc-biz-meta">统计范围：' +
      App.escapeHtml(data.rangeLabel) +
      ' · 共 ' +
      data.totalRecords +
      ' 笔</p>' +
      '<div class="sc-biz-tabs" role="tablist">' +
      '<button type="button" class="sc-biz-tabs__btn is-active" role="tab" data-action="biz-tab" data-tab="salesperson" aria-selected="true">业务员排行</button>' +
      '<button type="button" class="sc-biz-tabs__btn" role="tab" data-action="biz-tab" data-tab="customer" aria-selected="false">客户排行</button>' +
      '</div>' +
      '<div data-biz-overview-wrap>' +
      renderBizOverviewHtml(data, defaultTab) +
      '</div>' +
      '<div class="sc-biz-metrics" role="group" aria-label="排序指标">' +
      BIZ_METRICS.map(function (m) {
        return (
          '<button type="button" class="sc-biz-metrics__btn' +
          (m.id === metric ? ' is-active' : '') +
          '" data-action="biz-metric" data-metric="' +
          m.id +
          '" aria-selected="' +
          (m.id === metric ? 'true' : 'false') +
          '">' +
          m.label +
          '</button>'
        );
      }).join('') +
      '</div>' +
      '<div class="sc-biz-rank" data-biz-rank>' +
      renderBizRankListHtml(data.salespersons || [], metric) +
      '</div>' +
      '<p class="sc-biz-hint">切换 Tab 查看客户排行；点指标切换列表排序</p>' +
      '<div class="sc-card__actions-inline">' +
      '<button type="button" class="sc-btn sc-btn--ghost" data-action="biz-change-range">选择时间范围</button>' +
      '</div>' +
      '</div>'
    );
  }


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

  function filterInventoryRows(allRows, filter) {
    const keyword = String(filter || '').toLowerCase().trim();
    if (!keyword) return allRows;
    return allRows.filter(function (row) {
      const code = String(row.inventoryCode || '').toLowerCase();
      const name = String(row.productName || '').toLowerCase();
      return code.indexOf(keyword) >= 0 || name.indexOf(keyword) >= 0;
    });
  }

  function renderInventoryFilterCard() {
    return (
      '<div class="sc-card sc-card--compact" data-spec-id="card-inventory-filter">' +
      '<div class="sc-card__head sc-card__head--compact">请输入筛选条件</div>' +
      '<p class="sc-card__meta">填写存货编码或名称后点确认；也可跳过，直接查看全部库存。</p>' +
      '<div class="sc-plan-query-row">' +
      '<input type="search" class="sc-input sc-input--field" id="inventory-filter-input" placeholder="输入存货编码或名称..."/>' +
      '<button type="button" class="sc-btn sc-btn--ghost" data-action="inventory-filter-submit">确认</button>' +
      '</div>' +
      '<div class="sc-card__actions-inline">' +
      '<button type="button" class="sc-btn sc-btn--ghost" data-action="inventory-filter-skip">跳过，查看全部</button>' +
      '</div>' +
      '</div>'
    );
  }

  function renderInventoryResultCard(allRows, filter) {
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
    const emptyHint = !allRows.length ? '<p class="sc-card__meta">暂无匹配的库存数据。</p>' : '';
    const filterLabel = filter ? ' · 筛选：' + App.escapeHtml(filter) : '';
    return (
      '<div class="sc-card sc-card--compact sc-card--inventory" data-spec-id="card-inventory">' +
      '<div class="sc-card__head sc-card__head--compact">库存查询' + filterLabel + '</div>' +
      '<div class="sc-biz-overview sc-inventory__overview">' +
      '<p class="sc-biz-overview__line sc-card-summary-line"><strong>合计：货品：' +
      summary.totalProducts + '  规格：' + summary.totalSku + '  空库存：' + summary.zeroAvail +
      '</strong></p></div>' +
      (listItems ? '<div class="sc-inventory-list">' + listItems + '</div>' : emptyHint) +
      '<div class="sc-card__actions-inline">' +
      '<button type="button" class="sc-btn sc-btn--ghost" data-action="inventory-reset-filter">重新筛选</button>' +
      '</div>' +
      '</div>'
    );
  }

  function runInventory(opts) {
    opts = opts || {};
    const filter = opts.filter || '';
    const rows = DemoData.buildInventorySnapshotRows ? DemoData.buildInventorySnapshotRows() : [];
    if (!rows.length) {
      App.toast('暂无库存数据');
      return;
    }
    const utterance = opts.utterance || '';
    if (opts.simulateUserMsg && utterance) {
      simulateUserUtteranceUnlessDuplicate(utterance);
    }
    if (!filter) {
      App.pushAiHtml(
        '<p class="sc-reply-lead">为您查询库存，请先输入筛选条件。</p>' +
          renderInventoryFilterCard()
      );
    } else {
      const filteredRows = filterInventoryRows(rows, filter);
      App.pushAiHtml(
        '<p class="sc-reply-lead">为您查询 <strong>' + App.escapeHtml(filter) + '</strong> 相关货品规格库存（全仓合计）：</p>' +
          renderInventoryResultCard(filteredRows, filter)
      );
    }
    rescanAnnotationPins();
  }


  function formatPaymentMoney(n) {
    var num = Number(n) || 0;
    if (num >= 10000) {
      var wan = num / 10000;
      return (
        '¥' +
        (wan >= 100 ? wan.toFixed(0) : wan.toFixed(1).replace(/\.0$/, '')) +
        ' 万'
      );
    }
    return fmtMoney(num);
  }

  function formatPaymentMoneyShort(n) {
    var num = Number(n) || 0;
    if (num >= 10000) {
      var wan = num / 10000;
      return (wan >= 100 ? wan.toFixed(0) : wan.toFixed(1).replace(/\.0$/, '')) + '万';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    }
    return String(num);
  }

  function renderPaymentResultCard(data, year) {
    var displayYear = year || new Date().getFullYear();
    return (
      '<div class="sc-card sc-card--compact sc-card--payment" data-spec-id="card-payment">' +
      '<div class="sc-card__head sc-card__head--compact">回款分析 · ' + displayYear + '年</div>' +
      '<div class="sc-payment-overview">' +
      '<div class="sc-payment-overview__item">' +
      '<span class="sc-payment-overview__label">本年销售金额</span>' +
      '<span class="sc-payment-overview__value">' + formatPaymentMoney(data.annualSalesAmount) + '</span>' +
      '</div>' +
      '<div class="sc-payment-overview__item">' +
      '<span class="sc-payment-overview__label">计划收款额</span>' +
      '<span class="sc-payment-overview__value">' + formatPaymentMoney(data.plannedCollectionAmount) + '</span>' +
      '</div>' +
      '<div class="sc-payment-overview__item">' +
      '<span class="sc-payment-overview__label">应收金额</span>' +
      '<span class="sc-payment-overview__value">' + formatPaymentMoney(data.receivableBalance) + '</span>' +
      '</div>' +
      '<div class="sc-payment-overview__item">' +
      '<span class="sc-payment-overview__label">未收金额</span>' +
      '<span class="sc-payment-overview__value sc-payment-overview__value--warn">' + formatPaymentMoney(data.unreceivedAmount) + '</span>' +
      '</div>' +
      '</div>' +
      renderPaymentMonthlyChart(data.monthlyDetails || []) +
      '<div class="sc-card__actions-inline">' +
      '<button type="button" class="sc-btn sc-btn--ghost" data-action="payment-change-year">更换年份</button>' +
      '</div>' +
      '</div>'
    );
  }

  function renderPaymentYearPickerCard(currentYear) {
    var years = [2021, 2022, 2023, 2024, 2025];
    var current = currentYear || new Date().getFullYear();
    var yearOptions = years.map(function(y) {
      var isChecked = y === current;
      return '<label class="sc-radio-label">' +
        '<input type="radio" name="payment-year" value="' + y + '"' + (isChecked ? ' checked' : '') + '>' +
        '<span>' + y + '年</span>' +
        '</label>';
    }).join('');
    return (
      '<p class="sc-reply-lead">请选择年份：</p>' +
      '<div class="sc-card sc-card--compact" data-spec-id="card-payment-year-picker">' +
      '<div class="sc-card__body">' +
      '<div class="sc-radio-group">' +
      yearOptions +
      '</div>' +
      '</div>' +
      '<div class="sc-card__actions">' +
      '<button type="button" class="sc-btn sc-btn--ghost" data-action="payment-year-cancel">取消</button>' +
      '<button type="button" class="sc-btn sc-btn--primary" data-action="payment-year-confirm">确认</button>' +
      '</div>' +
      '</div>'
    );
  }

  function renderBizDateRangePickerCard() {
    var today = new Date();
    var defaultEnd = today.toISOString().slice(0, 10);
    var defaultStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
    return (
      '<p class="sc-reply-lead">请选择时间范围：</p>' +
      '<div class="sc-card sc-card--compact" data-spec-id="card-biz-date-range-picker">' +
      '<div class="sc-card__body">' +
      '<div class="sc-date-range-picker">' +
      '<div class="sc-date-range-picker__row">' +
      '<label class="sc-date-range-picker__label">开始时间</label>' +
      '<input type="date" class="sc-input sc-input--field" data-action="biz-range-start" value="' + defaultStart + '">' +
      '</div>' +
      '<div class="sc-date-range-picker__row">' +
      '<label class="sc-date-range-picker__label">结束时间</label>' +
      '<input type="date" class="sc-input sc-input--field" data-action="biz-range-end" value="' + defaultEnd + '">' +
      '</div>' +
      '</div>' +
      '</div>' +
      '<div class="sc-card__actions">' +
      '<button type="button" class="sc-btn sc-btn--ghost" data-action="biz-range-cancel">取消</button>' +
      '<button type="button" class="sc-btn sc-btn--primary" data-action="biz-range-confirm">确认</button>' +
      '</div>' +
      '</div>'
    );
  }

  function renderPaymentMonthlyChart(monthlyDetails) {
    if (!monthlyDetails.length) return '';
    var maxTotal = 0;
    monthlyDetails.forEach(function (d) {
      var total = (d.receivable || 0) + (d.unreceived || 0);
      if (total > maxTotal) maxTotal = total;
    });
    maxTotal = maxTotal || 1;

    var rows = monthlyDetails.map(function (d) {
      var total = (d.receivable || 0) + (d.unreceived || 0);
      var recW = Math.max((d.receivable / maxTotal) * 100, d.receivable > 0 ? 2 : 0);
      var unrecW = Math.max((d.unreceived / maxTotal) * 100, d.unreceived > 0 ? 2 : 0);
      var isFuture = d.receivable === 0 && d.unreceived === 0;
      var futureCls = isFuture ? ' sc-payment-chart__row--future' : '';
      return (
        '<div class="sc-payment-chart__row' + futureCls + '">' +
        '<span class="sc-payment-chart__row-label">' + App.escapeHtml(d.month) + '</span>' +
        '<div class="sc-payment-chart__row-bar">' +
        (d.receivable > 0
          ? '<div class="sc-payment-chart__seg sc-payment-chart__seg--receivable" style="width:' + recW.toFixed(1) + '%"><span class="sc-payment-chart__seg-amount">' + formatPaymentMoneyShort(d.receivable) + '</span></div>'
          : '') +
        (d.unreceived > 0
          ? '<div class="sc-payment-chart__seg sc-payment-chart__seg--unreceived" style="width:' + unrecW.toFixed(1) + '%"><span class="sc-payment-chart__seg-amount">' + formatPaymentMoneyShort(d.unreceived) + '</span></div>'
          : '') +
        '</div>' +
        '</div>'
      );
    }).join('');

    var legend = (
      '<div class="sc-payment-chart__legend">' +
      '<span class="sc-payment-chart__legend-item"><span class="sc-payment-chart__dot sc-payment-chart__dot--receivable"></span>应收金额</span>' +
      '<span class="sc-payment-chart__legend-item"><span class="sc-payment-chart__dot sc-payment-chart__dot--unreceived"></span>未收金额</span>' +
      '</div>'
    );

    return (
      '<div class="sc-payment-chart">' +
      '<p class="sc-payment-chart__title">月度应收与未收趋势</p>' +
      legend +
      '<div class="sc-payment-chart__body">' +
      rows +
      '</div>' +
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

  function run(skillId) {
    switch (skillId) {
      case 'followup':
        App.requestFollowUpListByClick();
        break;
      case 'plan':
        showPlanSkillEntry();
        break;
      case 'quote':
        showQuoteSkillEntry();
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

  function customersInEnterprise() {
    const ent = App.state.enterpriseId;
    return DemoData.customers.filter((c) => c.enterpriseId === ent);
  }

  /** 与选客户抽屉一致：当前业务员老客户 + 本企业公海新客户 */
  function customersInPickerScope() {
    const user = DemoData.demoSalesUser || DemoData.salesperson;
    return DemoData.customersVisibleToSalesUser(customersInEnterprise(), user);
  }

  function syncCustomerFromDemandUtterance(text) {
    if (!DemoData.resolveCustomerUtterance) return;
    const res = DemoData.resolveCustomerUtterance(text, customersInPickerScope());
    if (res.status === 'ambiguous') {
      if (App.openCustomerSheet) App.openCustomerSheet(res.query);
      return;
    }
    if (res.status !== 'unique') return;
    const cur = activeCustomer();
    if (cur && cur.id === res.customer.id) return;
    App.state.customerId = res.customer.id;
    App.state.selectedFollowUpId = res.customer.id;
    App.saveState();
    App.refreshHeader();
  }

  const WORKFLOW_SKILL_LABELS = {
    plan: '方案速配',
    quote: '产品报价',
    order: '确认下单'
  };

  /** 以对话区最新助手业务卡为准（避免 activeSkill / ctx 残留导致跨功能判断跳过） */
  function inferWorkflowSkillFromLatestCard() {
    const msgs = document.querySelectorAll('#messages .sc-msg');
    for (let i = msgs.length - 1; i >= 0; i--) {
      const row = msgs[i];
      if (row.classList.contains('sc-msg--user')) continue;
      const bubble = row.querySelector('.sc-bubble--ai');
      if (!bubble) continue;
      if (
        bubble.querySelector(
          '[data-spec-id="card-plan-preview"], [data-spec-id="card-plan-pick"], [data-spec-id="card-plan-demand"]'
        )
      ) {
        return 'plan';
      }
      if (
        bubble.querySelector('[data-spec-id="card-scheme"], [data-spec-id="card-scheme-pick"]')
      ) {
        return 'plan';
      }
      const quotePick = bubble.querySelector('[data-spec-id="card-quote-pick"]');
      if (quotePick && quotePick.getAttribute('data-order-via-quote-pick') === '1') {
        return 'order';
      }
      if (
        bubble.querySelector(
          '[data-spec-id="card-quote-source"], [data-spec-id="card-quote-demand"], [data-spec-id="card-quote-pick"], [data-spec-id="card-quote-cart"], [data-spec-id="card-quote-select"], [data-spec-id="card-quote"]'
        )
      ) {
        return 'quote';
      }
      if (
        bubble.querySelector(
          '[data-spec-id="card-order-source"], [data-spec-id="card-order-pick"], [data-spec-id="card-order-cart"]'
        )
      ) {
        return 'order';
      }
    }
    return null;
  }

  function getActiveWorkflowSkill() {
    const domSkill = inferWorkflowSkillFromLatestCard();
    if (domSkill) return domSkill;
    const s = App.state.activeSkill;
    if (s === 'plan' || s === 'quote' || s === 'order') return s;
    if (ctx().plan && ctx().plan.customerId) return 'plan';
    if (ctx().quoteDraft && ctx().quoteDraft.customerId) return 'quote';
    if (ctx().orderDraft && ctx().orderDraft.customerId) return 'order';
    return null;
  }

  function detectCrossTargetSkill(text) {
    const t = (text || '').trim();
    if (!t) return null;
    if (isOrderByQuoteEntryPhrase(t)) return 'order';
    if (isOrderDemandText(t) && !/报价|报个价/.test(t)) return 'order';
    if (isSchemeQuoteEntryPhrase(t) || isQuoteEntryPhrase(t)) return 'quote';
    if (/^(去报价|报价|产品报价|按方案\s*报价)/.test(t)) return 'quote';
    if (/^(配个方案|做方案|方案速配)/.test(t)) return 'plan';
    if (/方案|配个方案|做方案|方案速配/.test(t) && !/报价|下单|生成订单/.test(t)) return 'plan';
    if (/^(下单|确认下单|生成订单)/.test(t)) return 'order';
    return null;
  }

  /** 跨功能切换口令：非一句话直达（长句仍走原生成逻辑） */
  function isCrossFunctionSwitchPhrase(text, targetSkill) {
    const t = (text || '').trim();
    if (!targetSkill || !t) return false;
    if (targetSkill === 'quote') {
      if (isNaturalDemandText(t) && (/单价|折扣|给.+报价|打.+折/.test(t) || t.length > 18)) return false;
      return (
        isQuoteEntryPhrase(t) ||
        isSchemeQuoteEntryPhrase(t) ||
        /^报价|去报价|产品报价|按方案\s*报价/.test(t)
      );
    }
    if (targetSkill === 'order') {
      if (isNaturalDemandText(t) && (/\d+\s*台|每台|单价/.test(t) || t.length > 18)) return false;
      return isOrderByQuoteEntryPhrase(t) || /^下单|确认下单|生成订单/.test(t);
    }
    if (targetSkill === 'plan') {
      if (isNaturalDemandText(t) && (/各\s*\d|\d+\s*台/.test(t) || t.length > 18)) return false;
      return /^配个方案|做方案|方案速配/.test(t) || (/方案/.test(t) && !/报价|下单/.test(t));
    }
    return false;
  }

  function assessContextForSkill(targetSkill) {
    const c = activeCustomer();
    if (!c) return { ready: false };
    const parts = ['客户「' + c.name + '」'];
    const carry = { customerId: c.id, targetSkill };

    if (targetSkill === 'quote') {
      const schemes = schemesForCustomer(c.id);
      if (schemes.length) {
        parts.push('已保存方案 ' + schemes.length + ' 份');
        carry.mode = 'scheme';
        return { ready: true, summary: parts.join('；'), carry };
      }
      const plan = ctx().plan;
      if (plan && plan.customerId === c.id && planSelectedIds().length) {
        parts.push('方案选品已选 ' + planSelectedIds().length + ' 项');
        carry.mode = 'plan-pick';
        return { ready: true, summary: parts.join('；'), carry };
      }
      const pending = ctx().quotePending;
      if (pending && pending.customerId === c.id && pending.lines && pending.lines.length) {
        parts.push('报价明细 ' + pending.lines.length + ' 项');
        carry.mode = 'quote-pending';
        return { ready: true, summary: parts.join('；'), carry };
      }
      carry.mode = 'customer-only';
      return { ready: true, summary: parts.join('；'), carry };
    }

    if (targetSkill === 'order') {
      const quotes = quotesForCustomer(c.id);
      if (quotes.length) {
        parts.push('报价单 ' + quotes.length + ' 份');
        carry.mode = 'quote-list';
        return { ready: true, summary: parts.join('；'), carry };
      }
      const pending = ctx().quotePending;
      if (pending && pending.customerId === c.id && pending.lines && pending.lines.length) {
        const priced = pending.lines.filter((l) => l.quotePrice > 0).length;
        if (priced === pending.lines.length) {
          parts.push('已填价明细 ' + pending.lines.length + ' 项');
          carry.mode = 'quote-pending-order';
          return { ready: true, summary: parts.join('；'), carry };
        }
      }
      carry.mode = 'customer-only';
      return { ready: true, summary: parts.join('；'), carry };
    }

    if (targetSkill === 'plan') {
      const schemes = schemesForCustomer(c.id);
      if (schemes.length) {
        parts.push('已有方案 ' + schemes.length + ' 份可参考');
        carry.mode = 'has-schemes';
        return { ready: true, summary: parts.join('；'), carry };
      }
      carry.mode = 'customer-only';
      return { ready: true, summary: parts.join('；'), carry };
    }
    carry.mode = 'customer-only';
    return { ready: true, summary: parts.join('；'), carry };
  }

  function closeCrossSkillModal() {
    /* 跨功能确认已改为消息卡片，无需关闭浮层 */
  }

  function renderCrossSkillCard(targetSkill) {
    const c = activeCustomer();
    const label = WORKFLOW_SKILL_LABELS[targetSkill] || targetSkill;
    const prompt =
      c && c.name
        ? '是否仍使用客户「' + c.name + '」进行' + label + '？'
        : '是否仍使用当前客户进行操作？';
    return (
      '<div class="sc-card sc-card--compact" data-spec-id="modal-cross-skill" data-target-skill="' +
      App.escapeHtml(targetSkill) +
      '">' +
      '<p class="sc-reply-lead">' +
      App.escapeHtml(prompt) +
      '</p>' +
      '<div class="sc-card__actions-inline">' +
      '<button type="button" class="sc-btn sc-btn--primary" data-action="cross-use-context" data-target="' +
      App.escapeHtml(targetSkill) +
      '">是</button>' +
      '<button type="button" class="sc-btn sc-btn--ghost" data-action="cross-enter-fresh" data-target="' +
      App.escapeHtml(targetSkill) +
      '">否</button></div></div>'
    );
  }

  function openCrossSkillModal(targetSkill) {
    App.pushAiHtml(renderCrossSkillCard(targetSkill));
    return true;
  }

  function dismissCrossSkillModal() {
    delete ctx().pendingCrossHandoff;
  }

  function confirmCrossSkillYes() {
    const pending = ctx().pendingCrossHandoff;
    const target = (pending && pending.targetSkill) || null;
    dismissCrossSkillModal();
    if (!target) return;
    simulateUserUtterance('是');
    executeCrossHandoffUse(target);
  }

  function confirmCrossSkillNo() {
    const pending = ctx().pendingCrossHandoff;
    const target = (pending && pending.targetSkill) || null;
    dismissCrossSkillModal();
    if (!target) return;
    executeCrossHandoffFresh(target, { simulateUserMsg: true });
  }

  function clearWorkflowDraftsKeepCustomer() {
    delete ctx().plan;
    delete ctx().quoteDraft;
    delete ctx().quotePending;
    delete ctx().orderDraft;
    delete ctx().orderPending;
    delete ctx().activePickList;
    delete ctx().pendingSchemeQuoteDemand;
    delete ctx().pendingSchemeQuoteUtterance;
    delete ctx().pendingOrderByQuoteUtterance;
    if (App.saveState) App.saveState();
  }

  /** 不沿用：清空流程草稿与当前客户，再出选客户引导 */
  function resetWorkflowForFreshStart() {
    delete ctx().plan;
    delete ctx().quoteDraft;
    delete ctx().quotePending;
    delete ctx().orderDraft;
    delete ctx().orderPending;
    delete ctx().activePickList;
    delete ctx().pendingCrossHandoff;
    delete ctx().pendingSchemeQuoteDemand;
    delete ctx().pendingSchemeQuoteUtterance;
    delete ctx().pendingOrderByQuoteUtterance;
    App.state.customerId = null;
    App.state.selectedFollowUpId = null;
    App.state.activeSkill = null;
    if (App.saveState) App.saveState();
    if (App.refreshHeader) App.refreshHeader();
    if (App.closeOverlays) App.closeOverlays();
  }

  function showCrossFunctionConfirm(targetSkill, utterance, opts) {
    opts = opts || {};
    if (App.openSkillSwitchConfirm) {
      return App.openSkillSwitchConfirm(targetSkill, {
        utterance: utterance || '',
        fromHandoff: true,
        simulateUserMsg: opts.simulateUserMsg !== false
      });
    }
    const assessment = assessContextForSkill(targetSkill);
    if (!assessment.ready) return false;
    const current = getActiveWorkflowSkill();
    ctx().pendingCrossHandoff = {
      utterance: utterance || '',
      targetSkill: targetSkill,
      fromSkill: current,
      carry: assessment.carry
    };
    if (opts.simulateUserMsg && utterance) simulateUserUtterance(utterance);
    if (!openCrossSkillModal(targetSkill)) return false;
    if (window.Annotation && Annotation.scanHosts) window.Annotation.scanHosts();
    return true;
  }

  function copyPlanSelectionsToQuoteDraft(c) {
    const plan = ctx().plan;
    if (!plan || plan.customerId !== c.id) return;
    ensureQuoteDraft(c);
    const draft = ctx().quoteDraft;
    planSelectedIds().forEach((pid) => {
      const pr = productById(pid);
      if (!pr) return;
      draft.selected[pid] = true;
      draft.qty[pid] = plan.qty[pid] || 1;
      draft.sku[pid] = plan.sku[pid] || DemoData.defaultSkuId(pr);
    });
  }

  function executeCrossHandoffUse(targetSkill) {
    const pending = ctx().pendingCrossHandoff;
    delete ctx().pendingCrossHandoff;
    const target = targetSkill || (pending && pending.targetSkill);
    if (!target) return;
    const c = activeCustomer();
    if (!c) return;
    /** 选「保留客户」：仅保留顶栏客户，清空方案/报价/下单流程草稿后进入目标功能 */
    clearWorkflowDraftsKeepCustomer();

    if (target === 'quote') {
      enterSkill('quote');
      ensureQuoteDraft(c);
      App.pushAiHtml(
        '<p class="sc-reply-lead">已切换至产品报价，当前客户为 <strong>' +
          App.escapeHtml(c.name) +
          '</strong>。</p>'
      );
      showQuoteSkillEntry({ onlyCard: true });
      return;
    }

    if (target === 'order') {
      enterSkill('order');
      showOrderSkillEntry({
        onlyCard: true,
        leadHtml:
          '<p class="sc-reply-lead">已切换至确认下单，当前客户为 <strong>' +
          App.escapeHtml(c.name) +
          '</strong>。</p>'
      });
      return;
    }

    if (target === 'plan') {
      enterSkill('plan');
      ensurePlan(c);
      App.pushAiHtml(
        '<p class="sc-reply-lead">已切换至方案速配，当前客户为 <strong>' +
          App.escapeHtml(c.name) +
          '</strong>。</p>'
      );
      showPlanSkillEntry({ onlyCard: true });
    }
  }

  function executeCrossHandoffFresh(targetSkill, opts) {
    opts = opts || {};
    const pending = ctx().pendingCrossHandoff;
    delete ctx().pendingCrossHandoff;
    const target = targetSkill || (pending && pending.targetSkill);
    if (!target) return;
    resetWorkflowForFreshStart();
    if (opts.simulateUserMsg) simulateUserUtterance('否');
    if (App.promptForCustomerSelection) {
      App.promptForCustomerSelection(target, { skipUserMsg: true, delayMs: 0 });
    } else {
      guideMissingSlot('customer', { skillId: target });
    }
  }

  /** 技能条/欢迎区：已选客户且切换到不同功能时，先弹窗确认是否保留客户 */
  function tryCrossSkillEntry(skillId, opts) {
    opts = opts || {};
    if (App.openSkillSwitchConfirm) {
      return App.openSkillSwitchConfirm(skillId, {
        utterance: opts.utterance,
        simulateUserMsg: opts.simulateUserMsg
      });
    }
    return false;
  }

  /**
   * 跨功能话术：已选客户且口令指向另一功能时，先询问是否保留客户
   */
  function tryCrossFunctionHandoff(text) {
    const t = (text || '').trim();
    if (!t) return false;
    const target = detectCrossTargetSkill(t);
    if (!target || !activeCustomer()) return false;
    if (!isCrossFunctionSwitchPhrase(t, target)) return false;
    const current = App.state.activeSkill;
    if (current === target) return false;
    return showCrossFunctionConfirm(target, t, { simulateUserMsg: false });
  }

  function tryIntent(t) {
    syncCustomerFromDemandUtterance(t);
    if (tryPlanTemplateUtterance(t)) return true;
    if (tryQuoteTemplateUtterance(t)) return true;
    if (tryCrossFunctionHandoff(t)) return true;
    if (tryActivePickListUtterance(t)) return true;
    if (ctx().plan && ctx().plan.awaitingDemand) {
      enterSkill('plan');
      const text = (t || '').trim();
      if (!text) return true;
      if (isPlanDemandSkipPhrase(text)) return skipPlanDemandToPick();
      if (handlePlanDemandEditUtterance(text, { simulateUserMsg: false })) return true;
      /** 需求录入/修改需求后须进选品卡，不走一句话直达方案 */
      return submitPlanDemand(text, {
        revise: !!(ctx().plan.demandText && ctx().plan.demandText.trim()),
        forcePickCard: true
      });
    }
    if (ctx().quoteDraft && ctx().quoteDraft.awaitingDemand) {
      enterSkill('quote');
      const text = (t || '').trim();
      if (!text) return true;
      if (isPlanDemandSkipPhrase(text)) return skipQuoteDemandToPick();
      if (handleQuoteDemandEditUtterance(text, { simulateUserMsg: false })) return true;
      return submitQuoteDemand(text, {
        revise: !!(ctx().quoteDraft.demandText && ctx().quoteDraft.demandText.trim()),
        forcePickCard: true
      });
    }
    if (ctx().deliveryLinesMode && ctx().orderDraft && ctx().orderDraft.awaitingDemand) {
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
    if (/^调整交期评审方案\s*$/.test((t || '').trim())) {
      if (ctx().delivery && ctx().delivery.confirmed) {
        adjustDeliveryFromResult({ utterance: false });
        return true;
      }
    }
    if (isPlanSkillAtEntry() && tryPlanEntryIntent(t)) return true;
    if (isQuoteSkillAtEntry() && tryQuoteEntryIntent(t)) return true;
    if (isOrderSkillAtEntry() && tryOrderEntryIntent(t)) return true;
    if (tryViewSchemeHistory(t)) return true;
    if (tryViewQuoteHistory(t)) return true;
    if (tryViewOrderHistory(t)) return true;
    if (tryQuoteSourceUtterance(t)) return true;
    if (tryOrderSourceUtterance(t)) return true;
    if (isOrderByQuoteEntryPhrase(t)) {
      return runOrderByQuoteEntry(t);
    }
    if (tryGenerateOrderFromDemand(t)) return true;
    if (isSchemeQuoteEntryPhrase(t)) return runSchemeQuoteEntry(t);
    /** 已在方案流程内（选品/预览）：优先生效，避免「生成方案」被 /方案/ 误判为重新配方案 */
    if (ctx().plan && ctx().plan.customerId && tryPlanCommand(t)) return true;
    if (
      /方案|配个方案|做方案|方案速配/.test(t) &&
      !/^调整交期评审方案\s*$/.test((t || '').trim()) &&
      !/^(?:生成|保存)方案/.test((t || '').trim()) &&
      !isNaturalDemandText(t) &&
      !isSchemeQuoteEntryPhrase(t)
    ) {
      if (tryCrossFunctionHandoff(t)) return true;
      enterSkill('plan');
      showPlanSkillEntry();
      return true;
    }
    if (
      !isOrderDemandText(t) &&
      (ctx().quotePending ||
        (ctx().quoteDraft && ctx().quoteDraft.customerId) ||
        (ctx().orderDraft && ctx().orderDraft.customerId) ||
        App.state.activeSkill === 'quote' ||
        App.state.activeSkill === 'order') &&
      tryQuoteCommand(t)
    ) {
      return true;
    }
    if (isQuoteEntryPhrase(t)) {
      if (tryCrossFunctionHandoff(t)) return true;
      if (/按方案\s*报价/.test(t)) return runSchemeQuoteEntry(t);
      enterSkill('quote');
      const c = activeCustomer() || requireCustomer('quote');
      if (!c) return true;
      showQuoteSkillEntry();
      return true;
    }
    if (tryGenerateQuoteFromDemand(t)) return true;
    if (tryGenerateSchemeFromDemand(t)) return true;
    if (/^选品|^加购|^筛选|^过滤|^生成方案|^保存方案/.test(t)) {
      enterSkill('plan');
      if (isPlanSkillAtEntry()) {
        return tryPlanEntryIntent(t);
      }
      if (!ctx().plan || !ctx().plan.customerId) {
        const c = ensurePlan();
        if (!c) return true;
        App.pushAiHtml(renderProductPickCard());
        schedulePlanPickLazyBind();
      }
      if (tryPlanCommand(t)) return true;
    }
    if (/报价/.test(t) && !isQuoteEntryPhrase(t) && !isSchemeQuoteEntryPhrase(t)) {
      if (tryCrossFunctionHandoff(t)) return true;
      enterSkill('quote');
      showQuoteSkillEntry();
      return true;
    }
    if (/交期|什么时候交|评估交期/.test(t) && !/^调整交期评审方案\s*$/.test((t || '').trim())) {
      enterSkill('delivery');
      if (/按报价单/.test(t)) {
        beginDeliveryFromQuote();
      } else if (/按订单/.test(t)) {
        beginDeliveryFromOrder();
      } else if (/自选|选品/.test(t)) {
        beginDeliveryLines();
      } else {
        runDelivery();
      }
      return true;
    }
    if (/下单|生成订单/.test(t)) {
      if (tryCrossFunctionHandoff(t)) return true;
      if (ctx().orderDraft && ctx().orderDraft.customerId && orderSelectedIds().length) {
        orderToQuoteSetupFromDraft();
        return true;
      }
      if (ctx().quotePending && ctx().quotePending.forOrder) {
        quoteSetupNext({ simulateUserMsg: false });
        return true;
      }
      enterSkill('order');
      runOrder();
      return true;
    }
    if (/复制|老订单/.test(t) && !/^确认复制\s*$/.test((t || '').trim())) {
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

    if (action === 'pick-free-attr') {
      onPickFreeAttrChange(btn);
      return true;
    }
    if (action === 'plan-toggle' && pid) {
      planSelectProduct(pid, !ctx().plan.selected[pid]);
      refreshLastPlanPickCard();
      return true;
    }
    if (action === 'plan-sku' && pid) {
      ctx().plan.sku[pid] = btn.value;
      return true;
    }
    if (action === 'plan-view-history') {
      simulateUserUtterance('查看历史数据');
      openPlanHistoryFromEntry();
      return true;
    }
    if (action === 'plan-create-new') {
      simulateUserUtterance('创建新方案');
      beginPlanCreate();
      return true;
    }
    if (action === 'quote-view-history') {
      simulateUserUtterance('查看历史报价单');
      openQuoteHistoryFromEntry();
      return true;
    }
    if (action === 'quote-create-new') {
      simulateUserUtterance('新建报价');
      beginQuoteCreate();
      return true;
    }
    if (action === 'plan-edit-demand' || action === 'plan-add-demand') {
      const inp = document.getElementById('plan-pick-query-input');
      if (inp && getLastPlanPickCard()) {
        if (action === 'plan-add-demand') inp.value = '';
        inp.focus();
        return true;
      }
      openPlanDemandEdit({ edit: true, simulateUserMsg: true });
      return true;
    }
    if (action === 'plan-skip-demand') {
      skipPlanDemandToPick({ simulateUserMsg: true });
      return true;
    }
    if (action === 'quote-skip-demand') {
      skipQuoteDemandToPick({ simulateUserMsg: true });
      return true;
    }
    if (action === 'delivery-skip-demand') {
      skipDeliveryDemandToPick({ simulateUserMsg: true });
      return true;
    }
    if (action === 'quote-edit-demand' || action === 'quote-add-demand') {
      if (ctx().deliveryLinesMode) {
        openDeliveryDemandEdit({
          edit: action === 'quote-edit-demand',
          simulateUserMsg: true
        });
        return true;
      }
      const inp = document.getElementById('quote-pick-query-input');
      if (inp && document.querySelector('[data-spec-id="card-quote-pick"]')) {
        if (action === 'quote-add-demand') inp.value = '';
        inp.focus();
        return true;
      }
      openQuoteDemandEdit({ simulateUserMsg: true });
      return true;
    }
    if (action === 'plan-demand-submit') {
      const card = btn.closest('[data-spec-id="card-plan-demand"]');
      const fromInput = readDemandTextFromCardEl(card);
      const hadDemand = !!(ctx().plan && ctx().plan.demandText && ctx().plan.demandText.trim());
      const fromBubble = getLatestUserChatText();
      const text = fromInput || fromBubble;
      if (!text) {
        App.toast('请在输入框或对话中描述采购需求');
        return true;
      }
      submitPlanDemand(text, {
        simulateUserMsg: !!fromInput,
        revise: hadDemand,
        forcePickCard: true
      });
      return true;
    }
    if (action === 'quote-demand-submit') {
      const card = btn.closest('[data-spec-id="card-quote-demand"]');
      const fromInput = readDemandTextFromCardEl(card);
      const hadDemand = !!(
        ctx().quoteDraft && ctx().quoteDraft.demandText && ctx().quoteDraft.demandText.trim()
      );
      const fromBubble = getLatestUserChatText();
      const text = fromInput || fromBubble;
      if (!text) {
        App.toast('请在输入框或对话中描述采购需求');
        return true;
      }
      submitQuoteDemand(text, {
        simulateUserMsg: !!fromInput,
        revise: hadDemand,
        forcePickCard: true
      });
      return true;
    }
    if (action === 'delivery-demand-submit') {
      const card = btn.closest('[data-spec-id="card-delivery-demand"]');
      const fromInput = readDemandTextFromCardEl(card);
      const hadDemand = !!(
        ctx().orderDraft && ctx().orderDraft.demandText && ctx().orderDraft.demandText.trim()
      );
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
    if (action === 'plan-filter' || action === 'plan-pick-query-apply') {
      applyPickQuery('plan', { simulateUserMsg: true });
      return true;
    }
    if (action === 'plan-load-more') {
      const card = btn.closest('[data-spec-id="card-plan-pick"]');
      if (card && appendMorePickProducts(card, 'plan')) bindPickLazyLoad(card, 'plan');
      return true;
    }
    if (action === 'plan-preview' || action === 'plan-to-cart') {
      syncPlanFilterFromDom();
      syncPlanQtyFromDom();
      syncPlanSkuFromDom();
      if (!planSelectedIds().length) {
        App.toast('请至少选择一种产品');
        return true;
      }
      pushNextAiCard(renderPlanCartCardFixed(), utterancePlanPreview());
      return true;
    }
    if (action === 'plan-back-pick') {
      syncPlanQtyFromDom();
      pushNextAiCard(renderProductPickCard(), '返回选品');
      schedulePlanPickLazyBind();
      return true;
    }
    if (action === 'plan-confirm') {
      simulateUserUtterance('生成方案');
      openPlanTemplateSheet();
      return true;
    }
    if (action === 'plan-template-submit') {
      submitPlanTemplate({ simulateUserMsg: true });
      return true;
    }
    if (action === 'quote-setup-next') {
      quoteSetupNext({ simulateUserMsg: true });
      return true;
    }
    if (action === 'quote-template-submit') {
      submitQuoteTemplate({ simulateUserMsg: true });
      return true;
    }
    if (action === 'order-submit') {
      submitOrder();
      return true;
    }

    if (action === 'biz-tab') {
      switchBizTab(btn.closest('[data-spec-id="card-biz-analysis"]'), btn.getAttribute('data-tab'));
      return true;
    }
    if (action === 'biz-metric') {
      switchBizMetric(btn.closest('[data-spec-id="card-biz-analysis"]'), btn.getAttribute('data-metric'));
      return true;
    }
    if (action === 'delivery-submit') {
      submitDelivery();
      return true;
    }
    if (action === 'delivery-to-order') {
      handleDeliveryToOrder();
      return true;
    }
    if (action === 'delivery-to-progress') {
      handleDeliveryToProgress(btn.getAttribute('data-oid'));
      return true;
    }
    if (action === 'change-submit') {
      submitChange();
      return true;
    }
    if (action === 'open-pdf') {
      openPdf(btn.getAttribute('data-pdf'));
      return true;
    }
    if (action === 'history-view-scheme') {
      viewSchemeById(btn.getAttribute('data-scheme-id'));
      return true;
    }
    if (action === 'history-view-quote') {
      viewQuoteById(btn.getAttribute('data-quote-id'));
      return true;
    }
    if (action === 'quote-from-scheme') {
      const sid = btn.getAttribute('data-scheme-id');
      const sch = sid ? schemeForActiveCustomer(sid) : null;
      simulateUserUtterance(
        sch
          ? '按方案 ' + (sch.templateName || sch.id) + ' 报价'
          : '按方案报价'
      );
      quoteFromScheme(sid);
      return true;
    }
    if (action === 'quote-pick-scheme') {
      applySchemePickById(btn.getAttribute('data-scheme-id'), { simulateUserMsg: true });
      return true;
    }
    if (action === 'quote-direct-start') {
      quoteDirectStart({ simulateUserMsg: true });
      return true;
    }
    if (action === 'quote-toggle' && pid) {
      quoteSelectProduct(pid, !ctx().quoteDraft.selected[pid]);
      refreshLastQuotePickCard();
      return true;
    }
    if (action === 'quote-sku' && pid) {
      ctx().quoteDraft.sku[pid] = btn.value;
      return true;
    }
    if (action === 'quote-filter' || action === 'quote-pick-query-apply') {
      applyPickQuery('quote', { simulateUserMsg: true });
      return true;
    }
    if (action === 'quote-to-cart') {
      quoteToCartFromDraft({ simulateUserMsg: true });
      return true;
    }
    if (action === 'quote-pick-to-order-setup') {
      quotePickToOrderSetup({ simulateUserMsg: true });
      return true;
    }
    if (action === 'quote-back-pick') {
      syncQuoteQtyFromDom();
      pushNextAiCard(renderQuotePickCard(), '返回报价选品');
      scheduleQuotePickLazyBind();
      return true;
    }
    if (action === 'quote-to-setup') {
      quoteToSetupFromDraft({ simulateUserMsg: true });
      return true;
    }
    if (action === 'cross-use-context') {
      const target = btn.getAttribute('data-target');
      if (target) {
        simulateUserUtterance('是');
        executeCrossHandoffUse(target);
      }
      return true;
    }
    if (action === 'cross-enter-fresh') {
      const target = btn.getAttribute('data-target');
      if (target) executeCrossHandoffFresh(target, { simulateUserMsg: true });
      return true;
    }
    if (action === 'skill-quote') {
      simulateUserUtterance(utteranceFor('quote'));
      enterSkill('quote');
      showQuoteSkillEntry();
      return true;
    }
    if (action === 'skill-delivery') {
      enterSkill('delivery');
      runDelivery();
      return true;
    }
    if (action === 'order-view-history') {
      openOrderHistoryFromEntry();
      return true;
    }
    if (action === 'order-create-new') {
      beginOrderCreate();
      return true;
    }
    if (action === 'history-view-order') {
      const idx = btn.getAttribute('data-pick-index');
      if (idx) ctx()._lastPickRowIndex = parseInt(idx, 10);
      viewOrderById(btn.getAttribute('data-oid'), {
        announceRow: ctx()._lastPickRowIndex || null
      });
      delete ctx()._lastPickRowIndex;
      return true;
    }
    if (action === 'skill-order') {
      simulateUserUtterance(utteranceFor('order'));
      enterSkill('order');
      runOrder();
      return true;
    }
    if (action === 'order-from-quote') {
      const qid = btn.getAttribute('data-quote-id');
      simulateUserUtterance(qid ? '按报价单 ' + qid + ' 生成订单' : '生成订单');
      orderFromQuote(qid);
      return true;
    }
    if (action === 'delivery-create-new') {
      setDeliverySkillAtEntry(false);
      const c = activeCustomer() || requireCustomer('delivery');
      if (!c) return true;
      App.pushAiHtml(renderDeliverySourceCard(c));
      rescanAnnotationPins();
      return true;
    }
    if (action === 'delivery-source-quote') {
      simulateUserUtterance('按报价单');
      beginDeliveryFromQuote(btn.getAttribute('data-quote-id') || undefined);
      return true;
    }
    if (action === 'delivery-source-order') {
      simulateUserUtterance('按订单');
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
        var lines = q.lines || [];
        if (!lines.length) {
          App.toast('报价单无可用明细');
          return true;
        }
        var sourceLabel = '报价单 ' + App.escapeHtml(q.id);
        var quoteId = q.id;
        var total = q.total;
        pushDeliveryLinePickCard(sourceLabel, lines, function (filteredLines) {
          openDeliveryForm({
            sourceType: 'quote',
            quoteId: quoteId,
            total: total,
            lines: filteredLines
          });
        });
      }
      return true;
    }
    if (action === 'delivery-order-pick') {
      const oid = btn.getAttribute('data-oid');
      const o = DemoData.orders.find(function (x) {
        return x.id === oid;
      });
      if (o) simulateUserUtterance('按订单 ' + o.no);
      deliveryOpenFormForOrder(o);
      return true;
    }
    if (action === 'delivery-line-pick-item') {
      var idx = parseInt(btn.getAttribute('data-idx'), 10);
      if (ctx().deliveryLineSelection && idx >= 0) {
        ctx().deliveryLineSelection[idx] = !ctx().deliveryLineSelection[idx];
        var card = btn.closest('[data-spec-id="card-delivery-line-pick"]');
        if (card && ctx().deliveryLinePickLines) {
          card.outerHTML = renderDeliveryLinePickCard(ctx().deliveryLinePickSourceLabel || '', ctx().deliveryLinePickLines);
          rescanAnnotationPins();
        }
      }
      return true;
    }
    if (action === 'delivery-line-pick-all') {
      var lines = ctx().deliveryLinePickLines;
      if (lines) {
        var selectedCount = (ctx().deliveryLineSelection || []).filter(Boolean).length;
        var allSelected = selectedCount === lines.length;
        if (allSelected) {
          ctx().deliveryLineSelection = lines.map(function () { return false; });
        } else {
          ctx().deliveryLineSelection = lines.map(function () { return true; });
        }
        var card = btn.closest('[data-spec-id="card-delivery-line-pick"]');
        if (card) {
          card.outerHTML = renderDeliveryLinePickCard(ctx().deliveryLinePickSourceLabel || '', lines);
          rescanAnnotationPins();
        }
      }
      return true;
    }
    if (action === 'delivery-line-pick-repick') {
      simulateUserUtterance('重选来源');
      var c2 = activeCustomer();
      if (c2) App.pushAiHtml(renderDeliverySourceCard(c2));
      rescanAnnotationPins();
      return true;
    }
    if (action === 'delivery-line-pick-confirm') {
      var selLines = ctx().deliveryLinePickLines;
      var selSelected = ctx().deliveryLineSelection || selLines.map(function () { return true; });
      var selCount = selSelected.filter(Boolean).length;
      if (!selCount) {
        App.toast('请至少选择一条货品');
        return true;
      }
      proceedFromDeliveryLinePickToForm();
      return true;
    }
    if (action === 'delivery-lines-confirm') {
      confirmDeliveryLines({ simulateUserMsg: true });
      return true;
    }
    if (action === 'delivery-lines-to-cart') {
      confirmDeliveryLines({ simulateUserMsg: true });
      return true;
    }
    if (action === 'order-pick-quote') {
      const idx = btn.getAttribute('data-pick-index');
      if (idx) ctx()._lastPickRowIndex = parseInt(idx, 10);
      applyQuotePickById(btn.getAttribute('data-quote-id'), { simulateUserMsg: true });
      return true;
    }
    if (action === 'order-direct-start') {
      orderDirectStart({ simulateUserMsg: true });
      return true;
    }
    if (action === 'order-toggle' && pid) {
      orderSelectProduct(pid, !ctx().orderDraft.selected[pid]);
      refreshLastOrderPickCard();
      return true;
    }
    if (action === 'order-sku' && pid) {
      ctx().orderDraft.sku[pid] = btn.value;
      return true;
    }
    if (action === 'order-filter' || action === 'order-pick-query-apply') {
      applyPickQuery('order', { simulateUserMsg: true });
      return true;
    }
    if (action === 'order-to-cart' || action === 'order-to-quote-setup') {
      if (ctx().deliveryLinesMode) {
        confirmDeliveryLines({ simulateUserMsg: true });
      } else {
        orderToQuoteSetupFromDraft({ simulateUserMsg: true });
      }
      return true;
    }
    if (action === 'order-back-pick') {
      syncOrderQtyFromDom();
      pushNextAiCard(renderOrderProductPickCard(), '返回下单选品');
      scheduleOrderPickLazyBind();
      return true;
    }
    if (action === 'order-to-confirm') {
      orderToConfirmFromDraft({ simulateUserMsg: true });
      return true;
    }
    if (action === 'skill-plan') {
      simulateUserUtterance(utteranceFor('plan'));
      enterSkill('plan');
      showPlanSkillEntry();
      return true;
    }
    if (action === 'order-force') {
      if (ctx().orderPending) showOrderConfirm();
      else App.toast('请先选择订单来源与明细');
      return true;
    }
    if (action === 'copy-pick' && oid) {
      copyOrderToConfirm(oid, { simulateUserMsg: true });
      return true;
    }
    if (action === 'copy-line-pick-item') {
      const idx = parseInt(btn.getAttribute('data-idx'), 10);
      if (ctx().copyLineSelection && idx >= 0) {
        ctx().copyLineSelection[idx] = !ctx().copyLineSelection[idx];
        const card = btn.closest('[data-spec-id="card-order-copy-line-pick"]');
        if (card) {
          const oid = card.getAttribute('data-oid');
          const o = DemoData.orders.find(function (x) { return x.id === oid; });
          if (o && ctx().copyLinePickLines) {
            card.outerHTML = renderCopyOrderLinePickCard(o, ctx().copyLinePickLines);
            rescanAnnotationPins();
          }
        }
      }
      return true;
    }
    if (action === 'copy-line-pick-all') {
      const lines = ctx().copyLinePickLines;
      if (lines) {
        const selectedCount = (ctx().copyLineSelection || []).filter(Boolean).length;
        const allSelected = selectedCount === lines.length;
        if (allSelected) {
          ctx().copyLineSelection = lines.map(function () { return false; });
        } else {
          ctx().copyLineSelection = lines.map(function () { return true; });
        }
        const card = btn.closest('[data-spec-id="card-order-copy-line-pick"]');
        if (card) {
          const oid = card.getAttribute('data-oid');
          const o = DemoData.orders.find(function (x) { return x.id === oid; });
          if (o) {
            card.outerHTML = renderCopyOrderLinePickCard(o, lines);
            rescanAnnotationPins();
          }
        }
      }
      return true;
    }
    if (action === 'copy-line-pick-repick') {
      simulateUserUtterance('重选订单');
      pushCopyOrderPickCard(activeCustomer());
      return true;
    }
    if (action === 'copy-line-pick-confirm') {
      const lines = ctx().copyLinePickLines;
      const selected = ctx().copyLineSelection || lines.map(function () { return true; });
      const selectedCount = selected.filter(Boolean).length;
      if (!selectedCount) {
        App.toast('请至少选择一条货品');
        return true;
      }
      const card = btn.closest('[data-spec-id="card-order-copy-line-pick"]');
      if (card) {
        const oid = card.getAttribute('data-oid');
        const o = DemoData.orders.find(function (x) { return x.id === oid; });
        if (o) {
          proceedFromLinePickToConfirm(o);
        }
      }
      return true;
    }
    if (action === 'copy-line-toggle') {
      syncOrderCopyLinesFromDom(btn);
      const idx = parseInt(btn.getAttribute('data-idx'), 10);
      ctx().orderCopyExpandedIdx = ctx().orderCopyExpandedIdx === idx ? -1 : idx;
      refreshLastOrderCopyCard();
      return true;
    }
    if (action === 'copy-order-confirm') {
      syncOrderCopyLinesFromDom(btn);
      const pending = ctx().orderPending;
      if (!pending || !pending.lines.length) {
        App.toast('订单明细为空');
        return true;
      }
      enterSkill('order');
      simulateUserUtterance('确认复制');
      showOrderConfirm();
      focusSpecHost('sheet-order');
      return true;
    }
    if (action === 'change-pick' && oid) {
      const o = DemoData.orders.find((x) => x.id === oid);
      if (o) simulateUserUtterance('变更订单 ' + o.no);
      openChangeSheet(oid);
      return true;
    }
    if (action === 'progress-detail' && oid) {
      const o = DemoData.orders.find((x) => x.id === oid);
      if (o) pushOrderProgressDetail(o);
      return true;
    }
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
      adjustDeliveryFromResult();
      return true;
    }
    if (action === 'delivery-repick-lines') {
      simulateUserUtterance('调整方案');
      repickDeliveryLines({ simulateUserMsg: false });
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
    if (action === 'progress-order-load-more') {
      progressOrderLoadMore();
      return true;
    }
    if (action === 'copy-edit-demand') {
      openCopyDemandEdit({ simulateUserMsg: true });
      return true;
    }
    if (action === 'progress-edit-demand') {
      openProgressDemandEdit({ simulateUserMsg: true });
      return true;
    }
    if (action === 'copy-repick-order') {
      simulateUserUtterance('重选订单');
      pushCopyOrderPickCard(activeCustomer());
      return true;
    }
    if (action === 'progress-pick' && oid) {
      const o = DemoData.orders.find(function (x) {
        return x.id === oid;
      });
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
    if (action === 'progress-workflow-toggle') {
      const idx = btn.getAttribute('data-item-idx');
      toggleProgressWorkflow(idx);
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
    if (action === 'payment-change-year') {
      simulateUserUtterance('更换年份');
      App.pushAiHtml(renderPaymentYearPickerCard());
      return true;
    }
    if (action === 'payment-year-cancel') {
      const card = btn.closest('[data-spec-id="card-payment-year-picker"]');
      if (card) card.remove();
      return true;
    }
    if (action === 'payment-year-confirm') {
      const card = btn.closest('[data-spec-id="card-payment-year-picker"]');
      const selected = card && card.querySelector('input[name="payment-year"]:checked');
      if (selected) {
        const year = parseInt(selected.value, 10);
        simulateUserUtterance('查看' + year + '年的数据');
        App.pushAiHtml(renderPaymentResultCard(DemoData.getPaymentAnalysis(year), year));
      }
      return true;
    }
    if (action === 'biz-change-range') {
      simulateUserUtterance('选择时间范围');
      App.pushAiHtml(renderBizDateRangePickerCard());
      return true;
    }
    if (action === 'biz-range-cancel') {
      const card = btn.closest('[data-spec-id="card-biz-date-range-picker"]');
      if (card) card.remove();
      return true;
    }
    if (action === 'biz-range-confirm') {
      const card = btn.closest('[data-spec-id="card-biz-date-range-picker"]');
      const startInput = card && card.querySelector('[data-action="biz-range-start"]');
      const endInput = card && card.querySelector('[data-action="biz-range-end"]');
      if (startInput && endInput) {
        var startDate = startInput.value;
        var endDate = endInput.value;
        simulateUserUtterance('查看' + startDate + '至' + endDate + '的业务排行');
        var data = DemoData.bizAnalysis;
        data.rangeLabel = startDate + ' 至 ' + endDate;
        App.pushAiHtml(
          '<p class="sc-reply-lead">为您展示 <strong>' + startDate + '</strong> 至 <strong>' + endDate + '</strong> 的业务排行：</p>' +
            renderBizAnalysisCard(data)
        );
      }
      return true;
    }
    if (action === 'inventory-filter-submit') {
      const input = document.getElementById('inventory-filter-input');
      const filter = input ? input.value.trim() : '';
      if (!filter) {
        App.toast('请输入存货编码或名称');
        return true;
      }
      simulateUserUtterance('筛选库存：' + filter);
      runInventory({ filter: filter });
      return true;
    }
    if (action === 'inventory-filter-skip') {
      simulateUserUtterance('查看全部库存');
      runInventory({ filter: '', simulateUserMsg: false });
      return true;
    }
    if (action === 'inventory-reset-filter') {
      simulateUserUtterance('重新筛选');
      App.pushAiHtml(
        '<p class="sc-reply-lead">为您查询库存，请先输入筛选条件。</p>' +
          renderInventoryFilterCard()
      );
      return true;
    }
    return false;
  }

  /** tryIntent 未命中：仅识别到客户等弱意图时的补槽引导 */
  function tryGuideAfterIntentFail(text) {
    const t = (text || '').trim();
    if (!t || /帮助|能做什么/.test(t)) return false;
    if (
      /方案|报价|下单|跟进|待跟进|切换客户|交期|工单|查看.*(?:方案|报价)|历史(?:方案|报价)/.test(
        t
      )
    ) {
      return false;
    }
    let parsed = null;
    if (DemoData.tryParseCustomerDemandUtterance) {
      parsed = DemoData.tryParseCustomerDemandUtterance(t, customersInPickerScope());
    }
    if (parsed && parsed.customer && (!parsed.demandText || parsed.demandText.trim().length < 4)) {
      guideMissingSlot('intentNeedFeature');
      return true;
    }
    return false;
  }

  function btnLabel(btn, fallback) {
    if (!btn) return fallback || '';
    const titleEl = btn.querySelector('.sc-plan-entry__option-title');
    if (titleEl && titleEl.textContent) {
      return String(titleEl.textContent).trim();
    }
    const t = btn.textContent ? String(btn.textContent).trim() : '';
    return t || fallback || '';
  }

  function ensurePickCustomAttrs(draft, pid, product) {
    if (!draft.customAttrs) draft.customAttrs = {};
    if (!draft.sku) draft.sku = {};
    if (!draft.customAttrs[pid]) {
      const skuId = draft.sku[pid] || DemoData.defaultSkuId(product);
      draft.customAttrs[pid] = DemoData.resolveLineCustomAttrs(product, skuId);
      draft.sku[pid] = skuId;
    }
    return draft.customAttrs[pid];
  }

  function pickDraftForScope(scope) {
    if (scope === 'plan') return ctx().plan;
    if (scope === 'quote') return ctx().quoteDraft;
    if (scope === 'order') return ctx().orderDraft;
    return null;
  }

  function renderPickFreeAttrRows(product, pid, scope, lineOpts) {
    const defs = DemoData.productCustomAttrDefs(product);
    if (!defs.length) return '';
    let attrs;
    if (scope === 'quote-line' && lineOpts && lineOpts.line) {
      attrs = lineOpts.line.customAttrs || DemoData.resolveLineCustomAttrs(product, lineOpts.line.skuId);
    } else {
      const draft = pickDraftForScope(scope);
      attrs = ensurePickCustomAttrs(draft, pid, product);
    }
    const idx = lineOpts && lineOpts.idx != null ? lineOpts.idx : '';
    const stopProp = scope === 'quote' || scope === 'order' ? ' onclick="event.stopPropagation()"' : '';
    return (
      '<div class="sc-pick-free-attrs">' +
      attrs
        .map(function (a) {
          const hasOpts = a.options && a.options.length;
          const inputHtml = hasOpts
            ? '<select class="sc-pick-free-attr__control sc-pick-free-attr__select" data-action="pick-free-attr" data-scope="' +
              scope +
              '" data-pid="' +
              pid +
              '" data-attr-key="' +
              App.escapeHtml(a.key) +
              '"' +
              (idx !== '' ? ' data-idx="' + idx + '"' : '') +
              stopProp +
              '>' +
              a.options
                .map(function (o) {
                  return (
                    '<option value="' +
                    App.escapeHtml(o) +
                    '"' +
                    (o === a.value ? ' selected' : '') +
                    '>' +
                    App.escapeHtml(o) +
                    '</option>'
                  );
                })
                .join('') +
              '</select>'
            : '<input type="text" class="sc-pick-free-attr__control sc-pick-free-attr__input" data-action="pick-free-attr" data-scope="' +
              scope +
              '" data-pid="' +
              pid +
              '" data-attr-key="' +
              App.escapeHtml(a.key) +
              '"' +
              (idx !== '' ? ' data-idx="' + idx + '"' : '') +
              stopProp +
              ' value="' +
              App.escapeHtml(a.value || '') +
              '"/>';
          return (
            '<label class="sc-pick-free-attr">' +
            '<span class="sc-pick-free-attr__label">' +
            App.escapeHtml(a.label) +
            '</span>' +
            inputHtml +
            '</label>'
          );
        })
        .join('') +
      '</div>'
    );
  }

  function renderPickSpecBlock(product, pid, scope, lineOpts) {
    const freeAttrs = renderPickFreeAttrRows(product, pid, scope, lineOpts);
    if (!freeAttrs) return '';
    if (scope === 'quote-line') return freeAttrs;
    return '<div class="sc-pick-spec-block">' + freeAttrs + '</div>';
  }

  function renderQuoteLineQtyField(line, pid, idx) {
    const qty = line.qty || 1;
    return (
      '<label class="sc-quote-line__field sc-quote-line__qty-field">数量<input type="number" min="1" step="1" value="' +
      qty +
      '" data-action="quote-line-qty" data-pid="' +
      pid +
      '" data-idx="' +
      idx +
      '" class="sc-input sc-input--field sc-quote-line__qty-input"/></label>'
    );
  }

  function syncPickCustomAttrsFromDom(scope) {
    const draft = pickDraftForScope(scope);
    if (!draft) return;
    document.querySelectorAll('[data-action="pick-free-attr"][data-scope="' + scope + '"]').forEach(function (el) {
      const pid = el.getAttribute('data-pid');
      const key = el.getAttribute('data-attr-key');
      if (!pid || !key) return;
      const pr = productById(pid);
      if (!pr) return;
      ensurePickCustomAttrs(draft, pid, pr);
      const attrs = draft.customAttrs[pid];
      const a = attrs.find(function (x) {
        return x.key === key;
      });
      if (a) a.value = el.value;
      draft._customAttrsTouched = draft._customAttrsTouched || {};
      draft._customAttrsTouched[pid] = true;
      syncPickSkuFromCustomAttrs(draft, pid, pr);
    });
  }

  function syncPickSkuFromCustomAttrs(draft, pid, product) {
    const attrs = draft.customAttrs && draft.customAttrs[pid];
    if (!attrs || !product) return;
    const map = {};
    attrs.forEach(function (a) {
      if (a && a.key) map[a.key] = a.value;
    });
    if (!draft.sku) draft.sku = {};
    draft.sku[pid] = DemoData.resolveSkuFromAttrValues(product, map);
  }

  function syncQuotePickCustomAttrsFromDom() {
    syncPickCustomAttrsFromDom('quote');
  }

  function syncOrderPickCustomAttrsFromDom() {
    syncPickCustomAttrsFromDom('order');
  }

  function syncLineCustomAttrsFromDom(line, idx) {
    const pr = productById(line.productId);
    if (!pr) return;
    const defs = DemoData.productCustomAttrDefs(pr);
    if (!defs.length) return;
    const pid = line.productId;
    const attrs = defs.map(function (d) {
      const el =
        document.querySelector(
          '[data-action="pick-free-attr"][data-scope="quote-line"][data-pid="' + pid + '"][data-attr-key="' + d.key + '"]'
        ) ||
        document.querySelector(
          '[data-action="pick-free-attr"][data-scope="quote-line"][data-idx="' + idx + '"][data-attr-key="' + d.key + '"]'
        );
      const prev = (line.customAttrs || []).find(function (x) { return x.key === d.key; });
      return {
        key: d.key,
        label: d.label,
        value: el ? el.value : prev && prev.value != null ? prev.value : '',
        options: d.options
      };
    });
    line.customAttrs = attrs;
    line._customAttrsTouched = true;
  }

  function onPickFreeAttrChange(el) {
    const scope = el.getAttribute('data-scope');
    const pid = el.getAttribute('data-pid');
    const key = el.getAttribute('data-attr-key');
    const val = el.value;
    const pr = productById(pid);
    if (!pr || !key) return;

    if (scope === 'quote-line') {
      const pending = ctx().quotePending;
      if (!pending) return;
      const idx = parseInt(el.getAttribute('data-idx'), 10);
      const line = pid
        ? pending.lines.find(function (l) {
            return l.productId === pid;
          })
        : pending.lines[idx];
      if (!line) return;
      if (!line.customAttrs) line.customAttrs = DemoData.resolveLineCustomAttrs(pr, line.skuId);
      const a = line.customAttrs.find(function (x) {
        return x.key === key;
      });
      if (a) a.value = val;
      line._customAttrsTouched = true;
      const map = {};
      line.customAttrs.forEach(function (x) {
        if (x && x.key) map[x.key] = x.value;
      });
      line.skuId = DemoData.resolveSkuFromAttrValues(pr, map);
      line.skuLabel = DemoData.skuLabelFromAttrs(pr, line.customAttrs);
      const hints = DemoData.priceHints(pr, line.skuId);
      line.latestPrice = hints.latestPrice;
      line.minPrice = hints.minPrice;
      if (!line._quotePriceTouched) line.quotePrice = hints.latestPrice;
      applyQuoteLineCommercialDefaults(line, pr, { keepCustom: true });
      line.sub = line.quotePrice * line.qty;
      line.unitPrice = line.quotePrice;
      if (isQuoteSetupOpen()) refreshQuoteSetupLines();
      else if (document.querySelector('[data-spec-id="card-quote-cart"]')) refreshLastQuoteConfirmCard();
      return;
    }

    const draft = pickDraftForScope(scope);
    if (!draft) return;
    ensurePickCustomAttrs(draft, pid, pr);
    const attrs = draft.customAttrs[pid];
    const attr = attrs.find(function (x) {
      return x.key === key;
    });
    if (attr) attr.value = val;
    draft._customAttrsTouched = draft._customAttrsTouched || {};
    draft._customAttrsTouched[pid] = true;
    syncPickSkuFromCustomAttrs(draft, pid, pr);
  }

  function orderConfirmRoot() {
    const cards = document.querySelectorAll('[data-spec-id="sheet-order"]');
    return cards.length ? cards[cards.length - 1] : null;
  }

  function renderOrderConfirmLineProcessField(pr, line, idx) {
    const options = DemoData.processVersionOptions(pr, line.skuId);
    const cur = line.processVersion || options[0] || '标准版';
    const opts = options
      .map(function (v) {
        return (
          '<option value="' +
          App.escapeHtml(v) +
          '"' +
          (v === cur ? ' selected' : '') +
          '>' +
          App.escapeHtml(v) +
          '</option>'
        );
      })
      .join('');
    return (
      '<label class="sc-quote-line__field">工艺版本 <select class="sc-input sc-input--field sc-quote-line__select" data-action="order-confirm-line-process" data-idx="' +
      idx +
      '">' +
      opts +
      '</select></label>'
    );
  }

  function renderOrderConfirmLineInfoGrid(line) {
    const stockWarn = line.availableQty === 0;
    const availVal = stockWarn
      ? '无库存'
      : line.availableQty != null
        ? String(line.availableQty)
        : '—';
    const onHandVal = line.onHandQty != null ? String(line.onHandQty) : '—';
    const warnCls = stockWarn ? ' sc-order-confirm-line__info-pair--warn' : '';
    return (
      '<dl class="sc-order-confirm-line__info">' +
      '<div class="sc-order-confirm-line__info-pair' +
      warnCls +
      '"><dt>可用量</dt><dd>' +
      App.escapeHtml(availVal) +
      '</dd></div>' +
      '<div class="sc-order-confirm-line__info-pair' +
      warnCls +
      '"><dt>现存量</dt><dd>' +
      App.escapeHtml(onHandVal) +
      '</dd></div>' +
      '<div class="sc-order-confirm-line__info-pair sc-order-confirm-line__info-pair--full"><dt>规格</dt><dd>' +
      App.escapeHtml(formatOrderLineSpec(line)) +
      '</dd></div>' +
      '<div class="sc-order-confirm-line__info-pair"><dt>单位</dt><dd>' +
      App.escapeHtml(line.salesUnit || '件') +
      '</dd></div>' +
      '</dl>'
    );
  }

  function renderOrderConfirmLineFields(line, idx, pr) {
    const price = line.quotePrice != null ? line.quotePrice : line.unitPrice || 0;
    const tax = line.taxRate != null ? line.taxRate : 13;
    const deliver = line.deliverDatetime || '';
    return (
      renderOrderConfirmLineInfoGrid(line) +
      '<div class="sc-order-confirm-line__fields-grid">' +
      renderOrderConfirmLineProcessField(pr, line, idx) +
      '<label class="sc-quote-line__field">数量 <input type="number" min="1" class="sc-input sc-input--field" data-action="order-confirm-line-qty" data-idx="' +
      idx +
      '" value="' +
      (line.qty || 1) +
      '" /></label>' +
      '<label class="sc-quote-line__field">单价 <input type="number" min="0" step="0.01" class="sc-input sc-input--field" data-action="order-confirm-line-price" data-idx="' +
      idx +
      '" value="' +
      price +
      '" /></label>' +
      '<label class="sc-quote-line__field">税率（%） <input type="number" min="0" step="0.01" class="sc-input sc-input--field" data-action="order-confirm-line-tax" data-idx="' +
      idx +
      '" value="' +
      tax +
      '" /></label>' +
      '</div>' +
      '<label class="sc-quote-line__field">要货时间 <input type="date" class="sc-input sc-input--field" data-action="order-confirm-line-deliver" data-idx="' +
      idx +
      '" value="' +
      App.escapeHtml(deliver) +
      '" /></label>' +
      '<p class="sc-card__meta">小计 <strong data-order-confirm-sub="' +
      idx +
      '">' +
      fmtMoney(line.sub != null ? line.sub : price * (line.qty || 1)) +
      '</strong></p>'
    );
  }

  function renderOrderConfirmLineCard(line, idx) {
    const pr = productById(line.productId);
    const unit = line.salesUnit || '件';
    const price = line.quotePrice != null ? line.quotePrice : line.unitPrice || 0;
    const sub = line.sub != null ? line.sub : price * (line.qty || 1);
    const lowStock = line.availableQty === 0;
    return (
      '<div class="sc-order-confirm-line sc-order-confirm-line--open' +
      (lowStock ? ' sc-order-confirm-line--warn' : '') +
      '" data-order-confirm-line-idx="' +
      idx +
      '">' +
      '<div class="sc-order-confirm-line__head sc-order-confirm-line__head--static">' +
      '<span class="sc-order-confirm-line__idx">' +
      (idx + 1) +
      '</span>' +
      '<span class="sc-order-confirm-line__main">' +
      '<span class="sc-order-confirm-line__name">' +
      App.escapeHtml(line.inventoryName || '—') +
      '</span>' +
      '<span class="sc-order-confirm-line__sub">' +
      App.escapeHtml(line.inventoryCode || '—') +
      ' · ' +
      (line.qty || 0) +
      ' ' +
      App.escapeHtml(unit) +
      '</span></span>' +
      '<span class="sc-order-confirm-line__amount" data-order-confirm-amount="' +
      idx +
      '">' +
      fmtMoney(sub) +
      '</span></div>' +
      '<div class="sc-order-confirm-line__body">' +
      renderOrderConfirmLineFields(line, idx, pr) +
      '</div></div>'
    );
  }

  function renderOrderConfirmHeaderMore(pending) {
    const open = !!ctx().orderHeaderMoreOpen;
    return (
      '<button type="button" class="sc-order-confirm__more-toggle" data-action="order-header-more-toggle" aria-expanded="' +
      (open ? 'true' : 'false') +
      '">' +
      '<span>更多表头信息</span><span class="sc-order-confirm__more-chevron" aria-hidden="true">›</span></button>' +
      '<div class="sc-order-confirm__header-more' +
      (open ? '' : ' sc-hidden') +
      '" data-order-header-more><dl class="sc-order-confirm__summary">' +
      '<div class="sc-order-confirm__row sc-order-confirm__row--field"><dt>收/付款方式</dt><dd>' +
      renderOrderSettlementFieldSelect('payment-method', pending.paymentMethod, DemoData.paymentMethodOptions) +
      '</dd></div>' +
      '<div class="sc-order-confirm__row sc-order-confirm__row--field"><dt>运输方式</dt><dd>' +
      renderOrderSettlementFieldSelect('transport-method', pending.transportMethod, DemoData.transportMethodOptions) +
      '</dd></div>' +
      '<div class="sc-order-confirm__row sc-order-confirm__row--field"><dt>发货地址</dt><dd><input type="text" class="sc-input sc-input--field" data-field="ship-address" value="' +
      App.escapeHtml(pending.shipAddress || '') +
      '" placeholder="发货地址" /></dd></div>' +
      '<div class="sc-order-confirm__row sc-order-confirm__row--field"><dt>联系人</dt><dd><input type="text" class="sc-input sc-input--field" data-field="contact-name" value="' +
      App.escapeHtml(pending.contactName || '') +
      '" /></dd></div>' +
      '<div class="sc-order-confirm__row sc-order-confirm__row--field"><dt>联系方式</dt><dd><input type="tel" class="sc-input sc-input--field" data-field="contact-phone" value="' +
      App.escapeHtml(pending.contactPhone || '') +
      '" /></dd></div>' +
      '<div class="sc-order-confirm__row sc-order-confirm__row--field"><dt>备注</dt><dd><input type="text" class="sc-input sc-input--field" data-field="header-remark" value="' +
      App.escapeHtml(pending.headerRemark || '') +
      '" placeholder="表头备注" /></dd></div>' +
      '</dl></div>'
    );
  }

  function toggleOrderHeaderMore(btn) {
    syncOrderConfirmFromDom();
    const card = (btn && btn.closest('[data-spec-id="sheet-order"]')) || orderConfirmRoot();
    if (!card) return;
    ctx().orderHeaderMoreOpen = !ctx().orderHeaderMoreOpen;
    applyOrderHeaderMoreOpenState(card);
  }

  function applyOrderHeaderMoreOpenState(card) {
    if (!card) return;
    const open = !!ctx().orderHeaderMoreOpen;
    const panel = card.querySelector('[data-order-header-more]');
    const toggleBtn = card.querySelector('[data-action="order-header-more-toggle"]');
    if (panel) panel.classList.toggle('sc-hidden', !open);
    if (toggleBtn) toggleBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  function syncOrderConfirmLinesFromDom() {
    const pending = ctx().orderPending;
    const root = orderConfirmRoot();
    if (!pending || !root) return;
    pending.lines.forEach(function (line, idx) {
      const qtyInp = root.querySelector('[data-action="order-confirm-line-qty"][data-idx="' + idx + '"]');
      const priceInp = root.querySelector('[data-action="order-confirm-line-price"][data-idx="' + idx + '"]');
      const taxInp = root.querySelector('[data-action="order-confirm-line-tax"][data-idx="' + idx + '"]');
      const processSel = root.querySelector('[data-action="order-confirm-line-process"][data-idx="' + idx + '"]');
      const deliverInp = root.querySelector('[data-action="order-confirm-line-deliver"][data-idx="' + idx + '"]');
      if (qtyInp) line.qty = parseInt(qtyInp.value, 10) || 1;
      if (priceInp) {
        const v = parseFloat(priceInp.value);
        if (!isNaN(v)) {
          line.quotePrice = v;
          if (priceInp.value !== '') line._quotePriceTouched = true;
        }
      }
      if (taxInp && taxInp.value !== '') {
        const t = parseFloat(taxInp.value);
        if (!isNaN(t)) {
          line.taxRate = t;
          line._taxRateTouched = true;
        }
      }
      if (processSel) line.processVersion = processSel.value;
      if (deliverInp && deliverInp.value) {
        line.deliverDatetime = deliverInp.value;
        line._deliverDatetimeTouched = true;
      }
      line.sub = (line.quotePrice != null ? line.quotePrice : line.unitPrice || 0) * (line.qty || 1);
      line.unitPrice = line.quotePrice != null ? line.quotePrice : line.unitPrice;
      const subEl = root.querySelector('[data-order-confirm-sub="' + idx + '"]');
      if (subEl) subEl.textContent = fmtMoney(line.sub);
      const amountEl = root.querySelector('[data-order-confirm-amount="' + idx + '"]');
      if (amountEl) amountEl.textContent = fmtMoney(line.sub);
      const row = root.querySelector('[data-order-confirm-line-idx="' + idx + '"]');
      if (row) {
        const lowStock = line.availableQty === 0;
        row.classList.toggle('sc-order-confirm-line--warn', lowStock);
        const subMeta = row.querySelector('.sc-order-confirm-line__sub');
        if (subMeta) {
          subMeta.textContent =
            (line.inventoryCode || '—') +
            ' · ' +
            (line.qty || 0) +
            ' ' +
            (line.salesUnit || '件');
        }
      }
    });
    recalcOrderPendingTotal();
    const totalEl = root.querySelector('[data-order-confirm-total]');
    if (totalEl) totalEl.textContent = fmtMoney(pending.total);
  }

  function refreshLastOrderConfirmCard() {
    const card = orderConfirmRoot();
    if (!card) return;
    const pending = ctx().orderPending;
    if (!pending) return;
    const c = App.getCustomer(pending.customerId);
    const body = card.querySelector('.sc-order-confirm-body');
    if (body) body.innerHTML = renderOrderConfirmBody(pending, c);
    applyOrderHeaderMoreOpenState(card);
    rescanAnnotationPins();
  }

  function finalizeOrderPendingLines(pending) {
    if (!pending || !pending.lines) return;
    pending.lines.forEach(function (line) {
      enrichOrderLineStock(line);
      if (!line.deliverDatetime && pending.shipDate) {
        line.deliverDatetime = pending.shipDate;
      }
    });
  }

  function enrichOrderLineStock(line) {
    const pr = productById(line.productId);
    if (!pr) return;
    const skuId = line.skuId || DemoData.defaultSkuId(pr);
    const skus = pr.skus || [];
    const sku = skus.find(function (s) {
      return s.id === skuId;
    }) || { id: skuId };
    if (line.availableQty == null || line.onHandQty == null) {
      const st = DemoData.skuInventoryStock(pr, sku);
      if (line.availableQty == null) line.availableQty = st.available;
      if (line.onHandQty == null) line.onHandQty = st.onHand;
    }
  }

  return {
    init,
    run,
    tryIntent,
    tryCrossSkillEntry,
    tryGuideAfterIntentFail,
    guideMissingSlot,
    clearWorkflowDraftsKeepCustomer,
    executeCrossHandoffUse,
    executeCrossHandoffFresh,
    runSchemeQuoteEntry,
    runOrderByQuoteEntry,
    customerHasSchemes,
    tryPlanCommand,
    handleAction,
    utteranceFor,
    startPlan,
    showPlanSkillEntry,
    beginPlanCreate,
    openPlanHistoryFromEntry,
    showQuoteSkillEntry,
    beginQuoteCreate,
    openQuoteHistoryFromEntry,
    showOrderSkillEntry,
    beginOrderCreate,
    openOrderHistoryFromEntry,
    submitQuote,
    submitDelivery,
    submitOrder,
    submitChange,

    submitPlanTemplate,
    submitQuoteTemplate,
    confirmCrossSkillYes,
    confirmCrossSkillNo,
    dismissCrossSkillModal,
    downloadPdfDocument,
    forwardPdfDocument,
    openPdf,
    quoteSetupNext,
    syncQuotePendingFromDom,
    syncPlanQtyFromDom,
    syncQuoteQtyFromDom,
    syncOrderQtyFromDom,
    syncOrderCopyLinesFromDom,
    syncOrderConfirmLinesFromDom,
    onQuoteLineSkuChange,
    onCopyLineSkuChange,
    onDeliveryFormExpectedDateChange,
    refreshLastQuoteConfirmCard
  };
})();
