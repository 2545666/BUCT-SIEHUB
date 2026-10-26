const { chromium } = require('../../tmp-playwright/node_modules/playwright');
const { makeUser, responseFor } = require('../ui-audit-20261022/audit-browser.cjs');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const out = path.join(__dirname, 'mobile-account'); fs.mkdirSync(out, { recursive: true });
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const width of process.env.UI_WIDTHS ? process.env.UI_WIDTHS.split(',').map(Number) : [320, 390, 768, 1440]) for (const role of ['student', 'presidium', 'ultimate']) {
      const user = makeUser(role); user.name = '测试成员张同学';
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      await context.addInitScript(() => { localStorage.setItem('siehub_auth_token_v2', 'local-audit-fixture'); localStorage.setItem('siehub_privacy_notice_v1', 'accepted'); });
      const reads = [], writes = [], errors = [];
      await context.route('**/api/**', route => {
        const req = route.request(), url = new URL(req.url()); reads.push(url.pathname);
        if (req.method() !== 'GET') writes.push({ path: url.pathname, body: req.postDataJSON() });
        const data = url.pathname.endsWith('/account-logs') ? { success: true, pagination: { page: 1, pages: 1, total: 1 }, logs: [{ _id: 'log', user: { name: '日志测试', studentId: '2026000001' }, success: true, reason: 'success', action: 'update_profile', resource: 'user', createdAt: '2026-10-26T06:00:00Z', ip: '127.0.0.1', userAgent: 'local browser', details: { changed: ['name'] } }] } : responseFor(url, user);
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
      });
      await context.route(/https?:\/\/(?!127\.0\.0\.1)/, route => route.abort());
      const page = await context.newPage(); page.setDefaultTimeout(10000); page.on('pageerror', err => errors.push(err.message));
      for (const [name, url] of [['home', '/'], ['directory', '/departments'], ['account', '/account']]) {
        await page.goto('http://127.0.0.1:5174' + url, { waitUntil: 'networkidle' });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), width, `${name} overflow at ${width}`);
        const identity = page.locator('.siehub-user-identity');
        assert.ok(await identity.getByText(user.name, { exact: true }).isVisible());
        assert.ok(await identity.locator('.role-pill').isVisible());
        if (width < 760) {
          assert.ok((await page.locator('.siehub-topbar').boundingBox()).height < 100);
          if (name === 'home') {
            const cards = page.locator('.siehub-product-window');
            const a = await cards.nth(0).boundingBox(), b = await cards.nth(1).boundingBox();
            assert.equal(a.y, b.y); assert.ok(a.height < 150);
            await page.getByRole('button', { name: '更多功能', exact: true }).click();
            assert.ok(await page.getByRole('button', { name: '退出登录', exact: true }).isVisible());
            await page.keyboard.press('Escape');
            assert.equal(await page.getByRole('button', { name: '更多功能', exact: true }).getAttribute('aria-expanded'), 'false');
          }
        }
        if (name === 'account') {
          assert.ok((await page.locator('.account-summary').boundingBox()).width >= 180, 'profile name squeezed');
          assert.equal(await page.getByRole('heading', { name: '登录日志' }).count(), 0);
          await page.getByLabel('姓名', { exact: true }).fill('已更新示例');
          await page.getByRole('button', { name: '保存信息', exact: true }).click();
          await page.getByText('资料已更新', { exact: true }).waitFor();
          assert.equal(writes.at(-1).body.name, '已更新示例');
          await page.getByRole('button', { name: '修改密码', exact: true }).click();
          await page.getByLabel('当前密码', { exact: true }).waitFor();
          await page.getByRole('button', { name: '个人资料', exact: true }).click();
        }
        await page.screenshot({ path: path.join(out, `${name}-${role}-${width}.png`) });
      }
      assert.equal(reads.includes('/api/my/login-logs'), false);
      if (role === 'ultimate') {
        await page.goto('http://127.0.0.1:5174/organization', { waitUntil: 'networkidle' });
        await page.getByRole('button', { name: '账号日志', exact: true }).click();
        await page.getByText('日志测试', { exact: false }).waitFor();
        await page.getByRole('button', { name: '操作记录', exact: true }).click();
        await page.getByText('update_profile · user', { exact: true }).waitFor();
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), width);
        await page.screenshot({ path: path.join(out, `audit-${width}.png`) });
      }
      assert.deepEqual(errors, []);
      console.log(`PASS ${role} ${width}: navigation, home, directory, account${role === 'ultimate' ? ', audit' : ''}`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
