/**
 * 生成 Axure 式原生 HTML 静态包（纯 HTML+CSS+JS）
 * node customer_service/scripts/generate-native-mobile-static.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../mobile-static')
const PDIR = path.join(ROOT, 'pages')

const C = {
  name: '华东精密制造有限公司',
  contact: '李经理',
  phone: '13800010001',
  code: 'CUST-2023-0108',
  tag: '超时未下单老客户',
  lastOrder: '距上次下单 62 天',
  summary: '常购 M6 紧固件与定制支架，近期需确认补货计划。',
  follow: '电话沟通备货周期，客户希望五一前收到货。',
}

/** 历史占位标签清理为 div */
function fixMotion(html) {
  return html
    .replace(/<motion(\s[^>]*)?>/g, '<div$1>')
    .replace(/<\/motion>/g, '</div>')
}

function hdr(title, trailing = '') {
  if (!trailing) {
    return `<header class="app-header"><h1 class="app-header__title">${title}</h1></header>`
  }
  return `<header class="app-header app-header--compact">
  <motion class="app-header__toolbar">
    <div class="app-header__center"><h1 class="app-header__title">${title}</h1></div>
    <div class="app-header__trailing">${trailing}</div>
  </div>
</header>`.replace(/<motion/g, '<div').replace(/<\/motion>/g, '</div>')
}

function bar() {
  return `<section class="customer-bar card">
  <div><h2>${C.name}</h2><p>${C.contact} · ${C.phone}</p></div>
  <a class="ghost-btn" href="选择客户.html" style="display:inline-flex;align-items:center;padding:0 12px;min-height:40px">换客户</a>
</section>`
}

function custCard(name, tag, href = '客户详情.html', action = '查看详情') {
  return `<article class="customer-card card">
  <div class="row"><span class="pill">${tag}</span><span class="muted">${C.lastOrder}</span></div>
  <h3>${name}</h3>
  <p class="code-line">编码 ${C.code}</p>
  <p>${C.contact} · ${C.phone}</p>
  <p class="summary">${C.summary}</p>
  <p class="follow-meta">已有 2 条跟进记录</p>
  <a class="primary-btn full-btn" href="${href}">${action}</a>
</article>`
}

