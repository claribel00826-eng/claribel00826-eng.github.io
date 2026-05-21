window.Annotation = (function () {
  const STORAGE_KEY = 'sc_spec';
  const STORAGE_KEY_PANEL_WIDTH = 'sc_spec_panel_width';
  const STORAGE_KEY_PANEL_HEIGHT = 'sc_spec_panel_height';
  const PANEL_WIDTH_DEFAULT = 560;
  const PANEL_WIDTH_MIN = 320;
  const PANEL_WIDTH_MAX = 920;
  const PANEL_HEIGHT_MIN = 160;
  const PANEL_HEIGHT_MAX_VH = 85;
  let highlighted = null;

  function isOn() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === '1') return true;
    if (stored === '0') return false;
    return new URLSearchParams(location.search).get('spec') === '1';
  }

  function stripSpecFromUrl() {
    const url = new URL(location.href);
    if (!url.searchParams.has('spec')) return;
    url.searchParams.delete('spec');
    const qs = url.searchParams.toString();
    history.replaceState(null, '', url.pathname + (qs ? '?' + qs : '') + url.hash);
  }

  function setOn(on) {
    if (on) {
      localStorage.setItem(STORAGE_KEY, '1');
    } else {
      localStorage.setItem(STORAGE_KEY, '0');
      stripSpecFromUrl();
    }
    applyMode();
  }

  function toggle() {
    setOn(!isOn());
  }

  function esc(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  /** 合并 content + query + interaction（无【】的交互行自动加【操作】）；行首【标题】高亮 */
  function specDetailLines(spec) {
    if (!spec) return [];
    const lines = [];
    if (spec.content && spec.content.length) lines.push.apply(lines, spec.content);
    if (spec.query && spec.query.length) lines.push.apply(lines, spec.query);
    if (spec.interaction && spec.interaction.length) {
      spec.interaction.forEach(function (line) {
        const t = (line || '').trim();
        if (!t) return;
        lines.push(/^【/.test(t) ? t : '【操作】' + t);
      });
    }
    return lines;
  }

  function parentKickerLabel(kicker) {
    if (!kicker) return '';
    return kicker.replace(/^【|】$/g, '');
  }

  /** 子行去掉与父区块重复的「推荐区·」等前缀 */
  function normalizeSpecSubLine(sub, parentKicker) {
    const t = (sub || '').trim();
    if (!t || !parentKicker) return t;
    const label = parentKickerLabel(parentKicker);
    const dotted = label + '·';
    if (t.indexOf(dotted) === 0) return t.slice(dotted.length);
    return t;
  }

  function formatSpecSubLine(line) {
    const t = (line || '').trim();
    const m = /^([^：\n]{2,16})(：)([\s\S]*)$/.exec(t);
    if (m) {
      return (
        '<span class="sc-spec-sub-kicker">' +
        esc(m[1] + m[2]) +
        '</span>' +
        esc(m[3])
      );
    }
    return esc(t);
  }

  /** 【标题】后正文整段同级展示；分号仅作句内停顿，不拆缩进子列表。真子级用无【】的独立数组行。 */
  function splitKickerLead(line) {
    const km = /^【[^】]+】/.exec(line || '');
    if (!km) return { kicker: null, lead: line || '', subs: [] };
    const rest = (line || '').slice(km[0].length).trim();
    return { kicker: km[0], lead: rest, subs: [] };
  }

  function normalizeSpecSubs(subs, parentKicker) {
    return (subs || []).map(function (s) {
      return normalizeSpecSubLine(s, parentKicker);
    });
  }

  function isSpecDetailSubLine(line) {
    return line && !/^【/.test(line);
  }

  /** 按【区块】分组；无【】的续行归入上一区块子列表 */
  function buildSpecDetailGroups(lines) {
    const groups = [];
    (lines || []).forEach(function (line) {
      const t = (line || '').trim();
      if (!t) return;
      const km = /^【[^】]+】/.exec(t);
      if (km) {
        const chunk = splitKickerLead(t);
        groups.push({
          kicker: chunk.kicker,
          lead: chunk.lead,
          subs: normalizeSpecSubs(chunk.subs, chunk.kicker)
        });
        return;
      }
      if (groups.length && isSpecDetailSubLine(t)) {
        const parent = groups[groups.length - 1].kicker;
        groups[groups.length - 1].subs.push(normalizeSpecSubLine(t, parent));
        return;
      }
      groups.push({ kicker: null, lead: t, subs: [] });
    });
    return groups;
  }

  function renderSpecDetailGroups(groups) {
    let html = '<ul class="sc-spec-panel__ul sc-spec-detail">';
    groups.forEach(function (g) {
      html += '<li class="sc-spec-block">';
      if (g.kicker) {
        html +=
          '<p class="sc-spec-block__head"><strong class="sc-spec-kicker">' +
          esc(g.kicker) +
          '</strong>';
        if (g.lead) html += esc(g.lead);
        html += '</p>';
      } else if (g.lead) {
        html += '<p class="sc-spec-block__head">' + esc(g.lead) + '</p>';
      }
      if (g.subs && g.subs.length) {
        html += '<ul class="sc-spec-panel__subul">';
        g.subs.forEach(function (sub) {
          html += '<li>' + formatSpecSubLine(sub) + '</li>';
        });
        html += '</ul>';
      }
      html += '</li>';
    });
    html += '</ul>';
    return html;
  }

  function renderGlobalNotesHtml() {
    const g = window.AnnotationSpecGlobal;
    if (!g || !g.notes || !g.notes.length) return '';
    let html = '<div class="sc-spec-global">';
    html += '<p class="sc-spec-panel__label">' + esc(g.title || '全局说明') + '</p>';
    html += renderSpecDetailGroups(buildSpecDetailGroups(g.notes));
    html += '</div>';
    return html;
  }

  function appendDetailListHtml(html, lines, label) {
    if (!lines || !lines.length) return html;
    html +=
      '<p class="sc-spec-panel__label">' +
      esc(label || '业务说明') +
      '</p>' +
      renderSpecDetailGroups(buildSpecDetailGroups(lines));
    return html;
  }

  function getScope() {
    return window.AnnotationSpecScope || null;
  }

  function isInScope(id) {
    const scope = getScope();
    if (!scope || !scope.ids || !scope.ids.length) return true;
    return scope.ids.indexOf(id) >= 0;
  }

  function scopeLabel() {
    const scope = getScope();
    return scope ? scope.label || scope.version || '' : '';
  }

  function scopeDocsSummary() {
    const scope = getScope();
    if (!scope || !scope.docs || !scope.docs.length) return '';
    return scope.docs
      .map(function (d) {
        return d.id + '·' + d.title;
      })
      .join('、');
  }

  function updatePanelHead() {
    const titleEl = document.querySelector('.sc-spec-panel__head-title');
    if (!titleEl) return;
    const label = scopeLabel();
    titleEl.textContent = label ? '设计标注 · ' + label : '设计标注';
  }

  function isMobileSpecLayout() {
    return window.matchMedia('(max-width: 640px)').matches;
  }

  function clamp(n, min, max) {
    return Math.min(max, Math.max(min, n));
  }

  function applyPanelWidth(px) {
    const w = clamp(px, PANEL_WIDTH_MIN, PANEL_WIDTH_MAX);
    document.documentElement.style.setProperty('--sc-spec-panel-width', w + 'px');
    localStorage.setItem(STORAGE_KEY_PANEL_WIDTH, String(w));
    return w;
  }

  function applyPanelHeight(px) {
    const maxH = Math.round((window.innerHeight * PANEL_HEIGHT_MAX_VH) / 100);
    const h = clamp(px, PANEL_HEIGHT_MIN, maxH);
    document.documentElement.style.setProperty('--sc-spec-panel-height', h + 'px');
    localStorage.setItem(STORAGE_KEY_PANEL_HEIGHT, String(h));
    return h;
  }

  function restorePanelSize() {
    const w = parseInt(localStorage.getItem(STORAGE_KEY_PANEL_WIDTH), 10);
    if (!isNaN(w)) applyPanelWidth(w);
    const h = parseInt(localStorage.getItem(STORAGE_KEY_PANEL_HEIGHT), 10);
    if (!isNaN(h)) applyPanelHeight(h);
  }

  function initPanelResize() {
    const panel = document.getElementById('spec-panel');
    if (!panel || panel.dataset.resizeBound) return;
    panel.dataset.resizeBound = '1';

    let handle = panel.querySelector('.sc-spec-panel__resize');
    if (!handle) {
      handle = document.createElement('div');
      handle.className = 'sc-spec-panel__resize';
      handle.setAttribute('role', 'separator');
      handle.setAttribute('aria-label', '拖动调整标注面板大小');
      panel.insertBefore(handle, panel.firstChild);
    }

    restorePanelSize();

    function startDrag(clientX, clientY) {
      const mobile = isMobileSpecLayout();
      const startX = clientX;
      const startY = clientY;
      const startW = panel.getBoundingClientRect().width;
      const startH = panel.getBoundingClientRect().height;
      handle.classList.add('is-dragging');
      document.body.classList.add('sc-spec-resizing');

      function onMove(cx, cy) {
        if (mobile) {
          applyPanelHeight(startH + (startY - cy));
        } else {
          applyPanelWidth(startW + (startX - cx));
        }
      }

      function endDrag() {
        handle.classList.remove('is-dragging');
        document.body.classList.remove('sc-spec-resizing');
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', endDrag);
        document.removeEventListener('touchmove', onTouchMove);
        document.removeEventListener('touchend', endDrag);
        document.removeEventListener('touchcancel', endDrag);
      }

      function onMouseMove(e) {
        e.preventDefault();
        onMove(e.clientX, e.clientY);
      }

      function onTouchMove(e) {
        if (!e.touches.length) return;
        e.preventDefault();
        onMove(e.touches[0].clientX, e.touches[0].clientY);
      }

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', endDrag);
      document.addEventListener('touchmove', onTouchMove, { passive: false });
      document.addEventListener('touchend', endDrag);
      document.addEventListener('touchcancel', endDrag);
    }

    handle.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      startDrag(e.clientX, e.clientY);
    });

    handle.addEventListener(
      'touchstart',
      (e) => {
        if (!e.touches.length) return;
        e.preventDefault();
        e.stopPropagation();
        startDrag(e.touches[0].clientX, e.touches[0].clientY);
      },
      { passive: false }
    );

    handle.addEventListener('dblclick', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (isMobileSpecLayout()) {
        applyPanelHeight(Math.round(window.innerHeight * 0.42));
      } else {
        applyPanelWidth(PANEL_WIDTH_DEFAULT);
      }
    });
  }

  function getSpec(id) {
    return (window.AnnotationSpecData && window.AnnotationSpecData[id]) || null;
  }

  function renderPanelBody(id) {
    const body = document.getElementById('spec-panel-body');
    if (!body) return;
    body.dataset.touched = '1';
    if (!isInScope(id)) {
      body.innerHTML =
        '<p class="sc-spec-panel__title">不在本版本标注范围</p>' +
        '<p class="sc-spec-panel__meta">当前为 <strong>' +
        esc(scopeLabel() || '本版本') +
        '</strong>，该模块未纳入本版标注验收清单。</p>' +
        '<p class="sc-spec-panel__sub">请查阅本版本标注文档中的映射表，或切换到包含该模块的产品版本验收。</p>';
      return;
    }
    const spec = getSpec(id);
    if (!spec) {
      body.innerHTML = '<p class="sc-spec-panel__title">未配置业务标注</p><p class="sc-spec-panel__meta">该模块尚未写入标注数据，请联系产品补充文档。</p>';
      return;
    }
    let html = '<p class="sc-spec-panel__title">' + esc(spec.name) + '</p>';
    html += '<p class="sc-spec-panel__meta">文档章节 ' + esc(spec.module) + ' · 本版验收模块</p>';
    html += renderGlobalNotesHtml();
    html = appendDetailListHtml(html, specDetailLines(spec));
    if (id === 'chat-messages' && isInScope('data-rules-chat-flow') && getSpec('data-rules-chat-flow')) {
      const dr = getSpec('data-rules-chat-flow');
      const drLines = specDetailLines(dr);
      if (drLines.length) {
        html = appendDetailListHtml(html, drLines, dr.name);
      }
    }
    if (id === 'chat-llm' && window.AnnotationIntentFlows) {
      html += window.AnnotationIntentFlows.getHtml();
    } else if (spec.extraHtml) {
      html += spec.extraHtml;
    }
    body.innerHTML = html;
    if (id === 'chat-llm' && typeof mermaid !== 'undefined') {
      const blocks = body.querySelectorAll('pre.mermaid');
      if (blocks.length) {
        mermaid.run({ nodes: blocks }).catch(function () {});
      }
    }
  }

  function highlight(el) {
    if (highlighted) highlighted.classList.remove('sc-spec-highlight');
    highlighted = el;
    if (el) el.classList.add('sc-spec-highlight');
  }

  function isInnermostSpecHost(el) {
    if (!el || !el.querySelectorAll) return false;
    const nested = el.querySelectorAll('[data-spec-id]');
    for (let i = 0; i < nested.length; i++) {
      if (nested[i] !== el) return false;
    }
    return true;
  }

  /** 仅当「直接父节点」为 pin-root 时不挂钉（如抽屉内的语音条）；不阻断更深层业务卡 */
  function hasSpecPinRootParent(host) {
    const parent = host && host.parentElement;
    return !!(parent && parent.hasAttribute && parent.hasAttribute('data-spec-pin-root'));
  }

  function isMessagesBusinessCard(host) {
    const id = host && host.getAttribute('data-spec-id');
    if (!id || !isInScope(id)) return false;
    if (!host.classList || !host.classList.contains('sc-card')) return false;
    return !!host.closest('#messages');
  }

  function shouldAttachSpecPin(host) {
    if (!host) return false;
    if (host.hasAttribute('data-spec-pin-root')) return true;
    if (hasSpecPinRootParent(host)) return false;
    if (isMessagesBusinessCard(host)) return true;
    return isInnermostSpecHost(host);
  }

  function rescanSpecPins() {
    if (!isOn() || !window.AnnotationSpecData) return;
    document.querySelectorAll('[data-spec-id]').forEach((el) => {
      delete el.dataset.specBtnBound;
    });
    document.querySelectorAll('.sc-dock').forEach((d) => {
      delete d.dataset.llmSpecBound;
    });
    scanHosts();
  }

  function attachButton(host) {
    if (!host || host.dataset.specBtnBound) return;
    const id = host.getAttribute('data-spec-id');
    if (!id || !isInScope(id)) return;
    if (!shouldAttachSpecPin(host)) return;

    host.classList.add('sc-spec-pin-host');
    host.dataset.specBtnBound = '1';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'sc-spec-pin';
    btn.textContent = '标注';
    const specMeta = getSpec(id);
    btn.setAttribute('aria-label', '查看' + (specMeta && specMeta.name ? specMeta.name : '该模块') + '标注');
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      renderPanelBody(id);
      highlight(host);
    });
    host.appendChild(btn);
  }

  function attachLlmButton() {
    if (!isInScope('chat-llm')) return;
    const dock = document.querySelector('.sc-dock');
    if (!dock || dock.dataset.llmSpecBound) return;
    if (!getSpec('chat-llm')) return;
    dock.dataset.llmSpecBound = '1';
    dock.classList.add('sc-spec-pin-host', 'sc-spec-pin-host--dock');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'sc-spec-pin sc-spec-pin--llm';
    btn.textContent = '意图';
    btn.setAttribute('aria-label', '查看意图路由标注');
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      renderPanelBody('chat-llm');
      highlight(null);
    });
    dock.appendChild(btn);
  }

  function scanHosts() {
    if (!isOn()) return;
    document.querySelectorAll('[data-spec-id]').forEach((el) => {
      attachButton(el);
    });
    attachLlmButton();
  }

  function defaultPanelIntro() {
    const docs = scopeDocsSummary();
    const label = scopeLabel();
    let html = '';
    if (label) {
      html +=
        '<p class="sc-spec-scope-banner"><strong>设计标注 · ' +
        esc(label) +
        '</strong></p>';
      if (docs) {
        html += '<p class="sc-spec-panel__sub">本版本文档：' + esc(docs) + '。仅范围内模块显示「标注」钉。</p>';
      }
    }
    html +=
      '<p>点击各模块 <strong>标注</strong> 查看流程逻辑；底部 <strong>意图</strong> 说明输入识别、字段合并与缺槽引导规则。</p>';
    return html;
  }

  function ensureOpenButton() {
    let btn = document.getElementById('spec-open');
    if (btn) return btn;
    btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'spec-open';
    btn.className = 'sc-spec-open sc-hidden';
    btn.textContent = '标注';
    btn.setAttribute('aria-label', '开启设计标注');
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      setOn(true);
    });
    document.body.appendChild(btn);
    return btn;
  }

  function shouldShowSpecOpen() {
    return !isOn();
  }

  function applyMode() {
    const on = isOn();
    updatePanelHead();
    document.body.classList.toggle('sc-spec-on', on);
    const closeBtn = document.getElementById('spec-close');
    const openBtn = ensureOpenButton();
    if (closeBtn) closeBtn.classList.toggle('sc-hidden', !on);
    if (openBtn) openBtn.classList.toggle('sc-hidden', on || !shouldShowSpecOpen());
    const toolbarBtn =
      document.getElementById('btn-spec-toggle') ||
      document.querySelector('.sc-demo-toolbar .sc-demo-spec-btn');
    if (toolbarBtn) {
      toolbarBtn.textContent = on ? '关闭标注' : '设计标注';
      toolbarBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
      toolbarBtn.classList.toggle('sc-demo-spec-btn--on', on);
    }
    if (!on) {
      document.querySelectorAll('.sc-spec-pin').forEach((b) => b.remove());
      document.querySelectorAll('.sc-spec-pin-host').forEach((h) => {
        h.classList.remove('sc-spec-pin-host', 'sc-spec-pin-host--dock');
        delete h.dataset.specBtnBound;
      });
      document.querySelectorAll('.sc-dock').forEach((d) => {
        delete d.dataset.llmSpecBound;
      });
      if (highlighted) {
        highlighted.classList.remove('sc-spec-highlight');
        highlighted = null;
      }
      return;
    }
    scanHosts();
    const body = document.getElementById('spec-panel-body');
    if (body && !body.dataset.touched) {
      body.innerHTML = defaultPanelIntro();
    }
  }

  function bindToolbarToggle() {
    const toolbarBtn =
      document.getElementById('btn-spec-toggle') ||
      document.querySelector('.sc-demo-toolbar .sc-demo-spec-btn');
    if (!toolbarBtn || toolbarBtn.dataset.bound) return;
    toolbarBtn.dataset.bound = '1';
    toolbarBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggle();
    });
  }

  function initSpecToggle() {
    ensureOpenButton();
    bindToolbarToggle();
    const closeBtn = document.getElementById('spec-close');
    if (closeBtn && !closeBtn.dataset.bound) {
      closeBtn.dataset.bound = '1';
      closeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        setOn(false);
      });
    }
    const legacyBanner = document.getElementById('spec-banner');
    if (legacyBanner) legacyBanner.remove();
  }

  let inited = false;

  function init() {
    if (inited) {
      applyMode();
      return;
    }
    inited = true;
    initSpecToggle();
    initPanelResize();
    const params = new URLSearchParams(location.search);
    if (params.get('spec') === '1') {
      localStorage.setItem(STORAGE_KEY, '1');
    } else if (params.get('spec') === '0') {
      localStorage.setItem(STORAGE_KEY, '0');
    } else if (/\.github\.io$/i.test(location.hostname) && localStorage.getItem(STORAGE_KEY) === null) {
      localStorage.setItem(STORAGE_KEY, '1');
    }
    applyMode();
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && isOn()) scanHosts();
    });
    document.addEventListener('keydown', (e) => {
      if (e.altKey && (e.key === 'd' || e.key === 'D')) {
        e.preventDefault();
        toggle();
      }
    });
    let scanTimer = 0;
    const obs = new MutationObserver(() => {
      if (!isOn()) return;
      clearTimeout(scanTimer);
      scanTimer = setTimeout(scanHosts, 80);
    });
    obs.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return { init, isOn, toggle, setOn, applyMode, renderPanelBody, scanHosts, rescanSpecPins, isInScope };
})();
