/** 静态 HTML 单文件包在 file:// 与 IDE 预览 iframe 下的环境处理 */

function isFileProtocol(): boolean {
  return typeof window !== 'undefined' && window.location.protocol === 'file:'
}

/** IDE 内置预览常在 iframe 中打开 file://，Hash 路由会异常；尝试跳出到顶层 */
export function escapeFilePreviewFrame(): boolean {
  if (typeof window === 'undefined' || !isFileProtocol()) return false
  try {
    if (window.self !== window.top) {
      window.top!.location.href = window.location.href
      return true
    }
  } catch {
    return true
  }
  return false
}

/** file:// 下默认落到 Hash 首页，避免空白页 */
export function ensureFileHashHome(): void {
  if (typeof window === 'undefined' || !isFileProtocol()) return
  const hash = window.location.hash
  if (!hash || hash === '#') {
    window.location.replace(`${window.location.pathname}${window.location.search}#/`)
  }
}
