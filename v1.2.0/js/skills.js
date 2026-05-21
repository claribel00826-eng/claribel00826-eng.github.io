window.Skills = (function () {
  let App;
  const PLAN_MORE_PAGE_SIZE = 5;
  let planMoreObserver = null;

  function init(app) {
    App = app;
    if (!App.state.ctx) App.state.ctx = {};
  }

  function ctx() {
    if (!App.state.ctx) App.state.ctx = {};
    return App.state.ctx;
  }

  /** 当前助手页内的补充说明，不触发「新页面」失效 */
  function pushAiMeta(html) {
    App.pushAiHtml(html, { samePage: true });
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
   * 与 annotation-docs/05、chat-llm 面板「缺槽定位」表一致
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
      message: '请说明要做方案、报价还是下单',
      hint: '可点底部技能条，或直接说「配个方案」「报价」「下单」',
      specId: 'chat-skill-bar'
    },
    planDemand: {
      message: '请描述采购需求',
      hint: '在需求描述卡填写并点确认，或底部按住说话/输入文字',
      specId: 'card-plan-demand',
      ensureCard: function () {
        enterSkill('plan');
        const c = activeCustomer();
        if (!c) return;
        if (!document.querySelector('[data-spec-id="card-plan-demand"]')) {
          ensurePlan(c);
          App.pushAiHtml(renderPlanDemandCard(c));
        }
      }
    },
    planPickProducts: {
      message: '请先在选品卡勾选至少一种产品',
      hint: '勾选后点「加入购物车」；或说「选品 伺服电机」再「加购」',
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
      message: '购物车为空，请先在选品卡勾选并加入购物车',
      hint: '在选品卡勾选后点「加入购物车」，或说「加购」',
      toast: '购物车为空，请先选品加购',
      specId: 'card-plan-pick',
      ensureCard: function () {
        guideMissingSlot('planPickProducts', { skipToast: true });
      }
    },
    planTemplate: {
      message: '请选择方案模板',
      hint: '在弹窗中点选或说「第1个」、模板名称；说「保存方案」确认',
      toast: '请选择方案模板',
      specId: 'sheet-plan-template',
      openSheet: function () {
        openPlanTemplateSheet();
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
        if (!document.querySelector('[data-spec-id="card-quote-source"]')) {
          App.pushAiHtml(
            '<p class="sc-reply-lead">请选择报价方式。</p>' + renderQuoteSourceCard(c)
          );
        }
      }
    },
    quoteNoScheme: {
      message: '暂无本客户方案，请先完成方案速配或使用直接选品',
      specId: 'card-quote-source',
      ensureCard: function () {
        const c = activeCustomer();
        if (!c) return;
        enterSkill('quote');
        App.pushAiHtml(renderNoSchemeForQuoteCard(c));
      }
    },
    quoteSchemePick: {
      message: '请选择要报价的方案',
      hint: '在下列方案中点选一行（方案名称），或说出方案名称/编号',
      specId: 'card-scheme-pick'
    },
    quotePickProducts: {
      message: '请至少选择一种产品',
      hint: '在报价选品卡勾选产品，或补充品名后重试',
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
      hint: '在逐项报价抽屉中填写单价，或说「伺服电机改4200」',
      toast: '请为每项产品填写本单报价',
      specId: 'sheet-quote-setup',
      openSheet: function () {
        if (!isQuoteSetupOpen()) openQuoteSetupSheet();
      },
      focusSpecId: 'sheet-quote-setup'
    },
    quoteTemplate: {
      message: '请选择报价单模板',
      toast: '请选择报价单模板',
      specId: 'sheet-quote-template',
      openSheet: function () {
        openQuoteTemplateSheet();
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
        if (!document.querySelector('[data-spec-id="card-order-source"]')) runOrder();
      }
    },
    orderNoQuotes: {
      message: '请先完成报价或使用直接选品',
      hint: '可先进行产品报价生成报价单，或在下单来源卡选「直接选品」',
      toast: '请先完成报价或使用直接选品',
      ensureCard: function () {
        guideMissingSlot('orderSource', { skipToast: true });
      }
    },
    orderQuotePick: {
      message: '请选择要下单的报价单',
      hint: '点选下列一行，或说出报价单编号/模板名',
      specId: 'card-quote-select'
    },
    orderPickProducts: {
      message: '请至少选择一种产品',
      specId: 'card-order-pick',
      ensureCard: function () {
        enterSkill('order');
        const c = activeCustomer();
        if (!c) return;
        if (!document.querySelector('[data-spec-id="card-order-pick"]')) {
          orderDirectStart();
        }
      }
    },
    orderLinePrice: {
      message: '请为订单明细填写本单报价',
      hint: '在逐项报价抽屉填写，语音改价需对准当前表行',
      specId: 'sheet-quote-setup',
      openSheet: function () {
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

  function setActivePickList(type, list) {
    const display = (list || []).slice().reverse();
    ctx().activePickList = {
      type: type,
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
      t.match(/^选(?:第)?([一二三四五六七八九十\d]{1,3})$/) ||
      t.match(/^([1-9]\d*)$/);
    if (!m) return null;
    const n = parseToken(m[1]);
    return n >= 1 ? n : null;
  }

  function latestPickListCardSpecId(type) {
    return type === 'scheme' ? 'card-scheme-pick' : 'card-quote-select';
  }

  function applySchemePickById(sid) {
    const demand = ctx().pendingSchemeQuoteDemand;
    delete ctx().pendingSchemeQuoteDemand;
    const scheme = schemeForActiveCustomer(sid);
    if (!scheme) {
      App.toast('未找到所选方案');
      return false;
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

  function applyQuotePickById(qid) {
    const quote = quoteForActiveCustomer(qid);
    if (!quote) {
      App.toast('未找到所选报价单');
      return false;
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
          App.pushAiHtml(
            '<p class="sc-card__meta">已选报价单「' + App.escapeHtml(hit.id) + '」。</p>'
          );
          return applyQuotePickById(hit.id);
        }
      }
    }
    return false;
  }

  function renderSchemePickCard(list) {
    const rows = list
      .slice()
      .reverse()
      .map(
        function (s, i) {
          const n = i + 1;
          return (
            '<button type="button" class="sc-follow-row sc-follow-row--select" data-action="quote-pick-scheme" data-scheme-id="' +
            App.escapeHtml(s.id) +
            '" data-pick-index="' +
            n +
            '"><span class="sc-follow-row__name">' +
            n +
            '. ' +
            App.escapeHtml(s.templateName || '未命名方案') +
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
      '<div class="sc-card__head sc-card__head--compact">选择方案</div>' +
      '<div class="sc-follow-list">' +
      rows +
      '</div></div>'
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
    setActivePickList('scheme', list);
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

  function renderQuoteSelectCard(list) {
    const rows = list
      .slice()
      .reverse()
      .map(function (q, i) {
        const n = i + 1;
        return (
          '<button type="button" class="sc-follow-row sc-follow-row--select" data-action="order-pick-quote" data-quote-id="' +
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
      '<div class="sc-card__head sc-card__head--compact">选择报价单</div>' +
      '<div class="sc-follow-list">' +
      rows +
      '</div></div>'
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
    setActivePickList('quote', list);
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
      guideMissingSlot('orderNoQuotes');
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
      templateName: tpl.name,
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
    App.pushAiHtml(
      '<div class="sc-card" data-spec-id="card-scheme"><div class="sc-card__head sc-card__head--compact">方案 ' +
        App.escapeHtml(scheme.id) +
        '</div><div class="sc-card__row sc-card__row--compact"><p class="sc-card__meta">客户：' +
        App.escapeHtml(c.name) +
        '</p><p class="sc-card__meta">模板：' +
        App.escapeHtml((tpl && tpl.name) || scheme.templateName || '—') +
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

  function openPdf(title, kind) {
    const modal = App.$('#pdf-modal');
    if (!modal) return;
    const k = kind || title || '';
    const isQuote = pdfKindIsQuote(k);
    const t = modal.querySelector('.sc-pdf__bar span:nth-child(2)');
    const body = modal.querySelector('.sc-pdf__body');
    if (t) t.textContent = isQuote ? '报价单预览' : '方案预览';
    if (body) body.innerHTML = renderPdfDocument(k);
    modal.classList.remove('sc-hidden');
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
    if (plan) plan.moreVisible = PLAN_MORE_PAGE_SIZE;
  }

  function getLastPlanPickCard() {
    const cards = document.querySelectorAll('[data-spec-id="card-plan-pick"]');
    return cards.length ? cards[cards.length - 1] : null;
  }

  function planDemandForMatch() {
    const plan = ctx().plan;
    return plan && plan.demandText ? plan.demandText : '';
  }

  function planMoreProductList(plan, recIds) {
    const c = App.getCustomer(plan.customerId);
    return DemoData.planMoreProducts(c, recIds, plan.filter || '', undefined, planDemandForMatch());
  }

  function renderPlanMoreSection(plan, recIds) {
    const all = planMoreProductList(plan, recIds);
    if (!all.length) return '';
    if (plan.moreVisible == null) plan.moreVisible = PLAN_MORE_PAGE_SIZE;
    const visible = Math.min(plan.moreVisible, all.length);
    const rows = all
      .slice(0, visible)
      .map((p) =>
        planPickRow(p, '<span class="sc-plan-rec-badge sc-plan-rec-badge--more">全部</span>')
      )
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

  function updatePlanMoreFooter(card, total, visible) {
    const status = card.querySelector('[data-plan-more-status]');
    const sentinel = card.querySelector('[data-plan-more-sentinel]');
    if (visible >= total) {
      if (status) {
        status.className = 'sc-plan-more-status sc-plan-more-status--done';
        status.textContent = '已加载全部 ' + total + ' 条';
      }
      if (sentinel) {
        if (planMoreObserver) planMoreObserver.unobserve(sentinel);
        sentinel.remove();
      }
    } else if (status) {
      status.textContent =
        '已显示 ' + visible + ' / ' + total + '，继续下滑加载（每页 ' + PLAN_MORE_PAGE_SIZE + ' 条）';
    }
  }

  function appendMorePlanProducts(card) {
    const plan = ctx().plan;
    if (!plan || !card) return false;
    const c = App.getCustomer(plan.customerId);
    if (!c) return false;
    const recs = DemoData.recommendProducts(c, plan.filter, undefined, planDemandForMatch());
    const recIds = new Set(recs.map((r) => r.product.id));
    const all = planMoreProductList(plan, recIds);
    const prev = plan.moreVisible != null ? plan.moreVisible : PLAN_MORE_PAGE_SIZE;
    if (prev >= all.length) return false;
    const next = Math.min(prev + PLAN_MORE_PAGE_SIZE, all.length);
    const listEl = card.querySelector('[data-plan-more-list]');
    if (!listEl) return false;
    const chunk = all
      .slice(prev, next)
      .map((p) =>
        planPickRow(p, '<span class="sc-plan-rec-badge sc-plan-rec-badge--more">全部</span>')
      )
      .join('');
    listEl.insertAdjacentHTML('beforeend', chunk);
    plan.moreVisible = next;
    updatePlanMoreFooter(card, all.length, next);
    return true;
  }

  function bindPlanPickLazyLoad(card) {
    if (planMoreObserver) {
      planMoreObserver.disconnect();
      planMoreObserver = null;
    }
    if (!card) return;
    const scrollRoot = card.querySelector('.sc-plan-pick-list');
    const sentinel = card.querySelector('[data-plan-more-sentinel]');
    if (!scrollRoot || !sentinel) return;
    planMoreObserver = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) appendMorePlanProducts(card);
      },
      { root: scrollRoot, rootMargin: '56px 0px', threshold: 0 }
    );
    planMoreObserver.observe(sentinel);
  }

  function schedulePlanPickLazyBind() {
    setTimeout(function () {
      bindPlanPickLazyLoad(getLastPlanPickCard());
    }, 0);
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

  /** 方案选品行：仅品名/存货规格/标签，不含单价；规格下拉始终可改 */
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

  function recommendLeadHtml(c) {
    if (DemoData.isOldCustomer(c, DemoData.demoSalesUser)) {
      return '<p class="sc-card__meta sc-plan-rec-hint">推荐区：本客户历史订单（时间倒序，最多十条）</p>';
    }
    if (DemoData.isNewCustomer(c)) {
      const d = planDemandForMatch();
      if (d) {
        const short = d.length > 28 ? d.slice(0, 28) + '…' : d;
        return (
          '<p class="sc-card__meta sc-plan-rec-hint">推荐区：已按需求「' +
          App.escapeHtml(short) +
          '」与存货描述匹配（超过八成）</p>'
        );
      }
      return '<p class="sc-card__meta sc-plan-rec-hint">推荐区：先按客户性质与产品类型筛选，再按需求关键词与存货描述匹配（超过八成）</p>';
    }
    return '<p class="sc-card__meta sc-plan-rec-hint">推荐区：按客户档案类型展示</p>';
  }

  function renderPlanDemandCard(c) {
    const cat = App.escapeHtml(c.category || '—');
    return (
      '<div class="sc-card sc-card--compact" data-spec-id="card-plan-demand"><div class="sc-card__head sc-card__head--compact">描述采购需求</div>' +
      '<p class="sc-card__meta">新客户 · 档案性质「' +
      cat +
      '」已用于第一步筛选；可在下方多行框填写后点确认，或<strong>仅用底部输入区</strong>发送文字 / 按住说话（卡片内无重复语音条）。</p>' +
      '<textarea class="sc-textarea sc-plan-demand-input" id="plan-demand-input" rows="3" placeholder="如：伺服电机和传动齿轮箱各2台，用于自动化产线"></textarea>' +
      '<div class="sc-card__actions-inline">' +
      '<button type="button" class="sc-btn sc-btn--ghost-primary" data-action="plan-demand-submit">确认需求 · 进入选品</button>' +
      '</div>' +
      '<p class="sc-card__meta sc-plan-voice-hint">语音输入请使用页面底部「按住 说话」或切换键盘后发送，识别结果进入对话流</p></div>'
    );
  }

  function submitPlanDemand(text) {
    const plan = ctx().plan;
    if (!plan || !plan.customerId) return false;
    const t = (text || '').trim();
    if (!t) {
      App.toast('请描述采购需求');
      return true;
    }
    if (isPlainSkillPhrase(t) && !/需要|电机|轴承|齿轮|伺服|导轨|PLC|产线|自动化|各\s*\d+|\d+\s*台/.test(t)) {
      App.toast('请用一句话描述需要什么产品，例如：伺服电机和齿轮箱各2台');
      return true;
    }
    const c = App.getCustomer(plan.customerId);
    plan.demandText = t;
    plan.awaitingDemand = false;
    plan.filter = '';
    App.pushAiHtml(
      '<p class="sc-reply-lead">已记录需求，为 <strong>' +
        App.escapeHtml(c.name) +
        '</strong> 匹配推荐商品，请选品或说「选品 品名」。</p>' +
        renderProductPickCard()
    );
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

    return (
      '<div class="sc-card sc-card--compact" data-spec-id="card-plan-pick"><div class="sc-card__head sc-card__head--compact">选品 · 改规格</div>' +
      recommendLeadHtml(c) +
      '<div class="sc-plan-filter-row">' +
      '<input type="search" class="sc-input sc-input--field" id="plan-filter-input" placeholder="筛选品名/规格" value="' +
      App.escapeHtml(plan.filter || '') +
      '"/>' +
      '<button type="button" class="sc-btn sc-btn--ghost" data-action="plan-filter">筛选</button></div>' +
      '<div class="sc-follow-list sc-plan-pick-list">' +
      (recRows || '<p class="sc-card__meta">暂无推荐，请调整筛选或查看下方全部产品。</p>') +
      moreSection +
      '</div><div class="sc-card__actions-inline">' +
      '<button type="button" class="sc-btn sc-btn--ghost-primary" data-action="plan-to-cart">加入购物车</button>' +
      '<p class="sc-card__meta sc-plan-voice-hint">可说：选品、加购、生成方案</p></div></div>'
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
      '<div class="sc-card sc-card--compact" data-spec-id="card-plan-cart"><div class="sc-card__head sc-card__head--compact">方案购物车 · 改规格</div>' +
      '<div class="sc-follow-list">' +
      rows +
      '</div><div class="sc-card__actions-inline">' +
      '<button type="button" class="sc-btn sc-btn--ghost" data-action="plan-back-pick">返回选品</button>' +
      '<button type="button" class="sc-btn sc-btn--ghost-primary" data-action="plan-confirm">生成方案</button></div>' +
      '<p class="sc-card__meta sc-plan-voice-hint">生成方案前须选择方案模板</p></div>'
    );
  }

  function startPlan(customer) {
    const c = ensurePlan(customer);
    if (!c) return;
    const plan = ctx().plan;
    if (ctx().plan) ctx().plan.filter = '';
    enterSkill('plan');
    if (DemoData.isNewCustomer(c) && !(plan.demandText && plan.demandText.trim())) {
      plan.awaitingDemand = true;
      App.pushAiHtml(
        '<p class="sc-reply-lead">为 <strong>' +
          App.escapeHtml(c.name) +
          '</strong> 配方案，请先说明采购需求。</p>' +
          renderPlanDemandCard(c)
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
  }

  function isPlanTemplateOpen() {
    const el = App.$('#overlay-plan-template');
    return el && !el.classList.contains('sc-hidden');
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
      submitPlanTemplate();
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

  function openPlanTemplateSheet() {
    syncPlanQtyFromDom();
    if (!planSelectedIds().length) {
      App.toast('请先在购物车中加入产品');
      return;
    }
    const list = App.$('#plan-template-list');
    if (list) list.innerHTML = renderPlanTemplateListHtml();
    App.$('#overlay-plan-template').classList.remove('sc-hidden');
    if (window.Annotation && Annotation.scanHosts) window.Annotation.scanHosts();
  }

  function confirmPlan(templateId) {
    syncPlanQtyFromDom();
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
      templateName: tpl.name,
      lines,
      total,
      createdAt: new Date().toISOString().slice(0, 16).replace('T', ' ')
    });
    App.closeOverlays();
    const scheme = schemeForActiveCustomer(schemeId);
    pushSchemeCard(scheme, c, tpl);
  }

  function submitPlanTemplate() {
    const picked = document.querySelector('input[name="plan-template"]:checked');
    if (!picked) {
      App.toast('请选择方案模板');
      return;
    }
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

  /** 口令「按方案报价」[+ 方案名称/方案编号]：检索方案 → 唯一则逐项报价，多个则选择方案卡 */
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
          '</strong> 暂无已保存方案，无法按方案报价。</p>' +
          renderNoSchemeForQuoteCard(c)
      );
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
          '」，进入逐项报价。</p>'
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
    if (DemoData.tryParseCustomerDemandUtterance) {
      const parsed = DemoData.tryParseCustomerDemandUtterance(t, customersInEnterprise());
      if (parsed && parsed.customer) {
        c = parsed.customer;
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
    const c = ensurePlan();
    if (!c) return false;

    if (ctx().plan) {
      ctx().plan.demandText = t;
      ctx().plan.awaitingDemand = false;
    }
    const matches = DemoData.matchProductsFromDemandText(c, t);
    if (!matches.length) {
      App.toast('未能从描述中匹配产品，请补充品名关键词或走选品流程');
      if (ctx().plan) ctx().plan.filter = '';
      enterSkill('plan');
      startPlan(c);
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
    ctx().quotePending = null;
    App.closeOverlays();
    pushQuoteCard(quote, c, tpl);
  }

  function pushQuoteCard(quote, c, tpl) {
    let schemeNameLine = '';
    if (quote.sourceType === 'scheme' && quote.schemeId) {
      const sch = schemesForCustomer(c.id).find((s) => s.id === quote.schemeId);
      if (sch && sch.templateName) {
        schemeNameLine =
          '<p class="sc-card__meta">方案名称：' + App.escapeHtml(sch.templateName) + '</p>';
      }
    }
    App.pushAiHtml(
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
        if (!document.querySelector('[data-spec-id="card-quote-source"]')) runQuote();
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
    if (DemoData.tryParseCustomerDemandUtterance) {
      const parsed = DemoData.tryParseCustomerDemandUtterance(t, customersInEnterprise());
      if (parsed && parsed.customer) {
        c = parsed.customer;
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

  function refreshLastPlanPickCard() {
    const card = getLastPlanPickCard();
    if (!card) return;
    card.outerHTML = renderProductPickCard();
    schedulePlanPickLazyBind();
  }

  function refreshLastPlanCartCard() {
    const cards = document.querySelectorAll('[data-spec-id="card-plan-cart"]');
    const card = cards[cards.length - 1];
    if (card) card.outerHTML = renderPlanCartCardFixed();
  }

  function tryPlanCommand(t) {
    const plan = ctx().plan;
    if (!plan || !plan.customerId) return false;
    if (plan.awaitingDemand) return false;
    const text = (t || '').trim();
    if (!text) return false;

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
        pushAiMeta('<p class="sc-card__meta">已选品：<strong>' + App.escapeHtml(p.name) + '</strong>，可调整规格后说「加购」。</p>');
        return true;
      }
      refreshLastPlanPickCard();
      pushAiMeta('<p class="sc-card__meta">请在选品卡中点选产品，或说「选品 伺服电机」。</p>');
      return true;
    }

    if (/加购|加入购物车|确认选品/.test(text)) {
      if (!planSelectedIds().length) {
        guideMissingSlot('planPickProducts');
        return true;
      }
      syncPlanFilterFromDom();
      App.pushAiHtml(renderPlanCartCardFixed());
      pushAiMeta('<p class="sc-card__meta">已加入购物车，可修改 SKU 与数量后说「生成方案」。</p>');
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
    const el = App.$('#overlay-quote-setup');
    return el && !el.classList.contains('sc-hidden');
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

  /** 逐项报价抽屉内语音/键盘：不回写对话区，必要时 toast */
  function quoteIntentReply(html, toastShort) {
    if (App.state._quoteSetupVoice) {
      if (toastShort) App.toast(toastShort);
      return;
    }
    App.pushAiHtml(html);
  }

  function tryQuoteCommand(t) {
    const text = (t || '').trim();
    if (!text) return false;
    const draft = ctx().quoteDraft;
    const pending = ctx().quotePending;

    if (draft && draft.customerId && !pending) {
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
      quoteSetupNext();
      return true;
    }
    if (!pending.forOrder && /模板|生成报价单|下一步|选择模板/.test(text)) {
      quoteSetupNext();
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
      ctx().quoteDraft = { customerId: c.id, filter: '', selected: {}, sku: {}, qty: {}, quotePrice: {}, saveAsScheme: false };
    }
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
    return '<label class="sc-plan-sku-label">规格 <select class="sc-plan-sku-select" data-action="quote-sku" data-pid="' + pid + '">' + opts + '</select></label>';
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
    const el = App.$('#quote-setup-total');
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

  function refreshQuoteSetupLines() {
    const p = ctx().quotePending;
    const el = App.$('#quote-setup-lines');
    if (!el || !p) return;
    el.innerHTML = p.lines.map((l, i) => renderQuoteLineConfigRow(l, i)).join('');
    updateQuoteSetupTotal();
    const row = App.$('#quote-save-scheme-row');
    if (row) row.classList.toggle('sc-hidden', p.sourceType !== 'direct');
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
    const setupOpen = App.$('#overlay-quote-setup') && !App.$('#overlay-quote-setup').classList.contains('sc-hidden');
    if (setupOpen) refreshQuoteSetupLines();
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

  function quoteToCartFromDraft() {
    const inp = document.getElementById('quote-filter-input');
    if (inp) ctx().quoteDraft.filter = inp.value.trim();
    if (!quoteSelectedIds().length) {
      App.toast('请至少选择一种产品');
      return;
    }
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
    const has = list.length > 0;
    let meta = '<p class="sc-card__meta">暂无本客户方案，请先完成<strong>方案速配</strong>或使用直接选品。</p>';
    if (list.length === 1) {
      meta = '<p class="sc-card__meta">当前方案 ' + App.escapeHtml(list[0].id) + '</p>';
    } else if (list.length > 1) {
      meta =
        '<p class="sc-card__meta">本客户共有 <strong>' +
        list.length +
        '</strong> 个方案，按方案报价时需先选择。</p>';
    }
    return (
      '<div class="sc-card sc-card--compact" data-spec-id="card-quote-source"><div class="sc-card__head sc-card__head--compact">产品报价 · 选择来源</div>' +
      '<div class="sc-card__actions-inline">' +
      '<button type="button" class="sc-btn sc-btn--ghost-primary" data-action="quote-from-scheme"' +
      (has ? '' : ' disabled aria-disabled="true"') +
      '>按方案报价</button>' +
      '<button type="button" class="sc-btn sc-btn--ghost-primary" data-action="quote-direct-start">直接选品报价</button></div>' +
      meta +
      '</div>'
    );
  }

  function renderQuotePickCard() {
    const d = ctx().quoteDraft;
    const c = App.getCustomer(d.customerId);
    const recs = DemoData.recommendProducts(c, d.filter);
    const recIds = new Set(recs.map((r) => r.product.id));
    const sel = d.selected || {};
    const row = (pr, tag) => {
      const on = sel[pr.id];
      const sku = on ? '<div class="sc-plan-sku-row">' + renderQuoteSkuSelect(pr, pr.id) + '</div>' : '';
      return (
        '<div class="sc-plan-pick-row' +
        (on ? ' is-selected' : '') +
        '"><button type="button" class="sc-follow-row sc-follow-row--select' +
        (on ? ' is-selected' : '') +
        '" data-action="quote-toggle" data-pid="' +
        pr.id +
        '"><span class="sc-follow-row__name">' +
        App.escapeHtml(pr.name) +
        '</span><span class="sc-follow-row__meta">' +
        App.escapeHtml(pr.spec) +
        ' ' +
        tag +
        '</span></button>' +
        sku +
        '</div>'
      );
    };
    const recRows = recs
      .map((r) =>
        row(
          r.product,
          r.score != null
            ? '<span class="sc-plan-rec-badge">匹配 ' + Math.round(r.score * 100) + '%</span>'
            : '<span class="sc-plan-rec-badge sc-plan-rec-badge--order">' + r.tag + '</span>'
        )
      )
      .join('');
    const more = DemoData.products
      .filter((pr) => !recIds.has(pr.id))
      .map((pr) => row(pr, '<span class="sc-plan-rec-badge sc-plan-rec-badge--more">全部</span>'))
      .join('');
    return (
      '<div class="sc-card sc-card--compact" data-spec-id="card-quote-pick"><div class="sc-card__head sc-card__head--compact">报价选品</div>' +
      recommendLeadHtml(c) +
      '<div class="sc-plan-filter-row"><input type="search" class="sc-input sc-input--field" id="quote-filter-input" value="' +
      App.escapeHtml(d.filter || '') +
      '"/><button type="button" class="sc-btn sc-btn--ghost" data-action="quote-filter">筛选</button></div>' +
      '<div class="sc-follow-list">' +
      (recRows || '<p class="sc-card__meta">暂无推荐</p>') +
      (more ? '<p class="sc-plan-section-label">更多</p>' + more : '') +
      '</div>' +
      '<div class="sc-card__actions-inline"><button type="button" class="sc-btn sc-btn--ghost-primary" data-action="quote-to-cart">下一步：逐项报价</button></div>' +
      '<p class="sc-card__meta sc-plan-voice-hint">可说：选品 伺服电机、逐项报价</p></div>'
    );
  }

  function refreshLastQuotePickCard() {
    const cards = document.querySelectorAll('[data-spec-id="card-quote-pick"]');
    const card = cards[cards.length - 1];
    if (card) card.outerHTML = renderQuotePickCard();
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
      desc.textContent = forOrder
        ? '直选下单须逐项填写本单报价，完成后进入订单确认。'
        : '逐项配置规格、数量与本单报价；参考最新/最低售价。';
    }
    if (totalLabel) totalLabel.textContent = forOrder ? '订单金额' : '报价合计';
    if (nextBtn) nextBtn.textContent = forOrder ? '生成订单' : '下一步：选择模板';
    if (hint) {
      hint.textContent = forOrder
        ? '可说：第一项报价 3680、齿轮箱 数量 2、生成订单'
        : '可说：第一项报价 3680、齿轮箱 数量 2、选择模板';
      hint.classList.remove('sc-hidden');
    }
    if (schemeRow) schemeRow.classList.toggle('sc-hidden', !p || p.sourceType !== 'direct' || forOrder);
  }

  function openQuoteSetupSheet() {
    const p = ctx().quotePending;
    if (!p || !p.lines.length) {
      App.toast(p && p.forOrder ? '请先选择订单产品' : '请先选择报价明细');
      return;
    }
    refreshQuoteSetupLines();
    refreshQuoteSetupChrome();
    const cb = App.$('#quote-save-scheme-sheet');
    if (cb) cb.checked = !!p.saveAsScheme;
    App.$('#overlay-quote-setup').classList.remove('sc-hidden');
  }

  function openQuoteTemplateSheet() {
    const list = App.$('#quote-template-list');
    if (list)
      list.innerHTML = DemoData.quoteTemplates
        .map(
          (t) =>
            '<label class="sc-plan-tpl-option"><input type="radio" name="quote-template" value="' +
            t.id +
            '"/><span class="sc-plan-tpl-option__name">' +
            App.escapeHtml(t.name) +
            '</span><span class="sc-plan-tpl-option__desc">' +
            App.escapeHtml(t.desc) +
            '</span></label>'
        )
        .join('');
    App.$('#overlay-quote-template').classList.remove('sc-hidden');
  }

  function saveSchemeFromPending(pending) {
    const c = App.getCustomer(pending.customerId);
    const scheme = persistScheme({
      id: 'PL' + Date.now().toString().slice(-8),
      customerId: c.id,
      templateName: '由报价保存',
      lines: pending.lines.map((l) => ({
        productId: l.productId,
        name: l.inventoryName,
        skuId: l.skuId,
        skuLabel: l.skuLabel,
        qty: l.qty
      })),
      total: 0,
      createdAt: new Date().toISOString().slice(0, 16).replace('T', ' ')
    });
    return scheme.id;
  }

  function runQuote() {
    const c = requireCustomer();
    if (!c) return;
    enterSkill('quote');
    App.pushAiHtml(
      '<p class="sc-reply-lead">为 <strong>' + App.escapeHtml(c.name) + '</strong> 报价。</p>' +
        renderQuoteSourceCard()
    );
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
      pushAiMeta('<p class="sc-card__meta">请先为 <strong>' + App.escapeHtml(c.name) + '</strong> 完成方案速配并保存方案，再使用按方案报价。</p>');
      return;
    }
    const sid = schemeId || null;
    if (!sid && list.length >= 1) {
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
    openQuoteSetupSheet();
  }

  function quoteDirectStart() {
    if (!ensureQuoteDraft()) return;
    enterSkill('quote');
    App.pushAiHtml(renderQuotePickCard());
  }

  function quoteToSetupFromDraft() {
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

  function quoteSetupNext() {
    syncQuotePendingFromDom();
    const pending = ctx().quotePending;
    if (!pending) return;
    const bad = pending.lines.find((l) => !l.quotePrice || l.quotePrice <= 0);
    if (bad) {
      App.toast('请为每项产品填写本单报价');
      return;
    }
    const saveSheet = App.$('#quote-save-scheme-sheet');
    if (pending.sourceType === 'direct' && saveSheet) pending.saveAsScheme = saveSheet.checked;
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
      App.$('#overlay-quote-setup').classList.add('sc-hidden');
      showOrderConfirm();
      return;
    }

    App.$('#overlay-quote-setup').classList.add('sc-hidden');
    openQuoteTemplateSheet();
  }

  function submitQuote() {
    const picked = document.querySelector('input[name="quote-template"]:checked');
    if (!picked) {
      App.toast('请选择报价单模板');
      return;
    }
    syncQuotePendingFromDom();
    const pending = ctx().quotePending;
    if (!pending || !pending.lines.length) {
      App.toast('报价明细为空');
      return;
    }
    publishQuoteCard(pending, picked.value);
  }

  function submitQuoteTemplate() {
    submitQuote();
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

  function ensureOrderDraft(customer) {
    const c = customer || requireCustomer();
    if (!c) return null;
    if (!ctx().orderDraft || ctx().orderDraft.customerId !== c.id) {
      ctx().orderDraft = { customerId: c.id, filter: '', selected: {}, sku: {}, qty: {}, saveAsScheme: false };
    }
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
    return '<label class="sc-plan-sku-label">SKU <select class="sc-plan-sku-select" data-action="order-sku" data-pid="' + pid + '">' + opts + '</select></label>';
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

  function orderToQuoteSetupFromDraft() {
    const inp = document.getElementById('order-filter-input');
    if (inp) ctx().orderDraft.filter = inp.value.trim();
    if (!orderSelectedIds().length) {
      App.toast('请至少选择一种产品');
      return;
    }
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
    const hasQuote = list.length > 0;
    let meta = '<p class="sc-card__meta">暂无本客户报价单，请先完成<strong>报价</strong>或使用直接选品。</p>';
    if (list.length === 1) {
      meta = '<p class="sc-card__meta">当前报价单 ' + App.escapeHtml(list[0].id) + ' · ' + fmtMoney(list[0].total) + '</p>';
    } else if (list.length > 1) {
      meta =
        '<p class="sc-card__meta">本客户共有 <strong>' +
        list.length +
        '</strong> 个报价单，按报价单下单时需先选择。</p>';
    }
    return (
      '<div class="sc-card sc-card--compact" data-spec-id="card-order-source"><div class="sc-card__head sc-card__head--compact">确认下单 · 选择来源</div>' +
      '<div class="sc-card__actions-inline">' +
      '<button type="button" class="sc-btn sc-btn--ghost-primary" data-action="order-from-quote"' + (hasQuote ? '' : ' disabled') + '>按报价单</button>' +
      '<button type="button" class="sc-btn sc-btn--ghost-primary" data-action="order-direct-start">直接选品</button></div>' +
      meta +
      '</div>'
    );
  }

  function renderOrderProductPickCard() {
    const d = ctx().orderDraft;
    const c = App.getCustomer(d.customerId);
    const recs = DemoData.recommendProducts(c, d.filter);
    const recIds = new Set(recs.map((r) => r.product.id));
    const sel = d.selected || {};
    const row = (pr, tag) => {
      const on = sel[pr.id];
      const sku = on ? '<div class="sc-plan-sku-row">' + renderOrderSkuSelect(pr, pr.id) + '</div>' : '';
      return '<div class="sc-plan-pick-row' + (on ? ' is-selected' : '') + '"><button type="button" class="sc-follow-row sc-follow-row--select' + (on ? ' is-selected' : '') + '" data-action="order-toggle" data-pid="' + pr.id + '"><span class="sc-follow-row__name">' + App.escapeHtml(pr.name) + '</span><span class="sc-follow-row__meta">' + App.escapeHtml(pr.spec) + ' ' + tag + '</span></button>' + sku + '</div>';
    };
    const recRows = recs.map((r) => row(r.product, r.score != null ? '<span class="sc-plan-rec-badge">匹配 ' + Math.round(r.score * 100) + '%</span>' : '<span class="sc-plan-rec-badge sc-plan-rec-badge--order">' + r.tag + '</span>')).join('');
    const more = DemoData.products.filter((pr) => !recIds.has(pr.id)).map((pr) => row(pr, '全部')).join('');
    return '<div class="sc-card sc-card--compact" data-spec-id="card-order-pick"><div class="sc-card__head sc-card__head--compact">订单选品</div>' + recommendLeadHtml(c) +
      '<div class="sc-plan-filter-row"><input type="search" class="sc-input sc-input--field" id="order-filter-input" value="' + App.escapeHtml(d.filter || '') + '"/><button type="button" class="sc-btn sc-btn--ghost" data-action="order-filter">筛选</button></div>' +
      '<div class="sc-follow-list">' + (recRows || '') + (more ? '<p class="sc-plan-section-label">更多</p>' + more : '') + '</div>' +
      '<label class="sc-plan-save-scheme"><input type="checkbox" id="order-save-scheme"' + (d.saveAsScheme ? ' checked' : '') + '/> 保存为方案</label>' +
      '<div class="sc-card__actions-inline"><button type="button" class="sc-btn sc-btn--ghost-primary" data-action="order-to-quote-setup">下一步：逐项报价</button></div>' +
      '<p class="sc-card__meta sc-plan-voice-hint">可说：选品 伺服电机、逐项报价、生成订单</p></div>';
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

  function createOrderFromPending(pending, c) {
    const orderNo = 'SO' + Date.now().toString().slice(-10);
    const order = { id: 'o' + Date.now(), customerId: c.id, no: orderNo, status: '待排产', statusDetail: '订单已创建，等待排产', amount: fmtMoney(pending.total), date: new Date().toISOString().slice(0, 10), items: pending.lines.map((l) => l.inventoryName + '×' + l.qty).join('、'), productIds: pending.lines.map((l) => l.productId).filter(Boolean), quoteId: pending.quoteId || null, customerName: c.name, salesperson: DemoData.salesperson, lines: pending.lines.map((l) => ({ inventoryCode: l.inventoryCode, inventoryName: l.inventoryName, inventorySpec: l.inventorySpec, salesUnit: l.salesUnit, qty: l.qty, skuLabel: l.skuLabel })) };
    DemoData.orders.unshift(order);
    return order;
  }

  function formatOrderLineSpec(line) {
    const parts = [];
    if (line.inventorySpec) parts.push(line.inventorySpec);
    if (line.skuLabel && line.skuLabel !== line.inventorySpec) parts.push(line.skuLabel);
    return parts.length ? parts.join(' · ') : '—';
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
  }

  function showOrderConfirm() {
    const pending = ctx().orderPending;
    if (!pending || !pending.lines.length) { App.toast('订单明细为空'); return; }
    const c = App.getCustomer(pending.customerId);
    const del = ctx().delivery;
    let detailMeta = pending.sourceType === 'quote' && pending.quoteId
      ? '<p class="sc-card__meta">报价 ' + App.escapeHtml(pending.quoteId) + ' · ' + fmtMoney(pending.total) + '</p>'
      : pending.sourceType === 'direct'
      ? '<p class="sc-card__meta">直选下单 · 共 ' + pending.lines.length + ' 项 · 合计 ' + fmtMoney(pending.total) + '</p>'
      : '<p class="sc-card__meta">共 ' + pending.lines.length + ' 项 · 合计 ' + fmtMoney(pending.total) + '</p>';
    App.$('#order-confirm-body').innerHTML = '<p><strong>' + App.escapeHtml(c.name) + '</strong></p>' + detailMeta + (del ? '<p class="sc-card__meta">交期：' + App.escapeHtml(del.detail) + '</p>' : '');
    App.$('#overlay-order').classList.remove('sc-hidden');
  }

  function runOrder() {
    const c = requireCustomer();
    if (!c) return;
    enterSkill('order');
    App.pushAiHtml(
      '<p class="sc-reply-lead">为 <strong>' + App.escapeHtml(c.name) + '</strong> 下单。</p>' +
        renderOrderSourceCard()
    );
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
      App.pushAiHtml('请先完成报价或使用直接选品。');
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

  function orderDirectStart() {
    if (!ensureOrderDraft()) return;
    enterSkill('order');
    App.pushAiHtml(renderOrderProductPickCard());
  }

  function orderToConfirmFromDraft() {
    orderToQuoteSetupFromDraft();
  }

  function submitOrder() {
    const pending = ctx().orderPending;
    if (!pending || !pending.lines.length) { App.toast('无订单明细'); return; }
    const c = App.getCustomer(pending.customerId);
    if (pending.saveAsScheme && pending.sourceType === 'direct') saveSchemeFromPending(pending);
    const order = createOrderFromPending(pending, c);
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

  function copyOrderToPlan(oid) {
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
    App.pushAiHtml(
      '<p class="sc-reply-lead">已按订单 <strong>' +
        o.no +
        '</strong> 带入购物车，可改 SKU 后生成方案：</p>' +
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

  function customersInEnterprise() {
    const ent = App.state.enterpriseId;
    return DemoData.customers.filter((c) => c.enterpriseId === ent);
  }

  function syncCustomerFromDemandUtterance(text) {
    if (!DemoData.tryParseCustomerDemandUtterance) return;
    const parsed = DemoData.tryParseCustomerDemandUtterance(text, customersInEnterprise());
    if (!parsed || !parsed.customer) return;
    const cur = activeCustomer();
    if (cur && cur.id === parsed.customer.id) return;
    App.state.customerId = parsed.customer.id;
    App.state.selectedFollowUpId = parsed.customer.id;
    App.saveState();
    App.refreshHeader();
  }

  const WORKFLOW_SKILL_LABELS = {
    plan: '方案速配',
    quote: '产品报价',
    order: '确认下单'
  };

  function getActiveWorkflowSkill() {
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
      return { ready: false };
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
      return { ready: false };
    }

    if (targetSkill === 'plan') {
      const schemes = schemesForCustomer(c.id);
      if (schemes.length) {
        parts.push('已有方案 ' + schemes.length + ' 份可参考');
        carry.mode = 'has-schemes';
        return { ready: true, summary: parts.join('；'), carry };
      }
      return { ready: false };
    }
    return { ready: false };
  }

  function renderCrossFunctionConfirmCard(targetSkill, assessment) {
    const label = WORKFLOW_SKILL_LABELS[targetSkill] || targetSkill;
    const current = getActiveWorkflowSkill();
    const curLabel = current ? WORKFLOW_SKILL_LABELS[current] : '当前流程';
    return (
      '<div class="sc-card sc-card--compact" data-spec-id="card-cross-skill">' +
      '<div class="sc-card__head sc-card__head--compact">切换功能</div>' +
      '<p class="sc-reply-lead">您正在 <strong>' +
      App.escapeHtml(curLabel) +
      '</strong> 中，输入将进入 <strong>' +
      App.escapeHtml(label) +
      '</strong>。</p>' +
      '<p class="sc-card__meta">当前上下文：' +
      App.escapeHtml(assessment.summary) +
      '</p>' +
      '<p class="sc-card__meta">是否使用以上信息进入 <strong>' +
      App.escapeHtml(label) +
      '</strong>？</p>' +
      '<div class="sc-card__actions-inline">' +
      '<button type="button" class="sc-btn sc-btn--primary" data-action="cross-use-context" data-target="' +
      App.escapeHtml(targetSkill) +
      '">使用当前信息</button>' +
      '<button type="button" class="sc-btn sc-btn--ghost" data-action="cross-enter-fresh" data-target="' +
      App.escapeHtml(targetSkill) +
      '">重新走流程</button>' +
      '</div></div>'
    );
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

  function executeCrossHandoffUse(target) {
    const pending = ctx().pendingCrossHandoff;
    const utterance = (pending && pending.utterance) || '';
    const carry = pending && pending.carry ? pending.carry : null;
    delete ctx().pendingCrossHandoff;
    const c = activeCustomer();
    if (!c) return;

    if (target === 'quote') {
      enterSkill('quote');
      if (carry && carry.mode === 'scheme') {
        App.pushAiHtml(
          '<p class="sc-reply-lead">已使用当前客户与方案信息，进入产品报价。</p>'
        );
        runSchemeQuoteEntry(utterance || '按方案报价');
        return;
      }
      if (carry && carry.mode === 'plan-pick') {
        copyPlanSelectionsToQuoteDraft(c);
        App.pushAiHtml(
          '<p class="sc-reply-lead">已带入方案选品至报价流程，请确认后逐项报价。</p>' +
            renderQuotePickCard()
        );
        return;
      }
      if (carry && carry.mode === 'quote-pending') {
        App.pushAiHtml('<p class="sc-reply-lead">已恢复当前报价明细，请确认后继续。</p>');
        openQuoteSetupSheet();
        return;
      }
      runQuote();
      return;
    }

    if (target === 'order') {
      enterSkill('order');
      if (carry && carry.mode === 'quote-list') {
        App.pushAiHtml('<p class="sc-reply-lead">已使用当前客户与报价单信息，进入确认下单。</p>');
        resolveOrderByQuoteUtterance(c, utterance || '按报价单下单');
        return;
      }
      if (carry && carry.mode === 'quote-pending-order') {
        const qp = ctx().quotePending;
        if (qp && qp.lines && qp.lines.length) {
          qp.forOrder = true;
          setOrderPending(qp.lines, {
            customerId: qp.customerId,
            sourceType: qp.sourceType || 'direct',
            quoteId: qp.quoteId || null,
            total: qp.total,
            saveAsScheme: false
          });
          ctx().quotePending = null;
          App.pushAiHtml('<p class="sc-reply-lead">已使用当前报价明细，打开下单确认。</p>');
          showOrderConfirm();
          return;
        }
      }
      runOrder();
      return;
    }

    if (target === 'plan') {
      enterSkill('plan');
      App.pushAiHtml('<p class="sc-reply-lead">进入方案速配。</p>');
      startPlan();
    }
  }

  function executeCrossHandoffFresh(target) {
    delete ctx().pendingCrossHandoff;
    if (target === 'quote') {
      enterSkill('quote');
      runQuote();
      return;
    }
    if (target === 'order') {
      enterSkill('order');
      runOrder();
      return;
    }
    if (target === 'plan') {
      enterSkill('plan');
      startPlan();
    }
  }

  /**
   * 跨功能：当前上下文满足目标功能时，先询问是否带入
   */
  function tryCrossFunctionHandoff(text) {
    const t = (text || '').trim();
    if (!t) return false;
    const target = detectCrossTargetSkill(t);
    const current = getActiveWorkflowSkill();
    if (!target || !current || target === current) return false;
    if (!isCrossFunctionSwitchPhrase(t, target)) return false;
    const assessment = assessContextForSkill(target);
    if (!assessment.ready) return false;

    ctx().pendingCrossHandoff = {
      utterance: t,
      targetSkill: target,
      fromSkill: current,
      carry: assessment.carry
    };
    App.pushAiHtml(renderCrossFunctionConfirmCard(target, assessment));
    if (window.Annotation && Annotation.scanHosts) window.Annotation.scanHosts();
    return true;
  }

  function tryIntent(t) {
    syncCustomerFromDemandUtterance(t);
    if (tryPlanTemplateUtterance(t)) return true;
    if (tryCrossFunctionHandoff(t)) return true;
    if (tryActivePickListUtterance(t)) return true;
    if (ctx().plan && ctx().plan.awaitingDemand) {
      enterSkill('plan');
      const text = (t || '').trim();
      if (!text) return true;
      if (tryGenerateSchemeFromDemand(text)) return true;
      return submitPlanDemand(text);
    }
    if (isOrderByQuoteEntryPhrase(t)) {
      return runOrderByQuoteEntry(t);
    }
    if (tryGenerateOrderFromDemand(t)) return true;
    if (isSchemeQuoteEntryPhrase(t)) return runSchemeQuoteEntry(t);
    if (
      /方案|配个方案|做方案|方案速配/.test(t) &&
      !isNaturalDemandText(t) &&
      !isSchemeQuoteEntryPhrase(t)
    ) {
      enterSkill('plan');
      startPlan();
      return true;
    }
    if (ctx().plan && ctx().plan.customerId && tryPlanCommand(t)) return true;
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
      if (/按方案\s*报价/.test(t)) return runSchemeQuoteEntry(t);
      enterSkill('quote');
      const c = activeCustomer() || requireCustomer('quote');
      if (!c) return true;
      runQuote();
      return true;
    }
    if (tryGenerateQuoteFromDemand(t)) return true;
    if (tryGenerateSchemeFromDemand(t)) return true;
    if (/^选品|^加购|^筛选|^过滤|^生成方案|^保存方案/.test(t)) {
      enterSkill('plan');
      if (!ctx().plan || !ctx().plan.customerId) {
        const c = ensurePlan();
        if (!c) return true;
        App.pushAiHtml(renderProductPickCard());
        schedulePlanPickLazyBind();
      }
      if (tryPlanCommand(t)) return true;
    }
    if (/报价/.test(t) && !isQuoteEntryPhrase(t) && !isSchemeQuoteEntryPhrase(t)) {
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
      if (ctx().orderDraft && ctx().orderDraft.customerId && orderSelectedIds().length) {
        orderToQuoteSetupFromDraft();
        return true;
      }
      if (ctx().quotePending && ctx().quotePending.forOrder) {
        quoteSetupNext();
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
    if (action === 'plan-demand-submit') {
      const ta = document.getElementById('plan-demand-input');
      submitPlanDemand(ta ? ta.value : '');
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
      if (card && appendMorePlanProducts(card)) bindPlanPickLazyLoad(card);
      return true;
    }
    if (action === 'plan-to-cart') {
      syncPlanFilterFromDom();
      if (!planSelectedIds().length) {
        App.toast('请至少选择一种产品');
        return true;
      }
      App.pushAiHtml(renderPlanCartCardFixed());
      return true;
    }
    if (action === 'plan-back-pick') {
      syncPlanQtyFromDom();
      App.pushAiHtml(renderProductPickCard());
      schedulePlanPickLazyBind();
      return true;
    }
    if (action === 'plan-confirm') {
      openPlanTemplateSheet();
      return true;
    }
    if (action === 'open-pdf') {
      openPdf(btn.getAttribute('data-pdf'));
      return true;
    }
    if (action === 'quote-from-scheme') {
      if (btn.disabled || btn.getAttribute('aria-disabled') === 'true') {
        const c = activeCustomer();
        if (!c) App.toast('请先选择客户');
        else
          App.pushAiHtml(
            '<p class="sc-card__meta">请先为 <strong>' +
              App.escapeHtml(c.name) +
              '</strong> 完成<strong>方案速配</strong>并保存方案。</p>'
          );
        return true;
      }
      quoteFromScheme(btn.getAttribute('data-scheme-id'));
      return true;
    }
    if (action === 'quote-pick-scheme') {
      applySchemePickById(btn.getAttribute('data-scheme-id'));
      return true;
    }
    if (action === 'quote-direct-start') {
      quoteDirectStart();
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
      refreshLastQuotePickCard();
      return true;
    }
    if (action === 'quote-to-cart') {
      quoteToCartFromDraft();
      return true;
    }
    if (action === 'quote-back-pick') {
      syncQuoteQtyFromDom();
      App.pushAiHtml(renderQuotePickCard());
      return true;
    }
    if (action === 'quote-to-setup') {
      quoteToSetupFromDraft();
      return true;
    }
    if (action === 'cross-use-context') {
      const target = btn.getAttribute('data-target');
      if (target) executeCrossHandoffUse(target);
      return true;
    }
    if (action === 'cross-enter-fresh') {
      const target = btn.getAttribute('data-target');
      if (target) executeCrossHandoffFresh(target);
      return true;
    }
    if (action === 'skill-quote') {
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
    if (action === 'order-from-quote') {
      orderFromQuote(btn.getAttribute('data-quote-id'));
      return true;
    }
    if (action === 'order-pick-quote') {
      const idx = btn.getAttribute('data-pick-index');
      if (idx) ctx()._lastPickRowIndex = parseInt(idx, 10);
      applyQuotePickById(btn.getAttribute('data-quote-id'));
      return true;
    }
    if (action === 'order-direct-start') {
      orderDirectStart();
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
      refreshLastOrderPickCard();
      return true;
    }
    if (action === 'order-to-cart' || action === 'order-to-quote-setup') {
      orderToQuoteSetupFromDraft();
      return true;
    }
    if (action === 'order-back-pick') {
      syncOrderQtyFromDom();
      App.pushAiHtml(renderOrderProductPickCard());
      return true;
    }
    if (action === 'order-to-confirm') {
      orderToConfirmFromDraft();
      return true;
    }
    if (action === 'skill-plan') {
      enterSkill('plan');
      startPlan();
      return true;
    }
    if (action === 'order-force') {
      if (ctx().orderPending) showOrderConfirm();
      else App.toast('请先选择订单来源与明细');
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

  /** tryIntent 未命中：仅识别到客户等弱意图时的补槽引导 */
  function tryGuideAfterIntentFail(text) {
    const t = (text || '').trim();
    if (!t || /帮助|能做什么/.test(t)) return false;
    if (/方案|报价|下单|跟进|待跟进|切换客户|交期|工单/.test(t)) return false;
    let parsed = null;
    if (DemoData.tryParseCustomerDemandUtterance) {
      parsed = DemoData.tryParseCustomerDemandUtterance(t, customersInEnterprise());
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
    tryGuideAfterIntentFail,
    guideMissingSlot,
    runSchemeQuoteEntry,
    runOrderByQuoteEntry,
    customerHasSchemes,
    tryPlanCommand,
    handleAction,
    utteranceFor,
    startPlan,
    submitQuote,
    submitDelivery,
    submitOrder,
    submitChange,
    submitService,
    submitPlanTemplate,
    submitQuoteTemplate,
    quoteSetupNext,
    syncQuotePendingFromDom,
    onQuoteLineSkuChange,
    refreshLastQuoteConfirmCard
  };
})();
