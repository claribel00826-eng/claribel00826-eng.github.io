/* 通用提示 / 确认弹窗 · PC QA 维护 */
(function () {
  'use strict';

  var modal;
  var titleEl;
  var messageEl;
  var listEl;
  var iconEl;
  var cancelBtn;
  var confirmBtn;
  var resolveFn = null;
  var mode = 'alert';

  var TYPE_META = {
    info: { title: '提示', icon: 'i' },
    success: { title: '操作成功', icon: '✓' },
    warning: { title: '请注意', icon: '!' },
    error: { title: '出错了', icon: '×' }
  };

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function normalizeOptions(message, options) {
    var opts = options || {};
    if (typeof options === 'string') {
      opts = { title: options };
    }
    if (typeof message === 'string') {
      opts.message = message;
    } else if (message && typeof message === 'object') {
      opts = Object.assign({}, message);
    }
    return opts;
  }

  function renderMessage(message) {
    var text = message == null ? '' : String(message);
    var lines = text.split('\n').map(function (line) {
      return line.trim();
    }).filter(Boolean);

    if (!lines.length) {
      messageEl.innerHTML = '';
      messageEl.hidden = true;
      listEl.hidden = true;
      listEl.innerHTML = '';
      return;
    }

    if (lines.length === 1) {
      messageEl.innerHTML = escapeHtml(lines[0]);
      messageEl.hidden = false;
      listEl.hidden = true;
      listEl.innerHTML = '';
      return;
    }

    messageEl.hidden = true;
    listEl.hidden = false;
    listEl.innerHTML = lines
      .map(function (line) {
        return '<li>' + escapeHtml(line) + '</li>';
      })
      .join('');
  }

  function setConfirmDanger(isDanger) {
    confirmBtn.classList.toggle('btn--primary', !isDanger);
    confirmBtn.classList.toggle('btn--danger-primary', !!isDanger);
  }

  function openDialog(options) {
    if (!modal) init();

    mode = options.mode || 'alert';
    var type = options.type || (mode === 'confirm' ? 'warning' : 'info');
    var meta = TYPE_META[type] || TYPE_META.info;

    titleEl.textContent = options.title || meta.title;
    iconEl.textContent = meta.icon;
    iconEl.className = 'dialog-icon dialog-icon--' + type;

    renderMessage(options.message);

    var isConfirm = mode === 'confirm';
    cancelBtn.hidden = !isConfirm;
    cancelBtn.textContent = options.cancelText || '取消';
    confirmBtn.textContent = options.confirmText || (isConfirm ? '确定' : '知道了');
    setConfirmDanger(isConfirm && options.danger);

    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    confirmBtn.focus();

    return new Promise(function (resolve) {
      resolveFn = resolve;
    });
  }

  function closeDialog(result) {
    if (!modal) return;
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    setConfirmDanger(false);
    if (resolveFn) {
      var fn = resolveFn;
      resolveFn = null;
      fn(result);
    }
  }

  function alert(message, options) {
    var opts = normalizeOptions(message, options);
    opts.mode = 'alert';
    if (typeof message === 'string') opts.message = message;
    return openDialog(opts).then(function () {});
  }

  function confirm(message, options) {
    var opts = normalizeOptions(message, options);
    opts.mode = 'confirm';
    if (typeof message === 'string') opts.message = message;
    return openDialog(opts).then(function (result) {
      return !!result;
    });
  }

  function onKeydown(e) {
    if (!modal || !modal.classList.contains('is-open')) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      closeDialog(mode === 'confirm' ? false : undefined);
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      closeDialog(mode === 'confirm' ? true : undefined);
    }
  }

  function init() {
    modal = document.getElementById('modal-dialog');
    titleEl = document.getElementById('dialog-title');
    messageEl = document.getElementById('dialog-message');
    listEl = document.getElementById('dialog-list');
    iconEl = document.getElementById('dialog-icon');
    cancelBtn = document.getElementById('dialog-cancel');
    confirmBtn = document.getElementById('dialog-confirm');

    cancelBtn.addEventListener('click', function () {
      closeDialog(false);
    });
    confirmBtn.addEventListener('click', function () {
      closeDialog(mode === 'confirm' ? true : undefined);
    });
    modal.addEventListener('click', function (e) {
      if (e.target === modal) {
        closeDialog(mode === 'confirm' ? false : undefined);
      }
    });
    document.addEventListener('keydown', onKeydown);
  }

  window.QaDialog = {
    alert: alert,
    confirm: confirm,
    init: init
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
