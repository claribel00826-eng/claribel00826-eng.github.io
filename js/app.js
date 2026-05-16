(function () {
  const TOKEN_KEY = 'sc_token';
  const STATE_KEY = 'sc_state';
  const CHAT_HISTORY_KEY = 'sc_chat_history';
  const DAILY_HOME_KEY = 'sc_daily_home';
  const CHAT_HISTORY_MAX = 200;

  let chatPersistSuspended = false;

  let state = {
    enterpriseId: 'ent-east',
    customerId: null,
    selectedFollowUpId: null,
    activeSkill: null,
    voiceSampleIdx: 0,
    ctx: {}
  };

  const CUSTOMER_PARTNER_TABS = [
    { id: 'customer', label: '客户' },
    { id: 'supplier', label: '供应商' },
    { id: 'both', label: '供应商/客户' }
  ];

  let customerPickerTab = 'customer';

  const $ = (sel) => document.querySelector(sel);

  function loadState() {
    try {
      const s = JSON.parse(localStorage.getItem(STATE_KEY) || '{}');
      state = { ...state, ...s };
    } catch (_) {}
  }

  function saveState() {
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
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

  function followUps() {
    return customersForEnterprise()
      .slice()
      .sort((a, b) => {
        const ta = new Date(a.updatedAt || 0).getTime();
        const tb = new Date(b.updatedAt || 0).getTime();
        if (tb !== ta) return tb - ta;
        return (a.name || '').localeCompare(b.name || '', 'zh-CN');
      });
  }

  function customerTypeLabel(c) {
    return c.customerType === 'new' ? '新客户' : '老客户';
  }

  function customerTypeBadgeClass(c) {
    return c.customerType === 'new' ? 'sc-badge--new' : 'sc-badge--old';
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

  function refreshHeader() {
    const titleEl = $('#header-title');
    if (titleEl && DemoData.agentName) titleEl.textContent = DemoData.agentName;
    const c = getCustomer();
    const nameEl = $('#current-customer-name');
    const tagsEl = $('#current-customer-tags');
    const barBtn = $('#header-customer');
    if (c) {
      nameEl.textContent = c.name;
      tagsEl.innerHTML =
        '<span class="sc-tag sc-tag--category">' +
        escapeHtml(c.category) +
        '</span><span class="sc-badge ' +
        customerTypeBadgeClass(c) +
        '">' +
        customerTypeLabel(c) +
        '</span>';
      barBtn.title = c.name + ' · ' + c.category + '（点击切换）';
      barBtn.classList.add('sc-current-customer__btn--selected');
    } else {
      nameEl.textContent = '请选择客户';
      tagsEl.innerHTML = '';
      barBtn.title = '点击选择当前服务的客户';
      barBtn.classList.remove('sc-current-customer__btn--selected');
    }
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
    const q = ($('#customer-search').value || '').trim().toLowerCase();
    const tab = customerPickerTab;
    return customersForEnterprise().filter((c) => {
      if ((c.partnerType || 'customer') !== tab) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        (c.code && c.code.toLowerCase().includes(q))
      );
    });
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
      empty.classList.remove('sc-hidden');
      return;
    }
    empty.classList.add('sc-hidden');
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

  function switchActiveSkill(skillId, opts) {
    opts = opts || {};
    if (!skillId) return;
    const changed = state.activeSkill !== skillId;
    state.activeSkill = skillId;
    saveState();
    renderSkills();
    scrollActiveSkillIntoView();
    if (changed && !opts.skipSkillAnnounce) {
      pushSystem('已切换当前功能：' + getSkillLabel(skillId) + '。');
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
          customerId: readCustomerScopeFromNode(node)
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
        if (item.customerId) row.dataset.customerId = item.customerId;
        row.innerHTML =
          '<div class="sc-bubble sc-bubble--ai">' +
          (item.html || '') +
          '</div>';
        box.appendChild(row);
      }
    });
    chatPersistSuspended = false;
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

  function pushAiHtml(html) {
    const row = document.createElement('div');
    row.className = 'sc-msg';
    row.innerHTML =
      '<div class="sc-bubble sc-bubble--ai">' + html + '</div>';
    stampCustomerScope(row);
    $('#messages').appendChild(row);
    scrollMessages();
    persistChatHistory();
  }

  function isDemoPagesHost() {
    return /\.github\.io$/i.test(location.hostname);
  }

  function isTemplateFollowupEntry() {
    const params = new URLSearchParams(location.search);
    if (params.get('tpl') === 'off') return false;
    return true;
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
    if (!isTemplateFollowupEntry()) {
      shell.classList.remove('sc-demo--tpl');
      panel.classList.add('sc-hidden');
      mount.innerHTML = '';
      return;
    }
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
    pushUserMsg('今日待跟进');
    setTimeout(replyWithFollowUpList, 300);
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
    const action = btn.getAttribute('data-action');
    if (window.Skills && Skills.handleAction(action, btn)) return;
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
        openFollowSheet(c);
      } else if (step === 'plan') {
        Skills.startPlan(c);
      } else if (step === 'later') {
        pushAiHtml('好的，需要时随时说客户名称或点待跟进继续。');
      }
      return;
    }
  }

  function showFollowUpList() {
    replyWithFollowUpList();
  }

  function handleIntent(text) {
    const t = text.trim();
    if (!t) return;
    pushUserMsg(t);
    if (/待跟进|跟进哪些|今天要跟/.test(t)) {
      setTimeout(showFollowUpList, 300);
      return;
    }
    if (/写跟进|记录跟进/.test(t)) {
      const c = getCustomer(state.selectedFollowUpId || state.customerId);
      if (!c) {
        setTimeout(() => {
          pushAiHtml('请先从今日待跟进列表选择一家企业。');
        }, 300);
        return;
      }
      setTimeout(() => openFollowSheet(c), 300);
      return;
    }
    if (/切换客户|换客户|选择客户|选客户/.test(t)) {
      setTimeout(openCustomerSheet, 200);
      return;
    }
    if (window.Skills && Skills.tryIntent(t)) return;
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

  function openFollowSheet(c) {
    $('#sheet-follow-title').textContent = '写跟进 — ' + c.name;
    $('#follow-contact-name').value = c.contactName || '';
    $('#follow-contact-phone').value = c.contactPhone || '';
    $('#follow-ship-address').value = c.shipAddress || '';
    $('#follow-content').value = '';
    $('#follow-time').value = nowDatetimeLocal();
    $('#follow-status').value = 'ongoing';
    $('#overlay-follow').classList.remove('sc-hidden');
    state._followCustomerId = c.id;
  }

  function closeOverlays() {
    document.querySelectorAll('.sc-overlay').forEach((o) => o.classList.add('sc-hidden'));
  }

  function openCustomerSheet() {
    customerPickerTab = 'customer';
    const search = $('#customer-search');
    if (search) search.value = '';
    renderCustomerCategoryFilters();
    renderCustomerPickerList();
    $('#overlay-customer').classList.remove('sc-hidden');
    if (search) setTimeout(() => search.focus(), 200);
  }

  function openEnterpriseSheet() {
    const list = $('#enterprise-list');
    list.innerHTML = '';
    DemoData.enterprises.forEach((e) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'sc-list-item' + (e.id === state.enterpriseId ? ' sc-list-item--active' : '');
      btn.textContent = e.name;
      btn.onclick = () => {
        const prevEnt = state.enterpriseId;
        if (e.id === prevEnt) {
          closeOverlays();
          return;
        }
        persistChatHistory(prevEnt);
        state.enterpriseId = e.id;
        const c = getCustomer();
        if (c && c.enterpriseId !== e.id) {
          state.customerId = null;
          state.selectedFollowUpId = null;
        }
        saveState();
        refreshHeader();
        closeOverlays();
        const box = $('#messages');
        delete box.dataset.sessionReady;
        loadChatForEnterprise();
        syncExternalTemplatePanel();
        box.dataset.sessionReady = '1';
        pushSystem('已切换企业：' + e.name + '。请重新选择客户。');
      };
      list.appendChild(btn);
    });
    $('#overlay-enterprise').classList.remove('sc-hidden');
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
      b.onclick = () => {
        if (!sk.enabled) {
          toast('该能力即将开放');
          return;
        }
        switchActiveSkill(sk.id);
        const utter = (DemoData.skillUtterances && DemoData.skillUtterances[sk.id]) || sk.name;
        if (sk.id === 'followup') {
          requestFollowUpListByClick();
          return;
        }
        pushUserMsg(utter);
        Skills.run(sk.id);
      };
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

  function createHomeScreenRows() {
    const welcomeHtml =
      '<div class="sc-welcome-block" data-spec-id="chat-welcome">' +
      '<p>' +
      escapeHtml(DemoData.welcomeAi) +
      '</p>' +
      '<p class="sc-card__meta" style="margin-top:8px">' +
      escapeHtml(DemoData.welcomeHelp) +
      '</p></div>';
    const rowWelcome = document.createElement('div');
    rowWelcome.className = 'sc-msg';
    rowWelcome.dataset.homeScreen = '1';
    rowWelcome.innerHTML =
      '<div class="sc-bubble sc-bubble--ai">' + welcomeHtml + '</div>';
    const rowSummary = document.createElement('div');
    rowSummary.className = 'sc-msg';
    rowSummary.dataset.homeScreen = '1';
    rowSummary.innerHTML =
      '<div class="sc-bubble sc-bubble--ai">' +
      renderFollowUpSummary() +
      '</div>';
    const rowRecent = document.createElement('div');
    rowRecent.className = 'sc-msg';
    rowRecent.dataset.homeScreen = '1';
    rowRecent.innerHTML =
      '<div class="sc-bubble sc-bubble--ai">' +
      buildRecentSectionHtml() +
      '</div>';
    return [rowWelcome, rowSummary, rowRecent];
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

    state.enterpriseId = 'ent-east';
    state.customerId = null;
    state.selectedFollowUpId = null;
    state.activeSkill = null;
    state.voiceSampleIdx = 0;
    state.ctx = {};
    delete state._followCustomerId;
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
    $('#header-customer').onclick = openCustomerSheet;
    const clearCustomerBtn = $('#clear-customer-chat');
    if (clearCustomerBtn) {
      clearCustomerBtn.onclick = (e) => {
        e.stopPropagation();
        clearChatHistoryAll();
      };
    }
    $('#messages').addEventListener('click', onMessagesClick);

    renderSkills();

    const voice = $('#voice-btn');
    let voiceBusy = false;
    function endVoice() {
      if (!voice.classList.contains('is-recording') || voiceBusy) return;
      voiceBusy = true;
      voice.classList.remove('is-recording');
      voice.textContent = '按住 说话';
      const sample = DemoData.voiceSamples[state.voiceSampleIdx % DemoData.voiceSamples.length];
      state.voiceSampleIdx++;
      if (sample) handleIntent(sample);
      setTimeout(() => {
        voiceBusy = false;
      }, 400);
    }
    voice.addEventListener('touchstart', (e) => {
      e.preventDefault();
      voice.classList.add('is-recording');
      voice.textContent = '松开 结束';
    });
    voice.addEventListener('touchend', endVoice);
    voice.addEventListener('mousedown', () => {
      voice.classList.add('is-recording');
      voice.textContent = '松开 结束';
    });
    voice.addEventListener('mouseup', endVoice);

    $('#mode-toggle').onclick = () => $('#composer').classList.toggle('is-text');

    $('#send-btn').onclick = () => {
      const t = ($('#text-input').value || '').trim();
      if (!t) return;
      $('#text-input').value = '';
      $('#composer').classList.remove('is-text');
      handleIntent(t);
    };

    $('#sheet-follow-close').onclick = closeOverlays;
    $('#overlay-follow').onclick = (e) => {
      if (e.target.id === 'overlay-follow') closeOverlays();
    };
    $('#follow-submit').onclick = () => {
      const name = $('#follow-contact-name').value.trim();
      const phone = $('#follow-contact-phone').value.trim();
      const addr = $('#follow-ship-address').value.trim();
      const content = $('#follow-content').value.trim();
      const time = $('#follow-time').value;
      const status = $('#follow-status');
      const statusLabel = status.options[status.selectedIndex].text;
      if (!name || !phone) {
        toast('请填写联系人和联系方式');
        return;
      }
      if (!content) {
        toast('请填写跟进信息');
        return;
      }
      if (!time) {
        toast('请选择跟进时间');
        return;
      }
      const c = getCustomer(state._followCustomerId || state.customerId);
      closeOverlays();
      const summary =
        '联系人：' +
        name +
        '，' +
        phone +
        '\n发货地址：' +
        addr +
        '\n跟进：' +
        content +
        '\n时间：' +
        time.replace('T', ' ') +
        '，状态：' +
        statusLabel;
      pushUserMsg('已提交跟进记录');
      setTimeout(
        () =>
          pushAiHtml(
            '已为 <strong>' +
              escapeHtml(c ? c.name : '该企业') +
              '</strong> 记录跟进（' +
              escapeHtml(statusLabel) +
              '）。<br><span style="font-size:12px;color:#71717A">' +
              escapeHtml(content) +
              '</span>'
          ),
        200
      );
    };

    $('#sheet-customer-close').onclick = closeOverlays;
    $('#overlay-customer').onclick = (e) => {
      if (e.target.id === 'overlay-customer') closeOverlays();
    };
    $('#customer-search').oninput = () => renderCustomerPickerList();

    $('#sheet-ent-close').onclick = closeOverlays;
    $('#overlay-enterprise').onclick = (e) => {
      if (e.target.id === 'overlay-enterprise') closeOverlays();
    };

    $('#pdf-close').onclick = () => $('#pdf-modal').classList.add('sc-hidden');

    const changeSel = $('#change-reason');
    if (changeSel && !changeSel.options.length) {
      DemoData.changeReasons.forEach((r) => {
        const opt = document.createElement('option');
        opt.value = r;
        opt.textContent = r;
        changeSel.appendChild(opt);
      });
    }

    $('#quote-close').onclick = closeOverlays;
    $('#overlay-quote').onclick = (e) => {
      if (e.target.id === 'overlay-quote') closeOverlays();
    };
    $('#quote-submit').onclick = () => Skills.submitQuote();

    $('#delivery-close').onclick = closeOverlays;
    $('#overlay-delivery').onclick = (e) => {
      if (e.target.id === 'overlay-delivery') closeOverlays();
    };
    $('#delivery-submit').onclick = () => Skills.submitDelivery();

    $('#order-close').onclick = closeOverlays;
    $('#overlay-order').onclick = (e) => {
      if (e.target.id === 'overlay-order') closeOverlays();
    };
    $('#order-submit').onclick = () => Skills.submitOrder();

    $('#change-close').onclick = closeOverlays;
    $('#overlay-change').onclick = (e) => {
      if (e.target.id === 'overlay-change') closeOverlays();
    };
    $('#change-submit').onclick = () => Skills.submitChange();

    $('#service-close').onclick = closeOverlays;
    $('#overlay-service').onclick = (e) => {
      if (e.target.id === 'overlay-service') closeOverlays();
    };
    $('#service-submit').onclick = () => Skills.submitService();

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
      requestFollowUpListByClick
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
