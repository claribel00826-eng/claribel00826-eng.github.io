/**
 * v1.5.0 · 最近访问（功能主轴）+ 本地客户建档
 */
(function () {
  const RECENT_MAX = 5;
  const LOCAL_CUSTOMERS_KEY = 'sc-customers-local';
  const RECENT_VISITS_KEY = 'sc-recent-visits';

  let deps = null;
  let createSeq = 0;

  function init(api) {
    deps = api;
    syncLocalCustomersIntoDemo();
  }

  function storageKey(base) {
    const ent = deps.state.enterpriseId || 'ent-east';
    const user = (window.DemoData && DemoData.demoSalesUser) || 'demo';
    return base + ':' + ent + ':' + user;
  }

  /* ── 本地客户 ── */

  function saveLocalCustomersRaw(list) {
    try {
      const all = JSON.parse(localStorage.getItem(LOCAL_CUSTOMERS_KEY) || '{}');
      all[getEnterpriseId()] = list;
      localStorage.setItem(LOCAL_CUSTOMERS_KEY, JSON.stringify(all));
    } catch (_) {}
  }

  function getEnterpriseId() {
    if (deps && deps.state && deps.state.enterpriseId) return deps.state.enterpriseId;
    try {
      const s = JSON.parse(localStorage.getItem('sc_state') || '{}');
      if (s.enterpriseId) return s.enterpriseId;
    } catch (_) {}
    return 'ent-east';
  }

  function loadLocalCustomersRaw() {
    try {
      const all = JSON.parse(localStorage.getItem(LOCAL_CUSTOMERS_KEY) || '{}');
      return all[getEnterpriseId()] || [];
    } catch (_) {
      return [];
    }
  }

  function syncLocalCustomersIntoDemo() {
    if (!window.DemoData) return;
    const local = loadLocalCustomersRaw();
    const ids = new Set(DemoData.customers.map((c) => c.id));
    local.forEach((c) => {
      if (!ids.has(c.id)) {
        DemoData.customers.push(c);
        ids.add(c.id);
      } else {
        const idx = DemoData.customers.findIndex((x) => x.id === c.id);
        if (idx >= 0) DemoData.customers[idx] = { ...DemoData.customers[idx], ...c };
      }
    });
  }

  function nextCustomerCode() {
    createSeq += 1;
    const d = new Date();
    const ymd =
      String(d.getFullYear()) +
      String(d.getMonth() + 1).padStart(2, '0') +
      String(d.getDate()).padStart(2, '0');
    return 'C-NEW-' + ymd + '-' + String(createSeq).padStart(3, '0');
  }

  function enterpriseHasCustomerName(name) {
    const n = (name || '').trim();
    const ent = getEnterpriseId();
    return DemoData.customers.some((c) => c.enterpriseId === ent && c.name === n);
  }

  /* ── 最近访问 ── */

  function loadRecentVisitsRaw() {
    try {
      return JSON.parse(localStorage.getItem(storageKey(RECENT_VISITS_KEY)) || '[]');
    } catch (_) {
      return [];
    }
  }

  function saveRecentVisitsRaw(list) {
    localStorage.setItem(storageKey(RECENT_VISITS_KEY), JSON.stringify(list));
  }

  function formatRelativeTime(isoOrLabel) {
    if (!isoOrLabel) return '';
    if (typeof isoOrLabel === 'string' && !/^\d{4}-\d{2}/.test(isoOrLabel)) {
      return isoOrLabel;
    }
    const t = new Date(isoOrLabel).getTime();
    if (isNaN(t)) return '';
    const diff = Date.now() - t;
    const min = Math.floor(diff / 60000);
    if (min < 1) return '刚刚';
    if (min < 60) return min + ' 分钟前';
    const hr = Math.floor(min / 60);
    if (hr < 24) return hr + ' 小时前';
    const day = Math.floor(hr / 24);
    if (day === 1) return '昨天';
    if (day < 7) return day + ' 天前';
    const d = new Date(t);
    return d.getMonth() + 1 + ' 月 ' + d.getDate() + ' 日';
  }

  function getSkillLabel(skillId) {
    if (deps.getSkillLabel) return deps.getSkillLabel(skillId);
    const sk = DemoData.skills.find((s) => s.id === skillId);
    return sk ? sk.name : skillId;
  }

  function defaultCheckpointLabel(skillId) {
    const map = {
      followup: '待跟进列表',
      plan: '入口',
      quote: '入口',
      delivery: '入口',
      order: '入口',
      copy: '入口',
      change: '入口',
      progress: '入口',
      capacity: '甘特图',
      inventory: '全量概览',
      'biz-analysis': '汇总看板',
      payment: '月度明细'
    };
    return map[skillId] || '入口';
  }

  function recordRecentVisit(skillId, opts) {
    opts = opts || {};
    if (!skillId) return;
    const now = new Date().toISOString();
    const entry = {
      skillId: skillId,
      customerId: opts.customerId != null ? opts.customerId : deps.state.customerId || null,
      checkpoint: opts.checkpoint || 'entry',
      checkpointLabel: opts.checkpointLabel || defaultCheckpointLabel(skillId),
      meta: opts.meta || null,
      visitedAt: now
    };
    let list = loadRecentVisitsRaw();
    list = list.filter((r) => r.skillId !== skillId);
    list.unshift(entry);
    if (list.length > RECENT_MAX) list = list.slice(0, RECENT_MAX);
    saveRecentVisitsRaw(list);
  }

  function seedRecentVisits() {
    const stored = loadRecentVisitsRaw();
    if (stored.length) return stored;
    const seeds = DemoData.recentVisits || DemoData.recentCustomers || [];
    return seeds.map(function (r) {
      return {
        skillId: r.skillId || 'followup',
        customerId: r.customerId || null,
        checkpointLabel: r.checkpointLabel || r.label || defaultCheckpointLabel(r.skillId),
        visitedAt: r.visitedAt || new Date(Date.now() - 86400000).toISOString()
      };
    });
  }

  function resolveRecentDisplayList() {
    const list = loadRecentVisitsRaw().length ? loadRecentVisitsRaw() : seedRecentVisits();
    return list.filter(function (r) {
      if (!r.skillId) return false;
      if (r.customerId) {
        const c = deps.getCustomer(r.customerId);
        if (!c || c.enterpriseId !== deps.state.enterpriseId) return false;
      }
      return true;
    });
  }

  function buildContextLine(r) {
    const parts = [];
    if (r.customerId) {
      const c = deps.getCustomer(r.customerId);
      if (c) parts.push(c.name);
    }
    if (r.checkpointLabel) {
      if (parts.length) parts.push(r.checkpointLabel);
      else parts.push(r.checkpointLabel);
    }
    if (parts.length === 2) return parts[0] + ' · ' + parts[1];
    return parts.join('');
  }

  function buildRecentSectionHtml() {
    const items = resolveRecentDisplayList();
    let html =
      '<div class="sc-welcome-section" data-spec-id="chat-recent"><p class="sc-welcome-section__title">最近访问</p>';
    if (!items.length) {
      html +=
        '<p class="sc-recent-empty">暂无最近访问，使用下方功能后将出现在此。</p></div>';
      return html;
    }
    html += '<div class="sc-recent-inline">';
    items.forEach(function (r) {
      const skillName = getSkillLabel(r.skillId);
      const timeLabel = formatRelativeTime(r.visitedAt || r.label);
      const context = buildContextLine(r);
      html +=
        '<button type="button" class="sc-recent-item" data-recent-skill="' +
        deps.escapeHtml(r.skillId) +
        '" data-recent-cid="' +
        deps.escapeHtml(r.customerId || '') +
        '" data-recent-checkpoint="' +
        deps.escapeHtml(r.checkpoint || '') +
        '">' +
        '<span class="sc-recent-item__row">' +
        '<span class="sc-recent-item__skill">' +
        deps.escapeHtml(skillName) +
        '</span>' +
        '<span class="sc-recent-item__time sc-recent-item__time--inline">' +
        deps.escapeHtml(timeLabel) +
        '</span></span>';
      if (context) {
        html +=
          '<span class="sc-recent-item__context">' + deps.escapeHtml(context) + '</span>';
      }
      html += '</button>';
    });
    html += '</div></div>';
    return html;
  }

  function hasWorkflowDraft(skillId, customerId) {
    const ctx = deps.state.ctx || {};
    if (skillId === 'plan' && ctx.plan) {
      return !customerId || ctx.plan.customerId === customerId;
    }
    if (skillId === 'quote' && ctx.quoteDraft) {
      return !customerId || ctx.quoteDraft.customerId === customerId;
    }
    if (skillId === 'order' && (ctx.orderDraft || ctx.orderPending)) {
      const d = ctx.orderDraft || ctx.orderPending;
      return !customerId || d.customerId === customerId;
    }
    return false;
  }

  function applyRecentVisit(skillId, customerId, checkpoint) {
    skillId = skillId || 'followup';
    const needsCustomer = deps.skillNeedsCustomer(skillId);

    if (needsCustomer && customerId) {
      const c = deps.getCustomer(customerId);
      if (c && c.enterpriseId === deps.state.enterpriseId) {
        deps.switchCustomer(customerId, { skipCustomerAnnounce: true });
      } else if (needsCustomer) {
        customerId = null;
      }
    }

    deps.switchActiveSkill(skillId, { skipSkillAnnounce: true });

    const utter =
      (DemoData.skillUtterances && DemoData.skillUtterances[skillId]) || getSkillLabel(skillId);
    deps.pushUserMsg(utter);

    const resumeDraft = hasWorkflowDraft(skillId, customerId || deps.state.customerId);

    setTimeout(function () {
      if (skillId === 'followup') {
        if (customerId) {
          const c = deps.getCustomer(customerId);
          if (c) {
            deps.pushAiHtml(deps.renderFollowUpDetailCard(c));
            deps.pushAiHtml(deps.renderNextStepCard(customerId));
          } else {
            deps.executeSkillAction('followup', { skipUserMsg: true });
          }
        } else {
          deps.executeSkillAction('followup', { skipUserMsg: true });
        }
      } else if (resumeDraft && window.Skills && Skills.run) {
        Skills.run(skillId);
      } else if (window.Skills && Skills.run) {
        Skills.run(skillId);
      }
      recordRecentVisit(skillId, {
        customerId: customerId || deps.state.customerId,
        checkpoint: checkpoint || 'entry'
      });
    }, 300);
  }

  /* ── 新增客户表单 ── */

  function emptyCreateForm(prefillName) {
    return {
      code: nextCustomerCode(),
      name: prefillName || '',
      cat1: '',
      cat2: '',
      regionScope: 'domestic',
      province: '',
      city: '',
      district: '',
      country: '',
      state: '',
      intlCity: ''
    };
  }

  function readCreateFormFromCard(card) {
    if (!card) return emptyCreateForm();
    const g = function (sel) {
      const el = card.querySelector(sel);
      return el ? el.value : '';
    };
    return {
      code: g('[data-field="create-code"]') || nextCustomerCode(),
      name: g('[data-field="create-name"]'),
      cat1: g('[data-field="create-cat1"]'),
      cat2: g('[data-field="create-cat2"]'),
      regionScope: g('[data-field="create-region-scope"]') || 'domestic',
      province: g('[data-field="create-province"]'),
      city: g('[data-field="create-city"]'),
      district: g('[data-field="create-district"]'),
      country: g('[data-field="create-country"]'),
      state: g('[data-field="create-state"]'),
      intlCity: g('[data-field="create-intl-city"]')
    };
  }

  function buildSelectOptions(items, selected, placeholder) {
    let h = '<option value="">' + deps.escapeHtml(placeholder || '请选择') + '</option>';
    (items || []).forEach(function (item) {
      h +=
        '<option value="' +
        deps.escapeHtml(item) +
        '"' +
        (item === selected ? ' selected' : '') +
        '>' +
        deps.escapeHtml(item) +
        '</option>';
    });
    return h;
  }

  function regionSummary(form) {
    if (form.regionScope === 'international') {
      if (!form.country) return '';
      let s = form.country;
      if (form.state) s += ' · ' + form.state;
      if (form.intlCity) s += ' · ' + form.intlCity;
      return s;
    }
    if (!form.province) return '';
    let s = form.province;
    if (form.city) s += ' · ' + form.city;
    if (form.district) s += ' · ' + form.district;
    return s;
  }

  function renderCustomerCreateCardHtml(form, errors, opts) {
    form = form || emptyCreateForm();
    errors = errors || {};
    opts = opts || {};
    const settled = !!opts.settled;
    const tree = DemoData.customerCategoryTree || {};
    const cat1Keys = Object.keys(tree);
    const cat2List = form.cat1 && tree[form.cat1] ? tree[form.cat1] : [];
    const domestic = DemoData.regionDomestic || {};
    const intl = DemoData.regionInternational || {};
    const provinces = Object.keys(domestic);
    const cities = form.province && domestic[form.province] ? Object.keys(domestic[form.province]) : [];
    const districts =
      form.province && form.city && domestic[form.province][form.city]
        ? domestic[form.province][form.city]
        : [];
    const countries = Object.keys(intl);
    const states = form.country && intl[form.country] ? Object.keys(intl[form.country]) : [];
    const intlCities =
      form.country && form.state && intl[form.country][form.state]
        ? intl[form.country][form.state]
        : [];
    const summary = regionSummary(form);
    const isDomestic = form.regionScope !== 'international';

    let html =
      '<div class="sc-card sc-card--compact sc-card--inline-form sc-card--customer-create"' +
      (settled ? ' data-create-settled="1"' : '') +
      ' data-spec-id="card-customer-create">' +
      '<div class="sc-card__head sc-card__head--compact">新增客户</div>' +
      '<div class="sc-form-scroll sc-form-scroll--card sc-form-scroll--create">' +
      '<div class="sc-form-meta-row">' +
      '<div class="sc-form-meta-cell"><span class="sc-form-meta-cell__label">编码</span>' +
      '<span class="sc-form-meta-cell__value">' +
      deps.escapeHtml(form.code) +
      '</span></div>' +
      '<div class="sc-form-meta-cell"><span class="sc-form-meta-cell__label">性质</span>' +
      '<span class="sc-form-meta-cell__value">客户</span></div></div>' +
      '<input type="hidden" data-field="create-code" value="' +
      deps.escapeHtml(form.code) +
      '" />' +
      '<input type="hidden" data-field="create-region-scope" value="' +
      deps.escapeHtml(form.regionScope) +
      '" />' +
      '<label class="sc-field-label">名称 <span class="sc-field-req">*</span></label>' +
      '<input class="sc-input sc-input--field' +
      (errors.name ? ' sc-input--error' : '') +
      '" data-field="create-name" type="text" value="' +
      deps.escapeHtml(form.name) +
      '" placeholder="请输入客户名称" autocomplete="off"' +
      (settled ? ' readonly disabled' : '') +
      ' />';
    if (errors.name) {
      html += '<p class="sc-field-hint sc-field-hint--error">' + deps.escapeHtml(errors.name) + '</p>';
    }

    html +=
      '<label class="sc-field-label">所属类别 <span class="sc-field-req">*</span></label>' +
      '<div class="sc-field-row sc-field-row--2col">' +
      '<select class="sc-input sc-input--field' +
      (errors.cat1 ? ' sc-input--error' : '') +
      '" data-field="create-cat1"' +
      (settled ? ' disabled' : '') +
      '>' +
      buildSelectOptions(cat1Keys, form.cat1, '请选择一级') +
      '</select>' +
      '<select class="sc-input sc-input--field' +
      (!form.cat1 || settled ? ' sc-select--disabled' : '') +
      '" data-field="create-cat2"' +
      (!form.cat1 || settled ? ' disabled' : '') +
      '>' +
      buildSelectOptions(cat2List, form.cat2, form.cat1 ? '可不选' : '请先选择一级') +
      '</select></div>' +
      '<p class="sc-field-hint">二级选填，选一级即可提交</p>';

    html +=
      '<div class="sc-form-block">' +
      '<label class="sc-field-label">地区 <span class="sc-field-req">*</span></label>' +
      '<div class="sc-segment" role="tablist">' +
      '<button type="button" class="sc-segment__item' +
      (isDomestic ? ' sc-segment__item--active' : '') +
      '"' +
      (settled ? ' disabled' : ' data-action="create-region-domestic"') +
      ' role="tab">国内</button>' +
      '<button type="button" class="sc-segment__item' +
      (!isDomestic ? ' sc-segment__item--active' : '') +
      '"' +
      (settled ? ' disabled' : ' data-action="create-region-intl"') +
      ' role="tab">国际</button></div>';

    const selDis = function (baseDisabled) {
      return baseDisabled || settled ? ' disabled' : '';
    };

    if (isDomestic) {
      html +=
        '<label class="sc-field-label sc-field-label--sub">省/直辖市 <span class="sc-field-req">*</span></label>' +
        '<select class="sc-input sc-input--field' +
        (errors.region ? ' sc-input--error' : '') +
        '" data-field="create-province"' +
        selDis(false) +
        '>' +
        buildSelectOptions(provinces, form.province, '请选择') +
        '</select>' +
        '<div class="sc-field-row sc-field-row--2col">' +
        '<div><label class="sc-field-label sc-field-label--sub">市 <span class="sc-field-req">*</span></label>' +
        '<select class="sc-input sc-input--field' +
        (!form.province || settled ? ' sc-select--disabled' : '') +
        '" data-field="create-city"' +
        selDis(!form.province) +
        '>' +
        buildSelectOptions(cities, form.city, form.province ? '请选择' : '请先选择省') +
        '</select></div>' +
        '<div><label class="sc-field-label sc-field-label--sub">区/县 <span class="sc-field-req">*</span></label>' +
        '<select class="sc-input sc-input--field' +
        (!form.city || settled ? ' sc-select--disabled' : '') +
        '" data-field="create-district"' +
        selDis(!form.city) +
        '>' +
        buildSelectOptions(districts, form.district, form.city ? '请选择' : '请先选择市') +
        '</select></div></div>';
    } else {
      html +=
        '<label class="sc-field-label sc-field-label--sub">国家 <span class="sc-field-req">*</span></label>' +
        '<select class="sc-input sc-input--field' +
        (errors.region ? ' sc-input--error' : '') +
        '" data-field="create-country"' +
        selDis(false) +
        '>' +
        buildSelectOptions(countries, form.country, '请选择') +
        '</select>' +
        '<div class="sc-field-row sc-field-row--2col">' +
        '<div><label class="sc-field-label sc-field-label--sub">州/省 <span class="sc-field-req">*</span></label>' +
        '<select class="sc-input sc-input--field' +
        (!form.country || settled ? ' sc-select--disabled' : '') +
        '" data-field="create-state"' +
        selDis(!form.country) +
        '>' +
        buildSelectOptions(states, form.state, form.country ? '请选择' : '请先选择国家') +
        '</select></div>' +
        '<div><label class="sc-field-label sc-field-label--sub">城市 <span class="sc-field-req">*</span></label>' +
        '<select class="sc-input sc-input--field' +
        (!form.state || settled ? ' sc-select--disabled' : '') +
        '" data-field="create-intl-city"' +
        selDis(!form.state) +
        '>' +
        buildSelectOptions(intlCities, form.intlCity, form.state ? '请选择' : '请先选择州/省') +
        '</select></div></div>';
    }

    if (summary) {
      html +=
        '<p class="sc-form-block__summary">✓ 已选：' + deps.escapeHtml(summary) + '</p>';
    }
    if (errors.region && !settled) {
      html += '<p class="sc-field-hint sc-field-hint--error">' + deps.escapeHtml(errors.region) + '</p>';
    }

    html += '</div></div>';
    if (!settled) {
      html +=
        '<div class="sc-card__actions-inline sc-card__actions-inline--split">' +
        '<button type="button" class="sc-btn sc-btn--ghost" data-action="customer-create-cancel">取消</button>' +
        '<button type="button" class="sc-btn sc-btn--primary" data-action="customer-create-submit">提交</button>' +
        '</div>';
    }
    html += '</div>';
    return html;
  }

  function refreshCreateCard(card, form, errors, opts) {
    if (!card || !card.parentNode) return;
    const parent = card.parentNode;
    const next = document.createElement('div');
    next.innerHTML = renderCustomerCreateCardHtml(form, errors, opts);
    const fresh = next.firstElementChild;
    if (!fresh) return;
    parent.replaceChild(fresh, card);
    if (window.Annotation && Annotation.scanHosts) window.Annotation.scanHosts();
    return fresh;
  }

  function lockCreateFormCard(card, form) {
    return refreshCreateCard(card, form, {}, { settled: true });
  }

  function cancelCreateForm(card, form) {
    deps.pushUserMsg('取消新增客户');
    lockCreateFormCard(card, form);
    deps.pushAiHtml(
      '<p class="sc-reply-lead">好的，已取消新增客户。您可以继续选择客户，或再次说「新增客户」建档。</p>'
    );
    if (deps.scrollMessages) deps.scrollMessages();
    if (deps.persistChatHistory) deps.persistChatHistory();
    if (window.Annotation && Annotation.scanHosts) window.Annotation.scanHosts();
  }

  function openCreateCustomerCard(prefillName, opts) {
    opts = opts || {};
    if (!opts.skipUserMsg) {
      deps.pushUserMsg(opts.userText || '新增客户');
    }
    deps.pushAiHtml(renderCustomerCreateCardHtml(emptyCreateForm(prefillName)));
    if (deps.scrollMessages) deps.scrollMessages();
    if (window.Annotation && Annotation.scanHosts) window.Annotation.scanHosts();
  }

  function validateCreateForm(form) {
    const errors = {};
    const name = (form.name || '').trim();
    if (!name || name.length < 2) errors.name = '请输入客户名称（至少 2 字）';
    else if (enterpriseHasCustomerName(name)) errors.name = '该企业下已有同名客户';
    if (!form.cat1) errors.cat1 = '请选择一级类别';
    if (form.regionScope === 'international') {
      if (!form.country || !form.state || !form.intlCity) {
        errors.region = '请完整选择国家、州/省、城市';
      }
    } else if (!form.province || !form.city || !form.district) {
      errors.region = '请完整选择省、市、区/县';
    }
    return errors;
  }

  function submitCreateForm(card) {
    const form = readCreateFormFromCard(card);
    const errors = validateCreateForm(form);
    if (Object.keys(errors).length) {
      refreshCreateCard(card, form, errors);
      return;
    }
    const regionLabel = regionSummary(form);
    const id = 'c-local-' + Date.now();
    const customer = {
      id: id,
      enterpriseId: getEnterpriseId(),
      code: form.code,
      name: form.name.trim(),
      partnerType: 'customer',
      category: form.cat1,
      categoryL2: form.cat2 || '',
      regionScope: form.regionScope,
      regionProvince: form.province,
      regionCity: form.city,
      regionDistrict: form.district,
      regionCountry: form.country,
      regionState: form.state,
      regionIntlCity: form.intlCity,
      regionLabel: regionLabel,
      address: regionLabel,
      contactAddress: regionLabel,
      shipAddress: regionLabel,
      customerType: 'new',
      nature: '客户',
      level: '—',
      lastOrderAt: '—',
      lastOrderAmount: '—',
      accountManager: DemoData.demoSalesUser,
      latestFollowStatus: 'pending',
      contactName: '',
      contactPhone: '',
      settlementCustomer: form.name.trim(),
      reminderDate: null,
      updatedAt: new Date().toISOString(),
      _localCreated: true
    };
    const local = loadLocalCustomersRaw();
    local.push(customer);
    saveLocalCustomersRaw(local);
    DemoData.customers.push(customer);
    deps.pushUserMsg('新增客户：' + customer.name.trim());
    lockCreateFormCard(card, form);
    deps.pushSystem('已新增客户：' + customer.name);
    deps.switchCustomer(id, { skipCustomerAnnounce: true });
    deps.pushAiHtml(deps.renderNextStepCard(id));
    if (deps.scrollMessages) deps.scrollMessages();
    if (deps.persistChatHistory) deps.persistChatHistory();
    if (window.Annotation && Annotation.scanHosts) window.Annotation.scanHosts();
  }

  function handleCreateAction(action, btn) {
    const card = btn.closest('[data-spec-id="card-customer-create"]');
    if (!card) return false;
    if (card.getAttribute('data-create-settled') === '1') return false;
    let form = readCreateFormFromCard(card);

    if (action === 'customer-create-cancel') {
      cancelCreateForm(card, form);
      return true;
    }
    if (action === 'customer-create-submit') {
      submitCreateForm(card);
      deps.persistChatHistory();
      return true;
    }
    if (action === 'create-region-domestic') {
      form.regionScope = 'domestic';
      form.country = form.state = form.intlCity = '';
      refreshCreateCard(card, form);
      return true;
    }
    if (action === 'create-region-intl') {
      form.regionScope = 'international';
      form.province = form.city = form.district = '';
      refreshCreateCard(card, form);
      return true;
    }
    return false;
  }

  function handleCreateSelectChange(selectEl) {
    const card = selectEl.closest('[data-spec-id="card-customer-create"]');
    if (!card || card.getAttribute('data-create-settled') === '1') return;
    const form = readCreateFormFromCard(card);
    const field = selectEl.getAttribute('data-field') || '';
    if (field === 'create-cat1') {
      form.cat2 = '';
    } else if (field === 'create-province') {
      form.city = form.district = '';
    } else if (field === 'create-city') {
      form.district = '';
    } else if (field === 'create-country') {
      form.state = form.intlCity = '';
    } else if (field === 'create-state') {
      form.intlCity = '';
    }
    refreshCreateCard(card, form);
    if (deps.persistChatHistory) deps.persistChatHistory();
  }

  function patchRecentSectionInDom() {
    const section = document.querySelector('[data-spec-id="chat-recent"]');
    if (!section || !section.parentNode) return;
    const wrap = document.createElement('div');
    wrap.innerHTML = buildRecentSectionHtml();
    const fresh = wrap.firstElementChild;
    if (fresh) {
      section.parentNode.replaceChild(fresh, section);
      if (window.Annotation && Annotation.scanHosts) window.Annotation.scanHosts();
    }
  }

  function isCreateCustomerIntent(text) {
    return /^(新增客户|添加客户|创建客户|建档|新建客户)/.test((text || '').trim());
  }

  window.V155 = {
    init: init,
    syncLocalCustomersIntoDemo: syncLocalCustomersIntoDemo,
    recordRecentVisit: recordRecentVisit,
    buildRecentSectionHtml: buildRecentSectionHtml,
    applyRecentVisit: applyRecentVisit,
    openCreateCustomerCard: openCreateCustomerCard,
    handleCreateAction: handleCreateAction,
    handleCreateSelectChange: handleCreateSelectChange,
    isCreateCustomerIntent: isCreateCustomerIntent,
    renderCustomerCreateCardHtml: renderCustomerCreateCardHtml,
    patchRecentSectionInDom: patchRecentSectionInDom
  };
})();
