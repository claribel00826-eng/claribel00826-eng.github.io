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
        '<p class="sc-spec-panel__meta"><code>' +
        esc(id) +
        '</code> 未列入 <strong>' +
        esc(scopeLabel() || '当前版本') +
        '</strong> 的 <code>annotation-spec-scope.js</code>。</p>' +
        '<p class="sc-spec-panel__sub">请查阅本版本 <code>annotation-docs/</code> 映射表，或切换至包含该模块的版本目录验收。</p>';
      return;
    }
    const spec = getSpec(id);
    if (!spec) {
      body.innerHTML = '<p>未配置业务标注：<code>' + esc(id) + '</code></p>';
      return;
    }
    let html = '<p class="sc-spec-panel__title">' + esc(spec.name) + '</p>';
    html += '<p class="sc-spec-panel__meta">文档模块 ' + esc(spec.module) + ' · <code>' + esc(id) + '</code></p>';
    if (spec.content && spec.content.length) {
      html += '<p class="sc-spec-panel__label">内容</p><ul class="sc-spec-panel__ul">';
      spec.content.forEach((line) => {
        html += '<li>' + esc(line) + '</li>';
      });
      html += '</ul>';
    }
    if (spec.query && spec.query.length) {
      html += '<p class="sc-spec-panel__label">查询逻辑</p><ul class="sc-spec-panel__ul">';
      spec.query.forEach((line) => {
        html += '<li>' + esc(line) + '</li>';
      });
      html += '</ul>';
    }
    if (spec.interaction && spec.interaction.length) {
      html += '<p class="sc-spec-panel__label">交互逻辑</p><ul class="sc-spec-panel__ul">';
      spec.interaction.forEach((line) => {
        html += '<li>' + esc(line) + '</li>';
      });
      html += '</ul>';
    }
    if (spec.dataRules && isInScope('data-rules-followup') && getSpec('data-rules-followup')) {
      const dr = getSpec('data-rules-followup');
      if (dr.query && dr.query.length) {
        html += '<p class="sc-spec-panel__label">' + esc(dr.name) + '</p><ul class="sc-spec-panel__ul">';
        dr.query.forEach((line) => {
          html += '<li>' + esc(line) + '</li>';
        });
        html += '</ul>';
      }
    }
    if (spec.extraHtml) html += spec.extraHtml;
    body.innerHTML = html;
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

  function shouldAttachSpecPin(host) {
    if (!host) return false;
    if (host.hasAttribute('data-spec-pin-root')) return true;
    return isInnermostSpecHost(host);
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
    btn.setAttribute('aria-label', '查看' + (specMeta && specMeta.name ? specMeta.name : id) + '标注');
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
    btn.setAttribute('aria-label', '查看大模型意图分配标注');
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
      '<p>点击各模块 <strong>标注</strong> 查看交互说明；底部 <strong>意图</strong> 为槽位路由：已读到 → 跳转 → 表单字段（文档 00）。</p>';
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

  return { init, isOn, toggle, setOn, applyMode, renderPanelBody, scanHosts, isInScope };
})();
