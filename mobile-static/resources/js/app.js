/**
 * 静态原型公共脚本：file:// 下用相对路径跳转，无构建、无服务。
 */
(function () {
  document.querySelectorAll('[data-href]').forEach(function (el) {
    el.addEventListener('click', function (e) {
      var href = el.getAttribute('data-href')
      if (!href) return
      if (el.tagName === 'A') return
      e.preventDefault()
      location.href = href
    })
  })
})()
