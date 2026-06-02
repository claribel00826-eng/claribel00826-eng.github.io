/**
 * GitHub Pages 在子路径下会展示 404.html，相对链接会叠路径（如 /v1.3.0/v1.4.0/...）。
 * 统一解析站点根后再拼版本路径。
 */
(function (global) {
  function portalBase() {
    var parts = location.pathname.split('/').filter(Boolean);
    while (parts.length) {
      var last = parts[parts.length - 1];
      if (last === 'index.html' || /^v\d+\.\d+\.\d+$/.test(last)) {
        parts.pop();
        continue;
      }
      break;
    }
    return parts.length ? '/' + parts.join('/') + '/' : '/';
  }

  function portalHref(relative) {
    if (!relative) return portalBase();
    if (/^https?:\/\//i.test(relative) || relative.charAt(0) === '#') return relative;
    if (relative.charAt(0) === '/') return relative;
    return portalBase() + relative.replace(/^\//, '');
  }

  function fixPortalLinks(root) {
    var scope = root || document;
    scope.querySelectorAll('[data-portal-href]').forEach(function (el) {
      el.setAttribute('href', portalHref(el.getAttribute('data-portal-href')));
    });
    scope.querySelectorAll('.version-card__links a[href], .portal__shared a[href]').forEach(function (a) {
      var href = a.getAttribute('href');
      if (!href || /^https?:\/\//i.test(href) || href.charAt(0) === '#' || href.charAt(0) === '/') return;
      a.setAttribute('href', portalHref(href));
    });
  }

  global.PortalBase = { base: portalBase, href: portalHref, fixLinks: fixPortalLinks };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      fixPortalLinks(document);
    });
  } else {
    fixPortalLinks(document);
  }
})(window);
