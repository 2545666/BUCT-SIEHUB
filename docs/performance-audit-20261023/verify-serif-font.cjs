const { chromium } = require('../../tmp-playwright/node_modules/playwright');
const { makeUser, responseFor } = require('../ui-audit-20261022/audit-browser.cjs');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const out = path.join(__dirname, 'serif-font');
  fs.mkdirSync(out, { recursive: true });
  try {
    for (const width of [390, 1440]) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      const user = makeUser('presidium');
      await context.addInitScript(() => {
        localStorage.setItem('siehub_auth_token_v2', 'local-audit-fixture');
        localStorage.setItem('siehub_privacy_notice_v1', 'accepted');
      });
      await context.route('**/api/**', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(responseFor(new URL(route.request().url()), user)) }));
      await context.route(/https?:\/\/(?!127\.0\.0\.1)/, route => route.abort());
      const page = await context.newPage();
      const failedFonts = [];
      page.on('response', response => { if (response.url().endsWith('.woff2') && response.status() !== 200) failedFonts.push(response.url()); });
      const check = async name => {
        await page.evaluate(() => document.fonts.ready);
        const mismatches = await page.locator('body *').evaluateAll(elements => elements.filter(element => {
          if (element.closest('.katex') || !element.getClientRects().length) return false;
          const hasText = [...element.childNodes].some(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
          return (hasText || element.matches('input, select, textarea')) && !getComputedStyle(element).fontFamily.startsWith('"Noto Serif SC Variable"');
        }).map(element => `${element.tagName}.${element.className}`).slice(0, 10));
        assert.deepEqual(mismatches, [], `${name}: mixed font families`);
        const cdp = await context.newCDPSession(page);
        await cdp.send('DOM.enable'); await cdp.send('CSS.enable');
        const { root } = await cdp.send('DOM.getDocument');
        const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: 'h1, h2' });
        assert(nodeId, `${name}: heading missing`);
        const { fonts } = await cdp.send('CSS.getPlatformFontsForNode', { nodeId });
        assert(fonts.some(font => font.isCustomFont && font.familyName.includes('Noto Serif SC') && font.glyphCount > 0), `${name}: webfont not actually rendered`);
        await cdp.detach();
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), width, `${name}: overflow`);
        await page.screenshot({ path: path.join(out, `${name}-${width}.png`) });
        console.log(`PASS ${name} ${width}: consistent family and actual self-hosted font rendering`);
      };
      for (const [name, route] of [['home', '/'], ['account', '/account'], ['directory', '/departments'], ['rights', '/student-rights/'], ['academic', '/academic-technology/'], ['culture', '/culture-sports-arts/']]) {
        await page.goto('http://127.0.0.1:5174' + route, { waitUntil: 'networkidle' });
        await check(name);
      }
      await page.goto('http://127.0.0.1:5174/', { waitUntil: 'networkidle' });
      await page.getByRole('region', { name: '部门绩效管理', exact: true }).getByRole('button').click();
      await page.getByRole('tablist', { name: '绩效内容' }).waitFor();
      await check('performance');
      assert.deepEqual(failedFonts, []);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
