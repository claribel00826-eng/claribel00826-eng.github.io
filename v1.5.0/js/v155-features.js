/**
 * v1.5.0 · 最近访问（功能主轴）+ 本地客户建档
 */
(function () {
  const RECENT_MAX = 5;
  const LOCAL_CUSTOMERS_KEY = 'sc-customers-local';
  const RECENT_VISITS_KEY = 'sc-recent-visits';

  let deps = null;
  let createRegionModal = { card: null, draft: null };

  function init(api) {
    deps = api;
    syncLocalCustomersIntoDemo();
    bindCreateRegionModal();
  }

  function bindCreateRegionModal() {
    const overlay = document.getElementById('overlay-create-region');
    if (!overlay || overlay.dataset.bound === '1') return;
    overlay.dataset.bound = '1';
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) handleRegionModalAction('region-picker-cancel', overlay);
    });
    const sheet = overlay.querySelector('[data-spec-id="sheet-create-region"]');
    if (sheet) {
      sheet.addEventListener('click', function (e) {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        handleRegionModalAction(btn.getAttribute('data-action'), btn);
      });
      sheet.addEventListener('input', function (e) {
        const inp = e.target.closest('[data-action="create-region-search"]');
        if (inp) handleCreateRegionSearch(inp);
      });
    }
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

  function enterpriseHasCustomerName(name) {
    const n = (name || '').trim();
    const ent = getEnterpriseId();
    return DemoData.customers.some((c) => c.enterpriseId === ent && c.name === n);
  }

  function enterpriseHasCustomerCode(code, excludeId) {
    const c = (code || '').trim();
    if (!c) return false;
    const ent = getEnterpriseId();
    return DemoData.customers.some(function (cust) {
      if (cust.enterpriseId !== ent) return false;
      if (excludeId && cust.id === excludeId) return false;
      return (cust.code || '').trim().toUpperCase() === c.toUpperCase();
    });
  }

  function isValidCustomerCodeFormat(code) {
    return /^[A-Za-z0-9_-]+$/.test(code);
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
            deps.pushAiHtml(deps.renderCustomerDetailWithNextStep(c));
          } else {
            deps.executeSkillAction('followup', { skipUserMsg: true });
          }
        } else {
          deps.executeSkillAction('followup', { skipUserMsg: true });
        }
      } else if (skillId === 'payment') {
        const list = loadRecentVisitsRaw();
        const entry = list.find(function (r) {
          return r.skillId === 'payment';
        });
        if (entry && entry.meta && entry.meta.year && window.Skills && Skills.runPayment) {
          Skills.runPayment({
            resume: {
              year: entry.meta.year,
              customerId: entry.meta.paymentCustomerId || null
            },
            simulateUserMsg: false
          });
        } else if (window.Skills && Skills.runPayment) {
          Skills.runPayment({ simulateUserMsg: false });
        }
      } else if (resumeDraft && window.Skills && Skills.run) {
        Skills.run(skillId);
      } else if (window.Skills && Skills.run) {
        Skills.run(skillId);
      }
      if (skillId !== 'payment') {
        recordRecentVisit(skillId, {
          customerId: customerId || deps.state.customerId,
          checkpoint: checkpoint || 'entry'
        });
      }
    }, 300);
  }

  /* ── 新增客户表单 ── */

  function emptyCreateForm(prefillName) {
    return {
      code: '',
      name: prefillName || '',
      cat1: '',
      cat2: '',
      regionId: '',
      regionPath: [],
      regionLabel: '',
      regionPickerOpen: false,
      regionPickerMode: 'browse',
      regionBrowseParentId: '',
      regionSearch: '',
      regionCandidateId: '',
      regionCandidatePath: []
    };
  }

  function encodeJsonAttr(value) {
    return encodeURIComponent(JSON.stringify(value == null ? [] : value));
  }

  function decodeJsonAttr(raw) {
    if (!raw) return [];
    try {
      return JSON.parse(decodeURIComponent(raw));
    } catch (e) {
      try {
        return JSON.parse(raw);
      } catch (e2) {
        return [];
      }
    }
  }

  function ensureCreateFormRegion(form) {
    if (!form.regionId && form.regionCandidateId) {
      applyRegionSelection(form, form.regionCandidateId);
    }
    if (form.regionId && (!form.regionPath || !form.regionPath.length)) {
      const hit = DemoData.findRegionNodeById ? DemoData.findRegionNodeById(form.regionId) : null;
      if (hit) {
        form.regionPath = hit.path;
        form.regionLabel = DemoData.formatRegionLabel
          ? DemoData.formatRegionLabel(hit.path)
          : hit.path.map(function (p) { return p.name; }).join(' / ');
      }
    }
    return form;
  }

  function readCreateFormFromCard(card) {
    if (!card) return emptyCreateForm();
    const g = function (sel) {
      const el = card.querySelector(sel);
      return el ? el.value : '';
    };
    let regionPath = decodeJsonAttr(g('[data-field="create-region-path"]'));
    let regionCandidatePath = decodeJsonAttr(g('[data-field="create-region-candidate-path"]'));
    return {
      code: g('[data-field="create-code"]'),
      name: g('[data-field="create-name"]'),
      cat1: g('[data-field="create-cat1"]'),
      cat2: g('[data-field="create-cat2"]'),
      regionId: g('[data-field="create-region-id"]'),
      regionPath: regionPath,
      regionLabel: g('[data-field="create-region-label"]'),
      regionPickerOpen: card.getAttribute('data-region-picker-open') === '1',
      regionPickerMode: card.getAttribute('data-region-picker-mode') || 'browse',
      regionBrowseParentId: card.getAttribute('data-region-browse-parent') || '',
      regionSearch: g('[data-field="create-region-search"]') || '',
      regionCandidateId: g('[data-field="create-region-candidate-id"]') || '',
      regionCandidatePath: regionCandidatePath
    };
  }

  function setRegionCandidate(form, nodeId) {
    const hit = DemoData.findRegionNodeById ? DemoData.findRegionNodeById(nodeId) : null;
    if (!hit) return;
    form.regionCandidateId = nodeId;
    form.regionCandidatePath = hit.path;
  }

  function candidatePathLabel(form) {
    if (!form.regionCandidatePath || !form.regionCandidatePath.length) return '';
    return DemoData.formatRegionLabel
      ? DemoData.formatRegionLabel(form.regionCandidatePath)
      : form.regionCandidatePath.map(function (p) { return p.name; }).join(' / ');
  }

  function openRegionPickerOnForm(form) {
    form.regionPickerOpen = true;
    form.regionPickerMode = 'browse';
    form.regionBrowseParentId = '';
    form.regionSearch = '';
    form.regionCandidateId = form.regionId || '';
    form.regionCandidatePath = form.regionPath ? form.regionPath.slice() : [];
  }

  function closeRegionPickerOnForm(form) {
    form.regionPickerOpen = false;
    form.regionSearch = '';
    form.regionBrowseParentId = '';
    form.regionCandidateId = '';
    form.regionCandidatePath = [];
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

  function regionPathJson(form) {
    return deps.escapeHtml(encodeJsonAttr(form.regionPath || []));
  }

  function renderRegionPickerBodyHtml(draft) {
    draft = draft || {};
    const q = (draft.regionSearch || '').trim();
    const browsePath =
      !q && DemoData.getRegionBrowsePath
        ? DemoData.getRegionBrowsePath(draft.regionBrowseParentId || '')
        : [];
    let bodyHtml = '';

    if (q) {
      const hits = DemoData.searchRegions ? DemoData.searchRegions(q) : [];
      if (!hits.length) {
        bodyHtml = '<p class="sc-card__meta sc-card__empty-hint">未找到匹配地区</p>';
      } else {
        bodyHtml =
          '<div class="sc-region-picker__list sc-region-picker__list--search">' +
          hits
            .map(function (hit) {
              const selected = draft.regionCandidateId === hit.id;
              return (
                '<button type="button" class="sc-list-item sc-list-item--customer sc-region-picker__item' +
                (selected ? ' is-selected' : '') +
                '" data-action="region-picker-highlight" data-region-id="' +
                deps.escapeHtml(hit.id) +
                '"><span class="sc-list-item__main"><span class="sc-list-item__name">' +
                deps.escapeHtml(hit.name) +
                '</span><span class="sc-list-item__sub">' +
                deps.escapeHtml(hit.fullPathLabel) +
                '</span></span></button>'
              );
            })
            .join('') +
          '</div>';
      }
    } else {
      const items = DemoData.getRegionChildren
        ? DemoData.getRegionChildren(draft.regionBrowseParentId || null)
        : [];
      let crumbHtml =
        '<div class="sc-region-picker__crumb-row">' +
        '<div class="sc-region-picker__crumb">';
      if (!browsePath.length) {
        crumbHtml += '<span class="sc-region-picker__crumb-item is-active">顶级</span>';
      } else {
        crumbHtml +=
          '<button type="button" class="sc-region-picker__crumb-item" data-action="region-picker-crumb" data-region-id="">顶级</button>';
        browsePath.forEach(function (node, idx) {
          const isLast = idx === browsePath.length - 1;
          crumbHtml +=
            '<span class="sc-region-picker__crumb-sep" aria-hidden="true">›</span>' +
            (isLast
              ? '<span class="sc-region-picker__crumb-item is-active">' + deps.escapeHtml(node.name) + '</span>'
              : '<button type="button" class="sc-region-picker__crumb-item" data-action="region-picker-crumb" data-region-id="' +
                deps.escapeHtml(node.id) +
                '">' +
                deps.escapeHtml(node.name) +
                '</button>');
        });
      }
      crumbHtml += '</div>';
      if (browsePath.length) {
        crumbHtml +=
          '<button type="button" class="sc-region-picker__back" data-action="region-picker-back">返回上级</button>';
      }
      crumbHtml += '</div>';

      let listHtml = '';
      if (!items.length) {
        listHtml = '<p class="sc-card__meta sc-card__empty-hint">暂无下级地区，可点「确认选择」</p>';
      } else {
        listHtml =
          '<div class="sc-region-picker__list">' +
          items
            .map(function (item) {
              const isCandidate = draft.regionCandidateId === item.id;
              const drillBtn = item.hasChildren
                ? '<button type="button" class="sc-region-picker__drill" data-action="region-picker-enter" data-region-id="' +
                  deps.escapeHtml(item.id) +
                  '" aria-label="进入下级">›</button>'
                : '';
              return (
                '<div class="sc-region-picker__row' + (isCandidate ? ' is-candidate' : '') + '">' +
                '<button type="button" class="sc-region-picker__row-main" data-action="region-picker-enter" data-region-id="' +
                deps.escapeHtml(item.id) +
                '"><span class="sc-list-item__name">' +
                deps.escapeHtml(item.name) +
                '</span></button>' +
                drillBtn +
                '</div>'
              );
            })
            .join('') +
          '</div>';
      }
      bodyHtml = crumbHtml + listHtml;
    }

    const pathLabel = candidatePathLabel(draft);
    const footerPath = pathLabel
      ? '当前：' + deps.escapeHtml(pathLabel)
      : '当前：请在列表中选择';
    const confirmDisabled = !draft.regionCandidateId ? ' disabled' : '';

    return (
      '<div class="sc-region-picker" data-spec-id="card-region-picker">' +
      '<input type="hidden" data-field="create-region-candidate-id" value="' +
      deps.escapeHtml(draft.regionCandidateId || '') +
      '" />' +
      '<input type="hidden" data-field="create-region-candidate-path" value="' +
      deps.escapeHtml(encodeJsonAttr(draft.regionCandidatePath || [])) +
      '" />' +
      '<input type="search" class="sc-search sc-card__search" data-action="create-region-search" data-field="create-region-search" value="' +
      deps.escapeHtml(draft.regionSearch || '') +
      '" placeholder="搜索地区名称" autocomplete="off" />' +
      bodyHtml +
      '<div class="sc-region-picker__footer">' +
      '<p class="sc-region-picker__footer-path">' +
      footerPath +
      '</p>' +
      '<div class="sc-region-picker__footer-actions">' +
      '<button type="button" class="sc-btn sc-btn--ghost sc-btn--sm" data-action="region-picker-cancel">取消</button>' +
      '<button type="button" class="sc-btn sc-btn--primary sc-btn--sm" data-action="region-picker-confirm"' +
      confirmDisabled +
      '>确认选择</button>' +
      '</div></div></div>'
    );
  }

  function renderCustomerCreateCardHtml(form, errors, opts) {
    form = form || emptyCreateForm();
    errors = errors || {};
    opts = opts || {};
    const settled = !!opts.settled;
    const tree = DemoData.customerCategoryTree || {};
    const cat1Keys = Object.keys(tree);
    const cat2List = form.cat1 && tree[form.cat1] ? tree[form.cat1] : [];
    const hasRegion = !!(form.regionId && form.regionPath && form.regionPath.length);
    const triggerTitle = hasRegion
      ? deps.escapeHtml(form.regionPath[form.regionPath.length - 1].name)
      : '请选择地区';
    const triggerDesc = hasRegion
      ? deps.escapeHtml(form.regionLabel || '')
      : '点击打开弹窗选择地区';
    const triggerCls =
      'sc-plan-entry__option sc-region-trigger' +
      (hasRegion ? ' sc-region-trigger--filled' : '') +
      (errors.region ? ' sc-region-trigger--error' : '');

    let html =
      '<div class="sc-card sc-card--compact sc-card--inline-form sc-card--customer-create"' +
      (settled ? ' data-create-settled="1"' : '') +
      ' data-spec-id="card-customer-create">' +
      '<div class="sc-card__head sc-card__head--compact">新增客户</div>' +
      '<div class="sc-form-scroll sc-form-scroll--card sc-form-scroll--create">' +
      '<input type="hidden" data-field="create-region-id" value="' +
      deps.escapeHtml(form.regionId || '') +
      '" />' +
      '<input type="hidden" data-field="create-region-path" value="' +
      regionPathJson(form) +
      '" />' +
      '<input type="hidden" data-field="create-region-label" value="' +
      deps.escapeHtml(form.regionLabel || '') +
      '" />' +
      '<label class="sc-field-label">客户编码 <span class="sc-field-req">*</span></label>' +
      '<input class="sc-input sc-input--field' +
      (errors.code ? ' sc-input--error' : '') +
      '" data-field="create-code" type="text" value="' +
      deps.escapeHtml(form.code) +
      '" placeholder="请输入客户编码" autocomplete="off"' +
      (settled ? ' readonly disabled' : '') +
      ' />';
    if (errors.code) {
      html += '<p class="sc-field-hint sc-field-hint--error">' + deps.escapeHtml(errors.code) + '</p>';
    } else if (!settled) {
      html += '<p class="sc-field-hint">企业内唯一，支持字母、数字、短横线与下划线</p>';
    }

    html +=
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
      '<button type="button" class="' +
      triggerCls +
      '"' +
      (settled ? ' disabled' : ' data-action="create-region-toggle"') +
      '><span class="sc-plan-entry__option-text"><span class="sc-plan-entry__option-title">' +
      triggerTitle +
      '</span><span class="sc-plan-entry__option-desc">' +
      triggerDesc +
      '</span></span><span class="sc-plan-entry__chevron" aria-hidden="true">›</span></button>';

    if (hasRegion) {
      html +=
        '<p class="sc-region-summary">已选：' + deps.escapeHtml(form.regionLabel || '') + '</p>';
    }

    html += '<p class="sc-field-hint">任意层级均可作为客户地区</p>';

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

  function openRegionPickerModal(card) {
    if (!card || card.getAttribute('data-create-settled') === '1') return;
    bindCreateRegionModal();
    const form = readCreateFormFromCard(card);
    createRegionModal.card = card;
    createRegionModal.draft = {
      regionPickerMode: 'browse',
      regionBrowseParentId: '',
      regionSearch: '',
      regionCandidateId: form.regionId || '',
      regionCandidatePath: form.regionPath ? form.regionPath.slice() : []
    };
    const overlay = document.getElementById('overlay-create-region');
    const mount = document.getElementById('create-region-mount');
    if (!overlay || !mount) return;
    mount.innerHTML = renderRegionPickerBodyHtml(createRegionModal.draft);
    overlay.classList.remove('sc-hidden');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.classList.add('sc-region-modal-open');
    if (window.Annotation && Annotation.scanHosts) window.Annotation.scanHosts();
  }

  function closeRegionPickerModal() {
    const overlay = document.getElementById('overlay-create-region');
    if (overlay) {
      overlay.classList.add('sc-hidden');
      overlay.setAttribute('aria-hidden', 'true');
    }
    document.body.classList.remove('sc-region-modal-open');
    createRegionModal = { card: null, draft: null };
  }

  function refreshRegionPickerModal() {
    const mount = document.getElementById('create-region-mount');
    if (!mount || !createRegionModal.draft) return;
    mount.innerHTML = renderRegionPickerBodyHtml(createRegionModal.draft);
    const q = (createRegionModal.draft.regionSearch || '').trim();
    if (q) {
      const searchInp = mount.querySelector('[data-field="create-region-search"]');
      if (searchInp) {
        searchInp.focus();
        const len = searchInp.value.length;
        searchInp.setSelectionRange(len, len);
      }
    }
    if (window.Annotation && Annotation.scanHosts) window.Annotation.scanHosts();
  }

  function handleRegionModalAction(action, btn) {
    const card = createRegionModal.card;
    const draft = createRegionModal.draft;
    if (!card || !draft) return false;

    if (action === 'region-picker-cancel') {
      closeRegionPickerModal();
      return true;
    }
    if (action === 'region-picker-confirm') {
      if (!draft.regionCandidateId) return true;
      let form = readCreateFormFromCard(card);
      applyRegionSelection(form, draft.regionCandidateId);
      closeRegionPickerModal();
      refreshCreateCard(card, form);
      if (deps.persistChatHistory) deps.persistChatHistory();
      return true;
    }
    if (action === 'region-picker-back') {
      const browsePath = DemoData.getRegionBrowsePath(draft.regionBrowseParentId || '');
      draft.regionBrowseParentId =
        browsePath.length >= 2 ? browsePath[browsePath.length - 2].id : '';
      if (draft.regionBrowseParentId) {
        setRegionCandidate(draft, draft.regionBrowseParentId);
      } else {
        draft.regionCandidateId = '';
        draft.regionCandidatePath = [];
      }
      refreshRegionPickerModal();
      return true;
    }
    if (action === 'region-picker-crumb') {
      draft.regionBrowseParentId = (btn && btn.getAttribute('data-region-id')) || '';
      if (draft.regionBrowseParentId) {
        setRegionCandidate(draft, draft.regionBrowseParentId);
      } else {
        draft.regionCandidateId = '';
        draft.regionCandidatePath = [];
      }
      refreshRegionPickerModal();
      return true;
    }
    if (action === 'region-picker-enter') {
      const nodeId = (btn && btn.getAttribute('data-region-id')) || '';
      draft.regionBrowseParentId = nodeId;
      draft.regionPickerMode = 'browse';
      draft.regionSearch = '';
      setRegionCandidate(draft, nodeId);
      refreshRegionPickerModal();
      return true;
    }
    if (action === 'region-picker-highlight') {
      setRegionCandidate(draft, (btn && btn.getAttribute('data-region-id')) || '');
      refreshRegionPickerModal();
      return true;
    }
    return false;
  }

  function applyRegionSelection(form, nodeId) {
    const hit = DemoData.findRegionNodeById ? DemoData.findRegionNodeById(nodeId) : null;
    if (!hit) return form;
    form.regionId = nodeId;
    form.regionPath = hit.path;
    form.regionLabel = DemoData.formatRegionLabel
      ? DemoData.formatRegionLabel(hit.path)
      : hit.path.map(function (p) { return p.name; }).join(' / ');
    closeRegionPickerOnForm(form);
    return form;
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
    const code = (form.code || '').trim();
    if (!code) errors.code = '请输入客户编码';
    else if (code.length < 2) errors.code = '客户编码至少 2 个字符';
    else if (!isValidCustomerCodeFormat(code)) {
      errors.code = '编码仅支持字母、数字、短横线与下划线';
    } else if (enterpriseHasCustomerCode(code)) {
      errors.code = '该企业下已有相同客户编码';
    }
    const name = (form.name || '').trim();
    if (!name || name.length < 2) errors.name = '请输入客户名称（至少 2 字）';
    else if (enterpriseHasCustomerName(name)) errors.name = '该企业下已有同名客户';
    if (!form.cat1) errors.cat1 = '请选择一级类别';
    if (!form.regionId || !form.regionPath || !form.regionPath.length) {
      errors.region = '请选择地区';
    }
    return errors;
  }

  function submitCreateForm(card) {
    let form = ensureCreateFormRegion(readCreateFormFromCard(card));
    const errors = validateCreateForm(form);
    if (Object.keys(errors).length) {
      refreshCreateCard(card, form, errors);
      return;
    }
    const regionLabel = form.regionLabel || '';
    const id = 'c-local-' + Date.now();
    const customer = {
      id: id,
      enterpriseId: getEnterpriseId(),
      code: form.code.trim(),
      name: form.name.trim(),
      partnerType: 'customer',
      category: form.cat1,
      categoryL2: form.cat2 || '',
      regionId: form.regionId,
      regionPath: form.regionPath,
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
    deps.switchCustomer(id, { skipCustomerAnnounce: true, showDetail: true });
    if (deps.switchActiveSkill) {
      deps.switchActiveSkill('customer-create', { skipSkillAnnounce: true });
    }
    if (deps.scrollMessages) deps.scrollMessages();
    if (deps.persistChatHistory) deps.persistChatHistory();
    if (window.Annotation && Annotation.scanHosts) window.Annotation.scanHosts();
  }

  function handleCreateAction(action, btn) {
    if (btn && btn.closest('[data-spec-id="sheet-create-region"]')) {
      return handleRegionModalAction(action, btn);
    }
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
    if (action === 'create-region-toggle') {
      openRegionPickerModal(card);
      return true;
    }
    if (card.querySelector('[data-spec-id="card-region-picker"]')) {
      return handleLegacyInlineRegionAction(action, btn, card, form);
    }
    return false;
  }

  function handleLegacyInlineRegionAction(action, btn, card, form) {
    if (action === 'region-picker-cancel') {
      closeRegionPickerOnForm(form);
      refreshCreateCard(card, form);
      if (deps.persistChatHistory) deps.persistChatHistory();
      return true;
    }
    if (action === 'region-picker-confirm') {
      if (!form.regionCandidateId) return true;
      applyRegionSelection(form, form.regionCandidateId);
      refreshCreateCard(card, form);
      if (deps.persistChatHistory) deps.persistChatHistory();
      return true;
    }
    if (action === 'region-picker-back') {
      const browsePath = DemoData.getRegionBrowsePath(form.regionBrowseParentId || '');
      form.regionBrowseParentId =
        browsePath.length >= 2 ? browsePath[browsePath.length - 2].id : '';
      if (form.regionBrowseParentId) {
        setRegionCandidate(form, form.regionBrowseParentId);
      } else {
        form.regionCandidateId = '';
        form.regionCandidatePath = [];
      }
      refreshCreateCard(card, form);
      return true;
    }
    if (action === 'region-picker-crumb') {
      form.regionBrowseParentId = btn.getAttribute('data-region-id') || '';
      if (form.regionBrowseParentId) {
        setRegionCandidate(form, form.regionBrowseParentId);
      } else {
        form.regionCandidateId = '';
        form.regionCandidatePath = [];
      }
      refreshCreateCard(card, form);
      return true;
    }
    if (action === 'region-picker-enter') {
      const nodeId = btn.getAttribute('data-region-id') || '';
      form.regionBrowseParentId = nodeId;
      form.regionPickerMode = 'browse';
      form.regionSearch = '';
      setRegionCandidate(form, nodeId);
      refreshCreateCard(card, form);
      return true;
    }
    if (action === 'region-picker-highlight') {
      setRegionCandidate(form, btn.getAttribute('data-region-id') || '');
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
    }
    refreshCreateCard(card, form);
    if (deps.persistChatHistory) deps.persistChatHistory();
  }

  function handleCreateRegionSearch(inputEl) {
    if (inputEl && inputEl.closest('[data-spec-id="sheet-create-region"]')) {
      if (!createRegionModal.draft) return;
      createRegionModal.draft.regionSearch = inputEl.value || '';
      createRegionModal.draft.regionPickerMode = createRegionModal.draft.regionSearch.trim()
        ? 'search'
        : 'browse';
      refreshRegionPickerModal();
      return;
    }
    const card =
      (inputEl && inputEl.closest('[data-spec-id="card-customer-create"]')) ||
      document.querySelector('[data-spec-id="card-customer-create"]:not([data-create-settled="1"])');
    if (!card || card.getAttribute('data-create-settled') === '1') return;
    const form = readCreateFormFromCard(card);
    form.regionSearch = (inputEl && inputEl.value) || '';
    form.regionPickerMode = form.regionSearch.trim() ? 'search' : 'browse';
    form.regionPickerOpen = true;
    refreshCreateCard(card, form);
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
    handleCreateRegionSearch: handleCreateRegionSearch,
    closeRegionPickerModal: closeRegionPickerModal,
    isCreateCustomerIntent: isCreateCustomerIntent,
    renderCustomerCreateCardHtml: renderCustomerCreateCardHtml,
    patchRecentSectionInDom: patchRecentSectionInDom
  };
})();