function page(title, body, opts = {}) {
  const cls = ['app-shell', opts.fit && 'app-shell--fit', opts.dock && 'app-shell--dock']
    .filter(Boolean)
    .join(' ')
  const voice = opts.dock
    ? `\n    <div class="voice-dock"><input type="text" placeholder="输入消息" readonly /><button type="button" class="send">发送</button></div>`
    : ''
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <title>${title} · 智能销售助手</title>
  <link rel="stylesheet" href="../resources/css/app.css" />
  <link rel="stylesheet" href="../resources/css/pages.css" />
</head>
<body>
  <main class="${cls}">
${body}${voice}
  </main>
  <a class="axure-sitemap-fab" href="../页面目录.html" title="页面目录">目录</a>
  <script src="../resources/js/app.js"></script>
</body>
</html>`
}

const hist = `<a class="toolbar-link" href="历史报价.html">历史报价</a>`
const propHist = `<a class="toolbar-link" href="方案历史.html">历史方案</a>`

const productCard = `<section class="swipe-product card">
  <div class="swipe-product__top">
    <label style="font-size:12px;font-weight:800;color:var(--primary)"><input type="checkbox" checked /> 纳入本单</label>
    <span class="swipe-product__price">¥128/盒</span>
  </div>
  <h3>高强度内六角螺栓</h3>
  <p class="spec-box">M6 x 30 / 12.9 级</p>
  <a class="ghost-btn" href="#" style="display:inline-block;margin-bottom:8px">改配…</a>
  <div class="qty-row"><span class="muted">数量</span><div class="quantity"><button type="button">-</button><strong>10</strong><button type="button">+</button></div></div>
</section>`

const FILES = {
  '登录.html': page(
    '登录',
    `<section class="login-page"><section class="login-card card">
  <h1>智能销售助手</h1><p class="muted">企业账号登录（静态演示）</p>
  <a class="primary-btn full-btn" href="首页.html">授权登录</a>
</section></section>`,
  ),

  '首页.html': page(
    '首页',
    `${hdr('智能销售助手')}
<section class="page">
  <a class="follow-strip card" href="待跟进列表.html"><span>待跟进客户</span><strong>3 位</strong></a>
  <nav class="function-grid">
    <a class="module-btn" href="方案速配-选品.html">方案速配</a>
    <a class="module-btn" href="产品报价-选方案.html">产品报价</a>
    <a class="module-btn" href="交期评审.html">交期评审</a>
    <a class="module-btn" href="生成订单.html">生成订单</a>
    <a class="module-btn" href="订单复制.html">订单复制</a>
    <a class="module-btn" href="订单变更.html">订单变更</a>
    <a class="module-btn" href="订单进度列表.html">订单进度</a>
    <a class="module-btn" href="客户服务.html">客户服务</a>
  </nav>
  <div class="section-title"><h2>最近客户</h2></div>
  <a class="recent-card card" href="方案速配-选品.html"><strong>${C.name}</strong><span>${C.contact} · 最近访问：方案速配（选品）</span></a>
</section>`,
    { dock: true },
  ),

  '待跟进列表.html': page(
    '待跟进客户列表',
    `${hdr('待跟进客户')}
<section class="page"><div class="tabs"><button class="is-on">全部</button><button>老客户</button><button>新客户</button></div>
<section class="list">${custCard(C.name, C.tag)}${custCard('铭科自动化', '公海新客户')}</section></section>`,
    { fit: true },
  ),

  '客户开拓.html': page(
    '客户开拓',
    `${hdr('客户开拓')}<section class="page list">${custCard(C.name, C.tag)}</section>`,
    { fit: true },
  ),

  '选择客户.html': page('选择客户', `${hdr('选择客户')}<section class="page list">${custCard(C.name, C.tag, '方案速配-选品.html', '选定')}</section>`),

  '客户详情.html': page(
    '客户详情',
    `${hdr('客户详情')}
<section class="page">
  <a class="ghost-btn" href="待跟进列表.html">← 返回列表</a>
  <section class="card" style="padding:12px;margin:10px 0">
    <h2 style="margin:0 0 8px;font-size:15px">主数据</h2>
    <dl class="master-dl">
      <div class="full"><dt>客户名称</dt><dd>${C.name}</dd></div>
      <div><dt>客户编码</dt><dd>${C.code}</dd></div>
      <div><dt>联系人</dt><dd>${C.contact}</dd></div>
      <div><dt>联系电话</dt><dd>${C.phone}</dd></div>
    </dl>
  </section>
  <section class="card" style="padding:12px">
    <h2 style="margin:0 0 8px;font-size:15px">跟进 · 2 条</h2>
    <p class="muted" style="font-size:12px">2026-05-12 · 跟进中</p>
    <p style="font-size:13px">${C.follow}</p>
  </section>
  <div class="link-row"><a href="写跟进.html">写跟进</a><a href="方案速配-选品.html">方案速配</a></div>
</section>`,
    { fit: true },
  ),

  '写跟进.html': page(
    '写跟进',
    `${hdr('写跟进')}${bar()}
<section class="page card" style="padding:12px">
  <h2 style="margin:0 0 10px;font-size:15px">新增跟进</h2>
  <div class="form-grid">
    <div class="form-field"><label>联系人</label><input value="${C.contact}" /></div>
    <div class="form-field"><label>联系方式</label><input value="${C.phone}" /></div>
    <div class="form-field full"><label>跟进信息</label><textarea rows="3">${C.follow}</textarea></motion>
    <div class="form-field"><label>跟进状态</label><select><option selected>跟进中</option><option>跟进结束</option></select></div>
  </div>
  <a class="primary-btn full-btn" href="客户详情.html" style="margin-top:12px">保存</a>
</section>`,
    { fit: true },
  ),

  '方案速配-选品.html': page(
    '方案速配 · 选品',
    `${hdr('方案速配', propHist)}
<nav class="scheme-tabs card"><a class="scheme-tab is-on" href="方案速配-选品.html">选品</a><a class="scheme-tab" href="方案速配-方案.html">方案</a></nav>
<section class="page">${bar()}
  <section class="need-summary card"><strong class="need-summary__title">最新跟进记录</strong><p class="need-summary__body">${C.follow}</p></section>
  <div class="deck-head"><h2 style="margin:0;font-size:15px">推荐商品</h2><a class="ghost-btn" href="方案速配-购物车.html">购物车 2</a></div>
  ${productCard}
  <a class="primary-btn full-btn" href="方案速配-方案.html" style="margin-top:12px">生成方案</a>
</section>`,
    { fit: true },
  ),

  '方案速配-购物车.html': page(
    '方案速配 · 购物车',
    `${hdr('方案速配', propHist)}
<section class="page">${bar()}
  <div class="row"><h2 style="margin:0">购物车</h2><a class="ghost-btn" href="方案速配-选品.html">返回选品</a></div>
  <article class="cart-card card">
    <label class="cart-check"><input type="checkbox" checked /> 带入方案候选</label>
    <h3>高强度内六角螺栓</h3>
    <p class="muted">M6 x 30 · ¥128/盒 · 数量 10</p>
  </article>
  <div class="summary-line card"><span>候选勾选小计</span><strong>¥1280</strong></div>
  <a class="primary-btn full-btn" href="方案速配-方案.html" style="margin-top:12px">生成方案</a>
</section>`,
    { fit: true },
  ),

  '方案速配-方案.html': page(
    '方案速配 · 方案',
    `${hdr('方案速配', propHist)}
<nav class="scheme-tabs card"><a class="scheme-tab" href="方案速配-选品.html">选品</a><a class="scheme-tab is-on" href="方案速配-方案.html">方案</a></nav>
<section class="page">${bar()}
  <h2 style="margin:0 0 10px;font-size:15px">本单方案明细</h2>
  <article class="line-card card"><label class="line-check"><input type="checkbox" checked /><div class="line-body"><strong>高强度内六角螺栓</strong><span>M6 x 30 · 10盒 · ¥1280</span></div></label></article>
  <a class="primary-btn full-btn" href="方案PDF预览.html">保存方案并预览</a>
  <a class="ghost-btn full-btn" href="产品报价-询价.html" style="margin-top:8px;display:block;text-align:center;line-height:44px">保存方案并生成报价</a>
</section>`,
    { fit: true },
  ),

  '方案历史.html': page(
    '方案历史',
    `${hdr('方案历史')}${bar()}
<section class="page list">
  <article class="card" style="padding:14px"><strong>五月补货方案</strong><p class="muted">2026-05-10 · ¥2140 · 2 项</p>
  <motion class="link-row"><a href="方案PDF预览.html">预览</a><a href="方案速配-选品.html">变更</a></motion></article>
</section>`.replace(/<motion/g, '<div').replace(/<\/motion>/g, '</div>'),
  ),

  '方案PDF预览.html': page(
    '方案 PDF 预览',
    `${hdr('五月补货方案', '')}
<section class="page" style="padding-bottom:100px">
  <div class="pdf-frame-wrap">方案 PDF 预览区<br/>（静态原型示意）</motion>
  <div class="action-bar-fixed">
    <a class="ghost-btn" href="方案速配-方案.html">返回</a>
    <a class="primary-btn" href="产品报价-选方案.html">去报价</a>
  </div>
</section>`,
  ),

  '产品报价-选方案.html': page(
    '产品报价 · 选方案',
    `${hdr('产品报价', hist)}
<nav class="quote-flow card"><span class="quote-flow__on">① 选方案</span><span>→</span><span class="quote-flow__muted">② 询价</span></nav>
<section class="page">${bar()}
  <article class="proposal-card proposal-card--on card"><div class="proposal-card__top"><strong>五月补货方案</strong><span class="pill">2 项</span></div><p class="muted">2026-05-10 · ¥2140</p></article>
  <a class="primary-btn full-btn" href="产品报价-询价.html">进入询价</a>
</section>`,
    { fit: true },
  ),

  '产品报价-询价.html': page(
    '产品报价 · 询价',
    `${hdr('产品报价', hist)}
<nav class="quote-flow card"><span class="quote-flow__muted">① 选方案</span><span>→</span><span class="quote-flow__on">② 询价</span></nav>
<section class="page">${bar()}
  <a class="ghost-btn" href="产品报价-选方案.html">← 换方案</a>
  <div class="inquiry-table-wrap card" style="padding:8px;overflow:auto">
    <table class="inquiry-table"><thead><tr><th>货品</th><th>数</th><th>报价</th><th>小计</th></tr></thead>
    <tbody><tr><td>高强度内六角螺栓<br/><small class="muted">M6</small></td><td>10盒</td><td><input class="price-input" value="128" /></td><td>¥1280</td></tr></tbody></table>
  </div>
  <p style="text-align:right">合计 <strong style="color:var(--primary)">¥1280</strong></p>
  <a class="primary-btn full-btn" href="报价PDF预览.html">生成报价单</a>
</section>`,
    { fit: true },
  ),

  '产品报价-编辑询价.html': page(
    '产品报价 · 编辑询价',
    `${hdr('产品报价', hist)}
<nav class="quote-flow card"><span class="quote-flow__muted">① 选方案</span><span>→</span><span class="quote-flow__on">② 询价（编辑）</span></nav>
<section class="page">${bar()}
  <p class="muted" style="font-size:12px">自报价 PDF「修改报价单」进入</p>
  <div class="inquiry-table-wrap card" style="padding:8px"><table class="inquiry-table"><tbody><tr><td>高强度内六角螺栓</td><td>10盒</td><td><input class="price-input" value="125" /></td><td>¥1250</td></tr></tbody></table></div>
  <a class="primary-btn full-btn" href="报价PDF预览.html">保存并更新预览</a>
</section>`,
    { fit: true },
  ),

  '历史报价.html': page(
    '历史报价',
    `${hdr('历史报价')}${bar()}
<section class="page list">
  <article class="card" style="padding:14px"><strong>BJ202605151430</strong><p class="muted">¥1280 · 有效至 2026-05-22</p>
  <div class="link-row"><a href="报价PDF预览.html">预览</a><a href="产品报价-编辑询价.html">重新报价</a></div></article>
</section>`,
  ),

  '报价PDF预览.html': page(
    '报价 PDF 预览',
    `${hdr('BJ202605151430')}
<section class="page" style="padding-bottom:120px">
  <motion class="pdf-frame-wrap">报价单 PDF 预览区</motion>
  <div class="action-bar-fixed">
    <a class="ghost-btn" href="产品报价-编辑询价.html">修改报价单</a>
    <a class="ghost-btn" href="#">导出</a>
    <a class="ghost-btn" href="交期评审.html">交期评审</a>
    <a class="primary-btn" href="生成订单.html">直接下单</a>
  </div>
</section>`.replace(/<motion/g, '<motion').replace(/<motion/g, '<motion>'),
  ),

  '交期评审.html': page(
    '交期评审',
    `${hdr('交期评审')}${bar()}
<section class="page">
  <section class="block card"><h2 class="block-title">选择报价单</h2>
  <label class="row" style="align-items:flex-start;gap:10px"><input type="radio" name="q" checked /><div><strong>BJ202605151430</strong><br/><span class="muted">五月补货方案 · ¥1280</span></div></label></section>
  <section class="block card"><h2 class="block-title">期望交期</h2><input type="date" value="2026-06-20" style="width:100%;padding:12px;border:1px solid var(--line);border-radius:12px" /></section>
  <section class="block card prediction-pass"><p><strong>预计按期交付</strong> · 齐套</p><p class="muted">话术：当前产能可满足 6 月 20 日前发货。</p></section>
  <div class="link-row"><a href="生成订单.html">生成订单</a><a href="调整方案.html">调整方案</a><a href="插单申请.html">插单申请</a></div>
</section>`,
  ),

  '生成订单.html': page(
    '生成订单',
    `${hdr('生成订单')}${bar()}
<section class="page card" style="padding:14px">
  <p class="muted">关联报价 BJ202605151430 · 方案「五月补货方案」</p>
  <article class="line-card card"><strong>高强度内六角螺栓</strong><p class="muted">10盒 · ¥1280</p></article>
  <p style="text-align:right">合计 <strong style="color:var(--primary)">¥1280</strong></p>
  <a class="primary-btn full-btn" href="订单进度列表.html">提交创建订单</a>
</section>`,
  ),

  '调整方案.html': page('调整方案', `${hdr('调整方案')}${bar()}<section class="page card" style="padding:16px"><p>将返回方案速配继续调整行项目。</p><a class="primary-btn full-btn" href="方案速配-选品.html">进入方案速配</a></section>`),

  '插单申请.html': page(
    '插单申请',
    `${hdr('插单申请')}${bar()}
<section class="page"><motion class="form-field"><label>申请理由</label><textarea rows="4">客户现场催货，需加急排产。</textarea></motion>
<a class="primary-btn full-btn" href="首页.html">提交插单申请</a></section>`.replace(/<motion/g, '<div').replace(/<\/motion>/g, '</div>'),
  ),

  '订单复制.html': page('订单复制', `${hdr('订单复制')}${bar()}<section class="page"><article class="card" style="padding:14px"><strong>SO-2026-0042</strong><p class="muted">2026-04-20 · ¥2140</p><a class="primary-btn full-btn" href="方案速配-购物车.html">复制到购物车</a></article></section>`),

  '订单变更.html': page(
    '订单变更',
    `${hdr('订单变更')}${bar()}
<section class="page"><div class="form-field"><label>异常原因</label><select><option>交期延误</option></select></div>
<div class="form-field"><label>备注</label><textarea rows="3">客户同意延期 3 天。</textarea></div>
<a class="primary-btn full-btn" href="订单进度列表.html">确认转异常</a></section>`,
  ),

  '订单进度列表.html': page(
    '订单进度',
    `${hdr('订单进度')}${bar()}
<section class="page list">
  <a class="card" href="订单进度详情.html" style="display:block;padding:14px"><strong>SO-2026-0051</strong><p class="muted">生产中 · ¥1280</p></a>
</section>`,
  ),

  '订单进度详情.html': page(
    '订单进度详情',
    `${hdr('订单详情')}${bar()}
<section class="page card" style="padding:14px">
  <p><span class="pill">生产中</span></p>
  <h2 style="margin:12px 0">SO-2026-0051</h2>
  <p class="muted">预计发货 2026-06-18</p>
  <a class="ghost-btn full-btn" href="订单进度列表.html" style="margin-top:16px;display:block;text-align:center;line-height:44px">返回列表</a>
</section>`,
  ),

  '客户服务.html': page(
    '客户服务',
    `${hdr('客户服务')}${bar()}
<section class="page">
  <div class="form-field"><label>客户问题</label><textarea rows="4">收货数量与订单明细不一致，请协助核对。</textarea></div>
  <section class="card" style="padding:14px;margin-top:12px"><span class="pill">售后问题</span><h2 style="font-size:15px">问题摘要</h2><p class="muted">建议核对出库单与签收单，必要时发起补发流程。</p></section>
  <a class="primary-btn full-btn" href="#">发起服务工单</a>
</section>`,
  ),
}

const CATALOG = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <title>智能销售助手 · 静态页面目录</title>
  <style>
    :root { --ink: #0f172a; --muted: #64748b; --primary: #1f5eff; --line: #e2e8f0; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: "PingFang SC", "Microsoft YaHei", system-ui, sans-serif; background: #f1f5f9; color: var(--ink); }
    .wrap { max-width: 480px; margin: 0 auto; padding: 20px 16px 40px; }
    h1 { font-size: 20px; margin: 0 0 8px; }
    .lead { font-size: 14px; color: var(--muted); line-height: 1.55; margin: 0 0 20px; }
    .group { background: #fff; border-radius: 14px; padding: 14px 16px; margin-bottom: 12px; border: 1px solid var(--line); }
    .group h2 { margin: 0 0 10px; font-size: 15px; }
    ul { list-style: none; margin: 0; padding: 0; }
    li { padding: 10px 0; border-top: 1px solid #f1f5f9; }
    li:first-child { border-top: 0; padding-top: 0; }
    li a { font-weight: 700; color: var(--primary); text-decoration: none; font-size: 15px; }
    .tip { margin-top: 16px; padding: 12px; background: #eff6ff; border-radius: 10px; font-size: 13px; color: #1e40af; line-height: 1.5; }
  </style>
</head>
<body>
  <main class="wrap">
    <h1>智能销售助手 · 页面目录</h1>
    <p class="lead"><strong>Axure 式离线原型包</strong>：每屏为独立 HTML，双击 <code>pages/*.html</code> 即可查看，无需 Node、无需本地服务。右下角「目录」可返回本页。</p>
    {{SECTIONS}}
    <p class="tip">请用 Chrome / Edge 打开；勿依赖 IDE 内置预览的 file:// 限制。</p>
  </main>
</body>
</html>`

const SECTIONS = [
  ['账号', [['登录', 'pages/登录.html']]],
  [
    '工作台',
    [
      ['首页', 'pages/首页.html'],
    ],
  ],
  [
    '客户开拓',
    [
      ['待跟进客户列表', 'pages/待跟进列表.html'],
      ['客户开拓', 'pages/客户开拓.html'],
      ['选择客户', 'pages/选择客户.html'],
      ['客户详情', 'pages/客户详情.html'],
      ['写跟进', 'pages/写跟进.html'],
    ],
  ],
  [
    '方案速配',
    [
      ['选品', 'pages/方案速配-选品.html'],
      ['购物车', 'pages/方案速配-购物车.html'],
      ['方案', 'pages/方案速配-方案.html'],
      ['方案历史', 'pages/方案历史.html'],
      ['方案 PDF', 'pages/方案PDF预览.html'],
    ],
  ],
  [
    '产品报价',
    [
      ['选方案', 'pages/产品报价-选方案.html'],
      ['询价', 'pages/产品报价-询价.html'],
      ['编辑询价', 'pages/产品报价-编辑询价.html'],
      ['历史报价', 'pages/历史报价.html'],
      ['报价 PDF', 'pages/报价PDF预览.html'],
    ],
  ],
  [
    '交期与订单',
    [
      ['交期评审', 'pages/交期评审.html'],
      ['生成订单', 'pages/生成订单.html'],
      ['调整方案', 'pages/调整方案.html'],
      ['插单申请', 'pages/插单申请.html'],
      ['订单复制', 'pages/订单复制.html'],
      ['订单变更', 'pages/订单变更.html'],
      ['订单进度列表', 'pages/订单进度列表.html'],
      ['订单进度详情', 'pages/订单进度详情.html'],
    ],
  ],
  ['客户服务', [['客户服务', 'pages/客户服务.html']]],
]

function buildCatalog() {
  const html = SECTIONS.map(
    ([title, links]) => `<section class="group"><h2>${title}</h2><ul>${links
      .map(([label, href]) => `<li><a href="${href}">${label}</a></li>`)
      .join('')}</ul></section>`,
  ).join('\n    ')
  return CATALOG.replace('{{SECTIONS}}', html)
}

const INDEX = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="refresh" content="0;url=页面目录.html" />
  <title>智能销售助手 · 静态原型</title>
</head>
<body>
  <p>正在打开页面目录… <a href="页面目录.html">点此进入</a></p>
</body>
</html>`

fs.mkdirSync(PDIR, { recursive: true })
for (const [name, content] of Object.entries(FILES)) {
  fs.writeFileSync(path.join(PDIR, name), fixMotion(content), 'utf8')
  console.log('wrote', name)
}
fs.writeFileSync(path.join(ROOT, '页面目录.html'), buildCatalog(), 'utf8')
fs.writeFileSync(path.join(ROOT, 'index.html'), INDEX, 'utf8')
fs.writeFileSync(
  path.join(ROOT, 'README.md'),
  `# 智能销售助手 · 移动端静态 HTML 原型

**Axure 式离线包**：\`resources/\` 公共样式脚本 + \`pages/\` 每屏独立 HTML，**无需启动服务**。

## 入口

1. 双击 **\`页面目录.html\`**（推荐）
2. 或双击 **\`index.html\`**
3. 或进入 **\`pages/\`** 打开任意单页

## 结构

\`\`\`
mobile-static/
  index.html
  页面目录.html
  resources/
    css/app.css
    css/pages.css
    js/app.js
  pages/
    首页.html
    …
\`\`\`

## 重新生成

\`\`\`bash
node customer_service/scripts/generate-native-mobile-static.mjs
\`\`\`

（不使用 npm run build:static；与 Vue 打包产物无关。）

数据为 Mock，页面间通过 \`<a href>\` 串联。
`,
  'utf8',
)
console.log('done:', ROOT)
