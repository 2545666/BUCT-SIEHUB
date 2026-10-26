const { chromium } = require('../../tmp-playwright/node_modules/playwright');
const { makeUser, responseFor } = require('../ui-audit-20261022/audit-browser.cjs');
const assert = require('node:assert/strict');
const path = require('node:path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const width of [390, 1440]) {
      for (const position of ['department_head', 'youth_league_cadre', 'presidium_member', 'youth_league_deputy_secretary', 'student', 'volunteer', 'unassigned']) {
        const lead = ['department_head', 'youth_league_cadre'].includes(position);
        const member = ['student', 'volunteer'].includes(position);
        const user = makeUser(member ? position : lead ? 'lead' : 'presidium');
        if (!member && position !== 'unassigned') user.positionTitle = position;
        const allowed = member || position === 'unassigned' ? [] : lead ? [position === 'department_head' ? 'student_rights' : 'organization'] : position === 'presidium_member' ? ['student_rights', 'culture_sports_arts', 'academic_technology', 'general_office', 'new_media'] : ['organization', 'publicity', 'practice', 'volunteer_service'];
        user.moduleCapabilities = user.moduleCapabilities.map(item => ({ ...item, accessLevel: allowed.includes(item.department) ? 'manage' : 'public', capabilities: allowed.includes(item.department) ? item.capabilities : [] }));
        user.managedDepartments = user.moduleCapabilities.filter(item => allowed.includes(item.department));
        const context = await browser.newContext({ viewport: { width, height: 900 } });
        await context.addInitScript(() => {
          localStorage.setItem('siehub_auth_token_v2', 'local-audit-fixture');
          localStorage.setItem('siehub_privacy_notice_v1', 'accepted');
        });
        await context.route('**/api/**', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(responseFor(new URL(route.request().url()), user)) }));
        await context.route(/https?:\/\/(?!127\.0\.0\.1)/, route => route.abort());
        const page = await context.newPage(), errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.goto('http://127.0.0.1:5174/', { waitUntil: 'networkidle' });
        const section = page.getByRole('region', { name: '部门绩效管理', exact: true });
        assert.equal(await section.count(), member ? 0 : 1);
        if (!member) {
          assert.equal(await section.getByRole('button').count(), allowed.length);
          assert.ok((await section.boundingBox()).y < 300, 'entry must be near the top');
          if (!allowed.length) await section.getByText(/暂未配置可管理的部门/).waitFor();
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), width);
          await page.screenshot({ path: path.join(__dirname, 'browser', `home-entry-${position}-${width}.png`) });
          for (let index = 0; index < allowed.length; index++) {
            const button = section.getByRole('button').nth(index);
            assert.ok((await button.boundingBox()).height >= 44);
            await button.click();
            await page.getByRole('tablist', { name: '绩效内容' }).waitFor();
            assert.equal(new URL(page.url()).searchParams.get('module'), user.managedDepartments[index].department);
            await page.goBack({ waitUntil: 'networkidle' });
            await section.waitFor();
          }
        }
        assert.deepEqual(errors, []);
        console.log(`PASS ${position} ${width}: ${allowed.length} department entries`);
        await context.close();
      }
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
