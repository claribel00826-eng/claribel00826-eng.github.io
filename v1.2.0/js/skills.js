window.Skills = (function () {
  let App;
  const PLAN_MORE_PAGE_SIZE = 5;
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
    const inp = document.getElementById('quote-filter-input');
    if (inp && ctx().quoteDraft) ctx().quoteDraft.filter = inp.value.trim();
    const label = formatProductNamesLabel(quoteSelectedIds());
    return label ? label + '，逐项报价' : '下一步：逐项报价';
  }

  function utteranceOrderPickToSetup() {
    const inp = document.getElementById('order-filter-input');
    if (inp && ctx().orderDraft) ctx().orderDraft.filter = inp.value.trim();
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

  function latestPickListCardSpecId(type) {
    if (type === 'scheme') return 'card-scheme-pick';
    if (type === 'order') return 'card-order-select';
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
    const specId = latestPickListCardSpecId(pick.type);
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

  /** 老客户直选报价/下单：跳过需求录入，按最近订单进选品 */
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
      return submitQuoteDemand(body, {
        revise: true,
        simulateUserMsg: false,
        forcePickCard: true
      });
    }
    openQuoteDemandEdit({ simulateUserMsg: opts.simulateUserMsg });
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
    return DemoData.planMoreProducts(c, recIds, draft.filter || '', undefined, demandText);
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
    const inp = document.getElementById('plan-filter-input');
    if (inp && ctx().plan) ctx().plan.filter = inp.value.trim();
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
    if (!plan.sku[pid]) plan.sku[pid] = DemoData.defaultSkuId(product);
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

  /** 方案选品行：仅品名/规格，不含单价；规格下拉始终可改 */
  function planPickRow(product, tagHtml) {
    const plan = ctx().plan;
    const pid = product.id;
    ensurePlanSku(pid, product);
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
      '</span><span class="sc-follow-row__meta">' +
      App.escapeHtml(product.spec) +
      (tagHtml ? ' ' + tagHtml : '') +
      '</span></button><div class="sc-plan-sku-row">' +
      renderSkuSelect(product, pid) +
      '</div></div>'
    );
  }

  function ensureQuoteSku(pid, product) {
    const d = ctx().quoteDraft;
    if (!d) return;
    if (!d.sku) d.sku = {};
    if (!d.sku[pid]) d.sku[pid] = DemoData.defaultSkuId(product);
  }

  /** 报价/下单选品行：与方案选品一致，规格下拉始终可改 */
  function quotePickRow(product, tagHtml) {
    const d = ctx().quoteDraft;
    const pid = product.id;
    ensureQuoteSku(pid, product);
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
      '</span><span class="sc-follow-row__meta">' +
      App.escapeHtml(product.spec) +
      (tagHtml ? ' ' + tagHtml : '') +
      '</span></button><div class="sc-plan-sku-row">' +
      renderQuoteSkuSelect(product, pid) +
      '</div></div>'
    );
  }

  function ensureOrderSku(pid, product) {
    const d = ctx().orderDraft;
    if (!d) return;
    if (!d.sku) d.sku = {};
    if (!d.sku[pid]) d.sku[pid] = DemoData.defaultSkuId(product);
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

  /** 订单选品行：与方案选品一致 */
  function orderPickRow(product, tagHtml) {
    const d = ctx().orderDraft;
    const pid = product.id;
    ensureOrderSku(pid, product);
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
      '</span><span class="sc-follow-row__meta">' +
      App.escapeHtml(product.spec) +
      (tagHtml ? ' ' + tagHtml : '') +
      '</span></button><div class="sc-plan-sku-row">' +
      renderOrderSkuSelect(product, pid) +
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
      ? '<p class="sc-card__meta">暂无匹配推荐，请检查需求描述或调整筛选。</p>'
      : '<p class="sc-card__meta">暂无推荐，请调整筛选或查看下方全部产品。</p>';
  }

  function recommendLeadHtml(c, demandText) {
    const demand = (demandText || '').trim();
    const isOld = DemoData.isOldCustomer(c, DemoData.demoSalesUser);
    if (isOld) {
      if (demand) {
        const short = demand.length > 28 ? demand.slice(0, 28) + '…' : demand;
        return (
          '<p class="sc-card__meta sc-plan-rec-hint">推荐区：优先按需求「' +
          App.escapeHtml(short) +
          '」模糊匹配（名称·描述·规格·自定义项），其次最近订单产品（最多十条）</p>'
        );
      }
      return '<p class="sc-card__meta sc-plan-rec-hint"></p>';
    }
    if (DemoData.isNewCustomer(c)) {
      if (demand) {
        const short = demand.length > 28 ? demand.slice(0, 28) + '…' : demand;
        return (
          '<p class="sc-card__meta sc-plan-rec-hint">推荐区：已按需求「' +
          App.escapeHtml(short) +
          '」模糊匹配名称、描述、规格与自定义项（最多十条）</p>'
        );
      }
      return '<p class="sc-card__meta sc-plan-rec-hint sc-plan-rec-hint--warn">请先在上一步发送采购需求，再展示推荐商品</p>';
    }
    return '<p class="sc-card__meta sc-plan-rec-hint">推荐区：按客户档案类型展示</p>';
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
    const plan = ctx().plan;
    return plan && plan.demandText ? String(plan.demandText).trim() : '';
  }

  function readDemandTextFromCardEl(cardEl) {
    if (!cardEl) return '';
    const ta = cardEl.querySelector('[data-field="demand-text"]');
    return ta ? String(ta.value || '').trim() : '';
  }

  function renderDemandInputBlock(specId, opts) {
    opts = opts || {};
    const submitAction =
      specId === 'card-quote-demand' ? 'quote-demand-submit' : 'plan-demand-submit';
    const confirmLabel = opts.isEdit
      ? opts.optional
        ? '确认调整'
        : '确认修改'
      : '确认需求';
    const initial = App.escapeHtml(demandDraftTextForSpec(specId));
    return (
      '<textarea class="sc-textarea sc-plan-demand-input" data-field="demand-text" rows="3" placeholder="例：伺服电机和传动齿轮箱各 2 台">' +
      initial +
      '</textarea>' +
      '<div class="sc-card__actions-inline">' +
      '<button type="button" class="sc-btn sc-btn--primary" data-action="' +
      submitAction +
      '">' +
      confirmLabel +
      '</button></div>' +
      '<p class="sc-plan-voice-hint">也可在底部输入区发送需求（与点确认二选一）</p>'
    );
  }

  function renderDemandPromptCard(c, opts) {
    opts = opts || {};
    const specId = opts.specId || 'card-plan-demand';
    const isEdit = !!opts.edit;
    const optional = !!opts.optional;
    const allowSkip = !!opts.allowSkip && !isEdit;
    if (isEdit) {
      return (
        '<div class="sc-card sc-card--compact" data-spec-id="' +
        specId +
        '">' +
        '<div class="sc-card__head sc-card__head--compact">' +
        (optional ? '调整采购需求' : '修改采购需求') +
        '</div>' +
        '<p class="sc-card__meta">发送后重新匹配推荐区，已勾选产品将清空。</p>' +
        renderDemandInputBlock(specId, { isEdit: true, optional: optional }) +
        '</div>'
      );
    }
    const skipAction = specId === 'card-quote-demand' ? 'quote-skip-demand' : 'plan-skip-demand';
    const skipActions = allowSkip
      ? '<div class="sc-card__actions-inline">' +
        '<button type="button" class="sc-btn sc-btn--ghost" data-action="' +
        skipAction +
        '">跳过，按最近订单推荐</button></div>'
      : '';
    return (
      '<div class="sc-card sc-card--compact" data-spec-id="' +
      specId +
      '">' +
      '<div class="sc-card__head sc-card__head--compact">' +
      (allowSkip ? '请描述采购需求（可跳过）' : '请描述您的采购需求') +
      '</div>' +
      '<p class="sc-card__meta">' +
      (allowSkip
        ? '填写后点「确认需求」；也可跳过，直接按最近订单产品推荐（最多十条）。'
        : '须先描述需求，再展示推荐商品。') +
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
    else plan.filter = '';
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
    const recs = DemoData.recommendProducts(c, plan.filter, undefined, planDemandForMatch());
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
    const emptyHint = DemoData.isNewCustomer(c)
      ? '<p class="sc-card__meta">暂无匹配推荐，请检查需求描述或调整筛选。</p>'
      : '<p class="sc-card__meta">暂无推荐，请调整筛选或查看下方全部产品。</p>';

    return (
      '<div class="sc-card sc-card--compact" data-spec-id="card-plan-pick"><div class="sc-card__head sc-card__head--compact">选品 · 改规格</div>' +
      recommendLeadHtml(c, planDemandForMatch()) +
      renderPlanDemandSummaryHtml(c) +
      '<div class="sc-plan-filter-row">' +
      '<input type="search" class="sc-input sc-input--field" id="plan-filter-input" placeholder="筛选品名/规格" value="' +
      App.escapeHtml(plan.filter || '') +
      '"/>' +
      '<button type="button" class="sc-btn sc-btn--ghost" data-action="plan-filter">筛选</button></div>' +
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
      return submitPlanDemand(text, {
        revise: !!(plan.demandText && plan.demandText.trim()),
        forcePickCard: true
      });
    }

    if (/^筛选|^过滤/.test(text)) {
      const m = text.match(/(?:筛选|过滤)\s*(.+)/);
      plan.filter = m && m[1] ? m[1].trim() : '';
      resetPlanMoreVisible(plan);
      const inp = document.getElementById('plan-filter-input');
      if (inp) inp.value = plan.filter;
      refreshLastPlanPickCard();
      pushAiMeta('<p class="sc-card__meta">已按「' + App.escapeHtml(plan.filter || '全部') + '」筛选产品列表。</p>');
      return true;
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
      if (/^(?:修改需求|改需求|重新描述需求|变更需求)/.test(text)) {
        return handleQuoteDemandEditUtterance(text, { simulateUserMsg: false });
      }
      if (/^筛选|^过滤/.test(text)) {
        const m = text.match(/(?:筛选|过滤)\s*(.+)/);
        draft.filter = m && m[1] ? m[1].trim() : '';
        const inp = document.getElementById('quote-filter-input');
        if (inp) inp.value = draft.filter;
        refreshLastQuotePickCard();
        pushAiMeta('<p class="sc-card__meta">已按「' + App.escapeHtml(draft.filter || '全部') + '」筛选。</p>');
        return true;
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
      if (/^筛选|^过滤/.test(text)) {
        const m = text.match(/(?:筛选|过滤)\s*(.+)/);
        orderDraft.filter = m && m[1] ? m[1].trim() : '';
        const inp = document.getElementById('order-filter-input');
        if (inp) inp.value = orderDraft.filter;
        refreshLastOrderPickCard();
        pushAiMeta('<p class="sc-card__meta">已按「' + App.escapeHtml(orderDraft.filter || '全部') + '」筛选。</p>');
        return true;
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
      if (/逐项报价|下一步|确认选品|生成订单/.test(text)) {
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
      sub: quotePrice * qty
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
      '</p><p class="sc-quote-line__meta">' +
      App.escapeHtml(line.inventoryCode) +
      ' · ' +
      App.escapeHtml(line.inventorySpec) +
      '</p><div class="sc-quote-line__fields">' +
      renderQuoteLineSkuSelectByPid(pr, line, pid) +
      '<label class="sc-qty-inline">数量 <input type="number" min="1" value="' +
      line.qty +
      '" data-action="quote-line-qty" data-pid="' +
      pid +
      '" data-idx="' +
      idx +
      '" class="sc-qty-input sc-input sc-input--field"/></label>' +
      '<div class="sc-quote-price-hints"><span>最新售价 <strong data-quote-latest="' +
      pid +
      '">' +
      fmtMoney(line.latestPrice) +
      '</strong></span><span>最低售价 <strong data-quote-min="' +
      pid +
      '">' +
      fmtMoney(line.minPrice) +
      '</strong></span></div>' +
      '<label class="sc-quote-price-input">本单报价（元）<input type="number" min="0" step="0.01" value="' +
      line.quotePrice +
      '" data-action="quote-line-price" data-pid="' +
      pid +
      '" data-idx="' +
      idx +
      '" class="sc-input sc-input--field"/></label>' +
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
      const skuSel =
        document.querySelector('[data-action="quote-line-sku"][data-pid="' + pid + '"]') ||
        document.querySelector('[data-action="quote-line-sku"][data-idx="' + idx + '"]');
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
        const hints = DemoData.priceHints(pr, line.skuId);
        line.latestPrice = hints.latestPrice;
        line.minPrice = hints.minPrice;
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
    const inp = document.getElementById('quote-filter-input');
    if (inp) ctx().quoteDraft.filter = inp.value.trim();
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
    const recs = DemoData.recommendProducts(c, d.filter, undefined, demandMatch);
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
      renderQuoteDemandSummaryHtml(c) +
      '<div class="sc-plan-filter-row"><input type="search" class="sc-input sc-input--field" id="quote-filter-input" placeholder="筛选品名/规格" value="' +
      App.escapeHtml(d.filter || '') +
      '"/><button type="button" class="sc-btn sc-btn--ghost" data-action="quote-filter">筛选</button></div>' +
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
    ctx().quotePending = {
      customerId: meta.customerId,
      sourceType: meta.sourceType,
      schemeId: meta.schemeId || null,
      lines: lines,
      total: lines.reduce((s, l) => s + l.sub, 0),
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
    const inp = document.getElementById('quote-filter-input');
    if (inp) ctx().quoteDraft.filter = inp.value.trim();
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
    publishQuoteCard(pending, picked.value);
  }

  function submitQuoteTemplate(opts) {
    submitQuote(opts);
  }

  function runDelivery() {
    const c = requireCustomer();
    if (!c) return;
    if (!ctx().quote || ctx().quote.customerId !== c.id) {
      App.pushAiHtml('请先完成 <strong>报价</strong> 后再查交期。');
      return;
    }
    App.pushAiHtml(renderDeliveryFormCard());
    rescanAnnotationPins();
  }

  function renderDeliveryFormCard() {
    const quote = ctx().quote;
    const hint = quote ? '报价单 ' + quote.id + ' · ' + fmtMoney(quote.total) : '';
    return (
      '<div class="sc-card sc-card--compact sc-card--inline-form" data-spec-id="sheet-delivery">' +
      '<div class="sc-card__head sc-card__head--compact">交期评审</div>' +
      '<p class="sc-card__meta">' + App.escapeHtml(hint) + '</p>' +
      '<label class="sc-field-label">期望交期</label>' +
      '<input class="sc-input sc-input--field" data-field="delivery-date" type="date" />' +
      '<div class="sc-card__actions-inline"><button type="button" class="sc-btn sc-btn--primary" data-action="delivery-submit">提交评审</button></div>' +
      '</div>'
    );
  }

  function submitDelivery() {
    const el = getActiveFormCard('sheet-delivery');
    const dateInp = el && el.querySelector('[data-field="delivery-date"]');
    const date = dateInp ? dateInp.value : '';
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

  function ensureOrderDraft(customer) {
    const c = customer || requireCustomer();
    if (!c) return null;
    if (!ctx().orderDraft || ctx().orderDraft.customerId !== c.id) {
      ctx().orderDraft = { customerId: c.id, filter: '', selected: {}, sku: {}, qty: {}, saveAsScheme: false, moreVisible: PLAN_MORE_PAGE_SIZE };
    }
    if (ctx().orderDraft.moreVisible == null) ctx().orderDraft.moreVisible = PLAN_MORE_PAGE_SIZE;
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
    const inp = document.getElementById('order-filter-input');
    if (inp) ctx().orderDraft.filter = inp.value.trim();
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

  function renderOrderProductPickCard() {
    const d = ctx().orderDraft;
    const c = App.getCustomer(d.customerId);
    const demandMatch = orderDemandForMatch();
    const recs = DemoData.recommendProducts(c, d.filter, undefined, demandMatch);
    const recIds = new Set(recs.map((r) => r.product.id));
    const recRows = recs.map((r) => orderPickRow(r.product, recommendRecTagHtml(r))).join('');
    const moreSection = renderPickMoreSection(d, recIds, demandMatch, orderPickRow);
    const isOld = DemoData.isOldCustomer(c, DemoData.demoSalesUser);
    const hasDemand = !!(demandMatch && demandMatch.trim());
    const addDemandBtn =
      isOld && !hasDemand
        ? '<button type="button" class="sc-btn sc-btn--ghost" data-action="quote-add-demand">录入用户需求</button>'
        : '';
    return (
      '<div class="sc-card sc-card--compact" data-spec-id="card-order-pick"><div class="sc-card__head sc-card__head--compact">订单选品</div>' +
      recommendLeadHtml(c, demandMatch) +
      renderQuoteDemandSummaryHtml(c) +
      '<div class="sc-plan-filter-row"><input type="search" class="sc-input sc-input--field" id="order-filter-input" placeholder="筛选品名/规格" value="' +
      App.escapeHtml(d.filter || '') +
      '"/><button type="button" class="sc-btn sc-btn--ghost" data-action="order-filter">筛选</button></div>' +
      '<div class="sc-follow-list sc-plan-pick-list">' +
      (recRows || pickCardEmptyHint(c)) +
      moreSection +
      '</div>' +
      '<label class="sc-plan-save-scheme"><input type="checkbox" id="order-save-scheme"' +
      (d.saveAsScheme ? ' checked' : '') +
      '/> 保存为方案</label>' +
      '<div class="sc-card__actions-inline">' +
      addDemandBtn +
      '<button type="button" class="sc-btn sc-btn--ghost-primary" data-action="order-to-quote-setup">下一步：逐项报价</button></div></div>'
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
    return '<div class="sc-card sc-card--compact" data-spec-id="card-order-cart"><div class="sc-card__head sc-card__head--compact">订单购物车</div><div class="sc-follow-list">' + rows + '</div>' +
      '<label class="sc-plan-save-scheme"><input type="checkbox" id="order-save-scheme"' + (d.saveAsScheme ? ' checked' : '') + '/> 保存为方案</label>' +
      '<div class="sc-card__actions-inline"><button type="button" class="sc-btn sc-btn--ghost" data-action="order-back-pick">返回</button><button type="button" class="sc-btn sc-btn--ghost-primary" data-action="order-to-quote-setup">下一步：逐项报价</button></div></div>';
  }

  function setOrderPending(lines, meta) {
    ctx().orderPending = { customerId: meta.customerId, sourceType: meta.sourceType, quoteId: meta.quoteId || null, lines: lines, total: meta.total != null ? meta.total : lines.reduce((s, l) => s + l.sub, 0), saveAsScheme: !!meta.saveAsScheme };
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
        skuLabel: l.skuLabel
      }))
    };
  }

  function createOrderFromPending(pending, c, opts) {
    opts = opts || {};
    const status = opts.status || '待排产';
    const isPendingSubmit = status === DemoData.orderStatusPendingSubmit;
    const orderNo = 'SO' + Date.now().toString().slice(-10);
    const snap = orderSnapshotFromPending(pending, c);
    const order = {
      id: 'o' + Date.now(),
      no: orderNo,
      status: status,
      statusDetail: isPendingSubmit ? '报价已生成，待确认下单' : '订单已创建，等待排产',
      date: new Date().toISOString().slice(0, 10),
      salesperson: DemoData.salesperson,
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
    existing.status = '待排产';
    existing.statusDetail = '订单已创建，等待排产';
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
    if (pending.sourceType === 'direct') return '直选下单';
    if (pending.sourceType === 'scheme') return '按方案';
    return '—';
  }

  function renderOrderConfirmBody(pending, c) {
    if (!pending || !pending.lines || !pending.lines.length) return '';
    const del = ctx().delivery;
    const lineRows = pending.lines
      .map(function (line, i) {
        const unit = line.salesUnit || '件';
        const price = line.quotePrice != null ? line.quotePrice : line.unitPrice || 0;
        const sub = line.sub != null ? line.sub : price * (line.qty || 1);
        return (
          '<tr><td class="sc-order-confirm__idx">' +
          (i + 1) +
          '</td><td><strong>' +
          App.escapeHtml(line.inventoryName || '—') +
          '</strong><span class="sc-order-confirm__code">' +
          App.escapeHtml(line.inventoryCode || '—') +
          '</span></td><td>' +
          App.escapeHtml(formatOrderLineSpec(line)) +
          '</td><td class="sc-order-confirm__num">' +
          (line.qty || 0) +
          ' ' +
          App.escapeHtml(unit) +
          '</td><td class="sc-order-confirm__num">' +
          fmtMoney(price) +
          '</td><td class="sc-order-confirm__num sc-order-confirm__sub">' +
          fmtMoney(sub) +
          '</td></tr>'
        );
      })
      .join('');
    const customerMeta =
      c && c.code
        ? '<span class="sc-order-confirm__code">' + App.escapeHtml(c.code) + '</span>'
        : '';
    return (
      '<div class="sc-order-confirm">' +
      '<dl class="sc-order-confirm__summary">' +
      '<div class="sc-order-confirm__row"><dt>客户</dt><dd><strong>' +
      App.escapeHtml(c ? c.name : '—') +
      '</strong>' +
      customerMeta +
      '</dd></div>' +
      '<div class="sc-order-confirm__row"><dt>订单来源</dt><dd>' +
      App.escapeHtml(orderSourceLabel(pending)) +
      '</dd></div>' +
      (del && del.detail
        ? '<div class="sc-order-confirm__row"><dt>交期</dt><dd>' + App.escapeHtml(del.detail) + '</dd></div>'
        : '') +
      '</dl>' +
      '<p class="sc-order-confirm__lines-title">订单明细（' +
      pending.lines.length +
      ' 项）</p>' +
      '<div class="sc-order-confirm__table-wrap"><table class="sc-order-confirm__table">' +
      '<thead><tr><th>#</th><th>品名</th><th>规格</th><th>数量</th><th>单价</th><th>小计</th></tr></thead><tbody>' +
      lineRows +
      '</tbody></table></div>' +
      '<p class="sc-order-confirm__total">合计金额 <strong>' +
      fmtMoney(pending.total) +
      '</strong></p></div>'
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
      '<div class="sc-card__head sc-card__head--compact">订单确认</div>' +
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
    const c = App.getCustomer(pending.customerId);
    if (pending.saveAsScheme && pending.sourceType === 'direct') saveSchemeFromPending(pending);
    const existing = findPendingSubmitOrderByQuoteId(pending.quoteId);
    const order = existing
      ? submitPendingOrder(existing, pending, c)
      : createOrderFromPending(pending, c);
    App.closeOverlays();
    ctx().orderPending = null;
    App.pushAiHtml(renderOrderSuccessCard(order, c.name, pending.total));
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

  function copyOrderToPlan(oid, opts) {
    opts = opts || {};
    const o = DemoData.orders.find((x) => x.id === oid);
    const c = App.getCustomer(o.customerId);
    ensurePlan(c);
    const plan = ctx().plan;
    plan.selected = {};
    plan.sku = {};
    plan.qty = {};
    (o.productIds || ['p1', 'p2']).forEach((pid) => {
      planSelectProduct(pid, true);
      plan.qty[pid] = plan.qty[pid] || 1;
    });
    if (opts.simulateUserMsg) {
      simulateUserUtterance('复制订单 ' + o.no + ' 做方案');
    }
    App.pushAiHtml(
      '<p class="sc-reply-lead">已按订单 <strong>' +
        o.no +
        '</strong> 带入方案预览，可改规格与数量后生成方案：</p>' +
        renderPlanCartCardFixed()
    );
  }

  function openChangeSheet(oid) {
    ctx().changeOrderId = oid;
    App.pushAiHtml(renderChangeFormCard(oid));
    rescanAnnotationPins();
  }

  function renderChangeFormCard(oid) {
    const o = DemoData.orders.find(function (x) {
      return x.id === oid;
    });
    const reasons = (DemoData.changeReasons || [])
      .map(function (r) {
        return '<option value="' + App.escapeHtml(r) + '">' + App.escapeHtml(r) + '</option>';
      })
      .join('');
    return (
      '<div class="sc-card sc-card--compact sc-card--inline-form" data-spec-id="sheet-change" data-change-oid="' +
      App.escapeHtml(oid) +
      '">' +
      '<div class="sc-card__head sc-card__head--compact">变更订单 — ' +
      App.escapeHtml(o ? o.no : '') +
      '</div>' +
      '<label class="sc-field-label">变更原因</label>' +
      '<select class="sc-input sc-input--field" data-field="change-reason">' +
      reasons +
      '</select>' +
      '<label class="sc-field-label">备注</label>' +
      '<textarea class="sc-textarea" data-field="change-remark" placeholder="请说明变更内容…"></textarea>' +
      '<div class="sc-card__actions-inline"><button type="button" class="sc-btn sc-btn--primary" data-action="change-submit">提交变更</button></div>' +
      '</div>'
    );
  }

  function submitChange() {
    const card = getActiveFormCard('sheet-change');
    const oid = (card && card.getAttribute('data-change-oid')) || ctx().changeOrderId;
    const o = DemoData.orders.find(function (x) {
      return x.id === oid;
    });
    const reasonEl = card && card.querySelector('[data-field="change-reason"]');
    const remarkEl = card && card.querySelector('[data-field="change-remark"]');
    const reason = reasonEl ? reasonEl.value : '';
    const remark = remarkEl ? remarkEl.value.trim() : '';
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
    App.pushAiHtml(renderServiceFormCard(c));
    rescanAnnotationPins();
  }

  function renderServiceFormCard(c) {
    return (
      '<div class="sc-card sc-card--compact sc-card--inline-form" data-spec-id="sheet-service">' +
      '<div class="sc-card__head sc-card__head--compact">客服工单 — ' +
      App.escapeHtml(c.name) +
      '</div>' +
      '<label class="sc-field-label">问题描述</label>' +
      '<textarea class="sc-textarea" data-field="service-desc" placeholder="请描述客户投诉或售后问题…"></textarea>' +
      '<div class="sc-card__actions-inline"><button type="button" class="sc-btn sc-btn--primary" data-action="service-submit">提交工单</button></div>' +
      '</div>'
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
    const card = getActiveFormCard('sheet-service');
    const descEl = card && card.querySelector('[data-field="service-desc"]');
    const desc = descEl ? descEl.value.trim() : '';
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
    if (/交期|什么时候交/.test(t)) {
      enterSkill('delivery');
      runDelivery();
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
    if (action === 'plan-edit-demand') {
      openPlanDemandEdit({ edit: true, simulateUserMsg: true });
      return true;
    }
    if (action === 'plan-add-demand') {
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
    if (action === 'quote-add-demand') {
      openQuoteDemandEdit({ edit: true, simulateUserMsg: true });
      return true;
    }
    if (action === 'quote-edit-demand') {
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
    if (action === 'plan-filter') {
      syncPlanFilterFromDom();
      resetPlanMoreVisible(ctx().plan);
      refreshLastPlanPickCard();
      return true;
    }
    if (action === 'plan-load-more') {
      const card = btn.closest('[data-spec-id="card-plan-pick"]');
      if (card && appendMorePickProducts(card, 'plan')) bindPickLazyLoad(card, 'plan');
      return true;
    }
    if (action === 'plan-preview' || action === 'plan-to-cart') {
      syncPlanFilterFromDom();
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
    if (action === 'delivery-submit') {
      submitDelivery();
      return true;
    }
    if (action === 'change-submit') {
      submitChange();
      return true;
    }
    if (action === 'service-submit') {
      submitService();
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
    if (action === 'quote-filter') {
      const inp = document.getElementById('quote-filter-input');
      if (inp) ctx().quoteDraft.filter = inp.value.trim();
      resetPickMoreVisible(ctx().quoteDraft);
      refreshLastQuotePickCard();
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
    if (action === 'order-filter') {
      const inp = document.getElementById('order-filter-input');
      if (inp) ctx().orderDraft.filter = inp.value.trim();
      resetPickMoreVisible(ctx().orderDraft);
      refreshLastOrderPickCard();
      return true;
    }
    if (action === 'order-to-cart' || action === 'order-to-quote-setup') {
      orderToQuoteSetupFromDraft({ simulateUserMsg: true });
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
      copyOrderToPlan(oid, { simulateUserMsg: true });
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
      if (o) simulateUserUtterance('查看订单 ' + o.no + ' 进度');
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
    submitService,
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
    onQuoteLineSkuChange,
    refreshLastQuoteConfirmCard
  };
})();
