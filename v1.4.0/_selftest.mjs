import { chromium } from 'playwright';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(root, '..');
const results = [];

function log(name, ok, detail) {
  results.push({ name, ok, detail: detail || '' });
  console.log((ok ? 'PASS' : 'FAIL') + ' ' + name + (detail ? ' — ' + detail : ''));
}

const server = http.createServer((req, res) => {
  let p = req.url.split('?')[0];
  if (p === '/') p = '/index.html';
  let fp;
  if (p === '/js/portal-base.js' || p.startsWith('/js/portal-base.js')) {
    fp = path.join(repoRoot, 'js', 'portal-base.js');
  } else if (p.startsWith('/../')) {
    fp = path.join(repoRoot, p.replace(/^\/\.\.\//, ''));
  } else {
    fp = path.join(root, p.replace(/^\//, ''));
  }
  if (!fs.existsSync(fp)) {
    res.writeHead(404);
    res.end('not found: ' + p);
    return;
  }
  const ext = path.extname(fp);
  const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css' };
  res.writeHead(200, { 'Content-Type': types[ext] || 'text/plain' });
  res.end(fs.readFileSync(fp));
});

function oldCustomerId() {
  return 'c1';
}

async function boot(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror:' + e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push('console:' + m.text());
  });
  await page.goto('http://127.0.0.1:8766/index.html#chat', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  const ready = await page.evaluate(() => ({
    Skills: !!window.Skills,
    DemoData: !!window.DemoData,
    chat: !document.querySelector('#view-chat.sc-hidden')
  }));
  if (!ready.Skills) errors.push('Skills missing');
  if (!ready.DemoData) errors.push('DemoData missing');
  if (!ready.chat) errors.push('chat hidden');
  return errors;
}

async function run() {
  await new Promise((r) => server.listen(8766, r));
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const cid = oldCustomerId();

  await page.addInitScript((customerId) => {
    window.__testErrors = [];
    window.addEventListener('error', (e) => window.__testErrors.push(e.message || String(e.error)));
    localStorage.setItem('sc_token', '1');
    localStorage.setItem(
      'sc_state',
      JSON.stringify({
        enterpriseId: 'ent-east',
        customerId: customerId,
        selectedFollowUpId: customerId,
        activeSkill: null,
        voiceSampleIdx: 0,
        ctx: {},
        flowStepId: 1
      })
    );
  }, cid);

  const bootErrors = await boot(page);
  log('页面启动', bootErrors.length === 0, bootErrors.join('; '));
  if (bootErrors.length) {
    await browser.close();
    server.close();
    process.exit(1);
  }

  // 1. 复制订单 → 确认复制 → 下单确认卡
  await page.evaluate(() => Skills.run('copy'));
  await page.waitForTimeout(700);

  // 若有需求筛选卡，点跳过
  const skipBtn = await page.$('[data-action="copy-skip-demand"]:not([disabled])');
  if (skipBtn) {
    await skipBtn.click();
    await page.waitForTimeout(600);
  }
  const pick = await page.$('[data-action="copy-pick"]:not([disabled])');
  log('复制订单出现选单', !!pick);
  if (pick) {
    await pick.click();
    await page.waitForTimeout(700);
  }

  const linePickBtn = await page.$('[data-action="copy-line-pick-confirm"]:not([disabled])');
  log('复制勾选货品卡出现', !!linePickBtn);
  if (linePickBtn) {
    await linePickBtn.click();
    await page.waitForTimeout(800);
    const after = await page.evaluate(() => {
      const cards = document.querySelectorAll('[data-spec-id="sheet-order"]');
      const card = cards[cards.length - 1];
      const msg = card && card.closest('.sc-msg');
      const stale = msg && msg.querySelector('.is-flow-stale');
      return {
        sheetCount: cards.length,
        active: !!card && !stale,
        errors: window.__testErrors || [],
        htmlLen: card ? card.outerHTML.length : 0
      };
    });
    log('勾选确认 → 下单确认卡', after.sheetCount > 0 && after.active, 'sheets=' + after.sheetCount + ' html=' + after.htmlLen);
    log('勾选确认无 JS 报错', after.errors.length === 0, after.errors.join('; '));
  } else {
    log('勾选确认 → 下单确认卡', false, '无勾选确认按钮');
  }

  // 2. 下单确认卡点「确认下单」→ 成功卡
  const submitBtn = await page.$('[data-action="order-submit"]:not([disabled])');
  if (submitBtn) {
    await page.evaluate(() => {
      const ship = document.querySelector('[data-field="ship-date"]');
      if (ship && !ship.value) ship.value = '2026-06-20';
    });
    await submitBtn.click();
    await page.waitForTimeout(600);
    const ok = await page.evaluate(() => ({
      success: !!document.querySelector('[data-spec-id="card-order-success"]'),
      errors: window.__testErrors || []
    }));
    log('确认下单 → 成功卡', ok.success, ok.errors.slice(-2).join('; '));
  } else {
    log('确认下单 → 成功卡', false, '无提交按钮');
  }

  // 3. 产品报价入口
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('sc_state') || '{}');
    s.activeSkill = null;
    s.ctx = {};
    localStorage.setItem('sc_state', JSON.stringify(s));
    window.__testErrors = [];
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await page.evaluate(() => Skills.run('quote'));
  await page.waitForTimeout(700);
  const quoteOk = await page.evaluate(() => ({
    card: !!document.querySelector(
      '[data-spec-id="card-quote-entry"], [data-spec-id="card-quote-demand"], [data-spec-id="card-quote-pick"], [data-spec-id="card-quote-source"]'
    ),
    errors: window.__testErrors || []
  }));
  log('产品报价入口', quoteOk.card, quoteOk.errors.join('; '));

  // 4. 订单变更入口
  await page.evaluate(() => {
    window.__testErrors = [];
    Skills.run('change');
  });
  await page.waitForTimeout(700);
  const changeOk = await page.evaluate(() => ({
    card: !!document.querySelector('[data-action="change-pick"], [data-spec-id="card-change-order-pick"]'),
    errors: window.__testErrors || []
  }));
  log('订单变更入口', changeOk.card, changeOk.errors.join('; '));

  // 5. 订单进度入口
  await page.evaluate(() => {
    window.__testErrors = [];
    Skills.run('progress');
  });
  await page.waitForTimeout(700);
  const progOk = await page.evaluate(() => ({
    card: !!document.querySelector('[data-action="progress-detail"], [data-action="progress-pick"], [data-spec-id="card-progress-demand"]'),
    errors: window.__testErrors || []
  }));
  log('订单进度入口', progOk.card, progOk.errors.join('; '));

  // 6. 交期评审入口
  await page.evaluate(() => {
    window.__testErrors = [];
    Skills.run('delivery');
  });
  await page.waitForTimeout(700);
  const delOk = await page.evaluate(() => ({
    card: !!document.querySelector('[data-spec-id="card-delivery-entry"], [data-spec-id="card-delivery-source"]'),
    errors: window.__testErrors || []
  }));
  log('交期评审入口', delOk.card, delOk.errors.join('; '));

  await browser.close();
  server.close();

  const failed = results.filter((r) => !r.ok);
  console.log('\n=== 合计 ' + results.length + ' 项，失败 ' + failed.length + ' 项 ===');
  if (failed.length) {
    failed.forEach((f) => console.log('  - ' + f.name + ': ' + f.detail));
  }
  process.exit(failed.length ? 1 : 0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
