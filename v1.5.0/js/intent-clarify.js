/**
 * 意图选择卡 · 多主功能命中时点击选择（不支持序号/语音二次识别）
 */
(function () {
  let deps = null;

  const SKILL_ORDER = [
    'followup',
    'customer-create',
    'plan',
    'quote',
    'delivery',
    'order',
    'copy',
    'change',
    'progress',
    'capacity',
    'inventory',
    'biz-analysis',
    'payment',
    'switch-customer'
  ];

  function init(api) {
    deps = api;
  }

  function isQaIntentEnabled() {
    try {
      if (typeof URLSearchParams !== 'undefined') {
        const q = new URLSearchParams(location.search).get('qaIntent');
        if (q === '0') return false;
        if (q === '1') return true;
      }
      if (localStorage.getItem('sc-use-qa-intent') === '0') return false;
    } catch (_) {}
    return true;
  }

  function sortCandidates(list) {
    return list.slice().sort(function (a, b) {
      return SKILL_ORDER.indexOf(a.id) - SKILL_ORDER.indexOf(b.id);
    });
  }

  function truncateUtterance(text, maxLen) {
    const t = (text || '').trim().replace(/\s+/g, ' ');
    if (!t) return '';
    if (t.length <= maxLen) return t;
    return t.slice(0, maxLen) + '…';
  }

  function buildLeadHtml(utterance, count) {
    const snippet = truncateUtterance(utterance, 18);
    if (snippet) {
      if (count === 2) {
        return (
          '<p class="sc-reply-lead">关于「' +
          deps.escapeHtml(snippet) +
          '」，我理解成两件事，<strong>点一下</strong>我帮您办：</p>'
        );
      }
      return (
        '<p class="sc-reply-lead">关于「' +
        deps.escapeHtml(snippet) +
        '」，可能有几种意思，<strong>先点最想办的那件</strong>：</p>'
      );
    }
    if (count === 2) {
      return '<p class="sc-reply-lead">听起来像两件事，<strong>点一下</strong>我帮您办：</p>';
    }
    return '<p class="sc-reply-lead">好像包含好几件事，<strong>先点最想办的那件</strong>：</p>';
  }

  function renderCard(utterance, candidates) {
    const sorted = sortCandidates(candidates);
    const rows = sorted
      .map(function (c) {
        return (
          '<button type="button" class="sc-list-item sc-list-item--clarify" data-action="intent-clarify-pick" data-skill-id="' +
          deps.escapeHtml(c.id) +
          '"><span class="sc-list-item__main"><span class="sc-list-item__name">' +
          deps.escapeHtml(c.name) +
          '</span></span></button>'
        );
      })
      .join('');
    return (
      buildLeadHtml(utterance, sorted.length) +
      '<div class="sc-card sc-card--intent-clarify" data-spec-id="card-intent-clarify">' +
      '<div class="sc-follow-list sc-follow-list--clarify">' +
      rows +
      '</div></div>'
    );
  }

  function showPickCard(utterance, candidates) {
    deps.advanceFlowPage();
    deps.pushAiHtml(renderCard(utterance, candidates));
    deps.scrollMessages();
    deps.persistChatHistory();
    if (window.Annotation && Annotation.scanHosts) Annotation.scanHosts();
  }

  function dispatchSwitchCustomer(opts) {
    opts = opts || {};
    if (!opts.skipAdvance) deps.advanceFlowPage();
    deps.switchActiveSkill(null, { skipSkillAnnounce: true });
    deps.state.pendingSkillRun = 'switch-customer';
    deps.pushAiHtml(deps.buildSwitchCustomerPromptHtml());
    deps.scrollMessages();
    deps.persistChatHistory();
    if (window.Annotation && Annotation.scanHosts) Annotation.scanHosts();
  }

  function dispatchSkill(skillId, opts) {
    opts = opts || {};
    if (opts.stalePick) deps.advanceFlowPage();
    if (skillId === 'switch-customer') {
      dispatchSwitchCustomer({ skipAdvance: !!opts.stalePick });
      return;
    }
    deps.runSkillEntry(skillId, { skipUserMsg: true });
  }

  function normalizePendingSkillId(pending) {
    if (!pending || pending === 'switch-customer') return pending;
    if (pending === 'write-follow') return 'followup';
    return pending;
  }

  /** 待选客户时：若用户说的是新主功能意图，应跳出选客户态 */
  function shouldBreakPendingSkillRun(text, pendingSkillRun) {
    if (!isQaIntentEnabled() || !window.IntentMatch) return false;
    const hits = window.IntentMatch.matchMainFunctions(text);
    if (!hits.length) return false;
    if (hits.length >= 2) return true;
    const pending = normalizePendingSkillId(pendingSkillRun);
    if (pending === 'switch-customer') return true;
    return hits[0].id !== pending;
  }

  function tryBreakPendingForQa(text) {
    if (!deps || !deps.state || !deps.state.pendingSkillRun) return false;
    if (!shouldBreakPendingSkillRun(text, deps.state.pendingSkillRun)) return false;
    delete deps.state.pendingSkillRun;
    return tryQaIntentRoute(text);
  }

  function tryQaIntentRoute(text) {
    if (!isQaIntentEnabled() || !window.IntentMatch) return false;
    const hits = window.IntentMatch.matchMainFunctions(text);
    if (!hits.length) return false;
    if (hits.length === 1) {
      deps.advanceFlowPage();
      dispatchSkill(hits[0].id, {});
      return true;
    }
    showPickCard(text, hits);
    return true;
  }

  function handleAction(action, btn) {
    if (action !== 'intent-clarify-pick') return false;
    const sid = btn.getAttribute('data-skill-id');
    if (!sid) return false;
    dispatchSkill(sid, { stalePick: true });
    return true;
  }

  window.IntentClarify = {
    init: init,
    isQaIntentEnabled: isQaIntentEnabled,
    shouldBreakPendingSkillRun: shouldBreakPendingSkillRun,
    tryBreakPendingForQa: tryBreakPendingForQa,
    tryQaIntentRoute: tryQaIntentRoute,
    handleAction: handleAction
  };
})();
