/**
 * 统一解析站点根路径，避免 GitHub Pages / 本地预览 / file:// 下「回到索引页」跳错。
 * - 版本演示：vX.Y.Z/index.html → 根目录 index.html（版本选择页）
 * - 子目录（如 annotation-docs）向上回溯到版本目录之上
 */
(function (global) {
  var VERSION_RE = /^v\d+\.\d+\.\d+$/;
  var PORTAL_SUBDIRS = ['annotation-docs', 'docs'];

  function pathnameParts() {
    var path = (location.pathname || '').replace(/\\/g, '/');
    return path.split('/').filter(Boolean);
  }

  function popTrailingHtml(parts) {
    if (parts.length && /\.html?$/i.test(parts[parts.length - 1])) {
      parts.pop();
    }
  }

  /** 站点根前缀（含末尾 /），用于拼接 v1.4.0/index.html 等 */
  function portalBase() {
    var parts = pathnameParts();
    while (parts.length) {
      var last = parts[parts.length - 1];
      if (last === 'index.html' || VERSION_RE.test(last)) {
        parts.pop();
        continue;
      }
      break;
    }
    return parts.length ? '/' + parts.join('/') + '/' : '/';
  }

  /** 版本选择页 index.html 的绝对路径 */
  function portalIndexHref() {
    if (location.protocol === 'file:') {
      var path = (location.pathname || '').replace(/\\/g, '/');
      if (/\/annotation-docs\//i.test(path)) {
        return '../../index.html';
      }
      if (/\/v\d+\.\d+\.\d+/.test(path)) {
        return '../index.html';
      }
      if (document.querySelector('.sc-demo-shell')) {
        return '../index.html';
      }
      return 'index.html';
    }

    var parts = pathnameParts();
    popTrailingHtml(parts);
    while (parts.length) {
      var last = parts[parts.length - 1];
      if (VERSION_RE.test(last) || PORTAL_SUBDIRS.indexOf(last) >= 0) {
        parts.pop();
        continue;
      }
      break;
    }
    var base = parts.length ? '/' + parts.join('/') + '/' : '/';
    return base + 'index.html';
  }

  function portalHref(relative) {
    if (!relative) return portalBase();
    if (/^https?:\/\//i.test(relative) || relative.charAt(0) === '#') return relative;
    if (relative === '@portal' || relative === '@index') return portalIndexHref();
    if (relative.charAt(0) === '/') return relative;
    if (relative.indexOf('../') === 0 || relative.indexOf('./') === 0) {
      try {
        return new URL(relative, location.href).pathname;
      } catch (e) {
        return portalBase() + relative.replace(/^\//, '');
      }
    }
    return portalBase() + relative.replace(/^\//, '');
  }

  function fixPortalLinks(root) {
    var scope = root || document;
    scope.querySelectorAll('[data-portal-href]').forEach(function (el) {
      var rel = el.getAttribute('data-portal-href');
      if (
        rel === '@portal' ||
        rel === '@index' ||
        (rel === 'index.html' && el.classList.contains('sc-demo-reset-btn--link'))
      ) {
        el.setAttribute('href', portalIndexHref());
      } else {
        el.setAttribute('href', portalHref(rel));
      }
    });
    scope.querySelectorAll('.version-card__links a[href], .portal__shared a[href]').forEach(function (a) {
      var href = a.getAttribute('href');
      if (!href || /^https?:\/\//i.test(href) || href.charAt(0) === '#' || href.charAt(0) === '/') return;
      a.setAttribute('href', portalHref(href));
    });
  }

  global.PortalBase = {
    base: portalBase,
    href: portalHref,
    indexHref: portalIndexHref,
    fixLinks: fixPortalLinks
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      fixPortalLinks(document);
    });
  } else {
    fixPortalLinks(document);
  }
})(window);
