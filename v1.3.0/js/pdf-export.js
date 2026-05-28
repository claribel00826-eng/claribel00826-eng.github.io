/**
 * 方案 / 报价单预览 · 下载与转发（纯前端演示）
 * 优先 CDN：html2canvas + jspdf → .pdf；否则下载自包含 .html
 */
window.PdfExport = (function () {
  const DOC_STYLES =
    'body{margin:0;padding:24px;font-family:"PingFang SC","Microsoft YaHei",sans-serif;background:#fff;color:#18181b}' +
    '.sc-pdf-doc{max-width:720px;margin:0 auto;font-size:13px;line-height:1.45}' +
    '.sc-pdf-doc__title{margin:0 0 8px;font-size:18px;font-weight:700;text-align:center}' +
    '.sc-pdf-doc__meta{margin:0 0 4px;font-size:12px;color:#71717a}' +
    '.sc-pdf-doc__table{width:100%;margin:14px 0;border-collapse:collapse;font-size:12px}' +
    '.sc-pdf-doc__table th,.sc-pdf-doc__table td{border:1px solid #e4e4e7;padding:6px 4px}' +
    '.sc-pdf-doc__table th{background:#f8f8fa;font-weight:600}' +
    '.sc-pdf-doc__num{text-align:right}' +
    '.sc-pdf-doc__foot{margin-top:12px;padding-top:10px;border-top:1px solid #e4e4e7}' +
    '.sc-pdf-doc__total{margin:0;text-align:right;font-size:15px}' +
    '.sc-pdf-doc__note{margin:0;text-align:right;font-size:12px;color:#71717a}';

  function getDocEl() {
    return document.querySelector('#pdf-body .sc-pdf-doc');
  }

  function libsReady() {
    return typeof html2canvas === 'function' && window.jspdf && window.jspdf.jsPDF;
  }

  async function renderPdfBlob(docEl) {
    const canvas = await html2canvas(docEl, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false
    });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new window.jspdf.jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    let leftHeight = imgHeight;
    let position = 0;
    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    leftHeight -= pageHeight;
    while (leftHeight > 0) {
      position = leftHeight - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      leftHeight -= pageHeight;
    }
    return pdf.output('blob');
  }

  function triggerDownload(blob, filename) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 200);
  }

  function downloadHtml(docEl, filename) {
    const html =
      '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"/><title>' +
      filename.replace(/\.[^.]+$/, '') +
      '</title><style>' +
      DOC_STYLES +
      '</style></head><body>' +
      docEl.outerHTML +
      '</body></html>';
    triggerDownload(new Blob([html], { type: 'text/html;charset=utf-8' }), filename.replace(/\.pdf$/i, '.html'));
  }

  async function download(docEl, filename) {
    if (!docEl) throw new Error('empty');
    if (libsReady()) {
      try {
        const blob = await renderPdfBlob(docEl);
        triggerDownload(blob, filename);
        return { format: 'pdf' };
      } catch (e) {
        console.warn('PdfExport pdf failed', e);
      }
    }
    downloadHtml(docEl, filename);
    return { format: 'html' };
  }

  function buildShareText(meta) {
    const lines = [meta.title, meta.subtitle];
    if (meta.total) lines.push('合计：' + meta.total);
    lines.push('', '— 销售助手演示导出');
    return lines.join('\n');
  }

  async function forward(docEl, meta, filename) {
    const text = buildShareText(meta);
    let file = null;
    if (docEl && libsReady()) {
      try {
        const blob = await renderPdfBlob(docEl);
        if (typeof File !== 'undefined') {
          file = new File([blob], filename, { type: 'application/pdf' });
        }
      } catch (e) {
        console.warn('PdfExport share file failed', e);
      }
    }
    if (navigator.share) {
      try {
        if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({ title: meta.title, text: text, files: [file] });
          return { mode: 'share-file' };
        }
        await navigator.share({ title: meta.title, text: text });
        return { mode: 'share-text' };
      } catch (e) {
        if (e && e.name === 'AbortError') return { mode: 'cancel' };
        console.warn('PdfExport share failed', e);
      }
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return { mode: 'clipboard' };
    }
    throw new Error('no-share');
  }

  return {
    getDocEl: getDocEl,
    download: download,
    forward: forward,
    libsReady: libsReady
  };
})();
