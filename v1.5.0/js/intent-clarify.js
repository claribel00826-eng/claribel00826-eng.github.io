/**
 * 意图选择卡 · 多主功能 / 功能+知识 混命中时点击选择（不支持序号/语音二次识别）
 * 知识至多取 1 条；与功能同时命中时：卡内上文案、下「若您要办理，可点选」+ 功能列表
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

  /** 知识至多 1 条 */
  function firstKnowledge(text) {
    if (!window.IntentMatch || !IntentMatch.matchKnowledge) return null;
    const kHits = IntentMatch.matchKnowledge(text);
    if (!kHits.length) return null;
    return kHits[0];
  }

  function buildLeadHtml(utterance, count, hasKnowledge) {
    if (hasKnowledge) return '';
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

  function renderFunctionRows(candidates) {
    return sortCandidates(candidates)
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
  }

  /**
   * @param {string} utterance
   * @param {Array<{id:string,name:string}>} candidates
   * @param {{text?:string}|null} knowledge
   */
  function renderCard(utterance, candidates, knowledge) {
    const sorted = sortCandidates(candidates);
    const hasKnowledge = !!(knowledge && knowledge.text);
    const rows = renderFunctionRows(sorted);
    let body = '';
    if (hasKnowledge) {
      body +=
        '<div class="sc-intent-clarify__knowledge">' +
        deps.escapeHtml(knowledge.text) +
        '</div>' +
        '<p class="sc-intent-clarify__action-hint">若您要办理，可点选：</p>';
    }
    body += '<div class="sc-follow-list sc-follow-list--clarify">' + rows + '</div>';
    return (
      buildLeadHtml(utterance, sorted.length, hasKnowledge) +
      '<div class="sc-card sc-card--intent-clarify' +
      (hasKnowledge ? ' sc-card--intent-clarify-mixed' : '') +
      '" data-spec-id="card-intent-clarify">' +
      body +
      '</div>'
    );
  }

  function showPickCard(utterance, candidates, knowledge) {
    deps.advanceFlowPage();
    deps.pushAiHtml(renderCard(utterance, candidates, knowledge || null));
    deps.scrollMessages();
    deps.persistChatHistory();
    if (window.Annotation && Annotation.scanHosts) Annotation.scanHosts();
  }

  function pushKnowledgeReply(text) {
    deps.advanceFlowPage();
    deps.pushAiHtml(
      '<p class="sc-reply-lead sc-reply-lead--knowledge">' + deps.escapeHtml(text || '') + '</p>'
    );
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
    if (firstKnowledge(text)) return true;
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
    const knowledge = firstKnowledge(text);

    if (hits.length && knowledge) {
      showPickCard(text, hits, knowledge);
      return true;
    }
    if (hits.length) {
      if (hits.length === 1) {
        deps.advanceFlowPage();
        dispatchSkill(hits[0].id, {});
        return true;
      }
      showPickCard(text, hits, null);
      return true;
    }
    if (knowledge) {
      pushKnowledgeReply(knowledge.text || '');
      return true;
    }
    return false;
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
