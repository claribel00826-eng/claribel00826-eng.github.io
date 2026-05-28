(function () {
  const TOKEN_KEY = 'sc_token';
  const STATE_KEY = 'sc_state';
  const DAILY_HOME_KEY = 'sc_daily_home';
  const CHAT_HISTORY_KEY = 'sc_chat_history';
  const CHAT_HISTORY_MAX = 200;

  let chatPersistSuspended = false;

  let state = {
    enterpriseId: 'ent-east',
    customerId: null,
    selectedFollowUpId: null,
    activeSkill: null,
    voiceSampleIdx: 0,
    ctx: {},
    flowStepId: 1
  };

  const CUSTOMER_PARTNER_TABS = [
    { id: 'both', label: '供应商/客户' },
    { id: 'customer', label: '客户' },
    { id: 'supplier', label: '供应商' }
  ];

  let customerPickerTab = 'both';
  let customerPickerQuery = '';

  const $ = (sel) => document.querySelector(sel);

  function loadState() {
    try {
      const s = JSON.parse(localStorage.getItem(STATE_KEY) || '{}');
      delete s.activeSkill;
      state = { ...state, ...s, activeSkill: null };
    } catch (_) {}
  }

  function saveState() {
    const persist = {
      enterpriseId: state.enterpriseId,
      customerId: state.customerId,
      selectedFollowUpId: state.selectedFollowUpId,
      voiceSampleIdx: state.voiceSampleIdx,
      ctx: state.ctx
    };
    localStorage.setItem(STATE_KEY, JSON.stringify(persist));
  }

  function escapeHtml(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  function getEnterprise() {
    return DemoData.enterprises.find((e) => e.id === state.enterpriseId) || DemoData.enterprises[0];
  }

  function getCustomer(id) {
    return DemoData.customers.find((c) => c.id === (id || state.customerId));
  }

  function customersForEnterprise() {
    return DemoData.customers.filter((c) => c.enterpriseId === state.enterpriseId);
  }

  /** 选客户抽屉：当前业务员老客户 + 本企业公海新客户（非企业全部档案） */
  function customersForPicker() {
    const user = DemoData.demoSalesUser || DemoData.salesperson;
    const pool = customersForEnterprise();
    if (DemoData.customersVisibleToSalesUser) {
      return DemoData.customersVisibleToSalesUser(pool, user);
    }
    return pool.filter(
      (c) => DemoData.isOldCustomer(c, user) || DemoData.isNewCustomer(c)
    );
  }

  function partnerTypeMatchesPickerTab(c, tab) {
    const pt = c.partnerType || 'customer';
    if (tab === 'customer') return pt === 'customer' || pt === 'both';
    if (tab === 'supplier') return pt === 'supplier' || pt === 'both';
    if (tab === 'both') return pt === 'both';
    return pt === tab;
  }

  function todayYmd() {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 10);
  }

  function getCustomerReminderDate(c) {
    if (!c) return '';
    const patches = state.ctx && state.ctx.customerPatches;
    if (patches && patches[c.id] && 'reminderDate' in patches[c.id]) {
      return patches[c.id].reminderDate || '';
    }
    return c.reminderDate || '';
  }

  function setCustomerReminderDate(customerId, reminderDate) {
    const c = DemoData.customers.find((x) => x.id === customerId);
    const val = (reminderDate || '').trim();
    if (c) c.reminderDate = val || null;
    if (!state.ctx.customerPatches) state.ctx.customerPatches = {};
    state.ctx.customerPatches[customerId] = {
      ...(state.ctx.customerPatches[customerId] || {}),
      reminderDate: val
    };
    saveState();
  }

  /** 未设置提醒日期 → 每日推送；已设置 → 仅当今日 ≥ 提醒日期时纳入待跟进推送 */
  function isDueForFollowUpPush(c) {
    return DemoData.isDueForFollowUpPush(c, todayYmd(), getCustomerReminderDate);
  }

  function followUps() {
    const user = DemoData.demoSalesUser || DemoData.salesperson;
    return DemoData.getTodayFollowUpCustomers(
      customersForEnterprise(),
      user,
      todayYmd(),
      getCustomerReminderDate
    ).sort((a, b) => {
      const ta = new Date(a.updatedAt || 0).getTime();
      const tb = new Date(b.updatedAt || 0).getTime();
      if (tb !== ta) return tb - ta;
      return (a.name || '').localeCompare(b.name || '', 'zh-CN');
    });
  }

  function customerTypeLabel(c) {
    if (!c || !window.DemoData) return '客户';
    if (DemoData.isOldCustomer(c, DemoData.demoSalesUser)) return '老客户';
    if (DemoData.isNewCustomer(c)) return '新客户';
    return '客户';
  }

  function customerTypeBadgeClass(c) {
    if (!c || !window.DemoData) return 'sc-badge--old';
    if (DemoData.isNewCustomer(c)) return 'sc-badge--new';
    if (DemoData.isOldCustomer(c, DemoData.demoSalesUser)) return 'sc-badge--old';
    return 'sc-badge--old';
  }

  function nowDatetimeLocal() {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  }


  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.add('is-show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove('is-show'), 2000);
  }

  function ensureDemoSession() {
    localStorage.setItem(TOKEN_KEY, '1');
  }

  function showChatView() {
    const chat = $('#view-chat');
    if (chat) chat.classList.remove('sc-hidden');
    refreshHeader();
    syncExternalTemplatePanel();
  }

  function route() {
    ensureDemoSession();
    if (!location.hash || location.hash === '#login') {
      location.hash = '#chat';
    }
    showChatView();
  }

  function bootChatSession() {
    ensureDemoSession();
    if (!location.hash || location.hash === '#login') {
      location.hash = '#chat';
    }
    route();
    initWelcome();
    refreshHeader();
    if (window.Annotation && Annotation.scanHosts) Annotation.scanHosts();
  }

  function skillNeedsCustomer(skillId) {
    if (!skillId || skillId === 'followup' || skillId === 'help') return false;
    if (skillId === 'write-follow' || skillId === 'switch-customer') return true;
    const sk = DemoData.skills.find((s) => s.id === skillId);
    if (sk && typeof sk.needsCustomer === 'boolean') return sk.needsCustomer;
    return true;
  }

  function normalizeSkillBarId(skillId) {
    return skillId === 'write-follow' ? 'followup' : skillId;
  }

  /** 已选客户且切换到不同功能时，须先确认是否保留客户 */
  function shouldConfirmSkillSwitch(skillId) {
    if (!skillId || skillId === 'switch-customer') return false;
    if (!skillNeedsCustomer(skillId)) return false;
    const c = getCustomer(state.selectedFollowUpId || state.customerId);
    if (!c) return false;
    const next = normalizeSkillBarId(skillId);
    if (state.activeSkill === next) return false;
    return true;
  }

  function closeSkillSwitchConfirm() {
    const modal = $('#skill-switch-modal');
    if (modal) modal.classList.add('sc-hidden');
    delete state.pendingSkillSwitch;
  }

  function openSkillSwitchConfirm(skillId, opts) {
    opts = opts || {};
    if (!shouldConfirmSkillSwitch(skillId) && !opts.force) return false;
    const c = getCustomer(state.selectedFollowUpId || state.customerId);
    if (!c) return false;
    const label = getSkillLabel(normalizeSkillBarId(skillId));
    state.pendingSkillSwitch = {
      skillId: skillId,
      utterance: opts.utterance || null,
      fromHandoff: !!opts.fromHandoff,
      simulateUserMsg: opts.simulateUserMsg !== false
    };
    const promptEl = $('#skill-switch-prompt');
    if (promptEl) {
      promptEl.textContent =
        '是否保留当前客户「' + c.name + '」，进入' + label + '？';
    }
    const modal = $('#skill-switch-modal');
    if (modal) modal.classList.remove('sc-hidden');
    return true;
  }

  function confirmSkillSwitchKeep() {
    const pending = state.pendingSkillSwitch;
    if (!pending) return;
    const skillId = pending.skillId;
    closeSkillSwitchConfirm();
    const workflowTarget =
      skillId === 'plan' || skillId === 'quote' || skillId === 'order' ? skillId : null;
    if (
      pending.fromHandoff &&
      workflowTarget &&
      window.Skills &&
      Skills.executeCrossHandoffUse
    ) {
      if (pending.simulateUserMsg && pending.utterance) {
        /* 话术切换时用户句已在 handleIntent 中发出 */
      }
      Skills.executeCrossHandoffUse(workflowTarget);
      return;
    }
    if (window.Skills && Skills.clearWorkflowDraftsKeepCustomer) {
      Skills.clearWorkflowDraftsKeepCustomer();
    }
    proceedSkillEntryInternal(skillId, {
      skipConfirm: true,
      skipUserMsg: pending.fromHandoff ? true : false
    });
  }

  function confirmSkillSwitchDiscard() {
    const pending = state.pendingSkillSwitch;
    if (!pending) return;
    const skillId = pending.skillId;
    closeSkillSwitchConfirm();
    state.customerId = null;
    state.selectedFollowUpId = null;
    if (window.Skills && Skills.clearWorkflowDraftsKeepCustomer) {
      Skills.clearWorkflowDraftsKeepCustomer();
    }
    saveState();
    refreshHeader();
    const workflowTarget =
      skillId === 'plan' || skillId === 'quote' || skillId === 'order' ? skillId : null;
    if (pending.fromHandoff && workflowTarget && window.Skills && Skills.executeCrossHandoffFresh) {
      Skills.executeCrossHandoffFresh(workflowTarget, { simulateUserMsg: pending.simulateUserMsg });
      return;
    }
    switchActiveSkill(normalizeSkillBarId(skillId), { skipSkillAnnounce: true });
    promptForCustomerSelection(skillId, { skipUserMsg: true });
  }

  function proceedSkillEntryInternal(skillId, opts) {
    opts = opts || {};
    const activeSkillId = normalizeSkillBarId(skillId);
    switchActiveSkill(activeSkillId, { skipSkillAnnounce: true });
    if (!skillNeedsCustomer(skillId)) {
      executeSkillAction(skillId, opts);
      return;
    }
    if (getCustomer(state.selectedFollowUpId || state.customerId)) {
      executeSkillAction(skillId, opts);
      return;
    }
    promptForCustomerSelection(skillId);
  }

  function refreshHeader() {
    const titleEl = $('#header-title');
    if (titleEl && DemoData.agentName) titleEl.textContent = DemoData.agentName;

    const skillEl = $('#header-skill');
    if (skillEl) {
      skillEl.textContent = state.activeSkill ? getSkillLabel(state.activeSkill) : '—';
    }

    const c = getCustomer();
    const nameEl = $('#header-customer-display');
    const tagsEl = $('#header-customer-tags');
    if (nameEl) {
      nameEl.textContent = c ? c.name : '未选择';
      nameEl.classList.toggle('sc-status-value--empty', !c);
    }
    if (tagsEl) {
      if (c) {
        tagsEl.innerHTML =
          '<span class="sc-tag sc-tag--category">' +
          escapeHtml(c.category) +
          '</span><span class="sc-badge ' +
          customerTypeBadgeClass(c) +
          '">' +
          customerTypeLabel(c) +
          '</span>';
        tagsEl.removeAttribute('aria-hidden');
      } else {
        tagsEl.innerHTML = '';
        tagsEl.setAttribute('aria-hidden', 'true');
      }
    }

    const clearBtn = $('#clear-customer-chat');
    if (clearBtn) {
      const hasCustomer = !!c;
      clearBtn.disabled = !hasCustomer;
      clearBtn.setAttribute('aria-disabled', hasCustomer ? 'false' : 'true');
      clearBtn.title = hasCustomer ? '清空全部对话记录' : '请先选择客户';
    }

    const switchBtn = $('#btn-switch-customer');
    if (switchBtn) {
      switchBtn.title = c ? '切换当前客户：' + c.name : '选择客户';
    }
  }

  function buildCustomerPromptHtml(skillId) {
    const sid = skillId === 'write-follow' ? 'write-follow' : skillId;
    const label = getSkillLabel(skillId === 'write-follow' ? 'followup' : skillId) || '当前操作';
    const hints = DemoData.skillCustomerOneLineHints || {};
    const oneLine = hints[sid] || hints[skillId] || '';
    let html =
      '<div class="sc-customer-prompt" data-spec-id="card-customer-prompt">' +
      '<p class="sc-reply-lead">进行 <strong>' +
      escapeHtml(label) +
      '</strong> 须先确定客户。</p>';
    if (oneLine) {
      html += '<p class="sc-card__meta sc-customer-prompt__oneliner">' + escapeHtml(oneLine) + '</p>';
    }
    html +=
      '<div class="sc-card__actions-inline">' +
      '<button type="button" class="sc-btn sc-btn--primary" data-action="open-customer-sheet">选择客户</button>' +
      '</div></div>';
    return html;
  }

  function buildSwitchCustomerPromptHtml() {
    return (
      '<div class="sc-customer-prompt" data-spec-id="card-customer-prompt">' +
      '<p class="sc-reply-lead">请指定要服务的客户。</p>' +
      '<div class="sc-card__actions-inline">' +
      '<button type="button" class="sc-btn sc-btn--primary" data-action="open-customer-sheet">选择客户</button>' +
      '</div></div>'
    );
  }

  function executeSkillAction(skillId, opts) {
    opts = opts || {};
    if (skillId === 'switch-customer') return;
    if (skillId === 'scheme-quote') {
      const ctx = state.ctx || (state.ctx = {});
      const utterance = ctx.pendingSchemeQuoteUtterance || '按方案报价';
      delete ctx.pendingSchemeQuoteUtterance;
      if (!opts.skipUserMsg) {
        pushUserMsg(utterance);
      }
      setTimeout(() => {
        if (window.Skills && Skills.runSchemeQuoteEntry) Skills.runSchemeQuoteEntry(utterance);
      }, opts.delayMs != null ? opts.delayMs : 300);
      return;
    }
    if (skillId === 'order-by-quote') {
      const ctx = state.ctx || (state.ctx = {});
      const utterance = ctx.pendingOrderByQuoteUtterance || '按报价单下单';
      delete ctx.pendingOrderByQuoteUtterance;
      if (!opts.skipUserMsg) {
        pushUserMsg(utterance);
      }
      setTimeout(() => {
        if (window.Skills && Skills.runOrderByQuoteEntry) Skills.runOrderByQuoteEntry(utterance);
      }, opts.delayMs != null ? opts.delayMs : 300);
      return;
    }
    if (skillId === 'followup') {
      if (!opts.skipUserMsg) requestFollowUpListByClick();
      else {
        setTimeout(replyWithFollowUpList, opts.delayMs != null ? opts.delayMs : 300);
      }
      return;
    }
    if (skillId === 'write-follow') {
      const c = getCustomer(state.selectedFollowUpId || state.customerId);
      if (!opts.skipUserMsg) {
        pushUserMsg(
          (DemoData.skillUtterances && DemoData.skillUtterances['write-follow']) || '写跟进'
        );
      }
      if (!c) return;
      setTimeout(
        () => openFollowSheet(c, state.pendingFollowFormSlots || {}),
        opts.delayMs != null ? opts.delayMs : 300
      );
      if (state.pendingFollowFormSlots) delete state.pendingFollowFormSlots;
      return;
    }
    const utter =
      (DemoData.skillUtterances && DemoData.skillUtterances[skillId]) || getSkillLabel(skillId);
    if (!opts.skipUserMsg) pushUserMsg(utter);
    setTimeout(() => {
      if (window.Skills) Skills.run(skillId);
    }, opts.delayMs != null ? opts.delayMs : 300);
  }

  function resumePendingSkillRun() {
    const skillId = state.pendingSkillRun;
    if (!skillId) return;
    delete state.pendingSkillRun;
    executeSkillAction(skillId, { skipUserMsg: true });
  }

  function tryMatchCustomerByName(text) {
    const q = (text || '').trim();
    if (!q) return null;
    const items = customersForPicker();
    if (window.DemoData && DemoData.findCustomersByQuery) {
      const hits = DemoData.findCustomersByQuery(q, items);
      return hits.length === 1 ? hits[0] : null;
    }
    if (window.DemoData && DemoData.findCustomerByQuery) {
      return DemoData.findCustomerByQuery(q, items);
    }
    const lower = q.toLowerCase();
    return (
      items.find((c) => c.name === q) ||
      items.find((c) => c.name.toLowerCase().includes(lower)) ||
      items.find((c) => (c.code && c.code.toLowerCase().includes(lower)))
    );
  }

  function isWriteFollowIntent(text) {
    const t = (text || '').trim();
    if (!t) return false;
    if (/写跟进|记录跟进|录入跟进|记一下跟进/.test(t)) return true;
    return /给.+写跟进|为.+写跟进|帮.+?(?:写|记|录).*?跟进/.test(t);
  }

  function tryMatchCustomerFromUtterance(text) {
    const t = (text || '').trim();
    if (!t) return null;
    const items = customersForEnterprise()
      .slice()
      .sort((a, b) => (b.name || '').length - (a.name || '').length);
    for (let i = 0; i < items.length; i++) {
      if (t.indexOf(items[i].name) >= 0) return items[i];
    }
    const m = t.match(/(?:给|为|帮)(.+?)(?:写跟进|记录跟进|记一下跟进|录入跟进)/);
    if (m && m[1]) {
      return tryMatchCustomerByName(m[1].trim());
    }
    return null;
  }

  /** 从话术/语音解析写跟进表单填槽（联系人等仍由主数据带入） */
  function parseWriteFollowSlots(text) {
    const t = (text || '').trim();
    const slots = {
      customer: tryMatchCustomerFromUtterance(t),
      content: '',
      status: 'ongoing'
    };
    if (/跟进完成|已完成跟进|跟进结束了|标记完成/.test(t)) {
      slots.status = 'done';
    }

    const afterIntent = t.match(/(?:写跟进|记录跟进|录入跟进|记一下跟进)\s*[,，：:]\s*(.+)/);
    if (afterIntent && afterIntent[1]) {
      slots.content = afterIntent[1].trim();
      return slots;
    }

    const afterIntentNoSep = t.match(/(?:写跟进|记录跟进|录入跟进|记一下跟进)\s+(.+)/);
    if (afterIntentNoSep && afterIntentNoSep[1]) {
      const rest = afterIntentNoSep[1].trim();
      if (rest.length >= 2) slots.content = rest;
    }

    if (!slots.content) {
      let rest = t;
      if (slots.customer) rest = rest.split(slots.customer.name).join('');
      rest = rest
        .replace(/(?:给|为|帮)[^，,：:]*?(?:写跟进|记录跟进|录入跟进|记一下跟进)/, '')
        .replace(/写跟进|记录跟进|录入跟进|记一下跟进/g, '')
        .replace(/跟进完成|已完成跟进|跟进结束了|标记完成/g, '')
        .replace(/^[,，：:\s]+|[,，：:\s]+$/g, '');
      if (rest.length >= 2) slots.content = rest;
    }

    return slots;
  }

  function stashWriteFollowFormSlots(slots) {
    if (!slots) return;
    if (slots.content || slots.status === 'done') {
      state.pendingFollowFormSlots = {
        content: slots.content || '',
        status: slots.status || 'ongoing'
      };
    } else {
      delete state.pendingFollowFormSlots;
    }
  }

  function openFollowSheetWithPrefill(c, opts) {
    opts = opts || {};
    const delay = opts.delayMs != null ? opts.delayMs : 0;
    const run = () => {
      const prefill = state.pendingFollowFormSlots || opts.prefill || {};
      const hadVoiceContent = !!(opts.fromVoice && prefill.content);
      if (state.pendingFollowFormSlots) delete state.pendingFollowFormSlots;
      openFollowSheet(c, prefill);
      if (hadVoiceContent) {
        pushAiHtml('已根据语音填入跟进信息，请核对联系人、时间与内容后提交。', { samePage: true });
        scrollMessages();
        persistChatHistory();
      }
    };
    if (delay) setTimeout(run, delay);
    else run();
  }

  function handleWriteFollowIntent(text, opts) {
    opts = opts || {};
    switchActiveSkill('followup', { skipSkillAnnounce: true });
    const delay = opts.delayMs != null ? opts.delayMs : 300;
    const fromSpeech = opts.fromVoice === true;
    const slots = parseWriteFollowSlots(text);
    stashWriteFollowFormSlots(slots);

    const matched = slots.customer;
    if (matched) {
      switchCustomer(matched.id, { skipCustomerAnnounce: fromSpeech });
      openFollowSheetWithPrefill(matched, { delay: delay, fromVoice: fromSpeech });
      return;
    }
    const cur = getCustomer(state.selectedFollowUpId || state.customerId);
    if (cur) {
      openFollowSheetWithPrefill(cur, { delay: delay, fromVoice: fromSpeech });
      return;
    }
    promptForCustomerSelection('write-follow', { skipUserMsg: true, delayMs: delay });
  }

  function promptForCustomerSelection(skillId, opts) {
    opts = opts || {};
    state.pendingSkillRun = skillId;
    const skillName = getSkillLabel(skillId === 'write-follow' ? 'followup' : skillId);
    if (!opts.skipUserMsg) {
      const utter =
        (DemoData.skillUtterances && DemoData.skillUtterances[skillId]) || skillName;
      pushUserMsg(utter);
    }
    const delay = opts.delayMs != null ? opts.delayMs : 300;
    setTimeout(() => {
      pushAiHtml(buildCustomerPromptHtml(skillId));
      scrollMessages();
      persistChatHistory();
      if (window.Annotation && Annotation.scanHosts) Annotation.scanHosts();
    }, delay);
  }

  function runSkillEntry(skillId, opts) {
    opts = opts || {};
    if (!skillId) return;
    closeOverlays();
    if (skillId !== 'write-follow') {
      const sk = DemoData.skills.find((s) => s.id === skillId);
      if (sk && !sk.enabled) {
        toast('该能力即将开放');
        return;
      }
    }
    if (!opts.skipConfirm && openSkillSwitchConfirm(skillId, opts)) {
      return;
    }
    proceedSkillEntryInternal(skillId, opts);
  }

  function getLocalDateKey() {
    const d = new Date();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + m + '-' + day;
  }

  function getDailyHomeStore() {
    try {
      return JSON.parse(localStorage.getItem(DAILY_HOME_KEY) || '{}');
    } catch (_) {
      return {};
    }
  }

  function saveDailyHomeStore(store) {
    localStorage.setItem(DAILY_HOME_KEY, JSON.stringify(store));
  }

  function needsDailyHomeScreen() {
    const store = getDailyHomeStore();
    return store[state.enterpriseId] !== getLocalDateKey();
  }

  function markDailyHomeScreenDone() {
    const store = getDailyHomeStore();
    store[state.enterpriseId] = getLocalDateKey();
    saveDailyHomeStore(store);
  }

  function clearDailyHomeMarker(enterpriseId) {
    const store = getDailyHomeStore();
    delete store[enterpriseId || state.enterpriseId];
    saveDailyHomeStore(store);
  }

  function partnerTypeLabel(c) {
    const tab = CUSTOMER_PARTNER_TABS.find((t) => t.id === c.partnerType);
    return tab ? tab.label : '客户';
  }

  function filteredCustomersForPicker() {
    const q = (customerPickerQuery || '').trim();
    const tab = customerPickerTab;
    const matchFn = window.DemoData && DemoData.customerMatchesQuery;
    const scoreFn = window.DemoData && DemoData.customerSearchScore;
    const items = customersForPicker().filter((c) => {
      if (!partnerTypeMatchesPickerTab(c, tab)) return false;
      if (!q) return true;
      if (matchFn) return DemoData.customerMatchesQuery(c, q);
      const lower = q.toLowerCase();
      return (
        c.name.toLowerCase().includes(lower) ||
        (c.code && c.code.toLowerCase().includes(lower))
      );
    });
    if (!q || !scoreFn) return items;
    return items.slice().sort((a, b) => DemoData.customerSearchScore(b, q) - DemoData.customerSearchScore(a, q));
  }

  function getLatestFlowCard(specId) {
    const cards = document.querySelectorAll('#messages [data-spec-id="' + specId + '"]');
    return cards.length ? cards[cards.length - 1] : null;
  }

  function isLatestFlowCardActive(specId) {
    const card = getLatestFlowCard(specId);
    if (!card) return false;
    const msg = card.closest('.sc-msg');
    if (!msg) return true;
    return msg.dataset.flowStep === String(state.flowStepId);
  }

  function buildCustomerListHtml(items) {
    if (!items.length) {
      return '<p class="sc-card__meta sc-card__empty-hint">无匹配客户，请调整筛选条件</p>';
    }
    return items
      .map(function (c) {
        return (
          '<button type="button" class="sc-list-item sc-list-item--customer' +
          (c.id === state.customerId ? ' sc-list-item--active' : '') +
          '" data-action="pick-customer" data-cid="' +
          escapeHtml(c.id) +
          '"><span class="sc-list-item__main"><span class="sc-list-item__name">' +
          escapeHtml(c.name) +
          '</span><span class="sc-list-item__sub">' +
          escapeHtml(c.code) +
          ' · ' +
          escapeHtml(c.category) +
          '</span></span><span class="sc-badge ' +
          customerTypeBadgeClass(c) +
          '">' +
          customerTypeLabel(c) +
          '</span></button>'
        );
      })
      .join('');
  }

  function renderCustomerPickCardHtml() {
    const tabs = CUSTOMER_PARTNER_TABS.map(function (chip) {
      return (
        '<button type="button" class="sc-filter-chip' +
        (customerPickerTab === chip.id ? ' sc-filter-chip--active' : '') +
        '" data-action="customer-tab" data-tab="' +
        escapeHtml(chip.id) +
        '" role="tab" aria-selected="' +
        (customerPickerTab === chip.id ? 'true' : 'false') +
        '">' +
        escapeHtml(chip.label) +
        '</button>'
      );
    }).join('');
    const items = filteredCustomersForPicker();
    return (
      '<div class="sc-card sc-card--compact sc-card--inline-form" data-spec-id="sheet-customer">' +
      '<div class="sc-card__head sc-card__head--compact">切换客户</div>' +
      '<input type="search" class="sc-search sc-card__search" data-action="customer-search" value="' +
      escapeHtml(customerPickerQuery) +
      '" placeholder="模糊搜索名称、编码（支持不连续关键字）" autocomplete="off" />' +
      '<div class="sc-filter-row" role="tablist" aria-label="往来单位类型">' +
      tabs +
      '</div>' +
      '<div class="sc-customer-list sc-customer-list--card">' +
      buildCustomerListHtml(items) +
      '</div></div>'
    );
  }

  function refreshLastCustomerPickCard() {
    const cards = document.querySelectorAll('[data-spec-id="sheet-customer"]');
    const card = cards[cards.length - 1];
    if (card) card.outerHTML = renderCustomerPickCardHtml();
    if (window.Annotation && Annotation.scanHosts) window.Annotation.scanHosts();
  }

  function renderFollowFormCardHtml(c, prefill) {
    prefill = prefill || {};
    const reminder =
      prefill.reminderDate != null ? prefill.reminderDate : getCustomerReminderDate(c);
    const statusDone = prefill.status === 'done';
    return (
      '<div class="sc-card sc-card--compact sc-card--inline-form" data-spec-id="sheet-followup" data-follow-cid="' +
      escapeHtml(c.id) +
      '">' +
      '<div class="sc-card__head sc-card__head--compact">写跟进 — ' +
      escapeHtml(c.name) +
      '</div>' +
      '<div class="sc-form-scroll sc-form-scroll--card">' +
      '<label class="sc-field-label">联系人</label>' +
      '<input class="sc-input sc-input--field" data-field="follow-contact-name" type="text" value="' +
      escapeHtml(c.contactName || '') +
      '" placeholder="联系人姓名" />' +
      '<label class="sc-field-label">联系方式</label>' +
      '<input class="sc-input sc-input--field" data-field="follow-contact-phone" type="tel" value="' +
      escapeHtml(c.contactPhone || '') +
      '" placeholder="手机或电话" />' +
      '<label class="sc-field-label">发货地址</label>' +
      '<input class="sc-input sc-input--field" data-field="follow-ship-address" type="text" value="' +
      escapeHtml(c.shipAddress || '') +
      '" placeholder="发货地址" />' +
      '<label class="sc-field-label">跟进信息</label>' +
      '<textarea class="sc-textarea" data-field="follow-content" placeholder="请输入跟进内容…">' +
      escapeHtml(prefill.content || '') +
      '</textarea>' +
      '<label class="sc-field-label">跟进时间</label>' +
      '<input class="sc-input sc-input--field" data-field="follow-time" type="datetime-local" value="' +
      escapeHtml(nowDatetimeLocal()) +
      '" />' +
      '<label class="sc-field-label">跟进状态</label>' +
      '<select class="sc-input sc-input--field" data-field="follow-status">' +
      '<option value="ongoing"' +
      (statusDone ? '' : ' selected') +
      '>跟进中</option>' +
      '<option value="done"' +
      (statusDone ? ' selected' : '') +
      '>跟进完成</option></select>' +
      '<label class="sc-field-label">提醒日期</label>' +
      '<input class="sc-input sc-input--field" data-field="follow-reminder-date" type="date" value="' +
      escapeHtml(reminder || '') +
      '" />' +
      '</div>' +
      '<div class="sc-card__actions-inline"><button type="button" class="sc-btn sc-btn--primary" data-action="follow-submit">提交</button></div>' +
      '</div>'
    );
  }

  function renderEnterprisePickCardHtml() {
    const rows = DemoData.enterprises
      .map(function (e) {
        return (
          '<button type="button" class="sc-list-item' +
          (e.id === state.enterpriseId ? ' sc-list-item--active' : '') +
          '" data-action="pick-enterprise" data-eid="' +
          escapeHtml(e.id) +
          '">' +
          escapeHtml(e.name) +
          '</button>'
        );
      })
      .join('');
    return (
      '<div class="sc-card sc-card--compact sc-card--inline-form" data-spec-id="sheet-enterprise">' +
      '<div class="sc-card__head sc-card__head--compact">切换企业</div>' +
      '<div class="sc-enterprise-list">' +
      rows +
      '</div></div>'
    );
  }

  function submitFollowFromCard(card) {
    if (!card) return;
    const name = (card.querySelector('[data-field="follow-contact-name"]') || {}).value || '';
    const phone = (card.querySelector('[data-field="follow-contact-phone"]') || {}).value || '';
    const addr = (card.querySelector('[data-field="follow-ship-address"]') || {}).value || '';
    const content = (card.querySelector('[data-field="follow-content"]') || {}).value || '';
    const time = (card.querySelector('[data-field="follow-time"]') || {}).value || '';
    const reminderDate =
      (card.querySelector('[data-field="follow-reminder-date"]') || {}).value || '';
    const statusEl = card.querySelector('[data-field="follow-status"]');
    const statusLabel = statusEl
      ? statusEl.options[statusEl.selectedIndex].text
      : '跟进中';
    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();
    const trimmedContent = content.trim();
    if (!trimmedName || !trimmedPhone) {
      toast('请填写联系人和联系方式');
      return;
    }
    if (!trimmedContent) {
      toast('请填写跟进信息');
      return;
    }
    if (!time) {
      toast('请选择跟进时间');
      return;
    }
    const cid = card.getAttribute('data-follow-cid') || state._followCustomerId || state.customerId;
    const c = getCustomer(cid);
    if (c) {
      setCustomerReminderDate(c.id, reminderDate);
      if (DemoData.isNewCustomer(c)) {
        c.latestFollowStatus = statusEl && statusEl.value === 'done' ? 'done' : 'ongoing';
      }
    }
    const reminderNote = reminderDate
      ? '提醒日期：' + reminderDate + '（自该日起推送待跟进）'
      : '提醒日期：未设置（每个工作日推送待跟进）';
    pushUserMsg('已提交跟进记录');
    setTimeout(function () {
      pushAiHtml(
        '已为 <strong>' +
          escapeHtml(c ? c.name : '该企业') +
          '</strong> 记录跟进（' +
          escapeHtml(statusLabel) +
          '）。<br><span style="font-size:12px;color:#71717A">' +
          escapeHtml(trimmedContent) +
          '</span><br><span style="font-size:12px;color:#71717A">' +
          escapeHtml(reminderNote) +
          '</span>'
      );
    }, 200);
  }

  function renderCustomerCategoryFilters() {
    const row = $('#customer-category-filters');
    if (!row) return;
    row.innerHTML = '';
    CUSTOMER_PARTNER_TABS.forEach((chip) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className =
        'sc-filter-chip' + (customerPickerTab === chip.id ? ' sc-filter-chip--active' : '');
      b.textContent = chip.label;
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', customerPickerTab === chip.id ? 'true' : 'false');
      b.onclick = () => {
        customerPickerTab = chip.id;
        renderCustomerCategoryFilters();
        renderCustomerPickerList();
      };
      row.appendChild(b);
    });
  }

  function renderCustomerPickerList() {
    const list = $('#customer-list');
    const empty = $('#customer-list-empty');
    if (!list) return;
    const items = filteredCustomersForPicker();
    list.innerHTML = '';
    if (!items.length) {
      if (empty) empty.classList.remove('sc-hidden');
      return;
    }
    if (empty) empty.classList.add('sc-hidden');
    items.forEach((c) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className =
        'sc-list-item sc-list-item--customer' +
        (c.id === state.customerId ? ' sc-list-item--active' : '');
      btn.innerHTML =
        '<span class="sc-list-item__main">' +
        '<span class="sc-list-item__name">' +
        escapeHtml(c.name) +
        '</span>' +
        '<span class="sc-list-item__sub">' +
        escapeHtml(c.code) +
        ' · ' +
        escapeHtml(c.category) +
        '</span></span>' +
        '<span class="sc-badge ' +
        customerTypeBadgeClass(c) +
        '">' +
        customerTypeLabel(c) +
        '</span>';
      btn.onclick = () => {
        closeOverlays();
        switchCustomer(c.id, { fromPicker: true });
      };
      list.appendChild(btn);
    });
  }

  function getSkillLabel(skillId) {
    if (skillId === 'scheme-quote') return '按方案报价';
    if (skillId === 'order-by-quote') return '按报价单下单';
    const sk = DemoData.skills.find((s) => s.id === skillId);
    return sk ? sk.name : skillId;
  }

  function pushCustomerSwitchPrompt(c) {
    pushSystem('已切换当前客户：' + c.name + '（' + customerTypeLabel(c) + '）。');
  }

  function scrollActiveSkillIntoView() {
    const bar = $('#skill-bar');
    if (!bar || !state.activeSkill) return;
    const active = bar.querySelector('.sc-skill--active');
    if (active && typeof active.scrollIntoView === 'function') {
      active.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
    }
  }

  function disableFlowControlsInRow(row) {
    if (!row) return;
    row.querySelectorAll('[data-action]').forEach((el) => {
      if (el.tagName === 'BUTTON' || el.classList.contains('sc-follow-row')) {
        el.disabled = true;
        el.setAttribute('aria-disabled', 'true');
        el.classList.add('is-flow-stale');
      }
    });
  }

  function invalidateFlowStep(stepId) {
    document
      .querySelectorAll('#messages .sc-msg[data-flow-step="' + stepId + '"]')
      .forEach((row) => disableFlowControlsInRow(row));
  }

  /** 弹出新消息卡片时：失效当前消息卡片，消息卡片序号加一（首屏合包、同卡片内补充说明不调用） */
  function advanceFlowPage() {
    const stepToInvalidate = state.flowStepId || 1;
    invalidateFlowStep(String(stepToInvalidate));
    state.flowStepId = stepToInvalidate + 1;
  }

  function currentFlowStepId() {
    return state.flowStepId || 1;
  }

  function stampFlowStep(row) {
    if (row && row.classList && row.classList.contains('sc-msg')) {
      row.dataset.flowStep = String(currentFlowStepId());
    }
  }

  function resetFlowState() {
    state.flowStepId = 1;
  }

  function switchActiveSkill(skillId, opts) {
    opts = opts || {};
    if (skillId === undefined) return;
    const next = skillId || null;
    const changed = state.activeSkill !== next;
    state.activeSkill = next;
    saveState();
    renderSkills();
    refreshHeader();
    scrollActiveSkillIntoView();
    if (changed && next && !opts.skipSkillAnnounce) {
      pushSystem('已切换当前功能：' + getSkillLabel(next) + '。');
    }
  }

  function switchCustomer(cid, opts) {
    opts = opts || {};
    const c = getCustomer(cid);
    if (!c) return;
    const changed = state.customerId !== cid;
    state.customerId = cid;
    state.selectedFollowUpId = cid;
    saveState();
    refreshHeader();
    if (changed && !opts.skipCustomerAnnounce) {
      pushCustomerSwitchPrompt(c);
    }
    if (opts.fromPicker && state.pendingSkillRun) {
      resumePendingSkillRun();
    }
    if (opts.showDetail) {
      pushAiHtml(renderFollowUpDetailCard(c));
      pushAiHtml(renderNextStepCard(cid));
    }
  }

  function scrollMessages() {
    const box = $('#messages');
    box.scrollTop = box.scrollHeight;
  }

  function getActiveCustomerScopeId() {
    return state.customerId || state.selectedFollowUpId || null;
  }

  function getActiveCustomerId() {
    return getActiveCustomerScopeId();
  }

  function stampCustomerScope(el) {
    const cid = getActiveCustomerScopeId();
    if (cid && el) el.dataset.customerId = cid;
  }

  function readCustomerScopeFromNode(node) {
    if (!node || !(node instanceof HTMLElement)) return null;
    return node.dataset.customerId || null;
  }

  function getChatHistoryStore() {
    try {
      return JSON.parse(localStorage.getItem(CHAT_HISTORY_KEY) || '{}');
    } catch (_) {
      return {};
    }
  }

  function saveChatHistoryStore(store) {
    localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(store));
  }

  function serializeChatMessages() {
    const box = $('#messages');
    if (!box) return [];
    const items = [];
    box.childNodes.forEach((node) => {
      if (!(node instanceof HTMLElement)) return;
      if (node.classList.contains('sc-system')) {
        items.push({
          type: 'system',
          text: node.textContent || '',
          customerId: readCustomerScopeFromNode(node)
        });
        return;
      }
      if (node.classList.contains('sc-msg--user')) {
        const bubble = node.querySelector('.sc-bubble--user');
        items.push({
          type: 'user',
          text: bubble ? bubble.textContent : '',
          customerId: readCustomerScopeFromNode(node)
        });
        return;
      }
      if (node.classList.contains('sc-msg')) {
        const bubble = node.querySelector('.sc-bubble--ai');
        items.push({
          type: 'ai',
          html: bubble ? bubble.innerHTML : '',
          customerId: readCustomerScopeFromNode(node),
          flowStep: node.dataset.flowStep || '',
          homeScreen: node.dataset.homeScreen === '1'
        });
      }
    });
    return items.slice(-CHAT_HISTORY_MAX);
  }

  function persistChatHistory(enterpriseId) {
    if (chatPersistSuspended) return;
    const entId = enterpriseId || state.enterpriseId;
    if (!entId) return;
    const store = getChatHistoryStore();
    store[entId] = serializeChatMessages();
    saveChatHistoryStore(store);
  }

  function clearAllChatHistory() {
    localStorage.removeItem(CHAT_HISTORY_KEY);
  }

  function clearChatHistoryAll() {
    if (!getCustomer()) return;
    if (
      !window.confirm(
        '确定清空全部对话记录？\n将删除欢迎区、待跟进摘要、最近访问及本会话内所有消息（含本地缓存）。'
      )
    ) {
      return;
    }
    const box = $('#messages');
    if (!box) return;
    chatPersistSuspended = true;
    box.innerHTML = '';
    delete box.dataset.inited;
    resetFlowState();
    chatPersistSuspended = false;
    const store = getChatHistoryStore();
    store[state.enterpriseId] = [];
    saveChatHistoryStore(store);
    scrollMessages();
    if (window.Annotation && Annotation.scanHosts) Annotation.scanHosts();
    toast('已清空全部对话记录');
  }

  function restoreChatHistory() {
    const box = $('#messages');
    if (!box) return false;
    const items = getChatHistoryStore()[state.enterpriseId];
    if (!items || !items.length) return false;

    chatPersistSuspended = true;
    box.innerHTML = '';
    items.forEach((item) => {
      if (item.type === 'system') {
        const p = document.createElement('p');
        p.className = 'sc-system';
        p.textContent = item.text || '';
        if (item.customerId) p.dataset.customerId = item.customerId;
        box.appendChild(p);
      } else if (item.type === 'user') {
        const wrap = document.createElement('div');
        wrap.className = 'sc-msg sc-msg--user';
        if (item.customerId) wrap.dataset.customerId = item.customerId;
        wrap.innerHTML =
          '<div class="sc-bubble sc-bubble--user" data-spec-id="chat-bubble-user">' +
          escapeHtml(item.text || '') +
          '</div>';
        box.appendChild(wrap);
      } else if (item.type === 'ai') {
        const row = document.createElement('div');
        row.className = 'sc-msg';
        if (item.flowStep) row.dataset.flowStep = item.flowStep;
        if (item.homeScreen) row.dataset.homeScreen = '1';
        if (item.customerId) row.dataset.customerId = item.customerId;
        row.innerHTML =
          '<div class="sc-bubble sc-bubble--ai">' +
          (item.html || '') +
          '</div>';
        box.appendChild(row);
      }
    });
    chatPersistSuspended = false;
    let maxStep = 1;
    document.querySelectorAll('#messages .sc-msg[data-flow-step]').forEach((row) => {
      const n = parseInt(row.dataset.flowStep, 10);
      if (!isNaN(n) && n > maxStep) maxStep = n;
    });
    document.querySelectorAll('#messages .sc-msg[data-flow-step]').forEach((row) => {
      const n = parseInt(row.dataset.flowStep, 10);
      if (!isNaN(n) && n < maxStep) disableFlowControlsInRow(row);
    });
    state.flowStepId = maxStep + 1;
    bindRecentHandlers();
    scrollMessages();
    if (window.Annotation && Annotation.scanHosts) Annotation.scanHosts();
    return true;
  }

  function pushSystem(text) {
    const p = document.createElement('p');
    p.className = 'sc-system';
    p.textContent = text;
    stampCustomerScope(p);
    $('#messages').appendChild(p);
    scrollMessages();
    persistChatHistory();
  }

  function pushUserMsg(text) {
    const wrap = document.createElement('div');
    wrap.className = 'sc-msg sc-msg--user';
    wrap.innerHTML =
      '<div class="sc-bubble sc-bubble--user" data-spec-id="chat-bubble-user">' +
      escapeHtml(text) +
      '</div>';
    stampCustomerScope(wrap);
    $('#messages').appendChild(wrap);
    scrollMessages();
    persistChatHistory();
  }

  function pushAiHtml(html, opts) {
    opts = opts || {};
    if (!opts.samePage) advanceFlowPage();
    const row = document.createElement('div');
    row.className = 'sc-msg';
    row.innerHTML =
      '<div class="sc-bubble sc-bubble--ai">' + html + '</div>';
    stampFlowStep(row);
    stampCustomerScope(row);
    $('#messages').appendChild(row);
    scrollMessages();
    persistChatHistory();
  }

  function renderTemplateFollowupCard() {
    const n = followUps().length;
    const t = DemoData.templateFollowup || {};
    return (
      '<div class="sc-card sc-card--template" data-spec-id="card-template-followup">' +
      '<span class="sc-template-msg__channel">' +
      escapeHtml(t.channel || '服务号消息') +
      '</span>' +
      '<p class="sc-template-msg__title">' +
      escapeHtml(t.title || '今日待跟进提醒') +
      '</p>' +
      '<p class="sc-template-msg__body">' +
      escapeHtml(t.bodyPrefix || '您有') +
      ' <strong>' +
      n +
      '</strong> ' +
      escapeHtml(t.bodySuffix || '家企业待跟进，请及时跟进。') +
      '</p>' +
      '<button type="button" class="sc-btn sc-btn--primary sc-template-msg__btn" data-action="template-followup">' +
      escapeHtml(t.button || '查看待跟进列表') +
      '</button></div>'
    );
  }

  function syncExternalTemplatePanel() {
    const shell = $('#demo-shell');
    const panel = $('#wx-service-panel');
    const mount = $('#wx-template-mount');
    if (!shell || !panel || !mount) return;
    shell.classList.add('sc-demo--tpl');
    panel.classList.remove('sc-hidden');
    mount.innerHTML = renderTemplateFollowupCard();
    if (window.Annotation && Annotation.scanHosts) Annotation.scanHosts();
  }

  function handleTemplateFollowupFromWx() {
    ensureDemoSession();
    location.hash = '#chat';
    route();
    initWelcome();
    refreshHeader();
    requestFollowUpListByClick();
  }

  function initWxTemplatePanel() {
    const panel = $('#wx-service-panel');
    if (!panel || panel.dataset.bound) return;
    panel.dataset.bound = '1';
    panel.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action="template-followup"]');
      if (!btn) return;
      e.preventDefault();
      handleTemplateFollowupFromWx();
    });
  }

  function renderFollowUpSummary() {
    const n = followUps().length;
    return `
      <div class="sc-card sc-card--summary" data-spec-id="card-followup-summary" data-followup-summary>
        <button type="button" class="sc-follow-summary" data-action="expand-followup">
          <span class="sc-follow-summary__main">
            <span class="sc-follow-summary__label">今日待跟进</span>
            <span class="sc-follow-summary__count">${n} 家企业</span>
          </span>
          <span class="sc-follow-summary__hint">点击查看列表</span>
          <span class="sc-follow-summary__chevron" aria-hidden="true">›</span>
        </button>
      </div>`;
  }

  function renderFollowUpListRows() {
    return followUps()
      .map(
        (c) => `
        <button type="button" class="sc-follow-row sc-follow-row--select" data-action="select-followup" data-cid="${c.id}">
          <span class="sc-follow-row__name">${escapeHtml(c.name)}</span>
          <span class="sc-badge ${customerTypeBadgeClass(c)}">${customerTypeLabel(c)}</span>
        </button>`
      )
      .join('');
  }

  function renderFollowUpCard() {
    const n = followUps().length;
    return `
      <div class="sc-card sc-card--compact" data-spec-id="card-followup-list" data-followup-expanded>
        <div class="sc-card__head sc-card__head--compact">今日待跟进 · ${n} 家</div>
        <div class="sc-follow-list">${renderFollowUpListRows()}</div>
      </div>`;
  }

  function renderDetailField(label, value) {
    return (
      '<div class="sc-detail-item">' +
      '<span class="sc-detail-label">' +
      escapeHtml(label) +
      '</span>' +
      '<span class="sc-detail-value">' +
      escapeHtml(value || '—') +
      '</span></div>'
    );
  }

  function renderFollowUpDetailCard(c) {
    const contactLine = [c.contactName, c.contactPhone, c.contactAddress].filter(Boolean).join(' · ');
    return `
      <div class="sc-card sc-card--detail" data-spec-id="card-customer-detail">
        <div class="sc-card__head sc-card__head--compact sc-card__head--detail">
          <span>企业详情</span>
          <span class="sc-badge ${customerTypeBadgeClass(c)}">${customerTypeLabel(c)}</span>
        </div>
        <div class="sc-detail-grid">
          ${renderDetailField('编码', c.code)}
          ${renderDetailField('名称', c.name)}
          ${renderDetailField('性质', c.nature)}
          ${renderDetailField('客户性质', c.category)}
          ${renderDetailField('结算客户', c.settlementCustomer)}
          ${renderDetailField('客户等级', c.level ? c.level + ' 级' : '—')}
          ${renderDetailField('联系人地址', contactLine)}
        </div>
      </div>`;
  }

  function replyWithFollowUpList() {
    const n = followUps().length;
    pushAiHtml(
      '<p class="sc-reply-lead">好的，今日共有 <strong>' +
        n +
        '</strong> 家企业待跟进，请选择：</p>' +
        renderFollowUpCard()
    );
  }

  function requestFollowUpListByClick() {
    switchActiveSkill('followup', { skipSkillAnnounce: true });
    pushUserMsg('今日待跟进');
    setTimeout(replyWithFollowUpList, 300);
  }

  function buildWelcomeFeatureGridHtml() {
    const items = DemoData.welcomeFeatures || [];
    if (!items.length) return '';
    let html =
      '<div class="sc-feature-grid" data-spec-id="chat-welcome-features" role="group" aria-label="快捷功能">';
    items.forEach((item) => {
      html +=
        '<button type="button" class="sc-feature-chip" data-action="welcome-feature" data-skill-id="' +
        escapeHtml(item.id) +
        '">' +
        escapeHtml(item.label) +
        '</button>';
    });
    html += '</div>';
    return html;
  }

  /** 欢迎区功能格：与底部 Skill 同路由，直达对应功能模式 */
  function triggerWelcomeFeature(skillId) {
    if (!skillId) return;
    if (skillId === 'help') {
      closeOverlays();
      switchActiveSkill(null, { skipSkillAnnounce: true });
      pushUserMsg((DemoData.skillUtterances && DemoData.skillUtterances.help) || '帮助');
      setTimeout(() => pushAiHtml(DemoData.welcomeHelp), 300);
      return;
    }
    if (skillId === 'switch-customer') {
      closeOverlays();
      switchActiveSkill(null, { skipSkillAnnounce: true });
      pushUserMsg(
        (DemoData.skillUtterances && DemoData.skillUtterances['switch-customer']) || '切换客户'
      );
      state.pendingSkillRun = 'switch-customer';
      setTimeout(() => {
        pushAiHtml(buildSwitchCustomerPromptHtml());
        scrollMessages();
        persistChatHistory();
        if (window.Annotation && Annotation.scanHosts) Annotation.scanHosts();
      }, 300);
      return;
    }
    if (skillId === 'write-follow') {
      switchActiveSkill('followup', { skipSkillAnnounce: true });
      runSkillEntry('write-follow');
      return;
    }
    runSkillEntry(skillId);
  }

  function renderNextStepCard(cid) {
    return `
      <div class="sc-card sc-card--next" data-spec-id="card-next-step">
        <p class="sc-next-steps__title">接下来您想做什么？</p>
        <div class="sc-next-steps__btns">
          <button type="button" class="sc-btn sc-btn--ghost-primary" data-action="next-step" data-step="follow" data-cid="${cid}">写跟进</button>
          <button type="button" class="sc-btn sc-btn--ghost" data-action="next-step" data-step="plan" data-cid="${cid}">做方案</button>
          <button type="button" class="sc-btn sc-btn--ghost" data-action="next-step" data-step="later" data-cid="${cid}">稍后再说</button>
        </div>
      </div>`;
  }

  function selectFollowUpTarget(cid) {
    const c = getCustomer(cid);
    if (!c) return;
    pushUserMsg('选择客户 ' + c.name);
    switchCustomer(cid, { showDetail: true });
  }

  function applyRecentVisit(customerId, skillId) {
    const c = getCustomer(customerId);
    if (!c || c.enterpriseId !== state.enterpriseId) return;
    skillId = skillId || 'followup';

    switchCustomer(customerId);
    switchActiveSkill(skillId);

    const utter =
      (DemoData.skillUtterances && DemoData.skillUtterances[skillId]) || getSkillLabel(skillId);
    pushUserMsg(utter);

    setTimeout(() => {
      if (skillId === 'followup') {
        pushAiHtml(renderFollowUpDetailCard(c));
        pushAiHtml(renderNextStepCard(customerId));
      } else if (window.Skills) {
        Skills.run(skillId);
      }
    }, 300);
  }

  function onMessagesClick(e) {
    const recentBtn = e.target.closest('[data-recent-cid]');
    if (recentBtn) {
      e.preventDefault();
      applyRecentVisit(
        recentBtn.getAttribute('data-recent-cid'),
        recentBtn.getAttribute('data-recent-skill')
      );
      return;
    }
    onMessageClick(e);
  }

  function onMessageClick(e) {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    if (btn.disabled || btn.classList.contains('is-flow-stale')) {
      toast('该消息卡片已过期，请使用最新消息卡片中的操作');
      return;
    }
    const action = btn.getAttribute('data-action');
    if (window.Skills && Skills.handleAction(action, btn)) return;
    if (action === 'open-customer-sheet') {
      openCustomerSheet();
      return;
    }
    if (action === 'pick-customer') {
      switchCustomer(btn.getAttribute('data-cid'), { fromPicker: true });
      return;
    }
    if (action === 'customer-tab') {
      customerPickerTab = btn.getAttribute('data-tab') || 'both';
      refreshLastCustomerPickCard();
      return;
    }
    if (action === 'pick-enterprise') {
      const eid = btn.getAttribute('data-eid');
      const ent = DemoData.enterprises.find(function (e) {
        return e.id === eid;
      });
      if (!ent) return;
      const prevEnt = state.enterpriseId;
      if (ent.id === prevEnt) return;
      persistChatHistory(prevEnt);
      state.enterpriseId = ent.id;
      const c = getCustomer();
      if (c && c.enterpriseId !== ent.id) {
        state.customerId = null;
        state.selectedFollowUpId = null;
      }
      saveState();
      refreshHeader();
      const box = $('#messages');
      delete box.dataset.sessionReady;
      loadChatForEnterprise();
      syncExternalTemplatePanel();
      box.dataset.sessionReady = '1';
      pushSystem('已切换企业：' + ent.name + '。请重新选择客户。');
      return;
    }
    if (action === 'follow-submit') {
      submitFollowFromCard(btn.closest('[data-spec-id="sheet-followup"]'));
      return;
    }
    if (action === 'welcome-feature') {
      triggerWelcomeFeature(btn.getAttribute('data-skill-id'));
      return;
    }
    if (action === 'template-followup') {
      requestFollowUpListByClick();
      return;
    }
    if (action === 'expand-followup') {
      requestFollowUpListByClick();
      return;
    }
    if (action === 'select-followup') {
      selectFollowUpTarget(btn.getAttribute('data-cid'));
      return;
    }
    const cid = btn.getAttribute('data-cid');
    if (action === 'next-step') {
      const step = btn.getAttribute('data-step');
      const c = getCustomer(cid);
      if (!c) return;
      if (step === 'follow') {
        pushUserMsg(
          (DemoData.skillUtterances && DemoData.skillUtterances['write-follow']) || '写跟进'
        );
        switchActiveSkill('followup', { skipSkillAnnounce: true });
        openFollowSheet(c);
      } else if (step === 'plan') {
        pushUserMsg(
          (DemoData.skillUtterances && DemoData.skillUtterances.plan) || '配个方案'
        );
        switchActiveSkill('plan', { skipSkillAnnounce: true });
        Skills.startPlan(c);
      } else if (step === 'later') {
        pushAiHtml('好的，需要时随时说客户名称或点待跟进继续。', { samePage: true });
      }
      return;
    }
  }

  function showFollowUpList() {
    replyWithFollowUpList();
  }

  function handleIntent(text, opts) {
    opts = opts || {};
    const t = text.trim();
    if (!t) return;
    if (!opts.skipUserMsg) pushUserMsg(t);
    if (state.pendingSkillRun) {
      const pendingSkill = state.pendingSkillRun;
      const pool = customersForPicker();
      const resolved =
        DemoData.resolveCustomerUtterance &&
        DemoData.resolveCustomerUtterance(t, pool);
      if (resolved && resolved.status === 'ambiguous') {
        setTimeout(() => {
          openCustomerSheet(resolved.query);
          pushAiHtml(
            '<p class="sc-card__meta">「' +
              escapeHtml(resolved.query) +
              '」匹配到多家客户，请在列表中确认。</p>'
          );
          scrollMessages();
          persistChatHistory();
          if (window.Annotation && Annotation.scanHosts) Annotation.scanHosts();
        }, 300);
        return;
      }
      const matched =
        resolved && resolved.status === 'unique'
          ? resolved.customer
          : tryMatchCustomerByName(t);
      if (matched) {
        delete state.pendingSkillRun;
        switchCustomer(matched.id, {
          fromPicker: false,
          skipCustomerAnnounce: !!(resolved && resolved.status === 'unique')
        });
        const demand =
          resolved &&
          resolved.demandText &&
          resolved.demandText.trim().length >= 6
            ? resolved.demandText.trim()
            : '';
        if (demand && window.Skills && Skills.tryIntent(demand)) {
          return;
        }
        setTimeout(
          () => executeSkillAction(pendingSkill, { skipUserMsg: true }),
          300
        );
        return;
      }
      setTimeout(() => {
        pushAiHtml(
          '未找到「' +
            escapeHtml(t) +
            '」。请核对客户名称，或点击上方对话中的「选择客户」按钮从列表中选择。'
        );
        scrollMessages();
        persistChatHistory();
      }, 300);
      return;
    }
    if (/待跟进|跟进哪些|今天要跟/.test(t)) {
      switchActiveSkill('followup', { skipSkillAnnounce: true });
      setTimeout(showFollowUpList, 300);
      return;
    }
    if (isWriteFollowIntent(t)) {
      handleWriteFollowIntent(t, { delayMs: 300, fromVoice: false });
      return;
    }
    if (/切换客户|换客户|选择客户|选客户/.test(t)) {
      switchActiveSkill(null, { skipSkillAnnounce: true });
      state.pendingSkillRun = 'switch-customer';
      setTimeout(() => {
        pushAiHtml(buildSwitchCustomerPromptHtml());
        scrollMessages();
        persistChatHistory();
        if (window.Annotation && Annotation.scanHosts) Annotation.scanHosts();
      }, 300);
      return;
    }
    if (window.Skills && Skills.tryIntent(t)) return;
    if (window.Skills && Skills.tryGuideAfterIntentFail && Skills.tryGuideAfterIntentFail(t)) return;
    if (/帮助|能做什么/.test(t)) {
      setTimeout(() => pushAiHtml(DemoData.welcomeHelp), 300);
      return;
    }
    setTimeout(() => {
      pushAiHtml(
        '我可以帮你：<strong>待跟进</strong>、<strong>方案速配</strong>、<strong>报价</strong>、<strong>交期</strong>、<strong>下单</strong>、查进度与客服。试试底部 Skill 或说「配个方案」。'
      );
    }, 300);
  }

  function openFollowSheet(c, prefill) {
    prefill = prefill || {};
    state._followCustomerId = c.id;
    pushAiHtml(renderFollowFormCardHtml(c, prefill));
    if (window.Annotation && Annotation.scanHosts) window.Annotation.scanHosts();
  }

  function closeOverlays() {
    const pdf = $('#pdf-modal');
    if (pdf) pdf.classList.add('sc-hidden');
    document.body.classList.remove('sc-pdf-open');
  }

  function openCustomerSheet(prefillQuery) {
    if (prefillQuery != null) customerPickerQuery = String(prefillQuery);
    else customerPickerQuery = '';
    customerPickerTab = 'both';
    pushAiHtml(renderCustomerPickCardHtml());
    if (window.Annotation && Annotation.scanHosts) window.Annotation.scanHosts();
  }

  function openEnterpriseSheet() {
    pushAiHtml(renderEnterprisePickCardHtml());
    if (window.Annotation && Annotation.scanHosts) window.Annotation.scanHosts();
  }

  function renderSkills() {
    const bar = $('#skill-bar');
    bar.innerHTML = '';
    DemoData.skills.forEach((sk) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className =
        'sc-skill' + (state.activeSkill && state.activeSkill === sk.id ? ' sc-skill--active' : '');
      b.textContent = sk.name;
      b.onclick = () => runSkillEntry(sk.id);
      bar.appendChild(b);
    });
  }

  function buildRecentSectionHtml() {
    let html =
      '<div class="sc-welcome-section" data-spec-id="chat-recent"><p class="sc-welcome-section__title">最近访问</p><div class="sc-recent-inline">';
    DemoData.recentCustomers.forEach((r) => {
      const c = getCustomer(r.customerId);
      if (!c || c.enterpriseId !== state.enterpriseId) return;
      const skillId = r.skillId || 'followup';
      const skillName = getSkillLabel(skillId);
      html +=
        '<button type="button" class="sc-recent-item" data-recent-cid="' +
        escapeHtml(c.id) +
        '" data-recent-skill="' +
        escapeHtml(skillId) +
        '">' +
        '<span class="sc-recent-item__row">' +
        '<span class="sc-recent-item__customer">' +
        escapeHtml(c.name) +
        '</span>' +
        '<span class="sc-recent-item__skill">' +
        escapeHtml(skillName) +
        '</span></span>' +
        '<span class="sc-recent-item__time">' +
        escapeHtml(r.label || '') +
        '</span></button>';
    });
    html += '</div></div>';
    return html;
  }

  function bindRecentHandlers() {
    /* 最近访问点击由 #messages 事件委托处理（onMessagesClick） */
  }

  /** 首屏欢迎 + 待跟进摘要 + 最近访问：合并为一条助手消息（同一 flowStep） */
  function createHomeScreenRows() {
    const bundleHtml =
      '<div class="sc-home-bundle">' +
      '<div class="sc-welcome-block" data-spec-id="chat-welcome">' +
      '<p class="sc-welcome-block__lead">' +
      escapeHtml(DemoData.welcomeAi) +
      '</p>' +
      buildWelcomeFeatureGridHtml() +
      '</div>' +
      renderFollowUpSummary() +
      buildRecentSectionHtml() +
      '</div>';
    const row = document.createElement('div');
    row.className = 'sc-msg';
    row.dataset.homeScreen = '1';
    row.dataset.flowStep = '1';
    row.innerHTML =
      '<div class="sc-bubble sc-bubble--ai sc-bubble--home">' + bundleHtml + '</div>';
    return [row];
  }

  function insertHomeScreenMessages(box, mode) {
    const rows = createHomeScreenRows();
    chatPersistSuspended = true;
    if (mode === 'prepend') {
      rows.reverse().forEach((row) => box.insertBefore(row, box.firstChild));
    } else {
      rows.forEach((row) => box.appendChild(row));
    }
    chatPersistSuspended = false;
  }

  function seedWelcomeMessages() {
    const box = $('#messages');
    if (box.dataset.inited) return;
    box.dataset.inited = '1';
    insertHomeScreenMessages(box, 'append');
    bindRecentHandlers();
    scrollMessages();
    persistChatHistory();
    if (window.Annotation && Annotation.scanHosts) Annotation.scanHosts();
  }

  function prependDailyHomeScreen(box) {
    insertHomeScreenMessages(box, 'prepend');
    bindRecentHandlers();
    scrollMessages();
    persistChatHistory();
    if (window.Annotation && Annotation.scanHosts) Annotation.scanHosts();
  }

  function loadChatForEnterprise() {
    const box = $('#messages');
    box.innerHTML = '';
    delete box.dataset.inited;
    resetFlowState();
    const hadHistory = restoreChatHistory();
    if (needsDailyHomeScreen()) {
      if (hadHistory) {
        prependDailyHomeScreen(box);
      } else {
        seedWelcomeMessages();
      }
      markDailyHomeScreenDone();
    } else if (!hadHistory) {
      seedWelcomeMessages();
    } else {
      box.dataset.inited = '1';
    }
  }

  function ensureChatSession() {
    const box = $('#messages');
    if (box.dataset.sessionReady === '1') return;
    box.dataset.sessionReady = '1';
    loadChatForEnterprise();
    syncExternalTemplatePanel();
  }

  function initWelcome() {
    ensureChatSession();
  }

  function resetChat() {
    clearAllChatHistory();
    clearDailyHomeMarker();
    const box = $('#messages');
    delete box.dataset.inited;
    delete box.dataset.sessionReady;
    loadChatForEnterprise();
    box.dataset.sessionReady = '1';
    syncExternalTemplatePanel();
  }

  /** 演示：恢复为登录后首屏（欢迎区 + 待跟进摘要 + 最近访问），等同重新登录 */
  function resetPageToInitial() {
    closeOverlays();
    const pdf = $('#pdf-modal');
    if (pdf) pdf.classList.add('sc-hidden');
    document.body.classList.remove('sc-pdf-open');

    state.enterpriseId = 'ent-east';
    state.customerId = null;
    state.selectedFollowUpId = null;
    state.activeSkill = null;
    state.voiceSampleIdx = 0;
    state.ctx = {};
    delete state._followCustomerId;
    delete state.pendingSkillRun;
    delete state.pendingFollowFormSlots;
    resetFlowState();
    saveState();

    const composer = $('#composer');
    if (composer) composer.classList.remove('is-text');
    const textInput = $('#text-input');
    if (textInput) textInput.value = '';

    localStorage.setItem(TOKEN_KEY, '1');
    location.hash = '#chat';
    route();
    resetChat();
    refreshHeader();
    if (window.Annotation && Annotation.scanHosts) Annotation.scanHosts();
    toast('已恢复为初始状态');
  }

  function initDemoReset() {
    const btn = $('#btn-demo-reset');
    if (!btn || btn.dataset.bound) return;
    btn.dataset.bound = '1';
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      resetPageToInitial();
    });
  }

  function initChat() {
    const clearCustomerBtn = $('#clear-customer-chat');
    if (clearCustomerBtn) {
      clearCustomerBtn.onclick = (e) => {
        e.stopPropagation();
        if (clearCustomerBtn.disabled) return;
        clearChatHistoryAll();
      };
    }
    $('#messages').addEventListener('click', onMessagesClick);

    renderSkills();

    function bindVoiceHoldButton(btn, getTranscript, onDone) {
      if (!btn) return;
      let busy = false;
      function endVoice() {
        if (!btn.classList.contains('is-recording') || busy) return;
        busy = true;
        btn.classList.remove('is-recording');
        btn.textContent = '按住 说话';
        const t = (getTranscript() || '').trim();
        if (t) onDone(t);
        setTimeout(() => {
          busy = false;
        }, 400);
      }
      btn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        btn.classList.add('is-recording');
        btn.textContent = '松开 结束';
      });
      btn.addEventListener('touchend', endVoice);
      btn.addEventListener('mousedown', () => {
        btn.classList.add('is-recording');
        btn.textContent = '松开 结束';
      });
      btn.addEventListener('mouseup', endVoice);
    }

    const voice = $('#voice-btn');
    bindVoiceHoldButton(
      voice,
      () => {
        const sample = DemoData.voiceSamples[state.voiceSampleIdx % DemoData.voiceSamples.length];
        state.voiceSampleIdx++;
        return sample;
      },
      (t) => {
        pushUserMsg(t);
        if (isWriteFollowIntent(t)) {
          handleWriteFollowIntent(t, { delayMs: 300, fromVoice: true });
        } else {
          handleIntent(t, { skipUserMsg: true });
        }
      }
    );

    $('#mode-toggle').onclick = () => $('#composer').classList.toggle('is-text');

    const textInput = $('#text-input');
    const sendBtn = $('#send-btn');
    function sendTextMessage() {
      const t = (textInput && textInput.value ? textInput.value : '').trim();
      if (!t) return;
      if (textInput) textInput.value = '';
      $('#composer').classList.remove('is-text');
      handleIntent(t);
    }
    if (sendBtn) sendBtn.onclick = sendTextMessage;
    if (textInput) {
      textInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          sendTextMessage();
        }
      });
    }

    $('#messages').addEventListener('input', function (e) {
      const inp = e.target.closest('[data-action="customer-search"]');
      if (!inp) return;
      customerPickerQuery = inp.value;
      refreshLastCustomerPickCard();
    });

    $('#pdf-close').onclick = () => {
      $('#pdf-modal').classList.add('sc-hidden');
      document.body.classList.remove('sc-pdf-open');
    };
    const pdfDownload = $('#pdf-download');
    if (pdfDownload) {
      pdfDownload.onclick = () => {
        if (window.Skills && Skills.downloadPdfDocument) Skills.downloadPdfDocument();
      };
    }
    const pdfForward = $('#pdf-forward');
    if (pdfForward) {
      pdfForward.onclick = () => {
        if (window.Skills && Skills.forwardPdfDocument) Skills.forwardPdfDocument();
      };
    }

    const btnSwitchCustomer = $('#btn-switch-customer');
    if (btnSwitchCustomer) {
      btnSwitchCustomer.onclick = () => openCustomerSheet();
    }

    const skillSwitchKeep = $('#skill-switch-keep');
    if (skillSwitchKeep) skillSwitchKeep.onclick = () => confirmSkillSwitchKeep();
    const skillSwitchDiscard = $('#skill-switch-discard');
    if (skillSwitchDiscard) skillSwitchDiscard.onclick = () => confirmSkillSwitchDiscard();

    document.addEventListener('change', (e) => {
      const skuSel = e.target.closest('[data-action="quote-sku"]');
      if (skuSel && window.Skills) Skills.handleAction('quote-sku', skuSel);
      const quoteLineSku = e.target.closest('[data-action="quote-line-sku"]');
      if (quoteLineSku && window.Skills && Skills.onQuoteLineSkuChange) Skills.onQuoteLineSkuChange(quoteLineSku);
      const copyLineSku = e.target.closest('[data-action="copy-line-sku"]');
      if (copyLineSku && window.Skills && Skills.onCopyLineSkuChange) Skills.onCopyLineSkuChange(copyLineSku);
      const orderSku = e.target.closest('[data-action="order-sku"]');
      if (orderSku && window.Skills) Skills.handleAction('order-sku', orderSku);
      const quoteLineProcess = e.target.closest('[data-action="quote-line-process"]');
      if (quoteLineProcess && window.Skills && Skills.syncQuotePendingFromDom) Skills.syncQuotePendingFromDom();
      const copyLineProcess = e.target.closest('[data-action="copy-line-process"]');
      if (copyLineProcess && window.Skills && Skills.syncOrderCopyLinesFromDom) Skills.syncOrderCopyLinesFromDom();
      const sel = e.target.closest('[data-action="plan-sku"]');
      if (sel && window.Skills) Skills.handleAction('plan-sku', sel);
      const planQty = e.target.closest('[data-action="plan-qty"]');
      if (planQty && window.Skills && Skills.syncPlanQtyFromDom) Skills.syncPlanQtyFromDom();
      const quoteQty = e.target.closest('[data-action="quote-qty"]');
      if (quoteQty && window.Skills && Skills.syncQuoteQtyFromDom) Skills.syncQuoteQtyFromDom();
      const orderQty = e.target.closest('[data-action="order-qty"]');
      if (orderQty && window.Skills && Skills.syncOrderQtyFromDom) Skills.syncOrderQtyFromDom();
    });

    document.addEventListener('input', (e) => {
      if (
        e.target.closest('[data-action="quote-line-price"]') ||
        e.target.closest('[data-action="quote-line-qty"]') ||
        e.target.closest('[data-action="quote-line-tax"]')
      ) {
        if (window.Skills && Skills.syncQuotePendingFromDom) Skills.syncQuotePendingFromDom();
      }
      if (
        e.target.closest('[data-action="copy-line-price"]') ||
        e.target.closest('[data-action="copy-line-qty"]') ||
        e.target.closest('[data-action="copy-line-tax"]')
      ) {
        if (window.Skills && Skills.syncOrderCopyLinesFromDom) Skills.syncOrderCopyLinesFromDom();
      }
      if (e.target.closest('[data-action="plan-qty"]') && window.Skills && Skills.syncPlanQtyFromDom) {
        Skills.syncPlanQtyFromDom();
      }
      if (e.target.closest('[data-action="quote-qty"]') && window.Skills && Skills.syncQuoteQtyFromDom) {
        Skills.syncQuoteQtyFromDom();
      }
      if (e.target.closest('[data-action="order-qty"]') && window.Skills && Skills.syncOrderQtyFromDom) {
        Skills.syncOrderQtyFromDom();
      }
    });

    Skills.init({
      state,
      saveState,
      refreshHeader,
      getCustomer,
      pushAiHtml,
      pushUserMsg,
      $,
      escapeHtml,
      toast,
      closeOverlays,
      requestFollowUpListByClick,
      promptForCustomerSelection,
      skillNeedsCustomer,
      openCustomerSheet,
      switchActiveSkill,
      openSkillSwitchConfirm,
      isLatestFlowCardActive,
      getLatestFlowCard
    });
  }

  function init() {
    loadState();
    if (!state.ctx) state.ctx = {};
    initChat();
    window.addEventListener('hashchange', () => {
      route();
      if (location.hash === '#chat') {
        initWelcome();
        refreshHeader();
        if (window.Annotation && Annotation.scanHosts) Annotation.scanHosts();
      }
    });
    window.addEventListener('pageshow', (e) => {
      route();
      if (e.persisted) {
        const box = $('#messages');
        if (box) delete box.dataset.sessionReady;
        initWelcome();
        refreshHeader();
      }
      if (window.Annotation && Annotation.scanHosts) Annotation.scanHosts();
    });
    window.addEventListener('pagehide', () => {
      persistChatHistory();
    });
    route();
    bootChatSession();
    syncExternalTemplatePanel();
    initWxTemplatePanel();
    initDemoReset();
    if (window.Annotation) Annotation.init();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
